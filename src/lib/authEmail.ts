import * as Linking from 'expo-linking';

/**
 * The client half of password recovery and email verification (issue #94). Pure — every decision
 * the three screens and the Home banner make lives here so it can be unit-tested without a render.
 *
 * THE LINK CONTRACT. better-auth mails a Worker URL, never an app URL: the runner opens
 * `<BETTER_AUTH_URL>/api/auth/reset-password/<token>?callbackURL=…` (or
 * `/api/auth/verify-email?token=…&callbackURL=…`), the Worker consumes the token server-side and
 * answers a 302 to the `callbackURL` the app supplied when it asked for the mail. That callback
 * is what `createResetPasswordURL` / `createVerifyEmailURL` build, through `expo-linking` so the
 * same code yields `paceblueprint://reset-password` in a built app, `exp://…/--/reset-password`
 * in Expo Go, and `http://localhost:8081/reset-password` on web — all three are in the Worker's
 * `trustedOrigins` (`workers/src/auth.ts`), which is what lets better-auth's origin check accept
 * them. A reset redirect carries `?token=` for the app to post back; a verify redirect carries
 * nothing on success and `?error=` on failure (`workers/test/auth-email.test.ts` pins both).
 */
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

// ---------------------------------------------------------------------------------------------
// Copy shared by more than one screen, or asserted by a test. The screens' own titles and labels
// live in their JSX; `docs/mvp-progress.md` → Blocked ("copy certification") lists every string.
// ---------------------------------------------------------------------------------------------

/**
 * The honest message when the Worker has no mail provider (`GET /api/email-status` answers
 * `mailConfigured: false`). It names the real limitation and the real remedy rather than
 * pretending a link was sent.
 */
export const MAIL_NOT_CONFIGURED_MESSAGE =
  "Password reset isn't available yet — this server can't send email. Ask whoever runs it to reset your password.";

export const RESET_LINK_INVALID_MESSAGE =
  'This reset link is invalid or has expired. Request a new one.';

export const VERIFY_LINK_INVALID_MESSAGE = 'This verification link is invalid or has expired.';

export const PASSWORD_MISMATCH_MESSAGE = "Passwords don't match.";

/** better-auth's own reset-token lifetime (`resetPasswordTokenExpiresIn`, default 3600 s). */
export const RESET_LINK_LIFETIME_COPY = 'It expires in an hour.';

// ---------------------------------------------------------------------------------------------
// Screen entry states.
// ---------------------------------------------------------------------------------------------

export interface AuthLinkParams {
  token?: string | string[];
  error?: string | string[];
}

export type ResetPasswordEntry =
  { kind: 'form'; token: string } | { kind: 'invalid'; message: string };

/**
 * What `/reset-password` renders on arrival. The Worker redirects here with `?token=` when the
 * mailed link was valid and `?error=INVALID_TOKEN` when it was not; an arrival with neither (a
 * hand-typed URL, a truncated link) is treated as invalid rather than shown an empty form that
 * could only fail on submit.
 */
export function resolveResetPasswordEntry(params: AuthLinkParams): ResetPasswordEntry {
  const token = normalizeSearchParam(params.token);
  const error = normalizeSearchParam(params.error);
  if (error || !token) return { kind: 'invalid', message: RESET_LINK_INVALID_MESSAGE };
  return { kind: 'form', token };
}

export type VerifyEmailEntry = { kind: 'verified' } | { kind: 'failed'; message: string };

/**
 * What `/verify-email` renders on arrival. better-auth redirects here bare on success and with
 * `?error=TOKEN_EXPIRED` / `?error=INVALID_TOKEN` on failure; both failures get the same copy
 * because the remedy (send a new link) is the same.
 */
export function resolveVerifyEmailEntry(params: AuthLinkParams): VerifyEmailEntry {
  const error = normalizeSearchParam(params.error);
  return error ? { kind: 'failed', message: VERIFY_LINK_INVALID_MESSAGE } : { kind: 'verified' };
}

/**
 * Whether the two new-password fields are ready to submit. Matching is the one check the client
 * makes: the minimum length stays server-side (`minPasswordLength` in `workers/src/auth.ts`) so
 * the server's message is the single source of that copy, exactly as on sign-up.
 */
export function newPasswordProblem(password: string, confirmation: string): string | null {
  if (!password || !confirmation) return null;
  return password === confirmation ? null : PASSWORD_MISMATCH_MESSAGE;
}

// ---------------------------------------------------------------------------------------------
// Verification state.
// ---------------------------------------------------------------------------------------------

/**
 * A sign-up that created the account but no session: better-auth answers `token: null` (instead
 * of a session token) when `requireEmailVerification` is on, and the runner must open the mailed
 * link before they can sign in. `Stack.Protected` will not move them, so the sign-up screen has
 * to say so itself.
 */
export function isVerificationPendingSignUp(
  data: { token: string | null } | null | undefined
): boolean {
  return data !== null && data !== undefined && data.token === null;
}

/**
 * The Home banner shows only when it can be acted on: the account is unverified AND the Worker
 * can actually send the link. While the capability read is still in flight (`null`) nothing is
 * shown — a banner that flashes in and out is worse than one that arrives a beat late.
 */
export function shouldShowVerifyEmailBanner(input: {
  emailVerified: boolean | null | undefined;
  mailConfigured: boolean | null;
}): boolean {
  return input.mailConfigured === true && input.emailVerified === false;
}
