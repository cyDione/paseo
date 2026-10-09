import type { GlassLayerProps } from "./glass-layer.types";

/**
 * `false` on every platform but HarmonyOS. Shared call sites read this to skip wrapping
 * children in a state function they would only need for the native layer, so the
 * non-Harmony rendering path stays exactly what it was before glass existed.
 */
export const GLASS_LAYER_ENABLED: boolean = false;

/**
 * Native system-material layer. HarmonyOS renders it through `PaseoGlass*`; every
 * other platform gets nothing, so callers can place it unconditionally.
 */
export function GlassLayer(_props: GlassLayerProps): null {
  return null;
}
