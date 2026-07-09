# V2.2 — Running Training Plan Builder: Brainstorm

> Planning phase only. No code exists yet. This app is a single-purpose spin-off of Echo (V1):
> user inputs their data → gets a personalized training plan. That is the only feature.

---

## Step 1 — Brainstorm ✅

### What's the actual goal of this project?
**Real launch** — intent to ship to the App Store to real users.

### Functionality milestones

**v1 (MVP):**
- Single core feature: plan generation from user inputs.
- **Free tier:** one plan only (to test the app), basic hard-coded/template plan.
- **Paid tier:** high-quality, detailed, personalized ("certified") plans; can generate multiple plans.
- Plan engine is tiered: templates only for free users → AI + template hybrid → fully AI-personalized for paid users.
- Plans/workouts are stored and accessible in a separate tab (plan history).
- **Dummy payment** in v1 (like Echo V1); real payments incorporated later.

**v2+ (later):**
- Real payment integration (⚠️ see App Store note below).
- Everything else deferred (export, adjustments, etc. — to be confirmed).

> ⚠️ **App Store note:** Apple requires In-App Purchase for unlocking digital features — a
> dummy-payment gate is fine for TestFlight, but the public App Store release will need real
> IAP (e.g. RevenueCat/StoreKit) before launch. Flagged early since the goal is a real launch.

---

## Step 2 — AI clarifying questions

### Answered
- **Plan engine:** tiered — free = templates only; paid = high-quality AI personalization (AI + template hybrid in between).
- **Payment model:** dummy payment for v1, real payments later.
- **Tiers (like Echo):** Free = 1 basic plan · Pro = 3 plans · Elite = 10 plans (fixed quotas, not unlimited).
- **Paid plan value:** deeper personalization + richer workout detail (paces, HR zones, warm-ups, drills) + multiple plans + coach-style "why" explanations.
- **Intake:** reuse Echo V1's onboarding questions as the base, extend where needed.
- **Plan shape:** both — race-date driven when the user has a target race; fixed-duration (8/12/16 wk) for general goals.
- **Accounts:** required sign-up (email/Apple) up front.

- **Quotas:** refresh monthly (Pro 3/mo, Elite 10/mo; Free = 1 total).
- **Pro vs Elite:** Elite gets more than quantity — extras proposed in the spec (mid-plan
  adjustments, race-day strategy, deeper periodization) → **user to confirm/edit**.
- **Stack:** same as Echo V1 (Expo/React Native + TypeScript, Supabase, Claude via edge functions).

---

## Step 3 — Spec doc ✅ (drafted)

- `planning/02-product-requirements.md` — Part A: what & why, tiers, flows, milestones + done criteria
- `planning/03-engineering-requirements.md` — Part B: stack, architecture, DB schema, security, infra checklist

### Remaining before coding
- [ ] Confirm/edit the proposed Elite extras (in 02, tier table)
- [ ] Pick the app's name
- [ ] Provision infra (checklist at the bottom of 03)
