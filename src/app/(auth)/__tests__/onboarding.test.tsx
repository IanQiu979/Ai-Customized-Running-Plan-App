import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Dimensions, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SETTLE_SLACK_MS } from '@/components/build/useBuildClock';
import { HERO_TIMELINE } from '@/lib/buildMotion';

import OnboardingScreen from '../onboarding';

/**
 * `CLAUDE.md` says screens are not unit-tested, and this is the one deliberate exception: the
 * signed-out landing screen gates "Create your first plan" — its ONLY forward action — on the
 * hero's build clock reporting that the build has ended (`ready` at the hold's start). If that
 * never arrives the runner is stranded on a permanently disabled button with nowhere else to
 * go, so the screen carries its own fallback ceiling, past the hero's whole authored timeline,
 * and this suite is what proves both halves: the clock's own report enables the CTA on a
 * healthy run, and the ceiling releases it — as a fallback, never before the timeline has had
 * every chance to complete — when the clock never reports at all.
 *
 * It also covers the captain's 2026-09-20 first-launch scroll lock: the `ScrollView` itself is
 * disabled while the section currently in view — the hero, first — is still animating, engages on
 * a step only once that step's content is fully on screen (never while it is still below the
 * fold), snaps section to section so a fling cannot carry past the one animating, and stays
 * enabled and free-scrolling on a repeat visit or under reduced motion, where there is nothing to
 * lock. The hero's own "Scroll down" hint and its rendered copy are `build.test.tsx`'s job
 * (`OnboardingHero` is mocked away here to keep this tree to the gate it proves).
 */

// The clock the screen sees. `ready: false` is a hero that mounts and never reports its build
// ended — an interrupted animation, an unmount mid-build, or a reduced-motion branch that
// misses; `ready: true` is the healthy run.
let mockReady = false;

// The step and Get started clocks (the ones with no `readyAt`): `false` is a piece still playing,
// which is what holds the first-launch lock on its section once that section has been seen.
let mockStepReady = false;

// The first-launch flag `useFirstOnboardingVisit` resolves to. `true` (or `null`, its loading
// state) holds the scroll lock; `false` — a repeat visit — never locks regardless of `mockReady`.
let mockFirstVisit: boolean | null = true;

// Reduced motion bypasses the lock entirely: every clock is already at its end frame, so there is
// nothing to wait out.
let mockReduceMotion = false;

jest.mock('@/components/build/OnboardingHero', () => ({
  OnboardingHero: () => null,
}));
jest.mock('@/components/build/useBuildClock', () => ({
  SETTLE_SLACK_MS:
    jest.requireActual<typeof import('@/components/build/useBuildClock')>(
      '@/components/build/useBuildClock'
    ).SETTLE_SLACK_MS,
  useBuildClock: ({ readyAt }: { readyAt?: number }) => ({
    T: { value: 0 },
    settled: false,
    ready: readyAt === undefined ? mockStepReady : mockReady,
    restart: jest.fn(),
  }),
}));
// The step pieces and the reveal button drive Reanimated styles off that clock; they are not what
// is under test, and a stub keeps the tree to the gate it proves.
jest.mock('@/components/build/steps', () => ({
  StepIntake: () => null,
  StepEngine: () => null,
  StepMiniPlan: () => null,
}));
jest.mock('@/hooks/use-first-onboarding-visit', () => ({
  useFirstOnboardingVisit: () => mockFirstVisit,
}));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<typeof import('react-native-reanimated')>(
    'react-native-reanimated'
  );
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: () => mockReduceMotion,
  };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }) }));

/** The rendered primary control's `accessibilityState.disabled` — the flag that actually makes
 * the `Pressable` inert, read off the tree rather than off component state. */
function ctaDisabled(node: unknown): boolean | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  const props = candidate.props ?? {};
  if (
    props.accessibilityRole === 'button' &&
    props.accessibilityLabel === 'Create your first plan'
  ) {
    return (props.accessibilityState as { disabled?: boolean } | undefined)?.disabled;
  }
  for (const child of candidate.children ?? []) {
    const found = ctaDisabled(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The rendered `ScrollView`'s `scrollEnabled` — the first-launch lock's one visible effect on
 * this mocked-down tree. */
function scrollEnabled(tree: ReactTestRenderer): boolean {
  return tree.root.findByType(ScrollView).props.scrollEnabled;
}

/** The window the screen measures itself against (`useWindowDimensions`), not the safe-area frame. */
const VIEWPORT = Dimensions.get('window');

/** Lay out one section and its content box the way the native side would: the section a viewport
 * tall at `y` inside the wrapper under the hero, its content centred. */
function layoutSection(tree: ReactTestRenderer, index: number, y: number, contentHeight: number) {
  const section = tree.root.findByProps({ testID: `onboarding-section-${index}` });
  const content = tree.root.findByProps({ testID: `onboarding-section-content-${index}` });
  act(() => {
    section.props.onLayout({
      nativeEvent: { layout: { x: 0, y, width: VIEWPORT.width, height: VIEWPORT.height } },
    });
    content.props.onLayout({
      nativeEvent: {
        layout: {
          x: 0,
          y: (VIEWPORT.height - contentHeight) / 2,
          width: VIEWPORT.width,
          height: contentHeight,
        },
      },
    });
  });
}

function scrollTo(tree: ReactTestRenderer, y: number) {
  act(() => {
    tree.root.findByType(ScrollView).props.onScroll({ nativeEvent: { contentOffset: { y } } });
  });
}

function mount(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  });
  return tree;
}

/** Re-render the same tree so the mocked clocks are re-read. */
function rerender(tree: ReactTestRenderer) {
  act(() => {
    tree.update(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  });
}

/** Where the fallback sits: past the hero's whole authored timeline plus the clock's slack. */
const HERO_TIMELINE_MS = HERO_TIMELINE.total * 1000 + SETTLE_SLACK_MS;

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReady = false;
    mockStepReady = false;
    mockFirstVisit = true;
    mockReduceMotion = false;
  });
  afterEach(() => jest.useRealTimers());

  it('enables the CTA as soon as the clock reports the build has ended', () => {
    mockReady = true;
    const tree = mount();
    expect(ctaDisabled(tree.toJSON())).toBe(false);
  });

  it('holds the CTA disabled for the whole authored timeline when the clock never reports', () => {
    const tree = mount();

    // The captain's constraint still holds up front: built first, interactive second.
    expect(ctaDisabled(tree.toJSON())).toBe(true);

    // The ceiling is a fallback, not the gate: it must not fire while a healthy clock could still
    // be reporting — anywhere inside the hero's build, its hold, or the clock's own slack.
    act(() => {
      jest.advanceTimersByTime(HERO_TIMELINE_MS);
    });
    expect(ctaDisabled(tree.toJSON())).toBe(true);
  });

  it('releases the CTA on its own fallback ceiling when the hero never settles', () => {
    const tree = mount();

    // Past the whole timeline and its slack, a clock that still has not reported never will —
    // and the runner gets the button back rather than a dead end.
    act(() => {
      jest.advanceTimersByTime(HERO_TIMELINE_MS + SETTLE_SLACK_MS);
    });
    expect(ctaDisabled(tree.toJSON())).toBe(false);
  });

  describe('first-launch scroll lock (2026-09-20 ruling)', () => {
    it('locks the scroll on first launch while the hero is still the animation playing', () => {
      mockFirstVisit = true;
      mockReady = false;
      const tree = mount();
      expect(scrollEnabled(tree)).toBe(false);
    });

    it('unlocks once the hero reports its build ended, its completion callback', () => {
      mockFirstVisit = true;
      mockReady = true;
      const tree = mount();
      // Nothing further down has scrolled into view yet, so there is no next animation to hold
      // the lock on — the runner is free to act on the hero's "Scroll down" hint.
      expect(scrollEnabled(tree)).toBe(true);
    });

    it('locks while the flag is still loading — `null` is treated as first-visit, not unlocked', () => {
      mockFirstVisit = null;
      mockReady = false;
      const tree = mount();
      expect(scrollEnabled(tree)).toBe(false);
    });

    it('never locks a repeat visit, even mid-build', () => {
      mockFirstVisit = false;
      mockReady = false;
      const tree = mount();
      expect(scrollEnabled(tree)).toBe(true);
    });

    it('never locks under reduced motion, even on a first visit mid-build', () => {
      mockFirstVisit = true;
      mockReduceMotion = true;
      mockReady = false;
      const tree = mount();
      expect(scrollEnabled(tree)).toBe(true);
    });

    describe('the latch is the content box, not the section edge', () => {
      // The first step's section sits 24 pt into the wrapper under the one-viewport hero; its
      // 400-pt content is centred inside it.
      const SECTION_Y = 24;
      const SECTION_TOP = VIEWPORT.height + SECTION_Y;
      const CONTENT_HEIGHT = 400;
      const CONTENT_TOP = SECTION_TOP + (VIEWPORT.height - CONTENT_HEIGHT) / 2;

      it('does not engage while the section top is in view but its content is below the fold', () => {
        mockReady = true;
        const tree = mount();
        layoutSection(tree, 0, SECTION_Y, CONTENT_HEIGHT);
        // The old latch fired here — the section's top is 400 pt inside the viewport — but the
        // content's bottom is still under the fold.
        scrollTo(tree, SECTION_TOP - VIEWPORT.height + 400);
        expect(CONTENT_TOP + CONTENT_HEIGHT).toBeGreaterThan(SECTION_TOP + 400);
        expect(scrollEnabled(tree)).toBe(true);
        expect(tree.root.findByType(ScrollView).instance.scrollTo).not.toHaveBeenCalled();
      });

      it('engages once the content is fully on screen and settles the scroll onto the section', () => {
        mockReady = true;
        const tree = mount();
        layoutSection(tree, 0, SECTION_Y, CONTENT_HEIGHT);
        scrollTo(tree, CONTENT_TOP + CONTENT_HEIGHT - VIEWPORT.height);
        expect(scrollEnabled(tree)).toBe(false);
        expect(tree.root.findByType(ScrollView).instance.scrollTo).toHaveBeenCalledWith({
          y: SECTION_TOP,
          animated: true,
        });
      });

      it('releases when that section reports its own build ended', () => {
        mockReady = true;
        const tree = mount();
        layoutSection(tree, 0, SECTION_Y, CONTENT_HEIGHT);
        scrollTo(tree, SECTION_TOP);
        expect(scrollEnabled(tree)).toBe(false);
        mockStepReady = true;
        rerender(tree);
        expect(scrollEnabled(tree)).toBe(true);
      });
    });

    describe('section-to-section snapping', () => {
      const scrollProps = (tree: ReactTestRenderer) => tree.root.findByType(ScrollView).props;

      it('snaps to every section top, one section per gesture, on first launch', () => {
        mockFirstVisit = true;
        const tree = mount();
        layoutSection(tree, 0, 24, 400);
        layoutSection(tree, 1, 24 + VIEWPORT.height, 400);
        const props = scrollProps(tree);
        expect(props.snapToOffsets).toEqual([0, VIEWPORT.height + 24, 2 * VIEWPORT.height + 24]);
        expect(props.disableIntervalMomentum).toBe(true);
      });

      it('scrolls freely, with no snapping, on a repeat visit', () => {
        mockFirstVisit = false;
        const tree = mount();
        layoutSection(tree, 0, 24, 400);
        const props = scrollProps(tree);
        expect(props.snapToOffsets).toBeUndefined();
        expect(props.disableIntervalMomentum).toBe(false);
      });

      it('scrolls freely, with no snapping, under reduced motion', () => {
        mockFirstVisit = true;
        mockReduceMotion = true;
        const tree = mount();
        layoutSection(tree, 0, 24, 400);
        const props = scrollProps(tree);
        expect(props.snapToOffsets).toBeUndefined();
        expect(props.disableIntervalMomentum).toBe(false);
      });
    });
  });
});
