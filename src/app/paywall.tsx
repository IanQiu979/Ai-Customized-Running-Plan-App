import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteLine } from '@/components/brand/RouteLine';
import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Radius,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL, describeError, purchaseTier } from '@/lib/apiClient';
import { formatQuotaLine } from '@/lib/quotaDisplay';
import { TIER_PLAN_LIMITS } from '@/lib/tierLimits';
import type { QuotaStatus, Tier } from '@/lib/planTypes';

/**
 * The dummy paywall — reached either proactively (Settings' "Upgrade" row, no `quota` param) or
 * reactively (Home's `generate-plan` catch branch on `over_quota`, which passes the server's
 * `quota` object through as a JSON-stringified route param). There is no real billing here —
 * `purchaseTier()` (`workers/`'s dummy purchase route) flips the tier in the ledger with no
 * payment collected, and the copy says so plainly rather than implying a real charge.
 *
 * Trailhead's pricing-page register: dark vertical slabs on `surface.inverse`, which is dark in
 * BOTH colour schemes — the inversion is the whole gesture, and a card that quietly becomes
 * ordinary `raised` in dark mode loses it. Elite is the one ember element on the screen; Pro is
 * an outline. That is what "one accent, one action" buys — a genuine recommendation instead of
 * two equally loud buttons.
 *
 * Every plan count comes from `TIER_PLAN_LIMITS`, the shared constant `workers/` imports too.
 * `planning/03-engineering-requirements.md` mandates that file by name precisely because Echo V1
 * hand-duplicated these numbers and they drifted.
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
          headerTitle: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.surface.base },
          headerLeft: () => <PaywallCloseButton color={theme.text.primary} />,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.masthead}>
            <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>UPGRADE</Text>
            <Text style={[styles.title, { color: theme.text.primary }]}>Go further.</Text>
            <Text style={[styles.reason, { color: theme.text.secondary }]}>
              {quota
                ? `You've used ${formatQuotaLine(quota)}. Pro and Elite add pace targets, HR zones and a coach's note on every week.`
                : 'Pro and Elite add pace targets, HR zones and a coach’s note on every week.'}
            </Text>
            <RouteLine variant="header" showSummit baseline style={styles.rule} />
          </View>

          {error && <Text style={[styles.error, { color: theme.status.error }]}>{error}</Text>}

          <TierCard
            title="Pro"
            plans={TIER_PLAN_LIMITS.pro}
            features={[
              'Pace targets on every session',
              'HR zones, or RPE under 18',
              'Warm-ups, drills and cool-downs',
              'A coach’s note on every week',
            ]}
            recommended={false}
            pending={purchasing === 'pro'}
            disabled={purchasing !== null}
            onPress={() => handlePurchase('pro')}
          />
          <TierCard
            title="Elite"
            plans={TIER_PLAN_LIMITS.elite}
            features={[
              'Everything in Pro',
              'Tuned to your injury history',
              'The richest personalization pass',
            ]}
            recommended
            pending={purchasing === 'elite'}
            disabled={purchasing !== null}
            onPress={() => handlePurchase('elite')}
          />

          <View style={[styles.disclaimer, { borderColor: theme.hairline }]}>
            <Text style={[styles.disclaimerText, { color: theme.text.secondary }]}>
              This is a test upgrade — no payment required.
            </Text>
          </View>
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
      (parsed.limit === null || typeof parsed.limit === 'number') &&
      (parsed.periodEnd === null || typeof parsed.periodEnd === 'string') &&
      typeof parsed.unlimited === 'boolean'
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

/**
 * One dark pricing slab. `recommended` is what earns the ember fill on the action; the other card
 * gets an outline on the same dark ground.
 *
 * The whole card is NOT the press target: a `Pressable` wrapping a feature list means every
 * attempt to read it is a purchase attempt. The button is the button.
 */
function TierCard({
  title,
  plans,
  features,
  recommended,
  pending,
  disabled,
  onPress,
}: {
  title: string;
  plans: number;
  features: readonly string[];
  recommended: boolean;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.tierCard,
        { backgroundColor: theme.surface.inverse, borderColor: theme.grid.inverseHairline },
      ]}
    >
      <View style={styles.tierHeader}>
        <Text style={[styles.tierTitle, { color: theme.text.onInverse }]}>{title}</Text>
        {recommended ? (
          <View style={[styles.badge, { backgroundColor: theme.accent.ember }]}>
            <Text style={[styles.badgeText, { color: theme.accent.onEmber }]}>RECOMMENDED</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.quotaLine}>
        <Text style={[styles.quotaNumber, { color: theme.text.onInverse }]}>{plans}</Text>
        <Text style={[styles.quotaUnit, { color: theme.text.onInverseMuted }]}>
          {plans === 1 ? 'PLAN PER PERIOD' : 'PLANS PER PERIOD'}
        </Text>
      </View>

      <View style={[styles.tierRule, { backgroundColor: theme.text.onInverseMuted }]} />

      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature} style={styles.feature}>
            <Text style={[styles.featureMark, { color: theme.text.onInverseMuted }]}>—</Text>
            <Text style={[styles.featureText, { color: theme.text.onInverseMuted }]}>{feature}</Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Upgrade to ${title}`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tierButton,
          recommended
            ? { backgroundColor: theme.accent.ember }
            : { borderWidth: Stroke.mark, borderColor: theme.text.onInverse },
          (pressed || disabled) && styles.pressed,
        ]}
      >
        {pending ? (
          <ActivityIndicator color={recommended ? theme.accent.onEmber : theme.text.onInverse} />
        ) : (
          <Text
            style={[
              styles.tierButtonText,
              { color: recommended ? theme.accent.onEmber : theme.text.onInverse },
            ]}
          >
            Choose {title}
          </Text>
        )}
      </Pressable>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  masthead: {
    gap: Spacing.one,
  },
  eyebrow: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  reason: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
    marginTop: Spacing.one,
  },
  rule: {
    marginTop: Spacing.two,
  },
  error: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
  },
  tierCard: {
    borderRadius: Radius.card,
    borderWidth: Stroke.hairline,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tierTitle: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: Tracking.display,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeText: {
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  quotaLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  quotaNumber: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.hero,
    letterSpacing: Tracking.display,
  },
  quotaUnit: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  tierRule: {
    height: Stroke.hairline,
    opacity: 0.4,
  },
  features: {
    gap: Spacing.two,
  },
  feature: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  featureMark: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.sm,
  },
  featureText: {
    flex: 1,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  tierButton: {
    minHeight: Spacing.six,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  tierButtonText: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.sm,
  },
  disclaimer: {
    borderWidth: Stroke.hairline,
    borderRadius: Radius.card,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  disclaimerText: {
    fontFamily: FontFamily.body.medium,
    fontSize: FontSize.xs,
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
