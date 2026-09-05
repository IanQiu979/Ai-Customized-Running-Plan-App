import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // The textbook hydration-flag pattern (return a fixed value on the server/first render, then
    // read the real one once mounted) — not the "derive state from props" anti-pattern
    // `react-hooks/set-state-in-effect` (new in the eslint-plugin-react-hooks bumped by the SDK 56
    // upgrade) is meant to catch. This file is Expo's own `expo-router` template scaffold.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
