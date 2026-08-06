# Under-18 HR-zone replacement — design

**Status:** captain-approved (§6-A, `v22-youth-policy-research-s1` report), 2026-08-06. Authored
autonomously by the `fm/v22-youth-hr-replacement-r1` crewmate task — no live interactive design
round was available, so this documents the alternatives weighed and the reasoning, in place of a
turn-by-turn brainstorming transcript. No fork below rose to a genuine open question for the
captain; see "Escalation check" at the end.

## The question

The report's item A (approved; items B–D explicitly declined) says: for `age < 18`, never emit
`hrZone`. It deliberately stops short of naming a replacement mechanism, floating RPE and
talk-test as candidates and explicitly rejecting a "better" age formula (208 − 0.7×age) as
replacing one unreliable number with another. This task's brief requires "a different intensity-
guidance mechanism — not just deleting the HR zone display with nothing in its place," and asks
for the alternatives to be weighed, not assumed.

## Alternatives considered

**A. RPE (rate of perceived exertion), 1–10 Borg-derived — recommended.**
`docs/reference/coaching/training-zones.md` § RPE scale already ports Ian's `training_zones.md`
**verbatim**, mapping RPE 1–10 to the same five zones the app already prescribes, plus a "Feel"
description column per row. This table exists in the repo today and is completely unused by any
code path. Using it means the youth replacement invents zero new coaching content — it activates
sourced content that was ported but never wired in.

- Needs no equipment. A youth runner is *less* likely than an adult to own a HR monitor; RPE is
  the only one of the three candidates that removes the equipment dependency entirely rather than
  just removing an unreliable formula.
- Structurally a drop-in: every place `hrZone` is threaded today (`paidFields` in
  `planTemplates.ts`, the `ReadoutBracket` in `WorkoutRow.tsx`, the spoken label in `format.ts`)
  already carries a single small integer alongside `pace`. RPE is the same shape — one field,
  same call sites, same UI slot.
- Each workout type in `planTemplates.ts` already hardcodes one of zones 1/3/4 (easy/long,
  tempo, interval). Of the RPE scale's ten rows, exactly the ones mapping to a *single* zone
  (not a "Z1–Z2" transitional row) are usable as a direct substitute — and 1, 3, and 4 all have
  one (RPE 3, 7, 8 respectively). No new judgment call is needed; the table already answers it.

**B. Talk-test-based effort zones.**
Genuinely simpler for a runner with zero training in self-rating, and it's a real coaching
construct. Rejected for this pass because the ported coaching library (`docs/reference/coaching/`)
has no talk-test content to port — building it out would mean inventing coaching thresholds
("can speak full sentences" vs "a few words" mapped to which effort levels), which is exactly what
`CLAUDE.md` forbids without Ian ruling on it directly. RPE needed no such invention.

**C. Pace-only, no explicit intensity label.**
Already the free-tier behavior (`paidFields` returns `{}` when `density !== 'paid'`), and the
report's §6-A recommendation text itself calls "effort- and pace-based prescription... the correct
substitute" in the same breath as recommending suppression — but the task brief is explicit that
"just deleting the HR zone display with nothing in its place" does not satisfy the requirement, so
this is out regardless of its coaching merit. It's also strictly worse for the runners this policy
protects: `pace` requires a `recentPerformance` at intake, which is optional, so a runner who
skipped that field would get *no* intensity signal at all on paid tiers, only `effortDescription`
prose — a worse floor than an adult on the same tier gets.

**D. A "better" age formula (208 − 0.7×age).**
Explicitly rejected by the report itself (§6, "What I deliberately did not propose") — swapping
one unreliable age-derived number for a less-unreliable one still implies a precision the evidence
doesn't support, and doesn't resolve the more fundamental point (four sources agree HR-zone
*prescription* itself, not just the formula, is inappropriate for youth). Not seriously considered.

## Decision

**RPE (option A).** New optional field `Workout.rpe?: RpeValue` (`1–10`), parallel to `hrZone`,
populated by a new `rpeForZone(zone: HrZone): RpeValue` lookup in `loadRules.ts` sourced directly
from the already-ported RPE table. `paidFields` in `planTemplates.ts` picks `hrZone` or `rpe`
based on `isUnder18(age)`, never both. Rendering: `WorkoutRow.tsx`'s bracket shows `RPE N` in the
same slot `Zone N` occupies today; `format.ts`'s spoken label says "perceived effort N out of 10"
in place of "heart rate zone N". Adult plans are untouched — same `hrZone`, same bracket text, same
spoken label as before this change.

## Escalation check

Is there a genuine fork here for the captain? No single item cleared the bar:

- The mechanism choice (RPE vs. talk-test vs. pace-only) has one candidate that needs zero new
  invented coaching content and fits the existing rendering pipeline without new UI; the other two
  either require inventing content the library doesn't have (talk-test) or were already ruled out
  by the task brief itself (pace-only-with-nothing-else) or the report (a new age formula). This
  converges on its own.
- The RPE→zone mapping for the three zones the engine actually prescribes (1, 3, 4) is a direct
  read of an existing verbatim-ported table, not a new coaching judgment call.

If a future change wants to prescribe zone 2 or 5 for a youth workout (neither happens today), the
same table already has an answer (RPE 5, RPE 10) — no new escalation needed then either.
