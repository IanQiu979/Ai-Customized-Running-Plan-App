import * as Linking from 'expo-linking';

/** Expo resolves these to the installed scheme, the current web origin, or Expo Go's exp:// URL. */
export function createResetPasswordURL(): string {
  return Linking.createURL('/reset-password');
}

export function createVerifyEmailURL(): string {
  return Linking.createURL('/verify-email');
}

/** Expo Router may return one value or many. Auth tokens are accepted only when unambiguous. */
export function normalizeSearchParam(value: string | string[] | undefined): string | null {
  const values = (Array.isArray(value) ? value : [value])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length === 1 ? values[0] : null;
}

export function isEmailNotVerifiedError(value: unknown): value is { code: 'EMAIL_NOT_VERIFIED' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    value.code === 'EMAIL_NOT_VERIFIED'
  );
}
