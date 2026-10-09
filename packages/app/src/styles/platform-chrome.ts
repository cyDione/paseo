import { StyleSheet } from "react-native-unistyles";

/**
 * Platform chrome overrides. Metro resolves `platform-chrome.harmony.ts` on HarmonyOS and this
 * file everywhere else, so an entry stays empty unless a platform explicitly needs it. Callers
 * append the entry at the end of a style array so the override wins over the shared style.
 */
export const platformChromeStyles = StyleSheet.create({
  headerButton: {},
  composerCard: {},
});

/**
 * Background for a surface the system material paints: `null` keeps the surface's own token,
 * which is what every platform without a material wants (docs/harmony.md). A token rather than a
 * function because theme colors are only legible inside `StyleSheet.create` (docs/unistyles.md).
 */
export const platformChromeMaterialFill: string | null = null;
