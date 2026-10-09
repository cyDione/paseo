import { Component, type ComponentType, type ReactElement, type ReactNode } from "react";
import {
  View,
  type HostComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
// The same entry point `@react-native-oh-tpl/masked-view` uses; no codegen step runs for an
// app component, so the runtime registration path is the only one available.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import type { Theme } from "@/styles/theme";
import { glassLightEffectColor, glassMaterialColor, toSignedArgbInt } from "./glass-color";
import type { GlassLayerProps, GlassThickness, GlassTone } from "./glass-layer.types";

/** Glass is real on HarmonyOS only; see the base module for the non-Harmony contract. */
export const GLASS_LAYER_ENABLED: boolean = true;

/**
 * Diagnostic-only, and deliberately not exported: it answers "which path did this surface take"
 * from the device instead of from a log. Red = the native view never registered or threw while
 * rendering, so no glass layer exists at all; orange (native side, `kDiagnosticTintOnDegrade`) =
 * the material degraded to the tinted backdrop blur; no tint = the system material applied. Set
 * to `false` with the native constant once the material is verified on a device.
 */
const GLASS_DIAGNOSTIC_TINTS: boolean = true;

/**
 * Not a theme color: the diagnostic must never be mistaken for a Paseo surface. It paints the
 * area the missing layer would have covered, which is otherwise the surface's own fill.
 */
const DIAGNOSTIC_MISSING_VIEW_TINT: ViewStyle = { backgroundColor: "rgba(255, 0, 0, 0.25)" };

/**
 * The material props the native `PaseoGlass*` views read. They are hand-registered in
 * `paseo-unistyles` (glass/GlassShadowNodes.cpp), so this interface is the contract — there is
 * no generated spec to import. Colors are 0xAARRGGBB as signed 32-bit numbers.
 */
interface NativeGlassProps extends ViewProps {
  materialColor?: number;
  lightColor?: number;
  interactive?: boolean;
  applyShadow?: boolean;
}

// Registered in paseo-unistyles (glass/GlassRegistration.cpp); keep the names in sync.
const NATIVE_COMPONENT_NAME_BY_THICKNESS: Record<GlassThickness, string> = {
  thin: "PaseoGlassThin",
  regular: "PaseoGlassRegular",
  thick: "PaseoGlassThick",
};

const themedComponentByKey = new Map<string, ComponentType<NativeGlassProps> | null>();

/**
 * The theme-to-material mapping is a `withUnistyles` mapper so a theme change re-renders only
 * this leaf, not the surface that hosts the layer. `tone` and `light` are baked into the cached
 * wrapper because the mapper only receives the theme, and passing them as props would override
 * the mapper's values.
 */
function resolveThemedGlassComponent(
  thickness: GlassThickness,
  tone: GlassTone,
  light: boolean,
): ComponentType<NativeGlassProps> | null {
  const key = `${thickness}:${tone}:${light ? "lit" : "unlit"}`;
  const cached = themedComponentByKey.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let resolved: ComponentType<NativeGlassProps> | null = null;
  try {
    const NativeGlass: HostComponent<NativeGlassProps> = codegenNativeComponent<NativeGlassProps>(
      NATIVE_COMPONENT_NAME_BY_THICKNESS[thickness],
    );
    resolved = withUnistyles(NativeGlass, (theme: Theme) => {
      const materialColor = glassMaterialColor({
        tone,
        scheme: theme.colorScheme,
        surface0: theme.colors.surface0,
        surface1: theme.colors.surface1,
        accent: theme.colors.accent,
      });
      return {
        // 0 leaves the material default. Only reachable if a theme token stops being a hex color.
        materialColor: materialColor === null ? 0 : toSignedArgbInt(materialColor),
        lightColor: light ? toSignedArgbInt(glassLightEffectColor(theme.colorScheme)) : 0,
      };
    });
  } catch {
    // Registered on a build that did not compile the native side; render nothing.
    resolved = null;
  }
  themedComponentByKey.set(key, resolved);
  return resolved;
}

interface GlassErrorBoundaryState {
  failed: boolean;
}

/**
 * The native view registers its view config lazily, so a missing registration throws while
 * React renders the child. Glass is decoration: swallow the error and paint the diagnostic fill
 * (nothing when the tints are off) instead of failing the surface.
 */
class GlassErrorBoundary extends Component<
  { children: ReactNode; diagnosticFillStyle: StyleProp<ViewStyle> | null },
  GlassErrorBoundaryState
> {
  state: GlassErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GlassErrorBoundaryState {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return this.props.diagnosticFillStyle === null ? null : (
      <View pointerEvents="none" style={this.props.diagnosticFillStyle} />
    );
  }
}

// Plain style object, not a Unistyles style: this prop reaches a native view through
// `withUnistyles`, which flattens plain entries as-is. The radius comes from the caller, so the
// material clips to the surface it fills.
const LAYER_STYLE: ViewStyle = { ...StyleSheet.absoluteFillObject, overflow: "hidden" };

export function GlassLayer({
  thickness = "regular",
  tone = "surface",
  interactive = false,
  light = true,
  style,
}: GlassLayerProps): ReactElement | null {
  const ThemedGlass = resolveThemedGlassComponent(thickness, tone, light);
  const diagnosticFillStyle: StyleProp<ViewStyle> | null = GLASS_DIAGNOSTIC_TINTS
    ? [LAYER_STYLE, style, DIAGNOSTIC_MISSING_VIEW_TINT]
    : null;
  if (ThemedGlass === null) {
    return diagnosticFillStyle === null ? null : (
      <View pointerEvents="none" style={diagnosticFillStyle} />
    );
  }
  return (
    <GlassErrorBoundary diagnosticFillStyle={diagnosticFillStyle}>
      <ThemedGlass
        pointerEvents="none"
        applyShadow
        interactive={interactive}
        style={[LAYER_STYLE, style]}
      />
    </GlassErrorBoundary>
  );
}
