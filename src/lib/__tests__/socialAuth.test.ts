import { WebBrowserResultType } from 'expo-web-browser';

import { describeAuthSessionResult, describeOAuthCallbackError } from '../socialAuth';

describe('Google OAuth callback errors', () => {
  it('turns token-exchange failures into an actionable message', () => {
    expect(describeOAuthCallbackError('paceblueprint:///?error=invalid_code')).toContain(
      'server credential may be out of date'
    );
  });

  it('explains consent-screen denial instead of leaving the button apparently dead', () => {
    expect(describeOAuthCallbackError('exp://192.168.1.2:8081/--/?error=access_denied')).toContain(
      'not allowed to use the app'
    );
  });

  it('preserves an unknown provider description when one is returned', () => {
    expect(
      describeOAuthCallbackError(
        'paceblueprint:///?error=temporarily_unavailable&error_description=Try%20again%20later'
      )
    ).toBe('Try again later');
  });

  it('returns null for a successful callback', () => {
    expect(describeOAuthCallbackError('paceblueprint:///?cookie=session')).toBeNull();
  });
});

describe('native auth-session results', () => {
  it('reports a cancelled browser session', () => {
    expect(describeAuthSessionResult({ type: WebBrowserResultType.CANCEL })).toBe(
      'Google sign-in was cancelled.'
    );
  });

  it('reads an OAuth error from a successful deep-link return', () => {
    expect(
      describeAuthSessionResult({ type: 'success', url: 'paceblueprint:///?error=state_not_found' })
    ).toContain('expired or was interrupted');
  });
});
