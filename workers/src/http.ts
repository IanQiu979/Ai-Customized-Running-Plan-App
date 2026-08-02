/**
 * The response envelope every route shares.
 *
 * `planning/03-engineering-requirements.md` "Conventions for all edge functions": JSON in / JSON
 * out; authenticate first and reject anon before any work; "return structured `{ error, code }` on
 * failure (never a bare 500 with a stack trace)". `fail()` is what makes the last clause
 * structural — a caller cannot accidentally serialize an `Error` into the body, because it only
 * ever accepts a code and a message the author wrote on purpose.
 */

/** The closed set of machine-readable failure codes the client may branch on. */
export type ErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'method_not_allowed'
  | 'invalid_request'
  | 'over_quota'
  /** Intake has not been completed, so there is nothing to build a plan from. */
  | 'intake_required'
  /** The plan engine is not bound yet — see `lib/planEngine.ts`. Distinct from a crash. */
  | 'engine_unavailable'
  | 'internal_error';

export interface ErrorBody {
  error: string;
  code: ErrorCode;
  /** Present only on `over_quota`, so the client can render "2 of 3 plans left" without a re-fetch. */
  quota?: {
    tier: string;
    used: number;
    limit: number;
    periodEnd: string | null;
  };
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const;

export function ok<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function fail(status: number, code: ErrorCode, message: string, extra?: Partial<ErrorBody>): Response {
  const body: ErrorBody = { error: message, code, ...extra };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * `403`, not `401`, for an anonymous caller — matching the documented contract in
 * `docs/architecture.md`'s API table ("`402` over-quota / `403` anon"). Worth stating because the
 * reflex is `401`, and a client written against the docs would branch on the wrong number.
 */
export function unauthenticated(): Response {
  return fail(403, 'unauthenticated', 'Sign in to continue.');
}

/** Body parse that never throws — a malformed body is a `400`, never a `500`. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
