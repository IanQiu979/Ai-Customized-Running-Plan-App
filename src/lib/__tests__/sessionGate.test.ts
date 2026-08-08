/**
 * Guards the readiness latch in `src/lib/sessionGate.ts`.
 *
 * The regression these cover, reported as "very difficult to sign in, if u input everything it
 * will just disappear": the root layout used to gate its render on `!sessionPending` directly and
 * `return null` while pending, which unmounts `<Stack>`, the `(auth)` group, and the sign-up
 * screen's `useState` along with it. Because better-auth re-raises `isPending` on every background
 * session refetch *while signed out*, switching to a password manager and back (a
 * `visibilitychange` refetch) blanked every field the runner had typed.
 *
 * The gate is a pure function precisely so this can be tested with plain jest — rendering
 * `_layout.tsx` is out of reach here, and it is the latch, not React, that is under test.
 */

import { hasSessionSettled } from '../sessionGate';

describe('hasSessionSettled', () => {
  it('keeps the gate closed until the very first session lookup resolves', () => {
    // The original reason the gate exists: routing a signed-out user into `(tabs)` (or a signed-in
    // one into `(auth)`) for a frame is a visible flash. The fix latches the gate, it does not
    // remove it.
    expect(hasSessionSettled(false, true)).toBe(false);
  });

  it('opens the gate on the first resolution', () => {
    expect(hasSessionSettled(false, false)).toBe(true);
  });

  it('does not blank a half-typed sign-up form when a background refetch re-raises pending', () => {
    // This is the regression itself. In `node_modules/better-auth/dist/client/session-atom.mjs`,
    // `fetchSession` sets `isPending: current.data === null` on every refetch — and a runner
    // halfway through the sign-up form has `data === null` by definition, so the flag flips back
    // to true for exactly the people filling in the form. Refetches fire on window focus / app
    // foreground, on reconnect, on cross-tab broadcast, and after a sign-up call.
    //
    // If this assertion ever flips to `false`, the root layout returns `null` mid-typing again and
    // the form comes back empty. It is guarding real upstream behaviour, not a style preference.
    expect(hasSessionSettled(true, true)).toBe(true);
  });

  it('stays open once settled and the session is simply not pending', () => {
    expect(hasSessionSettled(true, false)).toBe(true);
  });

  it("is closed only for the first load across a signed-out runner's real refetch sequence", () => {
    // The observed sequence for someone sitting on the sign-up screen: first load, resolution,
    // then a `visibilitychange` refetch (switch to the password manager and back), its resolution,
    // and another refetch. Folding the latch across it is the check that would actually have
    // caught the bug — each individual value of `sessionPending` looks innocent on its own.
    const sessionPendingSequence = [true, false, true, false, true];

    const gateOpenAtEachStep: boolean[] = [];
    let settled = false;
    for (const sessionPending of sessionPendingSequence) {
      settled = hasSessionSettled(settled, sessionPending);
      gateOpenAtEachStep.push(settled);
    }

    expect(gateOpenAtEachStep).toEqual([false, true, true, true, true]);
  });

  it('is pure — repeated calls with the same inputs agree and nothing is carried over', () => {
    expect(hasSessionSettled(false, true)).toBe(false);
    expect(hasSessionSettled(true, true)).toBe(true);
    // The latch's memory lives in the caller's state, never inside the function: asking again with
    // the un-settled inputs must still answer "closed".
    expect(hasSessionSettled(false, true)).toBe(false);
    expect(hasSessionSettled(false, true)).toBe(false);
  });
});
