import AsyncStorage from '@react-native-async-storage/async-storage';

import { hasVisitedOnboardingBefore, markOnboardingVisited } from '../onboardingVisit';

/**
 * Backs the captain's 2026-09-20 first-launch scroll lock (`(auth)/onboarding.tsx`). A storage
 * failure must resolve to "already visited" — free scroll — since the lock has no manual escape
 * hatch and a stuck one would trap every future launch behind it.
 */
describe('onboardingVisit', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('reports not-visited before anything is written', async () => {
    await expect(hasVisitedOnboardingBefore()).resolves.toBe(false);
  });

  it('reports visited once the flag has been written', async () => {
    await markOnboardingVisited();
    await expect(hasVisitedOnboardingBefore()).resolves.toBe(true);
  });

  it('fails open to "visited" when storage read throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(hasVisitedOnboardingBefore()).resolves.toBe(true);
  });

  it('never throws when storage write fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(markOnboardingVisited()).resolves.toBeUndefined();
  });
});
