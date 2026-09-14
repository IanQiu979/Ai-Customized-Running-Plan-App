import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';

import { OnboardingHero } from '@/components/build/OnboardingHero';
import { RunnerFigure } from '@/components/build/RunnerFigure';
import { StepEngine, StepIntake, StepMiniPlan } from '@/components/build/steps';
import { useBuildClock } from '@/components/build/useBuildClock';
import { LinkAction, RevealPrimaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HERO_TIMELINE, STEP_SECONDS } from '@/lib/buildMotion';

/**
 * The signed-out landing screen — "the plan builds itself" (V22-01 + V22-02, approved
 * 2026-09-13). A full-viewport hero in which a week strip draws itself, its blocks snap in and
 * the total counts up, then a scroll-down walk through what the app does — three steps, each
 * with a small build animation above its copy — and, at the bottom, the primary action drawing
 * itself in under the runner figure.
 *
 * **The mechanic is the scroll, not a carousel.** The steps stack vertically under the hero,
 * each a screenful-ish beat. The runner reads by scrolling — there is nothing to swipe, no
 * "next" button, and no state to restore if they leave halfway. That is deliberate: this screen
 * is the anchor for EVERY signed-out session, not just a first install (`(auth)/index.tsx`
 * redirects here), so a returning user must be able to reach the actions without being walked
 * through a tour. The sign-in link is a peer of the CTA at the bottom rather than fine print
 * under it, for exactly that reason — it is the skip. Tapping the settled hero (its "Continue"
 * cue) scrolls to the first step; it never navigates.
 *
 * Each step's piece plays once, when the step scrolls into view (spec §V22-02), on its own
 * build clock; the hero's clock is owned here so the screen can gate its primary action on the
 * hero settling. Every timing and coordinate lives in the build components and
 * `lib/buildMotion.ts`, ported from the pages.
 *
 * Copy is grounded in what the product does and nothing more — ten intake questions
 * (`planning/02-product-requirements.md`), unnamed Day 1–7 slots (`CLAUDE.md`'s coaching-domain
 * rules). It makes no coaching claim: the "McMillan-certified coach" line was reviewed and
 * deliberately dropped by captain's ruling on 2026-08-08 and has not come back.
 */

/** The three steps of the scroll. Index, label, copy and piece travel together so a reorder
 * cannot skew the numbering — the mono index is derived from the array position, never
 * hand-written. Steps 01 and 03 keep the captain-audited copy (#109); step 02 is the approved
 * page's. The page has exactly three steps and then Get started, so the old pricing beat is gone. */
const STEPS = [
  {
    heading: 'Tell us about your running.',
    body: 'Share your goal, age, running experience, weekly training, race target, recent performance, and injuries.',
    Piece: StepIntake,
  },
  {
    heading: 'The engine picks each session',
    body: 'Every block is chosen against your load, recovery and goal.',
    Piece: StepEngine,
  },
  {
    heading: 'See every week.',
    body: 'Your plan shows each week’s runs and rest days; you choose the calendar days.',
    Piece: StepMiniPlan,
  },
] as const;

/**
 * The ceiling on waiting for the hero to settle. The hero's authored timeline is 5.2 s including
 * its hold, but the build itself is done at 3.0 s and `useBuildClock` reports `settled` at the
 * end of the hold with its own slack; 4 s sits past a healthy build and only ever fires when
 * something has actually gone wrong.
 */
const HERO_SETTLE_CEILING_MS = 4000;

/** A step counts as on screen once its top is this far inside the bottom of the viewport. */
const STEP_VISIBLE_MARGIN = 120;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * The captain's constraint, carried over from the previous hero: the hero must already be
   * settled, not mid-build, by the time the CTA is interactive. The build clock raises that from
   * its own completion — and the CTA is below the fold anyway, so on a real device the build has
   * finished long before the button is on screen.
   *
   * The constraint stands; the ceiling below is only so it cannot hang forever. This screen owns
   * that ceiling itself rather than trusting the clock to have one, because "Create your first
   * plan" is the ONLY forward action out of the signed-out landing screen: a completion that never
   * arrives — an interrupted animation, an unmount mid-build, a reduced-motion branch that misses —
   * is a silent, total dead end, and that failure must not depend on another component's internals.
   */
  const hero = useBuildClock({ total: HERO_TIMELINE.total });
  const [heroSettled, setHeroSettled] = useState(false);
  useEffect(() => {
    if (hero.settled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- latching a clock's completion
      setHeroSettled(true);
    }
  }, [hero.settled]);
  useEffect(() => {
    if (heroSettled) return;
    const ceiling = setTimeout(() => setHeroSettled(true), HERO_SETTLE_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [heroSettled]);

  // Which sections have scrolled into view, by index (0..2 the steps, 3 the Get started beat).
  // Once visible always visible: a piece plays once and holds, never rewinds.
  const [scrollY, setScrollY] = useState(0);
  const [sectionTops, setSectionTops] = useState<Record<number, number>>({});
  const [seen, setSeen] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const threshold = scrollY + viewportHeight - STEP_VISIBLE_MARGIN;
    const next: Record<number, boolean> = {};
    let changed = false;
    for (const [key, top] of Object.entries(sectionTops)) {
      const index = Number(key);
      if (!seen[index] && top <= threshold) {
        next[index] = true;
        changed = true;
      }
    }
    if (changed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from scroll + layout
      setSeen((current) => ({ ...current, ...next }));
    }
  }, [scrollY, sectionTops, viewportHeight, seen]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  }, []);
  // The step sections are laid out inside a wrapper below the hero, so their `y` is offset by
  // the hero's height (one viewport) to land in scroll-content coordinates.
  const sectionLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const top = event.nativeEvent.layout.y + viewportHeight;
      setSectionTops((current) => (current[index] === top ? current : { ...current, [index]: top }));
    },
    [viewportHeight]
  );

  const scrollToSteps = useCallback(() => {
    scrollRef.current?.scrollTo({ y: viewportHeight, animated: true });
  }, [viewportHeight]);

  const stepMinHeight = Math.max(Spacing.seven * 3, viewportHeight * 0.42);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      {/* The hero owns the top inset inside its 852-pt canvas; the scroll below takes the side
          and bottom insets. */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <OnboardingHero
            T={hero.T}
            width={viewportWidth}
            height={viewportHeight}
            onContinue={scrollToSteps}
          />

          <View style={styles.sections}>
            {STEPS.map((step, index) => (
              <View
                key={step.heading}
                onLayout={sectionLayout(index)}
                style={[
                  styles.section,
                  { borderTopColor: theme.hairline },
                  // Each beat is sized against the viewport rather than its own copy so the scroll
                  // has real rhythm on a tall phone and still collapses to its content on a short
                  // one. `minHeight`, never `height` — copy at large Dynamic Type sizes must be
                  // allowed to make a section taller, never be clipped by it.
                  { minHeight: stepMinHeight },
                ]}
              >
                <Step index={index} heading={step.heading} body={step.body} Piece={step.Piece} visible={Boolean(seen[index])} />
              </View>
            ))}

            <View
              onLayout={sectionLayout(STEPS.length)}
              style={[styles.section, styles.actions, { borderTopColor: theme.hairline, minHeight: stepMinHeight }]}
            >
              <GetStarted
                visible={Boolean(seen[STEPS.length])}
                disabled={!heroSettled}
                onPress={() => router.push('/(auth)/sign-up')}
              />
              <LinkAction onPress={() => router.push('/(auth)/sign-in')}>
                Already have an account?{' '}
                <Text style={{ color: theme.text.primary }}>Sign in</Text>
              </LinkAction>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One numbered step: its piece, then its copy. The piece gets its own clock, started the first
 * time the step is on screen. */
function Step({
  index,
  heading,
  body,
  Piece,
  visible,
}: {
  index: number;
  heading: string;
  body: string;
  Piece: (props: { t: SharedValue<number> }) => React.JSX.Element;
  visible: boolean;
}) {
  const theme = useTheme();
  const clock = useBuildClock({ total: STEP_SECONDS, play: visible });
  return (
    <View style={styles.step}>
      <Piece t={clock.T} />
      <View style={styles.copy}>
        <Text style={[styles.indexLabel, { color: theme.text.secondary }]}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>{heading}</Text>
        <Text style={[styles.sectionBody, { color: theme.text.secondary }]}>{body}</Text>
      </View>
    </View>
  );
}

/** The last beat: the runner figure, then the primary action drawing itself in. */
function GetStarted({
  visible,
  disabled,
  onPress,
}: {
  visible: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const clock = useBuildClock({ total: STEP_SECONDS, play: visible });
  return (
    <View style={styles.getStarted}>
      <RunnerFigure />
      <RevealPrimaryAction
        T={clock.T}
        label="Create your first plan"
        disabled={disabled}
        accessibilityHint={disabled ? 'Available once the illustration finishes animating.' : undefined}
        onPress={onPress}
      />
    </View>
  );
}

/** The page's step geometry (`v22-02-scene.jsx`): piece, 36pt, then a 300pt copy column. */
const STEP_GAP = 36;
const COPY_WIDTH = 300;
const RUNNER_SIZE = 105;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  sections: {
    paddingTop: Spacing.four,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    justifyContent: 'center',
  },
  step: {
    alignItems: 'center',
    gap: STEP_GAP,
  },
  copy: {
    width: COPY_WIDTH,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 10,
  },
  indexLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xxs,
    letterSpacing: 2,
  },
  sectionHeading: {
    fontFamily: FontFamily.display.semiBold,
    fontSize: 30,
    lineHeight: 30 * 1.05,
    textAlign: 'center',
  },
  sectionBody: {
    fontFamily: FontFamily.body.regular,
    fontSize: 14,
    lineHeight: 14 * 1.5,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
  getStarted: {
    alignItems: 'center',
    gap: Spacing.five,
    minHeight: RUNNER_SIZE,
  },
});
