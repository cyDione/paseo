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
}));
