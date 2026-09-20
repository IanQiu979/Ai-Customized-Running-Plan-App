import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { DeleteAccountDialog } from '../DeleteAccountDialog';

/**
 * Delete-account's re-auth dialog (captain's decision, change-list item 10, 2026-09-20). Covers
 * the acceptance criteria that live in this component rather than in `settings.tsx`'s wiring:
 * empty password disables the confirm button, a wrong-password error renders inline, and the
 * password field is only shown — and required — when `requiresPassword` is true (the credential
 * account case; a Google/OAuth-only account gets `requiresPassword={false}`, per
 * `AGENTS.md`'s "do not lock them out of deletion").
 */

let mountedTrees: ReactTestRenderer[] = [];

function render(props: Partial<Parameters<typeof DeleteAccountDialog>[0]> = {}) {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <DeleteAccountDialog
        visible
        requiresPassword
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

function confirmButton(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.find(
    (node) => node.props.accessibilityLabel === 'Confirm delete account'
  );
}

function passwordField(tree: ReactTestRenderer): ReactTestInstance | null {
  const matches = tree.root.findAll((node) => node.props.accessibilityLabel === 'Password');
  return matches.length > 0 ? matches[0] : null;
}

function typePassword(tree: ReactTestRenderer, value: string): void {
  act(() => {
    passwordField(tree)!.props.onChangeText(value);
  });
}

afterEach(() => {
  act(() => {
    mountedTrees.splice(0).forEach((tree) => tree.unmount());
  });
});

describe('DeleteAccountDialog', () => {
  it('disables the confirm button when the password is empty', () => {
    const { tree } = render();

    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('enables the confirm button once a password is entered', () => {
    const { tree } = render();

    typePassword(tree, 'correct horse battery staple');

    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('calls onConfirm with the entered password', () => {
    const { tree, onConfirm } = render();

    typePassword(tree, 'correct horse battery staple');
    act(() => {
      confirmButton(tree).props.onPress();
    });

    expect(onConfirm).toHaveBeenCalledWith('correct horse battery staple');
  });

  it('shows a wrong-password error inline', () => {
    const { tree } = render({ error: 'That password is incorrect.' });

    const alerts = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'alert' &&
        node.props.children === 'That password is incorrect.'
    );
    expect(alerts).toHaveLength(1);
  });

  it('keeps the account on a wrong password — the dialog stays open and does not call onConfirm on its own', () => {
    // The error prop alone must never trigger a delete; only an explicit confirm press does.
    const { onConfirm } = render({ error: 'That password is incorrect.' });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not render a password field, and enables confirm with no password, for a passwordless OAuth account', () => {
    const { tree, onConfirm } = render({ requiresPassword: false });

    expect(passwordField(tree)).toBeNull();
    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: false });

    act(() => {
      confirmButton(tree).props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('disables the confirm button while busy, even with a password entered', () => {
    const { tree } = render({ busy: true });

    typePassword(tree, 'correct horse battery staple');

    expect(confirmButton(tree).props.accessibilityState).toMatchObject({ disabled: true });
  });
});
