import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReactElement } from 'react';
import { Text, processColor } from 'react-native';

import { Accent, Colors } from '@/constants/theme';

import { RouteLine } from '../brand/RouteLine';
import { LockedPanel } from '../home/LockedPanel';
import { PlanContentTeaser } from '../home/PlanContentTeaser';
import { ActionRow, Group, Row } from '../layout/GroupedRows';
import { ScreenHeader } from '../layout/ScreenHeader';
import { TabBarIcon, type TabIconName } from '../nav/TabBarIcon';
import { PulseTraceSlot } from '../onboarding/PulseTraceSlot';
import { ActionDivider, LinkAction, PrimaryAction, SecondaryAction } from '../ui/ActionButton';

/**
 * A render smoke test for the presentational components the app is assembled from.
 *
 * `CLAUDE.md` says screens are not unit-tested, and this does not test screens — it mounts the
 * presentational pieces they are assembled from. The gap it closes is specific: `tsc` proves these
 * files type-check and proves nothing about whether they render. A `<Path d={undefined}>`, a
 * `Children.toArray` that chokes on a conditional `null` child, or a `StyleSheet` key referenced
 * but never defined are all clean typechecks and blank or crashed screens.
 *
 * The assertions are deliberately shallow. This is not a snapshot suite — pinning the exact tree
 * of an ornament would make every visual tweak a test edit, which is how a suite stops meaning
 * anything. It asserts that a tree exists and that the few genuinely load-bearing behaviours hold.
 */

/** `create()` outside `act()` warns and can leave effects unflushed; every mount goes through
 * this so a component with a layout effect behaves the same as one without. */
function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

/** First value of `key` found anywhere in a rendered tree's props, depth-first. */
function findProp(node: unknown, key: string): unknown {
  if (!node || typeof node !== 'object') return undefined;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  if (candidate.props && key in candidate.props) return candidate.props[key];
  for (const child of candidate.children ?? []) {
    const found = findProp(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe('RouteLine', () => {
  it('renders every variant without measuring first', () => {
    // The pre-layout pass is the real risk: width is 0 until `onLayout` fires, and `routePath([])`
    // returns '' rather than a malformed `d`. If this ever throws, the ornament crashes the first
    // frame of Home, My Plans and Plan view simultaneously.
    for (const variant of ['header', 'card'] as const) {
      const tree = render(<RouteLine variant={variant} />);
      expect(tree.toJSON()).toBeTruthy();
    }
  });

  it('draws nothing before layout, and a real path after it', () => {
    const tree = render(<RouteLine variant="header" showSummit baseline />);

    // Pre-layout: width is 0, so there is no `<Svg>` at all rather than one with an empty `d`.
    expect(JSON.stringify(tree.toJSON())).not.toContain('"d":');

    const measurable = tree.root.findAll(
      (node) => typeof (node.props as { onLayout?: unknown }).onLayout === 'function'
    );
    act(() => {
      (measurable[0].props as { onLayout: (event: unknown) => void }).onLayout({
        nativeEvent: { layout: { width: 320, height: 24 } },
      });
    });

    // Post-layout: a `d` that actually starts with a moveto and carries cubic segments. An empty
    // or malformed `d` renders as nothing at all, which is precisely the failure a screenshot of
    // a 1.5pt ornament would not catch.
    const svg = JSON.parse(JSON.stringify(tree.toJSON()));
    const path = findProp(svg, 'd');
    expect(typeof path).toBe('string');
    expect(path as string).toMatch(/^M [\d.]+ [\d.]+ C /);
  });
});

describe('TabBarIcon', () => {
  const names: TabIconName[] = ['route', 'book', 'cards', 'gear'];

  it.each(names)('renders the %s icon', (name) => {
    const tree = render(<TabBarIcon name={name} color="#241C17" />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('covers every icon the tab bar asks for', () => {
    // The switch in `renderIcon` has no default branch — TypeScript makes it exhaustive over
    // `TabIconName`, and this asserts the list above stays exhaustive too, so a fifth tab cannot
    // ship with an invisible icon.
    expect(names).toHaveLength(4);
  });
});

describe('ScreenHeader', () => {
  it('renders with and without the route line', () => {
    expect(render(<ScreenHeader title="My Plans" routeLine />).toJSON()).toBeTruthy();
    expect(render(<ScreenHeader title="Settings" />).toJSON()).toBeTruthy();
  });

  it('renders the optional eyebrow and supporting copy', () => {
    const tree = render(
      <ScreenHeader eyebrow="Your library" title="My Plans" supporting="Everything you've built." />
    );
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('YOUR LIBRARY');
    expect(text).toContain("Everything you've built.");
  });
});

describe('LockedPanel', () => {
  it('renders children bare when unlocked — no frame, no unlock affordance', () => {
    const tree = render(
      <LockedPanel locked={false} label="Notes" onUnlock={jest.fn()}>
        <ScreenHeader title="Visible" />
      </LockedPanel>
    );
    expect(JSON.stringify(tree.toJSON())).not.toContain('UPGRADE TO UNLOCK');
  });

  it('frames the children and offers the upgrade route when locked', () => {
    const onUnlock = jest.fn();
    const tree = render(
      <LockedPanel locked label="Notes" onUnlock={onUnlock}>
        <ScreenHeader title="Hidden" />
      </LockedPanel>
    );
    expect(JSON.stringify(tree.toJSON())).toContain('UPGRADE TO UNLOCK');
  });

  it('announces the lock, so the dim is never the only channel carrying it', () => {
    // The dim is decoration. A screen reader gets nothing from `opacity: 0.45`, so the state has
    // to be in the label or it does not exist for that user.
    const tree = render(
      <LockedPanel locked label="Notes" onUnlock={jest.fn()}>
        <ScreenHeader title="Hidden" />
      </LockedPanel>
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Notes — locked');
  });
});

describe('PlanContentTeaser', () => {
  it('renders the sample pace, HR zone and coach note the Free tier is being shown', () => {
    const text = JSON.stringify(render(<PlanContentTeaser />).toJSON());
    expect(text).toContain('PACE');
    expect(text).toContain('HR ZONE');
    expect(text).toContain("COACH'S NOTE");
  });
});

describe('GroupedRows', () => {
  it('renders a group of rows', () => {
    const tree = render(
      <Group title="Account">
        <Row label="Tier" value="FREE" mono />
        <Row label="Plans" value="1 of 1 plans used" mono />
        <ActionRow label="Upgrade" onPress={jest.fn()} />
      </Group>
    );
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('ACCOUNT');
    expect(text).toContain('Upgrade');
  });

  it('survives the conditional `null` children every caller passes', () => {
    // Settings renders `{quota ? <Row/> : null}` three times over. `Children.toArray` drops the
    // nulls, but only because `Group` filters with `isValidElement` — without that the separator
    // logic indexes past the end and the group renders a stray hairline.
    const tree = render(
      <Group title="Account">
        {null}
        <Row label="Tier" value="PRO" mono />
        {false}
        {null}
      </Group>
    );
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders a destructive action row', () => {
    const tree = render(
      <Group>
        <ActionRow label="Delete account" tone="destructive" onPress={jest.fn()} />
      </Group>
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Delete account');
  });
});

/** Every style object a component resolved, flattened into one lookup. `Pressable`'s `style` is a
 * function of press state, which `toJSON()` has already called for us, so this reads what actually
 * rendered rather than what was passed. */
function styleOf(node: unknown): Record<string, unknown> {
  const style = findProp(node, 'style');
  const parts = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...parts.filter((part) => part && typeof part === 'object'));
}

describe('PrimaryAction', () => {
  it('spends the signal on a live action: near-black field, cyan edge, cyan label', () => {
    // The whole two-tier accent in one assertion. If the fill ever becomes the cyan, this fails —
    // and it should, because `Accent.signal` has no boundary on a light page (1.27:1). See
    // `constants/__tests__/theme.contrast.test.ts`.
    const tree = render(<PrimaryAction label="Get started" onPress={jest.fn()} />);
    const style = styleOf(tree.toJSON());

    expect(style.backgroundColor).toBe(Accent.field);
    expect(style.borderColor).toBe(Accent.signal);

    const label = tree.root.findAllByType(Text)[0];
    expect(styleOf({ props: label.props })).toMatchObject({ color: Accent.signal });
  });

  it('withdraws the signal entirely when disabled — an inert slab, not a dim cyan one', () => {
    const tree = render(<PrimaryAction label="Get started" disabled onPress={jest.fn()} />);
    const style = styleOf(tree.toJSON());

    expect(style.backgroundColor).toBe(Colors.light.progress.disabled);
    expect(style.backgroundColor).not.toBe(Accent.field);
    expect(style.borderColor).toBe('transparent');
    expect(JSON.stringify(tree.toJSON())).not.toContain(Accent.signal);
  });

  it('announces its disabled state, so the dead fill is never the only channel carrying it', () => {
    const tree = render(<PrimaryAction label="Get started" disabled onPress={jest.fn()} />);
    expect(findProp(tree.toJSON(), 'accessibilityState')).toEqual({ disabled: true });
  });

  it('swaps the label for a spinner while busy, but keeps the accessible name', () => {
    const tree = render(<PrimaryAction label="Sign in" busy onPress={jest.fn()} />);

    // No visible label...
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
    // ...but the control is still "Sign in" to a screen reader. A spinner with no accessible name
    // is an unlabelled button, which is the bug this shape is easy to write by accident.
    expect(findProp(tree.toJSON(), 'accessibilityLabel')).toBe('Sign in');
  });
});

describe('SecondaryAction', () => {
  it('never carries the signal — that is the whole point of it being secondary', () => {
    const tree = render(<SecondaryAction label="Sign in with Google" onPress={jest.fn()} />);
    expect(JSON.stringify(tree.toJSON())).not.toContain(Accent.signal);
    expect(styleOf(tree.toJSON()).borderColor).toBe(Colors.light.text.primary);
  });

  it('takes light ink on an inverse slab, where the ordinary border would be invisible', () => {
    const tree = render(
      <SecondaryAction label="Choose Pro" tone="onInverse" onPress={jest.fn()} />
    );
    expect(styleOf(tree.toJSON()).borderColor).toBe(Colors.light.text.onInverse);
  });
});

describe('ActionDivider and LinkAction', () => {
  it('render their copy', () => {
    expect(JSON.stringify(render(<ActionDivider />).toJSON())).toContain('OR');
    const link = render(<LinkAction onPress={jest.fn()}>Already have an account?</LinkAction>);
    expect(JSON.stringify(link.toJSON())).toContain('Already have an account?');
  });
});

describe('PulseTraceSlot', () => {
  it('paints its own dark field and draws the trace in the signal colour', () => {
    // The field is deliberately NOT scheme-resolved: the bold moment looks the same in light and
    // dark mode, which is what makes it read as a signature rather than as a themed decoration.
    const tree = render(<PulseTraceSlot />);

    expect(styleOf(tree.toJSON()).backgroundColor).toBe(Accent.field);
    // `react-native-svg` resolves a stroke to a processed colour payload rather than keeping the
    // hex, so the expectation is processed the same way instead of hard-coding the integer.
    expect(findProp(tree.toJSON(), 'stroke')).toEqual({
      type: 0,
      payload: processColor(Accent.signal),
    });
  });

  it('renders the copy laid over the field', () => {
    const tree = render(
      <PulseTraceSlot size="band">
        <Text>PACE BLUEPRINT</Text>
      </PulseTraceSlot>
    );
    expect(JSON.stringify(tree.toJSON())).toContain('PACE BLUEPRINT');
  });

  it('settles immediately when nothing drives it, so a gated CTA is never stranded', () => {
    // The placeholder has no draw to wait for, and the real `<PulseTraceHero>` behaves the same
    // way under reduced motion. Onboarding gates "Get started" on this callback, so a slot that
    // never raised it would leave the only forward action permanently disabled.
    const onSettled = jest.fn();
    render(<PulseTraceSlot onSettled={onSettled} />);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('does not self-settle when a caller drives it — the runner owns that timeline', () => {
    const onSettled = jest.fn();
    const progress = { value: 0 } as { value: number };
    render(<PulseTraceSlot progress={progress as never} onSettled={onSettled} />);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
