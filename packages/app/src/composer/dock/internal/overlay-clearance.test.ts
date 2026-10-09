import { describe, expect, it } from "vitest";

import { resolveComposerOverlayInset } from "./overlay-clearance";

describe("resolveComposerOverlayInset", () => {
  it("keeps the caller's clearance while the composer is in the flow", () => {
    expect(resolveComposerOverlayInset({ clearance: 64, composerHeight: 0 })).toBe(64);
  });

  it("stacks the floating composer's height under the clearance", () => {
    expect(resolveComposerOverlayInset({ clearance: 64, composerHeight: 96 })).toBe(160);
    expect(resolveComposerOverlayInset({ clearance: 0, composerHeight: 96 })).toBe(96);
  });

  it("treats an unmeasured or negative height as no composer at all", () => {
    expect(resolveComposerOverlayInset({ clearance: 24, composerHeight: -8 })).toBe(24);
  });
});
