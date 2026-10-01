/**
 * The one-way aging transition (captain's decision, 2026-10-01): a recorded `13_17` account
 * declares a date of birth at least 18 years old and becomes `18_plus` — once, irreversibly, with
 * its guardian consent row archived rather than deleted (`migrations/0006_age_transition.sql`,
 * `POST /api/age-transition` in `src/routes.ts`).
 *
 * Everything here runs through the real Worker against a real D1 (`SELF.fetch`), because the
 * guarantees live in two places that only exist together at runtime: the route's birthday check,
 * and the triggers that make the transition and its archive a single SQLite statement.
 * Calendar edge cases (29 February, the UTC−12 "today") are pinned with a fixed clock in
 * `src/lib/__tests__/ageAssurance.test.ts`; these tests use dates far from any boundary.
 */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { PRIVACY_POLICY_VERSION } from '../../src/constants/legal';
import { latestCalendarDate } from '../../src/lib/ageAssurance';
import { createAuth } from '../src/auth';
import type { Env } from '../src/env';

interface Account {
  token: string;
  userId: string;
}

async function signUp(email: string, ageBand: '18_plus' | '13_17'): Promise<Account> {
  const response = await SELF.fetch('https://example.test/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'a-long-enough-password',
      name: 'Runner',
      ageBand,
      guardianConsent: ageBand === '13_17',
    }),
  });
  const body = await response.text();
  expect(response.status, body).toBe(200);
  const parsed = JSON.parse(body) as { token: string; user: { id: string } };
  return { token: parsed.token, userId: parsed.user.id };
}

async function createPendingOAuthSession(email: string): Promise<Account> {
  const auth = createAuth(env as unknown as Env);
  const context = await auth.$context;
  const { user } = await context.internalAdapter.createOAuthUser(
    { name: 'Google Runner', email, emailVerified: true, image: null },
    { providerId: 'google', accountId: `google-${email}` }
  );
  const session = await context.internalAdapter.createSession(user.id);
  return { token: session.token, userId: user.id };
}

/** See `worker.test.ts`'s helper of the same name: restores the live trigger verbatim. */
async function makeGrandfathered(userId: string): Promise<void> {
  const trigger = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'age_assurance_is_write_once'"
  ).first<{ sql: string }>();
  await env.DB.exec('DROP TRIGGER age_assurance_is_write_once;');
  try {
    await env.DB.prepare("UPDATE user SET age_assurance_status = 'grandfathered' WHERE id = ?")
      .bind(userId)
      .run();
  } finally {
    await env.DB.prepare(trigger!.sql).run();
  }
}

/** `YYYY-MM-DD` for a birthday `years` years and `extraDays` days before today (UTC−12). */
function birthDateYearsAgo(years: number, extraDays = 0): string {
  const today = latestCalendarDate(new Date());
  const date = new Date(Date.UTC(today.year - years, today.month - 1, today.day - extraDays));
  return date.toISOString().slice(0, 10);
}

function transition(account: Account, body: Record<string, unknown>): Promise<Response> {
  return SELF.fetch('https://example.test/api/age-transition', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${account.token}` },
    body: JSON.stringify({ expectedUserId: account.userId, ...body }),
  });
}

function putIntake(account: Account, age: number): Promise<Response> {
  return SELF.fetch('https://example.test/api/intake', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${account.token}` },
    body: JSON.stringify({
      goal: 'Run a faster 5K',
      age,
      experience: 'new',
      daysPerWeek: 3,
      weeklyKm: 15,
      injuries: ['none'],
    }),
  });
}

function assuranceRow(userId: string) {
  return env.DB.prepare(
    'SELECT age_band, age_assurance_status, age_policy_version FROM user WHERE id = ?'
  )
    .bind(userId)
    .first<{ age_band: string | null; age_assurance_status: string; age_policy_version: string | null }>();
}

function consentRow(userId: string) {
  return env.DB.prepare(
    `SELECT granted_at, policy_version, archived_at, archived_reason
       FROM guardian_consent WHERE user_id = ?`
  )
    .bind(userId)
    .first<{
      granted_at: string;
      policy_version: string;
      archived_at: string | null;
      archived_reason: string | null;
    }>();
}

async function consentCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM guardian_consent').first<{ n: number }>();
  return row?.n ?? -1;
}

const ADULT_BIRTH_DATE = birthDateYearsAgo(20);

beforeEach(async () => {
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
});

describe('POST /api/age-transition', () => {
  it('moves a recorded minor to adult and archives — not deletes — the guardian consent', async () => {
    const minor = await signUp('aging-happy@example.test', '13_17');
    const consentBefore = await consentRow(minor.userId);
    expect(consentBefore).toMatchObject({ archived_at: null, archived_reason: null });

    const response = await transition(minor, { birthDate: ADULT_BIRTH_DATE });

    const body = await response.json<{ ageBand: string; guardianConsentArchivedAt: string }>();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.ageBand).toBe('18_plus');
    expect(body.guardianConsentArchivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(await assuranceRow(minor.userId)).toEqual({
      age_band: '18_plus',
      age_assurance_status: 'recorded',
      age_policy_version: PRIVACY_POLICY_VERSION,
    });
    // The row survives, still says when and under which policy consent was given, and now says
    // when and why it stopped being in force.
    expect(await consentRow(minor.userId)).toEqual({
      granted_at: consentBefore!.granted_at,
      policy_version: consentBefore!.policy_version,
      archived_at: body.guardianConsentArchivedAt,
      archived_reason: 'aged_out_self_declared',
    });
    expect(await consentCount()).toBe(1);
  });

  it('exposes the adult band on the session after the transition', async () => {
    const minor = await signUp('aging-session@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);

    const session = await SELF.fetch('https://example.test/api/auth/get-session', {
      headers: { authorization: `Bearer ${minor.token}` },
    });
    expect(await session.json()).toMatchObject({
      user: { id: minor.userId, ageBand: '18_plus', ageAssuranceStatus: 'recorded' },
    });
  });

  it.each([
    ['15 years ago', birthDateYearsAgo(15)],
    ['one day short of 18', birthDateYearsAgo(18, -1)],
  ])('refuses a declared birthday %s and leaves the account a minor', async (_name, birthDate) => {
    const minor = await signUp(`aging-young-${_name.replace(/\W+/g, '-')}@example.test`, '13_17');
    const consentBefore = await consentRow(minor.userId);

    const response = await transition(minor, { birthDate });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'age_transition_too_young' });
    expect(await assuranceRow(minor.userId)).toMatchObject({ age_band: '13_17' });
    expect(await consentRow(minor.userId)).toEqual(consentBefore);
  });

  it.each([
    ['missing', undefined],
    ['not a date', 'eighteen'],
    ['an impossible day', '2000-02-30'],
    ['a non-ISO format', '01/02/2000'],
    ['in the future', birthDateYearsAgo(-1)],
    ['a number', 20000101],
  ])('refuses a birth date that is %s', async (_name, birthDate) => {
    const minor = await signUp(`aging-invalid-${_name.replace(/\W+/g, '-')}@example.test`, '13_17');

    const response = await transition(minor, { birthDate });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_birth_date' });
    expect(await assuranceRow(minor.userId)).toMatchObject({ age_band: '13_17' });
    expect(await consentRow(minor.userId)).toMatchObject({ archived_at: null });
  });

  it('refuses a second transition and leaves the first archive untouched', async () => {
    const minor = await signUp('aging-twice@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);
    const archived = await consentRow(minor.userId);

    const second = await transition(minor, { birthDate: birthDateYearsAgo(30) });

    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: 'age_transition_not_eligible' });
    expect(await consentRow(minor.userId)).toEqual(archived);
    expect(await assuranceRow(minor.userId)).toMatchObject({ age_band: '18_plus' });
  });

  it('lets exactly one of two concurrent transitions win', async () => {
    const minor = await signUp('aging-race@example.test', '13_17');

    const responses = await Promise.all([
      transition(minor, { birthDate: ADULT_BIRTH_DATE }),
      transition(minor, { birthDate: ADULT_BIRTH_DATE }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await consentCount()).toBe(1);
  });

  it('refuses an account that was never a recorded minor', async () => {
    const adult = await signUp('aging-adult@example.test', '18_plus');
    const grandfathered = await createPendingOAuthSession('aging-grandfathered@example.test');
    await makeGrandfathered(grandfathered.userId);

    for (const account of [adult, grandfathered]) {
      const response = await transition(account, { birthDate: ADULT_BIRTH_DATE });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'age_transition_not_eligible' });
    }
    expect(await assuranceRow(adult.userId)).toMatchObject({ age_band: '18_plus' });
    expect(await assuranceRow(grandfathered.userId)).toMatchObject({
      age_band: null,
      age_assurance_status: 'grandfathered',
    });
    expect(await consentCount()).toBe(0);
  });

  it('refuses a pending account at the central gate', async () => {
    const pending = await createPendingOAuthSession('aging-pending@example.test');

    const response = await transition(pending, { birthDate: ADULT_BIRTH_DATE });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'age_assurance_required' });
  });

  it('refuses a stale tab rendered for a different account, and a request naming none', async () => {
    const current = await signUp('aging-current-tab@example.test', '13_17');
    const previous = await signUp('aging-previous-tab@example.test', '13_17');

    const mismatch = await transition(current, {
      expectedUserId: previous.userId,
      birthDate: ADULT_BIRTH_DATE,
    });
    const missing = await transition(current, {
      expectedUserId: undefined,
      birthDate: ADULT_BIRTH_DATE,
    });

    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toMatchObject({ code: 'age_assurance_account_mismatch' });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: 'invalid_request' });
    for (const account of [current, previous]) {
      expect(await assuranceRow(account.userId)).toMatchObject({ age_band: '13_17' });
      expect(await consentRow(account.userId)).toMatchObject({ archived_at: null });
    }
  });
});

describe('intake age after the transition', () => {
  it('accepts an adult intake age once transitioned, and an untransitioned minor still cannot', async () => {
    const transitioned = await signUp('aging-intake-adult@example.test', '13_17');
    const stillMinor = await signUp('aging-intake-minor@example.test', '13_17');

    // Before: both are refused an adult age — PR 131's mirror check.
    for (const account of [transitioned, stillMinor]) {
      const refused = await putIntake(account, 18);
      expect(refused.status).toBe(400);
      expect(await refused.json()).toMatchObject({
        error: 'age must be 17 or under for this account.',
      });
    }

    expect((await transition(transitioned, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);

    for (const age of [18, 30]) {
      const accepted = await putIntake(transitioned, age);
      expect(accepted.status, await accepted.text()).toBe(200);
    }
    const stored = await env.DB.prepare('SELECT age FROM intake_responses WHERE user_id = ?')
      .bind(transitioned.userId)
      .first<{ age: number }>();
    expect(stored).toEqual({ age: 30 });

    // The untransitioned minor's ceiling is unchanged.
    const stillRefused = await putIntake(stillMinor, 18);
    expect(stillRefused.status).toBe(400);
    expect(await stillRefused.json()).toMatchObject({
      error: 'age must be 17 or under for this account.',
    });
  });

  it('holds a transitioned account to the adult floor, like any recorded adult', async () => {
    const minor = await signUp('aging-intake-floor@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);

    const refused = await putIntake(minor, 17);

    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({
      error: 'age must be at least 18 for this account.',
    });
    expect(await consentRow(minor.userId)).toMatchObject({
      archived_reason: 'aged_out_self_declared',
    });
  });
});

describe('the aging-transition schema (0006)', () => {
  it('cannot move a transitioned account back to 13_17, by any statement', async () => {
    const minor = await signUp('aging-schema-back@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);

    await expect(
      env.DB.prepare("UPDATE user SET age_band = '13_17' WHERE id = ?").bind(minor.userId).run()
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE user SET age_assurance_status = 'grandfathered', age_band = NULL, age_policy_version = NULL WHERE id = ?")
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();
    expect(await assuranceRow(minor.userId)).toMatchObject({ age_band: '18_plus' });
  });

  it('keeps a recorded adult from becoming a minor (0005 write-once still holds)', async () => {
    const adult = await signUp('aging-schema-adult@example.test', '18_plus');

    await expect(
      env.DB.prepare("UPDATE user SET age_band = '13_17' WHERE id = ?").bind(adult.userId).run()
    ).rejects.toThrow();
    expect(await consentCount()).toBe(0);
  });

  it('makes an archived consent row immutable and impossible to replace', async () => {
    const minor = await signUp('aging-schema-archive@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);
    const archived = await consentRow(minor.userId);

    await expect(
      env.DB.prepare(
        'UPDATE guardian_consent SET archived_at = NULL, archived_reason = NULL WHERE user_id = ?'
      )
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE guardian_consent SET granted_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?")
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();
    // The legacy intake upsert's shape: REPLACE would delete the archive and insert a fresh row.
    await expect(
      env.DB.prepare(
        `INSERT OR REPLACE INTO guardian_consent (user_id, granted_at, policy_version)
         VALUES (?, '2030-01-01T00:00:00.000Z', 'x')`
      )
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();

    expect(await consentRow(minor.userId)).toEqual(archived);
  });

  it('refuses consent inserted already archived, or archived with an unknown reason', async () => {
    const minor = await signUp('aging-schema-reason@example.test', '13_17');

    await expect(
      env.DB.prepare(
        "UPDATE guardian_consent SET archived_at = '2030-01-01T00:00:00.000Z', archived_reason = 'other' WHERE user_id = ?"
      )
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE guardian_consent SET archived_reason = 'aged_out_self_declared' WHERE user_id = ?")
        .bind(minor.userId)
        .run()
    ).rejects.toThrow();

    const grandfathered = await createPendingOAuthSession('aging-schema-insert@example.test');
    await makeGrandfathered(grandfathered.userId);
    await expect(
      env.DB.prepare(
        `INSERT INTO guardian_consent (user_id, granted_at, policy_version, archived_at, archived_reason)
         VALUES (?, '2030-01-01T00:00:00.000Z', 'x', '2030-01-01T00:00:00.000Z', 'aged_out_self_declared')`
      )
        .bind(grandfathered.userId)
        .run()
    ).rejects.toThrow();
    expect(await consentRow(minor.userId)).toMatchObject({ archived_at: null, archived_reason: null });
  });

  it('rolls the transition back when there is no consent row to archive', async () => {
    const minor = await signUp('aging-schema-no-consent@example.test', '13_17');
    await env.DB.prepare('DELETE FROM guardian_consent WHERE user_id = ?').bind(minor.userId).run();

    const response = await transition(minor, { birthDate: ADULT_BIRTH_DATE });

    expect(response.status).toBe(500);
    expect(await assuranceRow(minor.userId)).toMatchObject({ age_band: '13_17' });
  });

  it('still lets a transitioned account delete itself, archive included', async () => {
    const minor = await signUp('aging-schema-delete@example.test', '13_17');
    expect((await transition(minor, { birthDate: ADULT_BIRTH_DATE })).status).toBe(200);

    const response = await SELF.fetch('https://example.test/api/delete-account', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${minor.token}` },
      body: JSON.stringify({ password: 'a-long-enough-password' }),
    });

    expect(response.status, await response.text()).toBe(200);
    expect(await assuranceRow(minor.userId)).toBeNull();
    expect(await consentCount()).toBe(0);
  });
});
