import { useContext } from "react";
import { ComposerOverlayHeightContext } from "./internal/overlay-height-context";

/** HarmonyOS floats the chat composer so the material container behind it has content to blur. */
export const COMPOSER_OVERLAYS_CONTENT = true;

/**
 * Measured height of the floating composer. The transcript and the pill strip both clear this
 * much above their own clearance; see `resolveComposerOverlayInset`.
 */
export function useComposerOverlayHeight(): number {
  return useContext(ComposerOverlayHeightContext);
}
