import { StyleSheet, Text, View } from 'react-native';

import { EffortChip } from '@/components/plan/EffortChip';
import { ReadoutBracket } from '@/components/plan/ReadoutBracket';
import { FontFamily, FontSize, Spacing, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A single sample workout row, rendered the way a Pro/Elite plan renders one — effort chip, run
 * type, a bracketed pace, an HR zone, and a line of coach's "why". Home shows it inside a
 * `LockedPanel` so a Free-tier runner can see exactly what the paid tiers add.
 *
 * The content is a fixed illustration, deliberately not a `Workout` from `planTypes.ts` and
 * deliberately not derived from the runner's own intake. Two reasons, and both matter:
 *
 *  1. A pace shown to a Free runner who has no plan would be a training prescription the app has
 *     not actually computed for them. `AGENTS.md`: coaching content is never invented.
 *  2. Feeding real intake through would put plan generation in the client, which is Worker work.
 *
 * It reuses `EffortChip` and `ReadoutBracket` rather than restyling them, so the teaser cannot
 * drift from what the plan view will actually look like once they upgrade — which is the entire
 * promise the teaser is making.
 */

/** One ordinary Tuesday from a mid-block Pro plan. Numbers are illustrative and are labelled as
 * such by the panel that frames this. */
const SAMPLE = {
  effort: 'tempo',
  runType: 'TR — Tempo Run',
  structure: '15min WU · 20min @ tempo · 10min CD',
  pace: '4:42–4:55 /km',
  hrZone: 'Z4',
  why: 'Threshold work is the single biggest lever on race pace this far out — hold the effort, not the clock.',
} as const;

export function PlanContentTeaser() {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.headline}>
        <EffortChip effort={SAMPLE.effort} />
        <Text style={[styles.runType, { color: theme.text.primary }]}>{SAMPLE.runType}</Text>
      </View>

      <Text style={[styles.structure, { color: theme.text.secondary }]}>{SAMPLE.structure}</Text>

      <View style={styles.readouts}>
        <View style={styles.readout}>
          <Text style={[styles.readoutLabel, { color: theme.text.secondary }]}>PACE</Text>
          <ReadoutBracket>
            <Text style={[styles.readoutValue, { color: theme.text.primary }]}>{SAMPLE.pace}</Text>
          </ReadoutBracket>
        </View>
        <View style={styles.readout}>
          <Text style={[styles.readoutLabel, { color: theme.text.secondary }]}>HR ZONE</Text>
          <ReadoutBracket>
            <Text style={[styles.readoutValue, { color: theme.text.primary }]}>{SAMPLE.hrZone}</Text>
          </ReadoutBracket>
        </View>
      </View>

      <View style={[styles.why, { borderLeftColor: theme.hairline }]}>
        <Text style={[styles.whyLabel, { color: theme.text.secondary }]}>COACH&apos;S NOTE</Text>
        <Text style={[styles.whyText, { color: theme.text.secondary }]}>{SAMPLE.why}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  runType: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.md,
  },
  structure: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  readouts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
    marginTop: Spacing.one,
  },
  readout: {
    gap: Spacing.half,
  },
  readoutLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  readoutValue: {
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.sm,
  },
  why: {
    marginTop: Spacing.one,
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  whyLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  whyText: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
});
