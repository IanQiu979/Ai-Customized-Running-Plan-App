import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL, authClient, describeError } from '@/lib/apiClient';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Function over form for this pass (captain's explicit call) — no design polish, just a working
 * email/password sign-in and a Google button. `Stack.Protected` in the root layout does the
 * actual navigation once a session exists; this screen only needs to make the sign-in call.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Every `authClient` call needs its own try/catch, not just an `error` check: better-auth's
  // `{ data, error }` contract only covers responses it received. A request that never reached the
  // Worker — the everyday case when the backend isn't running, or when EXPO_PUBLIC_API_BASE_URL
  // points at localhost and the app is on a real phone — rejects instead. Uncaught in a `Pressable`
  // handler that means an unhandled promise rejection *and* a `submitting` flag that never clears,
  // so the button spins forever and sign-in is unreachable. See `apiErrors.ts`.
  async function handleSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? 'Sign-in failed. Check your email and password.');
      }
    } catch (signInError) {
      setError(describeError(signInError, 'Sign-in failed. Try again.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    try {
      const { error: socialError } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
      if (socialError) {
        // better-auth returns { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } when a
        // provider isn't registered — the case here until the captain's Google OAuth credentials
        // land (v22-google-oauth-creds). Show a plain, honest message instead of the raw backend
        // string; keep the button visible either way.
        if (socialError.code === 'PROVIDER_NOT_FOUND') {
          setError("Google sign-in isn't available yet.");
        } else {
          setError(socialError.message ?? 'Google sign-in failed.');
        }
      }
    } catch (socialError) {
      setError(describeError(socialError, 'Google sign-in failed.', API_BASE_URL));
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Sign in</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          style={[styles.input, { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised }]}
        />

        {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || !email || !password}
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.accent.hivis },
            (pressed || submitting) && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.accent.onAccent} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: theme.accent.onAccent }]}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleGoogleSignIn}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.text.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text.primary }]}>Continue with Google</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/sign-up')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: theme.text.secondary }]}>
            No account? <Text style={{ color: theme.text.primary }}>Sign up</Text>
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
    marginBottom: Spacing.three,
  },
  input: {
    minHeight: Spacing.six,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  primaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  secondaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.two,
    minHeight: Spacing.six,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.xs,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
