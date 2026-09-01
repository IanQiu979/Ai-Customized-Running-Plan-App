import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GlossaryEntry, StructureSymbolEntry } from '@/lib/notation';
import { RUN_TYPE_ABBREVIATIONS, STRUCTURE_SHORTHAND, UNABBREVIATED_RUN_TYPES } from '@/lib/notation';

/**
 * Explains every abbreviation the plan view uses: run types first, then structure shorthand
 * (Ian's 2026-07-11 notation ruling, `docs/reference/coaching/notation.md`). All copy is read
 * from `src/lib/notation.ts` — nothing here is hardcoded — so the glossary and the plan view can
 * never drift apart. Strides is the one always-spelled-out run type this screen covers; Race Day
 * and Rest also live in `notation.ts` but aren't run *types* a workout is abbreviated from, so
 * they sit outside this screen's two sections.
 */
export default function GlossaryScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]}>Glossary</Text>
            <Text style={[styles.intro, { color: theme.text.secondary }]}>
              Every plan uses the same shorthand for run types and session structure. Here&apos;s
              what each one means.
            </Text>
          </View>

          <GlossarySection title="Run types">
            {Object.entries(RUN_TYPE_ABBREVIATIONS).map(([code, entry]) => (
              <RunTypeRow key={code} code={code} entry={entry} />
            ))}
            <RunTypeRow code="Strides" entry={UNABBREVIATED_RUN_TYPES.Strides} />
          </GlossarySection>

          <GlossarySection title="Structure shorthand">
            {Object.entries(STRUCTURE_SHORTHAND).map(([symbol, entry]) => (
              <StructureRow key={symbol} symbol={symbol} entry={entry} />
            ))}
          </GlossarySection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function GlossarySection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{title.toUpperCase()}</Text>
      <View>{children}</View>
    </View>
  );
}

/** "ER, Easy Run — Comfortable, conversational-pace aerobic run — the base of every week." */
function RunTypeRow({ code, entry }: { code: string; entry: GlossaryEntry }) {
  const theme = useTheme();
  const isAbbreviated = code !== entry.fullName;
  const accessibilityLabel = isAbbreviated
    ? `${code}, ${entry.fullName} — ${entry.description}`
    : `${entry.fullName} — ${entry.description}`;

  return (
    <View
      style={[styles.row, { borderBottomColor: theme.hairline }]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.heading}>
        {isAbbreviated ? (
          <>
            <Text style={[styles.code, { color: theme.text.primary }]}>{code}</Text>
            <Text style={[styles.fullName, { color: theme.text.secondary }]}> · </Text>
          </>
        ) : null}
        <Text style={[styles.fullName, { color: theme.text.primary }]}>{entry.fullName}</Text>
      </Text>
      <Text style={[styles.description, { color: theme.text.secondary }]}>{entry.description}</Text>
    </View>
  );
}

/** "WU — Warm-up." */
function StructureRow({ symbol, entry }: { symbol: string; entry: StructureSymbolEntry }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.row, { borderBottomColor: theme.hairline }]}
      accessible
      accessibilityLabel={`${symbol} — ${entry.meaning}`}
    >
      <Text style={[styles.code, { color: theme.text.primary }]}>{symbol}</Text>
      <Text style={[styles.description, { color: theme.text.secondary }]}>{entry.meaning}</Text>
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
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.display.extraBold,
    fontSize: FontSize.xxl,
  },
  intro: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
  },
  row: {
    paddingVertical: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    fontSize: FontSize.md,
  },
  code: {
    fontFamily: FontFamily.mono.bold,
  },
  fullName: {
    fontFamily: FontFamily.body.semiBold,
  },
  description: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
