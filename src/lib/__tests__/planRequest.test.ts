import {
  buildGeneratePlanRequest,
  DEFAULT_PLAN_WEEKS,
  describePlanTarget,
  isRaceDatePast,
  MAX_PLAN_WEEKS,
  needsPlanLength,
  planTargetFromIntake,
  RACE_DATE_PASSED_MESSAGE,
} from '../planRequest';
import type { IntakeResponses } from '../planTypes';

const BASE_INTAKE: IntakeResponses = {
  goal: 'Get fitter',
  age: 34,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 35,
  injuries: ['none'],
};

/** Fixed so every race date below is unambiguously in the future or the past. */
const NOW = new Date(2026, 7, 15);

function request(overrides: Partial<Parameters<typeof buildGeneratePlanRequest>[0]> = {}) {
  return buildGeneratePlanRequest({
    target: planTargetFromIntake(BASE_INTAKE),
    planLengthWeeks: String(DEFAULT_PLAN_WEEKS),
    notes: '',
    idempotencyKey: 'key-1',
    now: NOW,
    ...overrides,
  });
}

describe('planTargetFromIntake — intake is the only place a target is asked for', () => {
  // The captain's 2026-08-15 report: "you can take the intake test two times, take the survey two
  // times, only one time is necessary". Home used to ask for goal type, race distance and race
  // date all over again. These tests pin the rule that replaced that: whatever the runner
  // answered in intake IS the target, and Home derives it rather than re-asking.
  it('reads a full race target straight off the saved intake', () => {
    const target = planTargetFromIntake({
      ...BASE_INTAKE,
      raceDistance: 'half',
      raceDate: '2026-09-26',
    });
    expect(target).toEqual({ kind: 'race', raceDistance: 'half', raceDate: '2026-09-26' });
  });

  it('reads a distance with no date as its own kind, not as a missing answer', () => {
    const target = planTargetFromIntake({ ...BASE_INTAKE, raceDistance: 'marathon' });
    expect(target).toEqual({ kind: 'distance', raceDistance: 'marathon' });
  });

  it('never invents a race for a runner who named none', () => {
    // A silently assumed 5K is exactly what PR #75 established must not happen to a stated goal;
    // the same holds for a goal deliberately left blank.
    expect(planTargetFromIntake(BASE_INTAKE)).toEqual({ kind: 'general' });
    expect(planTargetFromIntake(null)).toEqual({ kind: 'general' });
    expect(planTargetFromIntake(undefined)).toEqual({ kind: 'general' });
  });

  it('describes every target in words the runner can check against what they answered', () => {
    expect(describePlanTarget({ kind: 'race', raceDistance: 'half', raceDate: '2026-09-26' })).toBe(
      'Half Marathon on 2026-09-26',
    );
    expect(describePlanTarget({ kind: 'distance', raceDistance: '10k' })).toBe('10K — no date set');
    expect(describePlanTarget({ kind: 'general' })).toBe('General fitness — no target race');
  });
});

describe('needsPlanLength — Home asks for exactly one thing intake cannot know', () => {
  it('does not ask when a race date already fixes the length', () => {
    expect(
      needsPlanLength({ kind: 'race', raceDistance: 'half', raceDate: '2026-09-26' }),
    ).toBe(false);
  });

  it('asks when there is no race date to count back from', () => {
    expect(needsPlanLength({ kind: 'distance', raceDistance: '10k' })).toBe(true);
    expect(needsPlanLength({ kind: 'general' })).toBe(true);
  });
});

describe('buildGeneratePlanRequest — a plan generates with no race specified', () => {
  // The second half of the captain's report: "The race stage should be optional, it's not a
  // mandatory thing you need to input." Home used to refuse with "Select a race distance."
  it('builds a valid duration request from an intake with no race at all', () => {
    const result = request();
    expect(result).toEqual({
      ok: true,
      request: {
        goalType: 'duration',
        durationWeeks: DEFAULT_PLAN_WEEKS,
        idempotencyKey: 'key-1',
      },
    });
  });

  it('never reports a missing race as an error', () => {
    const result = request();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.raceDistance).toBeUndefined();
    expect(result.request.raceDate).toBeUndefined();
  });

  it('builds a race request from intake alone, with no second answer from the runner', () => {
    const result = request({
      target: planTargetFromIntake({
        ...BASE_INTAKE,
        raceDistance: 'half',
        raceDate: '2026-09-26',
      }),
    });
    expect(result).toEqual({
      ok: true,
      request: {
        goalType: 'race',
        raceDistance: 'half',
        raceDate: '2026-09-26',
        idempotencyKey: 'key-1',
      },
    });
  });

  it('carries a dateless target distance through so periodization can still specialise', () => {
    const result = request({
      target: planTargetFromIntake({ ...BASE_INTAKE, raceDistance: 'marathon' }),
      planLengthWeeks: '20',
    });
    expect(result).toEqual({
      ok: true,
      request: {
        goalType: 'duration',
        durationWeeks: 20,
        raceDistance: 'marathon',
        idempotencyKey: 'key-1',
      },
    });
  });

  it('ignores the plan-length field entirely when a race date fixes the length', () => {
    const result = request({
      target: { kind: 'race', raceDistance: '5k', raceDate: '2026-09-26' },
      planLengthWeeks: 'nonsense',
    });
    expect(result.ok).toBe(true);
  });

  it('attaches trimmed notes, and omits them when blank', () => {
    const withNotes = request({ notes: '  shift work  ' });
    expect(withNotes.ok && withNotes.request.notes).toBe('shift work');
    const blank = request({ notes: '   ' });
    expect(blank.ok && 'notes' in blank.request).toBe(false);
  });

  it('rejects a plan length that is not a positive whole number of weeks', () => {
    expect(request({ planLengthWeeks: '' })).toEqual({
      ok: false,
      error: 'Plan length must be a whole number of weeks, 1 or more.',
    });
    expect(request({ planLengthWeeks: '0' }).ok).toBe(false);
  });

  it('rejects a plan length past the server’s own ceiling before sending it', () => {
    expect(request({ planLengthWeeks: String(MAX_PLAN_WEEKS + 1) })).toEqual({
      ok: false,
      error: `Plan length must be ${MAX_PLAN_WEEKS} weeks or fewer.`,
    });
    expect(request({ planLengthWeeks: String(MAX_PLAN_WEEKS) }).ok).toBe(true);
  });
});

describe('a saved race date that has already passed', () => {
  // Home shows the target read-only now, so a runner returning after their race would have sent a
  // stale date verbatim. `weeksUntilRace` floors at one week and the quota slot is reserved before
  // the skeleton is built, so that request charges a generation for a degenerate one-week plan.
  // Refused here, client-side, before anything is sent; the server-side floor is untouched.
  const passed = { kind: 'race', raceDistance: 'half', raceDate: '2026-08-01' } as const;

  it('refuses the request and points at the Change affordance', () => {
    expect(request({ target: passed })).toEqual({ ok: false, error: RACE_DATE_PASSED_MESSAGE });
  });

  it('produces no request at all, so no quota slot can be charged', () => {
    const result = request({ target: passed });
    expect(result.ok).toBe(false);
    expect('request' in result).toBe(false);
  });

  it('leaves a future race date alone', () => {
    const result = request({
      target: { kind: 'race', raceDistance: 'half', raceDate: '2026-09-26' },
    });
    expect(result).toEqual({
      ok: true,
      request: {
        goalType: 'race',
        raceDistance: 'half',
        raceDate: '2026-09-26',
        idempotencyKey: 'key-1',
      },
    });
  });

  it('treats race day itself as still generatable', () => {
    expect(isRaceDatePast('2026-08-15', NOW)).toBe(false);
    expect(request({ target: { kind: 'race', raceDistance: '5k', raceDate: '2026-08-15' } }).ok).toBe(
      true,
    );
  });

  it('compares calendar days, not clock instants', () => {
    expect(isRaceDatePast('2026-08-14', NOW)).toBe(true);
    expect(isRaceDatePast('2026-08-16', NOW)).toBe(false);
    // Year and month boundaries, where a naive string comparison of unpadded parts would slip.
    expect(isRaceDatePast('2025-12-31', new Date(2026, 0, 1))).toBe(true);
    expect(isRaceDatePast('2026-01-02', new Date(2026, 0, 1))).toBe(false);
  });

  it('does not block a dateless distance or a general target', () => {
    expect(request({ target: { kind: 'distance', raceDistance: '10k' } }).ok).toBe(true);
    expect(request({ target: { kind: 'general' } }).ok).toBe(true);
  });
});

describe('the return visit — a saved intake is never re-asked', () => {
  // "Also confirm what happens on a return visit — a user who already has intake saved should not
  // be walked through it again to generate another plan."
  it('produces a complete second request from the same saved intake, with no new answers', () => {
    const saved: IntakeResponses = { ...BASE_INTAKE, raceDistance: '10k', raceDate: '2026-10-04' };
    const first = request({ target: planTargetFromIntake(saved), idempotencyKey: 'key-1' });
    const second = request({ target: planTargetFromIntake(saved), idempotencyKey: 'key-2' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // Identical but for the idempotency key: nothing about the second plan needed re-asking.
    expect({ ...first.request, idempotencyKey: 'x' }).toEqual({
      ...second.request,
      idempotencyKey: 'x',
    });
  });

  it('needs no answers at all from a general-fitness runner beyond the prefilled length', () => {
    expect(needsPlanLength(planTargetFromIntake(BASE_INTAKE))).toBe(true);
    // …and that one field ships prefilled, so a return visit is still a single tap.
    expect(request({ planLengthWeeks: String(DEFAULT_PLAN_WEEKS) }).ok).toBe(true);
  });
});
