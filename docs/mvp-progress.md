# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-07-10

---

## Status at a glance

| Milestone | State |
|---|---|
| M1 — Foundation (account → empty Home) | **Not started.** Infra partially provisioned |
| M2 — Intake (questionnaire persists) | Not started |
| M3 — Plan engine (3 tiers produce valid plans) | Not started |
| M4 — Tiers & quotas (server-side, unbypassable) | Not started |
| M5 — My Plans (history) | Not started |
| M6 — Polish & TestFlight | Not started |

**The honest summary:** planning, design, and domain research are done to an unusual depth.
**No product code exists.** `src/lib/supabase.ts` is the only non-template file in the app. Nothing
generates a plan. The gap between "designed" and "working" is the entire remaining project.

---

## Done

### Planning and specification
- [x] `planning/01-brainstorm.md`, `02-product-requirements.md`, `03-engineering-requirements.md`, `README.md`
- [x] Tiers, quotas, user flow, and six milestones each with a "done" definition
- [x] `docs/architecture.md` — route tree, DB schema draft, API table, `generate-plan` design

### Infrastructure
- [x] Supabase project `v2.2_plan_generation` (`vvvcaulmbwbujeszfvbo`, ap-northeast-1) — `ACTIVE_HEALTHY`
- [x] Google OAuth + email/password auth enabled
- [x] Env layout correct and **verified**: `.env` (client) and `supabase/functions/.env` (server) are
      both gitignored and untracked; no secret is committed; `ANTHROPIC_API_KEY` is server-side only
- [x] `gh` 2.96.0 and `supabase` 2.109.1 CLIs installed

### Code
- [x] Expo SDK 54 scaffold — TypeScript strict, expo-router, `@/*` path alias
- [x] `src/lib/supabase.ts` — env-guarded at import, AsyncStorage on native, `AppState` auto-refresh,
      `detectSessionInUrl: false`
- [x] 3 passing tests (`jest-expo`); `typecheck && lint && test` all clean

### Repo hygiene
- [x] `AGENTS.md` rewritten as the agent-routing doc, committed (`60382cd`)
- [x] `main` in sync with `origin/main`, no stray branches or worktrees
- [x] **Full audit run.** No HIGH or exploitable findings. Secrets posture clean three ways
- [x] **DB audit run.** Live project matches the repo (nothing deployed); zero advisor lints

### Design
- [x] `docs/design/frontend-design-brief.md` — token layer with **computationally verified** contrast,
      accessibility floor, motion system, full copy deck
- [x] `docs/design/mvp-blueprint.md` — "Instrument & Matter", eight screens, the measurement grid,
      the generation reveal
- [x] Caught and fixed: four of five effort hues failed the 3:1 bar in light mode → darker fills
- [x] Caught and fixed: the collapsed ribbon encoded effort by **colour alone**, violating the
      project's own rule → added the monotonic bar-height channel

### Domain
- [x] Located the coaching source of truth (Ian's McMillan-based library) — it is not ours to invent
- [x] Applicability filter defined: V2.2 has no run data, so most of ECHO's rules cannot run here
- [x] Independent fact-check produced **six corrections** (see `change_log.md`)
- [x] Market research: Strava discontinued its own plan builder and acquired Runna (July 2026);
      Runna has documented injury reports traced to an unconstrained algorithm
- [x] **Coaching library ported — done.** Six files under `docs/reference/coaching/`
      (`00-README.md`, `load-rules.md`, `training-zones.md`, `workout-library.md`,
      `injury-rules.md`, `plan-structure.md`), PACE-branded, filtered to what a one-time 8-field
      intake can drive, with the six evidence corrections applied.

---

## In flight

Nothing right now — the coaching port (above) was the last item in flight. Next work starts at
the top of "Next" below.

---

## Next — the critical path to a working MVP

Ordered so something is demoable as early as possible. Steps 1–4 produce a real plan on a real screen
with **no backend at all**.

1. [x] **`src/lib/planTypes.ts`** — **Done 2026-07-10.** Pure TypeScript, importable by the app and the
       edge functions. `pace` and `hrZone` are optional on `Workout`, so a Free plan — or any plan from
       a runner who gave no recent time — structurally *cannot* carry a measured numeral. The type
       system enforces the design's readout-bracket honesty rule.
2. [x] **`src/lib/loadRules.ts`** — **Done 2026-07-10.** Weekly volume cap, deload cadence and the
       35–45% band, long-run share cap, long-run spike cap, Daniels time cap, HR zones. 19 unit tests.
       `clampLongRun()` reports which ceiling actually bound.
3. [ ] **`src/lib/planTemplates.ts`** — the 5K plan first: phases, workout primitives, load curve.
       Generates for any week count, any days/week, any starting mileage.
4. [ ] **Plan view rendering a real template plan.** Ugly beyond tokens, but true.
5. [ ] **Theme + fonts** — replace `theme.ts` wholesale; bundle Barlow Condensed, Inter, IBM Plex Mono;
       delete the stock template screens.
6. [ ] **The spine** — `supabase init`, migrations, RLS on all four tables, required sign-up.
7. [ ] **Intake** (8 questions, or 10 with a target race, + review) persisting to `intake_responses`.
8. [ ] **`generate-plan` edge function** — tier branch, quota check, validate, clamp, retry once, fall back.
9. [ ] **Quota UI + dummy paywall.**
10. [ ] **My Plans.**
11. [ ] **Motion + polish**, last, because the reveal choreographs the finalised `Plan` types.

---

## Blocked / awaiting a decision

| Item | Blocks | Who decides |
|---|---|---|
| **The goal-vs-current improvement threshold.** If a goal time implies a large improvement over the recent time, training paces must come from the recent time. How large is "large"? | `planTemplates`, every paid pace | Ian |
| **Does "experienced — I've trained for races before" map to intermediate or advanced?** Mapped *down* for now, since a lower level means tighter caps (`toExperienceLevel()`) | Volume ceilings, long-run caps | Ian |
| **Intermediate deload cadence: every 3 or 4 weeks?** Source says "3–4"; using 4 so cadence tightens monotonically with experience (`deloadEveryWeeks()`) | Plan shape | Ian |
| App name | app icon, wordmark, store listing | Ian |
| Elite extras (race-day strategy, mid-plan adjustment) | paywall copy, plan view's extras stack | Ian |
| iPad / tablet a v1 target? | responsive work, orientation | Ian |
| Password minimum length | sign-up copy | Verify vs Supabase config |
| Shape of the intake `injuries` field (free text vs. structured symptom picker) | Whether a declared symptom can be routed deterministically into `load-rules.md` Rule 5's three trigger tiers | Ian |
| Whether Rule 5's "Monitoring" tier applies to a one-time pre-run intake at all | Rule 5's Monitoring-tier triggers ("new muscular soreness," "joint stiffness > 10 min") are worded for something noticed during/after a run, not a signup-time self-report; wiring `injury-rules.md` to intake | Ian |
| Where the mandatory disclaimers (`load-rules.md` Rule 10) render in the UI | Every plan? Every week? A persistent footer? Not specified by the coaching source | Ian |

---

## Known debt and risks

- 🔴 **`docs/` is entirely untracked.** Every design doc, the architecture, the change log, and this
  file exist only on disk. **Commit them.**
- 🔴 **`supabase secrets set` has never been run.** Production has no `ANTHROPIC_API_KEY`. Hard blocker
  the moment `generate-plan` deploys.
- 🟠 **Supabase CLI is not logged in, and `supabase init` was never run** — there is no `config.toml`,
  so `supabase start` and `functions serve` both fail today. The comment inside
  `supabase/functions/.env` claiming otherwise is currently false.
- 🟠 **Apple Sign-In is not configured.** App Store rules require it once Google sign-in is offered.
- 🟠 **Deep-link scheme `v22workoutplangenerator://` not confirmed on Supabase's redirect allowlist**
  (Authentication → URL Configuration). Google OAuth will dead-end without it. UNVERIFIED — this
  setting could not be read.
- 🟠 `expo-glass-effect ~0.1.10` is installed and contradicts the design's no-blur depth rule. Remove
  it or fence it off in review.
- 🟠 **Ian's own `workout_library.md` worked deload examples reduce volume by ~35–45%** (Beginner
  ~40%, Intermediate ~45%, Advanced ~35–40% — three independent examples), exceeding the 20–30% band
  he made authoritative (`load-rules.md` Rule 1; see `plan-structure.md`). Unresolved: either the
  20–30% rule is too shallow, or the source's worked examples are sloppy. The port currently enforces
  20–30% regardless.
- 🟡 Stock Expo template not yet deleted — `src/app/explore.tsx` and the other create-expo-app
  screens are still boilerplate, not yet replaced with real screens, and the hero title still reads
  **"Aanya's baby"** (`src/app/index.tsx:38`).
- 🟡 Spacing ramp needs a `48` step inserted, renaming old `six`→`seven` (2 call sites in `explore.tsx`,
  which is slated for deletion anyway).
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
