import { Accent, Colors, Effort, EffortOrder, type ColorScheme } from '../theme';

/**
 * The Instrument system's contrast table, executable.
 *
 * `CLAUDE.md` has always carried the rule "never edit a hex without re-verifying contrast", and
 * `theme.ts` has always carried the ratios as comments. Comments do not fail a build: issue #70
 * ("light-mode effort hexes have no contrast headroom, and dark `interval` is below 3:1") is
 * exactly what a documented-but-unenforced table produces after a few edits. This file recomputes
 * every ratio from the hexes themselves, so a value changed in `theme.ts` without re-running the
 * table fails here instead of shipping.
 *
 * The floors, from `docs/design/instrument-visual-system.md` §2:
 *   - text on the surface it sits on: >= 4.5:1 (WCAG AA)
 *   - meaningful non-text — the effort ramp, a control's boundary: >= 3:1
 *   - `progress.disabled`: deliberately BELOW 3:1. "You cannot use this" is what it means, so
 *     this is asserted as an upper bound, not a lower one.
 */

// --- WCAG 2.x relative luminance and contrast ratio -------------------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. Order-independent. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- CIE76 dE, for the one question contrast ratio cannot answer -------------------------------

/**
 * Contrast ratio is blind to hue: an icy-cyan `recovery` would pass every ratio assertion in this
 * file while being indistinguishable from `Accent.signal` at a glance. Distance in Lab is what
 * actually answers "could a runner mistake this bar for the highlight", so the signal-collision
 * rule is measured that way.
 */
function lab(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const SCHEMES: ColorScheme[] = ['light', 'dark'];

/** Every token in `theme.ts` is a 6-digit hex or an `rgba()` string; only the former is measurable
 * without compositing, and only the former is ever put on a surface as opaque colour. */
const isOpaqueHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);

describe('Instrument contrast — docs/design/instrument-visual-system.md §2', () => {
  describe.each(SCHEMES)('%s scheme', (scheme) => {
    const c = Colors[scheme];

    it('text.primary clears AA on both base and raised', () => {
      expect(ratio(c.text.primary, c.surface.base)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.text.primary, c.surface.raised)).toBeGreaterThanOrEqual(4.5);
    });

    it('text.secondary clears AA on both base and raised', () => {
      // `raised` is the binding constraint in both schemes, not `base`: the tab bar and every
      // card sit on it, so a value tuned only against the page is the failure mode this catches.
      expect(ratio(c.text.secondary, c.surface.raised)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.text.secondary, c.surface.base)).toBeGreaterThanOrEqual(4.5);
    });

    it('progress.informative clears AA on both base and raised', () => {
      expect(ratio(c.progress.informative, c.surface.base)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.progress.informative, c.surface.raised)).toBeGreaterThanOrEqual(4.5);
    });

    it('progress.disabled stays BELOW the non-text floor — it has to read as dead', () => {
      expect(ratio(c.progress.disabled, c.surface.base)).toBeLessThan(3);
    });

    it('a disabled control keeps a readable label despite the dead fill', () => {
      // `PrimaryAction` drops the signal when disabled and labels the inert slab in ordinary ink.
      // The fill is allowed to be invisible; the word on it is not.
      expect(ratio(c.text.primary, c.progress.disabled)).toBeGreaterThanOrEqual(4.5);
    });

    it('onInverse copy clears AA on the dark slab', () => {
      expect(ratio(c.text.onInverse, c.surface.inverse)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.text.onInverseMuted, c.surface.inverse)).toBeGreaterThanOrEqual(4.5);
    });

    it('status colours clear AA on both base and raised', () => {
      for (const status of [c.status.error, c.status.success]) {
        expect(ratio(status, c.surface.base)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(status, c.surface.raised)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('the load curve clears the non-text floor on both base and raised', () => {
      expect(ratio(c.chart.loadLine, c.surface.base)).toBeGreaterThanOrEqual(3);
      expect(ratio(c.chart.loadLine, c.surface.raised)).toBeGreaterThanOrEqual(3);
    });
  });

  describe('the accent — theme-invariant, and legible in both schemes', () => {
    it('the signal is the locked icy cyan, and the field the locked near-black', () => {
      // Both are duplicated in `constants/pulseTrace.ts` (`PulseTracePalette.trace` / `.field`),
      // which the onboarding animation owns. This pin is ONE-SIDED today: that file is not on
      // this branch, so it cannot be imported here, and these assertions catch a drift in
      // `theme.ts` only — an edit to `PulseTracePalette` would still ship two different cyans.
      // The pin becomes two-sided once `fm/v22-redesign-animation` lands and the palette can be
      // imported and asserted equal; see the swap checklist in `PulseTraceSlot.tsx`.
      expect(Accent.signal).toBe('#A8F0FF');
      expect(Accent.field).toBe('#0A0E13');
    });

    it('the signal is legible as a label on the field', () => {
      expect(ratio(Accent.signal, Accent.field)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(Accent.onField, Accent.field)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(Accent.onFieldMuted, Accent.field)).toBeGreaterThanOrEqual(4.5);
    });

    it('is why the signal is never a fill: it has no boundary on a light page', () => {
      // The measurement that shaped the whole two-tier accent. If this ever clears 3:1 the
      // constraint has changed and `PrimaryAction` could be reconsidered; until then, a cyan slab
      // in light mode is a button with no visible edge.
      expect(ratio(Accent.signal, Colors.light.surface.base)).toBeLessThan(3);
    });

    it('gives the primary action a boundary in BOTH schemes, through different channels', () => {
      // Light: the near-black slab itself separates the control from the page.
      expect(ratio(Accent.field, Colors.light.surface.base)).toBeGreaterThanOrEqual(3);
      expect(ratio(Accent.field, Colors.light.surface.raised)).toBeGreaterThanOrEqual(3);
      // Dark: the slab is invisible against the page — asserted, because that is the whole reason
      // the cyan edge exists and not an accident to be "fixed" later.
      expect(ratio(Accent.field, Colors.dark.surface.base)).toBeLessThan(3);
      // ...so the cyan edge is what carries it.
      expect(ratio(Accent.signal, Colors.dark.surface.base)).toBeGreaterThanOrEqual(3);
      expect(ratio(Accent.signal, Colors.dark.surface.raised)).toBeGreaterThanOrEqual(3);
    });

    it('shares one dark plane with surface.inverse, so a CTA on a pricing slab has no seam', () => {
      expect(Colors.light.surface.inverse).toBe(Accent.field);
    });
  });

  describe('the effort ramp', () => {
    it.each(SCHEMES)('%s: every level clears AA against its own base and raised', (scheme) => {
      for (const level of EffortOrder) {
        const hex = Effort[level][scheme];
        expect(ratio(hex, Colors[scheme].surface.base)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(hex, Colors[scheme].surface.raised)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(SCHEMES)('%s: no level is confusable with the signal', (scheme) => {
      // The floor is 25 dE. For reference the ramp's own tightest adjacent pair is 33.3 (light
      // recovery/easy) and the tightest value here is dark `recovery` at 28.3, so a hue that
      // fails this is closer to the highlight than the ramp's own steps are to each other.
      for (const level of EffortOrder) {
        expect(deltaE(Effort[level][scheme], Accent.signal)).toBeGreaterThanOrEqual(25);
      }
    });

    it.each(SCHEMES)('%s: adjacent levels stay distinguishable from each other', (scheme) => {
      for (let i = 1; i < EffortOrder.length; i += 1) {
        const previous = Effort[EffortOrder[i - 1]][scheme];
        const current = Effort[EffortOrder[i]][scheme];
        expect(deltaE(previous, current)).toBeGreaterThanOrEqual(25);
      }
    });
  });

  it('measures every opaque colour token — nothing was added without a floor', () => {
    // A guard on the guard: it is easy to add a token to `theme.ts` and never add an assertion
    // for it, at which point the table above silently stops being a table. This walks the whole
    // `Colors` tree and asserts the count of opaque hexes matches what is covered above, so a new
    // one fails here and has to be given a floor deliberately.
    const opaque = SCHEMES.flatMap((scheme) =>
      Object.values(Colors[scheme]).flatMap((group) =>
        typeof group === 'string'
          ? [group].filter(isOpaqueHex)
          : Object.values(group).filter(isOpaqueHex)
      )
    );
    // 12 per scheme: 3 surfaces (base/raised/inverse), 4 text, 2 progress, 2 status, 1 chart
    // line, and nothing else — `surface.overlay`, `hairline`, the whole `grid` group and
    // `chart.loadFill` are rgba, so they composite and are measured against what they sit on
    // rather than in isolation.
    expect(opaque).toHaveLength(24);
  });
});
