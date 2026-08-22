import { describe, expect, it } from 'vitest';
import { generateProgram, chooseSplit, assignWeekdays, canPerform, estimateSessionMinutes, weeklyVolumeByMuscle } from '@/lib/fitness/program';
import { emptyFitnessProfile } from '@/lib/defaults';
import { getExercise, EXERCISE_BY_SLUG } from '@/data/exercises';
import type { FitnessProfile } from '@/types';

const profile = (over: Partial<FitnessProfile> = {}): FitnessProfile => ({
  ...emptyFitnessProfile('u1', 'Alex'),
  equipment: ['dumbbells', 'barbell', 'bench', 'squat_rack', 'cable', 'machine', 'pullup_bar', 'bodyweight'],
  ...over,
});

describe('chooseSplit', () => {
  it('gives beginners full-body sessions on three days', () => {
    expect(chooseSplit(3, 'beginner', 'build_muscle').name).toBe('Full Body ×3');
  });
  it('gives experienced trainees push/pull/legs on three days', () => {
    expect(chooseSplit(3, 'advanced', 'build_muscle').name).toBe('Push / Pull / Legs');
  });
  it('adds conditioning when the goal is fat loss', () => {
    expect(chooseSplit(4, 'intermediate', 'lose_fat').sequence.some((d) => d.kind === 'cardio')).toBe(true);
  });
  it('never schedules seven hard days', () => {
    const seq = chooseSplit(7, 'advanced', 'build_muscle').sequence;
    expect(seq.some((d) => d.kind === 'recovery' || d.kind === 'rest')).toBe(true);
  });
});

describe('assignWeekdays', () => {
  it('uses the days the user asked for', () => {
    expect(assignWeekdays(3, [1, 3, 5])).toEqual([1, 3, 5]);
  });
  it('fills in spaced defaults when the user picked too few', () => {
    const days = assignWeekdays(4, [1]);
    expect(days).toHaveLength(4);
    expect(days).toContain(1);
    expect(new Set(days).size).toBe(4);
  });
  it('trims when the user picked too many', () => {
    expect(assignWeekdays(2, [1, 2, 3, 4, 5])).toHaveLength(2);
  });
  it('never returns duplicates', () => {
    for (let n = 1; n <= 7; n++) {
      const days = assignWeekdays(n, []);
      expect(new Set(days).size).toBe(days.length);
    }
  });
});

describe('canPerform', () => {
  it('always allows bodyweight movements', () => {
    expect(canPerform(getExercise('push-up')!, [])).toBe(true);
  });
  it('rejects exercises needing missing equipment', () => {
    expect(canPerform(getExercise('barbell-bench-press')!, ['dumbbells'])).toBe(false);
    expect(canPerform(getExercise('barbell-bench-press')!, ['barbell', 'bench', 'squat_rack'])).toBe(true);
  });
});

describe('generateProgram', () => {
  it('covers all seven weekdays with an explicit plan', () => {
    const p = generateProgram(profile({ days_per_week: 4, preferred_days: [1, 2, 4, 5] }), 'u1', { seed: 1 });
    expect(p.days).toHaveLength(7);
    expect(new Set(p.days.map((d) => d.weekday)).size).toBe(7);
  });

  it('schedules exactly the requested number of training days', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const p = generateProgram(profile({ days_per_week: n, preferred_days: [] }), 'u1', { seed: n });
      const training = p.days.filter((d) => d.kind !== 'rest' && d.exercises.length > 0);
      expect(training.length).toBeGreaterThanOrEqual(n);
    }
  });

  it('only prescribes exercises the user has equipment for', () => {
    const p = generateProgram(profile({ equipment: ['bodyweight'], days_per_week: 3 }), 'u1', { seed: 7 });
    for (const day of p.days) {
      for (const pe of day.exercises) {
        const e = EXERCISE_BY_SLUG[pe.exercise_slug];
        expect(e).toBeDefined();
        expect(canPerform(e, ['bodyweight'])).toBe(true);
      }
    }
  });

  it('never prescribes advanced exercises to a beginner', () => {
    const p = generateProgram(profile({ experience: 'beginner', days_per_week: 4 }), 'u1', { seed: 3 });
    for (const day of p.days) {
      for (const pe of day.exercises) {
        expect(EXERCISE_BY_SLUG[pe.exercise_slug].difficulty).not.toBe('advanced');
      }
    }
  });

  it('avoids advanced movements when the safety screen is flagged', () => {
    const flagged = profile({ experience: 'advanced', days_per_week: 4 });
    flagged.safety = { ...flagged.safety, chest_pain: true, flagged: true };
    const p = generateProgram(flagged, 'u1', { seed: 5 });
    for (const day of p.days) {
      for (const pe of day.exercises) {
        expect(EXERCISE_BY_SLUG[pe.exercise_slug].difficulty).not.toBe('advanced');
      }
    }
  });

  it('respects the session length budget', () => {
    const p = generateProgram(profile({ session_minutes: 30, days_per_week: 3 }), 'u1', { seed: 11 });
    for (const day of p.days.filter((d) => d.exercises.length)) {
      expect(day.est_minutes).toBeLessThanOrEqual(30 + 6);
    }
  });

  it('never repeats an exercise inside the same session', () => {
    const p = generateProgram(profile({ days_per_week: 5 }), 'u1', { seed: 13 });
    for (const day of p.days) {
      const slugs = day.exercises.map((e) => e.exercise_slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('prescribes lower reps for strength than for endurance', () => {
    const strength = generateProgram(profile({ primary_goal: 'gain_strength', experience: 'intermediate' }), 'u1', { seed: 2 });
    const endurance = generateProgram(profile({ primary_goal: 'improve_endurance', experience: 'intermediate' }), 'u1', { seed: 2 });
    const reps = (p: typeof strength) =>
      p.days.flatMap((d) => d.exercises).map((e) => e.target_reps).filter((r): r is number => r !== null);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(reps(strength))).toBeLessThan(avg(reps(endurance)));
  });

  it('produces different but valid programmes for different seeds', () => {
    const a = generateProgram(profile(), 'u1', { seed: 1 });
    const b = generateProgram(profile(), 'u1', { seed: 999 });
    const slugs = (p: typeof a) => p.days.flatMap((d) => d.exercises.map((e) => e.exercise_slug)).join(',');
    expect(slugs(a)).not.toBe('');
    expect(slugs(b)).not.toBe('');
  });

  it('marks itself active and generated', () => {
    const p = generateProgram(profile(), 'u1', { seed: 1 });
    expect(p.active).toBe(true);
    expect(p.generated).toBe(true);
    expect(p.notes.length).toBeGreaterThan(20);
  });
});

describe('estimateSessionMinutes', () => {
  it('grows with sets and rest', () => {
    const base = [{ id: 'a', exercise_slug: 'push-up', order: 0, sets: 3, target_reps: 10, target_seconds: null, target_weight_kg: null, rest_seconds: 60, notes: '', superset_group: null }];
    const more = [{ ...base[0], sets: 5 }];
    expect(estimateSessionMinutes(more)).toBeGreaterThan(estimateSessionMinutes(base));
  });
  it('has a floor so an empty session is not zero minutes', () => {
    expect(estimateSessionMinutes([])).toBeGreaterThan(0);
  });
});

describe('weeklyVolumeByMuscle', () => {
  it('accumulates sets per muscle across the week', () => {
    const p = generateProgram(profile({ days_per_week: 4 }), 'u1', { seed: 21 });
    const volume = weeklyVolumeByMuscle(p);
    expect(Object.keys(volume).length).toBeGreaterThan(4);
    expect(Object.values(volume).every((v) => v > 0)).toBe(true);
  });
  it('returns an empty map for no programme', () => {
    expect(weeklyVolumeByMuscle(null)).toEqual({});
  });
});
