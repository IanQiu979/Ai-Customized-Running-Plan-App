import { useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { TICK_SECONDS, draw } from '@/lib/buildMotion';

/** One block landing: at `at` seconds its `km` start ticking onto the total, over 150 ms unless
 * the landing says otherwise (a step's input field counts to its value over 0.4 s). */
export interface Landing {
  at: number;
  km: number;
  duration?: number;
}

/** The kilometres landed by time `T`, rounded for display. */
function totalAt(T: number, landings: readonly Landing[], round: boolean): number {
  'worklet';
  let total = 0;
  for (const landing of landings) {
    total += landing.km * draw(T, landing.at, landing.duration ?? TICK_SECONDS);
  }
  return round ? Math.round(total) : Math.round(total * 10) / 10;
}

/**
 * The Number (spec §B.0): tabular figures that count up as blocks land. The value shown is the
 * sum of every landed block's kilometres, each added over 150 ms from the instant its bar
 * finishes rising, so the total visibly ticks with each landing rather than gliding. While a
 * tick is in progress the figure scales to 1.02 — the page's "ticking" nudge.
 *
 * The text itself is React state, updated from the UI thread only when the rounded value
 * changes (a 25 km week is 25 updates, not one per frame). The nudge is a UI-thread transform.
 */
export function CountUp({
  T,
  landings,
  style,
  tickScale = 1.02,
  round = true,
}: {
  T: SharedValue<number>;
  landings: readonly Landing[];
  style?: StyleProp<TextStyle>;
  tickScale?: number;
  /** Show whole kilometres. Off, the figure keeps one decimal while ticking. */
  round?: boolean;
}) {
  // Under reduced motion the clock sits at its end frame from the first render, and the end
  // frame must not flash a 0 — so the figure is seeded with the landed total. (Seeded from the
  // landings rather than by reading `T.value` during render, which Reanimated forbids.)
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(() =>
    reduceMotion ? totalAt(Number.POSITIVE_INFINITY, landings, round) : 0
  );

  useAnimatedReaction(
    () => totalAt(T.value, landings, round),
    (value, previous) => {
      if (value !== previous) runOnJS(setShown)(value);
    },
    [landings, round]
  );

  const nudge = useAnimatedStyle(() => {
    let ticking = false;
    for (const landing of landings) {
      if (T.value > landing.at && T.value < landing.at + (landing.duration ?? TICK_SECONDS)) {
        ticking = true;
      }
    }
    return { transform: [{ scale: ticking ? tickScale : 1 }] };
  }, [landings, tickScale]);

  return (
    <Animated.View style={nudge}>
      <Text style={style} accessibilityLiveRegion="none">
        {shown}
      </Text>
    </Animated.View>
  );
}
