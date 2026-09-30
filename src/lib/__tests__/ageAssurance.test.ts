import {
  parseAgeBandChoice,
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
