export const AGE_BANDS = ['18_plus', '13_17'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_ASSURANCE_STATUSES = ['pending', 'recorded', 'grandfathered'] as const;
export type AgeAssuranceStatus = (typeof AGE_ASSURANCE_STATUSES)[number];

export interface AgeBandChoice {
  ageBand: AgeBand;
  guardianConsent: boolean;
}

export type AgeBandRefusalCode = 'age_band_required' | 'guardian_consent_required';

export type AgeBandParseResult =
  | { ok: true; choice: AgeBandChoice }
  | { ok: false; code: AgeBandRefusalCode; error: string };

function isAgeBand(value: unknown): value is AgeBand {
  return value === '18_plus' || value === '13_17';
}

export function parseAgeBandChoice(raw: unknown): AgeBandParseResult {
  const body =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const { ageBand } = body;

  if (!isAgeBand(ageBand)) {
    return {
      ok: false,
      code: 'age_band_required',
      error: 'Select an age range: 18 or older, or 13 to 17 with a parent or guardian who agrees.',
    };
  }

  if (ageBand === '13_17' && body.guardianConsent !== true) {
    return {
      ok: false,
      code: 'guardian_consent_required',
      error:
        'A parent or guardian must agree to the Privacy Policy on behalf of a runner aged 13 to 17.',
    };
  }

  return {
    ok: true,
    choice: { ageBand, guardianConsent: ageBand === '13_17' },
  };
}

export function selectionOf(
  ageBand: AgeBand | null,
  guardianConsent: boolean
): AgeBandChoice | null {
  if (ageBand === null || (ageBand === '13_17' && !guardianConsent)) return null;
  return { ageBand, guardianConsent: ageBand === '13_17' };
}

export function requiresLegacyIntakeConsent(
  status: unknown,
  age: number
): boolean {
  const usesLegacyFlow = status !== 'recorded' && status !== 'pending';
  return usesLegacyFlow && age >= 13 && age < 18;
}
