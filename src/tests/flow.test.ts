import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { backend } from '@/lib/db';
import { idbWipe } from '@/lib/storage/idb';
import { generateProgram } from '@/lib/fitness/program';
import { emptyFitnessProfile } from '@/lib/defaults';
import { habitsFromTemplates } from '@/data/habits';
import { buildMilestones } from '@/lib/fitness/goals';
import { computeFitScore } from '@/lib/fitness/fitscore';
import { computeStreak } from '@/lib/fitness/streaks';
import { uid } from '@/lib/id';
import { addDays, nowISO, today } from '@/lib/date';
import { periodEndFrom } from '@/lib/billing/plans';
import type { Goal, WorkoutSet } from '@/types';

/**
 * End-to-end through the real store and the real local backend:
 * register -> profile -> programme -> workout -> sets -> finish -> records,
 * goals, achievements and recovery all updating from that one session.
 *
 * jsdom has no IndexedDB, so this also exercises the localStorage fallback
 * inside the storage layer.
 */
describe('the core FitHub loop', () => {
  beforeEach(async () => {
    localStorage.clear();
    await idbWipe();
    useData.getState().reset();
    useAuth.setState({ status: 'anon', profile: null, error: null, busy: false });
  });

  it('carries a new user from sign-up through a completed workout', async () => {
    /* ---- register ------------------------------------------------------ */
    const created = await useAuth.getState().signUp({
      email: 'Alex@Example.com  ',
      password: 'correct-horse-9',
      full_name: 'Alex Rivera',
      role: 'member',
    });
    expect(created).toBe(true);

    const profile = useAuth.getState().profile!;
    expect(profile.email).toBe('alex@example.com'); // normalised
    expect(profile.onboarded).toBe(false);

    /* ---- onboarding ---------------------------------------------------- */
    const fitnessProfile = emptyFitnessProfile(profile.id, 'Alex');
    fitnessProfile.weight_kg = 78;
    fitnessProfile.height_cm = 179;
    fitnessProfile.days_per_week = 3;
    fitnessProfile.equipment = ['bodyweight', 'dumbbells', 'barbell', 'bench', 'squat_rack'];

    await backend().upsert('fitness_profiles', fitnessProfile);
    const program = generateProgram(fitnessProfile, profile.id, { seed: 42 });
    await backend().upsert('programs', program);
    for (const habit of habitsFromTemplates(profile.id, ['water', 'steps'])) {
      await backend().upsert('habit_definitions', habit);
    }

    const goal: Goal = {
      id: uid('goal'), user_id: profile.id, title: 'Bench press 80 kg', metric: 'lift_1rm',
      ref: 'barbell-bench-press', unit: 'kg', start_value: 60, target_value: 80,
      current_value: 60, direction: 'increase', start_date: addDays(today(), -14),
      target_date: addDays(today(), 70), status: 'starting',
      milestones: buildMilestones(60, 80, 'kg'), achieved_at: null, archived: false,
      created_at: nowISO(),
    };
    await backend().upsert('goals', goal);
    await useAuth.getState().updateProfile({ onboarded: true });

    /* ---- load ----------------------------------------------------------- */
    await useData.getState().load(profile.id, 'member');
    const loaded = useData.getState();
    expect(loaded.loaded).toBe(true);
    expect(loaded.fitnessProfile?.weight_kg).toBe(78);
    expect(loaded.programs).toHaveLength(1);
    expect(loaded.programs[0].days).toHaveLength(7);
    expect(loaded.habits).toHaveLength(2);
    expect(loaded.preferences).not.toBeNull();
    // Privacy must default to closed.
    expect(loaded.preferences!.privacy.profile_visibility).toBe('private');
    expect(loaded.preferences!.privacy.share_workouts).toBe(false);

    /* ---- start a session ------------------------------------------------ */
    const session = await useData.getState().startSession({
      title: 'Push Day',
      kind: 'push',
      planned: [{
        id: uid('pe'), exercise_slug: 'barbell-bench-press', order: 0, sets: 3,
        target_reps: 10, target_seconds: null, target_weight_kg: 70,
        rest_seconds: 90, notes: '', superset_group: null,
      }],
      programId: program.id,
    });
    expect(session.status).toBe('in_progress');
    expect(useData.getState().sessions).toHaveLength(1);

    /* ---- log sets -------------------------------------------------------- */
    const mkSet = (i: number, weight: number, reps: number): WorkoutSet => ({
      id: uid('set'), session_id: session.id, exercise_slug: 'barbell-bench-press',
      set_index: i, weight_kg: weight, reps, seconds: null, distance_km: null, rpe: null,
      completed: true, is_warmup: false, logged_at: nowISO(),
    });
    await useData.getState().logSet(mkSet(0, 70, 10));
    await useData.getState().logSet(mkSet(1, 70, 10));
    await useData.getState().logSet(mkSet(2, 70, 9));
    // A warm-up must never count toward volume or records.
    await useData.getState().logSet({ ...mkSet(3, 40, 12), is_warmup: true });
    expect(useData.getState().sets).toHaveLength(4);

    /* ---- finish ---------------------------------------------------------- */
    const result = await useData.getState().finishSession(session.id, {
      durationSeconds: 3120,
      difficulty: 4,
      feeling: 'good',
      notes: 'Left shoulder felt fine today.',
    });

    expect(result.session.status).toBe('completed');
    expect(result.session.duration_seconds).toBe(3120);
    // Calories are estimated only because a bodyweight is known.
    expect(result.session.est_calories).toBeGreaterThan(0);

    /* ---- records --------------------------------------------------------- */
    expect(result.newRecords.length).toBeGreaterThan(0);
    const heaviest = result.newRecords.find((r) => r.kind === 'max_weight');
    expect(heaviest?.value).toBe(70);
    expect(heaviest?.previous_value).toBeNull();

    /* ---- goal auto-updated from the logged sets -------------------------- */
    const updatedGoal = useData.getState().goals.find((g) => g.id === goal.id)!;
    expect(updatedGoal.current_value).toBeGreaterThan(60);
    expect(updatedGoal.status).not.toBe('starting');

    /* ---- achievements ---------------------------------------------------- */
    const earned = useData.getState().achievements.filter((a) => a.earned_at);
    expect(earned.some((a) => a.achievement_id === 'first-step')).toBe(true);

    /* ---- notifications --------------------------------------------------- */
    expect(useData.getState().notifications.some((n) => n.kind === 'achievement')).toBe(true);

    /* ---- recovery check-in ----------------------------------------------- */
    const recovery = await useData.getState().saveRecovery({
      date: today(), sleep_hours: 8, sleep_quality: 5, energy: 4, soreness: 2, stress: 2,
    });
    expect(recovery.score).toBeGreaterThan(70);
    // Saving twice for the same day updates rather than duplicating.
    await useData.getState().saveRecovery({ date: today(), energy: 2 });
    expect(useData.getState().recovery).toHaveLength(1);

    /* ---- habits ----------------------------------------------------------- */
    const waterHabit = useData.getState().habits.find((h) => h.key === 'water')!;
    await useData.getState().logHabit(waterHabit.id, today(), 2500);
    await useData.getState().logHabit(waterHabit.id, today(), 3000);
    expect(useData.getState().habitLogs.filter((l) => l.habit_id === waterHabit.id)).toHaveLength(1);
    expect(useData.getState().habitLogs[0].value).toBe(3000);

    /* ---- derived state ---------------------------------------------------- */
    const s = useData.getState();
    const score = computeFitScore({
      sessions: s.sessions, recovery: s.recovery, goals: s.goals, records: s.records,
      program: s.programs[0], targetSessionsPerWeek: 3,
    });
    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThanOrEqual(1000);
    expect(computeStreak(s.sessions, s.programs[0]).current).toBeGreaterThanOrEqual(1);
  });

  it('rejects a duplicate email and a wrong password', async () => {
    await useAuth.getState().signUp({
      email: 'dupe@example.com', password: 'correct-horse-9', full_name: 'A', role: 'member',
    });
    useAuth.setState({ status: 'anon', profile: null });

    const again = await useAuth.getState().signUp({
      email: 'dupe@example.com', password: 'another-pass-1', full_name: 'B', role: 'member',
    });
    expect(again).toBe(false);
    expect(useAuth.getState().error).toMatch(/already exists/i);

    const wrong = await useAuth.getState().signIn('dupe@example.com', 'not-the-password');
    expect(wrong).toBe(false);
    // The message must not reveal whether the email exists.
    expect(useAuth.getState().error).toBe('Email or password is incorrect.');

    const right = await useAuth.getState().signIn('DUPE@example.com', 'correct-horse-9');
    expect(right).toBe(true);
  });

  it('durably saves a programme and the selected sandbox billing period before refresh', async () => {
    await useAuth.getState().signUp({
      email: 'persist@example.com', password: 'correct-horse-9', full_name: 'Persistent User', role: 'member',
    });
    const id = useAuth.getState().profile!.id;
    const fitnessProfile = emptyFitnessProfile(id, 'Persistent');
    const program = generateProgram(fitnessProfile, id, { seed: 77 });
    await backend().upsert('fitness_profiles', fitnessProfile);
    await backend().upsert('programs', program);
    await useData.getState().load(id, 'member');

    const method = { kind: 'gcash', brand: null, last4: null, wallet_account: '09•• ••• 4567' } as const;
    const monthly = await useData.getState().checkout({ tier: 'plus', cycle: 'monthly', currency: 'PHP', method });
    expect(monthly.current_period_end).toBe(periodEndFrom(today(), 'monthly'));

    // jsdom has no IndexedDB, so this is the exact persistence fallback used
    // by browsers where IDB is blocked. The writes must exist before checkout
    // resolves; refreshing immediately after success must not lose them.
    const persisted = JSON.parse(localStorage.getItem('fithub:fallback') ?? '[]') as Array<{
      collection: string;
      data: { id?: string; user_id?: string; tier?: string };
    }>;
    expect(persisted.some((row) => row.collection === 'programs' && row.data.id === program.id)).toBe(true);
    expect(persisted.some((row) => row.collection === 'subscriptions' && row.data.user_id === id && row.data.tier === 'plus')).toBe(true);

    useData.getState().reset();
    await useData.getState().load(id, 'member');
    expect(useData.getState().programs.some((item) => item.id === program.id && item.active)).toBe(true);
    expect(useData.getState().subscription?.tier).toBe('plus');

    const yearly = await useData.getState().checkout({ tier: 'pro', cycle: 'yearly', currency: 'PHP', method });
    expect(yearly.current_period_end).toBe(periodEndFrom(today(), 'yearly'));
    expect(yearly.current_period_end).not.toBe(monthly.current_period_end);
  });

  it('still reloads the programme when one optional account query fails', async () => {
    await useAuth.getState().signUp({
      email: 'partial-load@example.com', password: 'correct-horse-9', full_name: 'Partial Load', role: 'member',
    });
    const id = useAuth.getState().profile!.id;
    const fitnessProfile = emptyFitnessProfile(id, 'Partial');
    const program = generateProgram(fitnessProfile, id, { seed: 88 });
    const db = backend();
    await db.upsert('fitness_profiles', fitnessProfile);
    await db.upsert('programs', program);

    const originalGet = db.get.bind(db);
    const getSpy = vi.spyOn(db, 'get').mockImplementation((async (collection, key) => {
      if (collection === 'subscriptions') throw new Error('billing table unavailable');
      return originalGet(collection, key);
    }) as typeof db.get);

    useData.getState().reset();
    try {
      await useData.getState().load(id, 'member');
    } finally {
      getSpy.mockRestore();
    }

    expect(useData.getState().loaded).toBe(true);
    expect(useData.getState().programs.some((item) => item.id === program.id)).toBe(true);
    expect(useData.getState().error).toMatch(/subscription/i);
  });

  it('rejects a too-short password', async () => {
    const ok = await useAuth.getState().signUp({
      email: 'short@example.com', password: 'abc', full_name: 'C', role: 'member',
    });
    expect(ok).toBe(false);
    expect(useAuth.getState().error).toMatch(/at least 8/i);
  });

  it('discards an abandoned session that logged nothing', async () => {
    await useAuth.getState().signUp({
      email: 'quit@example.com', password: 'correct-horse-9', full_name: 'D', role: 'member',
    });
    const id = useAuth.getState().profile!.id;
    await useData.getState().load(id, 'member');

    const session = await useData.getState().startSession({ title: 'Test', kind: 'push', planned: [] });
    expect(useData.getState().sessions).toHaveLength(1);

    await useData.getState().abandonSession(session.id);
    expect(useData.getState().sessions).toHaveLength(0);
  });

  it('keeps an abandoned session that logged real sets, marked skipped', async () => {
    await useAuth.getState().signUp({
      email: 'partial@example.com', password: 'correct-horse-9', full_name: 'E', role: 'member',
    });
    const id = useAuth.getState().profile!.id;
    await useData.getState().load(id, 'member');

    const session = await useData.getState().startSession({ title: 'Test', kind: 'push', planned: [] });
    await useData.getState().logSet({
      id: uid('set'), session_id: session.id, exercise_slug: 'push-up', set_index: 0,
      weight_kg: null, reps: 12, seconds: null, distance_km: null, rpe: null,
      completed: true, is_warmup: false, logged_at: nowISO(),
    });

    await useData.getState().abandonSession(session.id);
    expect(useData.getState().sessions).toHaveLength(1);
    expect(useData.getState().sessions[0].status).toBe('skipped');
  });

  it('deletes every trace of an account on request', async () => {
    await useAuth.getState().signUp({
      email: 'gone@example.com', password: 'correct-horse-9', full_name: 'F', role: 'member',
    });
    const id = useAuth.getState().profile!.id;
    await useData.getState().load(id, 'member');
    await useData.getState().startSession({ title: 'Test', kind: 'push', planned: [] });
    expect(await backend().list('workout_sessions', id)).toHaveLength(1);

    await backend().deleteAccount(id);
    expect(await backend().list('workout_sessions', id)).toHaveLength(0);
    expect(await backend().get('profiles', id)).toBeNull();
    expect(await backend().currentProfile()).toBeNull();
  });
});
