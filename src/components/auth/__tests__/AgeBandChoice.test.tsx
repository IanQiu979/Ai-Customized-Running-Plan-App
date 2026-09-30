import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { AgeBandChoice } from '../AgeBandChoice';
import { Colors, Spacing } from '@/constants/theme';
import type { AgeBand } from '@/lib/ageAssurance';

const mockOpenPrivacyPolicy = jest.fn<Promise<string | null>, []>();

jest.mock('@/lib/openPrivacyPolicy', () => ({
  openPrivacyPolicy: () => mockOpenPrivacyPolicy(),
}));

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<AgeBand | null>(null);
  const [guardianConsent, setGuardianConsent] = useState(false);

  return (
    <AgeBandChoice
      value={value}
      guardianConsent={guardianConsent}
      onChange={(band) => {
        setValue(band);
        if (band !== '13_17') setGuardianConsent(false);
      }}
      onToggleGuardianConsent={() => setGuardianConsent((checked) => !checked)}
      disabled={disabled}
      testIDPrefix="choice"
    />
  );
}

function render(disabled = false): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Harness disabled={disabled} />);
  });
  return tree;
}

function press(tree: ReactTestRenderer, testID: string) {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

function control(tree: ReactTestRenderer, testID: string) {
  return tree.root.find(
    (node) => node.props.testID === testID && typeof node.props.accessibilityRole === 'string'
  );
}

describe('AgeBandChoice', () => {
  beforeEach(() => {
    mockOpenPrivacyPolicy.mockReset().mockResolvedValue(null);
  });

  it('renders one radiogroup with both age choices and the 13+ eligibility line', () => {
    const tree = render();

    expect(tree.root.findByProps({ accessibilityRole: 'radiogroup' })).toBeTruthy();
    expect(control(tree, 'choice-18-plus').props).toMatchObject({
      accessibilityRole: 'radio',
      accessibilityState: { checked: false, disabled: false },
    });
    expect(control(tree, 'choice-13-17').props).toMatchObject({
      accessibilityRole: 'radio',
      accessibilityState: { checked: false, disabled: false },
    });
    expect(tree.root.findByProps({ children: 'Pace Blueprint is for ages 13 and up.' })).toBeTruthy();
  });

  it('uses the meaningful informative boundary for an unselected age control', () => {
    const tree = render();
    const row = control(tree, 'choice-18-plus');
    const style = StyleSheet.flatten(row.props.style({ pressed: false }));

    expect(style.borderColor).toBe(Colors.dark.progress.informative);
  });

  it('uses roving tab stops and selects the next radio with an arrow key', () => {
    const tree = render();
    const adult = control(tree, 'choice-18-plus');
    const preventDefault = jest.fn();

    expect(adult.props.tabIndex).toBe(0);
    expect(control(tree, 'choice-13-17').props.tabIndex).toBe(-1);

    act(() => {
      adult.props.onKeyDown({ nativeEvent: { key: 'ArrowDown' }, preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(control(tree, 'choice-18-plus').props).toMatchObject({
      tabIndex: -1,
      accessibilityState: { checked: false },
    });
    expect(control(tree, 'choice-13-17').props).toMatchObject({
      tabIndex: 0,
      accessibilityState: { checked: true },
    });
  });

  it('ignores custom web arrow handling while the radio group is disabled', () => {
    const tree = render(true);
    const adult = control(tree, 'choice-18-plus');
    const preventDefault = jest.fn();

    act(() => {
      adult.props.onKeyDown({ nativeEvent: { key: 'ArrowDown' }, preventDefault });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(control(tree, 'choice-18-plus').props).toMatchObject({
      tabIndex: -1,
      accessibilityState: { checked: false, disabled: true },
    });
    expect(control(tree, 'choice-13-17').props).toMatchObject({
      tabIndex: -1,
      accessibilityState: { checked: false, disabled: true },
    });
  });

  it('shows an unchecked guardian checkbox only for 13–17 and resets it after switching away', () => {
    const tree = render();

    expect(tree.root.findAllByProps({ testID: 'choice-guardian-consent' })).toHaveLength(0);
    press(tree, 'choice-13-17');
    expect(control(tree, 'choice-guardian-consent').props).toMatchObject({
      accessibilityRole: 'checkbox',
      accessibilityState: { checked: false, disabled: false },
    });

    press(tree, 'choice-guardian-consent');
    expect(
      control(tree, 'choice-guardian-consent').props.accessibilityState
    ).toEqual({ checked: true, disabled: false });

    press(tree, 'choice-18-plus');
    expect(tree.root.findAllByProps({ testID: 'choice-guardian-consent' })).toHaveLength(0);
    press(tree, 'choice-13-17');
    expect(
      control(tree, 'choice-guardian-consent').props.accessibilityState
    ).toEqual({ checked: false, disabled: false });
  });

  it('opens the privacy policy and exposes an opener failure as an alert', async () => {
    const failure = 'Could not open the privacy policy. Check your connection and try again.';
    mockOpenPrivacyPolicy.mockResolvedValue(failure);
    const tree = render();
    press(tree, 'choice-13-17');

    const link = control(tree, 'choice-privacy-policy');
    await act(async () => {
      await link.props.onPress();
    });

    expect(mockOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(failure);
  });

  it('renders the guardian checkbox and policy opener as sibling controls with independent actions', async () => {
    const tree = render();
    press(tree, 'choice-13-17');

    const checkbox = control(tree, 'choice-guardian-consent');
    const link = control(tree, 'choice-privacy-policy');

    expect(checkbox.parent).toBe(link.parent);
    expect(checkbox.props.accessibilityLabelledBy).toBe('choice-guardian-attestation');
    expect(
      tree.root.findByProps({ nativeID: 'choice-guardian-attestation' }).props.children
    ).toBe(
      'I am 13–17, and a parent or guardian has read the privacy policy and agrees to it on my behalf.'
    );
    expect(StyleSheet.flatten(link.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(
      Spacing.six
    );

    await act(async () => {
      await link.props.onPress();
    });

    expect(mockOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(control(tree, 'choice-guardian-consent').props.accessibilityState.checked).toBe(false);
  });
});
