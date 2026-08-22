import { create } from 'zustand';
import type {
  Assessment, BodyMeasurement, Challenge, ChallengeMember, FeedPost, FitnessProfile,
  Friendship, Goal, Gym, GymCheckin, GymEquipment, HabitDefinition, HabitLog, ID,
  MaintenanceLog, Membership, MembershipPlan, Message, Niggle, AppNotification, NutritionLog,
  NutritionTargets, PersonalRecord, ProgressPhoto, Profile, Program, RecoveryLog,
  TrainerClient, TrainerNote, UserAchievement, UserPreferences, WorkoutSession,
  WorkoutSet, PlannedExercise, ISODate, SessionKind, Feeling, AuditLog,
  Subscription, PaymentRecord, SubscriptionTier, BillingCycle, BillingCurrency,
  PaymentMethodInfo,
} from '@/types';
import { backend, type Collection, type Row } from '@/lib/db';
import { DEMO_GYM_ID } from '@/lib/db/seed';
import { defaultNutritionTargets, defaultPreferences } from '@/lib/defaults';
import { uid } from '@/lib/id';
import { addDays, nowISO, startOfWeek, today, toISODate, weekdayOf } from '@/lib/date';
import { getExercise } from '@/data/exercises';
import { candidatesFrom, beatsExisting, toRecord } from '@/lib/fitness/records';
import { computeRecoveryScore } from '@/lib/fitness/recovery';
import { estimateSessionCalories } from '@/lib/fitness/calculations';
import { goalStatus, isGoalMet } from '@/lib/fitness/goals';
import { priceFor, periodEndFrom, TIER_LABEL } from '@/lib/billing/plans';
import { estimate1RM } from '@/lib/fitness/calculations';
import { evaluateAchievements } from '@/lib/fitness/achievements';
import { ACHIEVEMENT_BY_ID } from '@/data/achievements';
import { toast } from './toast';

export interface DataState {
  userId: ID | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;

  /* personal */
  fitnessProfile: FitnessProfile | null;
  preferences: UserPreferences | null;
  assessments: Assessment[];
  goals: Goal[];
  programs: Program[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  records: PersonalRecord[];
  recovery: RecoveryLog[];
  niggles: Niggle[];
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  habits: HabitDefinition[];
  habitLogs: HabitLog[];
  nutrition: NutritionLog[];
  nutritionTargets: NutritionTargets | null;
  subscription: Subscription | null;
  payments: PaymentRecord[];
  achievements: UserAchievement[];
  challengeMembers: ChallengeMember[];
  friendships: Friendship[];
  feed: FeedPost[];
  notifications: AppNotification[];
  messages: Message[];
  memberships: Membership[];
  checkins: GymCheckin[];
  trainerClients: TrainerClient[];
  trainerNotes: TrainerNote[];

  /* shared / gym scope */
  challenges: Challenge[];
  gym: Gym | null;
  plans: MembershipPlan[];
  equipment: GymEquipment[];
  maintenance: MaintenanceLog[];
  /** Loaded only for trainer/staff/manager/admin roles. */
  directory: Profile[];
  allMemberships: Membership[];
  allCheckins: GymCheckin[];
  auditLogs: AuditLog[];

  load: (userId: ID, role: Profile['role']) => Promise<void>;
  reset: () => void;

  put: <C extends Collection>(collection: C, row: Row<C>) => Promise<void>;
  del: <C extends Collection>(collection: C, id: string) => Promise<void>;
  audit: (action: string, entity: string, entityId: string | null, meta?: Record<string, unknown>) => Promise<void>;

  notify: (n: Omit<AppNotification, 'id' | 'user_id' | 'created_at' | 'read_at'>) => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;

  /* workout lifecycle */
  startSession: (input: { title: string; kind: SessionKind; planned: PlannedExercise[]; programId?: ID | null; programDayId?: ID | null; date?: ISODate }) => Promise<WorkoutSession>;
  logSet: (set: WorkoutSet) => Promise<void>;
  removeSet: (setId: ID) => Promise<void>;
  finishSession: (sessionId: ID, input: { durationSeconds: number; difficulty: WorkoutSession['difficulty']; feeling: Feeling | null; notes: string }) => Promise<{ session: WorkoutSession; newRecords: PersonalRecord[] }>;
  abandonSession: (sessionId: ID) => Promise<void>;

  /* domain helpers */
  saveRecovery: (input: Partial<RecoveryLog> & { date: ISODate }) => Promise<RecoveryLog>;
  saveMeasurement: (input: Omit<BodyMeasurement, 'id' | 'user_id'>) => Promise<void>;
  logHabit: (habitId: ID, date: ISODate, value: number) => Promise<void>;
  addNutrition: (input: Omit<NutritionLog, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  joinChallenge: (challengeId: ID, onLeaderboard: boolean) => Promise<void>;
  leaveChallenge: (challengeId: ID) => Promise<void>;
  /** Sandbox checkout: records the plan and a payment entry, moves no money. */
  checkout: (input: { tier: Exclude<SubscriptionTier, 'free'>; cycle: BillingCycle; currency: BillingCurrency; method: PaymentMethodInfo }) => Promise<Subscription>;
  setCancelAtPeriodEnd: (cancel: boolean) => Promise<void>;
  recalcGoals: () => Promise<void>;
  syncAchievements: () => Promise<void>;
  updateChallengeProgress: () => Promise<void>;
  activeProgram: () => Program | null;
}

const EMPTY: Omit<DataState,
  'userId' | 'loading' | 'loaded' | 'error' | 'load' | 'reset' | 'put' | 'del' | 'audit' |
  'notify' | 'markNotificationsRead' | 'startSession' | 'logSet' | 'removeSet' |
  'finishSession' | 'abandonSession' | 'saveRecovery' | 'saveMeasurement' | 'logHabit' |
  'addNutrition' | 'joinChallenge' | 'leaveChallenge' | 'checkout' | 'setCancelAtPeriodEnd' |
  'recalcGoals' | 'syncAchievements' | 'updateChallengeProgress' | 'activeProgram'
> = {
  fitnessProfile: null, preferences: null, assessments: [], goals: [], programs: [],
  sessions: [], sets: [], records: [], recovery: [], niggles: [], measurements: [], photos: [],
  habits: [], habitLogs: [], nutrition: [], nutritionTargets: null,
  subscription: null, payments: [], achievements: [],
  challengeMembers: [], friendships: [], feed: [], notifications: [], messages: [],
  memberships: [], checkins: [], trainerClients: [], trainerNotes: [],
  challenges: [], gym: null, plans: [], equipment: [], maintenance: [],
  directory: [], allMemberships: [], allCheckins: [], auditLogs: [],
};

export const useData = create<DataState>((set, get) => ({
  userId: null,
  loading: false,
  loaded: false,
  error: null,
  ...EMPTY,

  reset: () => set({ userId: null, loaded: false, loading: false, error: null, ...EMPTY }),

  load: async (userId, role) => {
    set({ loading: true, error: null, userId });
    const db = backend();
    try {
      const [
        fitnessProfile, preferences, nutritionTargets, subscription, payments,
        assessments, goals, programs, sessions, sets, records, recovery, niggles,
        measurements, photos, habits, habitLogs, nutrition, achievements,
        challengeMembers, friendships, feed, notifications, messages,
        memberships, checkins, trainerClients, trainerNotes,
        challenges, gyms, plans, equipment, maintenance,
      ] = await Promise.all([
        db.get('fitness_profiles', userId),
        db.get('user_preferences', userId),
        db.get('nutrition_targets', userId),
        db.get('subscriptions', userId),
        db.list('payment_records', userId),
        db.list('assessments', userId),
        db.list('goals', userId),
        db.list('programs', userId),
        db.list('workout_sessions', userId),
        db.list('workout_sets', userId),
        db.list('personal_records', userId),
        db.list('recovery_logs', userId),
        db.list('niggles', userId),
        db.list('body_measurements', userId),
        db.list('progress_photos', userId),
        db.list('habit_definitions', userId),
        db.list('habit_logs', userId),
        db.list('nutrition_logs', userId),
        db.list('user_achievements', userId),
        db.list('challenge_members', userId),
        db.list('friendships', userId),
        db.list('feed_posts', userId),
        db.list('notifications', userId),
        db.list('messages', userId),
        db.list('memberships', userId),
        db.list('gym_checkins', userId),
        db.list('trainer_clients', userId),
        db.list('trainer_notes', userId),
        db.listAll('challenges'),
        db.listAll('gyms'),
        db.listAll('membership_plans'),
        db.listAll('gym_equipment'),
        db.listAll('maintenance_logs'),
      ]);

      const prefs = preferences ?? defaultPreferences(userId, fitnessProfile?.units ?? 'metric');
      if (!preferences) await db.upsert('user_preferences', prefs);
      const targets = nutritionTargets ?? defaultNutritionTargets(userId);
      if (!nutritionTargets) await db.upsert('nutrition_targets', targets);

      set({
        fitnessProfile, preferences: prefs, nutritionTargets: targets, subscription, payments,
        assessments, goals, programs, sessions, sets, records, recovery, niggles,
        measurements, photos, habits, habitLogs, nutrition, achievements,
        challengeMembers, friendships, feed, notifications, messages,
        memberships, checkins, trainerClients, trainerNotes,
        challenges, plans, equipment, maintenance,
        gym: gyms.find((g) => g.id === DEMO_GYM_ID) ?? gyms[0] ?? null,
        loading: false, loaded: true,
      });

      // Staff-facing roles need gym-wide reads. In the Supabase backend these
      // are gated by row-level security policies, not by this check alone.
      if (role !== 'member') {
        const [directory, allMemberships, allCheckins, auditLogs] = await Promise.all([
          db.listAll('profiles'), db.listAll('memberships'), db.listAll('gym_checkins'), db.listAll('audit_logs'),
        ]);
        set({ directory, allMemberships, allCheckins, auditLogs });
      }

      await get().recalcGoals();
      await get().syncAchievements();
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load your data.' });
    }
  },

  put: async (collection, row) => {
    await backend().upsert(collection, row);
    applyLocal(set, get, collection, row);
  },

  del: async (collection, id) => {
    await backend().remove(collection, id);
    removeLocal(set, get, collection, id);
  },

  audit: async (action, entity, entityId, meta = {}) => {
    const { userId } = get();
    if (!userId) return;
    const row: AuditLog = {
      id: uid('audit'),
      actor_id: userId,
      actor_email: '',
      action, entity, entity_id: entityId, meta,
      created_at: nowISO(),
    };
    await backend().upsert('audit_logs', row);
    set((s) => ({ auditLogs: [row, ...s.auditLogs].slice(0, 500) }));
  },

  notify: async (n) => {
    const { userId, preferences } = get();
    if (!userId) return;
    if (preferences && preferences.notifications[n.kind] === false) return;
    const row: AppNotification = { id: uid('ntf'), user_id: userId, created_at: nowISO(), read_at: null, ...n };
    await backend().upsert('notifications', row);
    set((s) => ({ notifications: [row, ...s.notifications] }));
  },

  markNotificationsRead: async (ids) => {
    const { notifications } = get();
    const target = ids ? notifications.filter((n) => ids.includes(n.id)) : notifications.filter((n) => !n.read_at);
    if (!target.length) return;
    const updated = target.map((n) => ({ ...n, read_at: nowISO() }));
    await backend().upsertMany('notifications', updated);
    set((s) => ({
      notifications: s.notifications.map((n) => updated.find((u) => u.id === n.id) ?? n),
    }));
  },

  /* ---------------- workout lifecycle ---------------- */

  startSession: async ({ title, kind, planned, programId = null, programDayId = null, date }) => {
    const { userId } = get();
    if (!userId) throw new Error('Not signed in');
    const session: WorkoutSession = {
      id: uid('ses'),
      user_id: userId,
      program_id: programId,
      program_day_id: programDayId,
      date: date ?? today(),
      title, kind,
      status: 'in_progress',
      started_at: nowISO(),
      ended_at: null,
      duration_seconds: 0,
      planned,
      difficulty: null,
      feeling: null,
      notes: '',
      est_calories: null,
      created_at: nowISO(),
    };
    await backend().upsert('workout_sessions', session);
    set((s) => ({ sessions: [session, ...s.sessions] }));
    return session;
  },

  logSet: async (row) => {
    await backend().upsert('workout_sets', row);
    set((s) => {
      const idx = s.sets.findIndex((x) => x.id === row.id);
      if (idx >= 0) {
        const next = [...s.sets];
        next[idx] = row;
        return { sets: next };
      }
      return { sets: [...s.sets, row] };
    });
  },

  removeSet: async (setId) => {
    await backend().remove('workout_sets', setId);
    set((s) => ({ sets: s.sets.filter((x) => x.id !== setId) }));
  },

  finishSession: async (sessionId, input) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const sessionSets = state.sets.filter((s) => s.session_id === sessionId && s.completed);
    const bodyWeight = state.measurements.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight_kg
      ?? state.fitnessProfile?.weight_kg ?? null;

    const calorieEntries = groupSetsByExercise(sessionSets).map(([slug, rows]) => ({
      exercise: getExercise(slug),
      seconds: rows.reduce((a, r) => a + (r.seconds ?? 45), 0) || rows.length * 45,
    }));

    const finished: WorkoutSession = {
      ...session,
      status: 'completed',
      ended_at: nowISO(),
      duration_seconds: input.durationSeconds,
      difficulty: input.difficulty,
      feeling: input.feeling,
      notes: input.notes,
      est_calories: estimateSessionCalories(calorieEntries, bodyWeight),
    };
    await backend().upsert('workout_sessions', finished);
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === sessionId ? finished : x)) }));

    /* Personal records ------------------------------------------------- */
    const newRecords: PersonalRecord[] = [];
    for (const [slug, rows] of groupSetsByExercise(sessionSets)) {
      const exercise = getExercise(slug);
      if (!exercise) continue;
      for (const candidate of candidatesFrom(rows, exercise)) {
        const existing = get().records
          .filter((r) => r.exercise_slug === slug && r.kind === candidate.kind)
          .sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))[0];
        if (!beatsExisting(candidate, existing)) continue;
        const record = toRecord(candidate, session.user_id, sessionId, existing?.value ?? null);
        newRecords.push(record);
      }
    }
    if (newRecords.length) {
      await backend().upsertMany('personal_records', newRecords);
      set((s) => ({ records: [...newRecords, ...s.records] }));
      await get().notify({
        kind: 'achievement',
        title: newRecords.length === 1 ? 'New personal record' : `${newRecords.length} new personal records`,
        body: newRecords.map((r) => getExercise(r.exercise_slug)?.name ?? r.exercise_slug).join(', '),
        href: '/records',
      });
    }

    await get().recalcGoals();
    await get().syncAchievements();
    await get().updateChallengeProgress();

    return { session: finished, newRecords };
  },

  abandonSession: async (sessionId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    // Discard an empty session outright rather than leaving noise in history.
    const hasSets = state.sets.some((s) => s.session_id === sessionId && s.completed);
    if (!hasSets) {
      await backend().remove('workout_sessions', sessionId);
      const orphans = state.sets.filter((s) => s.session_id === sessionId);
      for (const o of orphans) await backend().remove('workout_sets', o.id);
      set((s) => ({
        sessions: s.sessions.filter((x) => x.id !== sessionId),
        sets: s.sets.filter((x) => x.session_id !== sessionId),
      }));
      return;
    }
    const skipped: WorkoutSession = { ...session, status: 'skipped', ended_at: nowISO() };
    await backend().upsert('workout_sessions', skipped);
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === sessionId ? skipped : x)) }));
  },

  /* ---------------- domain helpers ---------------- */

  saveRecovery: async (input) => {
    const { userId, recovery, sessions } = get();
    if (!userId) throw new Error('Not signed in');
    const existing = recovery.find((r) => r.date === input.date);
    const merged: RecoveryLog = {
      id: existing?.id ?? uid('rec'),
      user_id: userId,
      date: input.date,
      sleep_hours: input.sleep_hours ?? existing?.sleep_hours ?? null,
      sleep_quality: input.sleep_quality ?? existing?.sleep_quality ?? null,
      energy: input.energy ?? existing?.energy ?? null,
      soreness: input.soreness ?? existing?.soreness ?? null,
      stress: input.stress ?? existing?.stress ?? null,
      mood: input.mood ?? existing?.mood ?? null,
      note: input.note ?? existing?.note ?? '',
      score: 0,
      created_at: existing?.created_at ?? nowISO(),
    };
    merged.score = computeRecoveryScore(merged, sessions).score;
    await backend().upsert('recovery_logs', merged);
    set((s) => ({
      recovery: existing ? s.recovery.map((r) => (r.id === merged.id ? merged : r)) : [...s.recovery, merged],
    }));
    await get().syncAchievements();
    return merged;
  },

  saveMeasurement: async (input) => {
    const { userId, measurements } = get();
    if (!userId) return;
    const existing = measurements.find((m) => m.date === input.date);
    const row: BodyMeasurement = { id: existing?.id ?? uid('bm'), user_id: userId, ...input };
    await backend().upsert('body_measurements', row);
    set((s) => ({
      measurements: existing ? s.measurements.map((m) => (m.id === row.id ? row : m)) : [...s.measurements, row],
    }));
    await get().recalcGoals();
  },

  logHabit: async (habitId, date, value) => {
    const { userId, habitLogs } = get();
    if (!userId) return;
    const existing = habitLogs.find((l) => l.habit_id === habitId && l.date === date);
    const row: HabitLog = { id: existing?.id ?? uid('hl'), user_id: userId, habit_id: habitId, date, value: Math.max(0, value) };
    await backend().upsert('habit_logs', row);
    set((s) => ({
      habitLogs: existing ? s.habitLogs.map((l) => (l.id === row.id ? row : l)) : [...s.habitLogs, row],
    }));
    await get().recalcGoals();
    await get().syncAchievements();
    await get().updateChallengeProgress();
  },

  addNutrition: async (input) => {
    const { userId } = get();
    if (!userId) return;
    const row: NutritionLog = { id: uid('nl'), user_id: userId, created_at: nowISO(), ...input };
    await backend().upsert('nutrition_logs', row);
    set((s) => ({ nutrition: [...s.nutrition, row] }));
  },

  joinChallenge: async (challengeId, onLeaderboard) => {
    const { userId, challengeMembers } = get();
    if (!userId || challengeMembers.some((c) => c.challenge_id === challengeId)) return;
    const row: ChallengeMember = {
      id: uid('cm'), challenge_id: challengeId, user_id: userId,
      joined_at: nowISO(), progress: 0, completed_at: null, on_leaderboard: onLeaderboard,
    };
    await backend().upsert('challenge_members', row);
    set((s) => ({ challengeMembers: [...s.challengeMembers, row] }));
    await get().updateChallengeProgress();
  },

  leaveChallenge: async (challengeId) => {
    const { challengeMembers } = get();
    const row = challengeMembers.find((c) => c.challenge_id === challengeId);
    if (!row) return;
    await backend().remove('challenge_members', row.id);
    set((s) => ({ challengeMembers: s.challengeMembers.filter((c) => c.id !== row.id) }));
  },

  /* ---------------- billing (sandbox) ---------------- */

  checkout: async ({ tier, cycle, currency, method }) => {
    const { userId, subscription } = get();
    if (!userId) throw new Error('Not signed in');
    const price = priceFor(tier, cycle, currency);
    const now = nowISO();
    const start = today();
    const sub: Subscription = {
      user_id: userId,
      tier, cycle, currency,
      status: 'active',
      price,
      started_at: subscription?.tier === tier ? subscription.started_at : start,
      current_period_end: periodEndFrom(start, cycle),
      cancel_at_period_end: false,
      payment_method: method,
      sandbox: true,
      created_at: subscription?.created_at ?? now,
      updated_at: now,
    };
    const record: PaymentRecord = {
      id: uid('pay'), user_id: userId,
      tier, cycle, amount: price, currency, method,
      status: 'paid', sandbox: true,
      description: `FitHub ${TIER_LABEL[tier]} — ${cycle} (sandbox)`,
      paid_at: now,
    };
    await backend().upsert('subscriptions', sub);
    await backend().upsert('payment_records', record);
    set((s) => ({ subscription: sub, payments: [record, ...s.payments] }));
    await get().notify({
      kind: 'membership',
      title: `Welcome to FitHub ${TIER_LABEL[tier]}`,
      body: `Your ${cycle} plan is active until ${sub.current_period_end}. Sandbox — no real charge was made.`,
      href: '/pricing',
    });
    return sub;
  },

  setCancelAtPeriodEnd: async (cancel) => {
    const { subscription } = get();
    if (!subscription) return;
    const next: Subscription = { ...subscription, cancel_at_period_end: cancel, updated_at: nowISO() };
    await backend().upsert('subscriptions', next);
    set({ subscription: next });
  },

  recalcGoals: async () => {
    const s = get();
    if (!s.goals.length) return;
    const updated: Goal[] = [];

    for (const goal of s.goals) {
      if (goal.archived) continue;
      const value = currentValueForGoal(goal, s);
      if (value === null) continue;
      const next: Goal = { ...goal, current_value: value };
      next.milestones = goal.milestones.map((m) => {
        const reached = goal.direction === 'increase' ? value >= m.value : value <= m.value;
        return reached && !m.reached_at ? { ...m, reached_at: nowISO() } : m;
      });
      next.status = goalStatus(next);
      if (next.status === 'achieved' && !next.achieved_at) next.achieved_at = nowISO();
      if (next.status !== 'achieved') next.achieved_at = null;
      if (
        next.current_value !== goal.current_value ||
        next.status !== goal.status ||
        next.achieved_at !== goal.achieved_at
      ) {
        updated.push(next);
        if (next.status === 'achieved' && goal.status !== 'achieved') {
          void get().notify({ kind: 'goal_progress', title: 'Goal achieved', body: goal.title, href: '/goals' });
          toast.brand('Goal achieved', goal.title);
        }
      }
    }

    if (updated.length) {
      await backend().upsertMany('goals', updated);
      set((st) => ({ goals: st.goals.map((g) => updated.find((u) => u.id === g.id) ?? g) }));
    }
  },

  syncAchievements: async () => {
    const s = get();
    if (!s.userId) return;
    const progress = evaluateAchievements({
      sessions: s.sessions, sets: s.sets, records: s.records, recovery: s.recovery,
      goals: s.goals, habits: s.habits, habitLogs: s.habitLogs,
      assessments: s.assessments, challengeMembers: s.challengeMembers,
      program: s.programs.find((p) => p.active) ?? null,
    });

    const changed: UserAchievement[] = [];
    const newlyEarned: string[] = [];
    for (const p of progress) {
      const existing = s.achievements.find((a) => a.achievement_id === p.id);
      if (p.earned && !existing) {
        changed.push({ id: uid('ua'), user_id: s.userId, achievement_id: p.id, earned_at: nowISO(), progress: 1 });
        newlyEarned.push(p.id);
      } else if (existing && Math.abs(existing.progress - p.progress) > 0.02 && !p.earned) {
        changed.push({ ...existing, progress: p.progress });
      } else if (!existing && p.progress > 0 && !p.earned) {
        changed.push({ id: uid('ua'), user_id: s.userId, achievement_id: p.id, earned_at: '', progress: p.progress });
      }
    }

    if (changed.length) {
      await backend().upsertMany('user_achievements', changed);
      set((st) => {
        const map = new Map(st.achievements.map((a) => [a.achievement_id, a]));
        for (const c of changed) map.set(c.achievement_id, c);
        return { achievements: [...map.values()] };
      });
    }

    for (const id of newlyEarned) {
      const def = ACHIEVEMENT_BY_ID[id];
      if (!def) continue;
      void get().notify({ kind: 'achievement', title: `Achievement unlocked — ${def.name}`, body: def.description, href: '/achievements' });
    }
  },

  activeProgram: () => get().programs.find((p) => p.active) ?? null,

  /* Challenge progress is derived from the user's own logs, so it stays
     correct even if they log a workout for a past date. */
  updateChallengeProgress: async () => {
    const s = get();
    if (!s.challengeMembers.length) return;
    const updated: ChallengeMember[] = [];

    for (const member of s.challengeMembers) {
      const challenge = s.challenges.find((c) => c.id === member.challenge_id);
      if (!challenge) continue;
      const inWindow = (d: ISODate) => d >= challenge.start_date && d <= challenge.end_date;
      let progress = 0;

      switch (challenge.metric) {
        case 'workouts':
          progress = s.sessions.filter((x) => x.status === 'completed' && inWindow(x.date)).length;
          break;
        case 'minutes':
          progress = Math.round(
            s.sessions.filter((x) => x.status === 'completed' && inWindow(x.date))
              .reduce((a, x) => a + x.duration_seconds / 60, 0),
          );
          break;
        case 'distance_km': {
          const ids = new Set(s.sessions.filter((x) => inWindow(x.date)).map((x) => x.id));
          progress = Math.round(
            s.sets.filter((x) => ids.has(x.session_id)).reduce((a, x) => a + (x.distance_km ?? 0), 0) * 10,
          ) / 10;
          break;
        }
        case 'steps': {
          const stepHabit = s.habits.find((h) => h.key === 'steps');
          progress = stepHabit
            ? s.habitLogs.filter((l) => l.habit_id === stepHabit.id && inWindow(l.date)).reduce((a, l) => a + l.value, 0)
            : 0;
          break;
        }
        case 'habit_days': {
          const days = new Set<string>();
          for (const l of s.habitLogs) {
            const habit = s.habits.find((h) => h.id === l.habit_id);
            if (habit && l.value >= habit.target && inWindow(l.date)) days.add(l.date);
          }
          for (const x of s.sessions) if (x.status === 'completed' && inWindow(x.date)) days.add(x.date);
          progress = days.size;
          break;
        }
        case 'sessions_of_type':
          progress = s.sessions.filter((x) => x.status === 'completed' && inWindow(x.date) && x.kind === 'cardio').length;
          break;
      }

      const completed = progress >= challenge.target;
      if (progress !== member.progress || (completed && !member.completed_at)) {
        updated.push({
          ...member,
          progress,
          completed_at: completed ? member.completed_at ?? nowISO() : null,
        });
      }
    }

    if (updated.length) {
      await backend().upsertMany('challenge_members', updated);
      set((st) => ({
        challengeMembers: st.challengeMembers.map((c) => updated.find((u) => u.id === c.id) ?? c),
      }));
      for (const u of updated) {
        if (u.completed_at && !s.challengeMembers.find((c) => c.id === u.id)?.completed_at) {
          const challenge = s.challenges.find((c) => c.id === u.challenge_id);
          if (challenge) toast.brand('Challenge complete', challenge.name);
        }
      }
    }
  },
}));

/* ------------------------------------------------------------------
   Local cache maintenance
   ------------------------------------------------------------------ */

const COLLECTION_TO_KEY: Partial<Record<Collection, keyof DataState>> = {
  assessments: 'assessments', goals: 'goals', programs: 'programs',
  workout_sessions: 'sessions', workout_sets: 'sets', personal_records: 'records',
  recovery_logs: 'recovery', niggles: 'niggles', body_measurements: 'measurements', progress_photos: 'photos',
  habit_definitions: 'habits', habit_logs: 'habitLogs', nutrition_logs: 'nutrition',
  payment_records: 'payments',
  user_achievements: 'achievements', challenge_members: 'challengeMembers',
  friendships: 'friendships', feed_posts: 'feed', notifications: 'notifications',
  messages: 'messages', memberships: 'memberships', gym_checkins: 'checkins',
  trainer_clients: 'trainerClients', trainer_notes: 'trainerNotes',
  challenges: 'challenges', membership_plans: 'plans', gym_equipment: 'equipment',
  maintenance_logs: 'maintenance', audit_logs: 'auditLogs',
};

const SINGLETONS: Partial<Record<Collection, keyof DataState>> = {
  fitness_profiles: 'fitnessProfile',
  user_preferences: 'preferences',
  nutrition_targets: 'nutritionTargets',
  subscriptions: 'subscription',
};

type SetFn = (partial: Partial<DataState> | ((s: DataState) => Partial<DataState>)) => void;

function applyLocal<C extends Collection>(setState: SetFn, get: () => DataState, collection: C, row: Row<C>) {
  const singleton = SINGLETONS[collection];
  if (singleton) {
    setState({ [singleton]: row } as unknown as Partial<DataState>);
    return;
  }
  const key = COLLECTION_TO_KEY[collection];
  if (!key) return;
  const list = (get()[key] as unknown as Array<{ id: string }>) ?? [];
  const id = (row as unknown as { id: string }).id;
  const idx = list.findIndex((x) => x.id === id);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? row : x)) : [...list, row];
  setState({ [key]: next } as unknown as Partial<DataState>);
}

function removeLocal(setState: SetFn, get: () => DataState, collection: Collection, id: string) {
  const key = COLLECTION_TO_KEY[collection];
  if (!key) return;
  const list = (get()[key] as unknown as Array<{ id: string }>) ?? [];
  setState({ [key]: list.filter((x) => x.id !== id) } as unknown as Partial<DataState>);
}

function groupSetsByExercise(sets: WorkoutSet[]): Array<[string, WorkoutSet[]]> {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = map.get(s.exercise_slug) ?? [];
    list.push(s);
    map.set(s.exercise_slug, list);
  }
  return [...map.entries()];
}

/** Reads a goal's live value from whichever collection actually owns it. */
function currentValueForGoal(goal: Goal, s: DataState): number | null {
  switch (goal.metric) {
    case 'body_weight': {
      const latest = s.measurements
        .filter((m) => m.weight_kg !== null)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return latest?.weight_kg ?? s.fitnessProfile?.weight_kg ?? null;
    }
    case 'body_measurement': {
      const key = (goal.ref ?? 'waist_cm') as keyof BodyMeasurement;
      const latest = s.measurements
        .filter((m) => typeof m[key] === 'number')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return latest ? (latest[key] as number) : null;
    }
    case 'lift_1rm': {
      if (!goal.ref) return null;
      const fromRecords = s.records
        .filter((r) => r.exercise_slug === goal.ref && (r.kind === 'weight_1rm' || r.kind === 'max_weight'))
        .reduce<number | null>((best, r) => (best === null || r.value > best ? r.value : best), null);
      const sessionDates = new Map(s.sessions.map((x) => [x.id, x.date]));
      const fromSets = s.sets
        .filter((x) => x.exercise_slug === goal.ref && x.completed && !x.is_warmup && sessionDates.has(x.session_id))
        .reduce<number | null>((best, x) => {
          const e = estimate1RM(x.weight_kg, x.reps);
          return e !== null && (best === null || e > best) ? e : best;
        }, null);
      if (fromRecords === null && fromSets === null) return null;
      return Math.max(fromRecords ?? 0, fromSets ?? 0);
    }
    case 'workouts_per_week': {
      const weekStart = startOfWeek(today(), s.preferences?.week_starts_on ?? 1);
      return s.sessions.filter((x) => x.status === 'completed' && x.date >= weekStart).length;
    }
    case 'run_distance': {
      const best = s.sets.reduce((a, x) => Math.max(a, x.distance_km ?? 0), 0);
      return best || null;
    }
    case 'run_time': {
      const paced = s.sets.filter((x) => (x.distance_km ?? 0) > 0 && (x.seconds ?? 0) > 0);
      if (!paced.length) return null;
      return Math.round(Math.min(...paced.map((x) => (x.seconds as number) / 60)));
    }
    case 'daily_steps': {
      const habit = s.habits.find((h) => h.key === 'steps');
      if (!habit) return null;
      const recent = s.habitLogs
        .filter((l) => l.habit_id === habit.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);
      if (!recent.length) return null;
      return Math.round(recent.reduce((a, l) => a + l.value, 0) / recent.length);
    }
    case 'habit_streak': {
      const habit = s.habits.find((h) => h.id === goal.ref || h.key === goal.ref);
      if (!habit) return null;
      const met = new Set(s.habitLogs.filter((l) => l.habit_id === habit.id && l.value >= habit.target).map((l) => l.date));
      let streak = 0;
      let cursor = today();
      if (!met.has(cursor)) cursor = addDays(cursor, -1);
      while (met.has(cursor) && streak < 400) { streak++; cursor = addDays(cursor, -1); }
      return streak;
    }
    default:
      return null;
  }
}

/* Convenience selectors used across the app ------------------------- */

export const selectTodaysSession = (s: DataState): WorkoutSession | null =>
  s.sessions.find((x) => x.date === today() && x.status !== 'skipped') ?? null;

export const selectActiveSession = (s: DataState): WorkoutSession | null =>
  s.sessions.find((x) => x.status === 'in_progress') ?? null;

export const selectTodaysProgramDay = (s: DataState) => {
  const program = s.programs.find((p) => p.active);
  if (!program) return null;
  return program.days.find((d) => d.weekday === weekdayOf(today())) ?? null;
};

export const selectSetsForSession = (s: DataState, sessionId: ID) =>
  s.sets.filter((x) => x.session_id === sessionId).sort((a, b) => a.set_index - b.set_index);

export const selectUnreadCount = (s: DataState) => s.notifications.filter((n) => !n.read_at).length;

/** The tier the user is actually entitled to right now. A canceled or lapsed
 *  subscription reads as free — no grace-period pretending. */
export const selectTier = (s: DataState): SubscriptionTier => {
  const sub = s.subscription;
  if (!sub || sub.status !== 'active') return 'free';
  if (sub.current_period_end < today()) return 'free';
  return sub.tier;
};

export function sessionDateMap(s: DataState): Map<string, ISODate> {
  return new Map(s.sessions.map((x) => [x.id, x.date]));
}

export { toISODate, isGoalMet };
