import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The masthead every tab screen opens with: an optional mono eyebrow, a display title, optional
 * supporting copy, and a hairline underneath.
 *
 * Flat by rule: the contour "route line" that used to sit under Home's, My Plans' and Plan
 * view's titles was the graph motif, retired with the heartbeat on 2026-09-14 (spec §V22-06 —
 * "the heartbeat/pulse-trace and the graph are retired everywhere they appear"). Every screen's
 * header is now the same hairline; the week strip is the app's only drawing.
 */
export function ScreenHeader({
  eyebrow,
  title,
  supporting,
}: {
  eyebrow?: string;
  title: string;
  supporting?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>{eyebrow.toUpperCase()}</Text>
      ) : null}

      <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>

      {supporting ? (
        <Text style={[styles.supporting, { color: theme.text.secondary }]}>{supporting}</Text>
      ) : null}

      <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  title: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  supporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  hairline: {
    height: Stroke.hairline,
    marginTop: Spacing.three,
  },
});
