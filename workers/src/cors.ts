/** Credential-safe CORS for the Expo web build. Native requests carry no `Origin` and pass
 * through unchanged. Browser origins are reflected only when they exactly match an allowlisted
 * origin; `*` is never emitted because auth and `/api/*` requests use cookies. */

import type { Env } from './env';

const ALLOW_HEADERS = 'content-type, authorization, expo-origin, x-skip-oauth-proxy';
const ALLOW_METHODS = 'GET, HEAD, POST, PUT, OPTIONS';

export function isCorsPreflight(request: Request): boolean {
  return request.method === 'OPTIONS' && request.headers.has('origin');
}

export function handleCorsPreflight(request: Request, env: Env): Response {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).has(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function normalizeAllowedBrowserOrigin(request: Request, env: Env): Request {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).has(origin)) return request;

  // better-auth performs its own origin/CSRF check. The CORS allowlist above is the browser trust
  // boundary, so present the Worker's own trusted origin internally while the outer response still
  // reflects the real browser origin. Without this, an allowed Expo web origin passes preflight
  // but every auth POST is rejected as INVALID_ORIGIN.
  const headers = new Headers(request.headers);
  headers.set('origin', env.BETTER_AUTH_URL);
  return new Request(request, { headers });
}

export function withCors(request: Request, response: Response, env: Env): Response {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).has(origin)) return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    env.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': ALLOW_HEADERS,
    'access-control-allow-methods': ALLOW_METHODS,
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
