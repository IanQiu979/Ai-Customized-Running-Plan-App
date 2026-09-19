import * as Linking from 'expo-linking';

import {
  type AuthLinkParams,
  createResetPasswordURL,
  createVerifyEmailURL,
  isEmailNotVerifiedError,
  isVerificationPendingSignUp,
  newPasswordProblem,
  normalizeSearchParam,
  PASSWORD_MISMATCH_MESSAGE,
  RESET_LINK_INVALID_MESSAGE,
  resolveResetPasswordEntry,
  resolveVerifyEmailEntry,
  shouldShowVerifyEmailBanner,
  VERIFY_LINK_INVALID_MESSAGE,
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
    expect(normalizeSearchParam(input as string | string[] | undefined)).toBe(expected);
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

describe('resolveResetPasswordEntry', () => {
  it('opens the form when the Worker redirected with a single token', () => {
    expect(resolveResetPasswordEntry({ token: 'abc' })).toEqual({
      kind: 'form',
      token: 'abc',
    });
  });

  it.each([
    ['the Worker reported an invalid link', { token: 'abc', error: 'INVALID_TOKEN' }],
    ['no token arrived', {}],
    ['the token was ambiguous', { token: ['one', 'two'] }],
    ['the token was blank', { token: '   ' }],
  ] as const)('treats the arrival as invalid when %s', (_label, params) => {
    expect(resolveResetPasswordEntry(params as AuthLinkParams)).toEqual({
      kind: 'invalid',
      message: RESET_LINK_INVALID_MESSAGE,
    });
  });
});

describe('resolveVerifyEmailEntry', () => {
  it('reads a bare arrival as a successful verification', () => {
    expect(resolveVerifyEmailEntry({})).toEqual({ kind: 'verified' });
  });

  it.each(['TOKEN_EXPIRED', 'INVALID_TOKEN'])('reads ?error=%s as a failed link', (error) => {
    expect(resolveVerifyEmailEntry({ error })).toEqual({
      kind: 'failed',
      message: VERIFY_LINK_INVALID_MESSAGE,
    });
  });
});

describe('newPasswordProblem', () => {
  it('stays quiet until both fields are filled', () => {
    expect(newPasswordProblem('', '')).toBeNull();
    expect(newPasswordProblem('long-enough', '')).toBeNull();
  });

  it("reports a mismatch and nothing else — length is the server's call", () => {
    expect(newPasswordProblem('long-enough', 'long-enougH')).toBe(PASSWORD_MISMATCH_MESSAGE);
    expect(newPasswordProblem('short', 'short')).toBeNull();
  });
});

describe('isVerificationPendingSignUp', () => {
  it('is true only for better-auth\'s "account created, no session" answer', () => {
    expect(isVerificationPendingSignUp({ token: null })).toBe(true);
    expect(isVerificationPendingSignUp({ token: 'session-token' })).toBe(false);
    expect(isVerificationPendingSignUp(null)).toBe(false);
    expect(isVerificationPendingSignUp(undefined)).toBe(false);
  });
});

describe('shouldShowVerifyEmailBanner', () => {
  it.each([
    ['unverified and mail configured', { emailVerified: false, mailConfigured: true }, true],
    ['verified', { emailVerified: true, mailConfigured: true }, false],
    ['mail not configured', { emailVerified: false, mailConfigured: false }, false],
    ['capability still loading', { emailVerified: false, mailConfigured: null }, false],
    ['no session', { emailVerified: undefined, mailConfigured: true }, false],
  ] as const)('%s', (_label, input, expected) => {
    expect(shouldShowVerifyEmailBanner(input)).toBe(expected);
  });
});
