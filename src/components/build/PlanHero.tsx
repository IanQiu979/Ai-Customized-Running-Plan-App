import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { BuildIllustration, FontFamily, FontSize, fitBuildIllustration } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLAN_HERO_BLOCK_STAGGER, PLAN_HERO_TIMELINE, enter } from '@/lib/buildMotion';
import type { StripWeek } from '@/lib/weekStrip';

import { CountUp, type Landing } from './CountUp';
import { WeekStrip, stripWidth } from './WeekStrip';

/**
 * V22-05 · My Plans hero — a larger V22-01 (≈ 200 pt of strip) showing the runner's REAL most
 * recent plan: the actual first week's blocks snap in with their real distances, and the total
 * counts to the real number. Plays once on screen open (2.0 s of build); if no plan exists yet
 * it plays the example plan — there is no empty state. Geometry and timings are
 * `v22-05-scene.jsx`'s. The screen owns the clock so it can fade its call-to-action and list in
 * on the hold.
 */

const { cues } = PLAN_HERO_TIMELINE;

const G = {
  strip: BuildIllustration.strip,
  /** From the header block's bottom to the strip's top. */
  stripGap: 22,
  numeralGap: 8,
  faintTop: 30,
  faintRow: 44,
  faintScale: 0.4,
  faintOpacity: 0.24,
  /** The strip block's total height: bars, numerals, and the faint week beneath. */
  stripBlockHeight: 170,
} as const;

export function PlanHero({
  T,
  week,
  eyebrow,
  title,
  weekCount,
  availableWidth,
  maxScale,
}: {
  T: SharedValue<number>;
  week: StripWeek;
  /** "MOST RECENT" or "EXAMPLE". */
  eyebrow: string;
  title: string;
  weekCount: number;
  /** The screen's content width. The canonical drawing scales down only when this is narrower. */
  availableWidth?: number;
  /** `buildCanvasScale` for the viewport, so the strip matches the full-screen builds' size. */
  maxScale?: number;
}) {
  const theme = useTheme();

  const landings: Landing[] = [];
  week.forEach((block, index) => {
    if (block && block.unit === 'km') {
      landings.push({
        at: cues.Blocks + PLAN_HERO_BLOCK_STAGGER * index + 0.25,
        km: block.value,
      });
    }
  });

  const header = useAnimatedStyle(() => {
    const e = enter(T.value, 0, 0.4);
    return { opacity: e, transform: [{ translateY: (1 - e) * 6 }] };
  });
  const faint = useAnimatedStyle(() => {
    const e = enter(T.value, cues.Weeks, 0.6);
    return {
      opacity: G.faintOpacity * e,
      transform: [{ translateY: G.faintTop + G.faintRow * e }],
    };
  });

  const width = stripWidth(G.strip);
  const fit = fitBuildIllustration(width, availableWidth ?? width, maxScale);

  return (
    <View>
      <Animated.View style={header}>
        <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.totalRow}>
          <CountUp
            T={T}
            landings={landings}
            style={[styles.total, { color: theme.text.primary }]}
          />
          <Text style={[styles.totalUnit, { color: theme.text.secondary }]}>
            KM · WEEK 1 OF {weekCount}
          </Text>
        </View>
      </Animated.View>

      <View
        style={[
          styles.stripFit,
          {
            width: fit.width,
            height: G.stripBlockHeight * fit.scale,
            marginTop: G.stripGap,
          },
        ]}
      >
        <View
          style={[
            styles.stripBlock,
            {
              width,
              height: G.stripBlockHeight,
              transform: [{ scale: fit.scale }],
              transformOrigin: 'top left',
            },
          ]}
        >
          <Animated.View style={[styles.faint, { width }, faint]}>
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
          <View style={{ width }}>
            <WeekStrip
              T={T}
              week={week}
              geometry={G.strip}
              outlineAt={cues.Outline}
              blockAt={cues.Blocks}
              blockStagger={PLAN_HERO_BLOCK_STAGGER}
              labels="both"
              labelDelay={0.21}
              valueSize={FontSize.title}
              codeSize={FontSize.micro}
              labelGap={5}
              numerals
              numeralSize={FontSize.label}
              numeralGap={G.numeralGap}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.label,
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.display,
    lineHeight: FontSize.display * 1.05,
    marginTop: 6,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
  },
  total: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.display,
    lineHeight: FontSize.display,
  },
  totalUnit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.label,
    letterSpacing: 1.5,
  },
  stripBlock: {
    alignItems: 'center',
  },
  stripFit: {
    alignSelf: 'center',
  },
  faint: {
    position: 'absolute',
    top: 0,
  },
});
