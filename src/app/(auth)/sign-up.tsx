import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL, authClient, describeError } from '@/lib/apiClient';
import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { markPostSignupRedirect } from '@/lib/postSignupRedirect';
import { useTheme } from '@/hooks/use-theme';

/** Function over form for this pass — see `sign-in.tsx`'s header for the same note. */
export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // See `sign-in.tsx` for why every `authClient` call needs a try/catch and not just an `error`
  // check — an unreachable backend rejects rather than resolving to `{ error }`.
  async function handleSignUp() {
    setError(null);
    setSubmitting(true);
    try {
      // `minPasswordLength: 8` (workers/src/auth.ts) is enforced server-side; this is not
      // duplicated here so the server's message stays the one source of truth for the copy.
      const { error: signUpError } = await authClient.signUp.email({ name, email, password });
      if (signUpError) {
        setError(signUpError.message ?? 'Sign-up failed. Try a different email or a longer password.');
        return;
      }
      // A brand-new account has no intake yet, so send it straight there instead of leaving Home's
      // "complete your intake" prompt for the runner to notice and tap themselves. This screen
      // cannot reliably do that navigation itself — see `postSignupRedirect.ts`'s header — so it
      // only sets the flag; `_layout.tsx` performs the actual `router.replace` once `session` (and
      // therefore the `intake` route) exists.
      markPostSignupRedirect();
    } catch (signUpError) {
      setError(describeError(signUpError, 'Sign-up failed. Try again.', API_BASE_URL));
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
        <Text style={[styles.title, { color: theme.text.primary }]}>Create account</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="words"
          autoComplete="name"
          style={[styles.input, { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised }]}
        />
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
          placeholder="Password (min 8 characters)"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoComplete="password-new"
          secureTextEntry
          style={[styles.input, { color: theme.text.primary, borderColor: theme.hairline, backgroundColor: theme.surface.raised }]}
        />

        {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || !name || !email || !password}
          onPress={handleSignUp}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.accent.hivis },
            (pressed || submitting) && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.accent.onAccent} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: theme.accent.onAccent }]}>Sign up</Text>
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
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: theme.text.secondary }]}>
            Already have an account? <Text style={{ color: theme.text.primary }}>Sign in</Text>
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
