-- better-auth's own tables, for the D1 (SQLite) adapter.
--
-- PROVENANCE, and how to re-check it after a better-auth upgrade. These four tables and every
-- column on them were verified against better-auth 1.6.25's own authoritative table definitions —
-- not against documentation and not from memory — by calling its internal schema builder directly:
--
--   node -e "import('better-auth/db').then(({getAuthTables}) =>
--     console.log(JSON.stringify(getAuthTables({emailAndPassword:{enabled:true}}), null, 2)))"
--
-- (`@better-auth/cli generate` is the documented route, but it insists on introspecting a live
-- database, which is not available offline. `getAuthTables` is what the CLI itself reads.)
--
-- They are additionally verified end to end: `test/worker.test.ts` signs a user up through the
-- real adapter against a real D1 built from this file, then uses the returned session on an app
-- route. A column name that disagreed with the adapter would fail that test, not merely look odd.
--
-- Do not hand-edit these identifiers to taste — better-auth's adapter queries them literally, so a
-- rename is a runtime failure, never a typecheck failure. After a better-auth version bump, re-run
-- the command above and land any diff as a NEW migration file rather than editing this one: D1
-- migrations are apply-once and tracked by name.
--
-- SQLITE, NOT POSTGRES. Three translations were forced and are called out where they appear:
--   * no `uuid` type          -> TEXT ids, minted with `crypto.randomUUID()` in Worker code
--   * no `timestamptz`        -> INTEGER epoch-millis (what better-auth's SQLite dialect writes)
--   * no `boolean`            -> INTEGER 0/1
-- There is NO row-level security in SQLite. Ownership is enforced in Worker code — see
-- `workers/src/lib/store.ts`'s header and `docs/architecture.md` "Authorization without RLS".

CREATE TABLE IF NOT EXISTS user (
  id             TEXT PRIMARY KEY NOT NULL,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  emailVerified  INTEGER NOT NULL DEFAULT 0,
  image          TEXT,
  createdAt      INTEGER NOT NULL,
  updatedAt      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id        TEXT PRIMARY KEY NOT NULL,
  expiresAt INTEGER NOT NULL,
  token     TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId    TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON session (userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session (token);

-- One row per credential: the email/password row (providerId = 'credential', password set) and
-- one row per linked social provider (providerId = 'google', tokens set).
CREATE TABLE IF NOT EXISTS account (
  id                    TEXT PRIMARY KEY NOT NULL,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  userId                TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope                 TEXT,
  password              TEXT,
  createdAt             INTEGER NOT NULL,
  updatedAt             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_user_id ON account (userId);

-- Email-verification and password-reset tokens.
CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER NOT NULL,
  updatedAt  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification (identifier);
