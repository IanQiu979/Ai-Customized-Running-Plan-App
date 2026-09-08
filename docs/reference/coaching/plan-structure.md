# Plan Structure — Phases, the Day Model, and Composing a Plan

Ported subset of `training_zones.md` § McMillan Periodization Cycles, `ECHO_Training_Plans_McMillan.md`,
and `workout_library.md` Part 3 (Deload Week Architecture), plus one design rule that is Ian's
decision about how V2.2 uses the ported red-flag rules — not a literal source quote.

## The Day 1…Day 7 model

**Days are unnamed.** A week is Day 1 … Day 7 in a 7-day cycle; rest days are real slots the
runner still sees, not absences. The app never emits Mon–Sun — the runner places the plan on
their own calendar (Ian's decision). This isn't an override of the source:
`ECHO_Training_Plans_McMillan.md` already does this — *"Use Day 1, Day 2, Day 3 (not Mon/Tue/Wed)
for flexibility"* (`ECHO_Training_Plans_McMillan.md § Training Plan Philosophy`) — so the port
confirms it rather than overriding it.

## Running only

Plans contain runs and rest days — no prehab strength, no cross-training, no mobility sessions,
even though the McMillan example plans in the source interleave prehab strength 1–2×/week
throughout (every example week in `ECHO_Training_Plans_McMillan.md` includes a "Prehab Strength"
day). Consequence: the engine's only levers against a declared injury are **volume and
intensity** — there's no third lever (Ian's decision; see `00-README.md` and `CLAUDE.md`
"Coaching domain").

## Phases

`training_zones.md § McMillan Periodization Cycles` describes a general 4-phase model for a
12–24 week macrocycle:

| Phase | Typical weeks | Intensity distribution | Long run | Hard sessions/week |
|---|---|---|---|---|
| 1 — Build | 1–6 | 90% Z1, 10% Z2 | Building from current base, +10%/week | 0–1 |
| 2 — Progressive | 7–12 | 70% Z1, 20% Z2, 10% Z3 | Maintaining + moderate finish efforts | 1–2 |
| 3 — Race-Specific | 13–18 | 60% Z1, 15% Z2, 20% Z3, 5% Z4 | Race-simulation, goal-pace sections | 2–3 |
| 4 — Taper | Final 2 weeks | Same or slightly higher intensity | 50% of peak-week volume | — |

The worked examples in `ECHO_Training_Plans_McMillan.md` don't reuse this exact 4-phase naming —
they scale phase count and names to the goal and total plan length instead: the 5K example
(12 weeks) uses 4 phases named Health & Early Aerobic Foundation / Early Aerobic Training /
Intervals & Maximum Aerobic Training / Race-Specific Preparation; the 10K example (16 weeks) uses
4 differently-named phases ending in a dedicated Race Week; the marathon example (30 weeks) uses
5 phases, adding a distinct Strength/Hill phase between Build and Race-Specific. Treat the table
above as the general shape — build aerobic base → introduce structure/threshold → race-pace
specificity → taper — scaled proportionally to the plan's total length, rather than a fixed
4-phase contract. That's how the source itself handles different race distances and durations.

## Deload cadence and the reduction band

**Ian's decision (authoritative, 2026-09-06): deload weeks reduce volume 15–25%**, superseding the
35–45% figure he ruled on 2026-07-10. `load-rules.md` § "Deload trigger" is the owner of this rule
— it carries the current band, the deload-frequency table by level, the reasoning for the reversal,
and the one ruled exception (the golden 5K plan's own weeks 4 and 8). Do not restate the number
anywhere else.

The rest of this section is the **superseded** 2026-07-10 basis, kept as history. The source
disagreed with itself three ways, and the worked examples won:

| Level (source example) | Normal volume | Deload volume | Reduction |
|---|---|---|---|
| Beginner | ~2.5 hr running | ~1.5 hr running | ~40% |
| Intermediate | ~5 hr running | ~2.75 hr running | ~45% |
| Advanced | 65–75 km | 40–45 km | ~35–40% |

*(workout_library.md § Part 3 › Beginner/Intermediate/Advanced Deload)*

All three of Ian's own worked examples sit in the 35–45% band, not the 20–30% one his Deload Trigger
table states. His separate "Exception — Recovery Weeks" clause already permits "any amount… even 50%
reduction," so 35–45% was consistent with the source's own allowance. The fact-check found **no direct
RCT evidence for any specific deload magnitude** — it is coaching convention either way, which is why
the coach's own practice was the tiebreak then, and his choice of McMillan's published figure is the
tiebreak now.

What the engine actually enforces follows the current band, not the table above:
`deloadVolume()`/`isValidDeload()` in `src/lib/loadRules.ts` — see `load-rules.md`
§ "Deload trigger".

**The source's Week 4 example remains an error, not an alternative.** In the 5K plan it is labelled a
deload ("Day 6: … This is deload week, keep it easy" — `ECHO_Training_Plans_McMillan.md § Example 1,
Week 4`) while its weekly total *rises* from Week 3's ~17–19 km to Week 4's ~18–19 km. A deload week
that doesn't reduce volume isn't a deload week.

The source's day-by-day example tables for the three levels above are also not ported: they name days
(Monday/Wednesday/Saturday, not Day 1…Day 7) and, for the intermediate example, place a rest/mobility
slot that reads as cross-training-adjacent — both inconsistent with Ian's decisions #1 and #2.

**What is ported as-is** from `workout_library.md` Part 3, because it's level-agnostic guidance
that doesn't conflict with anything above:

- **Definition:** a deload week is a planned reduction in training stress to allow adaptation and
  recovery; without it, runners stagnate or get injured.
- **Intensity during deload:** Zone 1 only, no hard efforts; strides may continue for
  "speedster"-type runners, to maintain neuromuscular activation without adding load.
- **What not to do during deload:** switch to hill repeats or speed work; try a new race distance
  or fitness test; ignore the deload and train normally; feel guilty about the reduced volume —
  it's part of the plan.
- **Expected outcomes across the week:** may feel sluggish at first (normal — the body is
  absorbing training), energy returns a couple of days in, slight performance improvement on easy
  efforts follows, and a "breakthrough" feeling often shows up the week after, where harder
  workouts feel more manageable.

## Design rule: a declared red-flag injury still produces a plan

**SUPERSEDED 2026-08-03 (captain ruling, injury-handling task brief `fm/v22-injury-handling-r1` —
"whichever uses the least amount of tokens but still maintain professionalism").** The rule below
this note was V2.2's original design intent and was never built — the plan-accuracy scout's Bug 1
(`/Users/Guestyyyyyyyy/firstmate/data/workout-v22-plan-accuracy-s1/report.md`) found
`intake.injuries` had no effect on plan generation at all, closed-set flag or red-flag alike. When
Bug 1 was fixed, the captain was asked which of the scout's two options to build, and ruled for
the simpler one — **not** the return-to-running protocol generator described below. This is a
deliberate simplification, not an oversight: do not "restore" the original text without a new
ruling.

**What ships instead:** a red-flag injury declaration produces a **normal plan with a volume
reduction applied throughout — never a separate return-to-running protocol, no `extras`
`PlanSection`, and no distinct plan shape.** The reduction mechanism itself was superseded again,
2026-08-06 (captain ruling `red-flag-injury-plan-shape`,
`/Users/Guestyyyyyyyy/firstmate/data/workout-v22-plan-accuracy-s1/report.md`): a red-flag
injury's cut is a flat **15%, applied to every week of the plan** (`src/lib/loadRules.ts`'s
`RED_FLAG_VOLUME_REDUCTION_PCT` / `redFlagVolumeReductionPct`) — not the ordinary closed-set
flag's week-1-only, per-flag-percentage cut (`INJURY_VOLUME_REDUCTION_PCT`), which still governs
every non-red-flag injury unchanged. A red-flag plan and an ordinary injury plan differ in both
their volume reduction and their disclaimers now, never in phase/week-count structure. "Still
maintain professionalism" means the plan must not understate a genuine red-flag situation: it
carries a **strengthened professional-evaluation disclaimer** on top of the standard Rule 10
injury disclaimer, adapted from the source's own language for the flag in question rather than
inventing new copy (see `src/lib/planTemplates.ts`'s `RED_FLAG_INJURY_DISCLAIMER`). Today the
closed set's one red-flag member is `ankle_achilles` — an interpretive judgment call (the source
labels its pattern "(HIGH PRIORITY)", `injury_flags.md:107-109`, the only closed-set pattern
carrying a priority label at all) documented and flagged for captain review in
`src/lib/loadRules.ts`'s `RED_FLAG_INJURIES` comment, not a literal "RED FLAG" tag on the pattern
itself.

The return-to-running protocol in `injury-rules.md` is **not deleted** — it remains documented,
unused source content, the same status Rule 5's "Monitoring" tier already has (see
`00-README.md`). It could be built later behind a genuine captain ruling to do so; nothing in this
codebase currently invokes it.

---

**Original rule (superseded above; kept for history — do not re-implement without a new ruling):**

**Ian's decision**, not a literal source quote — this is how V2.2 uses the ported red-flag rules
(`load-rules.md` Rule 5) and return-to-running protocol (`injury-rules.md`) together:

When a runner declares a red-flag injury at intake (per `load-rules.md` Rule 5 / `injury-rules.md`),
the app **still generates a plan** — it generates the **return-to-running protocol** instead of a
normal training plan, symptom-gated, with a prominent "seek imaging / see a professional" notice
attached (the `load-rules.md` Rule 10 disclaimers). It never refuses outright, and it never
prescribes intervals or hard efforts through a suspected bone stress injury.

## See also

How each day's run type is labelled (`ER`, `TR`, `INT`, `RP`, `LR`, `SR`, `ER + Strides`) and how a
workout's `structure` string is written (`WU`/`CD`/`GP`/`w/`/`@`, reps as count × distance) is
[`notation.md`](notation.md), not this file — this file governs the week's shape (phases, the Day
1…Day 7 slots, deload cadence), not what each day is called.
