# Google OAuth production runbook

Last audited: 2026-08-15.

## Configuration contract

Google Cloud Console → **Google Auth Platform** / **APIs & Services**:

1. **Clients** → the client id used by the production Worker must be type **Web application**.
2. Its **Authorized redirect URIs** must include, exactly:
   - `https://pace-blueprint-production.i78979848.workers.dev/api/auth/callback/google`
   - `http://localhost:8787/api/auth/callback/google` (local `wrangler dev`)
3. **Authorized JavaScript origins are not used by the native OAuth round trip.** If the app's
   local web build is tested, add `http://localhost:8081` and/or `http://localhost:19006`; do not add
   `exp://` or `paceblueprint://` here. Google returns to the Worker HTTPS callback, then
   `@better-auth/expo` returns to the app's deep link.
4. **Audience / publishing status:** if the app is in **Testing**, add the captain's exact Google
   account under **Test users**, or publish the app to **Production**. A non-test account receives
   `access_denied` before the Worker can create a user/account/session.

The Google console cannot be inspected from this repo. The live authorization page proves the
client id and production redirect URI are accepted; it does not prove the consent-screen audience
or the secret used at token exchange.

## Deployed Worker secrets

Run from `workers/`:

```sh
npx wrangler secret list --env production
```

The production Worker must list all three names (values are never printed):

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Cloudflare cannot reveal whether a bound secret's value matches Google Cloud. To prove or repair a
rotated client secret, copy the current secret from the same Web application client and run, from
`workers/`:

```sh
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

Then redeploy with `npx wrangler deploy --env production`. Never omit `--env production`: that
writes/deploys a different Worker.

## Interactive proof (required after auth/config changes)

Before tapping Google, show the empty baseline:

```sh
npx wrangler d1 execute pace-blueprint --remote --env production \
  --command "SELECT id,email,createdAt FROM user; SELECT userId,providerId,accountId FROM account; SELECT id,userId,expiresAt FROM session;"
```

On a physical phone:

1. Start Expo with `.env` pointing `EXPO_PUBLIC_API_BASE_URL` at
   `https://pace-blueprint-production.i78979848.workers.dev` (never `localhost`).
2. Open the app in Expo Go or in the Android development-client build (`docs/build.md`), tap
   **Continue with Google**, and use the captain's Google account.
3. If Google says the app is unavailable to this user, fix **Audience → Test users** or publish the
   consent screen. If the app reports that the server credential may be out of date, reset
   `GOOGLE_CLIENT_SECRET` as above and redeploy.
4. Confirm the app returns from the browser and leaves the auth form.
5. Query D1 again:

```sh
npx wrangler d1 execute pace-blueprint --remote --env production \
  --command "SELECT u.id,u.email,u.createdAt,a.providerId,a.accountId FROM user u JOIN account a ON a.userId=u.id; SELECT id,userId,expiresAt FROM session;"
```

Completion requires a real row with `providerId = 'google'` and a session for that user. URL
creation alone is not completion.

## Observability

Tail the production Worker while reproducing:

```sh
npx wrangler tail --env production --format pretty
```

The Worker now emits secret-free better-auth callback errors. The app also surfaces cancellations,
consent denial, callback/state failures, missing session cookies, and post-callback session failures
instead of leaving a dead button.
