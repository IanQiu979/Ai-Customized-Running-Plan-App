import { act, create, type ReactTestRenderer } from 'react-test-renderer';
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
 */

// The clock the screen sees. `ready: false` is a hero that mounts and never reports its build
// ended — an interrupted animation, an unmount mid-build, or a reduced-motion branch that
// misses; `ready: true` is the healthy run.
let mockReady = false;

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
jest.mock('@/components/build/RunnerFigure', () => ({ RunnerFigure: () => null }));

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
});
