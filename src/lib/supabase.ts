/**
 * Supabase client, shared by the whole app.
 * https://supabase.com/docs/guides/auth/quickstarts/react-native
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Read with dot notation — Expo only inlines `process.env.EXPO_PUBLIC_*` when
// accessed this way, so destructuring or bracket access yields undefined.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and fill it in, then restart the dev server — ' +
      'Expo inlines these at build time, so a running server will not pick them up.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // AsyncStorage has no web implementation; there supabase-js falls back to localStorage.
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // Native has no URL bar to read a session out of; OAuth returns via deep link.
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Refresh the session only while the app is foregrounded, so a backgrounded app
// stops issuing token refreshes. Registered once, at import.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
