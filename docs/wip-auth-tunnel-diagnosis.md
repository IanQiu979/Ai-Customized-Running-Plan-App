# WIP — diagnosis: "sign-in/sign-up don't work" + "`expo start --tunnel` broken"

**Status: INCOMPLETE. Diagnosis only — no fix implemented yet.** Delete this file once the fix
lands and the findings are folded into `docs/mvp-progress.md` / `docs/change_log.md`.

Session paused mid-task 2026-09-03 (captain ended the session). Branch: `fm/v22-fix-auth-ngrok-r1`.

---

## Bug 1 — sign-in and sign-up "don't work at all"

### Root cause: client config, not backend, and not the auth code.

Evidence gathered 2026-09-03 by direct probe, in this order:

**The deployed Worker is healthy.** Against
`https://pace-blueprint-production.i78979848.workers.dev`:

| Probe | Result |
|---|---|
| `GET /api/auth/ok` | `200` |
| `POST /api/auth/sign-up/email` | `200`, real user row + `set-cookie: __Secure-better-auth.session_token=…` + `set-auth-token` |
| `POST /api/auth/sign-in/email` | `200`, `{"redirect":false,"token":…,"user":{…}}` |

So better-auth, D1, the session cookie, and both email flows all work server-side. A throwaway
account (`fmtest+1788450139@example.com`) was created and signed into successfully. **Nothing is
wrong with `workers/`.**

Note `GET /api/auth/session` returns `404` with no body — that is better-auth's expected shape for
an unauthenticated bare probe, not a defect.

**The client is pointed at a dead address.** The captain's real `.env` (in the primary checkout,
gitignored, not in this worktree) reads:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

and nothing is listening on `localhost:8787` — `wrangler dev` is not running. Verified: connection
refused.

**Therefore:** every `authClient` call — sign-in and sign-up alike — never reaches a server. `fetch`
rejects with a bare `TypeError`, `src/lib/apiErrors.ts`'s `isNetworkFailure` converts it to
`NetworkError`, and the screen shows a can't-reach-the-server message. Both flows fail identically
and totally, which is exactly the reported symptom. On a *physical device* it fails for a second,
independent reason on top: `localhost` resolves to the phone. This is precisely the guardrail
already written down in `AGENTS.md` ("A loopback `EXPO_PUBLIC_API_BASE_URL` is unreachable from a
phone, and `--tunnel` does not change that") and in `.env.example`.

### What still needs doing

1. Point the client at the deployed Worker. The one-machine part is the captain's gitignored `.env`;
   the *committable* part is that **`.env.example` is now stale** — it still says the Worker is "not
   set yet — nothing is deployed yet", which is false since 2026-08-09 and is what leads a fresh
   setup straight into this failure. It should name
   `https://pace-blueprint-production.i78979848.workers.dev` as the value for device testing.
2. Decide whether `src/lib/apiClient.ts` should keep hard-throwing on a missing
   `EXPO_PUBLIC_API_BASE_URL` (today: no `.env` at all ⇒ the app crashes at import, white screen,
   *not* a legible error) or fall back to the deployed origin. **This is a product/architecture
   call, not an implementation detail — escalate rather than choose.**
3. Reproduce once in the simulator against the corrected base URL and confirm a real account signs
   up and signs in, as the brief requires ("verified live"). **Not yet done.**

### Ruled out — do not re-investigate

- `src/lib/supabase.ts` throwing at import. Both `EXPO_PUBLIC_SUPABASE_*` vars are **empty** in the
  captain's `.env`, so it *would* throw — but nothing in the app imports it (`apiClient.ts` only
  mentions it in a comment). Expo's own startup log confirms it: only
  `env: export EXPO_PUBLIC_API_BASE_URL` is exported. Harmless dead scaffold, as documented.

---

## Bug 2 — `expo start --tunnel`

### Partially diagnosed. The tunnel does come up; it does not stay up.

Reproduced in this worktree with `npx expo start --tunnel --port 8097`:

- `@expo/ngrok` is **not** a local dependency and is not in `package.json`; it resolves from a
  **global** install, `@expo/ngrok@4.1.3`. Expo SDK 54 needs `^4.1.0`, so the version satisfies —
  but the dependency being global-only means the tunnel works or breaks per-machine, invisibly, and
  a fresh clone has no way to know it is required.
- The tunnel **does** establish: `Tunnel connected.` → `Tunnel ready.`, and the public URL serves
  Metro's manifest correctly — `200` for `GET https://<sub>.ngrok.io` with `expo-platform: ios`,
  matching `200` from `localhost:8097` direct. So it is not a dead tunnel.
- It then **drops and reconnects**: `Tunnel connection has been closed. This is often related to
  intermittent connection issues between the dev server and ngrok. Restart the dev server to try
  connecting to ngrok again.` followed by another `Tunnel connected.` This churn is the likely
  shape of "broken" from the captain's seat — a device loses the bundler mid-session.
- **Prime suspect, unconfirmed:** the URL handed out is on `*.ngrok.io`, the legacy domain ngrok has
  deprecated in favour of `*.ngrok-free.app` / `*.ngrok.app`. `@expo/ngrok@4.1.3` bundles an old
  agent binary. Next step is to check the agent version against ngrok's current minimum and try a
  newer `@expo/ngrok`, and to confirm whether the captain's ngrok account
  (subdomain `ianbeatingpros`) is hitting a free-tier session/agent limit — a second agent session
  elsewhere would force exactly this disconnect loop.

### Confounder to be aware of

The first run failed for an unrelated reason worth remembering: **port 8081 was already held by a
different treehouse lane** (`echo`), and `--non-interactive` is not a valid Expo flag (use `CI=1`),
so the prompt to switch ports could not be answered and the dev server was skipped entirely. That
is not the captain's bug, but it will bite any agent reproducing this in a parallel worktree.

---

## Also noticed, not acted on

`npm install` in a clean worktree warns the lockfile is behind `package.json`'s ranges:
`expo@54.0.36` (expected `~54.0.37`), `expo-constants@18.0.13` (`~18.0.14`),
`jest-expo@54.0.17` (`~54.0.18`). Out of scope for this task; a dependency bump is HIGH tier
(`AGENTS.md`) and needs its own pass.
