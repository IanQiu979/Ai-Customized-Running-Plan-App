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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { DuskHero } from '@/components/brand/DuskHero';
import {
  DuskGradient,
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, describeError, signInWithGoogle } from '@/lib/apiClient';

/**
 * Sign-in. Trailhead gives it the same dusk exception the landing screen has, at `band` height
 * rather than `cover` — enough for the gradient to carry across all three signed-out screens
 * without a 256pt hero fighting the keyboard for room. The form itself is paper and ink, and the
 * one ember element on the screen is the Sign in button.
 *
 * `Stack.Protected` in the root layout does the actual navigation once a session exists; this
 * screen only needs to make the sign-in call.
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

  const disabled = submitting || !email || !password;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/*
          The form scrolls. Without a scroll container the title, or the Sign in button, becomes
          unreachable once the container is shorter than the content — which is exactly what a
          keyboard does (Android resizes the window, iOS covers the bottom), and an error message
          only makes the content taller.
        */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <DuskHero size="band">
              <Text style={[styles.eyebrow, { color: DuskGradient.onDuskMuted }]}>
                PACE BLUEPRINT
              </Text>
              <Text style={[styles.title, { color: DuskGradient.onDusk }]}>Welcome back</Text>
            </DuskHero>

            <View style={styles.form}>
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                autoCapitalize="none"
                autoComplete="password"
                secureTextEntry
              />

              {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={handleSignIn}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: disabled ? theme.progress.disabled : theme.accent.ember },
                  pressed && !disabled && styles.pressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.accent.onEmber} />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: disabled ? theme.text.primary : theme.accent.onEmber },
                    ]}
                  >
                    Sign in
                  </Text>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
                <Text style={[styles.dividerLabel, { color: theme.text.secondary }]}>OR</Text>
                <View style={[styles.dividerRule, { backgroundColor: theme.hairline }]} />
              </View>

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
                <Text style={[styles.secondaryButtonText, { color: theme.text.primary }]}>
                  Continue with Google
                </Text>
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
            </View>
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
  scrollContent: { flexGrow: 1 },
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
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
    marginTop: Spacing.one,
  },
  primaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerRule: {
    flex: 1,
    height: Stroke.hairline,
  },
  dividerLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  secondaryButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    borderWidth: Stroke.mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  linkButton: {
    alignItems: 'center',
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
