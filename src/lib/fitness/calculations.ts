import type { Gender, WorkoutSet, Exercise, Experience } from '@/types';
import { clamp, round, sumBy } from '@/lib/utils';

/* ---------------- Strength ---------------- */

/**
 * Estimated one-rep max.
 * Epley for higher reps, Brzycki blended in at low reps where it is more
 * accurate. Both formulas degrade past ~12 reps, so we cap the input.
 * Returns null rather than guessing when there is nothing to compute from.
 */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round(weightKg, 1);
  const r = Math.min(reps, 12);
  const epley = weightKg * (1 + r / 30);
  const brzycki = weightKg * (36 / (37 - r));
  const blend = r <= 5 ? 0.35 : 0.5; // weight toward Brzycki in low-rep ranges
  return round(epley * (1 - blend) + brzycki * blend, 1);
}

/** Load that should allow `reps` repetitions given a 1RM. Inverse of Epley. */
export function weightForReps(oneRM: number, reps: number): number {
  if (oneRM <= 0 || reps <= 0) return 0;
  return round(oneRM / (1 + Math.min(reps, 12) / 30), 1);
}

/** Percentage of 1RM commonly associated with a rep count. */
export function percentOf1RM(reps: number): number {
  const table: Record<number, number> = {
    1: 100, 2: 95, 3: 92, 4: 89, 5: 86, 6: 83, 7: 81,
    8: 78, 9: 76, 10: 74, 11: 71, 12: 69, 15: 65, 20: 60,
  };
  if (table[reps]) return table[reps];
  return clamp(round(100 - reps * 2.6, 0), 50, 100);
}

/** Tonnage: sum of weight x reps across working sets. Bodyweight moves score 0 load. */
export function sessionVolume(sets: WorkoutSet[]): number {
  return round(
    sumBy(sets.filter((s) => s.completed && !s.is_warmup), (s) =>
      s.weight_kg && s.reps ? s.weight_kg * s.reps : 0,
    ),
    0,
  );
}

export function totalReps(sets: WorkoutSet[]): number {
  return sumBy(sets.filter((s) => s.completed && !s.is_warmup), (s) => s.reps ?? 0);
}

export function workingSetCount(sets: WorkoutSet[]): number {
  return sets.filter((s) => s.completed && !s.is_warmup).length;
}

/* ---------------- Body metrics ---------------- */

export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

/**
 * Broad BMI band. Deliberately non-diagnostic wording — BMI ignores muscle
 * mass and is a poor individual indicator, which the UI states alongside it.
 */
export function bmiBand(value: number | null): { label: string; tone: 'info' | 'success' | 'warn' } | null {
  if (value === null) return null;
  if (value < 18.5) return { label: 'Below typical range', tone: 'info' };
  if (value < 25) return { label: 'Typical range', tone: 'success' };
  if (value < 30) return { label: 'Above typical range', tone: 'warn' };
  return { label: 'Well above typical range', tone: 'warn' };
}

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function bmr(weightKg: number | null, heightCm: number | null, age: number | null, gender: Gender): number | null {
  if (!weightKg || !heightCm || age === null) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // Non-binary / undisclosed uses the midpoint of the two coefficients rather
  // than forcing a value the user did not give.
  const offset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  return Math.round(base + offset);
}

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

/** Maps weekly training days onto an activity multiplier. */
export function activityLevelFromDays(daysPerWeek: number): ActivityLevel {
  if (daysPerWeek <= 1) return 'sedentary';
  if (daysPerWeek <= 2) return 'light';
  if (daysPerWeek <= 4) return 'moderate';
  if (daysPerWeek <= 6) return 'active';
  return 'very_active';
}

export function tdee(bmrValue: number | null, level: ActivityLevel): number | null {
  if (bmrValue === null) return null;
  return Math.round(bmrValue * ACTIVITY_FACTORS[level]);
}

/* ---------------- Energy estimates ----------------
   Every calorie number in FitHub is an estimate and is labelled as one in
   the UI. MET-based estimation needs body weight; without it we return null
   rather than inventing a figure. */

export function estimateCalories(met: number, weightKg: number | null, seconds: number): number | null {
  if (!weightKg || weightKg <= 0 || seconds <= 0) return null;
  const hours = seconds / 3600;
  return Math.round(met * weightKg * hours);
}

/** Blended estimate for a mixed session from its exercises' MET values. */
export function estimateSessionCalories(
  entries: Array<{ exercise: Exercise | undefined; seconds: number }>,
  weightKg: number | null,
): number | null {
  if (!weightKg || weightKg <= 0) return null;
  let kcal = 0;
  let counted = 0;
  for (const e of entries) {
    if (!e.exercise || e.seconds <= 0) continue;
    kcal += (e.exercise.met * weightKg * e.seconds) / 3600;
    counted += e.seconds;
  }
  if (!counted) return null;
  return Math.round(kcal);
}

/* ---------------- Cardio ---------------- */

/** Seconds per kilometre. */
export function paceSecPerKm(distanceKm: number | null, seconds: number | null): number | null {
  if (!distanceKm || !seconds || distanceKm <= 0) return null;
  return Math.round(seconds / distanceKm);
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/** Karvonen target heart-rate zone. Presented as general guidance only. */
export function heartRateZones(age: number | null, restingHr: number | null) {
  if (age === null) return null;
  const max = 208 - 0.7 * age; // Tanaka; more accurate than 220-age
  const reserve = restingHr ? max - restingHr : max;
  const at = (frac: number) => Math.round((restingHr ?? 0) + reserve * frac);
  return {
    max: Math.round(max),
    zones: [
      { name: 'Very light', range: [at(0.5), at(0.6)] as [number, number], purpose: 'Warm-up & recovery' },
      { name: 'Light', range: [at(0.6), at(0.7)] as [number, number], purpose: 'Base endurance' },
      { name: 'Moderate', range: [at(0.7), at(0.8)] as [number, number], purpose: 'Aerobic capacity' },
      { name: 'Hard', range: [at(0.8), at(0.9)] as [number, number], purpose: 'Anaerobic threshold' },
      { name: 'Maximum', range: [at(0.9), at(1)] as [number, number], purpose: 'Short intervals' },
    ],
  };
}

/* ---------------- Training prescription ---------------- */

export interface RepScheme {
  sets: number;
  reps: number;
  restSeconds: number;
  intensityNote: string;
}

/** Rep/set/rest prescription for a goal + experience + movement type. */
export function repScheme(
  goal: 'lose_fat' | 'build_muscle' | 'gain_strength' | 'improve_endurance' | 'general_fitness' | 'mobility' | 'maintain',
  experience: Experience,
  mechanic: 'compound' | 'isolation',
): RepScheme {
  const base: Record<string, RepScheme> = {
    gain_strength: { sets: 4, reps: 5, restSeconds: 180, intensityNote: 'Heavy — leave 2 reps in reserve' },
    build_muscle: { sets: 4, reps: 10, restSeconds: 90, intensityNote: 'Challenging — 1–3 reps in reserve' },
    lose_fat: { sets: 3, reps: 12, restSeconds: 60, intensityNote: 'Moderate load, short rest' },
    improve_endurance: { sets: 3, reps: 15, restSeconds: 45, intensityNote: 'Light load, controlled tempo' },
    general_fitness: { sets: 3, reps: 10, restSeconds: 75, intensityNote: 'Comfortable but challenging' },
    mobility: { sets: 2, reps: 12, restSeconds: 45, intensityNote: 'Slow, full range of motion' },
    maintain: { sets: 3, reps: 8, restSeconds: 90, intensityNote: 'Steady effort' },
  };
  const scheme = { ...(base[goal] ?? base.general_fitness) };

  if (experience === 'beginner') {
    scheme.sets = Math.max(2, scheme.sets - 1);
    scheme.reps = clamp(scheme.reps + 2, 5, 15);
    scheme.restSeconds = Math.min(scheme.restSeconds + 15, 180);
  } else if (experience === 'advanced') {
    scheme.sets = Math.min(scheme.sets + 1, 5);
  }

  if (mechanic === 'isolation') {
    scheme.reps = clamp(scheme.reps + 3, 8, 20);
    scheme.restSeconds = Math.max(45, scheme.restSeconds - 45);
    scheme.sets = Math.max(2, scheme.sets - 1);
  }
  return scheme;
}

/** Weekly hard-set target per muscle group — the evidence-backed 10–20 band. */
export function weeklySetTarget(experience: Experience): { min: number; max: number } {
  if (experience === 'beginner') return { min: 8, max: 12 };
  if (experience === 'advanced') return { min: 14, max: 22 };
  return { min: 10, max: 18 };
}
