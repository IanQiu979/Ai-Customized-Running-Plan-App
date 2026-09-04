import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Plan } from '@/lib/planTypes';

import { formatPlanDate } from './format';

/**
 * The plan's masthead: the title at display scale, and beneath it a small mono metadata line
 * that reads like a serial plate rather than a caption.
 *
 * The title takes `FontSize.hero`, the step added for exactly this — Big Shoulders
 * Display is optically much smaller than the Barlow Condensed it replaced, so the old `xxl` no
 * longer carried the top of a screen.
 */
export function PlanNameplate({ plan }: { plan: Plan }) {
  const theme = useTheme();

  // One glyph, one job: `·` separates peer fields, a colon binds a key to its value. Before, `·`
  // did both, told apart only by how much whitespace surrounded it. `·` takes the separator role
  // rather than the binder role because that's the sense the app already teaches the runner —
  // `notation.ts` glosses it as the segment separator inside a structure string, and the Glossary
  // prints that definition. The wide gutters stay: they are what makes this line read as a serial
  // plate rather than a caption.
  const metadata = [
    `TIER: ${plan.tierAtGeneration.toUpperCase()}`,
    plan.goalType === 'race' && plan.raceDistance && plan.raceDate
      ? `${plan.durationWeeks} WEEKS TO RACE DAY: ${formatPlanDate(plan.raceDate)}`
      : `${plan.durationWeeks}-WEEK PLAN`,
  ].join('   ·   ');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text.primary }]}>{plan.title}</Text>
      <Text style={[styles.metadata, { color: theme.text.secondary }]}>{metadata}</Text>
      {plan.coachIntro ? (
        <Text style={[styles.intro, { color: theme.text.secondary }]}>{plan.coachIntro}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  metadata: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  intro: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    marginTop: Spacing.one,
  },
});
