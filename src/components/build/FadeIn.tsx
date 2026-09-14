import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { enter } from '@/lib/buildMotion';

/**
 * Something arriving on a build clock: fades in (ease-out) over `duration` seconds from `at`,
 * rising through `lift` points as it does. The pages use this for every piece of chrome that
 * appears once the build settles — a legend, a cue, a call-to-action, a list.
 */
export function FadeIn({
  T,
  at,
  duration = 0.5,
  lift = 0,
  style,
  children,
  pointerEvents,
}: {
  T: SharedValue<number>;
  at: number;
  duration?: number;
  lift?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}) {
  const animated = useAnimatedStyle(() => {
    const e = enter(T.value, at, duration);
    return { opacity: e, transform: [{ translateY: (1 - e) * lift }] };
  });
  return (
    <Animated.View style={[style, animated]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
