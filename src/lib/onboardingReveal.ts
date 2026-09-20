/**
 * The geometry behind the onboarding scroll's reveal latch (`(auth)/onboarding.tsx`). Each step
 * section is a full viewport tall with its content — the build piece and its copy — vertically
 * centred inside it, so "the section has scrolled into view" and "the content is on screen" are
 * different questions by up to half a viewport. The captain's 2026-09-20 ruling makes the latch
 * fire on the content: a piece starts to play, and on first launch the scroll locks to it, only
 * once its whole bounding box is inside the viewport — never while it is still below the fold.
 *
 * Everything here is in scroll-content coordinates (the hero occupies `0..viewportHeight`).
 */

/** Sub-pixel layout rounding on either edge must not keep a box that is visibly on screen from
 * counting as such. */
export const REVEAL_ROUNDING_PX = 1;

export type ContentBox = {
  /** Top of the content's bounding box, in scroll-content coordinates. */
  contentTop: number;
  contentHeight: number;
};

/**
 * Whether a section's content is fully on screen at the given scroll offset. Content taller than
 * the viewport (copy at large Dynamic Type sizes) can never be fully on screen, so it counts once
 * the viewport is filled by it from its top edge downward — the runner has scrolled to its top.
 */
export function isContentFullyOnScreen({
  scrollY,
  viewportHeight,
  contentTop,
  contentHeight,
}: ContentBox & { scrollY: number; viewportHeight: number }): boolean {
  const viewportBottom = scrollY + viewportHeight;
  const contentBottom = contentTop + contentHeight;
  if (contentHeight > viewportHeight) {
    return (
      contentTop <= scrollY + REVEAL_ROUNDING_PX &&
      contentBottom >= viewportBottom - REVEAL_ROUNDING_PX
    );
  }
  return (
    contentTop >= scrollY - REVEAL_ROUNDING_PX && contentBottom <= viewportBottom + REVEAL_ROUNDING_PX
  );
}

/**
 * The scroll offset that centres a section's content in the viewport — where the first-launch
 * lock settles the scroll when it engages, so the one animation playing fills the screen rather
 * than sitting wherever the finger left it. Content taller than the viewport is pinned to its
 * top edge instead, since centring it would push its top off screen.
 */
export function lockScrollOffset({
  viewportHeight,
  contentTop,
  contentHeight,
}: ContentBox & { viewportHeight: number }): number {
  if (contentHeight >= viewportHeight) return contentTop;
  return Math.max(0, contentTop - (viewportHeight - contentHeight) / 2);
}
