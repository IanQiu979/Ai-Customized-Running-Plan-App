import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import {
  Accent,
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { draw, enter } from '@/lib/buildMotion';

/**
 * The button shapes the Blueprint system allows, in one module so that the "one accent per
 * screen" rule is enforceable by reading imports rather than by auditing eight hand-rolled
 * `StyleSheet` blocks — which is what the app had before, and why the accent's treatment drifted
 * between Home, intake and the auth screens.
 *
 * `PrimaryAction` IS the accent. A screen gets at most one, and the review question is simply
 * "how many `<PrimaryAction>` (or `<RevealPrimaryAction>`) does this file render?".
 */

/** The V22 sheet: buttons 12pt radius, 48–52pt tall. */
const BUTTON_HEIGHT = 52;

/**
 * The screen's single forward action: an ink slab (`Accent.fill`, the sheet's near-white) with
 * the page colour as its label, so it reads as a cut-out of the field rather than as a coloured
 * object on it. Same in every scheme — the app has one.
 *
 * Disabled drops the fill entirely rather than dimming it: the accent is spent on a live action
 * or not at all, so a disabled control is an inert `progress.disabled` slab with an ordinary ink
 * label (dead-looking, still readable — asserted in `theme.contrast.test.ts`).
 */
export function PrimaryAction({
  label,
  onPress,
  disabled = false,
  busy = false,
  accessibilityHint,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label. Callers pass their own `disabled` separately — a busy
   * control is usually also disabled, but a screen may keep it pressable to allow a retry. */
  busy?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const inert = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        inert
          ? { backgroundColor: theme.progress.disabled }
          : { backgroundColor: theme.accent.fill },
        pressed && !inert && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={inert ? theme.text.primary : theme.accent.onFill} />
      ) : (
        <Text style={[styles.label, { color: inert ? theme.text.primary : theme.accent.onFill }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * The primary action as the last beat of onboarding (V22-02 "Get started"): its outline draws
 * itself around the slab over 0.6 s, the ink fill sweeps in from the left (0.65 s → 1.1 s), and
 * the label fades up (0.85 s → 1.15 s). Same slab, same label, same press — only the arrival is
 * choreographed, and it is driven by the caller's build clock `T` (seconds, see
 * `lib/buildMotion.ts`) so it plays when the step scrolls into view and holds its end frame.
 *
 * Pressable whenever the caller's `disabled` is false — the reveal choreographs the arrival, not
 * the availability, which the caller gates on its own clock (onboarding's hero build). Under
 * reduced motion the caller's clock sits at its end and the control is simply the finished
 * button.
 *
 * Drawn at the page's width where the viewport allows it and capped at the viewport minus the
 * section's gutters where it does not: a 375 pt or 360 pt phone gets a narrower slab, never one
 * that runs into the margins or is clipped.
 */
export function RevealPrimaryAction({
  T,
  startAt = 0,
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
}: {
  T: SharedValue<number>;
  /** Where on the caller's clock the reveal begins. */
  startAt?: number;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  // The page draws a 345 × 52 rounded rect; the perimeter is what the dash offset counts down.
  const width = revealWidth(viewportWidth);
  const perimeter = 2 * (width + BUTTON_HEIGHT) - 8 * Radius.button + 2 * Math.PI * Radius.button;

  const outline = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - draw(T.value, startAt, 0.6)),
  }));
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: enter(T.value, startAt + 0.65, 0.45) }],
  }));
  const text = useAnimatedStyle(() => ({
    opacity: enter(T.value, startAt + 0.85, 0.3),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.reveal, { width }, pressed && !disabled && styles.pressed, style]}
    >
      <Animated.View
        style={[styles.revealFill, { backgroundColor: disabled ? theme.progress.disabled : theme.accent.fill }, fill]}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={BUTTON_HEIGHT}>
          <AnimatedRect
            x={0.5}
            y={0.5}
            width={width - 1}
            height={BUTTON_HEIGHT - 1}
            rx={Radius.button}
            fill="none"
            stroke={theme.text.primary}
            strokeWidth={Stroke.thin}
            strokeDasharray={[perimeter]}
            animatedProps={outline}
          />
        </Svg>
      </View>
      <Animated.Text
        style={[styles.label, { color: disabled ? theme.text.primary : theme.accent.onFill }, text]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/** The page's button width (393 − 2 × 24). The reveal is drawn at this width and centred by its
 * caller; a wider screen keeps the page's proportions rather than stretching the outline. */
export const REVEAL_WIDTH = 345;
/** The section's gutter on either side of the reveal — the page's 24 pt. */
export const REVEAL_GUTTER = Spacing.four;

/** The reveal's drawn width on a given viewport: the page's, or what fits inside the gutters. */
export function revealWidth(viewportWidth: number): number {
  return Math.max(0, Math.min(REVEAL_WIDTH, viewportWidth - 2 * REVEAL_GUTTER));
}

/**
 * Everything that is a real action but not THE action: the Google buttons on the auth screens, a
 * non-recommended tier on Paywall. A hairline-bordered ink outline, no fill, no accent — the
 * system's near-monochrome default.
 *
 * `tone="onInverse"` is for a secondary action sitting on a `surface.inverse` slab, where the
 * ordinary ink border would be invisible.
 */
export function SecondaryAction({
  label,
  onPress,
  disabled = false,
  busy = false,
  tone = 'default',
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'default' | 'onInverse';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const ink = tone === 'onInverse' ? theme.text.onInverse : theme.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        { borderColor: ink },
        (pressed || disabled || busy) && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : (
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/**
 * The "OR" rule between a social button and an email form. Two hairlines and a tracked mono
 * label — the auth screens' only piece of shared chrome, lifted here because both of them had a
 * verbatim copy of it.
 */
export function ActionDivider({ label = 'OR' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
      <Text style={[styles.dividerLabel, { color: theme.text.secondary }]}>{label}</Text>
      <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
    </View>
  );
}

/** A centred text link — "Already have an account? Sign in". Not a button: no fill, no border. */
export function LinkAction({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, { color: theme.text.secondary }]}>{children}</Text>
    </Pressable>
  );
}

/** Exported for the contrast/render tests, which assert the fill rather than a colour literal. */
export const PRIMARY_FILL = Accent.fill;

const styles = StyleSheet.create({
  button: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: Stroke.thin,
  },
  reveal: {
    height: BUTTON_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: Radius.button,
  },
  revealFill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: Radius.button,
    transformOrigin: 'left',
  },
  label: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerRule: {
    flex: 1,
    height: Stroke.hairline,
  },
  dividerLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.six,
  },
  linkText: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
