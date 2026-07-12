import { Effort, EffortOrder } from '../../constants/theme';
import { EFFORT_LEVELS, EFFORT_ORDINAL } from '../planTypes';

/**
 * Guards `theme.ts`'s effort-scale derivation (issue #32 finding 7). `Effort[level].barHeight` is
 * computed as `0.4 + 0.15 × EFFORT_ORDINAL[level]` rather than hand-written per level, so the
 * ribbon's bar heights cannot silently drift from `planTypes.ts` — the module the edge function
 * shares — the way they could when both files carried their own copy of the scale.
 *
 * Note what is *not* worth asserting: that the derived heights rise with the ordinal. They do so
 * by construction, for any ordinals, so such a test passes even against a scrambled scale. The
 * assertions below are the two that can actually fail.
 */
describe('Effort.barHeight — frontend-design-brief.md Part 2 "The effort scale"', () => {
  it('matches the documented ramp exactly: recovery .4, easy .55, steady .7, tempo .85, interval 1', () => {
    // Reorder `EFFORT_ORDINAL` and this fails: `steady` comes back 0.85, not 0.7.
    expect(Effort.recovery.barHeight).toBe(0.4);
    expect(Effort.easy.barHeight).toBe(0.55);
    expect(Effort.steady.barHeight).toBe(0.7);
    expect(Effort.tempo.barHeight).toBe(0.85);
    expect(Effort.interval.barHeight).toBe(1);
  });

  it('derives from a dense 0…4 ordinal — the shape the 0.4 + 0.15 × ordinal ramp assumes', () => {
    // The ramp is only bounded by 1 because the ordinals are exactly 0…4 with no gaps. Widen them
    // (0, 10, 20 …) and every bar above `easy` overflows its track without any other test noticing.
    const ordinals = EFFORT_LEVELS.map((level) => EFFORT_ORDINAL[level]);
    expect(ordinals).toEqual([0, 1, 2, 3, 4]);
  });

  it('renders in planTypes.ts EFFORT_LEVELS itself, not a second literal array that could drift', () => {
    // Referential identity, not deep equality — a copy-pasted literal would satisfy `toEqual`,
    // which is precisely the duplication this finding removed.
    expect(EffortOrder).toBe(EFFORT_LEVELS);
  });
});
