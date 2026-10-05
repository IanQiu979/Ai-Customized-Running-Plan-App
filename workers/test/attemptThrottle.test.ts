import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AttemptThrottle,
  createDeleteAccountThrottle,
  DELETE_ACCOUNT_MAX_ATTEMPTS,
} from '../src/lib/attemptThrottle';

const SECRET = 'test-only-throttle-secret';

/** A throttle on the real test D1. Two calls with the same clock share rows — two isolates. */
function make(maxAttempts = 3, windowMs = 1000, scope = 'test-scope') {
  let clock = 1_000_000;
  const build = () =>
    new AttemptThrottle(env.DB, { scope, secret: SECRET, maxAttempts, windowMs, now: () => clock });
  return { throttle: build(), build, tick: (ms: number) => (clock += ms) };
}

async function rowCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempt_throttle').first<{ n: number }>();
  return row?.n ?? 0;
}

describe('AttemptThrottle (D1-backed)', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM attempt_throttle').run();
  });

  it('is open until maxAttempts failures land inside the window', async () => {
    const { throttle } = make();
    await throttle.recordFailure(['user:a']);
    await throttle.recordFailure(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(false);
    await throttle.recordFailure(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(true);
  });

  it('survives an isolate restart: a fresh instance sees the failures an earlier one recorded', async () => {
    // The 2026-10-05 fix. The old counter was module memory, so a new isolate started at zero.
    const { throttle: before, build } = make(2);
    await before.recordFailure(['user:a', 'ip:203.0.113.7']);
    await before.recordFailure(['user:a', 'ip:203.0.113.7']);

    const afterRestart = build();
    expect(await afterRestart.isThrottled(['user:a'])).toBe(true);
    expect(await afterRestart.isThrottled(['ip:203.0.113.7'])).toBe(true);
  });

  it('forgets failures that fall out of the window', async () => {
    const { throttle, tick } = make(2, 1000);
    await throttle.recordFailure(['user:a']);
    tick(600);
    await throttle.recordFailure(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(true);
    tick(500);
    expect(await throttle.isThrottled(['user:a'])).toBe(false);
    await throttle.recordFailure(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(true);
  });

  it('prunes rows that fell out of the window on the next write', async () => {
    const { throttle, tick } = make(5, 1000);
    await throttle.recordFailure(['user:a', 'ip:1']);
    expect(await rowCount()).toBe(2);
    tick(1001);
    await throttle.recordFailure(['user:b']);
    expect(await rowCount()).toBe(1);
  });

  it('throttles when any one key is exhausted and ignores empty keys', async () => {
    const { throttle } = make(1);
    await throttle.recordFailure(['user:a', null, undefined]);
    expect(await throttle.isThrottled(['user:b', 'user:a'])).toBe(true);
    expect(await throttle.isThrottled(['user:b', null])).toBe(false);
    expect(await throttle.isThrottled([null, undefined])).toBe(false);
  });

  it('reset clears only the named keys, or everything in its scope', async () => {
    const { throttle } = make(1);
    await throttle.recordFailure(['user:a', 'ip:1']);
    await throttle.reset(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(false);
    expect(await throttle.isThrottled(['ip:1'])).toBe(true);
    await throttle.reset();
    expect(await throttle.isThrottled(['ip:1'])).toBe(false);
  });

  it('keeps scopes apart: another route can neither spend nor reset this budget', async () => {
    const mine = make(1, 1000, 'delete-account').throttle;
    const other = make(1, 1000, 'some-other-route').throttle;
    await mine.recordFailure(['user:a']);
    expect(await other.isThrottled(['user:a'])).toBe(false);
    await other.reset();
    expect(await mine.isThrottled(['user:a'])).toBe(true);
  });

  it('stores neither the user id nor the IP address in the clear', async () => {
    const throttle = createDeleteAccountThrottle(env.DB, SECRET);
    await throttle.recordFailure(['user:user-123', 'ip:203.0.113.7']);
    const { results } = await env.DB.prepare('SELECT scope, key_digest FROM attempt_throttle').all<{
      scope: string;
      key_digest: string;
    }>();
    expect(results).toHaveLength(2);
    for (const row of results) {
      expect(row.scope).toBe('delete-account');
      expect(row.key_digest).toMatch(/^[0-9a-f]{64}$/);
      expect(row.key_digest).not.toContain('user-123');
      expect(row.key_digest).not.toContain('203.0.113.7');
    }
  });

  it('the delete-account budget is five', async () => {
    const throttle = createDeleteAccountThrottle(env.DB, SECRET);
    for (let attempt = 1; attempt < DELETE_ACCOUNT_MAX_ATTEMPTS; attempt += 1) {
      await throttle.recordFailure(['user:a']);
    }
    expect(await throttle.isThrottled(['user:a'])).toBe(false);
    await throttle.recordFailure(['user:a']);
    expect(await throttle.isThrottled(['user:a'])).toBe(true);
  });
});
