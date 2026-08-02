# Plan generation

> **Status: the pure shared plan layer is built and canonical** — `planTypes.ts`,
> `loadRules.ts`, `paceDerivation.ts`, and `planTemplates.ts` exist, and when this document and the
> types disagree, the types win. `supabase/functions/generate-plan` and `src/lib/subscription.ts`
> are still designed, not built. This document describes the design in
> [`planning/02-product-requirements.md`](../../planning/02-product-requirements.md) and
> [`planning/03-engineering-requirements.md`](../../planning/03-engineering-requirements.md).
> See [`docs/architecture.md`](../architecture.md) for how it fits the rest of the system and
> [`docs/mvp-progress.md`](../mvp-progress.md) for what's actually shipped.

Plan generation is the entire product — this app does one thing: turn intake answers into a
training plan. It is a single edge function, `generate-plan`, that branches into one of three
engines by the caller's subscription tier.

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
[`docs/reference/coaching/plan-structure.md`](coaching/plan-structure.md) for the design rule that
a declared red-flag injury still produces a plan — the return-to-running protocol in
[`docs/reference/coaching/injury-rules.md`](coaching/injury-rules.md), never a refusal.

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

All eleven steps run inside the single `generate-plan` edge function, in order:

1. **Auth** — verify the JWT, reject anonymous requests.
2. **Idempotency replay** — `GeneratePlanRequest.idempotencyKey` is minted client-side when the
   configure modal opens. A duplicate `(user_id, idempotency_key)` returns the existing plan
   instead of generating again — this is what makes a network-timeout retry safe.
3. **Atomic quota gate** — the SECURITY DEFINER RPC described under "Quotas" below.
4. **Reconcile plan length** — a race farther out than the tier's max plan length gets a delayed
   start so the taper lands on race day (ported from Echo V1's `reconcilePlanLength`); a
   compressed race gets an honest, short plan. **Never refuse.** A declared red-flag injury
   produces the return-to-running protocol as a plan (see "Coaching source of truth" above), not
   a rejection, and does not consume quota.
5. **Build the parametric template skeleton** — from `planTemplates.ts` and the coaching docs:
   phases, deload cadence, weekly volumes under `loadRules.ts` caps, workout primitives from
   `workout-library.md`, Day 1–7 slots with real rest days.
6. **Free tier stops here.** Template + effort descriptions. No AI call, ever.
7. **Pro/Elite — one Claude call** (`claude-sonnet-5`, verified live 2026-07-10). The skeleton
   goes into the prompt as the fixed structure; Claude personalizes **one representative week per
   phase**, not all 24–30 weeks — a full plan does not fit a single model response. Ported from
   Echo V1's token strategy: a brevity mandate, a `max_tokens` ceiling, a **forced tool call** for
   guaranteed JSON, **SSE streaming** so the edge function isn't CPU-killed mid-response, and
   truncation detection. Personalization is paces (**only if a recent time exists — otherwise no
   numeric pace is emitted at any tier**), HR zones (from age), warm-ups/drills, a weekly "why"
   (Pro) or per-workout "why" (Elite).
8. **Deterministic expander** — typed code materializes every calendar week from the
   representative weeks, scaling distances along the phase's load curve (Echo V1's expander is
   the reference).
9. **Clamp** — `loadRules.ts` re-checks every week (weekly increase cap, deload band 35–45%,
   long-run share/spike/time caps), identically across all three tiers.
10. **Validate structurally, loosely; retry once; fall back.** See "Validation" below. A second
    failure falls back to the pure template plan, `is_fallback: true`, rendered at **Free
    density** — a template has no "why"; fabricating one would lie.
11. **Insert** the `plans` row (immutable JSONB — no update/delete RLS grant — carrying
    `tier_at_generation`, `engine`, `is_fallback`, `idempotency_key`) and return
    `{ plan, planId, isFallback }`.

## Quotas

Free is 1 plan **total**, not monthly. Pro is 3/period, Elite is 10/period. Periods are **not**
calendar months: they're computed **arithmetically at read time** from the purchase-day anchor
(e.g. May 26 → June 26, clamped at month end: Jan 31 → Feb 28 → Mar 31), by one pure shared
function `currentPeriod(anchorDate, now)` used by both `generate-plan` and `quota-status`. No
cron, no rollover write. A user with no `subscriptions` row is `free`.

The check itself is a **SECURITY DEFINER RPC**, not a bare `count(plans)` read followed by an
insert — a count-then-insert has a TOCTOU race with a window as wide as the generation itself
(tens of seconds). The RPC checks the tier limit, counts **non-fallback** plans
(`is_fallback = false`) in the current period, and reserves the slot atomically in one
transaction — N concurrent requests at 2-of-3 quota must yield exactly one success. There is no
separate counter table to drift out of sync with the `plans` table itself. Quotas are always
enforced **server-side**, never a client-side counter, and never trusted from client input.

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

Model: `claude-sonnet-5`. Called only from the `generate-plan` edge function (Deno, Supabase
Edge Functions) — never from the client. `ANTHROPIC_API_KEY` lives in edge-function secrets
(`supabase secrets set`, not yet pushed — see `docs/mvp-progress.md` "Known debt and risks") and in
`supabase/functions/.env` for local development; it must never carry an `EXPO_PUBLIC_` prefix
or appear in the app bundle. Full policy: `CLAUDE.md` "Secrets & env".

## Request/response contract

See `docs/architecture.md`, "Planned — `generate-plan` edge function flow" and "Planned — API",
for the endpoint signatures. The step-by-step flow is "The generation pipeline" above (auth →
idempotency replay → atomic quota gate → reconcile plan length → build skeleton → Free stops /
Pro-Elite AI call → expand → clamp → validate → retry once → fall back to template → insert →
return).
