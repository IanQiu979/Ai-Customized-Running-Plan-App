import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from '../onboarding';

/**
 * `CLAUDE.md` says screens are not unit-tested, and this is the one deliberate exception: the
 * signed-out landing screen gates "Get started" — its ONLY forward action — on a callback raised
 * by `<PulseTraceHero>`, a component owned by another branch. If that callback never arrives the
 * runner is stranded on a permanently disabled button with nowhere else to go, so the screen
 * carries its own bounded ceiling and this suite is what proves the ceiling holds.
 */

// A pulse trace that mounts, renders its copy, and never raises `onSettled` — an interrupted
// draw, an unmount mid-draw, or a reduced-motion branch that misses. It ignores the prop
// entirely, which is exactly the failure being reproduced.
jest.mock('@/components/onboarding/PulseTraceSlot', () => ({
  PulseTraceSlot: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }) }));

/** The rendered "Get started" control's `accessibilityState.disabled` — the flag that actually
 * makes the `Pressable` inert, read off the tree rather than off component state. */
function ctaDisabled(node: unknown): boolean | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  const props = candidate.props ?? {};
  if (props.accessibilityRole === 'button' && props.accessibilityLabel === 'Get started') {
    return (props.accessibilityState as { disabled?: boolean } | undefined)?.disabled;
  }
  for (const child of candidate.children ?? []) {
    const found = ctaDisabled(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe('OnboardingScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('releases the CTA on its own ceiling when the hero never settles', () => {
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

    // The captain's constraint still holds up front: settled first, interactive second.
    expect(ctaDisabled(tree.toJSON())).toBe(true);

    // 4s is past any healthy draw, so reaching it means something is genuinely wrong — and the
    // runner gets the button back rather than a dead end.
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(ctaDisabled(tree.toJSON())).toBe(false);
  });
});
