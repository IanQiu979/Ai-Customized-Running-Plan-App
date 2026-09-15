import { Alert, Platform } from 'react-native';

/**
 * One confirmation step for a destructive action, on every platform the app ships to.
 *
 * WHY THIS EXISTS: `Alert.alert` is the right dialog on iOS and Android, and on web it is
 * literally an empty method — react-native-web's `Alert` is `class Alert { static alert() {} }`.
 * Settings' "Delete account" went through it unconditionally, so on web the runner got no dialog,
 * no deletion and no error (issue #96). Web is a supported target (the Worker's CORS allowlist was
 * repaired for it), and account deletion is a required account-control path, so the confirmation
 * has to actually happen there.
 *
 * WHAT IT DOES: native keeps the OS alert exactly as before — a `cancel` button and a
 * `destructive` one. Web asks the browser's own modal (`window.confirm`), which is the same shape
 * of step: a blocking dialog with Cancel and OK, where only OK proceeds. That keeps a deletion
 * exactly as hard to trigger by accident as it is on a phone; a one-tap delete is never on offer.
 * The browser cannot relabel OK, so the message says what OK will do.
 *
 * WHY THE `runtime` PARAMETER: `Platform.OS` and `Alert.alert` are read through an injectable seam
 * so `__tests__/confirmDestructive.test.ts` can drive both branches — and prove that cancelling
 * never reaches `onConfirm` on either — under the one jest-expo preset. Screens never pass it.
 */

export interface DestructiveConfirmation {
  title: string;
  message: string;
  /** The native button's label ("Delete"). On web it is quoted in the dialog text instead. */
  confirmLabel: string;
}

/** The platform seams, defaulted from the real `react-native` / browser globals. */
export interface ConfirmRuntime {
  platform: string;
  alert: typeof Alert.alert;
  browserConfirm: ((message: string) => boolean) | undefined;
}

export function defaultConfirmRuntime(): ConfirmRuntime {
  const confirm = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
  return {
    platform: Platform.OS,
    alert: Alert.alert,
    // Bound, not passed bare: browsers throw "Illegal invocation" on an unbound `confirm`.
    browserConfirm: typeof confirm === 'function' ? (message) => confirm.call(globalThis, message) : undefined,
  };
}

/**
 * Present the confirmation; call `onConfirm` only if the runner explicitly confirms. Never resolves
 * a value — the native dialog reports through callbacks, so the web branch matches that shape.
 */
export function confirmDestructive(
  prompt: DestructiveConfirmation,
  onConfirm: () => void,
  runtime: ConfirmRuntime = defaultConfirmRuntime()
): void {
  if (runtime.platform === 'web') {
    if (!runtime.browserConfirm) {
      // No dialog means no confirmation means no deletion — and, unlike the bug this replaces,
      // it says so rather than swallowing the tap.
      throw new Error(
        `confirmDestructive: this web runtime has no confirm dialog, so "${prompt.title}" cannot be confirmed.`
      );
    }
    const confirmed = runtime.browserConfirm(
      `${prompt.title}\n\n${prompt.message}\n\nPress OK to ${prompt.confirmLabel.toLowerCase()}, or Cancel to keep everything as it is.`
    );
    if (confirmed) onConfirm();
    return;
  }

  runtime.alert(prompt.title, prompt.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: prompt.confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
