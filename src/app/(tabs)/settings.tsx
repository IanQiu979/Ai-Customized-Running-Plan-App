import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Group, Row } from '@/components/layout/GroupedRows';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, authClient, deleteAccount, describeError, getQuotaStatus } from '@/lib/apiClient';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { QuotaStatus } from '@/lib/planTypes';

/**
 * Settings. On focus, fetches `getQuotaStatus()` and renders the runner's tier and quota line
 * (`formatQuotaLine`). Free tier gets a proactive "Upgrade" entry point to `/paywall` (no quota
 * param — that route is reserved for the 402 redirect out of Home). Sign-out (moved here from
 * Home) and Delete Account (native confirm, then `deleteAccount()`) round it out — on
 * delete-account success, an explicit `authClient.signOut()` invalidates the local session store
 * so `src/app/_layout.tsx`'s `Stack.Protected` guard bounces to `(auth)`.
 *
 * **Zero accent, no exception** (`docs/design/trailhead-visual-system.md` §1). This screen is flat
 * grouped rows and hairlines. The "Upgrade" row is deliberately not an ember button: the offer
 * lives on the Paywall, and this is a door to it. `status.error` on Delete Account is a status
 * colour, not the accent.
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
          <ScreenHeader title="Settings" />

          {loading ? (
            <ActivityIndicator color={theme.text.primary} style={styles.spinner} />
          ) : (
            <Group title="Account">
              {/* The error is a `Text` in `status.error`, not a `Row` — routing it through the
                  row's value slot would set a failure in `text.primary` and make it read as
                  though it were the account state itself. */}
              {error ? (
                <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>
              ) : null}
              {quota ? <Row label="Tier" value={quota.tier.toUpperCase()} mono /> : null}
              {quota ? <Row label="Plans" value={formatQuotaLine(quota)} mono /> : null}
              {quota && !quota.unlimited && quota.tier === 'free' ? (
                <ActionRow
                  label="Upgrade"
                  hint="Pace targets, HR zones and a coach's note on every week"
                  onPress={() => router.push('/paywall')}
                />
              ) : null}
            </Group>
          )}

          <Group title="Session">
            <ActionRow label="Sign out" onPress={handleSignOut} />
          </Group>

          <Group title="Danger zone">
            <ActionRow
              label="Delete account"
              hint="Permanently deletes your account, intake and plans"
              tone="destructive"
              busy={deleting}
              onPress={confirmDeleteAccount}
            />
          </Group>

          {deleteError && (
            <Text style={[styles.error, { color: theme.status.error }]}>{deleteError}</Text>
          )}
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
    gap: Spacing.five,
  },
  spinner: {
    marginTop: Spacing.four,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
});
