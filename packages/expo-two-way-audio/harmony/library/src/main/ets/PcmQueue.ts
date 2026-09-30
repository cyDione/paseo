/** Signed 16-bit little-endian chunks, owned independently of OS/JS buffers. */
export class PcmQueue {
  private chunks: Uint8Array[] = [];
  private offset: number = 0;
  private queuedBytes: number = 0;
  private limit: number;

  constructor(limit: number = 16000 * 2 * 60) {
    this.limit = limit;
  }

  get byteLength(): number {
    return this.queuedBytes;
  }

  push(bytes: Uint8Array): void {
    if (bytes.length % 2 !== 0) throw new Error("PCM must contain complete signed 16-bit samples");
    if (this.queuedBytes + bytes.length > this.limit) throw new Error("PCM playback queue is full");
    if (bytes.length === 0) return;
    this.chunks.push(new Uint8Array(bytes));
    this.queuedBytes += bytes.length;
  }

  fill(output: Uint8Array): number {
    output.fill(0);
    let written = 0;
    while (written < output.length && this.chunks.length > 0) {
      const head = this.chunks[0];
      const count = Math.min(head.length - this.offset, output.length - written);
      output.set(head.subarray(this.offset, this.offset + count), written);
      written += count;
      this.offset += count;
      this.queuedBytes -= count;
      if (this.offset === head.length) {
        this.chunks.shift();
        this.offset = 0;
      }
    }
    return written;
  }

  clear(): void {
    this.chunks = [];
    this.offset = 0;
    this.queuedBytes = 0;
  }
}

export function pcmVolume(bytes: Uint8Array): number {
  const pcm = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let squares = 0;
  for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
    const sample = pcm.getInt16(offset, true) / 32768;
    squares += sample * sample;
  }
  return bytes.length > 1 ? Math.sqrt(squares / Math.floor(bytes.length / 2)) : 0;
}
