import type { ReactNode } from 'react';
import { Children, Fragment, isValidElement } from 'react';
import type { AccessibilityRole } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The grouped-row primitive Glossary and Settings are built from.
 *
 * Those two screens are specified flat, hairline-ruled and **zero-accent, with no exception**
 * (`docs/design/instrument-visual-system.md` §1). The signal never appears on either, not even on
 * Settings' "Upgrade" row — the upgrade decision belongs to the Paywall, and this row is a door
 * to it, not the offer itself. Destructive actions still use `status.error`, which is a status
 * colour rather than the accent.
 *
 * `Group` draws the separators, so no row has to know whether it is last. That was the actual
 * defect being designed out: every hand-ruled list eventually grows a trailing hairline nobody
 * meant to leave in.
 */

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.groupTitle, { color: theme.text.secondary }]}>{title.toUpperCase()}</Text>
      ) : null}
      <View style={[styles.groupBody, { borderTopColor: theme.hairline }]}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? (
              <View style={[styles.separator, { backgroundColor: theme.hairline }]} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/**
 * A read-only row: a label on the left, a value on the right.
 *
 * `mono` sets the value in Space Mono — for anything genuinely tabular (a tier, a quota count).
 * Prose values stay in the body face.
 */
export function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.rowLabel, { color: theme.text.secondary }]}>{label}</Text>
      <Text
        style={[
          mono ? styles.rowValueMono : styles.rowValue,
          { color: theme.text.primary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** A row that does something. `tone="destructive"` is the only colour any of these ever take. */
export function ActionRow({
  label,
  hint,
  tone = 'default',
  disabled = false,
  busy = false,
  accessibilityRole = 'button',
  accessibilityHint,
  onPress,
}: {
  label: string;
  hint?: string;
  tone?: 'default' | 'destructive';
  disabled?: boolean;
  busy?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = tone === 'destructive' ? theme.status.error : theme.text.primary;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, (pressed || disabled || busy) && styles.pressed]}
    >
      <View style={styles.actionText}>
        <Text style={[styles.rowAction, { color }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.text.secondary }]}>{hint}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: theme.progress.informative }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  groupTitle: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  groupBody: {
    borderTopWidth: Stroke.hairline,
  },
  separator: {
    height: Stroke.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: Spacing.six, // 48pt tap target
    paddingVertical: Spacing.two,
  },
  rowLabel: {
    flexShrink: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  // The value column is right-aligned, which only shows once a value is short enough not to wrap.
  // A long one ("Unlimited plans during the test pass") shrank and then set its own lines flush
  // left inside the shrunken box, so it ran ragged against the "ELITE" directly above it. The
  // shrink is what makes wrapping possible at all; `textAlign` is what keeps the column a column.
  rowValue: {
    flexShrink: 1,
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
    textAlign: 'right',
  },
  rowValueMono: {
    flexShrink: 1,
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.sm,
    textAlign: 'right',
  },
  actionText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  rowAction: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
  },
  rowHint: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  chevron: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.lg,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
