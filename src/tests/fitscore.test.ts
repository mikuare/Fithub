import { describe, expect, it } from 'vitest';
import { computeFitScore, consistencyScore, cardioScore, recoveryScore, goalScore, fitScoreBand } from '@/lib/fitness/fitscore';
import { addDays, today } from '@/lib/date';
import type { Goal, RecoveryLog, WorkoutSession } from '@/types';

const session = (daysAgo: number, kind: WorkoutSession['kind'] = 'push', minutes = 60): WorkoutSession => ({
  id: `s${daysAgo}-${kind}`, user_id: 'u1', program_id: null, program_day_id: null,
  date: addDays(today(), -daysAgo), title: 'S', kind, status: 'completed',
  started_at: null, ended_at: null, duration_seconds: minutes * 60, planned: [],
  difficulty: null, feeling: null, notes: '', est_calories: null, created_at: '2026-01-01T00:00:00.000Z',
});

const recoveryLog = (daysAgo: number, score: number): RecoveryLog => ({
  id: `r${daysAgo}`, user_id: 'u1', date: addDays(today(), -daysAgo), sleep_hours: 8,
  sleep_quality: 4, energy: 4, soreness: 2, stress: 2, mood: 4, score, note: '',
  created_at: '2026-01-01T00:00:00.000Z',
});

const goal = (progress: number): Goal => ({
  id: `g${progress}`, user_id: 'u1', title: 'G', metric: 'custom', ref: null, unit: '',
  start_value: 0, target_value: 100, current_value: progress * 100, direction: 'increase',
  start_date: addDays(today(), -30), target_date: addDays(today(), 30), status: 'improving',
  milestones: [], achieved_at: null, archived: false, created_at: '2026-01-01T00:00:00.000Z',
});

const base = { sessions: [], recovery: [], goals: [], records: [], program: null, targetSessionsPerWeek: 3 };

describe('computeFitScore', () => {
  it('is zero for a brand-new account', () => {
    const s = computeFitScore(base);
    expect(s.total).toBe(0);
    expect(s.consistency).toBe(0);
  });

  it('stays within 0..1000', () => {
    const sessions = Array.from({ length: 40 }, (_, i) => session(i % 28, i % 3 === 0 ? 'cardio' : 'push'));
    const s = computeFitScore({
      ...base, sessions,
      recovery: Array.from({ length: 14 }, (_, i) => recoveryLog(i, 95)),
      goals: [goal(1), goal(1)],
    });
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(1000);
  });

  it('reports the change against a previous score', () => {
    const s = computeFitScore({ ...base, sessions: [session(1)] }, 100);
    expect(s.delta).toBe(s.total - 100);
  });
});

describe('consistencyScore', () => {
  it('rewards hitting the weekly target', () => {
    const sessions = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25].map((d) => session(d));
    expect(consistencyScore(sessions, 3)).toBeGreaterThan(90);
  });

  it('weights recent weeks more heavily than older ones', () => {
    const recent = [0, 1, 2].map((d) => session(d));
    const old = [21, 22, 23].map((d) => session(d));
    expect(consistencyScore(recent, 3)).toBeGreaterThan(consistencyScore(old, 3));
  });

  it('caps the reward for wildly exceeding the target', () => {
    const many = Array.from({ length: 20 }, (_, i) => session(i % 7));
    expect(consistencyScore(many, 3)).toBeLessThanOrEqual(100);
  });
});

describe('cardioScore', () => {
  it('is zero with no cardio logged', () => {
    expect(cardioScore([session(1, 'push')])).toBe(0);
  });
  it('reaches full marks around 150 weekly minutes', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session(i * 2, 'cardio', 50));
    expect(cardioScore(sessions)).toBeGreaterThan(90);
  });
});

describe('recoveryScore', () => {
  it('is zero with no check-ins', () => {
    expect(recoveryScore([])).toBe(0);
  });
  it('gives only partial credit for sparse logging', () => {
    const sparse = recoveryScore([recoveryLog(1, 100)]);
    const dense = recoveryScore(Array.from({ length: 12 }, (_, i) => recoveryLog(i, 100)));
    expect(sparse).toBeLessThan(dense);
  });
  it('ignores check-ins older than the window', () => {
    expect(recoveryScore([recoveryLog(40, 100)])).toBe(0);
  });
});

describe('goalScore', () => {
  it('averages live goals and ignores archived ones', () => {
    expect(goalScore([goal(0.5), goal(1)])).toBe(75);
    expect(goalScore([{ ...goal(1), archived: true }])).toBe(0);
  });
});

describe('fitScoreBand', () => {
  it('labels each band', () => {
    expect(fitScoreBand(0).label).toBe('Getting started');
    expect(fitScoreBand(500).label).toBe('Consistent');
    expect(fitScoreBand(900).label).toBe('Elite habit');
  });
});
