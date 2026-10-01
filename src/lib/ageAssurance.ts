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

// ---------------------------------------------------------------------------------------------
// The one-way aging transition (captain's decision, 2026-10-01)
// ---------------------------------------------------------------------------------------------

/** The age a `13_17` account must declare to move to `18_plus`. */
export const AGE_TRANSITION_MIN_AGE = 18;

/**
 * The oldest birth year the transition accepts. Not a coaching or legal number — only a bound that
 * rejects an obviously mistyped year instead of storing nothing and saying "adult".
 */
const AGE_TRANSITION_MIN_BIRTH_YEAR = 1900;

/**
 * Hours behind UTC of the last time zone on Earth to reach a given calendar date (UTC−12). Reading
 * "today" there means a runner is never treated as 18 before their birthday has arrived in every
 * time zone; the cost is that a runner far east of UTC may wait up to a day longer.
 */
const LATEST_TIME_ZONE_OFFSET_HOURS = 12;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export type AgeTransitionRefusalCode = 'invalid_birth_date' | 'age_transition_too_young';

export type AgeTransitionCheck =
  | { ok: true }
  | { ok: false; code: AgeTransitionRefusalCode; error: string };

/**
 * Whether an account may offer the transition at all: only a recorded `13_17` one. Display only —
 * the Worker's conditional update is the rule (`workers/src/lib/store.ts`'s
 * `transitionMinorToAdult`); this just keeps the app from offering a control that would be refused.
 */
export function canOfferAgeTransition(status: unknown, ageBand: unknown): boolean {
  return status === 'recorded' && ageBand === '13_17';
}

/** The calendar date it is right now in UTC−12 — see `LATEST_TIME_ZONE_OFFSET_HOURS`. */
export function latestCalendarDate(now: Date): CalendarDate {
  const shifted = new Date(now.getTime() - LATEST_TIME_ZONE_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Whole years between `birth` and `on`. A birthday counts only once its exact month and day are
 * reached, so a 29 February birthday is reached on 1 March in a common year — never a day early.
 */
export function ageOnDate(birth: CalendarDate, on: CalendarDate): number {
  const beforeBirthday =
    on.month < birth.month || (on.month === birth.month && on.day < birth.day);
  return on.year - birth.year - (beforeBirthday ? 1 : 0);
}

/** A strict `YYYY-MM-DD` real calendar date, or `null`. 31 February is refused, not rolled over. */
export function parseCalendarDate(raw: unknown): CalendarDate | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Whether a declared date of birth lets a `13_17` account become `18_plus` at `now`.
 *
 * This proves only that the date the runner typed is at least 18 years old. It is a
 * self-declaration: nothing here — or anywhere in Pace Blueprint — verifies a birthday. The Worker
 * runs it against its own clock; the client may run it only to decide what to show.
 */
export function checkAgeTransitionBirthDate(raw: unknown, now: Date): AgeTransitionCheck {
  const birth = parseCalendarDate(raw);
  const today = latestCalendarDate(now);
  if (
    !birth ||
    birth.year < AGE_TRANSITION_MIN_BIRTH_YEAR ||
    ageOnDate(birth, today) < 0
  ) {
    return {
      ok: false,
      code: 'invalid_birth_date',
      error: 'Enter your date of birth as a real date (YYYY-MM-DD).',
    };
  }
  if (ageOnDate(birth, today) < AGE_TRANSITION_MIN_AGE) {
    return {
      ok: false,
      code: 'age_transition_too_young',
      error: 'That date of birth is under 18, so this account stays 13 to 17.',
    };
  }
  return { ok: true };
}
