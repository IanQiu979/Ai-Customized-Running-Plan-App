import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { MARK_CELL_RISE, MARK_CELL_STAGGER, enter } from '@/lib/buildMotion';

/**
 * The Home header mark (V22-04): a tiny 7-slot week strip beside the tier / plans-used counter.
 * 6 × 10 pt cells, 4 pt gap, 2 pt radius, slots at the slot colour; the completed days fill
 * bottom-up in ink, each over 300 ms and 70 ms after the one before, then hold. It plays once
 * on screen open and re-runs only when the data changes — the caller owns the clock.
 *
 * `scale` enlarges the whole mark uniformly; the page draws it at 1.4 in the tier row.
 */
export function HeaderMark({
  T,
  completedDays,
  fillAt = 0,
  scale = 1.4,
}: {
  T: SharedValue<number>;
  /** How many of the seven slots are filled, 0..7. */
  completedDays: number;
  /** When the fill begins on the caller's clock. */
  fillAt?: number;
  scale?: number;
}) {
  const theme = useTheme();
  const cell = { width: 6 * scale, height: 10 * scale, borderRadius: 2 * scale };
  return (
    <View
      style={[styles.row, { gap: 4 * scale }]}
      accessible
      accessibilityLabel={`${completedDays} of 7 days into this week`}
    >
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <View key={index} style={[styles.cell, cell, { backgroundColor: theme.grid.slot }]}>
          {index < completedDays ? (
            <Fill T={T} at={fillAt + index * MARK_CELL_STAGGER} color={theme.text.primary} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Fill({ T, at, color }: { T: SharedValue<number>; at: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    height: `${enter(T.value, at, MARK_CELL_RISE) * 100}%`,
  }));
  return <Animated.View testID="header-mark-fill" style={[styles.fill, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
  },
});
