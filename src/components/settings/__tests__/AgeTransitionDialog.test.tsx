import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { AgeTransitionDialog } from '../AgeTransitionDialog';

/**
 * The aging transition's dialog (captain's decision, 2026-10-01). It only collects a complete,
 * real date and hands it on; the 18+ ruling is the Worker's, shown back through `error`. These
 * tests pin that split: the dialog never sends a partial or impossible date, never refuses a real
 * one on its own, and renders the server's refusal inline.
 */

let mountedTrees: ReactTestRenderer[] = [];

function render(props: Partial<Parameters<typeof AgeTransitionDialog>[0]> = {}) {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <AgeTransitionDialog
        visible
        busy={false}
        error={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...props}
      />
    );
  });
  mountedTrees.push(tree);
  return { tree, onCancel, onConfirm };
}

function byLabel(tree: ReactTestRenderer, label: string): ReactTestInstance {
  return tree.root.find(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === label
  );
}

/** The composite `Pressable` (the first match), whose `onPress` is the handler under test. */
function pressable(tree: ReactTestRenderer, label: string): ReactTestInstance {
  return tree.root.find((node) => node.props.accessibilityLabel === label);
}

function confirmButton(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.find((node) => node.props.accessibilityLabel === 'Confirm date of birth');
}

function typeDate(tree: ReactTestRenderer, year: string, month: string, day: string): void {
  act(() => {
    byLabel(tree, 'Date of birth year').props.onChangeText(year);
  });
  act(() => {
    byLabel(tree, 'Date of birth month').props.onChangeText(month);
  });
  act(() => {
    byLabel(tree, 'Date of birth day').props.onChangeText(day);
  });
}

function alertTexts(tree: ReactTestRenderer): unknown[] {
  return tree.root
    .findAll((node) => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')
    .map((node) => node.props.children);
}

afterEach(() => {
  act(() => {
    mountedTrees.splice(0).forEach((tree) => tree.unmount());
  });
  mountedTrees = [];
});

describe('AgeTransitionDialog', () => {
  it('keeps confirm disabled until a complete, real date is entered', () => {
    const { tree } = render();
    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });

    typeDate(tree, '2000', '02', '30');
    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });
    expect(alertTexts(tree)).toEqual(['That date does not exist.']);

    act(() => {
      byLabel(tree, 'Date of birth day').props.onChangeText('29');
    });
    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('sends the ISO date and leaves the 18+ ruling to the server, even for a recent date', () => {
    const { tree, onConfirm } = render();

    typeDate(tree, '2015', '06', '01');
    act(() => {
      confirmButton(tree).props.onPress();
    });

    expect(onConfirm).toHaveBeenCalledWith('2015-06-01');
  });

  it("renders the server's refusal inline", () => {
    const { tree } = render({
      error: 'That date of birth is under 18, so this account stays 13 to 17.',
    });

    expect(alertTexts(tree)).toEqual([
      'That date of birth is under 18, so this account stays 13 to 17.',
    ]);
  });

  it('clears the typed date on cancel', () => {
    const { tree, onCancel } = render();
    typeDate(tree, '2000', '01', '01');

    act(() => {
      pressable(tree, 'Cancel').props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(byLabel(tree, 'Date of birth year').props.value).toBe('');
    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('cannot be confirmed or dismissed while the request is in flight', () => {
    const { tree, onCancel } = render({ busy: true });

    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });
    expect(pressable(tree, 'Dismiss').props.onPress).toBeUndefined();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
