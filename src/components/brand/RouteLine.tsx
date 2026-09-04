import { useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ROUTE_PROFILE, ROUTE_SUMMIT_INDEX, routePath, routePoints } from '@/lib/routeProfile';

/**
 * The app's in-app ornament: a thin elevation/contour line
 * (`docs/design/instrument-visual-system.md` §4). It carries through Home, My Plans, and Plan
 * view, and replaces the previous system's ribbon-and-wave motif.
 *
 * It draws the SAME ridge everywhere, every launch — the profile is a fixed constant in
 * `src/lib/routeProfile.ts`, not a random walk. A motif that reshuffles between renders is noise.
 *
 * It is ornament and nothing else: no data reaches it, it is hidden from the accessibility tree,
 * and it never carries state. The per-week effort ribbon in `components/plan/WeekAccordion.tsx`
 * is the opposite — that one encodes real data and is not this component's business.
 *
 * Width comes from `onLayout` rather than a prop because every caller wants it flush to whatever
 * container it lives in, and a hardcoded width would be wrong on the first phone that isn't the
 * one it was tuned on.
 */

/** Heights are per-variant so a caller never has to pick one — a route line that is 39pt on one
 * screen and 42pt on the next reads as a mistake rather than a system. */
const VARIANT_HEIGHT = {
  /** A rule under a screen title, in place of a plain hairline divider. */
  header: Spacing.four,
  /** Inside a summary card, behind or beneath its numbers. */
  card: Spacing.six,
} as const;

// There was a third, `hero`-height variant for the retired dusk field. It went with that field:
// the signed-out screens carry the pulse trace now, which draws its own geometry.

export type RouteLineVariant = keyof typeof VARIANT_HEIGHT;

/** The dash rhythm of the not-yet-real ridge: dots one stroke-width long, a small gap apart.
 * With round linecaps a `thin`-length dash renders as a dot, which is exactly the mockup's
 * "pencilled-in, not drawn yet" reading. */
const DASH_PATTERN = [Stroke.thin, Spacing.two] as const;

export function RouteLine({
  variant = 'header',
  strokeWidth = Stroke.mark,
  showSummit = false,
  baseline = false,
  dashed = false,
  style,
}: {
  variant?: RouteLineVariant;
  strokeWidth?: number;
  /** A small open circle at the profile's high point. Reserved for the one place per screen that
   * wants the ridge to read as a summit rather than as a rule. */
  showSummit?: boolean;
  /** A hairline under the ridge, the way a chart has an axis. Used by the header variant. */
  baseline?: boolean;
  /** Draw the ridge as a dotted stroke — the "preview of a plan that doesn't exist yet" reading
   * from the Home empty-state mockup. A solid route line asserts a route; this one sketches it. */
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const height = VARIANT_HEIGHT[variant];
  const stroke = theme.grid.routeLine;
  // Absorbs the stroke's own half-width plus the spline's sub-pixel overshoot past its summit
  // vertex — see `routeProfile.test.ts`'s two bounds assertions for both numbers.
  const inset = strokeWidth / 2 + Stroke.thin;

  const points = width > 0 ? routePoints(ROUTE_PROFILE, width, height, inset) : [];
  const path = routePath(points);
  const summit = points[ROUTE_SUMMIT_INDEX];

  function handleLayout(event: LayoutChangeEvent) {
    const measured = event.nativeEvent.layout.width;
    // Guard the re-render, not just the value: `onLayout` fires on every parent relayout, and an
    // unconditional `setWidth` turns a rotation or a keyboard into a render loop.
    setWidth((current) => (current === measured ? current : measured));
  }

  return (
    <View
      onLayout={handleLayout}
      style={[{ height }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {baseline ? (
            <Line
              x1={0}
              y1={height - inset}
              x2={width}
              y2={height - inset}
              stroke={theme.hairline}
              strokeWidth={Stroke.hairline}
            />
          ) : null}
          <Path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashed ? DASH_PATTERN : undefined}
          />
          {showSummit && summit ? (
            <Circle
              cx={summit.x}
              cy={summit.y}
              r={strokeWidth * 2}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
