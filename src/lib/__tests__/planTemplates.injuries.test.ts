/**
 * Regression coverage for the plan-accuracy scout's Bug 1 ("`intake.injuries` is never read by
 * the plan engine") and mandated finding B (the `plantar_arch` closed-set gap). The scout's own
 * A/B proof showed every injury combination producing a byte-identical plan to `['none']`; these
 * tests invert that proof — non-`none` injuries must actually change the generated plan.
 *
 * Captain rulings applied here (2026-08-03, see `docs/reference/coaching/plan-structure.md`):
 * Ruling 1 — a red-flag injury produces a normal, volume-adjusted plan (same mechanism as any
 * other flag), not a separate return-to-running protocol. Ruling 2 — add a dedicated
 * `plantar_arch` flag.
 */
import { buildTemplatePlan } from '../planTemplates';
import type { TemplatePlanParams } from '../planTemplates';
import type { InjuryFlag, IntakeResponses, Plan } from '../planTypes';

// Mirrors the scout's locked repro intake: age 16, "experienced" -> intermediate, 4 days/week,
// 27 km/week, 12-week 5K goal — the golden-fixture path (`useGoldenFiveKShape`).
const BASE_INTAKE: IntakeResponses = {
  goal: 'Run a fast 5K',
  age: 16,
  experience: 'experienced',
  daysPerWeek: 4,
  weeklyKm: 27,
  raceDistance: '5k',
  raceDate: '2026-10-26',
  recentPerformance: { distance: '5k', timeSec: 1350 },
  injuries: ['none'],
};

function goldenPlanWithInjuries(injuries: InjuryFlag[]): Plan {
  const intake: IntakeResponses = { ...BASE_INTAKE, injuries };
  const params: TemplatePlanParams = {
    intake,
    goalType: 'race',
    durationWeeks: 12,
    raceDistance: '5k',
    raceDate: intake.raceDate,
    tierAtGeneration: 'free',
    density: 'free',
  };
  return buildTemplatePlan(params);
}

// A generic-path plan (not the golden 5K/12wk/4-day shape) — Bug 3 in the same scout report was
// specific to the golden path silently not receiving a shared parameter, so injury wiring is
// checked on both paths, not just the golden one.
function genericPlanWithInjuries(injuries: InjuryFlag[]): Plan {
  const intake: IntakeResponses = {
    ...BASE_INTAKE,
    daysPerWeek: 5,
    weeklyKm: 30,
    raceDistance: '10k',
    injuries,
  };
  const params: TemplatePlanParams = {
    intake,
    goalType: 'race',
    durationWeeks: 16,
    raceDistance: '10k',
    raceDate: intake.raceDate,
    tierAtGeneration: 'free',
    density: 'free',
  };
  return buildTemplatePlan(params);
}

describe('intake.injuries drives plan generation (Bug 1)', () => {
  it('produces a different plan for a declared injury than for none — inverts the scout\'s all-identical A/B', () => {
    const none = goldenPlanWithInjuries(['none']);
    const knee = goldenPlanWithInjuries(['knee']);
    expect(JSON.stringify(knee)).not.toEqual(JSON.stringify(none));
  });

  // Week-1 `volumeKm` is the runner-visible sum of that week's actual sessions, not the raw
  // target: the long run still passes through `clampLongRun`'s share-of-week ceiling (a
  // fractional cap, e.g. 0.32 * weeklyKm), so the assembled total lands close to, not always
  // exactly at, `desiredVolumeKm * (1 - reductionPct)`. Assert the reduction ratio with a tight
  // but rounding-tolerant band rather than a brittle exact-km figure.
  function reductionRatio(none: Plan, injured: Plan): number {
    return 1 - injured.weeks[0].volumeKm / none.weeks[0].volumeKm;
  }

  it('cuts week-1 volume by ~15% for a knee injury (injury_flags.md:29, load_rules.md:206)', () => {
    const none = goldenPlanWithInjuries(['none']);
    const knee = goldenPlanWithInjuries(['knee']);
    expect(none.weeks[0].volumeKm).toBeCloseTo(26, 0); // round(34 * 27/35)
    expect(reductionRatio(none, knee)).toBeCloseTo(0.15, 1);
  });

  it('cuts week-1 volume by ~15% for shin splints (injury_flags.md:49, load_rules.md:217)', () => {
    const none = goldenPlanWithInjuries(['none']);
    const shin = goldenPlanWithInjuries(['shin_splints']);
    expect(reductionRatio(none, shin)).toBeCloseTo(0.15, 1);
  });

  it('applies the new plantar_arch flag\'s ~20% cut (Ruling 2; injury_flags.md:69)', () => {
    const none = goldenPlanWithInjuries(['none']);
    const plantar = goldenPlanWithInjuries(['plantar_arch']);
    expect(reductionRatio(none, plantar)).toBeCloseTo(0.2, 1);
  });

  it('only reduces week 1 — later weeks ramp off the reduced week-1 volume, not off the un-reduced target', () => {
    const none = goldenPlanWithInjuries(['none']);
    const knee = goldenPlanWithInjuries(['knee']);
    expect(knee.weeks[1].volumeKm).not.toBeCloseTo(none.weeks[1].volumeKm * 0.85, 0);
    // Week 2 is unclamped growth off week 1's actual (reduced) volume, not a second injury cut.
    expect(knee.weeks[1].volumeKm).toBeGreaterThan(knee.weeks[0].volumeKm);
  });

  it('combines multiple declared injuries at the most conservative (largest) reduction, not additively', () => {
    const none = goldenPlanWithInjuries(['none']);
    const combined = goldenPlanWithInjuries(['knee', 'plantar_arch']);
    expect(reductionRatio(none, combined)).toBeCloseTo(0.2, 1); // max(15%, 20%) = 20%, not 35%
  });

  it('also drives the generic (non-golden) plan-building path, not just the golden 5K shape', () => {
    const none = genericPlanWithInjuries(['none']);
    const knee = genericPlanWithInjuries(['knee']);
    expect(none.weeks[0].volumeKm).toBe(29); // round(34 * 30/35)
    expect(knee.weeks[0].volumeKm).toBe(25); // round(29 * 0.85)
  });
});

describe('Rule 10 injury disclaimer', () => {
  const RULE_10_INJURY_DISCLAIMER =
    'If you are experiencing significant pain, swelling, or symptoms that concern you, please ' +
    'seek assessment from a qualified sports medicine professional or physiotherapist before ' +
    'continuing training.';

  it('does not appear when injuries is ["none"]', () => {
    const plan = goldenPlanWithInjuries(['none']);
    expect(plan.disclaimers).not.toContain(RULE_10_INJURY_DISCLAIMER);
    // general + under-18 — BASE_INTAKE's age (16) is a real under-18 fixture, not incidental,
    // so it now also carries the youth disclaimer (captain-approved youth policy §6-A/E).
    expect(plan.disclaimers.length).toBe(2);
  });

  it('appears verbatim whenever injuries is not ["none"]', () => {
    const plan = goldenPlanWithInjuries(['hip_glute']);
    expect(plan.disclaimers).toContain(RULE_10_INJURY_DISCLAIMER);
  });

  it('still carries the general disclaimer alongside the injury one', () => {
    const plan = goldenPlanWithInjuries(['lower_back']);
    expect(plan.disclaimers.length).toBe(3); // general + under-18 + injury
  });
});

describe('red-flag injury (Ruling 1) — normal volume-adjusted plan, not a return-to-running protocol', () => {
  it('produces the same plan shape (phases, deload cadence, week count) as a non-red-flag injury at the same reduction tier', () => {
    // ankle_achilles and hip_glute share the same 20% fallback tier (loadRules.ts); only the
    // disclaimer set should differ between them, never the plan's structure.
    const redFlag = goldenPlanWithInjuries(['ankle_achilles']);
    const ordinary = goldenPlanWithInjuries(['hip_glute']);
    expect(redFlag.weeks.map((w) => w.phase)).toEqual(ordinary.weeks.map((w) => w.phase));
    expect(redFlag.weeks.map((w) => w.isDeload)).toEqual(ordinary.weeks.map((w) => w.isDeload));
    expect(redFlag.weeklyLoad).toEqual(ordinary.weeklyLoad);
    expect(redFlag.durationWeeks).toBe(ordinary.durationWeeks);
    expect(redFlag.engine).toBe('template');
    expect(redFlag.extras).toEqual([]);
  });

  it('carries the strengthened professional-evaluation disclaimer in addition to the standard injury disclaimer', () => {
    const redFlag = goldenPlanWithInjuries(['ankle_achilles']);
    const ordinary = goldenPlanWithInjuries(['hip_glute']);
    expect(redFlag.disclaimers.length).toBe(4); // general + under-18 + injury + strengthened
    expect(ordinary.disclaimers.length).toBe(3); // general + under-18 + injury only
    const strengthened = redFlag.disclaimers.find(
      (d) =>
        d !== ordinary.disclaimers[0] &&
        d !== ordinary.disclaimers[1] &&
        d !== ordinary.disclaimers[2],
    );
    expect(strengthened).toBeDefined();
    expect(strengthened).toMatch(/professional|physiotherapist/i);
  });
});
