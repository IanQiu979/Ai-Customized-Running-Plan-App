# ECHO Running Coach — Injury Flags & Return-to-Running Protocols

---

## Part 1: Injury Pattern Detection

### Overuse Injuries — Pattern Recognition from Run Data

The coaching system should detect injury patterns from logged run data, RPE reports, and user messages. When patterns emerge, proactively flag and adjust the plan.

> 📎 **V2.2 SCOPE NOTE:** The patterns below assume logged run data, and their responses prescribe prehab, mobility, and surface changes that V2.2 cannot emit — the app takes a one-time 8-field intake, outputs runs and rest days only, and its only levers against a declared injury are volume and intensity (see `CLAUDE.md`, "Coaching domain"). Everything here remains authoritative for Ian's coaching business. Do not delete.

> ℹ️ **EVIDENCE NOTE (per Ian's 2026-07-10 cadence ruling — annotate, don't alter):** Several patterns below treat "cadence below 170 SPM" as a causal injury threshold. Per the annotations in `training_zones.md` (Cadence Targets by Zone) and `ECHO_Framework_CORRECTED.md` Pillar 2, the evidence keys cadence intervention to a 5-10% increase above the runner's *own* baseline (Br J Sports Med 2022 step-rate meta-analysis), not to an absolute 170 floor.

---

### Knee Pain Pattern

**Detection Signals:**
- User reports knee pain or discomfort
- Cadence consistently below 170 SPM in logs
- Recent mileage increase greater than 15%
- No prehab sessions logged in past 2 weeks

**Likely Causes:**
1. Cadence too low (overstriding = impact on knee)
2. Weak glutes (hip drop stresses knee)
3. Mileage jumped too fast
4. Inadequate prehab (lateral lunges, single-leg RDL missing)

**Coaching Response:**

> Knee discomfort in runners often signals one of three things: cadence below target (overstriding creates knee impact), weak glutes causing hip drop, or a mileage jump your body is not ready for. This week: reduce volume 15%, focus cadence above 175 SPM, add glute prehab daily (glute bridges 3×15, lateral lunges 3×10 each side, clamshells 3×20). Reassess in 5 days. If pain is above 3/10 during runs, stop and seek physiotherapy.

---

### Shin Pain Pattern (Shin Splints / Medial Tibial Stress Syndrome)

**Detection Signals:**
- User reports shin pain or shin tenderness
- Cadence logs showing below 170 SPM
- Volume increased more than 15% in past 2 weeks
- High proportion of hard surface running noted

**Likely Causes:**
1. Cadence below 170 SPM (heel striking, braking force on shins)
2. Volume increase too fast
3. Hard running surfaces (concrete, road)
4. Insufficient rest between hard sessions

**Coaching Response:**

> Shin discomfort is one of the most common early warning signs in runners. It signals impact overload — usually from low cadence or too-rapid mileage increase. Immediate actions: reduce volume 15% this week, avoid hard surfaces (use trail, grass, or treadmill), increase cadence to 175+ SPM (shorter strides = less impact), and add calf raises daily (3 sets of 20, both straight and bent knee). Run through shin splints is how they become stress fractures. Treat this seriously.

---

### Plantar Fasciitis Pattern (Heel / Arch Pain)

**Detection Signals:**
- User reports heel or arch pain, especially in first morning steps
- Tight calf complaints
- High mileage week recently
- No mobility or calf work logged

**Likely Causes:**
1. Tight calves transferring load to plantar fascia
2. Arch weakness
3. Inadequate prehab
4. Rapid increase in pace or volume

**Coaching Response:**

> Plantar fascia pain — especially the classic morning first-step pain — requires consistent daily treatment. Three mandatory daily actions: (1) calf stretch 3×30 seconds each leg, morning before first steps, (2) towel curls or marble pickups for arch strength (2×20 each foot), (3) eccentric calf raises off a step (3×15, slow lowering phase). Reduce volume 20% this week. Avoid heel striking — focus on midfoot landing. If morning pain is severe (above 5/10), seek physiotherapy assessment before continuing.

---

### IT Band Syndrome Pattern (Outer Knee Pain)

**Detection Signals:**
- User reports outer knee pain (lateral, not front or back)
- Pain appearing at consistent mileage mark during runs
- Downhill running in recent training logs
- No hip strengthening work logged

**Likely Causes:**
1. Weak hip abductors (cannot stabilize pelvis = IT band overloaded)
2. Tight hip flexors and IT band itself
3. Downhill running (increases IT band strain)
4. Sudden increase in training load

**Coaching Response:**

> IT band pain is fundamentally a hip strength issue. The IT band tightens because the hip cannot stabilize the pelvis properly. Key prehab: lateral band walks (3×20 steps each direction), clamshells (3×20 each side), single-leg glute bridges (3×15 each). Foam roll outer thigh daily (not directly on IT band — foam roll the quad above and hip below). Avoid downhill running for 2 weeks. Reduce hard sessions by 50% this week.

---

### Achilles Tendon Pattern (Back of Heel / Lower Calf Pain)

**Detection Signals:**
- User reports heel cord pain or stiffness
- Recent increase in speed work or hill sessions
- Tight calf complaints
- Older runner (40+) — higher Achilles injury risk

**Likely Causes:**
1. Rapid increase in speed work (Achilles not conditioned for load)
2. Tight calves transferring stress to Achilles
3. Too much hill running
4. Insufficient warm-up before hard sessions

**Coaching Response (HIGH PRIORITY):**

> Achilles pain requires immediate attention. Unlike other running injuries, Achilles issues worsen quickly when pushed through. This week: no speed work, no hills. Easy Zone 1 only if pain is below 3/10. If pain is above 3/10 during running, stop and rest. Mandatory daily work: eccentric heel drops off a step (3×15 each leg, slow lowering over 3 seconds — this is the gold standard for Achilles rehab). Calf stretching after every run. If pain does not improve in 5-7 days, seek sports physiotherapy before continuing.

---

### Stress Fracture Pattern (Bone Stress — ⚠️ HIGHEST PRIORITY)

**Detection Signals:**
- Sharp, localized bone pain (shin, foot, hip)
- Pain that worsens during run and does not improve with warm-up
- Point tenderness on specific bone when pressed
- Recent dramatic mileage increase
- Female runner with irregular or missing periods (RED FLAG — low bone density)

**Coaching Response (STOP RUNNING — URGENT):**

> The pain pattern you are describing has characteristics consistent with bone stress injury (stress reaction or stress fracture). **This is a STOP-RUNNING situation.** Do NOT run until you have medical clearance — an X-ray or MRI is required to rule out stress fracture. Running on a stress fracture converts it to a complete fracture. Seek medical assessment today. This is not medical advice — this is a safety instruction.

**Recovery Timeline for Stress Fractures:**
- Beginner runner: 8-12 weeks minimum
- Intermediate: 10-14 weeks
- Advanced: 12-16 weeks (more muscle mass = more bone load)

> ⚠️ **EVIDENCE ANNOTATION — HIGHEST-SEVERITY ITEM IN THE LIBRARY (per Ian's 2026-07-10 ruling — annotate prominently, don't alter):** These timelines are keyed to *experience level*, but the clinical evidence keys return-to-running to fracture **site and grade**, not runner tier: a low-risk metatarsal shaft stress fracture returns in roughly **6-8 weeks**, while high-risk sites — **navicular, femoral neck** — need **4-6 months minimum** and specialist management. An "advanced" runner with a navicular fracture given "12-16 weeks" by this table could be returned to running months too early, with catastrophic downside (femoral neck completion = surgical emergency). Note also this file gives two *contradictory* rationales for the same tiering: here, advanced runners take longer because "more muscle mass = more bone load"; in Part 2, because "muscle loss = slower comeback." Any generator or coaching output must defer to the treating clinician's site-specific guidance — never to these tier-based numbers alone.

---

## Part 2: Return-to-Running Protocol (After Injury)

Comebacks are harder than initial training. **Patience is the most critical variable.**

---

### Phase 1: Pain-Free Clearance (Weeks 0-2)

**Requirements before proceeding:**
- No pain with daily activities (walking, stairs)
- No visible swelling
- Medical clearance obtained for significant injuries
- Can complete pain-free walk for 30 minutes on flat surface

**Testing Protocol:**
1. Pain-free walk test: 30 min flat, no pain during or after
2. Single-leg balance: 1 minute each leg without discomfort
3. Gentle movement test: Slow high knees, butt kicks, lateral steps

**Progression:**
- ✅ If ALL pain-free: Proceed to Phase 2
- ❌ If ANY pain present: Extend Phase 1, do not run

---

### Phase 2: Return to Easy Running (Weeks 2-4)

**Goal:** Build running tolerance, establish confidence, prevent re-injury

**For Significant Injuries — Run/Walk Protocol:**
- Structure: 1 minute running, 2 minutes walking
- Repeat: 6-8 cycles = 18-24 minutes total
- Frequency: 2-3 sessions per week, never consecutive days
- Assessment after each: Pain during? Pain after? Pain next morning?
  - All three must be zero to progress

**For Minor Injuries — Continuous Easy Running:**
- Duration: 20-25 minutes very easy (Zone 1 only)
- Frequency: 2-3 sessions per week
- Rest days: Minimum 1 day between runs
- Assessment: Zero pain at all three checkpoints

**Example Week 2 Schedule:**
| Day | Activity | Duration |
|-----|----------|----------|
| Day 1 | 20 min easy run/walk | 20 min |
| Day 2 | Rest or 30 min walk | 30 min |
| Day 3 | 20 min easy run/walk | 20 min |
| Day 4 | Rest | — |
| Day 5 | 25 min easy run/walk | 25 min |
| Day 6 | Rest or light cross-train | Swimming, cycling |
| Day 7 | Rest | — |

**Weekly Total:** 1-1.5 hours running per week

---

### Phase 3: Building Tolerance (Weeks 5-8)

**Goal:** Increase volume, introduce consistency, build confidence

**Session Structure:**
- Two easy runs per week (48+ hours apart)
- Duration: 25-35 minutes each
- Intensity: Zone 1 only (no hard efforts)
- Third session: Long easy run (starting 40 min, building 5-10 min/week)

**Example Week 6 Schedule:**
| Day | Activity | Distance/Duration |
|-----|----------|-------------------|
| Day 1 | 30 min easy | 30 min |
| Day 2 | Rest or walk | — |
| Day 3 | 30 min easy | 30 min |
| Day 4 | Rest | — |
| Day 5 | Rest or cross-train | Swimming, cycling |
| Day 6 | 45 min easy long run | 45 min |
| Day 7 | Rest | — |

**Milestones:**
- Week 5: Two 25-30 min runs + 40 min long run
- Week 6: Two 30-35 min runs + 45 min long run
- Week 7: Two 35 min runs + 50 min long run
- Week 8: Two 35-40 min runs + 55 min long run

---

### Phase 4: Near-Return (Weeks 9-12)

**Goal:** Approach pre-injury volume, test returning to normal structure, introduce a third easy day

**Session Structure:**
- Three easy runs (48+ hours between any hard/moderate)
- Option to add one easy steady (Zone 2, very mild — not hard)
- Normal long run building

**Example Week 10:**
| Day | Activity | Duration/Distance |
|-----|----------|-------------------|
| Day 1 | 40 min easy | 40 min |
| Day 2 | Rest | — |
| Day 3 | 35 min easy + 10 min steady | 45 min total |
| Day 4 | Rest | — |
| Day 5 | Rest | — |
| Day 6 | 65 min long run | 65 min |
| Day 7 | Rest | — |

**Decision Point (Week 12):**
- ✅ If completely pain-free: Advance to Phase 5
- ⚠️ If slight pain returning: Extend Phase 4 another 2-3 weeks
- ❌ If significant pain: Regress to Phase 3

---

### Phase 5: Return to Normal Training (Week 13+)

**Goal:** Restore full training, reintroduce hard efforts (if injury is stable)

**Progression:**
- Week 13: Add one easy steady day (25-30 min Zone 2)
- Week 14: Add short intervals (4 × 2 min Zone 3 with recovery)
- Week 15: Near-normal training (follow standard periodization)
- Week 16: Full training, building intensity as normal

**RED FLAGS (Stop and Regress if Occur):**
- 🚩 Sharp pain during/after run
- 🚩 Swelling that doesn't go away
- 🚩 Compensation limping (favoring injured side)
- 🚩 Pain radiating to other areas
- 🚩 Returning pain after painless week

**Response to Red Flags:**
- Regress 1-2 phases
- Re-assess with medical professional
- Do NOT push through pain

---

### Special Case: Stress Fracture

Stress fractures are the **longest injuries** for runners.

**Timeline:**
- Beginner runner: 8-12 weeks minimum recovery
- Intermediate runner: 10-14 weeks
- Advanced runner: 12-16 weeks (muscle loss = slower comeback)

> ⚠️ **EVIDENCE ANNOTATION (see the prominent annotation in Part 1):** Return-to-running after a stress fracture is determined by fracture **site and grade** (low-risk metatarsal shaft ~6-8 weeks; navicular and femoral neck 4-6 months minimum), not by runner experience tier. Also note the rationale here ("muscle loss = slower comeback") contradicts Part 1's ("more muscle mass = more bone load") for the exact same tiering. Defer to the treating clinician's site-specific guidance.

**Recovery Protocol:**

**Weeks 1-4: Absolute Rest (No impact whatsoever)**
- Swimming: ✅ OK (non-impact)
- Cycling: ✅ OK (if non-weight-bearing, gentle pedaling)
- Walking: Carefully; some fractures allow walking after week 2-3
- Running: ❌ NO

**Weeks 5-8: Return-to-Running Phases 1-2 (Run/walk very gradually)**
- Follow Phase 2 above religiously
- 2-3 runs per week, 15-20 min max
- Any pain = regress

**Weeks 9-12: Phases 3-4 (Building carefully)**
- Very conservative progression
- 3 runs per week, no hard efforts
- Maximum long run 45-50 min

**Weeks 13-16: Phase 5 (Cautious full return)**
- Add intensity very slowly
- Hard efforts introduced week 15+
- Full training by week 16-20

---

## Part 3: Special Populations — Injury Risk Adjustments

### Female Runners — Additional Injury Risk Factors

**Luteal Phase (Day 15-28 of cycle):**
- Higher injury risk
- Joints more lax, muscles more fatigued, recovery slower
- Action: Reduce hard session intensity in luteal phase
- Avoid VO2 max intervals and testing during this phase

**Missing or Irregular Periods = RED FLAG:**
- Signals underfueling or overtraining (Female Athlete Triad risk)
- Action: Immediate nutrition assessment, reduce training load
- Require medical evaluation before continuing hard training

**Iron Monitoring (Especially During Menstruation):**
- Low iron = low hemoglobin = poor oxygen delivery = poor performance
- Signs: Unusual fatigue, pale, dizziness during runs
- Action: Blood test recommended, increase iron-rich foods

---

### Runners 50+ — Additional Injury Risk Factors

**Bone Density Lower:**
- Stress fracture risk higher
- Calcium + Vitamin D essential
- Strength training 2-3×/week non-negotiable
- Impact running actually builds bone density — do not switch entirely to low-impact exercise

**Muscle Loss (Sarcopenia):**
- Injury recovery takes longer
- Protein intake 2.0-2.2 g per kg body weight
- Strength training is non-optional for injury prevention

**Recovery Timeline Longer:**
- Young runner stress fracture: 6-8 weeks
- 50+ runner stress fracture: 12-16 weeks
- Coach all injuries with more conservative timelines for 50+ runners

> ℹ️ This is the library's *third* stress-fracture timeline, keyed to age (Parts 1 and 2 key theirs to experience tier). See the annotations there: fracture **site and grade**, not age or tier, determine return time. Conservative timelines for 50+ runners remain sound coaching; the specific week counts are not clinically load-bearing.

**Deconditioning Faster:**
- Missing 2 weeks = more significant loss than younger runners
- Return-to-running must follow protocol even after short breaks

---

### Returning After 2+ Week Break (All Runners)

| Week | Volume | Intensity |
|------|--------|-----------|
| 1 | 50% of normal | Zone 1 only |
| 2 | 75% of normal | Zone 1 + Zone 2 gently introduced |
| 3 | 100% of normal | Normal structure, intensity still conservative |
| 4+ | Full training | Normal periodization |

**Critical Note:** Never jump back to pre-break volume immediately. Muscles and connective tissue decondition at different rates — tendons and ligaments lose conditioning faster than aerobic capacity. The runner may feel cardiovascularly ready before tendons are ready.

---

## Part 4: Prehab Exercise Library

These exercises **prevent injuries**. They must be integrated into the training plan, especially on rest days and after easy runs.

---

### Exercise: Glute Bridge

**Primary Target:** Glutes, hamstrings, core

**Why It Matters:** Weak glutes = hip drop = knee and ankle injury

**Form:**
1. Lie on back, knees bent, feet flat on floor hip-width apart
2. Drive through heels to lift hips until body forms straight line
3. Squeeze glutes hard at top, hold 2 seconds
4. Lower slowly (3 second descent)
5. Do not let lower back arch excessively

**Progression:**
- **Beginner:** 3 × 12 reps, bodyweight, 2× per week
- **Intermediate:** 3 × 15 reps + hold 3 sec at top, 2× per week
- **Advanced:** 3 × 15 single-leg glute bridge, 2-3× per week

**Common Mistakes:**
- Pushing through lower back not glutes → Cue: "Drive through heels"
- Not squeezing at top → Cue: "Hold and squeeze for 2 seconds"

---

### Exercise: Single Leg RDL (Romanian Deadlift)

**Primary Target:** Glutes, posterior chain, balance

**Secondary Target:** Core stability, hamstring endurance

**Why It Matters:** Builds single-leg stability critical for running gait

**Form:**
1. Stand on one leg, slight bend in standing knee
2. Hinge at hip (not waist), maintain neutral spine throughout
3. Lower torso toward parallel, back leg extends behind for balance
4. Feel weight through front heel
5. Return by driving hip forward, squeeze glute at top
6. Keep hips square throughout (do not open hip outward)

**Progression:**
- **Beginner:** 3 × 8 reps each leg, bodyweight, 2× per week
- **Intermediate:** 3 × 10 reps each leg, light dumbbell, 2× per week
- **Advanced:** 4 × 12 reps + 3 × 20 reps light, 2-3× per week

**Common Mistakes:**
- Rounding lower back → Cue: "Hinge from hip, not waist"
- Hip rotating open → Cue: "Keep hips square, knee tracks toe"
- Too much weight → Cue: "Light weight, high reps first"

**Integration:** Best on rest days or after easy runs. Never on back-to-back hard sessions.

---

### Exercise: Lateral Lunge

**Primary Target:** Hip abductors, adductors, glutes

**Why It Matters:** Builds frontal plane stability — reduces knee collapse and IT band issues

**Form:**
1. Stand feet hip-width apart
2. Step wide to one side, bend stepping knee over toes
3. Keep opposite leg straight, foot flat
4. Drive back to start through stepping leg heel
5. Keep chest tall, do not round forward

**Progression:**
- **Beginner:** 3 × 8 each side, bodyweight, 2× per week
- **Intermediate:** 3 × 10 each side + 2 second hold, 2× per week
- **Advanced:** 3 × 12 each side with light dumbbell, 2-3× per week

---

### Exercise: Calf Raise (Eccentric Focus)

**Primary Target:** Calf complex (gastrocnemius + soleus), Achilles

**Why It Matters:** Prevents Achilles tendon issues and plantar fasciitis. Gold standard for Achilles rehab and prevention.

**Form:**
1. Stand on edge of step, heels hanging off
2. Rise up on both feet (2 seconds up)
3. Lower on ONE foot only (3-4 second slow descent)
4. Full range of motion — full stretch at bottom, full rise at top
5. Both legs for rise, single leg for slow lower

**Progression:**
- **Beginner:** 3 × 12 each leg, bodyweight, 2× per week
- **Intermediate:** 3 × 15 each leg, 2× per week
- **Advanced:** 3 × 20 each leg + add weight (backpack), 2-3× per week

**Key Note:** The SLOW lowering (eccentric) phase is the therapeutic part. Do not rush the descent.

---

### Exercise: Lateral Band Walk

**Primary Target:** Hip abductors (gluteus medius)

**Why It Matters:** Prevents IT band syndrome and knee collapse during running

**Form:**
1. Place resistance band around ankles or just above knees
2. Slight squat position (athletic stance)
3. Walk sideways with controlled steps, maintaining band tension
4. Do not let feet come together (keep tension throughout)
5. Keep knees tracking over toes, do not cave inward

**Progression:**
- **Beginner:** 3 × 15 steps each direction, light band, 2× per week
- **Intermediate:** 3 × 20 steps, medium band, 2× per week
- **Advanced:** 3 × 25 steps + forward/backward walks, heavy band, 2-3× per week

---

### Exercise: Plank

**Primary Target:** Core (transverse abdominus, obliques)

**Why It Matters:** Core stability = stable pelvis = efficient running form

**Form:**
1. Forearms on floor, elbows under shoulders
2. Body straight from head to heels (like a pushup position)
3. Squeeze glutes and brace core
4. Do not let hips sag or rise
5. Breathe normally throughout

**Progression:**
- **Beginner:** 3 × 20-30 seconds, 2× per week
- **Intermediate:** 3 × 45-60 seconds, 2× per week
- **Advanced:** 3 × 60-90 seconds + side planks, 2-3× per week

**Integration:** Can be done daily — very low injury risk, high benefit.

---

### Prehab Integration Into Training Week

**Recommended Prehab Schedule:**
- **Rest days:** Full prehab session (20-30 min all exercises)
- **After easy runs:** 10-15 min light prehab (2-3 exercises)
- **After hard runs:** Light mobility only, not full prehab
- **Never before runs** (pre-fatigues stabilizers needed during run)

**Minimum Effective Dose:**
- 2× prehab sessions per week (rest days) maintains injury prevention
- 3× prehab sessions per week builds strength and resilience
- Daily prehab is ideal for 50+ runners or return-from-injury runners

---

## Disclaimer

⚠️ **This is not medical advice.** All injury guidance is for informational purposes only. Always consult a qualified sports medicine professional or physiotherapist for diagnosis and treatment of running injuries. Do not run through pain without medical clearance.
