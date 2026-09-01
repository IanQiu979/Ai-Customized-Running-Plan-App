import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL, authClient, describeError, signInWithGoogle } from '@/lib/apiClient';
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
    setSubmitting(true);
    try {
      const outcome = await signInWithGoogle();
      if (!outcome.ok) setError(outcome.message);
    } catch (socialError) {
      setError(describeError(socialError, 'Google sign-in failed.', API_BASE_URL));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/*
          Centred content overflows off *both* edges once the container is shorter than the
          content, which is exactly what a keyboard does (Android resizes the window, iOS covers
          the bottom) — and an error message only makes the content taller. Without a scroll
          container the title, or the Sign in button, becomes unreachable. `flexGrow: 1` keeps
          today's centred look on a tall screen and lets the content scroll when it doesn't fit.
        */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
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
                { backgroundColor: theme.accent.ember },
                (pressed || submitting) && styles.pressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={theme.accent.onEmber} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: theme.accent.onEmber }]}>Sign in</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.text.primary },
                (pressed || submitting) && styles.pressed,
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
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
