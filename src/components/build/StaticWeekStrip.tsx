import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StripWeek } from '@/lib/weekStrip';

/**
 * A week strip with no animation — the plan-detail week (V22-06 B, "the strip replaces the
 * graph") and Home's empty-state preview. Seven columns on a slot-coloured baseline; a run day
 * is a bar with its number above it, a rest day a short dash; `01 … 07` under the columns with
 * the current day, if any, in ink. Plain views, no clock: this is the end frame and nothing
 * else, which is also what every animated strip becomes under reduced motion.
 */
export function StaticWeekStrip({
  week,
  currentDay,
  height = 120,
}: {
  week: StripWeek;
  /** 0-based index of the day to highlight in the numerals row. */
  currentDay?: number;
  /** Total height, label room included. The page's is 120 with 26pt of label room. */
  height?: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { height, borderBottomColor: theme.grid.slot }]}>
        {week.map((block, index) => (
          <View key={index} style={styles.column}>
            {block ? (
              <View
                style={[
                  styles.bar,
                  { height: `${block.h * 100}%`, backgroundColor: theme.session[block.tone] },
                ]}
              >
                <Text style={[styles.value, { color: theme.text.primary }]} numberOfLines={1}>
                  {block.value}
                </Text>
              </View>
            ) : (
              <View style={[styles.dash, { backgroundColor: theme.grid.slot }]} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.numerals}>
        {week.map((_, index) => {
          const current = index === currentDay;
          return (
            <Text
              key={index}
              style={[
                styles.numeral,
                current
                  ? { color: theme.text.primary, fontFamily: FontFamily.mono.medium }
                  : { color: theme.text.secondary },
              ]}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/** The label room above the tallest bar — the page's `padding-top: 26px`. */
const LABEL_ROOM = 26;

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two + Spacing.half,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two + Spacing.half,
    paddingTop: LABEL_ROOM,
    borderBottomWidth: Stroke.thin,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: Radius.bar,
    borderTopRightRadius: Radius.bar,
  },
  value: {
    position: 'absolute',
    left: -6,
    right: -6,
    bottom: '100%',
    paddingBottom: 5,
    textAlign: 'center',
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.sm,
  },
  dash: {
    height: 2,
  },
  numerals: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
  numeral: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: Tracking.label,
  },
});
