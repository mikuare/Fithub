import type { WorkoutSession, Program, StreakInfo, ISODate } from '@/types';
import { addDays, diffDays, startOfMonth, startOfWeek, today, weekdayOf } from '@/lib/date';

/**
 * Consistency streak.
 *
 * A streak counts a day as "kept" when the user trained OR when that weekday
 * is a scheduled rest/recovery day in their active programme. Punishing people
 * for taking the rest day their own plan prescribes would push them toward the
 * exact behaviour the product is meant to discourage.
 */
export function computeStreak(sessions: WorkoutSession[], program: Program | null): StreakInfo {
  const trained = new Set(sessions.filter((s) => s.status === 'completed').map((s) => s.date));
  const restDays = new Set(
    (program?.days ?? [])
      .filter((d) => d.kind === 'rest' || d.kind === 'recovery')
      .map((d) => d.weekday),
  );
  // With no programme, treat a day with no scheduled session as neutral only
  // if the user trained at least once in the surrounding 7 days.
  const kept = (date: ISODate): boolean =>
    trained.has(date) || restDays.has(weekdayOf(date));

  let current = 0;
  let cursor = today();
  if (!kept(cursor)) cursor = addDays(cursor, -1);
  while (kept(cursor) && current < 500) {
    if (trained.has(cursor) || restDays.has(weekdayOf(cursor))) current++;
    cursor = addDays(cursor, -1);
  }

  // Longest streak across all history.
  const allDates = Array.from(trained).sort();
  let longest = 0;
  if (allDates.length) {
    let run = 0;
    let prev: ISODate | null = null;
    let d = allDates[0];
    const last = today();
    let guard = 0;
    while (d <= last && guard++ < 2000) {
      if (kept(d)) run++;
      else { longest = Math.max(longest, run); run = 0; }
      prev = d;
      d = addDays(prev, 1);
    }
    longest = Math.max(longest, run);
  }

  const monthStart = startOfMonth(today());
  const workouts_this_month = sessions.filter(
    (s) => s.status === 'completed' && s.date >= monthStart,
  ).length;

  return {
    current,
    longest: Math.max(longest, current),
    workouts_this_month,
    consistent_weeks: consistentWeeks(sessions, program?.days_per_week ?? 3),
    last_active: allDates.length ? allDates[allDates.length - 1] : null,
  };
}

/** Consecutive most-recent weeks that met at least (target - 1) sessions. */
export function consistentWeeks(sessions: WorkoutSession[], target: number): number {
  const threshold = Math.max(1, target - 1);
  let weeks = 0;
  let weekStart = startOfWeek(today(), 1);
  for (let i = 0; i < 104; i++) {
    const weekEnd = addDays(weekStart, 6);
    const count = sessions.filter(
      (s) => s.status === 'completed' && s.date >= weekStart && s.date <= weekEnd,
    ).length;
    // The in-progress current week only counts once it already hit target.
    const isCurrent = i === 0;
    if (count >= threshold) weeks++;
    else if (!isCurrent) break;
    else if (count < threshold) { /* current week still open — do not break the run */ }
    weekStart = addDays(weekStart, -7);
  }
  return weeks;
}

/** Per-day activity map for heat strips and calendars. */
export function activityMap(sessions: WorkoutSession[], days = 84): Map<ISODate, WorkoutSession[]> {
  const map = new Map<ISODate, WorkoutSession[]>();
  const from = addDays(today(), -days);
  for (const s of sessions) {
    if (s.date < from) continue;
    const list = map.get(s.date) ?? [];
    list.push(s);
    map.set(s.date, list);
  }
  return map;
}

export function weeksSince(date: ISODate): number {
  return Math.max(0, Math.floor(diffDays(today(), date) / 7));
}
