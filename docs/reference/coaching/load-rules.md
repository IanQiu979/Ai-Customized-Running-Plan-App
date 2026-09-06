# Load Rules — Deterministic Safety Arithmetic

Ported subset of `load_rules.md`. These rules are deterministic and absolute — the engine
enforces them in typed code, and they clamp AI output for paid tiers; a model must not be able to
prescribe an unsafe week (`CLAUDE.md` "Coaching domain"). Rule numbers below match the source
file's numbering where a rule is a direct port; two new rules (not in the source) are labeled as
PACE additions. See [`00-README.md`](00-README.md) for what's not ported and why.

## Rule 1: Weekly Volume Increase Cap

**Maximum increase: 10–15% per week** — relabeled **"coaching convention,"** not "verified."
`load_rules.md § Rule 1` originally labels this "Verified: McMillan methodology, industry
standard." That label doesn't survive the port: Buist et al. 2008 (*Am J Sports Med*, RCT, 532
novices) found injury incidence 20.8% under a 10%-rule graded program vs. 20.3% without (p = .90)
— no measurable effect — and a 2022 systematic review (23,047 runners) concluded the rule "is not
justified." The cap stays in the engine as prudent practice; it is not evidence of injury
prevention.

| Last week | This week maximum |
|---|---|
| 40 km | 44–46 km |
| 50 km | 55–57 km |
| 20 km | 22–23 km |

**Enforcement** *(load_rules.md § Rule 1 › Enforcement)*: calculate the proposed weekly km; if it
exceeds last week's total by more than 15%, reject it and recalculate at a 10% increase.

### Long-run cap, by level

*(load_rules.md § Rule 1 › Long Run Cap (Corrected Data), overridden — see below)*

**Ian's ruling, 2026-07-12 (issue #34, rendered-plan review round 2).** Resolves the conflict
logged as issue #19, where 9 of the golden 5K plan's 11 long runs breached the 30% cap.

**Follow-up ruling R1c, 2026-07-12 (issue #34 code review — corrects the wording that stood here
briefly the same day).** Ian's initial pass at this ruling said deload weeks were "exempt" from
the cap. A code review of that same change flagged it as a HIGH-severity hole: exempting the week
removes the ceiling outright, and `Week.isDeload` is a field the AI model itself emits on paid
tiers, so an exemption keyed to it would hand the model a switch that turns off its own safety
cap — exactly what `CLAUDE.md` forbids ("a model must not be able to prescribe an unsafe week").
Corrected the same day:

**The cap is never removed for a deload week. It is measured against the last *loading* week's
volume instead of the deload week's own (reduced) total.** Ian's reasoning: a deload cuts the
week's total while largely preserving the long run, so measuring the long run's share against
that shrunken total measures the wrong thing — measure it against the right thing, not against
nothing. A deload long run remains bound by every other ceiling exactly as before: the 1.10x
long-run spike cap above, the absolute single-run cap (Rule 4), and the Daniels 3-hour long-run
time cap above.

**A week that claims to be a deload but is not actually 15–25% down off the last loading week is
not treated as one — it is capped as an ordinary loading week**, against its own volume. This
makes an unsubstantiated deload claim worthless as a way to loosen the cap.

**The per-level cap ladder is raised and made monotonic — unchanged by R1c:**

| Level | Long-run cap |
|---|---|
| Beginner | 25% of weekly km |
| Intermediate | 32% of weekly km |
| Advanced | 35% of weekly km |

**This is a deliberate, Ian-authorised departure from the source library's 20–25% / 25–30% / 30%
figures — an override, not a port.** Ian chose 35% for advanced explicitly so that intermediate's
32% could never exceed it. Do not "correct" this back toward the source in a future session.

Example: intermediate runner, 50 km loading week → long-run max = 50 × 0.32 = **16 km**. A deload
week that follows that 50 km loading week caps its own long run the same way — against that
50 km, not against the deload week's own reduced total.

With this ladder and R1c's corrected measurement, the golden 5K plan (`example-plan-5k-pro.md`)
now passes comfortably: week 4's 8 km long run is 21.1% of week 3's 38 km (the last loading
week), and week 8's 10 km long run is 20.8% of week 7's 48 km — both far under the 32%
intermediate cap. Since 2026-08-03 the generator itself enforces this: `buildCanonicalFiveKWeek`
routes every long run through `clampLongRun()` and scales quality-session distances to the
runner's volume, so the cap holds at any baseline, not just the fixture's 35 km (a 27 km/week
runner previously saw long runs at 34.6-35.5% of the week).

**Cross-reference:** R1c is conceptually the same correction as open issue #22
(`clampWeeklyVolume()` should compare a proposed week's total against the last loading week, not
literally the previous week) — the two rules now agree that "the last loading week" is the
correct reference point for anything measured across a deload boundary. Issue #22 itself governs
a different function (the weekly-volume increase cap, not the long-run share cap) and remains
open; it is not resolved by this ruling.

**Ian's ruling, 2026-09-05 (core-purpose audit §1.2, issue `longrun-share-cap-floor`) — the cap
scales with run count on every path except the golden fixture.** The audit found the table above
enforced only inside `buildCanonicalFiveKWeek`; `buildGenericWeek` — every 10K, half, marathon and
general-fitness plan — never called `clampLongRun()` at all, so long runs at 53–86% of weekly
volume shipped unclamped. Fixing that call surfaced a second, deeper problem: the flat table above
is arithmetically impossible at low run counts. An `n`-run week is `n` positive numbers summing to
a whole, so its largest entry is never below `1/n` — 33% at 3 runs/week, already over every level's
flat cap. Every beginner and 3-day profile in the audit's own regression suite breached the cap on
every single loading week as a direct result, independent of the wiring bug.

Ian's ruling: **the cap wins, unconditionally** — the long run is capped even if that puts it below
a quality session that week (an earlier, incomplete fix instead floored the long run at that
session's length, which is why the cap stayed unreachable for exactly the plans the audit flagged).
Losing "long run = week's longest run" as an absolute is the accepted cost; `notation.md`'s LR row
and `planTemplates.ts`'s `LONG_DESCRIPTION` are both edited to stop claiming it. **And the table
above is a special case of a run-count-scaled ladder, not the whole rule**: "a 3-day week
legitimately carries a larger share than a 6-day week; that is normal training, not a breach." The
table's three numbers remain the cap at the reference 4-run week (unchanged, still what
`buildCanonicalFiveKWeek` uses); `src/lib/loadRules.ts`'s `longRunShareCap(level, runCount)` scales
them by run count for every other path — see that function's own comment for the exact formula
and the reasoning behind beginner's single small adjustment (its flat cap sat exactly on the
reachability boundary at every run count, not just at 3).

Explicitly declined in the same ruling: shrinking that week's quality session to keep the long run
on top instead. That changes the training stimulus the captain designed, which was not this
decision's call to make.

**Before / after, the audit's own cited breaches** (the audit measured a deload's long run against
that week's own, deliberately-reduced volume; the figures below use R1c's actual measurement — the
last *loading* week — which is what `clampLongRun()` enforces): profile B (marathon, 50 km/wk,
intermediate, 5 runs/week) week 8 deload was reported at 20/25 km = 80% of its own volume, now
10/41 km = 24.4% of the last loading week against a 25.6% cap; profile K (marathon, 60 km/wk, same
level/frequency) week 8 was 24/30 = 80%, now 12/50 km = 24.0% against 25.6%; profile C (half,
80 km/wk, advanced, 6 runs/week) week 6 was 30/35 = 86%, now 13/58 km = 22.4% against a 23.3% cap;
week 9 was 32/41 = 78%, now 16/69 km = 23.2% against 23.3%. Every profile in the regression suite
(`planTemplates.genericLongRun.test.ts`) — not just these four — now holds inside its scaled cap on
every loading and deload week.

**Ian's ruling, 2026-09-07 (`v22-distance-specific-plans`,
`[key=marathon-longrun-share-cap]`) — an intermediate or advanced marathon long run is capped at
35% of the generated loading-week denominator.** On an ordinary loading week that denominator is
the rendered week volume. On a valid 15–25% deload it remains the last loading week's volume under
R1c above, not the deload's own reduced total. Therefore a displayed deload-week ratio can exceed
35% without breaching the rule; the enforced comparison uses the last loading week.

The distance-specific curve fix surfaced that the run-count-scaled ladder above — and
`MAX_SINGLE_RUN_KM`'s flat 25/35 km ceiling below — were calibrated without marathon-length long
runs in mind and became wrongly tight at common marathon training frequencies. Before the
distance-specific override, the 50 km/week, 16-week intermediate survey peaked at 25/19/16/8 km
for 3/4/5/6 running days. A temporary `Infinity` engineering stage produced 28 km at every
frequency while the decision was open; that was plumbing validation, never the final policy.

Two options were rejected outright: raising the general intermediate/advanced ceilings (which
would let a 5K runner take a marathon-sized share) and accepting the old ladder as marathon's real
limit (which was most restrictive at the common 5–6-day frequencies). The research correctly
identified the share percentage as coaching policy rather than settled science; Ian supplied the
35% policy instead of the implementation inventing it.

`longRunShareCap()` and `maxSingleRunKm()` (`src/lib/loadRules.ts`) both take `raceDistance`, but
their marathon outcomes are now deliberately different. For intermediate/advanced race plans,
`MARATHON_LONG_RUN_SHARE_CAP` is **0.35 and binding**. The separate absolute kilometre ceiling is
still `Infinity` (non-binding) pending Ian's calibration. `beginner` is excluded from both
marathon overrides: it keeps the existing 14 km absolute ceiling and run-count-scaled share
ladder, preserving the first-timer completion track. The unchanged 180-minute duration cap and
1.10× recent-longest-run spike guard remain active for every marathon plan alongside the share
cap. McMillan's occasional four-hour marathon allowance remains a separate captain-owned question;
this ruling does not change V2.2's three-hour limit.

**Generated survey, 50 km/week, 16 weeks, intermediate, recent half-marathon performance:**

| Days/week | Old level/run-count cap | Temporary `Infinity` stage | Final 35% share cap |
|---|---:|---:|---:|
| 3 | 25 km | 28 km | **11 km** |
| 4 | 19 km | 28 km | **24 km** |
| 5 | 16 km | 28 km | **24 km** |
| 6 | 8 km | 28 km | **24 km** |

Four days is the headline case: **24 km**, versus 19 km under the old stretched-5K behavior (and
the core-purpose audit's approximately 21 km observation). At three days, the sourced E + Q1 + LR
layout and fixed Q1 dose leave no additional easy-support slot; enforcing 35% against the rendered
week reaches an 11 km fixed point. The plan exposes that limitation in its disclaimers and
recommends a fourth running day rather than pretending this is full marathon preparation. The
source-corrected adaptation keeps Q1 and drops Q2 before easy support at both three and four days;
Q2 may be retained only at five or more running days.

**Structural caveat not solved by the 35% ruling.** The long-run curves still carry recovery dips
at fixed array positions. Those positions do not realign with `deloadEveryWeeks` (three weeks for
advanced and for 50+, four otherwise) when `interpolateCanonical` resamples a curve onto a
noncanonical duration. The cap fixes the magnitude of an overlarge long run, but a relatively
long run can still land in a week labelled as recovery. Valid deloads use the last loading week's
denominator under R1c, so this structural issue must not be audited by requiring every displayed
deload-week ratio to be at or below 35%.

### Deload trigger

*(load_rules.md § Rule 1 › Deload Trigger)*

| Level | Frequency |
|---|---|
| Beginner | Every 4 weeks |
| Intermediate | Every 3–4 weeks |
| Advanced | Every 3 weeks |
| 50+ runners | Every 3 weeks (mandatory) |

**Experience drives the cadence (Ian's ruling, 2026-08-03 — "pro runners = 3 weeks, beginners =
4").** The engine resolves this table to exactly one number per level: `advanced` (the
`competitive` intake answer) deloads every 3 weeks; `beginner` (`new`/`some`) every 4. The ruling
also settles the source's open beginner-cadence gap — `workout_library.md` § Deload Frequency by
Runner Type flagged beginner at "every 4–5 weeks" against this table's 4; Ian's ruling picks 4.
`intermediate` is not addressed by the ruling and stays at 4, inside its source range of 3–4.
The 50+ row wins over every level: a 50+ runner of any experience gets the mandatory 3-week
cadence. `deloadEveryWeeks()` in `src/lib/loadRules.ts` is the single implementation of this
composition; `planTemplates.ts` calls through it.

**Golden 12-week 5K path exception for 50+ (captain ruling, `fifty-plus-golden-deload-weeks`,
2026-08-06):** on this one specific path (`buildCanonicalFiveKWeek` in `planTemplates.ts`), a
50+ runner's deload weeks are **4, 8 and 12** — not the generic every-3-weeks modulo (which would
land on 3, 6, 9 and drop off the plan by week 9). This aligns with the natural volume dips
`FIVE_K_WEEKLY_LOAD` already carries at weeks 4 and 8, and additionally flags week 12 — the race
week — as a deload for 50+ runners specifically, on top of its existing taper/race structure. The
generic (non-golden) path is unaffected and still uses the every-3-weeks modulo above.

**Reduction: 15–25% of volume** during a deload week — authoritative (**Ian's ruling, 2026-09-06,
superseding the 35–45% figure below**).

**What changed and why.** The number in this section was **35–45%, targeting 40%**, from 2026-07-10
until 2026-09-06. The V2.2 distance-specific-plans research (`report-source.md`) surfaced that
McMillan's own public marathon guide recommends a down week every third or fourth week at roughly
**15–25%** lower load — directly conflicting with the imported-examples figure below. Ian was asked
to pick rather than have the conflict resolved silently, and on 2026-09-06 he chose the published
McMillan figure over his own earlier ruling: **use 15–25%, targeting 20%,** everywhere in the
engine. This is a deliberate reversal, not drift — a future reader should not assume the 2026-07-10
reasoning below still holds; it is kept for history, not as the current rule.

Why the *old* number had been chosen (2026-07-10, superseding an earlier 20–30% call the same day):
the source disagreed with itself three ways — the Deload Trigger table said 20–30%; the separate
"Exception — Recovery Weeks" clause (`load_rules.md § Rule 1`) said volume "can decrease by any
amount… even 50% reduction is fine"; and `workout_library.md`'s own three worked deload examples
reduced by ~40% (beginner), ~45% (intermediate), and ~35–40% (advanced). Ian ruled at the time that
the worked examples reflected what he actually did. 35–45% sat inside the Exception clause and
matched all three examples, so it reconciled the source rather than contradicting it.

The fact-check found no direct RCT evidence for *any* specific deload magnitude — it is coaching
convention either way, which is why the coach's own choice is the tiebreak, then and now.

The engine enforces a band with both a floor and a ceiling, not a "no minimum" allowance:
`isValidDeload()` in `src/lib/loadRules.ts` accepts a reduction in `[0.15, 0.25]` and rejects
anything shallower or deeper. Generation uses the 20% midpoint.

**Known interaction with the long-run cap work (flagged per the captain's instruction, not quietly
reconciled):** `clampLongRun()`'s weekly-share ceiling measures a deload week's long run against the
*last loading week's* volume, but only when `isValidDeload(lastLoadingWeekKm, weeklyKm)` agrees the
week is a genuine deload under the currently-configured band (R1c, 2026-07-12, issue #34). The
byte-pinned golden 12-week/4-day 5K fixture (`example-plan-5k-pro.md`, `FIVE_K_WEEKLY_LOAD` /
`FIVE_K_LONG_RUNS` in `src/lib/planTemplates.ts`) has its own literal, separately-approved dip at
weeks 4 and 8 — roughly **37–40%** off the prior loading week. That figure was authored years before
this ruling and was never itself a `deloadVolume()` output, so tightening the band to 15–25% does
not change the fixture's literal weekly-volume numbers, but it **does** flip `isValidDeload()` to
`false` for those two weeks (37–40% no longer qualifies as "a genuine deload" under the new
narrower band), which flips `clampLongRun()`'s denominator from the prior loading week back to the
deload week's own (smaller) volume — tightening the share ceiling and shrinking the golden fixture's
weeks 4/8 long runs by one kilometre each (8→7, 10→9). This is two coaching rules disagreeing, not a
bug: the golden fixture's own dip depth was never brought into line with this ruling (that would be
a separate, explicit edit to `example-plan-5k-pro.md`'s content, which nothing here authorizes), so
it now reads as "not a real deload" by the newly-tightened definition purely because it dips deeper
than the new 25% ceiling allows. The golden fixture's test expectations were updated to the new,
correctly-computed numbers rather than left pinned to pre-ruling output; the fixture's own
`FIVE_K_WEEKLY_LOAD`/`FIVE_K_LONG_RUNS` values were left untouched.

**Still an error, not an alternative:** the 5K example plan's Week 4 is labelled a deload while its
volume *rises* (~17–19 km → ~18–19 km). See `plan-structure.md`.

## New rule (PACE addition): Long-Run Spike Cap

Not in the source. Added because V2.2 generates every week of the plan itself, which makes this
fully deterministic in a way it couldn't be for a training log:

**No long run may exceed the plan's own previous longest long run by more than 10%.**

Evidence: a 2025 BJSM cohort (5,205 runners, 588,071 sessions) found *weekly* volume change was a
poor injury predictor, while a *single run* exceeding ~10% of the runner's longest run in the
prior 30 days raised overuse-injury rates. Nielsen 2014 (*JOSPT*, 874 novices) separately found
>30% progression over two weeks is the risky band for total load. This cap targets the single-run
spike specifically, in addition to — not instead of — Rule 1's weekly-total cap and the long-run
percentage cap above.

**Enforcement**: same reject/recalculate pattern as Rule 1 — if a proposed long run exceeds
1.10 × the longest long run generated so far in this plan, clamp it to that ceiling.

## New rule (PACE addition): Long-Run Time Cap

Not in the source; added per Ian ("the source omits it"). Alongside the percentage-of-weekly-volume
cap above, a long run should not exceed **~2.5–3 hours**, regardless of what percentage of weekly
volume it represents (Daniels). This matters once a plan is far enough into a build phase that a
percentage-based cap alone would push a long run past what's sustainable in a single session (an
advanced marathon block, for example).

**Enforcement**: convert the long run's planned distance to an estimated duration using the
runner's easy pace; clamp to 3 hours regardless of what the percentage caps above would otherwise
allow.

## Rule 4: Weekly Volume Safety Thresholds by Level

*(load_rules.md § Rule 4, ported verbatim)*

### Beginner (0–6 months running experience)

| Metric | Value |
|---|---|
| Maximum weekly km | 40 km |
| Maximum single run | 14 km |
| Hard sessions per week | Max 1 |
| Easy-to-hard ratio | 90% easy, 10% hard |
| Deload frequency | Every 4 weeks |

Do not exceed 40 km until 6+ months of consistent running.

### Intermediate (6 months – 3 years experience)

| Metric | Value |
|---|---|
| Maximum weekly km | 70 km |
| Maximum single run | 25 km |
| Hard sessions per week | Max 2 (48+ hours apart) |
| Easy-to-hard ratio | 80% easy, 20% hard |
| Deload frequency | Every 3–4 weeks |

Do not exceed 70 km without an adequate strength base.

### Advanced (3+ years, competitive focus)

| Metric | Value |
|---|---|
| Maximum weekly km | 110 km |
| Maximum single run | 35 km (marathon-specific only) |
| Hard sessions per week | Max 2–3 (structured spacing) |
| Easy-to-hard ratio | 75–80% easy, 20–25% hard |
| Deload frequency | Every 3 weeks |

The source adds "requires adequate recovery infrastructure and strength training" here — moot for
V2.2 since plans are running-only (Ian's decision, see `00-README.md`); noted only because it's in
the source.

## Rule 5: Injury Red Flag Protocol — the declared-symptom subset

*(load_rules.md § Rule 5)*. The source writes these as things a runner reports **during or right
after a run** — but V2.2 never observes a run happen; it only has whatever the runner declared
once, at signup, in the intake's `injuries` field. The port keeps the trigger vocabulary and the
coaching responses, but the *mechanism* changes: these become an **intake-time triage**, not a
per-run monitor. If a declared symptom matches an Immediate Stop trigger, the app does not
generate a normal training plan at all — see the design rule in `plan-structure.md` and the
return-to-running protocol in `injury-rules.md`. (The exact intake field format needed to do this
matching is `NOT SPECIFIED IN SOURCE — needs Ian`; see `00-README.md`.)

**Only the Immediate Stop and Reduce Volume tiers below are surfaced or actioned at intake (Ian's
ruling, 2026-07-12 — issue #34, rendered-plan review round 2).** The Monitoring tier is dropped
from intake entirely — see the "Monitoring triggers" heading below for why.

### Immediate stop triggers (do not run)

- Sharp, stabbing pain during a run
- Pain that causes limping or gait change
- Joint swelling visible after a run
- Pain that does not improve after 5 minutes of warm-up
- Any bone pain (shin, foot, hip — stress fracture risk)

### Reduce volume triggers

- Ache or soreness that persists more than 5 days
- Pain that rates above 3/10 during easy running
- Swelling that appears and does not resolve overnight
- Pain that increases progressively during a run

### Monitoring triggers — documented, NOT used by V2.2 (Ian's ruling, 2026-07-12)

Kept here as source content, for the record — not deleted — but **not surfaced or actioned at
intake.** Ian's reasoning: all three triggers describe something a runner notices *during or after
a run*. V2.2 never observes a run — it meets the runner exactly once, at signup — so a monitoring
flag it can never monitor is a flag that does nothing, and surfacing it at intake would invite a
self-report the runner has no basis to make before running a single session on the plan. Resolves
`00-README.md`'s "Open gaps" question of the same name.

- New muscular soreness in an unfamiliar area
- Joint stiffness that takes more than 10 minutes to resolve
- Unusual fatigue in the legs that persists 3+ days

### Coaching responses

*(load_rules.md § Rule 5 › Coaching Responses)*

> **Sharp pain:** You reported sharp pain during your run. Do not run again until this resolves
> completely. Sharp pain during running is a signal to stop immediately. If pain persists beyond
> 48 hours or you have swelling, seek medical assessment before continuing training. This is not
> medical advice — consult a healthcare professional.

> **Persistent ache (5+ days):** Your reported soreness has persisted for 5+ days. This is beyond
> normal DOMS (which resolves in 2-3 days). We are reducing your training volume by 20% this
> week. If this does not improve in 5-7 days, seek assessment from a sports physiotherapist. Do
> not push through persistent pain.

> **Swelling present:** Swelling after running indicates tissue stress or inflammation. We are
> reducing your volume 20% and replacing hard sessions with easy runs this week. If swelling does
> not reduce within 3-4 days, seek medical clearance before continuing.

(The source's mobility-work, ice/elevate, and prehab-adjacent lines are trimmed from the
"Persistent Ache" and "Swelling" responses above — those are self-care actions or prehab
suggestions, both out of scope here; the pain-threshold guidance and volume-reduction percentages
are kept as the actionable plan-generation content.)

### Per-flag volume reduction (closed-set `InjuryFlag`, added 2026-08-03)

The closed `InjuryFlag` set (`src/lib/planTypes.ts`) is a body-location picker, not the symptom
vocabulary above — `knee`, `ankle_achilles`, `shin_splints`, `it_band`, `hip_glute`, `lower_back`,
`plantar_arch` (added 2026-08-03, captain ruling — resolves the plan-accuracy scout's mandated
finding B), `none`. A declared flag applies a one-time "this week" volume cut to the plan's first
generated week, sourced per flag from `injury_flags.md` Part 1's pattern-specific coaching
response where one gives a body-specific figure:

| Flag | Reduction | Source |
|---|---|---|
| `knee` | 15% | `injury_flags.md:29`, `load_rules.md:206` |
| `shin_splints` | 15% | `injury_flags.md:49`, `load_rules.md:217` |
| `plantar_arch` | 20% | `injury_flags.md:69` |
| `ankle_achilles` | 20% (fallback) | `injury_flags.md:109` gives no volume figure ("immediate volume reduction" only); falls back to the generic Reduce Volume tier below |
| `it_band` | 20% (fallback) | `injury_flags.md:89` gives "reduce hard sessions by 50%" — a session-count metric, not a weekly-volume one; falls back to the generic tier |
| `hip_glute` | 20% (fallback) | no dedicated pattern in the source; generic tier |
| `lower_back` | 20% (fallback) | no dedicated pattern in the source; generic tier |

The four fallback rows use this section's own generic "Reduce Volume Triggers" figure (20%,
`load_rules.md:185,189`) rather than an invented number. Multiple declared flags combine at the
largest reduction, not additively — an engine-combination choice, not a sourced coaching number.
Implementation: `src/lib/loadRules.ts`'s `INJURY_VOLUME_REDUCTION_PCT`,
`injuryVolumeReductionPct()`.

**Red-flag: strengthened disclaimer, and its own volume rule.** `ankle_achilles` is, today, the
closed set's one member the 2026-08-03 captain ruling treats as red-flag for disclaimer purposes
(`src/lib/loadRules.ts`'s `RED_FLAG_INJURIES`) — an interpretive judgment call, since the source
never literally labels a body-location pattern "RED FLAG" (that label appears only on the
stress-fracture/bone-pain pattern and the female-athlete-triad pattern, neither of which the
closed set has an equivalent flag for). Achilles is the one pattern here carrying the source's
"(HIGH PRIORITY)" label and an explicit stop-and-rest branch (`injury_flags.md:107-109`). Flagged
for captain review, not a settled taxonomy — see `plan-structure.md`'s "Design rule" section for
the full ruling this implements. **A red-flag declaration no longer uses the per-flag table
above** for its volume cut: a superseding ruling (`red-flag-injury-plan-shape`, 2026-08-06) gives
it its own flat 15% reduction applied to every week of the plan, not just the first — see
`src/lib/loadRules.ts`'s `RED_FLAG_VOLUME_REDUCTION_PCT` and `plan-structure.md`.

## Rule 10: Non-Negotiable Disclaimers

*(load_rules.md § Rule 10 — legally required, non-negotiable)*

**General coaching output disclaimer** — must appear in every AI coaching output:

> This is not medical advice. Consult a doctor before starting any training program or if you
> experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. PACE
> provides coaching guidance, not medical diagnosis or treatment.

**Injury-related output disclaimer** — must appear in all injury flag alerts and health guidance:

> If you are experiencing significant pain, swelling, or symptoms that concern you, please seek
> assessment from a qualified sports medicine professional or physiotherapist before continuing
> training.

Compliance notes from the source: these disclaimers must appear in all injury flag alerts and any
response involving health guidance; non-compliance is a liability risk. (*Where* in the UI they
render is a product decision, not specified in the source — see `00-README.md`.)

**Wired 2026-08-03.** The plan-accuracy scout found this exact string existed nowhere in the
codebase despite a declared knee injury. `src/lib/planTemplates.ts` now attaches it to
`Plan.disclaimers` whenever `intake.injuries` is not `['none']` (`hasDeclaredInjury()`,
`src/lib/loadRules.ts`), alongside the general disclaimer that's always present.

## Not ported from `load_rules.md`

Rule 2 (RPE fatigue detection), Rule 3 (resting-HR spike), Rule 6 (injury pattern detection from
logs), Rules 7–9 (illness, sleep, altitude) — each needs ongoing data V2.2 never collects. Full
reasoning in [`00-README.md`](00-README.md).
