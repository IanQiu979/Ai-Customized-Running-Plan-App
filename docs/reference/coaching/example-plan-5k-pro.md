# Worked example — 12-week 5K, Pro tier

> **Hand-derived from the coaching library only.** Every number below traces to a source rule, to
> the 2026-07-11 market-research pass, to arithmetic on the runner's own inputs, or to a dated
> ruling from Ian. Nothing is invented. Where the library cannot produce a value, that is stated
> rather than filled in.
>
> This doubles as the **golden fixture** for `src/lib/planTemplates.ts` — the generator must
> reproduce this plan from this intake.
>
> **Revised 2026-07-11.** Ian scored the originally-rendered version of this plan **3/10** and
> issued five rulings — session sizing is keyed to race distance, not weekly volume; reps are
> count × distance, never bare distances or times; race-pace-rep anchoring converges from
> current-fitness pace to goal pace; run-type labels are abbreviated (`notation.md`); the HR zones
> and volume-adherence discipline were explicitly praised and are unchanged. The runner, HR zones,
> phase names, deload architecture (weeks 4 and 8, −40%), and the 4-day Day 1/3/5/6 pattern are
> unchanged from the original; the volume table, every tempo/interval/race-pace session, and every
> day label below are rebuilt. Full account: `docs/change_log.md`, 2026-07-11 entry.
>
> **Cycle-2 correction pass, same day (2026-07-11).** A code-review pass over that rebuild found
> internal contradictions; all are fixed in this revision — week 9's interval recovery jog now
> follows `workout-library.md`'s own recovery menu (44 → **45 km**); the Daniels 10%-of-volume
> brake is re-scoped from an enforced rule to advisory context, since the app's own golden plan
> violates it in every quality week; "reps are count × distance" is now stated consistently (it
> had been inverted in three places); `notation.md`'s canonical structure-string example no longer
> anchors an `INT` session to goal pace; and strides are extended to one easy day per loading week
> (research-sourced, flagged for Ian's sign-off). Full account: `docs/change_log.md`, second
> 2026-07-11 entry.
>
> **Round-2 sign-off, 2026-07-12 (issue #34, rendered-plan review round 2).** Ian ruled on every
> item this doc had flagged for him. Applied here: peak volume 48 km approved on its own merits,
> no longer awaiting his eyes (ruling 2); the long-run share cap is raised to 32% for this
> intermediate runner, so this plan's long-run percentages are no longer a rounding overage worth
> flagging (ruling 1, `load-rules.md`); the run-type abbreviation set is signed off exactly as
> written, including the known `RP`/`GP` wrinkle (ruling 5, `notation.md`); race day's structure
> string is corrected to `WU 3 km · 5 km race · CD 2 km` (ruling 6, closes issue #29); strides
> extend from one easy day to **both** easy days of every loading week with two easy days — weeks
> 1, 2, 3, 5, 6, 7 (ruling 7); week 9's 300 m recovery jog is confirmed, not just corrected (ruling
> 8); and the Daniels 10%-of-volume brake is ruled permanently advisory, never overriding the 5K
> quality-volume band's floor (ruling 3). Full account: `docs/change_log.md`, 2026-07-12 entry.
>
> **Follow-up, same day: ruling R1c (issue #34 code review).** Ian's ruling 1 above was first
> worded as "deload weeks are exempt" from the long-run share cap; a code review found that a
> HIGH-severity hole (an AI-emittable field, `Week.isDeload`, would have switched off the app's
> only volume-relative safety ceiling), so Ian corrected it the same day: the cap is never removed
> for a deload week, it is measured against the last **loading** week's volume instead of the
> deload week's own reduced total. See "Volume plan" below and `load-rules.md` for the corrected
> rule and the worked numbers.

## The runner (assumed — replace with real intake)

| Field | Value | Consequence |
|---|---|---|
| Age | 25 | Max HR = `220 − 25` = **195 bpm** |
| Years running | 3 | — |
| Weekly volume | 35 km | **Intermediate** (>30 km, <70 km). Volume beats years. |
| Days per week | 4 | "3–4 run programs — add steady/interval" *(§ Customization › Weekly Availability)* |
| Race | 5K, 12 weeks out | Plan length 12 weeks *(§ Customization › Goal Race: 5K = 12–14 wk)* |
| Goal time | 20:00 | Goal pace = **4:00/km** |
| Recent 5K | 22:30 | Current pace = 4:30/km (270 s/km). Goal is **11.1% faster.** |
| Tier | Pro | Gets HR zones, coach "why", warm-ups/drills |

## Heart-rate zones (Ian: "the zones are also correct" — unchanged)

Max HR 195. *(training-zones.md)*

| Zone | % max HR | bpm | RPE |
|---|---|---|---|
| 1 — Easy / Recovery | 60–70% | **117–137** | 1–3 |
| 2 — Steady | 70–80% | **137–156** | 4–5 |
| 3 — Tempo / Threshold | 80–87% | **156–170** | 6–7 |
| 4 — Intervals | 87–95% | **170–185** | 8–9 |
| 5 — Strides only | 95–100% | **185–195** | 10 |

## Pace bands — originally "The pace gap," resolved 2026-07-10, decision 13

The library derives tempo pace as *"45–60 sec/km faster than easy pace"* for an intermediate
(`workout_library.md § Tempo › Pace Guidance`), but never gives easy pace a formula anywhere —
only heart rate and feel. There is no VDOT table, no equivalent-performance chart, no pace
calculator in any of the six source files. That was this doc's own Open item #1 as originally
written, and it stood unresolved through the first draft of this plan.

**Resolved by decision 13 in `00-README.md` (2026-07-10), now implemented in the in-flight
`paceDerivation.ts` module** (`src/lib/__tests__/paceDerivation.test.ts`): cross-distance
equivalency via the published Riegel formula (`T2 = T1 × (D2/D1)^1.06`) converts this runner's
recent 22:30 5K into equivalent times at other distances; training-pace bands are then read off
the source's own *relative* rules — a 10K-to-half "tempo pace feel," a 3K-to-5K "interval pace
feel," and an intermediate-level easy-pace offset from the tempo band — rather than any invented
numeric table.

For this runner (recent 5K 22:30 → 270 s/km):

- **Tempo band: 281–294 s/km (≈4:41–4:54/km).**
- **Interval band, current fitness: 262–270 s/km (≈4:22–4:30/km).**
- **Easy band (intermediate offset, +45/+60 s/km over the tempo band): 326–354 s/km
  (≈5:26–5:54/km).** Shown here for completeness — this worked example continues to prescribe
  easy and long runs by HR zone alone below, as the original did, to keep the day-by-day table
  readable; the app itself carries this band on every easy-run `Workout`.
- **Steady / Zone 2 pace: still not derivable.** The source gives no relative rule for it;
  `paceDerivation.ts` deliberately never returns a `steady` pace. `NOT SPECIFIED IN SOURCE — needs
  Ian.`

**This plan can now state, as real numbers:** heart-rate zones, goal race pace (4:00/km), tempo
pace, interval pace, and — for the first time, per Ian's 2026-07-11 ruling 3 below — race-pace
reps at goal pace directly. It still cannot state a numeric steady/Zone 2 pace.

**Cycle-2 note (2026-07-11): `paceDerivation.test.ts` was mid-resync when this note was first
written; the resync has since landed.** That test's `deriveRacePaceTarget` section originally
encoded the 2026-07-10 R-A addendum's >10%-goal-improvement gate: for this runner (20:00 goal vs. a
22:30 recent-equivalent, an 11.1% implied improvement) the gate fired and pinned the race-pace
target flat at this runner's current pace (270 s/km), which contradicted ruling 3's week-11
prescription below (goal pace, 4:00/km = 240 s/km, directly). The resync landed the same cycle:
`deriveRacePaceTarget` now anchors to goal pace for this fixture
(`pace: { lowSecPerKm: 240, highSecPerKm: 240 }, source: 'goal'`), exactly per ruling 3, and the
old >10%-goal-improvement gate is gone from the test. The gate itself raised a question ruling 3
doesn't answer — see Open item 5, which is still open.

---

## Session sizing (Ian's ruling, 2026-07-11)

> *"A 14 km tempo run at 4:30 pace [in a 5K plan] makes no sense."* — Ian, reviewing the version
> of this plan that grew its tempo session 9 → 10 → 11 → 12 → 12 → 14 km to absorb rising weekly
> volume. That growth pattern is the defect this revision removes.

**Quality-session size (tempo and interval work) is a fixed band keyed to race distance, not to
weekly volume — it does not grow as the week's volume grows.** Full sizing rule and sourcing:
`workout-library.md` § "Session sizing by race distance." For this 5K plan: tempo sustained work
**15–30 minutes** — this plan's own sessions sit in the **20–30 minute** upper region of that band
(see the week-by-week arithmetic below), not a different, narrower band of their own — and
interval quality volume 4.0–5.0 km off the McMillan rep menu (400/600/800/1000 m). Surplus weekly
volume goes to easy runs and the long run instead, inside the long-run share cap.

**Reps are prescribed as count × distance** (`"8 × 600 m"` style), with recovery and target pace
stated — never a bare distance or a bare time. Full grammar and worked examples:
[`notation.md`](notation.md).

**Race-pace-rep anchoring converges from current fitness to goal pace (ruling 3) — supersedes part
of the 2026-07-10 correction.** Ian: *"your goal is to run at your goal pace, might be slower in
the beginning."* Early-plan interval sessions (weeks 9–10 below) run at this runner's
**current-fitness** interval pace (262–270 s/km); the week 11 race-pace-rep session runs **at goal
pace** (4:00/km) directly, now that it sits in the race-specific phase. This is the McMillan
position (Higdon and Runna also anchor to goal pace); Daniels forbids goal-pace anchoring
entirely and anchors to current fitness only — Ian is McMillan-certified and ruled for McMillan,
with the early-plan current-fitness convergence explicitly covering Daniels' overtraining concern.
**This supersedes the narrower 2026-07-10 correction, which had pinned the week-11 session flat at
this runner's current pace (270 s/km) throughout** — that correction is not deleted, it's
superseded: it was right that goal pace shouldn't be assumed on day one of the plan, wrong that it
should never be reached. See "Open" below for the full history.

**Run-type labels use abbreviations** (`ER`, `TR`, `INT`, `RP`, `LR`, `SR`, `ER + Strides`),
**except Strides, always spelled out.** Full table and structure-string grammar:
[`notation.md`](notation.md). A `Workout`'s headline distance is the **total** kilometres run that
day (warm-up, cool-down, and recovery jog included) so each day's number sums cleanly into the
week's volume; the `structure` string itemizes warm-up / work / cool-down so the true quality-work
size is never hidden inside the total — see `notation.md`'s headline-number convention for why this
is a deliberate divergence from how published plans usually headline these numbers.

**Strides sit on both easy days of every loading week that has two easy days (Ian's ruling,
2026-07-12 — issue #34, rendered-plan review round 2; resolves Open item 7).** The original build
only carried strides in weeks 1–2 and 12. A cycle-2 pass (2026-07-11, research-sourced) extended
that to one easy day in every other loading week. This ruling extends it further, to **both** easy
days of weeks 1, 2, 3, 5, 6, 7 — moving the plan the rest of the way toward the ported library's own
2–3×/week guidance (`workout-library.md` § Session 9) rather than partway to it. Weeks 9 and 10
have only one easy day each and keep their single strides day, unchanged. Week 11 is taper and Ian
ruled the taper is left alone: Day 1 stays strides-free, only Day 5 keeps its goal-pace strides.
Week 12 (race week) is unchanged. Deload weeks 4 and 8 stay strides-free: the library permits
strides during a deload for "speedster" types (`workout-library.md` § Session 9, "When to use"),
but keeping deload weeks pure remains the simpler default. Strides add no headline distance, so no
volume-table arithmetic changes anywhere in this revision.

---

## Volume plan

Baseline 35 km. Weekly increase capped at 10–15% *(load-rules.md Rule 1)*. Deload every **4
weeks** (intermediate), reducing **35–45%** — ~40% used, measured off the last **loading** week.
Long run ≤ **32%** of weekly volume (intermediate); the cap is never removed for a deload week —
in a deload week it is measured against the last **loading** week's volume instead of the deload
week's own reduced total (`load-rules.md`, Ian's ruling R1c, 2026-07-12); **no easy run may
exceed ~80% of that week's long run** (new rule, a direct consequence of ruling 1 — see below);
long run grows by no more than **min(10%, 2 km)** per week and never more than **10%** over the
plan's own previous longest long run (`load-rules.md`, long-run spike cap).

**New rule, stated explicitly (consequence of ruling 1): weekly volume is the *sum* of
correctly-sized sessions, not a target the sessions are stretched to fill.** The old plan reached
52–54 km peak weeks only by inflating the tempo and interval sessions past their sizing band —
exactly the defect ruling 1 removes. With quality sessions right-sized, a 4-day-a-week
intermediate runner training toward a 5K physically cannot fill a 52–54 km week without either
adding a 5th run day (not this runner's intake) or breaking the long-run cap — so the peak below
lands lower, where the arithmetic actually puts it.

| Week | Phase | Volume | Long run | Note |
|---|---|---|---|---|
| 1 | Health & Early Aerobic Foundation | 34 km | 10 km | Baseline (1 km under the runner's declared 35 km/week — flagged below) |
| 2 | Health & Early Aerobic Foundation | 35 km | 11 km | +2.9% |
| 3 | Health & Early Aerobic Foundation | 38 km | 12 km | +8.6% |
| 4 | Health & Early Aerobic Foundation | 23 km | 8 km | **Deload −39.5%** (off week 3) |
| 5 | Early Aerobic Training | 41 km | 13 km | +7.9% *(vs week 3, the last loading week)* |
| 6 | Early Aerobic Training | 45 km | 14 km | +9.8% |
| 7 | Early Aerobic Training | 48 km | 15 km | +6.7% |
| 8 | Early Aerobic Training | 30 km | 10 km | **Deload −37.5%** (off week 7) |
| 9 | Intervals & Maximum Aerobic | 45 km | 14 km | −6.3% vs week 7 — see note below, not a violation |
| 10 | Intervals & Maximum Aerobic | 48 km | 15 km | +6.7%. **Peak week** (tied with week 7) |
| 11 | Race-Specific Preparation | 40 km | 12 km | Taper begins, −16.7% |
| 12 | Race Week | 28 km | — | Race |

Peak **48 km** ≤ intermediate ceiling of 70 km. Longest run **15 km** ≤ 25 km single-run cap.
*(Rule 4)* Every long run above sits inside the 10% spike cap off the plan's own previous longest
(10 → 11 → 12 → 13 → 14 → 15, each step ≤ 10%; the deload weeks and week 9's step *down* are
decreases, which the spike cap never restricts).

**Peak volume approved (Ian's ruling, 2026-07-12 — issue #34, rendered-plan review round 2).** The
drop from the old plan's 54 km peak was a direct consequence of ruling 1 (quality sessions no
longer scale with weekly volume); Ian has now approved the resulting shape on its own merits.
`weeklyLoad` stays `[34, 35, 38, 23, 41, 45, 48, 30, 45, 48, 40, 28]` — recorded as approved, no
longer awaiting his eyes.

**Deload long runs checked against the last loading week (ruling R1c, Ian's follow-up, same day).**
Week 4's 8 km long run is **21.1%** of week 3's 38 km (the last loading week), and week 8's 10 km
long run is **20.8%** of week 7's 48 km — both far under the 32% intermediate cap. The cap is
never removed for a deload week; it is measured against the last loading week's volume instead of
the deload week's own reduced total. See `load-rules.md` § "Long-run cap, by level" for the full
rule and why it changed.

**Three things to flag for Ian, all a direct, arithmetic consequence of ruling 1 — not separate
new rules:**

1. **Week 1 lands at 34 km, 1 km under the runner's declared 35 km/week.** With the tempo session
   fixed at 8 km and the 80%-of-long-run cap on easy runs, 34 km is the maximum this week's
   sessions can sum to at a 10 km long run — hitting 35 exactly would mean either growing the
   tempo session (ruling 1 forbids it) or pushing an easy run past 80% of the long run. Resolved
   in favor of the long-run cap and session sizing, per the priority this revision follows
   throughout; 1 km is inside the rounding tolerance this revision uses.
2. **Every loading week's long run lands 0.5–0.8 km over a strict 30%-of-volume reading**, once
   each day is rounded to a whole kilometre (e.g. week 7: 15 km long run ÷ 48 km total = 31.25%).
   This is mechanical, not a case of the cap being ignored: maximizing each easy run at 80% of the
   long run and holding the long run at (approximately) 30% of the total pull the same two numbers
   toward each other from opposite sides, and whole-kilometre rounding rarely lands on an exact
   solution. Every overage below is under 1 km. **Resolved by ruling 1 (Ian's ruling, 2026-07-12 —
   issue #34/#19): the long-run share cap for intermediate runners is now 32%, not 25–30%.** Every
   loading-week figure above (29.4–31.7%) sits inside 32% with room to spare — this is no longer
   an overage worth flagging. The plan's two deload long runs (week 4, week 8) are checked
   differently — against their own last loading week's volume, not their own reduced total, per
   the R1c follow-up ruling — see "Deload long runs checked against the last loading week" above
   and `load-rules.md` § "Long-run cap, by level."
3. **Week 9's total volume (45 km) sits *below* week 7's (48 km)**, even though week 9 opens the
   plan's most intense phase. Two right-sized quality sessions (tempo + intervals) plus the
   long-run share cap leave less room for easy-day filler than the single-tempo phase did — with
   only one easy day left in the week (Day 1) to dilute the long run's 30% share, the long run
   itself has to sit slightly lower (14 km, down from week 7's 15 km) to stay near that cap.
   Intensity rises even as total volume dips slightly; this is a legitimate, if initially
   surprising, outcome of "volume is an outcome, not a target," worth Ian's eyes before it ships.

> **Bug found while building this.** `clampWeeklyVolume()` compares a proposed week against **last
> week**. After a deload that is wrong: week 5 (41 km) follows week 4's 23 km, a +78% jump, which
> the clamp would reject and rebuild far too low — permanently crippling the plan after every
> deload. The cap must compare against the **last loading week**, not the last week. Weeks 5 and 9
> above are computed that way. Still open — see "Open" below.

---

## Week by week

Days are unnamed. The runner places them; rest days are real slots.
All easy running is Zone 1. Hard sessions sit 48+ hours apart *(Rule 4)*. Labels follow
[`notation.md`](notation.md): `ER` easy run, `TR` tempo run, `INT` intervals, `RP` race-pace reps,
`LR` long run, `SR` shakeout run, `ER + Strides`, and unabbreviated `Rest` / `Race Day`.

### Phase 1 — Health & Early Aerobic Foundation (weeks 1–4)

**Week 1 — 34 km**
- Day 1 — ER + Strides · 8 km + 4 × 30 s Strides · Z1 117–137, strides Z5 · RPE 3
- Day 2 — Rest
- Day 3 — ER + Strides · 8 km + 4 × 30 s Strides · Z1, strides Z5
- Day 4 — Rest
- Day 5 — TR · 8 km · WU 2 km (Z1) · 20 min @ tempo ≈4 km (Z3 156–170, RPE 6–7, 281–294 s/km ≈
  4:41–4:54/km) · CD 2 km (Z1)
- Day 6 — LR · 10 km · Z1
- Day 7 — Rest

*Why this week:* establishing the aerobic floor. The tempo session is fixed at 20 minutes
sustained — 4 km of work either side of a 2 km warm-up and 2 km cool-down (arithmetic: 20 min at
~4:48/km — the middle of this runner's 4:45–4:50/km conversion band inside the derived
4:41–4:54/km tempo range — ≈4.17 km, rounded to 4) — and stays exactly this size for as long as
this phase calls for 20 minutes of tempo work, regardless of how much the week's total volume
grows. It also sits deliberately at the *bottom* of Zone 3 — tempo runs are run at or slightly
**below** threshold, not on it *(workout-library.md § Tempo)*. Both easy days (Day 1, Day 3) carry
strides this week — every loading week with two easy days does, per Ian's ruling (see "Session
sizing" above).

**Week 2 — 35 km** · ER + Strides 8 / ER + Strides 8 / TR 8 / LR 11 · +2.9%
**Week 3 — 38 km** · ER + Strides 9 / ER + Strides 9 / TR 8 / LR 12 · +8.6%

**Week 4 — 23 km · DELOAD**
- Day 1 — ER · 6 km · Z1
- Day 2 — Rest
- Day 3 — ER · 5 km · Z1
- Day 4 — Rest
- Day 5 — ER · 4 km · Z1
- Day 6 — LR · 8 km · Z1
- Day 7 — Rest

*Why this week:* no quality work at all. A deload that keeps the hard session isn't a deload.
Volume drops 39.5% off week 3, the last loading week. Deliberately strides-free, unlike the
loading weeks either side — `workout-library.md` § Session 9 permits strides during a deload for
"speedster" types, but this revision keeps deload weeks pure as the simpler default; that's a
choice, not a rule, and the alternative is available if Ian prefers it.

### Phase 2 — Early Aerobic Training (weeks 5–8)

**Week 5 — 41 km** · ER + Strides 10 / ER + Strides 10 / TR 8 / LR 13 · +7.9% *(vs week 3, not week
4 — see the clamp bug note above)*
**Week 6 — 45 km** · ER + Strides 11 / ER + Strides 11 / TR 9 / LR 14 · +9.8% — tempo steps up to 22
minutes sustained (≈5 km of work; 22 min at ~4:48/km ≈ 4.58 km, rounded to 5), still well inside the
15–30 minute tempo band, not driven by the week's own volume growth.
**Week 7 — 48 km** · ER + Strides 12 / ER + Strides 12 / TR 9 / LR 15 · +6.7% — tempo holds at ~24
minutes sustained (≈5 km of work), long run reaches this phase's peak at 15 km.
**Week 8 — 30 km · DELOAD** · ER 8 / ER 7 / ER 5 / LR 10 — no quality work, −37.5% off week 7,
strides-free like week 4.

### Phase 3 — Intervals & Maximum Aerobic (weeks 9–10)

**Week 9 — 45 km**
- Day 1 — ER + Strides · 11 km + 4 × 30 s Strides · Z1, strides Z5
- Day 2 — Rest
- Day 3 — TR · 9 km · WU 2 km (Z1) · 24 min @ tempo ≈5 km (Z3 156–170, RPE 6–7) · CD 2 km (Z1)
- Day 4 — Rest
- Day 5 — INT · ≈11 km (WU 2 + 4.8 km quality + 2.1 km recovery jog + CD 2 ≈ 10.9, rounded to 11)
  · WU 2 km · 8 × 600 m @ current-fitness interval pace (262–270 s/km ≈ 4:22–4:30/km, Z4
  170–185, RPE 8–9) w/ 300 m jog · CD 2 km
- Day 6 — LR · 14 km · Z1
- Day 7 — Rest

*Why this week:* two quality sessions, 48 hours apart (Day 3 to Day 5). The interval structure is
the McMillan rep-menu "Buildup B" (8 × 600 m, 4.8 km quality volume) — see `workout-library.md` §
"Rep-distance menu and pace convergence." Recovery is a 300 m jog, inside `workout-library.md`'s
300–400 m recovery menu for 600 m reps (200–300 m would be a 400 m-rep recovery, not a 600 m one) —
**confirmed, not pending (Ian's ruling, 2026-07-12 — issue #34, rendered-plan review round 2): the
version of this plan Ian first scored used a 200 m jog here, outside the menu; the 300 m jog this
revision uses is correct and the menu itself is unchanged. Signed off.** Reps run at this runner's
current-fitness interval pace, not goal pace yet — ruling 3's early-plan moderation. First and last
interval should sit within 5–8 s/km of each other; a >10 s/km drop means the pace was too
aggressive. Day 1's single strides day is unchanged by ruling 7 — weeks 9 and 10 have only one easy
day each and keep it — see "Session sizing" above.

**Week 10 — 48 km**
- Day 1 — ER + Strides · 12 km + 4 × 30 s Strides · Z1, strides Z5
- Day 2 — Rest
- Day 3 — TR · 10 km · WU 2 km (Z1) · 29 min @ tempo ≈6 km (Z3 156–170, RPE 6–7) · CD 2 km (Z1)
- Day 4 — Rest
- Day 5 — INT · ≈11 km (WU 2 + 5.0 km quality + 1.6 km recovery jog + CD 2 ≈ 10.6, rounded to 11)
  · WU 2 km · 5 × 1000 m @ current-fitness interval pace (262–270 s/km ≈ 4:22–4:30/km, Z4
  170–185, RPE 8–9) w/ 400 m jog · CD 2 km
- Day 6 — LR · 15 km · Z1
- Day 7 — Rest

*Why this week:* the heaviest week of the plan. Tempo reaches this phase's ceiling (~29 minutes,
inside the 25–30 minute maximum for this plan's final tempo session) and the interval session
moves to McMillan's flagship "Best 5K Workout" design (5 × 1000 m, 5.0 km quality volume).
Everything after this week converts fitness into race readiness, not adds more of it. Day 1's
single strides day is unchanged by ruling 7, same as week 9 — see "Session sizing" above.

### Phase 4 — Race-Specific Preparation (weeks 11–12)

**Week 11 — 40 km**
- Day 1 — ER · 9 km · Z1
- Day 2 — Rest
- Day 3 — RP · ≈10 km (WU 2 + 4.8 km quality + 0.8 km recovery jog + CD 2 ≈ 9.6, rounded to 10) ·
  WU 2 km · 3 × 1600 m @ GP 4:00/km w/ ~400 m jog · CD 2 km
- Day 4 — Rest
- Day 5 — ER + Strides · 9 km + 4 × 30 s Strides @ GP · Z1, strides Z5
- Day 6 — LR · 12 km · Z1
- Day 7 — Rest

*Why this week:* the first session prescribed **at goal pace**, not current-fitness pace — ruling
3's convergence point. Reps run at 4:00/km because this is the race-specific phase; the same
session earlier in the plan would have used the current-fitness interval band instead (weeks 9–10
above). Recovery is generous (a ~400 m jog between reps, not a tight interval-style recovery) —
this session rehearses goal pace, it doesn't chase VO2 max. Volume drops 16.7% off week 10 while
intensity stays specific. Day 5's strides carry a `@ GP` pace reference, like week 12's, since this
is already the race-specific phase; the taper is left alone by ruling 7 — Day 1 stays strides-free
(see "Session sizing" above).

**Week 12 — Race week, 28 km**
- Day 1 — ER · 8 km · Z1
- Day 2 — Rest
- Day 3 — ER + Strides · 6 km + 4 × 20 s Strides @ GP
- Day 4 — Rest
- Day 5 — SR · 4 km · Z1 + 2 × 30 s Strides @ GP
- Day 6 — Rest
- Day 7 — **Race Day** · WU 3 km · 5 km race · CD 2 km

*Why this week:* nothing here builds fitness. Everything preserves it.

---

## Disclaimers *(load-rules.md Rule 10 — legally required)*

> This is not medical advice. Consult a doctor before starting any training program or if you
> experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. PACE
> provides coaching guidance, not medical diagnosis or treatment.

---

## Open — needs Ian

1. **Pace derivation. RESOLVED 2026-07-10 and implemented 2026-08-03
   (`paceDerivation.ts`).** Left here for history: this doc originally said the
   library could produce no numeric easy or tempo pace at all. Answered: cross-distance Riegel
   equivalency plus the source's own relative pace rules derive tempo, interval, and
   (intermediate-level) easy-pace bands from a recent performance; see "Pace bands" above for this
   runner's actual numbers. **Still open within this: no relative rule exists anywhere in the
   source for steady/Zone 2 pace** — `paceDerivation.ts` deliberately never returns one. (See Open
   item 5 — RESOLVED 2026-07-12 — for a related but separate question this cycle surfaced: what to
   do about the goal itself, not the pace derivation, when it looks implausible.)
2. **RESOLVED 2026-08-03.** `clampWeeklyVolume()` now takes an explicitly named
   `lastLoadingWeekKm` reference, so a deload week cannot be passed accidentally. Regression tests
   cover the golden week-5 and week-9 post-deload transitions.
3. **RESOLVED 2026-07-11 (ruling 3).** Ian: *"your goal is to run at your goal pace, might be
   slower in the beginning."* Early-plan interval sessions (weeks 9–10) run at this runner's
   current-fitness interval pace; race-pace-rep sessions in the race-specific phase (week 11) run
   at goal pace directly. This is the McMillan position, adopted because Ian is McMillan-certified;
   Daniels forbids goal-pace anchoring outright, and the early-plan moderation is this ruling's
   answer to that concern. **This supersedes the 2026-07-10 correction that had pinned the week-11
   session flat at current-fitness pace (270 s/km) — not deleted, superseded: see "Session sizing"
   above for the full reasoning.**
4. **RESOLVED 2026-07-12 (Ian's ruling, issue #34, rendered-plan review round 2).** Left here for
   history: `notation.md`'s run-type abbreviation table (`ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`)
   was built to match Ian's two given examples (`ER`, `TR`) and the 2026-07-11 market-research
   pass's notation findings, but was marked "proposed... pending his sign-off" — it had not been
   read back to Ian item by item. Answered: the full set is approved exactly as written, with
   Strides always spelled out and Race Day never abbreviated. Ian was shown, and accepted, the one
   known wrinkle — `RP` (a run-type label) and `GP` (the structure-string goal-pace symbol) are two
   codes for closely related ideas on two different layers, e.g. week 11's "RP · 3 × 1600 m @ GP" —
   and approved the set anyway. See `notation.md`.
5. **RESOLVED 2026-07-12 (goal-realism ruling —
   `docs/superpowers/specs/2026-07-12-goal-realism-design.md`).** Left here for history: the
   2026-07-10 R-A addendum's >10%-goal-improvement gate (decision 3) already only ever governed
   *race-pace session* targets, never everyday training paces — but `paceDerivation.test.ts` still
   applied it exactly as R-A specified it (pin to the recent-equivalent pace beyond 10%), which was
   the wrong call for a race-specific-phase `RP` session under ruling 3. That test was resynced to
   ruling 3's week-11 goal-pace prescription in cycle 2 — see the "Pace bands" cycle-2 note above.
   But the question the old gate was really standing in for stayed open: when a declared goal is
   implausibly faster than the runner's recent-equivalent performance (this runner's 11.1%
   improvement is exactly the case the old gate fired on), should the app warn at intake, cap the
   race-pace-rep target, or trust the goal outright? Ruling 3 answered *when* a session converges
   to goal pace across a plan; it did not answer what to do when the goal itself looks unrealistic.

   **Answered: two bands, not one.** Riegel-equivalent the recent performance to the goal distance,
   then measure the implied improvement (`(equivalentSec − goalTimeSec) / equivalentSec × 100`).
   **≤10%: `realistic`, silent** — the `RP` session anchors at the raw goal pace. **10%–15%:
   `ambitious`, warn — but `RP` still anchors at the raw goal pace**; ruling 3 holds even under a
   warning. **>15%: `implausible`, warn AND cap** — the `RP` anchor is pinned at the recent-
   equivalent improved by exactly 15%, not the declared goal pace. Boundaries are inclusive at the
   top of each band (10.0% is `realistic`, 15.0% is `ambitious`); the cap engages only strictly
   above 15%. Thresholds are flat: no scaling by age, experience, or plan length.

   For **this runner** (20:00 goal vs. 22:30 recent, 11.1% implied improvement): `ambitious`,
   warned, **not capped** — `RP` still anchors at 4:00/km, exactly ruling 3's week-11 prescription
   above, unchanged. The canonical fantasy that motivated this question — a 25:00 5K runner
   declaring a sub-3:00 marathon goal, 24.93% implied improvement — is `implausible`: capped to a
   3:23:49 equivalent (4:50/km), not the 4:16/km the sub-3 goal implies.

   **Both thresholds are Ian's own, not ported from the source.** `COMPLETENESS.md` lists "goal
   unrealistic for current fitness" under what the coaching library is missing (edge-case rules,
   item 8); no threshold exists anywhere in the source to check a declared goal against.

   One pure function, `assessGoalRealism()`, is shared by client and engine so the two can never
   disagree: the client shows the (advisory, non-blocking) warning at both goal-entry points —
   intake review and the configure modal, since goal time travels per-generation — and the engine
   calls the same function to cap the `RP` anchor and stamps the verdict onto the immutable plan
   (`Plan.goalRealism`), so the plan explains its own numbers forever. Training paces
   (easy/tempo/interval) are untouched by any of this, at any goal size.

   **Implemented 2026-08-03:** the shared types in `planTypes.ts`, the contract tests, and
   `src/lib/paceDerivation.ts` now all exist. `assessGoalRealism()` and
   `deriveRacePaceTarget()` use the exact ruled arithmetic and thresholds.
6. **RESOLVED 2026-07-12 (Ian's ruling, issue #34, rendered-plan review round 2).** Left here for
   history: `workout-library.md` § "Session sizing by race distance" re-scopes the Daniels
   10%-of-weekly-volume rule as advisory context, not an enforced constraint — this app's own
   golden plan violates it in every quality week (10% of this plan's 34–48 km weeks is 3.4–4.8 km,
   under the 4.0–5.0 km band this app enforces). Open question was whether the brake should
   override the band's floor for a genuinely low-volume runner. Answered: never — the brake is
   **permanently advisory**. The physiological demand of a 5K does not shrink because the runner
   trains less; a 5K runner gets 4.0–5.0 km of interval quality volume regardless of weekly volume,
   and the app knowingly accepts that this is a large share of a low-volume runner's week. See
   `workout-library.md` § "Session sizing by race distance."
7. **RESOLVED 2026-07-12 (Ian's ruling, issue #34, rendered-plan review round 2).** Left here for
   history: strides had been extended to one easy day per loading week (weeks 1, 2, 3, 5, 6, 7, 9,
   10, 11), sourced from the 2026-07-11 market-research report and the ported library's own
   optional-strides clause, but not read back to Ian item by item. Answered: strides go on **both**
   easy days of every loading week that has two easy days — weeks 1, 2, 3, 5, 6, 7 — moving further
   toward the source library's own 2–3×/week guidance. Weeks 9 and 10 have only one easy day each
   and keep their single strides day, unchanged. Week 11 is taper and stays as ruled: Day 1
   strides-free, only Day 5 keeps its goal-pace strides. Week 12 (race week) is unchanged. Deload
   weeks 4 and 8 stay strides-free. Strides add no headline distance, so no volume arithmetic
   changes anywhere in the plan. See "Session sizing" above.
