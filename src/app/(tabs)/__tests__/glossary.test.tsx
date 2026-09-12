import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GlossaryScreen from '../glossary';

const mountedTrees: ReactTestRenderer[] = [];

function renderScreen(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 430, height: 932 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <GlossaryScreen />
      </SafeAreaProvider>
    );
  });
  mountedTrees.push(tree);
  return tree;
}

function flatten(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children && typeof children === 'object') {
    const node = children as { children?: unknown; props?: { children?: unknown } };
    return flatten(node.children ?? node.props?.children);
  }
  return '';
}

function disclosures(tree: ReactTestRenderer, accessibilityLabel: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === accessibilityLabel &&
      typeof node.props.onPress === 'function'
  );
}

function press(control: ReactTestInstance): void {
  act(() => {
    (control.props.onPress as () => void)();
  });
}

describe('Glossary compact rows', () => {
  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach((tree) => tree.unmount());
    });
  });

  it('keeps run-type definitions collapsed and toggles each row independently', () => {
    const tree = renderScreen();
    const easyDescription =
      'Comfortable, conversational-pace aerobic run — the base of every week.';
    const recoveryDescription =
      'A very easy, short run the day after a hard session — active recovery, not training stimulus.';

    expect(flatten(tree.root)).not.toContain(easyDescription);
    expect(flatten(tree.root)).not.toContain(recoveryDescription);

    const easyControls = disclosures(tree, 'ER, Easy Run');
    const recoveryControls = disclosures(tree, 'RR, Recovery Run');
    expect(easyControls).toHaveLength(1);
    expect(recoveryControls).toHaveLength(1);
    if (easyControls.length !== 1 || recoveryControls.length !== 1) return;

    expect(easyControls[0].props.accessibilityState).toEqual({ expanded: false });
    expect(easyControls[0].props.accessibilityHint).toBe('Expands this definition');
    expect(recoveryControls[0].props.accessibilityState).toEqual({ expanded: false });

    press(easyControls[0]);

    expect(flatten(tree.root)).toContain(easyDescription);
    expect(flatten(tree.root)).not.toContain(recoveryDescription);
    expect(disclosures(tree, 'ER, Easy Run')[0].props.accessibilityState).toEqual({ expanded: true });
    expect(disclosures(tree, 'ER, Easy Run')[0].props.accessibilityHint).toBe(
      'Collapses this definition'
    );
    expect(disclosures(tree, 'RR, Recovery Run')[0].props.accessibilityState).toEqual({
      expanded: false,
    });

    press(disclosures(tree, 'ER, Easy Run')[0]);

    expect(flatten(tree.root)).not.toContain(easyDescription);
    expect(disclosures(tree, 'ER, Easy Run')[0].props.accessibilityState).toEqual({ expanded: false });
  });

  it('collapses and expands structure shorthand rows too', () => {
    const tree = renderScreen();

    expect(flatten(tree.root)).not.toContain('Warm-up.');
    expect(flatten(tree.root)).not.toContain('Cool-down.');

    const warmupControls = disclosures(tree, 'WU');
    const cooldownControls = disclosures(tree, 'CD');
    expect(warmupControls).toHaveLength(1);
    expect(cooldownControls).toHaveLength(1);
    if (warmupControls.length !== 1 || cooldownControls.length !== 1) return;

    expect(warmupControls[0].props.accessibilityState).toEqual({ expanded: false });
    expect(warmupControls[0].props.accessibilityHint).toBe('Expands this definition');
    expect(cooldownControls[0].props.accessibilityState).toEqual({ expanded: false });

    press(warmupControls[0]);

    expect(flatten(tree.root)).toContain('Warm-up.');
    expect(flatten(tree.root)).not.toContain('Cool-down.');
    expect(disclosures(tree, 'WU')[0].props.accessibilityState).toEqual({ expanded: true });
    expect(disclosures(tree, 'WU')[0].props.accessibilityHint).toBe(
      'Collapses this definition'
    );
    expect(disclosures(tree, 'CD')[0].props.accessibilityState).toEqual({ expanded: false });
  });

  it('keeps an unabbreviated run term compact until its row is expanded', () => {
    const tree = renderScreen();
    const stridesDescription =
      'Short, controlled accelerations to near-top speed with full recovery — neuromuscular sharpening, not a workout in itself.';

    expect(flatten(tree.root)).not.toContain(stridesDescription);

    const stridesControls = disclosures(tree, 'Strides');
    expect(stridesControls).toHaveLength(1);
    if (stridesControls.length !== 1) return;
    expect(stridesControls[0].props.accessibilityState).toEqual({ expanded: false });

    press(stridesControls[0]);

    expect(flatten(tree.root)).toContain(stridesDescription);
    expect(disclosures(tree, 'Strides')[0].props.accessibilityState).toEqual({ expanded: true });
  });
});
