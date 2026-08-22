import { describe, expect, it } from 'vitest';
import { computeRecoveryScore, stateFor, consecutiveTrainingDays, averageSleep } from '@/lib/fitness/recovery';
import { addDays, today } from '@/lib/date';
import type { RecoveryLog, WorkoutSession } from '@/types';

const session = (date: string, status: WorkoutSession['status'] = 'completed'): WorkoutSession => ({
  id: `s-${date}`, user_id: 'u1', program_id: null, program_day_id: null, date,
  title: 'Push', kind: 'push', status, started_at: `${date}T18:00:00.000Z`, ended_at: null,
  duration_seconds: 3600, planned: [], difficulty: null, feeling: null, notes: '',
  est_calories: null, created_at: `${date}T18:00:00.000Z`,
});

const log = (date: string, over: Partial<RecoveryLog> = {}): RecoveryLog => ({
  id: `r-${date}`, user_id: 'u1', date, sleep_hours: 8, sleep_quality: 4, energy: 4,
  soreness: 2, stress: 2, mood: 4, score: 0, note: '', created_at: `${date}T08:00:00.000Z`, ...over,
});

describe('computeRecoveryScore', () => {
  it('reports no input rather than a fake neutral score', () => {
    const r = computeRecoveryScore({});
    expect(r.hasInput).toBe(false);
    expect(r.score).toBe(0);
    expect(r.headline).toMatch(/No check-in/);
  });

  it('scores a well-rested day highly', () => {
    const r = computeRecoveryScore({ sleep_hours: 8, sleep_quality: 5, energy: 5, soreness: 1, stress: 1 });
    expect(r.score).toBeGreaterThanOrEqual(88);
    expect(r.state).toBe('excellent');
  });

  it('scores a depleted day low and recommends recovery', () => {
    const r = computeRecoveryScore({ sleep_hours: 4, sleep_quality: 1, energy: 1, soreness: 5, stress: 5 });
    expect(r.score).toBeLessThan(38);
    expect(r.state).toBe('recover');
    expect(r.advice).toMatch(/rest|recovery/i);
  });

  it('re-normalises weights when only some inputs are given', () => {
    const partial = computeRecoveryScore({ energy: 5 });
    expect(partial.hasInput).toBe(true);
    expect(partial.score).toBe(100);
    expect(partial.contributions).toHaveLength(1);
  });

  it('penalises unusually long sleep as well as short sleep', () => {
    const short = computeRecoveryScore({ sleep_hours: 5 }).score;
    const ideal = computeRecoveryScore({ sleep_hours: 8 }).score;
    const long = computeRecoveryScore({ sleep_hours: 12 }).score;
    expect(ideal).toBeGreaterThan(short);
    expect(ideal).toBeGreaterThan(long);
  });

  it('factors in a long run of consecutive training days', () => {
    const sessions = [0, 1, 2, 3, 4].map((d) => session(addDays(today(), -d)));
    const fresh = computeRecoveryScore({ energy: 4, sleep_hours: 8 }).score;
    const loaded = computeRecoveryScore({ energy: 4, sleep_hours: 8 }, sessions).score;
    expect(loaded).toBeLessThan(fresh);
  });
});

describe('stateFor', () => {
  it('maps score bands in order', () => {
    expect(stateFor(95)).toBe('excellent');
    expect(stateFor(75)).toBe('ready');
    expect(stateFor(60)).toBe('moderate');
    expect(stateFor(45)).toBe('take_it_easy');
    expect(stateFor(20)).toBe('recover');
  });
});

describe('consecutiveTrainingDays', () => {
  it('counts back from today', () => {
    const sessions = [0, 1, 2].map((d) => session(addDays(today(), -d)));
    expect(consecutiveTrainingDays(sessions)).toBe(3);
  });

  it('still counts a streak that ended yesterday', () => {
    const sessions = [1, 2].map((d) => session(addDays(today(), -d)));
    expect(consecutiveTrainingDays(sessions)).toBe(2);
  });

  it('returns zero after two rest days', () => {
    expect(consecutiveTrainingDays([session(addDays(today(), -2))])).toBe(0);
  });

  it('ignores sessions that were never completed', () => {
    expect(consecutiveTrainingDays([session(today(), 'skipped')])).toBe(0);
  });
});

describe('averageSleep', () => {
  it('averages only logs that recorded sleep', () => {
    expect(averageSleep([log('2026-01-01', { sleep_hours: 7 }), log('2026-01-02', { sleep_hours: 8 })])).toBe(7.5);
    expect(averageSleep([log('2026-01-01', { sleep_hours: null })])).toBeNull();
    expect(averageSleep([])).toBeNull();
  });
});
