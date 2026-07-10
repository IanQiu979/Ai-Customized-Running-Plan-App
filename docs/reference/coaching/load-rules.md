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

*(load_rules.md § Rule 1 › Long Run Cap (Corrected Data))*

| Level | Long-run cap |
|---|---|
| Beginner | 20–25% of weekly km |
| Intermediate | 25–30% of weekly km |
| Advanced | 30% of weekly km |

Example: intermediate runner, 50 km week → long-run max = 50 × 0.30 = **15 km**.

### Deload trigger

*(load_rules.md § Rule 1 › Deload Trigger)*

| Level | Frequency |
|---|---|
| Beginner | Every 4 weeks |
| Intermediate | Every 3–4 weeks |
| Advanced | Every 3 weeks |
| 50+ runners | Every 3 weeks (mandatory) |

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

### Monitoring triggers

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
