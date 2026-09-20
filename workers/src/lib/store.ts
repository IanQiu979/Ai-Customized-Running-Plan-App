/**
 * Every D1 statement the app's own routes issue.
 *
 * ============================================================================================
 * AUTHORIZATION LIVES HERE. THERE IS NO SECOND NET.
 * ============================================================================================
 * The Postgres design this is ported from relied on row-level security: even if an edge function
 * forgot a `where user_id = ...`, the database itself refused to return another user's rows.
 * SQLite — and therefore D1 — has no policy system whatsoever. D1 runs whatever SQL this Worker
 * sends, with full access.
 *
 * The consequence is a rule, not a preference: **every statement in this file binds a `userId`
 * that came from a verified better-auth session, and no function in this file accepts a row id
 * without also accepting the owner's id.** `settle`, `release`, and `getPlan` all carry
 * `AND user_id = ?` even though they already have a primary key, because a primary key that
 * arrived over the wire proves nothing about who sent it. A reviewer's job on this file is to
 * check that predicate on every statement; a statement missing it is a data-leak bug, not a style
 * nit.
 *
 * The quota logic is the other half of the file. Its rules come from
 * `docs/reference/plan-generation.md` "Quotas" and are enforced with exactly two conditional
 * single statements — `reserve` and `settle` — for the reasons in
 * `migrations/0002_app_schema.sql`'s header (translation 2).
 */

import type {
  Engine,
  GoalType,
  IntakeResponses,
  Plan,
  RaceDistance,
  Tier,
} from '../../../src/lib/planTypes';
import { currentPeriod } from '../../../src/lib/quotaPeriod';
import { UNLIMITED_ACCESS_TIER } from '../access';
import {
  DEFAULT_TIER,
  FALLBACK_EXEMPTION_CAP,
  FREE_IS_LIFETIME,
  TIER_PLAN_LIMITS,
} from '../../../src/lib/tierLimits';

/**
 * How long a `reserved` row keeps holding its quota slot.
 *
 * A Worker that is evicted mid-generation never runs its `release`, and without this the slot
 * would be consumed forever. Postgres would have swept these with a cron; the same result is had
 * here for free by simply not counting reservations older than the TTL, evaluated at read time —
 * the same "no cron, no rollover write" trick the quota *period* already uses.
 *
 * 15 minutes is generous against the pipeline's real ceiling (one Claude call, retried at most
 * once) and stingy enough that a crash costs a user minutes, not a billing period.
 */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

export interface SubscriptionRow {
  tier: Tier;
  /** The purchase-day anchor every period is computed from. ISO-8601 UTC. */
  purchasedAt: string;
  source: 'dummy' | 'revenuecat';
}

/** The window quota is counted over. `lifetime` is Free's — see `FREE_IS_LIFETIME`. */
export interface QuotaWindow {
  tier: Tier;
  /** `null` means the temporary all-users override bypasses quota enforcement. */
  limit: number | null;
  lifetime: boolean;
  /** `null` for a lifetime window; there is no period boundary to report. */
  periodStart: string | null;
  periodEnd: string | null;
}

export interface PlanRow {
  id: string;
  userId: string;
  status: 'reserved' | 'settled' | 'released';
  tierAtGeneration: Tier;
  engine: Engine | null;
  isFallback: boolean;
  plan: Plan | null;
  idempotencyKey: string;
  createdAt: string;
  quotaConsumed: boolean;
}

export interface ReserveInput {
  userId: string;
  tier: Tier;
  idempotencyKey: string;
  goalType: GoalType;
  raceDistance?: RaceDistance;
  raceDate?: string;
  durationWeeks?: number;
  now: string;
}

export type ReserveResult =
  | { outcome: 'reserved'; planId: string }
  | { outcome: 'replayed'; row: PlanRow }
  | { outcome: 'over_quota'; used: number };

export interface SettleInput {
  planId: string;
  userId: string;
  plan: Plan;
  engine: Engine;
  isFallback: boolean;
  now: string;
}

/**
 * What `generate-plan`'s orchestration is allowed to do to storage.
 *
 * The flow is written against this interface rather than against D1 so it can be unit-tested with
 * a fake — the same split as the sibling repo's `flow.ts` / `deps.ts` (see `lib/model.ts`'s
 * header for the full convention note).
 */
export interface PlanStore {
  getSubscription(userId: string): Promise<SubscriptionRow | null>;
  quotaWindow(userId: string, now: string): Promise<QuotaWindow>;
  countUsed(userId: string, window: QuotaWindow, now: string): Promise<number>;
  findByIdempotencyKey(userId: string, key: string): Promise<PlanRow | null>;
  reserve(input: ReserveInput): Promise<ReserveResult>;
  settle(input: SettleInput): Promise<void>;
  release(planId: string, userId: string, reason: string): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------------------------

interface RawPlanRow {
  id: string;
  user_id: string;
  status: string;
  tier_at_generation: string;
  engine: string | null;
  is_fallback: number;
  plan: string | null;
  idempotency_key: string;
  created_at: string;
  counts_against_quota: number;
}

function toPlanRow(raw: RawPlanRow): PlanRow {
  return {
    id: raw.id,
    userId: raw.user_id,
    status: raw.status as PlanRow['status'],
    tierAtGeneration: raw.tier_at_generation as Tier,
    engine: raw.engine as Engine | null,
    isFallback: raw.is_fallback === 1,
    // `json_valid()` is a table CHECK, so anything stored parses. A parse failure here would mean
    // the column was written around the constraint, which is worth throwing over.
    plan: raw.plan === null ? null : (JSON.parse(raw.plan) as Plan),
    idempotencyKey: raw.idempotency_key,
    createdAt: raw.created_at,
    quotaConsumed: raw.counts_against_quota === 1,
  };
}

/** The columns every plan read selects. One list, so a mapper change cannot miss a call site. */
const PLAN_COLUMNS =
  'id, user_id, status, tier_at_generation, engine, is_fallback, plan, idempotency_key, created_at, counts_against_quota';

interface RawIntakeRow {
  goal: string;
  age: number;
  experience: string;
  days_per_week: number;
  weekly_km: number;
  race_distance: string | null;
  race_date: string | null;
  goal_time_sec: number | null;
  recent_perf_distance: string | null;
  recent_perf_time_sec: number | null;
  injuries: string;
  injury_notes: string | null;
}

function toIntakeResponses(raw: RawIntakeRow): IntakeResponses {
  return {
    goal: raw.goal,
    age: raw.age,
    experience: raw.experience as IntakeResponses['experience'],
    daysPerWeek: raw.days_per_week,
    weeklyKm: raw.weekly_km,
    raceDistance: (raw.race_distance as RaceDistance | null) ?? undefined,
    raceDate: raw.race_date ?? undefined,
    goalTimeSec: raw.goal_time_sec ?? undefined,
    // The table CHECK guarantees these two are both set or both null, so the pair is never half
    // present — see `0002_app_schema.sql`. A half-set pair would silently disable every pace.
    recentPerformance:
      raw.recent_perf_distance !== null && raw.recent_perf_time_sec !== null
        ? { distance: raw.recent_perf_distance as RaceDistance, timeSec: raw.recent_perf_time_sec }
        : undefined,
    injuries: JSON.parse(raw.injuries) as IntakeResponses['injuries'],
    injuryNotes: raw.injury_notes ?? undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// The D1 implementation
// ---------------------------------------------------------------------------------------------

export class D1PlanStore implements PlanStore {
  constructor(
    private readonly db: D1Database,
    private readonly allUsersUnlimitedAccess = false
  ) {}

  async getSubscription(userId: string): Promise<SubscriptionRow | null> {
    const row = await this.db
      .prepare(
        `SELECT tier, purchased_at, source FROM subscriptions
          WHERE user_id = ? AND status = 'active'`
      )
      .bind(userId)
      .first<{ tier: string; purchased_at: string; source: string }>();

    if (!row) return null;
    return {
      tier: row.tier as Tier,
      purchasedAt: row.purchased_at,
      source: row.source as SubscriptionRow['source'],
    };
  }

  /**
   * The user's tier and the window to count in — derived server-side from `subscriptions`, never
   * read from the request. No active row means `free`, which is also why `free` is not a storable
   * tier value (see the `subscriptions` comment in `0002_app_schema.sql`).
   */
  async quotaWindow(userId: string, now: string): Promise<QuotaWindow> {
    if (this.allUsersUnlimitedAccess) {
      return {
        tier: UNLIMITED_ACCESS_TIER,
        limit: null,
        lifetime: true,
        periodStart: null,
        periodEnd: null,
      };
    }

    const subscription = await this.getSubscription(userId);
    const tier: Tier = subscription?.tier ?? DEFAULT_TIER;
    const limit = TIER_PLAN_LIMITS[tier];

    if (tier === 'free' && FREE_IS_LIFETIME) {
      return { tier, limit, lifetime: true, periodStart: null, periodEnd: null };
    }

    // A paid tier always has an anchor: it can only be paid because `purchase-tier` wrote one.
    const anchor = subscription?.purchasedAt ?? now;
    const period = currentPeriod(anchor, now);
    return {
      tier,
      limit,
      lifetime: false,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    };
  }

  /**
   * Plans consuming quota right now: settled rows that count, plus live reservations. Released
   * rows and expired reservations are both invisible to it, which is the whole reservation
   * lifecycle expressed as one predicate.
   */
  async countUsed(userId: string, window: QuotaWindow, now: string): Promise<number> {
    if (window.limit === null) return 0;

    const staleCutoff = new Date(new Date(now).getTime() - RESERVATION_TTL_MS).toISOString();

    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM plans
          WHERE user_id = ?
            AND counts_against_quota = 1
            AND (status = 'settled' OR (status = 'reserved' AND created_at > ?))
            AND (? = 1 OR (created_at >= ? AND created_at < ?))`
      )
      .bind(
        userId,
        staleCutoff,
        window.lifetime ? 1 : 0,
        window.periodStart ?? '',
        window.periodEnd ?? ''
      )
      .first<{ n: number }>();

    return row?.n ?? 0;
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<PlanRow | null> {
    const raw = await this.db
      .prepare(`SELECT ${PLAN_COLUMNS} FROM plans WHERE user_id = ? AND idempotency_key = ?`)
      .bind(userId, key)
      .first<RawPlanRow>();

    return raw ? toPlanRow(raw) : null;
  }

  /**
   * The quota gate. **One statement**, deliberately.
   *
   * `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < limit` reserves the slot and checks the
   * limit inside a single write, so there is no window between the count and the insert for a
   * second request to slip through. `meta.changes === 0` is the database saying "the count was
   * already at the limit" — the same answer the Postgres RPC returned as `allowed: false`.
   *
   * Why this is sufficient in SQLite when it would NOT be in Postgres: SQLite serializes writes
   * behind an exclusive lock and D1 funnels every query for a database through one Durable
   * Object, so the subquery cannot read a snapshot that predates a concurrent, uncommitted
   * insert. Postgres MVCC gives no such guarantee, which is why the original design needed
   * `pg_advisory_xact_lock`. This is the one place the port is *simpler* than its source, and it
   * is simpler for a reason worth keeping written down.
   */
  async reserve(input: ReserveInput): Promise<ReserveResult> {
    const existing = await this.findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existing) {
      return { outcome: 'replayed', row: existing };
    }

    const window = await this.quotaWindow(input.userId, input.now);
    const staleCutoff = new Date(new Date(input.now).getTime() - RESERVATION_TTL_MS).toISOString();
    const planId = crypto.randomUUID();

    let result: D1Result;
    try {
      if (window.limit === null) {
        // Temporary all-users test mode: keep the same immutable ledger/idempotency path, but do
        // not let the quota count refuse a request or count the resulting row against a limit.
        result = await this.db
          .prepare(
            `INSERT INTO plans (
               id, user_id, tier_at_generation, goal_type, race_distance, race_date,
               duration_weeks, idempotency_key, status, counts_against_quota, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', 0, ?)`
          )
          .bind(
            planId,
            input.userId,
            input.tier,
            input.goalType,
            input.raceDistance ?? null,
            input.raceDate ?? null,
            input.durationWeeks ?? null,
            input.idempotencyKey,
            input.now
          )
          .run();
      } else {
        result = await this.db
          .prepare(
            `INSERT INTO plans (
               id, user_id, tier_at_generation, goal_type, race_distance, race_date,
               duration_weeks, idempotency_key, status, counts_against_quota, created_at
             )
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', 1, ?
              WHERE (
                SELECT COUNT(*) FROM plans p
                 WHERE p.user_id = ?
                   AND p.counts_against_quota = 1
                   AND (p.status = 'settled' OR (p.status = 'reserved' AND p.created_at > ?))
                   AND (? = 1 OR (p.created_at >= ? AND p.created_at < ?))
              ) < ?`
          )
          .bind(
            planId,
            input.userId,
            input.tier,
            input.goalType,
            input.raceDistance ?? null,
            input.raceDate ?? null,
            input.durationWeeks ?? null,
            input.idempotencyKey,
            input.now,
            input.userId,
            staleCutoff,
            window.lifetime ? 1 : 0,
            window.periodStart ?? '',
            window.periodEnd ?? '',
            window.limit
          )
          .run();
      }
    } catch (error) {
      // The `UNIQUE (user_id, idempotency_key)` backstop firing means a concurrent request for
      // the same key won the race between our lookup above and this insert. That is a replay, not
      // a failure: re-read and return the winner rather than generating a second plan.
      const replayed = await this.findByIdempotencyKey(input.userId, input.idempotencyKey);
      if (replayed) {
        return { outcome: 'replayed', row: replayed };
      }
      throw error;
    }

    if ((result.meta?.changes ?? 0) === 0) {
      return { outcome: 'over_quota', used: await this.countUsed(input.userId, window, input.now) };
    }

    return { outcome: 'reserved', planId };
  }

  /**
   * Finish a reservation.
   *
   * `counts_against_quota` is decided here, in SQL, by the same one-statement argument as
   * `reserve`: a fallback is exempt only while fewer than `FALLBACK_EXEMPTION_CAP` exempt
   * fallbacks already exist in the window, and evaluating that in the UPDATE keeps two concurrent
   * settles from both claiming the last exemption. Past the cap the row keeps the slot it already
   * reserved — addendum R-B, 2026-07-10: nobody is refused a plan, the attempt just counts.
   *
   * `AND status = 'reserved'` makes this a no-op on an already-terminal row, which is what keeps a
   * duplicated settle from resurrecting or rewriting a plan. The table's trigger refuses the same
   * write independently.
   */
  async settle(input: SettleInput): Promise<void> {
    const window = await this.quotaWindow(input.userId, input.now);

    if (window.limit === null) {
      await this.db
        .prepare(
          `UPDATE plans
              SET status = 'settled', plan = ?, engine = ?, is_fallback = ?, settled_at = ?,
                  counts_against_quota = 0
            WHERE id = ? AND user_id = ? AND status = 'reserved'`
        )
        .bind(
          JSON.stringify(input.plan),
          input.engine,
          input.isFallback ? 1 : 0,
          input.now,
          input.planId,
          input.userId
        )
        .run();
      return;
    }

    await this.db
      .prepare(
        `UPDATE plans
            SET status = 'settled',
                plan = ?,
                engine = ?,
                is_fallback = ?,
                settled_at = ?,
                counts_against_quota = CASE
                  WHEN ? = 1 AND (
                    SELECT COUNT(*) FROM plans f
                     WHERE f.user_id = ?
                       AND f.is_fallback = 1
                       AND f.counts_against_quota = 0
                       AND f.status = 'settled'
                       AND (? = 1 OR (f.created_at >= ? AND f.created_at < ?))
                  ) < ?
                  THEN 0 ELSE 1
                END
          WHERE id = ? AND user_id = ? AND status = 'reserved'`
      )
      .bind(
        JSON.stringify(input.plan),
        input.engine,
        input.isFallback ? 1 : 0,
        input.now,
        input.isFallback ? 1 : 0,
        input.userId,
        window.lifetime ? 1 : 0,
        window.periodStart ?? '',
        window.periodEnd ?? '',
        FALLBACK_EXEMPTION_CAP,
        input.planId,
        input.userId
      )
      .run();
  }

  /** Hand the slot back. Only a live reservation can be released; terminal rows are untouched. */
  async release(planId: string, userId: string, reason: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE plans SET status = 'released', release_reason = ?
          WHERE id = ? AND user_id = ? AND status = 'reserved'`
      )
      .bind(reason, planId, userId)
      .run();
  }

  // -------------------------------------------------------------------------------------------
  // Reads and account lifecycle — not part of `PlanStore`, because the generation flow has no
  // business calling them.
  // -------------------------------------------------------------------------------------------

  /** One plan, by id, **owned by this user**. A foreign id returns null, never someone's plan. */
  async getPlan(userId: string, planId: string): Promise<PlanRow | null> {
    const raw = await this.db
      .prepare(`SELECT ${PLAN_COLUMNS} FROM plans WHERE id = ? AND user_id = ?`)
      .bind(planId, userId)
      .first<RawPlanRow>();

    return raw ? toPlanRow(raw) : null;
  }

  /** My Plans. Settled rows only — a reservation is not yet a plan anyone can read. */
  async listPlans(userId: string): Promise<PlanRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT ${PLAN_COLUMNS} FROM plans
          WHERE user_id = ? AND status = 'settled'
          ORDER BY created_at DESC`
      )
      .bind(userId)
      .all<RawPlanRow>();

    return (results ?? []).map(toPlanRow);
  }

  /**
   * Record a purchase. The anchor is set on first purchase and **preserved on re-purchase within
   * the same subscription**, because moving it would silently reset the user's period — a Pro user
   * upgrading to Elite on day 29 would otherwise get a fresh 30 days of Elite quota for free.
   */
  async recordPurchase(
    userId: string,
    tier: Exclude<Tier, 'free'>,
    source: 'dummy' | 'revenuecat',
    now: string
  ): Promise<SubscriptionRow> {
    await this.db
      .prepare(
        `INSERT INTO subscriptions (user_id, tier, purchased_at, source, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'active', ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
              tier = excluded.tier,
              source = excluded.source,
              status = 'active',
              updated_at = excluded.updated_at`
      )
      .bind(userId, tier, now, source, now, now)
      .run();

    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new Error('purchase-tier: subscription row vanished immediately after upsert');
    }
    return subscription;
  }

  /**
   * The caller's intake answers, or null.
   *
   * In the Supabase design this was a *direct client read*, protected by RLS. With no RLS to
   * protect it, it has to become a Worker route like everything else — see `docs/architecture.md`
   * "Authorization without RLS" for the full list of reads that changed shape for this reason.
   */
  async getIntake(userId: string): Promise<IntakeResponses | null> {
    const raw = await this.db
      .prepare(
        `SELECT goal, age, experience, days_per_week, weekly_km, race_distance, race_date,
                goal_time_sec, recent_perf_distance, recent_perf_time_sec, injuries, injury_notes
           FROM intake_responses WHERE user_id = ?`
      )
      .bind(userId)
      .first<RawIntakeRow>();

    return raw ? toIntakeResponses(raw) : null;
  }

  /**
   * Upsert the caller's intake answers. One row per user; the intake screen overwrites it.
   *
   * `guardianConsent`, when given, batches a `guardian_consent` upsert into the SAME `db.batch()`
   * transaction as the intake write — a 13–17 intake row and its consent record must commit
   * together or not at all, since the consent row is the audit evidence that the intake was even
   * allowed to be saved. Two separate `.run()` calls would leave a window (isolate eviction, a
   * throw between them) where the intake persists with no consent record on file.
   */
  async upsertIntake(
    userId: string,
    intake: IntakeResponses,
    now: string,
    guardianConsent?: { grantedAt: string; policyVersion: string }
  ): Promise<void> {
    const intakeStatement = this.db
      .prepare(
        `INSERT INTO intake_responses (
           user_id, goal, age, experience, days_per_week, weekly_km, race_distance, race_date,
           goal_time_sec, recent_perf_distance, recent_perf_time_sec, injuries, injury_notes,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           goal = excluded.goal,
           age = excluded.age,
           experience = excluded.experience,
           days_per_week = excluded.days_per_week,
           weekly_km = excluded.weekly_km,
           race_distance = excluded.race_distance,
           race_date = excluded.race_date,
           goal_time_sec = excluded.goal_time_sec,
           recent_perf_distance = excluded.recent_perf_distance,
           recent_perf_time_sec = excluded.recent_perf_time_sec,
           injuries = excluded.injuries,
           injury_notes = excluded.injury_notes,
           updated_at = excluded.updated_at`
      )
      .bind(
        userId,
        intake.goal,
        intake.age,
        intake.experience,
        intake.daysPerWeek,
        intake.weeklyKm,
        intake.raceDistance ?? null,
        intake.raceDate ?? null,
        intake.goalTimeSec ?? null,
        intake.recentPerformance?.distance ?? null,
        intake.recentPerformance?.timeSec ?? null,
        JSON.stringify(intake.injuries ?? []),
        intake.injuryNotes ?? null,
        now
      );

    if (!guardianConsent) {
      await intakeStatement.run();
      return;
    }

    const consentStatement = this.db
      .prepare(
        `INSERT OR REPLACE INTO guardian_consent (user_id, granted_at, policy_version)
         VALUES (?, ?, ?)`
      )
      .bind(userId, guardianConsent.grantedAt, guardianConsent.policyVersion);

    await this.db.batch([intakeStatement, consentStatement]);
  }

  /**
   * The stored password hash for the account's `providerId = 'credential'` row, or `null` when the
   * user has none — meaning the account was created (or exclusively linked) via an OAuth provider
   * such as Google. `better-auth`'s own sign-in handler reads the identical column; this is the
   * seam `handleDeleteAccount` uses to tell "verify a password" from "confirm-only, like V2.3's
   * passwordless path" apart, per `AGENTS.md`'s "no business rules in the client" — that decision
   * has to be made from a real row, not a client-asserted flag.
   */
  async getCredentialPassword(userId: string): Promise<string | null> {
    const row = await this.db
      .prepare(`SELECT password FROM account WHERE userId = ? AND providerId = 'credential'`)
      .bind(userId)
      .first<{ password: string | null }>();

    return row?.password ?? null;
  }

  /**
   * Erase a user, everything they own, and every session they hold.
   *
   * Written as an explicit ordered batch rather than leaning on `ON DELETE CASCADE`. The cascades
   * exist and would do the same job, but "the user's data is gone" is a promise made in the app's
   * own delete-account copy ("This permanently deletes your account, your intake answers, and
   * every plan you've generated"), and a promise that depends on a `PRAGMA` being on somewhere is
   * not a promise. `db.batch()` runs the statements in one implicit transaction, so this is
   * all-or-nothing — a half-deleted account is worse than a live one.
   *
   * This is also the ONLY place that deletes a plan. There is deliberately no per-plan delete
   * route: count-based quota depends on plans being undeletable, or a user could reset their own
   * count (`planning/03-engineering-requirements.md` "Security requirements").
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM plans WHERE user_id = ?').bind(userId),
      this.db.prepare('DELETE FROM intake_responses WHERE user_id = ?').bind(userId),
      this.db.prepare('DELETE FROM guardian_consent WHERE user_id = ?').bind(userId),
      this.db.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId),
      this.db.prepare('DELETE FROM profiles WHERE user_id = ?').bind(userId),
      this.db.prepare('DELETE FROM session WHERE userId = ?').bind(userId),
      this.db.prepare('DELETE FROM account WHERE userId = ?').bind(userId),
      this.db.prepare('DELETE FROM user WHERE id = ?').bind(userId),
    ]);
  }
}
