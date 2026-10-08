import { useEffect } from "react";
import { StatusBar, useColorScheme } from "react-native";
import type { PluginThemeOption } from "@/plugins/themes";
import type { ThemePreference } from "@/styles/theme";
import { resolveEffectiveColorScheme, statusBarStyleFor } from "./system-bars-style";

// RNOH's StatusBarManager defaults the content color to white, so light themes must ask for
// dark icons. The effect re-runs on scheme changes to keep the auto preference on the system.
export function useSystemBars(
  preference: ThemePreference,
  contributedTheme: PluginThemeOption | null,
): void {
  const deviceColorScheme = useColorScheme();
  const pluginColorScheme = contributedTheme?.theme.colorScheme ?? null;

  useEffect(() => {
    const scheme = resolveEffectiveColorScheme({
      preference,
      pluginColorScheme,
      deviceColorScheme,
    });
    StatusBar.setBarStyle(statusBarStyleFor(scheme), false);
  }, [deviceColorScheme, pluginColorScheme, preference]);
}
