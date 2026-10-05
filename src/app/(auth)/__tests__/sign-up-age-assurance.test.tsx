/**
 * Rendered-screen suite (a CLAUDE.md → Testing exception, issue #95). Sign-up's age-band rule lives
 * in the screen itself — the disabled state of "Sign up", the handler's own refusal when invoked
 * without a complete choice, and the body it hands to `signUpWithAgeAssurance` — with no logic
 * layer underneath to test instead. The Worker re-enforces the same rule; this pins the client half.
 * Since 2026-10-05 it also pins when the age choice is on screen at all (the captain's "create
 * account shows too much"): hidden on the empty form, revealed by the first focus of a credential
 * field and kept from then on — a render branch, again with nothing underneath it to test.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SignUpScreen from '../sign-up';

const mockSignUpWithAgeAssurance = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockMarkPostSignupRedirect = jest.fn();
const mockClearPostSignupRedirect = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/lib/apiClient', () => ({
  API_BASE_URL: 'https://example.invalid',
  describeError: (_error: unknown, fallback: string) => fallback,
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signUpWithAgeAssurance: (...args: unknown[]) => mockSignUpWithAgeAssurance(...args),
}));

jest.mock('@/lib/authEmail', () => ({
  createVerifyEmailURL: () => 'paceblueprint://verify-email',
  isVerificationPendingSignUp: () => false,
}));

jest.mock('@/lib/postSignupRedirect', () => ({
  markPostSignupRedirect: () => mockMarkPostSignupRedirect(),
  clearPostSignupRedirect: () => mockClearPostSignupRedirect(),
}));

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <SignUpScreen />
      </SafeAreaProvider>
    );
  });
  return tree;
}

function change(tree: ReactTestRenderer, label: string, value: string) {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value);
  });
}

function press(tree: ReactTestRenderer, labelOrTestID: string) {
  const byTestID = tree.root.findAllByProps({ testID: labelOrTestID });
  const control =
    byTestID[0] ?? tree.root.findByProps({ accessibilityRole: 'button', accessibilityLabel: labelOrTestID });
  return act(async () => {
    await control.props.onPress();
  });
}

function focus(tree: ReactTestRenderer, label: string) {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: label }).props.onFocus?.();
  });
}

function ageChoiceShown(tree: ReactTestRenderer): boolean {
  return tree.root.findAllByProps({ testID: 'signup-age-18-plus' }).length > 0;
}

function fillCredentials(tree: ReactTestRenderer) {
  change(tree, 'Name', 'Runner');
  change(tree, 'Email', 'runner@example.com');
  change(tree, 'Password', 'password123');
}

function action(tree: ReactTestRenderer, label: string) {
  return tree.root.findByProps({ accessibilityRole: 'button', accessibilityLabel: label });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

describe('SignUpScreen age assurance', () => {
  beforeEach(() => {
    mockSignUpWithAgeAssurance.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSignInWithGoogle.mockReset().mockResolvedValue({ ok: true });
    mockMarkPostSignupRedirect.mockReset();
    mockClearPostSignupRedirect.mockReset();
  });

  describe('the age choice appears on first engagement (2026-10-05)', () => {
    it('is not on the empty form — only the credentials and the actions are', () => {
      const tree = render();
      expect(ageChoiceShown(tree)).toBe(false);
      expect(tree.root.findAllByProps({ testID: 'signup-age-13-17' })).toHaveLength(0);
      expect(action(tree, 'Sign up')).toBeTruthy();
      expect(action(tree, 'Continue with Google')).toBeTruthy();
    });

    it.each(['Name', 'Email', 'Password'])('appears when %s is first focused', (label) => {
      const tree = render();
      focus(tree, label);
      expect(ageChoiceShown(tree)).toBe(true);
    });

    it('appears when text arrives without a focus event (autofill)', () => {
      const tree = render();
      change(tree, 'Email', 'runner@example.com');
      expect(ageChoiceShown(tree)).toBe(true);
    });

    it('stays visible once shown, even after every field is emptied again', () => {
      const tree = render();
      fillCredentials(tree);
      change(tree, 'Name', '');
      change(tree, 'Email', '');
      change(tree, 'Password', '');
      expect(ageChoiceShown(tree)).toBe(true);
    });

    it('keeps the guardian-consent gate once revealed', async () => {
      const tree = render();
      focus(tree, 'Name');
      fillCredentials(tree);
      await press(tree, 'signup-age-13-17');
      expect(tree.root.findAllByProps({ testID: 'signup-age-guardian-consent' }).length).toBeGreaterThan(0);
      expect(action(tree, 'Sign up').props.accessibilityState.disabled).toBe(true);
    });

    it('the handler still refuses with no age band, however it is reached', async () => {
      const tree = render();
      focus(tree, 'Name');
      await act(async () => {
        await action(tree, 'Sign up').props.onPress();
      });
      expect(mockSignUpWithAgeAssurance).not.toHaveBeenCalled();
      expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
        'Select your age range before you create this account.'
      );
    });
  });

  it('keeps the button and handler gated until the age choice is complete', async () => {
    const tree = render();
    fillCredentials(tree);

    expect(tree.root.findByProps({ accessibilityLabel: 'Sign up' }).props.accessibilityState.disabled).toBe(
      true
    );
    await press(tree, 'Sign up');

    expect(mockSignUpWithAgeAssurance).not.toHaveBeenCalled();
  });

  it('sends the normalized adult choice with the ordinary signup fields', async () => {
    const tree = render();
    fillCredentials(tree);
    await press(tree, 'signup-age-18-plus');
    await press(tree, 'Sign up');

    expect(mockSignUpWithAgeAssurance).toHaveBeenCalledWith({
      name: 'Runner',
      email: 'runner@example.com',
      password: 'password123',
      callbackURL: 'paceblueprint://verify-email',
      ageBand: '18_plus',
      guardianConsent: false,
    });
  });

  it('marks only email signup busy while disabling both account actions', async () => {
    const request = deferred<{ data: { user: { id: string } }; error: null }>();
    mockSignUpWithAgeAssurance.mockReturnValue(request.promise);
    const tree = render();
    fillCredentials(tree);
    await press(tree, 'signup-age-18-plus');

    act(() => {
      void action(tree, 'Sign up').props.onPress();
    });

    expect(action(tree, 'Sign up').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(action(tree, 'Continue with Google').props.accessibilityState).toEqual({
      disabled: true,
    });

    await act(async () => {
      request.resolve({ data: { user: { id: 'user-1' } }, error: null });
      await request.promise;
    });
  });

  it('sends a minor choice only after the guardian checkbox is affirmed', async () => {
    const tree = render();
    fillCredentials(tree);
    await press(tree, 'signup-age-13-17');

    expect(tree.root.findByProps({ accessibilityLabel: 'Sign up' }).props.accessibilityState.disabled).toBe(
      true
    );
    await press(tree, 'Sign up');
    expect(mockSignUpWithAgeAssurance).not.toHaveBeenCalled();

    await press(tree, 'signup-age-guardian-consent');
    await press(tree, 'Sign up');
    expect(mockSignUpWithAgeAssurance).toHaveBeenCalledWith(
      expect.objectContaining({ ageBand: '13_17', guardianConsent: true })
    );
  });

  it('keeps Google signup independent of the incomplete email age selection', async () => {
    const tree = render();
    // Google never needed the email form's age choice — it stays available untouched, too.
    await press(tree, 'Continue with Google');
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    mockSignInWithGoogle.mockClear();

    focus(tree, 'Name');
    await press(tree, 'signup-age-13-17');
    await press(tree, 'Continue with Google');

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockSignUpWithAgeAssurance).not.toHaveBeenCalled();
  });

  it('marks only Google signup busy while disabling both account actions', async () => {
    const request = deferred<{ ok: true }>();
    mockSignInWithGoogle.mockReturnValue(request.promise);
    const tree = render();

    act(() => {
      void action(tree, 'Continue with Google').props.onPress();
    });

    expect(action(tree, 'Continue with Google').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(action(tree, 'Sign up').props.accessibilityState).toEqual({
      disabled: true,
    });

    await act(async () => {
      request.resolve({ ok: true });
      await request.promise;
    });
  });

  it('clears the persisted redirect when Google sign-in fails to start', async () => {
    mockSignInWithGoogle.mockImplementation(async ({ onBeforeSessionNotify }) => {
      onBeforeSessionNotify();
      return { ok: false, message: 'Google sign-in could not start.' };
    });
    const tree = render();

    await press(tree, 'Continue with Google');

    expect(mockMarkPostSignupRedirect).toHaveBeenCalledTimes(1);
    expect(mockClearPostSignupRedirect).toHaveBeenCalledTimes(1);
  });

  it('clears the persisted redirect when Google sign-in throws after marking it', async () => {
    mockSignInWithGoogle.mockImplementation(async ({ onBeforeSessionNotify }) => {
      onBeforeSessionNotify();
      throw new Error('network unavailable');
    });
    const tree = render();

    await press(tree, 'Continue with Google');

    expect(mockMarkPostSignupRedirect).toHaveBeenCalledTimes(1);
    expect(mockClearPostSignupRedirect).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
      'Google sign-in failed.'
    );
  });

  it('exposes a signup failure as an assertive live alert', async () => {
    mockSignUpWithAgeAssurance.mockResolvedValue({
      data: null,
      error: { message: 'That email is already registered.' },
    });
    const tree = render();
    fillCredentials(tree);
    await press(tree, 'signup-age-18-plus');
    await press(tree, 'Sign up');

    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props).toMatchObject({
      accessibilityLiveRegion: 'assertive',
      children: 'That email is already registered.',
    });
  });
});
