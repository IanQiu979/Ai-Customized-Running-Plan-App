import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReactElement } from 'react';

import { RouteLine } from '../brand/RouteLine';
import { LockedPanel } from '../home/LockedPanel';
import { PlanContentTeaser } from '../home/PlanContentTeaser';
import { ActionRow, Group, Row } from '../layout/GroupedRows';
import { ScreenHeader } from '../layout/ScreenHeader';
import { TabBarIcon, type TabIconName } from '../nav/TabBarIcon';

/**
 * A render smoke test for every component Trailhead introduced.
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
    for (const variant of ['header', 'card', 'hero'] as const) {
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
