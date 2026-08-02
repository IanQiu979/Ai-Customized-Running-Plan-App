/**
 * The Worker entry point: authenticate once, then dispatch.
 *
 * There is no routing framework here on purpose. Nine routes and one auth mount do not justify a
 * dependency, and a hand-written `switch` keeps the one property that matters most visible on a
 * single screen — **every app route is behind the session check, structurally**, because the check
 * happens before dispatch rather than inside each handler where one could forget it.
 *
 * ROUTE TABLE (the Cloudflare translation of `docs/architecture.md`'s "Planned — API"):
 *
 *   ANY  /api/auth/*          better-auth: sign-up, sign-in, sign-out, session, OAuth callbacks
 *   GET  /health              liveness, unauthenticated, no database access
 *   POST /api/generate-plan   the core call — 402 over quota, 403 anon
 *   GET  /api/quota-status    { tier, used, limit, periodEnd }
 *   POST /api/purchase-tier   v1 dummy purchase; v2's real IAP lands on this same route
 *   POST /api/delete-account  erases the account and everything it owns
 *   GET  /api/intake          was a direct RLS-guarded client read under Supabase
 *   PUT  /api/intake          "
 *   GET  /api/plans           My Plans — summaries
 *   GET  /api/plans/:id       one plan, owned by the caller or 404
 *
 * There is deliberately no `DELETE /api/plans/:id`. Count-based quota depends on plans being
 * undeletable — a delete route would let a user reset their own count, which Echo V1 learned the
 * hard way (`planning/03-engineering-requirements.md` "Security requirements").
 */

import { AUTH_BASE_PATH, createAuth } from './auth';
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
    // Ahead of dispatch, so no handler below can be reached anonymously. `403`, not `401`, per the
    // documented contract.
    const session = await createAuth(env).api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return unauthenticated();
    }
    const userId = session.user.id;
    const deps = createDeps(env);

    try {
      switch (`${request.method} ${path}`) {
        case 'POST /api/generate-plan':
          return await handleGeneratePlan(request, userId, deps);
        case 'GET /api/quota-status':
          return await handleQuotaStatus(userId, deps);
        case 'POST /api/purchase-tier':
          return await handlePurchaseTier(request, userId, deps);
        case 'POST /api/delete-account':
          return await handleDeleteAccount(userId, deps);
        case 'GET /api/intake':
          return await handleGetIntake(userId, deps);
        case 'PUT /api/intake':
          return await handlePutIntake(request, userId, deps);
        case 'GET /api/plans':
          return await handleListPlans(userId, deps);
      }

      const planId = matchPlanId(path);
      if (planId) {
        if (request.method !== 'GET') {
          return fail(405, 'method_not_allowed', 'Plans are read-only.');
        }
        return await handleGetPlan(userId, planId, deps);
      }

      return fail(404, 'not_found', 'No such route.');
    } catch (error) {
      // The last line of defence for the "never a bare 500 with a stack trace" rule. The real
      // error goes to the Worker's log (`[observability] enabled` in `wrangler.toml`); the client
      // gets a sentence.
      console.error('unhandled error', { path, method: request.method, error });
      return fail(500, 'internal_error', 'Something went wrong. Try again.');
    }
  },
} satisfies ExportedHandler<Env>;

/** `/api/plans/:id` → the id. Anything deeper is not a route. */
function matchPlanId(path: string): string | null {
  const match = /^\/api\/plans\/([^/]+)$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}
