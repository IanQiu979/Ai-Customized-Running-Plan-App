/**
 * A one-shot flag bridging sign-up to the root layout's post-auth redirect.
 *
 * `sign-up.tsx` cannot reliably navigate itself once `session` flips truthy: that same
 * transition makes `_layout.tsx`'s `Stack.Protected` unmount the whole `(auth)` group — including
 * sign-up's own `useEffect` — in the same commit, so the effect can lose the race and never fire.
 * `_layout.tsx` never unmounts, so it consumes this flag once `session` becomes truthy instead.
 */
let pending = false;

export function markPostSignupRedirect(): void {
  pending = true;
}

export function consumePostSignupRedirect(): boolean {
  const value = pending;
  pending = false;
  return value;
}
