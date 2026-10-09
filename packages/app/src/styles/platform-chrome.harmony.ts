import { StyleSheet } from "react-native-unistyles";
import { hexToRgbaString } from "@/components/ui/glass-color";

/**
 * Alpha of the fill a glass surface keeps when the system material does not paint: translucent
 * enough that the material still reads through it, opaque enough that the surface never becomes a
 * hole over live content. Tuned by feel, not derived from a token.
 */
export const GLASS_FALLBACK_FILL_ALPHA = 0.78;

/**
 * The fill a glass surface hands to itself: the surface's own theme token at
 * `GLASS_FALLBACK_FILL_ALPHA`. The material used to be the only fill, which left the surface
 * fully transparent whenever the native view failed to register, drew nothing, or degraded — the
 * tint sits under the material, so the two don't fight. Identity off Harmony
 * (platform-chrome.ts).
 */
export function platformChromeGlassFillColor(color: string): string {
  // A token that is not a hex color has no channels to take alpha; keep it as the caller wrote it.
  return hexToRgbaString(color, GLASS_FALLBACK_FILL_ALPHA) ?? color;
}

export const platformChromeStyles = StyleSheet.create((theme) => ({
  // Harmony's new system chrome floats circular icon buttons over the bar instead of
  // drawing a flat ghost control. The fill stays transparent here (the GlassLayer behind the
  // icon owns the surface, and the button's own fill would sit on top of it); shape and
  // layering only — the tokens stay Paseo's.
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
  // Popover and dialog cards float over live content. Each keeps its own token as a
  // semi-transparent fill so a material that does not paint leaves frosted glass; borders,
  // radii and shadows stay with the shared style.
  menuPanel: {
    backgroundColor: platformChromeGlassFillColor(theme.colors.surface1),
  },
  // The combobox's desktop popover shares the menu's glass layer but not its token
  // (styles.desktopContainer uses surface0).
  comboboxPanel: {
    backgroundColor: platformChromeGlassFillColor(theme.colors.surface0),
  },
  modalCard: {
    backgroundColor: platformChromeGlassFillColor(theme.colors.surface1),
    ...theme.shadow.lg,
  },
}));
