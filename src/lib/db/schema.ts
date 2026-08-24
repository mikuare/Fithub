import type {
  Profile, FitnessProfile, Assessment, Goal, Program, WorkoutSession, WorkoutSet,
  PersonalRecord, RecoveryLog, Niggle, BodyMeasurement, ProgressPhoto, HabitDefinition,
  HabitLog, NutritionLog, NutritionTargets, UserAchievement, Challenge,
  ChallengeMember, Friendship, FeedPost, Gym, MembershipPlan, Membership,
  GymCheckin, GymEquipment, MaintenanceLog, TrainerClient, TrainerNote, Message,
  AppNotification, UserPreferences, AuditLog, Subscription, PaymentRecord,
  GymClass, ClassBooking, GymPayment,
} from '@/types';

/** Local credential record — only used by the offline auth adapter. */
export interface Credential {
  user_id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

/** Every persisted collection, mapped to its row type. Table names match 1:1
 *  with the Postgres schema in supabase/migrations. */
export interface Schema {
  profiles: Profile;
  credentials: Credential;
  fitness_profiles: FitnessProfile;
  assessments: Assessment;
  goals: Goal;
  programs: Program;
  workout_sessions: WorkoutSession;
  workout_sets: WorkoutSet;
  personal_records: PersonalRecord;
  recovery_logs: RecoveryLog;
  niggles: Niggle;
  body_measurements: BodyMeasurement;
  progress_photos: ProgressPhoto;
  habit_definitions: HabitDefinition;
  habit_logs: HabitLog;
  nutrition_logs: NutritionLog;
  nutrition_targets: NutritionTargets;
  user_achievements: UserAchievement;
  challenges: Challenge;
  challenge_members: ChallengeMember;
  friendships: Friendship;
  feed_posts: FeedPost;
  gyms: Gym;
  membership_plans: MembershipPlan;
  memberships: Membership;
  gym_checkins: GymCheckin;
  gym_classes: GymClass;
  class_bookings: ClassBooking;
  gym_payments: GymPayment;
  gym_equipment: GymEquipment;
  maintenance_logs: MaintenanceLog;
  trainer_clients: TrainerClient;
  trainer_notes: TrainerNote;
  messages: Message;
  notifications: AppNotification;
  user_preferences: UserPreferences;
  subscriptions: Subscription;
  payment_records: PaymentRecord;
  audit_logs: AuditLog;
}

export type Collection = keyof Schema;
export type Row<C extends Collection> = Schema[C];

/**
 * Primary key per collection. Singleton-per-user tables key on user_id so
 * there can only ever be one row; everything else keys on its own id.
 */
const USER_KEYED = new Set<Collection>(['fitness_profiles', 'nutrition_targets', 'user_preferences', 'credentials', 'subscriptions']);

export function primaryKey<C extends Collection>(collection: C, row: Row<C>): string {
  if (USER_KEYED.has(collection)) return (row as { user_id: string }).user_id;
  return (row as { id: string }).id;
}

export function primaryKeyColumn(collection: Collection): 'id' | 'user_id' {
  return USER_KEYED.has(collection) ? 'user_id' : 'id';
}

/** The column that scopes a row to a user, if the collection has one. */
export function ownerColumn(collection: Collection): string | null {
  switch (collection) {
    case 'profiles': return 'id';
    case 'challenges':
    case 'gyms':
    case 'membership_plans':
    case 'gym_classes':
    case 'gym_equipment':
    case 'maintenance_logs':
      return null; // shared / gym-scoped resources
    case 'trainer_clients': return 'trainer_id';
    case 'trainer_notes': return 'trainer_id';
    case 'audit_logs': return 'actor_id';
    case 'messages': return null; // scoped by thread participants
    default: return 'user_id';
  }
}

export function ownerOf<C extends Collection>(collection: C, row: Row<C>): string | null {
  const col = ownerColumn(collection);
  if (!col) return null;
  return ((row as unknown as Record<string, unknown>)[col] as string | undefined) ?? null;
}

/** Collections that are shared across users and seeded once. */
export const SHARED_COLLECTIONS: Collection[] = [
  'challenges', 'gyms', 'membership_plans', 'gym_classes', 'gym_equipment', 'maintenance_logs',
];
