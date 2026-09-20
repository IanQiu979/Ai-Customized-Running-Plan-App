/**
 * `D1PlanStore` against a real D1, in a real `workerd`.
 *
 * These are the tests that earn the quota gate's correctness claim. The claim is specifically
 * about SQLite's concurrency behaviour ("a conditional INSERT is atomic here even though the same
 * trick is insufficient in Postgres" — `migrations/0002_app_schema.sql`), and a claim about SQLite
 * can only be tested against SQLite. A hand-rolled in-memory fake would agree with whatever the
 * author assumed, which is the opposite of what this file is for.
 */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { InjuryFlag, Plan } from '../../src/lib/planTypes';
import { FALLBACK_EXEMPTION_CAP } from '../../src/lib/tierLimits';
import { D1PlanStore, RESERVATION_TTL_MS } from '../src/lib/store';

const USER = 'user-under-test';
const NOW = '2026-08-01T12:00:00.000Z';

function store() {
  return new D1PlanStore(env.DB);
}

async function seedUser(id = USER) {
  await env.DB.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 0, 0, 0)`
  )
    .bind(id, `Runner ${id}`, `${id}@example.test`)
    .run();
}

/** A minimally plan-shaped document. Content is irrelevant to storage; shape is not. */
function fakePlan(title = 'Test plan'): Plan {
  return {
    title,
    goalType: 'race',
    raceDistance: '5k',
    raceDate: '2026-10-01',
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
          { kind: 'run', effort: 'easy', label: 'ER', distanceKm: 10, effortDescription: 'Easy.' },
          { kind: 'rest' },
        ],
      },
    ],
    extras: [],
    disclaimers: ['Not medical advice.'],
  };
}

async function reserveAndSettle(
  s: D1PlanStore,
  key: string,
  opts: { isFallback?: boolean; now?: string } = {}
) {
  const now = opts.now ?? NOW;
  const window = await s.quotaWindow(USER, now);
  const result = await s.reserve({
    userId: USER,
    tier: window.tier,
    idempotencyKey: key,
    goalType: 'duration',
    durationWeeks: 8,
    now,
  });
  if (result.outcome !== 'reserved') return result;

  await s.settle({
    planId: result.planId,
    userId: USER,
    plan: fakePlan(key),
    engine: 'template',
    isFallback: opts.isFallback ?? false,
    now,
  });
  return result;
}

beforeEach(async () => {
  // Explicit truncation rather than relying on the pool's storage isolation semantics: several of
  // these tests assert on exact row counts, and a test that silently inherits another's rows fails
  // in a way that looks like a quota bug.
  await env.DB.batch(
    [
      'plans',
      'intake_responses',
      'guardian_consent',
      'subscriptions',
      'profiles',
      'session',
      'account',
      'user',
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`))
  );
  await seedUser();
});

describe('quotaWindow', () => {
  it('can temporarily grant every account Elite access with no quota limit', async () => {
    const window = await new D1PlanStore(env.DB, true).quotaWindow(USER, NOW);

    expect(window).toEqual({
      tier: 'elite',
      limit: null,
      lifetime: true,
      periodStart: null,
      periodEnd: null,
    });
  });

  it('defaults to free, lifetime, with no period end when there is no subscription row', async () => {
    // "A user with no `subscriptions` row is `free`" — and Free's single plan is a lifetime
    // allowance, so reporting a period end would put a countdown on the UI that means nothing.
    const window = await store().quotaWindow(USER, NOW);

    expect(window.tier).toBe('free');
    expect(window.limit).toBe(1);
    expect(window.lifetime).toBe(true);
    expect(window.periodEnd).toBeNull();
  });

  it('anchors a paid period on the purchase day, not the calendar month', async () => {
    const s = store();
    await s.recordPurchase(USER, 'pro', 'dummy', '2026-05-26T09:00:00.000Z');

    const window = await s.quotaWindow(USER, '2026-06-10T00:00:00.000Z');

    expect(window.tier).toBe('pro');
    expect(window.limit).toBe(3);
    expect(window.lifetime).toBe(false);
    expect(window.periodStart).toBe('2026-05-26T09:00:00.000Z');
    expect(window.periodEnd).toBe('2026-06-26T09:00:00.000Z');
  });

  it('keeps the original purchase anchor when the tier is upgraded', async () => {
    // Re-anchoring on upgrade would hand a Pro user on day 29 a fresh period of Elite quota for
    // free, just by pressing upgrade.
    const s = store();
    await s.recordPurchase(USER, 'pro', 'dummy', '2026-05-26T09:00:00.000Z');
    await s.recordPurchase(USER, 'elite', 'dummy', '2026-06-24T09:00:00.000Z');

    const window = await s.quotaWindow(USER, '2026-06-25T00:00:00.000Z');

    expect(window.tier).toBe('elite');
    expect(window.periodStart).toBe('2026-05-26T09:00:00.000Z');
  });
});

describe('reserve', () => {
  it('never refuses or counts plans while the temporary unlimited override is enabled', async () => {
    const s = new D1PlanStore(env.DB, true);

    for (let i = 0; i < 12; i += 1) {
      const result = await s.reserve({
        userId: USER,
        tier: 'elite',
        idempotencyKey: `unlimited-${i}`,
        goalType: 'duration',
        durationWeeks: 8,
        now: NOW,
      });
      expect(result.outcome).toBe('reserved');
      if (result.outcome === 'reserved') {
        await s.settle({
          planId: result.planId,
          userId: USER,
          plan: { ...fakePlan(`unlimited-${i}`), tierAtGeneration: 'elite' },
          engine: 'template',
          isFallback: false,
          now: NOW,
        });
      }
    }

    const window = await s.quotaWindow(USER, NOW);
    expect(await s.countUsed(USER, window, NOW)).toBe(0);
    expect((await s.listPlans(USER)).every((plan) => !plan.quotaConsumed)).toBe(true);
  });

  it('reserves while under the limit and refuses at it', async () => {
    const s = store();

    const first = await reserveAndSettle(s, 'key-1');
    expect(first.outcome).toBe('reserved');

    // Free is 1 plan total.
    const second = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'key-2',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });

    expect(second.outcome).toBe('over_quota');
    expect(second.outcome === 'over_quota' && second.used).toBe(1);
  });

  it('yields exactly one success when concurrent requests race for the last slot', async () => {
    // The property the whole design turns on. N concurrent requests at the limit must produce one
    // winner, not N — this is what the Postgres version needed an advisory lock for.
    const s = store();
    await s.recordPurchase(USER, 'pro', 'dummy', NOW); // limit 3

    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_unused, i) =>
        s.reserve({
          userId: USER,
          tier: 'pro',
          idempotencyKey: `race-${i}`,
          goalType: 'duration',
          durationWeeks: 8,
          now: NOW,
        })
      )
    );

    expect(attempts.filter((a) => a.outcome === 'reserved')).toHaveLength(3);
    expect(attempts.filter((a) => a.outcome === 'over_quota')).toHaveLength(5);
  });

  it('replays an existing row for a repeated idempotency key instead of generating again', async () => {
    // The network-timeout retry case: same key, same plan, no second charge.
    const s = store();
    const first = await reserveAndSettle(s, 'same-key');
    expect(first.outcome).toBe('reserved');

    const replay = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'same-key',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });

    expect(replay.outcome).toBe('replayed');
    expect(replay.outcome === 'replayed' && replay.row.status).toBe('settled');
    expect(replay.outcome === 'replayed' && replay.row.plan?.title).toBe('same-key');
  });

  it('does not let a released attempt consume a slot', async () => {
    const s = store();
    const reserved = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'doomed',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });
    expect(reserved.outcome).toBe('reserved');

    await s.release(
      reserved.outcome === 'reserved' ? reserved.planId : '',
      USER,
      'model_error'
    );

    // The user's one free plan must still be available: a server-side failure is not their fault.
    const retry = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'second-try',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });

    expect(retry.outcome).toBe('reserved');
  });

  it('stops counting a reservation once it is older than the TTL', async () => {
    // A Worker evicted mid-generation never runs its release. Without this the slot would be held
    // forever, and the user would be permanently down a plan because of a server crash.
    const s = store();
    const abandonedAt = new Date(Date.parse(NOW) - RESERVATION_TTL_MS - 60_000).toISOString();

    await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'abandoned',
      goalType: 'duration',
      durationWeeks: 8,
      now: abandonedAt,
    });

    const window = await s.quotaWindow(USER, NOW);
    expect(await s.countUsed(USER, window, NOW)).toBe(0);

    const retry = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'after-abandon',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });
    expect(retry.outcome).toBe('reserved');
  });

  it('scopes quota per user', async () => {
    // The ownership rule, from the quota side: one user filling their allowance must not affect
    // another's. With no RLS, this is only true because every statement binds `user_id`.
    const s = store();
    await seedUser('other-user');
    await reserveAndSettle(s, 'mine');

    const theirs = await s.reserve({
      userId: 'other-user',
      tier: 'free',
      idempotencyKey: 'theirs',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });

    expect(theirs.outcome).toBe('reserved');
  });
});

describe('settle — the fallback exemption', () => {
  it('exempts the first fallbacks in a period and charges the ones past the cap', async () => {
    // `docs/reference/plan-generation.md` "Quotas" + addendum R-B: the first
    // FALLBACK_EXEMPTION_CAP fallbacks are quota-exempt so a failing model does not cost the user
    // plans; past the cap a fallback keeps its already-reserved slot, so free-text `notes` cannot
    // be used to farm unlimited template plans.
    const s = store();
    await s.recordPurchase(USER, 'elite', 'dummy', NOW); // limit 10

    for (let i = 0; i < FALLBACK_EXEMPTION_CAP; i += 1) {
      await reserveAndSettle(s, `fallback-${i}`, { isFallback: true });
    }

    const window = await s.quotaWindow(USER, NOW);
    expect(await s.countUsed(USER, window, NOW)).toBe(0);

    await reserveAndSettle(s, 'fallback-past-cap', { isFallback: true });
    expect(await s.countUsed(USER, window, NOW)).toBe(1);
  });

  it('counts a successful (non-fallback) plan against quota', async () => {
    const s = store();
    await s.recordPurchase(USER, 'pro', 'dummy', NOW);
    await reserveAndSettle(s, 'real-plan');

    const window = await s.quotaWindow(USER, NOW);
    expect(await s.countUsed(USER, window, NOW)).toBe(1);
  });
});

describe('immutability', () => {
  it('refuses to rewrite a settled plan, at the database level', async () => {
    // Postgres would have expressed this as "no update grant". The trigger binds the Worker too,
    // not only the client, which is strictly stronger than the grant it replaces.
    const s = store();
    const reserved = await reserveAndSettle(s, 'immutable');
    const planId = reserved.outcome === 'reserved' ? reserved.planId : '';

    await expect(
      env.DB.prepare(`UPDATE plans SET plan = ? WHERE id = ?`)
        .bind(JSON.stringify(fakePlan('tampered')), planId)
        .run()
    ).rejects.toThrow(/immutable/);
  });

  it('makes a second settle a no-op rather than a rewrite', async () => {
    const s = store();
    const reserved = await reserveAndSettle(s, 'settle-twice');
    const planId = reserved.outcome === 'reserved' ? reserved.planId : '';

    await s.settle({
      planId,
      userId: USER,
      plan: fakePlan('second settle'),
      engine: 'hybrid',
      isFallback: true,
      now: NOW,
    });

    const row = await s.getPlan(USER, planId);
    expect(row?.plan?.title).toBe('settle-twice');
    expect(row?.engine).toBe('template');
  });
});

describe('ownership', () => {
  it('does not return another user’s plan by id', async () => {
    const s = store();
    await seedUser('stranger');
    const reserved = await reserveAndSettle(s, 'private');
    const planId = reserved.outcome === 'reserved' ? reserved.planId : '';

    // A plan id that arrived over the wire proves nothing about who sent it.
    expect(await s.getPlan('stranger', planId)).toBeNull();
    expect(await s.getPlan(USER, planId)).not.toBeNull();
  });

  it('does not list another user’s plans', async () => {
    const s = store();
    await seedUser('stranger');
    await reserveAndSettle(s, 'mine-only');

    expect(await s.listPlans('stranger')).toHaveLength(0);
    expect(await s.listPlans(USER)).toHaveLength(1);
  });

  it('cannot settle or release a plan on someone else’s behalf', async () => {
    const s = store();
    await seedUser('stranger');
    const reserved = await s.reserve({
      userId: USER,
      tier: 'free',
      idempotencyKey: 'not-yours',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });
    const planId = reserved.outcome === 'reserved' ? reserved.planId : '';

    await s.settle({
      planId,
      userId: 'stranger',
      plan: fakePlan('hijacked'),
      engine: 'template',
      isFallback: false,
      now: NOW,
    });
    await s.release(planId, 'stranger', 'hijack');

    const row = await s.getPlan(USER, planId);
    expect(row?.status).toBe('reserved');
  });
});

describe('intake', () => {
  it('round-trips, and reports null before intake is completed', async () => {
    const s = store();
    expect(await s.getIntake(USER)).toBeNull();

    await s.upsertIntake(
      USER,
      {
        goal: 'Run a faster 5K',
        age: 34,
        experience: 'regular',
        daysPerWeek: 4,
        weeklyKm: 30,
        raceDistance: '5k',
        raceDate: '2026-11-01',
        goalTimeSec: 1200,
        recentPerformance: { distance: '10k', timeSec: 2700 },
        injuries: ['knee'],
        injuryNotes: 'Occasional ache after long runs.',
      },
      NOW
    );

    expect(await s.getIntake(USER)).toEqual({
      goal: 'Run a faster 5K',
      age: 34,
      experience: 'regular',
      daysPerWeek: 4,
      weeklyKm: 30,
      raceDistance: '5k',
      raceDate: '2026-11-01',
      goalTimeSec: 1200,
      recentPerformance: { distance: '10k', timeSec: 2700 },
      injuries: ['knee'],
      injuryNotes: 'Occasional ache after long runs.',
    });
  });

  it('refuses half a recent performance', async () => {
    // Storing only one half silently disables every numeric pace in every plan the user ever
    // generates, with nothing in the UI to explain why.
    await expect(
      env.DB.prepare(
        `INSERT INTO intake_responses
           (user_id, goal, age, experience, days_per_week, weekly_km,
            recent_perf_distance, recent_perf_time_sec, injuries, updated_at)
         VALUES (?, 'g', 30, 'regular', 4, 30, '5k', NULL, '[]', ?)`
      )
        .bind(USER, NOW)
        .run()
    ).rejects.toThrow();
  });
});

const BASE_INTAKE = {
  goal: 'g',
  age: 15,
  experience: 'regular' as const,
  daysPerWeek: 4,
  weeklyKm: 30,
  injuries: ['none'] as InjuryFlag[],
};

describe('guardianConsent', () => {
  it('records a consent event with its granted-at time and policy version, atomically with the intake', async () => {
    const s = store();

    await s.upsertIntake(USER, BASE_INTAKE, NOW, { grantedAt: NOW, policyVersion: '2026-09-19' });

    const row = await env.DB.prepare(
      'SELECT granted_at, policy_version FROM guardian_consent WHERE user_id = ?'
    )
      .bind(USER)
      .first<{ granted_at: string; policy_version: string }>();
    expect(row).toEqual({ granted_at: NOW, policy_version: '2026-09-19' });
  });

  it('replaces the prior consent row rather than accumulating a history', async () => {
    const s = store();

    await s.upsertIntake(USER, BASE_INTAKE, NOW, { grantedAt: NOW, policyVersion: '2026-09-19' });
    await s.upsertIntake(USER, BASE_INTAKE, '2026-09-20T00:00:00.000Z', {
      grantedAt: '2026-09-20T00:00:00.000Z',
      policyVersion: '2026-10-01',
    });

    const rows = await env.DB.prepare('SELECT * FROM guardian_consent WHERE user_id = ?')
      .bind(USER)
      .all();
    expect(rows.results).toHaveLength(1);
    const row = await env.DB.prepare(
      'SELECT granted_at, policy_version FROM guardian_consent WHERE user_id = ?'
    )
      .bind(USER)
      .first<{ granted_at: string; policy_version: string }>();
    expect(row).toEqual({ granted_at: '2026-09-20T00:00:00.000Z', policy_version: '2026-10-01' });
  });

  it('writes the intake and the consent row together in one call', async () => {
    const s = store();

    await s.upsertIntake(USER, BASE_INTAKE, NOW, { grantedAt: NOW, policyVersion: '2026-09-19' });

    const consentRow = await env.DB.prepare('SELECT 1 FROM guardian_consent WHERE user_id = ?')
      .bind(USER)
      .first();
    const intakeRow = await env.DB.prepare('SELECT 1 FROM intake_responses WHERE user_id = ?')
      .bind(USER)
      .first();
    expect(consentRow).not.toBeNull();
    expect(intakeRow).not.toBeNull();
  });
});

describe('deleteAccount', () => {
  it('erases the user, their plans, intake, guardian consent, subscription and sessions', async () => {
    const s = store();
    await s.recordPurchase(USER, 'pro', 'dummy', NOW);
    await s.upsertIntake(USER, BASE_INTAKE, NOW, { grantedAt: NOW, policyVersion: '2026-09-19' });
    await reserveAndSettle(s, 'to-be-deleted');
    await env.DB.prepare(
      `INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) VALUES (?, 0, ?, 0, 0, ?)`
    )
      .bind('sess-1', 'tok-1', USER)
      .run();

    await s.deleteAccount(USER);

    for (const [table, column] of [
      ['plans', 'user_id'],
      ['intake_responses', 'user_id'],
      ['guardian_consent', 'user_id'],
      ['subscriptions', 'user_id'],
      ['session', 'userId'],
    ] as const) {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
        .bind(USER)
        .first<{ n: number }>();
      expect(row?.n, `${table} should be empty`).toBe(0);
    }

    const user = await env.DB.prepare('SELECT COUNT(*) AS n FROM user WHERE id = ?')
      .bind(USER)
      .first<{ n: number }>();
    expect(user?.n).toBe(0);
  });

  it('leaves other users untouched', async () => {
    const s = store();
    await seedUser('bystander');
    await s.reserve({
      userId: 'bystander',
      tier: 'free',
      idempotencyKey: 'theirs',
      goalType: 'duration',
      durationWeeks: 8,
      now: NOW,
    });

    await s.deleteAccount(USER);

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM plans WHERE user_id = ?')
      .bind('bystander')
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
  });
});

describe('getCredentialPassword', () => {
  async function insertAccount(providerId: string, userId: string, password: string | null) {
    await env.DB.prepare(
      `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, 0)`
    )
      .bind(`${providerId}-${userId}`, `${providerId}-account-id`, providerId, userId, password)
      .run();
  }

  it('returns the stored hash for a credential account', async () => {
    await insertAccount('credential', USER, 'a-hashed-password');

    expect(await store().getCredentialPassword(USER)).toBe('a-hashed-password');
  });

  it('returns null for a user with only a social account — the passwordless OAuth case', async () => {
    await insertAccount('google', USER, null);

    expect(await store().getCredentialPassword(USER)).toBeNull();
  });

  it('returns null for a user with no account rows at all', async () => {
    expect(await store().getCredentialPassword(USER)).toBeNull();
  });
});
