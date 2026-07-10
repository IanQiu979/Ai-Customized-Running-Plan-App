# V2.2 MVP Build Prompt

> **How to use:** open a Claude Code session in this repo and say:
> *"Read `docs/mvp-build-prompt.md` and execute it. Start with Phase 0."*
> This prompt was produced on 2026-07-10 after a full three-lens audit (spec consistency,
> design blueprint, live DB state) of the planning docs. The audit's findings are already
> baked in below as **Rulings** (apply them, don't re-litigate) and a **Decision gate**
> (ask Ian, don't invent answers). Do NOT re-run the audit.

---

## Mission

Build the V2.2 MVP — the Running Training Plan Builder — end to end: milestones M1–M6 in
`planning/02-product-requirements.md`, following the critical path in `docs/mvp-progress.md`
§Next. The product does one thing: intake in → tiered, safety-clamped training plan out.
**Plan generation is the core of the app. Get it right before anything is made beautiful.**

This is multi-session work. At the end of every session, update `docs/mvp-progress.md`, and
leave a handoff note (use the `session-handoff` skill if available) so the next session
resumes cold without re-reading everything.

## Read first, in this order

1. `CLAUDE.md` + `AGENTS.md` — standing rules (secrets, coaching domain, doc sync, git etiquette)
2. `docs/mvp-progress.md` — where the project actually is (trust it over architecture.md's "Current")
3. `planning/02-product-requirements.md` + `planning/03-engineering-requirements.md` — the spec
4. `docs/architecture.md` — route tree, API, schema draft
5. `docs/reference/plan-generation.md` — the three-tier engine design
6. `docs/reference/coaching/00-README.md` → then the five coaching files as needed — **the only
   legitimate source of training content. Never invent coaching advice.**
7. `docs/design/frontend-design-brief.md` + `docs/design/mvp-blueprint.md` — tokens, screens, motion
8. `src/lib/planTypes.ts` + `src/lib/loadRules.ts` — already built and tested; they are canonical

## Standing rules (non-negotiable, all phases)

- **Never invent coaching content.** Every workout structure, volume number, pace rule, and
  injury behavior comes from `docs/reference/coaching/`. If the coaching docs don't answer a
  question, it goes to Ian — it is not yours to decide.
- **Safety logic is typed code, never a prompt.** `loadRules.ts` clamps every plan at every tier.
- **No business rules in the client.** Tier, quota, generation: server-side only.
- **Secrets:** `ANTHROPIC_API_KEY` never gets `EXPO_PUBLIC_`, never enters `.env` or the bundle.
- **Verification:** `npm run typecheck && npm run lint && npm test` clean before every commit.
  Dispatch the `verifier` subagent at the end of every phase.
- **Git:** branch `feat/<slug>` per milestone; multi-file / auth / RLS / edge-function work goes
  through a PR via the `github-ops` subagent. Commit early and often inside a branch.
- **Docs:** after every milestone (or decision), dispatch `doc-writer` to sync
  `docs/mvp-progress.md`, `docs/change_log.md`, and `docs/architecture.md` (planned → current).
- **Dependencies:** `npx expo install` only, never `npm install` (SDK 54 pinning).
- **Subagent discipline:** planner agents plan, builder agents build, reviewer agents review —
  don't have one agent do all three. Wrap planner→builder handoffs with `scope-guard`. Dispatch
  independent subagents in parallel; serialize only where outputs feed inputs.

## Owner design directions (recorded 2026-07-10)

- The app is an app, but it should be **composed like a website**: screens are long, scrolling
  surfaces. A **later phase** (post-MVP) adds website-style scroll-driven animations —
  scroll-triggered reveals, scroll-linked motion, "scroll down and everything."
  **MVP ships plain native scroll** (the blueprint's rule stands for v1), but do not build
  anything that precludes scroll-driven animation later: keep screens on Reanimated-compatible
  scroll containers, avoid nested-scroll traps, don't hard-pin layouts that assume a static
  viewport. Record this direction in `docs/architecture.md` when doc-writer syncs.
- The v1 aesthetic is the blueprint's **Instrument & Matter** system. Its banned list (glow,
  glassmorphism, ambient motion) still applies to the future scroll animations.

---

# Phase 0 — Reconcile before building anything

The 2026-07-10 audit found the doc set describes **two different quota systems**, contradicts
itself on scope and field counts, and silently dropped several mechanisms Echo V1 learned the
hard way. Phase 0 fixes the paper so the build never has to guess which doc wins.

## 0-A. Repo hygiene (do immediately)

1. `git status` — commit the **uncommitted diff in `planning/02-product-requirements.md`**
   (plan-length table, "never refuse", tier caps, ultra deferral) and the untracked
   `docs/reference/coaching/example-plan-5k-pro.md` (also add it to `00-README.md`'s file
   table). Add the missing `docs/change_log.md` entry for the planning/02 change.
2. Fix `docs/change_log.md` date ordering (2026-07-09 currently sits above 2026-07-10).

## 0-B. Rulings — apply as fact, then have `doc-writer` sync every doc that disagrees

These were resolved by evidence during the audit. They are not open questions.

1. **Deload band is 35–45%** (Ian's 2026-07-10 ruling in `load-rules.md` Rule 1; implemented in
   `loadRules.ts`). Delete `docs/mvp-progress.md`'s stale 🟠 risk claiming 20–30% is
   authoritative and "the port enforces 20–30%" — both halves are false. Never "fix" the band
   backwards.
2. **Intake is 10 fields** (8 always asked; goal-time + recent-time appear with a race), per the
   change_log supersession. Fix the stale "Intake is 8 fields" line in `CLAUDE.md`/`AGENTS.md`
   §Coaching domain, and the "eight fields" mentions in `docs/reference/coaching/00-README.md`
   and `training-zones.md`. Re-check the coaching applicability filter against the 10-field set
   (goal-time and recent-time now drive paces — confirm no rule was filtered out that these two
   fields can newly power).
3. **`src/lib/planTypes.ts` and `src/lib/loadRules.ts` exist and are canonical** (19+ tests).
   Fix `docs/architecture.md` §Current and `docs/reference/plan-generation.md`'s status header,
   which claim otherwise. When types and docs disagree, the types win.
4. **The idempotency key is real.** `GeneratePlanRequest` already requires `idempotencyKey`
   (minted when the configure modal opens). Add it to the API tables in `planning/03` and
   `docs/architecture.md`; add a `plans.idempotency_key` column with a UNIQUE
   `(user_id, idempotency_key)` index; the edge function returns the existing plan on a
   duplicate key instead of generating twice. This is what makes a network-timeout retry safe.
5. **Quota check must be atomic.** A bare count-then-insert has a TOCTOU race with a huge window
   (generation takes tens of seconds). Port Echo V1's solution: a SECURITY DEFINER RPC that
   checks the count and reserves/inserts in one transaction (see
   `react-native-supabase-practice/supabase/functions/plan-regen-gate/` and its
   `try_record_plan_regeneration` RPC for the proven pattern). N concurrent requests at
   2-of-3 quota must yield exactly one success.
6. **Quota periods are computed arithmetically at read time** from the purchase-day anchor
   (May 26 → June 26, clamped at month end: Jan 31 → Feb 28 → Mar 31). No cron, no rollover
   write. One pure function `currentPeriod(anchorDate, now)` in shared code, unit-tested on the
   month-end clamp cases, used by both `generate-plan` and `quota-status`. A user with no
   `subscriptions` row is `free`.
7. **Pro/Elite generation uses V1's token strategy** — see "How plan generation must work"
   below. Full-plan per-workout authoring of a 24–30-week plan does not fit in a model response;
   V1 already engineered around this and the V2.2 docs silently dropped it.
8. **`planTemplates.ts` is a parametric generator** ("any week count, any days/week, any starting
   mileage" — `docs/mvp-progress.md` §Next step 3), NOT the fixed "5K/10K/half/marathon ×
   8/12/16wk" matrix still described in `planning/03` and `docs/architecture.md`. Fix that
   wording. The template engine must be able to produce **every distance at any legal length**,
   because it is also the fallback for paid tiers (an Elite 26-week marathon fallback needs a
   26-week marathon template) — even though Free *users* are capped at 12 weeks/5K in the UI.
   This also resolves the apparent M3 contradiction: M3's "all three tiers produce valid plans
   for all distances" is about **engine capability**; the Free *user* cap is a UI/quota gate.
9. **Far-out races: port V1's `reconcilePlanLength`** (`react-native-supabase-practice/lib/
   planGenerator.ts:124-162`) — a race farther out than the tier's max plan length gets a
   delayed start so the taper lands on race day. Compressed races (<12wk) get an honest short
   plan ("never refuse").
10. **The `engine` enum's `ai` value is never emitted in v1.** All paid plans are
    skeleton-constrained `hybrid` (the "unconstrained Elite" design was corrected 2026-07-10).
    Annotate the enum; never branch Elite off-skeleton.
11. **Plans are never user-deletable.** Count-based quota depends on it (V1 learned this the hard
    way — a DELETE policy let users reset their count). RLS grants select/insert only. Add one
    sentence to `planning/03` §Security so a future "delete plan" feature request gets caught.
12. **Accessibility labels never say Mon–Sun.** The brief's own example ("Monday steady…") breaks
    the product's Day 1–7 rule. Composed labels read "Day 1 steady, Day 2 rest…".
13. **Split `color.progress` into two tokens.** It currently serves both "disabled" and
    "meaningful but quiet", and fails contrast in the second role (inactive tab labels 2.13:1
    dark; intake progress fill under the 3:1 non-text bar). Keep a disabled token; add a lifted
    quiet-informative token that clears 4.5:1 for text and 3:1 for meaningful non-text.
14. **The generation-reveal handoff ships as an honest crossfade in v1.** The blueprint's
    "frozen ribbon, zero transform" claim only holds horizontally; vertical geometry and the
    modal-dismiss + router-push orchestration are unsolved and are the likeliest silent
    time-sink in the build. Crossfade first; attempt the bespoke frozen-ribbon handoff only
    after M6 is otherwise done.
15. **The generating modal must have failure exits.** It is deliberately non-dismissable, so
    design and build: a client-side timeout (~90s), an error state with Retry / Cancel actions,
    and offline detection — the sealed modal must never trap a user into force-quitting.
    VoiceOver: announce step transitions and the "Still working" line via live region.
16. **Wave annotations scale by tier** (blueprint Part 9 wins over Part 7's default-Elite
    treatment): Free unlabelled beyond start/end, week markers Pro, taper annotation Elite.
17. **Sparkline bitmaps: lazy first-render rasterization, in-memory per-session cache.** No
    expo-file-system in v1.
18. **Remove `expo-glass-effect`** (installed; contradicts the no-blur depth rules).
19. **Verify the model ID live** (`claude-sonnet-5`) with a cheap API call before wiring it in.
    V1 runs `claude-sonnet-4-6`; nobody has confirmed the new string.
20. **Design the routine states the docs skipped:** plan view opened cold from My Plans
    (loading/error), My Plans list loading, Home when `quota-status` fails, intake save failure
    (offline), and routing for a signed-in user with incomplete intake (→ resume intake).

## 0-C. Decision gate — batch-ask Ian, first thing, one AskUserQuestion pass

Present these with the recommended defaults so Ian can accept or override in one sitting.
**Do not start Phase 1 with any of #1–#5 unanswered. Do not invent answers.**

1. **Paywall + Settings in the MVP?** The blueprint cut both; M4's done-definition, the 402 path,
   and the user flow require a paywall, and cutting Settings removed the only sign-out.
   *Recommended: restore a minimal dummy paywall (M4 needs it — without it nobody can become
   Pro/Elite and two-thirds of the product is unreachable) and a settings-lite screen (sign out,
   tier display, restore). The blueprint's third tab slot is already reserved for it.*
2. **Does a fallback plan burn quota?** Blueprint says never; engineering spec says plain
   count; the brief calls it open and has copy that becomes a lie one way.
   *Recommended: fallback does NOT burn quota (`is_fallback = false` filter in both
   `generate-plan` and `quota-status`), capped at 3 quota-exempt fallbacks per period so the
   free-text `notes` field can't be used to farm unlimited template plans (each costs 2 Claude
   calls). If notes-injection abuse is a worry, sanitize/limit `notes` length too.*
3. **The goal-vs-recent improvement threshold** ("large improvement → paces from recent time").
   The number does not exist anywhere and blocks every paid pace.
   *Recommendation: propose a concrete default (e.g. goal implies >8–10% improvement over the
   recent-time equivalent) but Ian must set it — it is a coaching call.*
4. **Free-tier configure gating.** Free can only reach 12 weeks/5K.
   *Recommended: Free sees all distance/length options but non-5K / over-12-week selections
   render in a locked state that routes to the paywall (honest upsell), never a dead disabled
   button.*
5. **"Next workout" / "current week" semantics.** Days are unnamed, there are no check-offs, so
   "next" is undefined for the most prominent card in the app.
   *Recommended: current week = floor(days since `created_at` / 7) + 1, clamped to plan length;
   the card shows that week's first run and is labelled as the current week's suggestion.*
6. **Red-flag injury protocol representation.** The return-to-running protocol is symptom-gated
   ("never state a week number") but a `Plan` is a fixed week array.
   *Recommended: MVP renders it as a conservative fixed-length plan whose weeks carry the
   protocol's phases, plus an `extras` PlanSection explaining progression is pain-gated, plus
   Rule 10 disclaimers. Confirm with Ian, and confirm whether it consumes quota (recommended:
   no for Free's single slot).*
7. **Elite extras** — confirm or cut. *Recommended for MVP: cut; Elite = richest prompt +
   per-workout "why" only. Extras land in `Plan.extras` later without a schema change.*
8. **"Experienced" answer maps to intermediate or advanced?** (Currently mapped down = safer.)
9. **Intermediate deload cadence: 3 or 4 weeks?** (Currently 4.)
10. **Injuries intake field shape** — schema says closed-set flags + free notes; mvp-progress
    still calls it blocked. *Recommended: confirm the schema as decided; `InjuryFlag` already
    encodes the closed set.*
11. **Rule 10 disclaimer placement.** *Recommended: static footer section on every plan view +
    one line in the generating modal's fine print.*
12. **App name** (blocks icon/wordmark/store listing — needed by M6, not before) and
    **iPad support** (*recommended: phone-only v1*), **password minimum** (*verify what the
    live Supabase project actually enforces; align sign-up copy to it*).

Once answered: `doc-writer` records every ruling + decision in `docs/change_log.md` and syncs
`planning/*` (these are Ian-authorized spec changes) before any code is written.

---

# How plan generation must work (ground truth — read twice)

This is the audited digest of Echo V1's real, shipped generation system
(`react-native-supabase-practice/lib/planGenerator.ts` + `supabase/functions/anthropic-plan/`)
merged with V2.2's design. V2.2 moves generation fully server-side, but the *mechanics* below
are proven and get ported, not reinvented.

**The V2.2 pipeline (all inside the `generate-plan` edge function):**

1. **Auth** — verify JWT, reject anon.
2. **Idempotency** — if `(user_id, idempotency_key)` already has a plan, return it. Done.
3. **Atomic quota gate** — SECURITY DEFINER RPC: tier limit (Free 1 total / Pro 3 / Elite 10 per
   purchase-anchored period), count non-fallback plans in the current period, reserve
   atomically. Over quota → `402` with a structured body.
4. **Reconcile plan length** — race date vs tier cap: compressed honest plan, or delayed start
   (V1's `reconcilePlanLength` pattern). Never refuse; a red-flag injury produces the
   return-to-running protocol, not a rejection.
5. **Build the template skeleton** — parametric, from the coaching docs via `planTemplates.ts`:
   phases, deload cadence (`deloadEveryWeeks` — age 50+ forces 3-week), weekly volumes under
   `loadRules.ts` caps, long-run progression under the share/spike/time caps, workout primitives
   from `workout-library.md`, days as Day 1–7 slots with real rest days.
6. **Free tier stops here.** Template + effort descriptions. No AI call, ever.
7. **Pro/Elite — one Claude call** (`claude-sonnet-5`, verified): the skeleton goes into the
   prompt as the fixed structure; Claude personalizes **one representative week per phase**
   (not all 24–30 weeks — V1 proved a full plan does not fit: ~9k-token brevity mandate,
   10k `max_tokens` ceiling, forced tool-call for guaranteed JSON, SSE streaming so the edge
   function isn't CPU-killed mid-response, truncation detection). Personalization = paces (only
   if a recent time exists — otherwise NO numeric pace at any tier), HR zones (from age),
   warm-ups/drills, weekly "why" (Pro) or per-workout "why" (Elite). Elite gets the richest
   prompt (injury history, race context, periodization nuance) — **still inside the skeleton**.
8. **Deterministic expander** — typed code materializes every calendar week from the
   representative weeks: scales distances along the phase's load curve, progresses the long run,
   applies per-week corrections. (V1's expander is the reference.)
9. **Clamp** — `loadRules.ts` re-checks every week: weekly increase cap, deload band 35–45%,
   long-run share/spike/time caps. Clamping a number is arithmetic, not the over-tight content
   validation that hurt V1. The model cannot emit an unsafe week because this code rejects it.
10. **Validate structurally, loosely** — shape only: weeks exist, days are 1–7, types right.
    A plan can be substantively fine while failing a narrow content check — V1's core lesson.
    Fail → **retry once**. Fail again → **fall back** to the pure template plan,
    `is_fallback: true`. A fallback renders at Free density (a template has no "why" —
    fabricating one would lie).
11. **Insert** `plans` row (immutable JSONB, `tier_at_generation`, `engine`, `is_fallback`,
    `idempotency_key`) and return `{ plan, planId, isFallback }`.

**What V1 learned that must not be re-learned:** loose structural validation (tight content
checks caused MORE bad fallbacks); atomic quota RPC (count-then-insert races); tamper-proofing
(no plan deletion); single source of truth for tier limits (V1 hand-duplicated them across
three files with "KEEP IN SYNC" comments and they drifted — V2.2 puts them in ONE shared
constant imported everywhere); in-flight dedupe (idempotency key covers this).

---

# Build phases — the subagent orchestration

Use the named subagents below (they exist at user level). Dispatch in parallel where marked ∥.
Every phase ends: `verifier` → fix → `code-reviewer` on the diff → fix → `doc-writer` sync →
`github-ops` PR.

## Phase 1 — Plan engine on a screen, no backend (M3 seed; critical path steps 3–5)

The demoable core: a real template plan rendered on a real screen, zero network.

1. `feature-planner` ∥ `design-system`:
   - `feature-planner`: file-by-file plan for `src/lib/planTemplates.ts` — the parametric
     template generator (5K first, then 10K/half/marathon), consuming `planTypes.ts` +
     `loadRules.ts` + the coaching docs. Include the pace-derivation module (recent-time →
     training paces via `training-zones.md`; goal-time → race-pace sessions only; the Phase-0
     threshold clamp).
   - `design-system`: rewrite `src/constants/theme.ts` — this is a **structural rewrite, not a
     value swap** (surfaces, hairline, the five effort hues with verified contrast, hivis,
     `grid.*` tokens, motion durations/curves, radius, spacing ramp with the 48 step,
     `six`→`seven` rename); bundle Barlow Condensed / Inter / IBM Plex Mono via
     `npx expo install`; remove `expo-glass-effect`; delete the stock template screens
     (including "Aanya's baby" at `src/app/index.tsx:38`).
2. `implementer` executes the planTemplates plan (with `scope-guard` wrapping the handoff);
   `test-writer` in parallel: golden tests per distance × duration × days/week × experience;
   property test — every generated week passes every `loadRules.ts` clamp; deload weeks reduce
   35–45%; no numeric pace without a recent time.
3. `frontend-builder`: plan view (`plan/[id]` reading a local fixture for now) — nameplate,
   week ribbon rows (colour + monotonic height, rest gaps, unbroken baseline), expanded
   workout rows with readout brackets only on measured numerals. Skip the wave until Phase 6
   (it's first on the blueprint's own cut list).
4. Gate: a 12-week 5K template plan renders fully, honestly, from tokens.

## Phase 2 — The spine (M1; step 6)

1. `env-config-manager`: `supabase login` + `supabase init` (no `config.toml` exists — the
   comment in `supabase/functions/.env` claiming otherwise is false), link project
   `vvvcaulmbwbujeszfvbo`, `supabase secrets set ANTHROPIC_API_KEY` (never yet run), verify the
   deep-link scheme is on the Supabase redirect allowlist.
2. `database-engineer`: migrations in `supabase/migrations/` for `profiles` (+ auth trigger),
   `intake_responses`, `subscriptions`, `plans` (with `idempotency_key` + unique index);
   RLS on every table (select/insert own rows; **no delete/update on plans**; tier writes
   service-role only); the atomic quota RPC. Then run the Supabase security advisors and get
   them clean.
3. `supabase-auth`: sign-in/sign-up screens per the blueprint (Google OAuth with deep-link
   return, **Apple Sign-In — App Store-mandatory, currently unconfigured**, email/password),
   session routing: signed-out → auth; signed-in without intake → intake; else → tabs.
4. `security-auditor` (read-only pass): RLS, quota bypass, secrets posture.
5. Gate (M1 done): a new user creates an account and lands on an empty Home.

## Phase 3 — Intake (M2; step 7)

1. `ux-copywriter` ∥ `feature-planner`: the copy deck covers only Q1–Q7 — write the missing
   goal-time and recent-time question copy (the flow's most complex controls), fix the
   "Question 3 of 7" example (total is 8, or 10 with a race), Day 1–7 accessible labels.
2. `frontend-builder`: the 10-question flow + review screen per the blueprint (steppers with
   the numeral-readout identity, progress hairline as a ruler, review manifest with inline
   Edit), upserting `intake_responses` (handle the offline-save failure state from Ruling 20).
3. `accessibility-implementer`: progressbar role + "Question n of total" name, 48pt targets,
   stepper interruptibility, reduced-motion variants.
4. Gate (M2 done): intake answers survive logout/login.

## Phase 4 — `generate-plan` (the heart; M3 + M4 server half; step 8)

1. `api-designer`: finalize the contract — `idempotencyKey` in the body, the error taxonomy
   (`402` over-quota, `403` anon, `409` in-flight duplicate, timeout semantics, structured
   `{ error, code }`), `quota-status` invocation method, and the configure-time race fields
   (race distance/date/goal-time travel per-generation; intake's stored race is a default,
   not the authority — they must never silently disagree).
2. `prompt-engineer` ∥ `jobs-queues-edge`:
   - `prompt-engineer`: the Pro/Elite system prompt — skeleton-in-prompt, representative-week
     output contract (forced tool call), token budget, brevity mandate, tier-differentiated
     personalization depth, injury context (`injuryNotes` informs, never gates safety),
     coaching content sourced ONLY from the ported docs.
   - `jobs-queues-edge`: the edge function per "How plan generation must work" above —
     streaming, truncation detection, retry-once, template fallback, clamp, atomic RPC,
     idempotent replay. Plus `purchase-tier` and `quota-status` (same period function, same
     fallback filter).
3. `llm-eval`: an eval harness with fixture intakes (beginner/50+/injured/no-recent-time/
   compressed-race/far-race × tiers) asserting: structural validity rate, clamps trigger
   correctly, zero numeric paces without a recent time, deload weeks in band, fallback path
   fires on forced-invalid output. Run it before calling M3 done, and on every prompt change.
4. `test-writer` ∥ `mocks-testdata`: unit tests for the expander, validator, period arithmetic
   (month-end clamps), quota RPC (concurrent-request test); fixtures for all of it.
5. `security-auditor`: notes-field prompt injection, quota bypass, fallback farming, key
   exposure. `ai-cost-optimizer` (read pass): token spend per generation at each tier.
6. Gate (M3 done): all three tiers produce valid, complete, clamped plans for every distance
   and fixed-duration goal; a malformed AI response never reaches the user.

## Phase 5 — Tiers, quota UI, paywall, My Plans (M4 + M5; steps 9–10)

1. `frontend-builder` ∥ `ux-copywriter`: Home quota pips + captions (honest per the Phase-0
   fallback ruling), configure modal with tier gating (Phase-0 decision #4), dummy paywall +
   settings-lite (per decision #1) wired through `purchase-tier`, My Plans list (flat cards,
   date ranges, no sparkline until Phase 6).
2. Copy rule: Free never sees "this month" (Free is 1 total, not monthly); the fallback card's
   quota sentence must match the actual server behavior decided in Phase 0.
3. Gate (M4+M5 done): quota can't be bypassed by the client; paywall shows at the right
   moments; every plan is retrievable after an app restart.

## Phase 6 — Motion, polish, TestFlight (M6; step 11)

1. `motion-animation`: the generation reveal (blueprint Part 6 — client-timeline theatre with
   400ms floors, gated on timeline AND response; cascade with `springSnappy`; colour flip in
   the compression trough; single haptic; honest-crossfade handoff per Ruling 14; full
   reduced-motion paths incl. Android's manual crossfade forcing). The wave + sparklines only
   if schedule allows — they're the top of the blueprint's own cut list, and Skia enters the
   dependency set only here.
2. `responsive-crossdevice` ∥ `accessibility-reviewer`: small phones, safe areas, font scaling;
   then `accessibility-implementer` fixes the reviewer's findings.
3. `ux-copywriter`: empty states, every error state from Ruling 20, offline copy.
4. Run the `frontend-audit` skill; feed findings to `fix-batch`.
5. `mobile-release`: `eas init`, new bundle ID, icon/splash (needs the app name from the
   decision gate), TestFlight build.
6. Final gate (M6 done): a stranger can go sign-up → plan without a dead end. Then run the
   `full-audit` skill once over the finished codebase and fix HIGHs before inviting testers.

---

## Cherry-pick map (copy from Echo V1, never into it)

`/Users/Guestyyyyyyyy/Desktop/react-native-supabase-practice` is frozen. Reference, adapt, port:

| V1 source | What to take |
|---|---|
| `lib/planGenerator.ts` | `reconcilePlanLength` (delayed start / compression), the representative-week expander, `validateAIPlan`'s loose-validation shape, per-week correction passes |
| `supabase/functions/anthropic-plan/index.ts` | SSE streaming proxy pattern, `max_tokens` ceiling, forced tool-call, truncation detection |
| `supabase/functions/plan-regen-gate/` | The atomic SECURITY DEFINER RPC pattern (TOCTOU fix), single-use consume tokens |
| `lib/subscription.ts` | Tier read + dummy-purchase flow shape (V2.2 version is server-authoritative) |
| Onboarding/intake screens | Question flow patterns, extended to the 10-field set |

**Do not port:** V1's client-side generation (V2.2 is server-side), V1's hand-duplicated tier
limits (one shared constant instead), V1's calendar-month quota (V2.2 anchors to purchase day).

## What NOT to do

- Don't tighten validation beyond structure. Don't let any agent "improve" the validator with
  content rules — that regression is documented in three places for a reason.
- Don't remove or weaken the template skeleton for Elite. Ever.
- Don't invent coaching numbers, ultra-distance content, or an eleventh intake field.
- Don't build the sand-man, the CTA gradient, per-card sparkline reveals, or scroll-linked
  motion in v1.
- Don't start Phase 1 before Phase 0's decision gate is answered.
- Don't trust `docs/architecture.md` §Current or `plan-generation.md`'s status header until
  Phase 0-B ruling 3 has fixed them — `docs/mvp-progress.md` is the truth tracker.
