import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseTraceHero } from '@/components/brand/PulseTraceHero';
import { PulseTracePalette } from '@/constants/pulseTrace';
import { FontSize, PressedOpacity, Radius, Spacing, Stroke, Tracking } from '@/constants/theme';
import { beatsAtMarks, scrollProgress } from '@/lib/pulseTrace';

/**
 * DEV-ONLY preview for the pulse trace — a place to see and tune `PulseTraceHero` before the
 * redesigned onboarding screen exists to mount it. Reachable at `/dev/pulse-trace` in a dev build;
 * in a release build it redirects home. Not linked from anywhere; remove it (or keep it as a
 * component gallery) once the onboarding rebuild lands — the worker's judgment there.
 *
 * Two tabs, one per way of driving the hero:
 *
 * - **Self-draw** mounts the hero with no `progress`; it draws once on mount, and "Replay"
 *   remounts it. This is the landing-screen use.
 * - **Scroll** is the onboarding rehearsal: the hero is a sticky header on a scrolling page whose
 *   scroll offset becomes `progress`, with the spikes placed at the section boundaries via
 *   `beatsAtMarks`, so crossing into a section fires a beat.
 *
 * This file deliberately reads no colour from `theme.ts` — see `constants/pulseTrace.ts` for why.
 */

type Mode = 'draw' | 'scroll';

/** The scroll rehearsal's sections, and where (as scroll progress) each hands over to the next. */
const SECTIONS = [
  { title: 'Your goal', body: 'A race, a distance, or simply more consistent running.' },
  { title: 'Where you are', body: 'Days per week, current volume, a recent time if you have one.' },
  { title: 'What to respect', body: 'Injuries and constraints shape volume and intensity — nothing else does.' },
  { title: 'Your plan', body: 'Week by week, Day 1 to Day 7, built from a coach-authored template.' },
] as const;
const SECTION_MARKS = [0.24, 0.5, 0.76, 0.98];
// Built once: a fresh `beats` array on every render would rebuild the trace's geometry each time.
const SECTION_BEATS = beatsAtMarks(SECTION_MARKS);

export default function PulseTracePreview() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Preview />;
}

function Preview() {
  const [mode, setMode] = useState<Mode>('draw');
  const [replay, setReplay] = useState(0);
  const [settled, setSettled] = useState(false);

  const handleReplay = useCallback(() => {
    setSettled(false);
    setReplay((n) => n + 1);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.toolbar}>
        <Segment label="Self-draw" active={mode === 'draw'} onPress={() => setMode('draw')} />
        <Segment label="Scroll" active={mode === 'scroll'} onPress={() => setMode('scroll')} />
        {mode === 'draw' ? <Segment label="Replay" onPress={handleReplay} /> : null}
      </View>

      {mode === 'draw' ? (
        <View style={styles.stack}>
          <PulseTraceHero key={replay} onSettled={() => setSettled(true)}>
            <Text style={styles.eyebrow}>PACE BLUEPRINT</Text>
            <Text style={styles.heading}>Your training plan, built around you.</Text>
          </PulseTraceHero>
          <Text style={styles.note}>
            cover · onSettled: {settled ? 'fired' : 'waiting'} · key {replay}
          </Text>
          <PulseTraceHero key={`band-${replay}`} size="band" />
          <Text style={styles.note}>band</Text>
        </View>
      ) : (
        <ScrollRehearsal />
      )}
    </SafeAreaView>
  );
}

function ScrollRehearsal() {
  const progress = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    progress.value = scrollProgress(
      event.contentOffset.y,
      event.contentSize.height,
      event.layoutMeasurement.height
    );
  });

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      stickyHeaderIndices={[0]}
      contentContainerStyle={styles.scrollContent}
    >
      <PulseTraceHero progress={progress} beats={SECTION_BEATS} size="band" />
      {SECTIONS.map((section, index) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}
    </Animated.ScrollView>
  );
}

function Segment({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PulseTracePalette.field },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  segment: {
    paddingHorizontal: Spacing.three,
    minHeight: Spacing.five,
    justifyContent: 'center',
    borderRadius: Radius.control,
    borderWidth: Stroke.thin,
    borderColor: PulseTracePalette.onFieldMuted,
  },
  segmentActive: { backgroundColor: PulseTracePalette.onField, borderColor: PulseTracePalette.onField },
  segmentLabel: { color: PulseTracePalette.onField, fontSize: FontSize.xs },
  segmentLabelActive: { color: PulseTracePalette.field },
  pressed: { opacity: PressedOpacity },
  stack: { gap: Spacing.three },
  eyebrow: { color: PulseTracePalette.onFieldMuted, fontSize: FontSize.xs, letterSpacing: Tracking.label },
  heading: {
    color: PulseTracePalette.onField,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    letterSpacing: Tracking.display,
  },
  note: { color: PulseTracePalette.onFieldMuted, fontSize: FontSize.xs, paddingHorizontal: Spacing.three },
  scrollContent: { paddingBottom: Spacing.seven },
  section: {
    // Tall enough that each section is roughly a viewport, so the scroll rehearsal has range.
    minHeight: Spacing.seven * 8,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  sectionIndex: { color: PulseTracePalette.onFieldMuted, fontSize: FontSize.xs, letterSpacing: Tracking.label },
  sectionTitle: { color: PulseTracePalette.onField, fontSize: FontSize.xl, fontWeight: '700' },
  sectionBody: { color: PulseTracePalette.onFieldMuted, fontSize: FontSize.md, lineHeight: FontSize.xl },
});
