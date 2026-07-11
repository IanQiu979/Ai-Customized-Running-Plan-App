@AGENTS.md

## What this is

V2.2 — **Pace Blueprint** (name decided 2026-07-12, see `docs/change_log.md`). An Expo/React
Native app, part of the PACE family (sibling to V2.3 "Pace AnalysisAI"): it turns a runner's
intake answers into a tiered, week-by-week training plan and does nothing else — no logging,
no chat, no coach messaging. Full spec: [`planning/README.md`](planning/README.md) and the
linked brainstorm / product / engineering docs it indexes.

## Architecture at a glance

Client: Expo SDK 54, expo-router, TypeScript strict. Backend: Supabase (Postgres + Auth + Edge
Functions). AI: Claude (`claude-sonnet-5`), called only from the `generate-plan` edge function,
never from the client. Today only the client scaffold and `src/lib/supabase.ts` exist — no auth
screens, no DB tables, no edge functions, no migrations. Route tree, `lib/` layout, the
`generate-plan` flow, the API table, the draft DB schema, and the proposed visual direction all
live in [`docs/architecture.md`](docs/architecture.md).

## Commands

| Command | Does |
|---|---|
| `npm start` | `expo start` |
| `npm run ios` / `npm run android` / `npm run web` | `expo start --ios` / `--android` / `--web` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm test` | `jest` |

Run `npm run typecheck && npm run lint && npm test` clean before every commit.

## Secrets & env — read this before touching any env file

- `.env` (gitignored) holds ONLY `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env.example` is the committed template — copy it,
  never edit it in place.
- Anything prefixed `EXPO_PUBLIC_` is inlined in **plain text** into the compiled app bundle by
  Expo. Treat it as public. Always read it with static dot notation
  (`process.env.EXPO_PUBLIC_X`) — the `expo/no-dynamic-env-var` lint rule enforces this;
  destructuring or bracket access silently yields `undefined`.
- `ANTHROPIC_API_KEY` must NEVER get an `EXPO_PUBLIC_` prefix and must NEVER go in `.env`. It
  lives in `supabase/functions/.env` (gitignored, local dev) and is pushed to production with
  `supabase secrets set` — not done yet, see `docs/mvp-progress.md`.
- Supabase auto-injects `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` into
  edge functions at runtime. Never set these by hand.
- Google OAuth client secret and Apple sign-in credentials live only in the Supabase Dashboard,
  never in a repo file.

## Git etiquette

Solo repo — commit directly to `main` by default. Branch (`feat/<slug>` or `fix/<slug>`) and
open a PR via the `github-ops` subagent when a change is multi-file, touches
auth/payments/RLS/edge functions, or is something worth a review pass. Never commit without a
clean `typecheck && lint && test`. Never force-push without explicit user approval.

## Code conventions

- TypeScript strict everywhere (already on in `tsconfig.json`).
- Theme tokens only — no hardcoded colors or spacing in components; use
  `src/constants/theme.ts`. It currently holds the stock Expo template palette; the proposed
  PACE palette is recorded in `docs/architecture.md` but not yet implemented.
- No business rules in the client. Tier, quota, and plan generation are server-only (edge
  functions); the client may display tier state but is never the authority for it.
- AI output validation is structural, not strict-content: validate shape, retry once, then fall
  back to a template. Over-tight content validation is a known Echo V1 mistake — detail in
  [`docs/reference/plan-generation.md`](docs/reference/plan-generation.md).
- Shared types (`Plan`, `Week`, `Workout`, `Tier`) belong in one place (planned:
  `src/lib/planTypes.ts`) and are imported by both the app and the edge functions.

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

## Testing

jest-expo is installed. New logic added to `src/lib/` gets a test alongside it (see
`src/lib/__tests__/supabase.test.ts`). Screens are not unit-tested for now.

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
