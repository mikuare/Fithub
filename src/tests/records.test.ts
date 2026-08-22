import { describe, expect, it } from 'vitest';
import { candidatesFrom, beatsExisting, lowerIsBetter, toRecord } from '@/lib/fitness/records';
import { getExercise } from '@/data/exercises';
import type { PersonalRecord, WorkoutSet } from '@/types';

const bench = getExercise('barbell-bench-press')!;
const plank = getExercise('plank')!;
const run = getExercise('outdoor-run')!;
const pushup = getExercise('push-up')!;

const s = (over: Partial<WorkoutSet>): WorkoutSet => ({
  id: 'x', session_id: 'sess', exercise_slug: bench.slug, set_index: 0,
  weight_kg: null, reps: null, seconds: null, distance_km: null, rpe: null,
  completed: true, is_warmup: false, logged_at: '2026-01-01T00:00:00.000Z', ...over,
});

describe('candidatesFrom', () => {
  it('produces heaviest-load and estimated-1RM candidates for strength work', () => {
    const kinds = candidatesFrom([s({ weight_kg: 80, reps: 5 }), s({ weight_kg: 70, reps: 10 })], bench).map((c) => c.kind);
    expect(kinds).toContain('max_weight');
    expect(kinds).toContain('weight_1rm');
  });

  it('tracks reps instead of load for bodyweight movements', () => {
    const c = candidatesFrom([s({ exercise_slug: pushup.slug, reps: 30 })], pushup);
    expect(c.map((x) => x.kind)).toContain('max_reps');
  });

  it('tracks duration for timed holds', () => {
    const c = candidatesFrom([s({ exercise_slug: plank.slug, seconds: 165 })], plank);
    expect(c[0].kind).toBe('max_duration');
    expect(c[0].value).toBe(165);
  });

  it('tracks distance and pace for cardio', () => {
    const c = candidatesFrom([s({ exercise_slug: run.slug, distance_km: 5, seconds: 1782 })], run);
    const kinds = c.map((x) => x.kind);
    expect(kinds).toContain('best_distance');
    expect(kinds).toContain('best_pace');
    expect(c.find((x) => x.kind === 'best_pace')!.value).toBe(356);
  });

  it('ignores warm-up sets entirely', () => {
    expect(candidatesFrom([s({ weight_kg: 200, reps: 1, is_warmup: true })], bench)).toHaveLength(0);
  });

  it('returns nothing when there are no completed sets', () => {
    expect(candidatesFrom([s({ weight_kg: 100, reps: 5, completed: false })], bench)).toHaveLength(0);
  });
});

describe('beatsExisting', () => {
  const existing = (value: number, kind: PersonalRecord['kind']): PersonalRecord => ({
    id: 'pr', user_id: 'u', exercise_slug: bench.slug, kind, value, unit: 'kg',
    reps: null, weight_kg: null, session_id: null, achieved_at: '2026-01-01T00:00:00.000Z',
    previous_value: null,
  });

  it('treats any value as a record when none exists', () => {
    expect(beatsExisting({ exercise_slug: bench.slug, kind: 'max_weight', value: 1, unit: 'kg', reps: null, weight_kg: null }, undefined)).toBe(true);
  });

  it('requires a higher value for most record kinds', () => {
    const c = { exercise_slug: bench.slug, kind: 'max_weight' as const, value: 80, unit: 'kg', reps: null, weight_kg: null };
    expect(beatsExisting(c, existing(75, 'max_weight'))).toBe(true);
    expect(beatsExisting(c, existing(85, 'max_weight'))).toBe(false);
  });

  it('requires a lower value for pace', () => {
    expect(lowerIsBetter('best_pace')).toBe(true);
    const c = { exercise_slug: run.slug, kind: 'best_pace' as const, value: 300, unit: 'sec/km', reps: null, weight_kg: null };
    expect(beatsExisting(c, existing(320, 'best_pace'))).toBe(true);
    expect(beatsExisting(c, existing(280, 'best_pace'))).toBe(false);
  });
});

describe('toRecord', () => {
  it('carries the previous value so the UI can show the improvement', () => {
    const r = toRecord(
      { exercise_slug: bench.slug, kind: 'max_weight', value: 80, unit: 'kg', reps: 5, weight_kg: 80 },
      'u1', 'sess1', 75,
    );
    expect(r.previous_value).toBe(75);
    expect(r.session_id).toBe('sess1');
    expect(r.user_id).toBe('u1');
  });
});
