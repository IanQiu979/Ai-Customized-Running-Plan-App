import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatPace } from '@/components/plan/format';
import { PlanPlaceholder } from '@/components/plan/PlanPlaceholder';
import { PlanTopBar } from '@/components/plan/PlanTopBar';
import { dayLabel, firstParam } from '@/components/plan/planScreen';
import { FontFamily, FontSize, Spacing, Stroke, sessionToneFor } from '@/constants/theme';
import { usePlan } from '@/hooks/use-plan';
import { useTheme } from '@/hooks/use-theme';
import { RUN_TYPE_ABBREVIATIONS, UNABBREVIATED_RUN_TYPES, expandLabel } from '@/lib/notation';
import type { Workout } from '@/lib/planTypes';

/** The copy a rest day carries under WHY — the row copy the plan view has always used, not new
 * coaching content. Only ever this: the week's own `why` is the week's rationale, shown on the
 * week screen, and would mislabel itself as the reason this day is a rest day. */
const REST_WHY = 'Rest day — recovery is training too.';

/**
 * V22-06 C · Session detail, and D · Rest day. One read-only screen for one unnamed day: what
 * the session is, its measured numbers where the plan measured them, its structure, its effort
 * description and — on paid tiers — why. A rest day says why it is one and nothing else: not
 * the week's `why` (that is the week screen's), no
 * "optional" section, because plans are running-only and the app never suggests cross-training
 * or mobility (`CLAUDE.md`, coaching domain).
 */
export default function DayScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id?: string | string[];
    week?: string | string[];
    day?: string | string[];
  }>();
  const planId = firstParam(params.id);
  const weekNumber = Number(firstParam(params.week));
  const dayIndex = Number(firstParam(params.day)) - 1;
  const { loaded, loading, error } = usePlan(planId);

  if (loading) return <PlanPlaceholder label="DAY" />;
  const week = loaded?.plan.weeks.find((candidate) => candidate.weekNumber === weekNumber);
  const day = week?.days[dayIndex];
  if (error || !week || !day) {
    return <PlanPlaceholder label="DAY" message={error ?? 'This day could not be found.'} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <PlanTopBar label={`DAY ${dayLabel(dayIndex)} · WEEK ${week.weekNumber}`} />
          {day.kind === 'run' ? <Session day={day} /> : <RestDay />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function runTypeName(label: string): string {
  return (
    RUN_TYPE_ABBREVIATIONS[label]?.fullName ??
    UNABBREVIATED_RUN_TYPES[label]?.fullName ??
    expandLabel(label)
  );
}

function Session({ day }: { day: Workout }) {
  const theme = useTheme();
  const headline =
    day.structure ??
    (day.distanceKm !== undefined
      ? `${day.distanceKm} km`
      : day.durationMin !== undefined
        ? `${day.durationMin} min`
        : runTypeName(day.label));

  // Only the numbers the plan actually measured: a Free plan has no pace and no zone, and a
  // stat cell that says "—" would be a claim about a measurement that never happened.
  const stats: { value: string; label: string }[] = [];
  if (day.distanceKm !== undefined) stats.push({ value: String(day.distanceKm), label: 'KM TOTAL' });
  else if (day.durationMin !== undefined) stats.push({ value: String(day.durationMin), label: 'MIN' });
  if (day.pace) stats.push({ value: formatPace(day.pace).replace('/km', ''), label: '/KM PACE' });
  if (day.hrZone) stats.push({ value: `ZONE ${day.hrZone}`, label: 'HR ZONE' });
  else if (day.rpe) stats.push({ value: `RPE ${day.rpe}`, label: 'EFFORT' });
  else stats.push({ value: day.effort.toUpperCase(), label: 'EFFORT' });

  return (
    <View style={styles.sections}>
      <View style={styles.masthead}>
        <View style={styles.kind}>
          <View style={[styles.dot, { backgroundColor: theme.session[sessionToneFor(day.effort)] }]} />
          <Text style={[styles.kindLabel, { color: theme.text.secondary }]}>
            {runTypeName(day.label).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.headline, { color: theme.text.primary }]}>{headline}</Text>
      </View>

      <View style={[styles.stats, { borderTopColor: theme.hairline, borderBottomColor: theme.hairline }]}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text.primary }]} numberOfLines={1}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {day.structure ? (
        <Section label="STRUCTURE" body={day.structure} />
      ) : null}
      <Section label="EFFORT" body={day.effortDescription} />
      {day.why ? <Section label="WHY" body={day.why} /> : null}
    </View>
  );
}

function RestDay() {
  const theme = useTheme();
  return (
    <View style={styles.sections}>
      <View style={styles.masthead}>
        <View style={styles.kind}>
          <View style={[styles.dot, { backgroundColor: theme.grid.slot }]} />
          <Text style={[styles.kindLabel, { color: theme.text.secondary }]}>REST</Text>
        </View>
        <Text style={[styles.headline, { color: theme.text.primary }]}>No run today</Text>
      </View>
      <View style={[styles.rule, { backgroundColor: theme.hairline }]} />
      <Section label="WHY" body={REST_WHY} />
    </View>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.text.secondary }]}>{label}</Text>
      <Text style={[styles.sectionBody, { color: theme.text.primary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.six,
  },
  sections: {
    marginTop: 15,
    gap: 28,
  },
  masthead: {
    gap: Spacing.two,
  },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.one,
  },
  kindLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 2,
  },
  headline: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 40,
    lineHeight: 40,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: Stroke.thin,
    borderBottomWidth: Stroke.thin,
    paddingVertical: Spacing.three,
  },
  stat: {
    flex: 1,
    gap: 5,
  },
  statValue: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 28,
    lineHeight: 28,
  },
  statLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  rule: {
    height: Stroke.thin,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 2,
  },
  sectionBody: {
    fontFamily: FontFamily.body.regular,
    fontSize: 14,
    lineHeight: 21,
  },
});
