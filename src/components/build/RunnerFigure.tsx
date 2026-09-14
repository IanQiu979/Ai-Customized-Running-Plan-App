import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * The runner figure on onboarding's last step (V22-02 "Get started"): a stick runner in ink,
 * 9-unit round strokes on a 100-unit grid, verbatim from the approved page. Decoration — it is
 * hidden from assistive tech and the button below it carries the meaning.
 */
export function RunnerFigure({ size = 105 }: { size?: number }) {
  const theme = useTheme();
  const ink = theme.text.primary;
  return (
    <View aria-hidden>
      <Svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        stroke={ink}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx={70} cy={26} r={9} fill={ink} stroke="none" />
        <Path d="M61 44 L52 64" />
        <Path d="M52 64 L34 78 L12 86" />
        <Path d="M52 64 L72 76 L62 98" />
        <Path d="M61 44 L40 36 L36 46" />
        <Path d="M61 44 L72 56 L88 38" />
      </Svg>
    </View>
  );
}
