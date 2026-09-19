# Email setup — password reset and email verification (issue #94)

**Status: built, tested, and switched off by default.** Until the two secrets below exist on the
deployed Worker, the app behaves exactly as before this feature: sign-up creates a session
immediately, no verification mail is sent, and "Forgot your password?" shows an honest
*"Password reset isn't available yet — this server can't send email"* instead of a form. Nothing
in this document can be done by an agent: the domain, the mail-provider account and every secret
are the captain's (`AGENTS.md` → guardrails, "Never run `wrangler secret put`").

## How it works, in one paragraph

The Worker sends two transactional emails through a provider-agnostic sender
(`workers/src/lib/mail.ts`: `sendMail({ to, subject, text, html })`) with two adapters —
`ResendAdapter` (Resend's HTTP API) when `RESEND_API_KEY` **and** `MAIL_FROM` are both set and
non-blank, and `ConsoleAdapter` otherwise, which logs one redacted line (`mail_skipped_unconfigured`,
subject only, never the recipient or the link) and sends nothing. `workers/src/auth-email.ts` picks
the adapter per request and exposes the two booleans the app reads from the public
`GET /api/email-status`: `mailConfigured` and `verificationRequired`. Every link in a mail is the
Worker's own URL; the Worker spends the token server-side and answers a `302` to the app
(`paceblueprint://reset-password?token=…`, `paceblueprint://verify-email`), so the token never
appears in an app URL until the Worker has already validated it. Both flows are pinned end to end
in `workers/test/auth-email.test.ts`; the adapters and the degradation flag in
`workers/test/mail.test.ts` and `workers/test/email-status.test.ts`. No test sends real mail —
`workers/vitest.config.ts` blanks both secrets regardless of `.dev.vars`.

## What the captain has to do

Six steps. Steps 1–3 are in Resend's dashboard; 4–6 are commands. **Every `wrangler` command
below needs `--env production`** — without it the secret lands on a Worker nothing talks to
(`workers/README.md` → "What the captain has to do" has the full warning).

### 1. Resend account and sending domain

Sign up at resend.com (free tier is enough for testers: 3,000 mails/month at the time of writing —
check the current limits, don't trust this line). Under **Domains → Add domain**, add a domain you
control. A subdomain dedicated to mail (`mail.yourdomain.com`) is the conventional choice because
its reputation stays separate from the root domain's; either works.

There is no Pace Blueprint domain yet, so this is also the moment to decide one. Nothing in the
code assumes any particular domain — `MAIL_FROM` is the only place it appears.

### 2. DNS records

Resend shows the exact records to add after step 1. Copy them **verbatim from the dashboard** —
they are per-account values, and this document deliberately does not reproduce examples that
would be wrong for yours. Expect three kinds:

| Record | Purpose | Required? |
|---|---|---|
| **DKIM** — a `TXT` at `resend._domainkey.<domain>` | Signs each mail so receivers can verify it came from you | Yes — Resend will not send until it verifies |
| **SPF / return-path** — an `MX` and a `TXT` on a `send.<domain>` (or similar) host | Lets receivers check bounces route back through Resend | Yes |
| **DMARC** — a `TXT` at `_dmarc.<domain>` | Tells receivers what to do with mail that fails the above | Optional for Resend, but Gmail/Yahoo increasingly bounce bulk senders without one; `v=DMARC1; p=none;` is the safe starting policy |

Add them at your DNS host, then press **Verify** in Resend. Propagation is usually minutes, can be
up to a day. The domain must show **Verified** before step 5 will deliver anything: an unverified
domain makes Resend answer `403`, which the Worker logs as `Mail delivery failed (HTTP 403).` —
status only, by design, since provider bodies can echo the address and link.

### 3. API key

**API Keys → Create API key.** Permission **Sending access** only, scoped to the domain from
step 1 — never "Full access"; the Worker only ever calls `POST /emails`. Copy the key once; Resend
does not show it again.

### 4. Local first (optional, recommended)

```sh
# workers/.dev.vars — gitignored; .dev.vars.example documents the lines
RESEND_API_KEY=re_…
MAIL_FROM=Pace Blueprint <no-reply@mail.yourdomain.com>
```

Then `npm --prefix workers run dev` and, from the app, request a reset for a real address you own.
`MAIL_FROM` accepts either a bare address or the `Name <address>` form; the address's domain must
be the verified one.

### 5. Production secrets

```sh
cd workers
wrangler secret put RESEND_API_KEY --env production   # paste the key from step 3
wrangler secret put MAIL_FROM --env production        # e.g. Pace Blueprint <no-reply@mail.yourdomain.com>
```

Both values are `.trim()`med on read, so a pasted trailing newline is harmless — but a blank value
counts as absent, and *either* one absent leaves mail off (`resolveAuthMailRuntime`). A secret put
takes effect immediately; no redeploy is needed for this step.

Confirm, without a device:

```sh
curl https://pace-blueprint-production.i78979848.workers.dev/api/email-status
# {"mailConfigured":true,"verificationRequired":false}
```

`mailConfigured: true` is the whole check. From here the app's forgot-password form appears,
sign-up sends a verification mail, and Home shows the "Verify your email" card (with a resend) to
any account whose address is unverified — but sign-in is **not yet** gated on it.

### 6. Requiring verification (a separate decision)

Gating sign-in on a verified address is off by default and stays off until you flip it, because
turning it on with mail misconfigured would lock every new tester out at the first sign-in. The
flag is a committed, non-secret var:

```toml
# workers/wrangler.toml
[env.production.vars]
MAIL_VERIFICATION_REQUIRED = "true"
```

then `wrangler deploy --env production`. The Worker only honours the flag when
`mailConfigured` is also true (`verificationRequired = mailConfigured && flag`), so the order of
steps 5 and 6 cannot produce a lockout. With it on: sign-up creates the account but no session and
the app shows "Check your inbox"; an unverified sign-in is refused with `EMAIL_NOT_VERIFIED` and the
sign-in screen offers a resend. **Existing accounts created before this feature have
`emailVerified = 0`** and will be gated too — Google accounts are exempt, since Google reports the
address verified at sign-in. Warn testers before flipping it, or leave it off until launch.

## The deep links

Nothing to configure. `app.json`'s `"scheme": "paceblueprint"` already registers the custom
scheme on both platforms, and Expo Router maps `paceblueprint://reset-password?token=…` and
`paceblueprint://verify-email` to `src/app/reset-password.tsx` and `src/app/verify-email.tsx`
(both deliberately outside the session guard — see `src/app/_layout.tsx`). The Worker already
trusts the scheme as a redirect target (`APP_SCHEME` in `wrangler.toml` → `trustedOrigins` in
`workers/src/auth.ts`).

The app supplies the callback itself through `expo-linking`, so the same code works in every
runtime without a per-environment setting:

| Runtime | Callback the mail's link redirects to |
|---|---|
| Built app (EAS dev client, TestFlight, store) | `paceblueprint://reset-password` |
| Expo Go | `exp://<lan-ip>:8081/--/reset-password` — only reachable while that Metro server is up on that address |
| Web (`npm run web`) | `http://localhost:8081/reset-password` (whatever origin the page is on; it must be in `CORS_ALLOWED_ORIGINS`) |

**Not done, and not needed for testers:** Universal Links / Android App Links (an `https://`
link that opens the app directly, skipping the browser hop) need an owned domain serving an
`apple-app-site-association` / `assetlinks.json` file plus `associatedDomains` / `intentFilters`
in `app.json`. The custom scheme works today from any mail client via a one-hop browser redirect;
revisit once there is a Pace Blueprint domain.

## Troubleshooting

| Symptom | Meaning |
|---|---|
| `/api/email-status` says `mailConfigured: false` after step 5 | One of the two secrets is blank, or was put without `--env production` |
| Worker log `Mail delivery failed (HTTP 403).` | Domain not verified in Resend, key revoked, or `MAIL_FROM` on a different domain than the key is scoped to |
| Worker log `Mail delivery failed (HTTP 422).` | `MAIL_FROM` malformed — use `Name <address>` or a bare address |
| Worker log `mail_skipped_unconfigured` | Expected while mail is off; the `ConsoleAdapter` is in use |
| Mail arrives, link opens the browser to a JSON 404 | The link's `callbackURL` was the Worker root — only possible from a client that omitted it; the app never does |
| Link opens the app on "Link expired" immediately | Both token kinds last one hour (better-auth's defaults) and a reset token is single-use. Request a new one |
| Tester says the reset mail never came | Check Resend's **Logs** page first — it shows every accepted request and its delivery state. The Worker answers `200` for unknown addresses on purpose (no account enumeration), so "no mail" can also mean "no account under that spelling" |
