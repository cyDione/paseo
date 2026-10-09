import { StyleSheet } from "react-native-unistyles";
import type { ViewStyle } from "react-native";

export const platformChromeStyles = StyleSheet.create((theme) => ({
  // Harmony's new system chrome floats circular icon buttons over the bar instead of
  // drawing a flat ghost control. The fill is transparent because the GlassLayer behind
  // the icon owns the surface now; shape and layering only — the tokens stay Paseo's.
  headerButton: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: "transparent",
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    ...theme.shadow.md,
  },
  // Shadow only. The card's 16px radius is the tangent point the pills above it align
  // to (composer/pill-styles.ts), and the border stays as the resting edge. Transparent
  // fill for the same reason as the header button.
  composerCard: {
    backgroundColor: "transparent",
    ...theme.shadow.md,
  },
  // Popover and dialog cards float over live content and hand their fill to a GlassLayer.
  // An opaque backgroundColor would cover the material, so the fill is the one thing these
  // overrides remove; borders, radii and shadows stay with the shared style.
  menuPanel: {
    backgroundColor: "transparent",
  },
  modalCard: {
    backgroundColor: "transparent",
    ...theme.shadow.lg,
  },
}));

/**
 * Fill override for surfaces that must not carry a Unistyles style: the bottom-sheet
 * backgrounds and the compact drawer are Reanimated `Animated.View`s, where a registered
 * style can crash on theme change. See docs/unistyles.md.
 */
export const platformChromeGlassFill: ViewStyle = { backgroundColor: "transparent" };
