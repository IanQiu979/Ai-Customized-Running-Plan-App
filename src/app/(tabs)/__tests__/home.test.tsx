import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../index';

const mockPush = jest.fn();
const mockGetIntake = jest.fn();
const mockGetQuotaStatus = jest.fn();
const mockListPlans = jest.fn();
const mockGeneratePlan = jest.fn();

let mockFocusedEffect: (() => void | (() => void)) | undefined;
let mockFocusCleanup: (() => void) | undefined;

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        mockFocusedEffect = effect;
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

// The header mark reads the newest plan's length through the plan cache; hold it unresolved so
// these cases stay about the subscription disclosures.
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
  // unconfigured mail provider; both are held at "nothing to show" so the disclosures under test
  // are the only variable.
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

async function refocus(): Promise<void> {
  act(() => {
    mockFocusCleanup?.();
    const cleanup = mockFocusedEffect?.();
    mockFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
  });
  await settleUpdates();
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

function controls(tree: ReactTestRenderer, accessibilityLabel: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === 'button' &&
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

describe('Home subscription disclosures', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGetIntake.mockReset().mockResolvedValue({ intake });
    mockGetQuotaStatus.mockReset();
    mockListPlans.mockReset();
    mockGeneratePlan.mockReset();
    mockFocusedEffect = undefined;
    mockFocusCleanup = undefined;
  });

  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });
  });

  it('hides Notes and the paid-plan teaser for a paid runner with no generated plan', async () => {
    mockGetQuotaStatus.mockResolvedValue({ ...freeQuota, tier: 'pro', limit: 5 });
    mockListPlans.mockResolvedValue({ plans: [] });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(renderedText).toContain('YOUR TARGET');
    expect(renderedText).toContain('PRO');
    expect(labels(tree, 'Notes')).toHaveLength(0);
    expect(labels(tree, 'Notes — locked. Available on Pro and Elite.')).toHaveLength(0);
    expect(
      labels(tree, "Pace targets, HR zones and coach's notes — locked. Available on Pro and Elite.")
    ).toHaveLength(0);
    expect(renderedText).not.toContain('NOTES (OPTIONAL)');
    expect(renderedText).not.toContain('ON PRO & ELITE');
  });

  it('keeps the plan creation basics available before any generated plan exists', async () => {
    mockGetQuotaStatus.mockResolvedValue(freeQuota);
    mockListPlans.mockResolvedValue({ plans: [] });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);
    const createPlanControls = labels(tree, 'Create plan');

    expect(createPlanControls).toHaveLength(1);
    if (createPlanControls.length !== 1) return;
    expect(createPlanControls[0].props.accessibilityRole).toBe('button');
    expect(createPlanControls[0].props.accessibilityState).toEqual({ disabled: false });
    expect(labels(tree, 'Plan length in weeks')).toHaveLength(1);
    expect(renderedText).toContain('YOUR TARGET');
    expect(renderedText).toContain('General fitness — no target race');
    expect(renderedText).toContain('PLAN LENGTH (WEEKS)');
  });

  it('announces a generation error as an assertive alert after Create plan is pressed', async () => {
    mockGetQuotaStatus.mockResolvedValue(freeQuota);
    mockListPlans.mockResolvedValue({ plans: [] });
    mockGeneratePlan.mockRejectedValue(new Error('connection failed'));

    const tree = await renderScreen(<HomeScreen />);
    const createPlanControls = controls(tree, 'Create plan');
    expect(createPlanControls).toHaveLength(1);
    if (createPlanControls.length !== 1) return;

    act(() => {
      (createPlanControls[0].props.onPress as () => void)();
    });
    await settleUpdates();

    const errorMessage = 'Something went wrong. Try again.';
    expect(flatten(tree.root)).toContain(errorMessage);
    const errorNodes = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' && flatten(node.props.children) === errorMessage
    );
    expect(errorNodes).toHaveLength(1);
    if (errorNodes.length !== 1) return;
    expect(errorNodes[0].props.accessibilityRole).toBe('alert');
    expect(errorNodes[0].props.accessibilityLiveRegion).toBe('assertive');
  });

  it('shows editable Notes without an upgrade teaser for a paid runner with a persisted plan', async () => {
    mockGetQuotaStatus.mockResolvedValue({ ...freeQuota, tier: 'pro', limit: 5 });
    mockListPlans.mockResolvedValue({
      plans: [{ ...generatedPlan, tierAtGeneration: 'pro' }],
    });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);
    const notesFields = labels(tree, 'Notes');

    expect(notesFields).toHaveLength(1);
    if (notesFields.length !== 1) return;
    expect(notesFields[0].props.editable).toBe(true);
    expect(renderedText).toContain('NOTES (OPTIONAL)');
    expect(renderedText).not.toContain('ON PRO & ELITE');
    expect(labels(tree, 'Notes — locked. Available on Pro and Elite.')).toHaveLength(0);
    expect(
      labels(tree, "Pace targets, HR zones and coach's notes — locked. Available on Pro and Elite.")
    ).toHaveLength(0);
  });

  it('reveals the free-tier subscription disclosures after a refocus finds the first persisted plan', async () => {
    mockGetQuotaStatus.mockResolvedValue(freeQuota);
    mockListPlans
      .mockResolvedValueOnce({ plans: [] })
      .mockResolvedValueOnce({ plans: [generatedPlan] });

    const tree = await renderScreen(<HomeScreen />);

    expect(labels(tree, 'Notes — locked. Available on Pro and Elite.')).toHaveLength(0);
    expect(
      labels(tree, "Pace targets, HR zones and coach's notes — locked. Available on Pro and Elite.")
    ).toHaveLength(0);

    await refocus();

    expect(labels(tree, 'Notes — locked. Available on Pro and Elite.')).toHaveLength(1);
    expect(
      labels(tree, "Pace targets, HR zones and coach's notes — locked. Available on Pro and Elite.")
    ).toHaveLength(1);
    expect(labels(tree, 'Notes')).toHaveLength(1);
    expect(labels(tree, 'Notes')[0].props.editable).toBe(false);
    expect(flatten(tree.root)).toContain('ON PRO & ELITE');
  });
});

/**
 * Copy-vs-behaviour (issue #25). The frontend audit of 2026-07-11 caught Home telling a tester
 * "Intake, generation, and plan view land in later build phases" directly above a working
 * plan-view link. Both the sentence and that link left this screen when it was wired to the real
 * backend (#62), so the fix is already in; these cases exist so the claim cannot come back — in
 * either branch of the screen — and so every pressable Home renders keeps announcing a role.
 */
describe('Home copy matches what the app does (issue #25)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGetIntake.mockReset();
    mockGetQuotaStatus.mockReset().mockResolvedValue(freeQuota);
    mockListPlans.mockReset().mockResolvedValue({ plans: [generatedPlan] });
    mockGeneratePlan.mockReset();
    mockFocusedEffect = undefined;
    mockFocusCleanup = undefined;
  });

  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });
  });

  const placeholderClaims = [/later build phase/i, /build phases/i, /\(demo\)/i, /not yet available/i];

  it('never claims a capability is missing before intake', async () => {
    mockGetIntake.mockResolvedValue({ intake: null });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(renderedText).toContain("Let's find your starting line.");
    for (const claim of placeholderClaims) expect(renderedText).not.toMatch(claim);
  });

  it('never claims a capability is missing once intake and a plan exist', async () => {
    mockGetIntake.mockResolvedValue({ intake });

    const tree = await renderScreen(<HomeScreen />);
    const renderedText = flatten(tree.root);

    expect(renderedText).toContain('YOUR TARGET');
    expect(renderedText).toContain('My Plans →');
    for (const claim of placeholderClaims) expect(renderedText).not.toMatch(claim);
  });

  it('gives every pressable on Home a role a screen reader can announce', async () => {
    mockGetIntake.mockResolvedValue({ intake });

    const tree = await renderScreen(<HomeScreen />);
    const pressables = tree.root.findAll(
      (node) =>
        typeof node.type === 'function' &&
        node.type.name === 'Pressable' &&
        typeof node.props.onPress === 'function'
    );

    // The one CTA, the Change link, the My Plans row, the tier row, and the two locked panels'
    // unlock controls — none of them may be a bare, role-less Pressable.
    expect(pressables.length).toBeGreaterThanOrEqual(4);
    for (const pressable of pressables) {
      expect(['button', 'link']).toContain(pressable.props.accessibilityRole);
    }
    expect(labels(tree, 'Go to My Plans')).toHaveLength(1);
    expect(labels(tree, 'Go to My Plans')[0].props.accessibilityRole).toBe('link');
  });
});
