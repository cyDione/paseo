import { describe, expect, it } from "vitest";
import { resolveEffectiveColorScheme, statusBarStyleFor } from "./system-bars-style";

describe("resolveEffectiveColorScheme", () => {
  it("follows the device scheme for the auto preference", () => {
    const light = resolveEffectiveColorScheme({
      preference: "auto",
      pluginColorScheme: null,
      deviceColorScheme: "light",
    });
    const dark = resolveEffectiveColorScheme({
      preference: "auto",
      pluginColorScheme: null,
      deviceColorScheme: "dark",
    });
    expect(light).toBe("light");
    expect(dark).toBe("dark");
  });

  it("treats an unknown device scheme as light", () => {
    const unspecified = resolveEffectiveColorScheme({
      preference: "auto",
      pluginColorScheme: null,
      deviceColorScheme: "unspecified",
    });
    const absent = resolveEffectiveColorScheme({
      preference: "auto",
      pluginColorScheme: null,
      deviceColorScheme: null,
    });
    const undefinedScheme = resolveEffectiveColorScheme({
      preference: "auto",
      pluginColorScheme: null,
      deviceColorScheme: undefined,
    });
    expect(unspecified).toBe("light");
    expect(absent).toBe("light");
    expect(undefinedScheme).toBe("light");
  });

  it("uses the registered theme for fixed preferences", () => {
    const light = resolveEffectiveColorScheme({
      preference: "light",
      pluginColorScheme: null,
      deviceColorScheme: "dark",
    });
    const dark = resolveEffectiveColorScheme({
      preference: "dark",
      pluginColorScheme: null,
      deviceColorScheme: "light",
    });
    const pureBlack = resolveEffectiveColorScheme({
      preference: "pureBlack",
      pluginColorScheme: null,
      deviceColorScheme: "light",
    });
    expect(light).toBe("light");
    expect(dark).toBe("dark");
    expect(pureBlack).toBe("dark");
  });

  it("prefers the contributed theme scheme over the preference", () => {
    const pluginLight = resolveEffectiveColorScheme({
      preference: "dark",
      pluginColorScheme: "light",
      deviceColorScheme: "dark",
    });
    const pluginDark = resolveEffectiveColorScheme({
      preference: "light",
      pluginColorScheme: "dark",
      deviceColorScheme: "light",
    });
    expect(pluginLight).toBe("light");
    expect(pluginDark).toBe("dark");
  });

  it("falls back to the default preference when the plugin theme is missing", () => {
    const dark = resolveEffectiveColorScheme({
      preference: "plugin",
      pluginColorScheme: null,
      deviceColorScheme: "dark",
    });
    const light = resolveEffectiveColorScheme({
      preference: "plugin",
      pluginColorScheme: null,
      deviceColorScheme: "light",
    });
    expect(dark).toBe("dark");
    expect(light).toBe("light");
  });
});

describe("statusBarStyleFor", () => {
  it("requests dark content on light themes", () => {
    expect(statusBarStyleFor("light")).toBe("dark-content");
  });

  it("requests light content on dark themes", () => {
    expect(statusBarStyleFor("dark")).toBe("light-content");
  });
});
