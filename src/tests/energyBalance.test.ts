import { describe, expect, it } from 'vitest';
import {
  BALANCE_META, currentWeightKg, energyVerdict, targetRateBand, weightSeries, weightTrend,
} from '@/lib/fitness/energyBalance';
import { addDays, today } from '@/lib/date';
import type { BodyMeasurement, GoalKind } from '@/types';

const at = (daysAgo: number, kg: number | null): BodyMeasurement => ({
  id: `m${daysAgo}`, user_id: 'u', date: addDays(today(), -daysAgo), weight_kg: kg,
  body_fat_pct: null, waist_cm: null, chest_cm: null, arm_cm: null,
  thigh_cm: null, hip_cm: null, neck_cm: null, note: '',
});

/** Weekly weigh-ins ending today, moving `perWeek` kg each week. */
const run = (startKg: number, perWeek: number, weeks = 4): BodyMeasurement[] =>
  Array.from({ length: weeks + 1 }, (_, i) => at((weeks - i) * 7, startKg + perWeek * i));

describe('weightSeries & currentWeightKg', () => {
  it('drops entries with no weight and sorts oldest first', () => {
    const s = weightSeries([at(0, 80), at(14, null), at(7, 81)]);
    expect(s).toHaveLength(2);
    expect(s[0].kg).toBe(81);
    expect(s[1].kg).toBe(80);
  });

  it('excludes weigh-ins older than the window', () => {
    expect(weightSeries([at(400, 90), at(2, 80)], 56)).toHaveLength(1);
  });

  it('prefers the latest weigh-in over the onboarding profile weight', () => {
    expect(currentWeightKg(run(90, -1), { weight_kg: 90 })).toBe(86);
  });

  it('falls back to the profile when nothing is logged', () => {
    expect(currentWeightKg([], { weight_kg: 74 })).toBe(74);
    expect(currentWeightKg([], null)).toBeNull();
  });
});

describe('weightTrend', () => {
  it('needs three weigh-ins across at least two weeks before it will call anything', () => {
    expect(weightTrend([at(20, 80), at(0, 79)])).toBeNull();
    expect(weightTrend([at(3, 80), at(1, 79.5), at(0, 79)])).toBeNull();
    expect(weightTrend(run(80, -0.5))).not.toBeNull();
  });

  it('measures the weekly rate', () => {
    const t = weightTrend(run(80, -0.5))!;
    expect(t.kgPerWeek).toBeCloseTo(-0.5, 1);
    expect(t.pctPerWeek).toBeLessThan(0);
    expect(t.latestKg).toBe(78);
  });

  it('is not derailed by one bad morning, the way first-vs-last would be', () => {
    const spiked = run(80, -0.5);
    spiked[spiked.length - 1] = at(0, 79.5); // 1.5 kg of water on the final weigh-in
    const t = weightTrend(spiked)!;

    // The underlying rate is -0.5 kg/week. Reading only the endpoints gives
    // -0.125; the fitted line stays far closer to the truth.
    const naive = ((spiked[spiked.length - 1].weight_kg! - spiked[0].weight_kg!) / 28) * 7;
    expect(Math.abs(t.kgPerWeek - -0.5)).toBeLessThan(Math.abs(naive - -0.5));
    expect(t.kgPerWeek).toBeLessThan(0);
  });
});

describe('targetRateBand', () => {
  it('points the scale down for fat loss and up for muscle', () => {
    expect(targetRateBand('lose_fat').high).toBeLessThan(0);
    expect(targetRateBand('build_muscle').low).toBeGreaterThan(0);
  });

  it('refuses to steer goals the scale does not measure', () => {
    for (const g of ['mobility', 'improve_endurance', 'general_fitness'] as GoalKind[]) {
      expect(targetRateBand(g).directional).toBe(false);
    }
  });
});

describe('energyVerdict', () => {
  it('stays quiet until there is enough data, and says what is missing', () => {
    const v = energyVerdict([at(10, 80), at(0, 79)], 'lose_fat', 2000);
    expect(v.status).toBe('not_enough_data');
    expect(v.suggestedCalories).toBeNull();
    expect(v.action).toBeTruthy();
  });

  it('never pushes calories on a goal the scale does not measure', () => {
    const v = energyVerdict(run(80, 0), 'mobility', 2200);
    expect(v.status).toBe('not_weight_driven');
    expect(v.deltaKcal).toBeNull();
  });

  it('leaves a working plan alone', () => {
    const v = energyVerdict(run(80, -0.6), 'lose_fat', 2000);
    expect(v.status).toBe('on_track');
    expect(v.suggestedCalories).toBeNull();
  });

  it('catches the stall that a stale deficit causes, and cuts', () => {
    const v = energyVerdict(run(80, 0), 'lose_fat', 2000);
    expect(v.status).toBe('too_slow');
    expect(v.deltaKcal).toBeLessThan(0);
    expect(v.suggestedCalories).toBeLessThan(2000);
  });

  it('slows a cut that is running too fast rather than cheering it on', () => {
    const v = energyVerdict(run(80, -1.4), 'lose_fat', 2000);
    expect(v.status).toBe('too_fast');
    expect(v.deltaKcal).toBeGreaterThan(0);
  });

  it('checks the logging before blaming metabolism when weight moves the wrong way', () => {
    const v = energyVerdict(run(80, 0.4), 'lose_fat', 2000);
    expect(v.status).toBe('wrong_way');
    expect(v.detail).toMatch(/logging/i);
  });

  it('adds a small surplus to a flat bulk, not a large one', () => {
    const v = energyVerdict(run(80, 0), 'build_muscle', 2800);
    expect(v.status).toBe('too_slow');
    expect(v.deltaKcal).toBeGreaterThan(0);
    expect(v.deltaKcal).toBeLessThanOrEqual(200);
  });

  it('reins in a gain that is outrunning what can be built', () => {
    expect(energyVerdict(run(80, 0.9), 'build_muscle', 2800).status).toBe('too_fast');
  });

  it('keeps every adjustment inside a sane single step', () => {
    for (const perWeek of [-3, -1.5, -0.5, 0, 0.5, 1.5, 3]) {
      for (const goal of ['lose_fat', 'build_muscle', 'maintain'] as GoalKind[]) {
        const v = energyVerdict(run(80, perWeek), goal, 2000);
        if (v.deltaKcal !== null) expect(Math.abs(v.deltaKcal)).toBeLessThanOrEqual(300);
        if (v.suggestedCalories !== null) expect(v.suggestedCalories).toBeGreaterThanOrEqual(1200);
      }
    }
  });

  it('never suggests a starvation target even from a very low starting point', () => {
    const v = energyVerdict(run(80, 0), 'lose_fat', 1250);
    expect(v.suggestedCalories).toBeGreaterThanOrEqual(1200);
  });

  it('always carries a headline, a detail and a labelled status', () => {
    for (const goal of ['lose_fat', 'build_muscle', 'maintain', 'mobility'] as GoalKind[]) {
      for (const ms of [[], run(80, 0), run(80, -0.6), run(80, 1)]) {
        const v = energyVerdict(ms, goal, 2000);
        expect(v.headline.length).toBeGreaterThan(5);
        expect(v.detail.length).toBeGreaterThan(20);
        expect(BALANCE_META[v.status].label).toBeTruthy();
      }
    }
  });
});
