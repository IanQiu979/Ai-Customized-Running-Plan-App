import { examplePlan } from '../fixtures/examplePlan';
import {
  RUN_TYPE_ABBREVIATIONS,
  STRUCTURE_SHORTHAND,
  UNABBREVIATED_RUN_TYPES,
  expandLabel,
  formatSecPerKm,
  speakPace,
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

  it('leaves "@" unexpanded — screen readers already voice the at-sign on their own — while still expanding an embedded pace band (issue #31 code-review finding)', () => {
    const result = speakStructure('8 × 600 m @ 4:22–4:30/km');
    expect(result).toContain('@');
    expect(result).toBe('8 times 600 m @ 4:22 to 4:30 per kilometer');
  });

  it('passes text it does not recognize through unchanged, including empty input', () => {
    expect(speakStructure('nothing to expand here')).toBe('nothing to expand here');
    expect(speakStructure('')).toBe('');
  });

  it('speaks a full real structure string from the fixture (week 9 INT, cycle-2 300 m jog), including the embedded pace band (issue #31 code-review finding)', () => {
    // src/lib/fixtures/examplePlan.ts, week 9 (index 8), Day 5 (index 4):
    // 'WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km'.
    const week9Int = examplePlan.weeks[8].days[4] as Workout;
    expect(week9Int.label).toBe('INT');
    expect(week9Int.structure).toBe('WU 2 km · 8 × 600 m @ 4:22–4:30/km w/ 300 m jog · CD 2 km');
    expect(speakStructure(week9Int.structure ?? '')).toBe(
      'warm-up 2 km, 8 times 600 m @ 4:22 to 4:30 per kilometer with 300 m jog, cool-down 2 km',
    );
  });

  it('expands a single-value pace band ("GP 4:00/km") the same way as a range, alongside "GP" itself', () => {
    // src/lib/fixtures/examplePlan.ts, week 11 (index 10), Day 3 (index 2):
    // 'WU 2 km · 3 × 1600 m @ GP 4:00/km w/ ~400 m jog · CD 2 km'.
    const week11Rp = examplePlan.weeks[10].days[2] as Workout;
    expect(week11Rp.label).toBe('RP');
    expect(week11Rp.structure).toBe('WU 2 km · 3 × 1600 m @ GP 4:00/km w/ ~400 m jog · CD 2 km');
    expect(speakStructure(week11Rp.structure ?? '')).toBe(
      'warm-up 2 km, 3 times 1600 m @ goal pace 4:00 per kilometer with ~400 m jog, cool-down 2 km',
    );
  });

  it('leaves a bare unit untouched — the defect is the en dash and the slash, not the unit', () => {
    expect(speakStructure('WU 2 km')).toBe('warm-up 2 km');
    expect(speakStructure('600 m')).toBe('600 m');
  });

  it('tolerates a plain hyphen in a pace range, defensively, alongside the en dash', () => {
    expect(speakStructure('@ 4:22-4:30/km')).toBe('@ 4:22 to 4:30 per kilometer');
  });

  it('speaks the race-day structure string from the fixture (issue #34 ruling R6)', () => {
    // src/lib/fixtures/examplePlan.ts, week 12 (index 11), Day 7 (index 6):
    // 'WU 3 km · 5 km race · CD 2 km'.
    const raceDay = examplePlan.weeks[11].days[6] as Workout;
    expect(raceDay.label).toBe('Race Day');
    expect(raceDay.structure).toBe('WU 3 km · 5 km race · CD 2 km');
    expect(speakStructure(raceDay.structure ?? '')).toBe(
      'warm-up 3 km, 5 km race, cool-down 2 km',
    );
  });
});

describe('speakPace — GitHub issue #31 finding 1', () => {
  it('speaks a genuine range with "to", never an en dash, and "per kilometer", never "/km"', () => {
    expect(speakPace({ lowSecPerKm: 281, highSecPerKm: 294 })).toBe(
      '4:41 to 4:54 per kilometer',
    );
  });

  it('speaks a fixed target (low === high) as a single value, not a range', () => {
    expect(speakPace({ lowSecPerKm: 270, highSecPerKm: 270 })).toBe('4:30 per kilometer');
  });

  it('zero-pads seconds under 10 ("4:05", not "4:5")', () => {
    expect(speakPace({ lowSecPerKm: 245, highSecPerKm: 245 })).toBe('4:05 per kilometer');
  });

  it('zero-pads seconds under 10 on both ends of a genuine range', () => {
    expect(speakPace({ lowSecPerKm: 245, highSecPerKm: 302 })).toBe(
      '4:05 to 5:02 per kilometer',
    );
  });

  it('rounds the whole second first, so a fractional input never rolls into a ":60" (issue #31 code-review finding)', () => {
    // 299.63 sec/km (a 3:30:43 marathon goal): floor(4.99) = 4 min but round(59.63) = 60 sec
    // would give "4:60" if minutes and seconds were rounded independently.
    expect(speakPace({ lowSecPerKm: 299.63, highSecPerKm: 299.63 })).toBe('5:00 per kilometer');
  });
});

describe('formatSecPerKm — shared m:ss formatter (issue #31 code-review finding)', () => {
  it('formats a normal integer input as minutes:seconds, zero-padded', () => {
    expect(formatSecPerKm(281)).toBe('4:41');
    expect(formatSecPerKm(245)).toBe('4:05');
  });

  it('rounds the whole second first, so a fractional input never rolls into a ":60"', () => {
    expect(formatSecPerKm(299.63)).toBe('5:00');
  });
});
