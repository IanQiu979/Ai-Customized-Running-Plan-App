import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniWeekStrip } from '@/components/build/MiniWeekStrip';
import { DisclaimerFooter } from '@/components/plan/DisclaimerFooter';
import { FallbackNotice } from '@/components/plan/FallbackNotice';
import { formatPlanDate } from '@/components/plan/format';
import { GoalRealismNotice } from '@/components/plan/GoalRealismNotice';
import { PlanPlaceholder } from '@/components/plan/PlanPlaceholder';
import { PlanTopBar } from '@/components/plan/PlanTopBar';
import { currentWeekIndex, firstParam, planTotalKm, weekTag } from '@/components/plan/planScreen';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing, Stroke } from '@/constants/theme';
import { usePlan } from '@/hooks/use-plan';
import { useTheme } from '@/hooks/use-theme';
import { shouldShowGoalRealismNotice } from '@/lib/goalRealismDisclosure';
import type { Week } from '@/lib/planTypes';
import { stripFromWeek } from '@/lib/weekStrip';

/**
 * V22-06 A · Plan overview. The whole plan, one row per week with a mini strip and its total;
 * the current week highlighted. Static — no animation anywhere on the plan-detail screens.
 * Tapping a week pushes B (`week/[week]`), which pushes C/D (`day/[day]`); all three are plain
 * pushes over the same cached plan (`usePlan`).
 *
 * `EXAMPLE_PLAN_ID` renders the local fixture with no fetch — the captain's "never remove the
 * sample plan" call. The product notices that used to sit under the nameplate (goal realism,
 * fallback, the coach's intro) keep their place above the week list; the legal disclaimers keep
 * the bottom.
 *
 * The week list replaces the accordion-and-ribbon plan view of 2026-07: the contour "route
 * line" that opened it was the graph motif, retired with the heartbeat on 2026-09-14.
 */
export default function PlanOverviewScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id?: string | string[];
    createdAt?: string | string[];
  }>();
  const planId = firstParam(params.id);
  const createdAt = firstParam(params.createdAt);
  const { loaded, loading, error } = usePlan(planId);

  if (loading) return <PlanPlaceholder label="PLAN" />;
  if (error || !loaded) {
    return <PlanPlaceholder label="PLAN" message={error ?? 'This plan could not be found.'} />;
  }

  const { plan, quotaConsumed } = loaded;
  const current = currentWeekIndex(plan, createdAt);
  const meta = [
    `${plan.durationWeeks} WEEKS`,
    `${planTotalKm(plan)} KM`,
    plan.raceDate ? `RACE ${formatPlanDate(plan.raceDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <PlanTopBar label="PLAN" />

          <View style={styles.masthead}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{plan.title}</Text>
            <Text style={[styles.meta, { color: theme.text.secondary }]}>{meta}</Text>
          </View>

          {shouldShowGoalRealismNotice(plan.goalRealism) ? (
            <GoalRealismNotice assessment={plan.goalRealism} />
          ) : null}
          {/* The server owns whether this immutable plan consumed quota; never infer it from the
              current account state, which may have changed since generation. */}
          {plan.isFallback ? (
            <FallbackNotice variant={quotaConsumed ? 'counted' : 'exempt'} />
          ) : null}
          {plan.coachIntro ? (
            <Text style={[styles.intro, { color: theme.text.secondary }]}>{plan.coachIntro}</Text>
          ) : null}

          <View>
            {plan.weeks.map((week, index) => (
              <WeekRow
                key={week.weekNumber}
                planId={planId!}
                createdAt={createdAt}
                week={week}
                current={index === current}
              />
            ))}
          </View>

          <DisclaimerFooter disclaimers={plan.disclaimers} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WeekRow({
  planId,
  createdAt,
  week,
  current,
}: {
  planId: string;
  createdAt: string | undefined;
  week: Week;
  current: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const ink = current ? theme.text.primary : theme.text.secondary;
  const tag = weekTag(week);
  // `router.push` rather than `<Link asChild>`: on web the link wrapper drops a Pressable's
  // function-form `style` and the row collapses into a column (2026-09-14 visual pass).
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/plan/[id]/week/[week]',
          params: {
            id: planId,
            week: String(week.weekNumber),
            ...(createdAt ? { createdAt } : {}),
          },
        })
      }
      accessibilityRole="link"
      accessibilityLabel={`Week ${week.weekNumber} of ${week.totalWeeks}, ${week.volumeKm} kilometres${
        tag ? `, ${tag.toLowerCase()}` : ''
      }${current ? ', current week' : ''}`}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: theme.hairline },
        current && [styles.rowCurrent, { backgroundColor: theme.grid.frame }],
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.weekNumber, { color: ink }]}>W{week.weekNumber}</Text>
      <MiniWeekStrip week={stripFromWeek(week)} width={120} height={22} gap={4} dim={!current} />
      <Text style={[styles.tag, { color: theme.text.secondary }]} numberOfLines={1}>
        {tag}
      </Text>
      <Text style={[styles.total, { color: ink }]}>
        {week.volumeKm} <Text style={[styles.unit, { color: theme.text.secondary }]}>KM</Text>
      </Text>
      <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.six,
    gap: 20,
  },
  masthead: {
    marginTop: 15, // the page: bar ends at 103, masthead at 118
    gap: 6,
  },
  title: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 30,
    lineHeight: 30 * 1.05,
  },
  meta: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 1.5,
  },
  intro: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
    borderTopWidth: Stroke.thin,
    minHeight: 44,
  },
  rowCurrent: {
    marginHorizontal: -Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.control,
  },
  weekNumber: {
    width: 26,
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
  },
  tag: {
    flex: 1,
    fontFamily: FontFamily.mono.regular,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  total: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 16,
  },
  unit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 8,
  },
  chevron: {
    width: 10,
    textAlign: 'right',
    fontFamily: FontFamily.mono.regular,
    fontSize: 12,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
