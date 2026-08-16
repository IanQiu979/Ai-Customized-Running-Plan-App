import {
  clockFieldError,
  clockPartsToSeconds,
  dateFieldError,
  datePartsToIso,
  decimalOnly,
  digitsOnly,
  EMPTY_CLOCK,
  EMPTY_DATE,
  isClockBlank,
  isDateBlank,
  isoToDateParts,
  secondsToClockParts,
} from '../fieldInput';

describe('digitsOnly — the guard that makes a "number" field hold numbers', () => {
  // The captain's 2026-08-15 report was reproduced on an iOS 26.5 simulator: the letter `v`
  // landed in the intake AGE field, which is `keyboardType="number-pad"`. keyboardType only picks
  // which keyboard is offered; a hardware keyboard, paste, dictation or autofill bypasses it
  // entirely. Filtering is the only thing that actually holds.
  it('drops a letter that a number-pad field would otherwise accept', () => {
    expect(digitsOnly('34v', 3)).toBe('34');
    expect(digitsOnly('v34', 3)).toBe('34');
    expect(digitsOnly('3 4', 3)).toBe('34');
  });

  it('drops pasted punctuation rather than letting it reach the parser', () => {
    expect(digitsOnly('1:45:00', 6)).toBe('14500');
    expect(digitsOnly('2026-09-26', 8)).toBe('20260926');
  });

  it('truncates to the field length', () => {
    expect(digitsOnly('123456', 4)).toBe('1234');
  });

  it('returns empty for input with no digits at all', () => {
    expect(digitsOnly('abc', 4)).toBe('');
  });
});

describe('decimalOnly', () => {
  it('keeps one separator and drops the rest', () => {
    expect(decimalOnly('32.5', 3, 1)).toBe('32.5');
    expect(decimalOnly('32.5.7', 3, 1)).toBe('32.5');
  });

  it('normalises a comma, which some locales’ decimal-pad emits', () => {
    // Number('32,5') is NaN, so an unnormalised comma is a silent rejection later.
    expect(decimalOnly('32,5', 3, 1)).toBe('32.5');
    expect(Number(decimalOnly('32,5', 3, 1))).toBe(32.5);
  });

  it('strips letters', () => {
    expect(decimalOnly('35km', 3, 1)).toBe('35');
  });

  it('bounds both halves', () => {
    expect(decimalOnly('12345.678', 3, 1)).toBe('123.6');
  });
});

describe('clockPartsToSeconds', () => {
  it('reads a sub-hour time with the hours box left blank', () => {
    expect(clockPartsToSeconds({ hours: '', minutes: '24', seconds: '00' })).toBe(24 * 60);
  });

  it('reads a goal time that runs past an hour', () => {
    // 1:45:00 — the exact value the captain could not type on his phone.
    expect(clockPartsToSeconds({ hours: '1', minutes: '45', seconds: '00' })).toBe(6300);
  });

  it('rejects an out-of-range minute or second', () => {
    expect(clockPartsToSeconds({ hours: '1', minutes: '60', seconds: '00' })).toBeNull();
    expect(clockPartsToSeconds({ hours: '1', minutes: '45', seconds: '60' })).toBeNull();
  });

  it('rejects a half-filled field and a zero duration', () => {
    expect(clockPartsToSeconds({ hours: '1', minutes: '', seconds: '00' })).toBeNull();
    expect(clockPartsToSeconds({ hours: '', minutes: '00', seconds: '00' })).toBeNull();
  });

  it('round-trips through secondsToClockParts', () => {
    expect(clockPartsToSeconds(secondsToClockParts(6300))).toBe(6300);
    expect(clockPartsToSeconds(secondsToClockParts(1440))).toBe(1440);
  });

  it('renders a blank clock for an absent stored value', () => {
    expect(secondsToClockParts(undefined)).toEqual(EMPTY_CLOCK);
    expect(isClockBlank(EMPTY_CLOCK)).toBe(true);
  });
});

describe('clockFieldError — quiet while typing, specific once judgeable', () => {
  it('says nothing about an untouched field', () => {
    expect(clockFieldError(EMPTY_CLOCK)).toBeNull();
  });

  it('says nothing mid-entry', () => {
    expect(clockFieldError({ hours: '1', minutes: '', seconds: '' })).toBeNull();
    expect(clockFieldError({ hours: '1', minutes: '45', seconds: '0' })).toBeNull();
  });

  it('names the offending box once it cannot become valid', () => {
    expect(clockFieldError({ hours: '', minutes: '75', seconds: '00' })).toBe('Minutes must be 0-59.');
    expect(clockFieldError({ hours: '', minutes: '24', seconds: '75' })).toBe('Seconds must be 0-59.');
  });

  it('rejects a complete but zero duration', () => {
    expect(clockFieldError({ hours: '', minutes: '00', seconds: '00' })).toBe(
      'Enter a time greater than zero.',
    );
  });

  it('passes a complete, valid time', () => {
    expect(clockFieldError({ hours: '1', minutes: '45', seconds: '00' })).toBeNull();
  });
});

describe('datePartsToIso', () => {
  it('assembles a padded ISO date', () => {
    expect(datePartsToIso({ year: '2026', month: '09', day: '26' })).toBe('2026-09-26');
    expect(datePartsToIso({ year: '2026', month: '9', day: '6' })).toBe('2026-09-06');
  });

  it('rejects a date that does not exist rather than rounding it into the next month', () => {
    expect(datePartsToIso({ year: '2026', month: '02', day: '31' })).toBeNull();
  });

  it('rejects an incomplete year', () => {
    expect(datePartsToIso({ year: '202', month: '09', day: '26' })).toBeNull();
  });

  it('round-trips through isoToDateParts', () => {
    expect(datePartsToIso(isoToDateParts('2026-09-26'))).toBe('2026-09-26');
    expect(isoToDateParts(undefined)).toEqual(EMPTY_DATE);
    expect(isDateBlank(EMPTY_DATE)).toBe(true);
  });
});

describe('dateFieldError', () => {
  it('says nothing about an untouched or half-typed date', () => {
    expect(dateFieldError(EMPTY_DATE)).toBeNull();
    expect(dateFieldError({ year: '2026', month: '0', day: '' })).toBeNull();
  });

  it('names an impossible month or day as soon as both digits are in', () => {
    expect(dateFieldError({ year: '2026', month: '13', day: '' })).toBe('Month must be 01-12.');
    expect(dateFieldError({ year: '2026', month: '09', day: '45' })).toBe('Day must be 01-31.');
  });

  it('catches a well-formed date that is not a real day', () => {
    expect(dateFieldError({ year: '2026', month: '02', day: '31' })).toBe('That date does not exist.');
  });

  it('passes a real date', () => {
    expect(dateFieldError({ year: '2026', month: '09', day: '26' })).toBeNull();
  });
});
