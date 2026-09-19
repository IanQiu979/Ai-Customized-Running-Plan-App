import * as Linking from 'expo-linking';

import {
  createResetPasswordURL,
  createVerifyEmailURL,
  isEmailNotVerifiedError,
  normalizeSearchParam,
} from '../authEmail';

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `exp://127.0.0.1:8081/--${path}`),
}));

describe('auth email links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the reset callback through Expo Linking so every runtime gets a full URL', () => {
    expect(createResetPasswordURL()).toBe('exp://127.0.0.1:8081/--/reset-password');
    expect(Linking.createURL).toHaveBeenCalledWith('/reset-password');
  });

  it('builds the verification callback through Expo Linking', () => {
    expect(createVerifyEmailURL()).toBe('exp://127.0.0.1:8081/--/verify-email');
    expect(Linking.createURL).toHaveBeenCalledWith('/verify-email');
  });
});

describe('normalizeSearchParam', () => {
  it.each([
    ['plain value', 'token', 'token'],
    ['surrounding whitespace', '  token  ', 'token'],
    ['one array value', ['token'], 'token'],
    ['one non-empty array value', ['', ' token ', ''], 'token'],
    ['missing value', undefined, null],
    ['empty string', '   ', null],
    ['empty array', [], null],
    ['ambiguous array', ['first', 'second'], null],
  ] as const)('normalizes %s', (_label, input, expected) => {
    expect(normalizeSearchParam(input)).toBe(expected);
  });
});

describe('isEmailNotVerifiedError', () => {
  it('recognises better-auth EMAIL_NOT_VERIFIED errors', () => {
    expect(isEmailNotVerifiedError({ code: 'EMAIL_NOT_VERIFIED' })).toBe(true);
  });

  it('does not mistake another response or a thrown value for verification failure', () => {
    expect(isEmailNotVerifiedError({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(false);
    expect(isEmailNotVerifiedError(new Error('EMAIL_NOT_VERIFIED'))).toBe(false);
    expect(isEmailNotVerifiedError(null)).toBe(false);
  });
});
