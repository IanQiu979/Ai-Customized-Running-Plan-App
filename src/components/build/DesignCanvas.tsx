import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DesignWidth } from '@/constants/theme';

/** The V22 pages' canvas: iPhone 15/16 class portrait, 393 × 852 pt (spec §0). */
export const DesignHeight = 852;

/**
 * A 393 × 852 composition, scaled to fit the box it is given and centred in it — never
 * stretched (spec §0: "must also read on an iPad in portrait: centre the composition"). The
 * full-screen builds (the onboarding hero, the survey intro) are authored in absolute page
 * coordinates, exactly as the approved pages are, and this is what keeps every coordinate true
 * on a 375-wide phone or a 1024-wide tablet.
 *
 * Scaling down only. A screen taller and wider than the design canvas gets the canvas at 1:1
 * with air around it, which is the page's own end frame rather than an enlarged one.
 */
export function DesignCanvas({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const scale = Math.min(1, width / DesignWidth, height / DesignHeight);
  return (
    <View style={[styles.box, { width, height }]}>
      <View
        style={[
          styles.canvas,
          {
            width: DesignWidth,
            height: DesignHeight,
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  canvas: {
    position: 'relative',
  },
});
