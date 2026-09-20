import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DesignWidth, FontFamily, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CUE_DELAY,
  HERO_BLOCK_STAGGER,
  HERO_TIMELINE,
  enter,
  snapLandsAt,
} from '@/lib/buildMotion';
import { HERO_WEEK, type StripWeek } from '@/lib/weekStrip';

import { CountUp, type Landing } from './CountUp';
import { DesignCanvas } from './DesignCanvas';
import { FadeIn } from './FadeIn';
import { WeekStrip, stripWidth } from './WeekStrip';

/**
 * V22-01 · Main onboarding animation — "the plan builds itself". Replaces the pulse trace as
 * the first thing anyone sees.
 *
 * On a 393 × 852 canvas: the wordmark; a single Number that counts the week's kilometres; a
 * seven-slot week strip whose baseline draws left to right and whose blocks snap in one every
 * 220 ms (Easy 8 · Rest · Rest · Tempo 7 · Rest · Long 10 · Rest — the page's own week); the
 * Number ticks with each landing; then the strip duplicates downward into three faint weeks
 * (0.28 / 0.18 / 0.10) that say the plan is bigger than one week; a legend; and, 0.8 s into the
 * hold, a "Scroll down" hint. 3.0 s of build, 2.2 s of hold, plays once. Every coordinate, size
 * and time below is `v22-01-scene.jsx`'s.
 *
 * The caller owns the clock (`useBuildClock(HERO_TIMELINE.total)`) so it can gate the screen's
 * primary action on the hero settling, as the previous hero was gated. The hint is informational
 * only — the mechanic is the scroll itself (captain's ruling, 2026-09-20), not a tap target, so
 * this component renders a plain `View`, not a `Pressable`.
 */

const { cues } = HERO_TIMELINE;

/** Page geometry, in points on the 393 × 852 canvas. */
const G = {
  wordmarkTop: 88,
  wordmarkSize: 21,
  totalTop: 240,
  unitGap: 8,
  strip: { slotWidth: 36, gap: 10, trackHeight: 88 },
  stripTop: 396,
  numeralGap: 10,
  faintTop: 36, // below the main strip's top
  faintRow: 60,
  faintScale: 0.55,
  legendTop: 736,
  legendGap: 18,
  legendDot: 7,
  cueTop: 776,
} as const;

const FAINT = [0.28, 0.18, 0.1] as const;

export function OnboardingHero({
  T,
  width,
  height,
  week = HERO_WEEK,
  appName = 'Pace Blueprint',
}: {
  T: SharedValue<number>;
  /** The box the composition is fitted into — normally the full viewport. */
  width: number;
  height: number;
  week?: StripWeek;
  appName?: string;
}) {
  const theme = useTheme();
  const stripLeft = (DesignWidth - stripWidth(G.strip)) / 2;

  const landings: Landing[] = [];
  week.forEach((block, index) => {
    if (block) {
      landings.push({ at: snapLandsAt(cues.Blocks + HERO_BLOCK_STAGGER * index), km: block.value });
    }
  });

  const wordmark = useAnimatedStyle(() => ({ opacity: enter(T.value, 0, 0.5) }));
  const total = useAnimatedStyle(() => ({ opacity: enter(T.value, cues.Outline + 0.2, 0.4) }));

  return (
    <View style={{ backgroundColor: theme.surface.base }}>
      <DesignCanvas width={width} height={height}>
        <Animated.Text
          style={[
            styles.wordmark,
            { top: G.wordmarkTop, fontSize: G.wordmarkSize, color: theme.text.primary },
            wordmark,
          ]}
        >
          {appName}
        </Animated.Text>

        <Animated.View style={[styles.total, { top: G.totalTop }, total]}>
          <CountUp
            T={T}
            landings={landings}
            style={[styles.totalNumber, { color: theme.text.primary }]}
          />
          <Text style={[styles.totalUnit, { color: theme.text.secondary, marginTop: G.unitGap }]}>
            KM / WEEK
          </Text>
        </Animated.View>

        {FAINT.map((opacity, k) => (
          <FaintWeek
            key={k}
            T={T}
            week={week}
            index={k}
            opacity={opacity}
            left={stripLeft}
            top={G.stripTop + G.faintTop}
          />
        ))}

        <View style={{ position: 'absolute', left: stripLeft, top: G.stripTop }}>
          <WeekStrip
            T={T}
            week={week}
            geometry={G.strip}
            outlineAt={cues.Outline}
            blockAt={cues.Blocks}
            blockStagger={HERO_BLOCK_STAGGER}
            labels="both"
            labelLift={4}
            valueSize={18}
            codeSize={9}
            labelGap={6}
            numerals
            numeralSize={FontSize.xxs}
            numeralGap={G.numeralGap}
          />
        </View>

        <FadeIn T={T} at={cues.Hold} duration={0.5} style={[styles.legend, { top: G.legendTop }]}>
          <LegendItem color={theme.session.easy} label="Easy" />
          <LegendItem color={theme.session.hard} label="Hard" />
        </FadeIn>

        <FadeIn
          T={T}
          at={cues.Hold + CUE_DELAY}
          duration={1.1}
          lift={6}
          style={[styles.cue, { top: G.cueTop }]}
        >
          <Text style={[styles.cueText, { color: theme.text.primary }]}>Scroll down</Text>
        </FadeIn>
      </DesignCanvas>
    </View>
  );
}

/** One of the three faint copies of the week, sliding down into place under the real one. */
function FaintWeek({
  T,
  week,
  index,
  opacity,
  left,
  top,
}: {
  T: SharedValue<number>;
  week: StripWeek;
  index: number;
  opacity: number;
  left: number;
  top: number;
}) {
  const style = useAnimatedStyle(() => {
    const e = enter(T.value, cues.Weeks + 0.08 * index, 0.6);
    return {
      opacity: opacity * e,
      transform: [{ translateY: G.faintRow * (index + 1) * e }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left, top }, style]}>
      <WeekStrip
        T={T}
        week={week}
        geometry={G.strip}
        outlineAt={-10}
        blockAt={-10}
        blockStagger={0}
        scale={G.faintScale}
      />
    </Animated.View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: FontFamily.display.semiBold,
    letterSpacing: 0.5,
  },
  total: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  totalNumber: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.giant,
    lineHeight: FontSize.giant,
    letterSpacing: -1,
    textAlign: 'center',
  },
  totalUnit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: 3,
  },
  legend: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: G.legendGap,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: G.legendDot,
    height: G.legendDot,
    borderRadius: G.legendDot / 2,
  },
  legendLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xxs,
  },
  cue: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cueText: {
    fontFamily: FontFamily.body.medium,
    fontSize: 14,
    letterSpacing: 0.3,
    opacity: 0.55,
  },
});
