import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuth, sanitizeAuthLogValue } from '../src/auth';
import type { AuthMailRuntime } from '../src/auth-email';
import type { Env } from '../src/env';
import type { MailMessage } from '../src/lib/mail';

const PASSWORD = 'a-long-enough-password';
const NEW_PASSWORD = 'a-different-long-password';

function withEnv(overrides: Partial<Env> = {}): Env {
  return { ...(env as unknown as Env), ...overrides };
}

function captureMail(options: { configured?: boolean; required?: boolean } = {}) {
  const messages: MailMessage[] = [];
  const mail: AuthMailRuntime = {
    mailConfigured: options.configured ?? true,
    verificationRequired: options.required ?? false,
    sendMail: async (message) => {
      messages.push(message);
    },
  };
  return { mail, messages };
}

function authRequest(auth: ReturnType<typeof createAuth>, path: string, init?: RequestInit) {
  return auth.handler(new Request(`http://localhost:8787/api/auth${path}`, init));
}

async function signUp(
  auth: ReturnType<typeof createAuth>,
  email: string,
  callbackURL?: string
) {
  return authRequest(auth, '/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, name: 'Runner', callbackURL }),
  });
}

beforeEach(async () => {
  await env.DB.batch(
    ['session', 'account', 'verification', 'user'].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`)
    )
  );
});

describe('email verification', () => {
  it('sends Better Auth supplied verification URL and verifies the real D1 user', async () => {
    const { mail, messages } = captureMail({ required: true });
    const auth = createAuth(withEnv(), { mail });

    const response = await signUp(auth, 'verify@example.test', 'paceblueprint://verify-email');
    const body = (await response.json()) as { token: string | null };
    expect(response.status).toBe(200);
    expect(body.token).toBeNull();
    expect(messages).toHaveLength(1);

    const verificationURL = messages[0].text.match(/https?:\/\/\S+/)?.[0];
    expect(verificationURL).toBeTruthy();
    expect(messages[0].html).toContain(verificationURL!.replaceAll('&', '&amp;'));
    expect(verificationURL).toContain('/api/auth/verify-email?token=');

    const verified = await auth.handler(new Request(verificationURL!, { redirect: 'manual' }));
    expect(verified.status).toBe(302);
    expect(verified.headers.get('location')).toBe('paceblueprint://verify-email');

    const row = await env.DB.prepare('SELECT emailVerified FROM user WHERE email = ?')
      .bind('verify@example.test')
      .first<{ emailVerified: number }>();
    expect(row?.emailVerified).toBe(1);

    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'verify@example.test', password: PASSWORD }),
    });
    expect(signIn.status).toBe(200);
    expect((await signIn.json()) as { token?: string }).toHaveProperty('token');
  });

  it('refuses an unverified sign-in without mailing anything, and resends on explicit request', async () => {
    const { mail, messages } = captureMail({ required: true });
    const auth = createAuth(withEnv(), { mail });
    await signUp(auth, 'unverified@example.test', 'paceblueprint://verify-email');
    messages.length = 0;

    // `sendOnSignIn` is deliberately off (`auth.ts`): the app cannot supply a `callbackURL` on
    // sign-in, so an auto-sent link would land on the Worker root. A plain refusal instead…
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'unverified@example.test', password: PASSWORD }),
    });
    expect(signIn.status).toBe(403);
    expect(((await signIn.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');
    expect(messages).toHaveLength(0);

    // …and the sign-in screen's explicit resend, which does carry the app's own callback.
    const resend = await authRequest(auth, '/send-verification-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'unverified@example.test',
        callbackURL: 'paceblueprint://verify-email',
      }),
    });
    expect(resend.status).toBe(200);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('callbackURL=paceblueprint%3A%2F%2Fverify-email');
  });

  it('still sends verification on sign-up when delivery exists but enforcement is off', async () => {
    const { mail, messages } = captureMail({ configured: true, required: false });
    const auth = createAuth(withEnv(), { mail });

    const response = await signUp(auth, 'optional-verify@example.test');
    expect(response.status).toBe(200);
    expect((await response.json()) as { token?: string }).toHaveProperty('token');
    expect(messages).toHaveLength(1);
  });

  it('keeps sign-up usable and sends nothing when verification was requested without mail config', async () => {
    const { mail, messages } = captureMail({ configured: false, required: false });
    const auth = createAuth(
      withEnv({ RESEND_API_KEY: '', MAIL_FROM: '', MAIL_VERIFICATION_REQUIRED: 'true' }),
      { mail }
    );

    const response = await signUp(auth, 'degraded@example.test');
    expect(response.status).toBe(200);
    expect((await response.json()) as { token?: string }).toHaveProperty('token');
    expect(messages).toHaveLength(0);
  });
});

describe('password recovery', () => {
  it('resets the password through the real token flow and revokes existing sessions', async () => {
    const { mail, messages } = captureMail();
    const auth = createAuth(withEnv(), { mail });
    const signedUp = await signUp(auth, 'reset@example.test');
    const originalToken = ((await signedUp.json()) as { token: string }).token;
    messages.length = 0;

    const requested = await authRequest(auth, '/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'reset@example.test',
        redirectTo: 'paceblueprint://reset-password',
      }),
    });
    expect(requested.status).toBe(200);
    expect(messages).toHaveLength(1);

    const betterAuthURL = messages[0].text.match(/https?:\/\/\S+/)?.[0];
    expect(betterAuthURL).toBeTruthy();
    expect(messages[0].html).toContain(betterAuthURL);

    const callback = await auth.handler(new Request(betterAuthURL!, { redirect: 'manual' }));
    expect(callback.status).toBe(302);
    const deepLink = new URL(callback.headers.get('location')!);
    expect(`${deepLink.protocol}//${deepLink.host}${deepLink.pathname}`).toBe(
      'paceblueprint://reset-password'
    );
    const token = deepLink.searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await authRequest(auth, '/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword: NEW_PASSWORD }),
    });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({ status: true });

    const sessionCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM session')
      .first<{ count: number }>();
    expect(sessionCount?.count).toBe(0);

    const oldPassword = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reset@example.test', password: PASSWORD }),
    });
    expect(oldPassword.status).toBeGreaterThanOrEqual(400);

    const newPassword = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${originalToken}` },
      body: JSON.stringify({ email: 'reset@example.test', password: NEW_PASSWORD }),
    });
    expect(newPassword.status).toBe(200);
  });

  it('keeps the reset response generic for an unknown email', async () => {
    const { mail, messages } = captureMail();
    const auth = createAuth(withEnv(), { mail });

    const response = await authRequest(auth, '/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'missing@example.test',
        redirectTo: 'paceblueprint://reset-password',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: true,
      message: 'If this email exists in our system, check your email for the reset link',
    });
    expect(messages).toHaveLength(0);
  });

  it('rejects an untrusted reset redirect without sending mail', async () => {
    const { mail, messages } = captureMail();
    const auth = createAuth(withEnv(), { mail });
    await signUp(auth, 'redirect@example.test');
    messages.length = 0;

    const response = await authRequest(auth, '/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'redirect@example.test',
        redirectTo: 'https://evil.example/steal',
      }),
    });

    expect(response.status).toBe(403);
    expect(messages).toHaveLength(0);
  });

  it('hands mail work to the supplied background-task handler', async () => {
    const { mail } = captureMail();
    const initial = createAuth(withEnv(), { mail });
    await signUp(initial, 'background@example.test');

    let backgroundTask: Promise<unknown> | undefined;
    const backgroundMail: AuthMailRuntime = {
      ...mail,
      sendMail: () => new Promise(() => undefined),
    };
    const auth = createAuth(withEnv(), {
      mail: backgroundMail,
      waitUntil: (promise) => {
        backgroundTask = promise;
      },
    });

    const response = await authRequest(auth, '/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'background@example.test' }),
    });

    expect(response.status).toBe(200);
    expect(backgroundTask).toBeInstanceOf(Promise);
  });
});

describe('auth log redaction', () => {
  it('sanitizes URL- or token-bearing metadata attached to errors', () => {
    const error = Object.assign(new Error('See https://example.test/reset?token=message-secret'), {
      code: 'token=code-secret',
      response: {
        status: 502,
        statusText: 'Upstream https://example.test/reset/status-secret',
      },
    });

    const serialized = JSON.stringify(sanitizeAuthLogValue(error));
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('message-secret');
    expect(serialized).not.toContain('code-secret');
    expect(serialized).not.toContain('status-secret');
    expect(serialized).toContain('502');
  });

  it('leaves bare OAuth error codes readable while still redacting real key=value tokens', () => {
    const error = Object.assign(new Error('Code not found'), { code: 'state_mismatch' });
    const sanitized = sanitizeAuthLogValue(error) as { message: string; code: string };
    expect(sanitized.message).toBe('Code not found');
    expect(sanitized.code).toBe('state_mismatch');

    const redacted = sanitizeAuthLogValue('invalid_code with code=abc&state=xyz') as string;
    expect(redacted).toBe('invalid_code with code=[redacted]&state=[redacted]');
    expect(redacted).not.toContain('abc');
    expect(redacted).not.toContain('xyz');
  });

  it('keeps a redacted stack trace on sanitized errors', () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom',
      '    at handler (https://worker.test/src/index.ts:10:5)',
      `    at ${'x'.repeat(600)}`,
      '    at reset (/api/auth/reset-password/stack-secret)',
    ].join('\n');

    const sanitized = sanitizeAuthLogValue(error) as { stack?: string };
    expect(sanitized.stack).toContain('Error: boom');
    expect(sanitized.stack).toContain('/api/auth/reset-password/[redacted]');
    expect(sanitized.stack).not.toContain('https://');
    expect(sanitized.stack).not.toContain('stack-secret');
    expect(sanitized.stack!.length).toBeGreaterThan(500);
  });

  it('does not log reset tokens or full URLs when mail delivery fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { mail } = captureMail();
      const initial = createAuth(withEnv(), { mail });
      await signUp(initial, 'log@example.test');

      const failing: AuthMailRuntime = {
        ...mail,
        sendMail: async (message) => {
          throw new Error(`Failed for ${message.text}`);
        },
      };
      const auth = createAuth(withEnv(), { mail: failing });
      const response = await authRequest(auth, '/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'log@example.test' }),
      });

      expect(response.status).toBe(200);
      const serialized = JSON.stringify(errorLog.mock.calls);
      expect(serialized).toContain('better-auth error');
      expect(serialized).not.toContain('/reset-password/');
      expect(serialized).not.toContain('http://localhost:8787');
      expect(serialized).not.toMatch(/token=[A-Za-z0-9_-]+/);
    } finally {
      errorLog.mockRestore();
    }
  });
});
