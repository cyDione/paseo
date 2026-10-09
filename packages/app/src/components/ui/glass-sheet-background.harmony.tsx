import type { FC, ReactElement } from "react";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import Animated from "react-native-reanimated";
import { BORDER_RADIUS } from "@/styles/theme";
import { GlassLayer } from "./glass-layer";

/**
 * Gorhom's default sheet background is a single view painted with `backgroundStyle`, and the
 * style prop is passed through unchanged here — the only additions are the transparent fill
 * (the material is the fill now) and the material itself.
 */
const FILL_OVERRIDE = { backgroundColor: "transparent" };
// Matches the menu sheet's backgroundStyle radius in menu-surface.tsx.
const GLASS_RADIUS = {
  borderTopLeftRadius: BORDER_RADIUS.xl,
  borderTopRightRadius: BORDER_RADIUS.xl,
};

function GlassSheetBackground({ pointerEvents, style }: BottomSheetBackgroundProps): ReactElement {
  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, FILL_OVERRIDE]}>
      <GlassLayer thickness="regular" style={GLASS_RADIUS} />
    </Animated.View>
  );
}

export const GLASS_SHEET_BACKGROUND_COMPONENT: FC<BottomSheetBackgroundProps> =
  GlassSheetBackground;
