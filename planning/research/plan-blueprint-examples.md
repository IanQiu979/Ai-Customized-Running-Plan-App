# V2.2 personalized plan blueprint and deterministic template library

**Review draft — expanded 2026-09-05 after Ian's coaching review**  
**Purpose:** Four review examples followed by the complete V1 source definition for 40 deterministic plan variants, schedule adaptations, and injury handling.  
**Important:** This is coach-review content, not application behavior. Final numbers must be generated from each runner's intake and deterministic safety rules.

## The proposed selection model

The plan generator should choose two things before placing workouts:

1. **Readiness path**
   - First timer / base not yet established
   - Prepared runner entering a race-specific block
2. **Runner level**
   - Novice: 3 runs, 1 specialty session
   - Lower intermediate: 4–5 runs, normally 1 specialty session; alternate quality types by week
   - Higher intermediate: 4–5 runs at roughly 35–45+ km/week, normally 2 specialty sessions
   - Advanced: 5–7 runs, normally 2 specialty sessions

Later Plus personalization can add **Speedster / Combo / Endurance Monster**. The first release can default to Combo until the intake captures enough evidence to classify runner type.

Recovery rhythm is also personalized:

- Beginners use a recovery week every fourth week.
- Intermediates choose a three- or four-week rhythm in intake. Current weekly distance, training history, and stated recovery preference inform the choice.
- Higher-volume intermediates choosing two quality sessions receive stronger easy/rest spacing and a genuinely reduced recovery week.
- The safety engine can move recovery earlier when pain, unusual fatigue, or missed recovery makes the selected rhythm inappropriate.

### Research duration ranges behind the examples

These catalogue ranges explain the four review examples; they are not the V1 canonical template lengths. The approved V1 library later in this file uses 12/14/16/24 weeks and adapts safely around race date and readiness.

| Distance | First timer | Prepared novice/intermediate/advanced | Taper/peak |
|---|---:|---:|---:|
| 5K | 12–16 weeks | 8–12 weeks | 1–2 weeks |
| 10K | 12–16 weeks | 8–12 weeks | 1–2 weeks |
| Half marathon | 16–20 weeks | 12–16 weeks | 1–2 weeks |
| Marathon | 16–20+ weeks | 12–16 weeks only if prerequisites are met | 2–3 weeks |

This matrix follows McMillan's public catalogue ranges. It also resolves the apparent contradiction between a short commercial race block and V2.2's imported 28–30-week marathon example: the longer version is a base/preparation sequence plus the race block.

## Shared weekly grammar

An established 5-day runner's default week:

| Day | Default role |
|---|---|
| Day 1 | Easy + optional strides |
| Day 2 | Primary quality session |
| Day 3 | Rest or very easy |
| Day 4 | Easy/aerobic |
| Day 5 | Secondary quality for eligible runners; easy for novices |
| Day 6 | Rest or recovery |
| Day 7 | Long run |

If Day 7 includes sustained goal-pace or fast-finish work, it counts as a quality session. Day 5 then becomes easy unless the runner is advanced and demonstrably tolerant of three demanding stimuli.

### How intensity enters a plan

The first block prepares the runner to absorb later training. It does not begin with the hardest available workouts.

1. **Aerobic base plus small neuromuscular speed:** easy running with gently introduced strides and, for eligible runners, short relaxed hill sprints.
2. **Strength and economy:** controlled hills, fartlek, short repetitions, and introductory threshold work.
3. **Stamina:** longer threshold work and sustained aerobic strength.
4. **Race specificity:** goal-race pace, fatigue resistance, and event-specific long runs.
5. **Peak/taper:** lower volume with brief intensity retained.

For half-marathon and marathon plans, “speed first” means low-volume neuromuscular speed and running-economy work—not maximal sprinting or high-lactate sessions in Week 1. Difficult lactate work enters only after the aerobic base and is scaled to the event. Marathon plans use less of it than half-marathon plans because late-cycle marathon pace, fueling, and durability have higher priority.

Note: Day 7 should always be a long run, and note they cant change that its fixed.

## Example A — 5K, prepared intermediate

**Illustrative intake:** 5 days/week, currently 35–45 km/week, longest recent run 75–90 minutes, healthy, recent race result available.  
**Length:** 12 weeks.  
**Primary needs:** aerobic maintenance, threshold, VO2/5K specificity, leg speed, pacing.

### Block structure

| Weeks | Focus | Primary work | Long run |
|---|---|---|---|
| 1–3 | Aerobic foundation | Easy running; strides introduced gently; no demanding threshold, fartlek, or hill session | Easy 70–85 min |
| 4 | Step-back | Short controlled threshold only | Shorter easy run |
| 5–7 | Strength, stamina + speed | Introduce hills/fartlek, then alternate threshold/cruise work with controlled 3K–5K-effort repetitions | Easy 75–90 min or gentle progression |
| 8 | Step-back/tune-up | Short race or controlled time trial, not both | Reduced |
| 9–10 | 5K-specific | Repetitions become longer and closer to current/realistic 5K pace | Maintain, do not chase distance |
| 11 | Peak | Reduced-volume 5K stimulus; full recovery | Reduced |
| 12 | Race | Brief leg-speed exposure, easy running, race | Race week |

### Representative specific week

This is a later race-specific week, not Week 1. The runner reaches it gradually.

| Day | Session |
|---|---|
| 1 | 7–8 km easy + 6 × 20 sec relaxed strides |
| 2 | Warm-up; 5 × 1 km at current 5K effort with 2–3 min jog; cool-down |
| 3 | Rest |
| 4 | 8–10 km easy |
| 5 | 20–25 min controlled threshold inside an 8–10 km run |
| 6 | 5–6 km recovery or rest |
| 7 | 12–14 km easy long run |

**Week 1 stride entry:** begin around `6–7 × 15 sec` relaxed with full easy recovery. Progress toward `6 × 20 sec` only when the runner is moving smoothly and recovering normally.

**Approved intermediate branch:** a higher intermediate around 35–45 km/week can use the two-quality-session week above. A lower intermediate alternates the threshold and 5K-specific sessions by week. The long run remains easy, and the recovery-week rhythm is selected as three or four weeks from intake.

## Example B — 10K, prepared intermediate

**Illustrative intake:** 5 days/week, currently 40–50 km/week, longest recent run 90 minutes, healthy, recent performance available.  
**Length:** 12 weeks.  
**Primary needs:** threshold, aerobic strength, VO2 support, progressive 10K-pace tolerance, pacing.

### Block structure

| Weeks | Focus | Primary work | Long run |
|---|---|---|---|
| 1–3 | Aerobic preparation | Easy running; gentle strides; no demanding interval or threshold session at the start | 80–95 min easy, beginning from demonstrated capacity |
| 4 | Step-back | One shortened threshold exposure | Reduced |
| 5–7 | Strength/economy → threshold | Introduce hills or fartlek, then longer threshold intervals; shorter 5K-effort work on alternate weeks | 90–105 min easy |
| 8 | Step-back/tune-up | Controlled 5K or threshold test | Reduced |
| 9–10 | 10K-specific | Progress from broken 10K-pace work toward longer repetitions | Maintain |
| 11 | Peak | Final reduced-volume 10K-specific session 9–12 days out | Reduced |
| 12 | Race | Easy running, strides, race | Race week |

### Representative specific week

This is a later 10K-specific week after the preparation and threshold blocks.

| Day | Session |
|---|---|
| 1 | 8 km easy + strides |
| 2 | Warm-up; 3 × 2 km at realistic 10K pace with 3 min jog; cool-down |
| 3 | Rest or 5 km recovery |
| 4 | 10 km easy/aerobic |
| 5 | 6 × 400 m at controlled 5K effort with 200 m jog; full warm-up/cool-down |
| 6 | Rest |
| 7 | 14–16 km easy long run |

> **Optional race-specific progression:** If `3 × 2 km` feels controlled, pace stays even, form remains sound, and recovery is normal, a stronger intermediate may progress to `4 × 2 km` in a later week. Add only one repetition at a time. `5 × 2 km` is advanced territory, not a routine intermediate option. Keep total weekly distance stable by removing the added distance from easy mileage first. Reduce the long run only when required by the runner's recovery, single-session cap, or weekly-volume ceiling.

**Approved 10K cap:** intermediate broken goal-pace volume stays below the advanced McMillan examples. The example's `3 × 2 km` is the standard intermediate session; progression is earned rather than automatic.

## Example C — half marathon, prepared intermediate

**Illustrative intake:** 5 days/week, currently 45–55 km/week, longest recent run 100–120 minutes, healthy, recent performance available.  
**Length:** 16 weeks.  
**Primary needs:** early neuromuscular speed and running economy, threshold and difficult-but-controlled lactate work later, leg durability, half-marathon pace economy, long-run endurance, and fueling practice for slower runners.

### Block structure

| Weeks | Focus | Primary work | Long run |
|---|---|---|---|
| 1–3 | Aerobic foundation + speed touch | Easy volume; gently introduced strides; optional short relaxed hill sprints for runners already accustomed to them | 90–110 min easy, beginning from demonstrated capacity |
| 4 | Step-back | One light stimulus | Reduced |
| 5–7 | Speed/economy → threshold | Controlled hills or short repetitions first, then introductory tempo/cruise intervals | 105–125 min easy |
| 8 | Step-back | Short threshold only | Reduced |
| 9–11 | Stamina + lactate development | Longer threshold work, controlled 10K-effort support, then broken HM-pace work | 115–140 min; alternate easy and controlled fast finish |
| 12 | Step-back | Maintain frequency, reduce load | Reduced |
| 13–14 | Peak specificity | Long HM-pace segments; selected difficult lactate session; final major long run | 120–145 min, then reduce |
| 15–16 | Taper + race | Reduce volume; retain a small threshold/HM-pace stimulus | Race week |

### Representative specific week

| Day | Session |
|---|---|
| 1 | 8–10 km easy + strides |
| 2 | Warm-up; 4 × 2 km at threshold/approximately HM effort with 2 min jog; cool-down |
| 3 | 6 km recovery or rest |
| 4 | 10–12 km easy/aerobic |
| 5 | 7–8 km easy |
| 6 | Rest |
| 7 | 18–21 km long run, final 4–6 km controlled at realistic HM effort only when recovered |

**Late speed/lactate rule:** Half-marathon runners keep some faster work because threshold speed and late-race form matter, but the hardest lactate session occurs before the taper and never replaces the event-specific HM-pace work.

**Open review point:** Should runners expected to finish over 90 minutes automatically receive fueling-practice instructions, even though v1 currently generates running sessions only?

## Example D — marathon, prepared intermediate

**Illustrative intake:** 5 days/week, currently 50–65 km/week, longest run in the last 30 days at least 16–20 km, healthy, recent performance available.  
**Length:** 16 weeks; a runner below the prerequisites receives a longer preparation path.  
**Primary needs:** early neuromuscular speed and running economy, then sustainable mileage, stamina, leg durability, marathon-pace economy, fueling rehearsal, and fatigue resistance.

### Block structure

| Weeks | Focus | Primary work | Long run |
|---|---|---|---|
| 1–3 | Aerobic foundation + speed touch | Easy volume; gently introduced strides; optional short relaxed hill sprints for runners already accustomed to them | Build from recent longest |
| 4 | Step-back | Short controlled stimulus | Reduced |
| 5–7 | Speed/economy → stamina | Controlled hills or short repetitions, then introductory threshold support and medium-long aerobic running | Progress conservatively |
| 8 | Step-back | Maintain rhythm | Reduced |
| 9–11 | Stamina + marathon specificity | Threshold becomes controlled support work; alternate easy long runs with marathon-pace/fast-finish long runs | Approx. 24–30 km or time-equivalent |
| 12 | Step-back | Short marathon-pace stimulus | Reduced |
| 13 | Final specific load | Final major marathon-specific run | Approx. 28–32 km, intake-dependent |
| 14–16 | Disciplined taper | Progressively reduce volume; keep brief marathon-pace/leg-speed exposure | Reduce to race |

### Representative marathon-specific week

| Day | Session |
|---|---|
| 1 | 8 km recovery |
| 2 | Warm-up; 3 × 3 km at controlled threshold with 2–3 min jog; cool-down |
| 3 | Rest or 6 km very easy |
| 4 | 12–16 km medium-long aerobic |
| 5 | 8–10 km easy + strides |
| 6 | Rest |
| 7 | 26–30 km total with a conservative middle/late block at realistic marathon pace; fueling rehearsal |

The Day 7 session counts as quality. It must not be prescribed unless its total distance is within the runner's single-session progression limit and they have recovered from Day 2.

**Marathon speed rule:** Early strides, relaxed hill sprints, and short controlled repetitions build economy before the stamina block. Late in the cycle, difficult lactate work is reduced rather than emphasized; marathon pace, fueling, and durable form under fatigue become the specific work.

**Later resolution:** V1 retains the 180-minute training-long-run ceiling with no slower-runner exception, uses a disciplined two-week marathon taper after a reduced transition week, and counts a marathon-specific Day 7 as quality. Day 2 is shortened or made easy whenever retaining it would breach the runner's hard-session or recovery limit.

## Approved review rulings

### Approved in Ian's first review

1. Weeks 1–3 begin with aerobic preparation; harder hills, fartlek, threshold, and race-specific work enter gradually.
2. Strides begin conservatively around `6–7 × 15 sec` and build toward longer repetitions only when tolerated.
3. Lower intermediates alternate quality types weekly; higher intermediates around 35–45+ km/week may use two quality sessions with stronger recovery.
4. Beginners recover every fourth week; intermediates can select a three- or four-week rhythm based on volume, preference, and recovery needs.
5. The intermediate 10K standard is `3 × 2 km`; progression adds one repetition at a time and preserves weekly volume by trimming easy mileage first.
6. Half-marathon preparation includes early low-cost speed/economy work and later difficult-but-controlled lactate, stamina, and race-pace work.
7. Marathon preparation also starts with low-cost speed/economy, but later prioritizes stamina, marathon pace, fueling, and durability rather than hard lactate work.

### Resolved for the V1 library after the template-scope review

1. Canonical durations are 12 weeks for 5K, 14 for 10K, 16 for half marathon, and 24 for marathon, with explicit safe shortening/extension rules.
2. A quality long run counts toward the weekly hard-session limit.
3. Established runners retain at least 70% easy running; `NEW/SOME` are normally closer to 85–90%.
4. Recovery weeks reduce **15–25% below the preceding loading week, targeting 20%**. *(Corrected 2026-09-06: this line previously read "V2.2's accepted 35–45% reduction band, targeting 40%". Ian reversed that band to McMillan's published 15–25% on 2026-09-06 — see `docs/change_log.md` and `docs/reference/coaching/load-rules.md` § Deload trigger. `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`DELOAD_REDUCTION_MAX` are authoritative; the library engine matches them.)*
5. Day 7 progression is limited by demonstrated recent-longest-run capacity; unsupported single-session jumps cause preparation to be extended or ambition reduced.
6. The canonical 5K, 10K, and half plans each contain one taper week; the marathon contains two taper weeks after a reduced transition.
7. V1 retains the 180-minute marathon training-long-run ceiling without a slower-runner exception.
8. The library contains `SPD` and `END` runner-profile variants. Insufficient classification evidence selects a reduced first dose in the conservative `END` lane.

## Evidence summary

These examples synthesize, rather than reproduce, public McMillan guidance, B.A.A. and Athletics Ireland architectures, and research on intensity distribution, tapering, load progression, and injury history. Full source notes and limitations are in the companion internal research report.

Key public sources:

- [McMillan plan library](https://www.mcmillanrunning.com/training-plans/)
- [McMillan 5K plans](https://www.mcmillanrunning.com/plans/5k-training-plans/)
- [McMillan 10K plans](https://www.mcmillanrunning.com/plans/10k-training-plans/)
- [McMillan half-marathon plans](https://www.mcmillanrunning.com/plans/half-marathon-training-plans/)
- [McMillan marathon guide](https://www.mcmillanrunning.com/marathon-training-plan-guide/)
- [B.A.A. Boston Marathon training](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/)
- [Campos et al. intensity-distribution review](https://pubmed.ncbi.nlm.nih.gov/34749417/)
- [Wang et al. taper meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/)
- [Frandsen et al. single-session distance cohort](https://pubmed.ncbi.nlm.nih.gov/40623829/)
- [Fredette et al. training-parameter review](https://pubmed.ncbi.nlm.nih.gov/34478518/)
- [van Poppel et al. injury-risk review](https://pubmed.ncbi.nlm.nih.gov/32535271/)

This draft does not modify the V2.2 codebase.

---

# V1 deterministic template library — 40 complete plan definitions

**Status:** coach-review source for the plan generator; not yet application behavior.  
**Scope:** 5K, 10K, half marathon, and marathon; five visible experience answers; two runner-profile variants; three to seven running days.  
**Construction rule:** each plan is the exact composition of one race calendar, one experience-dose row, one runner-profile lane, one day layout, and the safety/injury overlays below. This is a normalized plan library: shared weeks are written once, while the matrix explicitly defines all 40 plans without copying the same easy runs hundreds of times.

## 1. The complete 40-plan register

The suffix describes the **runner**, not the workouts they already enjoy:

- `SPD` — speed-leaning runner: comparatively stronger at short, fast work; receives the stamina-oriented lane.
- `END` — endurance-leaning runner: comparatively stronger at sustained running; receives the speed/economy-oriented lane.

| Intake answer | 5K | 10K | Half marathon | Marathon |
|---|---|---|---|---|
| New to running | `5K-NEW-SPD`, `5K-NEW-END` | `10K-NEW-SPD`, `10K-NEW-END` | `HM-NEW-SPD`, `HM-NEW-END` | `M-NEW-SPD`, `M-NEW-END` |
| Some running experience | `5K-SOME-SPD`, `5K-SOME-END` | `10K-SOME-SPD`, `10K-SOME-END` | `HM-SOME-SPD`, `HM-SOME-END` | `M-SOME-SPD`, `M-SOME-END` |
| Regular runner | `5K-REG-SPD`, `5K-REG-END` | `10K-REG-SPD`, `10K-REG-END` | `HM-REG-SPD`, `HM-REG-END` | `M-REG-SPD`, `M-REG-END` |
| Experienced runner | `5K-EXP-SPD`, `5K-EXP-END` | `10K-EXP-SPD`, `10K-EXP-END` | `HM-EXP-SPD`, `HM-EXP-END` | `M-EXP-SPD`, `M-EXP-END` |
| Competitive runner | `5K-COMP-SPD`, `5K-COMP-END` | `10K-COMP-SPD`, `10K-COMP-END` | `HM-COMP-SPD`, `HM-COMP-END` | `M-COMP-SPD`, `M-COMP-END` |

Count: `5 experience answers × 2 runner profiles × 4 distances = 40 complete core plans`.

## 2. Non-negotiable interpretation rules

1. **Current capacity wins.** Training pace comes from a recent performance, not the desired finish time. Goal pace is used only in specifically labelled race-pace work and remains subject to the existing realism clamp.
2. **Week 1 is not a fitness test.** Weeks 1–3 emphasize easy aerobic running and low-cost coordination. No plan begins with maximal sprinting, hard hills, or a large threshold workout.
3. **Easy means conversational.** At least 70% of established-runner volume is easy; `NEW` and `SOME` normally sit closer to 85–90% easy.
4. **Hard-session caps include quality long runs.** `NEW` and `SOME`: one per week. `REG` and `EXP`: normally one, at most two. `COMP`: normally two; a third stimulus is allowed only when one is a brief stride exposure and recovery remains normal.
5. **Day 7 is fixed.** It contains the long run, or the target race during race week. The runner may not move it inside the generated template.
6. **Hard days are separated.** There is at least one rest/easy day between demanding sessions. If Day 7 contains a substantial fast finish or race-pace block, Day 5 becomes easy.
7. **Recovery weeks are real reductions.** Target **20% below the previous loading week, within the 15–25% band**. Remove hard volume before removing easy frequency. *(Corrected 2026-09-06 — see the note under "Resolved for the V1 library" item 4 above; the figure here previously read "40% … 35–45%".)*
8. **Long-run progression is demonstrated-capacity based.** A generated long run may not exceed 110% of the longest run completed in the preceding 30 days without first inserting conservative preparation weeks. It also remains inside the level share cap, absolute cap, and 180-minute training cap.
9. **No hidden distance inside workout notation.** Warm-up, recoveries, and cool-down count toward both session and weekly distance.
10. **Pain changes the plan.** The injury gate is evaluated before variant, volume, or race-goal ambition.

## 3. Workout vocabulary

| Code | Meaning | Intensity / construction |
|---|---|---|
| `REST` | No running | A genuine rest day |
| `REC` | Recovery run | RPE 2–3, shorter than an easy run |
| `E` | Easy run | Conversational, RPE 3–4 |
| `AER` | Aerobic/steady support | RPE 4–5; never allowed to drift into threshold |
| `LR` | Easy long run | RPE 3–4; Day 7 |
| `ST` | Relaxed strides | Gradual acceleration, relaxed fast running, full walking/jog recovery; never all-out |
| `HS` | Short relaxed hill sprints | 8–10 seconds, full walk-back; only after an easy warm-up and only when already tolerated |
| `F` | Fartlek | Controlled timed efforts with easy float recoveries |
| `H` | Aerobic hill repetitions | Controlled strength/economy work, not sprinting |
| `T` | Tempo/threshold | Comfortably hard, even, never a time trial |
| `CR` | Cruise intervals | Broken threshold with short easy recoveries |
| `I` | Interval work | Current-fitness VO2/5K effort; even repetitions |
| `RP5` | 5K race-pace repetitions | Realistic 5K goal pace, late cycle |
| `RP10` | 10K race-pace repetitions | Realistic 10K goal pace, late cycle |
| `HMP` | Half-marathon pace | Realistic HM effort, continuous or broken |
| `MP` | Marathon pace | Realistic marathon effort; also practices pacing/fueling |
| `MLR` | Medium-long aerobic run | Longer than ordinary easy, shorter than Day 7 |
| `FF` | Fast-finish long run | Final portion controlled; makes Day 7 a quality session |
| `TU` | Tune-up | Controlled race or time trial; never paired with another hard workout that week |
| `RACE` | Goal race | Replaces Day 7 long run in the final week |

### Effort hierarchy when no recent performance exists

No numeric training paces are emitted. Use: easy/conversational → steady/aerobic → comfortably hard threshold → hard-but-even interval → realistic race effort. A runner unable to finish every repetition with stable form and similar pace is moved down one dose at the next occurrence.

## 4. Exact experience-dose ladder

The calendar names the workout family; this table supplies its dose. `WU/CD` are easy and included in the stated total. When the prescribed total would breach a weekly or single-run cap, reduce repetitions/work minutes first—never the warm-up or cool-down.

| Dose | `NEW` | `SOME` | `REG` | `EXP` | `COMP` |
|---|---|---|---|---|---|
| `ST-A` | 4 × 12 sec | 5 × 15 sec | 6 × 15 sec | 6–7 × 15 sec | 8 × 15 sec |
| `ST-B` | 4 × 15 sec | 6 × 15 sec | 6 × 20 sec | 6–8 × 20 sec | 8 × 20 sec |
| `HS-A` | Not used | 4 × 8 sec if previously tolerated | 5 × 8 sec | 6 × 8–10 sec | 8 × 10 sec |
| `F-A` | 6 × 1 min controlled / 2 min easy | 6 × 90 sec / 90 sec | 6 × 2 min / 90 sec | 8 × 2 min / 1 min | 10 × 2 min / 1 min |
| `H-A` | 6 × 30 sec gentle incline | 6 × 45 sec | 6 × 60 sec | 8 × 60 sec | 8 × 90 sec |
| `T-A` | 3 × 4 min / 2 min easy | 3 × 5 min / 90 sec | 3 × 7 min / 90 sec | 3 × 8 min / 90 sec | 3 × 10 min / 90 sec |
| `T-B` | 2 × 6 min / 2 min easy | 2 × 8 min / 2 min | 20 min continuous | 24–25 min continuous | 28–30 min continuous |
| `CR-A` | 3 × 5 min / 2 min easy | 3 × 6 min / 90 sec | 3 × 2 km / 2 min | 4 × 2 km / 2 min | 3 × 3 km / 2 min |
| `I-A` | 6 × 1 min hard-even / 2 min easy | 6 × 2 min / 2 min | 8 × 400 m / 200 m jog | 6 × 600 m / 300 m jog | 6 × 800 m / 400 m jog |
| `I-B` | 5 × 2 min / 2 min easy | 6 × 2 min / 90 sec | 6 × 600 m / 300 m | 5 × 800 m / 400 m | 5 × 1000 m / 400–600 m |
| `RP5-A` | 6 × 1 min at realistic 5K effort | 5 × 400 m / 200 m | 6 × 600 m / 300 m | 5 × 800 m / 400 m | 5 × 1000 m / 400–600 m |
| `RP10-A` | 3 × 5 min at realistic 10K effort | 4 × 1 km / 2 min | 3 × 1.6 km / 2–3 min | 3 × 2 km / 3 min | 4 × 2 km / 3 min; fifth only after a successful four |
| `HMP-A` | 3 × 8 min steady/HM feel | 2 × 2 km / 3 min | 3 × 2 km / 2 min | 4 × 2 km / 2 min | 3 × 3 km / 2 min |
| `MP-A` | 2 × 10 min steady/MP feel | 2 × 3 km / 1 km easy | 2 × 4 km / 1 km easy | 2 × 5 km / 1 km easy | 3 × 5 km / 1 km easy |
| `FF-A` | Final 5 min steady | Final 10 min steady | Final 15% steady | Final 20% steady or race effort | Final 20–25% at event-specific effort |

### Experience-specific operating limits

| Intake answer | Normal runs/week | Quality policy | Long-run training range | Deload rhythm | Special interpretation |
|---|---:|---|---|---|---|
| `NEW` | 3–4 | Weeks 1–3 easy; then max 1 controlled stimulus | 45–75 min; ≤14 km | Every 4th week | Run/walk is valid; completion goals dominate |
| `SOME` | 3–5 | Max 1 true quality session | 55–90 min; ≤14 km while mapped to beginner safety | Every 4th week | Strides before intervals; no two-hard-day week |
| `REG` | 4–5 | Normally 1; second only after demonstrated tolerance | 70–110 min; ≤25 km | User choice 3 or 4; default 4 | Alternates quality types when lower-volume |
| `EXP` | 5–6 | Normally 2, separated by ≥48 hours | 80–150 min; ≤25 km | User choice 3 or 4 | 35–45+ km/week may use both quality slots |
| `COMP` | 5–7 | Normally 2; third only as low-cost neuromuscular touch | 90–180 min; ≤35 km | Every 3rd week | Requires established recovery infrastructure |

The distance-specific long-run target below is always clipped by this table and by the runner's recent longest run. Race day itself is not treated as a training-run cap; the plan must still state honestly when preparation was compressed or incomplete.

## 5. Weekly-volume state machine

Let `B` be the runner's current normal weekly kilometres, after injury/readiness validation.

| State | Target before deterministic clamps |
|---|---|
| `ENTRY` | `0.90 × B`; never increase an already struggling or returning runner |
| `LOAD-1` | Up to `1.00 × B` |
| `LOAD-2` | Up to `1.08 ×` the previous loading week |
| `LOAD-3` | Up to `1.08 ×` the previous loading week; use 5% for `NEW` |
| `HOLD` | 95–100% of the preceding loading week |
| `RECOVERY` | 75–85% of the preceding loading week; target 80% *(corrected 2026-09-06 from "55–65% … target 60%", which encoded the superseded 35–45% depth)* |
| `TAPER-1` | 70–80% of peak loading volume |
| `TAPER-2` | 55–65% of peak loading volume |
| `RACE-WEEK` | 40–60% of peak **plus the race**, reconciled honestly rather than hidden |

After every state is calculated, apply: level maximum weekly kilometres → injury adjustment → single-session and long-run caps → hard-session cap → exact reconciliation of the seven days. A recovery week never becomes a loading week because of rounding.

## 6. Exact 3–7-day placement layouts

The calendar provides `Q1`, optional `Q2`, ordinary easy volume, and Day 7. These layouts place them. `Q2/E` means use Q2 only when both the experience row and calendar permit it; otherwise use easy running.

| Runs/week | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|---:|---|---|---|---|---|---|---|
| 3 | `E + optional ST` | `REST` | `REST` | `Q1` | `REST` | `REST` | `LR/RACE` |
| 4 | `E + optional ST` | `REST` | `Q1` | `REST` | `E` | `REST` | `LR/RACE` |
| 5 | `E` | `Q1` | `REST` | `E` | `Q2/E` | `REST` | `LR/RACE` |
| 6 | `E` | `Q1` | `REC` | `REST` | `Q2/E` | `E or REC` | `LR/RACE` |
| 7 | `E` | `Q1` | `REC` | `E or MLR` | `Q2/E` | `REC` | `LR/RACE` |

Rules:

- `NEW` uses only the 3- or 4-day layouts. A higher availability answer creates rest days, not extra running.
- `SOME` uses 3–5 days; the fifth run remains easy.
- `REG` uses 4–5 days unless already stable at six.
- `EXP` uses 5–6 days. A 3–4-day request retains Q1 and Day 7, then removes Q2 before any easy support.
- The 7-day layout is `COMP` only. It contains recovery running, never seven medium/hard days.
- During `RECOVERY`, remove Q2, replace Q1 with short strides or a shortened threshold touch only when healthy, and shorten Day 7.
- When Day 7 is `FF`, `HMP`, or `MP`, it is the week's second quality session and Day 5 is `E`.
- All unused weekly distance is distributed across `E/REC`; it never enlarges the physiological dose of Q1 or Q2.

## 7. Runner-profile selection and variant behavior

Use a recent performance at two distances when available. Compare each performance with its predicted equivalent rather than comparing raw pace.

| Evidence | Classification | Calendar lane used |
|---|---|---|
| Short-distance result is materially stronger; runner reports fading as duration rises | `SPD` runner | Stamina-oriented lane: more `T/CR/AER`, fewer short intervals |
| Long-distance result is materially stronger; runner reports difficulty changing gears | `END` runner | Speed/economy-oriented lane: more `ST/H/I`, smaller controlled doses |
| Only one result, conflicting evidence, or no usable evidence | Conservative default | `END` lane, but first occurrence of every fast workout is reduced one dose |

The two lanes change emphasis, not total difficulty. They use the same weekly volume, hard-session cap, recovery rhythm, taper, and safety constraints.

## 8. Duration adaptation

Canonical plans are 12 weeks for 5K, 14 for 10K, 16 for half marathon, and 24 for marathon.

### Shorter race date

1. Never delete race week or the final taper exposure.
2. Remove early repeated loading weeks only when the runner already demonstrates the required base and recent-long-run capacity.
3. Otherwise retain preparation and remove later ambitious workouts; the plan becomes a safe completion/tune-up plan rather than pretending full preparation is possible.
4. With fewer than four weeks, prescribe easy running, one brief event-specific reminder if already tolerated, and taper/race. Do not attempt to create fitness through compression.
5. A compressed marathon plan never introduces a long run that breaches the recent-30-day progression rule.

### Longer race date

1. Add `ENTRY/LOAD/RECOVERY` base cycles before the canonical Week 1; do not repeat peak or taper weeks.
2. Repeat only aerobic foundation, strides, controlled hills, and introductory threshold—not maximal intervals.
3. Preserve the runner's selected three-/four-week recovery rhythm.
4. Begin the canonical calendar when the runner meets its entry prerequisites.

### No target race date

Run the base/build portion for the selected distance, finish on a loading or consolidation week rather than a recovery week, and omit `RACE` and race-week taper language.

## 9. Long-run target ladder

These are peak training-time targets, not automatic entitlements. The actual Day 7 prescription is the smallest allowed by: this table, the level's distance cap, the level's share of weekly volume, 110% of recent-longest-run capacity, and 180 minutes.

| Distance | `NEW` | `SOME` | `REG` | `EXP` | `COMP` |
|---|---:|---:|---:|---:|---:|
| 5K | 55–60 min | 60–70 min | 75–85 min | 85–95 min | 95–105 min |
| 10K | 60–70 min | 70–80 min | 85–95 min | 95–110 min | 105–120 min |
| Half marathon | 70–80 min | 80–95 min | 100–115 min | 115–135 min | 125–145 min |
| Marathon | 80–100 min | 95–120 min | 125–150 min | 145–180 min | 160–180 min |

Calendar notation: `LR-low` = lower quarter of the range; `LR-mid` = midpoint; `LR-high` = upper quarter; `LR-peak` = top of the range. `LR-recovery` is 60–70% of the preceding long run. A beginner's 14 km and an intermediate's 25 km maximum can bind before the time target.

For marathon, `NEW` and `SOME` are conservative completion/run-walk tracks. If the athlete cannot safely develop adequate long-run capacity within the available time, the plan explicitly reports **limited preparation**; it does not disguise the gap by violating a cap.

## 10. Recovery-cadence overlay

The calendars show the standard four-week rhythm. Before rendering:

- `NEW` and `SOME`: retain every fourth-week `RECOVERY` row.
- `REG`: three or four weeks from intake; default four.
- `EXP`: three or four weeks from intake; use three for higher-volume/two-quality runners.
- `COMP` and all runners age 50+: every third week.
- When a recovery week moves, that week's demanding workouts are deferred to the next loading week, not squeezed into another week. A printed recovery row that is not due becomes `HOLD` with only one shortened Q1. Taper and race weeks always override this cadence.

## 11. The 10 complete 5K plans

**Canonical length:** 12 weeks. Each row applies to `5K-NEW-SPD` through `5K-COMP-END` using the exact experience dose and variant lane already defined.

| Week | Load / focus | Shared prescription | `SPD` runner — stamina lane | `END` runner — speed/economy lane | Day 7 |
|---:|---|---|---|---|---|
| 1 | `ENTRY` · settle in | Easy running only; one `ST-A` exposure late in the week if comfortable | Add 10 min `AER` inside one easy run | Strides only; no second fast exposure | `LR-low`, easy |
| 2 | `LOAD-1` · aerobic | Easy running; one `ST-A` | 12–15 min `AER`, controlled | Second `ST-A` only for `REG+` | `LR-low`, easy |
| 3 | `LOAD-2` · aerobic | Easy running; `ST-A`; no demanding threshold/hills | 15–20 min `AER` | `HS-A` only if previously tolerated; otherwise `ST-A` | `LR-mid`, easy |
| 4 | `RECOVERY` | Short easy running; no Q2; optional 4 relaxed strides for `REG+` | No quality | No quality | `LR-recovery` |
| 5 | `LOAD-1` · strength | Q1 enters gradually | `F-A`; optional `ST-A` later | `H-A`; optional `ST-A` later | `LR-mid`, easy |
| 6 | `LOAD-2` · threshold/economy | First sustained quality block | Q1 `T-A`; Q2 `ST-B` for eligible runners | Q1 `I-A`; Q2 `T-A` for eligible runners | `LR-high`, easy |
| 7 | `LOAD-3` · development | Keep repetitions even; never race the workout | Q1 `T-B`; Q2 `I-A` for `EXP+` | Q1 `I-B`; Q2 `T-A` for `EXP+` | `LR-high`, easy or final 5–10 min steady for `COMP` only |
| 8 | `RECOVERY` · absorb | No tune-up for `NEW/SOME`; `REG+` may use a controlled 3K `TU` instead of Q1 | Half-dose `T-A` or no quality | Half-dose `I-A` or no quality | `LR-recovery` |
| 9 | `LOAD-2` · 5K specific | Q1 uses current fitness, moving toward realistic 5K pace | Q1 `RP5-A`; Q2 `T-B` for eligible runners | Q1 `I-B`; Q2 half-dose `T-A` for eligible runners | `LR-high`, easy |
| 10 | `HOLD` · peak specific | Final full 5K-specific session | Q1 `RP5-A`; Q2 `T-A` for `EXP+` | Q1 `RP5-A` one dose higher only after successful Week 9; Q2 `ST-B` | `LR-peak`, easy; do not chase distance |
| 11 | `TAPER-1` | Reduce volume; retain brief rhythm | Half-dose `RP5-A`; one `ST-A` | Half-dose `I-A`; one `ST-A` | `LR-low`, easy |
| 12 | `RACE-WEEK` | Two or three short easy runs; `2–4 × 15 sec` relaxed strides once | Same | Same | `RACE` 5K |

### 5K completion rules

- `NEW/SOME` perform only Q1, and their Week 8 tune-up is omitted.
- `REG` alternates Q1 and Q2 when below roughly 35 km/week. `EXP` around 35–45+ km/week may retain both.
- Repetition pace converges from current-fitness effort toward realistic goal pace; it never begins at an unsupported goal.
- The `COMP` `RP5-A` dose may change rep length within the 4–5 km quality-volume band, but may not enlarge that band.

## 12. The 10 complete 10K plans

**Canonical length:** 14 weeks. Each row applies to `10K-NEW-SPD` through `10K-COMP-END`.

| Week | Load / focus | Shared prescription | `SPD` runner — stamina lane | `END` runner — speed/economy lane | Day 7 |
|---:|---|---|---|---|---|
| 1 | `ENTRY` · settle in | Easy running only; optional `ST-A` | 10 min `AER` inside easy run | Strides only | `LR-low`, easy |
| 2 | `LOAD-1` · aerobic | Easy running; one `ST-A` | 12–15 min `AER` | Second `ST-A` for `REG+` only | `LR-low`, easy |
| 3 | `LOAD-2` · aerobic | No demanding interval or threshold work | 15–20 min `AER` | `HS-A` only if already tolerated | `LR-mid`, easy |
| 4 | `RECOVERY` | Short easy running; no Q2 | No quality | No quality | `LR-recovery` |
| 5 | `LOAD-1` · strength | Q1 introduced conservatively | Q1 `F-A` | Q1 `H-A` | `LR-mid`, easy |
| 6 | `LOAD-2` · threshold | Even, controlled work | Q1 `T-A`; Q2 `ST-B` if eligible | Q1 `I-A`; Q2 half-dose `T-A` if eligible | `LR-high`, easy |
| 7 | `LOAD-3` · aerobic strength | Extend sustainable work | Q1 `T-B`; Q2 `F-A` for `EXP+` | Q1 `I-B`; Q2 `T-A` for `EXP+` | `LR-high`, easy |
| 8 | `RECOVERY` | Shortened stimulus only | Half-dose `T-A` | `ST-A` or half-dose `I-A` | `LR-recovery` |
| 9 | `LOAD-2` · 10K support | Current-fitness 5K/threshold support | Q1 `CR-A`; Q2 `I-A` for eligible runners | Q1 `I-B`; Q2 `T-A` for eligible runners | `LR-high`, easy |
| 10 | `LOAD-3` · broken 10K pace | First `RP10-A`; add no automatic repetitions | Q1 `RP10-A`; Q2 half-dose `T-A` for `EXP+` | Q1 `RP10-A`; Q2 `ST-B` | `LR-peak`, easy |
| 11 | `HOLD` · specific tolerance | Pace and form must remain even | Q1 `RP10-A`; Q2 `T-B` if eligible | Q1 `RP10-A`; Q2 half-dose `I-A` if eligible | `LR-high`, easy |
| 12 | `RECOVERY` / tune-up | `NEW/SOME` easy only; `REG+` optional controlled 5K `TU` replaces Q1 | Half-dose `T-A` or TU | `ST-A` or TU | `LR-recovery` |
| 13 | `TAPER-1` | Brief 10K reminder; reduce volume | Half-dose `RP10-A` | Half-dose `RP10-A` + 4 strides | `LR-low`, easy |
| 14 | `RACE-WEEK` | Short easy runs; one `2–4 × 15 sec` stride exposure | Same | Same | `RACE` 10K |

### 10K completion rules

- `3 × 2 km` is the standard `EXP` session. Progress to `4 × 2 km` only after it is controlled, even, and normally recovered from.
- `5 × 2 km` is `COMP` territory and never automatic. Add only one repetition at a time.
- Added repetition distance is removed from easy mileage first. Reduce Day 7 only when required by recovery or another deterministic cap.
- `NEW/SOME` use timed or shorter repetitions and only one quality session.

## 13. The 10 complete half-marathon plans

**Canonical length:** 16 weeks. Each row applies to `HM-NEW-SPD` through `HM-COMP-END`.

| Week | Load / focus | Shared prescription | `SPD` runner — stamina lane | `END` runner — speed/economy lane | Day 7 |
|---:|---|---|---|---|---|
| 1 | `ENTRY` · aerobic + speed touch | Easy running; one `ST-A` only | 10–15 min `AER` | `ST-A`; no hard repetitions | `LR-low`, easy |
| 2 | `LOAD-1` · aerobic | Easy running and relaxed mechanics | 15 min `AER` | Second `ST-A` for `REG+` | `LR-low`, easy |
| 3 | `LOAD-2` · aerobic | No difficult lactate work | 20 min `AER` | `HS-A` only when previously tolerated | `LR-mid`, easy |
| 4 | `RECOVERY` | Easy only; no Q2 | No quality | Optional 4 relaxed strides | `LR-recovery` |
| 5 | `LOAD-1` · economy/strength | Introduce first controlled Q1 | Q1 `F-A` | Q1 `H-A` | `LR-mid`, easy |
| 6 | `LOAD-2` · economy → threshold | Maintain low-cost speed | Q1 `T-A`; Q2 `ST-B` if eligible | Q1 `I-A`; Q2 half-dose `T-A` if eligible | `LR-high`, easy |
| 7 | `LOAD-3` · threshold | Sustainable work grows | Q1 `T-B`; Q2 `F-A` for `EXP+` | Q1 `I-B`; Q2 `T-A` for `EXP+` | `LR-high`, easy |
| 8 | `RECOVERY` | One shortened stimulus at most | Half-dose `T-A` | `ST-A` or half-dose `I-A` | `LR-recovery` |
| 9 | `LOAD-2` · stamina | Longer aerobic strength | Q1 `CR-A`; Q2 `AER`/MLR for eligible runners | Q1 `I-B`; Q2 `T-A` for eligible runners | `LR-high`, easy |
| 10 | `LOAD-3` · stamina/lactate | Difficult but controlled; no sprinting | Q1 `CR-A`; Q2 half-dose `I-A` for `EXP+` | Q1 `I-B`; Q2 `T-B` for `EXP+` | `LR-peak`, easy |
| 11 | `HOLD` · HM transition | First broken HM-specific work | Q1 `HMP-A`; Q2 `ST-B` | Q1 `HMP-A`; Q2 half-dose `I-A` if eligible | `LR-high` with final 10 min steady only if recovered |
| 12 | `RECOVERY` | Maintain frequency, sharply reduce load | Half-dose `T-A` | `ST-A` | `LR-recovery` |
| 13 | `LOAD-2` · peak HM specificity | Longest HMP dose | Q1 `HMP-A`; Q2 `T-A` for `EXP+` | Q1 `HMP-A`; Q2 `I-A` for `EXP+` | `LR-peak`, easy |
| 14 | `HOLD` · fatigue resistance | Day 7 becomes quality; Day 5 easy | Q1 `T-B`; no Q2 | Q1 half-dose `I-A`; no Q2 | `LR-high` with `FF-A` at realistic HM effort |
| 15 | `TAPER-1` | Small threshold/HM reminder | Half-dose `HMP-A` | Half-dose `I-A` + `ST-A` | `LR-low`, easy |
| 16 | `RACE-WEEK` | Short easy runs; one relaxed stride exposure | Same | Same | `RACE` half marathon |

### Half-marathon completion rules

- Early speed is neuromuscular/economy work; the hardest controlled lactate session occurs before taper and never replaces HM-specific work.
- Runners expected to take longer than about 90 minutes receive fueling-practice reminders on selected long runs; the template does not prescribe products or medical nutrition advice.
- `NEW/SOME` use completion-oriented HMP feel in short blocks and do not perform two-quality weeks.
- A fast-finish long run counts as quality. Q2 is removed that week.

## 14. The 10 complete marathon plans

**Canonical length:** 24 weeks. Each row applies to `M-NEW-SPD` through `M-COMP-END`.

| Week | Load / focus | Shared prescription | `SPD` runner — stamina lane | `END` runner — speed/economy lane | Day 7 |
|---:|---|---|---|---|---|
| 1 | `ENTRY` · settle in | Easy running; one `ST-A`; no maximal sprinting | 10 min `AER` | Strides only | `LR-low`, easy |
| 2 | `LOAD-1` · aerobic | Easy running and relaxed mechanics | 15 min `AER` | Second `ST-A` for `REG+` | `LR-low`, easy |
| 3 | `LOAD-2` · aerobic | No difficult threshold or hills | 20 min `AER` | `HS-A` only if already tolerated | `LR-mid`, easy |
| 4 | `RECOVERY` | Easy only | No quality | Optional 4 relaxed strides | `LR-recovery` |
| 5 | `LOAD-1` · economy | First controlled stimulus | Q1 `F-A` | Q1 `H-A` | `LR-mid`, easy |
| 6 | `LOAD-2` · speed/economy | Low-cost speed precedes stamina | Q1 `T-A`; Q2 `ST-B` if eligible | Q1 `I-A`; Q2 half-dose `T-A` if eligible | `LR-mid`, easy |
| 7 | `LOAD-3` · economy → threshold | Avoid high lactate accumulation | Q1 `T-B`; Q2 `F-A` for `EXP+` | Q1 `I-B`; Q2 `T-A` for `EXP+` | `LR-high`, easy |
| 8 | `RECOVERY` | One shortened stimulus at most | Half-dose `T-A` | `ST-A` or half-dose `I-A` | `LR-recovery` |
| 9 | `LOAD-2` · aerobic strength | Introduce MLR for eligible schedules | Q1 `CR-A`; Q2 `MLR` for `EXP+` | Q1 `I-B`; Q2 `AER/MLR` for `EXP+` | `LR-high`, easy |
| 10 | `LOAD-3` · threshold support | Threshold supports, not dominates | Q1 `T-B`; Q2 `MLR` if eligible | Q1 `I-A`; Q2 `T-A` if eligible | `LR-high`, easy |
| 11 | `HOLD` · stamina | Keep intensity controlled | Q1 `CR-A`; Q2 `AER/MLR` | Q1 `T-A`; Q2 `ST-B` | `LR-peak`, easy |
| 12 | `RECOVERY` | Reduce load and long run | Half-dose `T-A` | `ST-A` | `LR-recovery` |
| 13 | `LOAD-2` · MP introduction | First broken marathon-pace work | Q1 `MP-A`; Q2 `AER` if eligible | Q1 `MP-A`; Q2 half-dose `I-A` for `EXP+` | `LR-high`, easy; fueling practice |
| 14 | `LOAD-3` · durability | Medium-long aerobic support | Q1 `T-B`; Q2 `MLR` if eligible | Q1 `T-A`; Q2 `ST-B` | `LR-peak`, easy; fueling practice |
| 15 | `HOLD` · marathon specificity | MP dose remains realistic | Q1 `MP-A`; Q2 `AER` | Q1 `MP-A`; Q2 half-dose `I-A` for `EXP+` | `LR-high`, easy |
| 16 | `RECOVERY` | No long MP work | Half-dose `T-A` | `ST-A` | `LR-recovery` |
| 17 | `LOAD-2` · fatigue resistance | Day 7 quality; Day 5 easy | Q1 `T-A`; no Q2 | Q1 half-dose `I-A`; no Q2 | `LR-high` with `FF-A`; fueling practice |
| 18 | `LOAD-3` · specific load | Broken MP plus easy long run | Q1 `MP-A`; Q2 `AER/MLR` if eligible | Q1 `MP-A`; Q2 `ST-B` | `LR-peak`, easy; fueling practice |
| 19 | `HOLD` · stamina | Final substantial threshold support | Q1 `CR-A`; Q2 `AER` | Q1 `T-A`; Q2 half-dose `I-A` for `COMP` only | `LR-high`, easy |
| 20 | `RECOVERY` | Absorb before final specific work | Half-dose `T-A` or none | `ST-A` | `LR-recovery` |
| 21 | `LOAD-2` · final specific load | Day 7 is final major marathon-specific run | Q1 `T-A`; no Q2 | Q1 `ST-B`; no Q2 | `LR-peak` with conservative `MP-A` block; fueling rehearsal |
| 22 | `TAPER-1` | 70–80% peak volume; brief MP rhythm | Half-dose `MP-A` | Half-dose `MP-A` + `ST-A` | `LR-mid`, easy |
| 23 | `TAPER-2` | 55–65% peak; no fitness chasing | 2 × 8 min MP feel | 4–6 × 15 sec strides plus 10 min MP feel | `LR-low`, easy |
| 24 | `RACE-WEEK` | Two or three short easy runs; brief relaxed strides once | Same | Same | `RACE` marathon |

### Marathon completion rules

- Late difficult lactate work is deliberately de-emphasized. Marathon pace, fueling rehearsal, sustainable mileage, and durable form under fatigue receive priority.
- Week 21 is allowed only when its total and MP block fit the single-session progression cap and the runner recovered from Week 19. Otherwise it becomes an easy `LR-high`.
- `NEW/SOME` marathon plans are completion/run-walk tracks: Q2 is always removed, MP blocks are timed and short, and no plan claims full preparation when the long-run prerequisites cannot be reached safely.
- The final major long run occurs before the disciplined taper; it is never inserted inside the final two weeks.
- Training long runs remain capped at 180 minutes. There is no slower-runner exception in V1.

## 15. Injury intake required by the template library

An injury area is not a diagnosis. The generator must collect the following before applying any module:

| Field | Allowed answer | Why it changes the branch |
|---|---|---|
| Location | Existing seven closed-set areas; multiple allowed | Selects provoking-load precautions, not a diagnosis |
| Status | Past/resolved · returning/cleared · active/stable · active/worsening | Separates history from current symptoms |
| Pain | 0–10 at rest, during running, after running, and next morning | Supplies a symptom gate; one number alone is insufficient |
| Running impact | None · shorten/slow · stop · changes gait | A gait change is a stop signal |
| Red-flag symptoms | Sharp/stabbing · localized bone pain · visible swelling · radiating symptoms/weakness · new bowel/bladder or saddle-sensation change · none | Determines whether a running plan is appropriate and whether urgent care language is required |
| Professional instruction | No restriction · modified running · told not to run · not assessed | A clinician's restriction always overrides the app |

Free text may provide context but never changes numeric training rules by itself. The app must not infer tissue, grade, diagnosis, or recovery timeline from the selected body area.

## 16. Injury state machine applied before all 40 plans

| Branch | Entry conditions | Generated output | Progression gate |
|---|---|---|---|
| `H0 — no current issue` | No injury, or past/resolved with normal pain-free running | Selected core plan; a known former trigger may be introduced one dose lower | Normal plan checks |
| `H1 — cautious history` | Resolved injury, but return to full load was recent or confidence is low | Week 1 at 90% of validated baseline; one fewer quality session; provoking workout one dose lower for first two loading weeks | No pain during, after, or next morning |
| `H2 — return to running` | Cleared/returning; pain-free daily activity and pain-free 30-minute walk; no red flags | 2–3 nonconsecutive easy run/walk or short easy sessions; Day 7 is simply the longest easy session; no quality, hills, strides, fast finish, or race-pace work | All checkpoints zero before adding time or progressing stage |
| `H3 — active stable symptom` | Pain ≤3/10, no swelling/bone pain/gait change/worsening, and no instruction to stop | Hold or reduce normal running by the module amount; easy only; no progression while symptoms remain | Symptoms must not rise during, after, or next morning; otherwise move to H4 |
| `H4 — stop and assess` | Pain >3/10; sharp/stabbing or localized bone pain; swelling; limp/gait change; worsening symptoms; pain with daily activity; or clinician says do not run | No running workouts. Display professional-assessment guidance and preserve the race plan only as inactive future context | Resume only through H2 after appropriate clearance/pain-free criteria |

This is coaching safety guidance, not medical diagnosis. H2–H4 always display the injury disclaimer. H4 cannot be overridden by race proximity, goal time, tier, or the runner pressing “generate” again.

### Symptom-gated return sequence

No fixed medical recovery duration is promised.

1. **Clearance gate:** daily activity pain-free, no visible swelling, 30-minute flat walk pain-free; significant injuries require appropriate professional clearance.
2. **Run/walk:** 1 minute easy running / 2 minutes walking × 6–8, two or three nonconsecutive days.
3. **Short continuous easy:** 20–25 minutes, two or three nonconsecutive days.
4. **Build tolerance:** two 25–35-minute easy runs plus a 40-minute easy Day 7; add only 5–10 minutes to Day 7 when every symptom checkpoint stays at zero.
5. **Near return:** three easy runs; later add one mild steady segment.
6. **Normal-plan re-entry:** first add easy frequency, then strides, then a shortened controlled quality session, and only afterward resume the selected core calendar.

At every stage ask about pain during, immediately after, and the next morning. Any recurrence holds or regresses the sequence; sharp pain, swelling, gait change, localized bone pain, or worsening moves to H4.

## 17. The seven injury modules

These modules modify the selected core plan only after the state machine chooses H0–H3. Percentage reductions apply to the validated baseline once; they never stack with one another.

### INJ-1 — Knee

| State | Template action |
|---|---|
| `H0` | No automatic reduction. Reintroduce any previously provoking hills or speed one dose lower. Do not prescribe a universal cadence number. |
| `H1` | First loading week −15%; one quality session maximum for two loading weeks; flat easy Day 7. |
| `H2/H3` | Easy flat running only when symptom gate permits; remove `H`, `HS`, `I`, `FF`, and race-pace blocks initially. |
| Escalate | Swelling, locking/giving way, gait change, sharp pain, or pain >3/10 → `H4`. |

Return order: easy flat running → relaxed strides if fully symptom-free → controlled threshold → hills/intervals → fast-finish long run last.

### INJ-2 — Ankle/Achilles

| State | Template action |
|---|---|
| `H0` | No automatic reduction, but recent history starts speed and hills one dose lower. |
| `H1` | First loading week −20%; remove `HS`, `H`, `I`, and fast finishes for at least the first two symptom-free loading weeks. |
| `H2/H3` | Flat Zone-1/easy running only if permitted by the symptom gate; no strides, sprinting, hills, or race-pace work. |
| Escalate | Pain >3/10, worsening stiffness/pain, swelling, gait change, or instruction to stop → `H4`. |

Return order: flat easy → steady/aerobic → relaxed strides → threshold → hills and short repetitions last. Race proximity never accelerates this order.

### INJ-3 — Shin splints / shin pain

| State | Template action |
|---|---|
| `H0` | No automatic reduction. Keep initial long-run and speed progression conservative after recent history. |
| `H1` | First loading week −15%; one quality session maximum; avoid sudden surface or hill-load changes. |
| `H2/H3` | Easy running only; remove `I`, `H`, `HS`, `FF`, and race-pace work until symptom-free. |
| Escalate | Localized bone pain, point tenderness, pain worsening through a run, pain at rest, or gait change → `H4`; the app must not label this “just shin splints.” |

Return order: short easy → ordinary easy frequency → strides → threshold → intervals/hills last.

### INJ-4 — IT band / outer knee

| State | Template action |
|---|---|
| `H0` | No automatic reduction; avoid adding downhill and speed load simultaneously. |
| `H1` | Reduce hard-session count by 50% for the first two loading weeks; use the generic −20% volume fallback only when current training tolerance is also reduced. |
| `H2/H3` | Flat easy running only; remove downhill running, `H`, `FF`, and long race-pace blocks. Stop the session before the runner's repeatable symptom-onset point. |
| Escalate | Gait change, swelling, sharp pain, or progressively earlier symptom onset → `H4`. |

Return order: flat easy below symptom threshold → longer easy → threshold → hills/fast finish last.

### INJ-5 — Hip/glute

| State | Template action |
|---|---|
| `H0` | No automatic reduction; reintroduce hills, long-run finishes, and sprint-like work separately. |
| `H1` | First loading week −20%; one quality session maximum; Day 7 easy and clipped to demonstrated tolerance. |
| `H2/H3` | Short flat easy running only; remove `HS`, `H`, `I`, `FF`, and long race-pace blocks. |
| Escalate | Bone-localized hip pain, pain at rest/night, weakness, radiating symptoms, or gait change → `H4`. |

Return order: short easy → normal easy duration → controlled steady/threshold → hills and fast finishes last.

### INJ-6 — Lower back

| State | Template action |
|---|---|
| `H0` | No automatic reduction; avoid introducing both longer running and faster running in the same week after recent history. |
| `H1` | First loading week −20%; remove fast finish; keep Day 7 at `LR-low`. |
| `H2/H3` | Easy running only if it does not alter posture or gait; remove `HS`, `H`, `I`, `FF`, and long sustained race-pace work. |
| Escalate | Radiating pain, numbness, weakness, major trauma, night/rest pain, or gait change → `H4` and prompt appropriate medical assessment. New bowel/bladder dysfunction or loss of sensation around the genitals/anus requires emergency-care language, not an ordinary physiotherapy suggestion. |

Return order: short easy → easy duration → strides if symptom-free → controlled threshold → long fast work last.

### INJ-7 — Plantar/arch

| State | Template action |
|---|---|
| `H0` | No automatic reduction; introduce speed, hills, and long-run growth separately. |
| `H1` | First loading week −20%; no hills or fast finish for two symptom-free loading weeks. |
| `H2/H3` | Short easy running only when symptoms do not rise during, after, or the following morning; remove `HS`, `H`, `I`, `FF`, and race-pace work. |
| Escalate | Severe or increasing first-step pain, swelling, localized bone pain, gait change, or pain >3/10 → `H4`. |

Return order: short easy → normal easy frequency → relaxed strides → threshold → hills/fast finish last.

## 18. Multiple-injury composition

When more than one injury is selected:

1. Evaluate every location through the state machine.
2. Use the highest state number (`H4` beats H3, H3 beats H2, and so on).
3. Take the single largest applicable volume reduction; never add percentages.
4. Apply the union of all workout removals.
5. Use the slowest return order and the shortest permitted Day 7.
6. Display each relevant location warning without claiming the locations share one diagnosis.
7. A clinician's “do not run” instruction overrides every other answer.

## 19. Remaining personalization modifiers

These inputs modify a plan without multiplying the 40-plan library:

| Input | Deterministic effect |
|---|---|
| Weekly kilometres | Establishes `B`; all weekly targets scale from it and remain within level ceilings |
| Days available | Selects one of the five exact placement layouts |
| Recent performance | Sets training pace/effort and assists `SPD/END` classification |
| Goal time | Sets only realistic race-pace work; never ordinary training pace |
| Race date | Shortens or extends through Section 8, preserving taper and safety |
| Age 50+ | Forces a three-week recovery rhythm |
| Under 18 | Uses RPE/effort rather than age-predicted HR zones and displays youth guidance |
| Recovery preference | Selects three or four weeks where the experience level permits |
| Recent longest run | Caps and seeds Day 7 progression |
| Injury answers | Apply Sections 15–18 before any other ambition-based modifier |

## 20. Generator resolution order

```text
validate intake
→ injury state (H0–H4)
→ race distance and canonical/adjusted duration
→ visible experience track
→ safe run-frequency layout
→ SPD/END runner profile
→ weekly calendar row
→ experience-specific workout dose
→ weekly-volume state
→ pace/effort derivation
→ long-run and hard-session clamps
→ injury removals/reductions
→ exact seven-day distance reconciliation
→ disclaimers and limited-preparation disclosure
```

If two rules conflict, the earlier safety decision in this resolution order wins. The output must never silently drop a warning or relabel a reduced plan as full preparation.

## 21. Completeness and acceptance checklist

- [x] 40 plan IDs explicitly registered.
- [x] Every plan resolves to a complete week-by-week distance calendar.
- [x] Five experience doses are explicit.
- [x] Both runner-profile variants are explicit and weakness-targeted.
- [x] Exact 3-, 4-, 5-, 6-, and 7-day placement layouts are defined.
- [x] Day 7 is fixed as long run or race.
- [x] Canonical durations and short/long adaptation rules are defined.
- [x] Beginner, lower-intermediate, higher-intermediate, and competitive quality limits are defined.
- [x] Seven injury modules and multiple-injury precedence are defined.
- [x] Active/worsening and red-flag branches cannot be overridden by race ambition.
- [x] Weekly volume, long run, recovery, taper, and quality-session constraints are composable.
- [ ] Ian coaching review of the complete library.
- [ ] Qualified clinical review of injury branching before production use.
- [ ] Translation into code and automated fixture tests; separately authorized work.

## 22. Evidence and provenance

This library is an original synthesis. It does not reproduce a paid McMillan, B.A.A., Daniels, Pfitzinger, or other commercial schedule. Its architecture is grounded in the professional and peer-reviewed sources listed earlier in this document and in the companion research ledger. In particular:

- McMillan's public materials inform readiness paths, runner-type concepts, event specificity, down-week rhythm, long-run variety, and speed-before-stamina sequencing.
- Athletics Ireland and B.A.A. public architectures support base → build → specific → taper organization and experience-scaled frequency.
- The Campos systematic review supports a low-intensity majority rather than a universal exact ratio.
- The Wang taper meta-analysis and large recreational-marathon analysis support substantial volume reduction while retaining brief intensity, with a longer disciplined marathon taper.
- The 2025 Frandsen cohort supports guarding single-session distance spikes relative to recent history.
- Injury-history and training-load reviews support treating prior/current injury as a material modifier while acknowledging that a body-location picker cannot diagnose pathology.

Location-specific safety checks were also cross-checked against current professional medical guidance:

- [AAOS — Stress Fractures](https://orthoinfo.aaos.org/en/diseases--conditions/stress-fractures/) supports stopping pain-provoking impact, clinical assessment for suspected bone stress, and slow clinician-cleared return.
- [NHS — Knee pain and other running injuries](https://www.nhs.uk/live-well/exercise/knee-pain-and-other-running-injuries/) supports stopping running with painful knee/Achilles symptoms and seeking assessment for severe, swollen, persistent, or sudden sharp presentations.
- [Guy's and St Thomas' NHS — Achilles tendinopathy](https://www.guysandstthomas.nhs.uk/health-information/achilles-tendinopathy) supports load modification, careful symptom monitoring, and individualized rehabilitation rather than a universal return date.
- [NHS — Plantar fasciitis](https://www.nhs.uk/conditions/plantar-fasciitis/) supports the first-step symptom screen and recognizes increased standing/walking/running load as relevant.
- [NHS — Back pain](https://www.nhs.uk/conditions/back-pain/) supports urgent/emergency escalation for neurological weakness/numbness and new bladder, bowel, or saddle-sensation changes.
- [AAOS — About Your Knee](https://orthoinfo.aaos.org/globalassets/pdfs/about-your-knee.pdf) identifies swelling, locking, and giving way as signs requiring proper clinical evaluation rather than template diagnosis.

### Required disclaimers

Every plan displays:

> This is not medical advice. Consult a doctor before starting any training program or if you experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. PACE provides coaching guidance, not medical diagnosis or treatment.

Every H1–H4 plan additionally displays:

> If you are experiencing significant pain, swelling, or symptoms that concern you, please seek assessment from a qualified sports medicine professional or physiotherapist before continuing training.

**Production boundary:** the 40 training templates are ready for Ian's coaching review. The injury modules remain draft safety logic until reviewed by a qualified sports-medicine professional. This document still makes no application-code change.
