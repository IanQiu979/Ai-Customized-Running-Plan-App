import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationThemes } from '@/constants/navigation-theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/apiClient';
import { consumePostSignupRedirect } from '@/lib/postSignupRedirect';
import { hasSessionSettled } from '@/lib/sessionGate';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  // `sessionPending` is not a one-shot "still loading" flag — better-auth re-raises it on every
  // background refetch while signed out, so it is latched here and never allowed to fall back.
  // See `sessionGate.ts`'s header for the quoted mechanism.
  const [sessionSettled, setSessionSettled] = useState(false);
  useEffect(() => {
    setSessionSettled((settled) => hasSessionSettled(settled, sessionPending));
  }, [sessionPending]);

  const ready = fontsLoaded && sessionSettled;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // This layout never unmounts, unlike `sign-up.tsx` — see `postSignupRedirect.ts`'s header for
  // why the redirect has to be consumed from here rather than from the sign-up screen itself.
  useEffect(() => {
    if (session && consumePostSignupRedirect()) {
      router.replace('/intake');
    }
  }, [session, router]);

  if (!ready) {
    // Keep the native splash screen up — nothing below can render its type-driven UI correctly
    // until the fonts finish loading, and routing a signed-in user into `(auth)` (or vice versa)
    // for one frame while the session is still resolving would be a visible flash, not a state.
    //
    // That reasoning holds for the *first* resolution only, which is why the gate is latched
    // (`sessionSettled`) rather than read straight off `sessionPending`. Returning `null` here
    // unmounts `<Stack>` and every screen under it, so a later refetch re-closing the gate would
    // destroy the sign-up form's `useState` mid-typing and hand the runner a blank form. Once the
    // session has resolved once there is no flash left to prevent: a subsequent change of session
    // is a `Stack.Protected` routing decision, not a reason to tear the tree down.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={NavigationThemes[theme.scheme]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.surface.base },
          }}
        >
          {/*
            The whole app is behind a session, per the captain's explicit "no anonymous
            browsing" decision — every `/api/*` route 403s anonymously anyway, so there is
            nothing an anonymous user could do past sign-in/sign-up. `Stack.Protected`
            (Expo Router's routing-guard primitive) redirects to whichever group's guard is
            true; an authenticated user who lands on `(auth)` — or a signed-out user who lands
            on `(tabs)` — is bounced automatically, including mid-session sign-out.
          */}
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="plan/[id]" />
            <Stack.Screen name="intake" />
            <Stack.Screen name="paywall" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
