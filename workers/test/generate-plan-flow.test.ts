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
  ])('rejects %s before reserving anything', async (_label, request) => {
    const { deps, store } = makeDeps();

    const outcome = await generatePlan(USER, request as GeneratePlanRequest, deps);

    expect(outcome.kind).toBe('invalid_request');
    // Nothing was reserved, so a malformed request can never cost a plan slot.
    expect(store.reserveCalls).toHaveLength(0);
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
