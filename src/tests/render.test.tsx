import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { defaultNutritionTargets, defaultPreferences, emptyFitnessProfile } from '@/lib/defaults';
import { generateProgram } from '@/lib/fitness/program';
import { EXERCISES } from '@/data/exercises';
import { habitsFromTemplates } from '@/data/habits';
import { seedChallenges } from '@/data/challenges';
import { addDays, nowISO, today, weekdayOf } from '@/lib/date';
import { uid } from '@/lib/id';
import type { Profile, WorkoutSession, WorkoutSet } from '@/types';

import BodyMap from '@/pages/BodyMap';
import Pricing from '@/pages/Pricing';
import Walk from '@/pages/Walk';

import Dashboard from '@/pages/Dashboard';
import Program from '@/pages/Program';
import WorkoutToday from '@/pages/WorkoutToday';
import Goals from '@/pages/Goals';
import Progress from '@/pages/Progress';
import CalendarPage from '@/pages/CalendarPage';
import Recovery from '@/pages/Recovery';
import Nutrition from '@/pages/Nutrition';
import Habits from '@/pages/Habits';
import Exercises from '@/pages/Exercises';
import EquipmentGuides from '@/pages/EquipmentGuides';
import MyGym from '@/pages/MyGym';
import Book from '@/pages/Book';
import GymSettings from '@/pages/admin/GymSettings';
import Desk from '@/pages/admin/Desk';
import Practice from '@/pages/Practice';
import ExerciseDetail from '@/pages/ExerciseDetail';
import Timers from '@/pages/Timers';
import Challenges from '@/pages/Challenges';
import Achievements from '@/pages/Achievements';
import Records from '@/pages/Records';
import Coach from '@/pages/Coach';
import WeeklyReview from '@/pages/WeeklyReview';
import MonthlyReport from '@/pages/MonthlyReport';
import Friends from '@/pages/Friends';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/Settings';
import More from '@/pages/More';
import NotFound from '@/pages/NotFound';
import Landing from '@/pages/Landing';
import SignIn from '@/pages/auth/SignIn';
import SignUp from '@/pages/auth/SignUp';
import TrainerDashboard from '@/pages/trainer/TrainerDashboard';
import Attendance from '@/pages/admin/Attendance';
import Members from '@/pages/admin/Members';
import Equipment from '@/pages/admin/Equipment';
import GymAnalytics from '@/pages/admin/GymAnalytics';
import AuditLogPage from '@/pages/admin/AuditLogPage';

const USER = 'user-1';

const profile: Profile = {
  id: USER, email: 'alex@example.com', full_name: 'Alex Rivera',
  avatar_color: '#B9F227', role: 'admin', gym_id: 'gym-1',
  created_at: nowISO(), onboarded: true, assessment_done: true,
};

function seedStores(empty = false) {
  useAuth.setState({ status: 'authed', profile, error: null, busy: false });

  const fitnessProfile = emptyFitnessProfile(USER, 'Alex');
  fitnessProfile.weight_kg = 78;
  fitnessProfile.height_cm = 179;
  fitnessProfile.birth_date = '1994-06-12';
  fitnessProfile.equipment = ['bodyweight', 'dumbbells', 'barbell', 'bench', 'squat_rack', 'cable', 'machine'];

  const program = generateProgram(fitnessProfile, USER, { seed: 7 });
  const habits = habitsFromTemplates(USER, ['water', 'sleep', 'steps']);

  const sessions: WorkoutSession[] = empty ? [] : [0, 2, 4, 7].map((d, i) => ({
    id: `ses-${i}`, user_id: USER, program_id: program.id, program_day_id: null,
    date: addDays(today(), -d), title: 'Push', kind: 'push', status: 'completed',
    started_at: `${addDays(today(), -d)}T18:00:00.000Z`,
    ended_at: `${addDays(today(), -d)}T19:02:00.000Z`,
    duration_seconds: 3720, planned: program.days[0]?.exercises ?? [],
    difficulty: 3, feeling: 'good', notes: 'Felt strong.', est_calories: 420,
    created_at: nowISO(),
  }));

  const sets: WorkoutSet[] = empty ? [] : sessions.flatMap((s, i) =>
    [0, 1, 2].map((n) => ({
      id: `set-${i}-${n}`, session_id: s.id, exercise_slug: 'barbell-bench-press',
      set_index: n, weight_kg: 60 + i * 2.5, reps: 10, seconds: null,
      distance_km: null, rpe: null, completed: true, is_warmup: false, logged_at: nowISO(),
    })),
  );

  useData.setState({
    userId: USER, loaded: true, loading: false, error: null,
    fitnessProfile,
    preferences: defaultPreferences(USER),
    nutritionTargets: defaultNutritionTargets(USER),
    programs: empty ? [] : [program],
    sessions, sets,
    goals: empty ? [] : [{
      id: uid('goal'), user_id: USER, title: 'Bench press 80 kg', metric: 'lift_1rm',
      ref: 'barbell-bench-press', unit: 'kg', start_value: 60, target_value: 80,
      current_value: 70, direction: 'increase', start_date: addDays(today(), -30),
      target_date: addDays(today(), 60), status: 'improving', milestones: [],
      achieved_at: null, archived: false, created_at: nowISO(),
    }],
    records: empty ? [] : [{
      id: uid('pr'), user_id: USER, exercise_slug: 'barbell-bench-press', kind: 'max_weight',
      value: 67.5, unit: 'kg', reps: 10, weight_kg: 67.5, session_id: 'ses-0',
      achieved_at: nowISO(), previous_value: 65,
    }],
    recovery: empty ? [] : [{
      id: uid('rec'), user_id: USER, date: today(), sleep_hours: 7.5, sleep_quality: 4,
      energy: 4, soreness: 2, stress: 2, mood: 4, score: 82, note: '', created_at: nowISO(),
    }],
    niggles: empty ? [] : [{
      id: uid('ngl'), user_id: USER, muscle: 'shoulders', side: 'left', severity: 2,
      note: 'Pinches at the top of a press', started_date: addDays(today(), -4),
      resolved_date: null, created_at: nowISO(),
    }],
    // A Pro subscription so the gated pages render their real content; the
    // empty-account pass covers the paywall path instead.
    subscription: empty ? null : {
      user_id: USER, tier: 'pro', cycle: 'yearly', status: 'active', currency: 'USD',
      price: 79.99, started_at: addDays(today(), -40), current_period_end: addDays(today(), 325),
      cancel_at_period_end: false,
      payment_method: { kind: 'card', brand: 'visa', last4: '4242', wallet_account: null },
      sandbox: true, created_at: nowISO(), updated_at: nowISO(),
    },
    payments: empty ? [] : [{
      id: uid('pay'), user_id: USER, tier: 'pro', cycle: 'yearly', amount: 79.99,
      currency: 'USD', method: { kind: 'card', brand: 'visa', last4: '4242', wallet_account: null },
      status: 'paid', sandbox: true, description: 'FitHub Pro — yearly (sandbox)', paid_at: nowISO(),
    }],
    measurements: empty ? [] : [
      { id: uid('bm'), user_id: USER, date: addDays(today(), -30), weight_kg: 80, body_fat_pct: null, waist_cm: 86, chest_cm: 102, arm_cm: 36, thigh_cm: 58, hip_cm: 98, neck_cm: null, note: '' },
      { id: uid('bm'), user_id: USER, date: today(), weight_kg: 78, body_fat_pct: null, waist_cm: 84, chest_cm: 103, arm_cm: 37, thigh_cm: 58, hip_cm: 97, neck_cm: null, note: '' },
    ],
    habits: empty ? [] : habits,
    habitLogs: empty ? [] : habits.map((h) => ({ id: uid('hl'), user_id: USER, habit_id: h.id, date: today(), value: h.target })),
    nutrition: empty ? [] : [{
      id: uid('nl'), user_id: USER, date: today(), slot: 'breakfast', name: 'Oats, dry (50 g)',
      servings: 1, calories: 190, protein_g: 6.7, carbs_g: 33, fat_g: 3.4, created_at: nowISO(),
    }],
    achievements: [], assessments: [], photos: [],
    challenges: seedChallenges('gym-1'),
    challengeMembers: [], friendships: [], feed: [], notifications: [], messages: [],
    memberships: [], checkins: [], trainerClients: [], trainerNotes: [],
    gym: {
      id: 'gym-1', name: 'FitHub Central', join_code: 'FITH-CTR', description: 'A test gym.',
      address: '18 Riverside Way', phone: '+1 555 0142', email: 'hello@example.com',
      timezone: 'UTC', open_hour: 6, close_hour: 23, capacity: 220, currency: 'USD',
      logo_data_url: null, photos: [], created_by: null, active: true, created_at: nowISO(),
    },
    plans: [{
      id: 'plan-1', gym_id: 'gym-1', name: 'Standard', price: 39, currency: 'USD',
      months: 6, perks: ['Full access'], includes_classes: true,
    }],
    gymClasses: [{
      id: 'cls-1', gym_id: 'gym-1', name: 'Spin', description: 'Indoor cycling.',
      weekday: weekdayOf(addDays(today(), 1)), start_time: '18:00', duration_minutes: 45,
      capacity: 20, trainer_id: null, price: 14, active: true,
    }],
    equipment: [{
      id: 'eq-1', gym_id: 'gym-1', name: 'Treadmill 01', asset_tag: 'FH-001', category: 'Cardio',
      location: 'Cardio floor', status: 'available', last_inspection: addDays(today(), -20),
      next_maintenance: addDays(today(), 70), notes: '', usage_hours: 400,
    }],
    maintenance: [],
    directory: [profile, {
      id: 'member-2', email: 'maya@example.com', full_name: 'Maya Silva', avatar_color: '#7C5CFF',
      role: 'member', gym_id: 'gym-1', created_at: nowISO(), onboarded: true, assessment_done: false,
    }],
    allMemberships: [{
      id: 'mem-1', user_id: 'member-2', gym_id: 'gym-1', plan_id: 'plan-1', status: 'active',
      start_date: addDays(today(), -60), end_date: addDays(today(), 120), member_code: 'FH-AB12-CD',
      auto_renew: true, payment: 'paid',
    }],
    allCheckins: [{
      id: 'ci-1', user_id: 'member-2', gym_id: 'gym-1', checked_in_at: nowISO(),
      checked_out_at: null, method: 'qr', recorded_by: null,
    }],
    auditLogs: [{
      id: 'aud-1', actor_id: USER, actor_email: profile.email, action: 'membership.update',
      entity: 'memberships', entity_id: 'mem-1', meta: { status: 'active' }, created_at: nowISO(),
    }],
  });
}

function renderPage(ui: ReactElement, route = '/') {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/* Recharts logs width/height warnings in jsdom because it cannot measure. */
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
/** React logs correctness problems (bad keys, invalid nesting) via console.error. */
let reactErrors: string[] = [];

beforeEach(() => {
  localStorage.clear();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  reactErrors = [];
  error = vi.spyOn(console, 'error').mockImplementation((...args) => {
    reactErrors.push(String(args[0]));
  });
});

afterEach(() => {
  cleanup();
  warn.mockRestore();
  error.mockRestore();
});

const PAGES: Array<[string, () => ReactElement, string?]> = [
  ['Landing', () => <Landing />],
  ['SignIn', () => <SignIn />],
  ['SignUp', () => <SignUp />],
  ['Dashboard', () => <Dashboard />],
  ['Program', () => <Program />],
  ['WorkoutToday', () => <WorkoutToday />],
  ['Goals', () => <Goals />],
  ['Progress', () => <Progress />],
  ['Calendar', () => <CalendarPage />],
  ['Recovery', () => <Recovery />],
  ['BodyMap', () => <BodyMap />],
  ['Pricing', () => <Pricing />],
  ['Walk', () => <Walk />],
  ['Nutrition', () => <Nutrition />],
  ['Habits', () => <Habits />],
  ['Exercises', () => <Exercises />],
  ['EquipmentGuides', () => <EquipmentGuides />],
  ['MyGym', () => <MyGym />],
  ['Book', () => <Book />],
  ['GymSettings', () => <GymSettings />],
  ['Desk', () => <Desk />],
  ['Practice', () => <Practice />],
  ['Timers', () => <Timers />],
  ['Challenges', () => <Challenges />],
  ['Achievements', () => <Achievements />],
  ['Records', () => <Records />],
  ['Coach', () => <Coach />],
  ['WeeklyReview', () => <WeeklyReview />],
  ['MonthlyReport', () => <MonthlyReport />],
  ['Friends', () => <Friends />],
  ['Profile', () => <ProfilePage />],
  ['Settings', () => <SettingsPage />],
  ['More', () => <More />],
  ['NotFound', () => <NotFound />],
  ['TrainerDashboard', () => <TrainerDashboard />],
  ['Attendance', () => <Attendance />],
  ['Members', () => <Members />],
  ['Equipment', () => <Equipment />],
  ['GymAnalytics', () => <GymAnalytics />],
  ['AuditLog', () => <AuditLogPage />],
];

describe('every page renders with data', () => {
  beforeEach(() => seedStores(false));

  for (const [name, factory] of PAGES) {
    it(`${name} renders without throwing`, () => {
      expect(() => renderPage(factory())).not.toThrow();
      // A page that silently rendered nothing would still "not throw".
      expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      expect(reactErrors, `React errors on ${name}`).toEqual([]);
    });
  }

  it('ExerciseDetail renders a real exercise with its instructions', () => {
    render(
      <MemoryRouter initialEntries={['/exercises/barbell-bench-press']}>
        <Routes><Route path="/exercises/:slug" element={<ExerciseDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Barbell Bench Press');
    expect(document.body.textContent).toMatch(/Step-by-step/);
    expect(document.body.textContent).toMatch(/Watch the movement/);
    expect(screen.getByRole('img', { name: /Barbell Bench Press starting position/i }).getAttribute('src'))
      .toContain('bench-press-start.webp');
    expect(screen.getByRole('link', { name: /reference videos on YouTube/i }).getAttribute('href'))
      .toContain('youtube.com/results?search_query=');
    expect(document.body.textContent).toMatch(/Common mistakes/);
    expect(document.body.textContent).toMatch(/Safety/);
    expect(reactErrors).toEqual([]);
  });

  it('ExerciseDetail handles an unknown slug without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/exercises/not-a-real-exercise']}>
        <Routes><Route path="/exercises/:slug" element={<ExerciseDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(document.body.textContent).toMatch(/not found/i);
    expect(reactErrors).toEqual([]);
  });

  it('keeps visual form guides locked on the Free plan', () => {
    useData.setState({ subscription: null });
    render(
      <MemoryRouter initialEntries={['/exercises/push-up']}>
        <Routes><Route path="/exercises/:slug" element={<ExerciseDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(document.body.textContent).toMatch(/Visual form guide/);
    expect(document.body.textContent).toMatch(/Plus & Pro/);
    expect(screen.queryByRole('img', { name: /Push-Up starting position/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /reference videos on YouTube/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Unlock visual guides/i }).getAttribute('href')).toBe('/pricing');
    expect(reactErrors).toEqual([]);
  });
});

describe('every page renders on a brand-new empty account', () => {
  beforeEach(() => seedStores(true));

  for (const [name, factory] of PAGES) {
    it(`${name} renders with no data`, () => {
      expect(() => renderPage(factory())).not.toThrow();
      expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      expect(reactErrors, `React errors on ${name}`).toEqual([]);
    });
  }
});

/**
 * A signed-up user who has not finished onboarding has `fitnessProfile: null`.
 * Selectors that fell back to a fresh `['bodyweight']` array on every call made
 * Zustand see a new snapshot each render and looped until React gave up — which
 * crashed the whole page. The seeded passes above never caught it because they
 * always provide a profile.
 */
describe('pages that read equipment survive a missing fitness profile', () => {
  beforeEach(() => {
    seedStores(true);
    useData.setState({ fitnessProfile: null });
  });

  const EQUIPMENT_PAGES: Array<[string, () => ReactElement]> = [
    ['WorkoutToday', () => <WorkoutToday />],
    ['Exercises', () => <Exercises />],
  ['EquipmentGuides', () => <EquipmentGuides />],
  ['Practice', () => <Practice />],
  ];

  for (const [name, factory] of EQUIPMENT_PAGES) {
    it(`${name} renders without an update-depth loop`, () => {
      expect(() => renderPage(factory())).not.toThrow();
      expect(reactErrors.join(' ')).not.toMatch(/Maximum update depth/i);
      expect(reactErrors, `React errors on ${name}`).toEqual([]);
    });
  }

  it('ExerciseDetail renders without an update-depth loop', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/exercises/barbell-bench-press']}>
        <Routes><Route path="/exercises/:slug" element={<ExerciseDetail />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
    expect(reactErrors.join(' ')).not.toMatch(/Maximum update depth/i);
    expect(reactErrors).toEqual([]);
  });
});

describe('key content', () => {
  beforeEach(() => seedStores(false));

  it('the landing page leads with the product promise', () => {
    renderPage(<Landing />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/BUILD YOUR/i);
  });

  it('the dashboard answers "what should I do today"', () => {
    renderPage(<Dashboard />);
    expect(document.body.textContent).toMatch(/workout|rest day/i);
  });

  it('the exercise library lists every exercise', () => {
    renderPage(<Exercises />);
    // Derived, not hardcoded: adding an exercise should not fail this test.
    expect(document.body.textContent).toContain(`${EXERCISES.length} exercises`);
  });
});
