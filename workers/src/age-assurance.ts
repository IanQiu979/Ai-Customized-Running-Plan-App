import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import { PRIVACY_POLICY_VERSION } from '../../src/constants/legal';
import {
  parseAgeBandChoice,
  type AgeBandParseResult,
} from '../../src/lib/ageAssurance';

export const AGE_ASSURANCE_AUTH_ERRORS = {
  AGE_BAND_REQUIRED: {
    code: 'AGE_BAND_REQUIRED',
    message:
      'Select an age range: 18 or older, or 13 to 17 with a parent or guardian who agrees.',
  },
  GUARDIAN_CONSENT_REQUIRED: {
    code: 'GUARDIAN_CONSENT_REQUIRED',
    message:
      'A parent or guardian must agree to the Privacy Policy on behalf of a runner aged 13 to 17.',
  },
  AGE_ASSURANCE_IMMUTABLE: {
    code: 'AGE_ASSURANCE_IMMUTABLE',
    message: 'Age assurance cannot be changed through the user profile endpoint.',
  },
} as const;

export type AuthUserCandidate = Record<string, unknown> & {
  name: string;
  email: string;
  emailVerified: boolean;
};

const ASSURANCE_FIELDS = [
  'ageBand',
  'ageAssuranceStatus',
  'agePolicyVersion',
] as const;
const SERVER_OWNED_CREATE_FIELDS = ['ageAssuranceStatus', 'agePolicyVersion'] as const;

function authErrorFor(result: Extract<AgeBandParseResult, { ok: false }>) {
  return result.code === 'guardian_consent_required'
    ? AGE_ASSURANCE_AUTH_ERRORS.GUARDIAN_CONSENT_REQUIRED
    : AGE_ASSURANCE_AUTH_ERRORS.AGE_BAND_REQUIRED;
}

function requireAgeBandChoice(body: unknown) {
  const result = parseAgeBandChoice(body);
  if (!result.ok) {
    throw APIError.from('BAD_REQUEST', authErrorFor(result));
  }
  return result.choice;
}

function rejectServerOwnedCreateFields(body: unknown): void {
  const rawBody =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (SERVER_OWNED_CREATE_FIELDS.some((field) => field in rawBody)) {
    throw APIError.from('BAD_REQUEST', AGE_ASSURANCE_AUTH_ERRORS.AGE_ASSURANCE_IMMUTABLE);
  }
}

/**
 * Stamp only canonical server-owned assurance tuples onto better-auth user inserts.
 *
 * The endpoint path is intentionally exact. Email signup is the sole creation path allowed to
 * arrive already recorded; OAuth and context-free internal creates fail closed as pending.
 */
export function resolveAgeAssuranceForCreate<T extends AuthUserCandidate>(
  path: string | null | undefined,
  body: unknown,
  candidate: T
): T & {
  ageBand: '18_plus' | '13_17' | null;
  ageAssuranceStatus: 'recorded' | 'pending';
  agePolicyVersion: string | null;
} {
  if (path !== '/sign-up/email') {
    return {
      ...candidate,
      ageBand: null,
      ageAssuranceStatus: 'pending',
      agePolicyVersion: null,
    };
  }

  const choice = requireAgeBandChoice(body);
  return {
    ...candidate,
    ageBand: choice.ageBand,
    ageAssuranceStatus: 'recorded',
    agePolicyVersion: PRIVACY_POLICY_VERSION,
  };
}

export function rejectAgeAssuranceUpdate(
  update: Record<string, unknown>,
  requestBody: unknown
): void {
  const rawBody =
    typeof requestBody === 'object' && requestBody !== null
      ? (requestBody as Record<string, unknown>)
      : {};
  if (ASSURANCE_FIELDS.some((field) => field in update || field in rawBody)) {
    throw APIError.from('BAD_REQUEST', AGE_ASSURANCE_AUTH_ERRORS.AGE_ASSURANCE_IMMUTABLE);
  }
}

/** Run age choice validation before better-auth performs its duplicate-email lookup. */
export function ageAssuranceValidationPlugin(): BetterAuthPlugin {
  return {
    id: 'pace-blueprint-age-assurance',
    hooks: {
      before: [
        {
          matcher: (context) => context.path === '/sign-up/email',
          handler: createAuthMiddleware(async (context) => {
            rejectServerOwnedCreateFields(context.body);
            requireAgeBandChoice(context.body);
          }),
        },
      ],
    },
    $ERROR_CODES: AGE_ASSURANCE_AUTH_ERRORS,
  };
}
