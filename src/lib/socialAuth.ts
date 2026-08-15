import { WebBrowserResultType } from 'expo-web-browser';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';

/** OAuth failures returned to the app deep link by better-auth/Google. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled or this account is not allowed to use the app.',
  invalid_code:
    'Google could not complete sign-in. The server credential may be out of date; please try again or contact support.',
  no_code: 'Google did not return a sign-in code. Please try again.',
  oauth_provider_not_found: 'Google sign-in is not configured on the server.',
  state_mismatch: 'Google sign-in expired or was interrupted. Please try again.',
  state_not_found: 'Google sign-in expired or was interrupted. Please try again.',
  unable_to_get_user_info: 'Google signed in, but did not return the account details the app needs.',
};

export function describeOAuthCallbackError(url: string): string | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('error');
    if (!code) return null;

    const knownMessage = OAUTH_ERROR_MESSAGES[code];
    if (knownMessage) return knownMessage;

    const description = parsed.searchParams.get('error_description');
    return description || `Google sign-in failed (${code.replaceAll('_', ' ')}). Please try again.`;
  } catch {
    return 'Google sign-in returned an invalid response. Please try again.';
  }
}

export function describeAuthSessionResult(result: WebBrowserAuthSessionResult): string | null {
  if (result.type === 'success') {
    return describeOAuthCallbackError(result.url);
  }
  if (result.type === WebBrowserResultType.CANCEL || result.type === WebBrowserResultType.DISMISS) {
    return 'Google sign-in was cancelled.';
  }
  if (result.type === WebBrowserResultType.LOCKED) {
    return 'Another sign-in window is already open. Close it and try again.';
  }
  return 'Google sign-in did not complete. Please try again.';
}
