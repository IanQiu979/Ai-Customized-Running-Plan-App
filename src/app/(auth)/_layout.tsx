import { Stack } from 'expo-router';

/**
 * The unauthenticated stack. Function over form for this pass (captain's explicit call) — no
 * headers, no transition polish, just the two screens a signed-out user can reach.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
