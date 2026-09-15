import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { examplePlan } from '@/lib/fixtures/examplePlan';
import type { Day, Plan, Week, Week7 } from '@/lib/planTypes';

import DayScreen from '../[id]/week/[week]/day/[day]';

/**
 * A rendered-screen exception on `CLAUDE.md`'s stated grounds: the behaviour under test is one
 * conditional render branch in the day screen — `{day.why ? <Section label="WHY" … /> : null}` —
 * with no logic layer beneath it. Issue #24: the per-workout `why` is what Elite pays for, and it
 * went unrendered for two months because no fixture populated the field, so nothing could fail.
 * The permanent example plan is a Pro plan and correctly carries no per-workout `why`; this suite
 * derives an Elite week from it so the branch is exercised on purpose.
 */

const ELITE_WHY: Record<number, string> = {
  0: 'Strides today because the tempo on Day 5 needs turnover that eight easy kilometres alone will not give you.',
  2: 'Second easy day, same size: the aim is repeatable, not bigger.',
  4: 'Twenty minutes at tempo is the smallest dose that moves your threshold; hold the effort, not the clock.',
  5: 'Ten kilometres is the longest you have run in this build — sit in Zone 2 and let the distance do the work.',
};

const PLAN_ID = 'plan_elite_fixture';

let mockParams: { id: string; week: string; day: string } = { id: PLAN_ID, week: '1', day: '1' };
let mockPlan: Plan = examplePlan;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/hooks/use-plan', () => ({
  usePlan: () => ({ loaded: { plan: mockPlan, quotaConsumed: true }, loading: false, error: null }),
}));

/** The example plan's Week 1 as Elite would serve it: every run carries its own `why`. */
function eliteWeekOne(): Week {
  const source = examplePlan.weeks[0];
  const days = source.days.map((day, index): Day =>
    day.kind === 'run' && ELITE_WHY[index] !== undefined ? { ...day, why: ELITE_WHY[index] } : day,
  ) as unknown as Week7<Day>;
  return { ...source, days };
}

function elitePlan(weekOne: Week = eliteWeekOne()): Plan {
  return {
    ...examplePlan,
    tierAtGeneration: 'elite',
    weeks: [weekOne, ...examplePlan.weeks.slice(1)],
  };
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
      </SafeAreaProvider>,
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

function openDay(plan: Plan, day: number): string[] {
  mockPlan = plan;
  mockParams = { id: PLAN_ID, week: '1', day: String(day) };
  return textNodes(render(<DayScreen />));
}

describe('DayScreen renders a workout\'s own why (issue #24)', () => {
  it('shows an Elite workout\'s why under a WHY section', () => {
    const text = openDay(elitePlan(), 1);
    const whyLabel = text.indexOf('WHY');
    expect(whyLabel).toBeGreaterThan(-1);
    expect(text[whyLabel + 1]).toBe(ELITE_WHY[0]);
  });

  it('renders every run day\'s why, each on its own screen', () => {
    for (const [index, why] of Object.entries(ELITE_WHY)) {
      const text = openDay(elitePlan(), Number(index) + 1);
      expect(text).toContain(why);
    }
  });

  it('renders no WHY section at all for a workout without one', () => {
    // The example plan is Pro: identical numbers, no per-workout why (`planTypes.ts`: "Paid tiers
    // only; a template genuinely has none").
    const text = openDay(examplePlan, 1);
    expect(text).not.toContain('WHY');
    expect(text).toContain('STRUCTURE');
    expect(text).toContain('EFFORT');
  });

  it('gives a rest day its own why, never the week\'s', () => {
    const plan = elitePlan();
    const text = openDay(plan, 2);
    const whyLabel = text.indexOf('WHY');
    expect(whyLabel).toBeGreaterThan(-1);
    expect(text[whyLabel + 1]).toBe('Rest day — recovery is training too.');
    expect(text).not.toContain(plan.weeks[0].why);
  });

  it('never shows the week\'s why on a workout screen', () => {
    const plan = elitePlan();
    const text = openDay(plan, 1);
    expect(text).not.toContain(plan.weeks[0].why);
  });
});
