import * as Localization from "expo-localization";
import type { IntlDeviceInfo } from "./intl";

export function readIntlDeviceInfo(): IntlDeviceInfo {
  // The Intl polyfill runs before anything else at startup. A missing native module must
  // leave the app in UTC with a 12-hour clock instead of keeping it from launching.
  try {
    const calendar = Localization.getCalendars()[0];
    return {
      timeZone: calendar?.timeZone ?? null,
      uses24hourClock: calendar?.uses24hourClock ?? null,
    };
  } catch {
    return { timeZone: null, uses24hourClock: null };
  }
}
