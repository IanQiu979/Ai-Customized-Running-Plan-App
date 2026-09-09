# Free-tier library engine — the six coaching decisions, and Ian's rulings

**Status: all six answered (Ian, 2026-09-10).** Nothing on this page is open.
**Raised:** 2026-09-09, while building the Free tier's 40-plan deterministic engine
(`src/lib/planLibrary/`) from `planning/research/plan-blueprint-examples.md`.
**Code counterpart:** every ruling below is a single constant or function in
[`src/lib/planLibrary/openQuestions.ts`](../../../src/lib/planLibrary/openQuestions.ts), keyed by
the same `Q` number. Nothing else in `planLibrary/` holds a coaching value the source document does
not state — a seventh decision means a seventh question to Ian in the same commit.

*(The filename is kept so the links already pointing here from `docs/change_log.md` and `AGENTS.md`
keep working. Read it as "the questions the library left open, and how they were answered".)*

## Why this file exists

The captain's ruling of 2026-09-06 makes the 40-plan library the Free tier's entire product, and
`AGENTS.md`'s standing rule is that **coaching content is never invented**. The source document
specifies the register, the doses, the layouts, the volume states, the long-run ladder, the four
week-by-week calendars, the injury modules, and the resolution order. Six decisions the engine
cannot avoid making are *not* in it. They were collected here rather than guessed at in code, and
answered a day later.

Each entry keeps the question as it was put, so a future reader can see what was actually decided
and on what evidence.

---

## Q1 — Free-tier eligibility for intake the register does not cover

**The document says.** § 1 registers 40 plans across exactly four race distances. § 8's "No target
race date" branch says to run the base/build portion for the **selected distance**.

**It does not say.** What a Free user gets when intake names no target distance at all — a pure
duration goal with the race-distance question left blank.

**Ruling (2026-09-10).** **Require a target distance before generating on Free.** Do not default to
the 10K calendar. A duration-only Free user without a distance is not served by the library engine.

**As implemented.** `buildLibraryPlan` returns the `no-race-distance` coverage gap, and
`workers/src/lib/planEngine.ts` turns that into an `invalid_request` carrying
`NO_RACE_DISTANCE_MESSAGE`, which names the fix. The flow releases the quota reservation before
returning, so the refusal costs nothing — which matters, because Free's allowance is one plan for
life. It deliberately does **not** fall through to `buildTemplatePlan`: that would put a Free user
back on the paid tiers' skeleton and undo the 2026-09-06 tier split.

**What this changed.** The captain's 2026-08-15 "the race stage should be optional" report now
applies to the **paid tiers only**. A race *date* remains optional on every tier; it is the
distance, not the booking, that Free requires. Intake asks for a target distance already, so this
is an edge case — but the client could refuse earlier and more kindly than the server does.

---

## Q2 — SPD/END classification thresholds

**The document says.** § 7 classifies on a recent performance at **two** distances, on one being
"materially stronger" than its predicted equivalent, and on a self-reported answer about fading as
duration rises / difficulty changing gears. It also states its own fallback: "Only one result,
conflicting evidence, or no usable evidence → conservative default: `END` lane, but first
occurrence of every fast workout is reduced one dose."

**It does not say.** What "materially stronger" is numerically.

**Ruling (2026-09-10).** **5%.** A result 5% or more faster than the Riegel-predicted equivalent
counts as materially stronger for `SPD` classification. Banked for when intake is expanded to two
performances; `SPD` stays unreachable until then, and that is expected.

**As implemented.** `SPD_MATERIALLY_STRONGER_PCT = 0.05`, exported and pinned by a test that also
records why nothing consumes it yet. Every runner takes § 7's conservative default — the `END` lane
with the first occurrence of each fast workout reduced one dose. All 20 `SPD` calendars are built
and tested; only the classifier is missing, and it needs an intake field, not a coaching decision.

---

## Q3 — Exact shorter / longer / no-race-date calendar transforms

**The document says.** § 8 gives rules in prose: never delete race week or the final taper
exposure; remove early repeated loading weeks "only when the runner already demonstrates the
required base and recent-long-run capacity"; otherwise retain preparation and remove later
ambitious workouts; under four weeks, easy running plus one brief reminder plus taper/race; extend
by adding `ENTRY/LOAD/RECOVERY` base cycles before canonical Week 1.

**It does not say.** What numeric test "already demonstrates the required base" is.

**Ruling (2026-09-10).** **Keep `deriveReadinessPath`'s `prepared` verdict as the test — approved
as implemented, no new threshold.**

**As implemented.** A `prepared` runner loses the earliest removable loading weeks first; a
`first-timer` keeps the preparation block and loses the later ambitious weeks instead. Extension
repeats canonical weeks 1–4 (the `ENTRY`/`LOAD-1`/`LOAD-2`/`RECOVERY` base cycle) and nothing else.
Race week and the final taper survive every shortening.

---

## Q4 — Numeric-range and workout-collision tie-breaks

**The document says.** § 5 names a target inside the band for `ENTRY` (0.90), the loading states
(1.00/1.08), and `RECOVERY`. § 9 defines `LR-low`/`LR-mid`/`LR-high`/`LR-peak` precisely as quarters
of the ladder range. § 6 caps `REG` at 4–5 days "unless already stable at six".

**It does not say.** A target inside `HOLD` (95–100%), `TAPER-1` (70–80%), `TAPER-2` (55–65%), or
`RACE-WEEK` (40–60%). What "if eligible" means in the § 11–14 calendar cells. What test makes a
`REG` runner "already stable at six" days.

**Ruling (2026-09-10).** **All three defaults kept as implemented:** band midpoints for `HOLD`,
`TAPER-1`, `TAPER-2` and `RACE-WEEK`; `EXP`/`COMP`-only eligibility for a second hard session; and
the five-day clamp for a `REG` runner requesting six.

**As implemented.** `bandMidpoint` for the unnamed bands — arithmetic, not a new coaching number.
`TWO_QUALITY_TRACKS = ['EXP', 'COMP']`, because `REG`'s second session is "only after demonstrated
tolerance" and intake reports no tolerance signal. A `REG` runner asking for six days gets five, the
extra day becoming rest — the direction § 6 already takes for `NEW`.

---

## Q5 — H0–H4 derivation from the intake the app actually collects

**The document says.** § 15 requires six fields before any module applies: location, status
(past/resolved · returning/cleared · active/stable · active/worsening), pain 0–10 at rest / during /
after / next morning, running impact, red-flag symptoms, and professional instruction. § 16 branches
on all six. Free text "never changes numeric training rules by itself".

**It does not say.** How to branch when only some of those fields exist. `IntakeResponses` carries
only the closed-set `injuries: InjuryFlag[]` and free-text `injuryNotes`.

**Ruling (2026-09-10).** **Keep the H0/H1 default for now.** Do not require the six-field injury
intake before Free ships; that is a separate future task.

**As implemented.** No declared injury → `H0`. Any declared injury → `H1` ("cautious history"), the
mildest branch that still applies a module. `H2`, `H3` and `H4` are fully implemented and tested —
including `H4`'s no-running output and its non-overridable disclaimer — but no live intake can
evidence them. The engine never derives a worse state than intake supports, and never a better one
than a declared injury implies. `deriveInjuryState` is the single function the real intake replaces.

*(All seven modules ship in v1 with the library's stated disclaimers, per the 2026-09-06 ruling,
despite § 21's unticked "qualified clinical review of injury branching". That was settled
separately and is not what this question asked.)*

---

## Q6 — Notation and effort mapping for the seven codes `notation.md` has no label for

**The document says.** § 3 defines 20 workout codes, with an explicit RPE for four of them: `REC`
(2–3), `E` (3–4), `AER` (4–5), `LR` (3–4). The rest carry prose.

**It does not say.** How those codes render in the app's own notation. `notation.md` (the 2026-07-11
notation ruling) defines nine labels — `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, `Strides`,
`Race Day`. Seven library codes have none: `AER`, `MLR`, `FF`, `HS`, `F`, `H`, `TU`.

**Ruling (2026-09-10).** **Approved as proposed — all ten mappings, including `MP` as *steady* and
`RP10` as *interval*.** No new abbreviations.

**As implemented** (`CODE_PRESENTATION`, pinned by a test that asserts no plan ever emits a label
outside `notation.md`'s set):

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

---

## Settled elsewhere, recorded here so nobody re-opens them

- **Recovery-week depth is 15–25%, target 20%** (2026-09-06). The source library's own
  "35–45% / target 40%" lines are stale and have been corrected in place in
  `planning/research/plan-blueprint-examples.md` (§ 2 rule 7, § 5's `RECOVERY` row, and "Resolved
  for the V1 library" item 4). `loadRules.ts`'s `DELOAD_REDUCTION_MIN`/`MAX` stay authoritative and
  were not changed.
- **All seven injury modules ship in v1** with the library's stated disclaimers, despite § 21's
  unticked clinical-review box.
- **A race date that cannot be safely prepared for reports limited preparation** — never
  compression, never a violated cap.
- **§ 22's disclaimers are mandatory on every plan**, plus the H1–H4 disclaimer where § 22
  specifies it.

## Known follow-ups, not decisions

Neither needs a coaching ruling; both are ordinary engineering work.

1. **Intake could refuse a missing target distance before the server does** (Q1). Today the client
   can send a Free request the server will reject.
2. **§ 15's six-field injury intake** (Q5), which would make `H2`–`H4` reachable. Explicitly
   deferred, not dropped.
