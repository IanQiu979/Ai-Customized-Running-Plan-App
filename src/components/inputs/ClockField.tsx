import { SegmentedField } from './SegmentedField';
import type { ClockParts } from '@/lib/fieldInput';

/**
 * A duration, as `H : MM : SS`. The `:` are drawn, never typed — see `SegmentedField`'s header.
 *
 * Hours is deliberately first and optional: a 24-minute 5K is `_ : 24 : 00`, and a 1:45:00 half is
 * `1 : 45 : 00`. `clockPartsToSeconds` treats a blank hours box as zero, so a runner entering a
 * sub-hour time never touches it.
 */
export function ClockField({
  parts,
  onChange,
  invalid = false,
  accessibilityLabel,
}: {
  parts: ClockParts;
  onChange: (next: ClockParts) => void;
  invalid?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <SegmentedField
      accessibilityLabel={accessibilityLabel}
      invalid={invalid}
      separator=":"
      segments={[
        {
          label: 'Hours',
          value: parts.hours,
          length: 2,
          placeholder: 'H',
          flex: 1,
          onChange: (hours) => onChange({ ...parts, hours }),
        },
        {
          label: 'Minutes',
          value: parts.minutes,
          length: 2,
          placeholder: 'MM',
          flex: 1,
          onChange: (minutes) => onChange({ ...parts, minutes }),
        },
        {
          label: 'Seconds',
          value: parts.seconds,
          length: 2,
          placeholder: 'SS',
          flex: 1,
          onChange: (seconds) => onChange({ ...parts, seconds }),
        },
      ]}
    />
  );
}
