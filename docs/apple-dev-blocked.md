# Parked: work that needs the Apple Developer Program

**Created 2026-07-12.** Ian does not hold an Apple Developer Program membership yet ($99/yr) and
will buy it later. Everything below is genuinely gated on that membership — it cannot be started,
let alone finished, without it.

**This file is the only record of GitHub issue #18.** It was **permanently deleted** from GitHub
on 2026-07-12 at Ian's explicit request, to keep the open backlog to work that can actually be
done today. GitHub issue deletion is irreversible: #18 cannot be reopened, and the number is
burned. Re-file from the text below when the membership is bought.

The remaining open GitHub issues are, by design, all doable without an Apple account.

---

## 1. Deleted from GitHub — re-file these when the membership lands

### #18 — M6: Release — EAS init, app icon/splash, empty/error-state sweep, TestFlight

> *Labels: `enhancement`. Verbatim body as it stood at deletion:*

> Build-prompt Phase 6 steps 3–6.
> - `eas init` (never run — 🟡 known debt), bundle ID, icon + splash (**blocked on the app-name
>   decision**).
> - Copy sweep: empty states, every error state from Ruling 20, offline copy.
> - `responsive-crossdevice` + accessibility pass: small phones, safe areas, font scaling.
> - Re-run the frontend-audit skill and fix HIGHs before inviting testers.
>
> **Done when (M6):** a stranger can go sign-up → plan without hitting a dead end, on TestFlight.

**What changed since it was written:** the app-name blocker is gone — the app is **Pace
Blueprint**, and the bundle ID `com.ian.paceblueprint` already ships in `app.json` (2026-07-12,
issue #35). So the icon/splash *artwork* is unblocked; only the Apple-side pipeline is not.

**Why it's Apple-gated:** TestFlight and App Store submission both require the paid membership.
`eas build` for iOS needs Apple credentials (an App Store Connect API key or an Apple ID with a
team). `eas init` itself is Expo-side and free, but it exists here only to feed a pipeline that
cannot run.

**Not actually Apple-gated — do these now, without the membership:**
- The **copy sweep** (empty states, Ruling 20 error states, offline copy) — pure app code.
- The **`responsive-crossdevice` + accessibility pass** — runs in Expo Go / simulator.
- Re-running the **frontend-audit** skill and fixing HIGHs.
- The **icon, wordmark, and splash artwork** themselves, now that the name is decided.

> **Suggestion:** when re-filing, split this into two issues — an "M6 polish" issue (everything in
> the list above, doable today) and an "M6 ship" issue (`eas build`, TestFlight, store listing,
> which needs the membership). It was only ever one issue because the name decision blocked both
> halves; it no longer does.

---

## 2. Carved out of a still-open issue

### From #7 — M1: Auth — the **Apple Sign-In** requirement only

**Issue #7 is still open on GitHub** and is still fully workable — email/password, Google OAuth,
and session routing need nothing from Apple. Only this one bullet was removed from it and parked
here:

> **Apple Sign-In** — App Store-mandatory once Google is offered (`planning/02` v1 scope);
> currently unconfigured (🟠 known debt).

**Why it's Apple-gated:** configuring Sign in with Apple requires an Apple Developer account — you
need a registered App ID with the Sign In with Apple capability, a Services ID, and a private
key, all created in the Apple Developer portal, before better-auth's Apple provider can be
configured at all (`workers/src/auth.ts`, alongside the Google provider wired there today).

**Why it isn't urgent:** the requirement is an **App Store review rule** — an app that offers a
third-party social login (Google, here) must also offer Sign in with Apple. It only binds at
submission. It does not block building auth, and it does not block TestFlight-less development.

**Do it in this order when the membership lands:** buy the membership → create the App ID /
Services ID / key → add the Apple provider to `buildSocialProviders` in `workers/src/auth.ts` and
`wrangler secret put` its credentials → add the button to the sign-in screen (per blueprint Part
7: native brand buttons, never reskinned) → then submit.

**Related known debt, already recorded in `docs/mvp-progress.md`:** the deep-link scheme is now
`paceblueprint://` (renamed 2026-07-12), and it is **unverified** on the better-auth redirect
allowlist. That's a `workers/` config task, not an Apple one — it belongs to issue #5.

---

## 3. Not Apple-gated, despite looking like it

Recorded so a future session doesn't re-park these by mistake:

| Looks Apple-gated | Actually |
|---|---|
| **#20** — stock Expo blue in `app.json` (`#208AEF` splash, `#E6F4FE` adaptive icon) | A two-value config edit. No Apple account involved. **Closed 2026-09-16** with #49 (same defect) — both values are the Blueprint field, pinned by `src/constants/__tests__/app-config-colors.test.ts`; see `docs/change_log.md`. |
| **#17** — motion, incl. haptics | `expo-haptics` runs in Expo Go. Only an on-device *EAS dev-client build* would need Apple credentials, and the reveal/reduced-motion work doesn't. **Still open.** |
| **#15** — dummy paywall | It's a dummy. Real IAP (StoreKit/RevenueCat) would need the membership, but real IAP is explicitly deferred to v2. **Still open.** |
| **#35** — app name | Was Ian's decision, not Apple's. **Closed 2026-07-12** — the app is Pace Blueprint. |

---

## 4. Leftovers — work Claude attempted but did not finish

Recorded here so the open backlog and this file together tell the whole truth. **All of these are
still open GitHub issues** — nothing in this section was deleted.

| Issue | State after the 2026-07-12 integration pass |
|---|---|
| **#3** — the plan engine (`planTemplates.ts` + `paceDerivation.ts`) | **Unblocked but unbuilt.** Every coaching question that blocked it is now ruled on (#19, #29, #33, #34 all closed). Its two TDD suites are **quarantined** — excluded from `jest`, `tsc`, and `eslint` so `main` is green. **Un-quarantining them and getting them green is this issue's done-when.** The specs are correct and assert every current ruling; they fail only because the two modules don't exist. |
| **#41** — main is red | **Fixed by the quarantine, not by building the engine** — which is the alternative #41's own text offered. `typecheck`, `lint`, and `test` (82/82) are all clean on `main` as of 2026-07-12. The real fix is #3. |
| **#22** — `clampWeeklyVolume()` compares against the literal previous week | **Attempted, nothing produced.** A `worktree-issue22` branch was cut and left with zero commits. Still fully open. Conceptually the same fix as ruling R1c, which *did* land for `clampLongRun()` — the two functions now disagree about what "the previous week" means, so this is worth doing soon. |
| **#20** — stock Expo blue | PR #40 edited `app.json` for the rename but **did not touch the colors**. `#208AEF` and `#E6F4FE` both survive. Still open. |
| **#33** — goal realism | The **ruling** landed (warn at 10%, cap the race-pace anchor at 15%), and the types + test contract are in the repo — but `assessGoalRealism()` itself is unimplemented, because `paceDerivation.ts` doesn't exist. That implementation is #3's job, not a reopening of #33. |
