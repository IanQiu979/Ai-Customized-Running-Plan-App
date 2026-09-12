import type { ReactElement, ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MyPlansScreen from '../my-plans';

const mockListPlans = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    Link: ({ href, children }: { href: unknown; children: ReactNode }) =>
      React.createElement('mock-link', { href }, children),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        return effect();
      }, [effect]);
    },
  };
});

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

function linksContaining(tree: ReactTestRenderer, text: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) => String(node.type) === 'mock-link' && flatten(node.props.children).includes(text)
  );
}

describe('My Plans library', () => {
  beforeEach(() => {
    mockListPlans.mockReset();
  });

  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });
  });

  it('shows the permanent Example Plan without a contradictory empty state', async () => {
    mockListPlans.mockResolvedValue({ plans: [] });

    const tree = await renderScreen(<MyPlansScreen />);

    expect(linksContaining(tree, 'Example Plan (5K)')).toHaveLength(1);
    expect(linksContaining(tree, 'MOST RECENT')).toHaveLength(0);
    expect(flatten(tree.root)).not.toContain('Nothing here yet.');
  });

  it('links the MOST RECENT stat to the newest plan from an unsorted response', async () => {
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
    const recentLinks = linksContaining(tree, 'MOST RECENT');

    expect(recentLinks).toHaveLength(1);
    if (recentLinks.length !== 1) return;

    expect(recentLinks[0].props.href).toEqual({
      pathname: '/plan/[id]',
      params: { id: 'newest-plan' },
    });
    expect(
      recentLinks[0].findAll(
        (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'link'
      )
    ).toHaveLength(1);
  });
});
