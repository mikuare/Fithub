import type { PlannedExercise } from '@/types';
import { getExercise } from '@/data/exercises';
import type { ExerciseCaution } from './freshness';
import type { RecoveryReadout } from './recovery';

/* ============================================================
   Auto-regulation
   Turns two signals that already exist — Body Map fatigue cautions
   and today's recovery readout — into concrete, explainable edits
   to today's planned session. Nothing here is silent: every change
   comes back with a plain-language reason, and it only ever eases
   the session (swap a fatigued exercise, trim a set). It never adds
   load, and it never removes an exercise outright.
   ============================================================ */

export interface AutoRegulateChange {
  exerciseId: string;
  kind: 'swap' | 'trim_sets';
  summary: string;
  reason: string;
}

export interface AutoRegulateResult {
  planned: PlannedExercise[];
  changes: AutoRegulateChange[];
}

/** Sets ceilings by how the recovery readout reads. A lift already at or
 *  under its ceiling is left alone, which is what keeps this idempotent —
 *  reapplying it to its own output never trims further. */
const CAP_ALL = 3;
const CAP_TOP_LIFTS = 4;

function trimPlanFor(state: RecoveryReadout['state']): { cap: number; onlyTopLifts: boolean } | null {
  if (state === 'take_it_easy' || state === 'recover') return { cap: CAP_ALL, onlyTopLifts: false };
  if (state === 'moderate') return { cap: CAP_TOP_LIFTS, onlyTopLifts: true };
  return null;
}

/**
 * Applies fatigue-driven swaps and readiness-driven volume trims to a
 * planned session. Pure and idempotent — re-running on its own output
 * makes no further changes, so it is safe to offer as a repeatable
 * one-tap action.
 */
export function autoRegulateSession(
  planned: PlannedExercise[],
  cautions: ExerciseCaution[],
  recovery: RecoveryReadout,
): AutoRegulateResult {
  const cautionBySlug = new Map(cautions.map((c) => [c.slug, c]));
  const changes: AutoRegulateChange[] = [];

  // 1. Swap exercises the Body Map flagged, when a clean alternative exists.
  let next = planned.map((pe) => {
    const caution = cautionBySlug.get(pe.exercise_slug);
    if (!caution || caution.alternatives.length === 0) return pe;
    const altSlug = caution.alternatives[0];
    const from = getExercise(pe.exercise_slug);
    const to = getExercise(altSlug);
    if (!to) return pe;
    changes.push({
      exerciseId: pe.id,
      kind: 'swap',
      summary: `${from?.name ?? pe.exercise_slug} → ${to.name}`,
      reason: caution.reasons.map((r) => r.detail).join('; '),
    });
    return { ...pe, exercise_slug: altSlug };
  });

  // 2. Trim volume when the recovery readout says the session is too heavy.
  const plan = recovery.hasInput ? trimPlanFor(recovery.state) : null;
  if (plan) {
    const trimmable = next.filter((pe) => pe.target_reps !== null && pe.sets > plan.cap);
    const eligible = plan.onlyTopLifts
      ? [...trimmable].sort((a, b) => b.sets - a.sets).slice(0, 2)
      : trimmable;
    const eligibleIds = new Set(eligible.map((pe) => pe.id));

    next = next.map((pe) => {
      if (!eligibleIds.has(pe.id)) return pe;
      const exercise = getExercise(pe.exercise_slug);
      changes.push({
        exerciseId: pe.id,
        kind: 'trim_sets',
        summary: `${exercise?.name ?? pe.exercise_slug} → ${plan.cap} sets`,
        reason: `readiness is "${recovery.label.toLowerCase()}" today (${recovery.score}/100)`,
      });
      return { ...pe, sets: plan.cap };
    });
  }

  return { planned: next, changes };
}
