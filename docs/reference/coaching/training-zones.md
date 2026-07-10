# Training Zones

Ported subset of `training_zones.md`. The whole zone model survives the port because max HR is
computed from age (`220 − age`), and age is one of the ten intake fields.

## Max heart rate estimation

**Formula: `220 − age`** *(training_zones.md § Max Heart Rate Estimation)*. Example: age 35 →
estimated max HR 185 bpm.

**Informed decision, not an oversight (Ian):** Tanaka et al. 2001 found this the least accurate of
the common max-HR formulas, with ±10–12 bpm scatter around the true value. Ian was shown this and
chose to keep `220 − age` anyway — it's the only estimate available for someone the app meets
exactly once — while carrying the source's own caveat forward:

> This is an estimate. A field test (hill sprint or track time trial) gives more accurate
> individual max HR. *(training_zones.md § Max Heart Rate Estimation)*

## The five zones

*(training_zones.md § Zone 1 through § Zone 5)*

| Zone | Purpose | % Max HR | RPE | Weekly usage |
|---|---|---|---|---|
| 1 — Easy / Recovery | Aerobic base, active recovery, economy | 60–70% | 1–3 | 60–70% of volume |
| 2 — Aerobic Base / Steady State | Aerobic capacity, tempo base, fat oxidation | 70–80% | 4–5 | 15–20% of volume |
| 3 — Lactate Threshold / Tempo | Threshold improvement, race-pace conditioning | 80–87% | 6–7 | 10–15% of volume |
| 4 — VO2 Max / Intervals | VO2 max, speed endurance, top-end fitness | 87–95% | 8–9 | 8–10% of volume |
| 5 — Maximum / Neuromuscular | Speed, power, stride mechanics | 95–100% | 10 | 2–5% of volume (strides only) |

Zone 1's most common failure mode, kept because it's directly actionable coaching content:
running Zone 1 sessions at Zone 2 intensity is "the **#1 error** in recreational runners... it
accumulates fatigue without the recovery benefit. Easy must mean EASY." (`training_zones.md §
Zone 1 › Common Mistake`)

Zone 3's tempo note, also kept: run tempo **at or slightly below** lactate threshold, not right at
it — allows more volume without burnout and produces better long-term adaptation
(`training_zones.md § Zone 3 › Coaching Note on Tempo Intensity`).

Zone 4 is capped at 1×/week; Zone 5 is strides only, never a sustained effort (`training_zones.md
§ Zone 4`, `§ Zone 5`).

## Cadence: qualitative cue, not a number

**Correction (d).** The source gives absolute per-zone SPM targets (Zone 1: 170–180 SPM …
Zone 5: 190–200+ SPM) and states, as a "Key Rule," that "cadence should INCREASE as effort
increases," flagging a lower cadence at higher effort as an injury-risk pattern
(`training_zones.md § Cadence Targets by Zone (Summary)`). The absolute numbers don't survive the
port:

- The 170-SPM threshold reflects the 180-SPM-cadence myth. Optimal cadence is individual (roughly
  150–200+ SPM depending on the runner), not a fixed target.
- The supported intervention, where cadence *is* a genuine issue, is a **5–10% increase above the
  runner's own baseline** (*Br J Sports Med* 2022 step-rate meta-analysis) — not a jump to a
  population number.
- V2.2 doesn't collect cadence at intake, so there's no baseline for the app to compute a 5–10%
  increase from in the first place.
- The source contradicts itself on this point across files: `ECHO_Framework_CORRECTED.md` §
  Pillar 2 (Cadence) already argues cadence is "NOT one-size-fits-all" and warns that forcing
  cadence above a runner's natural rhythm is "counterproductive and injury-prone" — directly at
  odds with `training_zones.md`'s fixed-SPM tables.

**What survives**: cadence as a qualitative cue only — "quick, light feet," rhythm that feels
lighter as effort increases — with no SPM number attached anywhere the plan output reaches a
runner. The directional rule (cadence should feel like it increases with effort; a felt drop
under fatigue is a form-breakdown signal worth a mid-run reset) is kept as a coaching cue, not a
number to hit.

## Intensity distribution by experience level

*(training_zones.md § Weekly Training Intensity Distribution)*

| Level | Zone 1 | Zone 2 | Zone 3–4 | Zone 5 |
|---|---|---|---|---|
| Beginner (3 days/wk) | 80% | 15% | 5% | — |
| Intermediate (5 days/wk) | 60–65% | 20% | 10–15% | 5% |
| Advanced (6–7 days/wk) | 55–60% | 15–20% | 15–20% | 5% |

## The 80/20 rule — pyramidal, not polarized

**Correction (e).** The source calls its distribution "polarized" and states the 80/20 easy-hard
split as a "Verified Principle" (`training_zones.md § The 80/20 Rule`). The 80/20 easy-hard
emphasis itself is well supported and unchanged. The label is wrong, though: the source's own
phase breakdown (see `plan-structure.md`) prescribes ~20% Zone 3 (threshold) work in its
race-specific phase — a true polarized model concentrates hard work at the top end with almost
nothing in the moderate/threshold zone. Prescribing a meaningful threshold-zone chunk makes this a
**pyramidal** distribution (Seiler; Stöggl & Sperlich 2014), relabeled accordingly.

## RPE scale

*(training_zones.md § RPE Scale, ported verbatim)*

| RPE | Zone | Feel |
|---|---|---|
| 1 | — | Almost no effort. Walking pace. |
| 2 | — | Very light. Easy walk. |
| 3 | Zone 1 | Light. Easy run, fully comfortable. |
| 4 | Z1–Z2 | Moderate. Breathing slightly deeper. |
| 5 | Zone 2 | Somewhat hard. Steady state. |
| 6 | Z2–Z3 | Hard. Tempo effort. |
| 7 | Zone 3 | Very hard. Threshold effort. |
| 8 | Zone 4 | Very very hard. VO2 max effort. |
| 9 | Z4–Z5 | Near maximum. |
| 10 | Zone 5 | Maximum effort. All-out sprint. |

## Disclaimer

*(training_zones.md § Disclaimer, verbatim)*

> This is not medical advice. Heart rate zones are estimates based on population averages.
> Individual variation is significant. Consult a doctor before starting any training program,
> especially if you have any cardiovascular conditions or health concerns.
