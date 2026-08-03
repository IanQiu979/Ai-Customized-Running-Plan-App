/**
 * The Anthropic call, behind an injectable seam.
 *
 * CONVENTION. This is the PACE family's existing split, not a new one: the sibling repo
 * `running-form-v2.3` keeps `supabase/functions/analyze-form/flow.ts` (pure orchestration, deps
 * injected, unit-testable) apart from `deps.ts` (the only file that reads `ANTHROPIC_API_KEY` and
 * the only one that can make a network call). Its `deps.ts` header states the reason plainly:
 * that split is what keeps the orchestration testable "with zero network and, crucially, ZERO
 * ANTHROPIC SPEND." Same split here, same reason. `generate-plan-flow.ts` is this repo's
 * `flow.ts`; `deps.ts` is its `deps.ts`.
 *
 * THE MISTAKE THIS FILE IS SHAPED TO AVOID. That same sibling repo shipped issue #128: a mock
 * client was bound as the *production* implementation on the theory that a later task would swap
 * it, the swap had no owner, and every upload in the real app silently dead-ended for weeks
 * because the mock wrote no database row. So, here:
 *   - the production default is `createUnconfiguredModelCaller()`, which **fails** — it does not
 *     pretend to generate anything;
 *   - a failing model call is already a first-class path in the pipeline (validate → retry → fall
 *     back to template), so "not configured" degrades into an honest template plan rather than
 *     into a fabricated one;
 *   - `createStubModelCaller()` exists for tests and local exploration and **throws outside a
 *     test/dev run**, so it cannot quietly become production;
 *   - `createAnthropicModelCaller()` is the real transport and is unreachable until a key exists.
 *
 * NO LIVE CALL IS MADE BY ANYTHING IN THIS BRANCH. No `ANTHROPIC_API_KEY` is set locally, in
 * `wrangler.toml`, or in any test, so `createAnthropicModelCaller` is never constructed.
 */

/**
 * An Anthropic Messages API request body, passed through opaquely.
 *
 * This file deliberately does NOT know how to build one. The Pro/Elite prompt — brevity mandate,
 * forced tool call for guaranteed JSON, one representative week per phase — is a separate,
 * coaching-sensitive piece of work (`docs/reference/plan-generation.md` step 7, tracked as its own
 * issue) and inventing it here would mean inventing training content, which `CLAUDE.md`'s
 * "Coaching domain" forbids. This module owns transport, timeouts, and error typing. Nothing else.
 */
export interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  [key: string]: unknown;
}

export interface AnthropicMessagesResponse {
  stop_reason?: string | null;
  content?: unknown;
  [key: string]: unknown;
}

export type ModelCallResult =
  | { ok: true; response: AnthropicMessagesResponse }
  | { ok: false; kind: 'timeout' | 'error' | 'not_configured'; message: string };

export interface ModelCaller {
  /** NEVER throws. Every failure comes back typed — see the note on `createAnthropicModelCaller`. */
  send(request: AnthropicMessagesRequest, timeoutMs: number): Promise<ModelCallResult>;
}

/** Verified against the Messages API docs; the version header is required on every request. */
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** A provider error message must never reach a user-facing body or an unbounded log line. */
const MAX_ERROR_SNIPPET = 500;

/**
 * The real transport. **Not reachable in this branch** — `resolveModelCaller` only builds it when
 * `ANTHROPIC_API_KEY` is present, and it is present nowhere: not in `wrangler.toml` (committed),
 * not in `.dev.vars` (which does not exist here, only `.dev.vars.example`), not in any test.
 *
 * FOLLOW-UP OWNED BY THE CAPTAIN — the exact analogue of Supabase's `supabase secrets set`:
 *   local:      add `ANTHROPIC_API_KEY=sk-ant-...` to `workers/.dev.vars` (gitignored)
 *   production: `wrangler secret put ANTHROPIC_API_KEY`  (needs `wrangler login` first)
 * Both require the captain's own Anthropic and Cloudflare accounts. No key is fabricated here.
 *
 * NEVER THROWS, on purpose: `generate-plan-flow.ts` must be able to release its quota reservation
 * on the way out of a failure, and an exception thrown through it is one more path that could
 * forget to.
 */
export function createAnthropicModelCaller(apiKey: string): ModelCaller {
  return {
    async send(request, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, MAX_ERROR_SNIPPET);
          return { ok: false, kind: 'error', message: `Anthropic returned ${res.status}: ${detail}` };
        }

        return { ok: true, response: (await res.json()) as AnthropicMessagesResponse };
      } catch (err) {
        if (controller.signal.aborted) {
          return { ok: false, kind: 'timeout', message: `Anthropic call exceeded ${timeoutMs}ms` };
        }
        return {
          ok: false,
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * The production default while no key is configured.
 *
 * It fails rather than fabricating, and the pipeline's existing fallback path turns that failure
 * into a real template plan marked `isFallback: true` — which is quota-exempt, so a user is never
 * charged a plan slot for the backend not being finished. That is the difference between "degrades
 * honestly" and "silently serves a lie".
 */
export function createUnconfiguredModelCaller(): ModelCaller {
  return {
    async send() {
      return {
        ok: false,
        kind: 'not_configured',
        message: 'ANTHROPIC_API_KEY is not set; serving the template plan instead.',
      };
    },
  };
}

/**
 * A canned success, for tests and local exploration of the paid-tier branch.
 *
 * GUARDED. It throws unless something in the environment says this is a test or development run,
 * so it can never be the thing answering a real user — the concrete failure mode of the sibling
 * repo's issue #128.
 */
export function createStubModelCaller(response: AnthropicMessagesResponse): ModelCaller {
  return {
    async send() {
      if (!isNonProductionRun()) {
        throw new Error(
          'createStubModelCaller() was called outside a test or development run. It exists to ' +
            'exercise the paid-tier branch without spending Anthropic budget, and must never ' +
            'serve a real request.'
        );
      }
      return { ok: true, response };
    },
  };
}

function isNonProductionRun(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.NODE_ENV === 'test' || env?.NODE_ENV === 'development' || env?.VITEST === 'true';
}

/**
 * The one place that decides which caller a request gets.
 *
 * Reading `ANTHROPIC_API_KEY` happens HERE and nowhere else in the Worker, so the answer to "where
 * can the key leak from?" is a single file.
 */
export function resolveModelCaller(apiKey: string | undefined): ModelCaller {
  return apiKey ? createAnthropicModelCaller(apiKey) : createUnconfiguredModelCaller();
}
