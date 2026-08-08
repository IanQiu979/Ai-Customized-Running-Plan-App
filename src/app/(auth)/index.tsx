import { Redirect } from 'expo-router';

/**
 * The `(auth)` group's anchor route — where `Stack.Protected` lands a signed-out user.
 *
 * That is EVERY signed-out session, not just a first install: a returning user who signed out (or
 * whose session expired) lands on onboarding too. Deliberate — onboarding's sign-in link exists
 * precisely so they can skip straight past it. Persisting a "has seen onboarding" flag to route
 * them elsewhere is a separate product decision, not an oversight here.
 */
export default function AuthIndex() {
  return <Redirect href="/(auth)/onboarding" />;
}
