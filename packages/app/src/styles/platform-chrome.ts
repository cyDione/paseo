import { StyleSheet } from "react-native-unistyles";
import type { ViewStyle } from "react-native";

/**
 * Platform chrome overrides. Metro resolves `platform-chrome.harmony.ts` on HarmonyOS and this
 * file everywhere else, so an entry stays empty unless a platform explicitly needs it. Callers
 * append the entry at the end of a style array so the override wins over the shared style.
 */
export const platformChromeStyles = StyleSheet.create({
  headerButton: {},
  composerCard: {},
  menuPanel: {},
  modalCard: {},
});

/** Plain-style companion for surfaces that must not carry a Unistyles style. */
export const platformChromeGlassFill: ViewStyle = {};
