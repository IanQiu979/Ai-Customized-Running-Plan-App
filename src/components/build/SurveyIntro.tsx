import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { DesignWidth, FontFamily, FontSize, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CUE_DELAY, SURVEY_BLOCK_STAGGER, SURVEY_TIMELINE, enter } from '@/lib/buildMotion';
import { HERO_WEEK, SURVEY_WEEKS, type StripWeek } from '@/lib/weekStrip';

import { DesignCanvas } from './DesignCanvas';
import { FadeIn } from './FadeIn';
import { WeekStrip, stripWidth } from './WeekStrip';

/**
 * V22-03 · Survey / intake intro. Heading up top, then a small build (a 3-row-and-more version
 * of V22-01: week 1 builds in 1.4 s, weeks 2–6 stack beneath it fading toward the bottom), and
 * when it holds, PRESS TO CONTINUE fades in. A tap goes to the intake questions; the questions
 * themselves do not animate. Geometry and timings are `v22-03-scene.jsx`'s.
 */

const { cues } = SURVEY_TIMELINE;

const G = {
  wordmarkTop: 88,
  wordmarkSize: 21,
  headingTop: 160,
  headingInset: 32,
  strip: { slotWidth: 26, gap: 8, trackHeight: 64, barRadius: 4 },
  stripTop: 300,
  /** The page nudges the strip 22pt right of centre to make room for the W1 … W6 labels. */
  stripNudge: 22,
  faintTop: 22,
  faintRow: 70,
  faintScale: 0.7,
  fadeTop: 620,
  fadeHeight: 140,
  cueTop: 776,
} as const;

const FAINT = [0.85, 0.7, 0.55, 0.42, 0.3] as const;

/** The W1 … W6 labels' line box, and where its top sits so the label's bottom lands 4pt under
 * the baseline (the page's `bottom: -4`) — measured from the track, not from the strip's box,
 * because week 1's box also holds the numerals row and the label must not drop with it. */
const WEEK_LABEL_LINE = 10;
const WEEK_LABEL_TOP = G.strip.trackHeight + 4 - WEEK_LABEL_LINE;

export function SurveyIntro({
  T,
  width,
  height,
  onContinue,
  settled,
  heading = 'A few questions first',
  supporting = 'Two minutes. Your plan is built from the answers.',
  appName = 'Pace Blueprint',
}: {
  T: SharedValue<number>;
  width: number;
  height: number;
  onContinue: () => void;
  /** The build has reached its end frame — the cue is showing and a tap may continue. */
  settled: boolean;
  heading?: string;
  supporting?: string;
  appName?: string;
}) {
  const theme = useTheme();
  const stripLeft = (DesignWidth - stripWidth(G.strip)) / 2 + G.stripNudge;

  const weekLabel = useAnimatedStyle(() => ({
    opacity: enter(T.value, cues.Outline, 0.4),
  }));

  return (
    <Pressable
      onPress={settled ? onContinue : undefined}
      accessibilityRole="button"
      accessibilityLabel="Press to continue"
      accessibilityState={{ disabled: !settled }}
      style={{ backgroundColor: theme.surface.base }}
    >
      <DesignCanvas width={width} height={height}>
        <Text
          style={[
            styles.wordmark,
            { top: G.wordmarkTop, fontSize: G.wordmarkSize, color: theme.text.primary },
          ]}
        >
          {appName}
        </Text>
        <View style={[styles.heading, { top: G.headingTop, left: G.headingInset, right: G.headingInset }]}>
          <Text style={[styles.headingText, { color: theme.text.primary }]}>{heading}</Text>
          <Text style={[styles.supporting, { color: theme.text.secondary }]}>{supporting}</Text>
        </View>

        {SURVEY_WEEKS.map((week, k) => (
          <FaintWeek key={k} T={T} week={week} index={k} left={stripLeft} top={G.stripTop + G.faintTop} />
        ))}

        <View style={{ position: 'absolute', left: stripLeft, top: G.stripTop }}>
          <Animated.Text
            style={[styles.weekLabel, { color: theme.text.secondary, top: WEEK_LABEL_TOP }, weekLabel]}
          >
            W1
          </Animated.Text>
          <WeekStrip
            T={T}
            week={HERO_WEEK}
            geometry={G.strip}
            outlineAt={cues.Outline}
            blockAt={cues.Blocks}
            blockStagger={SURVEY_BLOCK_STAGGER}
            labels="value"
            labelDelay={0.21}
            valueSize={14}
            labelGap={4}
            numerals
            numeralSize={9}
            numeralGap={8}
          />
        </View>

        {/* The lower weeks fade into the field before the cue. */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: G.fadeTop, height: G.fadeHeight }} pointerEvents="none">
          <Svg width={DesignWidth} height={G.fadeHeight}>
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.surface.base} stopOpacity={0} />
                <Stop offset="1" stopColor={theme.surface.base} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={DesignWidth} height={G.fadeHeight} fill="url(#fade)" />
          </Svg>
        </View>

        <FadeIn T={T} at={cues.Hold + CUE_DELAY} duration={0.9} lift={6} style={[styles.cue, { top: G.cueTop }]}>
          <Text style={[styles.cueText, { color: theme.text.primary }]}>PRESS TO CONTINUE</Text>
        </FadeIn>
      </DesignCanvas>
    </Pressable>
  );
}

function FaintWeek({
  T,
  week,
  index,
  left,
  top,
}: {
  T: SharedValue<number>;
  week: StripWeek;
  index: number;
  left: number;
  top: number;
}) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const e = enter(T.value, cues.Weeks + 0.08 * index, 0.6);
    return {
      opacity: FAINT[index] * e,
      transform: [{ translateY: G.faintRow * (index + 1) * e }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left, top }, style]}>
      <Text style={[styles.weekLabel, { color: theme.text.secondary, top: WEEK_LABEL_TOP }]}>W{index + 2}</Text>
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

const styles = StyleSheet.create({
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: FontFamily.display.semiBold,
    letterSpacing: 0.5,
  },
  heading: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
  },
  headingText: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 34,
    lineHeight: 34 * 1.05,
    textAlign: 'center',
  },
  supporting: {
    fontFamily: FontFamily.body.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  weekLabel: {
    position: 'absolute',
    right: '100%',
    paddingRight: 10,
    fontFamily: FontFamily.mono.regular,
    fontSize: 8,
    lineHeight: WEEK_LABEL_LINE,
    letterSpacing: 1.5,
  },
  cue: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cueText: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xxs + 1,
    letterSpacing: Tracking.wide,
    opacity: 0.55,
  },
});
