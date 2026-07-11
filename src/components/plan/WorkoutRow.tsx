import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { expandLabel, speakStructure } from '@/lib/notation';
import type { Day, Workout } from '@/lib/planTypes';

import { EffortChip } from './EffortChip';
import { formatPace } from './format';
import { ReadoutBracket } from './ReadoutBracket';

/**
 * One day inside an expanded week: label, structure line, effort description, and — only when
 * genuinely measured — a bracketed pace/HR-zone readout. Rest days are real slots, not
 * absences (`planTypes.ts` `RestDay`), and render their own row rather than a gap.
 */
export function WorkoutRow({ dayNumber, day }: { dayNumber: number; day: Day }) {
  const theme = useTheme();
  const dayGutter = String(dayNumber).padStart(2, '0');

  if (day.kind === 'rest') {
    return (
      <View style={styles.row} accessible accessibilityLabel={`Day ${dayNumber}, rest day`}>
        <Text style={[styles.dayGutter, { color: theme.text.secondary }]}>{dayGutter}</Text>
        <Text style={[styles.restText, { color: theme.text.secondary }]}>
          Rest day — recovery is training too.
        </Text>
      </View>
    );
  }

  const measured = day.pace ? formatPace(day.pace) : undefined;
  const zone = day.hrZone ? `Zone ${day.hrZone}` : undefined;
  const hasBracket = Boolean(measured || zone);

  return (
    <View style={styles.row} accessible accessibilityLabel={composeWorkoutLabel(dayNumber, day)}>
      <Text style={[styles.dayGutter, { color: theme.text.secondary }]}>{dayGutter}</Text>
      <View style={styles.body}>
        <View style={styles.headline}>
          <EffortChip effort={day.effort} />
          <Text style={[styles.label, { color: theme.text.primary }]}>{day.label}</Text>
          <DistanceOrDuration day={day} />
          {hasBracket ? (
            <ReadoutBracket>
              <Text style={[styles.mono, { color: theme.text.primary }]}>
                {[measured, zone].filter(Boolean).join(' · ')}
              </Text>
            </ReadoutBracket>
          ) : null}
        </View>
        <Text style={[styles.description, { color: theme.text.secondary }]}>{day.effortDescription}</Text>
        {day.structure ? (
          <Text style={[styles.structure, { color: theme.text.secondary }]}>{day.structure}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** `Workout` sets exactly one of `distanceKm`/`durationMin` — render whichever is present. */
function DistanceOrDuration({ day }: { day: Workout }) {
  const theme = useTheme();
  if (day.distanceKm !== undefined) {
    return (
      <Text style={[styles.distance, { color: theme.text.primary }]}>
        {day.distanceKm} <Text style={styles.unit}>km</Text>
      </Text>
    );
  }
  if (day.durationMin !== undefined) {
    return (
      <Text style={[styles.distance, { color: theme.text.primary }]}>
        {day.durationMin} <Text style={styles.unit}>min</Text>
      </Text>
    );
  }
  return null;
}

function composeWorkoutLabel(dayNumber: number, day: Workout): string {
  // `day.label` is an abbreviated code ("ER", "TR" ...) — read the expanded name aloud, not the
  // bare letters (`src/lib/notation.ts`, per `docs/reference/coaching/notation.md`).
  const parts = [`Day ${dayNumber}`, expandLabel(day.label)];
  if (day.distanceKm !== undefined) parts.push(`${day.distanceKm} kilometers`);
  if (day.durationMin !== undefined) parts.push(`${day.durationMin} minutes`);
  if (day.pace) parts.push(formatPace(day.pace));
  if (day.hrZone) parts.push(`heart rate zone ${day.hrZone}`);
  parts.push(day.effortDescription);
  // The row is flattened (`accessible` above collapses its whole subtree into this one label),
  // so the structure line — the rep prescription the notation ruling exists to carry — would
  // otherwise never reach a screen reader at all. Speak it expanded, not as raw shorthand.
  if (day.structure) parts.push(speakStructure(day.structure));
  return parts.join(', ');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dayGutter: {
    width: Spacing.six,
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    paddingTop: Spacing.half,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  label: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.md,
  },
  distance: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.md,
  },
  unit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  mono: {
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.sm,
  },
  description: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  structure: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  restText: {
    flex: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    paddingTop: Spacing.half,
  },
});
