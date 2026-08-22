import { useMemo } from 'react';
import { useData, selectTier, type DataState } from '@/store/data';
import { hasFeature, type PlanFeature } from '@/lib/billing/plans';
import type {
  ExerciseHistoryEntry,
} from '@/lib/fitness/progression';
import { buildHistory } from '@/lib/fitness/progression';
import { computeStreak } from '@/lib/fitness/streaks';
import { computeFitScore } from '@/lib/fitness/fitscore';
import { computeRecoveryScore, type RecoveryReadout } from '@/lib/fitness/recovery';
import { evaluateAchievements, type AchievementProgress } from '@/lib/fitness/achievements';
import { sessionVolume, totalReps, workingSetCount } from '@/lib/fitness/calculations';
import { addDays, startOfWeek, today, weekdayOf } from '@/lib/date';
import type {
  FitScore, ProgramDay, StreakInfo, WorkoutSession, WorkoutSet, ISODate, Program,
  SubscriptionTier,
} from '@/types';

/** The tier the signed-in user is entitled to right now. */
export function useTier(): SubscriptionTier {
  return useData(selectTier);
}

export function useHasFeature(feature: PlanFeature): boolean {
  return hasFeature(useTier(), feature);
}

export function useActiveProgram(): Program | null {
  return useData((s) => s.programs.find((p) => p.active) ?? null);
}

export function useTodaysProgramDay(): ProgramDay | null {
  const program = useActiveProgram();
  return useMemo(() => program?.days.find((d) => d.weekday === weekdayOf(today())) ?? null, [program]);
}

export function useProgramDayFor(date: ISODate): ProgramDay | null {
  const program = useActiveProgram();
  return useMemo(() => program?.days.find((d) => d.weekday === weekdayOf(date)) ?? null, [program, date]);
}

export function useStreak(): StreakInfo {
  const sessions = useData((s) => s.sessions);
  const program = useActiveProgram();
  return useMemo(() => computeStreak(sessions, program), [sessions, program]);
}

export function useFitScore(): FitScore {
  const sessions = useData((s) => s.sessions);
  const recovery = useData((s) => s.recovery);
  const goals = useData((s) => s.goals);
  const records = useData((s) => s.records);
  const program = useActiveProgram();
  return useMemo(
    () => computeFitScore({
      sessions, recovery, goals, records, program,
      targetSessionsPerWeek: program?.days_per_week ?? 3,
    }),
    [sessions, recovery, goals, records, program],
  );
}

/** Score as it stood a week ago, so the dashboard can show a real delta. */
export function useFitScoreDelta(): number {
  const sessions = useData((s) => s.sessions);
  const recovery = useData((s) => s.recovery);
  const goals = useData((s) => s.goals);
  const records = useData((s) => s.records);
  const program = useActiveProgram();
  const current = useFitScore();

  return useMemo(() => {
    const cutoff = addDays(today(), -7);
    const past = computeFitScore({
      sessions: sessions.filter((s) => s.date <= cutoff),
      recovery: recovery.filter((r) => r.date <= cutoff),
      goals,
      records: records.filter((r) => r.achieved_at.slice(0, 10) <= cutoff),
      program,
      targetSessionsPerWeek: program?.days_per_week ?? 3,
    });
    return current.total - past.total;
  }, [sessions, recovery, goals, records, program, current.total]);
}

export function useTodaysRecovery(): RecoveryReadout {
  const recovery = useData((s) => s.recovery);
  const sessions = useData((s) => s.sessions);
  return useMemo(() => {
    const log = recovery.find((r) => r.date === today());
    return computeRecoveryScore(log ?? {}, sessions);
  }, [recovery, sessions]);
}

export function useWeekProgress() {
  const sessions = useData((s) => s.sessions);
  const weekStart = useData((s) => startOfWeek(today(), s.preferences?.week_starts_on ?? 1));
  const program = useActiveProgram();
  return useMemo(() => {
    const end = addDays(weekStart, 6);
    const done = sessions.filter((s) => s.status === 'completed' && s.date >= weekStart && s.date <= end);
    const target = program?.days_per_week ?? 3;
    return {
      completed: done.length,
      target,
      weekStart,
      weekEnd: end,
      sessions: done,
      minutes: Math.round(done.reduce((a, s) => a + s.duration_seconds / 60, 0)),
      volume: 0,
    };
  }, [sessions, weekStart, program]);
}

export function useAchievementProgress(): AchievementProgress[] {
  const s = useData();
  return useMemo(
    () => evaluateAchievements({
      sessions: s.sessions, sets: s.sets, records: s.records, recovery: s.recovery,
      goals: s.goals, habits: s.habits, habitLogs: s.habitLogs,
      assessments: s.assessments, challengeMembers: s.challengeMembers,
      program: s.programs.find((p) => p.active) ?? null,
    }),
    [s],
  );
}

/** Per-session history for one exercise, newest first. */
export function useExerciseHistory(slug: string): ExerciseHistoryEntry[] {
  const sets = useData((s) => s.sets);
  const sessions = useData((s) => s.sessions);
  return useMemo(() => {
    const dates = new Map(sessions.map((x) => [x.id, x.date]));
    return buildHistory(sets.filter((x) => x.exercise_slug === slug), (id) => dates.get(id) ?? null);
  }, [sets, sessions, slug]);
}

export interface SessionStats {
  volume: number;
  sets: number;
  reps: number;
  exercises: number;
}

export function sessionStats(sets: WorkoutSet[]): SessionStats {
  const working = sets.filter((s) => s.completed && !s.is_warmup);
  return {
    volume: sessionVolume(sets),
    sets: workingSetCount(sets),
    reps: totalReps(sets),
    exercises: new Set(working.map((s) => s.exercise_slug)).size,
  };
}

export function useSessionStats(sessionId: string | null): SessionStats {
  const sets = useData((s) => s.sets);
  return useMemo(() => sessionStats(sessionId ? sets.filter((x) => x.session_id === sessionId) : []), [sets, sessionId]);
}

/** Total tonnage per ISO date, for the volume chart. */
export function volumeByDate(state: Pick<DataState, 'sessions' | 'sets'>, days = 90) {
  const from = addDays(today(), -days);
  const dates = new Map(state.sessions.map((s) => [s.id, s.date]));
  const out = new Map<ISODate, number>();
  for (const set of state.sets) {
    if (!set.completed || set.is_warmup || !set.weight_kg || !set.reps) continue;
    const date = dates.get(set.session_id);
    if (!date || date < from) continue;
    out.set(date, (out.get(date) ?? 0) + set.weight_kg * set.reps);
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, volume]) => ({ date, volume: Math.round(volume) }));
}

export function useNextSession(): { date: ISODate; day: ProgramDay } | null {
  const program = useActiveProgram();
  return useMemo(() => {
    if (!program) return null;
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today(), i);
      const day = program.days.find((d) => d.weekday === weekdayOf(date));
      if (day) return { date, day };
    }
    return null;
  }, [program]);
}

export function completedSessionsSorted(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date) || (b.ended_at ?? '').localeCompare(a.ended_at ?? ''));
}
