/**
 * A small sliding-window failure counter for one route's password check.
 *
 * `handleDeleteAccount` verifies a plaintext password outside better-auth's handler, so
 * better-auth's own `rateLimit` (which only wraps `/api/auth/*`) never sees it. Without a bound,
 * a stolen session token — exactly what the re-auth exists to defeat — turns the route into an
 * unlimited online password oracle. This keeps that budget small: after `maxAttempts` wrong
 * passwords inside `windowMs`, the caller is refused with `429` before any verification runs,
 * so a correct guess while throttled deletes nothing.
 *
 * In-memory on purpose: the Worker binds no KV and adding a D1 table for a single route is a
 * migration (`AGENTS.md` HIGH tier) that the captain has not asked for. Module state is
 * per-isolate, so the bound is per colo rather than global — still a hard stop for a tight loop,
 * which is the threat. Keys are the caller's user id and connecting IP, tracked independently.
 */

export interface AttemptThrottleOptions {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
}

export class AttemptThrottle {
  private readonly failures = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor({ maxAttempts, windowMs, now = () => Date.now() }: AttemptThrottleOptions) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** True when any of `keys` has exhausted its budget inside the current window. */
  isThrottled(keys: readonly (string | null | undefined)[]): boolean {
    const cutoff = this.now() - this.windowMs;
    return keys.some((key) => key && this.recent(key, cutoff).length >= this.maxAttempts);
  }

  /** Record one failed attempt against every key given. */
  recordFailure(keys: readonly (string | null | undefined)[]): void {
    const at = this.now();
    const cutoff = at - this.windowMs;
    for (const key of keys) {
      if (!key) continue;
      this.failures.set(key, [...this.recent(key, cutoff), at]);
    }
  }

  /** Forget every key — a success, or a test's clean slate. */
  reset(keys?: readonly (string | null | undefined)[]): void {
    if (!keys) {
      this.failures.clear();
      return;
    }
    for (const key of keys) {
      if (key) this.failures.delete(key);
    }
  }

  private recent(key: string, cutoff: number): number[] {
    const stamps = this.failures.get(key)?.filter((stamp) => stamp > cutoff) ?? [];
    if (stamps.length === 0) {
      this.failures.delete(key);
    } else {
      this.failures.set(key, stamps);
    }
    return stamps;
  }
}

export const DELETE_ACCOUNT_MAX_ATTEMPTS = 5;
export const DELETE_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

/** The one instance `POST /api/delete-account` shares across requests in this isolate. */
export const deleteAccountThrottle = new AttemptThrottle({
  maxAttempts: DELETE_ACCOUNT_MAX_ATTEMPTS,
  windowMs: DELETE_ACCOUNT_WINDOW_MS,
});
