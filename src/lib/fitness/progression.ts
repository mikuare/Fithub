import type { WorkoutSet, Exercise, Experience, ISODate } from '@/types';
import { estimate1RM } from './calculations';
import { round } from '@/lib/utils';

export interface ExerciseHistoryEntry {
  session_id: string;
  date: ISODate;
  sets: WorkoutSet[];
  topWeight: number | null;
  topReps: number | null;
  volume: number;
  best1RM: number | null;
}

/** Group an exercise's logged sets into per-session history, newest first. */
export function buildHistory(sets: WorkoutSet[], dateOf: (sessionId: string) => ISODate | null): ExerciseHistoryEntry[] {
  const bySession = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (!s.completed || s.is_warmup) continue;
    const list = bySession.get(s.session_id) ?? [];
    list.push(s);
    bySession.set(s.session_id, list);
  }
  const out: ExerciseHistoryEntry[] = [];
  for (const [session_id, list] of bySession) {
    const date = dateOf(session_id);
    if (!date) continue;
    list.sort((a, b) => a.set_index - b.set_index);
    let topWeight: number | null = null;
    let topReps: number | null = null;
    let best1RM: number | null = null;
    let volume = 0;
    for (const s of list) {
      if (s.weight_kg !== null && (topWeight === null || s.weight_kg > topWeight)) {
        topWeight = s.weight_kg;
        topReps = s.reps;
      }
      const e = estimate1RM(s.weight_kg, s.reps);
      if (e !== null && (best1RM === null || e > best1RM)) best1RM = e;
      if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps;
    }
    out.push({ session_id, date, sets: list, topWeight, topReps, volume: round(volume, 0), best1RM });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export type SuggestionKind = 'increase_load' | 'add_reps' | 'hold' | 'deload' | 'first_time';

export interface ProgressionSuggestion {
  kind: SuggestionKind;
  headline: string;
  detail: string;
  suggestedWeightKg: number | null;
  suggestedReps: number | null;
  confidence: 'low' | 'medium' | 'high';
}

/** Load jump appropriate to the movement and the trainee. */
export function loadIncrement(exercise: Exercise, experience: Experience): number {
  const lowerBodyCompound =
    exercise.mechanic === 'compound' &&
    exercise.primary.some((m) => ['quads', 'hamstrings', 'glutes'].includes(m));
  let base = exercise.mechanic === 'isolation' ? 1.25 : lowerBodyCompound ? 5 : 2.5;
  if (experience === 'beginner') base *= lowerBodyCompound ? 1 : 1;
  if (experience === 'advanced' && exercise.mechanic === 'isolation') base = 1.25;
  return base;
}

/**
 * Double progression: hit the top of the rep target on every working set,
 * then add load and drop back to the bottom of the range. Everything here is
 * a *suggestion* — the UI always presents it as optional.
 */
export function suggestProgression(
  history: ExerciseHistoryEntry[],
  exercise: Exercise,
  experience: Experience,
  targetReps: number,
  targetSets: number,
): ProgressionSuggestion {
  const last = history[0];
  if (!last || last.sets.length === 0) {
    return {
      kind: 'first_time',
      headline: 'First time logging this',
      detail: 'Start with a load you could lift for a few more reps than the target, and note how it felt. FitHub will build suggestions from there.',
      suggestedWeightKg: null,
      suggestedReps: targetReps,
      confidence: 'low',
    };
  }

  const working = last.sets;
  const weights = working.map((s) => s.weight_kg).filter((w): w is number => w !== null);
  const reps = working.map((s) => s.reps ?? 0);
  const topWeight = weights.length ? Math.max(...weights) : null;
  const allHitTarget = reps.length >= Math.min(targetSets, working.length) && reps.every((r) => r >= targetReps);
  const anyBigMiss = reps.some((r) => r > 0 && r < targetReps - 3);

  // Three sessions of falling volume at the same load: suggest a step back.
  if (history.length >= 3) {
    const [a, b, c] = history;
    if (a.volume < b.volume && b.volume < c.volume && a.topWeight === c.topWeight && a.volume > 0) {
      return {
        kind: 'deload',
        headline: 'Performance is drifting down',
        detail: 'Volume has fallen three sessions running at the same load. A lighter week, more sleep or an extra rest day usually resets this faster than pushing through.',
        suggestedWeightKg: topWeight ? round(topWeight * 0.9, 1) : null,
        suggestedReps: targetReps,
        confidence: 'medium',
      };
    }
  }

  if (allHitTarget && topWeight !== null) {
    const inc = loadIncrement(exercise, experience);
    const next = round(topWeight + inc, 2);
    return {
      kind: 'increase_load',
      headline: 'Great progress',
      detail: `You completed every set at ${targetReps} reps. Consider trying ${next} kg during your next suitable session — only if your warm-up sets feel strong.`,
      suggestedWeightKg: next,
      suggestedReps: targetReps,
      confidence: history.length >= 2 ? 'high' : 'medium',
    };
  }

  if (allHitTarget && topWeight === null) {
    return {
      kind: 'add_reps',
      headline: 'Target reps cleared',
      detail: `You hit ${targetReps} reps on every set. Consider adding reps, slowing the lowering phase, or moving to the advanced variation.`,
      suggestedWeightKg: null,
      suggestedReps: targetReps + 2,
      confidence: 'medium',
    };
  }

  if (anyBigMiss) {
    return {
      kind: 'hold',
      headline: 'Stay at this load',
      detail: 'Some sets fell well short of the target. Repeating this weight until every set reaches the target is the fastest route forward.',
      suggestedWeightKg: topWeight,
      suggestedReps: targetReps,
      confidence: 'medium',
    };
  }

  return {
    kind: 'add_reps',
    headline: 'Close — chase the reps',
    detail: `Keep ${topWeight !== null ? `${topWeight} kg` : 'this load'} and aim to add a rep or two per set. Once every set hits ${targetReps}, the load goes up.`,
    suggestedWeightKg: topWeight,
    suggestedReps: targetReps,
    confidence: 'high',
  };
}

/** Percent change in estimated 1RM across the window. */
export function strengthTrend(history: ExerciseHistoryEntry[], weeks = 4): number | null {
  const withE1RM = history.filter((h) => h.best1RM !== null);
  if (withE1RM.length < 2) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const recent = withE1RM[0];
  const baseline = withE1RM.find((h) => h.date <= cutoffISO) ?? withE1RM[withE1RM.length - 1];
  if (!baseline.best1RM || !recent.best1RM || baseline === recent) return null;
  return round(((recent.best1RM - baseline.best1RM) / baseline.best1RM) * 100, 1);
}
