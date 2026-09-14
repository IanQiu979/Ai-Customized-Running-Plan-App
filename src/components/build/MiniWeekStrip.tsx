import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StripWeek } from '@/lib/weekStrip';

/**
 * A week at thumbnail size — the row miniature on the plan overview (V22-06 A: 120 × 22, 4pt
 * gap), on Home's and My Plans' plan rows (60 × 28, 3pt gap). No labels, no numerals, no
 * animation. A rest day is a 2pt dash in the slot colour; a run day a bar in its session tone.
 * `dim` draws every bar at 55% — the plan overview's treatment for weeks other than the current
 * one.
 */
export function MiniWeekStrip({
  week,
  width = 60,
  height = 28,
  gap = 3,
  dim = false,
  style,
}: {
  week: StripWeek;
  width?: number;
  height?: number;
  gap?: number;
  dim?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.row, { width, height, gap }, style]}
      aria-hidden
    >
      {week.map((block, index) =>
        block ? (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: `${block.h * 100}%`,
                backgroundColor: theme.session[block.tone],
                opacity: dim ? DIM_OPACITY : 1,
              },
            ]}
          />
        ) : (
          <View key={index} style={[styles.dash, { backgroundColor: theme.grid.slot }]} />
        )
      )}
    </View>
  );
}

/** The plan overview dims every week but the current one to this (V22-06 A). */
export const DIM_OPACITY = 0.55;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: Spacing.half,
    borderTopRightRadius: Spacing.half,
  },
  dash: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
});
