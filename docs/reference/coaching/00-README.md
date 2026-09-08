# Coaching Reference Library (PACE)

Ported subset of Ian's McMillan-certified coaching library, rebranded ECHO → PACE, filtered down
to what a **one-time intake** can actually drive. This is a port, not new authorship: every rule
below traces to a specific source file and section, cited inline like `(load_rules.md § Rule 1)`.
Where the source is silent on something the engine needs, it's marked
`NOT SPECIFIED IN SOURCE — needs Ian` rather than filled in. See also `CLAUDE.md` "Coaching
domain" for the standing rules this library exists to satisfy.

**Source** (read-only, outside this repo, belongs to Ian's separate running-coach business):
`~/Desktop/Running Bussiness Files/4th Edition/Final Txt Files/` — `load_rules.md`,
`training_zones.md`, `workout_library.md`, `injury_flags.md`, `ECHO_Training_Plans_McMillan.md`,
`ECHO_Framework_CORRECTED.md`.

**Rebrand note:** where the source names the coaching system "ECHO" or labels its coaching
commentary "ECHO Cues," this port renames it "PACE" / "PACE cues." The four pillar names inside
that framework — Economy, Cadence, Harmony, Optimization — are coaching content, not branding, and
are kept as-is even though they no longer spell the product name.

**Files in this folder:**

| File | Covers |
|---|---|
| [`load-rules.md`](load-rules.md) | Deterministic safety arithmetic — volume caps, deload cadence, injury red flags, disclaimers |
| [`training-zones.md`](training-zones.md) | The 5-zone model, max-HR estimation, intensity distribution |
| [`workout-library.md`](workout-library.md) | Running session primitives (easy, tempo, intervals, long run, ...) |
| [`injury-rules.md`](injury-rules.md) | Return-to-running protocol for a declared injury |
| [`plan-structure.md`](plan-structure.md) | Phases, the Day 1…Day 7 model, deload cadence, how a plan is composed |
| [`example-plan-5k-pro.md`](example-plan-5k-pro.md) | Worked 12-week 5K Pro-tier plan, hand-derived from the library — the golden fixture `planTemplates.ts` must reproduce |
| [`notation.md`](notation.md) | Run-type abbreviations (`ER`, `TR`, `INT`, `RP`, `LR`, `SR`, `ER + Strides`), the structure-string grammar (`WU`/`CD`/`GP`/`w/`/`@`), and the headline-number convention — Ian's 2026-07-11 notation ruling |

## The applicability filter — why most of the source didn't make the cut

ECHO was a training log with wearable data: it saw every run, every RPE rating, every morning
resting heart rate, indefinitely. V2.2 collects **ten fields once, at signup**, and never sees the
runner again. **Eight are always asked**: goal, age, experience, days_per_week, weekly_km, a
race-distance choice, a recent performance at any distance (optional to *answer*, but always
*asked*), and injuries. **Two appear only once a target race is chosen**: race_date and goal_time —
so the flow is 8 questions, or 10 with a race. No logging, no wearables, no check-offs, no ongoing
data. A rule only survives this port if a one-time intake can actually drive it.

## Ported

- **Volume caps & deload cadence** — `load_rules.md` Rule 1 (weekly increase cap, long-run cap,
  deload trigger) and Rule 4 (weekly volume thresholds by level). Both are pure arithmetic on
  numbers the engine already generates. → `load-rules.md`
- **Injury red flags, triage subset** — `load_rules.md` Rule 5, the parts a *declared* symptom at
  signup can drive (as opposed to a per-run report). → `load-rules.md`, `injury-rules.md`
- **Per-flag injury volume reduction (2026-08-03).** `injury_flags.md` Part 1 / `load_rules.md`
  Rule 6's per-pattern coaching-response magnitudes — knee 15% (`injury_flags.md:29`), shin
  splints 15% (`:49`), plantar fasciitis/arch 20% (`:69`) — repurposed: the *detection* mechanism
  those sections describe (from logged cadence/mileage data) stays out of scope, unchanged from
  below, but V2.2 already collects body location as a declared closed-set `InjuryFlag` at intake,
  so the same magnitude numbers apply to that one-time declaration instead of a detected pattern.
  Flags without their own magnitude (`ankle_achilles`, `it_band`, `hip_glute`, `lower_back`) fall
  back to Rule 5's generic Reduce Volume tier (20%, `load_rules.md:185`). → `load-rules.md`,
  `src/lib/loadRules.ts`.
- **Disclaimers** — `load_rules.md` Rule 10, verbatim, non-negotiable. → `load-rules.md`
- **Training zones, whole model** — `training_zones.md`. Zones are computed from age
  (`220 − age`), which V2.2 collects, so the whole zone table is drivable. → `training-zones.md`.
  **Adults only as of 2026-08-06** — under-18 plans substitute the same file's RPE scale instead
  (captain-approved youth policy §6-A; see `training-zones.md`'s own note).
- **Running sessions** — `workout_library.md` Part 1, all 9 session types, minus the fuel/fueling
  sub-sections (out of scope, see below). → `workout-library.md`
- **Return-to-running protocol** — `injury_flags.md` Part 2. → `injury-rules.md`

## NOT ported (and why)

- `load_rules.md` **Rule 2** (RPE fatigue detection) — needs per-session RPE logging; V2.2 has
  none.
- `load_rules.md` **Rule 3** (resting-HR spike) — needs a daily resting-HR reading; V2.2 has none.
- `load_rules.md` **Rules 7, 8, 9** (illness, sleep, altitude) — each needs ongoing self-report
  V2.2 never collects.
- `load_rules.md` **Rule 6** (injury pattern detection from cadence/mileage logs, prescribing
  prehab) — not explicitly named in the porting brief, but it fails on both counts that rule out
  other sections below: it detects patterns *from logged run data* (none exists — same reason as
  `injury_flags.md` Part 1) and its remedy is a prehab exercise library (out of scope — same
  reason as Part 4). Noted here for completeness. **Its per-pattern volume-reduction
  *magnitudes*, however, are reused** for the closed-set `InjuryFlag`'s fixed at-intake cut — see
  the "Per-flag injury volume reduction" bullet under "Ported" above. Only the log-detection
  mechanism itself stays out of scope, not the numbers it prescribes.
- `injury_flags.md` **Part 1** (injury pattern detection from run data) — no run data exists;
  V2.2 never sees a run after it's assigned. (Same carve-out as Rule 6 above: the numbers survive,
  repurposed for a declared flag; the detection-from-logs mechanism does not.)
- `injury_flags.md` **Part 3** (special populations) — the female-specific rules need **sex**,
  which V2.2 does not collect (age is collected and is used elsewhere). The Runners-50+
  sub-section's *age-keyed stress-fracture timeline* is also dropped — see correction (f) below,
  same reasoning as the experience-keyed timelines.
- `injury_flags.md` **Part 4** (prehab exercise library) — plans are running-only; no prehab is
  ever emitted.
- `workout_library.md` **Part 2** (cross-training equivalences) — plans are running-only.
- **All nutrition/fueling content** — the "Fuel" sub-section on every session type, and the
  fueling guidance embedded in the long-run and marathon-pacing content — out of scope for a plan
  generator.

## Ian's decisions, applied exactly

These aren't corrections to the source's coaching content — they're V2.2 product decisions about
how the ported rules get used. Applied without second-guessing:

1. **Plans are running only.** Runs and rest days — no prehab, no cross-training, no mobility.
   Consequence: the engine's only levers against a declared injury are volume and intensity.
2. **Days are unnamed.** Day 1 … Day 7 in a 7-day cycle, never Mon–Sun. (`ECHO_Training_Plans_McMillan.md`
   already does this — "Use Day 1, Day 2, Day 3 (not Mon/Tue/Wed) for flexibility" — so this
   confirms the source rather than overriding it.)
3. **Max HR stays `220 − age`, for adults.** Ian was shown that Tanaka (2001) finds this the least
   accurate of the common max-HR formulas (±10–12 bpm scatter) and chose to keep it anyway for
   age ≥ 18 — an informed decision, not an oversight. **Under-18 (2026-08-06):** the formula's
   error is worse in youth specifically, and the definitive youth-running consensus prescribes no
   HR-zone training regardless of formula — captain-approved policy suppresses `hrZone` entirely
   below 18 and substitutes RPE. See `training-zones.md`.
4. **Deload weeks reduce volume 15–25%** (Ian's ruling, 2026-09-06, adopting McMillan's published
   figure and superseding his own 35–45% ruling of 2026-07-10, which had itself superseded a
   20–30% call the same day). `load-rules.md` § "Deload trigger" owns the current band and the full
   history; `plan-structure.md` keeps the superseded 2026-07-10 reasoning. The 5K plan's Week 4,
   whose volume *rises* while labelled a deload, remains an error under every one of these bands.
5. **The 10–15% weekly cap stays, plus a new long-run spike cap.** See corrections (a) and (b).
6. **Injuries intake field shape (decision gate #10, 2026-07-10).** Closed-set `InjuryFlag` flags
   plus an optional free-text `injury_notes` field. The flags, and only the flags, drive
   `load-rules.md` Rule 5's deterministic triage tiers; the free text is context handed to the
   model on paid tiers and never gates a safety decision. Resolves the "shape of the `injuries`
   intake field" gap below.
7. **Rule 10 disclaimer placement (decision gate #11, 2026-07-10).** A static footer section on
   every plan view, plus one line in the generating modal's fine print. Resolves the "where the
   mandatory disclaimers render" gap below.
8. **Pace-derivation method (decision gate #13, 2026-07-10) — closes the Ruling 2 re-check gap.**
   Cross-distance race-time equivalency uses the published Riegel formula,
   `T2 = T1 × (D2/D1)^1.06`, to convert a runner's recent performance to an equivalent time at the
   goal/training distance. Training paces are then anchored to the source's own relative rules
   (e.g. Zone 2 ≈ marathon pace to slightly faster; tempo = 30–60 s/km faster than easy pace by
   level) rather than any new invented numeric table. Any numeric gap the source's relative rules
   don't cover goes back to Ian as a specific question before Phase 1 codes it — nothing is
   invented. This is the "no numeric race-time → training-pace method in the source" gap the
   2026-07-10 re-check found; decision 13 is its resolution, not a new coaching rule.
9. **Red-flag injury plan shape (2026-08-03, captain ruling, injury-handling task brief).** A
   declared red-flag injury produces a normal, volume-adjusted plan — the same mechanism as any
   other closed-set flag — not the return-to-running protocol. See `plan-structure.md`'s "Design
   rule" section for the full ruling and what it supersedes.
10. **Add `plantar_arch` to the closed `InjuryFlag` set (2026-08-03, captain ruling).** Resolves
    the plan-accuracy scout's mandated finding B (arch/plantar coverage gap). Wired at its
    library-prescribed 20% reduction (`injury_flags.md:69`).

## Corrections made while porting

Each is evidence-driven and cited inline at its source location. Summary:

- **(a) Relabel the 10–15% weekly cap "coaching convention," not "verified."**
  `load_rules.md` labels this "Verified: McMillan methodology, industry standard." Buist et al.
  2008 (*Am J Sports Med*, RCT, 532 novices) found injury incidence 20.8% under a 10%-rule graded
  program vs. 20.3% without (p = .90) — no measurable effect — and a 2022 systematic review
  (23,047 runners) concluded the rule "is not justified." The cap stays in the engine as prudent
  practice; the "verified" label does not survive the port. → `load-rules.md` Rule 1.
- **(b) New long-run spike cap.** A 2025 BJSM cohort (5,205 runners, 588,071 sessions) found
  weekly volume change was a poor injury predictor, while a single run exceeding ~10% of the
  runner's longest run in the prior 30 days raised overuse-injury rates. Nielsen 2014 (*JOSPT*,
  874 novices) found >30% progression over two weeks is the risky band. Because V2.2 generates
  every week itself, this is fully deterministic: **no long run may exceed the plan's own
  previous longest long run by more than 10%.** → `load-rules.md`, new rule.
- **(c) Daniels' long-run time cap.** ~2.5–3 hours regardless of percentage of weekly volume. The
  source omits this cap entirely; added per Ian. → `load-rules.md`, new rule.
- **(d) Cadence: qualitative cue only, no absolute SPM targets.** The source prescribes absolute
  targets (170–180 SPM) and blames knee/shin injury on cadence below 170 — the 180-SPM myth.
  Optimal cadence is individual (~150–200+ SPM); the supported intervention is a 5–10% increase
  above the runner's *own* baseline (*Br J Sports Med* 2022 step-rate meta-analysis). V2.2 never
  collects cadence, so there's no baseline to increase from. Absolute SPM numbers are removed from
  everything the plan emits; cadence survives only as a qualitative cue ("quick, light feet").
  Notably, `ECHO_Framework_CORRECTED.md` § Pillar 2 already argues against one-size-fits-all SPM
  targets — the source contradicts itself between files. → `training-zones.md`,
  `workout-library.md`.
- **(e) "Polarized" → "pyramidal."** `training_zones.md` calls its intensity distribution
  polarized, but its own Phase 3 prescribes ~20% Zone 3 (threshold) work — that's a
  pyramidal/threshold distribution, not polarized (Seiler; Stöggl & Sperlich 2014). Relabeled. The
  80/20 easy-hard emphasis itself is supported and unchanged. → `training-zones.md`.
- **(f) Stress-fracture return timelines de-keyed from tier/age, made symptom-gated.**
  `injury_flags.md` keys return timelines to *experience level* (beginner 8–12 wk, intermediate
  10–14, advanced 12–16) in two places with two contradictory rationales — "more muscle mass =
  more bone load" (§ Stress Fracture Pattern, Recovery Timeline) vs. "muscle loss = slower
  comeback" for the identical 12–16-week advanced-runner figure (§ Special Case: Stress Fracture,
  Timeline) — plus a third, age-keyed version for 50+ runners (§ Runners 50+, Recovery Timeline
  Longer) reconciled with neither. The evidence keys return time to fracture **site and grade**
  (low-risk metatarsal ~6–8 wk; navicular and femoral neck 4–6 months), neither of which V2.2
  collects. All three fixed timelines are removed; the return protocol advances on the source's
  own pain-during / pain-after / next-morning checkpoints instead and never promises a week
  number. → `injury-rules.md`.

## Open gaps — `NOT SPECIFIED IN SOURCE — needs Ian`

- **Shape of the `injuries` intake field. RESOLVED 2026-07-10 (decision gate #10) — see "Ian's
  decisions, applied exactly" item 6 above.** Left here for history: routing a declared injury
  into `load_rules.md` Rule 5's three trigger tiers (Immediate Stop / Reduce Volume / Monitor)
  needs to know what the runner actually typed or selected. Neither the coaching source nor
  `planning/03-engineering-requirements.md`'s `intake_responses.injuries` column specified free
  text vs. a structured symptom picker at the time this gap was logged. Answered: closed-set
  `InjuryFlag` flags plus optional free-text notes; the flags alone drive the safety triage.
- **Whether "Monitoring" tier flags should surface at intake at all. RESOLVED 2026-07-12 (Ian's
  ruling, issue #34, rendered-plan review round 2).** Left here for history: Rule 5's triggers in
  that tier ("new muscular soreness in unfamiliar area," "joint stiffness > 10 min," "unusual leg
  fatigue 3+ days") are worded as things noticed *during or after a run* — not something a runner
  would confidently self-report once at signup, before taking a single run on the plan. The source
  doesn't say whether a one-time intake should act on this tier or only on the two more severe
  ones. Answered: no. A monitoring flag V2.2 can never monitor is a flag that does nothing, and it
  invites a self-report the runner has no basis to make before running a single session. Only the
  Immediate Stop and Reduce Volume tiers are surfaced or actioned at intake; the Monitoring tier
  stays documented in `load-rules.md` § Rule 5 as source content, not deleted, but is not used by
  V2.2.
- **Where/how often the Rule 10 disclaimers render in the UI. RESOLVED 2026-07-10 (decision gate
  #11) — see "Ian's decisions, applied exactly" item 7 above.** Left here for history: Rule 10
  mandates *that* the disclaimers appear on every injury-related and health-guidance output; it
  didn't specify UI placement at the time this gap was logged, which is out of coaching-content
  scope. Answered: a static footer section on every plan view, plus one line in the generating
  modal's fine print.

Cross-references: [`docs/reference/plan-generation.md`](../plan-generation.md) (how the tiers call
these rules) and
[`planning/03-engineering-requirements.md`](../../../planning/03-engineering-requirements.md) (the
engine's responsibilities, including the new long-run spike cap).
