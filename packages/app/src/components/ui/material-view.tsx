import { forwardRef, type ReactElement, type Ref } from "react";
import { View } from "react-native";
import type { MaterialViewProps } from "./material-view.types";

/**
 * Material surfaces are real on HarmonyOS only (`material-view.harmony.tsx`). Everywhere else
 * this is the `View` the call site used before, so call sites stay unconditional. The
 * material-only props are dropped here: a `View` must never see them (web would put them on the
 * DOM node).
 */
export const MaterialView = forwardRef(function MaterialView(
  {
    thickness: _thickness,
    tone: _tone,
    interactive: _interactive,
    applyShadow: _applyShadow,
    lightEffect: _lightEffect,
    ...props
  }: MaterialViewProps,
  ref: Ref<View>,
): ReactElement {
  return <View ref={ref} {...props} />;
});
