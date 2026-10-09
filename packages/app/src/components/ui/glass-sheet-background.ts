import type { FC } from "react";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";

/**
 * `undefined` on every platform but HarmonyOS, where gorhom's own default background renders
 * exactly as if the prop were never passed. See `glass-sheet-background.harmony.tsx`.
 */
export const GLASS_SHEET_BACKGROUND_COMPONENT: FC<BottomSheetBackgroundProps> | undefined =
  undefined;
