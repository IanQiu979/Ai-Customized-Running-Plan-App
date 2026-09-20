import { useEffect, useState } from 'react';

import { hasVisitedOnboardingBefore, markOnboardingVisited } from '@/lib/onboardingVisit';

/**
 * `true` for exactly one render tree per device: the very first time onboarding has ever
 * rendered. `null` while the flag is still being read from storage — callers should treat that
 * the same as `true` (hold the first-launch lock) since a flash of an unlocked scroll, then a
 * lock snapping shut under the runner's thumb, is worse than briefly holding a lock that was
 * always going to apply.
 */
export function useFirstOnboardingVisit(): boolean | null {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasVisitedOnboardingBefore().then((visited) => {
      if (cancelled) return;
      setIsFirstVisit(!visited);
      if (!visited) markOnboardingVisited();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isFirstVisit;
}
