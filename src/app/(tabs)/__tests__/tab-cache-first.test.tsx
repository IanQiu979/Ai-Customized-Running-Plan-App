import type { ReactElement } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { PlanSummary } from '@/lib/apiClient';

import MyPlansScreen from '../my-plans';

/**
 * My Plans is a rendered-screen exception to the usual pure-logic test preference: the bug is the
 * screen's visible branch during an Expo Router focus refresh. A second focus used to call
 * `setLoading(true)`, replacing already-rendered plan data with a full loading indicator even
 * though the tab navigator had kept this exact screen instance mounted.
 */

type FocusEffect = () => void | (() => void);

let mockRegisteredFocusEffect: FocusEffect | undefined;
const mockListPlans = jest.fn<Promise<{ plans: PlanSummary[] }>, []>();

jest.mock('expo-router', () => {
  const actual = jest.requireActual<typeof import('expo-router')>('expo-router');
  return {
    __esModule: true,
    ...actual,
    useFocusEffect: (effect: FocusEffect) => {
      mockRegisteredFocusEffect = effect;
    },
  };
});

// The screen fills each row's miniature (and the hero) from the plan cache; hold those details
// unresolved so the assertion is purely about the list's cache-first branch.
jest.mock('@/hooks/use-plan', () => ({
  peekPlan: () => undefined,
  loadPlan: () => new Promise(() => {}),
}));

jest.mock('@/lib/apiClient', () => {
  const errors = jest.requireActual<typeof import('@/lib/apiErrors')>('@/lib/apiErrors');
  return {
    API_BASE_URL: 'https://example.invalid',
    describeError: errors.describeError,
    listPlans: () => mockListPlans(),
  };
});

const cachedPlan: PlanSummary = {
  planId: 'plan_cached_001',
  title: 'Cached Marathon Build',
  tierAtGeneration: 'pro',
  engine: 'template-personalized',
  isFallback: false,
  createdAt: '2026-09-12T08:15:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        {element}
      </SafeAreaProvider>
    );
  });
  return tree;
}

function visibleText(tree: ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('MyPlansScreen cache-first focus refresh', () => {
  beforeEach(() => {
    mockRegisteredFocusEffect = undefined;
    mockListPlans.mockReset();
  });

  it('keeps cached plans visible without a loading indicator on the second focus', async () => {
    const firstRequest = deferred<{ plans: PlanSummary[] }>();
    const refreshRequest = deferred<{ plans: PlanSummary[] }>();
    mockListPlans.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(refreshRequest.promise);

    const tree = render(<MyPlansScreen />);
    expect(mockRegisteredFocusEffect).toBeDefined();

    let blur: void | (() => void);
    act(() => {
      blur = mockRegisteredFocusEffect?.();
    });

    // No cached response exists on the first focus, so a full loading state is appropriate.
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);

    await act(async () => {
      firstRequest.resolve({ plans: [cachedPlan] });
      await firstRequest.promise;
    });

    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(visibleText(tree)).toContain('Cached Marathon Build');

    // Blur only runs the registered focus cleanup. The renderer stays mounted, just as a tab does.
    act(() => {
      blur?.();
    });

    act(() => {
      mockRegisteredFocusEffect?.();
    });

    // The background refresh deliberately remains unresolved. Cache-first rendering must not
    // flash a spinner or hide the last known plan while that request is in flight.
    expect({
      activityIndicators: tree.root.findAllByType(ActivityIndicator).length,
      cachedPlanVisible: visibleText(tree).includes('Cached Marathon Build'),
    }).toEqual({ activityIndicators: 0, cachedPlanVisible: true });
  });
});
