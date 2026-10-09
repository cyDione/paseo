import type { GlassLayerProps } from "./glass-layer.types";

/**
 * Native system-material layer. HarmonyOS renders it through `PaseoGlass*`; every
 * other platform gets nothing, so callers can place it unconditionally.
 */
export function GlassLayer(_props: GlassLayerProps): null {
  return null;
}
