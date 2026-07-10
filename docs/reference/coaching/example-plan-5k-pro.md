# Worked example — 12-week 5K, Pro tier

> **Hand-derived from the coaching library only.** Every number below traces to a source rule or to
> arithmetic on the runner's own inputs. Nothing is invented. Where the library cannot produce a
> value, that is stated rather than filled in.
>
> This doubles as the **golden fixture** for `src/lib/planTemplates.ts` — the generator must
> reproduce this plan from this intake.

## The runner (assumed — replace with real intake)

| Field | Value | Consequence |
|---|---|---|
| Age | 25 | Max HR = `220 − 25` = **195 bpm** |
| Years running | 3 | — |
| Weekly volume | 35 km | **Intermediate** (>30 km, <70 km). Volume beats years. |
| Days per week | 4 | "3–4 run programs — add steady/interval" *(§ Customization › Weekly Availability)* |
| Race | 5K, 12 weeks out | Plan length 12 weeks *(§ Customization › Goal Race: 5K = 12–14 wk)* |
| Goal time | 20:00 | Goal pace = **4:00/km** |
| Recent 5K | 22:30 | Current pace = 4:30/km. Goal is **11.1% faster.** |
| Tier | Pro | Gets HR zones, coach "why", warm-ups/drills |

## Heart-rate zones (the only absolute numbers the library can produce)

Max HR 195. *(training-zones.md)*

| Zone | % max HR | bpm | RPE |
|---|---|---|---|
| 1 — Easy / Recovery | 60–70% | **117–137** | 1–3 |
| 2 — Steady | 70–80% | **137–156** | 4–5 |
| 3 — Tempo / Threshold | 80–87% | **156–170** | 6–7 |
| 4 — Intervals | 87–95% | **170–185** | 8–9 |
| 5 — Strides only | 95–100% | **185–195** | 10 |

## ⚠️ The pace gap

The library derives tempo pace as *"45–60 sec/km faster than easy pace"* for an intermediate
(`workout_library.md § Tempo › Pace Guidance`). But **easy pace is never given a formula anywhere** —
it is only ever described by heart rate and by feel. There is no VDOT table, no equivalent-performance
chart, no pace calculator in any of the six source files.

**Therefore this plan can state, as real numbers:**
- Heart-rate zones (from age)
- Goal race pace, 4:00/km (goal time ÷ distance — arithmetic)
- Session structures, durations, recoveries

**It cannot state:** a numeric easy pace, and therefore not a numeric tempo pace either.

Those sessions are prescribed by **HR zone + RPE** instead. See "Open" at the bottom.

---

## Volume plan

Baseline 35 km. Weekly increase capped at 10–15% *(load-rules.md Rule 1)*. Deload every **4 weeks**
(intermediate), reducing **35–45%** — 40% used. Long run ≤ **30%** of weekly volume (intermediate),
growing by no more than **min(10%, 2 km)** per week.

| Week | Phase | Volume | Long run | Note |
|---|---|---|---|---|
| 1 | Health & Early Aerobic | 35 km | 10 km | Baseline |
| 2 | Health & Early Aerobic | 38 km | 11 km | +8.6% |
| 3 | Health & Early Aerobic | 42 km | 12 km | +10.5% |
| 4 | Health & Early Aerobic | **25 km** | 8 km | **Deload −40%** |
| 5 | Early Aerobic | 44 km | 13 km | +4.8% *(vs week 3)* |
| 6 | Early Aerobic | 47 km | 14 km | +6.8% |
| 7 | Early Aerobic | 50 km | 15 km | +6.4%, long run at the 30% cap |
| 8 | Early Aerobic | **30 km** | 10 km | **Deload −40%** |
| 9 | Intervals & Max Aerobic | 52 km | 15 km | +4% *(vs week 7)* |
| 10 | Intervals & Max Aerobic | 54 km | 16 km | +3.8%. Peak week |
| 11 | Race-Specific | 45 km | 12 km | Taper begins |
| 12 | Race Week | ~28 km | — | Race |

Peak 54 km ≤ intermediate ceiling of 70 km. Longest run 16 km ≤ 25 km. *(Rule 4)*

> **Bug found while building this.** `clampWeeklyVolume()` compares a proposed week against **last
> week**. After a deload that is wrong: week 5 (44 km) follows week 4's 25 km, a +76% jump, which the
> clamp would reject and rebuild at 27.5 km — permanently crippling the plan after every deload.
> The cap must compare against the **last loading week**, not the last week. Weeks 5 and 9 above are
> computed that way.

---

## Week by week

Days are unnamed. The runner places them; rest days are real slots.
All easy running is Zone 1. Hard sessions sit 48+ hours apart *(Rule 4)*.

### Phase 1 — Health & Early Aerobic Foundation (weeks 1–4)

**Week 1 — 35 km**
- Day 1 — Easy run · 8 km · Z1 117–137 · RPE 3
- Day 2 — Rest
- Day 3 — Easy run + strides · 8 km + 4 × 30 s strides · Z1, strides Z5
- Day 4 — Rest
- Day 5 — Tempo run · 9 km · 10 min WU (Z1) / 20 min sustained (Z3 156–170, RPE 6–7) / 10 min CD
- Day 6 — Long run · 10 km · Z1
- Day 7 — Rest

*Why this week:* establishing the aerobic floor. The tempo is deliberately at the *bottom* of Zone 3 —
tempo runs are run at or slightly **below** threshold, not on it *(workout-library.md § Tempo)*.

**Week 2 — 38 km** · Easy 9 / Easy+strides 8 / Tempo 10 / Long 11
**Week 3 — 42 km** · Easy 10 / Easy 9 / Tempo 11 / Long 12

**Week 4 — 25 km · DELOAD**
- Day 1 — Easy 7 km · Z1
- Day 2 — Rest
- Day 3 — Easy 6 km · Z1
- Day 4 — Rest
- Day 5 — Easy 4 km · Z1
- Day 6 — Long 8 km · Z1
- Day 7 — Rest

*Why this week:* no quality work at all. A deload that keeps the hard session isn't a deload.

### Phase 2 — Early Aerobic Training (weeks 5–8)

**Week 5 — 44 km** · Easy 10 / Easy 9 / Tempo 12 / Long 13
**Week 6 — 47 km** · Easy 11 / Easy 10 / Tempo 12 / Long 14
**Week 7 — 50 km** · Easy 11 / Easy 10 / Tempo 14 / Long 15 — *long run exactly at the 30% cap*
**Week 8 — 30 km · DELOAD** · Easy 8 / Easy 7 / Easy 5 / Long 10

### Phase 3 — Intervals & Maximum Aerobic (weeks 9–10)

**Week 9 — 52 km**
- Day 1 — Easy run · 11 km · Z1
- Day 2 — Rest
- Day 3 — Tempo run · 12 km · 10 WU / 25 min sustained (Z3) / 10 CD
- Day 4 — Rest
- Day 5 — VO2 intervals · 14 km · 15 min WU / **6 × 3 min hard (Z4 170–185, RPE 8–9), 90 s jog** / 10 CD
- Day 6 — Long run · 15 km · Z1
- Day 7 — Rest

*Why this week:* two quality sessions, 48 hours apart. Interval structure is taken verbatim from
`workout-library.md § VO2 Max Intervals › Advanced Structure Options`. First and last interval must sit
within 5–8 s/km of each other; a >10 s/km drop means the pace was too aggressive.

**Week 10 — 54 km · peak** · Easy 11 / Tempo 12 / Intervals 15 (`4 × 5 min hard, 2 min recovery`) / Long 16

### Phase 4 — Race-Specific Preparation (weeks 11–12)

**Week 11 — 45 km**
- Day 1 — Easy run · 10 km · Z1
- Day 2 — Rest
- Day 3 — **Race-pace reps · 14 km** · 15 WU / **3 × 1.6 km at goal pace 4:00/km**, 90 s jog / 10 CD
- Day 4 — Rest
- Day 5 — Easy run · 9 km · Z1
- Day 6 — Long run · 12 km · Z1
- Day 7 — Rest

*Why this week:* this is the first session prescribed by **pace** rather than heart rate, because goal
pace is the one pace the plan actually knows. Volume drops 17% while intensity stays specific.

**Week 12 — Race week, ~28 km**
- Day 1 — Easy 8 km · Z1
- Day 2 — Rest
- Day 3 — Easy 6 km + 4 × 20 s strides at goal pace
- Day 4 — Rest
- Day 5 — Shakeout 4 km · Z1 + 2 × 30 s at goal pace
- Day 6 — Rest
- Day 7 — **RACE 5K** (5 km warm-up/cool-down + 5 km race)

*Why this week:* nothing here builds fitness. Everything preserves it.

---

## Disclaimers *(load-rules.md Rule 10 — legally required)*

> This is not medical advice. Consult a doctor before starting any training program or if you
> experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. PACE
> provides coaching guidance, not medical diagnosis or treatment.

---

## Open — needs Ian

1. **No pace derivation exists in the library.** Pro sells "pace targets," but the source cannot turn
   22:30 for 5K into an easy or tempo pace. Three ways out:
   - Encode McMillan's pace tables (Ian is certified and may have them).
   - Ask the runner for their current easy pace at intake.
   - Ship HR zones + RPE only, and drop numeric easy/tempo pace from the paid promise.
2. **`clampWeeklyVolume()` must compare against the last *loading* week**, not literally last week,
   or every post-deload week gets crushed. Fix before `planTemplates.ts`.
3. **Ian's model says intervals anchor to goal pace, "maybe a bit slower depending on comfort."**
   How much slower, and when does it converge? Above, phase 3 uses HR zones and phase 4 uses exact
   goal pace. The in-between is unspecified.
