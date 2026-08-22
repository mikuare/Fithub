import type {
  FitnessProfile, NutritionTargets, UserPreferences, NotificationKind, ID, Units,
} from '@/types';
import { nowISO } from '@/lib/date';

export const NOTIFICATION_DEFAULTS: Record<NotificationKind, boolean> = {
  workout_reminder: true,
  rest_reminder: true,
  goal_progress: true,
  achievement: true,
  hydration: false,   // opt-in only — nagging reminders are off by default
  trainer: true,
  system: true,
  challenge: true,
  membership: true,
};

export function defaultPreferences(userId: ID, units: Units = 'metric'): UserPreferences {
  return {
    user_id: userId,
    theme: 'dark',
    units,
    week_starts_on: 1,
    notifications: { ...NOTIFICATION_DEFAULTS },
    privacy: {
      // Private by default. The user opts in to every kind of sharing.
      profile_visibility: 'private',
      share_workouts: false,
      share_records: false,
      share_measurements: false,
      leaderboard_opt_in: false,
    },
    workout: {
      default_rest_seconds: 90,
      auto_start_rest: true,
      sound: true,
      vibrate: true,
      keep_awake: true,
      plate_calculator: true,
      bar_weight_kg: 20,
    },
    reduced_motion: false,
    updated_at: nowISO(),
  };
}

export function emptyFitnessProfile(userId: ID, firstName = ''): FitnessProfile {
  return {
    user_id: userId,
    first_name: firstName,
    gender: 'prefer_not_to_say',
    birth_date: null,
    height_cm: null,
    weight_kg: null,
    units: 'metric',
    experience: 'beginner',
    primary_goal: 'general_fitness',
    secondary_goals: [],
    location: 'gym',
    equipment: ['bodyweight'],
    days_per_week: 3,
    preferred_days: [1, 3, 5],
    preferred_time: '18:00',
    session_minutes: 60,
    activities: [],
    safety: {
      injuries: '',
      movement_limitations: '',
      recent_surgery: false,
      doctor_restrictions: '',
      chest_pain: false,
      dizziness: false,
      flagged: false,
      acknowledged_at: null,
    },
    updated_at: nowISO(),
  };
}

export function defaultNutritionTargets(userId: ID): NutritionTargets {
  return {
    user_id: userId,
    calories: 2200,
    protein_g: 130,
    carbs_g: 240,
    fat_g: 70,
    water_ml: 2500,
    manual: false,
    updated_at: nowISO(),
  };
}

/** Medical-safety disclaimer used wherever FitHub gives guidance. */
export const HEALTH_DISCLAIMER =
  'FitHub provides general fitness guidance and is not a medical device or a substitute for professional healthcare advice. Consider consulting a qualified healthcare professional before starting or significantly changing your exercise programme.';

export const RED_FLAG_MESSAGE =
  'Stop exercising and seek medical assistance if you experience chest pain or pressure, severe shortness of breath, fainting, sudden dizziness, or pain that feels different from normal muscular effort.';
