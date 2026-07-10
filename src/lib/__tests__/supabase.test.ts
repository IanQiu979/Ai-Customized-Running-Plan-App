/**
 * Guards the env contract in `src/lib/supabase.ts`. A missing EXPO_PUBLIC_* var
 * must fail loudly at import, not surface later as an opaque 401 at runtime.
 *
 * Env vars are read with static dot notation throughout, because that is the
 * only form Expo inlines at build time (see `expo/no-dynamic-env-var`).
 */

/** Re-executes the module against whatever process.env currently holds. */
function loadClient() {
  return jest.requireActual('../supabase') as typeof import('../supabase');
}

describe('supabase client env contract', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('throws an actionable error when both env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(loadClient).toThrow(/Missing EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('throws when only the publishable key is missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(loadClient).toThrow(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('exposes an auth client when both env vars are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

    const { supabase } = loadClient();

    expect(supabase.auth).toBeDefined();
  });
});
