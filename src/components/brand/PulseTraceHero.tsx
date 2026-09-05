import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { PulseTraceLayout, PulseTraceMotion, PulseTracePalette } from '@/constants/pulseTrace';
import { Spacing, Stroke } from '@/constants/theme';
import {
  PULSE_RHYTHM,
  normalizeBeats,
  pulseTracePath,
  pulseTracePoints,
  pulseTraceTables,
  scrollProgress,
  type PulseBeat,
} from '@/lib/pulseTrace';

/**
 * The pulse trace — the redesign's signature onboarding animation and the ONE deliberately bold,
 * expressive element in an otherwise near-monochrome app (captain-approved concept, 2026-09-03).
 * A thin icy-cyan ECG-style waveform draws itself across a near-black field, standing for pace
 * and effort: it idles along a flat baseline and snaps through each spike, the beats building and
 * quickening, then easing off.
 *
 * Two ways to drive it, one number underneath:
 *
 * - **Self-drawing** (no `progress`): mount it and it draws once — a beat of flat baseline, then
 *   the head crosses the field at constant paper speed, then a soft light sweeps the finished
 *   trace on a slow loop. `onSettled` fires when the draw completes (a caller gating a CTA on it
 *   gets a token-derived ceiling behind it, so the gate can never hang).
 * - **Scroll-driven** (`progress`, a Reanimated `SharedValue` in 0..1): the head follows the
 *   value, so the trace draws as the runner scrolls, and a spike placed at a section boundary
 *   (`beats`, see `lib/pulseTrace.ts`'s `beatsAtMarks`) fires exactly as they cross it. The
 *   ambient sweep runs along whatever is drawn so far. `usePulseTraceScroll`, at the bottom of
 *   this file, is the wiring: it hands back the value plus the three `ScrollView` props that keep
 *   it honest on a page too short to scroll.
 *
 * Everything on the UI thread is a table lookup off the head's x-position — `lib/pulseTrace.ts`
 * explains why the geometry is x-monotonic and where the "rhythm" comes from with no per-spike
 * easing. The component owns nothing but rendering and the two shared values.
 *
 * It paints its OWN dark field regardless of the surrounding colour scheme — the bold moment is
 * identical in light and dark mode — and it reads colour only from `constants/pulseTrace.ts`
 * (see that file's header for why not `theme.ts`). Nothing in here may be reused elsewhere in the
 * app: the cyan is the CTA's and this animation's, and nobody else's.
 *
 * Integration notes for the onboarding rebuild live in `docs/design/pulse-trace.md`. The dev
 * preview at `app/dev/pulse-trace.tsx` shows both modes.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

export type PulseTraceHeroSize = keyof typeof PulseTraceLayout.height;

/** Stroke widths for the three stacked passes that make one glowing line: a wide faint bloom, a
 * narrower brighter halo, and the hairline core on top. Stacking is how the glow is drawn without
 * an SVG blur filter, which react-native-svg does not render consistently across platforms. */
const STROKE = {
  bloom: Stroke.mark * 6,
  halo: Stroke.mark * 2.5,
  core: Stroke.mark,
  sweep: Stroke.mark * 2,
} as const;

/** Resting and boosted opacities for the glow passes. The boost is the "kick" — the bloom flares
 * as the head goes through a spike and decays on the far side. */
const GLOW = {
  bloomRest: 0.08,
  bloomKick: 0.2,
  haloRest: 0.24,
  haloKick: 0.3,
} as const;

/** The head: a hot core dot with a soft halo, both swelling a little on a spike. Radii in points.
 * The swell is deliberately small — a halo that balloons on every beat reads as a blob chasing the
 * line, and the flare is meant to be felt in the line's own glow, not in the dot. */
const HEAD = {
  coreRest: 2.5,
  coreKick: 1,
  haloRest: 7,
  haloKick: 3,
  haloRestOpacity: 0.16,
  haloKickOpacity: 0.18,
} as const;

/** How the kick is timed against the head's x, in fractions of the width: it ramps up over
 * `before` as the head approaches an R-peak and decays over `after` past it, so the flare lands on
 * the spike and lingers just long enough to register. */
const KICK = { before: 0.02, after: 0.07 } as const;

/** The head and its cursor fade in over this much of the width at the left edge and out over the
 * same at the right, so the dot enters and leaves the field like a stylus lifting off the paper
 * rather than sitting half-clipped against either edge. The trace itself still runs edge to edge. */
const HEAD_EDGE_FADE = 0.03;

/** The sweeping light's length as a fraction of the width. */
const SWEEP_FRACTION = 0.22;

/** The phosphor trail: the stretch of line just behind the head is drawn hotter than the settled
 * line, the way a monitor's freshly-written trace glows before it cools. Length as a fraction of
 * the width, and the peak opacity of that pass. It fades with the head at either edge. */
const TRAIL = { fraction: 0.14, opacity: 0.55 } as const;

/** The reveal's cursor — a hairline standing at the head's x, like a strip chart's stylus. */
const CURSOR_OPACITY = 0.12;

/** The inset that keeps the LARGEST thing drawn at the tallest spike inside the trace band — not
 * just the bloom stroke's half-width, but the head's halo at full kick, which is bigger and is
 * centred on the peak vertex itself. Size it from whichever is larger, or the signature beat's
 * halo gets a flat top exactly as the head crests the spike. */
const TRACE_INSET = Math.max(STROKE.bloom / 2, HEAD.haloRest + HEAD.haloKick) + Stroke.thin;

const EASE_IN_OUT = Easing.inOut(Easing.cubic);

export function PulseTraceHero({
  progress,
  beats = PULSE_RHYTHM,
  size: heroSize = 'cover',
  onSettled,
  children,
  style,
}: {
  /**
   * Drive the head from outside: 0 = nothing drawn, 1 = fully drawn. For a scrolling screen take
   * it from `usePulseTraceScroll` (below), which both handles the scroll and seeds the value from
   * layout and content size — a page shorter than its viewport emits no scroll event at all, so a
   * handler-only wiring leaves the field blank. Full recipe: `docs/design/pulse-trace.md`. Omit
   * this prop and the trace draws itself on mount.
   */
  progress?: SharedValue<number>;
  /** Where the spikes go and how tall. Defaults to the fixed house rhythm; a scroll-driven caller
   * passes `beatsAtMarks(...)` so the spikes land on its section boundaries. */
  beats?: readonly PulseBeat[];
  /** `cover` is a landing hero; `band` is a header-height strip a form screen can afford. */
  size?: PulseTraceHeroSize;
  /** Self-drawing mode only: raised once the trace has finished drawing (immediately under
   * reduced motion). Never fires in scroll-driven mode — the runner owns that timeline. */
  onSettled?: () => void;
  /** Copy that sits over the field, above the trace band. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const driven = progress !== undefined;

  const [field, setField] = useState({ width: 0, height: 0 });
  /** The trace band's measured width and its y-offset inside the field. The offset is measured
   * rather than assumed so the grid's baseline rule lands on the real baseline whatever pins the
   * band where it is — the `marginTop: 'auto'`, a caller's `style` padding, tall copy. */
  const [trace, setTrace] = useState({ width: 0, top: 0 });
  const traceWidth = trace.width;

  const traceHeight = Math.min(PulseTraceLayout.maxTraceHeight, PulseTraceLayout.height[heroSize]);

  const points = useMemo(
    () =>
      pulseTracePoints(
        beats,
        traceWidth,
        traceHeight,
        TRACE_INSET,
        PulseTraceLayout.baselineFraction
      ),
    [beats, traceWidth, traceHeight]
  );
  const path = useMemo(() => pulseTracePath(points), [points]);
  const tables = useMemo(() => pulseTraceTables(points), [points]);
  const beatAts = useMemo(() => normalizeBeats(beats).map((beat) => beat.at), [beats]);
  const hasGeometry = tables.total > 0;

  /** The head's x as a fraction of the width, when self-drawing. Ignored when `progress` drives. */
  const clock = useSharedValue(0);
  /** 0..1 position of the ambient light along the drawn portion of the trace. */
  const sweep = useSharedValue(0);
  const head = progress ?? clock;

  // `onSettled` is read through a ref so that `settle` — and every effect that depends on it —
  // stays stable across renders. Without this, a caller passing an inline arrow (which is the
  // natural thing to write) would hand the draw effect a new dependency on the very re-render
  // that `onSettled` itself causes, and the trace would restart the moment it finished.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);
  const settled = useRef(false);
  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettledRef.current?.();
  }, []);

  // Self-draw. Depends on `hasGeometry`, not on the width: a re-measure that changes the width
  // rescales the same head fraction, it must not restart a draw the runner has already watched.
  useEffect(() => {
    if (driven || !hasGeometry) return;

    if (reduceMotion) {
      // No draw: the trace is simply present, complete, immediately.
      clock.value = 1;
      settle();
      return;
    }

    clock.value = 0;
    clock.value = withDelay(
      PulseTraceMotion.lead,
      withTiming(
        1,
        // Linear on purpose: constant paper speed is what makes the spikes snap. An eased draw
        // would slow the head down exactly where the trace should be quickest.
        { duration: PulseTraceMotion.draw, easing: Easing.linear },
        (finished) => {
          'worklet';
          if (finished) runOnJS(settle)();
        }
      )
    );
  }, [clock, driven, hasGeometry, reduceMotion, settle]);

  // The ambient sweep. It travels only the drawn part of the trace (see `sweepProps`). When
  // self-drawing it waits for the draw; when scroll-driven it starts the first time anything is
  // drawn (`sweepStart` below) rather than on mount, so an untouched onboarding is not pushing
  // prop updates to an invisible path every frame.
  const startSweep = useCallback(
    (wait: number) => {
      sweep.value = 0;
      sweep.value = withDelay(
        wait,
        withRepeat(
          withSequence(
            withTiming(1, { duration: PulseTraceMotion.sweep, easing: EASE_IN_OUT }),
            withTiming(0, { duration: 0 }),
            withDelay(PulseTraceMotion.sweepRest, withTiming(0, { duration: 0 }))
          ),
          -1,
          false
        )
      );
    },
    [sweep]
  );
  useEffect(() => {
    if (driven || reduceMotion || !hasGeometry) return;
    startSweep(PulseTraceMotion.lead + PulseTraceMotion.draw);
  }, [driven, hasGeometry, reduceMotion, startSweep]);

  // The draw is timed from layout (`hasGeometry`), so the ceiling must be too — timed from mount
  // it could fire mid-draw on a slow first layout and enable a CTA while the head is still
  // crossing. It only guarantees a gate on `onSettled` can never hang.
  useEffect(() => {
    if (driven || !hasGeometry) return;
    const ceiling = setTimeout(
      settle,
      reduceMotion
        ? 0
        : PulseTraceMotion.lead + PulseTraceMotion.draw + PulseTraceMotion.settleSlack
    );
    return () => clearTimeout(ceiling);
  }, [driven, hasGeometry, reduceMotion, settle]);

  useEffect(
    () => () => {
      cancelAnimation(clock);
      cancelAnimation(sweep);
    },
    [clock, sweep]
  );

  // One lookup per frame, shared by every animated node below. `xs`/`ys`/`arcs` are captured by
  // reference and rebuilt only when the geometry changes (`useMemo` above).
  const { xs, ys, arcs, total } = tables;
  const state = useDerivedValue(() => {
    const fraction = Math.min(1, Math.max(0, head.value));
    if (xs.length < 2) return { x: 0, y: 0, drawn: 0, kick: 0, edge: 0 };
    const x = fraction * xs[xs.length - 1];
    const y = interpolate(x, xs, ys, Extrapolation.CLAMP);
    const drawn = interpolate(x, xs, arcs, Extrapolation.CLAMP);

    let kick = 0;
    for (let i = 0; i < beatAts.length; i += 1) {
      const d = fraction - beatAts[i];
      const v = d < 0 ? 1 + d / KICK.before : 1 - d / KICK.after;
      if (v > kick) kick = v;
    }
    // 0 at either edge of the field, 1 across the middle: the head's presence.
    const edge = Math.max(
      0,
      Math.min(1, fraction / HEAD_EDGE_FADE, (1 - fraction) / HEAD_EDGE_FADE)
    );
    return { x, y, drawn, kick: Math.max(0, kick), edge };
  });

  // Scroll-driven: light the sweep the first time the head has drawn anything.
  const sweepStarted = useSharedValue(false);
  useAnimatedReaction(
    () => driven && !reduceMotion && state.value.drawn > 0,
    (lit) => {
      if (lit && !sweepStarted.value) {
        sweepStarted.value = true;
        runOnJS(startSweep)(PulseTraceMotion.sweepRest);
      }
    },
    [driven, reduceMotion, startSweep]
  );

  const bloomProps = useAnimatedProps(() => ({
    strokeDashoffset: total - state.value.drawn,
    opacity: GLOW.bloomRest + GLOW.bloomKick * state.value.kick,
  }));
  const haloProps = useAnimatedProps(() => ({
    strokeDashoffset: total - state.value.drawn,
    opacity: GLOW.haloRest + GLOW.haloKick * state.value.kick,
  }));
  const coreProps = useAnimatedProps(() => ({
    strokeDashoffset: total - state.value.drawn,
  }));

  const trailLength = traceWidth * TRAIL.fraction;
  const trailProps = useAnimatedProps(() => ({
    // A lit dash that always ENDS at the head: dash start = drawn - trailLength.
    strokeDashoffset: trailLength - state.value.drawn,
    opacity: TRAIL.opacity * state.value.edge,
  }));

  const sweepLength = traceWidth * SWEEP_FRACTION;
  const sweepProps = useAnimatedProps(() => {
    // The lit dash runs from `-sweepLength` (entirely before the path's start, invisible) to end
    // exactly at the drawn arc, so it can never light up trace the head has not reached yet.
    const start = -sweepLength + state.value.drawn * sweep.value;
    return {
      strokeDashoffset: -start,
      opacity: Math.sin(Math.PI * sweep.value) * 0.85,
    };
  });

  const headCoreProps = useAnimatedProps(() => ({
    cx: state.value.x,
    cy: state.value.y,
    r: HEAD.coreRest + HEAD.coreKick * state.value.kick,
    opacity: state.value.edge,
  }));
  const headHaloProps = useAnimatedProps(() => ({
    cx: state.value.x,
    cy: state.value.y,
    r: HEAD.haloRest + HEAD.haloKick * state.value.kick,
    opacity: (HEAD.haloRestOpacity + HEAD.haloKickOpacity * state.value.kick) * state.value.edge,
  }));
  const cursorProps = useAnimatedProps(() => ({
    x1: state.value.x,
    x2: state.value.x,
    opacity: CURSOR_OPACITY * state.value.edge,
  }));

  function handleFieldLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    // Guard the re-render, not just the value: `onLayout` fires on every parent relayout.
    setField((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  }
  function handleTraceLayout(event: LayoutChangeEvent) {
    const { width, y } = event.nativeEvent.layout;
    setTrace((current) => (current.width === width && current.top === y ? current : { width, top: y }));
  }

  // The ECG-paper grid, aligned so one horizontal rule IS the resting baseline.
  const baselineY =
    trace.top + TRACE_INSET + (traceHeight - 2 * TRACE_INSET) * PulseTraceLayout.baselineFraction;
  const grid = useMemo(() => {
    if (field.width === 0 || field.height === 0) return { verticals: [], horizontals: [] };
    const pitch = PulseTraceLayout.gridPitch;
    const verticals: number[] = [];
    for (let x = pitch; x < field.width; x += pitch) verticals.push(x);
    const horizontals: number[] = [];
    for (let y = baselineY; y > 0; y -= pitch) horizontals.unshift(y);
    for (let y = baselineY + pitch; y < field.height; y += pitch) horizontals.push(y);
    return { verticals, horizontals };
  }, [field.width, field.height, baselineY]);

  return (
    // Accessibility is split on purpose. The outer field is NOT one accessible element — on iOS
    // an `accessible` container swallows its descendants, and the copy in `children` is usually
    // the screen's headline. The grid is hidden, the copy is traversed normally, and only the
    // trace band below is announced, as a single labelled image.
    <View
      style={[styles.field, { minHeight: PulseTraceLayout.height[heroSize] }, style]}
      onLayout={handleFieldLayout}
    >
      {field.width > 0 ? (
        <Svg
          style={styles.gridLayer}
          width={field.width}
          height={field.height}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {grid.verticals.map((x) => (
            <Line
              key={`v${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={field.height}
              stroke={PulseTracePalette.grid}
              strokeWidth={Stroke.hairline}
            />
          ))}
          {grid.horizontals.map((y) => (
            <Line
              key={`h${y}`}
              x1={0}
              y1={y}
              x2={field.width}
              y2={y}
              stroke={PulseTracePalette.grid}
              strokeWidth={Stroke.hairline}
            />
          ))}
        </Svg>
      ) : null}

      {children ? <View style={styles.copySlot}>{children}</View> : null}

      <View
        style={[styles.traceBand, { height: traceHeight }]}
        onLayout={handleTraceLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Illustration: a pulse trace drawing itself across a dark field, the beats building and quickening, then easing off."
      >
        {hasGeometry ? (
          <Svg width={traceWidth} height={traceHeight} style={styles.noPointer}>
            {/* The resting line: present before the trace arrives, so the field is never empty
                and the first frame of the draw reads as a flat line coming to life. */}
            <Line
              x1={0}
              y1={ys[0]}
              x2={traceWidth}
              y2={ys[0]}
              stroke={PulseTracePalette.baseline}
              strokeWidth={Stroke.hairline}
            />
            <AnimatedLine
              y1={0}
              y2={traceHeight}
              stroke={PulseTracePalette.trace}
              strokeWidth={Stroke.hairline}
              animatedProps={cursorProps}
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={PulseTracePalette.glow}
              strokeWidth={STROKE.bloom}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={total}
              animatedProps={bloomProps}
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={PulseTracePalette.glow}
              strokeWidth={STROKE.halo}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={total}
              animatedProps={haloProps}
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={PulseTracePalette.trace}
              strokeWidth={STROKE.core}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={total}
              animatedProps={coreProps}
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={PulseTracePalette.head}
              strokeWidth={STROKE.core}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[trailLength, total + trailLength]}
              animatedProps={trailProps}
            />
            {reduceMotion ? null : (
              <AnimatedPath
                d={path}
                fill="none"
                stroke={PulseTracePalette.head}
                strokeWidth={STROKE.sweep}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[sweepLength, total + sweepLength]}
                animatedProps={sweepProps}
              />
            )}
            <AnimatedCircle fill={PulseTracePalette.glow} animatedProps={headHaloProps} />
            <AnimatedCircle fill={PulseTracePalette.head} animatedProps={headCoreProps} />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Everything a scrolling screen needs to drive the hero: the `progress` value to hand it, plus the
 * three `Animated.ScrollView` props that keep it truthful. Spread the props, pass `progress`, done.
 *
 * The seeding on layout and content size is the point of the hook, not a detail. React Native
 * emits no initial `onScroll`, and a page whose content is shorter than its viewport emits none at
 * all — so a handler-only integration leaves `progress` at 0 forever and the runner sees an empty
 * field on a tablet or a short page. Measuring both sides and re-deriving through the same
 * `scrollProgress` resolves that case to a finished trace, which is what `scrollProgress`'s
 * "nothing to scroll" branch has always promised. Owning it here rather than in the recipe is what
 * stops the next screen from copying the broken half.
 */
export function usePulseTraceScroll(): {
  progress: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
} {
  const progress = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);

  const reseed = useCallback(() => {
    if (viewportHeight.current <= 0 || contentHeight.current <= 0) return;
    progress.value = scrollProgress(offsetY.value, contentHeight.current, viewportHeight.current);
  }, [offsetY, progress]);

  const onScroll = useAnimatedScrollHandler((event) => {
    offsetY.value = event.contentOffset.y;
    progress.value = scrollProgress(
      event.contentOffset.y,
      event.contentSize.height,
      event.layoutMeasurement.height
    );
  });

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      reseed();
    },
    [reseed]
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      reseed();
    },
    [reseed]
  );

  return { progress, onScroll, onLayout, onContentSizeChange };
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: PulseTracePalette.field,
    overflow: 'hidden',
  },
  copySlot: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  traceBand: {
    width: '100%',
    // Pinned to the bottom of the field whether or not there is copy above it — an auto margin
    // absorbs the spare height, where `justifyContent: 'space-between'` would only do so with
    // two children.
    marginTop: 'auto',
  },
  // `pointerEvents` as a style, not a prop: the prop form is deprecated on web and warns.
  gridLayer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  noPointer: {
    pointerEvents: 'none',
  },
});
