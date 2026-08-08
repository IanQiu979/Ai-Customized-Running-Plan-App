import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AmbientPulseFloor, Effort, Motion, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { EffortLevel } from '@/lib/planTypes';

/**
 * The onboarding hero: ONE week of the app's signature ribbon motif, at hero scale, building
 * itself once and then settling into a slow ambient pulse.
 *
 * It is the same instrument as `components/plan/WeekAccordion.tsx` — seven cells, run days as
 * bars coloured *and* height-ramped by effort, rest days as real gaps, an unbroken hairline
 * baseline — with two deliberate differences:
 *
 *   1. Geometry is scaled 2× (track `Spacing.seven`, gap `Spacing.one`) because this is a hero,
 *      not a list row.
 *   2. The week-number gutter is omitted, so no text glyph ever sits on or beside an
 *      effort-coloured bar.
 *
 * It is exactly ONE week, never a stack of them: a multi-week barcode is plan view's signature
 * and stays unique to a real generated plan (`frontend-design-brief.md` Part 3).
 *
 * The week below is an illustration, not the user's data, and is deliberately not a `Week` from
 * `planTypes.ts` — it has no volume, no labels and no paces to be honest about.
 */

/** Full track height of an `interval` (100%) bar; every other effort is a fraction of it, per the
 * monotonic ramp in `Effort[level].barHeight`. 2× `WeekAccordion`'s `Spacing.five`. */
const BAR_TRACK_HEIGHT = Spacing.seven; // 64
/** 2× `WeekAccordion`'s `Spacing.half`. */
const CELL_GAP = Spacing.one; // 4
/** How far the pop/glow extends past the bar on every side. */
const GLOW_SPREAD = Spacing.half;

/**
 * The beat between one cell's entrance and the next. There is no dedicated stagger token and one
 * is not warranted: `instant` is the smallest existing duration and a beat-to-beat gap is exactly
 * the quantity it measures. Reusing it here is intentional — noted so a later reader doesn't
 * "fix" it into a magic number.
 */
const STAGGER = Motion.duration.instant; // 100

const EASE_OUT = Easing.bezier(...Motion.curve.easeOut);
const EASE_IN = Easing.bezier(...Motion.curve.easeIn);

/**
 * `Motion.spring.snappy` records a damping ratio only — the design token is the *shape*, one
 * crisp overshoot, not a platform config. Pairing it with `standard` gives that shape a ~250ms
 * settle tail, which is what makes the whole six-cell build resolve inside ~850ms.
 */
const ENTRANCE_SPRING = {
  dampingRatio: Motion.spring.snappy.dampingRatio,
  duration: Motion.duration.standard,
} as const;

/** Below this the bar is still travelling; at or above it, it has locked into place. */
const FULL_HEIGHT = 1;

type RibbonCellSpec = { kind: 'run'; effort: EffortLevel } | { kind: 'rest' };

/**
 * A real microcycle, not a sorted colour ramp: all five efforts appear, and the two hard days
 * (tempo, interval) sit three days apart with both a recovery day and the rest day between them.
 * Heights and hues are derived from `Effort` / `theme.effort` — never written down here.
 */
const HERO_WEEK: readonly RibbonCellSpec[] = [
  { kind: 'run', effort: 'easy' },
  { kind: 'run', effort: 'tempo' },
  { kind: 'run', effort: 'recovery' },
  { kind: 'rest' },
  { kind: 'run', effort: 'interval' },
  { kind: 'run', effort: 'recovery' },
  { kind: 'run', effort: 'steady' }, // the long run, closing the week
];

/**
 * A ceiling on how long the CTA may stay disabled, in case an animation callback never fires
 * (a backgrounded app, a dropped frame budget on a cold start). Derived from the tokens the
 * build itself is made of, plus one `slow` of slack — never a hand-picked number.
 */
const BUILD_CEILING_MS = HERO_WEEK.length * STAGGER + Motion.duration.standard + Motion.duration.slow;
const REDUCED_CEILING_MS = Motion.duration.standard + Motion.duration.slow;

export function HeroRibbon({ onSettled }: { onSettled: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  /** One value for all six bars, so the ambient pulse is strictly in phase. A per-cell phase
   * offset would be a travelling sweep, which is loading-skeleton vocabulary. */
  const barOpacity = useSharedValue(1);

  const settled = useRef(false);
  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;

    // Phase C → D. Ease into the loop over `standard`, then yoyo forever between full and the
    // scheme's own floor — opacity only, never hue, position or scale. Dark mode can afford
    // `PressedOpacity` (0.7); light mode cannot without dropping the effort fills below the 3:1
    // floor this channel is accessibility-mandated to clear — see `AmbientPulseFloor`'s comment
    // in `theme.ts` for the contrast numbers behind the two floors.
    if (!reduceMotion) {
      const floor = AmbientPulseFloor[theme.scheme];
      barOpacity.value = withSequence(
        withTiming(floor, { duration: Motion.duration.standard, easing: EASE_OUT }),
        withRepeat(
          withSequence(
            withTiming(1, { duration: Motion.duration.ambient, easing: EASE_OUT }),
            withTiming(floor, { duration: Motion.duration.ambient, easing: EASE_IN })
          ),
          -1,
          false
        )
      );
    }

    onSettled();
  }, [barOpacity, onSettled, reduceMotion, theme.scheme]);

  // The gate is driven by the last cell's own completion callback (below); this only guarantees
  // it can never hang, so the CTA always ends up interactive.
  useEffect(() => {
    const ceiling = setTimeout(settle, reduceMotion ? REDUCED_CEILING_MS : BUILD_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [reduceMotion, settle]);

  useEffect(() => () => cancelAnimation(barOpacity), [barOpacity]);

  const lastRunSlot = HERO_WEEK.reduce(
    (last, cell, index) => (cell.kind === 'run' ? index : last),
    0
  );

  return (
    // One node, one static label. The label lives on this wrapper rather than on the ribbon
    // itself because Android's `no-hide-descendants` hides the labelled view too — putting both
    // on a single node would silently drop the description there.
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Illustration of a sample training week: six runs at different intensities and one rest day."
      style={styles.frame}
    >
      <View
        style={styles.bleed}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.ribbon, { borderBottomColor: theme.hairline }]}>
          {HERO_WEEK.map((cell, index) => (
            <RibbonCell
              key={index}
              cell={cell}
              // The rest day keeps its stagger slot even though it has no bar, so the beat
              // never skips a count.
              slot={index}
              barOpacity={barOpacity}
              reduceMotion={reduceMotion}
              onComplete={index === lastRunSlot ? settle : undefined}
            />
          ))}
        </View>
        <View style={styles.ticks}>
          {HERO_WEEK.map((_, index) => (
            <View key={index} style={styles.tickCell}>
              <View style={[styles.tick, { backgroundColor: theme.hairline }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function RibbonCell({
  cell,
  slot,
  barOpacity,
  reduceMotion,
  onComplete,
}: {
  cell: RibbonCellSpec;
  slot: number;
  barOpacity: SharedValue<number>;
  reduceMotion: boolean;
  /** Set on the last run cell only — the cascade's own "we're done" signal. */
  onComplete?: () => void;
}) {
  const theme = useTheme();

  /** Bottom-anchored vertical scale of a bar already laid out at its true height: the slot never
   * resizes, the fill inside it is what moves. */
  const scale = useSharedValue(0);
  const glow = useSharedValue(0);
  /**
   * Latches at 1 the first frame the bar reaches full height, and never falls back. It must be a
   * latch, not a live `scale >= 1` test: `snappy` overshoots to ~1.09 and then settles *through*
   * 1.0 from above, dipping a few ten-thousandths below it — a live test flickers the bar back to
   * inert gray for a frame on the way down. Verified in a browser before this was a latch.
   */
  const locked = useSharedValue(0);

  /** Kept in a ref so the entrance effect below never re-runs — and never restarts a bar
   * mid-flight — just because the parent handed down a new callback identity. */
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const notifyComplete = useCallback(() => completeRef.current?.(), []);

  const isRun = cell.kind === 'run';
  const height = isRun ? BAR_TRACK_HEIGHT * Effort[cell.effort].barHeight : 0;
  const effortColor = isRun ? theme.effort[cell.effort] : theme.progress.disabled;
  /**
   * The bar travels inert (`progress.disabled`, the same gray the brief's ghost ribbon uses)
   * and hard-swaps to its effort colour the frame it locks in — never an interpolation, which
   * would pass through muddy hues that mean nothing in a system where a colour is an intensity.
   * Under reduced motion there is no travel to be inert during: the colour is present the instant
   * any height is.
   */
  const inertColor = theme.progress.disabled;

  useEffect(() => {
    if (!isRun) return;

    if (reduceMotion) {
      // No stagger, no spring travel: every bar grows to full height at once, in one `standard`
      // window, and holds there permanently.
      scale.value = withTiming(
        1,
        { duration: Motion.duration.standard, easing: EASE_OUT },
        (finished) => {
          'worklet';
          if (finished) runOnJS(notifyComplete)();
        }
      );
      return;
    }

    scale.value = withDelay(
      slot * STAGGER,
      withSpring(1, ENTRANCE_SPRING, (finished) => {
        'worklet';
        if (finished) runOnJS(notifyComplete)();
      })
    );
  }, [isRun, notifyComplete, reduceMotion, scale, slot]);

  useEffect(() => {
    const value = scale;
    const bloom = glow;
    return () => {
      cancelAnimation(value);
      cancelAnimation(bloom);
    };
  }, [glow, scale]);

  // The colour swap and the pop are the same instant: the frame the bar first reaches full
  // height, a plain View at the bar's OWN effort colour appears at full opacity and fades out
  // over `quick`. No blur (unavailable on Android) and no new hue — the hivis accent has exactly
  // one sanctioned use and this is not it.
  useAnimatedReaction(
    () => scale.value,
    (current) => {
      'worklet';
      if (reduceMotion || !isRun) return;
      if (locked.value === 0 && current >= FULL_HEIGHT) {
        locked.value = 1;
        glow.value = 1;
        glow.value = withTiming(0, { duration: Motion.duration.quick, easing: EASE_OUT });
      }
    }
  );

  const barStyle = useAnimatedStyle(() => ({
    // Bottom-anchored scale, written as translate/scale/translate rather than leaning on a
    // static `transformOrigin` merging with a Reanimated-driven `transform`. Same result, no
    // dependency on prop-merge order: the bar's bottom edge is pinned to the baseline and only
    // its top edge travels.
    transform: [{ translateY: height / 2 }, { scaleY: scale.value }, { translateY: -height / 2 }],
    backgroundColor: reduceMotion || locked.value === 1 ? effortColor : inertColor,
    opacity: barOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    // Stops rendering entirely once it has bloomed — it is an event, not furniture.
    display: glow.value > 0 ? 'flex' : 'none',
  }));

  return (
    <View style={styles.cell}>
      {isRun ? (
        <View style={[styles.slot, { height }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { backgroundColor: effortColor }, glowStyle]}
          />
          <Animated.View style={[styles.bar, barStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    // Vertical room for the glow's overhang, so cropping horizontally never clips the bloom.
    paddingVertical: GLOW_SPREAD,
    overflow: 'hidden',
  },
  bleed: {
    // Full-bleed: the end cells run past both screen edges and are cropped by `frame`.
    marginHorizontal: -Spacing.four,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: CELL_GAP,
    height: BAR_TRACK_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth, // the baseline — unbroken under the rest gap
  },
  cell: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  slot: {
    // Laid out at the bar's true target height; the bar only ever scales inside it.
    justifyContent: 'flex-end',
  },
  bar: {
    flex: 1,
    // Top-only — bars rise from the baseline below, they don't float above it.
    borderTopLeftRadius: Spacing.half,
    borderTopRightRadius: Spacing.half,
  },
  glow: {
    position: 'absolute',
    top: -GLOW_SPREAD,
    left: -GLOW_SPREAD,
    right: -GLOW_SPREAD,
    bottom: -GLOW_SPREAD,
    borderTopLeftRadius: Spacing.half,
    borderTopRightRadius: Spacing.half,
  },
  ticks: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  tickCell: {
    flex: 1,
    alignItems: 'center',
  },
  tick: {
    width: StyleSheet.hairlineWidth,
    height: Spacing.two,
  },
});
