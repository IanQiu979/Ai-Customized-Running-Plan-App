/**
 * A one-shot flag bridging sign-up to the root layout's post-auth redirect.
 *
 * `sign-up.tsx` cannot reliably navigate itself once `session` flips truthy: that same
 * transition makes `_layout.tsx`'s `Stack.Protected` unmount the whole `(auth)` group — including
 * sign-up's own `useEffect` — in the same commit, so the effect can lose the race and never fire.
 * `_layout.tsx` never unmounts, so it consumes this flag once `session` becomes truthy instead.
 * Web social auth leaves the JavaScript realm for a full-page redirect, so same-tab session
 * storage is the durable source there. The in-memory copy is the native and SSR-safe fallback.
 */
const STORAGE_KEY = 'paceblueprint_post_signup_redirect';

interface RedirectIntent {
  userId: string | null;
}

let memoryIntent: RedirectIntent | null = null;

function browserSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readIntent(): RedirectIntent | null {
  const storage = browserSessionStorage();
  if (!storage) return memoryIntent;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return memoryIntent;
    const parsed = JSON.parse(raw) as Partial<RedirectIntent>;
    if (parsed.userId !== null && typeof parsed.userId !== 'string') {
      storage.removeItem(STORAGE_KEY);
      return memoryIntent;
    }
    memoryIntent = { userId: parsed.userId };
    return memoryIntent;
  } catch {
    return memoryIntent;
  }
}

function writeIntent(intent: RedirectIntent): void {
  memoryIntent = intent;
  try {
    browserSessionStorage()?.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Native, SSR, privacy modes and full storage all retain the in-memory fallback.
  }
}

export function markPostSignupRedirect(): void {
  writeIntent({ userId: null });
}

/**
 * Binds an unclaimed sign-up intent to the first authenticated account that sees it. A different
 * account cannot inherit the redirect from a runner who signed out during the pending-age gate.
 */
export function claimPostSignupRedirect(userId: string): boolean {
  const intent = readIntent();
  if (!intent) return false;
  if (intent.userId === null) {
    writeIntent({ userId });
    return true;
  }
  if (intent.userId === userId) return true;
  clearPostSignupRedirect();
  return false;
}

export function clearPostSignupRedirect(): void {
  memoryIntent = null;
  try {
    browserSessionStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory fallback is already clear.
  }
}

export function consumePostSignupRedirect(userId: string): boolean {
  if (!claimPostSignupRedirect(userId)) return false;
  clearPostSignupRedirect();
  return true;
}
