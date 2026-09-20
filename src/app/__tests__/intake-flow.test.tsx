import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/apiErrors';

import IntakeScreen from '../intake';

/**
 * A rendered-screen exception on `CLAUDE.md`'s stated grounds: the captain's 2026-09-20 rulings
 * on the intake flow — mandatory and unskippable on first entry, blank on every re-entry, the
 * target race required, one bottom "Create plan" that saves and then generates — all live in this
 * screen's own render branches and its own submit handler, with no logic layer underneath to
 * test instead. `intake-guardian-consent.test.tsx` covers the 13–17 gate on the same screen.
 */

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRouter = { replace: mockReplace, push: mockPush, back: mockBack, canGoBack: () => true };
const mockAddListener = jest.fn();
const mockRemoveListener = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useNavigation: () => ({
    addListener: (...args: unknown[]) => {
      mockAddListener(...args);
      return mockRemoveListener;
    },
  }),
}));

// The first-time survey intro is a reanimated build; it is not what is under test here, so it is
// reduced to its one interaction — the continue press — to reach the questions underneath.
jest.mock('@/components/build/SurveyIntro', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SurveyIntro: ({ onContinue }: { onContinue: () => void }) => (
      <RN.Pressable accessibilityRole="button" accessibilityLabel="Press to continue" onPress={onContinue} />
    ),
  };
});

const mockGetIntake = jest.fn();
const mockPutIntake = jest.fn();
const mockGeneratePlan = jest.fn();
const callOrder: string[] = [];

jest.mock('@/lib/apiClient', () => {
  const errors = jest.requireActual<typeof import('@/lib/apiErrors')>('@/lib/apiErrors');
  return {
    API_BASE_URL: 'http://localhost:8787',
    ApiError: errors.ApiError,
    describeError: errors.describeError,
    getIntake: () => mockGetIntake(),
    putIntake: (...args: unknown[]) => {
      callOrder.push('putIntake');
      return mockPutIntake(...args);
    },
    generatePlan: (...args: unknown[]) => {
      callOrder.push('generatePlan');
      return mockGeneratePlan(...args);
    },
  };
});

jest.mock('@/lib/openPrivacyPolicy', () => ({ openPrivacyPolicy: async () => null }));

const savedIntake = {
  goal: 'Finish my first 10K',
  age: 34,
  experience: 'some',
  daysPerWeek: 3,
  weeklyKm: 20,
  raceDistance: '10k',
  raceDate: '2027-03-01',
  goalTimeSec: 3000,
  recentPerformance: { distance: '5k', timeSec: 1500 },
  injuries: ['knee'],
  injuryNotes: 'left knee',
};

type JsonNode = { type?: string; props?: Record<string, unknown>; children?: unknown[] };

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <IntakeScreen />
      </SafeAreaProvider>
    );
  });
  return tree;
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderLoaded(): Promise<ReactTestRenderer> {
  const tree = render();
  await settle();
  return tree;
}

function nodeText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (node && typeof node === 'object') return nodeText((node as JsonNode).children);
  return '';
}

function findAll(node: unknown, predicate: (node: JsonNode) => boolean, out: JsonNode[] = []): JsonNode[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  const candidate = node as JsonNode;
  if (predicate(candidate)) out.push(candidate);
  candidate.children?.forEach((child) => findAll(child, predicate, out));
  return out;
}

function byLabel(tree: ReactTestRenderer, label: string): JsonNode | undefined {
  return findAll(tree.toJSON(), (node) => node.props?.accessibilityLabel === label)[0];
}

function screenText(tree: ReactTestRenderer): string {
  return nodeText(tree.toJSON());
}

async function type(tree: ReactTestRenderer, label: string, text: string) {
  const field = byLabel(tree, label);
  expect(field).toBeDefined();
  await act(async () => {
    (field?.props?.onChangeText as (next: string) => void)(text);
  });
}

/** Taps the `nth` option row or chip whose visible label is exactly `label`. */
async function pressOption(tree: ReactTestRenderer, label: string, nth = 0) {
  const options = findAll(
    tree.toJSON(),
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      typeof node.props?.onClick === 'function' &&
      node.props?.accessibilityLabel === undefined &&
      nodeText(node.children) === label
  );
  expect(options.length).toBeGreaterThan(nth);
  await act(async () => {
    (options[nth]?.props?.onClick as () => void)();
  });
}

async function press(tree: ReactTestRenderer, label: string) {
  const control = byLabel(tree, label);
  expect(control).toBeDefined();
  await act(async () => {
    (control?.props?.onClick as () => void)();
  });
  await settle();
}

/** Every required answer except the target race distance, which each case decides for itself. */
async function fillRequiredExceptRace(tree: ReactTestRenderer) {
  await type(tree, 'Goal', 'Run a strong 10K');
  await type(tree, 'Age', '34');
  await pressOption(tree, 'Regular runner');
  await pressOption(tree, '4');
  await type(tree, 'Weekly distance in kilometres', '35');
}

/** The segmented date boxes: each box is labelled `${groupLabel} ${segment}` by `SegmentedField`. */
async function typeParts(tree: ReactTestRenderer, groupLabel: string, parts: Record<string, string>) {
  for (const [segment, value] of Object.entries(parts)) {
    await type(tree, `${groupLabel} ${segment}`, value);
  }
}

function selectedChips(tree: ReactTestRenderer): string[] {
  return findAll(
    tree.toJSON(),
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      (node.props?.accessibilityState as { selected?: boolean } | undefined)?.selected === true
  ).map((node) => nodeText(node.children));
}

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockBack.mockClear();
  mockAddListener.mockClear();
  mockRemoveListener.mockClear();
  callOrder.splice(0);
  mockGetIntake.mockReset().mockResolvedValue({ intake: savedIntake });
  mockPutIntake.mockReset().mockResolvedValue({ saved: true });
  mockGeneratePlan.mockReset().mockResolvedValue({
    planId: 'plan-new',
    plan: {},
    isFallback: false,
    quotaConsumed: true,
  });
});

describe('re-entry starts blank (ruling 4)', () => {
  it('never prefills from the stored intake, whatever it holds', async () => {
    const tree = await renderLoaded();

    expect(mockGetIntake).toHaveBeenCalledTimes(1);
    expect(byLabel(tree, 'Goal')?.props?.value).toBe('');
    expect(byLabel(tree, 'Age')?.props?.value).toBe('');
    expect(byLabel(tree, 'Weekly distance in kilometres')?.props?.value).toBe('');
    expect(byLabel(tree, 'Injury notes')?.props?.value).toBe('');
    // Only the injury "None" default is selected — no experience, no days, no target, no recent
    // distance carried over.
    expect(selectedChips(tree)).toEqual(['None']);
    expect(screenText(tree)).not.toContain('Finish my first 10K');
    expect(screenText(tree)).not.toContain('left knee');
    // The plan length shows, at its default, because no race date is entered.
    expect(byLabel(tree, 'Plan length in weeks')?.props?.value).toBe('12');
  });

  it('offers a Cancel back to Home, and does not lock the screen', async () => {
    const tree = await renderLoaded();

    await press(tree, 'Cancel');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockAddListener).not.toHaveBeenCalled();
  });
});

describe('first entry cannot be skipped (ruling 1)', () => {
  beforeEach(() => {
    mockGetIntake.mockResolvedValue({ intake: null });
  });

  it('plays the survey intro, then shows the questions with no Cancel and a refused removal', async () => {
    const tree = await renderLoaded();

    expect(byLabel(tree, 'Press to continue')).toBeDefined();
    expect(byLabel(tree, 'Cancel')).toBeUndefined();
    await press(tree, 'Press to continue');

    expect(byLabel(tree, 'Create plan')).toBeDefined();
    expect(byLabel(tree, 'Cancel')).toBeUndefined();
    expect(screenText(tree)).not.toContain('Skip');

    expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function));
    const handler = mockAddListener.mock.calls[0][1] as (event: { preventDefault: () => void }) => void;
    const preventDefault = jest.fn();
    handler({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('lets its own replace to the new plan through once the plan exists', async () => {
    const tree = await renderLoaded();
    await press(tree, 'Press to continue');
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '5K');

    await press(tree, 'Create plan');

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[id]', params: { id: 'plan-new' } });
    const handler = mockAddListener.mock.calls[0][1] as (event: { preventDefault: () => void }) => void;
    const preventDefault = jest.fn();
    handler({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('the target race is required; its date and the goal time are not (ruling 5)', () => {
  it('blocks Create plan with the field error when no distance is chosen, and sends nothing', async () => {
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);

    await press(tree, 'Create plan');

    expect(mockPutIntake).not.toHaveBeenCalled();
    expect(mockGeneratePlan).not.toHaveBeenCalled();
    const text = screenText(tree);
    expect(text).toContain('Choose your target race distance.');
    expect(text).toContain('TARGET RACE');
    expect(text).not.toContain('TARGET RACE (OPTIONAL)');
    expect(text).toContain('RACE DATE (OPTIONAL)');
    expect(text).toContain('GOAL TIME (OPTIONAL)');
  });

  it('proceeds with a distance alone — no date, no goal time — as a duration plan', async () => {
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, 'Half Marathon');

    await press(tree, 'Create plan');

    expect(mockPutIntake).toHaveBeenCalledTimes(1);
    const payload = mockPutIntake.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ raceDistance: 'half', age: 34, daysPerWeek: 4, weeklyKm: 35 });
    expect(payload.raceDate).toBeUndefined();
    expect(payload.goalTimeSec).toBeUndefined();
    expect(mockGeneratePlan).toHaveBeenCalledWith(
      expect.objectContaining({ goalType: 'duration', durationWeeks: 12, raceDistance: 'half' })
    );
  });

  it('hides the plan length once a race date is entered and sends a race request', async () => {
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '10K');
    await typeParts(tree, 'Race date', { year: '2027', month: '03', day: '01' });

    expect(byLabel(tree, 'Plan length in weeks')).toBeUndefined();
    await press(tree, 'Create plan');

    expect(mockPutIntake.mock.calls[0][0]).toMatchObject({ raceDistance: '10k', raceDate: '2027-03-01' });
    expect(mockGeneratePlan).toHaveBeenCalledWith(
      expect.objectContaining({ goalType: 'race', raceDistance: '10k', raceDate: '2027-03-01' })
    );
    expect(mockGeneratePlan.mock.calls[0][0].durationWeeks).toBeUndefined();
  });
});

describe('the bottom Create plan saves, then generates, then opens the plan (ruling 3)', () => {
  it('runs putIntake before generatePlan and replaces itself with the new plan', async () => {
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '5K');

    await press(tree, 'Create plan');

    expect(callOrder).toEqual(['putIntake', 'generatePlan']);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[id]', params: { id: 'plan-new' } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sends the Free runner who has spent their one plan to the paywall with the quota, unchanged from Home', async () => {
    const quota = { tier: 'free' as const, used: 1, limit: 1, periodEnd: null };
    mockGeneratePlan.mockRejectedValue(
      new ApiError(402, { error: 'You have used every plan in this period.', code: 'over_quota', quota })
    );
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '5K');

    await press(tree, 'Create plan');

    expect(callOrder).toEqual(['putIntake', 'generatePlan']);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { quota: JSON.stringify(quota) },
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a generation refusal as an assertive alert and stays on the form', async () => {
    mockGeneratePlan.mockRejectedValue(
      new ApiError(400, { error: 'durationWeeks must be 104 or fewer.', code: 'invalid_request' })
    );
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '5K');

    await press(tree, 'Create plan');

    const alert = findAll(tree.toJSON(), (node) => node.props?.accessibilityRole === 'alert')[0];
    expect(alert?.props?.accessibilityLiveRegion).toBe('assertive');
    expect(nodeText(alert?.children)).toBe('durationWeeks must be 104 or fewer.');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(byLabel(tree, 'Create plan')).toBeDefined();
  });

  it('does not generate when the save itself is refused', async () => {
    mockPutIntake.mockRejectedValue(
      new ApiError(400, { error: 'goal is required and must be 500 characters or fewer.', code: 'invalid_request' })
    );
    const tree = await renderLoaded();
    await fillRequiredExceptRace(tree);
    await pressOption(tree, '5K');

    await press(tree, 'Create plan');

    expect(callOrder).toEqual(['putIntake']);
    expect(screenText(tree)).toContain('goal is required and must be 500 characters or fewer.');
  });
});
