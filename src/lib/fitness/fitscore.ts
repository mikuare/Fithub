import type { WorkoutSession, RecoveryLog, Goal, FitScore, PersonalRecord, Program } from '@/types';
import { clamp } from '@/lib/utils';
import { addDays, diffDays, today } from '@/lib/date';
import { goalProgress } from './goals';

export interface FitScoreInput {
  sessions: WorkoutSession[];
  recovery: RecoveryLog[];
  goals: Goal[];
  records: PersonalRecord[];
  program: Program | null;
  targetSessionsPerWeek: number;
}

/**
 * FitScore, 0–1000.
 *
 * An engagement and progress indicator — explicitly NOT a health measurement.
 * Five components, each 0–100, weighted and scaled. Components with no data
 * report 0 and the UI shows what is missing rather than hiding the gap.
 */
export function computeFitScore(input: FitScoreInput, previous?: number): FitScore {
  const consistency = consistencyScore(input.sessions, input.targetSessionsPerWeek);
  const strength = strengthScore(input.sessions, input.records);
  const cardio = cardioScore(input.sessions);
  const recovery = recoveryScore(input.recovery);
  const goals = goalScore(input.goals);

  const total = Math.round(
    consistency * 3.0 + strength * 2.2 + cardio * 1.8 + recovery * 1.6 + goals * 1.4,
  );

  return {
    total: clamp(total, 0, 1000),
    consistency: Math.round(consistency),
    strength: Math.round(strength),
    cardio: Math.round(cardio),
    recovery: Math.round(recovery),
    goals: Math.round(goals),
    delta: previous === undefined ? 0 : clamp(total, 0, 1000) - previous,
    computed_at: new Date().toISOString(),
  };
}

/** Did you show up, at the rate you set for yourself, over the last 4 weeks? */
export function consistencyScore(sessions: WorkoutSession[], targetPerWeek: number): number {
  const target = Math.max(1, targetPerWeek);
  const weeks = [0, 1, 2, 3].map((w) => {
    const end = addDays(today(), -w * 7);
    const start = addDays(end, -6);
    const done = sessions.filter((s) => s.status === 'completed' && s.date >= start && s.date <= end).length;
    return clamp(done / target, 0, 1.15); // small credit for exceeding, capped
  });
  // Recent weeks matter more than older ones.
  const weights = [0.4, 0.28, 0.2, 0.12];
  const raw = weeks.reduce((a, v, i) => a + v * weights[i], 0);
  return clamp(raw * 100, 0, 100);
}

/** Trend in training volume plus recency of strength records. */
export function strengthScore(sessions: WorkoutSession[], records: PersonalRecord[]): number {
  const strengthSessions = sessions.filter(
    (s) => s.status === 'completed' && !['cardio', 'mobility', 'recovery', 'rest'].includes(s.kind),
  );
  if (!strengthSessions.length) return 0;

  const recent = strengthSessions.filter((s) => diffDays(today(), s.date) <= 28).length;
  const frequency = clamp(recent / 8, 0, 1) * 45;

  const strengthRecords = records.filter((r) => r.kind === 'weight_1rm' || r.kind === 'max_weight' || r.kind === 'max_reps');
  const fresh = strengthRecords.filter((r) => diffDays(today(), r.achieved_at.slice(0, 10)) <= 56).length;
  const prPoints = clamp(fresh / 5, 0, 1) * 35;

  const breadth = new Set(strengthSessions.slice(0, 12).map((s) => s.kind)).size;
  const balance = clamp(breadth / 3, 0, 1) * 20;

  return clamp(frequency + prPoints + balance, 0, 100);
}

/** Cardio minutes per week against a 150-minute reference. */
export function cardioScore(sessions: WorkoutSession[]): number {
  const cutoff = addDays(today(), -28);
  const cardio = sessions.filter(
    (s) => s.status === 'completed' && s.date >= cutoff && ['cardio', 'recovery'].includes(s.kind),
  );
  const minutes = cardio.reduce((a, s) => a + s.duration_seconds / 60, 0);
  const weekly = minutes / 4;
  return clamp((weekly / 150) * 100, 0, 100);
}

/** Average of recent recovery check-ins, damped by how often you check in. */
export function recoveryScore(logs: RecoveryLog[]): number {
  const cutoff = addDays(today(), -14);
  const recent = logs.filter((l) => l.date >= cutoff);
  if (!recent.length) return 0;
  const avg = recent.reduce((a, l) => a + l.score, 0) / recent.length;
  const coverage = clamp(recent.length / 10, 0.4, 1); // partial data → partial credit
  return clamp(avg * coverage, 0, 100);
}

/** Mean completion across live goals. */
export function goalScore(goals: Goal[]): number {
  const live = goals.filter((g) => !g.archived);
  if (!live.length) return 0;
  const avg = live.reduce((a, g) => a + goalProgress(g), 0) / live.length;
  return clamp(avg * 100, 0, 100);
}

export const FITSCORE_BANDS = [
  { min: 0, label: 'Getting started', note: 'Log a few sessions to build a picture.' },
  { min: 250, label: 'Building', note: 'The habit is forming. Keep the rhythm.' },
  { min: 450, label: 'Consistent', note: 'You are training regularly and it shows.' },
  { min: 650, label: 'Strong', note: 'Well-rounded training across the board.' },
  { min: 820, label: 'Elite habit', note: 'Excellent consistency, progress and recovery.' },
] as const;

export function fitScoreBand(total: number) {
  return [...FITSCORE_BANDS].reverse().find((b) => total >= b.min) ?? FITSCORE_BANDS[0];
}

export const FITSCORE_COMPONENTS = [
  { key: 'consistency', label: 'Consistency', weight: 3.0, help: 'Sessions completed against your weekly target over 4 weeks.' },
  { key: 'strength', label: 'Strength', weight: 2.2, help: 'Resistance-training frequency, recent records and balance across the body.' },
  { key: 'cardio', label: 'Cardio', weight: 1.8, help: 'Weekly cardio minutes against a 150-minute reference.' },
  { key: 'recovery', label: 'Recovery', weight: 1.6, help: 'Your recent recovery check-ins and how regularly you log them.' },
  { key: 'goals', label: 'Goal Progress', weight: 1.4, help: 'Average completion across your active goals.' },
] as const;
