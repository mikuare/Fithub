import type { Goal, GoalStatus, GoalMetric } from '@/types';
import { clamp, round } from '@/lib/utils';
import { diffDays, today } from '@/lib/date';

/** Fraction 0..1 of the distance from start to target that has been covered. */
export function goalProgress(goal: Pick<Goal, 'start_value' | 'target_value' | 'current_value' | 'direction'>): number {
  const span = goal.target_value - goal.start_value;
  if (Math.abs(span) < 1e-9) {
    // Degenerate goal (start === target): either you are there or you are not.
    return goal.direction === 'decrease'
      ? goal.current_value <= goal.target_value ? 1 : 0
      : goal.current_value >= goal.target_value ? 1 : 0;
  }
  const done = (goal.current_value - goal.start_value) / span;
  return clamp(done, 0, 1);
}

export function goalPercent(goal: Parameters<typeof goalProgress>[0]): number {
  return Math.round(goalProgress(goal) * 100);
}

export function isGoalMet(goal: Pick<Goal, 'target_value' | 'current_value' | 'direction'>): boolean {
  return goal.direction === 'increase'
    ? goal.current_value >= goal.target_value
    : goal.current_value <= goal.target_value;
}

/**
 * Status compares progress made against time elapsed. A goal is only
 * "needs attention" when it is meaningfully behind pace AND enough of the
 * window has passed for that to mean something.
 */
export function goalStatus(goal: Goal): GoalStatus {
  if (isGoalMet(goal)) return 'achieved';

  const progress = goalProgress(goal);
  const totalDays = Math.max(1, diffDays(goal.target_date, goal.start_date));
  const elapsed = clamp(diffDays(today(), goal.start_date) / totalDays, 0, 1);

  // Too early in the window to judge pace fairly.
  if (elapsed < 0.15) return progress > 0.02 ? 'improving' : 'starting';

  const ratio = progress / Math.max(elapsed, 0.01);
  if (ratio >= 0.95) return 'on_track';
  if (ratio >= 0.6) return 'improving';
  return 'needs_attention';
}

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; tone: 'info' | 'success' | 'warn' | 'brand'; icon: string }> = {
  starting: { label: 'Starting', tone: 'info', icon: 'Flag' },
  improving: { label: 'Improving', tone: 'brand', icon: 'TrendingUp' },
  on_track: { label: 'On Track', tone: 'success', icon: 'Target' },
  needs_attention: { label: 'Needs Attention', tone: 'warn', icon: 'AlertTriangle' },
  achieved: { label: 'Achieved', tone: 'success', icon: 'Trophy' },
};

/** Even milestones between start and target, labelled in the goal's unit. */
export function buildMilestones(start: number, target: number, unit: string, count = 4) {
  const step = (target - start) / count;
  return Array.from({ length: count }, (_, i) => {
    const value = round(start + step * (i + 1), 1);
    return {
      value,
      label: i === count - 1 ? `Goal: ${value} ${unit}` : `${value} ${unit}`,
      reached_at: null as string | null,
    };
  });
}

/** Rate needed per week from now to land on target by the target date. */
export function requiredWeeklyRate(goal: Goal): number | null {
  const daysLeft = diffDays(goal.target_date, today());
  if (daysLeft <= 0) return null;
  const remaining = goal.target_value - goal.current_value;
  return round((remaining / daysLeft) * 7, 2);
}

/** Projected finish date from observed pace, or null if there is no pace yet. */
export function projectedDate(goal: Goal): string | null {
  const daysElapsed = diffDays(today(), goal.start_date);
  if (daysElapsed < 7) return null;
  const moved = goal.current_value - goal.start_value;
  if (Math.abs(moved) < 1e-6) return null;
  const perDay = moved / daysElapsed;
  const remaining = goal.target_value - goal.current_value;
  if (perDay === 0 || Math.sign(perDay) !== Math.sign(remaining)) return null;
  const daysNeeded = Math.ceil(remaining / perDay);
  if (daysNeeded > 3650) return null;
  const d = new Date();
  d.setDate(d.getDate() + daysNeeded);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const GOAL_METRIC_META: Record<GoalMetric, { label: string; unit: string; direction: 'increase' | 'decrease'; hint: string }> = {
  body_weight: { label: 'Body weight', unit: 'kg', direction: 'decrease', hint: 'Tracked from your body measurements.' },
  lift_1rm: { label: 'Strength (estimated 1RM)', unit: 'kg', direction: 'increase', hint: 'Updates automatically from logged sets.' },
  workouts_per_week: { label: 'Workouts per week', unit: 'sessions', direction: 'increase', hint: 'Counts completed sessions each week.' },
  run_distance: { label: 'Continuous distance', unit: 'km', direction: 'increase', hint: 'Your best single cardio distance.' },
  run_time: { label: 'Time for a distance', unit: 'min', direction: 'decrease', hint: 'Your fastest logged time.' },
  daily_steps: { label: 'Daily steps', unit: 'steps', direction: 'increase', hint: 'Pulled from your steps habit.' },
  habit_streak: { label: 'Habit streak', unit: 'days', direction: 'increase', hint: 'Consecutive days meeting the habit target.' },
  body_measurement: { label: 'Body measurement', unit: 'cm', direction: 'decrease', hint: 'Tracked from your measurements.' },
  custom: { label: 'Custom', unit: '', direction: 'increase', hint: 'You update this one manually.' },
};
