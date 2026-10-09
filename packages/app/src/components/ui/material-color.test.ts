import { describe, expect, it } from "vitest";

import {
  hexToArgbHex,
  materialDegradedFillColor,
  materialLightEffectColor,
  materialTintColor,
} from "./material-color";

describe("hexToArgbHex", () => {
  it("writes a theme token as #AARRGGBB with the requested alpha", () => {
    expect(hexToArgbHex("#ffffff", 0.55)).toBe("#8cffffff");
    expect(hexToArgbHex("#181b1a", 0.25)).toBe("#40181b1a");
    expect(hexToArgbHex("#f80", 0.5)).toBe(hexToArgbHex("#ff8800", 0.5));
  });

  it("clamps out-of-range alpha instead of wrapping the byte", () => {
    expect(hexToArgbHex("#0a0a0a", 2)).toBe("#ff0a0a0a");
    expect(hexToArgbHex("#0a0a0a", -1)).toBe("#000a0a0a");
  });

  it("returns null for tokens that are not hex colors", () => {
    expect(hexToArgbHex("rgba(0, 0, 0, 0.5)", 0.5)).toBeNull();
    expect(hexToArgbHex("transparent", 0.5)).toBeNull();
  });
});

describe("materialTintColor", () => {
  const tokens = {
    surface0: "#ffffff",
    surface1: "#1e2120",
    accent: "#20744a",
  };

  it("tints light themes with surface0 and dark themes with surface1", () => {
    expect(materialTintColor({ tone: "surface", scheme: "light", ...tokens })).toBe("#8cffffff");
    expect(materialTintColor({ tone: "surface", scheme: "dark", ...tokens })).toBe("#8c1e2120");
  });

  it("uses the accent token with its own alpha for emphasis", () => {
    expect(materialTintColor({ tone: "accent", scheme: "light", ...tokens })).toBe(
      hexToArgbHex("#20744a", 0.25),
    );
    expect(materialTintColor({ tone: "accent", scheme: "dark", ...tokens })).toBe(
      hexToArgbHex("#20744a", 0.25),
    );
  });
});

describe("materialLightEffectColor", () => {
  it("is white, dimmer on dark themes", () => {
    expect(materialLightEffectColor("light")).toBe("#80ffffff");
    expect(materialLightEffectColor("dark")).toBe("#40ffffff");
  });
});

describe("materialDegradedFillColor", () => {
  it("keeps the tint's alpha and mixes in the diagnostic orange", () => {
    const degraded = materialDegradedFillColor("#8cffffff");
    expect(degraded).not.toBeNull();
    expect(degraded?.slice(0, 3)).toBe("#8c");
    expect(degraded).not.toBe("#8cffffff");
  });

  it("stays close to the tint so the surface is still readable", () => {
    const degraded = materialDegradedFillColor("#80202020");
    // 0x20 mixed 20% toward 0xff8800: the red channel rises, blue falls, nothing saturates.
    expect(degraded).toBe("#804d351a");
  });

  it("has nothing to mix when the tint is missing", () => {
    expect(materialDegradedFillColor(null)).toBeNull();
    expect(materialDegradedFillColor("rgba(0, 0, 0, 0.5)")).toBeNull();
  });
});
