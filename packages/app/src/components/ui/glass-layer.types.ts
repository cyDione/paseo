import type { StyleProp, ViewStyle } from "react-native";

/** System-material thickness; each value maps to its own native component. */
export type GlassThickness = "thin" | "regular" | "thick";

export interface GlassLayerProps {
  /** Material thickness. Defaults to `regular`. */
  thickness?: GlassThickness;
  /**
   * Shape of the surface the layer fills. The caller owns the corner radius;
   * the layer is absolutely positioned and takes no part in layout.
   */
  style?: StyleProp<ViewStyle>;
}
