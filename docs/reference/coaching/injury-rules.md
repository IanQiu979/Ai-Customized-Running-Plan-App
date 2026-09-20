# Injury Rules — Return-to-Running Protocol

Ported subset of `injury_flags.md`. Part 1 (pattern detection from run history), Part 3 (special
populations needing sex, which V2.2 doesn't collect), and Part 4 (prehab exercise library, out of
scope for running-only plans) are not ported — full reasoning in `00-README.md`.

## When this protocol applies

**Not currently wired into intake (2026-08-03 captain ruling — see `plan-structure.md`'s
"Design rule" section).** A red-flag injury declaration now produces a normal, volume-adjusted
plan with a strengthened disclaimer, not this protocol. The content below remains documented,
unused source content — the same status Rule 5's "Monitoring" tier already has — kept for a
future ruling that decides to build it, not deleted.

Original design intent, never implemented, superseded above: per the design rule in
`plan-structure.md`, when a runner's declared injury at intake matches one of `load-rules.md` Rule
5's Immediate Stop or Reduce Volume triggers, the app does not generate a normal training plan —
it generates the protocol below instead, with the disclaimers from `load-rules.md` Rule 10
attached.

The source's day-by-day example schedules for these phases (e.g. "Day 6: Rest or cross-train,
Swimming/cycling") are not reproduced verbatim below: some slots specify cross-training, out of
scope for running-only plans (Ian's decision #1). The frequency/duration/spacing guidance below
carries the same content, with those slots simply left as rest.

## The Free library's declared-injury modules — two rulings, 2026-09-20

The Free library (`src/lib/planLibrary/injury.ts`, § 15–18 of
`planning/research/plan-blueprint-examples.md`) applies a declared injury as a module rather than
through the protocol below. Two questions its sweeps raised are Ian's, and he ruled on both on
2026-09-20:

**INJ-6 (lower back) "keep Day 7 at `LR-low`" is a cap, not a fixed value — issue #119.** Day 7
never rises above `LR-low`; beneath that ceiling the calendar's own Day-7 target still applies, so
a rest week's Day 7 takes § 9's `LR-recovery` (60–70% of the preceding long run) and the
recovery cut lands on the long run first, exactly as § 6 "shorten Day 7" says. Read as a value,
the pin had held every rest week's Day 7 at full `LR-low` length and left the whole 15–25% cut to
the easy runs (the issue's witness: `new`, 3 days, 15 km, 8-week 5K — week 4 at 80% of week 3
with Day 7 at 100% and the easy runs at 69%). `H2`/`H3`, which carry the same pin, read it the
same way. `engine.recovery.test.ts` now sweeps `lower_back` on all three rest-week invariants like
the other six modules.

**A declared injury's volume cut lands once, on the first loading week, and the plan ramps back
from there — issue #106, confirmed.** § 17: "Percentage reductions apply to the validated
baseline once; they never stack." Ian confirmed the shape the 2026-09-19 fix took — the module's
cut (and § 16's 90% for `H1`) on the first non-`RECOVERY` week only, later weeks building off that
week's reduced volume through the state machine and `clampWeeklyVolume` — rather than a per-week
reduction, which had compounded (0.85 × 0.85 × …) and collapsed an injured plan to 29% of its
healthy twin by week 12. No code changed for this ruling; it closes the question.

## Phase 1: Pain-free clearance

*(injury_flags.md § Part 2 › Phase 1)*

**Requirements before proceeding:**
- No pain with daily activities (walking, stairs)
- No visible swelling
- Medical clearance obtained for significant injuries
- Can complete a pain-free 30-minute walk on a flat surface

**Testing protocol:** 30-min pain-free walk test; single-leg balance, 1 minute each leg, no
discomfort; gentle movement test (slow high knees, butt kicks, lateral steps).

**Progression:** all pain-free → proceed to Phase 2. Any pain present → extend Phase 1, do not
run. (No week number is attached to this phase — see "On timelines," below.)

## Phase 2: Return to easy running

*(injury_flags.md § Part 2 › Phase 2)*

**Goal:** build running tolerance, establish confidence, prevent re-injury.

- **Significant injuries — run/walk protocol:** 1 min running / 2 min walking, 6–8 cycles
  (18–24 min total), 2–3 sessions/week, never on consecutive days.
- **Minor injuries — continuous easy running:** 20–25 minutes very easy (Zone 1 only), 2–3
  sessions/week, minimum 1 rest day between runs.

**Checkpoint, every session — this is the gate the whole protocol runs on:** pain during? pain
after? pain next morning? All three must be zero to advance.

## Phase 3: Building tolerance

*(injury_flags.md § Part 2 › Phase 3)*

**Goal:** increase volume, introduce consistency, build confidence.

- Two easy runs per week, 48+ hours apart, 25–35 minutes each, Zone 1 only.
- A third session: long easy run, starting at 40 minutes and building 5–10 min/week.

Advance only while the Phase 2 checkpoint (pain during / after / next morning, all zero) keeps
being met; regress to Phase 2 if it isn't.

## Phase 4: Near-return

*(injury_flags.md § Part 2 › Phase 4)*

**Goal:** approach pre-injury volume, test a return to normal structure, introduce a third easy
day.

- Three easy runs, 48+ hours between any hard/moderate effort.
- Optional one easy steady (Zone 2, very mild) session.
- Normal long-run building continues.

**Decision point:** completely pain-free → advance to Phase 5. Slight pain returning → stay in
Phase 4 longer. Significant pain → regress to Phase 3.

## Phase 5: Return to normal training

*(injury_flags.md § Part 2 › Phase 5)*

**Goal:** restore full training, reintroduce hard efforts, if the injury is stable.

Progression: add one easy steady day → add short intervals (4 × 2 min Zone 3 with recovery) →
near-normal training → full training, building intensity as normal. Each step is gated on the
same pain checkpoint as Phases 2–4, not a week count.

**Red flags — stop and regress if any occur** *(injury_flags.md § Part 2 › Phase 5)*: sharp pain
during/after a run; swelling that doesn't go away; compensation limping; pain radiating to other
areas; pain returning after a painless stretch. Response: regress 1–2 phases, re-assess with a
medical professional, do not push through pain.

## On timelines: symptom-gated, not week-numbered

**Correction (f).** The source attaches week ranges to each phase (Weeks 0–2, 2–4, 5–8, 9–12,
13+) and, for stress fractures specifically, keys total recovery time to the runner's *experience
level* — beginner 8–12 weeks, intermediate 10–14, advanced 12–16 (`injury_flags.md § Stress
Fracture Pattern › Recovery Timeline`). The same source file gives the identical 12–16-week
figure for advanced runners a second time, with a contradictory rationale — "muscle loss = slower
comeback" (`injury_flags.md § Special Case: Stress Fracture › Timeline`) — versus the first
instance's "more muscle mass = more bone load." A third version keys the timeline to *age*
instead of experience for 50+ runners (`injury_flags.md § Runners 50+ › Recovery Timeline
Longer`), reconciled with neither of the first two.

The evidence keys stress-fracture return time to fracture **site and grade** — a low-risk
metatarsal stress fracture is roughly 6–8 weeks; navicular and femoral-neck fractures are 4–6
months — not to the runner's experience tier or age. V2.2 collects neither site nor grade (it has
no imaging, no diagnosis — only whatever the runner typed at signup). None of the three fixed
timelines above are ported. The phase structure and its pain checkpoints are ported as-is; no
phase in this document promises a week number, and the app must never state one.

## Returning after a 2+ week break (all runners)

*(injury_flags.md § Part 3 › Returning After 2+ Week Break — this sub-section applies by break
duration, not sex, so it's in scope even though the rest of Part 3 isn't)*

| Week | Volume | Intensity |
|---|---|---|
| 1 | 50% of normal | Zone 1 only |
| 2 | 75% of normal | Zone 1 + Zone 2 gently introduced |
| 3 | 100% of normal | Normal structure, intensity still conservative |
| 4+ | Full training | Normal periodization |

> Never jump back to pre-break volume immediately. Tendons and ligaments decondition faster than
> aerobic capacity — the runner may feel cardiovascularly ready before tendons are ready.
> *(injury_flags.md § Part 3 › Returning After 2+ Week Break, Critical Note)*

## Disclaimer

*(injury_flags.md § Disclaimer, verbatim)*

> This is not medical advice. All injury guidance is for informational purposes only. Always
> consult a qualified sports medicine professional or physiotherapist for diagnosis and treatment
> of running injuries. Do not run through pain without medical clearance.
