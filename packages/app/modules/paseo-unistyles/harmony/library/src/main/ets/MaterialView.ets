/**
 * `PaseoMaterialView`: an RN view whose background is an ArkUI system material.
 *
 * The material is a node attribute, so it can only paint a node that *contains* what should show
 * through it — that is also what `colorInvert` needs, since it adapts the colors of the node's
 * subtree. The RN children therefore live inside this component (`ContentSlot`), and the C++
 * layout rect pinned on this component's frame node is the box the material fills.
 *
 * This component deliberately does not use `RNViewBase`: the ARKUI node for an ArkTS component is
 * already positioned by the layout rect the C++ side sets on its wrapper, and `RNViewBase`
 * re-applies the same origin from `layoutMetrics`, which would offset anything that does not
 * start at (0, 0). It applies the view properties the material surfaces need (corner radius,
 * border, opacity) from the descriptor instead.
 */
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

/** Raw props sent by `material-view.harmony.tsx`. Colors are `#AARRGGBB` strings. */
export interface PaseoMaterialRawProps extends ViewRawProps {
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
  ViewBaseProps,
  PaseoMaterialState,
  PaseoMaterialRawProps
>;

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
 * Builds the material for one descriptor, or `undefined` when this device cannot render it. The
 * caller then paints `degradedColor` over a backdrop blur.
 */
function createMaterial(rawProps: PaseoMaterialRawProps): uiMaterial.Material | undefined {
  if (!uiMaterial.isImmersiveMaterialSupported()) {
    return undefined;
  }
  const options: uiMaterial.ImmersiveOptions = {
    style: toImmersiveStyle(rawProps.thickness),
    colorInvert: true,
    applyShadow: rawProps.applyShadow ?? true,
    interactive: rawProps.interactive ?? false,
  };
  if (rawProps.materialColor !== undefined) {
    options.materialColor = rawProps.materialColor;
  }
  if (rawProps.lightColor !== undefined) {
    options.lightEffect = { color: rawProps.lightColor };
  }
  return new uiMaterial.ImmersiveMaterial(options);
}

/** One line per material change: the device's material support and the path this view took. */
function logMaterial(rawProps: PaseoMaterialRawProps, material: uiMaterial.Material | undefined): void {
  const info: uiMaterial.MaterialInfo = uiMaterial.getMaterialInfo();
  hilog.info(
    HILOG_DOMAIN,
    HILOG_TAG,
    'PaseoMaterial: supported=%{public}s level=%{public}d state=%{public}d style=%{public}s path=%{public}s',
    uiMaterial.isImmersiveMaterialSupported(),
    uiMaterial.getGlobalMaterialLevel(),
    info.state,
    rawProps.thickness ?? 'regular',
    material === undefined ? 'degraded' : 'material',
  );
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
 * The material, the corner radius that clips it and the border the RN style asked for all belong
 * to the same node, so they are applied by one modifier. A new instance is set on every
 * descriptor change, which is what makes ArkUI apply it again.
 */
class PaseoMaterialAttributeModifier implements AttributeModifier<StackAttribute> {
  private readonly descriptor: PaseoMaterialDescriptor;
  private readonly material: uiMaterial.Material | undefined;
  private readonly degradedColor: string | undefined;

  constructor(
    descriptor: PaseoMaterialDescriptor,
    material: uiMaterial.Material | undefined,
    degradedColor: string | undefined,
  ) {
    this.descriptor = descriptor;
    this.material = material;
    this.degradedColor = degradedColor;
  }

  applyNormalAttribute(instance: StackAttribute): void {
    const view = new ViewDescriptorWrapperBase(this.descriptor);
    const radius = view.borderRadius;
    instance.borderRadius({
      topLeft: radius.topLeft,
      topRight: radius.topRight,
      bottomLeft: radius.bottomLeft,
      bottomRight: radius.bottomRight,
    });
    const width = view.borderWidth;
    instance.borderWidth({ top: width.top, right: width.right, bottom: width.bottom, left: width.left });
    const color = view.borderColor;
    instance.borderColor({ top: color.top, right: color.right, bottom: color.bottom, left: color.left });
    instance.borderStyle(toBorderStyle(view.borderStyle));
    const opacity = view.opacity;
    if (opacity !== 1) {
      instance.opacity(opacity);
    }
    if (this.material !== undefined) {
      // The material owns the fill, the border and the shadow on this node; see docs/harmony.md
      // for why the RN style must stay transparent behind it.
      instance.systemMaterial(this.material);
      return;
    }
    instance.backgroundBlurStyle(BlurStyle.Thin);
    if (this.degradedColor !== undefined) {
      instance.backgroundColor(this.degradedColor);
    }
  }
}

@Builder
export function buildPaseoMaterialView(ctx: ComponentBuilderContext) {
  PaseoMaterialView({
    ctx: ctx.rnComponentContext,
    tag: ctx.tag,
  });
}

@Component
export struct PaseoMaterialView {
  public static readonly NAME: string = 'PaseoMaterialView';
  public ctx!: RNComponentContext;
  public tag: number = 0;
  @State private modifier: PaseoMaterialAttributeModifier | undefined = undefined;
  private cleanUpCallbacks: (() => void)[] = [];

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
    const material = createMaterial(descriptor.rawProps);
    this.modifier = new PaseoMaterialAttributeModifier(descriptor, material, descriptor.rawProps.degradedColor);
    logMaterial(descriptor.rawProps, material);
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
