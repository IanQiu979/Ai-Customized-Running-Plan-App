import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, deleteAccount, describeError, getQuotaStatus } from '@/lib/apiClient';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { QuotaStatus } from '@/lib/planTypes';

/**
 * Settings. On focus, fetches `getQuotaStatus()` and renders the runner's tier and quota line
 * (`formatQuotaLine`). Free tier gets a proactive "Upgrade" entry point to `/paywall` (no quota
 * param — that route is reserved for the 402 redirect out of Home). Sign-out (moved here from
 * Home) and Delete Account (native confirm, then `deleteAccount()`) round it out — no
 * on delete-account success, an explicit `authClient.signOut()` invalidates the local session
 * store so `src/app/_layout.tsx`'s `Stack.Protected` guard bounces to `(auth)`.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      (async () => {
        try {
          const status = await getQuotaStatus();
          if (!cancelled) setQuota(status);
        } catch (fetchError) {
          if (!cancelled) {
            setError(describeError(fetchError, 'Could not load your account.', API_BASE_URL));
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, intake, and plans. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  }

  // `onPress={() => authClient.signOut()}` handed React Native a promise nobody awaited, so an
  // unreachable backend surfaced as an unhandled rejection instead of anything the runner could
  // read. Swallowing it is right here, and only here: `@better-auth/expo`'s `onRequest` hook clears
  // the stored cookie and sets `session.data = null` *before* the request goes out (verified in its
  // compiled `dist/client.js`), so by the time this rejects the local session is already gone,
  // `Stack.Protected` has bounced to `(auth)`, and this screen is unmounted — there is no surface
  // left to show an error on, and the runner got the sign-out they asked for either way.
  async function handleSignOut() {
    try {
      await authClient.signOut();
    } catch {
      // Intentionally ignored — see above.
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // The server-side session row is gone, but `authClient`'s own session store doesn't know
      // that yet — it only refetches on an explicit sign-in/out call, not on a plain `apiFetch`.
      // Call `signOut()` to invalidate it locally so `Stack.Protected`'s `!!session` guard reacts.
      await authClient.signOut();
    } catch (deleteAccountError) {
      setDeleteError(describeError(deleteAccountError, 'Something went wrong. Try again.', API_BASE_URL));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Settings</Text>

          {loading ? (
            <ActivityIndicator color={theme.text.primary} style={styles.spinner} />
          ) : (
            <View style={styles.section}>
              {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}
              {quota && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>TIER</Text>
                  <Text style={[styles.tierValue, { color: theme.text.primary }]}>
                    {quota.tier.toUpperCase()}
                  </Text>
                  <Text style={[styles.body, { color: theme.text.secondary }]}>
                    {formatQuotaLine(quota)}
                  </Text>
                  {!quota.unlimited && quota.tier === 'free' && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/paywall')}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.accent.ember },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.primaryButtonText, { color: theme.accent.onEmber }]}>
                        Upgrade
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.text.secondary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text.secondary }]}>Sign out</Text>
          </Pressable>

          <View style={styles.section}>
            {deleteError && (
              <Text style={[styles.error, { color: theme.status.error }]}>{deleteError}</Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDeleteAccount}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.status.error },
                (pressed || deleting) && styles.pressed,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={theme.status.error} />
              ) : (
                <Text style={[styles.secondaryButtonText, { color: theme.status.error }]}>
                  Delete Account
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  title: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xxl,
  },
  spinner: {
    marginTop: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  tierValue: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
  },
  body: {
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
    marginTop: Spacing.two,
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
  pressed: {
    opacity: PressedOpacity,
  },
});
