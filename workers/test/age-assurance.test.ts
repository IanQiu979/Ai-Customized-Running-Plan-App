import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { PRIVACY_POLICY_VERSION } from '../../src/constants/legal';
import {
  resolveAgeAssuranceForCreate,
  type AuthUserCandidate,
} from '../src/age-assurance';
import { createAuth } from '../src/auth';
import type { AuthMailRuntime } from '../src/auth-email';
import type { Env } from '../src/env';

const PASSWORD = 'a-long-enough-password';
const VERIFICATION_REQUIRED_MAIL: AuthMailRuntime = {
  mailConfigured: true,
  verificationRequired: true,
  sendMail: async () => undefined,
};

function createTestAuth() {
  return createAuth(env as unknown as Env);
}

function authRequest(
  auth: ReturnType<typeof createAuth>,
  path: string,
  body: Record<string, unknown>,
  token?: string
) {
  return auth.handler(
    new Request(`http://localhost:8787/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

function signUp(
  auth: ReturnType<typeof createAuth>,
  email: string,
  assurance: Record<string, unknown>
) {
  return authRequest(auth, '/sign-up/email', {
    email,
    password: PASSWORD,
    name: 'Runner',
    ...assurance,
  });
}

async function authTableCounts() {
  const counts = await Promise.all(
    ['user', 'account', 'session', 'verification', 'guardian_consent'].map(async (table) => {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{
        count: number;
      }>();
      return [table, row?.count ?? -1] as const;
    })
  );
  return Object.fromEntries(counts);
}

async function assuranceRow(email: string) {
  return env.DB.prepare(
    `SELECT id, age_band, age_assurance_status, age_policy_version
     FROM user WHERE email = ?`
  )
    .bind(email)
    .first<{
      id: string;
      age_band: string | null;
      age_assurance_status: string;
      age_policy_version: string | null;
    }>();
}

beforeEach(async () => {
  await env.DB.batch(
    ['guardian_consent', 'session', 'account', 'verification', 'user'].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`)
    )
  );
});

describe('resolveAgeAssuranceForCreate', () => {
  const candidate: AuthUserCandidate = {
    name: 'Runner',
    email: 'runner@example.test',
    emailVerified: false,
  };

  it('stamps the server-owned recorded tuple only for email signup', () => {
    expect(
      resolveAgeAssuranceForCreate(
        '/sign-up/email',
        { ageBand: '13_17', guardianConsent: true },
        candidate
      )
    ).toEqual({
      ...candidate,
      ageBand: '13_17',
      ageAssuranceStatus: 'recorded',
      agePolicyVersion: PRIVACY_POLICY_VERSION,
    });
  });

  it.each([null, '/callback/google', '/internal/create-user'])(
    'forces %s user creation to pending even when candidate data is spoofed',
    (path) => {
      expect(
        resolveAgeAssuranceForCreate(
          path,
          { ageBand: '13_17', guardianConsent: true },
          {
            ...candidate,
            ageBand: '13_17',
            ageAssuranceStatus: 'recorded',
            agePolicyVersion: 'client-controlled',
          }
        )
      ).toEqual({
        ...candidate,
        ageBand: null,
        ageAssuranceStatus: 'pending',
        agePolicyVersion: null,
      });
    }
  );
});

describe('email signup age assurance', () => {
  it.each([
    ['missing', {}],
    ['unknown', { ageBand: 'not-a-band' }],
    ['under 13', { ageBand: 'under_13' }],
  ])('rejects a %s age band before creating any auth row', async (_case, assurance) => {
    const response = await signUp(
      createTestAuth(),
      `${_case.replaceAll(' ', '-')}@example.test`,
      assurance
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'AGE_BAND_REQUIRED' });
    expect(await authTableCounts()).toEqual({
      user: 0,
      account: 0,
      session: 0,
      verification: 0,
      guardian_consent: 0,
    });
  });

  it('returns the same consent refusal before duplicate-email handling', async () => {
    const auth = createAuth(env as unknown as Env, { mail: VERIFICATION_REQUIRED_MAIL });
    const existing = await signUp(auth, 'existing@example.test', {
      ageBand: '18_plus',
      guardianConsent: false,
    });
    expect(existing.status).toBe(200);

    const newEmail = await signUp(auth, 'new-minor@example.test', {
      ageBand: '13_17',
      guardianConsent: false,
    });
    const existingEmail = await signUp(auth, 'existing@example.test', {
      ageBand: '13_17',
      guardianConsent: false,
    });

    expect(newEmail.status).toBe(400);
    expect(existingEmail.status).toBe(400);
    expect(await newEmail.json()).toMatchObject({ code: 'GUARDIAN_CONSENT_REQUIRED' });
    expect(await existingEmail.json()).toMatchObject({ code: 'GUARDIAN_CONSENT_REQUIRED' });
    expect((await authTableCounts()).user).toBe(1);
  });

  it('returns recorded assurance for both new and synthetic duplicate signup responses', async () => {
    const auth = createAuth(env as unknown as Env, { mail: VERIFICATION_REQUIRED_MAIL });
    const choice = { ageBand: '13_17', guardianConsent: true };

    const newResponse = await signUp(auth, 'private-minor@example.test', choice);
    const duplicateResponse = await signUp(auth, 'private-minor@example.test', choice);
    const newBody = (await newResponse.json()) as {
      token: string | null;
      user: Record<string, unknown>;
    };
    const duplicateBody = (await duplicateResponse.json()) as {
      token: string | null;
      user: Record<string, unknown>;
    };

    expect(newResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(200);
    expect(newBody.token).toBeNull();
    expect(duplicateBody.token).toBeNull();
    expect(newBody.user).toMatchObject({
      ageBand: '13_17',
      ageAssuranceStatus: 'recorded',
    });
    expect(duplicateBody.user).toMatchObject({
      ageBand: '13_17',
      ageAssuranceStatus: 'recorded',
    });
    expect(newBody.user).not.toHaveProperty('agePolicyVersion');
    expect(duplicateBody.user).not.toHaveProperty('agePolicyVersion');
    expect((await authTableCounts()).user).toBe(1);
  });

  it('records the adult tuple and exposes session fields without consent evidence', async () => {
    const auth = createTestAuth();
    const response = await signUp(auth, 'adult@example.test', {
      ageBand: '18_plus',
      guardianConsent: true,
    });

    const body = (await response.json()) as {
      token?: string;
      user?: Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.user).toMatchObject({
      ageBand: '18_plus',
      ageAssuranceStatus: 'recorded',
    });
    expect(body.user).not.toHaveProperty('agePolicyVersion');
    const sessionResponse = await auth.handler(
      new Request('http://localhost:8787/api/auth/get-session', {
        headers: { authorization: `Bearer ${body.token}` },
      })
    );
    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      user: {
        ageBand: '18_plus',
        ageAssuranceStatus: 'recorded',
      },
    });
    expect(await assuranceRow('adult@example.test')).toMatchObject({
      age_band: '18_plus',
      age_assurance_status: 'recorded',
      age_policy_version: PRIVACY_POLICY_VERSION,
    });
    expect((await authTableCounts()).guardian_consent).toBe(0);
  });

  it('records the canonical minor tuple and exactly one server-versioned consent row', async () => {
    const response = await signUp(createTestAuth(), 'minor@example.test', {
      ageBand: '13_17',
      guardianConsent: true,
    });

    expect(response.status).toBe(200);
    const user = await assuranceRow('minor@example.test');
    expect(user).toMatchObject({
      age_band: '13_17',
      age_assurance_status: 'recorded',
      age_policy_version: PRIVACY_POLICY_VERSION,
    });
    const consent = await env.DB.prepare(
      'SELECT user_id, policy_version FROM guardian_consent WHERE user_id = ?'
    )
      .bind(user!.id)
      .all<{ user_id: string; policy_version: string }>();
    expect(consent.results).toEqual([
      { user_id: user!.id, policy_version: PRIVACY_POLICY_VERSION },
    ]);
  });

  it.each([
    ['ageAssuranceStatus', 'grandfathered'],
    ['agePolicyVersion', 'client-policy'],
  ])('rejects a client-supplied %s field', async (field, value) => {
    const email = `spoof-${field.toLowerCase()}@example.test`;
    const response = await signUp(createTestAuth(), email, {
      ageBand: '18_plus',
      guardianConsent: false,
      [field]: value,
    });

    expect(response.status).toBe(400);
    expect(await assuranceRow(email)).toBeNull();
  });

  it.each([
    ['ageBand', '13_17'],
    ['ageAssuranceStatus', 'pending'],
    ['agePolicyVersion', 'client-policy'],
  ])('rejects update-user attempts to mutate %s', async (field, value) => {
    const auth = createTestAuth();
    const email = `update-${field.toLowerCase()}@example.test`;
    const signedUp = await signUp(auth, email, {
      ageBand: '18_plus',
      guardianConsent: false,
    });
    const token = ((await signedUp.json()) as { token: string }).token;

    const response = await authRequest(
      auth,
      '/update-user',
      { name: 'Still Runner', [field]: value },
      token
    );

    expect(response.status).toBe(400);
    expect(await assuranceRow(email)).toMatchObject({
      age_band: '18_plus',
      age_assurance_status: 'recorded',
      age_policy_version: PRIVACY_POLICY_VERSION,
    });
  });

  it('rolls the email user insert back when the consent trigger fails', async () => {
    await env.DB.prepare(`
      CREATE TRIGGER fail_auth_signup_consent
      BEFORE INSERT ON guardian_consent
      BEGIN
        SELECT RAISE(ABORT, 'test auth consent failure');
      END;
    `).run();

    try {
      const response = await signUp(createTestAuth(), 'rollback@example.test', {
        ageBand: '13_17',
        guardianConsent: true,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await authTableCounts()).toEqual({
        user: 0,
        account: 0,
        session: 0,
        verification: 0,
        guardian_consent: 0,
      });
    } finally {
      await env.DB.exec('DROP TRIGGER IF EXISTS fail_auth_signup_consent;');
    }
  });
});

describe('non-email user creation', () => {
  it('creates a new OAuth user as pending', async () => {
    const auth = createTestAuth();
    const context = await auth.$context;
    const providerUser = {
      name: 'Google Runner',
      email: 'oauth-new@example.test',
      emailVerified: true,
      image: null,
      ageBand: '13_17',
      ageAssuranceStatus: 'recorded',
      agePolicyVersion: 'provider-controlled',
    };

    await context.internalAdapter.createOAuthUser(
      providerUser,
      { providerId: 'google', accountId: 'google-new-subject' }
    );

    expect(await assuranceRow('oauth-new@example.test')).toMatchObject({
      age_band: null,
      age_assurance_status: 'pending',
      age_policy_version: null,
    });
  });

  it('preserves recorded assurance when linking OAuth to an existing user', async () => {
    const auth = createTestAuth();
    const signedUp = await signUp(auth, 'oauth-link@example.test', {
      ageBand: '18_plus',
      guardianConsent: false,
    });
    expect(signedUp.status).toBe(200);
    const user = await assuranceRow('oauth-link@example.test');
    const context = await auth.$context;

    await context.internalAdapter.linkAccount({
      providerId: 'google',
      accountId: 'google-existing-subject',
      userId: user!.id,
    });

    expect(await assuranceRow('oauth-link@example.test')).toMatchObject({
      age_band: '18_plus',
      age_assurance_status: 'recorded',
      age_policy_version: PRIVACY_POLICY_VERSION,
    });
  });
});
