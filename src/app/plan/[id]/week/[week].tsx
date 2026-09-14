import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaticWeekStrip } from '@/components/build/StaticWeekStrip';
import { formatPace } from '@/components/plan/format';
import { PlanTopBar } from '@/components/plan/PlanTopBar';
import {
  currentDayIndex,
  currentWeekIndex,
  dayLabel,
  firstParam,
} from '@/components/plan/planScreen';
import { FontFamily, FontSize, PressedOpacity, Spacing, Stroke } from '@/constants/theme';
import { usePlan } from '@/hooks/use-plan';
import { useTheme } from '@/hooks/use-theme';
import { RUN_TYPE_ABBREVIATIONS, UNABBREVIATED_RUN_TYPES, expandLabel } from '@/lib/notation';
import type { Day } from '@/lib/planTypes';
import { stripFromWeek, stripRunCount } from '@/lib/weekStrip';

/** A structure string short enough to sit in the row's detail column ("6 × 800 m"). */
const SHORT_STRUCTURE = 14;

/**
 * V22-06 B · Week, compact. The static strip replaces the graph; the seven days follow as
 * hairline rows — every day, rest days included, because rest days are real slots. Tapping a
 * row pushes C (a session) or D (a rest day). Static; no animation.
 */
export default function WeekScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id?: string | string[];
    week?: string | string[];
    createdAt?: string | string[];
  }>();
  const planId = firstParam(params.id);
  const createdAt = firstParam(params.createdAt);
  const weekNumber = Number(firstParam(params.week));
  const { loaded, loading, error } = usePlan(planId);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={theme.text.primary} />
      </View>
    );
  }

  const week = loaded?.plan.weeks.find((candidate) => candidate.weekNumber === weekNumber);
  if (error || !loaded || !week) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.base }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.errorTitle, { color: theme.text.primary }]}>Nothing to show</Text>
        <Text style={[styles.error, { color: theme.status.error }]}>
          {error ?? 'This week could not be found.'}
        </Text>
      </View>
    );
  }

  const { plan } = loaded;
  const weekIndex = plan.weeks.indexOf(week);
  const isCurrent = weekIndex === currentWeekIndex(plan, createdAt);
  const currentDay = isCurrent ? currentDayIndex(plan, weekIndex, createdAt) : undefined;
  const strip = stripFromWeek(week);
  const meta = [
    `${week.volumeKm} KM`,
    `${stripRunCount(strip)} RUNS`,
    week.isDeload ? 'RECOVERY WEEK' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <PlanTopBar label={`WEEK ${week.weekNumber} OF ${week.totalWeeks}`} />

          <View style={styles.masthead}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{plan.title}</Text>
            <Text style={[styles.meta, { color: theme.text.secondary }]}>{meta}</Text>
          </View>

          <StaticWeekStrip week={strip} currentDay={currentDay} />

          <View>
            {week.days.map((day, index) => (
              <SessionRow
                key={index}
                planId={planId!}
                createdAt={createdAt}
                weekNumber={week.weekNumber}
                dayIndex={index}
                day={day}
                last={index === week.days.length - 1}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** The row's title: the run type spelled out ("Easy Run"), or "Rest". */
function rowTitle(day: Day): string {
  if (day.kind === 'rest') return 'Rest';
  return (
    RUN_TYPE_ABBREVIATIONS[day.label]?.fullName ??
    UNABBREVIATED_RUN_TYPES[day.label]?.fullName ??
    expandLabel(day.label)
  );
}

/** The row's small mono detail: the pace, or a short structure line, or nothing. */
function rowDetail(day: Day): string {
  if (day.kind === 'rest') return '';
  if (day.pace) return formatPace(day.pace).toUpperCase();
  if (day.structure && day.structure.length <= SHORT_STRUCTURE) return day.structure.toUpperCase();
  return '';
}

function SessionRow({
  planId,
  createdAt,
  weekNumber,
  dayIndex,
  day,
  last,
}: {
  planId: string;
  createdAt: string | undefined;
  weekNumber: number;
  dayIndex: number;
  day: Day;
  last: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const rest = day.kind === 'rest';
  const ink = rest ? theme.text.secondary : theme.text.primary;
  const magnitude = rest
    ? null
    : day.distanceKm !== undefined
      ? { value: day.distanceKm, unit: 'KM' }
      : day.durationMin !== undefined
        ? { value: day.durationMin, unit: 'MIN' }
        : null;
  const spoken = rest
    ? `Day ${dayIndex + 1}, rest day`
    : `Day ${dayIndex + 1}, ${rowTitle(day)}${magnitude ? `, ${magnitude.value} ${magnitude.unit === 'KM' ? 'kilometres' : 'minutes'}` : ''}`;

  // `router.push` rather than `<Link asChild>`: on web the link wrapper drops a Pressable's
  // function-form `style` and the row collapses into a column (2026-09-14 visual pass).
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/plan/[id]/week/[week]/day/[day]',
          params: {
            id: planId,
            week: String(weekNumber),
            day: String(dayIndex + 1),
            ...(createdAt ? { createdAt } : {}),
          },
        })
      }
      accessibilityRole="link"
      accessibilityLabel={spoken}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: theme.hairline, borderBottomColor: theme.hairline },
        last && styles.rowLast,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.day, { color: theme.text.secondary }]}>{dayLabel(dayIndex)}</Text>
      <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
        {rowTitle(day)}
      </Text>
      <Text style={[styles.detail, { color: theme.text.secondary }]} numberOfLines={1}>
        {rowDetail(day)}
      </Text>
      <Text style={[styles.number, { color: ink }]} numberOfLines={1}>
        {magnitude ? (
          <>
            {magnitude.value}{' '}
            <Text style={[styles.unit, { color: theme.text.secondary }]}>{magnitude.unit}</Text>
          </>
        ) : (
          '—'
        )}
      </Text>
      <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.six,
    gap: 20,
  },
  masthead: {
    marginTop: 15,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: Stroke.thin,
    minHeight: 44,
  },
  rowLast: {
    borderBottomWidth: Stroke.thin,
  },
  day: {
    width: 30,
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.body.medium,
    fontSize: 14,
  },
  detail: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    flexShrink: 1,
  },
  number: {
    width: 44,
    textAlign: 'right',
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.lg,
    flexShrink: 0,
  },
  unit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 9,
  },
  chevron: {
    width: 10,
    textAlign: 'right',
    fontFamily: FontFamily.mono.regular,
    fontSize: 12,
  },
  errorTitle: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.xl,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
