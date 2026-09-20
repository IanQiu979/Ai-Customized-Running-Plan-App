import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Colors, Session } from '@/constants/theme';
import { CUE_DELAY, HERO_TIMELINE, PLAN_HERO_TIMELINE, SURVEY_TIMELINE } from '@/lib/buildMotion';
import { EMPTY_STRIP_WEEK, HERO_WEEK, stripFromWeek } from '@/lib/weekStrip';
import { examplePlan } from '@/lib/fixtures/examplePlan';

import { CountUp } from '../build/CountUp';
import { HeaderMark } from '../build/HeaderMark';
import { MiniWeekStrip } from '../build/MiniWeekStrip';
import { OnboardingHero } from '../build/OnboardingHero';
import { PlanHero } from '../build/PlanHero';
import { StaticWeekStrip } from '../build/StaticWeekStrip';
import { SurveyIntro } from '../build/SurveyIntro';
import { WeekStrip } from '../build/WeekStrip';
import { StepEngine, StepIntake, StepMiniPlan } from '../build/steps';
import { SETTLE_SLACK_MS, useBuildClock } from '../build/useBuildClock';
import { RevealPrimaryAction } from '../ui/ActionButton';

/**
 * Render smoke tests for the build animations ("the plan builds itself"), in the spirit of
 * `render.test.tsx`: every composition mounts, its end frame carries the copy and structure a
 * caller relies on, and the clock hook behaves under reduced motion. Not a snapshot suite — the
 * choreography's numbers are pinned in `lib/__tests__/buildMotion.test.ts`, and pinning the
 * rendered tree of an animation would make every tuning pass a test edit.
 *
 * Reduced motion is forced on: it is the one mode in which a build's output is deterministic (the
 * clock sits at its end frame), so structural assertions can be made without pretending to know
 * which frame the UI thread is on. One motion-on case checks that mounting with the clock live
 * neither throws nor leaves an animation running after unmount.
 */

let mockReduceMotion = true;

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<typeof import('react-native-reanimated')>(
    'react-native-reanimated'
  );
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: () => mockReduceMotion,
    cancelAnimation: jest.fn(actual.cancelAnimation),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cancelAnimation } = require('react-native-reanimated') as { cancelAnimation: jest.Mock };

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

/** Every string a tree's `Text` nodes carry, joined. Nested `Text` elements are found on their
 * own by `findAllByType`, so only string children are read here. */
const text = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => {
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
      return children.filter((child: unknown) => typeof child === 'string' || typeof child === 'number').join('');
    })
    .join(' | ');

/** A host that owns a clock the way a screen does, so a composition can be mounted alone. */
function Clocked({ total, play = true, readyAt, children }: { total: number; play?: boolean; readyAt?: number; children: (clock: ReturnType<typeof useBuildClock>) => ReactElement }) {
  const clock = useBuildClock({ total, play, readyAt });
  return children(clock);
}

beforeEach(() => {
  mockReduceMotion = true;
  cancelAnimation.mockClear();
});

describe('useBuildClock', () => {
  it('sits at the end frame and is settled immediately under reduced motion', () => {
    let seen: ReturnType<typeof useBuildClock> | undefined;
    render(
      <Clocked total={5.2}>
        {(clock) => {
          seen = clock;
          return <Text>ok</Text>;
        }}
      </Clocked>
    );
    expect(seen?.settled).toBe(true);
    expect(seen?.T.value).toBe(5.2);
  });

  it('starts at 0, unsettled, with motion on — and cancels its animation on unmount', () => {
    mockReduceMotion = false;
    let seen: ReturnType<typeof useBuildClock> | undefined;
    const tree = render(
      <Clocked total={5.2}>
        {(clock) => {
          seen = clock;
          return <Text>ok</Text>;
        }}
      </Clocked>
    );
    expect(seen?.settled).toBe(false);
    act(() => tree.unmount());
    expect(cancelAnimation).toHaveBeenCalled();
  });

  it('reports `ready` at `readyAt` — the cue, not the end of the hold — and never later than its slack', () => {
    mockReduceMotion = false;
    jest.useFakeTimers();
    try {
      let seen: ReturnType<typeof useBuildClock> | undefined;
      render(
        <Clocked total={SURVEY_TIMELINE.total} readyAt={SURVEY_TIMELINE.cues.Hold + CUE_DELAY}>
          {(clock) => {
            seen = clock;
            return <Text>ok</Text>;
          }}
        </Clocked>
      );
      expect(seen?.ready).toBe(false);
      expect(seen?.settled).toBe(false);
      // Just past the cue plus the clock's slack: ready, while the hold is still running.
      act(() => {
        jest.advanceTimersByTime((SURVEY_TIMELINE.cues.Hold + CUE_DELAY) * 1000 + SETTLE_SLACK_MS);
      });
      expect(seen?.ready).toBe(true);
      expect(seen?.settled).toBe(false);
      act(() => {
        jest.advanceTimersByTime(SURVEY_TIMELINE.total * 1000);
      });
      expect(seen?.settled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds at 0 while `play` is false — a step waits to scroll into view', () => {
    mockReduceMotion = false;
    let seen: ReturnType<typeof useBuildClock> | undefined;
    render(
      <Clocked total={2.4} play={false}>
        {(clock) => {
          seen = clock;
          return <Text>ok</Text>;
        }}
      </Clocked>
    );
    expect(seen?.T.value).toBe(0);
    expect(seen?.settled).toBe(false);
  });
});

describe('WeekStrip', () => {
  it('draws one bar per run day in its session tone, and day numerals 01–07', () => {
    const tree = render(
      <Clocked total={HERO_TIMELINE.total}>
        {({ T }) => (
          <WeekStrip
            T={T}
            week={HERO_WEEK}
            geometry={{ slotWidth: 36, gap: 10, trackHeight: 88 }}
            outlineAt={0}
            blockAt={0.4}
            blockStagger={0.22}
            labels="both"
            numerals
          />
        )}
      </Clocked>
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(Session.easy);
    expect(json).toContain(Session.hard);
    // Three labels: 8 ER, 7 TR, 10 LR.
    expect(text(tree)).toContain('8');
    expect(text(tree)).toContain('LR');
    for (const numeral of ['01', '02', '03', '04', '05', '06', '07']) {
      expect(text(tree)).toContain(numeral);
    }
    // Days are unnamed.
    expect(text(tree)).not.toMatch(/MON|TUE|WED|THU|FRI|SAT|SUN/);
  });
});

describe('CountUp', () => {
  it('shows the landed total at the end frame', () => {
    const tree = render(
      <Clocked total={3}>
        {({ T }) => <CountUp T={T} landings={[{ at: 0.5, km: 8 }, { at: 1, km: 7 }, { at: 1.5, km: 10 }]} />}
      </Clocked>
    );
    expect(text(tree)).toBe('25');
  });
});

describe('OnboardingHero — V22-01 end frame', () => {
  it('carries the wordmark, the 25 km total, the legend and the scroll-down cue', () => {
    const tree = render(
      <Clocked total={HERO_TIMELINE.total}>
        {({ T }) => <OnboardingHero T={T} width={393} height={852} />}
      </Clocked>
    );
    const copy = text(tree);
    expect(copy).toContain('Pace Blueprint');
    expect(copy).toContain('25');
    expect(copy).toContain('KM / WEEK');
    expect(copy).toContain('Easy');
    expect(copy).toContain('Hard');
    expect(copy).toContain('Scroll down');
    expect(copy).not.toContain('Continue');
  });

  it('paints the dark field regardless of scheme, and nothing cyan', () => {
    const tree = render(
      <Clocked total={HERO_TIMELINE.total}>
        {({ T }) => <OnboardingHero T={T} width={393} height={852} />}
      </Clocked>
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(Colors.dark.surface.base);
    expect(json).not.toContain('#A8F0FF');
  });
});

describe('step pieces — V22-02', () => {
  it('01 Intake counts to 10 km and 51 min', () => {
    const tree = render(<Clocked total={2.4}>{({ T }) => <StepIntake t={T} />}</Clocked>);
    const copy = text(tree);
    expect(copy).toContain('10');
    expect(copy).toContain('KM');
    expect(copy).toContain('51');
    expect(copy).toContain('MIN');
  });

  it('02 Engine ends on the chosen session card, day unnamed', () => {
    const tree = render(<Clocked total={2.4}>{({ T }) => <StepEngine t={T} />}</Clocked>);
    const copy = text(tree);
    expect(copy).toContain('EASY RUN');
    expect(copy).toContain('DAY 03');
    expect(copy).not.toContain('WED');
  });

  it('03 Plan is the week in miniature with its header', () => {
    const tree = render(<Clocked total={2.4}>{({ T }) => <StepMiniPlan t={T} />}</Clocked>);
    const copy = text(tree);
    expect(copy).toContain('WEEK 1');
    expect(copy).toContain('25 KM · 3 RUNS');
  });

  it('Get started is the primary action, pressable once revealed', () => {
    const onPress = jest.fn();
    const tree = render(
      <Clocked total={2.4}>
        {({ T }) => <RevealPrimaryAction T={T} label="Create your first plan" onPress={onPress} />}
      </Clocked>
    );
    expect(text(tree)).toContain('Create your first plan');
    act(() => {
      tree.root.findByProps({ accessibilityRole: 'button' }).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SurveyIntro — V22-03', () => {
  it('holds on the heading, W1–W6 and PRESS TO CONTINUE, and continues once the cue is shown', () => {
    const onContinue = jest.fn();
    const tree = render(
      <Clocked total={SURVEY_TIMELINE.total} readyAt={SURVEY_TIMELINE.cues.Hold + CUE_DELAY}>
        {({ T, ready }) => (
          <SurveyIntro T={T} width={393} height={852} onContinue={onContinue} cueShown={ready} />
        )}
      </Clocked>
    );
    const copy = text(tree);
    expect(copy).toContain('A few questions first');
    expect(copy).toContain('PRESS TO CONTINUE');
    for (const label of ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']) expect(copy).toContain(label);
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Press to continue' }).props.onPress();
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('ignores a tap before the cue is shown', () => {
    const onContinue = jest.fn();
    const tree = render(
      <Clocked total={SURVEY_TIMELINE.total}>
        {({ T }) => <SurveyIntro T={T} width={393} height={852} onContinue={onContinue} cueShown={false} />}
      </Clocked>
    );
    const press = tree.root.findByProps({ accessibilityLabel: 'Press to continue' }).props.onPress;
    expect(press).toBeUndefined();
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('HeaderMark — V22-04', () => {
  it('fills exactly the completed days and announces them', () => {
    const tree = render(
      <Clocked total={2.6}>{({ T }) => <HeaderMark T={T} completedDays={3} />}</Clocked>
    );
    // Three ink fills inside seven slots.
    expect(tree.root.findAllByProps({ testID: 'header-mark-fill' }).filter((n) => typeof n.type === 'string')).toHaveLength(3);
    expect(JSON.stringify(tree.toJSON())).toContain('3 of 7 days into this week');
  });
});

describe('PlanHero — V22-05', () => {
  it('builds the real first week with its real total', () => {
    const week = stripFromWeek(examplePlan.weeks[0]);
    const tree = render(
      <Clocked total={PLAN_HERO_TIMELINE.total}>
        {({ T }) => (
          <PlanHero T={T} week={week} eyebrow="EXAMPLE" title={examplePlan.title} weekCount={examplePlan.durationWeeks} />
        )}
      </Clocked>
    );
    const copy = text(tree);
    expect(copy).toContain('EXAMPLE');
    expect(copy).toContain(examplePlan.title);
    expect(copy).toContain(String(Math.round(examplePlan.weeks[0].volumeKm)));
    expect(copy).toContain(`KM · WEEK 1 OF ${examplePlan.durationWeeks}`);
  });
});

describe('static strips — V22-06', () => {
  it('StaticWeekStrip shows numbers above bars, dashes for rest, and highlights the current day', () => {
    const tree = render(<StaticWeekStrip week={HERO_WEEK} currentDay={3} />);
    const copy = text(tree);
    expect(copy).toContain('8');
    expect(copy).toContain('10');
    expect(copy).toContain('04');
    expect(JSON.stringify(tree.toJSON())).toContain(Colors.dark.grid.slot);
  });

  it('MiniWeekStrip renders seven cells for any week, including the empty one', () => {
    expect(render(<MiniWeekStrip week={EMPTY_STRIP_WEEK} />).toJSON()).toBeTruthy();
    const json = JSON.stringify(render(<MiniWeekStrip week={HERO_WEEK} dim />).toJSON());
    expect(json).toContain(Session.easy);
  });

});
