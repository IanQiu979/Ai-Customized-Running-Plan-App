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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationThemes } from '@/constants/navigation-theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/apiClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
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

  const ready = fontsLoaded && !sessionPending;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    // Keep the native splash screen up — nothing below can render its type-driven UI correctly
    // until the fonts finish loading, and routing a signed-in user into `(auth)` (or vice versa)
    // for one frame while the session is still resolving would be a visible flash, not a state.
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
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
