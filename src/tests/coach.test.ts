import { describe, expect, it } from 'vitest';
import { askFitCoach } from '@/lib/coach/fitcoach';
import type { DataState } from '@/store/data';
import { defaultPreferences, defaultNutritionTargets, emptyFitnessProfile } from '@/lib/defaults';
import { generateProgram } from '@/lib/fitness/program';
import { addDays, today } from '@/lib/date';
import type { WorkoutSession, WorkoutSet } from '@/types';

const USER = 'u1';

function baseState(over: Partial<DataState> = {}): DataState {
  const fitnessProfile = { ...emptyFitnessProfile(USER, 'Alex'), days_per_week: 3, preferred_days: [1, 3, 5] as never };
  return {
    userId: USER, loading: false, loaded: true, error: null,
    fitnessProfile,
    preferences: defaultPreferences(USER),
    nutritionTargets: defaultNutritionTargets(USER),
    assessments: [], goals: [], programs: [], sessions: [], sets: [], records: [],
    recovery: [], measurements: [], photos: [], habits: [], habitLogs: [], nutrition: [],
    achievements: [], challengeMembers: [], friendships: [], feed: [], notifications: [],
    messages: [], memberships: [], checkins: [], trainerClients: [], trainerNotes: [],
    challenges: [], gym: null, plans: [], equipment: [], maintenance: [],
    directory: [], allMemberships: [], allCheckins: [], auditLogs: [],
    ...over,
  } as unknown as DataState;
}

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 's1', user_id: USER, program_id: null, program_day_id: null, date: today(),
  title: 'Push', kind: 'push', status: 'completed',
  started_at: `${today()}T18:00:00.000Z`, ended_at: `${today()}T19:00:00.000Z`,
  duration_seconds: 3600, planned: [], difficulty: 3, feeling: 'good', notes: '',
  est_calories: null, created_at: `${today()}T18:00:00.000Z`,
  ...over,
});

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 'set1', session_id: 's1', exercise_slug: 'barbell-bench-press', set_index: 0,
  weight_kg: 60, reps: 10, seconds: null, distance_km: null, rpe: null,
  completed: true, is_warmup: false, logged_at: `${today()}T18:10:00.000Z`,
  ...over,
});

describe('askFitCoach', () => {
  it('never invents data it does not have', () => {
    const answer = askFitCoach('How did I perform this week?', baseState());
    expect(answer.missingData).toBe(true);
    expect(answer.text).toMatch(/Nothing logged/i);
  });

  it('points a user with no programme at creating one', () => {
    const answer = askFitCoach('What is my workout today?', baseState());
    expect(answer.missingData).toBe(true);
    expect(answer.link?.to).toBe('/program');
  });

  it("describes today's session from the active programme", () => {
    const profile = emptyFitnessProfile(USER, 'Alex');
    const program = generateProgram(profile, USER, { seed: 5 });
    const answer = askFitCoach('what should I do today', baseState({ programs: [program] }));
    expect(answer.text.length).toBeGreaterThan(20);
    // Either a training day with a link to start, or an honest rest-day answer.
    expect(answer.link?.to === '/workout' || /rest day/i.test(answer.text)).toBe(true);
  });

  it('summarises the week from logged sessions', () => {
    const state = baseState({
      sessions: [session(), session({ id: 's2', date: addDays(today(), -2) })],
      sets: [set(), set({ id: 'set2', session_id: 's2' })],
    });
    const answer = askFitCoach('How did I perform this week?', state);
    expect(answer.text).toMatch(/sessions done this week/i);
    expect(answer.facts?.some((f) => f.label === 'Working sets')).toBe(true);
  });

  it('reports exercise progress only when it has been logged', () => {
    const empty = askFitCoach('show my bench press progress', baseState());
    expect(empty.missingData).toBe(true);

    const withData = askFitCoach('show my bench press progress', baseState({
      sessions: [session(), session({ id: 's2', date: addDays(today(), -7) })],
      sets: [set(), set({ id: 'set2', session_id: 's2', weight_kg: 55 })],
    }));
    expect(withData.missingData).toBeUndefined();
    expect(withData.link?.to).toBe('/exercises/barbell-bench-press');
  });

  it('suggests real alternatives for an exercise', () => {
    const answer = askFitCoach('what can replace cable rows?', baseState());
    expect(answer.facts?.length ?? 0).toBeGreaterThan(0);
  });

  it('diagnoses a plateau from consistency, recovery and load data', () => {
    const answer = askFitCoach('why am I not progressing?', baseState({
      sessions: [session()],
      programs: [generateProgram(emptyFitnessProfile(USER), USER, { seed: 1 })],
    }));
    expect(answer.text).toMatch(/consistency/i);
  });

  it('admits when a question is outside what it can answer', () => {
    const answer = askFitCoach('what is the capital of France?', baseState());
    expect(answer.text).toMatch(/could not match/i);
    expect(answer.suggestions?.length ?? 0).toBeGreaterThan(0);
  });

  it('returns a prompt rather than an error for an empty question', () => {
    expect(askFitCoach('   ', baseState()).text).toMatch(/Ask me anything/i);
  });

  it('never throws on a completely empty account for any starter question', () => {
    const state = baseState();
    const questions = [
      'What is my workout today?', 'How did I perform this week?',
      'What muscles did I train yesterday?', 'What should I do on a recovery day?',
      'Why am I not progressing?', 'Show my bench press progress',
      'What exercises can replace cable rows?', 'How consistent was I this month?',
      'How is my recovery?', 'What are my goals?', 'Show my records',
      'What is my fitscore?', 'How much volume have I lifted?',
      'Am I training every muscle?', 'How is my nutrition?',
    ];
    for (const q of questions) {
      const answer = askFitCoach(q, state);
      expect(typeof answer.text).toBe('string');
      expect(answer.text.length).toBeGreaterThan(10);
    }
  });
});
