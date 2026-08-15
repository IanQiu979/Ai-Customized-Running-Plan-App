/**
 * Pure helpers behind the app's structured numeric inputs.
 *
 * **Why these exist.** On 2026-08-15 the captain reported that the phone keyboard for the plan
 * fields was "missing the colons, the dashes" he needed to type `1:45:00` or `2026-09-26`. Both
 * halves of that are real:
 *
 * 1. `keyboardType="number-pad"` genuinely offers no `:` or `-`. The old screens hid that behind
 *    an as-you-type mask that inserted the separators for you, but the field's own label still
 *    demanded punctuation the keyboard could not produce, so the control read as broken even when
 *    it worked.
 * 2. `keyboardType` is only a hint about which keyboard to *present*. It restricts nothing. A
 *    hardware keyboard, a paste, dictation or autofill puts arbitrary text straight into a
 *    "number" field — verified on an iOS 26.5 simulator, where the letter `v` landed in the
 *    intake AGE field and the runner then got "Age must be a whole number between 13 and 100."
 *
 * The fix for (1) is to stop asking anyone to type a separator: the date and clock fields are
 * split into one box per component with the `-` / `:` **printed between them**. The fix for (2) is
 * these functions — every numeric field filters its own input, so a non-digit can never reach the
 * parser and there is no unhelpful error to hit.
 *
 * Pure and dependency-free on purpose: imported by screens and by `workers/`-shared code alike.
 */

/** Strips everything but digits, then truncates. The floor under every numeric field. */
export function digitsOnly(text: string, maxLength: number): string {
  return text.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Digits plus at most one decimal separator, for a field like weekly volume that accepts `32.5`.
 * A comma is accepted and normalised to `.` — some locales' `decimal-pad` emits one, and
 * `Number('32,5')` is `NaN`.
 */
export function decimalOnly(text: string, maxIntegerDigits: number, maxFractionDigits: number): string {
  const normalized = text.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  const head = whole.slice(0, maxIntegerDigits);
  if (rest.length === 0) return head;
  return `${head}.${rest.join('').slice(0, maxFractionDigits)}`;
}

// ---------------------------------------------------------------------------------------------
// Clock — a duration, entered as separate hour / minute / second boxes
// ---------------------------------------------------------------------------------------------

export interface ClockParts {
  hours: string;
  minutes: string;
  seconds: string;
}

export const EMPTY_CLOCK: ClockParts = { hours: '', minutes: '', seconds: '' };

/** True when the runner has typed nothing at all — an optional clock field left blank. */
export function isClockBlank(parts: ClockParts): boolean {
  return !parts.hours && !parts.minutes && !parts.seconds;
}

/**
 * Total seconds, or `null` when the parts do not describe a usable duration. `null` covers both
 * "blank" and "invalid"; callers that need to tell those apart check `isClockBlank` first.
 *
 * Hours may be omitted (a 24-minute 5K is `24` / `00`), which is why an empty hours box is `0`
 * rather than a rejection. Minutes and seconds must both be present, because "24 minutes and
 * some unstated number of seconds" is not a time anyone meant to enter.
 */
export function clockPartsToSeconds(parts: ClockParts): number | null {
  if (!parts.minutes || !parts.seconds) return null;
  const hours = parts.hours ? Number(parts.hours) : 0;
  const minutes = Number(parts.minutes);
  const seconds = Number(parts.seconds);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) {
    return null;
  }
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/**
 * The message to show under a clock field, or `null` when there is nothing to say. Stays quiet
 * while the runner is mid-entry — a half-typed `2` in the seconds box is not yet wrong — and
 * speaks only once a box holds a value that can never become valid, or once the field is
 * complete enough to judge.
 */
export function clockFieldError(parts: ClockParts): string | null {
  if (isClockBlank(parts)) return null;
  if (parts.minutes && Number(parts.minutes) > 59) return 'Minutes must be 0-59.';
  if (parts.seconds.length === 2 && Number(parts.seconds) > 59) return 'Seconds must be 0-59.';
  if (!parts.minutes || !parts.seconds) return null;
  if (parts.seconds.length < 2) return null;
  return clockPartsToSeconds(parts) === null ? 'Enter a time greater than zero.' : null;
}

/** Splits stored seconds back into boxes. Hours stays blank under an hour, matching entry. */
export function secondsToClockParts(totalSeconds: number | undefined): ClockParts {
  if (totalSeconds === undefined) return EMPTY_CLOCK;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hours: hours > 0 ? String(hours) : '',
    minutes: hours > 0 ? pad(minutes) : String(minutes),
    seconds: pad(seconds),
  };
}

// ---------------------------------------------------------------------------------------------
// Calendar date — entered as separate year / month / day boxes
// ---------------------------------------------------------------------------------------------

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export const EMPTY_DATE: DateParts = { year: '', month: '', day: '' };

export function isDateBlank(parts: DateParts): boolean {
  return !parts.year && !parts.month && !parts.day;
}

/**
 * `YYYY-MM-DD`, or `null` when the parts are incomplete or do not name a real calendar day.
 * Rejects 31 February the same way the server does rather than round it into March.
 */
export function datePartsToIso(parts: DateParts): string | null {
  if (parts.year.length !== 4 || !parts.month || !parts.day) return null;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Same quiet-while-typing contract as `clockFieldError`. */
export function dateFieldError(parts: DateParts): string | null {
  if (isDateBlank(parts)) return null;
  if (parts.month.length === 2 && (Number(parts.month) < 1 || Number(parts.month) > 12)) {
    return 'Month must be 01-12.';
  }
  if (parts.day.length === 2 && (Number(parts.day) < 1 || Number(parts.day) > 31)) {
    return 'Day must be 01-31.';
  }
  if (parts.year.length !== 4 || parts.month.length < 2 || parts.day.length < 2) return null;
  return datePartsToIso(parts) === null ? 'That date does not exist.' : null;
}

export function isoToDateParts(iso: string | undefined): DateParts {
  if (!iso) return EMPTY_DATE;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return EMPTY_DATE;
  return { year: match[1], month: match[2], day: match[3] };
}
