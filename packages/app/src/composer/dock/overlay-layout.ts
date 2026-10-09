/**
 * Whether a pane may float its composer over the transcript on this platform. Metro resolves
 * `overlay-layout.harmony.ts` on HarmonyOS and this file everywhere else. Panes also have to ask
 * for it per dock (`ComposerDock.overlayContent`): the draft and new-workspace docks keep the
 * composer in the flow, so only the chat pane pays for the measured height.
 */
export const COMPOSER_OVERLAYS_CONTENT = false;

/**
 * Measured height of the composer while it floats over this pane's transcript, published by
 * `ComposerOverlayHeightContext`. Zero everywhere the composer is in the flow — the transcript
 * already ends where the composer begins, so there is nothing to clear.
 */
export function useComposerOverlayHeight(): number {
  return 0;
}
