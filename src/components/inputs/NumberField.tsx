import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { FontFamily, FontSize, Radius, Spacing, Stroke } from '@/constants/theme';
import { decimalOnly, digitsOnly } from '@/lib/fieldInput';
import { useTheme } from '@/hooks/use-theme';

/**
 * A numeric text field that actually holds numbers.
 *
 * `keyboardType` only chooses which keyboard iOS and Android *offer*; it restricts nothing, so a
 * hardware keyboard, paste, dictation or autofill can put letters into a "number" field and the
 * runner then meets a parser error they did not earn (see `src/lib/fieldInput.ts`'s header for the
 * simulator repro). Every keystroke here goes through `digitsOnly`/`decimalOnly` first, so the
 * value can only ever be a number.
 *
 * `number-pad` and `decimal-pad` are the two keyboards supported identically on both platforms —
 * unlike `numeric`, which on iOS is the full punctuation-bearing symbols pad and on Android is
 * digits with a stray separator. Picking these two deliberately keeps the two platforms honest.
 */
export function NumberField({
  value,
  onChangeValue,
  mode = 'integer',
  maxIntegerDigits = 6,
  maxFractionDigits = 1,
  invalid = false,
  style,
  ...rest
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: string;
  onChangeValue: (next: string) => void;
  /** `integer` gets `number-pad`; `decimal` gets `decimal-pad` and allows one separator. */
  mode?: 'integer' | 'decimal';
  maxIntegerDigits?: number;
  maxFractionDigits?: number;
  invalid?: boolean;
}) {
  const theme = useTheme();

  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={(text) =>
        onChangeValue(
          mode === 'decimal'
            ? decimalOnly(text, maxIntegerDigits, maxFractionDigits)
            : digitsOnly(text, maxIntegerDigits),
        )
      }
      keyboardType={mode === 'decimal' ? 'decimal-pad' : 'number-pad'}
      inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={theme.text.secondary}
      style={[
        styles.input,
        {
          color: theme.text.primary,
          borderColor: invalid ? theme.status.error : theme.hairline,
          backgroundColor: theme.surface.raised,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: Spacing.six,
    borderWidth: Stroke.thin,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.body.regular,
    fontSize: FontSize.sm,
  },
});
