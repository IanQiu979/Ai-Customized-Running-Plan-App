/**
 * The Free tier's deterministic 40-plan engine, ported from
 * `planning/research/plan-blueprint-examples.md`. Start at `engine.ts`'s `buildLibraryPlan` — it
 * implements § 20's resolution order and cites the section behind every decision.
 *
 * Six coaching decisions the source document does not make are isolated in `openQuestions.ts` and
 * put to the captain in `docs/reference/coaching/free-engine-open-questions.md`. Nothing else in
 * this directory guesses.
 */

export * from './registry';
export * from './calendars';
export * from './injury';
export * from './openQuestions';
export * from './engine';
