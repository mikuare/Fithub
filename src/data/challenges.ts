import type { Challenge } from '@/types';
import { addDays, startOfMonth, endOfMonth, today } from '@/lib/date';

/**
 * Seed challenges. Dates are computed relative to today so a fresh install
 * always has something live rather than a wall of expired events.
 */
export function seedChallenges(gymId: string | null): Challenge[] {
  const monthStart = startOfMonth(today());
  const monthEnd = endOfMonth(today());
  return [
    {
      id: 'ch_walk30', name: '30-Day Walking Challenge',
      description: 'Log 8,000 steps or a walk on 30 separate days. Rest days count — walking is recovery.',
      icon: 'Footprints', metric: 'habit_days', target: 30, unit: 'days',
      start_date: addDays(today(), -3), end_date: addDays(today(), 27),
      scope: 'global', gym_id: null, created_by: null,
    },
    {
      id: 'ch_20workouts', name: '20 Workout Challenge',
      description: 'Complete 20 workouts this month. Any session type counts.',
      icon: 'Dumbbell', metric: 'workouts', target: 20, unit: 'workouts',
      start_date: monthStart, end_date: monthEnd,
      scope: 'global', gym_id: null, created_by: null,
    },
    {
      id: 'ch_100km', name: '100 km Cycling Challenge',
      description: 'Cover 100 km on the bike — indoor or outdoor, in as many rides as you like.',
      icon: 'Bike', metric: 'distance_km', target: 100, unit: 'km',
      start_date: monthStart, end_date: addDays(monthEnd, 30),
      scope: 'global', gym_id: null, created_by: null,
    },
    {
      id: 'ch_mobility30', name: '30-Day Mobility Challenge',
      description: 'Ten minutes of mobility work on 30 days. Small, daily, and it adds up.',
      icon: 'Sparkles', metric: 'minutes', target: 300, unit: 'minutes',
      start_date: addDays(today(), -7), end_date: addDays(today(), 23),
      scope: 'global', gym_id: null, created_by: null,
    },
    {
      id: 'ch_consistency', name: 'Consistency Challenge',
      description: 'Hit your own weekly workout target four weeks in a row. Your target, your pace.',
      icon: 'CalendarCheck', metric: 'workouts', target: 12, unit: 'workouts',
      start_date: addDays(today(), -14), end_date: addDays(today(), 14),
      scope: 'global', gym_id: null, created_by: null,
    },
    {
      id: 'ch_gym_summer', name: 'Gym Summer Shape-Up',
      description: 'A gym-wide challenge: 250 total training minutes over four weeks.',
      icon: 'Flame', metric: 'minutes', target: 250, unit: 'minutes',
      start_date: monthStart, end_date: monthEnd,
      scope: 'gym', gym_id: gymId, created_by: null,
    },
  ];
}

export const CHALLENGE_METRIC_LABEL: Record<Challenge['metric'], string> = {
  workouts: 'Workouts completed',
  distance_km: 'Distance covered',
  steps: 'Steps taken',
  minutes: 'Active minutes',
  sessions_of_type: 'Sessions of a type',
  habit_days: 'Days with the habit met',
};
