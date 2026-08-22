import { describe, expect, it } from 'vitest';
import { computeStreak, consistentWeeks } from '@/lib/fitness/streaks';
import { addDays, today, weekdayOf } from '@/lib/date';
import type { Program, WorkoutSession, Weekday } from '@/types';

const session = (date: string): WorkoutSession => ({
  id: `s-${date}`, user_id: 'u1', program_id: null, program_day_id: null, date,
  title: 'Session', kind: 'full_body', status: 'completed', started_at: null, ended_at: null,
  duration_seconds: 3000, planned: [], difficulty: null, feeling: null, notes: '',
  est_calories: null, created_at: `${date}T00:00:00.000Z`,
});

const programWithRestOn = (restDays: Weekday[]): Program => ({
  id: 'p1', user_id: 'u1', name: 'Test', goal: 'general_fitness', experience: 'beginner',
  days_per_week: 3, split: 'Full Body', week_count: 8, active: true, generated: true,
  created_by: 'u1', created_at: '2026-01-01T00:00:00.000Z', notes: '',
  days: restDays.map((d, i) => ({
    id: `d${i}`, weekday: d, kind: 'rest' as const, title: 'Rest', focus: '', est_minutes: 0, exercises: [],
  })),
});

describe('computeStreak', () => {
  it('counts consecutive training days with no programme', () => {
    const s = computeStreak([0, 1, 2].map((d) => session(addDays(today(), -d))), null);
    expect(s.current).toBe(3);
  });

  it('does not break a streak across a scheduled rest day', () => {
    // Trained the last two days; the day before that is a programmed rest day.
    const restDay = weekdayOf(addDays(today(), -2));
    const sessions = [0, 1, 3].map((d) => session(addDays(today(), -d)));
    const withRest = computeStreak(sessions, programWithRestOn([restDay]));
    const withoutRest = computeStreak(sessions, null);
    expect(withRest.current).toBeGreaterThan(withoutRest.current);
  });

  it('counts workouts in the current month', () => {
    const s = computeStreak([session(today()), session(addDays(today(), -1))], null);
    expect(s.workouts_this_month).toBeGreaterThanOrEqual(1);
  });

  it('handles an empty history without throwing', () => {
    const s = computeStreak([], null);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(0);
    expect(s.last_active).toBeNull();
  });
});

describe('consistentWeeks', () => {
  it('counts recent weeks that met the target', () => {
    const sessions: WorkoutSession[] = [];
    // Three sessions in each of the last three weeks.
    for (let w = 0; w < 3; w++) {
      for (let i = 0; i < 3; i++) sessions.push(session(addDays(today(), -(w * 7 + i))));
    }
    expect(consistentWeeks(sessions, 3)).toBeGreaterThanOrEqual(3);
  });

  it('does not penalise the current, still-open week', () => {
    // Two full past weeks, nothing yet this week.
    const sessions: WorkoutSession[] = [];
    for (let w = 1; w <= 2; w++) {
      for (let i = 0; i < 3; i++) sessions.push(session(addDays(today(), -(w * 7 + i))));
    }
    expect(consistentWeeks(sessions, 3)).toBeGreaterThanOrEqual(2);
  });
});
