import type { PluginThemeOption } from "@/plugins/themes";
import type { ThemePreference } from "@/styles/theme";

/** iOS, Android and web configure the status bar through their own window APIs. */
export function useSystemBars(
  _preference: ThemePreference,
  _contributedTheme: PluginThemeOption | null,
): void {
  // Nothing to synchronize here.
}
