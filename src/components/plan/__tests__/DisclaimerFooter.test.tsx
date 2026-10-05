import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { DISCLAIMER_SUMMARY, DisclaimerFooter } from '../DisclaimerFooter';

/**
 * The plan view's legal footer, folded to one line since 2026-10-05 (captain). What must hold:
 * the line is always there when a plan carries disclaimers, the full text is one tap away and
 * folds back on a second, the state is announced, and the wording that unfolds is exactly the
 * plan's own — the component may choose how much stands open, never what it says.
 */

const DISCLAIMERS = [
  'This plan is general guidance, not medical advice.',
  'Stop and see a professional if pain persists.',
];

function render(disclaimers: readonly string[]): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<DisclaimerFooter disclaimers={disclaimers} />);
  });
  return tree;
}

function toggle(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.find(
    (node) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === `${DISCLAIMER_SUMMARY}, ${DISCLAIMERS.length}` &&
      typeof node.props.onPress === 'function'
  );
}

function shownText(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .filter((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);
}

function press(control: ReactTestInstance) {
  act(() => {
    (control.props.onPress as () => void)();
  });
}

describe('DisclaimerFooter', () => {
  it('starts folded to one line, with none of the disclaimers open', () => {
    const tree = render(DISCLAIMERS);
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: false });
    for (const text of DISCLAIMERS) expect(shownText(tree)).not.toContain(text);
  });

  it('opens to the full, unchanged wording on a tap and folds again on the next', () => {
    const tree = render(DISCLAIMERS);

    press(toggle(tree));
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: true });
    expect(shownText(tree)).toEqual(expect.arrayContaining(DISCLAIMERS));

    press(toggle(tree));
    expect(toggle(tree).props.accessibilityState).toEqual({ expanded: false });
    for (const text of DISCLAIMERS) expect(shownText(tree)).not.toContain(text);
  });

  it('renders nothing for a plan that carries no disclaimers', () => {
    const tree = render([]);
    expect(tree.toJSON()).toBeNull();
  });
});
