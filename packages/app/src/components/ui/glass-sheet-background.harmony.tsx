import { useMemo, type FC, type ReactElement } from "react";
import { StyleSheet } from "react-native";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import Animated from "react-native-reanimated";
import { BORDER_RADIUS } from "@/styles/theme";
import { platformChromeGlassFillColor } from "@/styles/platform-chrome";
import { GlassLayer } from "./glass-layer";

// Matches the menu sheet's backgroundStyle radius in menu-surface.tsx.
const GLASS_RADIUS = {
  borderTopLeftRadius: BORDER_RADIUS.xl,
  borderTopRightRadius: BORDER_RADIUS.xl,
};

/**
 * Gorhom's default sheet background is a single view painted with `backgroundStyle`, and the
 * style prop is passed through unchanged here beyond the fill: the material is the surface, but
 * the caller's token stays underneath it at the fallback alpha, so a material that does not paint
 * leaves frosted glass rather than a hole. The token comes from the incoming style because this
 * component never sees the theme — the caller resolved it already.
 */
function GlassSheetBackground({ pointerEvents, style }: BottomSheetBackgroundProps): ReactElement {
  const fillOverride = useMemo(() => {
    const backgroundColor = StyleSheet.flatten(style)?.backgroundColor;
    return typeof backgroundColor === "string"
      ? { backgroundColor: platformChromeGlassFillColor(backgroundColor) }
      : null;
  }, [style]);

  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, fillOverride]}>
      <GlassLayer thickness="regular" style={GLASS_RADIUS} />
    </Animated.View>
  );
}

export const GLASS_SHEET_BACKGROUND_COMPONENT: FC<BottomSheetBackgroundProps> =
  GlassSheetBackground;
