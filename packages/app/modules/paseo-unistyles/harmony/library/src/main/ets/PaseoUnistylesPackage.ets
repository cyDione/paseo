import { ComponentBuilderContext, RNOHPackage, TurboModulesFactory, TurboModule, TurboModuleContext }
  from '@rnoh/react-native-openharmony';
import { buildPaseoMaterialView, PaseoMaterialView } from './MaterialView';

interface WindowInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

class UnistylesWindow extends TurboModule {
  private removeInsetsListener: () => void;
  private statusHidden: boolean = false;
  private navigationHidden: boolean = false;
  private destroyed: boolean = false;

  constructor(ctx: TurboModuleContext) {
    super(ctx);
    this.removeInsetsListener = ctx.safeAreaInsetsProvider.eventEmitter.subscribe(
      'SAFE_AREA_INSETS_CHANGE', (): void => {
        ctx.rnInstance.emitDeviceEvent('paseoWindowInsetsChanged', this.getInsets());
      });
    ctx.safeAreaInsetsProvider.ready.then((): void => {
      if (!this.destroyed) ctx.rnInstance.emitDeviceEvent('paseoWindowInsetsChanged', this.getInsets());
    });
  }

  getInsets(): WindowInsets {
    return this.ctx.safeAreaInsetsProvider.safeAreaInsets;
  }

  async setWindowStyle(command: string, value: number): Promise<void> {
    const target = await this.ctx.rnInstance.getRNWindow();
    if (command === 'background') {
      target.setWindowBackgroundColor(`#${(value >>> 0).toString(16).padStart(8, '0')}`);
      return;
    }
    if (command === 'status') this.statusHidden = value !== 0;
    else if (command === 'navigation') this.navigationHidden = value !== 0;
    else if (command === 'immersive') {
      this.statusHidden = value !== 0;
      this.navigationHidden = value !== 0;
      await target.setWindowLayoutFullScreen(value !== 0);
    } else throw new Error(`Unknown window style command: ${command}`);
    const bars: Array<'status' | 'navigation'> = [];
    if (!this.statusHidden) bars.push('status');
    if (!this.navigationHidden) bars.push('navigation');
    await target.setWindowSystemBarEnable(bars);
  }

  override __onDestroy__(): void {
    this.destroyed = true;
    this.removeInsetsListener();
  }
}

class UnistylesFactory extends TurboModulesFactory {
  override createTurboModule(name: string): TurboModule | null {
    return name === 'Unistyles' ? new UnistylesWindow(this.ctx) : null;
  }
  override hasTurboModule(name: string): boolean { return name === 'Unistyles'; }
}

export class PaseoUnistylesPackage extends RNOHPackage {
  override createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new UnistylesFactory(ctx);
  }

  // The ArkTS side of the material view. C++ registers only its descriptor and view config
  // (cpp/material/MaterialRegistration.cpp), so the mounting manager builds this component.
  override createWrappedCustomRNComponentBuilderByComponentNameMap():
    Map<string, WrappedBuilder<[ComponentBuilderContext]>> {
    return new Map<string, WrappedBuilder<[ComponentBuilderContext]>>()
      .set(PaseoMaterialView.NAME, wrapBuilder(buildPaseoMaterialView));
  }
}
