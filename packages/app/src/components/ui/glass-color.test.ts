import { describe, expect, it } from "vitest";

import {
  argbWithAlpha,
  glassLightEffectColor,
  glassMaterialColor,
  hexToArgbWithAlpha,
  toSignedArgbInt,
} from "./glass-color";

describe("argbWithAlpha", () => {
  it("replaces the alpha byte of the rgb color", () => {
    expect(argbWithAlpha(0x1e2120, 0.55)).toBe(0x8c1e2120);
    expect(argbWithAlpha(0xffffff, 0.5)).toBe(0x80ffffff);
    expect(argbWithAlpha(0xffffff, 0.25)).toBe(0x40ffffff);
  });

  it("clamps out-of-range alpha instead of wrapping the byte", () => {
    expect(argbWithAlpha(0x0a0a0a, 2)).toBe(0xff0a0a0a);
    expect(argbWithAlpha(0x0a0a0a, -1)).toBe(0x000a0a0a);
  });
});

describe("hexToArgbWithAlpha", () => {
  it("converts six- and three-digit theme tokens", () => {
    expect(hexToArgbWithAlpha("#ffffff", 0.55)).toBe(0x8cffffff);
    expect(hexToArgbWithAlpha("#181b1a", 0.25)).toBe(0x40181b1a);
    expect(hexToArgbWithAlpha("#f80", 0.5)).toBe(hexToArgbWithAlpha("#ff8800", 0.5));
  });

  it("returns null for tokens that are not hex colors", () => {
    expect(hexToArgbWithAlpha("rgba(0, 0, 0, 0.5)", 0.5)).toBeNull();
    expect(hexToArgbWithAlpha("transparent", 0.5)).toBeNull();
  });
});

describe("toSignedArgbInt", () => {
  it("keeps the 0xAARRGGBB bits across the signed bridge cast", () => {
    expect(toSignedArgbInt(0x80ffffff)).toBe(-2130706433);
    expect(toSignedArgbInt(0x8c1e2120) >>> 0).toBe(0x8c1e2120);
    expect(toSignedArgbInt(0x0a0a0a)).toBe(0x0a0a0a);
  });
});

describe("glassMaterialColor", () => {
  const tokens = {
    surface0: "#ffffff",
    surface1: "#1e2120",
    accent: "#20744a",
  };

  it("tints light themes with surface0 and dark themes with surface1", () => {
    expect(glassMaterialColor({ tone: "surface", scheme: "light", ...tokens })).toBe(0x8cffffff);
    expect(glassMaterialColor({ tone: "surface", scheme: "dark", ...tokens })).toBe(0x8c1e2120);
  });

  it("uses the accent token with its own alpha for emphasis", () => {
    expect(glassMaterialColor({ tone: "accent", scheme: "light", ...tokens })).toBe(
      hexToArgbWithAlpha("#20744a", 0.25),
    );
    expect(glassMaterialColor({ tone: "accent", scheme: "dark", ...tokens })).toBe(
      hexToArgbWithAlpha("#20744a", 0.25),
    );
  });

  it("returns null when a theme token stops being a hex color", () => {
    expect(
      glassMaterialColor({
        tone: "surface",
        scheme: "light",
        surface0: "rgb(255, 255, 255)",
        surface1: "#1e2120",
        accent: "#20744a",
      }),
    ).toBeNull();
  });
});

describe("glassLightEffectColor", () => {
  it("uses white at the scheme alpha", () => {
    expect(glassLightEffectColor("light")).toBe(0x80ffffff);
    expect(glassLightEffectColor("dark")).toBe(0x40ffffff);
  });
});
