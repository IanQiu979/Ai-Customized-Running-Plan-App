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
