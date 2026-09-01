import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { digitsOnly } from '@/lib/fieldInput';

export interface Segment {
  /** Stable key, and the tail of the box's accessibility label ("Hours", "Year", …). */
  label: string;
  value: string;
  /** Digits this box holds. Also its auto-advance threshold. */
  length: number;
  placeholder: string;
  /** Relative width; a 4-digit year needs more room than a 2-digit month. */
  flex: number;
  onChange: (next: string) => void;
}

/**
 * One value split across several digit-only boxes with the separator **printed between them**.
 *
 * This is the answer to the captain's "the keyboard is missing the colons, the dashes" (2026-08-15).
 * A single free-text field labelled `H:MM:SS` or `YYYY-MM-DD` asks the runner for characters that
 * `number-pad` does not have. The previous screens papered over that with an as-you-type mask that
 * inserted the separators — the value was reachable, but the control still *told* the runner to
 * type punctuation the keyboard could not produce, and the digits regrouped under their thumb as
 * they typed (`1` → `14` → `1:45`). Splitting the value removes the question: nobody types a
 * separator because the separator is a `Text` node, the keyboard is digits-only on both platforms,
 * and no parsing of free text remains.
 *
 * Focus advances to the next box the moment one fills, and a backspace on an empty box steps back,
 * so the whole value is still a single uninterrupted run of digits to type.
 */
export function SegmentedField({
  segments,
  separator,
  invalid = false,
  accessibilityLabel,
}: {
  segments: Segment[];
  /** Drawn between boxes — `:` for a clock, `-` for a date. Never typed. */
  separator: string;
  invalid?: boolean;
  /**
   * The field's name ("Race date", "Goal time"). Prefixed onto each box's own label, because a
   * label on the `accessible={false}` wrapper is dropped by both platforms — a screen reader would
   * otherwise announce a bare "Year" with no clue which field it belongs to.
   */
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const refs = useRef<(TextInput | null)[]>([]);

  return (
    <View
      accessible={false}
      style={[
        styles.row,
        {
          borderColor: invalid ? theme.status.error : theme.hairline,
          backgroundColor: theme.surface.raised,
        },
      ]}
    >
      {segments.map((segment, index) => (
        <View key={segment.label} style={[styles.segmentWrapper, { flex: segment.flex }]}>
          {index > 0 && (
            <Text style={[styles.separator, { color: theme.text.secondary }]}>{separator}</Text>
          )}
          <TextInput
            ref={(node) => {
              refs.current[index] = node;
            }}
            accessibilityLabel={
              accessibilityLabel
                ? `${accessibilityLabel} ${segment.label.toLowerCase()}`
                : segment.label
            }
            value={segment.value}
            onChangeText={(text) => {
              const next = digitsOnly(text, segment.length);
              segment.onChange(next);
              if (next.length === segment.length) refs.current[index + 1]?.focus();
            }}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !segment.value) {
                refs.current[index - 1]?.focus();
              }
            }}
            placeholder={segment.placeholder}
            placeholderTextColor={theme.text.secondary}
            keyboardType="number-pad"
            inputMode="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={segment.length}
            style={[styles.segmentInput, { color: theme.text.primary }]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Spacing.six,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.two,
  },
  segmentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.one,
  },
  segmentInput: {
    flex: 1,
    minHeight: Spacing.six,
    paddingHorizontal: Spacing.one,
    // Centred so each box reads as one component of the value rather than as a left-aligned
    // field with the separator stranded in the gap after it.
    textAlign: 'center',
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
