import type { ReactElement, ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { examplePlan } from '@/lib/fixtures/examplePlan';

import MyPlansScreen from '../my-plans';

const mockListPlans = jest.fn();
const mockPush = jest.fn();
const mockLoadPlan = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useRouter: () => ({ push: mockPush }),
    Link: ({ href, children }: { href: unknown; children: ReactNode }) =>
      React.createElement('mock-link', { href }, children),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        return effect();
      }, [effect]);
    },
  };
});

// The hero and the row miniatures read plan details through the plan cache.
jest.mock('@/hooks/use-plan', () => ({
  peekPlan: () => undefined,
  loadPlan: (...args: unknown[]) => mockLoadPlan(...args),
}));

jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  describeError: (_error: unknown, fallback: string) => fallback,
  listPlans: (...args: unknown[]) => mockListPlans(...args),
}));

const mountedTrees: ReactTestRenderer[] = [];

async function renderScreen(element: ReactElement): Promise<ReactTestRenderer> {
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
  await settleUpdates();
  mountedTrees.push(tree);
  return tree;
}

async function settleUpdates(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function flatten(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children && typeof children === 'object') {
    const node = children as { children?: unknown; props?: { children?: unknown } };
    return flatten(node.children ?? node.props?.children);
  }
  return '';
}

/** The plan rows are `Pressable`s with `accessibilityRole="link"` that push their plan — not
 * `<Link>`s, which drop a function-form style on web (see `PlanListRow.tsx`). */
function rowsContaining(tree: ReactTestRenderer, text: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === 'link' &&
      typeof node.props.onPress === 'function' &&
      typeof node.type !== 'string' &&
      flatten(node.props.children).includes(text)
  );
}

describe('My Plans library', () => {
  beforeEach(() => {
    mockListPlans.mockReset();
    mockPush.mockReset();
    mockLoadPlan.mockReset();
    // Every real plan's detail resolves to the example fixture's shape — the screens only need a
    // `Plan`; which one is irrelevant here.
    mockLoadPlan.mockImplementation(() =>
      Promise.resolve({ plan: examplePlan, quotaConsumed: false })
    );
  });

  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });
  });

  it('shows the permanent Example Plan without a contradictory empty state', async () => {
    mockListPlans.mockResolvedValue({ plans: [] });

    const tree = await renderScreen(<MyPlansScreen />);

    expect(rowsContaining(tree, 'Example Plan (5K)')).toHaveLength(1);
    expect(rowsContaining(tree, 'MOST RECENT')).toHaveLength(0);
    expect(flatten(tree.root)).not.toContain('Nothing here yet.');
  });

  it('opens the newest plan from an unsorted response as the MOST RECENT hero', async () => {
    mockListPlans.mockResolvedValue({
      plans: [
        {
          planId: 'middle-plan',
          title: 'Middle plan',
          tierAtGeneration: 'pro',
          engine: 'hybrid',
          isFallback: false,
          createdAt: '2026-09-10T12:00:00.000Z',
        },
        {
          planId: 'newest-plan',
          title: 'Newest plan',
          tierAtGeneration: 'elite',
          engine: 'hybrid',
          isFallback: false,
          createdAt: '2026-09-12T09:30:00.000Z',
        },
        {
          planId: 'oldest-plan',
          title: 'Oldest plan',
          tierAtGeneration: 'free',
          engine: 'template',
          isFallback: false,
          createdAt: '2026-09-08T06:00:00.000Z',
        },
      ],
    });

    const tree = await renderScreen(<MyPlansScreen />);

    // The hero is the runner's real most recent plan, and its one action opens that plan —
    // the newest by `createdAt`, whatever order the server listed them in.
    expect(flatten(tree.root)).toContain('MOST RECENT');
    const openPlan = tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Open plan' && typeof node.props.onPress === 'function'
    );
    expect(openPlan.length).toBeGreaterThanOrEqual(1);
    if (openPlan.length === 0) return;

    act(() => {
      openPlan[0].props.onPress();
    });
    // `createdAt` rides along so the overview can derive elapsed days (`planProgress.ts`)
    // without a second fetch.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/plan/[id]',
      params: { id: 'newest-plan', createdAt: '2026-09-12T09:30:00.000Z' },
    });

    // Every listed plan is a row that pushes to itself.
    for (const [id, title, createdAt] of [
      ['middle-plan', 'Middle plan', '2026-09-10T12:00:00.000Z'],
      ['newest-plan', 'Newest plan', '2026-09-12T09:30:00.000Z'],
      ['oldest-plan', 'Oldest plan', '2026-09-08T06:00:00.000Z'],
    ]) {
      const rows = rowsContaining(tree, title);
      expect(rows).toHaveLength(1);
      mockPush.mockClear();
      act(() => {
        rows[0].props.onPress();
      });
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[id]', params: { id, createdAt } });
    }
  });
});
