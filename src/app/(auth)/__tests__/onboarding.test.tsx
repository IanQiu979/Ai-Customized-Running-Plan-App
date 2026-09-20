import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView } from 'react-native';
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
 * disabled while the section currently in view — the hero, first — is still animating, and stays
 * enabled on a repeat visit or under reduced motion, where there is nothing to lock. The hero's
 * own "Scroll down" hint and its rendered copy are `build.test.tsx`'s job (`OnboardingHero` is
 * mocked away here to keep this tree to the gate it proves).
 */

// The clock the screen sees. `ready: false` is a hero that mounts and never reports its build
// ended — an interrupted animation, an unmount mid-build, or a reduced-motion branch that
// misses; `ready: true` is the healthy run.
let mockReady = false;

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
  useBuildClock: () => ({ T: { value: 0 }, settled: false, ready: mockReady, restart: jest.fn() }),
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

/** Where the fallback sits: past the hero's whole authored timeline plus the clock's slack. */
const HERO_TIMELINE_MS = HERO_TIMELINE.total * 1000 + SETTLE_SLACK_MS;

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReady = false;
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

    it('never locks the loading state either — `null` is treated as first-visit, not unlocked', () => {
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
  });
});
