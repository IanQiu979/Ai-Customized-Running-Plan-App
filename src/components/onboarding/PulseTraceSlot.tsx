import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { Accent, Spacing } from '@/constants/theme';

/**
 * ============================ INTEGRATION POINT ============================
 *
 * A PLACEHOLDER for `<PulseTraceHero>` — the redesign's signature onboarding animation, owned by
 * a parallel task (`v22-redesign-animation`, branch `fm/v22-redesign-animation`) that had not
 * landed on this branch when the screens below were built.
 *
 * **To integrate, once that branch is merged:** delete this file and change the single import in
 * `src/app/(auth)/onboarding.tsx` from
 *
 *     import { PulseTraceSlot } from '@/components/onboarding/PulseTraceSlot';
 *
 * to
 *
 *     import { PulseTraceHero as PulseTraceSlot } from '@/components/brand/PulseTraceHero';
 *
 * Nothing else changes. This component's props are a deliberate subset of that one's, with the
 * same names and the same meanings, so the swap is an import line and no call-site edits:
 *
 *   - `progress?: SharedValue<number>` — 0..1, drives the trace's head from the caller's scroll.
 *   - `size?: 'cover' | 'band'` — a landing hero vs a header-height strip.
 *   - `onSettled?: () => void` — self-drawing mode only; raised once the draw finishes.
 *   - `children` — copy that sits over the dark field.
 *   - `style`
 *
 * What it renders in the meantime is intentionally the *static* end state of that animation and
 * not an approximation of it: the same near-black field (`Accent.field`), the same icy-cyan
 * (`Accent.signal`) hairline waveform, no motion. That way the surrounding layout, spacing and
 * contrast are already correct against the real thing, and swapping the import changes only
 * whether the line draws itself.
 *
 * ===========================================================================
 */

export type PulseTraceSlotSize = 'cover' | 'band';

const HEIGHT: Record<PulseTraceSlotSize, number> = { cover: 256, band: 128 };

/**
 * The static waveform, in a 0..100 × 0..40 viewBox stretched to the band. Flat baseline, three
 * spikes growing left to right — the shape the animated component settles into.
 */
const TRACE =
  'M 0 20 L 14 20 L 17 20 L 19 13 L 21 26 L 23 20 L 40 20 L 43 20 L 45 9 L 47 29 L 49 20 ' +
  'L 66 20 L 70 20 L 72 3 L 74 33 L 76 20 L 100 20';

export function PulseTraceSlot({
  progress,
  size = 'cover',
  onSettled,
  children,
  style,
}: {
  progress?: SharedValue<number>;
  size?: PulseTraceSlotSize;
  onSettled?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // The real component raises this when its draw completes. With no draw there is nothing to
  // wait for, so it lands on mount — which is also exactly what the real one does under reduced
  // motion. A caller gating a CTA on it is therefore never stranded by the placeholder.
  useEffect(() => {
    if (progress === undefined) onSettled?.();
  }, [progress, onSettled]);

  const height = HEIGHT[size];

  return (
    <View
      style={[styles.field, { height, backgroundColor: Accent.field }, style]}
      // One node to VoiceOver: the field is a picture, and the copy over it is the label. Without
      // this the waveform is announced as an unlabelled image between the eyebrow and the heading.
      accessible={false}
    >
      <View style={styles.copy}>{children}</View>

      <View style={styles.band} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <Line
            x1="0"
            y1="20"
            x2="100"
            y2="20"
            stroke={Accent.signal}
            strokeOpacity={0.18}
            strokeWidth={0.3}
          />
          <Path
            d={TRACE}
            fill="none"
            stroke={Accent.signal}
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    overflow: 'hidden',
  },
  copy: {
    gap: Spacing.two,
  },
  band: {
    height: Spacing.six,
    marginTop: Spacing.three,
    // A fixed floor so the band never collapses to nothing when the copy above it grows at large
    // Dynamic Type sizes — the same failure the real component guards against.
    minHeight: Spacing.five,
  },
});
