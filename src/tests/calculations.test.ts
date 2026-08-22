import { describe, expect, it } from 'vitest';
import {
  estimate1RM, weightForReps, sessionVolume, totalReps, bmi, bmiBand, bmr, tdee,
  activityLevelFromDays, estimateCalories, paceSecPerKm, formatPace, repScheme,
  percentOf1RM, heartRateZones, workingSetCount,
} from '@/lib/fitness/calculations';
import type { WorkoutSet } from '@/types';

const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
  id: 's', session_id: 'sess', exercise_slug: 'barbell-bench-press', set_index: 0,
  weight_kg: null, reps: null, seconds: null, distance_km: null, rpe: null,
  completed: true, is_warmup: false, logged_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('estimate1RM', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it('scales up with reps', () => {
    const five = estimate1RM(100, 5)!;
    const ten = estimate1RM(100, 10)!;
    expect(five).toBeGreaterThan(100);
    expect(ten).toBeGreaterThan(five);
  });

  it('lands in the accepted range for a known case (100 kg x 5)', () => {
    // Epley 116.7, Brzycki 112.5 — a blend must sit between them.
    expect(estimate1RM(100, 5)).toBeGreaterThanOrEqual(112);
    expect(estimate1RM(100, 5)).toBeLessThanOrEqual(117);
  });

  it('caps the rep input so very high reps do not produce absurd maxima', () => {
    expect(estimate1RM(50, 30)).toEqual(estimate1RM(50, 12));
  });

  it('returns null for missing or nonsensical input', () => {
    expect(estimate1RM(null, 5)).toBeNull();
    expect(estimate1RM(100, null)).toBeNull();
    expect(estimate1RM(0, 5)).toBeNull();
    expect(estimate1RM(100, -3)).toBeNull();
  });
});

describe('weightForReps', () => {
  it('is roughly the inverse of the 1RM estimate', () => {
    const oneRM = 120;
    const w = weightForReps(oneRM, 8);
    expect(w).toBeGreaterThan(80);
    expect(w).toBeLessThan(oneRM);
  });
  it('handles zero safely', () => {
    expect(weightForReps(0, 5)).toBe(0);
    expect(weightForReps(100, 0)).toBe(0);
  });
});

describe('percentOf1RM', () => {
  it('is 100% at one rep and decreases monotonically', () => {
    expect(percentOf1RM(1)).toBe(100);
    expect(percentOf1RM(5)).toBeLessThan(percentOf1RM(3));
    expect(percentOf1RM(12)).toBeLessThan(percentOf1RM(10));
  });
});

describe('volume', () => {
  it('sums weight x reps across completed working sets', () => {
    const sets = [
      set({ weight_kg: 50, reps: 10 }),
      set({ weight_kg: 50, reps: 8 }),
      set({ weight_kg: 60, reps: 5 }),
    ];
    expect(sessionVolume(sets)).toBe(50 * 10 + 50 * 8 + 60 * 5);
  });

  it('excludes warm-ups and incomplete sets', () => {
    const sets = [
      set({ weight_kg: 50, reps: 10 }),
      set({ weight_kg: 20, reps: 10, is_warmup: true }),
      set({ weight_kg: 90, reps: 10, completed: false }),
    ];
    expect(sessionVolume(sets)).toBe(500);
    expect(workingSetCount(sets)).toBe(1);
  });

  it('scores bodyweight movements as zero load without crashing', () => {
    expect(sessionVolume([set({ weight_kg: null, reps: 20 })])).toBe(0);
    expect(totalReps([set({ weight_kg: null, reps: 20 })])).toBe(20);
  });
});

describe('body metrics', () => {
  it('computes BMI', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.7, 1);
    expect(bmi(null, 180)).toBeNull();
    expect(bmi(80, 0)).toBeNull();
  });

  it('bands BMI without diagnostic language', () => {
    expect(bmiBand(22)?.label).toBe('Typical range');
    expect(bmiBand(17)?.label).toBe('Below typical range');
    expect(bmiBand(27)?.tone).toBe('warn');
    expect(bmiBand(null)).toBeNull();
  });

  it('computes Mifflin-St Jeor BMR', () => {
    // 80 kg, 180 cm, 30 y, male => 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmr(80, 180, 30, 'male')).toBe(1780);
    // female offset -161
    expect(bmr(80, 180, 30, 'female')).toBe(1614);
    // undisclosed gender uses the midpoint rather than assuming
    const other = bmr(80, 180, 30, 'prefer_not_to_say')!;
    expect(other).toBeLessThan(1780);
    expect(other).toBeGreaterThan(1614);
  });

  it('returns null BMR when a required input is missing', () => {
    expect(bmr(null, 180, 30, 'male')).toBeNull();
    expect(bmr(80, 180, null, 'male')).toBeNull();
  });

  it('maps weekly training days to activity multipliers', () => {
    expect(activityLevelFromDays(1)).toBe('sedentary');
    expect(activityLevelFromDays(3)).toBe('moderate');
    expect(activityLevelFromDays(7)).toBe('very_active');
    expect(tdee(2000, 'moderate')).toBe(3100);
    expect(tdee(null, 'moderate')).toBeNull();
  });
});

describe('calorie estimates', () => {
  it('needs a bodyweight to produce a number', () => {
    expect(estimateCalories(8, null, 3600)).toBeNull();
    expect(estimateCalories(8, 0, 3600)).toBeNull();
  });
  it('uses the MET formula', () => {
    // 8 MET, 70 kg, 1 hour => 560 kcal
    expect(estimateCalories(8, 70, 3600)).toBe(560);
  });
});

describe('pace', () => {
  it('computes seconds per km and formats it', () => {
    expect(paceSecPerKm(5, 1500)).toBe(300);
    expect(formatPace(300)).toBe('5:00 /km');
    expect(formatPace(null)).toBe('—');
  });
  it('guards divide-by-zero', () => {
    expect(paceSecPerKm(0, 1500)).toBeNull();
    expect(paceSecPerKm(null, 1500)).toBeNull();
  });
});

describe('heartRateZones', () => {
  it('returns null without an age', () => {
    expect(heartRateZones(null, 60)).toBeNull();
  });
  it('produces five ascending zones', () => {
    const z = heartRateZones(30, 60)!;
    expect(z.zones).toHaveLength(5);
    expect(z.max).toBe(187);
    for (let i = 1; i < z.zones.length; i++) {
      expect(z.zones[i].range[0]).toBeGreaterThanOrEqual(z.zones[i - 1].range[0]);
    }
  });
});

describe('repScheme', () => {
  it('prescribes heavy low reps for strength and lighter high reps for endurance', () => {
    const strength = repScheme('gain_strength', 'intermediate', 'compound');
    const endurance = repScheme('improve_endurance', 'intermediate', 'compound');
    expect(strength.reps).toBeLessThan(endurance.reps);
    expect(strength.restSeconds).toBeGreaterThan(endurance.restSeconds);
  });

  it('reduces set count and adds rest for beginners', () => {
    const beginner = repScheme('build_muscle', 'beginner', 'compound');
    const intermediate = repScheme('build_muscle', 'intermediate', 'compound');
    expect(beginner.sets).toBeLessThan(intermediate.sets);
    expect(beginner.restSeconds).toBeGreaterThanOrEqual(intermediate.restSeconds);
  });

  it('gives isolation work higher reps and shorter rest than compounds', () => {
    const compound = repScheme('build_muscle', 'intermediate', 'compound');
    const isolation = repScheme('build_muscle', 'intermediate', 'isolation');
    expect(isolation.reps).toBeGreaterThan(compound.reps);
    expect(isolation.restSeconds).toBeLessThan(compound.restSeconds);
  });
});
