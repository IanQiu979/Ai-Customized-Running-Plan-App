import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the signed-out landing screen (`(auth)/onboarding.tsx`) has ever rendered on this
 * device before. Backs the captain's 2026-09-20 ruling: the first-ever view locks scroll to one
 * animation at a time; every visit after that scrolls freely (`docs/mvp-progress.md`'s
 * "Onboarding replays on every signed-out session" note — this is what closes it).
 *
 * A storage failure resolves to "already visited" — free scroll — rather than a lock that can
 * never clear, since the lock has no manual escape hatch.
 */
const ONBOARDING_VISITED_KEY = 'pace-blueprint.onboarding.visited';

export async function hasVisitedOnboardingBefore(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_VISITED_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function markOnboardingVisited(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_VISITED_KEY, 'true');
  } catch {
    // Best-effort: a write failure only costs a repeat lock next launch, never a stuck one.
  }
}
