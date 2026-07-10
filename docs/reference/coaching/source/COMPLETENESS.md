# Coaching source library — completeness audit

**Audited 2026-07-10**, against one question: *could a professional, commercial-grade
training-plan generator be built from these six files alone?*

**Short answer: no — not for the paid tiers.** The library is strong on safety rails,
session anatomy, deloading, and coaching philosophy, and weak exactly where a generator
does its actual work: deriving paces, constructing week-by-week progressions from rules
rather than examples, and tapering. A Free-tier plan (week structure + HR zones from age
+ RPE/effort descriptions, no pace targets) is buildable today. Pro and Elite sell
"pace targets" — those are blocked outright until gap #1 is filled.

Every gap below also exists as an inline `> ⚠️ **GAP — NEEDS IAN:**` annotation at the
exact spot in the source file where it bites. Grep for `GAP — NEEDS IAN` to find them all.

---

## What a commercial-grade generator needs

1. **Pace derivation** — a function from a recent race result to easy / tempo / interval /
   long-run / goal-race paces.
2. **Progression rules** — weekly volume growth, long-run growth, session selection and
   ordering, parameterized by experience level × race distance × days available.
3. **Phase-construction rules** — phase lengths and intensity distributions as functions of
   total program length, not fixed examples.
4. **Deload rule** — cadence and depth.
5. **Taper rule** — length and shape as a function of race distance.
6. **Safety clamps** — volume caps, long-run caps, hard-session spacing, illness/injury
   modifications, age adjustments.
7. **One authoritative zone model** — HR percentages, RPE mapping.
8. **Edge-case rules** — race too close, goal unrealistic for current fitness, runner
   profile outside the tier bands, ultra distances.

## What the library has (genuinely solid)

- **Safety rails** (`load_rules.md`): 10-15% weekly increase cap (now correctly labelled a
  coaching convention, not "verified"), per-level ceilings for weekly volume / longest run /
  hard sessions (Rule 4), 48-hour hard-session spacing, illness protocols with concrete
  return percentages, return-from-break table, altitude rule, mandatory disclaimers.
  This is exactly the deterministic clamp layer `CLAUDE.md` demands, and it is complete
  enough to ship for standard road distances.
- **Deload** — now fully consistent after the 2026-07-10 ruling: every 3-4 weeks
  (3 mandatory at 50+), 35-45% volume reduction, with worked deload weeks for 3-, 5-, and
  6-7-day runners (`workout_library.md` Part 3).
- **Experience-level definition** — ruled: volume-primary (≤30 km beginner, >30 and <70
  intermediate, ≥70 advanced), years as secondary signal, volume wins, app confirms.
- **Session anatomy** (`workout_library.md` Part 1): nine running session types with
  structure, HR/RPE targets, durations, warm-up/cool-down, and coaching cues. A generator
  can assemble any individual day from this.
- **Intensity distribution**: per-level weekly zone percentages and per-phase distributions
  (`training_zones.md`), 80/20 emphasis (now correctly labelled pyramidal).
- **Periodization skeleton**: McMillan 4-phase macrocycle with typical week ranges;
  program-length recommendations per distance (Customization Guidelines).
- **Three complete worked plans** — beginner 5K, intermediate 10K, advanced marathon —
  usable as validation fixtures for generated output.
- **Injury and illness response logic** (`injury_flags.md`): usable by the app only through
  its volume/intensity levers; fully usable by the coaching business.

## What it lacks — ranked by how badly each blocks a working generator

| # | Gap | Why it blocks | Where annotated |
|---|-----|---------------|-----------------|
| 1 | **No pace derivation. Anywhere.** Tempo is defined as "45-60 sec/km faster than easy pace" — and easy pace has no formula. No VDOT table, no equivalent-performance chart, no McMillan calculator. | **Total blocker for Pro/Elite.** From a recent 5K time the app can compute goal race pace (arithmetic) and HR zones (age), but not one training pace. Every session in the library that names a pace is unreachable. | `workout_library.md` § Tempo › Pace Guidance |
| 2 | **Worked examples instead of construction rules.** Three plans, no half-marathon example, no per-level variant of any distance. Example 1's weekly totals don't even equal the sum of its listed days (~3-6 km overshoot every week); Example 2's header says 16 weeks but schedules 15. | A generator needs rules, not exemplars — it cannot safely interpolate a 4-day intermediate half-marathon plan from a 3-day beginner 5K plan and a 6-day advanced marathon plan. The internal inconsistencies also poison the examples as validation fixtures until resolved. | `ECHO_Training_Plans_McMillan.md` (top, Example 1 header, Example 2 header) |
| 3 | **No taper rule.** Taper exists only inside the worked examples (1 week for 5K, ~2 for 10K, ~3 for marathon), while `training_zones.md` Phase 4 says a flat "final 2 weeks, 50% of peak." | Every plan ends in a taper; the generator has no rule to build one, and the partial rule contradicts the examples. | `ECHO_Training_Plans_McMillan.md` § General Principles; `training_zones.md` § Phase 4 |
| 4 | **Long-run growth contradiction.** "1-2 km per week max" (absolute) vs Ian's separately stated "10-20%" (relative). They agree only near a 10 km long run. | Long-run progression is the spine of every distance plan; the generator cannot pick a side without inventing coaching. | `ECHO_Training_Plans_McMillan.md` § General Principles |
| 5 | **Short-runway races: ruling without rules.** Ian ruled: never refuse — build a short race-specific plan with a taper week. But nothing says at what runway it becomes taper-only, which phases drop first, or what intensity is safe with no base. | This is a common real-world intake (race in 4 weeks). The ruling prevents refusal; the missing rules prevent construction. | `ECHO_Training_Plans_McMillan.md` § Customization › Goal Race |
| 6 | **Two competing zone models.** Z3/Z4 boundaries differ between `training_zones.md` (80-87 / 87-95%) and `ECHO_Framework_CORRECTED.md` (80-90 / 90-95%); Zone 2's physiology is described differently. | Free tier's core deliverable is HR zones; the library gives two answers. Trivial for Ian to rule on, embarrassing to ship inconsistently. | `training_zones.md` § Zone Overview; framework § Pillar 4 |
| 7 | **No goal-realism check.** Nothing links a runner's recent result to an achievable goal at another distance, so the app cannot flag a fantasy goal (25-min 5K runner asking for a sub-3 marathon) — it would just build the plan. | Same missing artifact as #1: equivalent-performance tables would fix both. Until then, plans can be built around impossible paces. | (covered by #1's annotation) |
| 8 | **Stress-fracture guidance keyed to the wrong variable.** Timelines keyed to experience tier (with two contradictory rationales, plus a third age-keyed table); evidence keys to fracture site and grade — metatarsal shaft ~6-8 wk, navicular / femoral neck 4-6 months minimum. | Less a generator blocker than the library's highest-severity safety item: a tier-based number can return a high-risk fracture months early. Annotated prominently; output must defer to the treating clinician. | `injury_flags.md` Parts 1, 2, 3 |
| 9 | **No ultra content.** Rule 4's ceilings (110 km/week, 35 km longest run, "marathon-specific only") structurally cannot express an ultra plan. | Blocks the planned v2 ultra scope entirely; harmless until then, but nothing is extrapolable. | `load_rules.md` Rule 4 |
| 10 | **Minor unresolved inconsistencies.** Beginner deload every 4 weeks (`load_rules.md`) vs every 4-5 weeks (`workout_library.md`). | One-line ruling each; only matter because a deterministic engine must pick exactly one value. | `workout_library.md` § Deload Frequency by Runner Type |

## What would unblock, concretely

- **From Ian, one artifact:** the pace tables or McMillan-calculator method he actually uses
  to derive training paces from a recent race result. Fixes #1 and #7 — the only gaps that
  hard-block a paid tier.
- **From Ian, one page of construction rules** per distance × level (phase lengths, session
  mix per week, progression and taper formulas). Fixes #2, #3, #5.
- **From Ian, four one-line rulings:** long-run growth (#4), authoritative zone boundaries
  (#6), beginner deload cadence (#10), and Example 1's totals-vs-days / Example 2's
  16-vs-15-weeks (#2's inconsistencies).

Everything else in the library — safety clamps, deload, session anatomy, distribution — is
already generator-ready for standard road distances.
