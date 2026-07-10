# ECHO Running Coach — Load Rules & Safety Protocols

**Non-Negotiable Coaching Safety Logic**

These rules are deterministic and absolute. They apply equally to all runners regardless of fitness level, goal, or preference. The AI coaching system must enforce these rules and never override them, even if a user requests it.

---

## Rule 1: Weekly Volume Increase Cap

**MAXIMUM INCREASE:** 10-15% per week  
**Verified:** McMillan methodology, industry standard

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

Volume can decrease by any amount during deload weeks. There is no minimum decrease required — even 50% reduction is fine.

### Deload Trigger

Every 3-4 weeks, reduce volume 20-30%.

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
