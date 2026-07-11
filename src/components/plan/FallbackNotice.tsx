import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The calm, neutral card explaining an `isFallback` plan — raised surface, hairline border,
 * never `status.error`, never hivis. `frontend-design-brief.md` Part 5, "The isFallback
 * treatment". This is the within-exemption copy variant; the 4th+/quota-consuming variant
 * needs live server quota state that doesn't exist yet in Phase 1, and there is no working
 * "Regenerate" action to attach a button to until `generate-plan` exists (Phase 4) — so this
 * renders the explanation only, no CTA.
 */
export function FallbackNotice() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface.raised, borderColor: theme.hairline }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>This plan wasn&apos;t personalized.</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        We tried twice to build your personalized plan and couldn&apos;t validate the result, so
        this is a template plan for your distance and schedule instead — no pace targets, HR
        zones, or coach notes. This attempt didn&apos;t use one of your plans.
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
