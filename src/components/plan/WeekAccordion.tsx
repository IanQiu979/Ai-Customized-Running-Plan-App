import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Effort, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Week } from '@/lib/planTypes';

import { describeDays } from './format';
import { WorkoutRow } from './WorkoutRow';

/** Full track height of an `interval` (100%) bar. Every other effort's bar is a fraction of
 * this, per the monotonic ramp in `Effort[level].barHeight`. */
const BAR_TRACK_HEIGHT = Spacing.five; // 32
/** Room for a two-digit mono week number, reused as the "why" line's left indent. */
const WEEK_GUTTER_WIDTH = Spacing.six; // 48

/**
 * One row per week: a mono week number, a seven-cell ribbon (colour + monotonic height, rest
 * days as real gaps, an unbroken baseline), and a chevron that expands the week's workouts in
 * place. Whether a bracket or a "why" line ever appears is entirely driven by whether `pace`,
 * `hrZone`, or `why` are populated on the data — there is no separate tier flag here, because
 * a fallback or Free-tier plan simply never populates those fields.
 * `mvp-blueprint.md` Part 3 / Part 7 "Plan view".
 */
export function WeekAccordion({ week }: { week: Week }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const accessibilityLabel = `Week ${week.weekNumber} of ${week.totalWeeks}${
    week.isDeload ? ', deload week' : ''
  }. ${describeDays(week.days)}.`;

  return (
    <View style={[styles.card, { borderBottomColor: theme.hairline }]}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={expanded ? "Collapses this week's workouts" : "Expands this week's workouts"}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Text style={[styles.weekNumber, { color: theme.text.secondary }]}>
          {String(week.weekNumber).padStart(2, '0')}
        </Text>
        <View
          style={[styles.ribbon, { borderBottomColor: theme.hairline }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {week.days.map((day, index) => (
            <View key={index} style={styles.cell}>
              {day.kind === 'run' ? (
                <View
                  style={[
                    styles.bar,
                    {
                      height: BAR_TRACK_HEIGHT * Effort[day.effort].barHeight,
                      backgroundColor: theme.effort[day.effort],
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
        <Text style={[styles.chevron, { color: theme.text.secondary }]}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {week.days.map((day, index) => (
            <WorkoutRow key={index} dayNumber={index + 1} day={day} />
          ))}
          {week.why ? (
            <View style={styles.why}>
              <Text style={[styles.whyLabel, { color: theme.text.secondary }]}>WHY THIS WEEK</Text>
              <Text style={[styles.whyText, { color: theme.text.secondary }]}>{week.why}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: Spacing.six, // 48pt minimum tap target
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerPressed: {
    opacity: 0.7,
  },
  weekNumber: {
    width: WEEK_GUTTER_WIDTH,
    fontFamily: FontFamily.mono.semiBold,
    fontSize: FontSize.sm,
    paddingBottom: Spacing.one,
  },
  ribbon: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.half,
    height: BAR_TRACK_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth, // the baseline — unbroken under rest-day gaps
  },
  cell: {
    flex: 1,
    alignItems: 'stretch',
  },
  bar: {
    borderRadius: Spacing.half,
  },
  chevron: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.md,
    paddingBottom: Spacing.one,
  },
  body: {
    paddingBottom: Spacing.three,
  },
  why: {
    marginTop: Spacing.two,
    marginLeft: WEEK_GUTTER_WIDTH + Spacing.three,
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  whyLabel: {
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xs,
    marginBottom: Spacing.half,
  },
  whyText: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
});
