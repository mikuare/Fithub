import type { PersonalRecord, WorkoutSet, Exercise, ID } from '@/types';
import { estimate1RM } from './calculations';
import { uid } from '@/lib/id';
import { nowISO } from '@/lib/date';
import { round } from '@/lib/utils';

export interface RecordCandidate {
  exercise_slug: string;
  kind: PersonalRecord['kind'];
  value: number;
  unit: string;
  reps: number | null;
  weight_kg: number | null;
}

/**
 * Which records a set of logged sets could beat. Strength moves are judged on
 * heaviest load and estimated 1RM; timed moves on duration; cardio on distance.
 * Warm-up sets never count.
 */
export function candidatesFrom(sets: WorkoutSet[], exercise: Exercise): RecordCandidate[] {
  const working = sets.filter((s) => s.completed && !s.is_warmup);
  if (!working.length) return [];
  const out: RecordCandidate[] = [];

  if (exercise.type === 'strength') {
    let heaviest: WorkoutSet | null = null;
    let best1RM: { value: number; set: WorkoutSet } | null = null;
    let mostReps: WorkoutSet | null = null;
    for (const s of working) {
      if (s.weight_kg !== null && (!heaviest || s.weight_kg > (heaviest.weight_kg ?? 0))) heaviest = s;
      const e = estimate1RM(s.weight_kg, s.reps);
      if (e !== null && (!best1RM || e > best1RM.value)) best1RM = { value: e, set: s };
      if (s.reps !== null && (!mostReps || s.reps > (mostReps.reps ?? 0))) mostReps = s;
    }
    if (heaviest?.weight_kg)
      out.push({ exercise_slug: exercise.slug, kind: 'max_weight', value: heaviest.weight_kg, unit: 'kg', reps: heaviest.reps, weight_kg: heaviest.weight_kg });
    if (best1RM)
      out.push({ exercise_slug: exercise.slug, kind: 'weight_1rm', value: best1RM.value, unit: 'kg', reps: best1RM.set.reps, weight_kg: best1RM.set.weight_kg });
    // Bodyweight movements track rep records instead of load.
    if (mostReps?.reps && !heaviest?.weight_kg)
      out.push({ exercise_slug: exercise.slug, kind: 'max_reps', value: mostReps.reps, unit: 'reps', reps: mostReps.reps, weight_kg: null });
  }

  if (exercise.type === 'timed' || exercise.type === 'mobility') {
    const best = Math.max(...working.map((s) => s.seconds ?? 0));
    if (best > 0) out.push({ exercise_slug: exercise.slug, kind: 'max_duration', value: best, unit: 'sec', reps: null, weight_kg: null });
  }

  if (exercise.type === 'cardio') {
    const bestDist = Math.max(...working.map((s) => s.distance_km ?? 0));
    if (bestDist > 0) out.push({ exercise_slug: exercise.slug, kind: 'best_distance', value: round(bestDist, 2), unit: 'km', reps: null, weight_kg: null });
    const paced = working.filter((s) => (s.distance_km ?? 0) > 0 && (s.seconds ?? 0) > 0);
    if (paced.length) {
      const bestPace = Math.min(...paced.map((s) => (s.seconds as number) / (s.distance_km as number)));
      out.push({ exercise_slug: exercise.slug, kind: 'best_pace', value: Math.round(bestPace), unit: 'sec/km', reps: null, weight_kg: null });
    }
  }
  return out;
}

/** Lower is better for pace and timed race results. */
export function lowerIsBetter(kind: PersonalRecord['kind']): boolean {
  return kind === 'best_pace';
}

export function beatsExisting(candidate: RecordCandidate, existing: PersonalRecord | undefined): boolean {
  if (!existing) return true;
  return lowerIsBetter(candidate.kind)
    ? candidate.value < existing.value
    : candidate.value > existing.value;
}

export function toRecord(candidate: RecordCandidate, userId: ID, sessionId: ID | null, previous: number | null): PersonalRecord {
  return {
    id: uid('pr'),
    user_id: userId,
    exercise_slug: candidate.exercise_slug,
    kind: candidate.kind,
    value: candidate.value,
    unit: candidate.unit,
    reps: candidate.reps,
    weight_kg: candidate.weight_kg,
    session_id: sessionId,
    achieved_at: nowISO(),
    previous_value: previous,
  };
}

export const RECORD_KIND_LABEL: Record<PersonalRecord['kind'], string> = {
  max_weight: 'Heaviest lift',
  weight_1rm: 'Estimated 1RM',
  max_reps: 'Most reps',
  max_duration: 'Longest hold',
  best_distance: 'Furthest distance',
  best_pace: 'Fastest pace',
};
