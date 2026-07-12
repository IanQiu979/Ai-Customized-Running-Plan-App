import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Whether this fallback consumed a quota slot. The first 3 fallbacks in a period are
 * quota-exempt; a 4th+ keeps its already-reserved slot and counts like any other plan
 * (`docs/reference/plan-generation.md`, addendum R-B). The two cases make opposite factual
 * claims to the user, so the caller must say which one it is — there is deliberately no
 * default.
 */
export type FallbackVariant = 'exempt' | 'counted';

interface FallbackNoticeProps {
  variant: FallbackVariant;
}

/**
 * The calm, neutral card explaining an `isFallback` plan — raised surface, hairline border,
 * never `status.error`, never hivis. `frontend-design-brief.md` Part 5, "The isFallback
 * treatment". There is no working "Regenerate" action to attach a button to until
 * `generate-plan` exists (Phase 4), so this renders the explanation only, no CTA.
 */
export function FallbackNotice({ variant }: FallbackNoticeProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface.raised, borderColor: theme.hairline }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>This plan wasn&apos;t personalized.</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        We tried twice to build your personalized plan and couldn&apos;t validate the result, so
        this is a template plan for your distance and schedule instead — no pace targets, HR
        zones, or coach notes.{' '}
        {variant === 'exempt'
          ? "This attempt didn't use one of your plans."
          : 'This attempt used one of your plans, the same as any other.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontFamily: FontFamily.body.semiBold,
    fontSize: FontSize.md,
  },
  body: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
