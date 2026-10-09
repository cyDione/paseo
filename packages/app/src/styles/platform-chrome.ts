import { StyleSheet } from "react-native-unistyles";

/**
 * Platform chrome overrides. Metro resolves `platform-chrome.harmony.ts` on HarmonyOS and this
 * file everywhere else, so an entry stays empty unless a platform explicitly needs it. Callers
 * append the entry at the end of a style array so the override wins over the shared style.
 */
export const platformChromeStyles = StyleSheet.create({
  headerButton: {},
  composerCard: {},
  menuPanel: {},
  comboboxPanel: {},
  modalCard: {},
});

/**
 * The fill a surface keeps under its glass layer, so a material that does not paint leaves a
 * readable surface instead of a hole. Identity here; HarmonyOS returns the same token at
 * `GLASS_FALLBACK_FILL_ALPHA` (platform-chrome.harmony.ts). Callers pass the surface's own theme
 * token, never one of the glass alphas.
 */
export function platformChromeGlassFillColor(color: string): string {
  return color;
}
