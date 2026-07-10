# Coaching source — verbatim import

These six files are a **verbatim copy** of Ian's running-business coaching library, imported
2026-07-10 from `~/Desktop/Running Bussiness Files/4th Edition/Final Txt Files/`.

They are the **authority**. Everything in `docs/reference/coaching/` is derived from them.

## Why they live here now

The originals are not under version control and have no undo. Editing them directly is a one-way
door on safety-critical content. Imported here, every change is a reviewable diff.

- **The originals on the Desktop are the untouched archive.** Do not edit them.
- **A pre-edit backup exists** at `~/Desktop/Running Bussiness Files/4th Edition/_backup_20260710-165851/`.
- **Edits happen here**, in git, and only with Ian's sign-off. He is a McMillan-certified coach; no
  agent invents or alters a training rule, formula, or clinical claim. See `CLAUDE.md`,
  "Coaching domain".

## The two layers

| | What it is |
|---|---|
| `source/` (here) | Raw, ECHO-branded, complete. The truth. |
| `../` (the port) | PACE-branded, filtered to what a one-time 8-field intake can drive, with the six evidence corrections applied. What the app reads. |

If a rule changes here, the port must be regenerated to match.

## Known gaps in the source, as of import

1. **No pace derivation exists.** No VDOT table, no equivalent-performance chart, no McMillan
   calculator. `workout_library.md` defines tempo as "45–60 sec/km faster than easy pace" — but easy
   pace is never given a formula anywhere. This blocks Pro's "pace targets" promise.
2. **No ultra content**, and `load_rules.md` Rule 4's ceilings (110 km/week, 35 km longest run)
   cannot express an ultra plan.
3. **Three worked plans only** (beginner 5K/12wk, 10K/15wk, marathon/28wk). No per-experience-level
   variants.
