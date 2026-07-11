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
2. **Intake**: onboarding questionnaire (based on Echo V1's onboarding, extended). **Eight fields
   always asked**: goal, **age**, experience level, days/week available, current weekly volume, a
   target-race distance choice, **a recent time at any distance** (optional to answer, always
   asked), and injuries/constraints. **Two more appear only once a target race is chosen**: race
   date and **goal time**. **Ten fields, or 8 questions without a race.**

   Three of them are not cosmetic:
   - *Age* → max HR is estimated `220 − age`, so **no HR zone is computable without it**, and the
     load rules make a 3-week deload cadence mandatory for runners 50+.
   - *Goal time* → drives **race-pace sessions only**.
   - *Recent time* → drives **every other training pace**. Deriving easy or tempo pace from a goal
     the runner hasn't achieved would prescribe paces they cannot sustain. Without a recent time the
     plan emits **no numeric paces at any tier** — only effort language.

   > **Units — RESOLVED (Ian, 2026-07-12, issue #36): kilometres, everywhere, permanently. No
   > toggle, ever.** Weekly volume is asked in km; every rendered distance is km and every pace is
   > sec/km. Imperial is **out of scope**, not deferred. Reasoning: the coaching source of truth
   > (`docs/reference/coaching/source/`) is 100% km, and `Workout.structure` /
   > `Workout.effortDescription` are free prose with the unit baked into the string (e.g. "1 km
   > easy, 3 km steady, 1 km easy"). Since plans are immutable once generated, a unit toggle could
   > never be display-only — it would have to be chosen before generation, and a runner changing
   > their mind would need a full regeneration, burning quota for a display preference. That cost is
   > what makes km-only correct rather than a deferred nice-to-have.

   > **Safety clamp (decision, 2026-07-10; refined by addendum R-A, same day).** Training paces are
   > **unconditionally** computed from the recent time, never the goal — this doesn't change at any
   > improvement size. What the goal drives is the goal-pace session's own target: if the goal time
   > implies **≤10% improvement** over the recent-time equivalent, goal-pace sessions use the raw
   > goal pace; beyond 10%, they use the recent-time-equivalent pace instead. This is a direct
   > answer to the failure mode behind Runna's reported injuries: an algorithm that "takes the
   > runner at their word."
3. **Generate a plan**, tiered by subscription:

| Tier | Plans | Engine | Quality |
|------|-------|--------|---------|
| **Free** | 1 total (to try the app) | Templates only | Basic hard-coded plan for the chosen distance/duration |
| **Pro** | 3 / period† | AI + template hybrid | Deep personalization, pace targets, HR zones, warm-ups/drills, coach-style "why" per week |
| **Elite** | 10 / period† | Same skeleton, customized far more heavily — richest prompt | Everything in Pro, plus a per-workout "why" — the richest personalization prompt (injury history, periodization nuance, race context), nothing more. **Extras cut for MVP** (decision, 2026-07-10) — see the v2 list below |

† A **period** is anchored to the purchase day (e.g. May 26 → June 26, clamped at month end), not
a calendar month. User-facing copy never says "this month" — see "User flow" below.

All three tiers build on the same coach-authored template skeleton (see
[`03-engineering-requirements.md`](03-engineering-requirements.md), `generate-plan`). It is never
removed — Elite customizes it far more heavily than Pro, it does not remove it. The deterministic
load-rule clamp applies identically to all three tiers.

4. **Plan view**: week-by-week schedule; each workout has type, distance/duration, pace/effort,
   and (paid) the coaching explanation.
5. **My Plans tab**: all generated plans stored and accessible; free users see their single plan.
6. **Dummy paywall + settings-lite** (v1, restored by decision, 2026-07-10): same dummy-payment
   pattern as Echo V1 — a fake payment flow gates Pro/Elite — plus a minimal settings screen (sign
   out, tier display, restore purchases). Both live behind the third tab slot the design blueprint
   already reserves (`docs/design/mvp-blueprint.md` Part 8).

### Free-tier configure gating (decision, 2026-07-10)

Free sees **every** distance and plan-length option on the configure screen, never a trimmed menu.
A selection outside Free's reach (anything but a ≤12-week 5K) renders in a **locked state** that
routes to the paywall on tap — an honest upsell, never a dead disabled control.

### Plan shape
- **Race-date driven** when the user sets a target race: plan spans today → race day.
- **Never refuse.** A race three weeks out gets a three-week plan: race-specific work, final week
  a taper. Short is honest; refusing is not.
- **Plan length is keyed to race distance, not experience**
  (`ECHO_Training_Plans_McMillan.md § Customization Guidelines › Goal Race`):

  | Distance | Program length |
  |---|---|
  | 5K | 12–14 weeks |
  | 10K | 14–16 weeks |
  | Half | 16–20 weeks |
  | Marathon | 24–30 weeks |
  | Ultra | v2 — no source content exists yet |

- **Maximum plan length is a tier feature.** Free 12 weeks · Pro 24 · Elite 30+.
  Consequence, stated plainly: **Free can only reach a 5K plan.** A 10K needs 14 weeks minimum.
- **Days available shape the week**
  (`§ Customization Guidelines › Weekly Availability`): under 3 days → a 3-run week (easy, tempo,
  long); 3–4 days → add steady/interval; 5–6 days → the full program.
- **Running only.** A v1 plan contains runs and rest days. No prehab strength, no cross-training,
  no mobility sessions. (Echo's McMillan plans include prehab; V2.2 deliberately drops it.)
  Consequence: the engine's only levers against a declared injury are **volume and intensity**.
- **Days are unnamed.** Sessions are Day 1 … Day 7 within a 7-day cycle, never Mon–Sun — the runner
  places them. Rest days are real slots in that cycle, not absences.

## User flow (v1)

```
Launch → Sign up / Log in
      → Intake questionnaire (first run)
      → Home: "Create a plan" + tier status (e.g. Pro: "2 of 3 plans left. More on {resetDate}."
        — never "this month"; periods are purchase-day-anchored, not calendar months)
         — no "next workout" or "current week" card (decision, 2026-07-10); Home shows only
           the plan link and quota state
      → Configure plan (goal, race/date or duration) → [paywall if over quota/tier or an
        out-of-tier selection]
      → Generating… → Plan view
      → Tab 2: My Plans (history list → plan view)
      → Tab 3: Settings-lite (account, subscription/paywall (dummy), restore)
```

Three tabs: **Home/Create**, **My Plans**, and **Settings-lite** (paywall + account, restored to
MVP scope by decision, 2026-07-10 — see "What it does (v1)" above). Deliberately small.

## Milestones & definition of done

- **M1 — Foundation**: Expo app scaffolded, Supabase project, required sign-up working.
  *Done when: a new user can create an account and land on an empty Home.*
- **M2 — Intake**: onboarding questionnaire persists to DB.
  *Done when: intake answers survive logout/login.*
- **M3 — Plan engine**: free template plans + paid AI plans generate reliably; plan view renders.
  *Done when: all three tiers produce a valid, complete plan for 5K/10K/half/marathon and
  fixed-duration goals, and a malformed AI response never reaches the user (falls back).*
- **M4 — Tiers & quotas**: dummy paywall, tier stored server-side, quotas enforced server-side
  (Free 1 total, Pro 3/period, Elite 10/period — purchase-anchored, not calendar months).
  *Done when: quota can't be bypassed by the client, and the paywall shows at the right moments.*
- **M5 — My Plans**: history tab, plan persistence, re-open past plans.
  *Done when: every generated plan is retrievable after app restart.*
- **M6 — Polish & TestFlight**: empty states, errors, loading, app icon/splash, TestFlight build.
  *Done when: a stranger can go sign-up → plan without hitting a dead end.*

## v2 (after launch learnings)

- **Ultra distances** (50K / 50 mile / 100K / 100 mile — exact set TBD). Deferred from v1 for two
  concrete reasons, both of which must be resolved before it can be built:
  1. **No source content exists.** The coaching library covers 5K, 10K, half, and marathon only.
     Ultra plan structure has to be authored by Ian; it is not ours to invent (`CLAUDE.md`,
     "Coaching domain").
  2. **The load rules cannot express it.** `load-rules.md` Rule 4 caps advanced runners at
     110 km/week and a 35 km longest run ("marathon-specific only"). A 100-mile plan does not fit
     inside those ceilings. Rule 4 needs an ultra tier before an ultra plan can be generated safely.
- **Real payments** — required for public App Store release (Apple mandates IAP for digital
  features; dummy payment is TestFlight-only). RevenueCat + StoreKit.
- **Guest account** — try the app without signing up (likely gets the same Free 1-plan limit,
  then a prompt to create a real account to keep the plan). Deferred from v1.
- **iPad and desktop/computer support** (decision, 2026-07-10). v1 ships phone-only, per Ian:
  "phone only for phase 1, then ipad and computer in phase two."
- **Elite extras** — mid-plan adjustment/regeneration (shift days, change race date), a race-day
  strategy section, and periodization tuned to injury history beyond what the richest prompt
  already covers. Cut from v1 (decision, 2026-07-10); `Plan.extras` can carry them later without a
  schema change.
- Plan export (PDF / calendar).
- Mid-plan adjustments for Pro (if Elite-only proves too restrictive).
- Completed-workout check-offs (deliberately excluded from v1 — that's Echo territory;
  this app builds plans, it is not a training log).
