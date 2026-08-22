import type { RecoveryLog, WorkoutSession } from '@/types';
import { clamp, round, avgBy } from '@/lib/utils';
import { diffDays, today } from '@/lib/date';

export type RecoveryState = 'excellent' | 'ready' | 'moderate' | 'take_it_easy' | 'recover';

export interface RecoveryReadout {
  score: number;
  state: RecoveryState;
  label: string;
  headline: string;
  advice: string;
  contributions: Array<{ key: string; label: string; value: number; weight: number; note: string }>;
  hasInput: boolean;
}

const STATE_META: Record<RecoveryState, { label: string; headline: string; advice: string }> = {
  excellent: {
    label: 'Excellent',
    headline: 'Your body is primed',
    advice: 'A good day to push a hard session or attempt a heavier top set — within your planned programme.',
  },
  ready: {
    label: 'Ready to train',
    headline: 'Green light for your session',
    advice: 'Train as planned. Warm up properly and keep a couple of reps in reserve on your heaviest sets.',
  },
  moderate: {
    label: 'Moderate',
    headline: 'Train, but manage the load',
    advice: 'Keep your session, trim a set from your heaviest lifts, and focus on quality of movement over load.',
  },
  take_it_easy: {
    label: 'Take it easy',
    headline: 'Lighter work suits today',
    advice: 'Consider swapping to mobility, a walk, or a reduced-load session. Progress is built over weeks, not single days.',
  },
  recover: {
    label: 'Recovery recommended',
    headline: 'Your inputs point to rest',
    advice: 'A rest or active-recovery day is likely the most productive choice. Sleep, hydration and food do the rebuilding.',
  },
};

/**
 * Recovery score, 0–100, from self-reported inputs plus recent training load.
 * This is an engagement and self-awareness signal, never a medical measure.
 * Missing inputs are dropped and the remaining weights re-normalised rather
 * than defaulting to a neutral value that would fake precision.
 */
export function computeRecoveryScore(
  log: Partial<Pick<RecoveryLog, 'sleep_hours' | 'sleep_quality' | 'energy' | 'soreness' | 'stress'>>,
  recentSessions: WorkoutSession[] = [],
): RecoveryReadout {
  const parts: Array<{ key: string; label: string; value: number; weight: number; note: string }> = [];

  if (typeof log.sleep_hours === 'number') {
    // Peak around 8h; both too little and unusually long score lower.
    const h = log.sleep_hours;
    const v = h <= 0 ? 0 : clamp(100 - Math.abs(h - 8) * 15, 10, 100);
    parts.push({
      key: 'sleep', label: 'Sleep duration', value: v, weight: 0.3,
      note: h < 6 ? 'Short sleep blunts recovery and strength output.' : h > 9.5 ? 'Long sleep can follow heavy fatigue.' : 'Solid sleep duration.',
    });
  }
  if (typeof log.sleep_quality === 'number') {
    parts.push({
      key: 'sleep_quality', label: 'Sleep quality', value: ((log.sleep_quality - 1) / 4) * 100, weight: 0.12,
      note: log.sleep_quality <= 2 ? 'Broken sleep leaves less in the tank.' : 'Restful night.',
    });
  }
  if (typeof log.energy === 'number') {
    parts.push({
      key: 'energy', label: 'Energy', value: ((log.energy - 1) / 4) * 100, weight: 0.24,
      note: log.energy <= 2 ? 'Low energy — scale the session, do not skip it entirely unless you need to.' : 'Energy is there.',
    });
  }
  if (typeof log.soreness === 'number') {
    parts.push({
      key: 'soreness', label: 'Muscle soreness', value: ((5 - log.soreness) / 4) * 100, weight: 0.2,
      note: log.soreness >= 4 ? 'High soreness — train around it or reduce load on affected muscles.' : 'Soreness is manageable.',
    });
  }
  if (typeof log.stress === 'number') {
    parts.push({
      key: 'stress', label: 'Stress', value: ((5 - log.stress) / 4) * 100, weight: 0.14,
      note: log.stress >= 4 ? 'Stress competes with training for recovery resources.' : 'Stress under control.',
    });
  }

  // Consecutive training days pull the score down slightly.
  const streak = consecutiveTrainingDays(recentSessions);
  if (streak >= 3) {
    parts.push({
      key: 'load', label: 'Recent training load', value: clamp(100 - (streak - 2) * 22, 10, 100), weight: 0.18,
      note: `${streak} training days in a row. A planned lighter day helps you keep going.`,
    });
  }

  const hasInput = parts.length > 0;
  if (!hasInput) {
    return {
      score: 0, state: 'moderate', ...STATE_META.moderate,
      headline: 'No check-in yet', advice: 'Log today’s sleep, energy, soreness and stress to see your readiness.',
      contributions: [], hasInput: false,
    };
  }

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) / totalWeight);
  return { score, state: stateFor(score), ...STATE_META[stateFor(score)], contributions: parts, hasInput: true };
}

export function stateFor(score: number): RecoveryState {
  if (score >= 88) return 'excellent';
  if (score >= 72) return 'ready';
  if (score >= 55) return 'moderate';
  if (score >= 38) return 'take_it_easy';
  return 'recover';
}

export function recoveryMeta(state: RecoveryState) {
  return STATE_META[state];
}

/** Number of consecutive days up to today with a completed session. */
export function consecutiveTrainingDays(sessions: WorkoutSession[]): number {
  const done = new Set(sessions.filter((s) => s.status === 'completed').map((s) => s.date));
  let n = 0;
  let cursor = today();
  // Today may not be trained yet; start from yesterday if so.
  if (!done.has(cursor)) {
    cursor = shift(cursor, -1);
    if (!done.has(cursor)) return 0;
  }
  while (done.has(cursor) && n < 60) {
    n++;
    cursor = shift(cursor, -1);
  }
  return n;
}

function shift(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 7-day rolling average score, for the recovery trend chart. */
export function recoveryTrend(logs: RecoveryLog[], days = 30) {
  const cutoff = -days;
  const inWindow = logs.filter((l) => diffDays(l.date, today()) >= cutoff);
  return inWindow
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, score: l.score, sleep: l.sleep_hours ?? null }));
}

export function averageSleep(logs: RecoveryLog[]): number | null {
  const v = avgBy(logs, (l) => l.sleep_hours);
  return v === null ? null : round(v, 1);
}
