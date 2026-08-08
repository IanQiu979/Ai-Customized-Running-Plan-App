/**
 * A one-way latch over better-auth's `isPending`, so the root layout's readiness gate can only
 * ever close once.
 *
 * `authClient.useSession()`'s `isPending` is not "the first session lookup hasn't finished yet" —
 * it is re-raised on every background refetch, but *only for signed-out users*. From
 * `node_modules/better-auth/dist/client/session-atom.mjs`, inside `fetchSession`:
 *
 *     session.set({ ...current, isPending: current.data === null, isRefetching: true, ... });
 *
 * A runner halfway through the sign-up form has `data === null` by definition, so every refetch
 * flips `isPending` back to true for exactly the people who can least afford it. And refetches are
 * frequent and invisible: `session-refresh.mjs` defaults `refetchOnWindowFocus` to true and also
 * refetches on online, broadcast, and signal events — on web the focus trigger is a
 * `visibilitychange` listener, on native it is AppState via `@better-auth/expo`. A 5-second rate
 * limit on the focus path is the only reason it reads as intermittent rather than constant.
 *
 * Gating render on `!isPending` therefore returns `null` from the root layout mid-typing, which
 * unmounts `<Stack>`, the `(auth)` group, and the sign-up screen's `useState` with it — the form
 * comes back blank. Latching means a later refetch cannot re-open the gate: the session has
 * resolved once, and whatever it resolves to next is a routing change, not a reason to tear the
 * tree down.
 *
 * NOT AN AUTHORIZATION SIGNAL, despite how the name reads. This never says whether a session
 * exists — only that the first lookup finished, resolving to anything at all. It feeds exactly one
 * expression (`ready` in `_layout.tsx`), whose only consumers are `SplashScreen.hideAsync()` and
 * the `return null` above it: this is splash-screen sequencing, nothing more. Authorization is
 * `Stack.Protected`'s `guard`, which reads `session` directly every render, and — the one that
 * actually matters — the pre-dispatch session check in `workers/src/index.ts`. Never wire this
 * into a guard or a "safe to call the API" check.
 */
export function hasSessionSettled(alreadySettled: boolean, sessionPending: boolean): boolean {
  return alreadySettled || !sessionPending;
}
