import { env, SELF } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import type { Env } from '../src/env';

describe('GET /api/email-status', () => {
  it('is public, reports the test environment as unconfigured, and cannot be cached', async () => {
    const response = await SELF.fetch('https://example.test/api/email-status');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      mailConfigured: false,
      verificationRequired: false,
    });
  });

  it('does not make other app API routes public', async () => {
    const response = await SELF.fetch('https://example.test/api/not-a-route');
    expect(response.status).toBe(403);
  });
});

describe('outer Worker error redaction', () => {
  it('redacts a reset token embedded in the request path', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await worker.fetch(
        new Request(
          'https://example.test/api/auth/reset-password/reset-token-must-not-be-logged?callbackURL=paceblueprint%3A%2F%2Freset-password'
        ),
        { ...(env as unknown as Env), BETTER_AUTH_SECRET: '' },
        { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} } as unknown as ExecutionContext
      );

      expect(response.status).toBe(500);
      const serialized = JSON.stringify(errorLog.mock.calls);
      expect(serialized).toContain('unhandled error');
      expect(serialized).not.toContain('reset-token-must-not-be-logged');
      expect(serialized).not.toContain('callbackURL');
    } finally {
      errorLog.mockRestore();
    }
  });
});
