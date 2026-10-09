import type { ViewProps } from "react-native";

/** Material style. Thin for the pill strip, regular for the composer card. */
export type MaterialThickness = "thin" | "regular" | "thick";

/** Theme token the material tints with; `surface` follows the color scheme. */
export type MaterialTone = "surface" | "accent";

/**
 * A box whose background is an ArkUI system material on HarmonyOS and an ordinary `View`
 * everywhere else. The material-only props are read by `material-view.harmony.tsx`; see
 * docs/harmony.md.
 */
export interface MaterialViewProps extends ViewProps {
  thickness?: MaterialThickness;
  tone?: MaterialTone;
  /** Deform the surface while it is touched. */
  interactive?: boolean;
  /** Let the material draw the shadow; it takes precedence over a `shadow` style. */
  applyShadow?: boolean;
  /** Light-sensing feedback while the surface is touched. */
  lightEffect?: boolean;
}
