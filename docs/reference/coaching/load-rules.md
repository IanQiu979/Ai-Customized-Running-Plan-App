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

**A week that claims to be a deload but is not actually 35–45% down off the last loading week is
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

**Reduction: 35–45% of volume** during a deload week — authoritative (Ian's decision, 2026-07-10,
**superseding an earlier 20–30% call the same day**).

Why the change. The source disagrees with itself three ways: the Deload Trigger table says 20–30%;
the separate "Exception — Recovery Weeks" clause (`load_rules.md § Rule 1`) says volume "can
decrease by any amount… even 50% reduction is fine"; and `workout_library.md`'s own three worked
deload examples reduce by ~40% (beginner), ~45% (intermediate), and ~35–40% (advanced). Ian ruled
that the worked examples reflect what he actually does. 35–45% sits inside the Exception clause and
matches all three examples, so it reconciles the source rather than contradicting it.

The fact-check found no direct RCT evidence for *any* specific deload magnitude — it is coaching
convention either way, which is why the coach's own practice is the tiebreak.

The engine enforces a band with both a floor and a ceiling, not a "no minimum" allowance:
`isValidDeload()` in `src/lib/loadRules.ts` accepts a reduction in `[0.35, 0.45]` and rejects
anything shallower or deeper. Generation uses the 40% midpoint.

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

## Not ported from `load_rules.md`

Rule 2 (RPE fatigue detection), Rule 3 (resting-HR spike), Rule 6 (injury pattern detection from
logs), Rules 7–9 (illness, sleep, altitude) — each needs ongoing data V2.2 never collects. Full
reasoning in [`00-README.md`](00-README.md).
