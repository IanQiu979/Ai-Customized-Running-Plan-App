# V2.2 — Engineering Requirements (Part B: How)

> Status: draft (2026-07-07). Stack mirrors Echo V1 deliberately — known tools, cherry-pickable code.

## Tech stack (explicit)

| Layer | Choice | Notes |
|-------|--------|-------|
| App | Expo / React Native + TypeScript, expo-router | Same as Echo V1 |
| Auth | Supabase Auth — **Google OAuth + Sign in with Apple + email/password** | **Required sign-up** (unlike Echo's anon sessions) → real per-user RLS. Apple sign-in included because App Store rules require it when Google sign-in is offered. No guest/anon in v1; guest account deferred to v2. |
| Database | Supabase Postgres | **New Supabase project** — do not share Echo V1's |
| Server logic | Supabase Edge Functions (Deno) | AI calls + quota enforcement live here, never in the client |
| AI | Claude API (claude-sonnet-5) via edge function | API key stays server-side |
| Payments | Dummy (v1) → RevenueCat/StoreKit (v2) | Design `subscriptions` table so swapping in real IAP doesn't need a schema rewrite |
| Email | Supabase built-in auth emails (v1) → dedicated SMTP (Resend/Postmark) before public launch | v1 only needs verification / password-reset / magic-link, all covered by Supabase's default mailer. Swap to a custom SMTP provider before real launch (Supabase's built-in mailer is rate-limited and not for production volume). No marketing/transactional email in v1 (no receipts until real payments in v2). |
| Storage | **None in v1** (Supabase Storage available if needed later) | Plans are JSONB rows, not files. App icons/splash ship in the bundle. Revisit only if v2 adds PDF export → store generated PDFs in a Supabase Storage bucket. |
| Hosting/builds | EAS Build, TestFlight | New Apple bundle ID |

## Architecture

```
app/ (expo-router)
  (auth)/sign-in, sign-up
  (tabs)/index        ← Home / Create plan
  (tabs)/plans        ← My Plans (history)
  intake/             ← onboarding questionnaire (stack)
  plan/[id]           ← plan view
  paywall, settings

lib/
  supabase.ts          ← client init
  planTemplates.ts     ← free-tier hard-coded plans (5K/10K/half/marathon × 8/12/16wk)
  planTypes.ts         ← shared Plan/Week/Workout types
  subscription.ts      ← tier read + dummy purchase (adapted from Echo)

supabase/functions/
  generate-plan/       ← THE core function (below)
```

### `generate-plan` edge function (the heart of the app)

1. Authenticate the user (JWT) — reject anon.
2. Read tier + count plans this period **server-side**; reject over quota (Free 1 total, Pro 3/mo, Elite 10/mo).
3. Branch by tier. **All three tiers build on the same coach-authored template skeleton. The
   skeleton is never removed — it is the safety guarantee and the product's differentiation.**
   What scales across tiers is how much of the runner the plan reasons about, and how much it
   explains. It is never how much of the coach's judgment is taken away.
   - **Free** → select + lightly parametrize the skeleton (no AI call). Effort *descriptions* only.
   - **Pro** → the skeleton + Claude personalizes workouts, paces, HR zones, and a weekly "why"
     *within* it.
   - **Elite** → the same skeleton, customized far more heavily: the richest prompt (injury history,
     periodization nuance, race context), a per-workout "why", and any confirmed extras. Still
     inside the skeleton.

   > Why: Runna's publicly reported injury cases trace to an algorithm that "takes the runner at
   > their word," and Düking et al. 2024 found LLM-generated plans were not rated optimal by coaching
   > experts without oversight. Selling the top tier as the one with the guardrail removed would be
   > backwards.

4. Clamp the result against the deterministic coaching rules in
   [`docs/reference/coaching/load-rules.md`](../docs/reference/coaching/load-rules.md) — the
   weekly volume increase cap, the long-run percentage cap, the **long-run spike cap** (no long
   run may exceed the plan's own previous longest long run generated so far by more than 10%),
   the long-run time cap (~2.5–3 hr), and deload-week volume reduction (35–45%, a band with both
   a floor and a ceiling).
   These run in typed code and apply **identically to all three tiers** — while building the
   template for Free, and as a post-generation clamp on Claude's output for Pro and Elite. The
   model cannot emit an unsafe week, because the code rejects the number before the user sees it.
5. Validate structure → on failure, retry once → on second failure, fall back to the template plan and flag it.
6. Insert into `plans`, return the plan.

**Lesson carried from Echo V1** (`lib/planGenerator.ts`): keep validation *structural*, not
strict-content — over-tight validation caused more bad fallback plans than it prevented.
Difference here: plan quality is the entire paid product, so the hybrid approach (template
skeleton constrains the AI) is the quality guarantee, not the validator.

## API design

The client never talks to Postgres for privileged operations — those go through edge functions.
Plain reads of the user's own rows go through the Supabase client (protected by RLS).

**Edge functions (server, service-role):**

| Method / Route | Auth | Body | Returns | Notes |
|----------------|------|------|---------|-------|
| `POST /functions/v1/generate-plan` | JWT | `{ goalType: "race"\|"duration", raceDistance?, raceDate?, durationWeeks?, notes? }` | `{ plan, planId, isFallback }` or `402` over-quota / `403` anon | The core call. Enforces tier + quota server-side, branches by tier, validates, persists. |
| `POST /functions/v1/purchase-tier` | JWT | `{ tier: "pro"\|"elite", source: "dummy" }` | `{ tier, periodStart, periodEnd }` | v1 dummy flow. v2 swaps `source` to `"revenuecat"` + verifies the receipt — **same route, same table write**, so the client contract never changes. |
| `GET  /functions/v1/quota-status` | JWT | — | `{ tier, used, limit, periodEnd }` | Drives the Home "2 of 3 plans left" UI. Computed from `count(plans)`, never a client counter. |

**Direct Supabase-client reads (RLS-guarded, `user_id = auth.uid()`):**

| Operation | Table | Notes |
|-----------|-------|-------|
| Read/write own intake answers | `intake_responses` | Upsert on the intake screen. |
| List own plans | `plans` | My Plans tab. Select-only from client; inserts happen only inside `generate-plan`. |
| Read own subscription | `subscriptions` | Cosmetic UI state; the source of truth is enforced server-side. |

**Conventions for all edge functions:** JSON in / JSON out; authenticate the JWT first and
reject anon before any work; return structured `{ error, code }` on failure (never a bare 500
with a stack trace); all tier/quota logic lives here and is never trusted from the client.

## DB schema (draft)

```sql
profiles          (id → auth.users, created_at, display_name)
intake_responses  (user_id, goal, age, experience, days_per_week, weekly_km,
                   race_distance, race_date, goal_time_sec,
                   recent_perf_distance, recent_perf_time_sec,
                   injuries, injury_notes, updated_at)
  -- age required: max HR = 220 - age; 50+ forces a 3-week deload cadence
  -- goal_time_sec        drives RACE-PACE sessions ONLY. Never everyday training paces.
  -- recent_perf_*        drives EVERY training pace. Absent -> the plan emits no numeric
  --                      paces at any tier, only effort language. This is why the "readout
  --                      bracket" in the design can never render a lie.
  -- injuries             closed-set flags. These, and only these, drive the safety rules.
  -- injury_notes         free text. Context for the model on paid tiers. Never gates safety.
subscriptions     (user_id, tier free|pro|elite, period_start, period_end,
                   source dummy|revenuecat)          -- source column = painless v2 swap
plans             (id, user_id, tier_at_generation, engine template|hybrid|ai,
                   goal_type race|duration, race_date, duration_weeks,
                   plan jsonb, is_fallback bool, created_at)
```

- Quota check = `count(plans) where user_id = X and created_at in current period` vs tier limit.
  No separate counter table to drift out of sync.
- **RLS on every table**: `user_id = auth.uid()` for select/insert own rows. Tier/quota writes
  only via edge functions (service role) — the client can never write its own tier.

## Security requirements

- Anthropic key only in edge function env — never shipped in the app bundle.
- Quota + tier enforcement server-side only; client UI state is cosmetic.
- Dummy payment must not be a client-side flag that unlocks tier — even the dummy flow goes
  through an edge function that sets `subscriptions`, so v2's real IAP slots into the same path.

## Conventions & best practices (for Claude to follow while building)

Solo project, but pinning these so the build stays consistent:

- **TypeScript strict** everywhere; shared types (`Plan`, `Week`, `Workout`, `Tier`) live in
  `lib/planTypes.ts` and are imported by both the app and the edge functions — one source of truth.
- **expo-router** file-based routing; screens are thin, logic lives in `lib/`.
- **No business rules in the client.** Tier, quota, and plan generation are server-only. The
  client may *display* tier state but must never be the authority for it.
- **Server-side validation is structural, not strict-content** (the Echo `planGenerator.ts`
  lesson) — validate shape, retry once, then fall back to a template.
- **Theme tokens only** — no hardcoded colors/spacing in components; use `constants/theme.ts`
  (new PACE-family palette).
- **Secrets** live in edge-function env / EAS secrets — never in the repo or the app bundle.
- **Migrations** are checked into `supabase/migrations/`; the live DB is never hand-edited.

## Infrastructure to provision (before coding)

- [ ] New Supabase project (name: `v22-plan-builder` or final app name) — enable **Google OAuth + Sign in with Apple + email/password** auth (set up Google OAuth client ID/secret and Apple Services ID/key; guest/anon deferred to v2)
- [ ] Anthropic API key (separate key from Echo, for usage tracking per app)
- [ ] Apple Developer: new bundle ID
- [ ] EAS project (`eas init`)
- [ ] New GitHub repo (this folder)

## Explicitly reused from Echo V1 (cherry-pick, don't fork)

- Onboarding question set + intake screen patterns
- `constants/theme.ts` design-token approach (new palette — this is a PACE-family app, not Echo)
- `lib/subscription.ts` tier/dummy-payment pattern
- Plan-generation prompt + structural validation learnings from `lib/planGenerator.ts`

Echo V1's repo is frozen — copy from it, never into it.
