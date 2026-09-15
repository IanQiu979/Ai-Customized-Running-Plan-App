/**
 * Recovery ("deload") weeks on the golden 12-week / 4-day / 5K path — core-purpose audit §1.3.
 *
 * The audit's finding (2026-09-06, deliberately left open by the §1.2/§1.4 task): most golden
 * profiles carried weeks flagged `isDeload` that were not reductions at all. The golden path had
 * exactly one byte-pinned fixture (`planTemplates.golden.test.ts`, the 25-year-old / 35 km
 * intermediate) and no property over the other intakes it serves, which is how a flagged week
 * that went *up* by half against the preceding loading week survived every gate.
 *
 * The cause was two independent computations that never consulted each other:
 * `buildCanonicalFiveKWeek` set `isDeload` from the runner's recovery cadence (every 3 weeks for
 * advanced runners, 4 otherwise, 4/8/12 for 50+) but read the week's volume from
 * `FIVE_K_WEEKLY_LOAD` by array position, whose authored dips sit at weeks 4 and 8 only. A 3-week
 * cadence therefore flagged 3/6/9 while the dips fell on unflagged 4/8, which then became the
 * growth base — the same defect the generic path fixed with its de-dipped curve.
 *
 * The fix (captain's `golden-cadence3-route` ruling, option A, 2026-09-16): the coach-authored
 * curve serves only a runner whose cadence lands on its dips — the 4-week cadence, or the 50+
 * ruling's 4/8/12 — and the under-50 advanced runner is built by `buildGenericWeek`, which keeps
 * the 3/6/9 pro cadence and sizes each rest week inside the band. Nothing was invented for the
 * curve at weeks 3/6/9. That profile is kept in this sweep on purpose: it is the one the fix
 * reroutes, so it is the one that proves the reroute.
 *
 * What this suite pins, for every 12-week / 4-day / 5K intake the golden shape admits:
 * 1. every flagged week that is not the race week has a preceding loading week and is a real
 *    reduction against it;
 * 2. that reduction sits inside the captain's 15–25% band (`loadRules.ts`'s
 *    `DELOAD_REDUCTION_MIN`/`_MAX`, ruled 2026-09-06), with a 1 km allowance for whole-km
 *    rendering;
 * 3. the one ruled exception: `FIVE_K_WEEKLY_LOAD`'s own weeks 4 and 8 stay exactly as Ian
 *    authored them (`[key=golden-deloads-outside-new-band]`, 2026-09-08, `docs/change_log.md`).
 *    Those dips are ~39.5% / ~37.5%, deeper than the band. For a flagged week that reads an
 *    authored dip, the assertion is therefore "no shallower than the band's floor, no deeper than
 *    the authored dip" — still a reduction with two hard edges, not an exemption.
 *
 * Race week (week 12) is flagged `isDeload` for 50+ runners by the 2026-08-06 ruling
 * (`fifty-plus-golden-deload-weeks`). Its volume includes the race day itself, so "reduction
 * against the taper week" is not a property the ruling asked of it; it is measured separately
 * below rather than folded into the band.
 */

import { buildTemplatePlan } from '../planTemplates';
import { DELOAD_REDUCTION_MAX, DELOAD_REDUCTION_MIN } from '../loadRules';
import type { ExperienceAnswer, IntakeResponses, Plan, Week } from '../planTypes';

/**
 * The same eight intakes `planTemplates.longRunCap.test.ts` sweeps the golden shape with: every
 * level, both age bands, and the volume range the path is reached with. Kept in step by hand.
 * The 30-year-old competitive runner is served by the generic builder (see the header).
 */
interface GoldenProfile {
  name: string;
  experience: ExperienceAnswer;
  age: number;
  weeklyKm: number;
}

const GOLDEN_PROFILES: GoldenProfile[] = [
  { name: 'beginner — brand new, 12 km/wk, 30 y/o', experience: 'new', age: 30, weeklyKm: 12 },
  { name: 'beginner — brand new, 20 km/wk, 16 y/o', experience: 'new', age: 16, weeklyKm: 20 },
  { name: 'beginner — some experience, 30 km/wk, 55 y/o', experience: 'some', age: 55, weeklyKm: 30 },
  { name: 'intermediate — regular, 35 km/wk, 30 y/o', experience: 'regular', age: 30, weeklyKm: 35 },
  { name: 'intermediate — experienced, 27 km/wk, 16 y/o', experience: 'experienced', age: 16, weeklyKm: 27 },
  { name: 'intermediate — experienced, 45 km/wk, 55 y/o', experience: 'experienced', age: 55, weeklyKm: 45 },
  { name: 'advanced — competitive, 60 km/wk, 30 y/o (generic path since 2026-09-16)', experience: 'competitive', age: 30, weeklyKm: 60 },
  { name: 'advanced — competitive, 80 km/wk, 55 y/o', experience: 'competitive', age: 55, weeklyKm: 80 },
];

/**
 * `FIVE_K_WEEKLY_LOAD`'s authored recovery weeks and their depth against the preceding loading
 * week: 38 → 23 km (week 4) and 48 → 30 km (week 8), from `example-plan-5k-pro.md`. The deepest
 * of the two is the ceiling the ruled exception permits.
 */
const AUTHORED_DIP_WEEKS = [4, 8] as const;
const AUTHORED_DIP_MAX_REDUCTION = Math.max(1 - 23 / 38, 1 - 30 / 48);

function buildGoldenPlanFor(profile: GoldenProfile): Plan {
  const intake: IntakeResponses = {
    goal: 'Run a fast 5K',
    age: profile.age,
    experience: profile.experience,
    daysPerWeek: 4,
    weeklyKm: profile.weeklyKm,
    raceDistance: '5k',
    recentPerformance: { distance: '5k', timeSec: 1516 },
    injuries: ['none'],
  };
  return buildTemplatePlan({
    intake,
    goalType: 'race',
    durationWeeks: 12,
    raceDistance: '5k',
    tierAtGeneration: 'pro',
    density: 'paid',
  });
}

/** Every (preceding loading week → flagged week) pair, race week excluded. */
function deloadPairs(plan: Plan): { loading: Week | undefined; rest: Week }[] {
  const pairs: { loading: Week | undefined; rest: Week }[] = [];
  let loading: Week | undefined;
  for (const week of plan.weeks) {
    const isRaceWeek = week.weekNumber === plan.durationWeeks;
    if (week.isDeload) {
      if (!isRaceWeek) pairs.push({ loading, rest: week });
    } else {
      loading = week;
    }
  }
  return pairs;
}

const CASES = GOLDEN_PROFILES.map((profile) => [profile.name, profile] as const);

describe('golden 5K path — every flagged deload week is a real reduction inside the ruled band', () => {
  it.each(CASES)('%s has a preceding loading week for every flagged week', (_name, profile) => {
    const plan = buildGoldenPlanFor(profile);
    const pairs = deloadPairs(plan);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { loading, rest } of pairs) {
      expect(loading).toBeDefined();
      expect(rest.weekNumber).toBeGreaterThan(loading?.weekNumber ?? Infinity);
    }
  });

  it.each(CASES)('%s reduces volume on every flagged week', (_name, profile) => {
    const plan = buildGoldenPlanFor(profile);
    const breaches = deloadPairs(plan)
      .filter(({ loading, rest }) => loading !== undefined && rest.volumeKm >= loading.volumeKm)
      .map(
        ({ loading, rest }) =>
          `week ${rest.weekNumber}: ${rest.volumeKm} km is not below loading week ${loading?.weekNumber}'s ${loading?.volumeKm} km`,
      );
    expect(breaches).toEqual([]);
  });

  it.each(CASES)(
    '%s lands every flagged week inside 15–25% (or, on an authored dip, between the band floor and the authored depth)',
    (_name, profile) => {
      const plan = buildGoldenPlanFor(profile);
      const breaches: string[] = [];
      for (const { loading, rest } of deloadPairs(plan)) {
        if (!loading) continue;
        const authoredDip = (AUTHORED_DIP_WEEKS as readonly number[]).includes(rest.weekNumber);
        const maxReduction = authoredDip ? AUTHORED_DIP_MAX_REDUCTION : DELOAD_REDUCTION_MAX;
        // Whole-kilometre rendering: 1 km of allowance on each edge, as the generic suite gives.
        const floorKm = (1 - maxReduction) * loading.volumeKm - 1;
        const ceilingKm = (1 - DELOAD_REDUCTION_MIN) * loading.volumeKm + 1;
        if (rest.volumeKm < floorKm || rest.volumeKm > ceilingKm) {
          const pct = ((1 - rest.volumeKm / loading.volumeKm) * 100).toFixed(0);
          breaches.push(
            `week ${rest.weekNumber}: ${rest.volumeKm} km is a ${pct}% cut from ${loading.volumeKm} km ` +
              `(allowed ${floorKm.toFixed(1)}–${ceilingKm.toFixed(1)} km${authoredDip ? ', authored dip' : ''})`,
          );
        }
      }
      expect(breaches).toEqual([]);
    },
  );

  it.each(CASES)('%s never grows the long run into a flagged week', (_name, profile) => {
    const plan = buildGoldenPlanFor(profile);
    const longRunKm = (week: Week) =>
      week.days.reduce(
        (max, day) => (day.kind === 'run' && day.isLongRun ? Math.max(max, day.distanceKm ?? 0) : max),
        0,
      );
    for (const { loading, rest } of deloadPairs(plan)) {
      if (!loading) continue;
      expect(longRunKm(rest)).toBeLessThanOrEqual(longRunKm(loading));
    }
  });
});
