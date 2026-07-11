# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-07-12 (Ian's round-2 coaching sign-off — GitHub issue #34's eight-item queue
ruled on in full, closing issues #19 and #29 alongside it. Issues #22 and #33 remain open)

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
arithmetic, and run-type/structure-string notation, all pure and tested (82 passing tests, up from
64, after Ian's 2026-07-12 round-2 rulings on issue #34 added the long-run deload-week measurement
fix (ruling R1c) and the race-day/strides test coverage). A golden fixture (`src/lib/fixtures/examplePlan.ts`), a rendered
plan screen (`src/app/plan/[id].tsx` and `src/components/plan/`), and an abbreviations glossary tab
(`src/app/(tabs)/glossary.tsx`) exist and render that fixture — but nothing generates a plan from an
intake yet. `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts`, the actual generation logic,
are still unwritten; two TDD test suites for them exist and intentionally fail to compile on the
missing modules (`npm run typecheck` and `npm run lint` are red for the same reason — expected, not
a regression). **What changed 2026-07-12: every coaching question blocking that engine's build is
now answered.** Issue #19's HIGH-severity long-run-cap conflict — the golden plan's own numbers
breached the coded cap — is closed; the abbreviation set, race-day notation (issue #29), strides
placement, the Daniels brake, and peak volume are all signed off. The gap between "designed" and
"working" is smaller than it was, but the engine itself is still ahead. Two coaching/code questions
remain genuinely open and unrelated to this pass: issue #22 (`clampWeeklyVolume` comparing against
the literal previous week) and issue #33 (goal-realism handling).

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
- [x] 82 passing tests (`jest-expo`), up from 64 after Ian's 2026-07-12 issue #34 rulings:
      `supabase.test.ts`, `loadRules.test.ts` (extended for ruling R1c — a deload week's long run
      is measured against the last loading week's volume, not exempted from the cap), plus
      `notation.test.ts` (+1 for R6's race-day structure string), and
      `examplePlan.fixture.test.ts` (extended for R6 and R7). Two more suites exist and
      **intentionally fail to compile** — they're TDD specs for code that doesn't exist yet:
      `planTemplates.golden.test.ts` (also extended for R6/R7) and `paceDerivation.test.ts`. Both
      already assert every current coaching ruling (45 km week 9, 300 m jog, week-11 goal-pace
      convergence, the R6 race-day string, R7's two-strides-day weeks) — they fail only because
      `planTemplates.ts` and `paceDerivation.ts` don't exist to import, not because their
      expectations are stale. `test` is 4 suites passing / 2 intentionally red — this was true on
      clean `origin/main` before the 2026-07-12 pass too; nothing here is a new failure.
      **`typecheck` and `lint` are currently red too**, both on the same two files (`Cannot find
      module '../planTemplates'` / `'../paceDerivation'`) — expected, not a regression, but `npm
      run typecheck && npm run lint && npm test` will not run clean until step 3 below lands both
      modules. Recorded plainly here and in "Known debt and risks" below: the repo cannot
      currently satisfy `CLAUDE.md`'s own "clean typecheck && lint && test before every commit"
      rule.

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
- [x] **Ian's round-2 coaching sign-off done (2026-07-12) — GitHub issue #34's eight-item queue
      ruled on in full, closing issues #19 and #29 alongside it.** R1: the long-run share cap's
      per-level ladder rises to a monotonic beginner 25% / intermediate 32% / advanced 35% — an
      Ian-authorised override of the source library, closing issue #19's HIGH finding that 9 of 11
      long runs breached the old 30% cap. **A code review then found a HIGH-severity hole in R1's
      deload-week wording ("deload weeks are exempt" would have let the AI-emittable `isDeload`
      field switch off the cap entirely) — Ian issued follow-up ruling R1c the same day: the cap
      is never removed for a deload week, it's measured against the last loading week's volume
      instead of the deload week's own reduced total.** R2: peak volume 48 km approved outright. R3: the Daniels 10%-of-volume brake is
      permanently advisory, never overriding the 5K quality-volume band's floor. R4: Rule 5's
      Monitoring tier is dropped from intake (kept as documented, unused, source content) — closes
      the last row of "Blocked / awaiting a decision" below. R5: the run-type abbreviation set is
      signed off exactly as written, including the known `RP`/`GP` layering wrinkle. R6: race-day's
      structure string becomes `WU 3 km · 5 km race · CD 2 km`, closing issue #29. R7: strides
      extend to both easy days of loading weeks 1, 2, 3, 5, 6, 7. R8: week 9's 300 m recovery jog
      is confirmed as correct. Applied to `src/lib/loadRules.ts`, `src/lib/fixtures/examplePlan.ts`,
      four test files, and five files under `docs/reference/coaching/`. Full account:
      `docs/change_log.md`'s 2026-07-12 entry. **Issues #22 and #33 remain open** — neither was
      part of this queue.

---

## In flight

**Nothing is currently in flight.** The coaching-doc review-and-refine cycles below are fully
closed — docs and code both. This section, "Next" step 3, and "Known debt" previously said
cycle 2's code-side resync was still open; **corrected in this doc-audit pass** — it wasn't, by
the time the actual files were read (see `docs/change_log.md`'s new correction bullet). The real
remaining critical-path item is `src/lib/planTemplates.ts` / `paceDerivation.ts` themselves, a
genuine gap tracked as step 3 in "Next," not a doc/fixture/test sync problem.

**2026-07-12, since:** the Open items these cycles left pending (4, 6, 7) were batched into
GitHub issue #34 along with two standalone bugs (#19, #29) and put to Ian in one sitting; see
"Decided (2026-07-12)" and `docs/change_log.md`'s 2026-07-12 entry for the rulings. That queue is
now also closed — only Open item 5, tracked as issue #33, is still open.

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
       week count, any days/week, any starting mileage. **Target `example-plan-5k-pro.md` as it
       stands after Ian's 2026-07-12 issue #34 rulings** (45 km week 9 with a 300 m interval jog,
       count × distance throughout, R1/R1c's long-run cap — a deload week's long run measured
       against the last loading week's volume, never exempted — R6's race-day structure string,
       R7's two-strides-day weeks) — the golden test and fixture below already assert
       exactly this, so build to make them pass rather than re-deriving them. Issue #19, the one
       coaching conflict that would have made this impossible to build correctly (the golden
       plan's own long runs breached the coded 30% cap), is now closed. **Two things still block
       full correctness, both open GitHub issues, neither part of #34's queue:** issue #22
       (`clampWeeklyVolume()`'s last-loading-week bug, Open item 2) and issue #33 (goal-realism
       handling, Open item 5 — needed before `deriveRacePaceTarget()` can be written for real).
   - [x] **Fixture/test resync — already done, not still open (corrected in this doc-audit
         pass).** `src/lib/__tests__/paceDerivation.test.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`,
         and `src/lib/fixtures/examplePlan.ts` all already assert cycle-2's corrected numbers:
         week 9 at 45 km with a 300 m interval jog, and `paceDerivation.test.ts`'s
         >10%-goal-improvement gate already replaced by a test asserting ruling 3's goal-pace
         convergence (240 s/km), plus an `it.todo` naming the still-open goal-realism question
         (Open item 5) instead of inventing an answer to it. This step, "In flight," and "Known
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
        **Abbreviation-set sign-off (Open item 4, R5) landed 2026-07-12** — the set is confirmed
        exactly as written, so the copy this tab ships is no longer "proposed," it's final.
13. [ ] **Ian's rendered-plan review, round 2** (renumbered from "cycle 2" — that label belongs to
        the 2026-07-11 review-and-refine pass, docs and code both done, see "In flight"). **Partially
        done 2026-07-12 — GitHub issue #34 batched this queue and Ian ruled on it.** Resolved: the
        Daniels-brake question (Open item 6, R3 — permanently advisory), the strides extension
        (Open item 7, R7 — both easy days of two-easy-day loading weeks), peak volume (R2 —
        48 km approved), and two items outside the original Open-item list that surfaced in the
        same sitting (the long-run share-cap conflict, R1, closing issue #19; race-day notation,
        R6, closing issue #29). **Still open, left unchecked:** the goal-realism question (Open
        item 5, tracked as issue #33) and the actual coach's sign-off on `planTemplates.ts`'s
        *rendered* numbers — that still can't happen until step 3 above produces a real plan; a
        rendered plan needs a coach's yes, not just a passing test suite.

---

## Blocked / awaiting a decision

Only genuinely open items remain here. Everything resolved by the 2026-07-10 decision gate moved
to "Decided" below.

| Item | Blocks | Who decides |
|---|---|---|
| App name | app icon, wordmark, store listing; needed by M6, not before | Ian |
| Password minimum length | sign-up copy | Verify against what the live Supabase project actually enforces — Phase 2 |

**Resolved 2026-07-12, removed from this table:** whether Rule 5's "Monitoring" tier applies to a
one-time pre-run intake — Ian ruled it does not (R4, issue #34). Only the Immediate Stop and
Reduce Volume tiers are surfaced or actioned; Monitoring's triggers stay in `load-rules.md`/
`injury-rules.md` as documented, unused source content. See "Decided (2026-07-12)" below.

## Decided (2026-07-12) — GitHub issue #34, coaching sign-off queue closed

Full rationale for each ruling is in `docs/change_log.md`'s "2026-07-12" entry. Closes issues #19
and #29 alongside #34; issues #22 and #33 remain open and were not part of this queue.

| Item | Decision |
|---|---|
| Long-run share cap vs. the golden plan (issue #19) | **R1 — per-level ladder raised and made monotonic**: beginner 25% (unchanged), intermediate 32% (was 30%), advanced 35% (was 30%). Ian-authorised override of the source library's figures, not a port. **Follow-up ruling R1c (same day, from a code-review finding):** the cap is never removed for a deload week — it's measured against the last loading week's volume instead of the deload week's own reduced total (still bound by the spike, absolute, and time caps; an unsubstantiated deload claim is capped as an ordinary loading week). |
| Peak weekly volume, 48 km | **R2 — approved on its own merits.** `weeklyLoad` stays `[34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28]`. |
| Daniels' 10%-of-weekly-volume brake, low-volume override | **R3 — permanently advisory, never enforced, never overrides the 5K quality-volume band's floor**, not even for a low-volume runner. |
| Rule 5's "Monitoring" tier at intake | **R4 — dropped from intake entirely.** Only Immediate Stop and Reduce Volume are surfaced/actioned; Monitoring's triggers stay documented as unused source content. |
| Run-type abbreviation set | **R5 — signed off exactly as written**: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, Strides always spelled out, Race Day never abbreviated — including the known `RP`-vs-`GP` layering wrinkle. |
| Race-day structure string (issue #29) | **R6 — `WU 3 km · 5 km race · CD 2 km`.** Replaces the ungrammatical `5 km warm-up/cool-down + 5 km race`; no new notation token. |
| Strides placement | **R7 — both easy days of loading weeks 1, 2, 3, 5, 6, 7** (up from one day/week). Weeks 9/10 keep one day; week 11's taper is left alone; deloads 4 and 8 stay strides-free. Volume-neutral. |
| Week 9's interval recovery jog | **R8 — 300 m jog confirmed**, the library's 300–400 m menu for 600 m reps stands. Week 9 stays 45 km. |

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
- 🟡 **Goal-realism handling remains open — GitHub issue #33.** When a declared goal is implausibly
  faster than the runner's recent-equivalent time, should the app warn, cap, or trust the goal?
  (Open item 5.) The R-A 10% threshold already governs which pace anchors goal-pace *sessions*;
  this is the separate question of what the product says and does beyond that clamp. Blocks
  `deriveRacePaceTarget()`; `paceDerivation.test.ts` carries an `it.todo` for it rather than
  inventing an answer. **Not part of issue #34's 2026-07-12 sign-off queue** — every other Open
  item from the 2026-07-11 review-and-refine cycles (4, 6, 7) and both standalone bugs filed
  against the rendered plan (issues #19, #29) were resolved that day; this is the one that wasn't.
- 🟡 **`clampWeeklyVolume()`'s last-loading-week bug remains open — GitHub issue #22.**
  `src/lib/loadRules.ts` compares a proposed week against the literal previous week; the ruling
  encoded in the fixture (a deload week should be skipped, comparing against the last *loading*
  week instead) isn't enforced in the typed API yet. Slated to be fixed alongside
  `planTemplates.ts` (step 3 in "Next"). **Conceptually the same fix as ruling R1c** (the long-run
  share cap now measures a deload week against the last loading week's volume too) — the two
  rules agree "the last loading week" is the correct reference point, but they govern different
  functions and #22 is not resolved by R1c.
- 🟡 **Two TDD suites intentionally fail to compile, and `typecheck`/`lint` are red, because
  `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts` don't exist yet.** `npm test` is 75
  passed / 0 failed (4 suites green, 2 red-by-design); `npm run typecheck` and `npm run lint` both
  report `Cannot find module '../planTemplates'` / `'../paceDerivation'`. This was true on clean
  `origin/main` before the 2026-07-12 issue #34 pass too — not a new regression — but it means the
  repo cannot currently satisfy `CLAUDE.md`'s own "clean typecheck && lint && test before every
  commit" rule. Resolves the moment step 3 in "Next" lands both modules.
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
