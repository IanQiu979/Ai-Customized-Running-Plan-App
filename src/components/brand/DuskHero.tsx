import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DuskGradient, Motion, Spacing, Stroke } from '@/constants/theme';
import { ROUTE_PROFILE, routeLength, routePath, routePoints } from '@/lib/routeProfile';

/**
 * The signed-out hero — Trailhead's ONE deliberate bold exception
 * (`docs/design/trailhead-visual-system.md` §1). A plum → ember → amber dusk gradient with the
 * route-line motif drawing itself across it once and then settling into a slow ambient glow.
 *
 * It replaces `HeroRibbon`, which put a hero-scale copy of the plan view's own week ribbon on the
 * landing screen. Two reasons that had to go: the signature motif is the route line now, and a
 * hero that borrows the plan's data viz spends the app's most memorable surface on a picture of
 * something the runner cannot see yet.
 *
 * Everything past the session gate is paper and ink. Nothing in this file may be reused there.
 *
 * `children` renders over the gradient's top portion, which is where the two darkest stops are —
 * `onDusk` is 14.18:1 on the plum and 7.34:1 on the ember mid-stop. The amber tail carries no
 * text by design (3.17:1); the container below reserves it for the route line alone.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const EASE_OUT = Easing.bezier(...Motion.curve.easeOut);
const EASE_IN = Easing.bezier(...Motion.curve.easeIn);

/** The trough of the settled ambient glow. Unlike the previous system's ambient pulse this needs
 * no contrast floor negotiated for it: it dims a decorative light stroke against a dark gradient,
 * in a band that carries no text. */
const GLOW_FLOOR = 0.45;

/** A ceiling on how long the CTA may stay disabled, in case an animation callback never fires (a
 * backgrounded app, a dropped frame budget on a cold start). Derived from the tokens the draw is
 * made of, plus one `slow` of slack — never a hand-picked number. */
const DRAW_CEILING_MS = Motion.duration.reveal + Motion.duration.slow;

export function DuskHero({
  onSettled,
  children,
}: {
  /** Raised once the line has finished drawing. The captain's constraint: the hero must be
   * settled, not mid-build, before the CTA becomes interactive. */
  onSettled: () => void;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });

  /** 1 = fully hidden, 0 = fully drawn. Expressed as a fraction rather than in points so it does
   * not have to be reset when the hero is measured at a different width. */
  const drawn = useSharedValue(1);
  const glow = useSharedValue(1);

  const settled = useRef(false);
  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled();
  }, [onSettled]);

  const inset = Stroke.mark / 2 + Stroke.thin;
  const points =
    size.width > 0 ? routePoints(ROUTE_PROFILE, size.width, size.height, inset) : [];
  const path = routePath(points);
  const length = routeLength(points);

  useEffect(() => {
    if (length === 0) return;

    if (reduceMotion) {
      // No stroke-draw and no loop: the line is simply present, at full opacity, immediately.
      drawn.value = 0;
      glow.value = 1;
      settle();
      return;
    }

    drawn.value = withTiming(
      0,
      { duration: Motion.duration.reveal, easing: EASE_OUT },
      (finished) => {
        'worklet';
        if (finished) runOnJS(settle)();
      }
    );

    // Phase B → C. Ease into the loop, then yoyo forever. Opacity only — never hue, position or
    // scale, and never on a paper-and-ink screen.
    glow.value = withSequence(
      withTiming(GLOW_FLOOR, { duration: Motion.duration.standard, easing: EASE_OUT }),
      withRepeat(
        withSequence(
          withTiming(1, { duration: Motion.duration.ambient, easing: EASE_OUT }),
          withTiming(GLOW_FLOOR, { duration: Motion.duration.ambient, easing: EASE_IN })
        ),
        -1,
        false
      )
    );
    // `length` is the dependency, not `size`: a re-measure that produces the same path must not
    // restart a draw the runner has already watched.
  }, [drawn, glow, length, reduceMotion, settle]);

  // The draw is driven by its own completion callback above; this only guarantees the gate can
  // never hang, so the CTA always ends up interactive.
  useEffect(() => {
    const ceiling = setTimeout(settle, reduceMotion ? 0 : DRAW_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [reduceMotion, settle]);

  useEffect(
    () => () => {
      cancelAnimation(drawn);
      cancelAnimation(glow);
    },
    [drawn, glow]
  );

  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: drawn.value * length,
    opacity: glow.value,
  }));

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  }

  return (
    <View
      style={styles.hero}
      onLayout={handleLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Illustration: an elevation profile climbing to a summit and easing down."
    >
      {size.width > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
              {DuskGradient.stops.map((stop, index) => (
                <Stop key={stop} offset={DuskGradient.offsets[index]} stopColor={stop} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#dusk)" />
          <AnimatedPath
            d={path}
            fill="none"
            stroke={DuskGradient.routeGlow}
            strokeWidth={Stroke.mark * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            animatedProps={strokeProps}
          />
          <Path
            d={path}
            fill="none"
            stroke={DuskGradient.routeLine}
            strokeWidth={Stroke.mark}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            strokeDashoffset={0}
            opacity={0.35}
          />
        </Svg>
      ) : null}

      {/* Copy sits in the top band, clear of the amber tail. */}
      <View
        style={styles.copySlot}
        accessibilityElementsHidden={false}
        importantForAccessibility="yes"
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    // Tall enough to be a cover rather than a banner, and fixed in absolute tokens so a short
    // viewport shrinks the surrounding spacers instead of the hero.
    minHeight: Spacing.seven * 4,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  copySlot: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
});
