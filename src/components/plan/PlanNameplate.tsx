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

  const metadata = [
    `TIER · ${plan.tierAtGeneration.toUpperCase()}`,
    plan.goalType === 'race' && plan.raceDistance && plan.raceDate
      ? `${plan.durationWeeks} WEEKS TO RACE DAY · ${formatPlanDate(plan.raceDate)}`
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
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xs,
  },
  intro: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    marginTop: Spacing.one,
  },
});
