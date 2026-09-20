@AGENTS.md

## What this is

V2.2 — **Pace Blueprint** (name decided 2026-07-12, see `docs/change_log.md`). An Expo/React
Native app, part of the PACE family (sibling to V2.3 "Pace AnalysisAI"): it turns a runner's
intake answers into a tiered, week-by-week training plan and does nothing else — no logging,
no chat, no coach messaging. Full spec: [`planning/README.md`](planning/README.md) and the
linked brainstorm / product / engineering docs it indexes.

## Architecture at a glance

Client: Expo SDK 57, expo-router, TypeScript strict. **Backend: Cloudflare — D1 + Workers +
better-auth, in [`workers/`](workers/README.md)** (captain's decision, 2026-08-02; `supabase/` and
`src/lib/supabase.ts` are dead scaffold, kept but unused). AI: Claude (`claude-sonnet-5`), called
only from the `generate-plan` route, never from the client. The backend spine works end to end
against `wrangler dev` locally — auth, the quota ledger, `quota-status`, `purchase-tier`,
`delete-account`, intake, plan reads, and `generate-plan`'s free-tier deterministic template
engine (`src/lib/planTemplates.ts`) — and **it is deployed** as wrangler's named `production`
environment, live at `https://pace-blueprint-production.i78979848.workers.dev` (confirmed by
`curl` 2026-08-09). Both plan-engine seams are bound (template skeleton 2026-08-04, Pro/Elite
personalizer 2026-08-10); the remaining gap is `ANTHROPIC_API_KEY`, unset everywhere, so paid-tier
requests still receive the quota-exempt template fallback. On the client side, `src/lib/apiClient.ts`
(better-auth's Expo client plus typed fetch wrappers for the other `/api/*` routes),
`src/app/(auth)/onboarding.tsx`, `sign-in.tsx`/`sign-up.tsx`, the intake screen (which, since 2026-09-20, also owns
the generate-plan action — its "Create plan" saves and generates in one press; Home asks nothing), the plan
view (real plans plus the permanent example-plan fixture), and the My Plans list all exist, and
`src/app/_layout.tsx` gates the whole app behind a session — email/password works in production,
and the Google provider is registered there as of 2026-08-09 (registration only; a real end-to-end
Google sign-in has never run) — it was dead until then because
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were never set on the deployed Worker
(`sign-in/social` answered `PROVIDER_NOT_FOUND`); the captain set both with
`wrangler secret put … --env production`. See `docs/mvp-progress.md`'s "Current state" for what is
and isn't proven live, its "Blocked / awaiting a decision" for the captain-only items, and
`AGENTS.md`'s guardrail on the `production` environment name. Route tree, `lib/` layout, the
`generate-plan` flow, the API table, the D1 schema, and the proposed visual direction all live in
[`docs/architecture.md`](docs/architecture.md).

## Commands

| Command | Does |
|---|---|
| `npm start` | `expo start` |
| `npm run ios` / `npm run android` / `npm run web` | `expo start --ios` / `--android` / `--web` |
| `npm run typecheck` | `npm run routes:generate && tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm test` | `jest` |
| `npm --prefix workers run dev` | `wrangler dev` — the backend, locally, no Cloudflare account needed |
| `npm --prefix workers run db:migrate:local` | apply `workers/migrations/` to the local D1 |
| `npm --prefix workers run typecheck` / `test` | the backend's own gate (`tsc`, then vitest in real `workerd`) |

Run `npm run typecheck && npm run lint && npm test` clean before every commit. **If the commit
touches `workers/`, also run `npm --prefix workers run typecheck && npm --prefix workers test`** —
the root gate deliberately excludes that directory (different runtime, different type system,
different runner), so it will pass while the backend is broken.

## Secrets & env — read this before touching any env file

- `.env` (gitignored) holds `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `EXPO_PUBLIC_API_BASE_URL` (the `workers/` origin `src/lib/apiClient.ts` talks to). `.env.example`
  is the committed template — copy it, never edit it in place. **The two Supabase vars are legacy
  since 2026-08-02** and exist only because `src/lib/supabase.ts` still throws at import without
  them; they go when that file is deleted. Server-side config now lives in `workers/` — see the two
  bullets below.
- Anything prefixed `EXPO_PUBLIC_` is inlined in **plain text** into the compiled app bundle by
  Expo. Treat it as public. Always read it with static dot notation
  (`process.env.EXPO_PUBLIC_X`) — the `expo/no-dynamic-env-var` lint rule enforces this;
  destructuring or bracket access silently yields `undefined`.
- `ANTHROPIC_API_KEY` must NEVER get an `EXPO_PUBLIC_` prefix and must NEVER go in `.env`. It
  lives in `workers/.dev.vars` (gitignored, local dev; `.dev.vars.example` is the template) and is
  pushed to production with `wrangler secret put ANTHROPIC_API_KEY` — not done yet, see
  `docs/mvp-progress.md`. It is read in exactly one file, `workers/src/lib/model.ts`.
- **`workers/wrangler.toml` is committed, so it is the Cloudflare equivalent of the
  `EXPO_PUBLIC_` trap.** `[vars]` there is public configuration only. Every secret goes to
  `.dev.vars` locally and `wrangler secret put` in production. `BETTER_AUTH_SECRET` included.
- Google OAuth client id/secret live in `.dev.vars` / `wrangler secret put`, never in a committed
  file. Apple sign-in is parked entirely (`docs/apple-dev-blocked.md`).
- `RESEND_API_KEY` and `MAIL_FROM` (transactional mail for password reset / email verification,
  issue #94) follow the same rule — `.dev.vars` locally, `wrangler secret put … --env production`
  live, captain-only. Both blank means mail is off and the app says so; the runbook is
  [`docs/email-setup.md`](docs/email-setup.md).

## Git etiquette

Solo repo — commit directly to `main` by default. Branch (`feat/<slug>` or `fix/<slug>`) and
open a PR via the `github-ops` subagent when a change is multi-file, touches
auth/payments/RLS/edge functions, or is something worth a review pass. Never commit without a
clean `typecheck && lint && test`. Never force-push without explicit user approval.

## Code conventions

- TypeScript strict everywhere (already on in `tsconfig.json`).
- Theme tokens only — no hardcoded colors or spacing in components; use
  `src/constants/theme.ts`. It holds the **"Blueprint"** token system (2026-09-14 — the captain's
  own `V22 theme.md` sheet from the design handoff, replacing "Instrument" of 2026-09-03): one
  near-black field, rendered as the **dark scheme only** (the light palette is kept but
  `use-theme.ts` never resolves to it), ink for every heading, number and the primary button's
  fill, a dim grey for labels and units, and exactly TWO session colours — easy green and hard
  orange — applied to bars and tiles, never to text or chrome. There is no second highlight
  colour anywhere. Source of truth for every value: the "Blueprint" section of
  [`docs/design/instrument-visual-system.md`](docs/design/instrument-visual-system.md); see also
  `docs/architecture.md`'s "Current — visual direction". **Never edit a hex there without
  re-verifying contrast** — and note that rule has teeth:
  `src/constants/__tests__/theme.contrast.test.ts` recomputes every ratio from the hexes and
  asserts it against its **floor** (and, for `progress.disabled`, which is deliberately below the
  floor, against a ceiling), so a hex that breaks legibility fails the suite instead of shipping.
  It does NOT pin the exact documented numbers — that is deliberate, so a legitimate re-tune is not
  a test edit — which means re-running the table and updating the comments is still a human step (the
  ratios were documented-only under Trailhead and drifted anyway — issue #70).
- The primary CTA's shape is `src/components/ui/ActionButton.tsx`'s `PrimaryAction` (or
  `RevealPrimaryAction`, the same slab drawing itself in), and nothing else may paint
  `Accent.fill`. "One accent per screen" is therefore a question about imports, not a review of
  eight hand-rolled stylesheets.
- **Motion is "the plan builds itself"**, and its numbers are the captain-approved pages', not
  yours: every build animation derives from one clock in seconds through `src/lib/buildMotion.ts`
  (cue tables, easings, the 350 ms snap) and renders `src/lib/weekStrip.ts`'s strip shape. Read
  [`docs/design/build-animations.md`](docs/design/build-animations.md) before adding or changing
  one. The heartbeat/pulse-trace and graph motifs were retired app-wide on 2026-09-14; the week
  strip is the app's one drawing.
- No business rules in the client. Tier, quota, and plan generation are server-only (`workers/`);
  the client may display tier state but is never the authority for it. **D1 has no row-level
  security**, so every D1 statement must bind a `userId` from the verified session — see
  `workers/src/lib/store.ts`'s header, which is the whole of the authorization story.
- AI output validation is structural, not strict-content: validate shape, retry once, then fall
  back to a template. Over-tight content validation is a known Echo V1 mistake — detail in
  [`docs/reference/plan-generation.md`](docs/reference/plan-generation.md).
- Shared types (`Plan`, `Week`, `Workout`, `Tier`) live in `src/lib/planTypes.ts`, shared
  constants/logic in `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts`, and the policy URL and
  version in `src/constants/legal.ts`. All four are imported by both the app and `workers/` (and
  listed in `workers/tsconfig.json`'s `include`), so they must stay pure — no React, no Node, no
  Cloudflare globals.

## Coaching domain — read before touching plan generation

- **The coaching content is not yours to invent.** Ian is a McMillan-certified coach. The source of
  truth is his library at `~/Desktop/Running Bussiness Files/4th Edition/Final Txt Files/`
  (`load_rules.md`, `workout_library.md`, `training_zones.md`, `injury_flags.md`, and the McMillan
  plan examples). Port from it; never generate training advice from general knowledge.
- **Safety logic lives in typed code, never in a prompt.** Volume caps, deload cadence, long-run
  limits, and injury rules are deterministic. They run in the template engine *and* clamp the AI's
  output for paid tiers. A model must not be able to prescribe an unsafe week — the code rejects the
  number before the user sees it. Clamping a number is not the over-tight *content* validation that
  hurt Echo V1; it is arithmetic.
- **Plans are running only.** Runs and rest days. No prehab strength, cross-training, or mobility.
  Consequence: the only levers against a declared injury are volume and intensity.
- **Days are unnamed.** A week is Day 1 … Day 7; rest days are real slots, not absences. The runner
  places them on a calendar themselves. Never emit Mon–Sun.
- **Intake is 10 fields, including age.** Eight are always asked — goal, age, experience,
  days/week, weekly volume, target race distance, a recent time at any distance (optional to
  answer, but always asked), and injuries. Race date and goal time appear **only** once a target
  race is chosen. Max HR is estimated `220 − age`, so no HR zone is computable without age, and
  50+ forces a 3-week deload cadence.
- **Under-18 runners never see HR zones.** Captain-approved youth policy (§6-A,
  `v22-youth-policy-research-s1` report, 2026-08-06): `age < 18` suppresses `Workout.hrZone`
  entirely and substitutes `Workout.rpe` instead (`loadRules.ts`'s `isUnder18`/`rpeForZone`, a
  direct read of `training-zones.md`'s already-ported RPE scale — no new coaching content). Adult
  plans are unaffected. The report's other under-18 proposals (a rest-day floor, an absolute
  volume ceiling, a race-distance gate) were evaluated and explicitly declined — don't assume they
  ship just because this one did.

## Testing

jest-expo is installed. New logic added to `src/lib/` gets a test alongside it (see
`src/lib/__tests__/supabase.test.ts`). Screens are not unit-tested for now. Eight rendered-screen
suites are deliberate exceptions, each because the bug or behaviour under test lives in the
screen's own render branches with no logic layer underneath to test instead: the two in
`src/app/(auth)/__tests__/` (2026-09-04) — `onboarding.test.tsx` (the CTA gate and its bounded
ceiling, and since 2026-09-20 the first-launch scroll lock and its content-box latch) and
`auth-back-link.test.tsx` (the four pre-auth links' navigation action) —
`src/app/(tabs)/__tests__/tab-cache-first.test.tsx` (2026-09-12, the cache-first-on-refocus
regression proof cited in `docs/change_log.md`'s same-dated entry),
`src/app/plan/__tests__/day-why.test.tsx` (2026-09-16, the Elite per-workout `why` render proof,
issue #24), `src/app/__tests__/root-layout-font-gate.test.tsx` (2026-09-16, the root layout's
splash gate settling on a font-load *failure* as well as a success — issue #21),
`src/app/__tests__/intake-guardian-consent.test.tsx` (2026-09-19, the 13–17 consent checkbox's
render branch and save-time gate, issue #89), `src/app/(tabs)/__tests__/settings-privacy.test.tsx`
(2026-09-19, the Settings privacy-policy link's role and its visible failure copy, issue #89) and
`src/app/__tests__/intake-flow.test.tsx` (2026-09-20, the captain's intake-flow rulings —
unskippable first entry, blank re-entry, required target distance, one "Create plan" that saves
then generates — which live in the screen's render branches and submit handler). Each file's
header states the reason; add a ninth only on the same grounds.

## Keep these docs updated — this is a standing rule, not a suggestion

**After any exchange that changes a decision, completes work, or moves a milestone, dispatch the
`doc-writer` subagent to sync the docs before moving on.** Don't defer it to "later"; later is how
`docs/` and reality drift apart, and this project's docs *are* its memory across sessions.

Do not dispatch `doc-writer` for exchanges that change nothing (a question answered, an option
explored and rejected, a file read). Churn is its own kind of rot.

| File | When it changes |
|---|---|
| [`docs/mvp-progress.md`](docs/mvp-progress.md) | **Every time.** The living tracker: done / in flight / next / blocked / risks |
| [`docs/change_log.md`](docs/change_log.md) | A dated entry on every behavior-changing commit or decision |
| [`docs/architecture.md`](docs/architecture.md) | After a feature lands — move it from "planned" to "current" |
| [`docs/reference/coaching/`](docs/reference/coaching/) | Only when Ian rules on a coaching question. Never edit a training rule without him |
| `planning/*` | Only when Ian changes the spec. Record the change in `change_log.md` the same day |
