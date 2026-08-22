import { describe, expect, it } from 'vitest';
import { buildHistory, suggestProgression, loadIncrement, strengthTrend } from '@/lib/fitness/progression';
import { getExercise } from '@/data/exercises';
import type { WorkoutSet } from '@/types';
import { addDays, today } from '@/lib/date';

const bench = getExercise('barbell-bench-press')!;
const curl = getExercise('dumbbell-curl')!;
const squat = getExercise('back-squat')!;

const mkSet = (sessionId: string, i: number, weight: number | null, reps: number | null, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${sessionId}-${i}`, session_id: sessionId, exercise_slug: bench.slug, set_index: i,
  weight_kg: weight, reps, seconds: null, distance_km: null, rpe: null,
  completed: true, is_warmup: false, logged_at: '2026-01-01T00:00:00.000Z', ...over,
});

const dates: Record<string, string> = {
  s1: addDays(today(), -2), s2: addDays(today(), -9), s3: addDays(today(), -16), s4: addDays(today(), -30),
};
const dateOf = (id: string) => dates[id] ?? null;

describe('buildHistory', () => {
  it('groups sets into sessions, newest first', () => {
    const sets = [
      mkSet('s2', 0, 50, 10), mkSet('s2', 1, 50, 10),
      mkSet('s1', 0, 52.5, 8),
    ];
    const history = buildHistory(sets, dateOf);
    expect(history).toHaveLength(2);
    expect(history[0].session_id).toBe('s1');
    expect(history[0].topWeight).toBe(52.5);
    expect(history[1].volume).toBe(1000);
  });

  it('ignores warm-ups, incomplete sets and sessions with no date', () => {
    const sets = [
      mkSet('s1', 0, 40, 10, { is_warmup: true }),
      mkSet('s1', 1, 50, 10, { completed: false }),
      mkSet('unknown', 0, 60, 5),
    ];
    expect(buildHistory(sets, dateOf)).toHaveLength(0);
  });
});

describe('loadIncrement', () => {
  it('gives lower-body compounds a bigger jump than isolation work', () => {
    expect(loadIncrement(squat, 'intermediate')).toBeGreaterThan(loadIncrement(bench, 'intermediate'));
    expect(loadIncrement(bench, 'intermediate')).toBeGreaterThan(loadIncrement(curl, 'intermediate'));
  });
});

describe('suggestProgression', () => {
  it('guides a first-time lifter instead of inventing a number', () => {
    const s = suggestProgression([], bench, 'beginner', 10, 3);
    expect(s.kind).toBe('first_time');
    expect(s.suggestedWeightKg).toBeNull();
    expect(s.confidence).toBe('low');
  });

  it('suggests more load once every set hits the rep target', () => {
    const sets = [mkSet('s1', 0, 50, 10), mkSet('s1', 1, 50, 10), mkSet('s1', 2, 50, 10)];
    const s = suggestProgression(buildHistory(sets, dateOf), bench, 'intermediate', 10, 3);
    expect(s.kind).toBe('increase_load');
    expect(s.suggestedWeightKg).toBe(52.5);
    expect(s.detail).toMatch(/Consider/);
  });

  it('holds the load when a set falls well short', () => {
    const sets = [mkSet('s1', 0, 50, 10), mkSet('s1', 1, 50, 6)];
    const s = suggestProgression(buildHistory(sets, dateOf), bench, 'intermediate', 10, 3);
    expect(s.kind).toBe('hold');
    expect(s.suggestedWeightKg).toBe(50);
  });

  it('chases reps when the session was close but not complete', () => {
    const sets = [mkSet('s1', 0, 50, 10), mkSet('s1', 1, 50, 9)];
    const s = suggestProgression(buildHistory(sets, dateOf), bench, 'intermediate', 10, 3);
    expect(s.kind).toBe('add_reps');
  });

  it('recommends a step back after three sessions of falling volume at the same load', () => {
    const sets = [
      mkSet('s1', 0, 60, 5), // 300
      mkSet('s2', 0, 60, 7), // 420
      mkSet('s3', 0, 60, 9), // 540
    ];
    const s = suggestProgression(buildHistory(sets, dateOf), bench, 'intermediate', 10, 3);
    expect(s.kind).toBe('deload');
    expect(s.suggestedWeightKg).toBe(54);
  });

  it('suggests reps rather than load for bodyweight work', () => {
    const sets = [mkSet('s1', 0, null, 12), mkSet('s1', 1, null, 12)];
    const pushup = getExercise('push-up')!;
    const s = suggestProgression(buildHistory(sets, dateOf), pushup, 'beginner', 12, 2);
    expect(s.kind).toBe('add_reps');
    expect(s.suggestedReps).toBe(14);
  });
});

describe('strengthTrend', () => {
  it('needs at least two data points', () => {
    expect(strengthTrend(buildHistory([mkSet('s1', 0, 50, 10)], dateOf))).toBeNull();
  });

  it('reports a positive percentage when estimated 1RM rises', () => {
    const sets = [mkSet('s4', 0, 50, 10), mkSet('s1', 0, 60, 10)];
    const trend = strengthTrend(buildHistory(sets, dateOf), 4);
    expect(trend).toBeGreaterThan(15);
  });
});
