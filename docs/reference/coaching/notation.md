# Notation — Run-Type Abbreviations and Structure Strings

**Ian's ruling, 2026-07-11**, issued alongside the session-sizing correction in
[`workout-library.md`](workout-library.md) after he scored the rendered 5K plan 3/10. His words:
run-type labels use abbreviations, never full names — *"easy run = ER, tempo run = TR"* — **except
strides, which are always spelled out.** The abbreviation set below was built to be consistent with
his two given examples and the notation findings in the 2026-07-11 market-research pass on
published 5K plans (`market-research-5k-plans.md` § 3, "Notation & abbreviations" — session-scoped
research report, not checked into the repo — informal coach-community shorthand converges on
`WU`/`CD`/`@pace`/`count × distance`, which is what the grammar below formalizes).

**Signed off exactly as written (Ian's ruling, 2026-07-12 — issue #34, rendered-plan review round
2).** The full set below — `ER`, `RR`, `TR`, `INT`, `RP`, `LR`, `SR`, with Strides always spelled
out and Race Day never abbreviated — is approved, not proposed. Ian was shown, and accepted, one
known wrinkle: `RP` (a run-type label) and `GP` (the structure-string goal-pace symbol) are two
codes for closely related ideas on two different layers, e.g. week 11's "RP · 3 × 1600 m @ GP." He
saw it and approved the set anyway — it is not to be re-litigated. It governs
[`example-plan-5k-pro.md`](example-plan-5k-pro.md); nothing here overrides an explicit label choice
Ian makes later.

This file is also the source for the app's planned **abbreviations glossary tab** — every row in
the table below is written as a full name + one-line plain-English meaning specifically so it can
be dropped into that screen unchanged (research §3: Runna's public glossary is full-term +
one-line-definition, not a dense letter-code legend — the more consumer-friendly convention for a
glossary screen, which is why the table below leads with the full name).

## Run-type abbreviations

| Abbreviation | Full name | Meaning |
|---|---|---|
| ER | Easy Run | Comfortable, conversational-pace aerobic run — the base of every week. |
| RR | Recovery Run | A very easy, short run the day after a hard session — active recovery, not training stimulus. |
| TR | Tempo Run | A sustained comfortably-hard effort at or just below lactate threshold. |
| INT | Intervals | Repeated hard efforts (VO2 max work) with jog recovery between reps. |
| RP | Race-Pace Reps | Repeats run at goal race pace, with generous recovery — race-specificity, not VO2 max stress. |
| LR | Long Run | Your endurance-building run for the week, at easy pace throughout (or a light finish-build). |
| SR | Shakeout Run | A very short, very easy jog in race week to keep the legs loose. |
| **Strides** | *(never abbreviated)* | Short, controlled accelerations to near-top speed with full recovery — neuromuscular sharpening, not a workout in itself. |

**Composite label:** `ER + Strides` — an easy run with strides appended at the end. Follows the
same "abbreviate the run type, spell out Strides" rule.

**`Race Day` stays unabbreviated.** It is the event itself, not a run type — abbreviating it would
imply it's just another training session, which it isn't.

**LR's description edited, 2026-09-05 (captain's ruling on `longrun-share-cap-floor`, core-purpose
audit §1.2).** It read "the week's longest run" until the long-run safety cap was fixed to always
win over that claim — the cap can now put LR below a quality session in the same week. This is the
one word of the row that isn't final per the 2026-07-12 sign-off above: it described a code
invariant, and the invariant changed. See [`load-rules.md`](load-rules.md).

## Structure-string grammar

Every workout's `structure` field itemizes the session left to right, in the order the runner
actually runs it, using this shorthand:

| Symbol | Means |
|---|---|
| `WU` | Warm-up |
| `CD` | Cool-down |
| `GP` | Goal pace |
| `w/` | "with" — introduces the recovery between reps |
| `@` | "at" — introduces a pace anchor |
| `×` | Rep count separator: `count × distance` or `count × time` |
| `·` | Segment separator inside a structure string |

**Every symbol above — including `·` — is one structure-shorthand vocabulary, not a subset plus a
typographic extra.** `notation.ts`'s `STRUCTURE_SHORTHAND` export and the abbreviations glossary
tab are expected to carry all seven rows, `·` included; a code change in flight this same cycle
adds it to `STRUCTURE_SHORTHAND` alongside `WU`/`CD`/`GP`/`w/`/`@`/`×` so the table above and the
exported set stay identical.

**Worked examples:**

- Intervals (`INT`) session, current-fitness pace: **`WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m
  jog · CD 2 km`** — a 2 km warm-up, eight 600-metre reps at this runner's current-fitness
  interval pace with a 300-metre jog recovery between each, then a 2 km cool-down. Early-plan
  `INT` sessions anchor to current fitness, never to `GP` — see ruling 3 in `workout-library.md` §
  "Rep-distance menu and pace convergence."
- Race-pace (`RP`) session, goal pace: **`WU 2 km · 3 × 1600 m @ GP w/ 400 m jog · CD 2 km`** — a
  2 km warm-up, three 1600-metre reps at goal race pace with a 400-metre jog recovery between
  each, then a 2 km cool-down. `@ GP` only appears once a session sits in the race-specific phase
  (see `example-plan-5k-pro.md` week 11) — it is never the anchor for an early-plan `INT` session.
- Tempo session: **`WU 2 km · 20 min @ tempo · CD 2 km`** — a 2 km warm-up, 20 minutes at tempo
  effort, then a 2 km cool-down.
- Strides, appended to an easy run: **`4 × 30 s Strides`** — always `count × seconds`, always the
  full word "Strides," never an abbreviation.
- Race day (Ian's ruling, 2026-07-12 — issue #34, rendered-plan review round 2; closes issue #29):
  **`WU 3 km · 5 km race · CD 2 km`** — a 3 km warm-up, the 5 km race itself, then a 2 km cool-down,
  summing to the 10 km headline. Replaces `5 km warm-up/cool-down + 5 km race`, which broke the
  grammar (a spelled-out "warm-up/cool-down" and a `+` the glossary above cannot explain) and
  introduces no new token — see `example-plan-5k-pro.md` week 12.

Reps are prescribed as **count × distance**, never a bare distance or a bare time (Ian's ruling —
`"8 × 600 m"` style). The source library (`workout-library.md`) only had time-based interval
structures (`6 × 3 min`); the distance-rep menu — 400 m / 600 m / 800 m / 1000 m — is adopted from
the 2026-07-11 market-research pass (McMillan's own published rep menu) under this ruling. See
`workout-library.md` § "Session sizing by race distance" for the menu and the pace-anchor rule.

## Headline-number convention (Ian's ruling, deliberate divergence — flagged)

Published plans surveyed in the market-research pass (§5, "Warm-up/cool-down accounting")
overwhelmingly headline the **work only** and itemize warm-up/cool-down as separate, additive
segments (McMillan, Daniels, Nike Run Club, RunnersConnect). This app does **not** follow that
convention, on purpose:

**A `Workout`'s headline `distanceKm` is the TOTAL kilometres run that day — warm-up, cool-down,
and recovery jogs included, not just the quality "work."** The `structure` string still itemizes
WU / work / CD (and recovery jog distance, for interval/race-pace sessions) so the runner always
sees the true size of the hard portion.

**Why this diverges from the published-plan norm:** the app's plan view sums every day's
`distanceKm` into the week's total, and the wave chart on the plan screen charts that same real
per-day volume — the thing Ian explicitly praised in his 3/10 review ("the plan staying within the
user's weekly volume capability"). A work-only headline (Higdon's trap, per the research report)
would make the week's numbers not add up to the volume the runner actually ran, silently breaking
that chart. Folding WU/CD/jog into the headline is the one change needed to keep the numbers
honest without asking the runner to do arithmetic themselves.

**This is a deliberate divergence from majority published-plan practice, not an oversight — flagged
here for Ian's awareness**, since it means the app's day-view numbers will read slightly larger
than the equivalent line in a McMillan or Daniels plan for the same session (e.g., week 9's
8×600m session, which most plans would call "4.8 km," reads as "≈11 km" here once warm-up,
cool-down, and jog recovery are folded in). The `structure` string is what carries the
McMillan-comparable "quality volume" figure.
