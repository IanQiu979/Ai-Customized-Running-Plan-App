/**
 * The one module that talks to `workers/`. Base URL, session handling, and typed wrappers for the
 * app's own `/api/*` routes — auth itself (`sign-up`, `sign-in`, `sign-out`, `useSession`) is
 * `authClient`, better-auth's Expo client, exported for screens to call directly.
 *
 * SESSION TRANSPORT: better-auth's Expo plugin stores the session cookie in `expo-secure-store`
 * and replays it automatically on requests made through `authClient` itself (sign-in, sign-up,
 * sign-out, `useSession`). It does NOT intercept the plain `fetch` calls this module makes to the
 * app's own routes (`quota-status`, `intake`, `plans`, …) — those need the stored cookie attached
 * by hand, which is exactly what `authClient.getCookie()` is for (the documented pattern:
 * https://www.better-auth.com/docs/integrations/expo#making-authenticated-api-requests).
 *
 * `workers/src/index.ts`'s route table is the source of truth for what routes exist; this file
 * only wraps the ones this task and its declared follow-ups need. `generate-plan` is included even
 * though the intake/plan-generation screens are a separate task, because it is a trivial wrapper
 * over the same `apiFetch` and duplicating it later would just drift.
 *
 * FAILURE MODES: two, and screens must tell them apart. `ApiError` means the server answered and
 * refused; `NetworkError` means nothing answered at all. Both are defined in `apiErrors.ts` and
 * re-exported here, alongside `describeError`, which every screen's `catch` should funnel through.
 */

import { expoClient } from '@better-auth/expo/client';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { ApiError, NetworkError, isNetworkFailure } from './apiErrors';
import { describeAuthSessionResult } from './socialAuth';
import type { ApiErrorBody } from './apiErrors';
import type {
  GeneratePlanRequest,
  GeneratePlanResponse,
  IntakeResponses,
  Plan,
  QuotaStatus,
  Tier,
} from './planTypes';

// The error vocabulary lives in `apiErrors.ts` (pure, unit-tested); re-exported here so screens
// keep a single import site for everything `/api/*`.
export { ApiError, NetworkError, describeError, isNetworkFailure } from './apiErrors';
export type { ApiErrorBody, ApiErrorCode } from './apiErrors';

// Read with dot notation — Expo only inlines `process.env.EXPO_PUBLIC_*` this way (see
// `src/lib/supabase.ts` for the same discipline).
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!configuredApiBaseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env and fill it in, then restart the ' +
      'dev server — Expo inlines this at build time, so a running server will not pick it up.'
  );
}

/**
 * The origin every request here — and every `authClient` call — is aimed at. Exported so screens
 * can name it in a "can't reach the server" message: the URL *is* the diagnosis when the failure
 * is a loopback address on a physical device (`apiErrors.ts`). Re-declared rather than reusing
 * `configuredApiBaseUrl` so the `undefined` narrowing above survives into the closures below.
 */
export const API_BASE_URL: string = configuredApiBaseUrl;

/**
 * `@better-auth/expo`'s own `package.json` declares `"typescript": "^6.0.3"` as a peer — this
 * project is pinned to `~5.9.2` (bumping breaks `expo/tsconfig.base`'s ambient type resolution
 * project-wide, verified by trying it). Under 5.9.2 the plugin's `getActions` return type fails
 * `BetterAuthClientPlugin`'s structural check by one level of generic inference, even though the
 * plugin is otherwise unmodified from the documented usage. The cast is narrow and isolated to
 * this one plugin; `getCookie()` genuinely exists at runtime (verified by reading
 * `@better-auth/expo`'s compiled `dist/client.js`) so the second cast below just restores the one
 * type the mismatch above erased.
 */
const webStorage = {
  // The Expo plugin intentionally does nothing with its storage on web; the browser owns the
  // HttpOnly session cookie. Supplying a no-op adapter avoids calling SecureStore's absent web
  // implementation while preserving the documented native adapter unchanged.
  //
  // All four methods, not just the sync pair. `@better-auth/expo@1.6.25` — the version the
  // deployed Worker's better-auth is built against, and the version the lockfile pins the client
  // to on purpose so the two sides of the auth wire never skew — only ever reaches the sync pair,
  // so the async two are dead weight there. They are kept deliberately: the `^1.6.25` range let
  // `1.7.2` in during the SDK 54→57 upgrade, and in `1.7.2` `getCookie()` (used unconditionally,
  // including on web — see the module header) calls `getItemAsync` regardless of platform,
  // verified by reading that release's compiled `@better-auth/expo/dist/client.js`. A sync-only
  // stub type-checks under 1.6.25 but throws `storage.getItemAsync is not a function` on web at
  // runtime the moment the range floats forward again. Harmless now, correct either way.
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => undefined,
  getItemAsync: async (_key: string) => null,
  setItemAsync: async (_key: string, _value: string) => undefined,
};

const AUTH_COOKIE_STORAGE_KEY = 'paceblueprint_cookie';
const SECURE_STORE_VALUE_LIMIT = 1800;
const CHUNK_MARKER = '\u0001ba-chunks:';

function readNativeAuthCookie(): string {
  const stored = SecureStore.getItem(AUTH_COOKIE_STORAGE_KEY);
  if (!stored?.startsWith(CHUNK_MARKER)) return stored ?? '{}';

  const count = Number(stored.slice(CHUNK_MARKER.length));
  if (!Number.isInteger(count) || count < 1) return '{}';
  let value = '';
  for (let index = 0; index < count; index += 1) {
    const chunk = SecureStore.getItem(`${AUTH_COOKIE_STORAGE_KEY}.${index}`);
    if (chunk === null) return '{}';
    value += chunk;
  }
  return value;
}

function writeNativeAuthCookie(value: string): void {
  if (value.length <= SECURE_STORE_VALUE_LIMIT) {
    SecureStore.setItem(AUTH_COOKIE_STORAGE_KEY, value);
    return;
  }

  // Match @better-auth/expo's storage adapter: clear the base key first and write its chunk marker
  // last, so an interrupted write reads as absent instead of combining old and new cookie pieces.
  SecureStore.setItem(AUTH_COOKIE_STORAGE_KEY, '');
  const count = Math.ceil(value.length / SECURE_STORE_VALUE_LIMIT);
  for (let index = 0; index < count; index += 1) {
    const start = index * SECURE_STORE_VALUE_LIMIT;
    SecureStore.setItem(
      `${AUTH_COOKIE_STORAGE_KEY}.${index}`,
      value.slice(start, start + SECURE_STORE_VALUE_LIMIT)
    );
  }
  SecureStore.setItem(AUTH_COOKIE_STORAGE_KEY, `${CHUNK_MARKER}${count}`);
}

const expoAuthPlugin = expoClient({
  scheme: 'paceblueprint',
  storagePrefix: 'paceblueprint',
  storage: Platform.OS === 'web' ? webStorage : SecureStore,
}) as unknown as BetterAuthClientPlugin;

export type GoogleAuthOutcome =
  | { ok: true }
  | { ok: false; message: string };

async function openNativeGoogleAuth(onBeforeSessionNotify?: () => void): Promise<GoogleAuthOutcome> {
  const callbackURL = await import('expo-linking').then((Linking) => Linking.createURL('/'));
  const start = await baseAuthClient.signIn.social({
    provider: 'google',
    callbackURL,
    errorCallbackURL: callbackURL,
    newUserCallbackURL: callbackURL,
    disableRedirect: true,
  });

  if (start.error) {
    if (start.error.code === 'PROVIDER_NOT_FOUND') {
      return { ok: false, message: "Google sign-in isn't available yet." };
    }
    return { ok: false, message: start.error.message ?? 'Google sign-in could not start.' };
  }
  if (!start.data?.url) {
    return { ok: false, message: 'Google sign-in did not return an authorization URL.' };
  }

  // The browser needs the signed OAuth state cookie that the native fetch cannot share with it.
  // Route through @better-auth/expo's server proxy, which sets that cookie in the browser before
  // redirecting to Google. Opening Google's URL directly reaches the callback with no state and
  // fails before persistence — exactly the empty-user/account/session symptom this audit began with.
  const proxyURL = `${API_BASE_URL}/api/auth/expo-authorization-proxy?${new URLSearchParams({
    authorizationURL: start.data.url,
  }).toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(proxyURL, callbackURL);
  const callbackError = describeAuthSessionResult(result);
  if (callbackError) return { ok: false, message: callbackError };
  if (result.type !== 'success') {
    return { ok: false, message: 'Google sign-in did not complete. Please try again.' };
  }

  // The Expo server plugin appends the session Set-Cookie value to the successful deep link. The
  // dependency's built-in browser callback normally stores it invisibly; this explicit flow mirrors
  // that storage format so the screen can observe and surface every non-success result.
  const callback = new URL(result.url);
  const cookie = callback.searchParams.get('cookie');
  if (!cookie) {
    return { ok: false, message: 'Google signed in, but no app session was returned. Please try again.' };
  }

  // No secret or token is logged or exposed to application state. Keep the dependency's cookie
  // JSON and chunk marker format exactly, because authClient.getCookie() is its reader.
  const existing = readNativeAuthCookie();
  let parsed: Record<string, { value: string; expires: string | null }>;
  try {
    parsed = JSON.parse(existing) as Record<string, { value: string; expires: string | null }>;
  } catch {
    parsed = {};
  }
  for (const [name, attributes] of (await import('better-auth/cookies')).parseSetCookieHeader(cookie)) {
    const maxAge = attributes['max-age'];
    if (maxAge !== undefined && Number(maxAge) <= 0) {
      delete parsed[name];
      continue;
    }
    const expires = maxAge
      ? new Date(Date.now() + Number(maxAge) * 1000)
      : attributes.expires
        ? new Date(String(attributes.expires))
        : null;
    parsed[name] = { value: String(attributes.value), expires: expires?.toISOString() ?? null };
  }
  writeNativeAuthCookie(JSON.stringify(parsed));

  const session = await baseAuthClient.getSession({ fetchOptions: { disableCache: true } });
  if (session.error || !session.data?.user?.id) {
    return { ok: false, message: 'Google signed in, but the app could not establish a session. Please try again.' };
  }
  // The sign-up screen sets its one-shot Intake redirect immediately before this notification.
  // Ordering matters: notifying first can let Stack.Protected unmount the form before its caller
  // marks the redirect, recreating the post-signup race this project already fixed for email.
  onBeforeSessionNotify?.();
  // Direct cookie persistence sits outside the dependency's hidden callback hook, so explicitly
  // notify the reactive session atom. Stack.Protected then routes immediately instead of leaving a
  // successfully authenticated runner sitting on the form until a later focus/refetch event.
  authClient.$store.notify('$sessionSignal');
  return { ok: true };
}

const baseAuthClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [expoAuthPlugin],
});

export const authClient = baseAuthClient as typeof baseAuthClient & {
  /** The Expo plugin's session cookie, for `apiFetch` below. See the comment above. */
  getCookie(): string;
};

export const { signIn, signUp, signOut, useSession } = authClient;

export async function signInWithGoogle(options?: {
  onBeforeSessionNotify?: () => void;
}): Promise<GoogleAuthOutcome> {
  if (Platform.OS === 'web') {
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    if (result.error) {
      return {
        ok: false,
        message:
          result.error.code === 'PROVIDER_NOT_FOUND'
            ? "Google sign-in isn't available yet."
            : result.error.message ?? 'Google sign-in could not start.',
      };
    }
    return { ok: true };
  }
  return openNativeGoogleAuth(options?.onBeforeSessionNotify);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // `fetch` rejects with a bare `TypeError` when the request never reached a server — wrong host,
  // refused connection, no route. Left unwrapped that `TypeError` fails every `instanceof ApiError`
  // check downstream and surfaces as a generic per-feature message, which points at the wrong
  // thing entirely. Convert it here, once, into an error that says what actually happened.
  let response: Response;
  try {
    // Native must replay the Expo plugin's stored cookie manually. On web the browser sends its
    // HttpOnly cookie with `credentials: include`, and `getCookie()` intentionally returns ''.
    const cookie = Platform.OS === 'web' ? '' : authClient.getCookie();
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...init?.headers,
      },
    });
  } catch (fetchError) {
    if (isNetworkFailure(fetchError)) {
      throw new NetworkError(API_BASE_URL, { cause: fetchError });
    }
    throw fetchError;
  }

  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null;

  if (!response.ok) {
    if (response.status === 403 && (body as ApiErrorBody | null)?.code === 'unauthenticated') {
      // The server is authoritative. If a session was revoked while the app stayed foregrounded,
      // clear better-auth's local cache immediately instead of leaving the user trapped inside an
      // authenticated shell whose every request fails. Sign-out is best effort; the original 403
      // remains the error returned to this call.
      await authClient.signOut().catch(() => undefined);
    }
    throw new ApiError(
      response.status,
      (body as ApiErrorBody | null) ?? {
        error: 'Something went wrong. Try again.',
        code: 'internal_error',
      }
    );
  }

  return body as T;
}

// ---------------------------------------------------------------------------------------------
// Typed wrappers — one per `workers/src/index.ts` route, outside `/api/auth/*`.
// ---------------------------------------------------------------------------------------------

export function getQuotaStatus(): Promise<QuotaStatus> {
  return apiFetch<QuotaStatus>('/api/quota-status');
}

export function purchaseTier(tier: 'pro' | 'elite'): Promise<{
  tier: Tier;
  periodStart: string | null;
  periodEnd: string | null;
}> {
  return apiFetch('/api/purchase-tier', {
    method: 'POST',
    body: JSON.stringify({ tier, source: 'dummy' }),
  });
}

export function deleteAccount(): Promise<{ deleted: true }> {
  return apiFetch('/api/delete-account', { method: 'POST' });
}

export function getIntake(): Promise<{ intake: IntakeResponses | null }> {
  return apiFetch('/api/intake');
}

export function putIntake(intake: IntakeResponses): Promise<{ saved: true }> {
  return apiFetch('/api/intake', { method: 'PUT', body: JSON.stringify(intake) });
}

export interface PlanSummary {
  planId: string;
  title: string | null;
  tierAtGeneration: Tier;
  engine: string;
  isFallback: boolean;
  createdAt: string;
}

export function listPlans(): Promise<{ plans: PlanSummary[] }> {
  return apiFetch('/api/plans');
}

export function getPlan(planId: string): Promise<{
  plan: Plan;
  planId: string;
  isFallback: boolean;
  quotaConsumed: boolean;
}> {
  return apiFetch(`/api/plans/${encodeURIComponent(planId)}`);
}

export function generatePlan(body: GeneratePlanRequest): Promise<GeneratePlanResponse> {
  return apiFetch('/api/generate-plan', { method: 'POST', body: JSON.stringify(body) });
}
