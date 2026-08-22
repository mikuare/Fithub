import { describe, expect, it } from 'vitest';
import {
  activeNiggles, computeMuscleFreshness, freshnessByMuscle, sessionCautions,
  statusForFreshness, weeklyBalance, TRACKED_MUSCLES,
} from '@/lib/fitness/freshness';
import { getExercise } from '@/data/exercises';
import type { Niggle, WorkoutSession, WorkoutSet } from '@/types';

const NOW = new Date('2026-03-14T18:00:00.000Z');

function isoAt(hoursAgo: number): string {
  return new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString();
}

let counter = 0;
function makeSet(slug: string, hoursAgo: number, over: Partial<WorkoutSet> = {}): WorkoutSet {
  counter++;
  return {
    id: `set-${counter}`, session_id: over.session_id ?? 'ses-1', exercise_slug: slug,
    set_index: counter, weight_kg: 60, reps: 8, seconds: null, distance_km: null,
    rpe: null, completed: true, is_warmup: false, logged_at: isoAt(hoursAgo),
    ...over,
  };
}

function makeSession(id: string, date: string): WorkoutSession {
  return {
    id, user_id: 'u1', program_id: null, program_day_id: null, date, title: 'T',
    kind: 'push', status: 'completed', started_at: null, ended_at: null,
    duration_seconds: 0, planned: [], difficulty: null, feeling: null, notes: '',
    est_calories: null, created_at: date,
  };
}

const sessions = [makeSession('ses-1', '2026-03-14')];

function makeNiggle(over: Partial<Niggle> = {}): Niggle {
  return {
    id: `ngl-${++counter}`, user_id: 'u1', muscle: 'shoulders', side: 'both',
    severity: 1, note: '', started_date: '2026-03-10', resolved_date: null,
    created_at: '2026-03-10T08:00:00.000Z', ...over,
  };
}

describe('computeMuscleFreshness', () => {
  it('reads fully fresh with honest missing-data labelling when nothing is logged', () => {
    const list = computeMuscleFreshness([], [], NOW);
    expect(list).toHaveLength(TRACKED_MUSCLES.length);
    for (const f of list) {
      expect(f.freshness).toBe(100);
      expect(f.status).toBe('fresh');
      expect(f.lastTrained).toBeNull();
      expect(f.weeklySets).toBe(0);
    }
  });

  it('a hard session fatigues its primary muscle more than its secondaries', () => {
    // Bench press: primary chest, secondary triceps + shoulders.
    const sets = [0, 1, 2, 3].map(() => makeSet('barbell-bench-press', 1));
    const by = freshnessByMuscle(computeMuscleFreshness(sets, sessions, NOW));
    const chest = by.get('chest')!;
    const triceps = by.get('triceps')!;
    expect(chest.freshness).toBeLessThan(triceps.freshness);
    expect(chest.status).not.toBe('fresh');
    expect(chest.lastTrained).toBe('2026-03-14');
    expect(by.get('quads')!.freshness).toBe(100);
  });

  it('fatigue decays over time', () => {
    const recent = computeMuscleFreshness([makeSet('barbell-bench-press', 1)], sessions, NOW);
    const stale = computeMuscleFreshness([makeSet('barbell-bench-press', 96)], sessions, NOW);
    const chestRecent = freshnessByMuscle(recent).get('chest')!;
    const chestStale = freshnessByMuscle(stale).get('chest')!;
    expect(chestStale.freshness).toBeGreaterThan(chestRecent.freshness);
    expect(chestStale.status).toBe('fresh'); // ~4 days is enough for one set
  });

  it('ignores warm-ups and incomplete sets', () => {
    const sets = [
      makeSet('barbell-bench-press', 1, { is_warmup: true }),
      makeSet('barbell-bench-press', 1, { completed: false }),
    ];
    const chest = freshnessByMuscle(computeMuscleFreshness(sets, sessions, NOW)).get('chest')!;
    expect(chest.freshness).toBe(100);
    expect(chest.lastTrained).toBeNull();
  });

  it('a grinding set (high RPE) deposits more fatigue than an easy one', () => {
    const hard = freshnessByMuscle(
      computeMuscleFreshness([makeSet('barbell-bench-press', 1, { rpe: 9 })], sessions, NOW),
    ).get('chest')!;
    const easy = freshnessByMuscle(
      computeMuscleFreshness([makeSet('barbell-bench-press', 1, { rpe: 6 })], sessions, NOW),
    ).get('chest')!;
    expect(hard.freshness).toBeLessThan(easy.freshness);
  });

  it('counts weekly sets with primary 1 and secondary 0.5, within 7 days only', () => {
    const sets = [
      makeSet('barbell-bench-press', 24),
      makeSet('barbell-bench-press', 48),
      makeSet('barbell-bench-press', 24 * 10), // outside the week
    ];
    const by = freshnessByMuscle(computeMuscleFreshness(sets, sessions, NOW));
    expect(by.get('chest')!.weeklySets).toBe(2);
    expect(by.get('triceps')!.weeklySets).toBe(1); // 2 × 0.5
  });

  it('spreads cardio stimulus into the legs by duration', () => {
    const run = getExercise('treadmill-run');
    expect(run?.primary).toContain('cardio');
    const sets = [makeSet('treadmill-run', 1, { reps: null, seconds: 30 * 60, distance_km: 5 })];
    const by = freshnessByMuscle(computeMuscleFreshness(sets, sessions, NOW));
    expect(by.get('quads')!.freshness).toBeLessThan(100);
    expect(by.get('chest')!.freshness).toBe(100);
  });

  it('skips sets whose exercise is unknown instead of crashing', () => {
    const list = computeMuscleFreshness([makeSet('not-a-real-exercise', 1)], sessions, NOW);
    expect(list.every((f) => f.freshness === 100)).toBe(true);
  });

  it('band edges match statusForFreshness', () => {
    expect(statusForFreshness(75)).toBe('fresh');
    expect(statusForFreshness(74)).toBe('recovering');
    expect(statusForFreshness(40)).toBe('recovering');
    expect(statusForFreshness(39)).toBe('fatigued');
  });
});

describe('weeklyBalance', () => {
  it('declines to judge on a small sample', () => {
    const b = weeklyBalance([makeSet('barbell-bench-press', 1)], sessions, NOW);
    expect(b.callouts.find((c) => c.key === 'push_pull_na')).toBeTruthy();
    expect(b.callouts.some((c) => c.tone === 'watch')).toBe(false);
  });

  it('flags a push-heavy week once there is enough data', () => {
    const sets = Array.from({ length: 12 }, () => makeSet('barbell-bench-press', 12));
    const b = weeklyBalance(sets, sessions, NOW);
    expect(b.pushSets).toBe(12);
    expect(b.pullSets).toBe(0);
    expect(b.callouts.find((c) => c.key === 'push_heavy')?.tone).toBe('watch');
  });

  it('calls a balanced week balanced', () => {
    const sets = [
      ...Array.from({ length: 6 }, () => makeSet('barbell-bench-press', 12)),
      ...Array.from({ length: 6 }, () => makeSet('lat-pulldown', 12)),
    ];
    expect(getExercise('lat-pulldown')?.force).toBe('pull');
    const b = weeklyBalance(sets, sessions, NOW);
    expect(b.callouts.find((c) => c.key === 'push_pull_ok')).toBeTruthy();
  });
});

describe('niggles and session cautions', () => {
  const freshAll = computeMuscleFreshness([], [], NOW);

  it('activeNiggles drops resolved entries', () => {
    const list = [makeNiggle(), makeNiggle({ resolved_date: '2026-03-12' })];
    expect(activeNiggles(list)).toHaveLength(1);
  });

  it('flags an exercise whose primary muscle has an active niggle, at any severity', () => {
    const cautions = sessionCautions(
      [{ exercise_slug: 'barbell-bench-press' }],
      freshAll,
      [makeNiggle({ muscle: 'chest', severity: 1 })],
    );
    expect(cautions).toHaveLength(1);
    expect(cautions[0].reasons[0].kind).toBe('niggle');
  });

  it('flags a secondary muscle only when the niggle is worse than mild tightness', () => {
    // Shoulders are secondary on the bench press.
    const mild = sessionCautions(
      [{ exercise_slug: 'barbell-bench-press' }], freshAll,
      [makeNiggle({ muscle: 'shoulders', severity: 1 })],
    );
    const worse = sessionCautions(
      [{ exercise_slug: 'barbell-bench-press' }], freshAll,
      [makeNiggle({ muscle: 'shoulders', severity: 2 })],
    );
    expect(mild).toHaveLength(0);
    expect(worse).toHaveLength(1);
  });

  it('flags exercises whose primary muscle is fatigued from recent training', () => {
    const sets = Array.from({ length: 10 }, () => makeSet('barbell-bench-press', 2, { rpe: 9 }));
    const tired = computeMuscleFreshness(sets, sessions, NOW);
    const chest = freshnessByMuscle(tired).get('chest')!;
    expect(chest.status).toBe('fatigued');
    const cautions = sessionCautions([{ exercise_slug: 'barbell-bench-press' }], tired, []);
    expect(cautions[0]?.reasons.some((r) => r.kind === 'fatigued')).toBe(true);
  });

  it('suggests alternatives that avoid the flagged muscle', () => {
    const cautions = sessionCautions(
      [{ exercise_slug: 'barbell-bench-press' }],
      freshAll,
      [makeNiggle({ muscle: 'chest', severity: 2 })],
    );
    for (const slug of cautions[0].alternatives) {
      const alt = getExercise(slug)!;
      expect(alt.primary).not.toContain('chest');
    }
  });

  it('respects available equipment when suggesting alternatives', () => {
    const cautions = sessionCautions(
      [{ exercise_slug: 'barbell-bench-press' }],
      freshAll,
      [makeNiggle({ muscle: 'chest', severity: 2 })],
      ['bodyweight'],
    );
    for (const slug of cautions[0].alternatives) {
      const alt = getExercise(slug)!;
      expect(alt.equipment.every((e) => e === 'bodyweight')).toBe(true);
    }
  });

  it('stays quiet when nothing is wrong', () => {
    const cautions = sessionCautions([{ exercise_slug: 'barbell-bench-press' }], freshAll, []);
    expect(cautions).toHaveLength(0);
  });

  it('ignores unknown exercise slugs', () => {
    const cautions = sessionCautions(
      [{ exercise_slug: 'nope' }], freshAll, [makeNiggle({ muscle: 'chest' })],
    );
    expect(cautions).toHaveLength(0);
  });
});
