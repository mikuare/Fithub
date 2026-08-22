import type {
  WorkoutSession, WorkoutSet, PersonalRecord, RecoveryLog, Goal,
  HabitDefinition, HabitLog, Assessment, ChallengeMember, Program,
} from '@/types';
import { ACHIEVEMENTS } from '@/data/achievements';
import { clamp } from '@/lib/utils';
import { addDays, startOfWeek, today } from '@/lib/date';
import { consistentWeeks } from './streaks';

export interface AchievementInput {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  records: PersonalRecord[];
  recovery: RecoveryLog[];
  goals: Goal[];
  habits: HabitDefinition[];
  habitLogs: HabitLog[];
  assessments: Assessment[];
  challengeMembers: ChallengeMember[];
  program: Program | null;
}

export interface AchievementProgress {
  id: string;
  progress: number; // 0..1
  earned: boolean;
  /** Human-readable "12 / 25" style position toward the achievement. */
  detail: string;
}

/**
 * Evaluates every achievement from the user's own data. Pure and idempotent,
 * so it can be re-run after any change without side effects.
 */
export function evaluateAchievements(input: AchievementInput): AchievementProgress[] {
  const completed = input.sessions.filter((s) => s.status === 'completed');
  const count = completed.length;

  const cardioSessions = completed.filter((s) => s.kind === 'cardio' || s.kind === 'recovery').length;
  const totalDistance = input.sets.reduce((a, s) => a + (s.distance_km ?? 0), 0);
  const totalVolume = input.sets.reduce(
    (a, s) => a + (s.completed && !s.is_warmup && s.weight_kg && s.reps ? s.weight_kg * s.reps : 0), 0,
  );

  const hourOf = (s: WorkoutSession) => (s.started_at ? new Date(s.started_at).getHours() : null);
  const morning = completed.filter((s) => { const h = hourOf(s); return h !== null && h < 9; }).length;
  const evening = completed.filter((s) => { const h = hourOf(s); return h !== null && h >= 20; }).length;

  const weeklyTarget = input.program?.days_per_week ?? 3;
  const weeksMet = consistentWeeks(completed, weeklyTarget);
  const thisWeekStart = startOfWeek(today(), 1);
  const thisWeek = completed.filter((s) => s.date >= thisWeekStart).length;

  const habitDays = habitCompletionDays(input.habits, input.habitLogs);
  const waterHabit = input.habits.find((h) => h.key === 'water');
  const stepHabit = input.habits.find((h) => h.key === 'steps');

  const ratio = (n: number, d: number) => clamp(d ? n / d : 0, 0, 1);
  const of = (n: number, d: number, unit = '') => `${Math.min(n, d).toLocaleString()} / ${d.toLocaleString()}${unit ? ` ${unit}` : ''}`;

  const table: Record<string, { progress: number; detail: string }> = {
    'first-step': { progress: ratio(count, 1), detail: of(count, 1, 'workout') },
    'consistency-builder': { progress: ratio(count, 10), detail: of(count, 10, 'workouts') },
    'quarter-century': { progress: ratio(count, 25), detail: of(count, 25, 'workouts') },
    'half-century': { progress: ratio(count, 50), detail: of(count, 50, 'workouts') },
    'century-club': { progress: ratio(count, 100), detail: of(count, 100, 'workouts') },

    'full-week': { progress: ratio(Math.max(thisWeek, weeksMet > 0 ? weeklyTarget : 0), weeklyTarget), detail: of(thisWeek, weeklyTarget, 'this week') },
    'four-weeks-strong': { progress: ratio(weeksMet, 4), detail: of(weeksMet, 4, 'weeks') },
    'twelve-weeks': { progress: ratio(weeksMet, 12), detail: of(weeksMet, 12, 'weeks') },

    'first-record': { progress: ratio(input.records.length, 1), detail: of(input.records.length, 1, 'record') },
    'stronger-every-week': { progress: ratio(fourWeekImprovementStreak(input.records), 4), detail: of(fourWeekImprovementStreak(input.records), 4, 'weeks') },
    'ten-records': { progress: ratio(input.records.length, 10), detail: of(input.records.length, 10, 'records') },
    'volume-mover': { progress: ratio(totalVolume, 100_000), detail: `${Math.round(totalVolume).toLocaleString()} / 100,000 kg` },

    'cardio-starter': { progress: ratio(cardioSessions, 5), detail: of(cardioSessions, 5, 'sessions') },
    'cardio-builder': { progress: ratio(cardioSessions, 20), detail: of(cardioSessions, 20, 'sessions') },
    'distance-50': { progress: ratio(totalDistance, 50), detail: `${totalDistance.toFixed(1)} / 50 km` },

    'early-warrior': { progress: ratio(morning, 10), detail: of(morning, 10, 'workouts') },
    'night-owl': { progress: ratio(evening, 10), detail: of(evening, 10, 'workouts') },

    'recovery-aware': { progress: ratio(input.recovery.length, 7), detail: of(input.recovery.length, 7, 'check-ins') },
    'rest-respecter': { progress: restRespecter(completed, input.program) ? 1 : 0, detail: restRespecter(completed, input.program) ? 'Earned' : 'Take your planned rest day' },
    'well-slept': { progress: wellSleptWeeks(input.recovery) ? 1 : 0, detail: wellSleptWeeks(input.recovery) ? 'Earned' : 'Log 7 nights averaging 7h+' },

    'habit-starter': { progress: habitDays.perfectDays > 0 ? 1 : 0, detail: habitDays.perfectDays > 0 ? 'Earned' : 'Complete every habit in one day' },
    'hydrated': { progress: ratio(habitDays.byHabit[waterHabit?.id ?? ''] ?? 0, 14), detail: of(habitDays.byHabit[waterHabit?.id ?? ''] ?? 0, 14, 'days') },
    'step-master': { progress: ratio(habitDays.byHabit[stepHabit?.id ?? ''] ?? 0, 20), detail: of(habitDays.byHabit[stepHabit?.id ?? ''] ?? 0, 20, 'days') },

    'goal-getter': { progress: input.goals.some((g) => g.status === 'achieved') ? 1 : 0, detail: `${input.goals.filter((g) => g.status === 'achieved').length} achieved` },
    'assessment-done': { progress: input.assessments.length ? 1 : 0, detail: input.assessments.length ? 'Earned' : 'Not yet taken' },
    'challenge-finisher': { progress: input.challengeMembers.some((c) => c.completed_at) ? 1 : 0, detail: `${input.challengeMembers.filter((c) => c.completed_at).length} completed` },
  };

  return ACHIEVEMENTS.map((a) => {
    const row = table[a.id] ?? { progress: 0, detail: '—' };
    return { id: a.id, progress: clamp(row.progress, 0, 1), earned: row.progress >= 1, detail: row.detail };
  });
}

function habitCompletionDays(habits: HabitDefinition[], logs: HabitLog[]) {
  const active = habits.filter((h) => h.active);
  const byHabit: Record<string, number> = {};
  const perDay = new Map<string, Set<string>>();
  for (const log of logs) {
    const h = active.find((x) => x.id === log.habit_id);
    if (!h || log.value < h.target) continue;
    byHabit[h.id] = (byHabit[h.id] ?? 0) + 1;
    const set = perDay.get(log.date) ?? new Set<string>();
    set.add(h.id);
    perDay.set(log.date, set);
  }
  let perfectDays = 0;
  if (active.length) {
    for (const set of perDay.values()) if (set.size >= active.length) perfectDays++;
  }
  return { byHabit, perfectDays };
}

/** Weeks in a row containing at least one new strength record. */
function fourWeekImprovementStreak(records: PersonalRecord[]): number {
  let streak = 0;
  for (let w = 0; w < 12; w++) {
    const end = addDays(today(), -w * 7);
    const start = addDays(end, -6);
    const has = records.some((r) => {
      const d = r.achieved_at.slice(0, 10);
      return d >= start && d <= end;
    });
    if (has) streak++;
    else if (w > 0) break;
  }
  return streak;
}

/** True once the user followed 3+ consecutive training days with their planned rest. */
function restRespecter(sessions: WorkoutSession[], program: Program | null): boolean {
  if (!program) return false;
  const restWeekdays = new Set(program.days.filter((d) => d.kind === 'rest' || d.kind === 'recovery').map((d) => d.weekday));
  if (!restWeekdays.size) return false;
  const trained = new Set(sessions.map((s) => s.date));
  for (let i = 0; i < 120; i++) {
    const day = addDays(today(), -i);
    const wd = new Date(day + 'T00:00:00').getDay();
    if (!restWeekdays.has(wd as 0 | 1 | 2 | 3 | 4 | 5 | 6)) continue;
    if (trained.has(day)) continue;
    const prior = [1, 2, 3].every((n) => trained.has(addDays(day, -n)));
    if (prior) return true;
  }
  return false;
}

function wellSleptWeeks(logs: RecoveryLog[]): boolean {
  const start = addDays(today(), -6);
  const week = logs.filter((l) => l.date >= start && typeof l.sleep_hours === 'number');
  if (week.length < 5) return false;
  const avg = week.reduce((a, l) => a + (l.sleep_hours ?? 0), 0) / week.length;
  return avg >= 7;
}
