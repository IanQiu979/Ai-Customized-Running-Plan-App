# MVP Progress

> The single place to see where V2.2 actually is. Updated after every exchange that changes a
> decision or completes work. If this file and reality disagree, reality wins — fix the file.
>
> Milestone definitions live in [`planning/02-product-requirements.md`](../planning/02-product-requirements.md).
> Decision history lives in [`change_log.md`](change_log.md).

**Last updated:** 2026-08-03 — client-side auth lands (`06b1f89`): `src/lib/apiClient.ts` (better-auth's
Expo client + typed fetch wrappers for every `/api/*` route), `src/app/(auth)/sign-in.tsx` +
`sign-up.tsx` (email/password; a "Continue with Google" button is wired but inert), and a
`Stack.Protected` gate in `src/app/_layout.tsx` so no route is reachable without a session — the
app now has no anonymous browsing at all, matching every `/api/*` route already 403ing anonymously.
Verified against `wrangler dev` at the curl level (sign-up, sign-in, anonymous 403, wrong-password
401) and by driving the running app (Expo Go/iOS Simulator + briefly web): unauthenticated launch
redirects to `/sign-in`, sign-in navigates into `(tabs)`, and a temporary "Sign out" button on Home
(no Settings-lite screen exists yet to host it) redirects back to `/sign-in`. **Google OAuth is the
only remaining blocker** — the captain still has to provision `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` (`workers/src/auth.ts`'s TODO); no code changes needed once they land. Also
fixed in the same commit, unrelated to auth: a stale `metro-config` subpath import in
`metro.config.js` that was blocking `expo start` entirely. This lands on top of the same day's
deload-cadence ruling: Ian's ratified "pro runners = 3 weeks, beginners = 4" — the engine already
keyed cadence to experience — `deloadEveryWeeks()` resolves the source's per-level Deload trigger
table to advanced 3 / beginner 4 / intermediate 4, and the 50+ mandatory 3-week rule still wins over
every level — and `planTemplates.ts` now calls through that single shared function instead of
inlining the same expression. Regression tests added on the golden and generic paths plus the unit
suite: under-50 advanced → `[3, 6, 9]`, under-50 beginner → `[4, 8]`, 50+ any level → `[3, 6, 9]`,
intermediate unchanged. Also settles the source's open beginner-cadence gap in `workout_library.md`.
Typecheck, lint, and all 248 tests pass.
Previous entry: issue #3's pure TypeScript plan-generation engine landed:
`paceDerivation.ts` + `planTemplates.ts`; bundled issues #22/#23 fixed; both red-first suites
un-quarantined. Typecheck, lint, and tests pass. This lands on top of the 2026-08-02 backend move:
**the backend is Cloudflare — D1 + Workers + better-auth, in `workers/`** — a captain's decision
over a Supabase project-slot constraint and a genuinely-free stack; the relational design was
ported, not re-decided. Auth, the quota ledger, `quota-status`, `purchase-tier`, `delete-account`,
intake, and plan reads all work end to end against `wrangler dev`, offline, with no Cloudflare
account. `generate-plan` is wired end to end but still returns `503 engine_unavailable` and
consumes no quota, because `workers/src/deps.ts` has not yet been swapped to call the
now-existing `src/lib/planTemplates.ts` — that wiring is the remaining gap. Two shared pure
modules, `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts`, are imported by both the app and the
Worker. 75 vitest tests in `workers/`. Nothing deployed, no secret set — see "Blocked" below.
Previous entry: 2026-07-12 integration pass: Ian's round-2 coaching sign-off closes issues #34,
#19 and #29; goal-realism ruled, closing #33; app named **Pace Blueprint** (#35); units ruled
km-only (#36); doc stale-reference sweep (#37). `main` returned to green by quarantining the two
orphaned TDD suites (#41). `formatSecPerKm` pace-rounding carry bug fixed, closing #28, adding the
first test suite under `src/components/`. Screen-reader gaps fixed, closing #31 — pace bands spoken
as words, race day announced, plus three code-review-caught defects, including collapsing the m:ss
formatter #28 fixed into one shared `formatSecPerKm()` so the two readouts can't drift apart.
`FallbackNotice` gains a required quota-copy `variant` prop, closing issue #30 (issue #45 filed for
the still-open follow-up). React Navigation's chrome now derives from `theme.ts`'s tokens instead
of leaking the library's own stock palette, closing #27. Issue #32's frontend polish batch closed —
nine of eleven findings fixed, two dispositioned (rejected / already stale). 121 tests passing, up
from 82. Issue #22 remains open.)

---

## Status at a glance

| Milestone | State |
|---|---|
| M1 — Foundation (account → empty Home) | **In progress.** Server (auth + schema + account routes) works locally on Cloudflare (`workers/`); client-side email/password auth now exists (`src/app/(auth)/`, `src/lib/apiClient.ts`) and gates the app behind a session — Google OAuth still needs the captain's credentials, and nothing is deployed |
| M2 — Intake (questionnaire persists) | Not started |
| M3 — Plan engine (3 tiers produce valid plans) | **In progress.** Pure template/pace engine done; not yet wired into the Worker's `generate-plan` route |
| M4 — Tiers & quotas (server-side, unbypassable) | **Server half done.** The quota ledger, atomic gate, fallback exemption, `quota-status` and `purchase-tier` are built and tested; no client UI |
| M5 — My Plans (history) | Not started |
| M6 — Polish & TestFlight | Not started |

**The honest summary:** planning, design, and domain research are done to an unusual depth, and
Phase 0's paper-reconciliation pass is now done too. **As of 2026-08-02 there is also a real
backend** — `workers/`, on Cloudflare D1 + Workers + better-auth — with auth, the quota ledger, and
the account routes working end to end against local emulation. **As of 2026-08-03 the pure
client/shared plan engine also exists.** `src/lib/paceDerivation.ts` derives Riegel equivalents,
training pace bands, and the ruled goal-realism/cap result; `src/lib/planTemplates.ts` builds
deterministic template plans and reproduces the approved 12-week 5K fixture exactly.
`clampWeeklyVolume()` now names and uses the last loading week, and the golden week-8 output is
30 km. The former red-first suites run normally, with typecheck and lint clean. **What is still
missing is the wiring between the two**: `workers/src/deps.ts` still binds `generate-plan`'s
skeleton builder and Pro/Elite prompt to a typed *unavailable* rather than to
`src/lib/planTemplates.ts`, which is why `generate-plan` still answers `503` and charges nothing.
The plan screen also still renders the static fixture, not a generated plan; M3 is therefore only
partially complete.

`planTypes.ts`, `loadRules.ts`, and (as of the 2026-07-11
review-and-refine cycle) `notation.ts` are the app's `lib/` layer — shared vocabulary, safety
arithmetic, and run-type/structure-string notation, all pure and tested (83 lib-layer tests, up
from 64, after Ian's 2026-07-12 round-2 rulings on issue #34 added the long-run deload-week
measurement fix (ruling R1c) and the race-day/strides test coverage, plus issue #32's
strides-label regression test; the project total is **121 across 7 suites** as of the same day's
`formatSecPerKm` carry-boundary fix (issue #28, which added the first test suite under
`src/components/`), issue #31's screen-reader accessibility fixes, issue #27's navigation-theme
suite under `src/constants/`, and issue #32's `theme.effort.test.ts`, which together took the
project total 82 → 93 → 107 → 117 → 121). A golden fixture (`src/lib/fixtures/examplePlan.ts`), a rendered
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
- [x] Env layout correct and **verified**: `.env` (client) and `workers/.dev.vars` (server) are both
      gitignored and untracked; no secret is committed; `ANTHROPIC_API_KEY` is server-side only and
      read in exactly one file, `workers/src/lib/model.ts`
- [x] `gh` 2.96.0 installed; `wrangler` 4.118 available via `npx`
- [ ] **Cloudflare account resources — none created.** `wrangler login`, `wrangler d1 create`,
      `wrangler secret put`, `wrangler deploy`: all the captain's, all unrun. See "Blocked" below.
- ~~Supabase project `v2.2_plan_generation`~~ — **superseded 2026-08-02.** The backend is Cloudflare
  now (`workers/`); the Supabase project is unused, and `supabase/` is dead scaffold kept for
  reference. Google OAuth and email/password were enabled on it and are not carried over: better-auth
  does email/password today, and Google needs a fresh client id/secret from the captain.

### Code
- [x] Expo SDK 54 scaffold — TypeScript strict, expo-router, `@/*` path alias
- [x] **`workers/` — the Cloudflare backend spine (2026-08-02).** better-auth on D1 (email/password,
      Bearer sessions), `migrations/` for both better-auth's tables and the app's, the quota ledger
      with its atomic gate and reserve→settle/release lifecycle, and the routes `generate-plan`,
      `quota-status`, `purchase-tier`, `delete-account`, `GET/PUT /api/intake`,
      `GET /api/plans[/:id]`. 75 tests in real `workerd` against real D1. Verified end to end against
      `wrangler dev`, offline. `generate-plan` returns `503 engine_unavailable` (and charges nothing)
      until the plan engine exists. Details: [`workers/README.md`](../workers/README.md)
- [x] `src/lib/tierLimits.ts` and `src/lib/quotaPeriod.ts` — pure, shared by the app and the Worker,
      as `planning/03-engineering-requirements.md` requires by name. 18 unit tests
- [x] ~~`src/lib/supabase.ts`~~ — **legacy since 2026-08-02**, nothing imports it. Kept, not deleted,
      alongside its now-built replacement (see the next bullet).
- [x] **Client-side auth against `workers/` — done 2026-08-03 (`06b1f89`).** `src/lib/apiClient.ts`
      wraps better-auth's Expo client (`authClient` — session persisted via `expo-secure-store`)
      plus typed fetch wrappers for every non-auth `/api/*` route; `src/app/(auth)/sign-in.tsx` and
      `sign-up.tsx` do email/password (a "Continue with Google" button is wired end to end but
      inert until the captain provisions credentials); `src/app/_layout.tsx` gates the whole route
      tree behind a session with Expo Router's `Stack.Protected` — no anonymous browsing at all.
      `workers/src/auth.ts` gained the `expo()` server plugin to support this. Verified against
      `wrangler dev` at the curl level and by driving the actual running app (unauthenticated
      launch → `/sign-in`, sign-in → `(tabs)`, sign-out → back to `/sign-in`); the sign-up screen
      was verified only via the shared backend curl test, not tap-tested live. Not built in this
      pass, deliberately: intake screen, plan generation UI, My Plans list, quota/tier display UI,
      visual polish. A documented TypeScript-peer-version cast lives in `apiClient.ts`'s header
      comment — see `docs/architecture.md`'s "Current — what exists in `src/`" for detail.
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
- [x] **Issue #32 frontend/code polish batch — nine of eleven findings fixed, 2026-07-12.** Applied
      to `src/components/plan/{WeekAccordion,PlanNameplate}.tsx`, `src/constants/theme.ts`,
      `src/hooks/use-theme.ts`, `src/app/(tabs)/index.tsx`, `src/lib/notation.ts`, and
      `src/lib/fixtures/examplePlan.ts`. Ribbon bars round top-only (rise from the baseline instead
      of floating above it); the ▴/▾ chevron is a drawn, fixed-weight glyph instead of a
      Unicode character riding on font-fallback weight; `PlanNameplate.tsx`'s metadata line now
      binds key→value with a colon and separates fields with `·` (was `·` doing both jobs,
      told apart only by whitespace — `docs/design/mvp-blueprint.md` Part 7 corrected to match, it
      was the origin of the ambiguity); a new `PressedOpacity` theme token replaces two hardcoded
      `0.7` press-dim values; `theme.ts`'s effort scale (`EffortLevel`, `EffortOrder`, `barHeight`)
      now derives from `planTypes.ts`'s `EFFORT_LEVELS`/`EFFORT_ORDINAL` instead of duplicating them
      (`planTypes.ts` itself untouched — still the source of truth); Home's `SafeAreaView` no longer
      reserves the bottom edge (matches `glossary.tsx`, the tab bar already owns it); a false
      provenance comment in `notation.ts` is corrected (comment only, no copy change); and
      `examplePlan.ts`'s `easyRun()` takes strides as an explicit parameter instead of inferring it
      from the structure string (fixture output byte-identical). **Two findings dispositioned, not
      fixed:** the Rule 10 disclaimer's "PACE" wording is rejected per Ian's existing 2026-07-12
      ruling (naming PR #40), not re-litigated; the "Home title" finding was already stale (Home has
      read "Pace Blueprint" since PR #40). **`BottomTabInset` stays intentionally uncalled** —
      documented in `theme.ts`'s docblock as parked until `tabBarStyle` ever goes `position:
      'absolute'`; see `docs/change_log.md` and "Known debt" below. Full account:
      `docs/change_log.md`'s 2026-07-12 issue #32 entry.
- [x] **`src/constants/navigation-theme.ts` — fixes GitHub issue #27 (2026-07-11 frontend-audit
      finding), done 2026-07-12.** `src/app/_layout.tsx` was feeding React Navigation's stock
      `DefaultTheme`/`DarkTheme` to `ThemeProvider`, which meant the library painted its own
      untokened colors (`rgb(242, 242, 242)` light background, `rgb(1, 1, 1)` dark, plus stock
      `card`/`text`/`border`/`primary`) onto chrome the app never styles directly — transition
      underlays, header defaults, the reveal behind an in-progress back-swipe — a visible seam
      against the chalk `#F7F7F4` canvas. `navigation-theme.ts` exports `NavigationLightTheme`,
      `NavigationDarkTheme`, and a `NavigationThemes: Record<ColorScheme, Theme>` lookup, each
      spreading the stock theme (keeping `dark`/`fonts`) but overriding every `colors` slot from
      `Colors` in `theme.ts`: `background`→`surface.base`, `card`→`surface.raised`,
      `text`→`text.primary`, `border`→`hairline`, `primary`→`text.primary` (deliberately not
      `Accent.hivis`, which the brief reserves for the single per-screen forward-action),
      `notification`→`status.error`. `_layout.tsx` now feeds `NavigationThemes[theme.scheme]` to
      `ThemeProvider`; `src/app/plan/[id].tsx` drops the now-redundant `headerTintColor` and keeps
      its deliberate `headerStyle` deviation from the nav theme's `card`, commented in place. New
      suite `src/constants/__tests__/navigation-theme.test.ts` (10 tests, first under
      `src/constants/`) guards against regressing to the stock literals.
- [x] **`FallbackNotice` gains a required `variant: 'exempt' | 'counted'` prop, closing issue
      #30.** It previously hardcoded the quota-exempt copy; both strings now live in the
      component, and the one caller (`src/app/plan/[id].tsx`) passes `variant="exempt"`
      explicitly, with a comment explaining why. The prop is required, with no default, by Ian's
      ruling — see `docs/change_log.md`'s 2026-07-12 entry. **Known gap, filed as issue #45:** the
      client can't yet derive the true variant from `Plan.isFallback` alone; blocked on
      `generate-plan` returning whether a fallback consumed quota (Phase 4).
- [x] **213 passing tests across 10 suites (`jest-expo`) as of 2026-08-03.** This includes the
      formerly red-first `planTemplates.golden.test.ts` and `paceDerivation.test.ts` contracts,
      now un-quarantined and green. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
- [x] **Issue #28 fixed (2026-07-12): `formatSecPerKm`'s minute/second carry.**
      `src/components/plan/format.ts` rounded minutes and seconds independently, so a fractional
      pace could round seconds up to 60 without carrying into the next minute (359.6 s/km →
      `"5:60/km"` instead of `"6:00/km"`) — latent today since every pace in `examplePlan.ts` is an
      integer, but armed to fire the moment `paceDerivation.ts` or the AI path emits an unrounded
      pace band. Fixed by rounding the total seconds once, then splitting into minutes and seconds.
      New `src/components/plan/__tests__/format.test.ts` (11 tests) was the first test suite under
      `src/components/` — covering `formatPace` (both carry-boundary cases), `formatPlanDate`, and
      `describeDays`. **93 passing, up from 82, across 5 suites** at this point (still 2 suites
      excluded — see "Known debt and risks").
- [x] **GitHub issue #31 fixed (2026-07-12): three screen-reader gaps from the 2026-07-11 a11y
      audits, plus three further defects a code review caught while fixing them.** Pace bands now
      reach VoiceOver as words (new `speakPace()` in `src/lib/notation.ts` — "4:41 to 4:54 per
      kilometer" instead of the visible en-dash/"/km" notation); race day is no longer announced as
      a generic interval (`describeDays` in `src/components/plan/format.ts` special-cases the new
      exported `RACE_DAY_LABEL` constant); `accessibilityRole="link"` was added to Home's demo
      link, though the fix turned out to be redundant — expo-router's `Link asChild` already
      supplies `role: 'link'`, so the audit's finding 3 was mistaken. Code review then caught two
      live defects the fix hadn't yet covered: `speakStructure` was leaving a pace band embedded
      inside the structure string raw, so a single flattened VoiceOver label spoke the same band
      correctly once and as broken notation once — fixed via the same transform in
      `expandStructureTokens`; and issue #28/PR #46's already-fixed `:60` rollover bug in the m:ss
      formatter would otherwise have been re-introduced by `speakPace`'s own copy of the same
      arithmetic — instead of duplicating it, `formatSecPerKm()` was collapsed into one shared
      function in `src/lib/notation.ts`, consumed by both `formatPace` (visible) and `speakPace`
      (spoken), so the two readouts cannot drift apart again. `composeWorkoutLabel` moved out of
      `WorkoutRow.tsx` into the React-free `format.ts` so the composed label is unit-tested at its
      real call site (`src/components/plan/__tests__/format.test.ts`, extended with these cases on
      top of #28's) instead of only indirectly. **107 passing tests, up from 93 (still 5 suites)**;
      `typecheck`, `lint`, and `test` all clean. No coaching rule touched. Full account:
      `docs/change_log.md`'s 2026-07-12 entries. **A suspected pre-existing bug was found while
      tracing the Link and filed separately, not fixed here** — see "Known debt and risks" below.

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

**Phase 1 core engine completed 2026-08-03.** The remaining backend-free step is wiring the plan
view to `buildTemplatePlan()` instead of the static fixture; intake and server work follow.

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
      `docs/change_log.md`'s 2026-07-12 entry. Issue #33's ruling was implemented in the engine on
      2026-08-03, and issue #22's clamp bug was fixed in the same build.

---

## In flight

**Nothing is currently in flight.** The pure engine and its test contracts are complete. The next
critical-path item is step 4 below: wire the plan route to the generated template, then build the
intake/backend flow.

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
       35–45% band, long-run share cap, long-run spike cap, Daniels time cap, HR zones. 31 unit tests.
       `clampLongRun()` reports which ceiling actually bound.
3. [x] **`src/lib/planTemplates.ts`** (+ **`src/lib/paceDerivation.ts`**) — **Done
       2026-08-03.** The pure template engine reproduces the approved 12-week 5K plan exactly and
       accepts arbitrary week counts, available run days, starting weekly volume, and supported
       race distances. Pace derivation, goal realism, issue #22's last-loading-week clamp, and
       issue #23's 30 km week-8 output landed in the same build.
   - [x] **Un-quarantine the two TDD suites.** The Jest, TypeScript, and ESLint exclusions are
         removed; both suites run in the normal gate. Typecheck, lint, and 213/213 tests pass.
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
       and `src/components/plan/` render the golden fixture end to end, but the route still imports
       that static fixture rather than calling the now-built `buildTemplatePlan()`. Wiring the
       screen is the next backend-free step.
5. [x] **Theme + fonts** — **Done.** `src/constants/theme.ts` replaced with the Instrument & Matter
       token system (commit `145d7e0`); stock template screens removed
       (`src/app/index.tsx` → `src/app/(tabs)/index.tsx`, rewritten; `explore.tsx` deleted);
       `expo-glass-effect` also removed in the same commit — the "Known debt" risk recording it as
       still-installed is stale and removed below. Not logged in `change_log.md` until this
       doc-audit pass; see its new 2026-07-10 (evening) entry.
6. [~] **The spine** — **Server half done 2026-08-02, client-side auth done 2026-08-03,
       on Cloudflare rather than Supabase.** `workers/` holds better-auth on D1, both migrations,
       and the account routes; there is no RLS to write because SQLite has none, so ownership moved
       into `workers/src/lib/store.ts` (see `docs/architecture.md` "Authorization without RLS").
       `src/lib/apiClient.ts` and `src/app/(auth)/` now let the app sign up, sign in, and sign out
       against it, gated by `Stack.Protected` in the root layout. **Still to do:** Google OAuth
       needs the captain's client id/secret (email/password works today); the captain's own
       `wrangler login`/`d1 create`/`secret put`/`deploy`.
7. [ ] **Intake** (8 questions, or 10 with a target race, + review) persisting to `intake_responses`.
       The server side exists: `GET`/`PUT /api/intake`, validated twice (readable message in the
       route, table CHECKs underneath). Only the screen is missing.
8. [~] **`generate-plan`** — tier branch, quota check, validate, retry once, fall back: **all built
       and tested** in `workers/`. Clamp and skeleton are not, because `src/lib/planTemplates.ts`
       does not exist (step 3), so the route returns `503 engine_unavailable` and charges no quota.
       Finishing it is two bindings in `workers/src/deps.ts`, not a rewrite.
9. [ ] **Quota UI + dummy paywall.**
10. [ ] **My Plans.**
11. [ ] **Motion + polish**, last, because the reveal choreographs the finalised `Plan` types.
12. [x] **Abbreviations glossary tab.** **Done.** `src/app/(tabs)/glossary.tsx`, sourced from
        `src/lib/notation.ts`'s `RUN_TYPE_ABBREVIATIONS`/`UNABBREVIATED_RUN_TYPES`/
        `STRUCTURE_SHORTHAND` exports, which are themselves copied verbatim from `notation.md`.
        **Abbreviation-set sign-off (Open item 4, R5) landed 2026-07-12** — the set is confirmed
        exactly as written, so the copy this tab ships is no longer "proposed," it's final.
13. [ ] **Ian's rendered-plan review, round 2** (renumbered from "cycle 2" — that label belongs to
        the 2026-07-11 review-and-refine pass, docs and code both done, see "In flight"). **The
        paper half is done as of 2026-07-12 — every open coaching question is now ruled on.**
        Resolved via issue #34's batched queue: the abbreviation set (Open item 4, R5), the
        Daniels-brake question (Open item 6, R3 — permanently advisory), the strides extension
        (Open item 7, R7 — both easy days of two-easy-day loading weeks), peak volume (R2 — 48 km
        approved), and two items outside the original Open-item list that surfaced in the same
        sitting (the long-run share-cap conflict, R1, closing issue #19; race-day notation, R6,
        closing issue #29). Goal-realism (Open item 5) was ruled on the same day in its own pass —
        warn at 10%, cap the race-pace anchor at 15% — closing issue #33. **Still open, left
        unchecked:** the actual coach's sign-off on `planTemplates.ts`'s *rendered* numbers. That
        can't happen until step 3 above produces a real plan; a rendered plan needs a coach's yes,
        not just a passing test suite.

---

## Blocked / awaiting a decision

Only genuinely open items remain here. Everything resolved by the 2026-07-10 decision gate moved
to "Decided" below.

| Item | Blocks | Who decides |
|---|---|---|
| `wrangler login` (interactive) | every remote Cloudflare action below | **Ian.** Opens a browser; nothing else can run first |
| `wrangler d1 create pace-blueprint` | a real remote database; `wrangler.toml`'s `database_id` is a deliberately fake placeholder until its uuid is pasted in | **Ian**, after login |
| `wrangler secret put BETTER_AUTH_SECRET` / `ANTHROPIC_API_KEY` | production auth; any real model call | **Ian.** The exact analogue of `supabase secrets set`. Generate the auth secret with `openssl rand -base64 32` |
| Google OAuth client id + secret | Google sign-in (email/password works without it) | **Ian.** A Google Cloud OAuth 2.0 "Web application" client, redirect URI `${BETTER_AUTH_URL}/api/auth/callback/google`. Exact steps: `workers/src/auth.ts`'s TODO |
| `APP_SCHEME` = `paceblueprint://` | the OAuth return into the app | **Ian.** Renamed 2026-07-12 and never verified against a built app |
| `wrangler deploy` | anything reachable from a phone | **Ian**, after all of the above |

None of the above blocks local work: everything in `workers/` runs offline against `wrangler dev`'s
Miniflare emulation with no account. The list is the exact Cloudflare counterpart of what the audit
called "the Supabase spine" — the same shape of gate, a different vendor.

**Password minimum length is decided, not blocked:** 8 characters, set in `workers/src/auth.ts`
(better-auth's `minPasswordLength`) and asserted by a test. It is ours to choose now, not something
to verify against a hosted provider's default.

**Resolved 2026-07-12, removed from this table:** whether Rule 5's "Monitoring" tier applies to a
one-time pre-run intake — Ian ruled it does not (R4, issue #34). Only the Immediate Stop and
Reduce Volume tiers are surfaced or actioned; Monitoring's triggers stay in `load-rules.md`/
`injury-rules.md` as documented, unused source content. See "Decided (2026-07-12)" below.

## Decided (2026-07-12) — GitHub issue #34, coaching sign-off queue closed

Full rationale for each ruling is in `docs/change_log.md`'s "2026-07-12" entry. This queue closed
issues #19 and #29 alongside #34; the separately tracked #22/#33 implementations landed later with
issue #3 on 2026-08-03.

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

## Decided (2026-07-12)

Full rationale for each row in `docs/change_log.md`'s 2026-07-12 entries.

| Item | Decision |
|---|---|
| App name (issue #35) | **Pace Blueprint** — a PACE-family sibling to V2.3 "Pace AnalysisAI" (`com.ian.paceanalysisai`). Chosen over "Pace Blocks," "Pace Plans," and "Pace Builder." A blueprint is a precise document you build from and don't edit — matching this app's immutable plans (2026-07-10 decision) — and carries no AI hype, matching the Instrument & Matter aesthetic (data is the decoration; glow is banned). |
| Identifiers (shipped, not just the art) | `app.json` `expo.name` → `Pace Blueprint`, `expo.slug` → `pace-blueprint`, `expo.scheme` → `paceblueprint`, `expo.ios.bundleIdentifier` → `com.ian.paceblueprint`, `expo.android.package` → `com.ian.paceblueprint` (newly added); `package.json` name → `pace-blueprint`; Home title in `src/app/(tabs)/index.tsx` → "Pace Blueprint." `package-lock.json` regenerated. |
| Why the name landed now, not M6 (revises issue #35's own premise) | The issue said the name was "needed by M6, not before" — true of the *art*, not the *identifiers*. `scheme` and the bundle ID are load-bearing for Supabase OAuth redirects and Apple/Google sign-in callbacks. Auth doesn't exist yet, EAS isn't linked (no `eas.json`, no `projectId`), and the scheme had zero references in code — so renaming today cost one edit, versus reconfiguring the Supabase redirect allowlist and the Google/Apple OAuth configs after auth ships. **Consequence:** the deep-link scheme is now `paceblueprint://`, not `v22workoutplangenerator://` — issue #5's redirect-allowlist item must use the new scheme. |
| Rule 10 disclaimer wording | Stays as-is — keeps the word "PACE" (the family brand is the entity providing coaching guidance; Pace Blueprint is one surface of it). `docs/reference/coaching/**` was NOT edited. Issue #32's claim that the fixture disclaimer was "fossilizing a placeholder" was mistaken — it's correct as written. |
| Distance/pace units — km vs miles (issue #36) | **Kilometres, everywhere, permanently. No unit toggle; units are never user-selectable.** Intake asks weekly volume in km; plans render distances in km and paces in sec/km. Imperial is **out of scope**, not deferred — not an open product question blocking intake. The code (`src/lib/planTypes.ts`, `src/lib/loadRules.ts`) was already km-canonical; only `docs/design/frontend-design-brief.md`'s stale `/mi` copy needed fixing. |
| `FallbackNotice` quota-copy variant, default or required? (issue #30) | **Required, no default** — Ian rejected the issue's own suggested fix (default to `exempt`), since a default is exactly what would let a bare `<FallbackNotice />` keep compiling while still stating a false quota claim to a runner past the 3-per-period cap. `variant: 'exempt' \| 'counted'` (`FallbackVariant`) now carries both copy strings; the one caller, `src/app/plan/[id].tsx`, passes `variant="exempt"` explicitly. The client can't yet derive the true variant server-side — filed as issue #45, blocked on `generate-plan` (Phase 4). |

### Goal-realism handling (issue #33)

Closes Open item 5 and GitHub issue #33; implementation landed with issue #3 on 2026-08-03. Full
reasoning, worked cases, and the type contract:
[`docs/superpowers/specs/2026-07-12-goal-realism-design.md`](superpowers/specs/2026-07-12-goal-realism-design.md).

| Item | Decision |
|---|---|
| Goal-realism handling — warn, cap, or trust an implausible goal? | **Two bands: warn, then cap.** Riegel-equivalent the recent performance to the goal distance and measure the implied improvement. **≤10% → `realistic`**, silent, race-pace (`RP`) sessions anchor at the raw goal pace. **10–15% → `ambitious`**, warn, but `RP` *still* anchors at the raw goal pace — ruling 3 holds even under a warning. **>15% → `implausible`**, warn **and cap** the `RP` anchor at the recent-equivalent improved by exactly 15%. Boundaries are inclusive at the top of each band; the cap engages only strictly above 15%. |
| Do the thresholds scale? | **No — flat for every runner.** No scaling by age, experience, or plan length. The source gives no per-week or per-age improvement rate to port, and inventing one would be exactly the fabricated coaching number this project forbids. Scaling stays available as an additive change if round-2 review shows flat is too crude. |
| Where the warning appears | **Both goal-entry points *and* the plan**, from one shared pure `assessGoalRealism()`. The client warns at the intake review screen *and* the configure modal (goal time travels per-generation), so the runner learns their goal is a stretch **before** spending a generation — on Free, that is 1 of 3. The engine calls the same function to cap the anchor and stamps the verdict onto the immutable plan (`Plan.goalRealism`), so the plan explains its own numbers. Same function both sides ⇒ warning and cap cannot disagree. The warning is advisory and **non-blocking**. |
| Provenance | **Both thresholds are Ian's own.** The coaching source has no goal-realism rule — `COMPLETENESS.md` lists "goal unrealistic for current fitness" under what the library is *missing*. Nothing here is portable from McMillan, and nothing here may be changed without him. |
| Blast radius | Training paces (easy/tempo/interval) stay **unconditionally** recent-derived at any goal size. A fantasy goal cannot corrupt everyday paces — the entire exposure is the `RP` session target, which is why capping one number is a sufficient fix. |

**Implemented in code:** the shared types and contract tests landed 2026-07-12;
`src/lib/paceDerivation.ts` landed 2026-08-03 with the exact ruled threshold and cap arithmetic.

---

## Known debt and risks

- 🔴 **`wrangler secret put ANTHROPIC_API_KEY` has never been run** (nor its Supabase predecessor).
  Nothing anywhere has an Anthropic key. This is not currently *breaking* anything — with no key the
  model caller returns a typed `not_configured` and the pipeline serves the template plan as a
  quota-exempt fallback — but it is a hard blocker on paid tiers ever being paid-tier.
- 🔴 **No Cloudflare account resources exist.** `wrangler login` is interactive and unrun, so
  `wrangler d1 create`, `wrangler secret put`, and `wrangler deploy` are all unrun too, and
  `wrangler.toml`'s `database_id` is a deliberately fake placeholder. Local work is unaffected —
  `wrangler dev` and the test suite need no account — but nothing is reachable from a phone. Full
  list in "Blocked" above.
- 🟠 **`generate-plan` cannot actually generate a plan yet.** The route, quota gate, idempotency,
  validation, and fallback are built and tested; the deterministic skeleton
  (`src/lib/planTemplates.ts`) and the Pro/Elite prompt are not, so it returns `503
  engine_unavailable`. Both are single bindings in `workers/src/deps.ts`, which names them so the
  swap has an owner. They are bound to typed *unavailable* implementations rather than mocks on
  purpose — the sibling repo's issue #128 shipped a mock as its production client.
- 🟢 **Resolved 2026-08-03: the client can now talk to `workers/`.** `src/lib/apiClient.ts` and
  `src/app/(auth)/` (email/password sign-in/sign-up, `Stack.Protected` session gate) landed in
  `06b1f89`. What's left of this gap is narrower: Google OAuth is wired but inert pending the
  captain's credentials, and no screen yet consumes `apiClient.ts`'s other wrappers
  (`quota-status`, intake, plans, `generate-plan`) — those land with the screens that need them.
- 🟡 **`supabase/` and `src/lib/supabase.ts` are dead code** kept deliberately (2026-08-02) so the
  earlier design stays readable. Deleting them is its own decision, and the `@supabase/supabase-js`
  dependency is still in `package.json` for the same reason.
- 🟠 **Apple Sign-In is not configured — and is now formally parked.** App Store rules require it
  once Google sign-in is offered, but configuring it needs an Apple Developer Program membership
  (App ID + Services ID + key) that Ian does not hold yet. Carved out of issue #7 on 2026-07-12 and
  recorded in [`apple-dev-blocked.md`](apple-dev-blocked.md); issue #7's remaining scope
  (email/password, Google OAuth, session routing) is unaffected and still workable today. The
  requirement binds only at App Store submission.
- 🟡 **Suspected pre-existing bug: Home's demo link may render with no border, no 48pt tap target,
  and no pressed state (found while tracing the Link for issue #31, filed as issue #51).**
  expo-router's `Link asChild` (`src/app/(tabs)/index.tsx`) uses a Radix Slot whose `mergeProps`
  spreads `style` as an *object*, but the wrapped `Pressable`'s `style` prop is a *function*
  (`({ pressed }) => [...]`) — spreading a function yields `{}`, silently dropping every rule the
  function would have returned. Derived from reading the source, not device-verified.
- 🟠 **Deep-link scheme `paceblueprint://` still unverified against a built app.** It is now
  configured as `APP_SCHEME` in `workers/wrangler.toml` and passed to better-auth's
  `trustedOrigins`, so there is no third-party allowlist to update any more — but the value itself
  was renamed from `v22workoutplangenerator://` in the 2026-07-12 identifier rename and has never
  been checked against what the app actually registers. Google OAuth will dead-end if it is wrong.
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
- 🟡 **Plan screen can't yet derive the correct `FallbackNotice` variant — GitHub issue #45.**
  `Plan.isFallback` (`src/lib/planTypes.ts:218`) is a bare boolean; only the server knows whether
  a given fallback landed inside the 3-per-period quota-exempt cap or past it (R-B addendum,
  `docs/reference/plan-generation.md:112-118`). `src/app/plan/[id].tsx` hardcodes
  `variant="exempt"` — correct for the Phase 1 fixture and the common case, wrong for a runner
  past the cap. Needs `generate-plan` to return whether the fallback consumed quota (e.g.
  `quotaConsumed: boolean` alongside `isFallback`) so the plan screen can derive `variant` from it;
  blocked on `generate-plan` existing (Phase 4, issue #9's API contract).
- 🟡 `220 − age` is retained for max HR by Ian's informed decision, against Tanaka 2001 (±10–12 bpm).
  Recorded so a future session does not "fix" it.
- 🟡 **`BottomTabInset` stays deliberately uncalled (issue #32 finding 8, 2026-07-12).** It models a
  tab bar that *floats over* content; the real tab bar (`src/app/(tabs)/_layout.tsx`) sets no
  `position: 'absolute'` on `tabBarStyle`, so React Navigation lays it out in normal flow and a tab
  screen's viewport already ends where the bar begins — padding by this constant today adds
  trailing void, not clearance. **A first attempt at this batch wired it into the Glossary's scroll
  padding and was reverted** (it silently grew Android's bottom gap from 48pt to 80pt for no
  benefit). It becomes correct — and should be applied to every scrolling tab screen at once — only
  if `tabBarStyle` ever goes `position: 'absolute'`; whoever builds Home/My Plans' real scrolling
  content next should read this before reaching for the constant. Full reasoning in `theme.ts`'s
  docblock at the constant's definition.
- 🟡 **EAS project not initialized** (`eas init` not run). No TestFlight pipeline exists yet — needed
  at M6, not before.
- 🟡 **App art is still stock Expo — unblocked by the name decision, not yet done.** The icon,
  wordmark, splash artwork, and store listing copy are all still placeholders; needed at M6, not
  before. `app.json` also still carries stock Expo blue — `#208AEF` (splash `backgroundColor`) and
  `#E6F4FE` (Android `adaptiveIcon.backgroundColor`) — which clashes with the Instrument & Matter
  token system (commit `145d7e0`). Pull both colors from `src/constants/theme.ts` when the art
  lands.
- 🟡 **Payments are dummy-only.** Real IAP (RevenueCat/StoreKit) is required before public App Store
  release; deferred to v2 per `planning/02-product-requirements.md`.
