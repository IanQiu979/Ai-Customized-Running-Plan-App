import { Redirect } from 'expo-router';

/** The `(auth)` group's anchor route — where `Stack.Protected` lands a signed-out user. */
export default function AuthIndex() {
  return <Redirect href="/(auth)/sign-in" />;
}
