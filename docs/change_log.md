# Change Log

Running history of behavior-changing work, newest first. Each entry is a dated `## YYYY-MM-DD`
heading followed by a bulleted list of what changed (and why, where it's not obvious). When you
make a behavior-changing commit, add a bullet under today's date — create a new heading at the
**top** of the file if there isn't one yet for today. Don't rewrite or delete past entries.

## 2026-07-12 — Units ruling: km, permanently (closes issue #36)

- **Ian ruled: V2.2 speaks kilometres, everywhere, permanently. No unit toggle; units are never
  user-selectable.** Intake asks weekly volume in km; plans render distances in km and paces in
  sec/km. Imperial is **out of scope**, not deferred. Recorded as a standing product rule in
  `planning/02-product-requirements.md`, next to the intake-fields section.
- **Why:** the coaching source of truth (`docs/reference/coaching/source/`) is 100% km — 314 km
  mentions, zero miles. The shipped code was already km-canonical (`Pace`'s
  `{lowSecPerKm, highSecPerKm}`, plus `volumeKm`, `distanceKm`, `MAX_WEEKLY_KM`,
  `MAX_SINGLE_RUN_KM`, `RACE_DISTANCE_KM` in `src/lib/planTypes.ts` / `src/lib/loadRules.ts`).
  A unit toggle could never be display-only: `Workout.structure` and `Workout.effortDescription`
  are free prose with the unit baked into the string, and plans are immutable once generated, so
  switching units would require choosing before generation and regenerating on a change of mind —
  burning quota for a display preference. That cost is what makes km-only correct rather than a
  deferred nice-to-have.
- **This corrected the design brief, not the code.** `docs/design/frontend-design-brief.md` had
  drifted to a stale `/mi` pace format and "weekly mileage" phrasing in three places (the paid pace
  readout copy, the intake Q4 copy, and the large-text workout-row example); all three now read
  `/km` and "weekly volume." The code needed no change — it was already correct.

## 2026-07-12 — docs stale-reference sweep (closes #37)

Doc-only pass reconciling files that still described the Phase 1 plan-engine work and the
`145d7e0` theme rewrite as pending, even though both had landed. `docs/architecture.md`,
`docs/mvp-progress.md`, and `docs/design/mvp-blueprint.md` were already reconciled by an earlier
pass (commit `75b8aba`) and were left untouched.

- **`README.md`** — "What exists today" code block rewritten to the real `src/` tree: real plan UI
  under `src/app/(tabs)/` and `src/app/plan/[id].tsx`, `src/components/plan/`, and `src/lib/`
  (`loadRules.ts`, `notation.ts`, `planTypes.ts`, `supabase.ts`, `fixtures/examplePlan.ts` —
  deliberately *not* listing `planTemplates.ts` or `paceDerivation.ts`, which don't exist yet even
  though their tests do). The "Planned layout" block no longer lists `(tabs)/index`, `plan/[id]`,
  `planTypes.ts`, or `supabase.ts` as unbuilt; auth, intake, paywall, settings, `(tabs)/plans`,
  `planTemplates.ts`, `subscription.ts`, and `generate-plan` stay listed as planned.
- **`docs/mvp-build-prompt.md`** — Ruling 18 (`expo-glass-effect` removal) and the Phase 1
  `design-system` task bullet (theme rewrite, font bundling, glass-effect removal, stock-template
  deletion) both annotated as landed in `145d7e0`, without deleting the historical instruction
  text or renumbering the ruling list.
- **`docs/design/frontend-design-brief.md`** — open-question item 5 (`expo-glass-effect`) marked
  RESOLVED 2026-07-10 (Ruling 18, `145d7e0`), matching item 6's existing RESOLVED convention. The
  now-moot `Spacing.six`-migration blockquote removed (its two call sites lived in `explore.tsx`
  and died with it), keeping the design rationale for the 48 spacing step directly above it. Part
  9's prerequisite table and checklist updated: the three Google Fonts packages marked installed,
  `expo-font`'s stale "zero font files bundled" note corrected, `expo-glass-effect` marked removed
  rather than "consider removing," and the "required before build" checklist rewritten past tense
  as done (`145d7e0`).
- **`docs/reference/coaching/example-plan-5k-pro.md`** — the "Cycle-2 note" on
  `paceDerivation.test.ts` rewritten in past tense: the resync to ruling 3's goal-pace convergence
  landed (verified against the live test file — `deriveRacePaceTarget` now asserts
  `{ pace: { lowSecPerKm: 240, highSecPerKm: 240 }, source: 'goal' }` for the fixture runner, and
  the old >10%-goal-improvement gate is gone). Open item 5's stale "still applies it" / "being
  resynced this cycle" clauses fixed to past tense; the actual open question — whether to warn,
  cap, or trust an implausibly fast declared goal — is untouched and still needs Ian's ruling.
- Closes GitHub issue #37.

## 2026-07-11 (cycle 3) — AGENTS.md rewritten as a 3-tier Subagent Usage Policy

Process/tooling decision, not a coaching or code change — logged because it changes how every
future session routes work in this repo.

- **`AGENTS.md`'s old size-based "Routing rules" (small/big) replaced with Ian's 3-tier severity
  policy**: LOW (single file, no schema/API change, easily reversible — proceed directly or with
  at most one subagent), MEDIUM (multi-file, new features, refactors touching shared code —
  minimum planning → implementation → testing → `doc-writer` if user-facing), HIGH/CRITICAL
  (schema/migrations, auth/security, production config, cross-service, or anything the user flags
  risky — full chain ending in branch + PR via `github-ops`, never a direct commit). The old
  "always big" list (auth, RLS, schema, payments, secrets/env, edge functions, plan generation,
  adding a dependency) folds into the HIGH tier definition unchanged. Skipping a required step for
  a tier is disallowed unless the user overrides it in the same message; the old "unsure → treat
  as big" rule becomes "unsure → default to the higher tier," with `task-router` kept as an
  optional escalation path.
- **New § "Subagent selection — category lookup" table** maps severity → category (planning,
  implementation by domain, testing, review/security, docs, QA/verification) → specific subagent,
  so routing is a lookup rather than a guess. Grounded directly against the 70 real subagent
  definitions at `~/.claude/agents/*.md` (name + description read for every file first) — no
  subagent name in the new policy is invented; the pre-existing "Full roster (70)" section
  cross-checks cleanly against it.
- **"Task → chain" table kept, given a `Tier` column**, and every row's chain brought in line with
  its tier's minimum requirements (e.g. the DB-schema, auth, edge-function, `generate-plan`,
  env/secrets, Expo-SDK-bump, and TestFlight-ship rows all gained the `doc-writer` → `github-ops`
  (branch + PR) tail HIGH now requires; a new "Add any new npm dependency" row was added since the
  old table never gave dependency additions their own line despite always being in the "always
  big" list).
- **Carried forward unchanged, under a new § "Standing rules"**: parallel dispatch only when tasks
  share no files; read-only agents report/never fix (with all seven existing pairings); all
  git/GitHub actions via `github-ops`; `verifier` = `npm run typecheck && npm run lint && npm
  test`, required before every commit at every tier.
- **`CLAUDE.md` checked, left untouched.** Its Git etiquette section ("branch when a change is
  multi-file, touches auth/payments/RLS/edge functions, or is worth a review pass") is coarser than
  the new HIGH tier but not contradicted by it — HIGH is a subset of that existing rule, and this
  predates the rewrite rather than being introduced by it. Flagged, not fixed, since fixing it
  wasn't this pass's scope: CLAUDE.md's "multi-file" branching trigger and the new policy's
  MEDIUM tier (which doesn't itself mandate branch + PR) can disagree on an ordinary multi-file
  feature — worth Ian's eye in a future pass.
- **`Full roster (70)`, `V2.2 guardrails agents must respect`, and the file's intro/`Expo HAS
  CHANGED` sections are untouched** — none referenced the old small/big language.

## 2026-07-11 (cycle 2) — review-and-refine: doc-side corrections to the 3/10-review rebuild

A code-review pass over cycle 1's rebuild (same day, entry below) found five internal
contradictions in the doc set plus one coverage gap worth closing while everything was already
open. This entry is the doc-side fix; code/tests are a separate, parallel pass this same cycle
(`src/lib/notation.ts`'s `STRUCTURE_SHORTHAND` gaining `·`, an accessibility fix to the structure
readout, and the `paceDerivation.test.ts` resync noted below).

- **Recovery-menu alignment: week 9's interval jog was outside `workout-library.md`'s own
  recovery menu.** The menu prescribes a 300–400 m jog after 600 m reps (40–67% of rep distance);
  week 9's `8 × 600 m` session used a 200 m jog (33%), contradicting it. Fixed to `w/ 300 m jog`.
  Ripple, all re-verified: week 9's headline INT distance 10 → **11 km** (WU 2 + 4.8 quality +
  2.1 jog + CD 2 = 10.9, rounded); week 9 total **44 → 45 km** (11 ER + 9 TR + 11 INT + 14 LR);
  volume-table note −8.3% → **−6.3%** vs week 7; week 10's note +9.1% → **+6.7%** (48 off 45);
  long-run share 14/45 = 31.1%, still inside the documented under-1-km-over-30% tolerance; the
  easy-run ≤ 80%-of-long-run check (11 ≤ 11.2) still holds. Marked in `example-plan-5k-pro.md` as
  a cycle-2 correction, with the alternative (widening the menu to ~33–67% instead) noted for Ian
  if he prefers the original 200 m jog.
- **Daniels 10%-of-weekly-volume brake was mis-scoped as an enforced rule.**
  `workout-library.md` had listed it as "used by this app" with "the smaller number wins" — but
  the app's own golden plan violates it in every quality week (10% of this plan's 34–48 km weeks
  is 3.4–4.8 km, under the 4.0–5.0 km band this app enforces). Re-scoped to advisory context from
  a different methodology, not an enforced constraint; the false "smaller number wins" line is
  removed. Whether it should ever override the band's floor for a genuinely low-volume runner is
  now an explicit open question (`example-plan-5k-pro.md` Open item 6), not a resolved rule.
- **"Reps are prescribed as distance × count" was backwards everywhere it appeared** — the
  grammar table and every emitted string are `count × distance` (`"8 × 600 m"`, count first).
  Fixed in `notation.md`, `example-plan-5k-pro.md` (the header bullet and § Session sizing), and
  this file's own cycle-1 entry below (ruling-2 bullet).
- **`notation.md`'s canonical structure-string example anchored an `INT` session `@ GP`**,
  contradicting ruling 3 (only race-specific-phase `RP` sessions anchor to goal pace; `INT`
  anchors to current fitness). Replaced with two worked examples — an `INT` session at a literal
  current-fitness pace band, and a separate `RP` session `@ GP` — so the doc no longer implies
  goal-pace anchoring for ordinary intervals. The `INT` example's recovery jog was also updated
  200 m → 300 m for the same reason as the week-9 fix above.
- **Tempo-band phrasing drifted between docs.** `example-plan-5k-pro.md` § Session sizing said
  "20–30 minutes" where `workout-library.md`'s own rule is 15–30; harmonized — the band is
  15–30 minutes, this plan's sessions sit in the 20–30 minute upper region, now stated that way in
  both places. Also reworded `workout-library.md`'s "bounded well under 10 km" to **"≤ 10 km"**,
  since week 10's tempo session is exactly 10 km — "well under" was false on the doc's own numbers.
- **Strides extended to one easy day per loading week** (weeks 1, 2, 3, 5, 6, 7, 9, 10, 11 — up
  from weeks 1–2 and 12 only), sourced from the 2026-07-11 market-research report's finding that
  strides are standard weekly maintenance in the McMillan/Runna/RunnersConnect convention and the
  ported library's own "optional 4–6 × 20 sec strides at the end" clause (`workout-library.md` §
  Session 1). Deload weeks 4 and 8 stay strides-free by choice, not rule — the library permits
  deload strides for "speedster" types; the alternative is noted, not adopted. No headline-distance
  arithmetic changes anywhere; flagged for Ian's sign-off (`example-plan-5k-pro.md` Open item 7),
  same status as the still-pending abbreviation-set sign-off (Open item 4).
- **`paceDerivation.test.ts` resync flagged, not yet landed.** That test's `deriveRacePaceTarget`
  section still encodes the 2026-07-10 R-A addendum's >10%-goal-improvement gate, which for this
  runner (11.1% implied improvement) pins the race-pace target flat at 270 s/km — contradicting
  ruling 3's week-11 goal-pace prescription (240 s/km / 4:00/km) in the golden plan. A test agent
  is resyncing that test to ruling 3 this same cycle; documented in `example-plan-5k-pro.md`'s
  "Pace bands" section as a cycle-2 note so the golden plan isn't read as contradicting a test that
  hasn't caught up yet. The gate also surfaced a genuinely open question ruling 3 doesn't answer —
  new Open item 5, "goal-realism handling": when a declared goal is implausibly faster than the
  runner's recent-equivalent performance, should the app warn, cap, or trust the goal? Not decided
  here.
- **Tracker sync.** `docs/mvp-progress.md` corrected: the fixture rebuild, `notation.ts`, the
  glossary tab, and the passing test suite are moved from "not done" to done (they already existed
  in the working tree, just weren't reflected); the stale "Aanya's baby" / `src/app/index.tsx:38`
  debt entry is removed (`src/app/index.tsx` was renamed to `src/app/(tabs)/index.tsx` and
  rewritten in the theme commit; `explore.tsx` no longer exists).
- **Correction, doc-audit pass, same day: the "paceDerivation.test.ts resync flagged, not yet
  landed" bullet above was wrong by the time this pass checked the actual files.**
  `src/lib/__tests__/paceDerivation.test.ts`, `src/lib/__tests__/planTemplates.golden.test.ts`,
  and `src/lib/fixtures/examplePlan.ts` all already assert cycle-2's numbers: week 9 at 45 km with
  a 300 m interval jog, and `paceDerivation.test.ts`'s `deriveRacePaceTarget` section already
  replaces the stale >10%-goal-improvement gate with a test asserting ruling 3's goal-pace
  convergence (240 s/km), plus an `it.todo` naming the still-open goal-realism question (Open item
  5) rather than inventing an answer to it. None of the three files needed further resyncing.
  `docs/mvp-progress.md`'s "In flight," "Next" step 3, and "Known debt" sections repeated this same
  now-corrected claim and are fixed in this pass too. `planTemplates.ts` and `paceDerivation.ts`
  themselves genuinely don't exist yet — that part of the original claim stands.
- Constraints respected: HR-zone tables, `load-rules.md` and `injury-rules.md`'s numeric rules,
  the Day 1…Day 7 model, and running-only scope are all untouched. `training-zones.md`,
  `load-rules.md`, `injury-rules.md`, and `planning/` were not opened for this pass.

## 2026-07-11 — Ian's 3/10 review: session-sizing correction, notation system, pace-anchor supersession

Ian reviewed the rendered 5K plan and scored it **3/10**, naming one concrete defect: the tempo
session grew 9 → 10 → 11 → 12 → 12 → 14 km across the plan to absorb rising weekly volume,
producing a 14 km tempo run at 4:30 pace inside a 5K plan — *"makes no sense."* Five rulings
followed. A market-research pass on published 5K plans (Higdon, McMillan, Daniels, Pfitzinger,
RunnersConnect, Runna, Nike Run Club) was run first to check the fix against real coaching
practice rather than inventing one; findings are cited inline in the docs below (report:
[`docs/reference/market-research-5k-plans.md`](reference/market-research-5k-plans.md), preserved
into the repo at the end of the session since the coaching docs cite it as a source).

- **Ruling 1 — quality-session sizing is keyed to race distance, never scaled with weekly
  volume.** Tempo and interval session size is now a fixed physiological band (5K: tempo 15–30 min
  sustained; interval quality volume 4.0–5.0 km off the McMillan rep menu), independent of the
  week's total volume — matches every source in the research pass, none of which scale a 5K
  session by weekly-mileage tier. Surplus volume goes to easy runs and the long run instead, inside
  the existing long-run share cap. New section: `docs/reference/coaching/workout-library.md` §
  "Session sizing by race distance," clearly marked as Ian's ruling + research-sourced, not a port.
- **Ruling 2 — reps are prescribed as count × distance**, never a bare distance or bare time
  (`"4 × 600 m"` style), with recovery and target pace stated. The source library only has
  time-based structures (`6 × 3 min`); the distance-rep menu (400/600/800/1000 m, McMillan's own
  four interchangeable designs) is adopted from the research pass under this ruling, added to
  `workout-library.md` § VO2 Max Intervals.
- **Ruling 3 — race-pace-rep anchoring converges from current fitness to goal pace, superseding
  part of the 2026-07-10 correction.** Ian: *"your goal is to run at your goal pace, might be
  slower in the beginning."* Early-plan interval sessions run at current-fitness interval pace;
  race-specific-phase race-pace-rep sessions run at goal pace directly. This is the McMillan
  position (Higdon and Runna also anchor to goal pace); Daniels forbids goal-pace anchoring
  outright and anchors to current fitness only — Ian is McMillan-certified and ruled for McMillan,
  with the early-plan moderation answering Daniels' overtraining concern. **This supersedes, not
  deletes, the 2026-07-10 correction that pinned week-11 race-pace reps flat at this runner's
  current pace (270 s/km) throughout** — recorded with the supersession explicit in
  `example-plan-5k-pro.md`'s "Open" section, not silently overwritten.
- **Ruling 4 — run-type labels are abbreviated, never spelled out, except Strides.** Ian's
  examples: `ER` (easy run), `TR` (tempo run). New canonical set, **marked "proposed... pending
  Ian's sign-off"**: `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, composite `ER + Strides`,
  unabbreviated `Race Day`; in-structure shorthand `WU`/`CD`/`GP`/`w/`/`@`. New file:
  `docs/reference/coaching/notation.md` — the abbreviation table (written full-name-first, one
  line each, so it drops into the planned in-app abbreviations glossary tab unchanged), the
  structure-string grammar with worked examples, and the strides rule.
- **Ruling 5 — praised, unchanged.** The plan staying within the runner's weekly volume capability,
  and the HR zones. Neither `training-zones.md` nor `load-rules.md`'s numeric rules were touched.
- **Headline-number convention decided and documented (a deliberate divergence, flagged for Ian):**
  published plans headline quality *work only* and itemize warm-up/cool-down separately (research
  §5); this app's `Workout.distanceKm` is instead the **total** kilometres run that day (WU + work
  + CD + recovery jog), so each day sums cleanly into the week's volume the wave chart renders —
  the thing ruling 5 praised. The `structure` string still itemizes WU/work/CD so the true
  quality-work size is never hidden. Documented in `notation.md`.
- **`docs/reference/coaching/example-plan-5k-pro.md` rebuilt** under all five rulings: same runner,
  HR zones, phase names, deload architecture (weeks 4/8, ~40% off the last loading week), and 4-day
  Day 1/3/5/6 pattern; every tempo/interval/race-pace session resized to the fixed band above, with
  the arithmetic shown (sustained minutes × ~4:45–4:50/km, inside the derived 281–294 s/km tempo
  band); every day label abbreviated per `notation.md`.
  **Volume-table consequence, stated as a rule, not an accident: weekly volume is now the *sum* of
  correctly-sized sessions, not a target the sessions are stretched to fill.** The old 52–54 km
  peak weeks only existed because the tempo/interval sessions were inflated past their sizing band
  — the exact defect ruling 1 removes. With sessions right-sized, this runner's 4-day week cannot
  fill 52–54 km without breaking the long-run cap, so the new peak lands at **48 km** (weeks 7 and
  10, tied) instead. New volume table, week → km: 1→34, 2→35, 3→38, 4→23 (deload), 5→41, 6→45,
  7→48, 8→30 (deload), 9→44, 10→48, 11→40, 12→28. Two small consequences flagged for Ian in the doc
  itself: week 1 lands 1 km under the runner's declared 35 km/week baseline (the 80%-of-long-run
  cap on easy runs is the binding constraint), and every loading week's long run rounds 0.5–0.8 km
  over a strict 30%-of-volume reading once each day is a whole kilometre (mechanical rounding, not
  the cap being ignored — both inside the ±1 km tolerance this revision uses when the caps
  interact). The "Bug found while building this" `clampWeeklyVolume()` note stays, still unfixed in
  code (`planTemplates.ts` doesn't exist yet).
- **Pace bands section rewritten to reflect it's largely resolved, not open.** The doc's original
  "pace gap" (no tempo/easy pace formula anywhere in the source) was already closed by the
  2026-07-10 decision-13 Riegel-based method and is now implemented in the in-flight
  `paceDerivation.ts` module — the doc was still describing it as open. Updated to show this
  runner's actual derived bands (tempo 281–294 s/km, interval 262–270 s/km, easy 326–354 s/km) and
  to note the one genuinely still-open piece: no relative rule exists for steady/Zone 2 pace.
- **Cross-references added**, nothing else changed: `plan-structure.md` and `00-README.md` now
  point to `notation.md`. Swept `docs/` and `planning/` for the old inflated numbers and labels
  ("Tempo 14," "54 km," full-name day labels) — found none outside `example-plan-5k-pro.md` itself
  and the quotes of Ian's words added above; `docs/mvp-build-prompt.md`,
  `planning/02-product-requirements.md`, and `docs/reference/plan-generation.md` never restated
  specific session sizes, so nothing there needed a fix.
- Constraints respected: HR-zone tables, deload rules/cadence, `load-rules.md`'s numeric rules,
  injury rules, the Day 1…Day 7 model, and running-only scope are all untouched.
- **Correction, same day: this entry originally claimed "no code file was edited" — that was
  wrong even at the time of writing.** Cycle 1 also shipped `src/lib/notation.ts` (the
  `RUN_TYPE_ABBREVIATIONS` / `STRUCTURE_SHORTHAND` code counterpart of `notation.md`, with
  `expandLabel()` for screen-reader text), the abbreviations glossary tab
  (`src/app/(tabs)/glossary.tsx`), the rebuilt golden fixture (`src/lib/fixtures/examplePlan.ts`),
  and three test files (`notation.test.ts`, `examplePlan.fixture.test.ts`, plus the still-failing
  TDD suites `planTemplates.golden.test.ts` and `paceDerivation.test.ts`, which intentionally fail
  on missing modules — `planTemplates.ts` and `paceDerivation.ts` don't exist yet). 52 tests pass.
  `src/lib/planTemplates.ts` and `src/lib/paceDerivation.ts` themselves are still the next
  session's work, as the superseded sentence correctly said.
- **Second correction, doc-audit pass, same day: "52 tests pass" above was also wrong, even at the
  time of writing.** Summing the four passing suites' actual test counts (`supabase.test.ts` 3,
  `loadRules.test.ts` 19, `notation.test.ts` 13, `examplePlan.fixture.test.ts` 29) gives **64**,
  matching `npm test`'s live output (`Tests: 64 passed, 64 total`, `Test Suites: 2 failed, 4
  passed, 6 total`). `docs/mvp-progress.md`'s occurrences of the same figure are corrected to 64
  in this pass.

## 2026-07-10 (evening) — theme rewrite: "Instrument & Matter" tokens land in code

**Missing from this log until now — added in this doc-audit pass.** Commit `145d7e0` shipped
between Phase 0's decision gate (below) and Ian's 3/10 review above (the review's rendered plan
and the golden fixture's components already consume these tokens), but was never given its own
entry.

- **`src/constants/theme.ts` and `src/hooks/use-theme.ts` rewritten** from the stock Expo template
  palette to the full "Instrument & Matter" token system specified in
  `docs/design/frontend-design-brief.md` Part 2: `Colors` (light/dark bases, effort scale,
  `grid.*`), `Accent`, `FontFamily`/`FontSize`, `Spacing`, `Radius`, and `Motion`. Two contrast
  values the brief left unresolved were computed to the documented 4.5:1 floor rather than
  guessed: `text.secondary` dark `#7E8590` (4.83:1 on `#14171C`) and `progress.informative` light
  `#676D7B` (4.83:1 on `#F7F7F4`) / dark `#788696` (4.83:1 on `#14171C`).
- **Spacing ramp gains a step.** `48` inserted between the old `five` (32) and `six` (64); the old
  `six` is renamed `seven`. The only two call sites using the old name were in the now-deleted
  `explore.tsx`.
- **Bundled the three font families** (`@expo-google-fonts/barlow-condensed`, `-inter`,
  `-ibm-plex-mono`) via `npx expo install`; `src/app/_layout.tsx` now loads them with `useFonts`
  and keeps the native splash screen up until they resolve.
- **Removed `expo-glass-effect`** — banned by the no-blur depth rule (Phase 0 Ruling 18); this
  system has no sanctioned blur use. Resolves the corresponding 🟠 risk in
  `docs/mvp-progress.md`'s "Known debt," removed in this pass.
- **Deleted the stock Expo template surface**: `src/app/explore.tsx`, `animated-icon*`,
  `hint-row.tsx`, `web-badge.tsx`, `app-tabs*`, `themed-text.tsx`, `themed-view.tsx`,
  `external-link.tsx`, `ui/collapsible.tsx`, and `src/global.css`.
- **`src/app/index.tsx` → `src/app/(tabs)/index.tsx`, rewritten** as a token-only placeholder Home
  screen proving the font/token pipeline boots. The stock template's placeholder title `"Aanya's
  baby"` is gone.
- Verification before commit: `typecheck`, `lint`, 22/22 tests, and `npx expo export --platform
  web` all ran clean.

## 2026-07-10 (Phase 0) — audit rulings applied, decision gate closed

Doc-sync pass following `docs/mvp-build-prompt.md`'s Phase 0 (§0-B rulings, §0-C decision gate).
Full detail for each item lives in the file it changed; this entry is the index.

- **All 20 audit rulings in `docs/mvp-build-prompt.md` §0-B applied** across `CLAUDE.md`,
  `docs/architecture.md`, `docs/reference/plan-generation.md`, `docs/reference/coaching/`,
  `planning/02-` and `03-*.md`, `docs/design/frontend-design-brief.md`,
  `docs/design/mvp-blueprint.md`, `docs/mvp-progress.md`, and `src/lib/planTypes.ts` (comment
  only). See that file rather than restating all 20 here — nothing was re-litigated or softened.
- **Decision gate — 13 rulings, Ian, 2026-07-10:**
  1. **Paywall + Settings restored to MVP.** Minimal dummy paywall (M4 needs it — without it
     nobody reaches Pro/Elite) + settings-lite (sign out, tier display, restore), in the
     blueprint's reserved third tab slot.
  2. **Fallback plans do not burn quota.** `is_fallback` filter in both `generate-plan` and
     `quota-status`, capped at 3 quota-exempt fallbacks/period so free-text `notes` can't farm
     unlimited template plans; `notes` is length-limited and sanitized.
  3. **Goal-vs-recent pace threshold = 10%, gating race-pace session targets only (refined by
     addendum R-A below).** Training paces are **unconditionally** derived from the recent time —
     the goal never drives everyday paces, at any improvement size. The threshold decides only
     which pace the goal-pace *session itself* is prescribed at.
  4. **Free configure gating.** Free sees every option; out-of-tier selections render locked and
     route to the paywall on tap — never a dead disabled button.
  5. **"Next workout" card dropped** (Ian's override of the recommended current-week
     arithmetic). Home shows the plan link + quota state only; no current-week concept exists.
  6. **Red-flag injury protocol** renders as a conservative fixed-length plan whose weeks carry
     the protocol's phases, plus a pain-gated-progression `extras` section, plus Rule 10
     disclaimers — and does not consume quota.
  7. **Elite extras cut for MVP.** Elite = richest personalization prompt + per-workout "why"
     only; `Plan.extras` can carry confirmed extras later without a schema change.
  8. **"Experienced" keeps mapping to intermediate** — the safer, tighter-caps reading.
  9. **Intermediate deload cadence stays 4 weeks** (50+ still always forces 3).
  10. **Injuries intake field: closed-set `InjuryFlag` flags + optional free-text notes**
      (length-limited/sanitized); flags alone drive safety triage, notes inform paid prompts only.
  11. **Rule 10 disclaimers**: a static footer section on every plan view + one line in the
      generating modal's fine print.
  12. **Phone-only v1; iPad and desktop/computer support move to v2** (Ian: "phone only for
      phase 1, then ipad and computer in phase two"). App name stays open until M6; password
      minimum to be verified against the live Supabase project in Phase 2.
  13. **Pace-derivation method** (closes Ruling 2's re-check gap): cross-distance equivalency via
      the published Riegel formula (`T2 = T1 × (D2/D1)^1.06`); training paces anchored to the
      source's own relative rules (e.g. Zone 2 ≈ marathon pace to slightly faster; tempo = 30–60
      s/km faster than easy pace by level). Any remaining numeric gap goes back to Ian as a
      specific question — nothing invented.
- **Addenda, same day (Ian's follow-up rulings, sharpening decisions 3 and 2 above):**
  - **R-A — the 10% threshold gates race-pace session targets only.** If the goal implies ≤10%
    improvement over the recent-time equivalent (Riegel), goal-pace sessions use the raw goal
    pace; beyond 10%, goal-pace sessions are prescribed at the recent-time-equivalent pace
    instead. **Training paces are unconditionally recent-time-derived** — the `planTypes.ts`
    contract (`recentPerformance` drives every pace; `goalTimeSec` drives race-pace sessions
    only) stands exactly as coded; the goal never drives everyday paces, regardless of the
    threshold. This corrects decision 3's original wording, which read as if training paces
    themselves became goal-derived under the threshold.
  - **R-B — a 4th+ quota-exempt fallback in a period burns quota.** Decision 2's 3-per-period
    fallback exemption is a cap, not an unlimited allowance: once a user has 3 quota-exempt
    fallbacks in a period, the already-reserved slot for a 4th+ fallback is **kept, not
    released** — nobody is refused a plan, but that attempt counts against quota. The
    fallback-card copy must say so honestly when it applies (see
    `docs/design/frontend-design-brief.md`).
- **Ruling 19 done: `claude-sonnet-5` verified live** against the Anthropic Models API with the
  project's server-side key today — a real model ("Claude Sonnet 5," 1M input tokens, 128K max
  output). V1 runs `claude-sonnet-4-6`; this confirms the new string actually exists.
- **Ruling 2 re-check done: no source coaching rule was wrongly filtered out by the 8→10-field
  intake change.** Every rule marked NOT-ported in `docs/reference/coaching/00-README.md` needs
  logging, wearable, or sex data that the two new time fields don't supply. The one real gap the
  re-check found — no numeric race-time → training-pace method anywhere in the source — is closed
  by decision 13 above.

## 2026-07-10 (later still) — plan shape spec + build prompt

- **Plan shape spec added to `planning/02-product-requirements.md`.** "Fixed duration (8 / 12 /
  16 weeks)" is replaced by rules ported from `ECHO_Training_Plans_McMillan.md §
  Customization Guidelines`:
  - **Never refuse.** A race three weeks out gets an honest three-week plan (race-specific work,
    final week a taper) instead of being turned away.
  - **Plan length is keyed to race distance, not experience**: 5K 12–14 weeks, 10K 14–16, half
    16–20, marathon 24–30. Ultra is deferred to v2 — no source content exists for it.
  - **Maximum plan length is a tier feature**: Free 12 weeks, Pro 24, Elite 30+. Consequence
    stated plainly: Free can only reach a 5K plan; a 10K needs 14 weeks minimum.
  - **Days available shape the week** (`§ Weekly Availability`): under 3 days → a 3-run week
    (easy, tempo, long); 3–4 days → add steady/interval; 5–6 days → the full program.
  - **v2 section explains the ultra deferral**, naming both blockers: no source content exists
    (5K/10K/half/marathon only in the library — not ours to invent per `CLAUDE.md`'s coaching
    domain rule), and `load-rules.md` Rule 4's ceilings (110 km/week, 35 km longest run) cannot
    express an ultra distance even if content existed.
- Added `docs/reference/coaching/example-plan-5k-pro.md` — a hand-derived, fully worked 12-week
  5K Pro-tier plan tracing every number to a source rule or intake arithmetic; it doubles as the
  golden fixture `src/lib/planTemplates.ts` must reproduce.
- Added `docs/mvp-build-prompt.md` — the audited, multi-session build prompt (three-lens audit:
  spec consistency, design blueprint, live DB state) the MVP build will follow phase by phase.

## 2026-07-10 — Coaching domain decisions

- **Intake grows to 8 fields**: `age` added. Not cosmetic — max HR is estimated `220 − age`, so no
  HR zone is computable without it, and the load rules make a 3-week deload mandatory for 50+.
  Updated `planning/02`, `planning/03`, `docs/architecture.md`, and both design docs (intake is now
  8 questions + review; the a11y progressbar name is "Question 3 of 8").
- **Plans are running-only.** Prehab strength, cross-training, and mobility sessions are dropped
  from Echo's McMillan plans. Consequence recorded: the engine's only levers against a declared
  injury are volume and intensity.
- **Days are unnamed** (Day 1 … Day 7, rest days as real slots). Confirms the length-7 `Week.days`
  array and leaves the seven-cell week ribbon unchanged.
- **Deload weeks reduce volume 20–30%.** Fixes an inconsistency where the 5K example plan labelled
  Week 4 a deload while its volume rose (~17–19 km → ~18–19 km). `load_rules.md` is authoritative.
- **Safety logic belongs in typed code, not prompts** — added to `CLAUDE.md`. The template engine and
  the AI-output clamp share one deterministic implementation of the load and injury rules.
- **Ported the coaching library** into `docs/reference/coaching/` (`00-README.md`, `load-rules.md`,
  `training-zones.md`, `workout-library.md`, `injury-rules.md`, `plan-structure.md`), rebranded
  ECHO → PACE, filtered to what a one-time intake (no logging, no wearables) can actually drive.
  Six evidence-driven corrections applied while porting: the 10–15% weekly cap is now labeled
  "coaching convention" not "verified" (a); a new long-run spike cap (b) and long-run time cap (c)
  were added, since V2.2 generates every week and can enforce both deterministically; cadence is
  now a qualitative cue only, no absolute SPM targets (d); the "polarized" intensity label is
  corrected to "pyramidal" (e); stress-fracture return timelines are de-keyed from
  experience/age and made symptom-gated instead (f). Full reasoning and citations in
  `docs/reference/coaching/00-README.md`.
- Updated `docs/reference/plan-generation.md` to point at the new coaching library and note that
  all three tiers share the same deterministic load/injury rules — Elite clamps Claude's output
  against them post-generation since it has no template skeleton.
  **⚠️ Superseded later the same day — see "Elite is not unconstrained" below: Elite does use the
  template skeleton, it just customizes it far more heavily.**
- Added the long-run spike cap to the `generate-plan` edge function's responsibilities in
  `planning/03-engineering-requirements.md`.
- **Elite is not unconstrained — corrects the entry above.** All three tiers build on the same
  coach-authored template skeleton; it is never removed. Free selects + lightly parametrizes it (no
  AI call, effort descriptions only). Pro's Claude personalizes workouts, paces, HR zones, and a
  weekly "why" within it. Elite's Claude customizes the same skeleton far more heavily (richest
  prompt: injury history, periodization nuance, race context; a per-workout "why"; any confirmed
  extras) — still inside the skeleton. The deterministic load-rule clamp applies **identically to
  all three tiers**, not just Elite. Rationale: Runna's publicly reported injury cases trace to an
  algorithm that "takes the runner at their word," and Düking et al. 2024 found LLM-generated plans
  were not rated optimal by coaching experts without oversight — selling the top tier as the one
  with the guardrail removed would be backwards. Canonical wording lives in
  `planning/03-engineering-requirements.md`'s `generate-plan` section; propagated to
  `docs/architecture.md`, `docs/reference/plan-generation.md`, `docs/design/frontend-design-brief.md`,
  `docs/design/mvp-blueprint.md`, `planning/02-product-requirements.md`, and `README.md`.
- **HR zones belong to Pro *and* Elite, not Elite-only.** `planning/02-product-requirements.md` was
  always right (Pro gets HR zones); `docs/design/frontend-design-brief.md` and
  `docs/design/mvp-blueprint.md` had drifted and showed the HR zone as an Elite-only addition over
  Pro's pace-only row. Fixed the row anatomy in both design docs: Free shows a qualitative effort
  description with no readout bracket; Pro and Elite both show a bracketed mono pace range + HR
  zone; Elite's row is taller only because its "why" is longer and per-workout, not because it
  measures more.
- **Merged `docs/status.md` into `docs/mvp-progress.md`** (the living tracker), then deleted
  `docs/status.md`. All eleven open items moved into `mvp-progress.md`'s "Blocked / awaiting a
  decision" or "Known debt and risks" sections — nothing dropped. Fixed the resulting dangling
  `docs/status.md` links in `docs/architecture.md` and `docs/reference/plan-generation.md`.
  (`AGENTS.md` still references `docs/status.md` once — left untouched, since editing `AGENTS.md`
  was explicitly out of scope for this pass; needs a follow-up.)
- Marked the coaching-library port **done** in `mvp-progress.md` (moved from "In flight" to "Done"
  — six files under `docs/reference/coaching/`).
- Added the three open coaching-port gaps to `mvp-progress.md`'s "Blocked / awaiting a decision":
  the shape of the intake `injuries` field (free text vs. structured picker), whether Rule 5's
  "Monitoring" tier applies to a one-time pre-run intake at all, and where the mandatory
  disclaimers render in the UI.
- Flagged a new risk in `mvp-progress.md`: Ian's own `workout_library.md` worked deload examples
  reduce volume ~35–45% (three independent examples), exceeding the 20–30% band he made
  authoritative. Unresolved — the port currently enforces 20–30% regardless.

## 2026-07-10 (later) — first product code, and two decisions superseded

- **`src/lib/planTypes.ts`** — the shared plan vocabulary. Pure TypeScript, no runtime deps, imported
  by both the Expo app and the Deno edge functions. `Day = RestDay | Workout` (plans are running-only);
  `Week.days` is a length-7 tuple of unnamed days; rest is deliberately **not** an `EffortLevel`, which
  is what lets the ribbon render it as a gap.
- **`src/lib/loadRules.ts`** — the deterministic safety arithmetic, ported from
  `docs/reference/coaching/`. 19 unit tests. `clampLongRun()` applies four ceilings (weekly share,
  absolute single-run, spike, time) and reports which one bound. The time cap silently does not apply
  when no pace is known, rather than pretending to clamp.
- **The type system now enforces the design's honesty rule.** `pace` and `hrZone` are optional on
  `Workout`, so a Free plan — or any plan from a runner who gave no recent time — structurally cannot
  carry a measured numeral. The "readout bracket" can never render a lie.

### Superseded, same day

- **Deload weeks now reduce volume 35–45%, not 20–30%.** Ian's own three worked examples in
  `workout_library.md` (~40% / ~45% / ~35–40%) all sit outside the 20–30% band his Deload Trigger table
  states, and his "Exception — Recovery Weeks" clause already permits deeper cuts. The fact-check found
  no direct RCT evidence for any specific magnitude, so the coach's own practice is the tiebreak.
  Enforced as a band with a floor *and* a ceiling: `isValidDeload()` accepts `[0.35, 0.45]`.
  The earlier bullet in this file recording "20–30%" is **superseded**.
- **Intake grows from 8 fields to 10.** Added `goal_time_sec` (shown only when a target race is chosen)
  and `recent_perf_distance` / `recent_perf_time_sec` (optional). Goal time drives **race-pace sessions
  only**; the recent time drives **every other training pace**. Deriving easy or tempo pace from a goal
  the runner hasn't achieved would prescribe paces they cannot sustain — the exact failure behind
  Runna's reported injuries. Without a recent time, no numeric pace is emitted at any tier.
  The earlier bullet recording "8 questions + review / Question 3 of 8" is **superseded**.

### Housekeeping

- `docs/status.md` merged into `docs/mvp-progress.md` and deleted; all references updated.
- `.claude/HANDOFF.md` deleted — 161 lines of stale notes from an unrelated debugging session,
  asserting this project is on Expo SDK 56. It is pinned to SDK 54.
- `AGENTS.md` gains a rule: no agent changes a coaching rule, formula, or clinical claim without Ian.

## 2026-07-09

- Rewrote `README.md` from the create-expo-app boilerplate into a real project doc (status,
  stack, tiers, environment, structure, roadmap).
- Fixed `.gitignore`, which previously ignored only `.env*.local` and would have committed the
  real `.env`.
- Added `.env.example` and `supabase/functions/.env.example` as committed templates for the
  client and edge-function env files.
- Provisioned the Supabase project `v2.2_plan_generation` (ref `vvvcaulmbwbujeszfvbo`, region
  ap-northeast-1, Free plan) and deleted the empty `DashboardFeature` project to free a
  Free-plan project slot.
- Enabled Google OAuth and email auth on the new Supabase project (`apple` and
  `anonymous_users` remain off).
- Installed `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill`.
- Added `src/lib/supabase.ts`, the shared Supabase client (env-guarded at import, native
  session persistence, AppState-driven auto-refresh).
- Installed `jest-expo` and added `src/lib/__tests__/supabase.test.ts` covering the env
  contract (3 tests, all passing).
- Added `typecheck` and `test` npm scripts.
- Corrected `AGENTS.md`'s Expo docs link from v57 (no such SDK is installed) to v54, matching
  the pinned `expo ~54.0.0`.
- Force-pushed the local history over the remote's stub initial commit on
  `IanQiu979/WorkoutGenerationv2.2`.
- Rewrote `CLAUDE.md` and added `docs/architecture.md`, `docs/change_log.md`, `docs/status.md`,
  and `docs/reference/plan-generation.md` to give future sessions persistent, accurate project
  memory.
