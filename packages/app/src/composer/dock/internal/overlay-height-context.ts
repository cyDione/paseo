import { createContext } from "react";

/**
 * Height of the composer that floats over the transcript, published by `ComposerDock` while it
 * renders the floating layout. Platform modules decide whether anything reads it; see
 * `composer/dock/overlay-layout`.
 */
export const ComposerOverlayHeightContext = createContext(0);
