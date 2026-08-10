# Plan generation

> **Status: the pure shared plan layer is built and canonical** — `planTypes.ts`,
> `loadRules.ts`, `paceDerivation.ts`, and `planTemplates.ts` exist, and when this document and the
> types disagree, the types win. The `generate-plan` **endpoint** also exists, on Cloudflare
> Workers (`workers/`, 2026-08-02 — the backend is Cloudflare, not Supabase; see
> [`docs/architecture.md`](../architecture.md)): all eleven steps below are implemented and tested,
> and the quota, idempotency, validation, and fallback rules on this page are live. As of
> 2026-08-04, `workers/src/deps.ts` binds the skeleton builder to that plan engine
> (`createTemplateSkeletonBuilder()`), so the endpoint returns a real plan for Free (and, as a
> template fallback, Pro/Elite). **As of 2026-08-10, the Pro/Elite personalization prompt (step 7)
> is also bound** — `workers/src/lib/planPersonalizationPrompt.ts`, wired into `deps.ts`'s second
> swap — but it is deliberately narrower than the "one representative week per phase + deterministic
> expander" design this section originally sketched; see "The generation pipeline" step 7 below for
> what actually shipped and why. It has never made a live Anthropic call: no `ANTHROPIC_API_KEY`
> exists anywhere yet (`docs/mvp-progress.md`'s "Blocked / awaiting a decision"), so every Pro/Elite
> generation today still serves the template plan as a quota-exempt fallback, exactly as designed
> for "the backend not being finished." This document describes the design in
> [`planning/02-product-requirements.md`](../../planning/02-product-requirements.md) and
> [`planning/03-engineering-requirements.md`](../../planning/03-engineering-requirements.md).
> See [`docs/architecture.md`](../architecture.md) for how it fits the rest of the system and
> [`docs/mvp-progress.md`](../mvp-progress.md) for what's actually shipped.

Plan generation is the entire product — this app does one thing: turn intake answers into a
training plan. It is a single server route, `POST /api/generate-plan` on Cloudflare Workers, that
branches into one of three engines by the caller's subscription tier.

## Coaching source of truth

All three tiers produce plans built from the same ported, cited coaching rules in
[`docs/reference/coaching/`](coaching/00-README.md) — never from a model's general knowledge and
never invented ad hoc (`CLAUDE.md` "Coaching domain"). The volume caps, deload cadence, long-run
caps (including the new long-run spike cap), and injury red-flag triage in
[`docs/reference/coaching/load-rules.md`](coaching/load-rules.md) are deterministic and run in
typed code, not a prompt, and they apply **identically to all three tiers**. Free's template
engine applies them while selecting/filling the template. Pro and Elite both build on that same
coach-authored template skeleton — it is never removed — so the same deterministic rules **clamp
Claude's output** after generation for both of them; a model must never be able to prescribe an
unsafe week, a deload that doesn't actually reduce volume, or intervals through a declared
red-flag injury, at any tier. See
[`docs/reference/coaching/plan-structure.md`](coaching/plan-structure.md) for the design rule
(captain ruling, 2026-08-03) that a declared red-flag injury still produces a normal,
volume-adjusted plan — the same mechanism as any other declared injury — with a strengthened
professional-evaluation disclaimer, never a refusal and never a distinct return-to-running
protocol.

## The three tiers

| Tier | Plans | Engine | Quality |
|---|---|---|---|
| Free | 1 total | Template only — no AI call | Basic hard-coded plan for the chosen distance/duration |
| Pro | 3 / period | Template skeleton + Claude personalization | Personalized paces, HR zones, warm-ups/drills, coach-style "why" per week |
| Elite | 10 / period | Same skeleton, customized far more heavily — richest prompt | Everything in Pro plus a per-workout "why" — the richest personalization prompt, nothing more. **Extras (mid-plan adjustment, race-day strategy, deeper periodization) are cut for MVP (decision, 2026-07-10)**; `Plan.extras` (`PlanSection[]`) can carry them later without a schema change. |

**All three tiers build on the same coach-authored template skeleton. The skeleton is never
removed.** What scales across tiers is how much of the runner the plan reasons about and how much
it explains — never how much of the coach's judgment is taken away.

- **Free**: select and lightly parametrize the skeleton from `src/lib/planTemplates.ts`.
  No AI call at all for this tier; effort *descriptions* only.
- **Pro**: the skeleton supplies the structural shape for the chosen distance/duration; Claude
  personalizes workouts, paces, HR zones, and a weekly "why" within it.
- **Elite**: the same skeleton, customized far more heavily — the richest prompt available (injury
  history, periodization nuance, race context) and a per-workout "why". Still inside the
  skeleton. Extras are cut for MVP (decision, 2026-07-10) — see the tiers table above.

> Why the skeleton is never removed, even at the top tier: Runna's publicly reported injury cases
> trace to an algorithm that "takes the runner at their word," and Düking et al. 2024 found
> LLM-generated plans were not rated optimal by coaching experts without oversight. Selling the top
> tier as the one with the guardrail removed would be backwards.

## The generation pipeline

All eleven steps run inside the single `generate-plan` route, in order. The orchestration is
`workers/src/lib/generate-plan-flow.ts`, written with every dependency injected so each branch below
is unit-tested with no network and no Anthropic spend:

1. **Auth** — verify the session, reject anonymous requests. This happens once, ahead of dispatch,
   so no route can be reached anonymously.
2. **Idempotency replay** — `GeneratePlanRequest.idempotencyKey` is minted client-side when the
   configure modal opens. A duplicate `(user_id, idempotency_key)` returns the existing plan
   instead of generating again — this is what makes a network-timeout retry safe.
3. **Atomic quota gate** — the single conditional insert described under "Quotas" below.
4. **Reconcile plan length** — a race farther out than the tier's max plan length gets a delayed
   start so the taper lands on race day (ported from Echo V1's `reconcilePlanLength`); a
   compressed race gets an honest, short plan. **Never refuse.** A declared red-flag injury
   produces a normal, volume-adjusted plan with a strengthened disclaimer (see "Coaching source of
   truth" above), not a rejection, and does not consume quota.
5. **Build the parametric template skeleton** — from `planTemplates.ts` and the coaching docs:
   phases, deload cadence, weekly volumes under `loadRules.ts` caps, workout primitives from
   `workout-library.md`, Day 1–7 slots with real rest days.
6. **Free tier stops here.** Template + effort descriptions. No AI call, ever.
7. **Pro/Elite — one Claude call** (`claude-sonnet-5`, verified live 2026-07-10). **SHIPPED
   2026-08-10, in a deliberately narrower shape than the paragraph below originally sketched** —
   read the correction first, then the original design intent it replaces.

   **What actually shipped** (`workers/src/lib/planPersonalizationPrompt.ts`): the skeleton
   already carries every number for Pro/Elite. `createTemplateSkeletonBuilder()` builds it at
   `density: 'paid'` for both tiers, which means paces (only if a recent time exists — otherwise no
   numeric pace at any tier), HR zones (adults) or RPE (under-18, `loadRules.ts`'s `rpeForZone`,
   §6-A), and every distance are already computed and already clamped by `loadRules.ts` before the
   model is ever called. So the model is asked for exactly one thing — prose — via a forced tool
   call whose schema contains no numeric field: a `coachIntro`, a `why` per week, and (Elite only) a
   `why` per workout. `mergePersonalization()` then copies only those strings onto the skeleton,
   matched by `weekNumber`/`dayIndex`; every structural and numeric field is copied unchanged. This
   makes the safety property stronger than "the model's numbers get clamped after the fact" — there
   is no code path by which the model's answer can carry a number at all, clamped or not.

   **What this replaces — the original sketch, not implemented:** "Claude personalizes one
   representative week per phase, not all 24–30 weeks... a brevity mandate, a `max_tokens` ceiling,
   a forced tool call, streaming so the server isn't CPU-killed mid-response, truncation detection,"
   with a deterministic expander (step 8, below) materializing every calendar week from the
   representative ones. That design existed to fit a whole week's *structure* into one response
   cheaply. Because the shipped design never asks the model for structure at all — only text — the
   token-budget problem that motivated "one representative week + expander" mostly does not arise
   here (`computeMaxTokens()` scales with `durationWeeks` and stays well under a normal ceiling even
   for a full-length plan), so the extra machinery of an expander was not built. Streaming was not
   added either, for the same reason: a prose-only response is far smaller than a fully
   restructured plan.

   Model output carrying `hrZone` for an under-18 runner cannot occur under the shipped design — the
   schema has no `hrZone` field for the model to emit in the first place, which is a stronger
   guarantee than the strip/convert step this paragraph originally called for.
8. **Deterministic expander** — typed code materializes every calendar week from the
   representative weeks, scaling distances along the phase's load curve (Echo V1's expander is
   the reference).
9. **Clamp** — `loadRules.ts` re-checks every week (weekly increase cap, deload band 35–45%,
   long-run share/spike/time caps), identically across all three tiers.
10. **Validate structurally, loosely; retry once; fall back.** See "Validation" below. A second
    failure falls back to the pure template plan, `is_fallback: true`, rendered at **Free
    density** — a template has no "why"; fabricating one would lie.
11. **Settle** the `plans` row reserved at step 3 (immutable once settled — enforced by a database
    trigger, since SQLite has no per-operation grants — carrying `tier_at_generation`, `engine`,
    `is_fallback`, `idempotency_key`) and return `{ plan, planId, isFallback, quotaConsumed }` —
    `quotaConsumed` tells the client whether this fallback counted against the tier limit or landed
    inside the quota-exempt cap, so `FallbackNotice` can pick `counted` vs `exempt` instead of
    hardcoding one variant. A reservation is settled or released on **every** exit path, including
    an unexpected throw: a quota slot held by a crashed generation is a bug the user can neither see
    nor work around.

## Quotas

Free is 1 plan **total**, not monthly. Pro is 3/period, Elite is 10/period. Periods are **not**
calendar months: they're computed **arithmetically at read time** from the purchase-day anchor
(e.g. May 26 → June 26, clamped at month end: Jan 31 → Feb 28 → Mar 31), by one pure shared
function `currentPeriod(anchorDate, now)` used by both `generate-plan` and `quota-status`. No
cron, no rollover write. A user with no `subscriptions` row is `free`.

The check itself is **one atomic statement**, not a bare `count(plans)` read followed by an
insert — a count-then-insert has a TOCTOU race with a window as wide as the generation itself
(tens of seconds). It checks the tier limit, counts **non-fallback** plans (`is_fallback = false`)
in the current period, and reserves the slot in a single write — N concurrent requests at 2-of-3
quota must yield exactly one success, which `workers/test/store.test.ts` asserts directly with
eight concurrent reservations against a three-slot limit. There is no separate counter table to
drift out of sync with the `plans` table itself. Quotas are always enforced **server-side**, never
a client-side counter, and never trusted from client input.

On Postgres this needed a `SECURITY DEFINER` RPC holding `pg_advisory_xact_lock`; on D1 (SQLite) a
single conditional `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < limit` is sufficient, for
reasons written out in `docs/architecture.md` and in `workers/migrations/0002_app_schema.sql`'s
header. The *rule* is unchanged; only its mechanism is.

**Fallback plans are quota-exempt (decision, 2026-07-10).** `is_fallback: true` rows are excluded
from the count in both `generate-plan` and `quota-status`, capped at **3 quota-exempt fallbacks
per period** so the free-text `notes` field can't be used to farm unlimited template plans (each
attempt still costs up to 2 Claude calls before falling back). `notes` and `injury_notes` are
length-limited and sanitized for the same reason. **Past the 3-per-period cap (addendum R-B,
2026-07-10): a 4th+ fallback in the same period keeps the already-reserved quota slot instead of
being excluded** — nobody is refused a plan, but that attempt counts against quota like any other.

## Validation: structural, not strict-content

This is a lesson carried forward from Echo V1's `lib/planGenerator.ts`: validating AI output
against tight content rules produced *more* bad fallback plans than it prevented, because a
plan can be substantively fine while still failing a narrow content check. The validator here
checks shape only — does the JSON have the expected weeks/workouts fields, are the types right
— and the flow is:

1. Validate structure.
2. On failure, retry the generation once.
3. On a second failure, fall back to the matching template plan and mark it
   `is_fallback: true`.

The quality guarantee is the hybrid template-skeleton approach itself — constraining Claude's
output to a known-good structure before it ever reaches the user — not the validator. This applies
equally to Pro and Elite: both build on the same skeleton, so both go through the identical
generate → validate → retry → fall-back-to-template flow. The validator's job is only to catch
outright malformed responses, not to judge quality.

## Model and key handling

Model: `claude-sonnet-5`. Called only from the `generate-plan` route on Cloudflare Workers — never
from the client. `ANTHROPIC_API_KEY` is read in exactly one file, `workers/src/lib/model.ts`,
reached from exactly one file, `workers/src/deps.ts`. It lives in `workers/.dev.vars` (gitignored)
for local development and is pushed to production with `wrangler secret put ANTHROPIC_API_KEY` —
the direct analogue of `supabase secrets set`, and likewise still unpushed, because it needs the
captain's own `wrangler login`. It must never carry an `EXPO_PUBLIC_` prefix, appear in the app
bundle, or land in `wrangler.toml`, which is committed. Full policy: `CLAUDE.md` "Secrets & env"
and [`workers/README.md`](../../workers/README.md).

**No key is configured anywhere today, and the code is built for that state rather than broken by
it.** With no key, the model caller returns a typed `not_configured` failure, which the pipeline
already handles as step 10's fallback: the runner gets the real template plan marked
`is_fallback: true`, which is quota-exempt. Nobody is charged a plan slot for the backend being
unfinished, and nothing fabricates a personalized plan it cannot produce.

## Request/response contract

See `docs/architecture.md`, "Current — `generate-plan`, and what is still missing from it" and
"Current — API",
for the endpoint signatures. The step-by-step flow is "The generation pipeline" above (auth →
idempotency replay → atomic quota gate → reconcile plan length → build skeleton → Free stops /
Pro-Elite AI call → expand → clamp → validate → retry once → fall back to template → insert →
return).
