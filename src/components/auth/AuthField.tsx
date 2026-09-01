import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing, Stroke, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One labelled text field on the two auth forms.
 *
 * It exists because `sign-in.tsx` and `sign-up.tsx` between them carried five `<TextInput>`s with
 * the same six-property inline style object copy-pasted onto each, which is exactly how one of
 * them ends up a token out of step with the other four.
 *
 * Deliberately NOT used anywhere else: `src/components/inputs/` owns every numeric, date and
 * segmented field in the app, and those filter keystrokes through `src/lib/fieldInput.ts` for
 * reasons this component has no business duplicating (`AGENTS.md` — "keyboardType restricts
 * nothing"). This is only ever a free-text credential field.
 */
export function AuthField({
  label,
  ...inputProps
}: { label: string } & Omit<TextInputProps, 'style' | 'placeholderTextColor'>) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>{label.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.progress.informative}
        style={[
          styles.input,
          {
            color: theme.text.primary,
            borderColor: theme.hairline,
            backgroundColor: theme.surface.raised,
          },
        ]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  label: {
    fontFamily: FontFamily.mono.regular,
    fontSize: FontSize.xs,
    letterSpacing: Tracking.label,
  },
  input: {
    minHeight: Spacing.six,
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
