import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import IntakeScreen from '../intake';

/**
 * A rendered-screen exception on `CLAUDE.md`'s stated grounds: the captain's 2026-09-19 ruling
 * (13–17 requires a parent/guardian's consent before the intake can save) lives entirely in this
 * screen's own render branch and its own save-time gate, with no logic layer underneath to test
 * instead. Mirrors `src/app/(auth)/__tests__/onboarding.test.tsx`'s rendered-screen setup.
 */

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useNavigation: () => ({ addListener: () => () => undefined }),
}));

const mockPutIntake = jest.fn().mockResolvedValue({ saved: true });
const mockGeneratePlan = jest.fn().mockResolvedValue({ planId: 'plan-1' });
const mockOpenPrivacyPolicy = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/openPrivacyPolicy', () => ({
  openPrivacyPolicy: () => mockOpenPrivacyPolicy(),
}));

// An existing saved intake, so this is a re-entry and the screen renders the form directly
// rather than the first-time survey intro (which otherwise replaces the whole screen until its
// own "PRESS TO CONTINUE" is tapped). Since 2026-09-20 the answers are NOT prefilled from it —
// the form starts blank — so each case fills the required fields itself (`fillRequired`).
jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'http://localhost:8787',
  ApiError: class MockApiError extends Error {},
  describeError: (_error: unknown, fallback: string) => fallback,
  getIntake: jest.fn().mockResolvedValue({
    intake: {
      goal: 'Finish my first 10K',
      age: 34,
      experience: 'some',
      daysPerWeek: 3,
      weeklyKm: 20,
      raceDistance: '10k',
      injuries: ['none'],
    },
  }),
  putIntake: (...args: unknown[]) => mockPutIntake(...args),
  generatePlan: (...args: unknown[]) => mockGeneratePlan(...args),
}));

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

/** Every string the tree would speak or show, in order. */
function textNodes(tree: ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      walk((node as { children?: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out;
}

/** Depth-first search for the first node whose props match `predicate`. */
function findNode(
  node: unknown,
  predicate: (props: Record<string, unknown>) => boolean
): { props: Record<string, unknown> } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  const props = candidate.props ?? {};
  if (predicate(props)) return candidate as { props: Record<string, unknown> };
  for (const child of candidate.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function findByAccessibilityLabel(tree: ReactTestRenderer, label: string) {
  return findNode(tree.toJSON(), (props) => props.accessibilityLabel === label);
}

function findCheckbox(tree: ReactTestRenderer) {
  return findNode(
    tree.toJSON(),
    (props) => props.accessibilityRole === 'checkbox'
  );
}

async function setAge(tree: ReactTestRenderer, age: string) {
  const ageField = findByAccessibilityLabel(tree, 'Age');
  await act(async () => {
    (ageField?.props.onChangeText as (text: string) => void)(age);
  });
}

/** The visible text under a node, joined. */
function nodeText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (node && typeof node === 'object') return nodeText((node as { children?: unknown }).children);
  return '';
}

type JsonNode = { props?: Record<string, unknown>; children?: unknown[] };

/** Depth-first search for the first node (props *and* children visible) matching `predicate`. */
function findElement(node: unknown, predicate: (node: JsonNode) => boolean): JsonNode | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const candidate = node as JsonNode;
  if (predicate(candidate)) return candidate;
  for (const child of candidate.children ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return undefined;
}

/** Taps the option row or chip whose visible label is exactly `label`. */
async function pressOption(tree: ReactTestRenderer, label: string) {
  const option = findElement(
    tree.toJSON(),
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      typeof node.props?.onClick === 'function' &&
      node.props?.accessibilityLabel === undefined &&
      nodeText(node.children) === label
  );
  expect(option).toBeDefined();
  await act(async () => {
    (option?.props?.onClick as () => void)();
  });
}

/** Every required answer except age, which each case sets itself. Includes the target race
 * distance, required since the captain's 2026-09-20 ruling. */
async function fillRequired(tree: ReactTestRenderer) {
  const goalField = findByAccessibilityLabel(tree, 'Goal');
  await act(async () => {
    (goalField?.props.onChangeText as (text: string) => void)('Finish my first 10K');
  });
  await pressOption(tree, 'Some running experience');
  await pressOption(tree, '3');
  const weeklyKmField = findByAccessibilityLabel(tree, 'Weekly distance in kilometres');
  await act(async () => {
    (weeklyKmField?.props.onChangeText as (text: string) => void)('20');
  });
  await pressOption(tree, '10K');
}

/** Waits for the mocked `getIntake()` to resolve and the loaded fields to hydrate. */
async function renderLoaded(): Promise<ReactTestRenderer> {
  const tree = render();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
}

describe('IntakeScreen guardian consent (captain\'s 2026-09-19 ruling)', () => {
  beforeEach(() => {
    mockPutIntake.mockClear();
    mockGeneratePlan.mockClear();
    mockOpenPrivacyPolicy.mockReset().mockResolvedValue(null);
  });

  it('does not render a consent checkbox for an adult age', async () => {
    const tree = await renderLoaded();
    await setAge(tree, '34');

    expect(findCheckbox(tree)).toBeUndefined();
    expect(textNodes(tree).join(' ')).not.toContain('parent or guardian');
  });

  it('renders and requires the checkbox for age 15, blocking save until checked', async () => {
    const tree = await renderLoaded();
    await fillRequired(tree);
    await setAge(tree, '15');

    const checkbox = findCheckbox(tree);
    expect(checkbox).toBeDefined();
    expect(checkbox?.props.accessibilityState).toEqual({ checked: false });

    const createButton = findByAccessibilityLabel(tree, 'Create plan');
    await act(async () => {
      (createButton?.props.onClick as () => void)();
    });

    expect(mockPutIntake).not.toHaveBeenCalled();
    expect(mockGeneratePlan).not.toHaveBeenCalled();
    expect(textNodes(tree).join(' ')).toContain(
      'A parent or guardian must confirm consent before saving.'
    );
  });

  it('calls putIntake with guardianConsent: true once the checkbox is checked', async () => {
    const tree = await renderLoaded();
    await fillRequired(tree);
    await setAge(tree, '15');

    const checkbox = findCheckbox(tree);
    await act(async () => {
      (checkbox?.props.onClick as () => void)();
    });

    const checkedBox = findCheckbox(tree);
    expect(checkedBox?.props.accessibilityState).toEqual({ checked: true });

    const createButton = findByAccessibilityLabel(tree, 'Create plan');
    await act(async () => {
      (createButton?.props.onClick as () => void)();
    });

    expect(mockPutIntake).toHaveBeenCalledTimes(1);
    expect(mockPutIntake.mock.calls[0][0]).toMatchObject({ guardianConsent: true, age: 15 });
  });

  it('opens the policy from the consent row and shows the failure instead of swallowing it', async () => {
    const tree = await renderLoaded();
    await setAge(tree, '15');

    const link = findNode(
      tree.toJSON(),
      (props) => props.accessibilityRole === 'link' && typeof props.onPress === 'function'
    );
    expect(link).toBeDefined();

    await act(async () => {
      await (link?.props.onPress as () => Promise<void>)();
    });
    expect(mockOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(textNodes(tree).join(' ')).not.toContain('Could not open the privacy policy');

    const failure = 'Could not open the privacy policy. Check your connection and try again.';
    mockOpenPrivacyPolicy.mockResolvedValue(failure);
    const linkAgain = findNode(
      tree.toJSON(),
      (props) => props.accessibilityRole === 'link' && typeof props.onPress === 'function'
    );
    await act(async () => {
      await (linkAgain?.props.onPress as () => Promise<void>)();
    });

    const alert = findNode(tree.toJSON(), (props) => props.accessibilityRole === 'alert');
    expect(alert?.props.accessibilityLiveRegion).toBe('assertive');
    expect(textNodes(tree).join(' ')).toContain(failure);
  });
});
