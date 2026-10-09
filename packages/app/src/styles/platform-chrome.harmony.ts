import { StyleSheet } from "react-native-unistyles";

export const platformChromeStyles = StyleSheet.create((theme) => ({
  // Harmony's new system chrome floats circular icon buttons over the bar instead of
  // drawing a flat ghost control. Shape and layering only — the tokens stay Paseo's.
  headerButton: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface1,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    ...theme.shadow.md,
  },
  // The immersive material owns the shadow (ImmersiveOptions.applyShadow) and needs a
  // transparent background to be visible at all; the card's 16px radius stays the tangent point
  // the pills above it align to (composer/pill-styles.ts).
  composerCard: {
    backgroundColor: "transparent",
  },
}));

/**
 * The system material owns the fill of the surfaces it sits behind, and an opaque RN background
 * would cover it: the material filter is what makes the surface translucent, so it *is* the fill.
 */
export const platformChromeMaterialFill: string | null = "transparent";
