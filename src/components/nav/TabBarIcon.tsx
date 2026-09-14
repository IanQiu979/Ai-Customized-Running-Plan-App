import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Spacing, Stroke } from '@/constants/theme';

/**
 * The four tab icons (`docs/design/instrument-visual-system.md` §1) — week strip, book, stacked
 * cards, gear. Before the 2026-09-01 redesign the tab bar rendered `tabBarIcon: () => null`;
 * there were no icons at all.
 *
 * All four are thin-stroke line drawings on a shared 24×24 grid, at `Stroke.mark` weight, with no
 * fills. They take their colour from the tab bar's active/inactive tint, which is `text.primary`
 * or `progress.informative` — never the accent. The accent is reserved for the single
 * forward-action on a screen and is barred from navigation.
 */

/** The grid every path below is drawn on. Rendered size is `Spacing.four`; the two are separate
 * numbers because one is a coordinate space and the other is a layout measurement. */
const VIEWBOX = 24;
const RENDERED_SIZE = Spacing.four;

export type TabIconName = 'strip' | 'book' | 'cards' | 'gear';

export function TabBarIcon({ name, color }: { name: TabIconName; color: string }) {
  return (
    <Svg
      width={RENDERED_SIZE}
      height={RENDERED_SIZE}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      // The bar composes its own accessible label from the tab's title, and the wrapper in
      // `(tabs)/_layout.tsx` hides this drawing from assistive tech; the SVG itself carries no
      // accessibility props (on web they reach the DOM as unknown attributes).
    >
      {renderIcon(name, color)}
    </Svg>
  );
}

function renderIcon(name: TabIconName, color: string) {
  const stroke = {
    stroke: color,
    strokeWidth: Stroke.mark,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  switch (name) {
    // Home. The week strip — the app's one drawing since the contour "route line" was retired
    // with the graph motif (2026-09-14): four bars of different heights on a baseline, with the
    // rest days as gaps, the way every strip in the app reads.
    case 'strip':
      return (
        <>
          <Path d="M3.5 19.5 H20.5" {...stroke} />
          <Path d="M6 19.5 V13" {...stroke} />
          <Path d="M10 19.5 V15.5" {...stroke} />
          <Path d="M14 19.5 V10" {...stroke} />
          <Path d="M18 19.5 V5.5" {...stroke} />
        </>
      );

    // Glossary.
    case 'book':
      return (
        <>
          <Path
            d="M6 3.5 H18 A1.5 1.5 0 0 1 19.5 5 V19 A1.5 1.5 0 0 1 18 20.5 H6 A2.5 2.5 0 0 1 3.5 18 V6 A2.5 2.5 0 0 1 6 3.5 Z"
            {...stroke}
          />
          <Path d="M6 3.5 V20.5" {...stroke} />
          <Path d="M9.5 8 H16" {...stroke} />
          <Path d="M9.5 11.5 H16" {...stroke} />
        </>
      );

    // My Plans — a stack, because a plan is a document and a runner accumulates them.
    case 'cards':
      return (
        <>
          <Path d="M7 5.5 H17" {...stroke} />
          <Path d="M5.5 8.5 H18.5" {...stroke} />
          <Rect x={3.5} y={11.5} width={17} height={9} rx={2} {...stroke} />
        </>
      );

    // Settings.
    case 'gear':
      return (
        <>
          <Path
            d="M 11.13 5.86 L 10.73 3.09 L 13.27 3.09 L 12.87 5.86 A 6.2 6.2 0 0 1 15.72 7.04 L 17.40 4.80 L 19.20 6.60 L 16.96 8.28 A 6.2 6.2 0 0 1 18.14 11.13 L 20.91 10.73 L 20.91 13.27 L 18.14 12.87 A 6.2 6.2 0 0 1 16.96 15.72 L 19.20 17.40 L 17.40 19.20 L 15.72 16.96 A 6.2 6.2 0 0 1 12.87 18.14 L 13.27 20.91 L 10.73 20.91 L 11.13 18.14 A 6.2 6.2 0 0 1 8.28 16.96 L 6.60 19.20 L 4.80 17.40 L 7.04 15.72 A 6.2 6.2 0 0 1 5.86 12.87 L 3.09 13.27 L 3.09 10.73 L 5.86 11.13 A 6.2 6.2 0 0 1 7.04 8.28 L 4.80 6.60 L 6.60 4.80 L 8.28 7.04 A 6.2 6.2 0 0 1 11.13 5.86 Z"
            {...stroke}
          />
          <Circle cx={12} cy={12} r={2.8} {...stroke} />
        </>
      );
  }
}
