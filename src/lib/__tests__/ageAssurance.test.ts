import {
  ageOnDate,
  canOfferAgeTransition,
  eighteenthBirthday,
  checkAgeTransitionBirthDate,
  latestCalendarDate,
  parseAgeBandChoice,
  parseCalendarDate,
  requiresLegacyIntakeConsent,
  selectionOf,
} from '../ageAssurance';

describe('parseAgeBandChoice', () => {
  it('normalizes an adult choice to guardianConsent false', () => {
    expect(parseAgeBandChoice({ ageBand: '18_plus' })).toEqual({
      ok: true,
      choice: { ageBand: '18_plus', guardianConsent: false },
    });
    expect(parseAgeBandChoice({ ageBand: '18_plus', guardianConsent: true })).toEqual({
      ok: true,
      choice: { ageBand: '18_plus', guardianConsent: false },
    });
  });

  it('accepts a minor choice only with literal guardian consent', () => {
    expect(parseAgeBandChoice({ ageBand: '13_17', guardianConsent: true })).toEqual({
      ok: true,
      choice: { ageBand: '13_17', guardianConsent: true },
    });
    expect(parseAgeBandChoice({ ageBand: '13_17', guardianConsent: false })).toMatchObject({
      ok: false,
      code: 'guardian_consent_required',
    });
    expect(parseAgeBandChoice({ ageBand: '13_17', guardianConsent: 'true' })).toMatchObject({
      ok: false,
      code: 'guardian_consent_required',
    });
  });

  it('uses age_band_required for missing and unknown bands', () => {
    expect(parseAgeBandChoice({})).toMatchObject({ ok: false, code: 'age_band_required' });
    expect(parseAgeBandChoice({ ageBand: 'under_13' })).toMatchObject({
      ok: false,
      code: 'age_band_required',
    });
  });
});

describe('selectionOf', () => {
  it('returns only complete, normalized choices', () => {
    expect(selectionOf(null, false)).toBeNull();
    expect(selectionOf('13_17', false)).toBeNull();
    expect(selectionOf('13_17', true)).toEqual({
      ageBand: '13_17',
      guardianConsent: true,
    });
    expect(selectionOf('18_plus', true)).toEqual({
      ageBand: '18_plus',
      guardianConsent: false,
    });
  });
});

describe('requiresLegacyIntakeConsent', () => {
  it('requires consent only for grandfathered runners aged 13 to 17', () => {
    expect(requiresLegacyIntakeConsent('grandfathered', 13)).toBe(true);
    expect(requiresLegacyIntakeConsent('grandfathered', 16)).toBe(true);
    expect(requiresLegacyIntakeConsent('grandfathered', 17)).toBe(true);
    expect(requiresLegacyIntakeConsent('grandfathered', 18)).toBe(false);
    expect(requiresLegacyIntakeConsent('recorded', 16)).toBe(false);
    expect(requiresLegacyIntakeConsent('pending', 16)).toBe(false);
    expect(requiresLegacyIntakeConsent(null, 16)).toBe(true);
    expect(requiresLegacyIntakeConsent(undefined, 16)).toBe(true);
    expect(requiresLegacyIntakeConsent('future_status', 16)).toBe(true);
  });
});

describe('the aging transition birthday check', () => {
  // 2026-10-01T15:00Z is 2026-10-01 03:00 at UTC−12, so "today" is 1 October everywhere.
  const MIDDAY = new Date('2026-10-01T15:00:00.000Z');

  it('reads today at UTC−12, the last time zone to reach a date', () => {
    expect(latestCalendarDate(new Date('2026-10-01T11:59:59.999Z'))).toEqual({
      year: 2026,
      month: 9,
      day: 30,
    });
    expect(latestCalendarDate(new Date('2026-10-01T12:00:00.000Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 1,
    });
  });

  it('counts a birthday only once its month and day are reached', () => {
    const birth = { year: 2008, month: 10, day: 1 };
    expect(ageOnDate(birth, { year: 2026, month: 9, day: 30 })).toBe(17);
    expect(ageOnDate(birth, { year: 2026, month: 10, day: 1 })).toBe(18);
  });

  it('reaches a 29 February birthday on 1 March in a common year, never a day early', () => {
    const leapling = { year: 2008, month: 2, day: 29 };
    expect(ageOnDate(leapling, { year: 2026, month: 2, day: 28 })).toBe(17);
    expect(ageOnDate(leapling, { year: 2026, month: 3, day: 1 })).toBe(18);
  });

  it('accepts an 18th birthday that is today, and refuses one that is tomorrow', () => {
    expect(checkAgeTransitionBirthDate('2008-10-01', MIDDAY)).toEqual({
      ok: true,
      eighteenthBirthday: '2026-10-01',
    });
    expect(checkAgeTransitionBirthDate('2008-10-02', MIDDAY)).toMatchObject({
      ok: false,
      code: 'age_transition_too_young',
    });
  });

  it('does not let an 18th birthday count early anywhere on Earth', () => {
    // 1 October has begun in UTC+14 and UTC, but not yet at UTC−12.
    expect(
      checkAgeTransitionBirthDate('2008-10-01', new Date('2026-10-01T06:00:00.000Z'))
    ).toMatchObject({ ok: false, code: 'age_transition_too_young' });
  });

  it('refuses anything that is not a real past YYYY-MM-DD date', () => {
    for (const raw of [
      undefined,
      null,
      20000101,
      '',
      '2000-1-01',
      '01/02/2000',
      '2000-02-30',
      '2000-13-01',
      '1899-12-31',
      '2026-10-02',
    ]) {
      expect(checkAgeTransitionBirthDate(raw, MIDDAY)).toMatchObject({
        ok: false,
        code: 'invalid_birth_date',
      });
    }
  });

  it('dates the 18th birthday, moving 29 February to 1 March in a common year', () => {
    expect(eighteenthBirthday({ year: 2008, month: 1, day: 5 })).toBe('2026-01-05');
    expect(eighteenthBirthday({ year: 2008, month: 2, day: 29 })).toBe('2026-03-01');
    expect(eighteenthBirthday({ year: 2012, month: 2, day: 29 })).toBe('2030-03-01');
    expect(eighteenthBirthday({ year: 2014, month: 2, day: 28 })).toBe('2032-02-28');
  });

  it('parses only strict, real calendar dates', () => {
    expect(parseCalendarDate('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseCalendarDate('2001-02-29')).toBeNull();
    expect(parseCalendarDate(' 2000-01-01')).toBeNull();
  });
});

describe('canOfferAgeTransition', () => {
  it('offers the transition only to a recorded 13–17 account', () => {
    expect(canOfferAgeTransition('recorded', '13_17')).toBe(true);
    expect(canOfferAgeTransition('recorded', '18_plus')).toBe(false);
    expect(canOfferAgeTransition('grandfathered', null)).toBe(false);
    expect(canOfferAgeTransition('pending', null)).toBe(false);
    expect(canOfferAgeTransition(undefined, undefined)).toBe(false);
  });
});
