import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import {
  FontFamily,
  FontSize,
  PressedOpacity,
  Spacing,
  Stroke,
  Tracking,
} from '@/constants/theme';
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
 *
 * **Zero accent and zero ornament, no exception** (`docs/design/instrument-visual-system.md` §1):
 * no route line in the header, no signal colour anywhere. This is a reference table, and a reference table
 * that decorates itself is harder to read, not more appealing.
 *
 * It does not use `components/layout/GroupedRows.tsx` the way Settings does: a glossary row is a
 * two-line definition, not a label/value pair, so it would have to fight that component's shape
 * rather than reuse it. The visual language — a mono section label over hairline-separated rows —
 * is deliberately identical.
 */
export default function GlossaryScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface.base }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            title="Glossary"
            supporting="Every plan uses the same shorthand for run types and session structure. Here's what each one means."
          />

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
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: theme.text.secondary }]}
      >
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionBody, { borderTopColor: theme.hairline }]}>{children}</View>
    </View>
  );
}

/** "ER, Easy Run", expanding to the full description inline. */
function RunTypeRow({ code, entry }: { code: string; entry: GlossaryEntry }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isAbbreviated = code !== entry.fullName;
  const accessibilityLabel = isAbbreviated ? `${code}, ${entry.fullName}` : entry.fullName;

  return (
    <View style={[styles.row, { borderBottomColor: theme.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={expanded ? 'Collapses this definition' : 'Expands this definition'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.rowToggle, pressed && styles.pressed]}
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
        <DisclosureArrow expanded={expanded} color={theme.text.secondary} />
      </Pressable>
      {expanded ? (
        <Text style={[styles.description, styles.expandedBody, { color: theme.text.secondary }]}>
          {entry.description}
        </Text>
      ) : null}
    </View>
  );
}

/** "WU", expanding to its meaning inline. */
function StructureRow({ symbol, entry }: { symbol: string; entry: StructureSymbolEntry }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.row, { borderBottomColor: theme.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={symbol}
        accessibilityHint={expanded ? 'Collapses this definition' : 'Expands this definition'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.rowToggle, pressed && styles.pressed]}
      >
        <Text style={[styles.symbol, { color: theme.text.primary }]}>{symbol}</Text>
        <DisclosureArrow expanded={expanded} color={theme.text.secondary} />
      </Pressable>
      {expanded ? (
        <Text
          style={[
            styles.description,
            styles.expandedBody,
            styles.structureBody,
            { color: theme.text.secondary },
          ]}
        >
          {entry.meaning}
        </Text>
      ) : null}
    </View>
  );
}

/** A local, drawn disclosure arrow whose size and stroke come from the Instrument tokens. */
function DisclosureArrow({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <View
      style={styles.arrow}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.arrowMark,
          { borderColor: color },
          expanded ? styles.arrowMarkUp : styles.arrowMarkDown,
        ]}
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
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  sectionBody: {
    borderTopWidth: Stroke.hairline,
  },
  row: {
    borderBottomWidth: Stroke.hairline,
  },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Spacing.six,
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  heading: {
    flexShrink: 1,
    fontSize: FontSize.md,
  },
  code: {
    fontFamily: FontFamily.mono.bold,
  },
  symbol: {
    fontFamily: FontFamily.mono.bold,
    fontSize: FontSize.md,
  },
  fullName: {
    fontFamily: FontFamily.body.semiBold,
  },
  description: {
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
  expandedBody: {
    paddingBottom: Spacing.three,
  },
  structureBody: {
    paddingLeft: Spacing.six + Spacing.three,
  },
  arrow: {
    width: Spacing.three,
    height: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowMark: {
    width: Spacing.two,
    height: Spacing.two,
    borderRightWidth: Stroke.mark,
    borderBottomWidth: Stroke.mark,
  },
  arrowMarkDown: {
    transform: [{ rotate: '45deg' }],
  },
  arrowMarkUp: {
    transform: [{ rotate: '225deg' }],
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
