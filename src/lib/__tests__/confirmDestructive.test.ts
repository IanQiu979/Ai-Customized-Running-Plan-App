import { Alert, Platform } from 'react-native';

import {
  confirmDestructive,
  defaultConfirmRuntime,
  type ConfirmRuntime,
  type DestructiveConfirmation,
} from '../confirmDestructive';

/**
 * Issue #96: Settings' "Delete account" confirmation went through `Alert.alert`, which
 * react-native-web implements as an empty method — so on web the runner got no dialog, no
 * deletion and no error. This suite pins both platform branches, and on each one the case that
 * matters most for a destructive action: cancelling never reaches `onConfirm`.
 */

const prompt: DestructiveConfirmation = {
  title: 'Delete account',
  message: 'This permanently deletes your account, intake, and plans. This cannot be undone.',
  confirmLabel: 'Delete',
};

function runtimeFor(platform: string, browserConfirmResult?: boolean): ConfirmRuntime & {
  alert: jest.Mock;
  browserConfirm: jest.Mock | undefined;
} {
  return {
    platform,
    alert: jest.fn(),
    browserConfirm:
      browserConfirmResult === undefined ? undefined : jest.fn(() => browserConfirmResult),
  };
}

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function alertButtons(alert: jest.Mock): AlertButton[] {
  expect(alert).toHaveBeenCalledTimes(1);
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  expect(Array.isArray(buttons)).toBe(true);
  return buttons;
}

describe('confirmDestructive on native', () => {
  it.each(['ios', 'android'])('%s: presents the OS alert with a cancel and a destructive button', (platform) => {
    const runtime = runtimeFor(platform);
    const onConfirm = jest.fn();

    confirmDestructive(prompt, onConfirm, runtime);

    expect(runtime.alert).toHaveBeenCalledWith(prompt.title, prompt.message, expect.any(Array));
    const buttons = alertButtons(runtime.alert);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
    expect(buttons[1]).toMatchObject({ text: 'Delete', style: 'destructive' });
    // Presenting the alert is not confirming it.
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancelling never reaches onConfirm', () => {
    const runtime = runtimeFor('ios');
    const onConfirm = jest.fn();

    confirmDestructive(prompt, onConfirm, runtime);
    const [cancel, destructive] = alertButtons(runtime.alert);
    // Cancel carries no handler at all, and the destructive button is the only object holding
    // `onConfirm` — so there is nothing a cancel could ever call.
    expect(cancel.onPress).toBeUndefined();
    expect(destructive.onPress).toBe(onConfirm);
    cancel.onPress?.();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('the destructive button is the only path to onConfirm', () => {
    const runtime = runtimeFor('ios');
    const onConfirm = jest.fn();

    confirmDestructive(prompt, onConfirm, runtime);
    const [, destructive] = alertButtons(runtime.alert);
    destructive.onPress?.();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('never touches the browser dialog', () => {
    const runtime = runtimeFor('android', true);

    confirmDestructive(prompt, jest.fn(), runtime);

    expect(runtime.browserConfirm).not.toHaveBeenCalled();
  });
});

describe('confirmDestructive on web', () => {
  it('asks the browser, quoting the title, the message and what confirming does', () => {
    const runtime = runtimeFor('web', false);

    confirmDestructive(prompt, jest.fn(), runtime);

    expect(runtime.browserConfirm).toHaveBeenCalledTimes(1);
    const text = runtime.browserConfirm!.mock.calls[0][0] as string;
    expect(text).toContain(prompt.title);
    expect(text).toContain(prompt.message);
    // The browser's own button says "OK", so the text must say what OK will do.
    expect(text).toContain('OK');
    expect(text).toContain(prompt.confirmLabel.toLowerCase());
    // `Alert.alert` is the empty method on react-native-web — it must not be the web path.
    expect(runtime.alert).not.toHaveBeenCalled();
  });

  it('cancelling never reaches onConfirm', () => {
    const runtime = runtimeFor('web', false);
    const onConfirm = jest.fn();

    confirmDestructive(prompt, onConfirm, runtime);

    expect(runtime.browserConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirming reaches onConfirm exactly once', () => {
    const runtime = runtimeFor('web', true);
    const onConfirm = jest.fn();

    confirmDestructive(prompt, onConfirm, runtime);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fails closed — loudly, not silently — when the browser offers no confirm dialog', () => {
    const runtime = runtimeFor('web');
    const onConfirm = jest.fn();

    expect(() => confirmDestructive(prompt, onConfirm, runtime)).toThrow(/confirm/);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(runtime.alert).not.toHaveBeenCalled();
  });
});

describe('defaultConfirmRuntime', () => {
  it('reads the real platform and the real Alert', () => {
    const runtime = defaultConfirmRuntime();

    expect(runtime.platform).toBe(Platform.OS);
    expect(runtime.alert).toBe(Alert.alert);
  });

  it('binds the browser confirm to the global when one exists', () => {
    const confirmSpy = jest.fn(() => false);
    const previous = (globalThis as { confirm?: unknown }).confirm;
    (globalThis as { confirm?: unknown }).confirm = confirmSpy;
    try {
      const runtime = defaultConfirmRuntime();
      expect(runtime.browserConfirm).toBeDefined();
      expect(runtime.browserConfirm!('anything')).toBe(false);
      expect(confirmSpy).toHaveBeenCalledWith('anything');
    } finally {
      (globalThis as { confirm?: unknown }).confirm = previous;
    }
  });
});
