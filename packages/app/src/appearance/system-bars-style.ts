import { DEFAULT_THEME_PREFERENCE } from "@/hooks/use-settings/storage";
import {
  PLUGIN_THEME_PREFERENCE,
  REGISTERED_THEMES,
  THEME_TO_UNISTYLES,
  type ThemePreference,
} from "@/styles/theme";

export type ResolvedColorScheme = "light" | "dark";

/** `useColorScheme()` result; RNOH reports "unspecified" when the system has no explicit scheme. */
export type DeviceColorScheme = ResolvedColorScheme | "unspecified" | null | undefined;

export type StatusBarContentStyle = "dark-content" | "light-content";

interface EffectiveColorSchemeInput {
  preference: ThemePreference;
  /** The selected contributed theme's scheme, or null when there is no contribution. */
  pluginColorScheme: ResolvedColorScheme | null;
  deviceColorScheme: DeviceColorScheme;
}

export function resolveEffectiveColorScheme(input: EffectiveColorSchemeInput): ResolvedColorScheme {
  if (input.pluginColorScheme !== null) return input.pluginColorScheme;
  const builtInPreference =
    input.preference === PLUGIN_THEME_PREFERENCE ? DEFAULT_THEME_PREFERENCE : input.preference;
  if (builtInPreference === "auto") {
    return input.deviceColorScheme === "dark" ? "dark" : "light";
  }
  return REGISTERED_THEMES[THEME_TO_UNISTYLES[builtInPreference]].colorScheme;
}

export function statusBarStyleFor(scheme: ResolvedColorScheme): StatusBarContentStyle {
  return scheme === "dark" ? "light-content" : "dark-content";
}
