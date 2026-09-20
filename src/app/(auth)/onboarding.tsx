import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useReducedMotion, type SharedValue } from 'react-native-reanimated';

import { OnboardingHero } from '@/components/build/OnboardingHero';
import { StepEngine, StepIntake, StepMiniPlan } from '@/components/build/steps';
import { SETTLE_SLACK_MS, useBuildClock } from '@/components/build/useBuildClock';
import { LinkAction, RevealPrimaryAction } from '@/components/ui/ActionButton';
import { FontFamily, FontSize, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFirstOnboardingVisit } from '@/hooks/use-first-onboarding-visit';
import { useTheme } from '@/hooks/use-theme';
import { HERO_TIMELINE, STEP_SECONDS } from '@/lib/buildMotion';
import { isContentFullyOnScreen, lockScrollOffset, type ContentBox } from '@/lib/onboardingReveal';

/**
 * The signed-out landing screen — "the plan builds itself" (V22-01 + V22-02, approved
 * 2026-09-13). A full-viewport hero in which a week strip draws itself, its blocks snap in and
 * the total counts up, then a scroll-down walk through what the app does — three steps, each
 * with a small build animation above its copy — and, at the bottom, the primary action drawing
 * itself in.
 *
 * **The mechanic is the scroll, not a carousel.** The steps stack vertically under the hero,
 * each a full-viewport beat, so one animation ever fills the screen at a time. There is nothing
 * to swipe, no "next" button, and no state to restore if they leave halfway. That is deliberate:
 * this screen is the anchor for EVERY signed-out session, not just a first install
 * (`(auth)/index.tsx` redirects here), so a returning user must be able to reach the actions
 * without being walked through a tour. The sign-in link is a peer of the CTA at the bottom rather
 * than fine print under it, for exactly that reason — it is the skip.
 *
 * **First launch is locked to one animation at a time (captain's ruling, 2026-09-20).** The very
 * first time onboarding renders on a device (`useFirstOnboardingVisit`), the `ScrollView` snaps
 * section to section — `snapToOffsets` at every section's top with `disableIntervalMomentum`, so a
 * fling can only ever land on the next section, never carry past it — and is disabled while the
 * section currently in view is still animating, so scrolling past a build in progress is
 * impossible; each section's own build clock unlatches the lock once it settles, and the hero's
 * "Scroll down" hint is what tells the runner to move on. When the lock engages on a section the
 * scroll is settled onto it (`lockScrollOffset`), so the one animation playing fills the screen.
 * Every visit after the first — the flag persists via `lib/onboardingVisit.ts` — scrolls freely
 * with no snapping, exactly as before, and so does a first visit under reduced motion
 * (`useReducedMotion`): there is nothing to wait out when every clock starts already settled. This
 * closes `docs/mvp-progress.md`'s long-standing "replays on every signed-out session" note.
 *
 * Each step's piece plays once, when the step's CONTENT — piece and copy, centred in a
 * full-viewport section — is fully on screen (spec §V22-02; the latch is
 * `lib/onboardingReveal.ts`'s, on the content's own bounding box rather than the section's top
 * edge, so a piece never starts below the fold), on its own build clock; the hero's clock is
 * owned here so the screen can gate its primary action, and the scroll lock, on each section
 * settling. Every timing and coordinate lives in the build components and `lib/buildMotion.ts`,
 * ported from the pages.
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

/** The hero's build is done when its hold begins (3.0 s); the hold is the end frame standing. */
const HERO_BUILD_END = HERO_TIMELINE.cues.Hold;

/**
 * The fallback ceiling on waiting for the hero's build to end. On a healthy run the clock
 * reports `ready` at `HERO_BUILD_END` and this never fires: it sits past the hero's whole
 * authored timeline (build and hold, 5.2 s) plus the clock's own slack, so reaching it means the
 * clock never completed at all, and the runner gets the button back rather than a dead end.
 */
const HERO_READY_CEILING_MS = HERO_TIMELINE.total * 1000 + 2 * SETTLE_SLACK_MS;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * The captain's constraint, carried over from the previous hero: the hero must already have
   * finished building, not be mid-build, by the time the CTA is interactive. The build clock
   * raises that from the clock reaching the hold (`HERO_BUILD_END`) — the hold itself is the end
   * frame standing, not more build — and the CTA is below the fold anyway, so on a real device
   * the build has finished long before the button is on screen.
   *
   * The constraint stands; the ceiling below is only so it cannot hang forever. This screen owns
   * that ceiling itself rather than trusting the clock to have one, because "Create your first
   * plan" is the ONLY forward action out of the signed-out landing screen: a completion that never
   * arrives — an interrupted animation, an unmount mid-build, a reduced-motion branch that misses —
   * is a silent, total dead end, and that failure must not depend on another component's internals.
   */
  const hero = useBuildClock({ total: HERO_TIMELINE.total, readyAt: HERO_BUILD_END });
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    if (hero.ready) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- latching a clock's completion
      setHeroReady(true);
    }
  }, [hero.ready]);
  useEffect(() => {
    if (heroReady) return;
    const ceiling = setTimeout(() => setHeroReady(true), HERO_READY_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [heroReady]);

  // Which sections' content has scrolled fully into view, by index (0..2 the steps, 3 the Get
  // started beat). Once visible always visible: a piece plays once and holds, never rewinds. The
  // scroll offset, the section tops and the content boxes live in refs and the latch is computed
  // in the handlers, so a scroll frame re-renders the tree only when it first reveals a section —
  // never at 60 Hz.
  const scrollY = useRef(0);
  const sectionTops = useRef<Record<number, number>>({});
  // Each section's content box relative to its section: the piece plus copy, centred in the
  // full-viewport section, which is what the latch measures rather than the section itself.
  const contentLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const seenRef = useRef<Record<number, boolean>>({});
  const [seen, setSeen] = useState<Record<number, boolean>>({});
  const contentBox = useCallback((index: number): ContentBox | null => {
    const top = sectionTops.current[index];
    const layout = contentLayouts.current[index];
    if (top === undefined || layout === undefined) return null;
    return { contentTop: top + layout.y, contentHeight: layout.height };
  }, []);
  const reveal = useCallback(() => {
    let changed = false;
    for (let index = 0; index <= STEPS.length; index += 1) {
      if (seenRef.current[index]) continue;
      const box = contentBox(index);
      if (box && isContentFullyOnScreen({ scrollY: scrollY.current, viewportHeight, ...box })) {
        seenRef.current[index] = true;
        changed = true;
      }
    }
    if (changed) setSeen({ ...seenRef.current });
  }, [contentBox, viewportHeight]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      reveal();
    },
    [reveal]
  );
  // The step sections are laid out inside a wrapper below the hero, so their `y` is offset by
  // the hero's height (one viewport) to land in scroll-content coordinates. The tops double as
  // the first-launch snap points, so they are mirrored into state for the `ScrollView`.
  const [snapOffsets, setSnapOffsets] = useState<number[]>([0]);
  const sectionLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      sectionTops.current[index] = event.nativeEvent.layout.y + viewportHeight;
      const next = [0];
      for (let i = 0; i <= STEPS.length; i += 1) {
        const top = sectionTops.current[i];
        if (top !== undefined) next.push(top);
      }
      setSnapOffsets((prev) =>
        prev.length === next.length && prev.every((y, i) => y === next[i]) ? prev : next
      );
      reveal();
    },
    [viewportHeight, reveal]
  );
  const contentLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      contentLayouts.current[index] = { y, height };
      reveal();
    },
    [reveal]
  );

  /**
   * One animation at a time, first launch only (captain's ruling, 2026-09-20). `null` while the
   * flag is still loading — `useFirstOnboardingVisit` treats that the same as a first visit, so
   * the scroll starts locked and only opens up once we positively know this is a repeat visit or
   * once reduced motion makes the lock meaningless (every clock is already settled).
   */
  const firstVisit = useFirstOnboardingVisit();
  const reduceMotion = useReducedMotion();
  const lockEnabled = firstVisit !== false && !reduceMotion;

  // Whether each of the STEPS + Get started sections has finished its own build clock, keyed the
  // same as `seen`. A section that is `seen` but not yet `sectionReady` is the one animation
  // currently playing; the lock below holds the scroll there until it latches.
  const [sectionReady, setSectionReady] = useState<Record<number, boolean>>({});
  const markSectionReady = useCallback((index: number) => {
    setSectionReady((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
  }, []);

  const lockedSectionIndex = useMemo(() => {
    if (!lockEnabled) return null;
    if (!heroReady) return -1; // the hero itself is still the animation playing
    for (let index = 0; index <= STEPS.length; index += 1) {
      if (seen[index] && !sectionReady[index]) return index;
    }
    return null;
  }, [lockEnabled, heroReady, seen, sectionReady]);
  const scrollLocked = lockedSectionIndex !== null;

  // When the lock engages on a section, settle the scroll onto it: a drag that stopped with the
  // content just inside the fold, or a snap still decelerating, both end on the section filling
  // the viewport, and a programmatic scroll cancels any momentum the disabled `ScrollView` would
  // otherwise let run out.
  useEffect(() => {
    if (lockedSectionIndex === null || lockedSectionIndex < 0) return;
    const box = contentBox(lockedSectionIndex);
    if (!box) return;
    scrollRef.current?.scrollTo({ y: lockScrollOffset({ viewportHeight, ...box }), animated: true });
  }, [lockedSectionIndex, contentBox, viewportHeight]);

  const stepMinHeight = viewportHeight;

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
          scrollEnabled={!scrollLocked}
          // First launch only: section-to-section snapping, one section per gesture. A repeat
          // visit and reduced motion keep plain free scroll — there is nothing to lock there.
          snapToOffsets={lockEnabled ? snapOffsets : undefined}
          disableIntervalMomentum={lockEnabled}
          decelerationRate={lockEnabled ? 'fast' : undefined}
        >
          <OnboardingHero T={hero.T} width={viewportWidth} height={viewportHeight} />

          <View style={styles.sections}>
            {STEPS.map((step, index) => (
              <View
                key={step.heading}
                testID={`onboarding-section-${index}`}
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
                <View testID={`onboarding-section-content-${index}`} onLayout={contentLayout(index)}>
                  <Step
                    index={index}
                    heading={step.heading}
                    body={step.body}
                    Piece={step.Piece}
                    visible={Boolean(seen[index])}
                    onReady={() => markSectionReady(index)}
                  />
                </View>
              </View>
            ))}

            <View
              testID={`onboarding-section-${STEPS.length}`}
              onLayout={sectionLayout(STEPS.length)}
              style={[styles.section, { borderTopColor: theme.hairline, minHeight: stepMinHeight }]}
            >
              <View
                testID={`onboarding-section-content-${STEPS.length}`}
                onLayout={contentLayout(STEPS.length)}
                style={styles.actions}
              >
                <GetStarted
                  visible={Boolean(seen[STEPS.length])}
                  disabled={!heroReady}
                  onPress={() => router.push('/(auth)/sign-up')}
                  onReady={() => markSectionReady(STEPS.length)}
                />
                <LinkAction onPress={() => router.push('/(auth)/sign-in')}>
                  Already have an account?{' '}
                  <Text style={{ color: theme.text.primary }}>Sign in</Text>
                </LinkAction>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One numbered step: its piece, then its copy. The piece gets its own clock, started the first
 * time the step is on screen. `onReady` fires once, when that clock latches — the first-launch
 * scroll lock's per-section unlatch. */
function Step({
  index,
  heading,
  body,
  Piece,
  visible,
  onReady,
}: {
  index: number;
  heading: string;
  body: string;
  Piece: (props: { t: SharedValue<number> }) => React.JSX.Element;
  visible: boolean;
  onReady: () => void;
}) {
  const theme = useTheme();
  const clock = useBuildClock({ total: STEP_SECONDS, play: visible });
  useEffect(() => {
    if (clock.ready) onReady();
    // `onReady` is a fresh closure each render; `clock.ready` is the one-way latch this effect
    // reacts to, and `onReady` itself is idempotent (`markSectionReady`), so omitting it here
    // avoids re-firing on every parent re-render without risking a missed or duplicate call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.ready]);
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

/** The last beat: the primary action drawing itself in. */
function GetStarted({
  visible,
  disabled,
  onPress,
  onReady,
}: {
  visible: boolean;
  disabled: boolean;
  onPress: () => void;
  onReady: () => void;
}) {
  const clock = useBuildClock({ total: STEP_SECONDS, play: visible });
  useEffect(() => {
    if (clock.ready) onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see Step's identical latch above
  }, [clock.ready]);
  return (
    <View style={styles.getStarted}>
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
  },
});
