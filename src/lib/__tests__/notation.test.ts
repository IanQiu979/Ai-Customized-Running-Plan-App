import { examplePlan } from '../fixtures/examplePlan';
import {
  RUN_TYPE_ABBREVIATIONS,
  STRUCTURE_SHORTHAND,
  UNABBREVIATED_RUN_TYPES,
  expandLabel,
  speakStructure,
} from '../notation';
import type { Workout } from '../planTypes';

/**
 * Unit tests for `src/lib/notation.ts`, the code counterpart of
 * `docs/reference/coaching/notation.md` (Ian's 2026-07-11 notation ruling). Expected sets are
 * copied from that doc's tables, not read back out of the module under test.
 */

describe('RUN_TYPE_ABBREVIATIONS — notation.md § "Run-type abbreviations"', () => {
  // Doc table rows: ER, RR, TR, INT, RP, LR, SR (Strides and Race Day are documented but
  // deliberately NOT in this record — they're never abbreviated, so they live in
  // UNABBREVIATED_RUN_TYPES instead).
  it('contains exactly the documented abbreviation set', () => {
    expect(Object.keys(RUN_TYPE_ABBREVIATIONS).sort()).toEqual(
      ['ER', 'INT', 'LR', 'RP', 'RR', 'SR', 'TR'].sort(),
    );
  });

  it('maps each abbreviation to its documented full name', () => {
    expect(RUN_TYPE_ABBREVIATIONS.ER.fullName).toBe('Easy Run');
    expect(RUN_TYPE_ABBREVIATIONS.RR.fullName).toBe('Recovery Run');
    expect(RUN_TYPE_ABBREVIATIONS.TR.fullName).toBe('Tempo Run');
    expect(RUN_TYPE_ABBREVIATIONS.INT.fullName).toBe('Intervals');
    expect(RUN_TYPE_ABBREVIATIONS.RP.fullName).toBe('Race-Pace Reps');
    expect(RUN_TYPE_ABBREVIATIONS.LR.fullName).toBe('Long Run');
    expect(RUN_TYPE_ABBREVIATIONS.SR.fullName).toBe('Shakeout Run');
  });
});

describe('STRUCTURE_SHORTHAND — notation.md § "Structure-string grammar"', () => {
  // Doc table rows, cycle-2 correction: "Every symbol above — including `·` — is one
  // structure-shorthand vocabulary, not a subset plus a typographic extra... a code change in
  // flight this same cycle adds it to STRUCTURE_SHORTHAND alongside WU/CD/GP/w//@/× so the
  // table above and the exported set stay identical." All seven rows: WU, CD, GP, w/, @, ×, ·.
  it('contains exactly the documented shorthand set, including the cycle-2-added "·" segment separator', () => {
    expect(Object.keys(STRUCTURE_SHORTHAND).sort()).toEqual(
      ['@', 'CD', 'GP', 'WU', 'w/', '×', '·'].sort(),
    );
  });
});

describe('expandLabel', () => {
  it('expands every documented run-type abbreviation to its full name', () => {
    for (const [abbreviation, entry] of Object.entries(RUN_TYPE_ABBREVIATIONS)) {
      expect(expandLabel(abbreviation)).toBe(entry.fullName);
    }
  });

  it('expands the "ER + Strides" composite to "Easy Run plus Strides"', () => {
    expect(expandLabel('ER + Strides')).toBe('Easy Run plus Strides');
  });

  it('passes an unrecognized label through unchanged', () => {
    expect(expandLabel('XYZ')).toBe('XYZ');
  });

  it('passes "Race Day" through as itself (already its own full name, never abbreviated)', () => {
    expect(expandLabel('Race Day')).toBe(UNABBREVIATED_RUN_TYPES['Race Day'].fullName);
    expect(expandLabel('Race Day')).toBe('Race Day');
  });
});

describe('speakStructure', () => {
  it('expands WU, CD, and GP to spoken words', () => {
    expect(speakStructure('WU 2 km')).toBe('warm-up 2 km');
    expect(speakStructure('CD 2 km')).toBe('cool-down 2 km');
    expect(speakStructure('3 × 1600 m @ GP')).toBe('3 times 1600 m @ goal pace');
  });

  it('expands "w/" to "with" and "×" to "times"', () => {
    expect(speakStructure('w/ 300 m jog')).toBe('with 300 m jog');
    expect(speakStructure('8 × 600 m')).toBe('8 times 600 m');
  });

  it('splits "·" segments into comma-separated spoken segments', () => {
    expect(speakStructure('WU 2 km · CD 2 km')).toBe('warm-up 2 km, cool-down 2 km');
  });

  it('leaves "@" unexpanded — screen readers already voice the at-sign on their own', () => {
    const result = speakStructure('8 × 600 m @ 4:22–4:30/km');
    expect(result).toContain('@');
    expect(result).toBe('8 times 600 m @ 4:22–4:30/km');
  });

  it('passes text it does not recognize through unchanged, including empty input', () => {
    expect(speakStructure('nothing to expand here')).toBe('nothing to expand here');
    expect(speakStructure('')).toBe('');
  });

  it('speaks a full real structure string from the fixture (week 9 INT, cycle-2 300 m jog)', () => {
    // src/lib/fixtures/examplePlan.ts, week 9 (index 8), Day 5 (index 4):
    // 'WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km'.
    const week9Int = examplePlan.weeks[8].days[4] as Workout;
    expect(week9Int.label).toBe('INT');
    expect(week9Int.structure).toBe('WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km');
    expect(speakStructure(week9Int.structure ?? '')).toBe(
      'warm-up 2 km, 8 times 600 m @ 4:22–4:30/km with 300 m jog, cool-down 2 km',
    );
  });
});
