# EAS builds

Issue #93 (Android half). iOS/TestFlight is out of scope — no Apple Developer Program yet.

## Account & project

- EAS account: `ianbeatingpros` (`i78979848@gmail.com`)
- EAS project: `pace-blueprint`, id `d86c9827-401d-4866-890e-7fcd5deedc7e`
- `app.json`'s `extra.eas.projectId` and top-level `owner` point at the above.

## Profiles (`eas.json`)

- `development` — `developmentClient: true`, `distribution: internal`, Android `buildType: apk`.
  Bakes `EXPO_PUBLIC_API_BASE_URL` = the production Worker
  (`https://pace-blueprint-production.i78979848.workers.dev`), so a build made from this profile
  talks to the real backend on a phone, not a loopback address.
- `preview` — same shape as `development` but no dev client, for a closer-to-production internal
  test build.
- `production` — Android `buildType: app-bundle`, `autoIncrement: true`, for a future Play Store
  submission.

All three profiles point at the same production Worker URL. There is no local/staging Worker
profile yet — add one (a new `env.EXPO_PUBLIC_API_BASE_URL`) if `wrangler dev` needs to be
targeted from a device build.

## First Android development build

Command: `npx eas-cli@latest build --profile development --platform android`

| Field | Value |
|---|---|
| Build ID | `9ca20e4e-6dfe-4aad-bdff-1dfafa874eb5` |
| Status | FINISHED |
| Build page | https://expo.dev/accounts/ianbeatingpros/projects/pace-blueprint/builds/9ca20e4e-6dfe-4aad-bdff-1dfafa874eb5 |
| Artifact (.apk) | https://expo.dev/artifacts/eas/ChU12AsfwEkGtRw7-6c4JUVMMzVvqyN_7iSx1NgOVNE.apk |
| App version / build number | 1.0.0 / 1 |
| SDK | 57.0.0 |
| App identifier | `com.ian.paceblueprint` |
| Fingerprint id/hash | `01a0b9b1-c918-7c53-8f48-b0f079e2b39a` / `0d61c7e2d14bc90e37342a855efa5d6fc49ebc2b` |
| Git commit | `6d83e0f` (build: configure EAS Android development client) |

Download the artifact URL directly on the Android phone (or `adb install` it) to get the app
installed. Email/password sign-in is the tester path tonight — Google sign-in needs the setup
below first.

## What Google sign-in on a phone still needs

The `fingerprint` field above is Expo's project fingerprint (used for build/update matching), not
the **keystore SHA-1** Google Cloud Console wants for an Android OAuth client. EAS is managing the
Android signing keystore for this project (accepted the auto-generated one non-interactively
during `eas init`/first build). To wire up Google sign-in on Android:

1. Run `npx eas-cli@latest credentials --platform android` (interactive) and read the keystore's
   SHA-1 fingerprint from there, or `npx eas-cli@latest credentials:configure-build --platform
   android` for a non-interactive path — this needs the captain's own EAS session, not a headless
   agent.
2. Register that SHA-1 plus `com.ian.paceblueprint` as an Android OAuth client in Google Cloud
   Console (same project as the existing web client — see `docs/google-oauth-runbook.md`).
3. Add the resulting Android client id to the app's Google sign-in config (currently only the web
   client id/secret are set as Worker secrets, per `CLAUDE.md`'s Secrets & env section).

None of this is done yet. Until it is, Google sign-in on the Android dev build will fail the same
way it did before `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were set on the Worker —
`PROVIDER_NOT_FOUND` or an OAuth redirect mismatch, depending on which half is missing.

## Re-running a build

`npx eas-cli@latest build --profile <development|preview|production> --platform android
--non-interactive --no-wait`, then poll `npx eas-cli@latest build:list` or `build:view <id>
--json` until `status` is `FINISHED`. EAS build minutes are on the free tier for this account —
budget a queue wait, not payment.
