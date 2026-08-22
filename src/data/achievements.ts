import type { AchievementDef } from '@/types';

/**
 * Achievements reward showing up, improving and recovering — never appearance
 * or bodyweight. There are no streak-loss penalties, no timed windows that
 * punish rest, and no "don't break the chain" pressure.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-step', name: 'First Step', description: 'Complete your first workout.', icon: 'Footprints', tier: 'bronze', category: 'milestone' },
  { id: 'consistency-builder', name: 'Consistency Builder', description: 'Complete 10 workouts.', icon: 'Repeat', tier: 'bronze', category: 'consistency' },
  { id: 'quarter-century', name: 'Quarter Century', description: 'Complete 25 workouts.', icon: 'Award', tier: 'silver', category: 'consistency' },
  { id: 'half-century', name: 'Half Century', description: 'Complete 50 workouts.', icon: 'Medal', tier: 'silver', category: 'consistency' },
  { id: 'century-club', name: 'Century Club', description: 'Complete 100 workouts.', icon: 'Trophy', tier: 'gold', category: 'consistency' },

  { id: 'full-week', name: 'Full Week', description: 'Hit your weekly workout target for the first time.', icon: 'CalendarCheck', tier: 'bronze', category: 'consistency' },
  { id: 'four-weeks-strong', name: 'Four Weeks Strong', description: 'Meet your weekly target four weeks running.', icon: 'CalendarHeart', tier: 'silver', category: 'consistency' },
  { id: 'twelve-weeks', name: 'A Season of Training', description: 'Meet your weekly target twelve weeks running.', icon: 'CalendarRange', tier: 'gold', category: 'consistency' },

  { id: 'first-record', name: 'On the Board', description: 'Set your first personal record.', icon: 'Star', tier: 'bronze', category: 'strength' },
  { id: 'stronger-every-week', name: 'Stronger Every Week', description: 'Improve the same exercise four weeks in a row.', icon: 'TrendingUp', tier: 'silver', category: 'strength' },
  { id: 'ten-records', name: 'Record Collector', description: 'Set 10 personal records.', icon: 'Trophy', tier: 'silver', category: 'strength' },
  { id: 'volume-mover', name: 'Volume Mover', description: 'Lift 100,000 kg of total volume.', icon: 'Layers', tier: 'gold', category: 'strength' },

  { id: 'cardio-starter', name: 'Cardio Starter', description: 'Complete 5 cardio sessions.', icon: 'HeartPulse', tier: 'bronze', category: 'cardio' },
  { id: 'cardio-builder', name: 'Cardio Builder', description: 'Complete 20 cardio sessions.', icon: 'Activity', tier: 'silver', category: 'cardio' },
  { id: 'distance-50', name: 'Fifty Club', description: 'Cover 50 km of logged cardio distance.', icon: 'Route', tier: 'silver', category: 'cardio' },

  { id: 'early-warrior', name: 'Early Warrior', description: 'Complete 10 workouts before 9 AM.', icon: 'Sunrise', tier: 'silver', category: 'consistency' },
  { id: 'night-owl', name: 'Night Owl', description: 'Complete 10 workouts after 8 PM.', icon: 'Moon', tier: 'silver', category: 'consistency' },

  { id: 'recovery-aware', name: 'Recovery Aware', description: 'Log 7 recovery check-ins.', icon: 'BatteryCharging', tier: 'bronze', category: 'recovery' },
  { id: 'rest-respecter', name: 'Rest Respecter', description: 'Take your planned rest day after three consecutive training days.', icon: 'Leaf', tier: 'silver', category: 'recovery' },
  { id: 'well-slept', name: 'Well Slept', description: 'Average 7+ hours of sleep across a full week.', icon: 'BedDouble', tier: 'silver', category: 'recovery' },

  { id: 'habit-starter', name: 'Habit Starter', description: 'Complete every active habit on the same day.', icon: 'CheckCheck', tier: 'bronze', category: 'habits' },
  { id: 'hydrated', name: 'Well Hydrated', description: 'Hit your water target 14 days in a month.', icon: 'Droplets', tier: 'silver', category: 'habits' },
  { id: 'step-master', name: 'Step Master', description: 'Hit your daily step target 20 times.', icon: 'Footprints', tier: 'gold', category: 'habits' },

  { id: 'goal-getter', name: 'Goal Getter', description: 'Achieve your first goal.', icon: 'Target', tier: 'silver', category: 'milestone' },
  { id: 'assessment-done', name: 'Know Your Baseline', description: 'Complete the FitStart assessment.', icon: 'ClipboardCheck', tier: 'bronze', category: 'milestone' },
  { id: 'challenge-finisher', name: 'Challenge Finisher', description: 'Complete a FitHub challenge.', icon: 'Flag', tier: 'gold', category: 'milestone' },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
