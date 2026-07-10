# V2.2 — Product Requirements (Part A: What & Why)

> Status: draft from brainstorm (2026-07-07). Working name TBD (part of the PACE family, not Echo).

## Who it's for

Runners of any level who want a structured training plan built around **their** data —
without paying $100+/month for a human coach, and without wading through a full-featured
coaching app (the exact feedback that Echo V1 got: too many features).

## What problem it solves

- Generic plans from books/blogs don't account for your fitness, schedule, or race date.
- Human coaching is expensive and slow to start.
- Full coaching apps (including Echo V1) bury plan generation under logging, metrics, chat, etc.

**This app does one thing:** input your data → get a professional training plan.

## What it does (v1)

1. **Sign up** (required): Google, Sign in with Apple, or email/password. (Apple sign-in is
   required by App Store rules whenever Google sign-in is offered, so it ships in v1.) No guest
   mode in v1 — a guest account is deferred to v2.
2. **Intake**: onboarding questionnaire (based on Echo V1's onboarding, extended) — goal, **age**,
   experience level, days/week available, current mileage, target race + date (optional),
   **goal time** (only when a race is chosen), **a recent time at any distance** (optional), and
   injuries/constraints. **Ten fields.**

   Three of them are not cosmetic:
   - *Age* → max HR is estimated `220 − age`, so **no HR zone is computable without it**, and the
     load rules make a 3-week deload cadence mandatory for runners 50+.
   - *Goal time* → drives **race-pace sessions only**.
   - *Recent time* → drives **every other training pace**. Deriving easy or tempo pace from a goal
     the runner hasn't achieved would prescribe paces they cannot sustain. Without a recent time the
     plan emits **no numeric paces at any tier** — only effort language.

   > **Safety clamp.** If the goal time implies a large improvement over the runner's recent
   > performance, training paces are computed from the recent time, not the goal. The goal still
   > shapes race-specific work. *(The improvement threshold is NOT SPECIFIED — needs Ian.)* This is
   > a direct answer to the failure mode behind Runna's reported injuries: an algorithm that "takes
   > the runner at their word."
3. **Generate a plan**, tiered by subscription:

| Tier | Plans | Engine | Quality |
|------|-------|--------|---------|
| **Free** | 1 total (to try the app) | Templates only | Basic hard-coded plan for the chosen distance/duration |
| **Pro** | 3 / month | AI + template hybrid | Deep personalization, pace targets, HR zones, warm-ups/drills, coach-style "why" per week |
| **Elite** | 10 / month | Same skeleton, customized far more heavily — richest prompt | Everything in Pro **plus** (proposed, confirm): mid-plan adjustments/regeneration (shift days, change race date), race-day strategy section, deeper periodization tuned to injury history |

All three tiers build on the same coach-authored template skeleton (see
[`03-engineering-requirements.md`](03-engineering-requirements.md), `generate-plan`). It is never
removed — Elite customizes it far more heavily than Pro, it does not remove it. The deterministic
load-rule clamp applies identically to all three tiers.

4. **Plan view**: week-by-week schedule; each workout has type, distance/duration, pace/effort,
   and (paid) the coaching explanation.
5. **My Plans tab**: all generated plans stored and accessible; free users see their single plan.
6. **Dummy paywall** (v1): same pattern as Echo V1 — fake payment flow gates Pro/Elite.

### Plan shape
- **Race-date driven** when the user sets a target race: plan spans today → race day.
- **Fixed duration** (8 / 12 / 16 weeks) for general goals ("get fitter", "build base").
- **Running only.** A v1 plan contains runs and rest days. No prehab strength, no cross-training,
  no mobility sessions. (Echo's McMillan plans include prehab; V2.2 deliberately drops it.)
  Consequence: the engine's only levers against a declared injury are **volume and intensity**.
- **Days are unnamed.** Sessions are Day 1 … Day 7 within a 7-day cycle, never Mon–Sun — the runner
  places them. Rest days are real slots in that cycle, not absences.

## User flow (v1)

```
Launch → Sign up / Log in
      → Intake questionnaire (first run)
      → Home: "Create a plan" + tier status (e.g. Pro: 2 of 3 plans left this month)
      → Configure plan (goal, race/date or duration) → [paywall if over quota/tier]
      → Generating… → Plan view
      → Tab 2: My Plans (history list → plan view)
      → Settings: account, subscription (dummy), restore
```

Two tabs + a stack: **Home/Create** and **My Plans**, plus Settings. Deliberately small.

## Milestones & definition of done

- **M1 — Foundation**: Expo app scaffolded, Supabase project, required sign-up working.
  *Done when: a new user can create an account and land on an empty Home.*
- **M2 — Intake**: onboarding questionnaire persists to DB.
  *Done when: intake answers survive logout/login.*
- **M3 — Plan engine**: free template plans + paid AI plans generate reliably; plan view renders.
  *Done when: all three tiers produce a valid, complete plan for 5K/10K/half/marathon and
  fixed-duration goals, and a malformed AI response never reaches the user (falls back).*
- **M4 — Tiers & quotas**: dummy paywall, tier stored server-side, quotas enforced server-side
  (Free 1 total, Pro 3/mo, Elite 10/mo).
  *Done when: quota can't be bypassed by the client, and the paywall shows at the right moments.*
- **M5 — My Plans**: history tab, plan persistence, re-open past plans.
  *Done when: every generated plan is retrievable after app restart.*
- **M6 — Polish & TestFlight**: empty states, errors, loading, app icon/splash, TestFlight build.
  *Done when: a stranger can go sign-up → plan without hitting a dead end.*

## v2 (after launch learnings)

- **Real payments** — required for public App Store release (Apple mandates IAP for digital
  features; dummy payment is TestFlight-only). RevenueCat + StoreKit.
- **Guest account** — try the app without signing up (likely gets the same Free 1-plan limit,
  then a prompt to create a real account to keep the plan). Deferred from v1.
- Plan export (PDF / calendar).
- Mid-plan adjustments for Pro (if Elite-only proves too restrictive).
- Completed-workout check-offs (deliberately excluded from v1 — that's Echo territory;
  this app builds plans, it is not a training log).
