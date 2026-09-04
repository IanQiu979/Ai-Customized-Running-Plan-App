import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The two button shapes the Instrument system allows, in one module so that the "one signal per
 * screen" rule is enforceable by reading imports rather than by auditing eight hand-rolled
 * `StyleSheet` blocks — which is what the app had before, and why the accent's treatment drifted
 * between Home, intake and the auth screens.
 *
 * `PrimaryAction` IS the signal. A screen gets at most one, and the review question is simply
 * "how many `<PrimaryAction>` does this file render?".
 */

/**
 * The screen's single forward action: a near-black slab (`Accent.field`) with a 1.5pt icy-cyan
 * edge and an icy-cyan label, identical in light and dark mode.
 *
 * Why the fill is never the cyan: `Accent.signal` measures 1.27:1 against a white page, so a cyan
 * slab in light mode would have no boundary at all. Splitting it — near-black slab, cyan edge —
 * gives the control a boundary in both schemes through different channels (light: the slab, at
 * 19.35:1 against the page; dark: the edge, at 14.74:1), which is what lets one appearance serve
 * both. Both ratios are asserted in `constants/__tests__/theme.contrast.test.ts`.
 *
 * Disabled drops the signal entirely rather than dimming it: the highlight is spent on a live
 * action or not at all, so a disabled control is an inert `progress.disabled` slab with an
 * ordinary ink label (7.63:1 light / 7.24:1 dark — dead-looking, still readable).
 *
 * It renders on `surface.base`, on `surface.raised`, and on a `surface.inverse` slab. On the last
 * of those the fill matches the slab exactly and the cyan edge is the whole control — deliberate,
 * and the reason Paywall's recommended tier needs no special case.
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
          ? { backgroundColor: theme.progress.disabled, borderColor: 'transparent' }
          : { backgroundColor: theme.accent.field, borderColor: theme.accent.signal },
        pressed && !inert && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.text.primary} />
      ) : (
        <Text style={[styles.label, { color: inert ? theme.text.primary : theme.accent.signal }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Everything that is a real action but not THE action: the Google buttons on the auth screens, a
 * non-recommended tier on Paywall. A hairline-bordered ink outline, no fill, no signal — the
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

const styles = StyleSheet.create({
  button: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    borderWidth: Stroke.mark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondary: {
    backgroundColor: 'transparent',
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
