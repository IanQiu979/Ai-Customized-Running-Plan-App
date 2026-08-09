/**
 * The Worker entry point: authenticate once, then dispatch.
 *
 * There is no routing framework here on purpose. Nine routes and one auth mount do not justify a
 * dependency, and a hand-written switch keeps the one property that matters most visible on a
 * single screen — **every app route is behind the session check, structurally**, because the check
 * happens before dispatch rather than inside each handler where one could forget it.
 *
 * ROUTE TABLE (the Cloudflare translation of `docs/architecture.md`'s API contract):
 *
 *   ANY  /api/auth/*          better-auth: sign-up, sign-in, sign-out, session, OAuth callbacks
 *   GET  /health              liveness, unauthenticated, no database access
 *   POST /api/generate-plan   the core call — 402 over quota, 403 anon
 *   GET  /api/quota-status    tier + quota/unlimited state
 *   POST /api/purchase-tier   v1 dummy purchase; real IAP lands on this same route later
 *   POST /api/delete-account  erases the account and everything it owns
 *   GET/PUT /api/intake       one authenticated runner's intake
 *   GET  /api/plans           My Plans summaries
 *   GET  /api/plans/:id       one plan, owned by the caller or 404
 *
 * There is deliberately no per-plan delete route: normal count-based quota depends on plans being
 * immutable and undeletable, even though the temporary all-users override bypasses the count.
 */

import { AUTH_BASE_PATH, createAuth } from './auth';
import {
  handleCorsPreflight,
  isCorsPreflight,
  normalizeAllowedBrowserOrigin,
  withCors,
} from './cors';
import { createDeps } from './deps';
import type { Env } from './env';
import { fail, ok, unauthenticated } from './http';
import {
  handleDeleteAccount,
  handleGeneratePlan,
  handleGetIntake,
  handleGetPlan,
  handleListPlans,
  handlePurchaseTier,
  handlePutIntake,
  handleQuotaStatus,
} from './routes';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isCorsPreflight(request)) return handleCorsPreflight(request, env);

    try {
      return withCors(
        request,
        await dispatch(normalizeAllowedBrowserOrigin(request, env), env),
        env
      );
    } catch (error) {
      const url = new URL(request.url);
      console.error('unhandled error', { path: url.pathname, method: request.method, error });
      return withCors(
        request,
        fail(500, 'internal_error', 'Something went wrong. Try again.'),
        env
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function dispatch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/health') {
    return ok({ ok: true });
  }

  // better-auth owns everything under its base path, including its own method handling.
  if (path === AUTH_BASE_PATH || path.startsWith(`${AUTH_BASE_PATH}/`)) {
    return createAuth(env).handler(request);
  }

  if (!path.startsWith('/api/')) {
    return fail(404, 'not_found', 'No such route.');
  }

  // --- the single authentication gate -------------------------------------------------------
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return unauthenticated();
  }
  const userId = session.user.id;
  const deps = createDeps(env);

  switch (`${request.method} ${path}`) {
    case 'POST /api/generate-plan':
      return handleGeneratePlan(request, userId, deps);
    case 'GET /api/quota-status':
      return handleQuotaStatus(userId, deps);
    case 'POST /api/purchase-tier':
      return handlePurchaseTier(request, userId, deps);
    case 'POST /api/delete-account':
      return handleDeleteAccount(userId, deps);
    case 'GET /api/intake':
      return handleGetIntake(userId, deps);
    case 'PUT /api/intake':
      return handlePutIntake(request, userId, deps);
    case 'GET /api/plans':
      return handleListPlans(userId, deps);
  }

  const planId = matchPlanId(path);
  if (planId) {
    if (request.method !== 'GET') {
      return fail(405, 'method_not_allowed', 'Plans are read-only.');
    }
    return handleGetPlan(userId, planId, deps);
  }

  return fail(404, 'not_found', 'No such route.');
}

/** `/api/plans/:id` → the id. Anything deeper is not a route. */
function matchPlanId(path: string): string | null {
  const match = /^\/api\/plans\/([^/]+)$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}
