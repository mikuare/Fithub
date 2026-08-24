import { describe, expect, it } from 'vitest';
import { autoRegulateSession } from '@/lib/fitness/autoRegulate';
import { computeMuscleFreshness, sessionCautions } from '@/lib/fitness/freshness';
import type { RecoveryReadout } from '@/lib/fitness/recovery';
import type { PlannedExercise, WorkoutSession, WorkoutSet } from '@/types';

let counter = 0;

function pe(over: Partial<PlannedExercise> = {}): PlannedExercise {
  counter++;
  return {
    id: `pe-${counter}`,
    exercise_slug: 'back-squat',
    order: 0,
    sets: 4,
    target_reps: 8,
    target_seconds: null,
    target_weight_kg: null,
    rest_seconds: 90,
    notes: '',
    superset_group: null,
    ...over,
  };
}

function readout(over: Partial<RecoveryReadout> = {}): RecoveryReadout {
  return {
    score: 60, state: 'moderate', label: 'Moderate', headline: '', advice: '',
    contributions: [], hasInput: true, ...over,
  };
}

const NO_INPUT: RecoveryReadout = readout({ hasInput: false });

function isoAt(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

function makeSet(slug: string, hoursAgo: number, over: Partial<WorkoutSet> = {}): WorkoutSet {
  counter++;
  return {
    id: `set-${counter}`, session_id: 'ses-1', exercise_slug: slug,
    set_index: counter, weight_kg: 60, reps: 8, seconds: null, distance_km: null,
    rpe: 9, completed: true, is_warmup: false, logged_at: isoAt(hoursAgo),
    ...over,
  };
}

const sessions: WorkoutSession[] = [{
  id: 'ses-1', user_id: 'u1', program_id: null, program_day_id: null, date: '2026-03-14',
  title: 'T', kind: 'push', status: 'completed', started_at: null, ended_at: null,
  duration_seconds: 0, planned: [], difficulty: null, feeling: null, notes: '',
  est_calories: null, created_at: '2026-03-14',
}];

describe('autoRegulateSession', () => {
  it('does nothing when there are no cautions and no recovery input', () => {
    const planned = [pe()];
    const result = autoRegulateSession(planned, [], NO_INPUT);
    expect(result.changes).toHaveLength(0);
    expect(result.planned).toEqual(planned);
  });

  it('swaps a fatigued exercise for the first clean alternative from its caution', () => {
    const sets = Array.from({ length: 10 }, () => makeSet('barbell-bench-press', 2));
    const freshness = computeMuscleFreshness(sets, sessions, new Date());
    const cautions = sessionCautions([{ exercise_slug: 'barbell-bench-press' }], freshness, []);
    expect(cautions[0].alternatives.length).toBeGreaterThan(0);

    const planned = [pe({ exercise_slug: 'barbell-bench-press' })];
    const result = autoRegulateSession(planned, cautions, NO_INPUT);

    expect(result.planned[0].exercise_slug).toBe(cautions[0].alternatives[0]);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].kind).toBe('swap');
  });

  it('leaves an exercise untouched when it has no caution', () => {
    const planned = [pe({ exercise_slug: 'back-squat' })];
    const result = autoRegulateSession(planned, [], NO_INPUT);
    expect(result.planned).toEqual(planned);
  });

  it('caps every eligible lift at the low-readiness ceiling', () => {
    const planned = [
      pe({ exercise_slug: 'back-squat', sets: 5 }),
      pe({ exercise_slug: 'deadlift', sets: 4 }),
    ];
    const result = autoRegulateSession(planned, [], readout({ state: 'take_it_easy', hasInput: true }));
    expect(result.planned.map((p) => p.sets)).toEqual([3, 3]);
    expect(result.changes).toHaveLength(2);
    expect(result.changes.every((c) => c.kind === 'trim_sets')).toBe(true);
  });

  it('leaves a lift already at or under the ceiling untouched', () => {
    const planned = [pe({ exercise_slug: 'back-squat', sets: 2 })];
    const result = autoRegulateSession(planned, [], readout({ state: 'recover', hasInput: true }));
    expect(result.planned[0].sets).toBe(2);
    expect(result.changes).toHaveLength(0);
  });

  it('ignores recovery entirely when there is no check-in and no training-load signal', () => {
    const planned = [pe({ exercise_slug: 'back-squat', sets: 4 })];
    const result = autoRegulateSession(planned, [], NO_INPUT);
    expect(result.planned[0].sets).toBe(4);
  });

  it('does not trim cardio or timed slots, which carry no target_reps', () => {
    const planned = [pe({ exercise_slug: 'treadmill-run', sets: 1, target_reps: null, target_seconds: 1200 })];
    const result = autoRegulateSession(planned, [], readout({ state: 'recover', hasInput: true }));
    expect(result.planned[0].sets).toBe(1);
    expect(result.changes).toHaveLength(0);
  });

  it('on a moderate readout, trims only the two highest-volume eligible lifts', () => {
    const planned = [
      pe({ exercise_slug: 'back-squat', sets: 6 }),
      pe({ exercise_slug: 'deadlift', sets: 5 }),
      pe({ exercise_slug: 'seated-cable-row', sets: 5 }),
      pe({ exercise_slug: 'front-squat', sets: 3 }),
    ];
    const result = autoRegulateSession(planned, [], readout({ state: 'moderate', hasInput: true }));
    expect(result.planned.map((p) => p.sets)).toEqual([4, 4, 5, 3]);
    expect(result.changes).toHaveLength(2);
  });

  it('does not trim on excellent or ready readiness', () => {
    const planned = [pe({ exercise_slug: 'back-squat', sets: 4 })];
    for (const state of ['excellent', 'ready'] as const) {
      const result = autoRegulateSession(planned, [], readout({ state, hasInput: true }));
      expect(result.planned[0].sets).toBe(4);
    }
  });

  it('is idempotent — reapplying to its own output makes no further changes', () => {
    const planned = [
      pe({ exercise_slug: 'back-squat', sets: 4 }),
      pe({ exercise_slug: 'deadlift', sets: 3 }),
    ];
    const first = autoRegulateSession(planned, [], readout({ state: 'take_it_easy', hasInput: true }));
    const second = autoRegulateSession(first.planned, [], readout({ state: 'take_it_easy', hasInput: true }));
    expect(second.changes).toHaveLength(0);
    expect(second.planned).toEqual(first.planned);
  });

  it('applies both a swap and a volume trim together', () => {
    const sets = Array.from({ length: 10 }, () => makeSet('barbell-bench-press', 2));
    const freshness = computeMuscleFreshness(sets, sessions, new Date());
    const cautions = sessionCautions([{ exercise_slug: 'barbell-bench-press' }], freshness, []);

    const planned = [
      pe({ exercise_slug: 'barbell-bench-press', sets: 5 }),
      pe({ exercise_slug: 'back-squat', sets: 4 }),
    ];
    const result = autoRegulateSession(planned, cautions, readout({ state: 'take_it_easy', hasInput: true }));

    expect(result.planned[0].exercise_slug).toBe(cautions[0].alternatives[0]);
    expect(result.planned[0].sets).toBe(3);
    expect(result.planned[1].sets).toBe(3);
    expect(result.changes).toHaveLength(3);
  });
});
