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

import { ApiError, NetworkError, isNetworkFailure } from './apiErrors';
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
const expoAuthPlugin = expoClient({
  scheme: 'paceblueprint',
  storagePrefix: 'paceblueprint',
  storage: SecureStore,
}) as unknown as BetterAuthClientPlugin;

const baseAuthClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [expoAuthPlugin],
});

export const authClient = baseAuthClient as typeof baseAuthClient & {
  /** The Expo plugin's session cookie, for `apiFetch` below. See the comment above. */
  getCookie(): string;
};

export const { signIn, signUp, signOut, useSession } = authClient;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = authClient.getCookie();

  // `fetch` rejects with a bare `TypeError` when the request never reached a server — wrong host,
  // refused connection, no route. Left unwrapped that `TypeError` fails every `instanceof ApiError`
  // check downstream and surfaces as a generic per-feature message, which points at the wrong
  // thing entirely. Convert it here, once, into an error that says what actually happened.
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
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

export function purchaseTier(tier: 'pro' | 'elite'): Promise<{ tier: Tier; periodStart: string; periodEnd: string }> {
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

export function getPlan(planId: string): Promise<{ plan: Plan; planId: string; isFallback: boolean }> {
  return apiFetch(`/api/plans/${encodeURIComponent(planId)}`);
}

export function generatePlan(body: GeneratePlanRequest): Promise<GeneratePlanResponse> {
  return apiFetch('/api/generate-plan', { method: 'POST', body: JSON.stringify(body) });
}
