/**
 * Run-type and structure-string notation — the code counterpart of
 * `docs/reference/coaching/notation.md` (Ian's 2026-07-11 notation ruling). Shared vocabulary,
 * so this module stays pure like `planTypes.ts`: types and const literals only, no React, no
 * Deno, no Node, no AsyncStorage. It is imported by the app today and will be imported by the
 * `generate-plan` edge function once that exists.
 *
 * Every name and description below is copied verbatim from notation.md's own tables and prose —
 * that file is explicitly written as "full name + one-line plain-English meaning specifically so
 * it can be dropped into [the glossary] screen unchanged." Do not add coaching content here that
 * isn't already in notation.md; if the glossary needs a new entry, that's a doc change first.
 *
 * The full abbreviation set is marked in notation.md as "proposed... pending [Ian's] sign-off" —
 * see that file's header and `example-plan-5k-pro.md`'s Open item 4.
 */

/** A glossary row: the expanded name and its one-line plain-English meaning. */
export interface GlossaryEntry {
  fullName: string;
  description: string;
}

/**
 * Run-type abbreviations. Source: notation.md § "Run-type abbreviations" table.
 * Keyed by the abbreviation exactly as it appears in a `Workout.label`.
 */
export const RUN_TYPE_ABBREVIATIONS: Record<string, GlossaryEntry> = {
  ER: {
    fullName: 'Easy Run',
    description: 'Comfortable, conversational-pace aerobic run — the base of every week.',
  },
  RR: {
    fullName: 'Recovery Run',
    description:
      'A very easy, short run the day after a hard session — active recovery, not training stimulus.',
  },
  TR: {
    fullName: 'Tempo Run',
    description: 'A sustained comfortably-hard effort at or just below lactate threshold.',
  },
  INT: {
    fullName: 'Intervals',
    description: 'Repeated hard efforts (VO2 max work) with jog recovery between reps.',
  },
  RP: {
    fullName: 'Race-Pace Reps',
    description:
      'Repeats run at goal race pace, with generous recovery — race-specificity, not VO2 max stress.',
  },
  LR: {
    fullName: 'Long Run',
    description: "The week's longest run, at easy pace throughout (or a light finish-build).",
  },
  SR: {
    fullName: 'Shakeout Run',
    description: 'A very short, very easy jog in race week to keep the legs loose.',
  },
};

/**
 * Run-type words that are always spelled out in full — never abbreviated. Strides' description
 * is notation.md's "Meaning" column for its own table row; Race Day's is notation.md's own prose
 * ("It is the event itself, not a run type — abbreviating it would imply it's just another
 * training session, which it isn't"); Rest has no notation.md entry (that file only covers run
 * types and structure shorthand) — its description is the app's own established rest-day copy,
 * already shipped in `WorkoutRow.tsx`, reused here rather than newly invented.
 */
export const UNABBREVIATED_RUN_TYPES: Record<string, GlossaryEntry> = {
  Strides: {
    fullName: 'Strides',
    description:
      'Short, controlled accelerations to near-top speed with full recovery — neuromuscular sharpening, not a workout in itself.',
  },
  'Race Day': {
    fullName: 'Race Day',
    description:
      "The event itself, not just another training session — abbreviating it would imply otherwise.",
  },
  Rest: {
    fullName: 'Rest',
    description: 'A real, scheduled slot, not an absence — recovery is training too.',
  },
};

/**
 * A structure-shorthand row: the symbol's one-line meaning. notation.md's grammar table has a
 * single "Means" column (unlike the run-type table's full-name + meaning pair), so this stays a
 * single field rather than forcing an artificial full-name/description split.
 */
export interface StructureSymbolEntry {
  meaning: string;
}

/**
 * Structure-shorthand symbols used inside a `Workout.structure` string. Source: notation.md
 * § "Structure-string grammar" table — all seven rows, `·` included: "Every symbol above —
 * including `·` — is one structure-shorthand vocabulary, not a subset plus a typographic
 * extra" (notation.md, cycle-2 correction, 2026-07-11).
 */
export const STRUCTURE_SHORTHAND: Record<string, StructureSymbolEntry> = {
  WU: { meaning: 'Warm-up.' },
  CD: { meaning: 'Cool-down.' },
  GP: { meaning: 'Goal pace.' },
  'w/': { meaning: '"With" — introduces the recovery between reps.' },
  '@': { meaning: '"At" — introduces a pace anchor.' },
  '×': { meaning: 'Rep-count separator: count × distance or count × time.' },
  '·': { meaning: 'Segment separator inside a structure string.' },
};

/**
 * Expands a workout label for screen readers — "ER" reads as "Easy Run", not letter by letter.
 * Handles the one composite form the plan actually emits ("ER + Strides" → "Easy Run plus
 * Strides"); any other unrecognized label passes through unchanged. Simple and total: every
 * input produces an output, nothing throws.
 */
export function expandLabel(label: string): string {
  if (label.includes(' + ')) {
    return label
      .split(' + ')
      .map((part) => expandSingleLabel(part.trim()))
      .join(' plus ');
  }
  return expandSingleLabel(label);
}

function expandSingleLabel(label: string): string {
  return RUN_TYPE_ABBREVIATIONS[label]?.fullName ?? UNABBREVIATED_RUN_TYPES[label]?.fullName ?? label;
}

/**
 * Expands a `Workout.structure` string's shorthand into words for screen readers — so
 * `"WU 2 km · 8 × 600 m @ GP w/ 300 m jog · CD 2 km"` reads as "warm-up 2 km, 8 times 600 m @
 * goal pace with 300 m jog, cool-down 2 km" instead of the runner having to parse letter-code
 * shorthand by ear. `·` becomes the pause between segments (a comma); `@` is left as-is —
 * screen readers already read the at-sign as "at" on its own. Total: any input, recognized
 * shorthand or not, produces a string; text this function doesn't recognize passes through
 * unchanged.
 */
export function speakStructure(structure: string): string {
  return structure
    .split('·')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map(expandStructureTokens)
    .join(', ');
}

function expandStructureTokens(segment: string): string {
  return segment
    .replace(/\bWU\b/g, 'warm-up')
    .replace(/\bCD\b/g, 'cool-down')
    .replace(/\bGP\b/g, 'goal pace')
    .replace(/w\//g, 'with')
    .replace(/×/g, 'times');
}
