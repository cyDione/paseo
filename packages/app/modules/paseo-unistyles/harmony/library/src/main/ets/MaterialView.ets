/**
 * `PaseoMaterialLight` / `PaseoMaterialDark`: an RN view whose background is frosted glass on
 * HarmonyOS, with an optional HDS flowing-light overlay.
 *
 * The immersive system material (`.systemMaterial()`) is **not** the effect here. It is created but
 * never activated on an arbitrary container: the engine answers every one of ours with
 * `Material inactive: out of scope. Use component in navigation title bar or Tabbar.` The material
 * only lights up inside the components it belongs to (Navigation title bar, Tabs tab bar, Dialog,
 * Toast, bindSheet, Menu, Select, Toggle, Slider, Chip, SegmentButton, SelectionMenu, …). What
 * paints this container instead is the always-available `.backgroundEffect()` — a backdrop blur
 * with an explicit radius, saturation, brightness and translucent fill — so the surface reads as
 * frosted glass on every device, and the light effect comes from an `HdsVisualComponent` overlay.
 *
 * The material is still created behind `SYSTEM_MATERIAL_ENABLED` (off): the code path and its logs
 * are kept so a future container that *is* in scope can switch it on.
 *
 * The material path also constrains the shape of this component: a material can only paint a node
 * that *contains* what should show through it, so the RN children live inside this component
 * (`ContentSlot`), and the C++ layout rect pinned on this component's frame node is the box the
 * background fills.
 *
 * This component deliberately does not use `RNViewBase`: the ArkUI node for an ArkTS component is
 * already positioned by the layout rect the C++ side sets on its wrapper, and `RNViewBase`
 * re-applies the same origin from `layoutMetrics`, which would offset anything that does not start
 * at (0, 0). It applies the corner radius (which clips the background), the border, the border
 * style and the opacity from the descriptor instead.
 */
import deviceInfo from '@ohos.deviceInfo';
import hilog from '@ohos.hilog';
import uiMaterial from '@ohos.arkui.uiMaterial';
import {
  DualEdgeFlowLightWithMaskParam,
  HdsSceneController,
  HdsSceneType,
  HdsVisualComponent,
} from '@kit.UIDesignKit';
import { ComponentBuilderContext, RNComponentContext } from '@rnoh/react-native-openharmony';
import {
  Descriptor,
  ViewDescriptorWrapperBase,
  ViewRawProps,
} from '@rnoh/react-native-openharmony/ts';

const HILOG_DOMAIN: number = 0xA100;
const HILOG_TAG: string = 'PaseoMaterial';

/**
 * The HDS visual-effect syscap. `canIUse` is the official probe: without it the overlay is skipped
 * and only the blur paints.
 */
const FLOW_LIGHT_SYSCAP: string = 'SystemCapability.UIDesign.HDSComponent.Core';

/**
 * `.systemMaterial()` is created but inactive on this container (see the file header). Off by
 * default so the engine stops logging "Material inactive: out of scope" for every surface; flip it
 * when this component moves somewhere the material is in scope.
 */
const SYSTEM_MATERIAL_ENABLED: boolean = false;

/** HDS overlay switch; the effect is only added when the device has the syscap as well. */
const FLOW_LIGHT_ENABLED: boolean = true;

/**
 * Every `uiMaterial` API is `@since 26.0.0` while the app's compatible SDK version is 23, so the
 * module and its members may be absent at runtime. `deviceInfo.sdkApiVersion` is the only version
 * probe that exists on those devices; the compiler's own suggestion (`deviceInfo.apiAvailable`)
 * is itself an API 26 API.
 */
const MATERIAL_API_VERSION: number = 26;
const UNAVAILABLE_METRIC: number = -1;

export type PaseoMaterialScheme = 'light' | 'dark';

/**
 * Built-in tints, used whenever the JS color does not arrive, so the surface is never transparent
 * by accident. Translucent by construction: an opaque fill would also hide the blur behind it.
 * Feel values, not derived from a token.
 */
const DEFAULT_TINT_LIGHT: string = '#B3FFFFFF';
const DEFAULT_TINT_DARK: string = '#66000000';
/** Those tints with the degrade diagnostic's orange mixed in (20%), as material-color.ts does. */
const DEFAULT_DEGRADED_TINT_LIGHT: string = '#B3FFE7CC';
const DEFAULT_DEGRADED_TINT_DARK: string = '#66331B00';
/** Light-effect white; dimmer on dark surfaces, like the JS mapping. */
const DEFAULT_LIGHT_EFFECT_LIGHT: string = '#80FFFFFF';
const DEFAULT_LIGHT_EFFECT_DARK: string = '#40FFFFFF';
const DEFAULT_THICKNESS: string = 'regular';

/**
 * Backdrop blur per material thickness, in vp. The radii are deliberately large — at 8vp a blur is
 * a smudge you have to look for, and the point of this surface is that the transcript behind it is
 * visibly out of focus. Saturation and brightness lift what is behind the glass on light themes and
 * calm it down on dark ones. Feel values, tuned by eye, not derived from a token.
 */
const BLUR_RADIUS_THIN: number = 16;
const BLUR_RADIUS_REGULAR: number = 28;
const BLUR_RADIUS_THICK: number = 44;
const BLUR_SATURATION_LIGHT: number = 1.6;
const BLUR_SATURATION_DARK: number = 1.4;
const BLUR_BRIGHTNESS_LIGHT: number = 1.08;
const BLUR_BRIGHTNESS_DARK: number = 0.92;

/**
 * The flowing light runs along the perimeter, one edge per half. `startPos`/`endPos` are documented
 * as "the portion of the component perimeter", so these are fractions of one lap; splitting the
 * perimeter in two keeps the lights apart, and a value that does not fit the engine's expectations
 * would simply draw the wrong arc.
 */
const FLOW_LIGHT_FIRST_START: number = 0;
const FLOW_LIGHT_FIRST_END: number = 0.5;
const FLOW_LIGHT_SECOND_START: number = 0.5;
const FLOW_LIGHT_SECOND_END: number = 1;

/**
 * Diagnostics are WARN, not INFO: a device's default global log level is `W`
 * (`param get hilog.loggable.global`), which filters `hilog.info` and `LOG(INFO)` entirely — the
 * first device run produced 12.7k log lines with no `PaseoMaterial` line in them. The `%{public}s`
 * format string is what keeps the arguments out of the `<private>` mask.
 */
function logWarning(message: string): void {
  hilog.warn(HILOG_DOMAIN, HILOG_TAG, '%{public}s', message);
}

logWarning('PaseoMaterial: module loaded');

/** Raw props sent by `material-view.harmony.tsx`. Colors are `#AARRGGBB` strings. */
export interface PaseoMaterialRawProps extends ViewRawProps {
  thickness?: string;
  materialColor?: string;
  degradedColor?: string;
  lightColor?: string;
  interactive?: boolean;
  applyShadow?: boolean;
}

/** The typed copy the `ComponentNapiBinder` ships as `descriptor.props`. */
export interface PaseoMaterialTypedProps {
  thickness?: string;
  materialColor?: string;
  degradedColor?: string;
  lightColor?: string;
  interactive?: boolean;
  applyShadow?: boolean;
}

export interface PaseoMaterialState {}

export type PaseoMaterialDescriptor = Descriptor<
  string,
  PaseoMaterialTypedProps,
  PaseoMaterialState,
  PaseoMaterialRawProps
>;

/**
 * A prop value and where it came from: the typed `descriptor.props` copy, the generic
 * `descriptor.rawProps` one, or nothing at all. Both are logged, so a delivery channel that stops
 * carrying a value is visible instead of being masked by the built-in default.
 */
interface MaterialPropValue {
  value: string | undefined;
  source: string;
}

/** Backdrop blur settings for one surface. */
interface BackdropBlurParams {
  radius: number;
  saturation: number;
  brightness: number;
}

function resolveStringProp(typed: string | undefined, raw: string | undefined): MaterialPropValue {
  if (typed !== undefined && typed.length > 0) {
    return { value: typed, source: 'props' };
  }
  if (raw !== undefined && raw.length > 0) {
    return { value: raw, source: 'rawProps' };
  }
  return { value: undefined, source: 'default' };
}

/** Which channel carried a boolean prop, or `default` when neither did. */
function resolveBooleanPropSource(typed: boolean | undefined, raw: boolean | undefined): string {
  if (typed !== undefined) {
    return 'props';
  }
  if (raw !== undefined) {
    return 'rawProps';
  }
  return 'default';
}

/**
 * Which channels carried anything at all: `props` is the typed `descriptor.props` copy from the
 * ComponentNapiBinder, `rawProps` the generic one. `none` means nothing arrived and every value came
 * from the built-in defaults.
 */
function summarizePropChannels(sources: string[]): string {
  let fromTyped = false;
  let fromRaw = false;
  for (const source of sources) {
    if (source === 'props') {
      fromTyped = true;
    } else if (source === 'rawProps') {
      fromRaw = true;
    }
  }
  if (fromTyped && fromRaw) {
    return 'props+rawProps';
  }
  if (fromTyped) {
    return 'props';
  }
  if (fromRaw) {
    return 'rawProps';
  }
  return 'none';
}

function defaultTint(scheme: PaseoMaterialScheme): string {
  return scheme === 'dark' ? DEFAULT_TINT_DARK : DEFAULT_TINT_LIGHT;
}

function defaultDegradedTint(scheme: PaseoMaterialScheme): string {
  return scheme === 'dark' ? DEFAULT_DEGRADED_TINT_DARK : DEFAULT_DEGRADED_TINT_LIGHT;
}

function defaultLightEffect(scheme: PaseoMaterialScheme): string {
  return scheme === 'dark' ? DEFAULT_LIGHT_EFFECT_DARK : DEFAULT_LIGHT_EFFECT_LIGHT;
}

function resolveBackdropBlur(
  thickness: string | undefined,
  scheme: PaseoMaterialScheme,
): BackdropBlurParams {
  let radius = BLUR_RADIUS_REGULAR;
  if (thickness === 'thin') {
    radius = BLUR_RADIUS_THIN;
  } else if (thickness === 'thick') {
    radius = BLUR_RADIUS_THICK;
  }
  return {
    radius: radius,
    saturation: scheme === 'dark' ? BLUR_SATURATION_DARK : BLUR_SATURATION_LIGHT,
    brightness: scheme === 'dark' ? BLUR_BRIGHTNESS_DARK : BLUR_BRIGHTNESS_LIGHT,
  };
}

function toImmersiveStyle(thickness: string | undefined): uiMaterial.ImmersiveStyle {
  if (thickness === 'thin') {
    return uiMaterial.ImmersiveStyle.THIN;
  }
  if (thickness === 'thick') {
    return uiMaterial.ImmersiveStyle.THICK;
  }
  return uiMaterial.ImmersiveStyle.REGULAR;
}

function toBorderStyle(style: string | undefined): BorderStyle {
  if (style === 'dotted') {
    return BorderStyle.Dotted;
  }
  if (style === 'dashed') {
    return BorderStyle.Dashed;
  }
  return BorderStyle.Solid;
}

function isMaterialApiAvailable(): boolean {
  return deviceInfo.sdkApiVersion >= MATERIAL_API_VERSION;
}

function isFlowLightAvailable(): boolean {
  return FLOW_LIGHT_ENABLED && canIUse(FLOW_LIGHT_SYSCAP);
}

/**
 * The material for one configuration, or `undefined` when it is disabled or unsupported. Only used
 * while `SYSTEM_MATERIAL_ENABLED` is on; the color always has a value, the JS one or the built-in
 * tint.
 */
function createMaterial(
  thickness: string,
  tintColor: string,
  lightColor: string,
  interactive: boolean,
  applyShadow: boolean,
): uiMaterial.Material | undefined {
  if (
    !SYSTEM_MATERIAL_ENABLED ||
    !isMaterialApiAvailable() ||
    !uiMaterial.isImmersiveMaterialSupported()
  ) {
    return undefined;
  }
  const lightEffect: uiMaterial.LightEffectOptions = { color: lightColor };
  const options: uiMaterial.ImmersiveOptions = {
    style: toImmersiveStyle(thickness),
    materialColor: tintColor,
    colorInvert: true,
    applyShadow: applyShadow,
    interactive: interactive,
    lightEffect: lightEffect,
  };
  return new uiMaterial.ImmersiveMaterial(options);
}

/**
 * The flowing-light overlay stops before it runs: the caller starts it once the component is
 * attached, and a fresh controller carries fresh colors.
 */
function createFlowLightController(maskColor: string, flowColor: string): HdsSceneController {
  const params: DualEdgeFlowLightWithMaskParam = {
    backgroundMaskColors: [maskColor],
    firstEdgeFlowLight: {
      startPos: FLOW_LIGHT_FIRST_START,
      endPos: FLOW_LIGHT_FIRST_END,
      color: flowColor,
    },
    secondEdgeFlowLight: {
      startPos: FLOW_LIGHT_SECOND_START,
      endPos: FLOW_LIGHT_SECOND_END,
      color: flowColor,
    },
  };
  const controller = new HdsSceneController();
  controller.setSceneParams(params);
  return controller;
}

/**
 * The backdrop blur, the fill, the corner radius that clips them, the border the RN style asked for
 * and the material (when enabled) all belong to the same node, so they are applied by one modifier.
 * A new instance is set on every descriptor change, which is what makes ArkUI apply it again.
 */
class PaseoMaterialAttributeModifier implements AttributeModifier<StackAttribute> {
  private readonly descriptor: PaseoMaterialDescriptor;
  private readonly material: uiMaterial.Material | undefined;
  private readonly fillColor: string;
  private readonly blur: BackdropBlurParams;

  constructor(
    descriptor: PaseoMaterialDescriptor,
    material: uiMaterial.Material | undefined,
    fillColor: string,
    blur: BackdropBlurParams,
  ) {
    this.descriptor = descriptor;
    this.material = material;
    this.fillColor = fillColor;
    this.blur = blur;
  }

  applyNormalAttribute(instance: StackAttribute): void {
    const view = new ViewDescriptorWrapperBase(this.descriptor);
    const radius = view.borderRadius;
    const radiuses: BorderRadiuses = {
      topLeft: radius.topLeft,
      topRight: radius.topRight,
      bottomLeft: radius.bottomLeft,
      bottomRight: radius.bottomRight,
    };
    instance.borderRadius(radiuses);
    const width = view.borderWidth;
    const widths: EdgeWidths = {
      top: width.top,
      right: width.right,
      bottom: width.bottom,
      left: width.left,
    };
    instance.borderWidth(widths);
    const color = view.borderColor;
    const colors: EdgeColors = {
      top: color.top,
      right: color.right,
      bottom: color.bottom,
      left: color.left,
    };
    instance.borderColor(colors);
    instance.borderStyle(toBorderStyle(view.borderStyle));
    const opacity = view.opacity;
    if (opacity !== 1) {
      instance.opacity(opacity);
    }
    // The blur and the translucent fill are unconditional: they are what makes the surface frosted
    // glass, and unlike the system material they work on any container. The fill must stay
    // translucent — an opaque color would hide the blur behind it.
    const effect: BackgroundEffectOptions = {
      radius: this.blur.radius,
      saturation: this.blur.saturation,
      brightness: this.blur.brightness,
      color: this.fillColor,
      adaptiveColor: AdaptiveColor.DEFAULT,
    };
    instance.backgroundEffect(effect);
    if (this.material !== undefined) {
      instance.systemMaterial(this.material);
    }
  }
}

/** What the summary line reports; see docs/harmony.md for how to read it. */
interface MaterialAppearSummary {
  viewName: string;
  scheme: PaseoMaterialScheme;
  thickness: string;
  tintColor: string;
  tintSource: string;
  channels: string;
  blur: BackdropBlurParams;
  flowLight: boolean;
}

/**
 * One summary line per view instance, plus one effect line. Both are printed while the component
 * appears (the first descriptor read happens in `aboutToAppear`) and never per descriptor update:
 * two WARN lines per surface are enough to answer "did the component exist, did the props arrive,
 * what exactly is painting it".
 */
function logAppearSummary(input: MaterialAppearSummary): void {
  const supported: boolean =
    isMaterialApiAvailable() && uiMaterial.isImmersiveMaterialSupported();
  const level: number = isMaterialApiAvailable() ? uiMaterial.getGlobalMaterialLevel() : UNAVAILABLE_METRIC;
  const state: number = isMaterialApiAvailable() ? uiMaterial.getMaterialInfo().state : UNAVAILABLE_METRIC;
  logWarning(
    `PaseoMaterial: appear name=${input.viewName} supported=${supported} level=${level} state=${state}` +
      ` propsReceived=${input.channels} materialColor=${input.tintColor}(from=${input.tintSource})` +
      ` style=${input.thickness}`,
  );
  logWarning(
    `PaseoMaterial: effect blur=radius:${input.blur.radius},saturation:${input.blur.saturation},brightness:${input.blur.brightness}` +
      ` flowLight=${input.flowLight} systemMaterial=${SYSTEM_MATERIAL_ENABLED ? 'called' : 'skipped(flag)'}`,
  );
}

@Builder
export function buildPaseoMaterialLight(ctx: ComponentBuilderContext) {
  PaseoMaterialView({
    ctx: ctx.rnComponentContext,
    tag: ctx.tag,
    defaultScheme: 'light',
  });
}

@Builder
export function buildPaseoMaterialDark(ctx: ComponentBuilderContext) {
  PaseoMaterialView({
    ctx: ctx.rnComponentContext,
    tag: ctx.tag,
    defaultScheme: 'dark',
  });
}

@Component
export struct PaseoMaterialView {
  public static readonly LIGHT_NAME: string = 'PaseoMaterialLight';
  public static readonly DARK_NAME: string = 'PaseoMaterialDark';
  public ctx!: RNComponentContext;
  public tag: number = 0;
  /**
   * The tint scheme this component name stands for. It is the one signal left when the props do not
   * arrive, so it decides the built-in tint.
   */
  public defaultScheme: PaseoMaterialScheme = 'light';
  @State private modifier: PaseoMaterialAttributeModifier | undefined = undefined;
  @State private flowLightController: HdsSceneController | undefined = undefined;
  @State private flowLightEnabled: boolean = false;
  private cleanUpCallbacks: (() => void)[] = [];
  private summaryLogged: boolean = false;
  private flowLightKey: string = '';
  private flowLightFinishLogged: boolean = false;

  aboutToAppear(): void {
    this.flowLightEnabled = isFlowLightAvailable();
    this.onDescriptorChange(this.ctx.descriptorRegistry.getDescriptor<PaseoMaterialDescriptor>(this.tag));
    this.cleanUpCallbacks.push(
      this.ctx.descriptorRegistry.subscribeToDescriptorChanges(this.tag, (descriptor: Descriptor) => {
        this.onDescriptorChange(descriptor as PaseoMaterialDescriptor);
      }),
    );
  }

  aboutToDisappear(): void {
    this.stopFlowLight();
    this.cleanUpCallbacks.forEach((callback: () => void) => callback());
  }

  private viewName(): string {
    return this.defaultScheme === 'dark' ? PaseoMaterialView.DARK_NAME : PaseoMaterialView.LIGHT_NAME;
  }

  /**
   * The scene callback is the only runtime signal the HDS component offers. It is logged once: if
   * the engine refuses the scene the way it refuses `.systemMaterial()` out of scope, this line
   * either never comes or comes immediately, and the difference is the evidence.
   */
  private onFlowLightFinished(): void {
    if (this.flowLightFinishLogged) {
      return;
    }
    this.flowLightFinishLogged = true;
    logWarning(`PaseoMaterial: flowLight finished name=${this.viewName()}`);
  }

  private stopFlowLight(): void {
    if (this.flowLightController !== undefined) {
      this.flowLightController.stop();
      this.flowLightController = undefined;
    }
  }

  private onDescriptorChange(descriptor: PaseoMaterialDescriptor): void {
    if (descriptor === undefined) {
      return;
    }
    const rawProps: PaseoMaterialRawProps = descriptor.rawProps;
    const typedProps: PaseoMaterialTypedProps = descriptor.props;
    const thicknessProp = resolveStringProp(typedProps.thickness, rawProps.thickness);
    const thickness: string = thicknessProp.value ?? DEFAULT_THICKNESS;
    const tint = resolveStringProp(typedProps.materialColor, rawProps.materialColor);
    const degraded = resolveStringProp(typedProps.degradedColor, rawProps.degradedColor);
    const light = resolveStringProp(typedProps.lightColor, rawProps.lightColor);
    const interactive: boolean = typedProps.interactive ?? rawProps.interactive ?? false;
    const applyShadow: boolean = typedProps.applyShadow ?? rawProps.applyShadow ?? true;
    const tintColor: string = tint.value ?? defaultTint(this.defaultScheme);
    const lightColor: string = light.value ?? defaultLightEffect(this.defaultScheme);
    const blur: BackdropBlurParams = resolveBackdropBlur(thicknessProp.value, this.defaultScheme);
    const material = createMaterial(thickness, tintColor, lightColor, interactive, applyShadow);
    // The degraded fill is the same tint with the diagnostic orange mixed in, and it only means
    // something on the material path: it marks a device that could not render a material we asked
    // for. With the material switched off there is nothing to diagnose, so the tint is the fill.
    const fillColor: string = SYSTEM_MATERIAL_ENABLED && material === undefined
      ? (degraded.value ?? defaultDegradedTint(this.defaultScheme))
      : tintColor;
    this.modifier = new PaseoMaterialAttributeModifier(descriptor, material, fillColor, blur);
    this.updateFlowLight(tintColor, lightColor);
    if (!this.summaryLogged) {
      this.summaryLogged = true;
      logAppearSummary({
        viewName: this.viewName(),
        scheme: this.defaultScheme,
        thickness: thickness,
        tintColor: tintColor,
        tintSource: tint.source,
        channels: summarizePropChannels([
          thicknessProp.source,
          tint.source,
          degraded.source,
          light.source,
          resolveBooleanPropSource(typedProps.interactive, rawProps.interactive),
          resolveBooleanPropSource(typedProps.applyShadow, rawProps.applyShadow),
        ]),
        blur: blur,
        flowLight: this.flowLightEnabled,
      });
    }
  }

  /** Rebuild the scene only when its colors change; a running controller is stopped first. */
  private updateFlowLight(maskColor: string, flowColor: string): void {
    const key = `${this.flowLightEnabled}|${maskColor}|${flowColor}`;
    if (key === this.flowLightKey) {
      return;
    }
    this.flowLightKey = key;
    this.stopFlowLight();
    if (!this.flowLightEnabled) {
      return;
    }
    const controller = createFlowLightController(maskColor, flowColor);
    this.flowLightController = controller;
    controller.start();
  }

  build() {
    Stack() {
      ContentSlot(this.ctx.getContentForTag(this.tag));
      if (this.flowLightController !== undefined) {
        // Decoration on top of the RN content: it must not take a single touch away from it. The
        // controller's existence is the condition — it is only created when the syscap is there.
        HdsVisualComponent()
          .scene(
            HdsSceneType.DUAL_EDGE_FLOW_LIGHT_WITH_BACKGROUND_MASK,
            this.flowLightController,
            () => this.onFlowLightFinished(),
          )
          .width('100%')
          .height('100%')
          .hitTestBehavior(HitTestMode.None)
      }
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .attributeModifier(this.modifier);
  }
}
