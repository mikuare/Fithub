/* ============================================================
   FitHub domain model
   These types mirror the Postgres schema in supabase/migrations
   one-to-one, so the local adapter and the Supabase adapter can
   satisfy the exact same repository interface.
   ============================================================ */

export type ID = string;
export type ISODate = string;   // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO timestamp

/* ---------- Identity & access ---------- */

export type Role = 'member' | 'trainer' | 'staff' | 'manager' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  member: 'Gym Member',
  trainer: 'Trainer / Coach',
  staff: 'Gym Staff',
  manager: 'Gym Manager',
  admin: 'Super Administrator',
};

/** Ordered from least to most privileged; used for hierarchy checks. */
export const ROLE_RANK: Record<Role, number> = {
  member: 0,
  trainer: 1,
  staff: 2,
  manager: 3,
  admin: 4,
};

export interface Profile {
  id: ID;
  email: string;
  full_name: string;
  avatar_color: string;
  /** Small, client-compressed profile photo. Optional for rows created before
   *  the avatar migration and null when the user prefers initials. */
  avatar_data_url?: string | null;
  role: Role;
  gym_id: ID | null;
  created_at: ISODateTime;
  onboarded: boolean;
  assessment_done: boolean;
}

/* ---------- Fitness profile ---------- */

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Units = 'metric' | 'imperial';

export type GoalKind =
  | 'lose_fat' | 'build_muscle' | 'gain_strength' | 'improve_endurance'
  | 'general_fitness' | 'mobility' | 'maintain';

export type TrainingLocation = 'gym' | 'home_gym' | 'home_minimal' | 'outdoor' | 'mixed';

export type Equipment =
  | 'dumbbells' | 'barbell' | 'bench' | 'squat_rack' | 'cable' | 'smith'
  | 'treadmill' | 'bike' | 'bands' | 'kettlebell' | 'pullup_bar'
  | 'machine' | 'bodyweight' | 'medicine_ball' | 'jump_rope' | 'box' | 'rower'
  /* Small kit people actually own at home. Adding one here never removes an
     exercise from anybody's programme — it only widens what can be chosen. */
  | 'ankle_strap' | 'power_twister' | 'ab_wheel' | 'suspension' | 'foam_roller'
  | 'stability_ball' | 'dip_bars' | 'elliptical' | 'mat' | 'hand_gripper';

export type Activity =
  | 'weightlifting' | 'running' | 'walking' | 'cycling' | 'hiit'
  | 'calisthenics' | 'yoga' | 'mobility' | 'sports' | 'swimming';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun..Sat

export interface SafetyScreen {
  injuries: string;
  movement_limitations: string;
  recent_surgery: boolean;
  doctor_restrictions: string;
  chest_pain: boolean;
  dizziness: boolean;
  /** True when any red-flag answer suggests professional clearance first. */
  flagged: boolean;
  acknowledged_at: ISODateTime | null;
}

export interface FitnessProfile {
  user_id: ID;
  first_name: string;
  gender: Gender;
  birth_date: ISODate | null;
  height_cm: number | null;
  weight_kg: number | null;
  units: Units;
  experience: Experience;
  primary_goal: GoalKind;
  secondary_goals: GoalKind[];
  location: TrainingLocation;
  equipment: Equipment[];
  days_per_week: number;
  preferred_days: Weekday[];
  preferred_time: string;       // 'HH:mm'
  session_minutes: number;
  activities: Activity[];
  safety: SafetyScreen;
  updated_at: ISODateTime;
}

/* ---------- FitStart baseline assessment ---------- */

export interface Assessment {
  id: ID;
  user_id: ID;
  taken_at: ISODateTime;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  resting_hr: number | null;
  pushups: number | null;
  plank_seconds: number | null;
  squats_60s: number | null;
  endurance_minutes: number | null;
  endurance_distance_km: number | null;
  mobility_score: number | null; // 1..5 self-reported sit-and-reach style
  notes: string;
}

/* ---------- Goals ---------- */

export type GoalMetric =
  | 'body_weight' | 'lift_1rm' | 'workouts_per_week' | 'run_distance'
  | 'run_time' | 'daily_steps' | 'habit_streak' | 'body_measurement' | 'custom';

export type GoalStatus = 'starting' | 'improving' | 'on_track' | 'needs_attention' | 'achieved';
export type GoalDirection = 'increase' | 'decrease';

export interface GoalMilestone {
  value: number;
  label: string;
  reached_at: ISODateTime | null;
}

export interface Goal {
  id: ID;
  user_id: ID;
  title: string;
  metric: GoalMetric;
  /** exercise slug for lift_1rm, measurement key for body_measurement, habit id for habit_streak */
  ref: string | null;
  unit: string;
  start_value: number;
  target_value: number;
  current_value: number;
  direction: GoalDirection;
  start_date: ISODate;
  target_date: ISODate;
  status: GoalStatus;
  milestones: GoalMilestone[];
  achieved_at: ISODateTime | null;
  archived: boolean;
  created_at: ISODateTime;
}

/* ---------- Exercise library ---------- */

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads'
  | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'forearms'
  | 'traps' | 'lats' | 'obliques' | 'lower_back' | 'full_body' | 'cardio';

export type ExerciseCategory =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs'
  | 'glutes' | 'core' | 'cardio' | 'mobility' | 'full_body';

export type ExerciseType = 'strength' | 'cardio' | 'timed' | 'mobility';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Mechanic = 'compound' | 'isolation';
export type Force = 'push' | 'pull' | 'static' | 'other';

export interface Exercise {
  slug: string;
  name: string;
  category: ExerciseCategory;
  type: ExerciseType;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: Equipment[];
  difficulty: Difficulty;
  mechanic: Mechanic;
  force: Force;
  unilateral: boolean;
  instructions: string[];
  mistakes: string[];
  safety: string[];
  alternatives: string[];   // slugs
  beginner_variation: string;
  advanced_variation: string;
  /** MET value, used only for clearly-labelled calorie estimates. */
  met: number;
  tempo_hint?: string;
}

/* ---------- Programs ---------- */

export type SessionKind =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body'
  | 'cardio' | 'core' | 'mobility' | 'recovery' | 'rest' | 'custom';

export interface PlannedExercise {
  id: ID;
  exercise_slug: string;
  order: number;
  sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string;
  superset_group: string | null;
}

export interface ProgramDay {
  id: ID;
  weekday: Weekday;
  kind: SessionKind;
  title: string;
  focus: string;
  est_minutes: number;
  exercises: PlannedExercise[];
}

export interface Program {
  id: ID;
  user_id: ID;
  name: string;
  goal: GoalKind;
  experience: Experience;
  days_per_week: number;
  split: string;
  week_count: number;
  active: boolean;
  generated: boolean;
  created_by: ID;
  created_at: ISODateTime;
  days: ProgramDay[];
  notes: string;
}

/* ---------- Sessions & sets ---------- */

export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped';

export interface WorkoutSet {
  id: ID;
  session_id: ID;
  exercise_slug: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  distance_km: number | null;
  rpe: number | null;
  completed: boolean;
  is_warmup: boolean;
  logged_at: ISODateTime;
}

export type Feeling = 'great' | 'good' | 'normal' | 'tired' | 'exhausted';

export interface WorkoutSession {
  id: ID;
  user_id: ID;
  program_id: ID | null;
  program_day_id: ID | null;
  date: ISODate;
  title: string;
  kind: SessionKind;
  status: SessionStatus;
  started_at: ISODateTime | null;
  ended_at: ISODateTime | null;
  duration_seconds: number;
  planned: PlannedExercise[];
  difficulty: 1 | 2 | 3 | 4 | 5 | null;
  feeling: Feeling | null;
  notes: string;
  est_calories: number | null;
  created_at: ISODateTime;
}

/* ---------- Records ---------- */

export type RecordKind = 'weight_1rm' | 'max_weight' | 'max_reps' | 'max_duration' | 'best_distance' | 'best_pace';

export interface PersonalRecord {
  id: ID;
  user_id: ID;
  exercise_slug: string;
  kind: RecordKind;
  value: number;
  unit: string;
  reps: number | null;
  weight_kg: number | null;
  session_id: ID | null;
  achieved_at: ISODateTime;
  previous_value: number | null;
}

/* ---------- Recovery, body, habits, nutrition ---------- */

export interface RecoveryLog {
  id: ID;
  user_id: ID;
  date: ISODate;
  sleep_hours: number | null;
  sleep_quality: number | null; // 1..5
  energy: number | null;        // 1..5
  soreness: number | null;      // 1..5 (5 = very sore)
  stress: number | null;        // 1..5 (5 = very stressed)
  mood: number | null;          // 1..5
  score: number;                // 0..100 computed
  note: string;
  created_at: ISODateTime;
}

/** A logged ache, tight spot or pain, tracked per muscle so training can
 *  steer around it and so it is visible when it lingers. Private to the
 *  user — never shared with trainers or friends under any setting. */
export type NiggleSeverity = 1 | 2 | 3; // 1 tightness · 2 ache · 3 pain
export type NiggleSide = 'left' | 'right' | 'both';

export interface Niggle {
  id: ID;
  user_id: ID;
  muscle: MuscleGroup;
  side: NiggleSide;
  severity: NiggleSeverity;
  note: string;
  started_date: ISODate;
  resolved_date: ISODate | null;
  created_at: ISODateTime;
}

export interface BodyMeasurement {
  id: ID;
  user_id: ID;
  date: ISODate;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  note: string;
}

export interface ProgressPhoto {
  id: ID;
  user_id: ID;
  date: ISODate;
  pose: 'front' | 'side' | 'back';
  /** Stored only in the user's own private bucket / local blob store. */
  data_url: string;
  note: string;
  private: boolean;
}

export type HabitUnit = 'count' | 'ml' | 'hours' | 'steps' | 'minutes' | 'servings';

export interface HabitDefinition {
  id: ID;
  user_id: ID;
  key: string;
  name: string;
  icon: string;
  unit: HabitUnit;
  target: number;
  active: boolean;
  color: string;
  order: number;
}

export interface HabitLog {
  id: ID;
  user_id: ID;
  habit_id: ID;
  date: ISODate;
  value: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: ID;
  user_id: ID;
  date: ISODate;
  slot: MealSlot;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: ISODateTime;
}

export interface NutritionTargets {
  user_id: ID;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  /** true when the user overrode the estimate by hand */
  manual: boolean;
  updated_at: ISODateTime;
}

/* ---------- Engagement ---------- */

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  category: 'consistency' | 'strength' | 'cardio' | 'habits' | 'milestone' | 'recovery';
}

export interface UserAchievement {
  id: ID;
  user_id: ID;
  achievement_id: string;
  earned_at: ISODateTime;
  progress: number; // 0..1
}

export type ChallengeMetric = 'workouts' | 'distance_km' | 'steps' | 'minutes' | 'sessions_of_type' | 'habit_days';
export type ChallengeScope = 'global' | 'gym' | 'friends' | 'personal';

export interface Challenge {
  id: ID;
  name: string;
  description: string;
  icon: string;
  metric: ChallengeMetric;
  target: number;
  unit: string;
  start_date: ISODate;
  end_date: ISODate;
  scope: ChallengeScope;
  gym_id: ID | null;
  created_by: ID | null;
}

export interface ChallengeMember {
  id: ID;
  challenge_id: ID;
  user_id: ID;
  joined_at: ISODateTime;
  progress: number;
  completed_at: ISODateTime | null;
  /** Opt-in: leaderboards only show members who chose to appear. */
  on_leaderboard: boolean;
}

export interface Friendship {
  id: ID;
  user_id: ID;
  friend_id: ID;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: ISODateTime;
}

export interface FeedPost {
  id: ID;
  user_id: ID;
  kind: 'workout' | 'record' | 'achievement' | 'challenge' | 'note';
  title: string;
  body: string;
  ref_id: ID | null;
  created_at: ISODateTime;
  reactions: Record<string, ID[]>; // emoji -> user ids
}

/* ---------- Gym operations ---------- */

export interface Gym {
  id: ID;
  name: string;
  address: string;
  timezone: string;
  open_hour: number;
  close_hour: number;
  capacity: number;
}

export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'frozen' | 'cancelled';

export interface MembershipPlan {
  id: ID;
  gym_id: ID;
  name: string;
  price: number;
  currency: string;
  months: number;
  perks: string[];
}

export interface Membership {
  id: ID;
  user_id: ID;
  gym_id: ID;
  plan_id: ID;
  status: MembershipStatus;
  start_date: ISODate;
  end_date: ISODate;
  member_code: string;
  auto_renew: boolean;
}

export interface GymCheckin {
  id: ID;
  user_id: ID;
  gym_id: ID;
  checked_in_at: ISODateTime;
  checked_out_at: ISODateTime | null;
  method: 'qr' | 'manual' | 'kiosk';
  recorded_by: ID | null;
}

export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service';

export interface GymEquipment {
  id: ID;
  gym_id: ID;
  name: string;
  asset_tag: string;
  category: string;
  location: string;
  status: EquipmentStatus;
  last_inspection: ISODate | null;
  next_maintenance: ISODate | null;
  notes: string;
  usage_hours: number;
}

export interface MaintenanceLog {
  id: ID;
  equipment_id: ID;
  gym_id: ID;
  date: ISODate;
  type: 'inspection' | 'repair' | 'service' | 'replacement';
  performed_by: string;
  cost: number | null;
  notes: string;
}

export interface TrainerClient {
  id: ID;
  trainer_id: ID;
  client_id: ID;
  since: ISODate;
  active: boolean;
  focus: string;
}

export interface TrainerNote {
  id: ID;
  trainer_id: ID;
  client_id: ID;
  body: string;
  created_at: ISODateTime;
  /** Notes are visible to the client unless the trainer marks them internal. */
  visible_to_client: boolean;
}

export interface Message {
  id: ID;
  thread_key: string; // sorted pair of user ids
  from_id: ID;
  to_id: ID;
  /** Owning user for row-level security and per-user indexing. */
  user_id: ID;
  body: string;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
}

/* ---------- Billing ---------- */

export type SubscriptionTier = 'free' | 'plus' | 'pro';
export type BillingCycle = 'monthly' | 'yearly';
export type BillingCurrency = 'USD' | 'PHP';
export type PaymentMethodKind = 'card' | 'gcash' | 'maya' | 'grabpay';
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unknown';

/** What FitHub keeps about how someone pays: the kind, and for cards only the
 *  brand and last four digits. A full card number is validated in memory and
 *  never persisted anywhere, sandbox or not. */
export interface PaymentMethodInfo {
  kind: PaymentMethodKind;
  brand: CardBrand | null;
  last4: string | null;
  /** Masked wallet account for GCash / Maya / GrabPay, e.g. '09•• ••• 4321'. */
  wallet_account: string | null;
}

export interface Subscription {
  user_id: ID; // singleton per user
  tier: SubscriptionTier;
  cycle: BillingCycle;
  status: 'active' | 'canceled';
  currency: BillingCurrency;
  price: number;
  started_at: ISODate;
  current_period_end: ISODate;
  cancel_at_period_end: boolean;
  payment_method: PaymentMethodInfo | null;
  /** True until a real payment provider is connected — no money moved. */
  sandbox: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PaymentRecord {
  id: ID;
  user_id: ID;
  tier: SubscriptionTier;
  cycle: BillingCycle;
  amount: number;
  currency: BillingCurrency;
  method: PaymentMethodInfo;
  status: 'paid' | 'refunded';
  sandbox: boolean;
  description: string;
  paid_at: ISODateTime;
}

/* ---------- Platform ---------- */

export type NotificationKind =
  | 'workout_reminder' | 'rest_reminder' | 'goal_progress' | 'achievement'
  | 'hydration' | 'trainer' | 'system' | 'challenge' | 'membership';

export interface AppNotification {
  id: ID;
  user_id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
}

export interface UserPreferences {
  user_id: ID;
  theme: 'dark' | 'light' | 'system';
  units: Units;
  week_starts_on: 0 | 1;
  notifications: Record<NotificationKind, boolean>;
  privacy: {
    profile_visibility: 'private' | 'friends' | 'gym' | 'public';
    share_workouts: boolean;
    share_records: boolean;
    share_measurements: boolean;
    leaderboard_opt_in: boolean;
  };
  workout: {
    default_rest_seconds: number;
    auto_start_rest: boolean;
    sound: boolean;
    vibrate: boolean;
    keep_awake: boolean;
    plate_calculator: boolean;
    bar_weight_kg: number;
  };
  reduced_motion: boolean;
  updated_at: ISODateTime;
}

export interface AuditLog {
  id: ID;
  actor_id: ID;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: ISODateTime;
}

/* ---------- Derived / computed view models ---------- */

export interface FitScore {
  total: number;
  consistency: number;
  strength: number;
  cardio: number;
  recovery: number;
  goals: number;
  delta: number;
  computed_at: ISODateTime;
}

export interface StreakInfo {
  current: number;
  longest: number;
  workouts_this_month: number;
  consistent_weeks: number;
  last_active: ISODate | null;
}
