# ECHO Running Coach — Load Rules & Safety Protocols

**Non-Negotiable Coaching Safety Logic**

These rules are deterministic and absolute. They apply equally to all runners regardless of fitness level, goal, or preference. The AI coaching system must enforce these rules and never override them, even if a user requests it.

> 📎 **V2.2 SCOPE NOTE:** Rules 2 (RPE), 3 (resting HR), and the sleep-based adjustments in Rule 8 depend on ongoing logged data. V2.2 generates a plan once from an 8-field intake and does no logging, so the app cannot enforce them. They remain in force for Ian's live coaching business and for any future product with run logging — do not delete them.

---

## Rule 1: Weekly Volume Increase Cap

**MAXIMUM INCREASE:** 10-15% per week  
**Status:** Coaching convention

> 📌 **RULING (Ian, 2026-07-10):** The line above previously read "Verified: McMillan methodology, industry standard." The 10-15% figure stays, but the "verified" claim does not: Buist et al. 2008 (Am J Sports Med, RCT, 532 novice runners) found injury incidence of 20.8% under a 10%-rule graded program vs 20.3% without one (p=.90), and a 2022 systematic review covering 23,047 runners concluded the 10% rule "is not justified." The cap is retained as Ian's coaching convention, not as an evidence-verified injury-prevention threshold.

### Calculation

| Last Week | This Week Maximum |
|-----------|-------------------|
| 40 km | 44-46 km |
| 50 km | 55-57 km |
| 20 km | 22-23 km |

### Enforcement

The planning system must calculate proposed weekly km. If proposed total exceeds last week by more than 15%: **REJECT** and recalculate at 10% increase maximum.

### Long Run Cap (Corrected Data)

**Old rule (too conservative):** Long run = max 20% of weekly km

**Correct rule:**
- **Beginners:** Long run = max 20-25% of weekly km
- **Intermediate:** Long run = max 25-30% of weekly km
- **Advanced:** Long run = max 30% of weekly km

**Example (Intermediate, 50 km week):**
- Long run max = 50 × 0.30 = **15 km**

### Exception — Recovery Weeks

The increase cap applies to increases only — deload-week decreases are exempt from it. Deload weeks reduce volume by 35-45% (see Deload Trigger below).

> 📌 **RULING (Ian, 2026-07-10):** **Deload = 35-45% volume reduction. Authoritative everywhere.** This clause previously read "Volume can decrease by any amount during deload weeks... even 50% reduction is fine." The library carried four different deload numbers: 20-30% (Deload Trigger below, `training_zones.md` Deload Frequency, and `workout_library.md` Part 3's Standard Protocol), "any amount... even 50%" (this clause), "50% volume" (`ECHO_Training_Plans_McMillan.md` General Principles), and ~35-45% (`workout_library.md` Part 3's worked examples: ~40% beginner, ~45% intermediate, 35-40% advanced). Ian ruled the worked examples reflect his actual practice; 35-45% now governs in all files.
>
> ↩️ **Superseded 2026-09-06 by Ian's ruling:** down weeks are **15–25%** lower, not 35–45% — see `docs/reference/coaching/load-rules.md` § Deload trigger; the code's `DELOAD_REDUCTION_MIN`/`DELOAD_REDUCTION_MAX` (0.15/0.25) in `src/lib/loadRules.ts` are authoritative, and the annotation above is kept as history.

### Deload Trigger

Every 3-4 weeks, reduce volume 35-45%.

> 📌 **RULING (Ian, 2026-07-10):** Previously "reduce volume 20-30%." Reconciled to the authoritative 35-45% — see the ruling under "Exception — Recovery Weeks" above for the full history.
>
> ↩️ **Superseded 2026-09-06 by Ian's ruling:** down weeks are **15–25%** lower, not 35–45% — see `docs/reference/coaching/load-rules.md` § Deload trigger; the code's `DELOAD_REDUCTION_MIN`/`DELOAD_REDUCTION_MAX` (0.15/0.25) in `src/lib/loadRules.ts` are authoritative, and the annotation above is kept as history.

| Level | Frequency |
|-------|-----------|
| Beginner | Every 4 weeks |
| Intermediate | Every 3-4 weeks |
| Advanced | Every 3 weeks |
| 50+ runners | Every 3 weeks (mandatory) |

---

## Rule 2: RPE Fatigue Detection

**TRIGGER:** RPE greater than 8 on two consecutive runs  
**Action:** Soften the next planned session

### Protocol

**If Run 1 RPE = 9 AND Run 2 RPE = 8+:**
- Replace next hard session with Zone 1 easy run (30-40 min)
- Add optional rest day if available in schedule
- Flag user: 

> Your last two runs show high perceived effort. Your body is signaling fatigue. Today is an easy day. Hard training on a fatigued body does not build fitness — it builds injury risk.

### Single High RPE Session

- **RPE 9-10 on one run:** Note it. Monitor next run.
- **RPE 9-10 on next run too:** Trigger softening protocol above.

### Chronic High RPE (3+ sessions in a row at RPE 8+)

This signals overtraining or accumulated fatigue.

**Action:**
- Extend recovery week by 3-4 additional days
- Reduce next week volume to 50% of recent average
- Alert:

> Your training data shows consistent high effort ratings. This is a sign your body needs more recovery. We are adjusting your plan to protect your progress and prevent injury.

---

## Rule 3: Resting Heart Rate Spike Protocol

### Trigger: RHR 5+ bpm above 7-day baseline

**Action:** Replace scheduled hard session with easy run or rest

### Trigger: RHR 8-10+ bpm above baseline

**Action:** Full rest day. Do not run.

### What Resting HR Spike Means

- Possible early illness (most common)
- Overtraining accumulation
- Poor sleep (1-2 nights bad sleep elevates RHR)
- Life stress (cortisol elevates HR)

### Coaching Message to User

> Your resting heart rate this morning is elevated above your baseline. This is your body communicating that it needs recovery today. Hard training when RHR is elevated is counterproductive — the stimulus does not land the same. Today is a rest or easy day. This protects your training.

### Recovery Baseline Target

Resting HR should be less than 60 bpm for trained runners, or within 10-15 bpm of individual morning resting baseline after full recovery from hard sessions.

---

## Rule 4: Weekly Volume Safety Thresholds by Level

> 📌 **RULING (Ian, 2026-07-10):** Experience level is determined **primarily by current weekly volume** — ≤30 km/week = beginner, >30 and <70 km = intermediate, ≥70 km = advanced — with years running as a secondary signal. Where the two disagree, **volume wins**, and the app asks the runner to confirm. This also resolves a contradiction: `ECHO_Training_Plans_McMillan.md`'s Customization Guidelines previously defined Intermediate as "1-2 years" while this rule says "6 months - 3 years"; the years bands below stand as the secondary signal, and the Customization Guidelines have been aligned to them.

### Beginner (0-6 months running experience)

| Metric | Value |
|--------|-------|
| Maximum weekly km | 40 km |
| Maximum single run | 14 km |
| Hard sessions per week | Maximum 1 |
| Easy-to-hard ratio | 90% easy, 10% hard |
| Deload frequency | Every 4 weeks |

**Note:** Do not exceed 40 km until 6+ months consistent running.

### Intermediate (6 months - 3 years experience)

| Metric | Value |
|--------|-------|
| Maximum weekly km | 70 km |
| Maximum single run | 25 km |
| Hard sessions per week | Maximum 2 (48+ hours apart) |
| Easy-to-hard ratio | 80% easy, 20% hard |
| Deload frequency | Every 3-4 weeks |

**Note:** Do not exceed 70 km without adequate strength base.

### Advanced (3+ years, competitive focus)

| Metric | Value |
|--------|-------|
| Maximum weekly km | 110 km |
| Maximum single run | 35 km (marathon-specific only) |
| Hard sessions per week | Maximum 2-3 (structured spacing) |
| Easy-to-hard ratio | 75-80% easy, 20-25% hard |
| Deload frequency | Every 3 weeks |

**Note:** Requires adequate recovery infrastructure and strength training.

> ⚠️ **GAP — NEEDS IAN:** No ultra-distance content exists anywhere in the library, and this rule's ceilings (110 km/week maximum, 35 km longest run, "marathon-specific only") cannot express an ultra plan at all. Ultra support is planned for v2 of the app; before then, Ian needs to supply ultra volume ceilings, long-run rules (including back-to-back long runs), and time-on-feet guidance — nothing here can be extrapolated safely.

---

## Rule 5: Injury Red Flag Protocol

### Immediate Stop Triggers (Do Not Run)

🚩 Sharp, stabbing pain during a run  
🚩 Pain that causes limping or gait change  
🚩 Joint swelling visible after a run  
🚩 Pain that does not improve after 5 minutes of warm-up  
🚩 Any bone pain (shin, foot, hip — stress fracture risk)

### Reduce Volume Triggers

⚠️ Ache or soreness that persists more than 5 days  
⚠️ Pain that rates above 3/10 during easy running  
⚠️ Swelling that appears and does not resolve overnight  
⚠️ Pain that increases progressively during a run

### Monitoring Triggers

👁️ New muscular soreness in unfamiliar area  
👁️ Joint stiffness that takes more than 10 minutes to resolve  
👁️ Unusual fatigue in legs that persists 3+ days

### Coaching Responses

**Sharp Pain:**

> You reported sharp pain during your run. Do not run again until this resolves completely. Sharp pain during running is a signal to stop immediately. If pain persists beyond 48 hours or you have swelling, seek medical assessment before continuing training. This is not medical advice — consult a healthcare professional.

**Persistent Ache (5+ days):**

> Your reported soreness has persisted for 5+ days. This is beyond normal DOMS (which resolves in 2-3 days). We are reducing your training volume by 20% this week and adding mobility work to your plan. If this does not improve in 5-7 days, seek assessment from a sports physiotherapist. Do not push through persistent pain.

**Swelling Present:**

> Swelling after running indicates tissue stress or inflammation. We are reducing your volume 20% and replacing hard sessions with easy runs this week. Apply ice 15 minutes after runs. Elevate the affected area when resting. If swelling does not reduce within 3-4 days, seek medical clearance before continuing.

---

## Rule 6: Injury Pattern Detection

Detect from run history and respond proactively.

> ℹ️ **EVIDENCE NOTE (per Ian's 2026-07-10 cadence ruling — annotate, don't alter):** The knee and shin patterns below treat "cadence below 170 SPM" as an absolute injury cause. The evidence keys cadence intervention to a 5-10% increase above the runner's *own* baseline (Br J Sports Med 2022 step-rate meta-analysis), not to an absolute 170 floor — see the matching annotations in `training_zones.md` (Cadence Targets by Zone) and `ECHO_Framework_CORRECTED.md` Pillar 2, which already takes the individual-baseline position.

### Knee Pain

**Likely Causes:**
- Cadence below 170 SPM
- Weak glutes
- Mileage jump

**Coaching Response:**

> Knee pain often signals cadence issues or glute weakness. Check: is your cadence above 175 SPM? Are you doing prehab (glute bridges, lateral lunges, single-leg RDL)? Reduce volume 15% this week and add prehab daily.

### Shin Pain (Shin Splints)

**Likely Causes:**
- Cadence below 170 SPM
- Volume increase above 15%
- Hard running surface

**Coaching Response:**

> Shin discomfort is common with rapid mileage increases or low cadence. We are reducing volume 15% and checking cadence targets. Focus on midfoot landing, not heel strike. Avoid hard surfaces for 1-2 weeks.

### Plantar Fasciitis (Heel/Arch Pain)

**Likely Causes:**
- Tight calves
- Arch weakness
- Inadequate prehab

**Coaching Response:**

> Plantar fascia pain requires calf stretching daily (3 × 30 seconds each leg, morning), calf raises as prehab, and reduction of hard surface running. We are adjusting your plan. If pain is present on first morning steps, seek professional assessment.

### IT Band Syndrome (Outer Knee Pain)

**Likely Causes:**
- Hip abductor weakness
- Tight hips
- Downhill running

**Coaching Response:**

> IT band issues signal hip strength gaps. Adding lateral lunges and clamshells to your prehab. Avoid downhill running for 2 weeks. Foam roll the outer thigh daily.

### Achilles (Back of Heel / Lower Calf)

**Likely Causes:**
- Rapid increase in speed work
- Tight calves

**Coaching Response:**

> Achilles sensitivity requires immediate volume reduction. No speed work for 2 weeks. Eccentric calf raises daily. If pain is more than 3/10 during runs, stop and seek physiotherapy assessment. Achilles injuries worsen quickly if pushed through.

---

## Rule 7: Illness Protocol

### Fever (Any temperature above normal)

- ✋ **Complete rest** until fever is gone **PLUS 3 additional days**
- Do NOT run while feverish (cardiac risk, worsened recovery)
- **Return to running:** 50% volume Week 1 back

### Upper Respiratory (Cold, Congestion, Sore Throat — No Fever)

- Can run at **50% intensity** if symptoms are mild
- **Zone 1 only** — no hard efforts
- If symptoms worsen after running: rest
- **Rule:** "Neck check"
  - Symptoms above neck only = light running OK
  - Symptoms below neck (chest, body aches) = rest

### Lower Respiratory (Bronchitis, Chest Infection)

- ✋ Do NOT run
- Rest 1-2 weeks minimum
- Require medical clearance before returning

### Stomach Illness (Vomiting, Diarrhea)

- Do NOT run until 24 hours symptom-free
- Hydration is priority
- Return to easy running only

### Post-Illness Return

| Week | Volume | Intensity |
|------|--------|-----------|
| 1 | 50% of normal | Zone 1 only |
| 2 | 75% of normal | Zone 1 + Zone 2 only |
| 3+ | Full volume | Normal intensity |

---

## Rule 8: Sleep Safety Protocol

### Sleep Targets

| Level | Hours |
|-------|-------|
| Beginner | 7-8 hours minimum |
| Intermediate | 8-9 hours (non-negotiable for adaptation) |
| Advanced | 8-10 hours (some require more at high volume) |
| High-intensity training blocks | +30-60 min above normal |

### Sleep Debt Consequences

| Sleep Level | Consequence |
|-------------|-------------|
| < 7 hours average | Injury risk increases 60% |
| < 6 hours average | Training adaptation STOPS entirely |

⚠️ **Critical:** Less than 6 hours = training stress without recovery = net negative effect

> ℹ️ **EVIDENCE NOTE (per Ian's 2026-07-10 ruling — annotate, don't alter):** The figures in the table above appear to derive from Milewski et al. 2014 (J Pediatr Orthop), which found injury risk increased ~70% below **8 hours** of sleep — in **adolescent athletes**, not adults. The "<6 hours: adaptation STOPS entirely" cliff has no identifiable source. The direction (short sleep → higher injury risk, worse adaptation) is well supported; the specific thresholds and percentages as stated are misattributed. Treat the table as directional guidance, not as sourced clinical thresholds.

### Sleep-Based Plan Adjustment

**If user reports less than 6 hours sleep:**

- Reduce next session by 30-50%
- Do NOT schedule hard session on back-to-back poor sleep nights
- Message:

> Sleep is where training adaptation happens. Without adequate sleep, hard training builds fatigue, not fitness. Today is a lighter session to respect your body's signals.

---

## Rule 9: High Altitude Adjustment

### First 3-5 Days at Altitude

- Reduce intensity by 20%, volume by 20%
- HR will be higher at same pace — this is normal

### Days 6-10

- Normal training (body adapts)

### Days 11+

- Benefit window (improved oxygen-carrying capacity)
- If returning to sea level after 10+ days at altitude: expect improved VO2 max and performance for 2-3 weeks

---

## Rule 10: Non-Negotiable Disclaimers

### General Coaching Output Disclaimer

**Must include in every AI coaching output:**

> This is not medical advice. Consult a doctor before starting any training program or if you experience pain, persistent soreness, dizziness, chest discomfort, or any health concern. ECHO provides coaching guidance, not medical diagnosis or treatment.

### Injury-Related Output Disclaimer

**Must include in all injury flag alerts, high RPE warnings, and health guidance:**

> If you are experiencing significant pain, swelling, or symptoms that concern you, please seek assessment from a qualified sports medicine professional or physiotherapist before continuing training.

### Compliance Notes

- These disclaimers are **legally required** and **non-negotiable**
- They must appear in **all injury flag alerts**
- They must appear in **all high RPE warnings**
- They must appear in **any response involving health guidance**
- Non-compliance is a liability risk

---

**Last Updated:** 2026  
**Status:** Active - All Rules Enforced  
**Responsibility:** AI Coaching System + User Interface
