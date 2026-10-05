-- The delete-account failed-password budget, made durable (2026-10-05).
--
-- `POST /api/delete-account` checks a plaintext password outside better-auth's handler, so
-- better-auth's own rate limit never sees it; `src/lib/attemptThrottle.ts` bounds it at five wrong
-- passwords per fifteen minutes. Until this migration that count lived in Worker module memory,
-- which a Cloudflare isolate restart or a request landing on another isolate silently reset — an
-- attacker holding a stolen session simply got a fresh budget. One row per failed attempt here
-- survives both.
--
-- NOT USER-OWNED DATA. A row is a throttle key (`user:<id>` or `ip:<address>`) and a timestamp,
-- never anything a runner reads back, so `store.ts`'s "every statement binds the session's
-- userId" rule does not apply: an IP key belongs to no user. The key is stored only as an
-- HMAC-SHA-256 digest (keyed with `BETTER_AUTH_SECRET`), so the table holds neither an address nor
-- a user id in the clear, and rows are pruned once they fall out of the window — see that file.
--
-- `scope` names the route the budget belongs to (`delete-account` today) so a second throttled
-- route cannot share or reset this one's counts. No foreign key to `user`: an IP key has no user,
-- and a deleted account's own key was already cleared by the successful attempt that deleted it.
--
-- ADDITIVE. The Worker live before this migration never reads or writes the table, so applying it
-- ahead of the deploy changes nothing that Worker does; deploying the new Worker WITHOUT it makes
-- every password-checked delete-account request fail. Migrate first, then deploy.

CREATE TABLE attempt_throttle (
  scope TEXT NOT NULL,
  key_digest TEXT NOT NULL,
  attempted_at INTEGER NOT NULL -- epoch milliseconds
);

-- The budget check: count one key's attempts inside the window.
CREATE INDEX attempt_throttle_by_key ON attempt_throttle (scope, key_digest, attempted_at);
-- The prune: drop a scope's attempts older than the window.
CREATE INDEX attempt_throttle_by_age ON attempt_throttle (scope, attempted_at);
