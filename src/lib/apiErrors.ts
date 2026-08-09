/**
 * The error vocabulary every `/api/*` call speaks, and the one function that turns any of it into
 * a sentence a runner can act on.
 *
 * Split out of `apiClient.ts` so it stays pure — no `@better-auth/expo`, no `expo-secure-store`,
 * no React — and can therefore be unit-tested directly (`__tests__/apiErrors.test.ts`).
 * `apiClient.ts` re-exports everything here, so screens keep importing from `@/lib/apiClient`.
 *
 * WHY A SEPARATE `NetworkError`: `ApiError` means "the server answered, and said no". A request
 * that never reached a server at all is a different failure with a different fix, and it used to
 * be indistinguishable — `fetch` rejects with a bare `TypeError: Network request failed`, which
 * fell through every `instanceof ApiError` check into a generic "Could not load your plans."
 * That message sends you looking at the wrong thing. `better-auth`'s client has the same hole from
 * the other direction: `@better-fetch/fetch` awaits `fetch` outside its own try/catch, so a
 * transport failure escapes its `{ data, error }` contract as a raw rejection rather than an
 * `error` object — which is why the auth screens must catch, not just check `error`.
 */

import type { Tier } from './planTypes';

/** The closed set of machine-readable failure codes the server may return — `workers/src/lib/http.ts`. */
export type ApiErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'method_not_allowed'
  | 'invalid_request'
  | 'over_quota'
  | 'intake_required'
  | 'engine_unavailable'
  | 'internal_error';

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  quota?: { tier: Tier; used: number; limit: number; periodEnd: string | null };
}

/** Thrown by every `apiFetch` call on a non-2xx response. `body` is the server's `{ error, code }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Thrown when the request never reached the backend at all — DNS, refused connection, no route. */
export class NetworkError extends Error {
  readonly baseUrl: string;

  constructor(baseUrl: string, options?: { cause?: unknown }) {
    super(networkErrorMessage(baseUrl), options);
    this.name = 'NetworkError';
    this.baseUrl = baseUrl;
  }
}

/**
 * A loopback address names *the machine the app is running on*. On web or a simulator that is the
 * developer's computer and `http://localhost:8787` works; on a physical device — including every
 * Expo tunnel session, since the tunnel only forwards the Metro bundler, never the Worker — it is
 * the phone, where nothing is listening. Same URL, same code, opposite outcome, which is why this
 * is worth calling out by name in the error text instead of saying "check your connection".
 */
export function isLoopbackUrl(url: string): boolean {
  // Hand-rolled rather than `new URL()`: Hermes' URL support is partial and this only needs the
  // host. Strip scheme and userinfo, keep the authority, then take either a bracketed IPv6
  // literal or everything before the port.
  const authority = url
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/^[^@]*@/, '');
  const host = (/^\[(.*?)\]/.exec(authority)?.[1] ?? authority.split(':')[0]).toLowerCase();

  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /^127\./.test(host)
  );
}

/**
 * `fetch` signals transport failure by rejecting with a `TypeError`, and that is the only thing it
 * rejects with — every HTTP status, including 500, resolves normally. The message is the only way
 * to tell that `TypeError` apart from an ordinary bug in our own code, and it differs per engine,
 * so match the known set rather than treating every `TypeError` as an outage.
 */
const NETWORK_FAILURE_MESSAGES = [
  'network request failed', // React Native / whatwg-fetch
  'failed to fetch', // Chrome, Edge
  'networkerror when attempting to fetch resource', // Firefox
  'load failed', // Safari
  'fetch failed', // undici (Node, and therefore jest)
];

export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return NETWORK_FAILURE_MESSAGES.some((known) => message.includes(known));
}

export function networkErrorMessage(baseUrl: string, platform = runtimePlatform()): string {
  if (isLoopbackUrl(baseUrl) && platform !== 'web') {
    return (
      `Can't reach the server at ${baseUrl}. That address means "this device", so it only works ` +
      'on web or a simulator — a phone can never reach a backend running on your computer, ' +
      'tunnel or not. Point EXPO_PUBLIC_API_BASE_URL at your computer\'s LAN address or a ' +
      'deployed Worker, then restart the dev server (Expo inlines this at build time).'
    );
  }
  return `Can't reach the server at ${baseUrl}. Check your connection and server configuration, then try again.`;
}

function runtimePlatform(): 'web' | 'native' {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' ? 'native' : 'web';
}

/**
 * The single translation from "something was thrown" to "what the runner is shown". Every screen's
 * `catch` funnels through this so a backend that is merely unreachable never masquerades as a
 * feature-specific failure.
 *
 * @param fallback what to show when the server answered but the failure is not otherwise explained
 */
export function describeError(error: unknown, fallback: string, baseUrl?: string): string {
  if (error instanceof ApiError) return error.body.error;
  if (error instanceof NetworkError) return error.message;
  if (isNetworkFailure(error)) return networkErrorMessage(baseUrl ?? 'the server');
  return fallback;
}
