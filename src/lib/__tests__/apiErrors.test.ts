/**
 * Guards the failure-mode split in `src/lib/apiErrors.ts`.
 *
 * The regression these cover: an unreachable backend used to reach the runner as "Could not load
 * your plans." — a message that sends you looking at plans instead of at the base URL. A physical
 * device pointed at `http://localhost:8787` (the default in `.env.example`, and unreachable from
 * anything but web or a simulator) is the everyday way to produce it.
 */

import {
  ApiError,
  NetworkError,
  describeError,
  isLoopbackUrl,
  isNetworkFailure,
  networkErrorMessage,
} from '../apiErrors';

describe('isLoopbackUrl', () => {
  it.each([
    'http://localhost:8787',
    'http://localhost:8788/api/intake',
    'https://LOCALHOST',
    'http://127.0.0.1:8787',
    'http://127.1.2.3',
    'http://0.0.0.0:8787',
    'http://[::1]:8787',
    'http://[::1]',
    'http://api.localhost:8787',
    'http://user:pw@localhost:8787',
  ])('treats %s as loopback', (url) => {
    expect(isLoopbackUrl(url)).toBe(true);
  });

  it.each([
    'https://pace-blueprint.workers.dev',
    'http://192.168.1.24:8787',
    'http://10.0.0.5:8787',
    'https://abc-123.exp.direct',
    // Not loopback: the literal starts with 127 only as a label, not an octet.
    'https://127-0-0-1.example.com',
  ])('treats %s as reachable', (url) => {
    expect(isLoopbackUrl(url)).toBe(false);
  });
});

describe('isNetworkFailure', () => {
  it('recognises the TypeError every fetch engine rejects transport failures with', () => {
    for (const message of [
      'Network request failed', // React Native / whatwg-fetch — the reported crash
      'Failed to fetch', // Chrome
      'NetworkError when attempting to fetch resource.', // Firefox
      'Load failed', // Safari
      'fetch failed', // undici
    ]) {
      expect(isNetworkFailure(new TypeError(message))).toBe(true);
    }
  });

  it('recognises an already-converted NetworkError', () => {
    expect(isNetworkFailure(new NetworkError('http://localhost:8787'))).toBe(true);
  });

  it('does not mistake an ordinary bug for an outage', () => {
    // A real TypeError from our own code must keep its own message rather than being reported as
    // a connectivity problem — that misdirection is the whole thing these helpers exist to stop.
    expect(isNetworkFailure(new TypeError("undefined is not an object (evaluating 'plan.weeks')"))).toBe(false);
    expect(isNetworkFailure(new ApiError(500, { error: 'boom', code: 'internal_error' }))).toBe(false);
    expect(isNetworkFailure(new Error('Network request failed'))).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});

describe('networkErrorMessage', () => {
  it('names the loopback trap, because that is the fix', () => {
    const message = networkErrorMessage('http://localhost:8787');
    expect(message).toContain('http://localhost:8787');
    expect(message).toContain('EXPO_PUBLIC_API_BASE_URL');
    expect(message).toMatch(/phone/i);
  });

  it('stays generic for a reachable-looking host', () => {
    const message = networkErrorMessage('https://pace-blueprint.workers.dev');
    expect(message).toContain('https://pace-blueprint.workers.dev');
    expect(message).not.toContain('EXPO_PUBLIC_API_BASE_URL');
  });
});

describe('describeError', () => {
  const fallback = 'Could not load your plans.';

  it("prefers the server's own message when the server answered", () => {
    const error = new ApiError(402, { error: 'You are out of plans this month.', code: 'over_quota' });
    expect(describeError(error, fallback, 'http://localhost:8787')).toBe('You are out of plans this month.');
  });

  it('replaces the feature-specific fallback when nothing answered', () => {
    const described = describeError(new TypeError('Network request failed'), fallback, 'http://localhost:8787');
    expect(described).not.toBe(fallback);
    expect(described).toContain('http://localhost:8787');
  });

  it('passes a NetworkError through with its own message', () => {
    const error = new NetworkError('http://localhost:8787');
    expect(describeError(error, fallback)).toBe(networkErrorMessage('http://localhost:8787'));
  });

  it('falls back for anything it cannot explain', () => {
    expect(describeError(new Error('kaboom'), fallback)).toBe(fallback);
    expect(describeError('a string', fallback)).toBe(fallback);
  });
});
