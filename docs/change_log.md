# Change Log

Running history of behavior-changing work, newest first. Each entry is a dated `## YYYY-MM-DD`
heading followed by a bulleted list of what changed (and why, where it's not obvious). When you
make a behavior-changing commit, add a bullet under today's date — create a new heading at the
**top** of the file if there isn't one yet for today. Don't rewrite or delete past entries.

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
