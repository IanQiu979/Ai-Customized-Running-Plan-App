import { REVEAL_ROUNDING_PX, isContentFullyOnScreen, lockScrollOffset } from '../onboardingReveal';

/**
 * The captain's 2026-09-20 ruling on the onboarding reveal latch: a step's piece plays — and, on
 * first launch, the scroll locks to it — only once the step's CONTENT is fully on screen, not once
 * the enclosing full-viewport section's top edge has crossed the fold. The section is a viewport
 * tall with the content centred, so the two differ by roughly half a viewport; this suite pins
 * the geometry the screen's handlers delegate to.
 */
describe('isContentFullyOnScreen', () => {
  const viewportHeight = 852;
  // A full-viewport section starting one viewport down (right under the hero), its 400-pt content
  // centred: content spans 852 + 226 .. 852 + 626.
  const contentHeight = 400;
  const contentTop = viewportHeight + (viewportHeight - contentHeight) / 2;

  it('is false while the section top is in view but the content is still below the fold', () => {
    // The old latch fired here: the section's top edge (852) is well inside the viewport's bottom
    // (400 + 852 = 1252, more than the 120 pt it asked for), but the content's bottom (1478) is not.
    const scrollY = 400;
    expect(isContentFullyOnScreen({ scrollY, viewportHeight, contentTop, contentHeight })).toBe(
      false
    );
  });

  it('is false while any of the content hangs below the fold', () => {
    const scrollY = contentTop + contentHeight - viewportHeight - 2;
    expect(isContentFullyOnScreen({ scrollY, viewportHeight, contentTop, contentHeight })).toBe(
      false
    );
  });

  it('is true from the first offset that brings the whole content on screen', () => {
    const scrollY = contentTop + contentHeight - viewportHeight;
    expect(isContentFullyOnScreen({ scrollY, viewportHeight, contentTop, contentHeight })).toBe(
      true
    );
  });

  it('is true when the section fills the viewport exactly, with the content centred', () => {
    expect(
      isContentFullyOnScreen({ scrollY: viewportHeight, viewportHeight, contentTop, contentHeight })
    ).toBe(true);
  });

  it('is false again once the content top has scrolled past the top edge', () => {
    const scrollY = contentTop + 2;
    expect(isContentFullyOnScreen({ scrollY, viewportHeight, contentTop, contentHeight })).toBe(
      false
    );
  });

  it('tolerates sub-pixel rounding on either edge', () => {
    expect(
      isContentFullyOnScreen({
        scrollY: contentTop + REVEAL_ROUNDING_PX,
        viewportHeight,
        contentTop,
        contentHeight,
      })
    ).toBe(true);
    expect(
      isContentFullyOnScreen({
        scrollY: contentTop + contentHeight - viewportHeight - REVEAL_ROUNDING_PX,
        viewportHeight,
        contentTop,
        contentHeight,
      })
    ).toBe(true);
  });

  describe('content taller than the viewport (large Dynamic Type)', () => {
    const tallHeight = viewportHeight + 300;
    const tallTop = viewportHeight + 32;

    it('never counts while its top is still below the viewport top', () => {
      expect(
        isContentFullyOnScreen({
          scrollY: tallTop - 40,
          viewportHeight,
          contentTop: tallTop,
          contentHeight: tallHeight,
        })
      ).toBe(false);
    });

    it('counts once the viewport is filled by it from its top edge', () => {
      expect(
        isContentFullyOnScreen({
          scrollY: tallTop,
          viewportHeight,
          contentTop: tallTop,
          contentHeight: tallHeight,
        })
      ).toBe(true);
      expect(
        isContentFullyOnScreen({
          scrollY: tallTop + 200,
          viewportHeight,
          contentTop: tallTop,
          contentHeight: tallHeight,
        })
      ).toBe(true);
    });

    it('stops counting once its bottom has risen above the fold', () => {
      expect(
        isContentFullyOnScreen({
          scrollY: tallTop + 302,
          viewportHeight,
          contentTop: tallTop,
          contentHeight: tallHeight,
        })
      ).toBe(false);
    });
  });
});

describe('lockScrollOffset', () => {
  const viewportHeight = 852;

  it('centres the content in the viewport', () => {
    // Content centred in a full-viewport section that starts at 852 → the lock lands on 852.
    expect(lockScrollOffset({ viewportHeight, contentTop: 852 + 226, contentHeight: 400 })).toBe(
      852
    );
  });

  it('pins content taller than the viewport to its own top edge', () => {
    expect(
      lockScrollOffset({ viewportHeight, contentTop: 884, contentHeight: viewportHeight + 300 })
    ).toBe(884);
  });

  it('never asks for a negative offset', () => {
    expect(lockScrollOffset({ viewportHeight, contentTop: 10, contentHeight: 400 })).toBe(0);
  });
});
