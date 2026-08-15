import { SegmentedField } from './SegmentedField';
import type { DateParts } from '@/lib/fieldInput';

/**
 * A calendar date, as `YYYY - MM - DD`. The `-` are drawn, never typed — see `SegmentedField`'s
 * header. There is still no native date picker here; adding one is a new dependency, which
 * `AGENTS.md` routes through `dependency-auditor` as a HIGH-tier change of its own. This keeps the
 * deliberate text-input fallback while removing the reason it was hard to use.
 */
export function DateField({
  parts,
  onChange,
  invalid = false,
  accessibilityLabel,
}: {
  parts: DateParts;
  onChange: (next: DateParts) => void;
  invalid?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <SegmentedField
      accessibilityLabel={accessibilityLabel}
      invalid={invalid}
      separator="-"
      segments={[
        {
          label: 'Year',
          value: parts.year,
          length: 4,
          placeholder: 'YYYY',
          flex: 2,
          onChange: (year) => onChange({ ...parts, year }),
        },
        {
          label: 'Month',
          value: parts.month,
          length: 2,
          placeholder: 'MM',
          flex: 1,
          onChange: (month) => onChange({ ...parts, month }),
        },
        {
          label: 'Day',
          value: parts.day,
          length: 2,
          placeholder: 'DD',
          flex: 1,
          onChange: (day) => onChange({ ...parts, day }),
        },
      ]}
    />
  );
}
