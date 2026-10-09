/**
 * Bottom clearance for whatever sits above the composer.
 *
 * In the flow layout the composer is the last block of the pane: the transcript ends where it
 * begins and the pill strip rests directly on it, so the measured height is 0 and callers keep
 * the clearance they already had. A composer that floats over the transcript would cover that
 * clearance, so its measured height stacks underneath.
 */
export function resolveComposerOverlayInset(input: {
  /** Clearance the caller reserves when the composer is in the flow. */
  clearance: number;
  /** Measured height of the floating composer; 0 while it is in the flow. */
  composerHeight: number;
}): number {
  return input.clearance + Math.max(0, input.composerHeight);
}
