import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, PressedOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, describeError, purchaseTier } from '@/lib/apiClient';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import type { QuotaStatus, Tier } from '@/lib/planTypes';

/**
 * The dummy paywall — reached either proactively (Settings' "Upgrade" row, no `quota` param) or
 * reactively (Home's `generate-plan` catch branch on `over_quota`, which passes the server's
 * `quota` object through as a JSON-stringified route param). There is no real billing here —
 * `purchaseTier()` (`workers/`'s dummy purchase route) flips the tier in the ledger with no
 * payment collected, and the copy says so plainly rather than implying a real charge.
 */
export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { quota: quotaParam } = useLocalSearchParams<{ quota?: string }>();

  const quota = parseQuotaParam(quotaParam);

  const [purchasing, setPurchasing] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(tier: Exclude<Tier, 'free'>) {
    setError(null);
    setPurchasing(tier);
    try {
      await purchaseTier(tier);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (purchaseError) {
      setError(describeError(purchaseError, 'Something went wrong. Try again.', API_BASE_URL));
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Upgrade',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.surface.base },
          headerLeft: () => <PaywallCloseButton color={theme.text.primary} />,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.reason, { color: theme.text.secondary }]}>
            {quota
              ? `You've used ${formatQuotaLine(quota)} — upgrade to generate more plans.`
              : 'Upgrade to generate more plans.'}
          </Text>

          <View
            style={[
              styles.disclaimer,
              { backgroundColor: theme.surface.raised, borderColor: theme.hairline },
            ]}
          >
            <Text style={[styles.disclaimerText, { color: theme.text.secondary }]}>
              This is a test upgrade — no payment required.
            </Text>
          </View>

          {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

          <TierCard
            title="Pro"
            body="3 plans per period."
            pending={purchasing === 'pro'}
            disabled={purchasing !== null}
            onPress={() => handlePurchase('pro')}
          />
          <TierCard
            title="Elite"
            body="10 plans per period."
            pending={purchasing === 'elite'}
            disabled={purchasing !== null}
            onPress={() => handlePurchase('elite')}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Defensive parse — a missing or malformed `quota` param degrades to the generic copy rather
 * than throwing. */
function parseQuotaParam(raw: string | undefined): QuotaStatus | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<QuotaStatus>;
    if (
      typeof parsed.tier === 'string' &&
      typeof parsed.used === 'number' &&
      typeof parsed.limit === 'number' &&
      (parsed.periodEnd === null || typeof parsed.periodEnd === 'string')
    ) {
      return parsed as QuotaStatus;
    }
    return null;
  } catch {
    return null;
  }
}

function PaywallCloseButton({ color }: { color: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Close"
      accessibilityRole="button"
      hitSlop={Spacing.two}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
    >
      <Text style={[styles.closeButtonText, { color }]}>Close</Text>
    </Pressable>
  );
}

function TierCard({
  title,
  body,
  pending,
  disabled,
  onPress,
}: {
  title: string;
  body: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tierCard,
        { borderColor: theme.hairline, backgroundColor: theme.surface.raised },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.tierTitle, { color: theme.text.primary }]}>{title}</Text>
      <Text style={[styles.tierBody, { color: theme.text.secondary }]}>{body}</Text>
      {pending && <ActivityIndicator color={theme.text.primary} style={styles.tierSpinner} />}
    </Pressable>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  reason: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  disclaimer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  disclaimerText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  tierCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tierTitle: {
    fontFamily: FontFamily.display.bold,
    fontSize: FontSize.xl,
  },
  tierBody: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  tierSpinner: {
    marginTop: Spacing.two,
  },
  closeButton: {
    paddingHorizontal: Spacing.two,
  },
  closeButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
