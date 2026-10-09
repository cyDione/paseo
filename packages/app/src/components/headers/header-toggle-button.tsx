import { useMemo, type ReactElement, type ReactNode } from "react";
import { Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shortcut } from "@/components/ui/shortcut";
import { GLASS_LAYER_ENABLED, GlassLayer } from "@/components/ui/glass-layer";
import type { ShortcutKey } from "@/utils/format-shortcut";
import { isWeb } from "@/constants/platform";
import { platformChromeStyles } from "@/styles/platform-chrome";
import { BORDER_RADIUS } from "@/styles/theme";
import {
  iconButtonChromeFrameStyle,
  iconButtonChromeStyle,
} from "@/components/ui/icon-button-chrome";

// The Harmony button is a circle (platformChromeStyles.headerButton); the glass layer
// underneath has to clip to the same shape.
const GLASS_LAYER_STYLE = { borderRadius: BORDER_RADIUS.full };

interface HeaderToggleButtonState {
  hovered: boolean;
  pressed: boolean;
}

interface HeaderToggleButtonProps extends Omit<PressableProps, "style" | "onPress" | "children"> {
  onPress: NonNullable<PressableProps["onPress"]>;
  tooltipLabel: string;
  tooltipKeys: ShortcutKey[];
  tooltipSide: "left" | "right" | "top" | "bottom";
  tooltipDelayDuration?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((state: HeaderToggleButtonState) => ReactNode);
}

export function HeaderToggleButton({
  onPress,
  tooltipLabel,
  tooltipKeys,
  tooltipSide,
  tooltipDelayDuration = 0,
  style,
  disabled,
  children,
  ...props
}: HeaderToggleButtonProps): ReactElement {
  const tooltipTestID =
    typeof props.testID === "string" && props.testID.length > 0
      ? `${props.testID}-tooltip`
      : undefined;
  const expandedState = (props.accessibilityState as { expanded?: boolean } | undefined)?.expanded;
  const ariaExpandedProps =
    isWeb && typeof expandedState === "boolean"
      ? ({ "aria-expanded": expandedState } as Record<string, boolean>)
      : null;

  const combinedStyle = useMemo(
    () =>
      ({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) =>
        iconButtonChromeStyle({
          size: "large",
          state: { hovered: Boolean(hovered), pressed },
          disabled: Boolean(disabled),
          style: GLASS_LAYER_ENABLED ? [style, platformChromeStyles.headerButton] : style,
        }),
    [disabled, style],
  );

  // The pre-glass rendering path, kept verbatim: a function child reaches the trigger as a
  // state function, a node child reaches it as-is. Harmony wraps this in another state function
  // so the glass layer can sit under the icon.
  const baselineChildren =
    typeof children === "function"
      ? (state: { pressed: boolean; hovered?: boolean }) =>
          children({ hovered: Boolean(state.hovered), pressed: state.pressed })
      : children;

  return (
    <Tooltip delayDuration={tooltipDelayDuration} enabledOnDesktop enabledOnMobile={false}>
      <TooltipTrigger
        {...props}
        {...ariaExpandedProps}
        disabled={disabled}
        onPress={onPress}
        style={combinedStyle}
      >
        {GLASS_LAYER_ENABLED
          ? (state: { pressed: boolean; hovered?: boolean }) => (
              <>
                <GlassLayer thickness="regular" interactive style={GLASS_LAYER_STYLE} />
                {typeof baselineChildren === "function"
                  ? baselineChildren(state)
                  : baselineChildren}
              </>
            )
          : baselineChildren}
      </TooltipTrigger>
      <TooltipContent testID={tooltipTestID} side={tooltipSide} align="center" offset={8}>
        <View style={styles.tooltipRow}>
          <Text style={styles.tooltipText}>{tooltipLabel}</Text>
          <Shortcut keys={tooltipKeys} style={styles.shortcut} />
        </View>
      </TooltipContent>
    </Tooltip>
  );
}

const styles = StyleSheet.create((theme) => ({
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  tooltipText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.popoverForeground,
  },
  shortcut: {},
}));

export const headerIconSlotStyle = {
  slot: iconButtonChromeFrameStyle("large"),
};
