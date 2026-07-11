# Goal-realism handling — design

**Status:** ruled by Ian, 2026-07-12. Closes GitHub issue #33 and Open item 5
(`docs/reference/coaching/example-plan-5k-pro.md`).
**Blocks:** `deriveRacePaceTarget()` in `src/lib/paceDerivation.ts` (issue #3).

---

## The question

When a runner declares a goal time implausibly faster than their recent-equivalent performance —
the canonical case being a 25-minute 5K runner asking for a sub-3 marathon — should the app **warn**,
**cap**, or **trust the goal**?

This was genuinely open, not merely undocumented. `COMPLETENESS.md` lists *"goal unrealistic for
current fitness"* under **what the coaching library is missing** (edge-case rules, item 8). No
threshold exists anywhere in the source to port, so no number here is McMillan's — they are Ian's.

## Why it was still open after ruling 3

Ruling 3 (2026-07-11) settled that race-pace (`RP`) sessions in the race-specific phase anchor
directly at **goal pace** — *"your goal is to run at your goal pace, might be slower in the
beginning."* That ruling was made on the fixture runner, whose goal implies an 11.1% improvement:
ambitious, but real.

Ruling 3 answers *when* a session converges to goal pace across a plan. It does not answer what to
do when the goal itself is a fantasy. And the 2026-07-10 R-A addendum's 10% gate — the only thing
that would have caught one — was retired last cycle as stale. So **"trust the goal outright" was the
de facto behavior**, leaving open exactly the failure mode `planning/03-engineering-requirements.md`
names by name: an algorithm that takes the runner at their word and prescribes reps at a pace they
cannot hold.

## What the source does say

Three findings, none of them a rule, all of them shaping the answer:

1. **The gap is admitted.** `COMPLETENESS.md` item 8 — the library has no goal-realism rule.
2. **McMillan already softens the anchor.** His 5K race-simulation session reads *"3 km at GOAL RACE
   PACE (whatever pace feels achievable for 5K) — Purpose: Practice goal pace, **confirm realistic
   goal**."* Two things follow. He qualifies the anchor at session level rather than taking the
   declared goal literally, and he treats the goal-pace session as *itself the realism test*. A cap
   is therefore not a departure from the McMillan position adopted in ruling 3; it is arguably
   inside it.
3. **The only improvement rate in the library is small.** Economy gains 3–5% *per year* at age 25
   (the "aggressive gain window"); at 55 it is maintenance, not gain. Any threshold measured in tens
   of percent *per training block* is already generous against that figure.

---

## Ruling

### 1. Two bands — warn, then cap

Riegel-equivalent the recent performance to the goal distance
(`T2 = T1 × (D2/D1)^1.06`, `RIEGEL_EXPONENT = 1.06`), then:

```
impliedImprovementPct = (equivalentSec − goalTimeSec) / equivalentSec × 100
```

Positive means the goal is *faster* than the equivalent.

| Implied improvement | Verdict | Warn | `RP` session anchored at |
|---|---|---|---|
| ≤ 0% (goal slower than equivalent) | `realistic` | no | raw goal pace |
| 0% – 10% | `realistic` | no | raw goal pace |
| **10% – 15%** | `ambitious` | **yes** | raw goal pace — **ruling 3 holds** |
| **> 15%** | `implausible` | **yes** | **capped** at the equivalent improved by exactly 15% |

Boundaries are inclusive at the top of each band: exactly 10.0% is `realistic`, exactly 15.0% is
`ambitious`. The cap engages only strictly above 15%.

`impliedImprovementPct` is an **unrounded float** — the presentation layer rounds it for copy. Tests
compare against the computed value, never a hand-rounded one.

**The cap is continuous at the boundary.** A goal at exactly 15.0% is anchored at its raw goal pace;
a goal at 15.01% is capped — and both land on the same pace (3:50/km for the fixture runner). There
is no cliff where one second of extra ambition produces a visible jump in the prescribed rep pace.
This is a property worth a test, because it is the thing that would most obviously look like a bug
to a runner nudging their goal time.

**Thresholds are flat.** They do not scale with age, experience, or plan length. The library gives
no per-week or per-age improvement rate to port, and inventing one would be exactly the kind of
fabricated coaching number this project forbids. Scaling remains an additive change later if
round-2 review shows flat thresholds are too crude.

### 2. Training paces are untouched — restated, because it bounds the blast radius

Easy, tempo, and interval paces are **unconditionally** derived from the recent performance. The
goal never drives them, at any improvement size. This was already the `planTypes.ts` contract and
this ruling does not change it.

Consequence: a fantasy goal cannot corrupt everyday paces. The entire exposure is the `RP` session
target and what the app tells the runner — which is why a cap on one number is a sufficient fix.

### 3. The cap

```
cappedTimeSec = round(equivalentSec × 0.85)
cappedPace    = paceSecPerKm(cappedTimeSec, RACE_DISTANCE_KM[raceDistance])
```

The capped anchor is a single pace, not a band — `{ lowSecPerKm: p, highSecPerKm: p }`, matching how
`deriveRacePaceTarget()` already returns the uncapped goal pace.

The runner's **declared goal is still their goal**. The cap governs the prescribed `RP` rep pace
only; the plan header still shows the time they asked for.

### 4. Where the warning lives

One pure function, two callers:

```
            assessGoalRealism()   ← pure, src/lib/paceDerivation.ts
                     │
        ┌────────────┴─────────────────┐
        │                              │
     CLIENT                       ENGINE (the authority)
  intake review    → advisory     caps the RP anchor
  configure modal  → advisory     stamps the verdict onto the immutable plan
                                  plan explains its own numbers
```

- **Client, at both goal-entry points** — the intake review screen *and* the configure modal. Goal
  time travels per-generation (`mvp-build-prompt.md:332`: *"race distance/date/goal-time travel
  per-generation; intake's stored race is a default, not the authority"*), so a warning shown only
  at intake would be silently skipped by anyone who sets an ambitious goal at configure time. The
  advisory is instant, needs no network, and **burns no quota** — the runner learns their goal is a
  stretch *before* spending a generation, which on Free is 1 of 3.
- **Engine, server-side** — calls the same function to cap the `RP` anchor and writes the verdict
  into the plan JSON. The plan is immutable, so it carries its own explanation forever: race-pace
  reps at 3:50/km against a declared goal pace of 3:36/km, and the reason, on the artifact the
  runner actually keeps.

Because both sides call **the same pure function**, the warning and the cap cannot disagree.

This does not violate *"no business rules in the client"* (`CLAUDE.md` → Code conventions). The
client renders a pure computation and is never the authority — the server-side cap is. This is the
same posture the project already takes with tier state: *"the client may display tier state but is
never the authority for it."*

The warning is **advisory and non-blocking**. It does not gate the Generate button.

---

## Worked cases

Both anchor cases the ruling had to satisfy. Every figure below was computed, not hand-derived.

### Fixture runner — the case ruling 3 was decided on

Recent 5K **22:30** (1350 s), goal 5K **20:00** (1200 s). Same distance, so equivalent = 1350 s.

```
impliedImprovementPct = (1350 − 1200) / 1350 × 100 = 11.11%   → ambitious
RP anchor             = paceSecPerKm(1200, 5) = 240 s/km = 4:00/km   (raw goal pace)
```

Warned, **not capped**. The `RP` anchor is 4:00/km — byte-for-byte the assertion ruling 3 already
put in `paceDerivation.test.ts`. The new rule does not disturb the existing ruling-3 test.

Cap line for this runner, had the goal been faster:

```
cappedTimeSec = round(1350 × 0.85) = round(1147.5) = 1148 s  (19:08)
cappedPace    = round(1148 / 5)    = 230 s/km = 3:50/km
```

So a declared 18:00 goal (20.0% improvement) is `implausible` and its `RP` anchor is pinned at
3:50/km, not the 3:36/km the goal implies.

### The canonical fantasy

Recent 5K **25:00** (1500 s), goal **sub-3 marathon** (10800 s).

```
equivalentSec = round(1500 × (42.195/5)^1.06) = 14387 s = 3:59:47
impliedImprovementPct = (14387 − 10800) / 14387 × 100 = 24.93%   → implausible
cappedTimeSec = round(14387 × 0.85) = 12229 s = 3:23:49
cappedPace    = round(12229 / 42.195) = 290 s/km = 4:50/km
```

The plan prescribes race-pace reps at 4:50/km rather than the 4:16/km the sub-3 goal implies. The
runner still sees "sub-3:00" as their stated goal, and sees why the reps don't match it.

### No recent performance

`assessGoalRealism()` returns `undefined`. No equivalent is computable, so nothing is warned and
nothing is capped. `deriveRacePaceTarget()` already returns `undefined` in this case. This is
consistent with the standing rule that a runner without a recent time gets effort language and no
numbers at any tier — the "readout bracket can never render a lie."

---

## Contract

### New, in `src/lib/planTypes.ts` (shared vocabulary — app *and* edge functions)

```ts
export type GoalRealism = 'realistic' | 'ambitious' | 'implausible';

export interface GoalRealismAssessment {
  realism: GoalRealism;
  /** Positive means the goal is faster than the Riegel equivalent. */
  impliedImprovementPct: number;
  /** Riegel equivalent at the goal distance. */
  equivalentTimeSec: number;
  /** Set only when `realism === 'implausible'`. */
  cappedTimeSec?: number;
}
```

`Plan` gains one **additive optional** field — no existing field changes, no fixture breaks:

```ts
export interface Plan {
  // ...
  /** Present only when a goal time and a recent performance both exist. */
  goalRealism?: GoalRealismAssessment;
}
```

### New, in `src/lib/paceDerivation.ts` (issue #3 builds the module; this fixes its contract)

```ts
export const GOAL_AMBITIOUS_THRESHOLD_PCT = 10;
export const GOAL_IMPLAUSIBLE_THRESHOLD_PCT = 15;

export function assessGoalRealism(input: {
  goalTimeSec: number;
  raceDistance: RaceDistance;
  recent?: Performance;
}): GoalRealismAssessment | undefined;   // undefined without a recent performance
```

### Changed — `deriveRacePaceTarget()`

`source` widens from `'goal'` to `'goal' | 'capped'`, and the return carries the verdict so callers
never recompute it:

```ts
{
  pace: Pace;
  source: 'goal' | 'capped';
  realism: GoalRealism;
  impliedImprovementPct: number;
}
```

Two existing tests in `paceDerivation.test.ts` assert the old shape with `toEqual` and must be
widened. Neither changes its *pace* expectation — only the object shape around it.

---

## What lands under this issue, and what does not

`src/lib/paceDerivation.ts` **does not exist yet**; issue #3 builds it. This issue is the ruling and
its contract, not the engine.

**In scope**
1. Types and threshold constants in the shared vocabulary.
2. The contract encoded as real tests in `paceDerivation.test.ts` — replacing the `it.todo`, and
   widening the two tests whose `toEqual` shape changes.
3. Doc sync: `example-plan-5k-pro.md` (Open item 5 → resolved), `docs/mvp-progress.md` (known debt +
   decided), `docs/change_log.md`, `planning/03-engineering-requirements.md` (the R-A section gains
   the realism rule).

**Out of scope — flagged, not fixed**
- **`GeneratePlanRequest` has no `goalTimeSec` field.** The per-generation goal that
  `mvp-build-prompt.md:332` promises cannot reach the engine today. The realism check depends on it.
  This belongs to issue #9 (`generate-plan` contract, `api-designer`) — flag it there.
- **The configure-modal spec never mentions goal time.** `frontend-design-brief.md:564` lists
  distance chips and a date picker only, which contradicts `mvp-build-prompt.md:332`. Doc tension
  for the sync pass.
- The client advisory copy and its two screens (issues #8, #13). The **text** of the warning is
  `ux-copywriter` work against this ruling; the ruling only fixes *when* it fires.
- The plan-view rendering of `goalRealism` (issue #4).

## Verification

**The suite stays red after this lands, and that is expected.** `paceDerivation.test.ts` and
`planTemplates.golden.test.ts` already fail to *run* on `main` ("Cannot find module") because the
modules they test are not built yet — 64 tests pass, 2 suites fail. This issue adds tests to a suite
that cannot run until issue #3 lands. `npm run typecheck && npm run lint` must stay clean; `npm test`
must not get *worse* (no new failing suite, no regression in the 64 passing tests).

Green comes with issue #3, whose acceptance now includes every test written here.
