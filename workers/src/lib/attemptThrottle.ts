/**
 * A small sliding-window failure counter for one route's password check, kept in D1.
 *
 * `handleDeleteAccount` verifies a plaintext password outside better-auth's handler, so
 * better-auth's own `rateLimit` (which only wraps `/api/auth/*`) never sees it. Without a bound,
 * a stolen session token — exactly what the re-auth exists to defeat — turns the route into an
 * unlimited online password oracle. This keeps that budget small: after `maxAttempts` wrong
 * passwords inside `windowMs`, the caller is refused with `429` before any verification runs,
 * so a correct guess while throttled deletes nothing.
 *
 * Durable since 2026-10-05 (`migrations/0007_attempt_throttle.sql`). It used to be module memory,
 * which is per isolate: a restart, or the next request landing on a different isolate, handed the
 * caller a fresh budget. D1 is the Worker's only binding, so the count lives there — one row per
 * failed attempt — and every isolate in every colo reads the same rows. Keys are the caller's user
 * id and connecting IP, tracked independently.
 *
 * What is stored is deliberately thin: the route's `scope`, an HMAC-SHA-256 digest of the key
 * (keyed with a server secret, so a leaked table is neither a list of IP addresses nor of user ids,
 * and an IPv4 digest cannot be reversed by enumerating the address space), and a timestamp. Each
 * write prunes the scope's rows older than the window, so the table holds at most one window's
 * failures plus whatever arrived since the last write.
 *
 * Not authorization data and not user-owned, so `store.ts`'s userId-predicate rule does not
 * apply — the migration's header says why. The check-then-record pair is not one statement, so a
 * burst of concurrent wrong guesses can overshoot `maxAttempts` by the burst's width; the bound is
 * on sustained guessing, which is the threat.
 */

type ThrottleKeys = readonly (string | null | undefined)[];

export interface AttemptThrottleOptions {
  /** Which route's budget this is; rows of another scope are never counted, pruned or reset. */
  scope: string;
  /** Keys the digest. A server secret; rotating it simply starts every budget afresh. */
  secret: string;
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
}

export class AttemptThrottle {
  private readonly db: D1Database;
  private readonly scope: string;
  private readonly secret: string;
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private hmacKey: Promise<CryptoKey> | null = null;

  constructor(db: D1Database, { scope, secret, maxAttempts, windowMs, now = () => Date.now() }: AttemptThrottleOptions) {
    this.db = db;
    this.scope = scope;
    this.secret = secret;
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** True when any of `keys` has exhausted its budget inside the current window. */
  async isThrottled(keys: ThrottleKeys): Promise<boolean> {
    const digests = await this.digests(keys);
    if (digests.length === 0) return false;
    const cutoff = this.now() - this.windowMs;
    const counts = await this.db.batch<{ attempts: number }>(
      digests.map((digest) =>
        this.db
          .prepare(
            'SELECT COUNT(*) AS attempts FROM attempt_throttle WHERE scope = ? AND key_digest = ? AND attempted_at > ?'
          )
          .bind(this.scope, digest, cutoff)
      )
    );
    return counts.some((result) => (result.results[0]?.attempts ?? 0) >= this.maxAttempts);
  }

  /** Record one failed attempt against every key given, and prune the scope's expired rows. */
  async recordFailure(keys: ThrottleKeys): Promise<void> {
    const digests = await this.digests(keys);
    const at = this.now();
    await this.db.batch([
      ...digests.map((digest) =>
        this.db
          .prepare('INSERT INTO attempt_throttle (scope, key_digest, attempted_at) VALUES (?, ?, ?)')
          .bind(this.scope, digest, at)
      ),
      this.pruneStatement(at),
    ]);
  }

  /** Forget the named keys (a success), or every key in this scope (a test's clean slate). */
  async reset(keys?: ThrottleKeys): Promise<void> {
    if (!keys) {
      await this.db.prepare('DELETE FROM attempt_throttle WHERE scope = ?').bind(this.scope).run();
      return;
    }
    const digests = await this.digests(keys);
    await this.db.batch([
      ...digests.map((digest) =>
        this.db
          .prepare('DELETE FROM attempt_throttle WHERE scope = ? AND key_digest = ?')
          .bind(this.scope, digest)
      ),
      this.pruneStatement(this.now()),
    ]);
  }

  private pruneStatement(at: number): D1PreparedStatement {
    return this.db
      .prepare('DELETE FROM attempt_throttle WHERE scope = ? AND attempted_at <= ?')
      .bind(this.scope, at - this.windowMs);
  }

  private async digests(keys: ThrottleKeys): Promise<string[]> {
    const present = [...new Set(keys.filter((key): key is string => Boolean(key)))];
    if (present.length === 0) return [];
    this.hmacKey ??= crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const hmacKey = await this.hmacKey;
    return Promise.all(
      present.map(async (key) => {
        const mac = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(key));
        return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      })
    );
  }
}

export const DELETE_ACCOUNT_THROTTLE_SCOPE = 'delete-account';
export const DELETE_ACCOUNT_MAX_ATTEMPTS = 5;
export const DELETE_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

/** The budget `POST /api/delete-account` checks — one per request, all reading the same rows. */
export function createDeleteAccountThrottle(db: D1Database, secret: string): AttemptThrottle {
  return new AttemptThrottle(db, {
    scope: DELETE_ACCOUNT_THROTTLE_SCOPE,
    secret,
    maxAttempts: DELETE_ACCOUNT_MAX_ATTEMPTS,
    windowMs: DELETE_ACCOUNT_WINDOW_MS,
  });
}
