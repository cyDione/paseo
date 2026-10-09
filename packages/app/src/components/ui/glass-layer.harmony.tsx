import { Component, type ReactElement, type ReactNode } from "react";
import { StyleSheet, type HostComponent, type ViewProps, type ViewStyle } from "react-native";
// The same entry point `@react-native-oh-tpl/masked-view` uses; no codegen step runs for an
// app component, so the runtime registration path is the only one available.
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import type { GlassLayerProps, GlassThickness } from "./glass-layer.types";

type NativeGlassProps = ViewProps;

// Registered in paseo-unistyles (glass/GlassRegistration.cpp); keep the names in sync.
const NATIVE_COMPONENT_NAME_BY_THICKNESS: Record<GlassThickness, string> = {
  thin: "PaseoGlassThin",
  regular: "PaseoGlassRegular",
  thick: "PaseoGlassThick",
};

const nativeComponentByThickness = new Map<
  GlassThickness,
  HostComponent<NativeGlassProps> | null
>();

function resolveNativeGlassComponent(
  thickness: GlassThickness,
): HostComponent<NativeGlassProps> | null {
  const cached = nativeComponentByThickness.get(thickness);
  if (cached !== undefined) {
    return cached;
  }
  let resolved: HostComponent<NativeGlassProps> | null = null;
  try {
    resolved = codegenNativeComponent<NativeGlassProps>(
      NATIVE_COMPONENT_NAME_BY_THICKNESS[thickness],
    );
  } catch {
    // Registered on a build that did not compile the native side; render nothing.
    resolved = null;
  }
  nativeComponentByThickness.set(thickness, resolved);
  return resolved;
}

interface GlassErrorBoundaryState {
  failed: boolean;
}

/**
 * The native view registers its view config lazily, so a missing registration throws while
 * React renders the child. Glass is decoration: swallow the error and render nothing.
 */
class GlassErrorBoundary extends Component<{ children: ReactNode }, GlassErrorBoundaryState> {
  state: GlassErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GlassErrorBoundaryState {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

// Plain style object, not a Unistyles style: this prop reaches a native view Unistyles does
// not track. The layer is theme-independent, so nothing here needs the theme.
const LAYER_STYLE: ViewStyle = { ...StyleSheet.absoluteFillObject, overflow: "hidden" };

export function GlassLayer({ thickness = "regular", style }: GlassLayerProps): ReactElement | null {
  const NativeGlass = resolveNativeGlassComponent(thickness);
  if (NativeGlass === null) {
    return null;
  }
  return (
    <GlassErrorBoundary>
      <NativeGlass pointerEvents="none" style={[LAYER_STYLE, style]} />
    </GlassErrorBoundary>
  );
}
