# Free-tier library engine — open coaching questions

**Status:** awaiting Ian's rulings. Six numbered questions, each answerable directly.
**Raised:** 2026-09-09, while building the Free tier's 40-plan deterministic engine
(`src/lib/planLibrary/`) from `planning/research/plan-blueprint-examples.md`.
**Code counterpart:** every provisional answer below is a single constant or function in
[`src/lib/planLibrary/openQuestions.ts`](../../../src/lib/planLibrary/openQuestions.ts), keyed by
the same `Q` number. Nothing else in `planLibrary/` guesses — when an answer lands, that file and
this doc are the only two places that change.

## Why this file exists

The captain's ruling of 2026-09-06 makes the 40-plan library the Free tier's entire product, and
`AGENTS.md`'s standing rule is that **coaching content is never invented**. The source document
specifies the register, the doses, the layouts, the volume states, the long-run ladder, the four
week-by-week calendars, the injury modules, and the resolution order — all of which are now ported
and tested. Six decisions the engine cannot avoid making are *not* in it. They are collected here
rather than guessed at in code.

Each question states what the source document does say, what it does not, what the engine does
today, and what a one-line answer would change.

---

## Q1 — Free-tier eligibility for intake the register does not cover

**The document says.** § 1 registers 40 plans across exactly four race distances. § 8's "No target
race date" branch says to "run the base/build portion for the **selected distance**".

**It does not say.** What a Free user gets when intake names no target distance at all — a pure
duration goal ("I want to train for 12 weeks") with the race-distance question left blank. The
register has no plan for them, and § 8's no-race-date branch still needs a distance to select a
calendar.

**Today.** The engine reports the request as uncovered and the caller keeps the existing generic
template engine (`buildTemplatePlan`) for it. No library plan is invented.

**The question.** For a Free user with a duration goal and no target distance, should the engine
(a) run the 10K calendar's base/build portion as a default general-fitness block, (b) require a
target distance before generating on Free, or (c) keep the current generic template engine for that
one case?

---

## Q2 — SPD/END classification thresholds

**The document says.** § 7 classifies on "a recent performance at **two** distances", on one being
"materially stronger" than its predicted equivalent, and on a self-reported answer about fading as
duration rises / difficulty changing gears. It also states its own fallback: "Only one result,
conflicting evidence, or no usable evidence → conservative default: `END` lane, but first
occurrence of every fast workout is reduced one dose."

**It does not say.** What "materially stronger" is numerically (a percentage off the Riegel
equivalent?), nor which self-report wording the intake should carry.

**Today.** Intake captures at most **one** recent performance and no fading/gear-change answer, so
every runner takes § 7's own documented conservative default: the `END` lane, first fast dose
reduced. All 20 `SPD` plans are built and tested but no live intake can currently select one.

**The question.** (a) What percentage difference from the Riegel-predicted equivalent counts as
"materially stronger"? (b) Should intake add a second recent performance and the fading/gear-change
question, so the `SPD` half of the register becomes reachable — and if so, is the self-report alone
ever sufficient without two results?

---

## Q3 — Exact shorter / longer / no-race-date calendar transforms

**The document says.** § 8 gives rules in prose: never delete race week or the final taper
exposure; remove early repeated loading weeks "only when the runner already demonstrates the
required base and recent-long-run capacity"; otherwise retain preparation and remove later
ambitious workouts; under four weeks, easy running plus one brief reminder plus taper/race; extend
by adding `ENTRY/LOAD/RECOVERY` base cycles before canonical Week 1, repeating only aerobic
foundation work.

**It does not say.** What numeric test "already demonstrates the required base" is, nor the exact
order in which weeks are dropped once that test passes or fails.

**Today.** `deriveReadinessPath`'s captain-approved `prepared` verdict is used as the test: a
`prepared` runner loses the earliest removable loading weeks first; a `first-timer` keeps the
preparation block and loses the later ambitious weeks instead. Extension repeats canonical weeks
1–4 (the `ENTRY`/`LOAD-1`/`LOAD-2`/`RECOVERY` base cycle) and nothing else.

**The question.** Is `deriveReadinessPath`'s `prepared` verdict the right test for "demonstrates
the required base"? If not, what is — a weekly-kilometre floor, a recent-longest-run floor, or
both? And when a `prepared` runner's plan must shorten, is dropping the earliest loading weeks the
order you want, or should the recovery weeks go first?

---

## Q4 — Numeric-range and workout-collision tie-breaks

**The document says.** § 5 names a target inside the band for `ENTRY` (0.90), the loading states
(1.00/1.08), and `RECOVERY`. § 9 defines `LR-low`/`LR-mid`/`LR-high`/`LR-peak` precisely as
quarters of the ladder range. § 6 caps `REG` at 4–5 days "unless already stable at six".

**It does not say.** A target inside `HOLD` (95–100%), `TAPER-1` (70–80%), `TAPER-2` (55–65%), or
`RACE-WEEK` (40–60%). What "if eligible" / "for eligible runners" means in the § 11–14 calendar
cells. What test makes a `REG` runner "already stable at six" days.

**Today.** An unnamed band takes its **midpoint** — arithmetic, not a new coaching number.
"Eligible" means the track's § 4 quality policy *normally* allows two sessions, i.e. `EXP` and
`COMP`: `REG`'s second session is "only after demonstrated tolerance" and intake reports no
tolerance signal. A `REG` runner asking for six days is clamped to five and the extra day becomes
rest — the direction § 6 already takes for `NEW`.

**The question.** (a) Are midpoints right for `HOLD` and the two tapers, or do you want a named
point in each? (b) Is "eligible" = `EXP`/`COMP`, or should a `REG` runner above a stated weekly
volume also qualify? (c) Is there a test that makes a `REG` runner "stable at six", or should the
five-day clamp stand?

---

## Q5 — H0–H4 derivation from the intake the app actually collects

**The document says.** § 15 requires six fields before any module applies: location, status
(past/resolved · returning/cleared · active/stable · active/worsening), pain 0–10 at rest / during
/ after / next morning, running impact, red-flag symptoms, and professional instruction. § 16
branches on all six. It also says free text "never changes numeric training rules by itself".

**It does not say.** How to branch when only some of those fields exist.

**Today.** `IntakeResponses` carries only the closed-set `injuries: InjuryFlag[]` and free-text
`injuryNotes`. So: **no declared injury → `H0`; any declared injury → `H1`** ("cautious history"),
the mildest branch that still applies a module. `H2`, `H3`, and `H4` are fully implemented and
tested — including `H4`'s no-running output and its non-overridable disclaimer — but no live intake
can evidence them, so no live plan reaches them. The engine never guesses a worse state than intake
supports, and never a better one than a declared injury implies.

**The question.** (a) Should intake collect § 15's six fields before Free ships, so the state
machine becomes reachable? (b) Until then, is `H1` for any declared injury the right conservative
default, or should a declared injury with no further evidence sit at `H0` with the module's "recent
history starts speed and hills one dose lower" treatment instead?

*(All seven modules ship in v1 with the library's stated disclaimers, per your 2026-09-06 ruling,
despite § 21's unticked "qualified clinical review of injury branching". That is settled and is not
what this question asks.)*

---

## Q6 — Notation and effort mapping for the seven codes `notation.md` has no label for

**The document says.** § 3 defines 20 workout codes, with an explicit RPE for four of them: `REC`
(2–3), `E` (3–4), `AER` (4–5), `LR` (3–4). The rest carry prose ("comfortably hard, even, never a
time trial"; "current-fitness VO2/5K effort").

**It does not say.** How those codes render in the app's own notation. `notation.md` (your
2026-07-11 notation ruling) defines nine labels — `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`,
`Strides`, `Race Day`. Seven library codes have none: `AER`, `MLR`, `FF`, `HS`, `F`, `H`, `TU`.

**Today.** Each library code maps onto an existing `notation.md` label and an `EffortLevel` read
from § 3's own intensity column where it states one. No new abbreviation is minted, because a new
notation entry is a notation ruling, not an engine decision. The mapping that needs your eye:

| Library code | Rendered label | Effort | Read from |
|---|---|---|---|
| `AER` | `ER` | steady | § 3 "RPE 4–5" |
| `MLR` | `ER` | steady | § 3 "longer than ordinary easy, shorter than Day 7" |
| `F` fartlek | `TR` | tempo | § 3 "controlled timed efforts" |
| `H` hill reps | `TR` | tempo | § 3 "controlled strength/economy work, not sprinting" |
| `HS` hill sprints | `ER + Strides` | easy | § 3 "8–10 seconds, full walk-back", never all-out |
| `FF` fast finish | `LR` | steady | § 3 "final portion controlled" |
| `TU` tune-up | `RP` | interval | § 3 "controlled race or time trial" |
| `RP10` | `RP` | interval | § 3 "realistic 10K goal pace" |
| `HMP` | `RP` | tempo | § 3 "realistic HM effort" |
| `MP` | `RP` | steady | § 3 "realistic marathon effort" |

**The question.** (a) Are those ten mappings right, in particular `MP` as *steady* and `RP10` as
*interval*? (b) Do you want new `notation.md` abbreviations for `AER`, `MLR`, `FF`, `HS`, `F`, `H`
and `TU` instead of reusing the nearest existing label — and if so, what are they?

---

## What is already settled and not asked here

These came with the task and are implemented as ruled — listed so no one re-opens them:

- **Recovery-week depth is 15–25%, target 20%.** The source library's own "35–45% / target 40%"
  lines are stale and have been corrected in place in `planning/research/plan-blueprint-examples.md`
  (§ 2 rule 7, § 5's `RECOVERY` row, and "Resolved for the V1 library" item 4).
  `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`MAX` stay authoritative and were not changed.
- **All seven injury modules ship in v1** with the library's stated disclaimers, despite § 21's
  unticked clinical-review box.
- **A race date that cannot be safely prepared for reports limited preparation** — never
  compression, never a violated cap.
- **§ 22's disclaimers are mandatory on every plan**, plus the H1–H4 disclaimer where § 22
  specifies it.
