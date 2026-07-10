# Plan generation

> **Status: designed, not built.** No `supabase/functions/generate-plan`,
> `src/lib/planTemplates.ts`, `src/lib/planTypes.ts`, or `src/lib/subscription.ts` exist yet.
> This document describes the design in
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
| Pro | 3 / month | Template skeleton + Claude personalization | Personalized paces, HR zones, warm-ups/drills, coach-style "why" per week |
| Elite | 10 / month | Same skeleton, customized far more heavily — richest prompt | Everything in Pro plus a per-workout "why" and any confirmed extras (mid-plan adjustments, race-day strategy, deeper periodization — **still marked "proposed, confirm" in `planning/02-product-requirements.md`, unconfirmed**, see `docs/mvp-progress.md` "Blocked / awaiting a decision") |

**All three tiers build on the same coach-authored template skeleton. The skeleton is never
removed.** What scales across tiers is how much of the runner the plan reasons about and how much
it explains — never how much of the coach's judgment is taken away.

- **Free**: select and lightly parametrize the skeleton from `src/lib/planTemplates.ts` (planned).
  No AI call at all for this tier; effort *descriptions* only.
- **Pro**: the skeleton supplies the structural shape for the chosen distance/duration; Claude
  personalizes workouts, paces, HR zones, and a weekly "why" within it.
- **Elite**: the same skeleton, customized far more heavily — the richest prompt available (injury
  history, periodization nuance, race context), a per-workout "why", and any confirmed extras.
  Still inside the skeleton.

> Why the skeleton is never removed, even at the top tier: Runna's publicly reported injury cases
> trace to an algorithm that "takes the runner at their word," and Düking et al. 2024 found
> LLM-generated plans were not rated optimal by coaching experts without oversight. Selling the top
> tier as the one with the guardrail removed would be backwards.

## Quotas

Free is 1 plan **total**, not monthly. Pro is 3/month, Elite is 10/month; both reset monthly.
Quotas are always counted **server-side**, inside the edge function, as
`count(plans) where user_id = X and created_at in current period` compared against the tier
limit — never a client-side counter, and never trusted from client input. There is no separate
counter table to drift out of sync with the `plans` table itself.

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
for the endpoint signatures and step-by-step flow (auth → server-side quota check → branch by
tier → structural validation → retry once → fall back to template → insert → return).
