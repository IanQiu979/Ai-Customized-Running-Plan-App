import { Stack } from 'expo-router';

/**
 * The unauthenticated stack. Function over form for this pass (captain's explicit call) — no
 * headers, no transition polish, just the screens a signed-out user can reach: onboarding,
 * sign-in, sign-up and forgot-password. The two link landings (`/reset-password`,
 * `/verify-email`) are deliberately NOT here — see the root layout for why they sit outside
 * every session guard.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
