import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGoalRealismNoticeCopy } from '@/lib/goalRealismDisclosure';
import type { GoalRealismNoticeVariant } from '@/lib/goalRealismDisclosure';
import type { GoalRealismAssessment } from '@/lib/planTypes';

interface GoalRealismNoticeProps {
  assessment: GoalRealismAssessment;
  variant?: GoalRealismNoticeVariant;
}

/**
 * The calm, neutral card explaining a goal that isn't `'realistic'` — same raised-surface,
 * hairline-border treatment as `FallbackNotice`, never `status.error`: this is a coaching judgment
 * call, not a failure. Which outcome speaks and what it says is owned entirely by
 * `src/lib/goalRealismDisclosure.ts` — this component only renders what that returns. Call sites
 * that render it before a plan exists pass `variant="preview"` for the future-tense wording.
 */
export function GoalRealismNotice({ assessment, variant = 'plan' }: GoalRealismNoticeProps) {
  const theme = useTheme();
  const copy = getGoalRealismNoticeCopy(assessment, variant);

  if (!copy) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface.raised, borderColor: theme.hairline }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: Stroke.hairline,
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
