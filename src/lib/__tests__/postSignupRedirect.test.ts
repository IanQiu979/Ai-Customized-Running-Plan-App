import {
  claimPostSignupRedirect,
  clearPostSignupRedirect,
  consumePostSignupRedirect,
  markPostSignupRedirect,
} from '../postSignupRedirect';

const STORAGE_KEY = 'paceblueprint_post_signup_redirect';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('postSignupRedirect', () => {
  beforeEach(() => {
    clearPostSignupRedirect();
  });

  it('is false until marked', () => {
    expect(consumePostSignupRedirect('user-1')).toBe(false);
  });

  it('reports true exactly once after being marked', () => {
    markPostSignupRedirect();

    expect(consumePostSignupRedirect('user-1')).toBe(true);
    expect(consumePostSignupRedirect('user-1')).toBe(false);
  });

  it('survives a web full-page reload in same-tab session storage', () => {
    const storage = memoryStorage();
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: { sessionStorage: storage },
    });

    markPostSignupRedirect();
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reloaded = require('../postSignupRedirect') as typeof import('../postSignupRedirect');
    expect(reloaded.claimPostSignupRedirect('oauth-user')).toBe(true);
    expect(reloaded.consumePostSignupRedirect('oauth-user')).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('retains a claimed intent for the same pending account and clears it on account change', () => {
    markPostSignupRedirect();

    expect(claimPostSignupRedirect('pending-a')).toBe(true);
    expect(claimPostSignupRedirect('pending-a')).toBe(true);
    expect(claimPostSignupRedirect('pending-b')).toBe(false);
    expect(consumePostSignupRedirect('pending-b')).toBe(false);
  });
});
