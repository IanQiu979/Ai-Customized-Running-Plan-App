import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../index';

/**
 * Home after the captain's 2026-09-20 phone test: it asks nothing and generates nothing. These
 * cases pin the three things it does instead — the first-entry gate to the intake, the
 * subscription box above the plan summary, and the one "Create a new plan" CTA — and, just as
 * deliberately, the controls that left with that ruling: the target card and its "Change", the
 * plan-length field, Notes and its locked panel, and the "On Pro & Elite" teaser.
 */

const mockPush = jest.fn();
// A stable object, as the real `useRouter()` returns one — Home's focus effect lists `router` in
// its deps, and a fresh object per render would re-run the effect (and its fetches) forever.
const mockRouter = { push: mockPush };
const mockGetIntake = jest.fn();
const mockGetQuotaStatus = jest.fn();
const mockListPlans = jest.fn();
const mockGeneratePlan = jest.fn();

let mockFocusCleanup: (() => void) | undefined;

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = effect();
        mockFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;

        return () => {
          mockFocusCleanup?.();
          mockFocusCleanup = undefined;
        };
      }, [effect]);
    },
  };
});

// The header mark and the plan summary read the newest plan's length through the plan cache;
// hold it unresolved so these cases stay about the screen's own branches.
jest.mock('@/hooks/use-plan', () => ({
  peekPlan: () => undefined,
  loadPlan: () => new Promise(() => {}),
}));

jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  ApiError: class MockApiError extends Error {},
  describeError: (_error: unknown, fallback: string) => fallback,
  generatePlan: (...args: unknown[]) => mockGeneratePlan(...args),
  getIntake: (...args: unknown[]) => mockGetIntake(...args),
  getQuotaStatus: (...args: unknown[]) => mockGetQuotaStatus(...args),
  listPlans: (...args: unknown[]) => mockListPlans(...args),
  // `VerifyEmailBanner` (issue #94) reads these and renders nothing for a verified runner or an
  // unconfigured mail provider; both are held at "nothing to show".
  getEmailStatus: async () => ({ mailConfigured: false, verificationRequired: false }),
  resendVerificationEmail: async () => ({ ok: true }),
  useSessionUser: () => null,
}));

const intake = {
  goal: 'general fitness',
  age: 34,
  experience: 'regular' as const,
  daysPerWeek: 4,
  weeklyKm: 32,
  raceDistance: '10k' as const,
  injuries: ['none' as const],
};

const freeQuota = {
  tier: 'free' as const,
  used: 0,
  limit: 1,
  periodEnd: null,
  unlimited: false,
};

const generatedPlan = {
  planId: 'settled-plan',
  title: 'Settled plan',
  tierAtGeneration: 'free' as const,
  engine: 'template',
  isFallback: false,
  createdAt: '2026-09-12T08:00:00.000Z',
};

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
  for (let turn = 0; turn < 6; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function labels(tree: ReactTestRenderer, accessibilityLabel: string) {
  return tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === accessibilityLabel
  );
}

function controls(
  tree: ReactTestRenderer,
  accessibilityLabel: string,
  role: 'button' | 'link' = 'button'
): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === role &&
      node.props.accessibilityLabel === accessibilityLabel &&
      typeof node.props.onPress === 'function'
  );
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

function resetMocks() {
  mockPush.mockClear();
  mockGetIntake.mockReset().mockResolvedValue({ intake });
  mockGetQuotaStatus.mockReset().mockResolvedValue(freeQuota);
  mockListPlans.mockReset().mockResolvedValue({ plans: [] });
  mockGeneratePlan.mockReset();
  mockFocusCleanup = undefined;
}

function unmountAll() {
  act(() => {
    mountedTrees.splice(0).forEach((tree) => tree.unmount());
  });
}

describe('Home first-entry gate (captain\'s ruling 1, 2026-09-20)', () => {
  beforeEach(resetMocks);
  afterEach(unmountAll);

  it('sends a signed-in runner with no intake on file to the intake, and offers nothing else', async () => {
    mockGetIntake.mockResolvedValue({ intake: null });

    const tree = await renderScreen(<HomeScreen />);

    expect(mockPush).toHaveBeenCalledWith('/intake');
    // No way to stay: no CTA, no "Start intake" prompt, no plan-creation controls of any kind.
    expect(labels(tree, 'Create a new plan')).toHaveLength(0);
    expect(labels(tree, 'Start intake')).toHaveLength(0);
    expect(flatten(tree.root)).not.toContain("Let's find your starting line.");
  });

  it('does not redirect when the intake lookup fails — a failed fetch is not "no intake"', async () => {
    mockGetIntake.mockRejectedValue(new Error('offline'));

    const tree = await renderScreen(<HomeScreen />);

    expect(mockPush).not.toHaveBeenCalledWith('/intake');
    expect(flatten(tree.root)).toContain('Could not load your intake.');
  });

  it('does not redirect once the intake exists', async () => {
    await renderScreen(<HomeScreen />);

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Home controls after the 2026-09-20 rework', () => {
  beforeEach(resetMocks);
  afterEach(unmountAll);

  it('shows one "Create a new plan" that opens the intake, and generates nothing itself', async () => {
    const tree = await renderScreen(<HomeScreen />);
    const cta = controls(tree, 'Create a new plan');

    expect(cta).toHaveLength(1);
    if (cta.length !== 1) return;
    expect(cta[0].props.accessibilityState).toEqual({ disabled: false });

    act(() => {
      (cta[0].props.onPress as () => void)();
    });

    expect(mockPush).toHaveBeenCalledWith('/intake');
    expect(mockGeneratePlan).not.toHaveBeenCalled();
    expect(labels(tree, 'Create plan')).toHaveLength(0);
  });

  it('carries no target or plan-length controls — those questions belong to the intake', async () => {
    mockGetIntake.mockResolvedValue({ intake: { ...intake, raceDate: '2027-03-01' } });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(labels(tree, 'Change target')).toHaveLength(0);
    expect(labels(tree, 'Plan length in weeks')).toHaveLength(0);
    expect(renderedText).not.toContain('YOUR TARGET');
    expect(renderedText).not.toContain('PLAN LENGTH');
    expect(renderedText).not.toContain('2027-03-01');
  });

  it('shows neither the Notes teaser nor the "On Pro & Elite" teaser to a Free runner with a plan', async () => {
    mockListPlans.mockResolvedValue({ plans: [generatedPlan] });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(labels(tree, 'Notes')).toHaveLength(0);
    expect(labels(tree, 'Notes — locked. Available on Pro and Elite.')).toHaveLength(0);
    expect(
      labels(tree, "Pace targets, HR zones and coach's notes — locked. Available on Pro and Elite.")
    ).toHaveLength(0);
    expect(renderedText).not.toContain('NOTES (OPTIONAL)');
    expect(renderedText).not.toContain('ON PRO & ELITE');
    expect(renderedText).not.toContain('UPGRADE TO UNLOCK');
  });

  it('shows no Notes field to a paid runner with a plan either', async () => {
    mockGetQuotaStatus.mockResolvedValue({ ...freeQuota, tier: 'pro', limit: 5 });
    mockListPlans.mockResolvedValue({ plans: [{ ...generatedPlan, tierAtGeneration: 'pro' }] });

    const tree = await renderScreen(<HomeScreen />);

    expect(labels(tree, 'Notes')).toHaveLength(0);
    expect(flatten(tree.root)).not.toContain('NOTES (OPTIONAL)');
  });

  it('puts the subscription box above the plan summary, and the summary above the CTA', async () => {
    mockListPlans.mockResolvedValue({ plans: [generatedPlan] });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    const subscriptionAt = renderedText.indexOf('See plans →');
    const summaryAt = renderedText.indexOf('Settled plan');
    const ctaAt = renderedText.indexOf('Create a new plan');
    const myPlansAt = renderedText.indexOf('My Plans →');

    expect(subscriptionAt).toBeGreaterThanOrEqual(0);
    expect(summaryAt).toBeGreaterThan(subscriptionAt);
    expect(ctaAt).toBeGreaterThan(summaryAt);
    expect(myPlansAt).toBeGreaterThan(ctaAt);

    // The subscription box is the door to the paywall, labelled with the tier and the count.
    const box = controls(tree, 'Free plan, 0 of 1 plans used. See plans', 'link');
    expect(box).toHaveLength(1);
    act(() => {
      (box[0].props.onPress as () => void)();
    });
    expect(mockPush).toHaveBeenCalledWith('/paywall');
  });

  it('opens the newest plan from the summary row', async () => {
    mockListPlans.mockResolvedValue({
      plans: [generatedPlan, { ...generatedPlan, planId: 'older', title: 'Older', createdAt: '2026-08-01T00:00:00.000Z' }],
    });

    const tree = await renderScreen(<HomeScreen />);
    const summary = controls(tree, 'Current plan: Settled plan. Open plan', 'link');

    expect(summary).toHaveLength(1);
    expect(flatten(tree.root)).not.toContain('Older');
    act(() => {
      (summary[0].props.onPress as () => void)();
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/plan/[id]',
      params: { id: 'settled-plan', createdAt: generatedPlan.createdAt },
    });
  });

  it('shows no plan summary before any plan exists', async () => {
    const tree = await renderScreen(<HomeScreen />);

    expect(flatten(tree.root)).not.toContain('CURRENT PLAN');
    expect(labels(tree, 'Create a new plan')).toHaveLength(1);
  });
});

/**
 * Copy-vs-behaviour (issue #25). The frontend audit of 2026-07-11 caught Home telling a tester
 * "Intake, generation, and plan view land in later build phases" directly above a working
 * plan-view link. These cases exist so the claim cannot come back and so every pressable Home
 * renders keeps announcing a role.
 */
describe('Home copy matches what the app does (issue #25)', () => {
  beforeEach(() => {
    resetMocks();
    mockListPlans.mockResolvedValue({ plans: [generatedPlan] });
  });
  afterEach(unmountAll);

  const placeholderClaims = [/later build phase/i, /build phases/i, /\(demo\)/i, /not yet available/i];

  it('never claims a capability is missing once intake and a plan exist', async () => {
    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(renderedText).toContain('Create a new plan');
    expect(renderedText).toContain('My Plans →');
    for (const claim of placeholderClaims) expect(renderedText).not.toMatch(claim);
  });

  it('gives every pressable on Home a role a screen reader can announce', async () => {
    const tree = await renderScreen(<HomeScreen />);
    const pressables = tree.root.findAll(
      (node) =>
        typeof node.type === 'function' &&
        node.type.name === 'Pressable' &&
        typeof node.props.onPress === 'function'
    );

    // The subscription box, the plan summary, the one CTA and the My Plans row — none of them may
    // be a bare, role-less Pressable.
    expect(pressables.length).toBeGreaterThanOrEqual(4);
    for (const pressable of pressables) {
      expect(['button', 'link']).toContain(pressable.props.accessibilityRole);
    }
    expect(labels(tree, 'Go to My Plans')).toHaveLength(1);
    expect(labels(tree, 'Go to My Plans')[0].props.accessibilityRole).toBe('link');
  });
});
