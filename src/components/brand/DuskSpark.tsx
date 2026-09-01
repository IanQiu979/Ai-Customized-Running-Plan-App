import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { DuskGradient, Spacing } from '@/constants/theme';

/**
 * The four-point star/sparkle glyph from the sign-in mockup — part of the signed-out dusk
 * exception, a sibling of `DuskHero` (`docs/design/trailhead-visual-system.md` §1). It marks the
 * "shape of the plan you're about to make" illustration and appears nowhere past the session
 * gate: everything after sign-in is paper and ink, and a gradient-filled sparkle on a chalk
 * screen would be exactly the kind of ornament Trailhead removed.
 *
 * Static on purpose. The mockup shimmers it, but the one sanctioned ambient exception is the
 * dusk hero's route-line glow (`Motion.duration.ambient`'s comment) — a second looping animation
 * on the same field would widen that exception rather than use it.
 */

/** The glyph's geometry, in its own 24×24 design space. */
const STAR_PATH = 'M12 2 L13.4 9.6 L21 11 L13.4 12.4 L12 20 L10.6 12.4 L3 11 L10.6 9.6 Z';

/** The mockup renders the spark at half strength so it reads as atmosphere, not as a control. */
const SPARK_OPACITY = 0.5;

export function DuskSpark({ size = Spacing.seven }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      opacity={SPARK_OPACITY}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Defs>
        {/* Cream falling into the route-glow amber, top-left to bottom-right — the same two
            lights the hero's route line is drawn with, so the spark and the line read as one
            illustration rather than two palettes. */}
        <LinearGradient id="duskSpark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={DuskGradient.onDuskMuted} />
          <Stop offset="1" stopColor={DuskGradient.routeGlow} />
        </LinearGradient>
      </Defs>
      <Path d={STAR_PATH} fill="url(#duskSpark)" />
    </Svg>
  );
}
