# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-07-12 (goal-realism ruling closes Open item 5 — resolved in
`example-plan-5k-pro.md`; removed from the cycle-2 sign-off list below and added to "Decided";
"Next" step 13's Open-items reference narrowed to 6–7; the shared types landed in
`src/lib/planTypes.ts` and the contract landed as real tests in `paceDerivation.test.ts`, but
`paceDerivation.ts` itself is still unbuilt, issue #3; two related doc tensions recorded as known
debt, not fixed)

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
Phase 0's paper-reconciliation pass is now done too. **The plan-generation engine itself does not
exist yet.** `src/lib/supabase.ts`, `planTypes.ts`, `loadRules.ts`, and (as of the 2026-07-11
review-and-refine cycle) `notation.ts` are the app's `lib/` layer — shared vocabulary, safety
arithmetic, and run-type/structure-string notation, all pure and tested (64 passing tests). A
golden fixture (`src/lib/fixtures/examplePlan.ts`), a rendered plan screen (`src/app/plan/[id].tsx`
and `src/components/plan/`), and an abbreviations glossary tab (`src/app/(tabs)/glossary.tsx`)
exist and render that fixture — but nothing generates a plan from an intake yet.
`src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts`, the actual generation logic, are still
unwritten; two TDD test suites for them exist and intentionally fail on the missing modules. The
gap between "designed" and "working" is smaller than it was, but the engine itself is still ahead.

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
- [x] `src/lib/loadRules.ts` — deterministic safety arithmetic (see "Next" step 2)
- [x] `src/lib/notation.ts` — the code counterpart of `notation.md`: `RUN_TYPE_ABBREVIATIONS`,
      `UNABBREVIATED_RUN_TYPES`, `STRUCTURE_SHORTHAND`, and `expandLabel()` for screen-reader text.
      Shipped alongside the 2026-07-11 review-and-refine cycle 1 doc rebuild, not logged in
      `change_log.md` at the time — corrected in the cycle-2 entry.
- [x] `src/lib/fixtures/examplePlan.ts` — the 5K golden fixture rendered as real `Plan` data,
      **already resynced to cycle 2's doc corrections** (45 km week 9 with a 300 m interval jog,
      week-11 race-pace reps at goal pace, and the rest of the cycle-2 fixes). **Corrected in this
      doc-audit pass:** this file previously claimed the fixture was still stale against cycle 2
      — reading the actual file shows it wasn't. See `docs/change_log.md`'s new correction bullet.
- [x] Plan-rendering screens and components: `src/app/plan/[id].tsx`, `src/app/(tabs)/glossary.tsx`
      (the abbreviations glossary tab, sourced from `notation.ts`), and `src/components/plan/`
      (`WeekAccordion`, `WorkoutRow`, `EffortChip`, `ReadoutBracket`, `PlanNameplate`,
      `DisclaimerFooter`, `FallbackNotice`, `format.ts`) — render the golden fixture on a real
      screen, ugly-beyond-tokens caveats aside.
- [x] 64 passing tests (`jest-expo`): `supabase.test.ts`, `loadRules.test.ts`, `notation.test.ts`,
      `examplePlan.fixture.test.ts`. Two more suites exist and **intentionally fail** — they're
      TDD specs for code that doesn't exist yet: `planTemplates.golden.test.ts` and
      `paceDerivation.test.ts`. Both already assert cycle-2's corrected numbers (45 km week 9,
      300 m jog, week-11 goal-pace convergence) — they fail only because `planTemplates.ts` and
      `paceDerivation.ts` don't exist to import, not because their expectations are stale.
      `test` is 4 suites passing / 2 intentionally red. **`typecheck` and `lint` are currently
      red too**, both on the same two files (`Cannot find module '../planTemplates'` /
      `'../paceDerivation'`) — expected, not a regression, but `npm run typecheck && npm run
      lint && npm test` will not run clean until step 3 below lands both modules.

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

**Next work: Phase 1 — the plan engine itself.** The rest of `docs/mvp-build-prompt.md`'s
build-phase orchestration for this phase — the theme rewrite and a plan view on a local fixture —
is now done (see "Code" above); `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts` are
what remain.

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
- [x] **2026-07-11 market-research pass on published 5K plans done** — Higdon, McMillan, Daniels,
      Pfitzinger, RunnersConnect, Runna, Nike Run Club — run to check the coach's review against
      real coaching practice before fixing anything. Full findings cited inline in
      `workout-library.md` and `example-plan-5k-pro.md`.
- [x] **Ian's first coaching-quality review done: 3/10, five rulings applied.** Session sizing is
      now keyed to race distance, not weekly volume; reps are count × distance; race-pace-rep
      anchoring converges current-fitness → goal pace (superseding, not deleting, part of the
      2026-07-10 correction); run-type labels are abbreviated (new `notation.md`); HR zones and
      volume adherence were praised and left untouched. `example-plan-5k-pro.md` rebuilt under all
      five, and shipped with real code the same day: `src/lib/notation.ts`, the golden fixture,
      the glossary tab, and tests. Full account: `docs/change_log.md`'s 2026-07-11 entry.
- [x] **Review-and-refine cycle 2 done — docs and code both (2026-07-11, same day).** A code-review
      pass over cycle 1's rebuild found five internal contradictions and one coverage gap:
      week 9's interval recovery jog now follows `workout-library.md`'s own menu (44 → 45 km);
      the Daniels 10%-of-volume brake is re-scoped from an enforced rule to advisory context;
      "count × distance" is now stated consistently everywhere (it was inverted in three places);
      `notation.md`'s canonical structure-string example no longer anchors an `INT` session to
      goal pace; tempo-band phrasing is harmonized (15–30 min, this plan uses the 20–30 upper
      region) and `workout-library.md`'s "well under 10 km" is now "≤ 10 km"; and strides are
      extended to one easy day per loading week (research-sourced). **Code side also done, not
      merely flagged** — `src/lib/fixtures/examplePlan.ts`, `planTemplates.golden.test.ts`, and
      `paceDerivation.test.ts` all already assert cycle-2's numbers, including
      `paceDerivation.test.ts`'s replacement of the stale >10%-goal-improvement gate with a
      ruling-3-compliant goal-pace assertion and an `it.todo` for the still-open goal-realism
      question (Open item 5). **Corrected in this doc-audit pass** — this file previously said
      that code-side resync was still open; it wasn't. Full account: `docs/change_log.md`'s second
      2026-07-11 entry and its doc-audit correction bullet.

---

## In flight

**Nothing is currently in flight.** The coaching-doc review-and-refine cycles below are fully
closed — docs and code both. This section, "Next" step 3, and "Known debt" previously said
cycle 2's code-side resync was still open; **corrected in this doc-audit pass** — it wasn't, by
the time the actual files were read (see `docs/change_log.md`'s new correction bullet). The real
remaining critical-path item is `src/lib/planTemplates.ts` / `paceDerivation.ts` themselves, a
genuine gap tracked as step 3 in "Next," not a doc/fixture/test sync problem.

- **Cycle 1** (2026-07-11): Ian scored the rendered plan 3/10, five rulings applied. Docs rebuilt
  (`notation.md` added; `workout-library.md` and `example-plan-5k-pro.md` rewritten;
  `plan-structure.md`/`00-README.md` cross-referenced) **and** shipped with real code the same
  day: `src/lib/notation.ts`, the rebuilt golden fixture, the abbreviations glossary tab, and
  tests (64 passing). None of that code was logged in `change_log.md` at the time — corrected in
  the cycle-2 entry below.
- **Cycle 2** (2026-07-11, later the same day): a code-review pass over cycle 1's doc rebuild
  found five internal contradictions and one coverage gap (see `docs/change_log.md`'s second
  2026-07-11 entry for the full list — recovery-menu alignment, the Daniels-brake re-scope, the
  count × distance prose fix, the `INT`/`RP` anchor example fix, tempo-band phrasing, and the
  strides extension). **Docs side done, and — corrected in this doc-audit pass — the code side
  too:** `src/lib/fixtures/examplePlan.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`, and
  `src/lib/__tests__/paceDerivation.test.ts` all already assert cycle-2's numbers (week 9 at 45 km
  with a 300 m interval jog; `paceDerivation.test.ts`'s >10%-goal-improvement gate already replaced
  by a ruling-3-compliant goal-pace assertion plus an `it.todo` for Open item 5). This section
  previously said that resync was still pending, sourced from a change-log claim that was itself
  wrong by the time this pass checked the files — both are fixed now.

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
3. [ ] **`src/lib/planTemplates.ts`** (+ **`src/lib/paceDerivation.ts`**, its pace-derivation
       counterpart) — the 5K plan first: phases, workout primitives, load curve. Generates for any
       week count, any days/week, any starting mileage. **Target the cycle-2-corrected
       `example-plan-5k-pro.md`** (45 km week 9, 300 m interval jog, count × distance throughout),
       not cycle 1's numbers and not the original pre-review version — the golden test and fixture
       below already assert exactly this, so build to make them pass rather than re-deriving them.
       Also fixes `clampWeeklyVolume()`'s last-loading-week bug (Open item 2). **The goal-realism
       ruling that used to block `deriveRacePaceTarget()` landed 2026-07-12** (Open item 5,
       resolved) — `deriveRacePaceTarget()` and `assessGoalRealism()` can now be written for real,
       against the contract already sitting in `paceDerivation.test.ts`.
   - [x] **Fixture/test resync — already done, not still open (corrected in this doc-audit
         pass).** `src/lib/__tests__/paceDerivation.test.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`,
         and `src/lib/fixtures/examplePlan.ts` all already assert cycle-2's corrected numbers:
         week 9 at 45 km with a 300 m interval jog, and `paceDerivation.test.ts`'s
         >10%-goal-improvement gate already replaced by a test asserting ruling 3's goal-pace
         convergence (240 s/km), plus an `it.todo` naming the then-open goal-realism question
         (Open item 5) instead of inventing an answer to it. **That `it.todo` is now gone** —
         2026-07-12's ruling replaced it with real tests. This step, "In flight," and "Known
         debt" previously said this resync was still pending — it wasn't, by the time this pass
         read the actual files; see `docs/change_log.md`'s new correction bullet. What remains is
         writing `planTemplates.ts`/`paceDerivation.ts` themselves against these already-correct
         specs — tracked in step 3 above, not a doc/test sync problem.
4. [ ] **Plan view rendering a real template plan.** **Partially done** — `src/app/plan/[id].tsx`
       and `src/components/plan/` already render the golden fixture end to end (ugly-beyond-tokens
       caveats aside), but it's still the static fixture, not `planTemplates.ts` output, since
       that module doesn't exist yet. Left unchecked until the data source is a real generated
       plan; swap it once step 3 lands.
5. [x] **Theme + fonts** — **Done.** `src/constants/theme.ts` replaced with the Instrument & Matter
       token system (commit `145d7e0`); stock template screens removed
       (`src/app/index.tsx` → `src/app/(tabs)/index.tsx`, rewritten; `explore.tsx` deleted);
       `expo-glass-effect` also removed in the same commit — the "Known debt" risk recording it as
       still-installed is stale and removed below. Not logged in `change_log.md` until this
       doc-audit pass; see its new 2026-07-10 (evening) entry.
6. [ ] **The spine** — `supabase init`, migrations, RLS on all four tables, required sign-up.
7. [ ] **Intake** (8 questions, or 10 with a target race, + review) persisting to `intake_responses`.
8. [ ] **`generate-plan` edge function** — tier branch, quota check, validate, clamp, retry once, fall back.
9. [ ] **Quota UI + dummy paywall.**
10. [ ] **My Plans.**
11. [ ] **Motion + polish**, last, because the reveal choreographs the finalised `Plan` types.
12. [x] **Abbreviations glossary tab.** **Done.** `src/app/(tabs)/glossary.tsx`, sourced from
        `src/lib/notation.ts`'s `RUN_TYPE_ABBREVIATIONS`/`UNABBREVIATED_RUN_TYPES`/
        `STRUCTURE_SHORTHAND` exports, which are themselves copied verbatim from `notation.md`.
        Abbreviation-set sign-off (Open item 4) is still pending Ian, so the copy it ships is
        still "proposed," not confirmed.
13. [ ] **Ian's rendered-plan review, round 2** (renumbered from "cycle 2" — that label now belongs
        to today's review-and-refine pass, docs and code both done, see "In flight"). Once
        `planTemplates.ts` renders the cycle-2-corrected 5K plan, take it back to Ian for a
        coach's sign-off on the actual rendered numbers, plus his rulings on the cycle-2 open
        items still outstanding (**Open items 6–7**: the Daniels-brake low-volume question and the
        strides extension — item 5, goal-realism, was ruled on 2026-07-12 and is closed). A
        rendered plan still needs a coach's yes, not just a passing test suite.

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
| Goal-vs-recent improvement threshold | ⚠️ **Superseded twice — see "Goal-realism handling" in the 2026-07-12 row below for the behavior that is actually live.** As originally decided (R-A addendum): 10%, gating race-pace session targets only — beyond 10%, goal-pace sessions would use the recent-time-equivalent pace instead. Ruling 3 (2026-07-11) retired that pace gate; the 2026-07-12 goal-realism ruling reuses the 10% number for a *warning* line, not a pace gate. The one part that never changed: training paces are **unconditionally** recent-time-derived — the goal never drives everyday paces, at any threshold. |
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

## Decided (2026-07-12) — goal-realism handling

Closes Open item 5 and GitHub issue #33. Full reasoning, worked cases, and the type contract:
[`docs/superpowers/specs/2026-07-12-goal-realism-design.md`](superpowers/specs/2026-07-12-goal-realism-design.md).

| Item | Decision |
|---|---|
| Goal-realism handling — warn, cap, or trust an implausible goal? | **Two bands: warn, then cap.** Riegel-equivalent the recent performance to the goal distance and measure the implied improvement. **≤10% → `realistic`**, silent, race-pace (`RP`) sessions anchor at the raw goal pace. **10–15% → `ambitious`**, warn, but `RP` *still* anchors at the raw goal pace — ruling 3 holds even under a warning. **>15% → `implausible`**, warn **and cap** the `RP` anchor at the recent-equivalent improved by exactly 15%. Boundaries are inclusive at the top of each band; the cap engages only strictly above 15%. |
| Do the thresholds scale? | **No — flat for every runner.** No scaling by age, experience, or plan length. The source gives no per-week or per-age improvement rate to port, and inventing one would be exactly the fabricated coaching number this project forbids. Scaling stays available as an additive change if round-2 review shows flat is too crude. |
| Where the warning appears | **Both goal-entry points *and* the plan**, from one shared pure `assessGoalRealism()`. The client warns at the intake review screen *and* the configure modal (goal time travels per-generation), so the runner learns their goal is a stretch **before** spending a generation — on Free, that is 1 of 3. The engine calls the same function to cap the anchor and stamps the verdict onto the immutable plan (`Plan.goalRealism`), so the plan explains its own numbers. Same function both sides ⇒ warning and cap cannot disagree. The warning is advisory and **non-blocking**. |
| Provenance | **Both thresholds are Ian's own.** The coaching source has no goal-realism rule — `COMPLETENESS.md` lists "goal unrealistic for current fitness" under what the library is *missing*. Nothing here is portable from McMillan, and nothing here may be changed without him. |
| Blast radius | Training paces (easy/tempo/interval) stay **unconditionally** recent-derived at any goal size. A fantasy goal cannot corrupt everyday paces — the entire exposure is the `RP` session target, which is why capping one number is a sufficient fix. |

**Landed in code 2026-07-12:** the shared types (`GoalRealism`, `GoalRealismAssessment`,
`Plan.goalRealism`) in `src/lib/planTypes.ts`, and the ruling encoded as real tests in
`paceDerivation.test.ts` (the `it.todo` is gone). **`src/lib/paceDerivation.ts` itself is still
unbuilt** — issue #3 implements `assessGoalRealism()` and the widened `deriveRacePaceTarget()`
against that contract, so the suite stays red until it lands.

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
- 🟡 **Abbreviation set pending Ian's sign-off (2026-07-11).** `notation.md`'s run-type table
  (`ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`) is built to fit Ian's two given examples (`ER`, `TR`)
  and the market-research pass's notation findings, but only two of the seven were confirmed
  directly by him. Marked "proposed" in the doc; confirm the full set — the abbreviations glossary
  tab already ships copy from it (`src/app/(tabs)/glossary.tsx`) ahead of that confirmation.
- 🟡 **Two cycle-2 items still await Ian's sign-off (2026-07-11), same status as the abbreviation
  set above.** *(Goal-realism, formerly the first of three here, was ruled on 2026-07-12 — see
  "Decided" — and is no longer debt.)* (1) Whether the Daniels 10%-of-weekly-volume brake, now
  re-scoped to advisory context, should ever override the 5K band's floor for a low-volume runner.
  (Open item 6.) (2) The strides extension to one easy day per loading week is research-sourced,
  not ruled on by Ian. (Open item 7.) A third, smaller item isn't a numbered Open entry but is also
  his call if he disagrees: the week-9 recovery-jog fix (200 m → 300 m, to match the menu) has a
  noted alternative — widen the menu to ~33–67% instead and keep 200 m. Full detail:
  `example-plan-5k-pro.md`'s Open section, `docs/change_log.md`'s second 2026-07-11 entry.
- 🟠 **`GeneratePlanRequest` has no `goalTimeSec` field, so the per-generation goal cannot reach the
  engine at all (found 2026-07-12).** `docs/mvp-build-prompt.md:332` promises that race
  distance/date/goal-time *travel per-generation* — "intake's stored race is a default, not the
  authority" — but `src/lib/planTypes.ts`'s `GeneratePlanRequest` carries only `raceDistance`,
  `raceDate`, `durationWeeks`, `notes`, and `idempotencyKey`. The goal-realism check is defined
  against the goal time, so it cannot run server-side until this is fixed. Belongs to the
  `generate-plan` contract (issue #9, `api-designer`) — flagged, deliberately not fixed under the
  goal-realism ruling.
- 🟡 **The configure-modal design spec never mentions goal time (found 2026-07-12).**
  `docs/design/frontend-design-brief.md:564` describes the modal as distance chips + a date picker
  only, which contradicts `mvp-build-prompt.md:332` and leaves the goal-realism warning's second
  home unspecified. The warning must appear at *both* goal-entry points, so the modal needs a
  goal-time control and its advisory copy. Resolve when M4's configure modal is built (issue #13).
- 🟡 **Peak weekly volume dropped 54 km → 48 km (2026-07-11) as a consequence of ruling 1, not a
  separate decision — surface it to Ian anyway.** Right-sizing the tempo/interval sessions to a
  fixed band removed the only way the old plan reached 52–54 km peak weeks (inflating those
  sessions); the new peak is wherever correctly-sized sessions plus the long-run cap put it. Ian
  praised the plan's volume adherence, so a materially different peak number is worth his eyes
  even though nothing here contradicts what he praised.
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
