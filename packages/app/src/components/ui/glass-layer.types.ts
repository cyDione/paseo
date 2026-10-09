import type { StyleProp, ViewStyle } from "react-native";

/** System-material thickness; each value maps to its own native component. */
export type GlassThickness = "thin" | "regular" | "thick";

/**
 * Which theme token tints the material. `surface` is the neutral panel tint;
 * `accent` is for emphasis, such as a primary action button.
 */
export type GlassTone = "surface" | "accent";

export interface GlassLayerProps {
  /** Material thickness. Defaults to `regular`. */
  thickness?: GlassThickness;
  /** Theme token behind the material color. Defaults to `surface`. */
  tone?: GlassTone;
  /** Lets the material react to presses underneath. Defaults to `false`. */
  interactive?: boolean;
  /** Enables the material light effect. Defaults to `true`. */
  light?: boolean;
  /**
   * Shape of the surface the layer fills. Pass the container's corner radius so
   * the material clips to the same shape. The layer is absolutely positioned and
   * takes no part in layout.
   */
  style?: StyleProp<ViewStyle>;
}
