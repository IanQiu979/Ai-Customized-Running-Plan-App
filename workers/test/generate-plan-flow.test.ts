/**
 * `generatePlan`'s eleven documented steps, branch by branch.
 *
 * The assertions to read first are the ones about `store.released` and `store.settled`: the flow's
 * central promise is that a reservation is resolved on every exit path, and a quota slot lost to a
 * server-side failure is the one bug a user cannot forgive or work around.
 */

import { describe, expect, it } from 'vitest';

import type { GeneratePlanRequest } from '../../src/lib/planTypes';
import type { GeneratePlanDeps } from '../src/lib/generate-plan-flow';
import { generatePlan } from '../src/lib/generate-plan-flow';
import type { PersonalizeResult, SkeletonResult } from '../src/lib/planEngine';
import { RACE_DATE_PASSED_MESSAGE } from '../../src/lib/planRequest';
import { FakeStore, INTAKE, makePlan, type FakeStoreOptions } from './fakes';

const USER = 'user-1';
const NOW = '2026-08-01T12:00:00.000Z';

const VALID_REQUEST: GeneratePlanRequest = {
  goalType: 'duration',
  durationWeeks: 8,
  idempotencyKey: 'key-1',
};

interface Overrides {
  store?: FakeStore;
  storeOptions?: FakeStoreOptions;
  skeleton?: SkeletonResult | (() => Promise<SkeletonResult>);
  personalize?: PersonalizeResult;
  intake?: GeneratePlanDeps['loadIntake'];
}

function makeDeps(overrides: Overrides = {}) {
  const store = overrides.store ?? new FakeStore(overrides.storeOptions);
  let personalizeCalls = 0;

  const deps: GeneratePlanDeps = {
    store,
    skeleton: {
      build: async () => {
        const s = overrides.skeleton ?? { ok: true as const, plan: makePlan() };
        return typeof s === 'function' ? s() : s;
      },
    },
    personalizer: {
      personalize: async () => {
        personalizeCalls += 1;
        return (
          overrides.personalize ?? {
            ok: false as const,
            reason: 'prompt_unavailable' as const,
            message: 'no prompt yet',
          }
        );
      },
    },
    loadIntake: overrides.intake ?? (async () => INTAKE),
    now: () => NOW,
  };

  return { deps, store, personalizeCalls: () => personalizeCalls };
}

describe('request validation', () => {
  it.each([
    ['a missing idempotency key', { ...VALID_REQUEST, idempotencyKey: '' }],
    ['an unknown goal type', { ...VALID_REQUEST, goalType: 'vibes' as never }],
    ['a race goal with no distance', { goalType: 'race', raceDate: '2026-10-01', idempotencyKey: 'k' }],
    ['a race goal with no date', { goalType: 'race', raceDistance: '5k', idempotencyKey: 'k' }],
    ['a duration goal with no weeks', { goalType: 'duration', idempotencyKey: 'k' }],
    ['over-long notes', { ...VALID_REQUEST, notes: 'x'.repeat(1001) }],
    ['an over-long idempotency key', { ...VALID_REQUEST, idempotencyKey: 'x'.repeat(201) }],
    ['a fractional duration', { ...VALID_REQUEST, durationWeeks: 8.5 }],
    ['an impossible race date', { goalType: 'race', raceDistance: '5k', raceDate: '2026-02-30', idempotencyKey: 'k' }],
    ['an unknown race distance', { goalType: 'race', raceDistance: 'ultra' as never, raceDate: '2026-10-01', idempotencyKey: 'k' }],
    ['an absurd explicit durationWeeks', { ...VALID_REQUEST, durationWeeks: 999_999 }],
    // A "race" request has no business carrying `durationWeeks` at all, but nothing stops a
    // client from sending one anyway — it must share the same ceiling `weeksUntilRace`
    // (`planEngine.ts`) clamps to, not bypass it via this unrelated field.
    [
      'a race goal with an absurd explicit durationWeeks',
      { goalType: 'race', raceDistance: '5k', raceDate: '2026-10-01', durationWeeks: 999_999, idempotencyKey: 'k' },
    ],
    // A "duration" request legitimately carries `raceDistance` when the runner named a target
    // distance with no date (`src/lib/planRequest.ts`), and that value shapes the periodization
    // exactly as a race goal's does — so it needs the same value check, which used to live only
    // inside the `race` branch.
    [
      'a duration goal with an unknown race distance',
      { ...VALID_REQUEST, raceDistance: 'ultra' as never },
    ],
  ])('rejects %s before reserving anything', async (_label, request) => {
    const { deps, store } = makeDeps();

    const outcome = await generatePlan(USER, request as GeneratePlanRequest, deps);

    expect(outcome.kind).toBe('invalid_request');
    // Nothing was reserved, so a malformed request can never cost a plan slot.
    expect(store.reserveCalls).toHaveLength(0);
  });

  it('names the offending field when a duration goal carries a bad race distance', async () => {
    const { deps } = makeDeps();
    const outcome = await generatePlan(
      USER,
      { ...VALID_REQUEST, raceDistance: 'ultra' as never },
      deps,
    );
    expect(outcome).toEqual({
      kind: 'invalid_request',
      message: 'raceDistance must be one of 5k|10k|half|marathon.',
    });
  });

  // The client refuses a stale race date before sending (`src/lib/planRequest.ts`), but a
  // client-only guard is not a guard: any other caller would reach `weeksUntilRace`'s one-week
  // floor and buy a degenerate plan with a real quota slot.
  it('refuses a race date that has already passed, before reserving anything', async () => {
    const { deps, store } = makeDeps();

    const outcome = await generatePlan(
      USER,
      { goalType: 'race', raceDistance: '5k', raceDate: '2026-07-31', idempotencyKey: 'k' },
      deps,
    );

    expect(outcome).toEqual({
      kind: 'invalid_request',
      message: RACE_DATE_PASSED_MESSAGE,
    });
    expect(store.reserveCalls).toHaveLength(0);
    expect(store.settled).toHaveLength(0);
  });

  it('still generates on race day itself', async () => {
    const { deps } = makeDeps();
    const outcome = await generatePlan(
      USER,
      { goalType: 'race', raceDistance: '5k', raceDate: NOW.slice(0, 10), idempotencyKey: 'k' },
      deps,
    );
    expect(outcome.kind).toBe('ok');
  });

  it('refuses a past race date even when it rides on a duration request', async () => {
    const { deps, store } = makeDeps();
    const outcome = await generatePlan(
      USER,
      { ...VALID_REQUEST, raceDate: '2020-01-01' } as GeneratePlanRequest,
      deps,
    );
    expect(outcome).toEqual({ kind: 'invalid_request', message: RACE_DATE_PASSED_MESSAGE });
    expect(store.reserveCalls).toHaveLength(0);
  });

  it('still accepts a duration goal carrying a valid race distance', async () => {
    const { deps } = makeDeps();
    const outcome = await generatePlan(USER, { ...VALID_REQUEST, raceDistance: 'half' }, deps);
    expect(outcome.kind).toBe('ok');
  });

  it('caps notes length because it reaches a model prompt as free text', async () => {
    const { deps } = makeDeps();
    const outcome = await generatePlan(USER, { ...VALID_REQUEST, notes: 'x'.repeat(1000) }, deps);
    expect(outcome.kind).toBe('ok');
  });
});

describe('preconditions', () => {
  it('requires intake before generating', async () => {
    const { deps, store } = makeDeps({ intake: async () => null });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome.kind).toBe('intake_required');
    expect(store.reserveCalls).toHaveLength(0);
  });

  it('reports quota state when the gate refuses', async () => {
    const { deps } = makeDeps({
      storeOptions: {
        tier: 'pro',
        limit: 3,
        reserveResult: { outcome: 'over_quota', used: 3 },
      },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    // The client renders "3 of 3 used" straight from this, with no follow-up request.
    expect(outcome).toMatchObject({
      kind: 'over_quota',
      tier: 'pro',
      used: 3,
      limit: 3,
      periodEnd: '2026-09-01T00:00:00.000Z',
    });
  });
});

describe('idempotency replay', () => {
  it('returns the already-settled plan rather than generating twice', async () => {
    // The network-timeout retry case, which is the entire reason `idempotencyKey` exists.
    const existing = makePlan({ title: 'Already generated' });
    const { deps, store, personalizeCalls } = makeDeps({
      storeOptions: {
        reserveResult: {
          outcome: 'replayed',
          row: {
            id: 'plan-existing',
            userId: USER,
            status: 'settled',
            tierAtGeneration: 'pro',
            engine: 'hybrid',
            isFallback: false,
            plan: existing,
            idempotencyKey: 'key-1',
            createdAt: NOW,
            quotaConsumed: true,
          },
        },
      },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome).toMatchObject({ kind: 'ok', planId: 'plan-existing', replayed: true });
    expect(personalizeCalls()).toBe(0);
    expect(store.settled).toHaveLength(0);
  });

  it('refuses to run a second generation while the first is still in flight', async () => {
    const { deps } = makeDeps({
      storeOptions: {
        reserveResult: {
          outcome: 'replayed',
          row: {
            id: 'plan-inflight',
            userId: USER,
            status: 'reserved',
            tierAtGeneration: 'pro',
            engine: null,
            isFallback: false,
            plan: null,
            idempotencyKey: 'key-1',
            createdAt: NOW,
            quotaConsumed: true,
          },
        },
      },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);
    expect(outcome.kind).toBe('internal_error');
  });
});

describe('the skeleton', () => {
  it('releases the reservation and charges nothing when the engine is unavailable', async () => {
    // The state this branch actually ships in. A 503 that quietly ate the user's only free plan
    // would be far worse than the 503 itself.
    const { deps, store } = makeDeps({
      skeleton: { ok: false, reason: 'engine_unavailable', message: 'not built yet' },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome.kind).toBe('engine_unavailable');
    expect(store.released).toEqual([{ planId: 'plan-1', reason: 'skeleton_engine_unavailable' }]);
    expect(store.settled).toHaveLength(0);
  });

  it('releases the reservation on an unexpected throw', async () => {
    const { deps, store } = makeDeps({
      skeleton: async () => {
        throw new Error('boom');
      },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome.kind).toBe('internal_error');
    expect(store.released).toEqual([{ planId: 'plan-1', reason: 'internal_error' }]);
  });
});

describe('tier branching', () => {
  it('stops at the template for Free and never calls the model', async () => {
    // "Free tier stops here. No AI call, ever." This assertion is the one that keeps that true.
    const { deps, store, personalizeCalls } = makeDeps({ storeOptions: { tier: 'free', limit: 1 } });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome).toMatchObject({ kind: 'ok', isFallback: false });
    expect(personalizeCalls()).toBe(0);
    expect(store.settled[0]).toMatchObject({ engine: 'template', isFallback: false });
  });

  it('serves a personalized plan for a paid tier when the model succeeds', async () => {
    const { deps, store } = makeDeps({
      storeOptions: { tier: 'pro', limit: 3 },
      personalize: { ok: true, plan: makePlan({ title: 'Personalized' }), engine: 'hybrid' },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome).toMatchObject({ kind: 'ok', isFallback: false });
    expect(store.settled[0]).toMatchObject({ engine: 'hybrid', isFallback: false });
  });

  it('falls back to the template — never a refusal — when personalization fails', async () => {
    const { deps, store } = makeDeps({
      storeOptions: { tier: 'elite', limit: 10 },
      personalize: { ok: false, reason: 'model_error', message: 'provider down' },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    // The runner still gets a real, coach-authored plan. What they lose is the "why".
    expect(outcome).toMatchObject({ kind: 'ok', isFallback: true, quotaConsumed: false });
    expect(store.settled[0]).toMatchObject({ engine: 'template', isFallback: true });
    expect(store.released).toHaveLength(0);
  });
});

describe('server-owned fields', () => {
  it('overwrites tier, engine and isFallback rather than trusting the plan it was handed', async () => {
    // A model (or a future skeleton bug) must not be able to name its own tier or engine: those
    // three fields decide how the plan renders forever.
    const { deps, store } = makeDeps({
      storeOptions: { tier: 'pro', limit: 3 },
      personalize: {
        ok: true,
        plan: makePlan({ tierAtGeneration: 'elite', engine: 'ai', isFallback: true }),
        engine: 'hybrid',
      },
    });

    const outcome = await generatePlan(USER, VALID_REQUEST, deps);

    expect(outcome.kind === 'ok' && outcome.plan.tierAtGeneration).toBe('pro');
    expect(outcome.kind === 'ok' && outcome.plan.engine).toBe('hybrid');
    expect(outcome.kind === 'ok' && outcome.plan.isFallback).toBe(false);
    expect(store.settled[0].plan.engine).toBe('hybrid');
  });
});
