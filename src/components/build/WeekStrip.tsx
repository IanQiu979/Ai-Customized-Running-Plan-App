import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { FontFamily, Radius, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NUMERAL_FADE,
  NUMERAL_STAGGER,
  OUTLINE_SECONDS,
  SNAP_SECONDS,
  draw,
  enter,
  snap,
} from '@/lib/buildMotion';
import type { StripBlock, StripWeek } from '@/lib/weekStrip';

/**
 * The animated week strip — the one drawing every V22 build is made of (`v22-01-scene.jsx`'s
 * `Strip`, and the same drawing at other sizes on V22-02, -03 and -05).
 *
 * Seven slots on a baseline. The baseline draws itself left to right over 0.4 s from
 * `outlineAt`; each block then rises from the baseline with the snap curve (350 ms, one 3%
 * overshoot) starting `blockStagger` seconds after the one before, and its number and code
 * fade in above it a little after it lands. Rest days are empty slots — the baseline runs
 * unbroken under them, and they draw nothing (the pages) or a short dash (`restDash`, the
 * plan-detail strips). Day numerals `01 … 07` fade in under the strip 50 ms apart; days are
 * unnamed in this app, never Mon–Sun.
 *
 * Everything is derived from the caller's clock `T` on the UI thread. Passing `outlineAt` and
 * `blockAt` well below zero renders the finished strip immediately — how the faint stacked
 * weeks are drawn.
 *
 * Geometry is the page's, in points: the caller picks slot width, gap and track height per
 * page; this component only ever multiplies them.
 */
export interface StripGeometry {
  slotWidth: number;
  gap: number;
  /** The full height a bar of `h = 1` reaches. */
  trackHeight: number;
  /** Bar top-corner radius. The sheet's 5pt at hero scale; the pages use 4pt on small strips. */
  barRadius?: number;
}

export type StripLabels = 'both' | 'value' | 'none';

export function stripWidth(geometry: StripGeometry): number {
  return geometry.slotWidth * 7 + geometry.gap * 6;
}

export function WeekStrip({
  T,
  week,
  geometry,
  outlineAt,
  outlineSeconds = OUTLINE_SECONDS,
  blockAt,
  blockStagger,
  labels = 'none',
  labelDelay = SNAP_SECONDS * 0.6,
  labelLift = 0,
  valueSize = 18,
  codeSize = 9,
  labelGap = 6,
  scale = 1,
  numerals = false,
  numeralsAt = outlineAt,
  numeralStagger = NUMERAL_STAGGER,
  numeralSize = 11,
  numeralGap = 10,
  restDash = false,
}: {
  T: SharedValue<number>;
  week: StripWeek;
  geometry: StripGeometry;
  /** When the baseline starts drawing, on the caller's clock (seconds). */
  outlineAt: number;
  /** How long the baseline takes to draw. 0.4 s on every page but the step miniature (0.3). */
  outlineSeconds?: number;
  /** When the first block starts to rise. */
  blockAt: number;
  /** Seconds between one slot's block and the next slot's. Counted per SLOT, rest days
   * included, so a week's rhythm is the same whatever pattern its rest days make. */
  blockStagger: number;
  labels?: StripLabels;
  /** Seconds after a block starts rising before its label begins to fade in. */
  labelDelay?: number;
  /** Points the label rises through as it fades in (the hero lifts 4pt; smaller strips none). */
  labelLift?: number;
  valueSize?: number;
  codeSize?: number;
  /** Space between a label's baseline and the top of its bar. */
  labelGap?: number;
  /** Multiplies every bar height — the faint stacked weeks draw at 0.55 / 0.4 / 0.7. */
  scale?: number;
  numerals?: boolean;
  numeralsAt?: number;
  numeralStagger?: number;
  numeralSize?: number;
  numeralGap?: number;
  restDash?: boolean;
}) {
  const theme = useTheme();
  const width = stripWidth(geometry);
  const barRadius = geometry.barRadius ?? Radius.bar;

  const baseline = useAnimatedStyle(() => ({
    width: width * draw(T.value, outlineAt, outlineSeconds),
  }));

  return (
    <View style={{ width }}>
      <View style={[styles.track, { height: geometry.trackHeight }]}>
        {week.map((block, index) => {
          const left = index * (geometry.slotWidth + geometry.gap);
          if (!block) {
            return restDash ? (
              <View
                key={index}
                style={[
                  styles.restDash,
                  { left, width: geometry.slotWidth, backgroundColor: theme.grid.slot },
                ]}
              />
            ) : null;
          }
          return (
            <Bar
              key={index}
              T={T}
              block={block}
              left={left}
              width={geometry.slotWidth}
              trackHeight={geometry.trackHeight}
              startAt={blockAt + blockStagger * index}
              scale={scale}
              radius={barRadius}
              labels={labels}
              labelDelay={labelDelay}
              labelLift={labelLift}
              valueSize={valueSize}
              codeSize={codeSize}
              labelGap={labelGap}
            />
          );
        })}
        {/* The baseline sits last so it paints over the bars' feet, unbroken under rest days. */}
        <Animated.View style={[styles.baseline, { backgroundColor: theme.hairline }, baseline]} />
      </View>
      {numerals ? (
        <View style={[styles.numerals, { marginTop: numeralGap, gap: geometry.gap }]}>
          {week.map((_, index) => (
            <Numeral
              key={index}
              T={T}
              index={index}
              at={numeralsAt}
              stagger={numeralStagger}
              width={geometry.slotWidth}
              size={numeralSize}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Bar({
  T,
  block,
  left,
  width,
  trackHeight,
  startAt,
  scale,
  radius,
  labels,
  labelDelay,
  labelLift,
  valueSize,
  codeSize,
  labelGap,
}: {
  T: SharedValue<number>;
  block: StripBlock;
  left: number;
  width: number;
  trackHeight: number;
  startAt: number;
  scale: number;
  radius: number;
  labels: StripLabels;
  labelDelay: number;
  labelLift: number;
  valueSize: number;
  codeSize: number;
  labelGap: number;
}) {
  const theme = useTheme();
  const full = trackHeight * block.h * scale;

  const bar = useAnimatedStyle(() => ({
    height: full * snap(T.value, startAt),
  }));
  const label = useAnimatedStyle(() => {
    const lab = enter(T.value, startAt + labelDelay, 0.3);
    return {
      opacity: lab,
      transform: [{ translateY: (1 - lab) * labelLift }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          left,
          width,
          backgroundColor: theme.session[block.tone],
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        },
        bar,
      ]}
    >
      {labels !== 'none' ? (
        <Animated.View style={[styles.label, { paddingBottom: labelGap }, label]}>
          <Text
            style={[styles.value, { color: theme.text.primary, fontSize: valueSize }]}
            numberOfLines={1}
          >
            {block.value}
            {labels === 'both' && block.code ? (
              <Text style={[styles.code, { color: theme.text.secondary, fontSize: codeSize }]}>
                {' '}
                {block.code}
              </Text>
            ) : null}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Numeral({
  T,
  index,
  at,
  stagger,
  width,
  size,
}: {
  T: SharedValue<number>;
  index: number;
  at: number;
  stagger: number;
  width: number;
  size: number;
}) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: enter(T.value, at + stagger * index, NUMERAL_FADE),
  }));
  return (
    <Animated.Text
      style={[styles.numeral, { width, color: theme.text.secondary, fontSize: size }, style]}
    >
      {String(index + 1).padStart(2, '0')}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
  },
  baseline: {
    position: 'absolute',
    left: 0,
    bottom: -Stroke.thin,
    height: Stroke.thin,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
  },
  restDash: {
    position: 'absolute',
    bottom: 0,
    height: 2,
  },
  label: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: '100%',
    alignItems: 'center',
  },
  value: {
    fontFamily: FontFamily.display.semiBold,
    lineHeight: undefined,
  },
  code: {
    fontFamily: FontFamily.mono.regular,
    letterSpacing: 0.5,
  },
  numerals: {
    flexDirection: 'row',
  },
  numeral: {
    fontFamily: FontFamily.mono.regular,
    textAlign: 'center',
    letterSpacing: Tracking.label,
  },
});
