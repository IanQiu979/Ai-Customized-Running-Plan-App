/**
 * Fakes for the orchestration tests.
 *
 * These exist so `generate-plan-flow.ts`'s branches can be driven directly — over quota, engine
 * unavailable, model failure, a mid-flight throw — without contorting a real database into each
 * state. The *storage* claims are tested against real D1 in `store.test.ts` instead; these fakes
 * are never the evidence for how D1 behaves, only for how the flow reacts to a given answer.
 */

import type { IntakeResponses, Plan, Tier } from '../../src/lib/planTypes';
import type {
  PlanStore,
  PlanRow,
  QuotaWindow,
  ReserveInput,
  ReserveResult,
  SettleInput,
  SubscriptionRow,
} from '../src/lib/store';

export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    title: 'Skeleton plan',
    goalType: 'duration',
    durationWeeks: 1,
    tierAtGeneration: 'free',
    engine: 'template',
    isFallback: false,
    weeklyLoad: [20],
    weeks: [
      {
        weekNumber: 1,
        totalWeeks: 1,
        phase: 'base',
        isDeload: false,
        volumeKm: 20,
        days: [
          { kind: 'rest' },
          { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, effortDescription: 'Easy.' },
          { kind: 'rest' },
          { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 5, effortDescription: 'Easy.' },
          { kind: 'rest' },
          { kind: 'run', effort: 'easy', label: 'LR', distanceKm: 10, effortDescription: 'Easy.' },
          { kind: 'rest' },
        ],
      },
    ],
    extras: [],
    disclaimers: ['Not medical advice.'],
    ...overrides,
  };
}

export const INTAKE: IntakeResponses = {
  goal: 'Run a faster 5K',
  age: 34,
  experience: 'regular',
  daysPerWeek: 4,
  weeklyKm: 30,
  injuries: ['none'],
};

export interface FakeStoreOptions {
  tier?: Tier;
  limit?: number;
  used?: number;
  /** Force `reserve` to answer with this instead of succeeding. */
  reserveResult?: ReserveResult;
}

/**
 * An in-memory `PlanStore` that records what was done to it, so a test can assert the thing that
 * actually matters — that the reservation was settled or released, never left dangling.
 */
export class FakeStore implements PlanStore {
  settled: SettleInput[] = [];
  released: { planId: string; reason: string }[] = [];
  reserveCalls: ReserveInput[] = [];

  constructor(private readonly options: FakeStoreOptions = {}) {}

  async getSubscription(): Promise<SubscriptionRow | null> {
    const tier = this.options.tier ?? 'free';
    return tier === 'free' ? null : { tier, purchasedAt: '2026-01-01T00:00:00.000Z', source: 'dummy' };
  }

  async quotaWindow(): Promise<QuotaWindow> {
    const tier = this.options.tier ?? 'free';
    return {
      tier,
      limit: this.options.limit ?? 3,
      lifetime: tier === 'free',
      periodStart: tier === 'free' ? null : '2026-08-01T00:00:00.000Z',
      periodEnd: tier === 'free' ? null : '2026-09-01T00:00:00.000Z',
    };
  }

  async countUsed(): Promise<number> {
    return this.options.used ?? 0;
  }

  async findByIdempotencyKey(): Promise<PlanRow | null> {
    return null;
  }

  async reserve(input: ReserveInput): Promise<ReserveResult> {
    this.reserveCalls.push(input);
    return this.options.reserveResult ?? { outcome: 'reserved', planId: 'plan-1' };
  }

  async settle(input: SettleInput): Promise<void> {
    this.settled.push(input);
  }

  async release(planId: string, _userId: string, reason: string): Promise<void> {
    this.released.push({ planId, reason });
  }
}
