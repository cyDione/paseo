import { describe, expect, it } from "vitest";

import { platformChromeGlassFillColor } from "./platform-chrome";
import {
  GLASS_FALLBACK_FILL_ALPHA,
  platformChromeGlassFillColor as harmonyGlassFillColor,
} from "./platform-chrome.harmony";

describe("platformChromeGlassFillColor", () => {
  it("returns the surface token unchanged off HarmonyOS", () => {
    expect(platformChromeGlassFillColor("#f4f4f5")).toBe("#f4f4f5");
  });

  it("keeps the surface token at the fallback alpha on HarmonyOS", () => {
    expect(GLASS_FALLBACK_FILL_ALPHA).toBe(0.78);
    expect(harmonyGlassFillColor("#ffffff")).toBe("rgba(255, 255, 255, 0.78)");
    expect(harmonyGlassFillColor("#141716")).toBe("rgba(20, 23, 22, 0.78)");
  });

  it("keeps a token it cannot read channels from", () => {
    expect(harmonyGlassFillColor("transparent")).toBe("transparent");
  });
});
