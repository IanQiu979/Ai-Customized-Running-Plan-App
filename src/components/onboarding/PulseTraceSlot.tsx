import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { Accent, Spacing, Stroke } from '@/constants/theme';

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
 * **One difference to check at swap time.** This slot treats `size` as a *minimum* height and
 * grows with its copy; `<PulseTraceHero>` treats it as a fixed height. Every caller here
 * therefore keeps its field copy to a single short mono line and puts headings on the page below,
 * so neither component can clip at large Dynamic Type sizes — but if a future caller puts tall
 * copy in the field, verify it against the real component's fixed height rather than this one's.
 *
 * ===========================================================================
 */

export type PulseTraceSlotSize = 'cover' | 'band';

/** `cover` is a landing hero, `band` a header-height strip. A floor rather than a fixed height:
 * see the swap note in the header. */
const MIN_HEIGHT: Record<PulseTraceSlotSize, number> = { cover: 256, band: 128 };

/**
 * The static waveform, in a 0..100 × 0..40 viewBox stretched to the band. Flat baseline, three
 * spikes growing left to right — the shape the animated component settles into.
 */
const TRACE =
  'M 0 20 L 17 20 L 18 22.5 L 19 10 L 20 25 L 21 20 ' +
  'L 44 20 L 45 23 L 46 6.5 L 47 26.5 L 48 20 ' +
  'L 71 20 L 72 23.5 L 73 2.5 L 74 28 L 75 20 L 100 20';

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

  const minHeight = MIN_HEIGHT[size];

  return (
    <View style={[styles.field, { minHeight, backgroundColor: Accent.field }, style]}>
      <View style={styles.copy}>{children}</View>

      {/* The waveform is decoration and carries no information the copy does not. Hidden from
          assistive tech on both platforms so it is not announced as an unlabelled graphic between
          the eyebrow and whatever follows — and NOT by making the field itself one accessible
          node, which would swallow the copy instead. */}
      <View
        style={styles.band}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <Line
            x1="0"
            y1="20"
            x2="100"
            y2="20"
            stroke={Accent.signal}
            strokeOpacity={0.18}
            strokeWidth={Stroke.hairline}
          />
          <Path
            d={TRACE}
            fill="none"
            stroke={Accent.signal}
            strokeWidth={Stroke.mark}
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
