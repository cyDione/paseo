import { parseHexColor } from "@/utils/color";
import type { GlassTone } from "./glass-layer.types";

/**
 * Color maths for the Harmony system material. The ArkUI setters take one signed 32-bit
 * argument in 0xAARRGGBB, so every color the glass layer sends is produced here.
 *
 * The alpha values are the visible half of the design: with no material color the API 26
 * material paints nothing on EXQUISITE/GENTLE devices, which is why the first version of this
 * layer was invisible. They are tuned by feel, not derived from a token.
 */
export const GLASS_SURFACE_TINT_ALPHA = 0.55;
export const GLASS_ACCENT_TINT_ALPHA = 0.25;
const GLASS_LIGHT_EFFECT_ALPHA_BY_SCHEME = { light: 0.5, dark: 0.25 } as const;

/** Opaque white; the light effect is white on both schemes, only its alpha differs. */
const WHITE_RGB = 0xffffff;

/**
 * Replaces the alpha byte of a 0xRRGGBB color. Returns 0xAARRGGBB as an unsigned number.
 */
export function argbWithAlpha(rgb: number, alpha: number): number {
  const clamped = Math.min(1, Math.max(0, alpha));
  const alphaByte = Math.round(clamped * 255);
  return ((alphaByte << 24) | (rgb & 0xffffff)) >>> 0;
}

/**
 * Theme hex token (`#rgb` or `#rrggbb`) as 0xAARRGGBB with the given alpha. `null` when the
 * token is not a hex color; the caller then leaves the material color unset instead of
 * inventing one.
 */
export function hexToArgbWithAlpha(hex: string, alpha: number): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => Math.round(channel * 255));
  return argbWithAlpha((r << 16) | (g << 8) | b, alpha);
}

/**
 * The signed 32-bit form the bridge carries. React Native casts raw props to `int`, so the
 * 0xAARRGGBB bits travel as a negative number on every dark or half-opaque color; keeping the
 * conversion here means the native side only has to cast back to `uint32_t`.
 */
export function toSignedArgbInt(argb: number): number {
  return argb | 0;
}

/**
 * Material tint for the glass layer: light themes tint with `surface0`, dark themes with
 * `surface1`, and `accent` overrides both.
 */
export function glassMaterialColor(args: {
  tone: GlassTone;
  scheme: "light" | "dark";
  surface0: string;
  surface1: string;
  accent: string;
}): number | null {
  if (args.tone === "accent") {
    return hexToArgbWithAlpha(args.accent, GLASS_ACCENT_TINT_ALPHA);
  }
  return hexToArgbWithAlpha(
    args.scheme === "dark" ? args.surface1 : args.surface0,
    GLASS_SURFACE_TINT_ALPHA,
  );
}

/** Light-effect color: white, at the scheme's alpha. 0 disables the effect on the native side. */
export function glassLightEffectColor(scheme: "light" | "dark"): number {
  return argbWithAlpha(WHITE_RGB, GLASS_LIGHT_EFFECT_ALPHA_BY_SCHEME[scheme]);
}
