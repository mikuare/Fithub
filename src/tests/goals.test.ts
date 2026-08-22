import { describe, expect, it } from 'vitest';
import { goalProgress, goalPercent, isGoalMet, goalStatus, buildMilestones, requiredWeeklyRate, projectedDate } from '@/lib/fitness/goals';
import { addDays, today } from '@/lib/date';
import type { Goal } from '@/types';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', user_id: 'u1', title: 'Lose 8 kg', metric: 'body_weight', ref: null,
  unit: 'kg', start_value: 82, target_value: 74, current_value: 82,
  direction: 'decrease', start_date: addDays(today(), -30), target_date: addDays(today(), 60),
  status: 'starting', milestones: [], achieved_at: null, archived: false,
  created_at: '2026-01-01T00:00:00.000Z', ...over,
});

describe('goalProgress', () => {
  it('is 0 at the start and 1 at the target for a decreasing goal', () => {
    expect(goalProgress(goal({ current_value: 82 }))).toBe(0);
    expect(goalProgress(goal({ current_value: 74 }))).toBe(1);
    expect(goalPercent(goal({ current_value: 78 }))).toBe(50);
  });

  it('works the same way for an increasing goal', () => {
    const g = goal({ start_value: 50, target_value: 70, current_value: 60, direction: 'increase' });
    expect(goalPercent(g)).toBe(50);
  });

  it('clamps overshoot and regression into 0..1', () => {
    expect(goalProgress(goal({ current_value: 70 }))).toBe(1);   // past the target
    expect(goalProgress(goal({ current_value: 90 }))).toBe(0);   // moved the wrong way
  });

  it('handles a degenerate goal where start equals target', () => {
    const met = goal({ start_value: 74, target_value: 74, current_value: 74 });
    expect(goalProgress(met)).toBe(1);
    const notMet = goal({ start_value: 74, target_value: 74, current_value: 80 });
    expect(goalProgress(notMet)).toBe(0);
  });
});

describe('isGoalMet', () => {
  it('respects direction', () => {
    expect(isGoalMet({ target_value: 74, current_value: 73, direction: 'decrease' })).toBe(true);
    expect(isGoalMet({ target_value: 74, current_value: 75, direction: 'decrease' })).toBe(false);
    expect(isGoalMet({ target_value: 70, current_value: 71, direction: 'increase' })).toBe(true);
  });
});

describe('goalStatus', () => {
  it('reports achieved when the target is met, whatever the pace', () => {
    expect(goalStatus(goal({ current_value: 73 }))).toBe('achieved');
  });

  it('does not punish a goal that has barely started', () => {
    const fresh = goal({ start_date: today(), target_date: addDays(today(), 90), current_value: 82 });
    expect(goalStatus(fresh)).toBe('starting');
  });

  it('flags a goal that is well behind pace once the window is underway', () => {
    // 30 of 90 days elapsed, no movement at all.
    const behind = goal({ start_date: addDays(today(), -30), target_date: addDays(today(), 60), current_value: 81.9 });
    expect(behind).toBeDefined();
    expect(goalStatus(behind)).toBe('needs_attention');
  });

  it('reports on track when progress keeps up with elapsed time', () => {
    // A third of the window gone, a third of the distance covered.
    const onTrack = goal({ start_date: addDays(today(), -30), target_date: addDays(today(), 60), current_value: 79.3 });
    expect(goalStatus(onTrack)).toBe('on_track');
  });
});

describe('buildMilestones', () => {
  it('creates evenly spaced milestones ending on the target', () => {
    const ms = buildMilestones(82, 74, 'kg', 4);
    expect(ms).toHaveLength(4);
    expect(ms[0].value).toBe(80);
    expect(ms[3].value).toBe(74);
    expect(ms[3].label).toContain('Goal');
    expect(ms.every((m) => m.reached_at === null)).toBe(true);
  });
});

describe('pace projections', () => {
  it('computes the weekly rate still required', () => {
    const g = goal({ current_value: 80, target_date: addDays(today(), 70) });
    expect(requiredWeeklyRate(g)).toBeCloseTo(-0.6, 1);
  });

  it('returns null for a target date in the past', () => {
    expect(requiredWeeklyRate(goal({ target_date: addDays(today(), -1) }))).toBeNull();
  });

  it('will not project a finish date without enough history', () => {
    expect(projectedDate(goal({ start_date: addDays(today(), -3) }))).toBeNull();
  });

  it('will not project when the trend runs away from the target', () => {
    const wrongWay = goal({ start_date: addDays(today(), -30), current_value: 85 });
    expect(projectedDate(wrongWay)).toBeNull();
  });

  it('projects a date when the trend heads toward the target', () => {
    const moving = goal({ start_date: addDays(today(), -30), current_value: 79 });
    expect(projectedDate(moving)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
