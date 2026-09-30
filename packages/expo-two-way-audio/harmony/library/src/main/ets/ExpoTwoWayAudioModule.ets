import { audio } from '@kit.AudioKit';
import { ExpoFunction, ExpoModule, ExpoModuleDefinition, ExpoPermissionStatus, ExpoValueTypes }
  from '@expo-harmony/expo-modules-core';
import { PcmQueue, pcmVolume } from './PcmQueue';

const BYTES_PER_SECOND = 16000 * 2;


class MicrophonePermission {
  status: string;
  granted: boolean;
  expires: string = 'never';
  canAskAgain: boolean;
  constructor(status: ExpoPermissionStatus) {
    this.granted = status === ExpoPermissionStatus.GRANTED;
    this.status = this.granted ? 'granted'
      : status === ExpoPermissionStatus.NOT_DETERMINED ? 'undetermined' : 'denied';
    this.canAskAgain = status !== ExpoPermissionStatus.DENIED;
  }
}

export class ExpoTwoWayAudioModule extends ExpoModule {
  private renderer?: audio.AudioRenderer;
  private capturer?: audio.AudioCapturer;
  private operations: Promise<void> = Promise.resolve();
  private queue: PcmQueue = new PcmQueue();
  private recording: boolean = false;
  private paused: boolean = false;
  private bypass: boolean = false;
  private playbackDeadline: number = 0;
  private destroyed: boolean = false;

  override definition(): ExpoModuleDefinition {
    return new ExpoModuleDefinition().name('ExpoTwoWayAudio')
      .events(['onMicrophoneData', 'onInputVolumeLevelData', 'onOutputVolumeLevelData',
        'onRecordingChange', 'onAudioInterruption'])
      .asyncFunction('initialize', async (): Promise<boolean> => {
        await this.enqueue(async (): Promise<void> => {
          if (this.destroyed) throw new Error('The audio module has been destroyed');
          await this.ensureRenderer();
        });
        return true;
      })
      .syncFunction('toggleRecording', ExpoFunction.typed1(ExpoValueTypes.boolean(),
        (enabled: boolean): boolean => this.toggleRecording(enabled)))
      .syncFunction('isRecording', (): boolean => this.recording)
      .syncFunction('playPCMData', ExpoFunction.typed1(ExpoValueTypes.uint8Array(),
        (bytes: Uint8Array): void => this.playPCM(bytes)))
      .syncFunction('isPlaying', (): boolean =>
        !this.paused && (this.queue.byteLength > 0 || Date.now() < this.playbackDeadline))
      .syncFunction('pausePlayback', (): void => {
        this.paused = true;
        this.enqueue(async (): Promise<void> => {
          if (this.renderer?.state === audio.AudioState.STATE_RUNNING) await this.renderer.pause();
        });
      })
      .syncFunction('resumePlayback', (): void => {
        this.paused = false;
        this.enqueue(async (): Promise<void> => {
          if (this.queue.byteLength > 0) await this.startRenderer();
        });
      })
      .syncFunction('stopPlayback', (): void => this.stopPlayback())
      .syncFunction('releaseAudioSession', (): void => {
        if (!this.recording && this.queue.byteLength === 0) this.stopPlayback();
      })
      .syncFunction('bypassVoiceProcessing', ExpoFunction.typed1(ExpoValueTypes.boolean(),
        (bypass: boolean): void => {
          if (this.bypass === bypass) return;
          this.bypass = bypass;
          this.enqueue(async (): Promise<void> => {
            await this.releaseCapturer();
            if (this.recording) await this.startCapturer();
          });
        }))
      .syncFunction('tearDown', (): void => this.tearDown())
      .syncFunction('restart', (): void => {
        this.paused = false;
        this.enqueue(async (): Promise<void> => {
          if (this.recording) await this.startCapturer();
          if (this.queue.byteLength > 0) await this.startRenderer();
        });
      })
      .asyncFunction('getMicrophonePermissionsAsync', async (): Promise<MicrophonePermission> =>
        this.microphonePermission())
      .asyncFunction('requestMicrophonePermissionsAsync', async (): Promise<MicrophonePermission> => {
        await this.appContext.requestPermissions(['ohos.permission.MICROPHONE']);
        return this.microphonePermission();
      })
      .syncFunction('getMicrophoneModeIOS', (): void => {
        throw new Error('getMicrophoneModeIOS is only supported on iOS');
      })
      .syncFunction('setMicrophoneModeIOS', (): void => {
        throw new Error('setMicrophoneModeIOS is only supported on iOS');
      })
      .onBackground((): void => this.interrupt())
      .onDestroy((): void => { this.destroyed = true; this.tearDown(); });
  }

  private microphonePermission(): MicrophonePermission {
    return new MicrophonePermission(this.appContext.permissionStatus('ohos.permission.MICROPHONE'));
  }

  // Preserve the synchronous JS API while serializing asynchronous OS state changes.
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const task = this.operations.then(operation);
    this.operations = task.catch(async (): Promise<void> => {
      this.recording = false;
      this.paused = true;
      this.queue.clear(); this.playbackDeadline = 0;
      const renderer = this.renderer; this.renderer = undefined;
      const capturer = this.capturer; this.capturer = undefined;
      // Failed stop/start operations must not enqueue another failing stop forever.
      const releases: Promise<void>[] = [];
      if (renderer !== undefined) releases.push(renderer.release());
      if (capturer !== undefined) releases.push(capturer.release());
      await Promise.allSettled(releases);
      if (!this.destroyed) {
        this.sendEvent('onRecordingChange', { data: false });
        this.sendEvent('onAudioInterruption', { data: 'blocked' });
      }
    });
    return task;
  }

  private async ensureRenderer(): Promise<void> {
    if (this.renderer !== undefined) return;
    const renderer = await audio.createAudioRenderer({
      streamInfo: { samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000,
        channels: audio.AudioChannel.CHANNEL_1, sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
        encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW },
      rendererInfo: { usage: audio.StreamUsage.STREAM_USAGE_VOICE_COMMUNICATION, rendererFlags: 0 },
    });
    renderer.on('writeData', (buffer: ArrayBuffer): audio.AudioDataCallbackResult => this.fillOutput(buffer));
    renderer.on('audioInterrupt', (event: audio.InterruptEvent): void => {
      if (event.hintType === audio.InterruptHint.INTERRUPT_HINT_STOP
        || event.hintType === audio.InterruptHint.INTERRUPT_HINT_PAUSE) this.interrupt();
    });
    this.renderer = renderer;
  }

  private async startRenderer(): Promise<void> {
    await this.ensureRenderer();
    if (this.renderer !== undefined && this.renderer.state !== audio.AudioState.STATE_RUNNING) {
      await this.renderer.start();
    }
  }

  private async startCapturer(): Promise<void> {
    if (!this.microphonePermission().granted) throw new Error('Microphone permission is required');
    if (this.capturer === undefined) {
      const capturer = await audio.createAudioCapturer({
        streamInfo: { samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000,
          channels: audio.AudioChannel.CHANNEL_1, sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
          encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW },
        capturerInfo: { source: this.bypass ? audio.SourceType.SOURCE_TYPE_UNPROCESSED
          : audio.SourceType.SOURCE_TYPE_VOICE_COMMUNICATION, capturerFlags: 0 },
      });
      capturer.on('readData', (buffer: ArrayBuffer): void => {
        if (!this.recording || this.destroyed) return;
        // The OS owns buffer; retain a copy for the typed event bridge.
        const bytes = new Uint8Array(new Uint8Array(buffer));
        this.sendEvent('onMicrophoneData', { data: bytes });
        this.sendEvent('onInputVolumeLevelData', { data: pcmVolume(bytes) });
      });
      capturer.on('audioInterrupt', (event: audio.InterruptEvent): void => {
        if (event.hintType === audio.InterruptHint.INTERRUPT_HINT_STOP
          || event.hintType === audio.InterruptHint.INTERRUPT_HINT_PAUSE) this.interrupt();
      });
      this.capturer = capturer;
    }
    if (this.capturer.state !== audio.AudioState.STATE_RUNNING) await this.capturer.start();
  }

  private toggleRecording(enabled: boolean): boolean {
    if (enabled && !this.microphonePermission().granted) return false;
    this.recording = enabled;
    this.enqueue(async (): Promise<void> => {
      if (this.recording) await this.startCapturer();
      else if (this.capturer?.state === audio.AudioState.STATE_RUNNING) await this.capturer.stop();
      if (!this.destroyed) this.sendEvent('onRecordingChange', { data: this.recording });
    });
    return enabled;
  }

  private playPCM(bytes: Uint8Array): void {
    if (this.destroyed) throw new Error('The audio module has been destroyed');
    this.queue.push(bytes);
    this.enqueue(async (): Promise<void> => {
      if (!this.paused && this.queue.byteLength > 0) await this.startRenderer();
    });
  }

  private fillOutput(buffer: ArrayBuffer): audio.AudioDataCallbackResult {
    const output = new Uint8Array(buffer);
    output.fill(0);
    if (this.paused || this.destroyed || this.queue.byteLength === 0) return audio.AudioDataCallbackResult.INVALID;
    const written = this.queue.fill(output);
    this.playbackDeadline = Date.now() + written / BYTES_PER_SECOND * 1000;
    this.sendEvent('onOutputVolumeLevelData', { data: pcmVolume(output) });
    return audio.AudioDataCallbackResult.VALID;
  }

  private stopPlayback(): void {
    this.queue.clear(); this.playbackDeadline = 0;
    this.enqueue(async (): Promise<void> => {
      if (this.renderer?.state === audio.AudioState.STATE_RUNNING
        || this.renderer?.state === audio.AudioState.STATE_PAUSED) await this.renderer.stop();
    });
  }

  private interrupt(): void {
    this.recording = false; this.paused = true;
    this.stopPlayback();
    this.enqueue(async (): Promise<void> => this.releaseCapturer());
    if (!this.destroyed) {
      this.sendEvent('onRecordingChange', { data: false });
      this.sendEvent('onAudioInterruption', { data: 'blocked' });
    }
  }

  private async releaseCapturer(): Promise<void> {
    const capturer = this.capturer; this.capturer = undefined;
    if (capturer !== undefined) await capturer.release();
  }

  private tearDown(): void {
    this.recording = false; this.stopPlayback();
    this.enqueue(async (): Promise<void> => {
      await this.releaseCapturer();
      const renderer = this.renderer; this.renderer = undefined;
      if (renderer !== undefined) await renderer.release();
    });
  }
}
