/**
 * `PaseoMaterialLight` / `PaseoMaterialDark`: an RN view whose background is an ArkUI system
 * material, with a visible frosted-glass fallback that does not depend on the material or on the
 * props arriving.
 *
 * The material is a node attribute, so it can only paint a node that *contains* what should show
 * through it — that is also what `colorInvert` needs, since it adapts the colors of the node's
 * subtree. The RN children therefore live inside this component (`ContentSlot`), and the C++ layout
 * rect pinned on this component's frame node is the box the material fills.
 *
 * This component deliberately does not use `RNViewBase`: the ArkUI node for an ArkTS component is
 * already positioned by the layout rect the C++ side sets on its wrapper, and `RNViewBase`
 * re-applies the same origin from `layoutMetrics`, which would offset anything that does not start
 * at (0, 0). It applies the view properties the material surfaces need (corner radius, border,
 * opacity) from the descriptor instead.
 */
import deviceInfo from '@ohos.deviceInfo';
import hilog from '@ohos.hilog';
import uiMaterial from '@ohos.arkui.uiMaterial';
import { ComponentBuilderContext, RNComponentContext } from '@rnoh/react-native-openharmony';
import {
  Descriptor,
  ViewDescriptorWrapperBase,
  ViewBaseProps,
  ViewRawProps,
} from '@rnoh/react-native-openharmony/ts';

const HILOG_DOMAIN: number = 0xA100;
const HILOG_TAG: string = 'PaseoMaterial';

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
 * Built-in tints, used whenever the JS color does not arrive. They are the difference between
 * "invisible" and "frosted glass": an unset material color is transparent, so a surface that relies
 * on the props alone disappears completely when the props do. Both are translucent by construction
 * — an opaque fill would also block the material's own filter. Feel values, not derived from a
 * token; `material-color.ts` sends the same order of magnitude for the themes.
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

function resolveStringProp(typed: string | undefined, raw: string | undefined): MaterialPropValue {
  if (typed !== undefined && typed.length > 0) {
    return { value: typed, source: 'props' };
  }
  if (raw !== undefined && raw.length > 0) {
    return { value: raw, source: 'rawProps' };
  }
  return { value: undefined, source: 'default' };
}

/**
 * Which channels carried anything at all: `props` is the typed `descriptor.props` copy from the
 * ComponentNapiBinder, `rawProps` the generic one. `none` means nothing arrived and every value
 * below came from the built-in defaults.
 */
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

function toImmersiveStyle(thickness: string | undefined): uiMaterial.ImmersiveStyle {
  if (thickness === 'thin') {
    return uiMaterial.ImmersiveStyle.THIN;
  }
  if (thickness === 'thick') {
    return uiMaterial.ImmersiveStyle.THICK;
  }
  return uiMaterial.ImmersiveStyle.REGULAR;
}

/**
 * The backdrop blur is not the material and does not depend on it: it is applied on every path, so
 * the surface is frosted even where the material only recolors the node (the low-computing-power
 * level) or does not exist at all.
 */
function toBlurStyle(thickness: string | undefined): BlurStyle {
  if (thickness === 'thin') {
    return BlurStyle.Thin;
  }
  if (thickness === 'thick') {
    return BlurStyle.Thick;
  }
  return BlurStyle.Regular;
}

function isMaterialApiAvailable(): boolean {
  return deviceInfo.sdkApiVersion >= MATERIAL_API_VERSION;
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

/**
 * Builds the material for one configuration, or `undefined` when this device cannot render it. The
 * color always has a value: the JS one when it arrived, the built-in tint otherwise.
 */
function createMaterial(
  thickness: string,
  tintColor: string,
  lightColor: string,
  interactive: boolean,
  applyShadow: boolean,
): uiMaterial.Material | undefined {
  if (!isMaterialApiAvailable() || !uiMaterial.isImmersiveMaterialSupported()) {
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
 * The material, the corner radius that clips it, the border the RN style asked for and the backdrop
 * blur all belong to the same node, so they are applied by one modifier. A new instance is set on
 * every descriptor change, which is what makes ArkUI apply it again.
 */
class PaseoMaterialAttributeModifier implements AttributeModifier<StackAttribute> {
  private readonly descriptor: PaseoMaterialDescriptor;
  private readonly material: uiMaterial.Material | undefined;
  private readonly fillColor: string;
  private readonly blurStyle: BlurStyle;

  constructor(
    descriptor: PaseoMaterialDescriptor,
    material: uiMaterial.Material | undefined,
    fillColor: string,
    blurStyle: BlurStyle,
  ) {
    this.descriptor = descriptor;
    this.material = material;
    this.fillColor = fillColor;
    this.blurStyle = blurStyle;
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
    // The blur and the translucent fill are unconditional: they are what makes the surface visible
    // as frosted glass. The material is an enhancement on top of them, never the only thing that
    // paints — an unsupported material or a color that never arrived would leave the surface
    // completely transparent.
    instance.backgroundBlurStyle(this.blurStyle);
    instance.backgroundColor(this.fillColor);
    if (this.material !== undefined) {
      instance.systemMaterial(this.material);
    }
  }
}

/**
 * One summary line per view instance, plus the material's own verdict. Both are printed while the
 * component appears (the first descriptor read happens in `aboutToAppear`) and never per descriptor
 * update: two WARN lines per surface are enough to answer "did the component exist, did the props
 * arrive, was the material applied" on a device whose log level filters everything below W.
 */
/** What the summary line reports; see docs/harmony.md for how to read it. */
interface MaterialAppearSummary {
  viewName: string;
  scheme: PaseoMaterialScheme;
  thickness: string;
  tintColor: string;
  tintSource: string;
  channels: string;
  blurStyle: BlurStyle;
}

function logAppearSummary(input: MaterialAppearSummary): void {
  const supported: boolean = isMaterialApiAvailable() && uiMaterial.isImmersiveMaterialSupported();
  const level: number = isMaterialApiAvailable() ? uiMaterial.getGlobalMaterialLevel() : UNAVAILABLE_METRIC;
  const state: number = isMaterialApiAvailable() ? uiMaterial.getMaterialInfo().state : UNAVAILABLE_METRIC;
  logWarning(
    `PaseoMaterial: appear name=${input.viewName} supported=${supported} level=${level} state=${state}` +
      ` propsReceived=${input.channels} materialColor=${input.tintColor}(from=${input.tintSource})` +
      ` style=${input.thickness} blurStyle=${input.blurStyle}`,
  );
}

function logMaterialApplied(applied: boolean): void {
  logWarning(`PaseoMaterial: systemMaterial applied=${applied}`);
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
  private cleanUpCallbacks: (() => void)[] = [];
  private summaryLogged: boolean = false;
  private loggedMaterialApplied: boolean | undefined = undefined;

  aboutToAppear(): void {
    this.onDescriptorChange(this.ctx.descriptorRegistry.getDescriptor<PaseoMaterialDescriptor>(this.tag));
    this.cleanUpCallbacks.push(
      this.ctx.descriptorRegistry.subscribeToDescriptorChanges(this.tag, (descriptor: Descriptor) => {
        this.onDescriptorChange(descriptor as PaseoMaterialDescriptor);
      }),
    );
  }

  aboutToDisappear(): void {
    this.cleanUpCallbacks.forEach((callback: () => void) => callback());
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
    const blurStyle: BlurStyle = toBlurStyle(thicknessProp.value);
    const material = createMaterial(thickness, tintColor, lightColor, interactive, applyShadow);
    const fillColor: string = material !== undefined
      ? tintColor
      : (degraded.value ?? defaultDegradedTint(this.defaultScheme));
    this.modifier = new PaseoMaterialAttributeModifier(descriptor, material, fillColor, blurStyle);
    const materialApplied: boolean = material !== undefined;
    if (!this.summaryLogged) {
      this.summaryLogged = true;
      logAppearSummary({
        viewName: this.defaultScheme === 'dark'
          ? PaseoMaterialView.DARK_NAME
          : PaseoMaterialView.LIGHT_NAME,
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
        blurStyle: blurStyle,
      });
    }
    if (materialApplied !== this.loggedMaterialApplied) {
      this.loggedMaterialApplied = materialApplied;
      logMaterialApplied(materialApplied);
    }
  }

  build() {
    Stack() {
      ContentSlot(this.ctx.getContentForTag(this.tag));
    }
    .width('100%')
    .height('100%')
    .attributeModifier(this.modifier);
  }
}
