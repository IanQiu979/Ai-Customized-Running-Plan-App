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

import {
  AUTH_BASE_PATH,
  createAuth,
  redactAuthRequestPath,
  sanitizeAuthLogValue,
} from './auth';
import { resolveAuthMailRuntime, type AuthMailRuntime } from './auth-email';
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
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    if (isCorsPreflight(request)) return handleCorsPreflight(request, env);

    try {
      return withCors(
        request,
        await dispatch(normalizeAllowedBrowserOrigin(request, env), env, {
          waitUntil: (promise) => context.waitUntil(promise),
        }),
        env
      );
    } catch (error) {
      const url = new URL(request.url);
      console.error('unhandled error', {
        path: redactAuthRequestPath(url.pathname),
        method: request.method,
        error: sanitizeAuthLogValue(error),
      });
      return withCors(
        request,
        fail(500, 'internal_error', 'Something went wrong. Try again.'),
        env
      );
    }
  },
} satisfies ExportedHandler<Env>;

interface DispatchOptions {
  waitUntil?: (promise: Promise<unknown>) => void;
}

async function dispatch(request: Request, env: Env, options: DispatchOptions = {}): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/health') {
    return ok({ ok: true });
  }

  const mail = resolveAuthMailRuntime(env);

  // The only public app capability route. It exposes booleans only so the forgot-password UI can
  // be honest without revealing which provider or credential is configured.
  if (request.method === 'GET' && path === '/api/email-status') {
    return emailStatus(mail);
  }

  // better-auth owns everything under its base path, including its own method handling.
  if (path === AUTH_BASE_PATH || path.startsWith(`${AUTH_BASE_PATH}/`)) {
    return createAuth(env, { mail, waitUntil: options.waitUntil }).handler(request);
  }

  if (!path.startsWith('/api/')) {
    return fail(404, 'not_found', 'No such route.');
  }

  // --- the single authentication gate -------------------------------------------------------
  const session = await createAuth(env, { mail, waitUntil: options.waitUntil }).api.getSession({
    headers: request.headers,
  });
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

function emailStatus(mail: AuthMailRuntime): Response {
  const response = ok({
    mailConfigured: mail.mailConfigured,
    verificationRequired: mail.verificationRequired,
  });
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

/** `/api/plans/:id` → the id. Anything deeper is not a route. */
function matchPlanId(path: string): string | null {
  const match = /^\/api\/plans\/([^/]+)$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}
