# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-07-12 (doc sync: `145d7e0`'s Instrument & Matter token rewrite reconciled)

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

**The honest summary:** planning, design, and domain research are done to an unusual depth, and
Phase 0's paper-reconciliation pass is now done too. **Almost no product code exists.**
`src/lib/supabase.ts`, `planTypes.ts`, and `loadRules.ts` are the shared vocabulary and the safety
arithmetic; `src/constants/theme.ts` now carries the full Instrument & Matter token system in
place of the create-expo-app template (`145d7e0`), and `src/app/` is down to a placeholder Home
screen and root layout — but there is still not yet a template engine, a real screen, or a
backend. Nothing generates a plan. The gap between "designed" and "working" is still nearly the
entire remaining project.

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
- [x] 22 passing tests (`jest-expo`); `typecheck && lint && test` all clean
- [x] **Design tokens — done `145d7e0`, 2026-07-10** ("Replace the stock theme with the
      Instrument & Matter token system"): `src/constants/theme.ts` rewritten structurally
      (surfaces, hairline, effort hues, hivis, `grid.*`, motion, radius, spacing ramp with the 48
      step and `six`→`seven` rename); Barlow Condensed / Inter / IBM Plex Mono bundled via
      `npx expo install`; `expo-glass-effect` removed; the stock create-expo-app template deleted
      (`explore.tsx`, `src/components/` in full); the placeholder hero title "Aanya's baby" fixed
      in `src/app/index.tsx`. Resolves the three risks this previously left open (see the removed
      🟠/🟡 rows, formerly under "Known debt and risks").

### Repo hygiene
- [x] `AGENTS.md` rewritten as the agent-routing doc, committed (`60382cd`)
- [x] `main` in sync with `origin/main`, no stray branches or worktrees
- [x] **Full audit run.** No HIGH or exploitable findings. Secrets posture clean three ways
- [x] **DB audit run.** Live project matches the repo (nothing deployed); zero advisor lints
- [x] **All docs committed** (`7b4ae77`, 2026-07-10) — `docs/`, `planning/`, and this file are no
      longer untracked. The stale 🔴 risk recording the opposite is removed below.

### Phase 0 (`docs/mvp-build-prompt.md`) — done 2026-07-10
- [x] Repo hygiene committed (`7b4ae77`) — plan-shape spec, 5K golden fixture, build prompt itself
- [x] All 20 audit rulings (§0-B) applied across the doc set — see `docs/change_log.md`
- [x] Decision gate (§0-C) answered — 13 Ian decisions, recorded in `docs/change_log.md` and this
      file's "Decided" section below
- [x] **Model ID verified live**: `claude-sonnet-5` confirmed against the Anthropic Models API
      with the project's server-side key — real model ("Claude Sonnet 5," 1M input tokens, 128K
      max output)
- [x] **Ruling 2 re-check clean**: the 8→10-field intake change drops no coaching rule that
      wasn't already excluded for other reasons (every NOT-ported rule needs logging/wearables/
      sex data the two new time fields don't provide). The one real gap found — no numeric
      race-time → training-pace method in the source — is closed by decision 13 below.

**Next work: Phase 1 — plan engine on a screen**, per `docs/mvp-build-prompt.md`'s build-phase
orchestration (`src/lib/planTemplates.ts`, the theme rewrite, plan view on a local fixture).

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
- [x] **Coaching library ported — done.** Seven files under `docs/reference/coaching/`
      (`00-README.md`, `load-rules.md`, `training-zones.md`, `workout-library.md`,
      `injury-rules.md`, `plan-structure.md`, `example-plan-5k-pro.md`), PACE-branded, filtered
      to what a one-time 10-field intake can drive, with the six evidence corrections applied.

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
5. [x] **Theme + fonts** — **Done `145d7e0`, 2026-07-10.** `theme.ts` replaced wholesale; Barlow
       Condensed, Inter, IBM Plex Mono bundled; the stock template screens deleted.
6. [ ] **The spine** — `supabase init`, migrations, RLS on all four tables, required sign-up.
7. [ ] **Intake** (8 questions, or 10 with a target race, + review) persisting to `intake_responses`.
8. [ ] **`generate-plan` edge function** — tier branch, quota check, validate, clamp, retry once, fall back.
9. [ ] **Quota UI + dummy paywall.**
10. [ ] **My Plans.**
11. [ ] **Motion + polish**, last, because the reveal choreographs the finalised `Plan` types.

---

## Blocked / awaiting a decision

Only genuinely open items remain here. Everything resolved by the 2026-07-10 decision gate moved
to "Decided" below.

| Item | Blocks | Who decides |
|---|---|---|
| App name | app icon, wordmark, store listing; needed by M6, not before | Ian |
| Password minimum length | sign-up copy | Verify against what the live Supabase project actually enforces — Phase 2 |
| Whether Rule 5's "Monitoring" tier applies to a one-time pre-run intake at all | Rule 5's Monitoring-tier triggers ("new muscular soreness," "joint stiffness > 10 min") are worded for something noticed during/after a run, not a signup-time self-report; wiring `injury-rules.md` to intake | Ian |

## Decided (2026-07-10) — decision gate closed

Full rationale for each is in `docs/change_log.md`'s "2026-07-10 (Phase 0)" entry.

| Item | Decision |
|---|---|
| Goal-vs-recent improvement threshold | **10%, gating race-pace session targets only (R-A addendum).** ≤10% implied improvement over the recent-time equivalent → goal-pace sessions use the raw goal pace; beyond 10% → goal-pace sessions use the recent-time-equivalent pace instead. Training paces are **unconditionally** recent-time-derived — the goal never drives everyday paces at any threshold. |
| "Experienced" maps to intermediate or advanced? | **Intermediate** (kept as coded) — safer, tighter caps. |
| Intermediate deload cadence | **4 weeks** (kept as coded); 50+ still always forces 3. |
| Shape of the intake `injuries` field | Closed-set `InjuryFlag` flags + optional free-text notes (length-limited/sanitized). Flags alone drive Rule 5's triage; notes inform paid prompts only. |
| Where Rule 10 disclaimers render | Static footer section on every plan view + one line in the generating modal's fine print. |
| Elite extras | **Cut for MVP.** Elite = richest personalization prompt + per-workout "why" only; `Plan.extras` can carry them later without a schema change. |
| iPad / tablet a v1 target? | **No — phone-only v1.** iPad and desktop/computer support move to v2 (Ian: "phone only for phase 1, then ipad and computer in phase two"). |
| Paywall + Settings in MVP? | **Restored.** Minimal dummy paywall + settings-lite (sign out, tier display, restore), in the blueprint's reserved third tab slot. |
| Does a fallback plan burn quota? | **Not the first 3 in a period** (`is_fallback` filter in both `generate-plan` and `quota-status`; `notes` length-limited and sanitized). **A 4th+ fallback in the same period keeps the already-reserved slot (R-B addendum)** — nobody is refused, but that attempt counts against quota, and the fallback card must say so. |
| Free-tier configure gating | Free sees all options; out-of-tier selections render locked and route to the paywall on tap — never a dead disabled button. |
| "Next workout" / "current week" card | **Dropped.** Home shows the plan link + quota state only. No current-week arithmetic exists in v1. |
| Red-flag injury protocol representation | Rendered as a conservative fixed-length plan whose weeks carry the protocol's phases, plus a pain-gated-progression `extras` `PlanSection`, plus Rule 10 disclaimers. Does not consume quota. |
| Pace-derivation method | Cross-distance equivalency via the Riegel formula (`T2 = T1 × (D2/D1)^1.06`); training paces anchored to the source's own relative rules. Any remaining numeric gap goes back to Ian — nothing invented. |

---

## Known debt and risks

- 🔴 **`supabase secrets set` has never been run.** Production has no `ANTHROPIC_API_KEY`. Hard blocker
  the moment `generate-plan` deploys.
- 🟠 **Supabase CLI is not logged in, and `supabase init` was never run** — there is no `config.toml`,
  so `supabase start` and `functions serve` both fail today. The comment inside
  `supabase/functions/.env` claiming otherwise is currently false.
- 🟠 **Apple Sign-In is not configured.** App Store rules require it once Google sign-in is offered.
- 🟠 **Deep-link scheme `v22workoutplangenerator://` not confirmed on Supabase's redirect allowlist**
  (Authentication → URL Configuration). Google OAuth will dead-end without it. UNVERIFIED — this
  setting could not be read.
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
