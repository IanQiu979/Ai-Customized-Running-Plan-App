import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Plan } from '@/lib/planTypes';

import { formatPlanDate } from './format';

/**
 * The equipment nameplate: title at 24-32, and beneath it a small mono metadata line reading
 * like a serial plate rather than a caption. `mvp-blueprint.md` Part 7, "Plan view".
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
    fontSize: FontSize.xxl,
  },
  metadata: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  intro: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    marginTop: Spacing.one,
  },
});
