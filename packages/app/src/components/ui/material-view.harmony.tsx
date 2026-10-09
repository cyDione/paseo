import {
  Component,
  forwardRef,
  useCallback,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import {
  View,
  type HostComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { withUnistyles } from "react-native-unistyles";
// The entry point `@react-native-oh-tpl/masked-view` uses: no codegen runs for an app component,
// so the runtime registration path is the only one available.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import type { Theme } from "@/styles/theme";
import {
  materialDegradedFillColor,
  materialLightEffectColor,
  materialTintColor,
} from "./material-color";
import type { MaterialThickness, MaterialTone, MaterialViewProps } from "./material-view.types";

/** Registered by the `paseo-unistyles` HAR (cpp/material/MaterialRegistration.cpp). Keep in sync. */
const NATIVE_MATERIAL_VIEW_NAME = "PaseoMaterialView";

/**
 * Diagnostic-only, and deliberately not exported: a build that never registered the native view
 * paints red instead of silently rendering flat, so a screenshot answers the question. Orange
 * (the native degrade fill) means the device has no immersive material and the surface fell back
 * to a tinted backdrop blur. Turn both off once the material is verified on a device.
 */
const MATERIAL_DIAGNOSTIC_TINTS: boolean = true;

/** Not a theme color: the diagnostic must never be mistaken for a Paseo surface. */
const MISSING_VIEW_TINT: ViewStyle = { backgroundColor: "rgba(255, 0, 0, 0.25)" };

/**
 * The material props the native `PaseoMaterialView` reads from `descriptor.rawProps`. The view is
 * hand-registered, so this interface — plus `PaseoMaterialJSIBinder` on the native side — is the
 * contract; there is no generated spec to import. Colors are `#AARRGGBB` strings.
 */
interface NativeMaterialViewProps extends ViewProps {
  thickness?: MaterialThickness;
  materialColor?: string;
  degradedColor?: string;
  lightColor?: string;
  interactive?: boolean;
  applyShadow?: boolean;
}

const NativeMaterialView: HostComponent<NativeMaterialViewProps> =
  codegenNativeComponent<NativeMaterialViewProps>(NATIVE_MATERIAL_VIEW_NAME);

/**
 * The theme-to-material mapping rides on `uniProps`, the theme-aware prop lane of
 * `withUnistyles`: the closure sees `tone` and `lightEffect`, and the wrapper — not the surface
 * that hosts it — re-renders when the theme or color scheme changes. The corner radius is not
 * sent: the ArkTS side clips the material to the RN style's own `borderRadius`.
 */
const ThemedMaterialView = withUnistyles(NativeMaterialView);

function resolveMaterialProps(
  theme: Theme,
  tone: MaterialTone,
  lightEffect: boolean,
): Partial<NativeMaterialViewProps> {
  const materialColor = materialTintColor({
    tone,
    scheme: theme.colorScheme,
    surface0: theme.colors.surface0,
    surface1: theme.colors.surface1,
    accent: theme.colors.accent,
  });
  return {
    // Leaving the color unset keeps the material's transparent default; only reachable if a
    // theme token stops being a hex color.
    materialColor: materialColor ?? undefined,
    degradedColor: materialDegradedFillColor(materialColor) ?? undefined,
    lightColor: lightEffect ? materialLightEffectColor(theme.colorScheme) : undefined,
  };
}

interface MaterialViewFailureBoundaryProps {
  children: ReactNode;
  /** Everything the native view would have received, for the plain-View fallback. */
  viewProps: ViewProps;
  style: StyleProp<ViewStyle>;
  hostRef: Ref<View>;
}

/**
 * The native view registers its view config lazily, so a missing registration throws while React
 * renders the child. The material is decoration: swallow the error and render the children in a
 * plain View (plus the diagnostic fill) instead of failing the surface.
 */
class MaterialViewFailureBoundary extends Component<
  MaterialViewFailureBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    const fallbackStyle: StyleProp<ViewStyle> = MATERIAL_DIAGNOSTIC_TINTS
      ? [this.props.style, MISSING_VIEW_TINT]
      : this.props.style;
    return (
      <View ref={this.props.hostRef} style={fallbackStyle} {...this.props.viewProps}>
        {this.props.children}
      </View>
    );
  }
}

export const MaterialView = forwardRef(function MaterialView(
  {
    thickness = "regular",
    tone = "surface",
    interactive = false,
    applyShadow = false,
    lightEffect = true,
    style,
    children,
    ...props
  }: MaterialViewProps,
  ref: Ref<View>,
): ReactElement {
  const uniProps = useCallback(
    (theme: Theme) => resolveMaterialProps(theme, tone, lightEffect),
    [tone, lightEffect],
  );
  return (
    <MaterialViewFailureBoundary style={style} viewProps={props} hostRef={ref}>
      <ThemedMaterialView
        ref={ref}
        style={style}
        thickness={thickness}
        interactive={interactive}
        applyShadow={applyShadow}
        uniProps={uniProps}
        {...props}
      >
        {children}
      </ThemedMaterialView>
    </MaterialViewFailureBoundary>
  );
});
