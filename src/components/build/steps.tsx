import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { FontFamily, FontSize, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { draw, enter, move } from '@/lib/buildMotion';
import { ENGINE_CANDIDATES, ENGINE_PICK_INDEX, HERO_WEEK, HERO_WEEK_TOTAL_KM } from '@/lib/weekStrip';

import { CountUp } from './CountUp';
import { WeekStrip } from './WeekStrip';

/**
 * V22-02 · Step animations — three ≈ 240 × 120 pt micro-pieces that sit above each onboarding
 * step's copy and play once when the step scrolls into view, each ≤ 1.5 s of motion on its own
 * clock `t` (seconds from the moment the step became visible). Geometry and timings are
 * `v22-02-scene.jsx`'s, verbatim. The fourth piece, "Get started", is the primary action itself
 * drawing in — `RevealPrimaryAction` in `ui/ActionButton.tsx`.
 */

export const STEP_PIECE_WIDTH = 240;
export const STEP_PIECE_HEIGHT = 120;

// --- 01 Intake --------------------------------------------------------------------------------

/**
 * Three short input rows arrive; a segmented control is "pressed" 3 → 4 → 5 and the last press
 * holds; a distance field counts to 10 km; a race-time field counts to 51 min. Pressing
 * buttons — Ian's own idea (spec §V22-02).
 */
export function StepIntake({ t }: { t: SharedValue<number> }) {
  return (
    <View style={[styles.piece, styles.intake]}>
      <IntakeRow t={t} index={0}>
        <SegmentedPress t={t} />
      </IntakeRow>
      <IntakeRow t={t} index={1}>
        <CountField t={t} at={1.0} to={10} unit="KM" />
      </IntakeRow>
      <IntakeRow t={t} index={2}>
        <CountField t={t} at={1.45} to={51} unit="MIN" />
      </IntakeRow>
    </View>
  );
}

function IntakeRow({
  t,
  index,
  children,
}: {
  t: SharedValue<number>;
  index: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const e = enter(t.value, index * 0.08, 0.4);
    return { opacity: e, transform: [{ translateY: (1 - e) * 8 }] };
  });
  return (
    <Animated.View style={[styles.intakeRow, style]}>
      <View style={[styles.intakeLabel, { backgroundColor: theme.hairline }]} />
      {children}
    </Animated.View>
  );
}

const SEGMENTS = ['3', '4', '5'] as const;

function SegmentedPress({ t }: { t: SharedValue<number> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.field,
        styles.segmented,
        { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
      ]}
    >
      {SEGMENTS.map((label, index) => (
        <Segment key={label} t={t} index={index} label={label} last={index === SEGMENTS.length - 1} />
      ))}
    </View>
  );
}

function Segment({
  t,
  index,
  label,
  last,
}: {
  t: SharedValue<number>;
  index: number;
  label: string;
  last: boolean;
}) {
  const theme = useTheme();
  // Each segment is pressed in turn (0.35 s apart); every one but the last releases 0.2 s later.
  const box = useAnimatedStyle(() => {
    const press = draw(t.value, 0.35 + index * 0.2, 0.15);
    const release = draw(t.value, 0.45 + index * 0.2, 0.12);
    return { transform: [{ scale: 1 - press * (1 - release) * 0.04 }] };
  });
  // The pressed tint is ink at 14% — a nested view carries the alpha.
  const tint = useAnimatedStyle(() => {
    const press = draw(t.value, 0.35 + index * 0.2, 0.15);
    const active = last ? press : press * (1 - draw(t.value, 0.55 + index * 0.2, 0.15));
    return { opacity: active * 0.14 };
  });
  const inkText = useAnimatedStyle(() => {
    const press = draw(t.value, 0.35 + index * 0.2, 0.15);
    const active = last ? press : press * (1 - draw(t.value, 0.55 + index * 0.2, 0.15));
    return { opacity: active > 0.5 ? 1 : 0 };
  });
  return (
    <Animated.View style={[styles.segment, box]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.segmentTint, { backgroundColor: theme.text.primary }, tint]}
      />
      <Text style={[styles.segmentText, { color: theme.text.secondary }]}>{label}</Text>
      <Animated.Text
        style={[styles.segmentText, styles.segmentInk, { color: theme.text.primary }, inkText]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

function CountField({
  t,
  at,
  to,
  unit,
}: {
  t: SharedValue<number>;
  at: number;
  to: number;
  unit: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.field,
        styles.countField,
        { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
      ]}
    >
      <CountUp
        T={t}
        landings={[{ at, km: to, duration: 0.4 }]}
        tickScale={1}
        style={[styles.countValue, { color: theme.text.primary }]}
      />
      <Text style={[styles.countUnit, { color: theme.text.secondary }]}>{unit}</Text>
    </View>
  );
}

// --- 02 Engine --------------------------------------------------------------------------------

const TILE = 56;
const TILE_GAP = 16;
const TILE_TOP = 32;
const TILES_LEFT = (STEP_PIECE_WIDTH - (TILE * 3 + TILE_GAP * 2)) / 2;
const CARD_HEIGHT = 96;

/**
 * Three candidate tiles line up; the chosen one grows into a full session card while the other
 * two fade. Reads as "it chooses".
 */
export function StepEngine({ t }: { t: SharedValue<number> }) {
  return (
    <View style={styles.piece}>
      {ENGINE_CANDIDATES.map((candidate, index) =>
        index === ENGINE_PICK_INDEX ? (
          <WinningTile key={candidate.code} t={t} index={index} />
        ) : (
          <LosingTile key={candidate.code} t={t} index={index} />
        )
      )}
    </View>
  );
}

function LosingTile({ t, index }: { t: SharedValue<number>; index: number }) {
  const theme = useTheme();
  const candidate = ENGINE_CANDIDATES[index];
  const style = useAnimatedStyle(() => {
    const arrive = enter(t.value, 0.05 + index * 0.07, 0.4);
    const gone = enter(t.value, 0.6, 0.3);
    return {
      opacity: arrive * (1 - gone),
      transform: [{ translateY: (1 - arrive) * 8 }, { scale: 1 - gone * 0.1 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.tile,
        {
          left: TILES_LEFT + index * (TILE + TILE_GAP),
          top: TILE_TOP,
          backgroundColor: theme.session[candidate.tone],
        },
        style,
      ]}
    >
      <Text style={[styles.tileCode, { color: theme.surface.base }]}>{candidate.code}</Text>
    </Animated.View>
  );
}

function WinningTile({ t, index }: { t: SharedValue<number>; index: number }) {
  const theme = useTheme();
  const candidate = ENGINE_CANDIDATES[index];
  const restLeft = TILES_LEFT + index * (TILE + TILE_GAP);
  const frame = useAnimatedStyle(() => {
    const arrive = enter(t.value, 0.05 + index * 0.07, 0.4);
    const pick = move(t.value, 0.7, 0.45);
    return {
      opacity: arrive,
      left: restLeft * (1 - pick),
      top: TILE_TOP - 20 * pick,
      width: TILE + (STEP_PIECE_WIDTH - TILE) * pick,
      height: TILE + (CARD_HEIGHT - TILE) * pick,
      borderRadius: 10 + 2 * pick,
      transform: [{ translateY: (1 - arrive) * 8 }],
    };
  });
  const code = useAnimatedStyle(() => ({ opacity: 1 - move(t.value, 0.7, 0.45) }));
  const detail = useAnimatedStyle(() => ({ opacity: enter(t.value, 1.0, 0.3) }));
  const onTile = theme.surface.base;
  return (
    <Animated.View style={[styles.tile, { backgroundColor: theme.session[candidate.tone] }, frame]}>
      <Animated.Text style={[styles.tileCode, { color: onTile }, code]}>{candidate.code}</Animated.Text>
      <Animated.View style={[styles.card, detail]}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardLabel, { color: onTile }]}>EASY RUN</Text>
          <Text style={[styles.cardLabel, { color: onTile }]}>DAY 03</Text>
        </View>
        <View style={[styles.cardRow, styles.cardBaseline]}>
          <Text style={[styles.cardNumber, { color: onTile }]}>{candidate.value}</Text>
          <Text style={[styles.cardLabel, { color: onTile }]}>KM</Text>
          <Text style={[styles.cardLabel, styles.cardPace, { color: onTile }]}>5:40 /KM</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// --- 03 Plan ----------------------------------------------------------------------------------

const MINI = { slotWidth: 22, gap: 8, trackHeight: 62, barRadius: 4 } as const;
const MINI_LEFT = (STEP_PIECE_WIDTH - (MINI.slotWidth * 7 + MINI.gap * 6)) / 2;
/** The strip's baseline sits 96pt down the 120pt piece; numerals at 104. */
const MINI_BASELINE_TOP = 96;

/**
 * The plan-detail week as it appears in the app, in miniature: header, baseline, bars with
 * their distances, day numerals — built in 1.0 s.
 */
export function StepMiniPlan({ t }: { t: SharedValue<number> }) {
  const theme = useTheme();
  const header = useAnimatedStyle(() => {
    const e = enter(t.value, 0, 0.4);
    return { opacity: e, transform: [{ translateY: (1 - e) * 6 }] };
  });
  return (
    <View style={styles.piece}>
      <Animated.View style={[styles.miniHeader, header]}>
        <Text style={[styles.miniTitle, { color: theme.text.primary }]}>WEEK 1</Text>
        <Text style={[styles.miniMeta, { color: theme.text.secondary }]}>
          {HERO_WEEK_TOTAL_KM} KM · 3 RUNS
        </Text>
      </Animated.View>
      <View style={{ position: 'absolute', left: MINI_LEFT, top: MINI_BASELINE_TOP - MINI.trackHeight }}>
        <WeekStrip
          T={t}
          week={HERO_WEEK}
          geometry={MINI}
          outlineAt={0.15}
          outlineSeconds={0.3}
          blockAt={0.35}
          blockStagger={0.09}
          labels="value"
          labelDelay={0.2}
          valueSize={FontSize.xxs}
          labelGap={3}
          numerals
          numeralsAt={0.2}
          numeralStagger={0.04}
          numeralSize={8}
          numeralGap={8}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    width: STEP_PIECE_WIDTH,
    height: STEP_PIECE_HEIGHT,
    position: 'relative',
  },
  intake: {
    justifyContent: 'center',
    gap: 10,
  },
  intakeRow: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intakeLabel: {
    width: 62,
    height: 8,
    borderRadius: 4,
  },
  field: {
    flex: 1,
    height: 30,
    borderRadius: 7,
    borderWidth: Stroke.thin,
  },
  segmented: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentTint: {
    borderRadius: 5,
  },
  segmentText: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xxs,
  },
  segmentInk: {
    position: 'absolute',
  },
  countField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  countValue: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: FontSize.md,
  },
  countUnit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
  },
  tile: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileCode: {
    position: 'absolute',
    fontFamily: FontFamily.mono.medium,
    fontSize: FontSize.xxs,
  },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBaseline: {
    justifyContent: 'flex-start',
    alignItems: 'baseline',
    gap: 6,
  },
  cardLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.tiny,
    letterSpacing: 1.5,
  },
  cardPace: {
    marginLeft: 'auto',
  },
  cardNumber: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 34,
    lineHeight: 34,
  },
  miniHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  miniTitle: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 16,
  },
  miniMeta: {
    fontFamily: FontFamily.mono.regular,
    fontSize: 9,
    letterSpacing: 1.5,
  },
});
