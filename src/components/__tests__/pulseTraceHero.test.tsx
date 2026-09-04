import type { ReactElement } from 'react';
import { Text, type LayoutChangeEvent } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PulseTracePalette } from '@/constants/pulseTrace';

import { PulseTraceHero, usePulseTraceScroll } from '../brand/PulseTraceHero';

/**
 * A render smoke test for the pulse trace hero, in the spirit of `render.test.tsx`: it proves the
 * component mounts, measures, and emits real geometry, and it pins the few behaviours a caller
 * relies on — not the exact tree. A snapshot of an animation would make every tuning pass a test
 * edit, which is how a suite stops meaning anything.
 *
 * Reduced motion is forced on for most cases. That is not a shortcut: it is the mode in which the
 * component's output is fully deterministic (no running clock), so it is the only mode in which a
 * structural assertion can be made without pretending to know what frame the UI thread is on. The
 * one motion-on case checks that mounting with animations live neither throws nor leaves an
 * animation running after unmount.
 */

let mockReduceMotion = true;

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<typeof import('react-native-reanimated')>(
    'react-native-reanimated'
  );
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: () => mockReduceMotion,
    cancelAnimation: jest.fn(actual.cancelAnimation),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cancelAnimation } = require('react-native-reanimated') as { cancelAnimation: jest.Mock };

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

/** Fire every `onLayout` in the tree with a plausible measurement, outermost first. */
function layout(tree: ReactTestRenderer, width: number, height: number) {
  const measurable = tree.root.findAll(
    (node) => typeof (node.props as { onLayout?: unknown }).onLayout === 'function'
  );
  act(() => {
    for (const node of measurable) {
      (node.props as { onLayout: (event: unknown) => void }).onLayout({
        nativeEvent: { layout: { width, height, x: 0, y: 0 } },
      });
    }
  });
}

function collectProp(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return out;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  if (candidate.props && key in candidate.props) out.push(candidate.props[key]);
  for (const child of candidate.children ?? []) collectProp(child, key, out);
  return out;
}

/** A reveal pass: `strokeDasharray={total}`, which react-native-svg renders as `[total, total]`. */
function isRevealDash(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value[0] === value[1];
}

/** A lit pass (the trail or the sweep): a short lit dash and a long gap, so the pair is unequal. */
function isSweepDash(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value[0] !== value[1];
}

beforeEach(() => {
  mockReduceMotion = true;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PulseTraceHero', () => {
  it('renders both sizes before layout without emitting any geometry', () => {
    for (const size of ['cover', 'band'] as const) {
      const tree = render(<PulseTraceHero size={size} />);
      const json = JSON.stringify(tree.toJSON());
      expect(json).toBeTruthy();
      // Width is 0 until `onLayout` fires, so there is no `<Svg>` for the trace at all rather
      // than one with an empty `d`.
      expect(json).not.toContain('"d":');
      act(() => tree.unmount());
    }
  });

  it('draws the trace once measured: a moveto-lineto path, a baseline, and the head', () => {
    const tree = render(<PulseTraceHero />);
    layout(tree, 360, 256);

    const json = JSON.parse(JSON.stringify(tree.toJSON()));
    const paths = collectProp(json, 'd') as string[];
    // The bloom, the halo, and the core all draw the same path.
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const d of paths) {
      expect(d).toMatch(/^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+)+$/);
      expect(new Set(paths).size).toBe(1);
    }
    // Each reveal pass hides itself behind a dash exactly as long as the trace. react-native-svg
    // normalizes a scalar dasharray to a `[n, n]` pair in the rendered props.
    const dashes = collectProp(json, 'strokeDasharray').filter(isRevealDash);
    expect(dashes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(dashes.map((d) => d[0])).size).toBe(1);

    // Colours are normalized to platform ints by react-native-svg under Jest, so they are not
    // asserted here; the palette test below covers the one colour that survives as a string.
    act(() => tree.unmount());
  });

  it('paints its own dark field regardless of the surrounding scheme', () => {
    const tree = render(<PulseTraceHero />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(PulseTracePalette.field);
    act(() => tree.unmount());
  });

  it('does not render the ambient sweep under reduced motion', () => {
    const tree = render(<PulseTraceHero />);
    layout(tree, 360, 256);
    const json = JSON.parse(JSON.stringify(tree.toJSON()));
    // The trail and the sweep are the two passes whose dash pattern is not a `[total, total]`
    // pair. Under reduced motion only the trail remains — it is driven by the head, not a clock.
    const litDashes = collectProp(json, 'strokeDasharray').filter(isSweepDash);
    expect(litDashes).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('settles synchronously under reduced motion when self-drawing, and only once', () => {
    const onSettled = jest.fn();
    const tree = render(<PulseTraceHero onSettled={onSettled} />);
    layout(tree, 360, 256);
    // Before any timer runs: the reduced-motion branch settles in the layout effect itself, not
    // through the ceiling.
    expect(onSettled).toHaveBeenCalledTimes(1);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // The 0ms ceiling then finds it already settled and is a no-op.
    expect(onSettled).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does not start the settle ceiling until it has been measured', () => {
    // The draw starts on first layout; if the ceiling started on mount instead, a slow first
    // layout would let it fire while the head was still crossing the field.
    mockReduceMotion = false;
    const onSettled = jest.fn();
    const tree = render(<PulseTraceHero onSettled={onSettled} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(onSettled).not.toHaveBeenCalled();
    layout(tree, 360, 256);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('never settles in scroll-driven mode — the runner owns that timeline', () => {
    const onSettled = jest.fn();
    // A plain object stands in for the SharedValue; the component only reads `.value`.
    const progress = { value: 1 } as unknown as import('react-native-reanimated').SharedValue<number>;
    const tree = render(<PulseTraceHero progress={progress} onSettled={onSettled} />);
    layout(tree, 360, 256);
    act(() => {
      jest.runAllTimers();
    });
    expect(onSettled).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('renders copy over the field, outside the image element, so a screen reader reaches it', () => {
    const tree = render(
      <PulseTraceHero>
        <Text>Your training plan, built around you.</Text>
      </PulseTraceHero>
    );
    layout(tree, 360, 256);
    expect(JSON.stringify(tree.toJSON())).toContain('Your training plan, built around you.');

    // Exactly one image element, and the copy is not inside it: on iOS an `accessible` container
    // swallows its descendants, which is the defect this guards against. Host instances only —
    // `findAll` walks composites too, so a single `<View>` matches twice (`composite:View` and
    // the `host:View` it renders) and an unfiltered count would read as two elements.
    const images = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        (node.props as { accessibilityRole?: string }).accessibilityRole === 'image'
    );
    expect(images).toHaveLength(1);
    expect(images[0].findAllByType(Text)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('mounts with motion enabled, settles through the fallback ceiling, and cancels on unmount', () => {
    mockReduceMotion = false;
    const onSettled = jest.fn();
    const tree = render(<PulseTraceHero onSettled={onSettled} />);
    layout(tree, 360, 256);
    // The sweep is present now, alongside the trail.
    const json = JSON.parse(JSON.stringify(tree.toJSON()));
    expect(collectProp(json, 'strokeDasharray').filter(isSweepDash)).toHaveLength(2);
    // Under Jest no worklet completion callback will ever fire; the ceiling is what a real device
    // falls back to when the same happens there, and it must always resolve the gate.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    cancelAnimation.mockClear();
    act(() => tree.unmount());
    // Both owned shared values (the clock and the sweep) are cancelled on the way out.
    expect(cancelAnimation).toHaveBeenCalledTimes(2);
  });
});

describe('usePulseTraceScroll', () => {
  let scroll: ReturnType<typeof usePulseTraceScroll> | null = null;

  function Probe() {
    scroll = usePulseTraceScroll();
    return null;
  }

  function measure(viewportHeight: number, contentHeight: number) {
    act(() => {
      scroll!.onContentSizeChange(360, contentHeight);
      scroll!.onLayout({
        nativeEvent: { layout: { width: 360, height: viewportHeight, x: 0, y: 0 } },
      } as LayoutChangeEvent);
    });
  }

  beforeEach(() => {
    scroll = null;
  });

  it('resolves a page with nothing to scroll to a fully drawn trace', () => {
    const tree = render(<Probe />);
    // A page shorter than its viewport never emits an `onScroll`, so measurement is the only
    // signal there is: without it `progress` would sit at 0 and the field would stay blank.
    measure(800, 400);
    expect(scroll!.progress.value).toBe(1);
    act(() => tree.unmount());
  });

  it('re-derives when a short page later grows past its viewport', () => {
    const tree = render(<Probe />);
    measure(800, 400);
    expect(scroll!.progress.value).toBe(1);
    // Growing the content makes the page scrollable again, so the head belongs back at the top —
    // which only happens if the content-size path really recomputes rather than seeding once.
    act(() => scroll!.onContentSizeChange(360, 2400));
    expect(scroll!.progress.value).toBe(0);
    act(() => tree.unmount());
  });
});
