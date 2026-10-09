import { parseHexColor } from "@/utils/color";

/**
 * Color maths for the ArkUI system material. The material travels to ArkTS as `#AARRGGBB`
 * strings because `ResourceColor` takes them directly — the native side has no conversion to do —
 * and a hilog line shows the color the material actually received.
 *
 * The alphas are the visible half of the design: an unset material color is transparent, and
 * `ImmersiveOptions.materialColor` documents that a fully opaque color blocks the material
 * filter, so the tint has to stay in the translucent range. They are tuned by feel, not derived
 * from a token.
 */
export const MATERIAL_SURFACE_TINT_ALPHA = 0.55;
export const MATERIAL_ACCENT_TINT_ALPHA = 0.25;
const MATERIAL_LIGHT_EFFECT_ALPHA_BY_SCHEME = { light: 0.5, dark: 0.25 } as const;

/** How much of the degrade diagnostic's orange is mixed into the tint. */
const DEGRADE_DIAGNOSTIC_MIX_ALPHA = 0.2;
/** Diagnostic-only, and deliberately not a Paseo token: a surface this color is degraded. */
const DEGRADE_DIAGNOSTIC_RGB = 0xff8800;

export type MaterialTone = "surface" | "accent";

/** A theme hex token (`#rgb` or `#rrggbb`) as `#AARRGGBB`, or `null` when it is not a hex color. */
export function hexToArgbHex(hex: string, alpha: number): string | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => Math.round(channel * 255));
  const clamped = Math.min(1, Math.max(0, alpha));
  const alphaByte = Math.round(clamped * 255);
  const argb = ((alphaByte << 24) | (r << 16) | (g << 8) | b) >>> 0;
  return `#${argb.toString(16).padStart(8, "0")}`;
}

/**
 * Material tint: light themes tint with `surface0`, dark themes with `surface1`, and `accent`
 * overrides both. `null` means the caller found no hex token to tint with; the material then
 * keeps its transparent default instead of being given an invented color.
 */
export function materialTintColor(args: {
  tone: MaterialTone;
  scheme: "light" | "dark";
  surface0: string;
  surface1: string;
  accent: string;
}): string | null {
  if (args.tone === "accent") {
    return hexToArgbHex(args.accent, MATERIAL_ACCENT_TINT_ALPHA);
  }
  return hexToArgbHex(
    args.scheme === "dark" ? args.surface1 : args.surface0,
    MATERIAL_SURFACE_TINT_ALPHA,
  );
}

/** Light-effect color: white at the scheme's alpha. */
export function materialLightEffectColor(scheme: "light" | "dark"): string {
  return hexToArgbHex("#ffffff", MATERIAL_LIGHT_EFFECT_ALPHA_BY_SCHEME[scheme]) ?? "#80ffffff";
}

/**
 * Fill for a device without the immersive material: the tint with the diagnostic orange mixed
 * in, so a degraded surface says so on screen. Returns `null` for a color this module cannot
 * read — the native side then keeps the plain backdrop blur without a fill.
 */
export function materialDegradedFillColor(materialColor: string | null): string | null {
  if (materialColor === null) return null;
  const rgb = parseHexColor(`#${materialColor.slice(3)}`);
  if (!rgb) return null;
  const mix = DEGRADE_DIAGNOSTIC_MIX_ALPHA;
  const [r, g, b] = rgb.map((channel) => Math.round(channel * 255));
  const [dr, dg, db] = [
    (DEGRADE_DIAGNOSTIC_RGB >> 16) & 0xff,
    (DEGRADE_DIAGNOSTIC_RGB >> 8) & 0xff,
    DEGRADE_DIAGNOSTIC_RGB & 0xff,
  ];
  const mixed = [r, g, b].map((channel, index) =>
    Math.round(channel * (1 - mix) + [dr, dg, db][index] * mix),
  );
  const alphaByte = Number.parseInt(materialColor.slice(1, 3), 16);
  const argb = ((alphaByte << 24) | (mixed[0] << 16) | (mixed[1] << 8) | mixed[2]) >>> 0;
  return `#${argb.toString(16).padStart(8, "0")}`;
}
