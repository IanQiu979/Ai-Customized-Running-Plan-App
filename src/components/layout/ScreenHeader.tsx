import { StyleSheet, Text, View } from 'react-native';

import { RouteLine } from '@/components/brand/RouteLine';
import { FontFamily, FontSize, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The masthead every tab screen opens with: an optional mono eyebrow, a display title, optional
 * supporting copy, and a rule underneath.
 *
 * That rule is where Trailhead's screen hierarchy actually lives. `routeLine` draws the contour
 * motif — reserved for Home, My Plans, and Plan view. Glossary and Settings pass `false` and get
 * a plain hairline instead, because those two screens are specified flat, grouped-row and
 * zero-ornament with no exception (`docs/design/trailhead-visual-system.md` §1). A route line
 * there would be the first crack in that rule.
 */
export function ScreenHeader({
  eyebrow,
  title,
  supporting,
  routeLine = false,
}: {
  eyebrow?: string;
  title: string;
  supporting?: string;
  routeLine?: boolean;
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

      {routeLine ? (
        <RouteLine variant="header" showSummit baseline style={styles.rule} />
      ) : (
        <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />
      )}
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
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  supporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  rule: {
    marginTop: Spacing.two,
  },
  hairline: {
    height: Stroke.hairline,
    marginTop: Spacing.three,
  },
});
