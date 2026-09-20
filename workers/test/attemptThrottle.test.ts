import { describe, expect, it } from 'vitest';

import { AttemptThrottle } from '../src/lib/attemptThrottle';

function make(maxAttempts = 3, windowMs = 1000) {
  let clock = 0;
  const throttle = new AttemptThrottle({ maxAttempts, windowMs, now: () => clock });
  return { throttle, tick: (ms: number) => (clock += ms) };
}

describe('AttemptThrottle', () => {
  it('is open until maxAttempts failures land inside the window', () => {
    const { throttle } = make();
    throttle.recordFailure(['user:a']);
    throttle.recordFailure(['user:a']);
    expect(throttle.isThrottled(['user:a'])).toBe(false);
    throttle.recordFailure(['user:a']);
    expect(throttle.isThrottled(['user:a'])).toBe(true);
  });

  it('forgets failures that fall out of the window', () => {
    const { throttle, tick } = make(2, 1000);
    throttle.recordFailure(['user:a']);
    tick(600);
    throttle.recordFailure(['user:a']);
    expect(throttle.isThrottled(['user:a'])).toBe(true);
    tick(500);
    expect(throttle.isThrottled(['user:a'])).toBe(false);
    throttle.recordFailure(['user:a']);
    expect(throttle.isThrottled(['user:a'])).toBe(true);
  });

  it('throttles when any one key is exhausted and ignores empty keys', () => {
    const { throttle } = make(1);
    throttle.recordFailure(['user:a', null, undefined]);
    expect(throttle.isThrottled(['user:b', 'user:a'])).toBe(true);
    expect(throttle.isThrottled(['user:b', null])).toBe(false);
  });

  it('reset clears only the named keys, or everything', () => {
    const { throttle } = make(1);
    throttle.recordFailure(['user:a', 'ip:1']);
    throttle.reset(['user:a']);
    expect(throttle.isThrottled(['user:a'])).toBe(false);
    expect(throttle.isThrottled(['ip:1'])).toBe(true);
    throttle.reset();
    expect(throttle.isThrottled(['ip:1'])).toBe(false);
  });
});
