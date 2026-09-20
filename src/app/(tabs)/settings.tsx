import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Group, Row } from '@/components/layout/GroupedRows';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  API_BASE_URL,
  accountHasPassword,
  authClient,
  deleteAccount,
  describeError,
  getQuotaStatus,
} from '@/lib/apiClient';
import { openPrivacyPolicy } from '@/lib/openPrivacyPolicy';
import { confirmDestructive } from '@/lib/confirmDestructive';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { QuotaStatus } from '@/lib/planTypes';

/**
 * Settings. On focus, fetches `getQuotaStatus()` and renders the runner's tier and quota line
 * (`formatQuotaLine`). Free tier gets a proactive "Upgrade" entry point to `/paywall` (no quota
 * param — that route is reserved for the 402 redirect out of Home). Sign-out (moved here from
 * Home) round it out. A "Legal" group links the published privacy policy (`PRIVACY_POLICY_URL`,
 * issue #89) — the in-app link the store guidelines require alongside the listing's URL.
 *
 * **Delete account re-auth** (captain's decision, change-list item 10, 2026-09-20 — "confirm
 * identity with the password, like V2.3"). Which confirmation a tap on "Delete account" opens is
 * decided by `accountHasPassword()` (`apiClient.ts`, read via better-auth's `list-accounts`), read
 * once on focus alongside the quota status:
 *   - a credential account (`hasPassword: true`, or still unknown/loading — fail closed, never
 *     skip the check) opens `<DeleteAccountDialog requiresPassword>`, which sends the entered
 *     password to `deleteAccount(password)`; the Worker is the actual authority (`workers/src/routes.ts`).
 *   - a Google/OAuth-only account (`hasPassword: false`) keeps the pre-existing path exactly:
 *     `confirmDestructive` (the native alert / web `confirm()` seam from issue #96), then
 *     `deleteAccount()` with no password — never locked out of deleting their own account.
 * Either path funnels into the same `handleDeleteAccount`, and on success calls
 * `authClient.signOut()` to invalidate the local session store so `src/app/_layout.tsx`'s
 * `Stack.Protected` guard bounces to `(auth)`.
 *
 * **Zero accent, no exception** (`docs/design/instrument-visual-system.md` §1). This screen is flat
 * grouped rows and hairlines. The "Upgrade" row is deliberately not a signal-marked button: the offer
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
  const [privacyPolicyError, setPrivacyPolicyError] = useState<string | null>(null);
  // `null` = not yet read, so the dialog path (the safer default) is used until we positively
  // know otherwise — see the header.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);

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

      accountHasPassword().then((result) => {
        if (!cancelled) setHasPassword(result);
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Not `Alert.alert` directly: react-native-web implements that as an empty method, which made
  // this row do nothing at all on web (issue #96). `confirmDestructive` keeps the OS alert on
  // native and asks the browser's own dialog on web; either way only an explicit confirm deletes.
  // Only ever reached for an account `accountHasPassword()` positively confirmed has no
  // credential — a credential (or still-unknown) account opens the password dialog instead.
  function confirmDeleteAccountNoPassword() {
    try {
      confirmDestructive(
        {
          title: 'Delete account',
          message: 'This permanently deletes your account, intake, and plans. This cannot be undone.',
          confirmLabel: 'Delete',
        },
        () => handleDeleteAccount()
      );
    } catch (confirmError) {
      // A runtime with no dialog at all (never a real browser) fails closed inside the lib; React
      // does not catch handler throws, so surface it here rather than repeat #96's silent tap.
      setDeleteError(describeError(confirmError, 'Could not open the confirmation.', API_BASE_URL));
    }
  }

  function handleDeleteAccountPress() {
    setDeleteError(null);
    if (hasPassword === false) {
      confirmDeleteAccountNoPassword();
    } else {
      setDialogVisible(true);
    }
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

  // The open chain (same-tab on web, in-app browser then OS handler on native) lives in
  // `src/lib/openPrivacyPolicy.ts`, shared with the intake screen's consent row; every failure
  // reaches visible copy instead of repeating #96's silent tap.
  async function handleOpenPrivacyPolicy() {
    setPrivacyPolicyError(null);
    setPrivacyPolicyError(await openPrivacyPolicy());
  }

  async function handleDeleteAccount(password?: string) {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      setDialogVisible(false);
      // The server-side session row is gone, but `authClient`'s own session store doesn't know
      // that yet — it only refetches on an explicit sign-in/out call, not on a plain `apiFetch`.
      // Call `signOut()` to invalidate it locally so `Stack.Protected`'s `!!session` guard reacts.
      await authClient.signOut();
    } catch (deleteAccountError) {
      // A wrong-password `401 invalid_password` reads through `describeError` as the server's own
      // "That password is incorrect." — shown inline in the dialog, which stays open so the
      // runner can retry rather than losing the flow to a toast that vanishes.
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

          {loading && quota === null ? (
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

          <Group title="Legal">
            <ActionRow
              label="Privacy policy"
              hint="What we collect, who sees it, and how to delete it"
              accessibilityRole="link"
              accessibilityHint="Opens the Pace Blueprint privacy policy"
              onPress={handleOpenPrivacyPolicy}
            />
          </Group>

          {privacyPolicyError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              selectable
              style={[styles.error, { color: theme.status.error }]}
            >
              {privacyPolicyError}
            </Text>
          ) : null}

          <Group title="Danger zone">
            <ActionRow
              label="Delete account"
              hint="Permanently deletes your account, intake and plans"
              tone="destructive"
              busy={deleting}
              onPress={handleDeleteAccountPress}
            />
          </Group>

          {deleteError && !dialogVisible && (
            <Text style={[styles.error, { color: theme.status.error }]}>{deleteError}</Text>
          )}
        </ScrollView>
      </SafeAreaView>

      <DeleteAccountDialog
        visible={dialogVisible}
        requiresPassword={hasPassword !== false}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setDialogVisible(false);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteAccount}
      />
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
