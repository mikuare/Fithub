import type {
  Equipment, ISODate, MuscleGroup, Niggle, NiggleSeverity, PlannedExercise,
  WorkoutSession, WorkoutSet,
} from '@/types';
import { getExercise } from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { clamp, round } from '@/lib/utils';

/* ============================================================
   Muscle freshness
   Every completed working set deposits "stimulus" into the muscles
   the exercise targets; that stimulus decays exponentially at a
   rate that depends on the muscle. Freshness is what remains.
   This is an estimate from logged training only — it knows nothing
   about sleep, nutrition or life, and it is never a medical measure.
   ============================================================ */

export type FreshnessStatus = 'fresh' | 'recovering' | 'fatigued';

export interface MuscleFreshness {
  muscle: MuscleGroup;
  /** 0..100 — 100 means no un-recovered training stimulus on record. */
  freshness: number;
  status: FreshnessStatus;
  /** Decayed stimulus units still "in" the muscle, for the transparent breakdown. */
  load: number;
  /** Most recent date this muscle was hit by any logged working set. */
  lastTrained: ISODate | null;
  /** Working sets in the trailing 7 days: primary counts 1, secondary 0.5. */
  weeklySets: number;
}

/** The muscles the engine (and the body heat map) reports on. The meta groups
 *  `full_body` and `cardio` are inputs only — their stimulus is spread below. */
export const TRACKED_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'lats', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
  'core', 'obliques', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves',
];

/**
 * Recovery half-life in hours. Large muscles and axially-loaded areas take
 * longer to shed fatigue than small ones — forearms and core tolerate
 * near-daily work; a hard squat session echoes for days.
 */
const HALF_LIFE_H: Record<string, number> = {
  quads: 30, hamstrings: 30, glutes: 30, lower_back: 32,
  chest: 28, back: 28, lats: 28,
  shoulders: 22, traps: 22, biceps: 20, triceps: 20, calves: 20,
  forearms: 18, core: 18, obliques: 18,
};

/** Load units at which freshness reads ~35 — roughly one hard session's dose. */
const SATURATION = 5.5;

/** Sets older than this contribute under 0.1% and are skipped. */
const STIMULUS_WINDOW_DAYS = 21;

const FRESH_AT = 75;
const FATIGUED_BELOW = 40;

export function statusForFreshness(freshness: number): FreshnessStatus {
  if (freshness >= FRESH_AT) return 'fresh';
  if (freshness >= FATIGUED_BELOW) return 'recovering';
  return 'fatigued';
}

/** RPE nudges the dose: a grinding set costs more than an easy one. */
function effortMultiplier(rpe: number | null): number {
  if (rpe === null) return 1;
  if (rpe >= 9) return 1.3;
  if (rpe >= 8) return 1.15;
  if (rpe <= 6) return 0.85;
  return 1;
}

/** How many stimulus units one working set is worth before distribution. */
function setStimulus(set: WorkoutSet, exerciseType: string): number {
  if (exerciseType === 'cardio') {
    // Long steady work fatigues by duration, not by "sets".
    const minutes = (set.seconds ?? 0) / 60;
    return minutes > 0 ? clamp(minutes / 10, 0.5, 3) : 1;
  }
  return effortMultiplier(set.rpe);
}

/** Per-muscle share of a set's stimulus, expanding the meta groups. */
function distribute(muscles: MuscleGroup[], weight: number, into: Map<MuscleGroup, number>) {
  for (const m of muscles) {
    if (m === 'full_body') {
      for (const t of TRACKED_MUSCLES) into.set(t, (into.get(t) ?? 0) + weight * 0.3);
    } else if (m === 'cardio') {
      // Generic conditioning: predominantly legs, a little trunk.
      for (const [t, w] of [['quads', 0.35], ['hamstrings', 0.35], ['calves', 0.35], ['core', 0.2]] as const) {
        into.set(t as MuscleGroup, (into.get(t as MuscleGroup) ?? 0) + weight * w);
      }
    } else {
      into.set(m, (into.get(m) ?? 0) + weight);
    }
  }
}

function setTimestamp(set: WorkoutSet, sessionDates: Map<string, ISODate>): number {
  const t = Date.parse(set.logged_at);
  if (!Number.isNaN(t)) return t;
  const date = sessionDates.get(set.session_id);
  return date ? Date.parse(`${date}T12:00:00`) : NaN;
}

/**
 * Freshness for every tracked muscle, from completed working sets.
 * A muscle with nothing logged reads 100 with `lastTrained: null` — reported
 * as "no recent training on record", not dressed up as measured readiness.
 */
export function computeMuscleFreshness(
  sets: WorkoutSet[],
  sessions: WorkoutSession[],
  now: Date = new Date(),
): MuscleFreshness[] {
  const sessionDates = new Map(sessions.map((s) => [s.id, s.date]));
  const nowMs = now.getTime();
  const windowMs = STIMULUS_WINDOW_DAYS * 24 * 3600_000;
  const weekMs = 7 * 24 * 3600_000;

  const load = new Map<MuscleGroup, number>();
  const weekly = new Map<MuscleGroup, number>();
  const lastTrained = new Map<MuscleGroup, ISODate>();

  for (const set of sets) {
    if (!set.completed || set.is_warmup) continue;
    const exercise = getExercise(set.exercise_slug);
    if (!exercise) continue;
    const at = setTimestamp(set, sessionDates);
    if (Number.isNaN(at) || at > nowMs) continue;

    const date = (sessionDates.get(set.session_id) ?? set.logged_at.slice(0, 10)) as ISODate;
    const involved = [...exercise.primary, ...exercise.secondary];
    for (const m of involved) {
      if (m === 'full_body' || m === 'cardio') continue;
      const prev = lastTrained.get(m);
      if (!prev || date > prev) lastTrained.set(m, date);
    }

    const age = nowMs - at;
    if (age <= weekMs) {
      for (const m of exercise.primary) {
        if (m !== 'full_body' && m !== 'cardio') weekly.set(m, (weekly.get(m) ?? 0) + 1);
      }
      for (const m of exercise.secondary) {
        if (m !== 'full_body' && m !== 'cardio') weekly.set(m, (weekly.get(m) ?? 0) + 0.5);
      }
    }

    if (age > windowMs) continue;
    const stimulus = setStimulus(set, exercise.type);
    const perMuscle = new Map<MuscleGroup, number>();
    distribute(exercise.primary, stimulus, perMuscle);
    distribute(exercise.secondary, stimulus * 0.5, perMuscle);
    for (const [m, units] of perMuscle) {
      const halfLife = HALF_LIFE_H[m];
      if (!halfLife) continue;
      const decayed = units * Math.pow(0.5, age / 3600_000 / halfLife);
      load.set(m, (load.get(m) ?? 0) + decayed);
    }
  }

  return TRACKED_MUSCLES.map((muscle) => {
    const l = load.get(muscle) ?? 0;
    const freshness = Math.round(clamp(100 * Math.exp(-l / SATURATION), 0, 100));
    return {
      muscle,
      freshness,
      status: statusForFreshness(freshness),
      load: round(l, 2),
      lastTrained: lastTrained.get(muscle) ?? null,
      weeklySets: round(weekly.get(muscle) ?? 0, 1),
    };
  });
}

export function freshnessByMuscle(list: MuscleFreshness[]): Map<MuscleGroup, MuscleFreshness> {
  return new Map(list.map((f) => [f.muscle, f]));
}

/* ============================================================
   Weekly balance
   ============================================================ */

export interface BalanceCallout {
  key: string;
  label: string;
  detail: string;
  tone: 'ok' | 'watch' | 'info';
}

export interface WeeklyBalance {
  pushSets: number;
  pullSets: number;
  quadSets: number;
  posteriorSets: number;
  callouts: BalanceCallout[];
}

const MIN_SETS_TO_JUDGE = 10;
const IMBALANCE_RATIO = 1.75;

/**
 * Push/pull and quad/posterior-chain working-set balance over the trailing
 * 7 days. Below a minimum sample it says so instead of inventing a verdict.
 */
export function weeklyBalance(
  sets: WorkoutSet[],
  sessions: WorkoutSession[],
  now: Date = new Date(),
): WeeklyBalance {
  const sessionDates = new Map(sessions.map((s) => [s.id, s.date]));
  const nowMs = now.getTime();
  const weekMs = 7 * 24 * 3600_000;

  let pushSets = 0, pullSets = 0, quadSets = 0, posteriorSets = 0;
  for (const set of sets) {
    if (!set.completed || set.is_warmup) continue;
    const exercise = getExercise(set.exercise_slug);
    if (!exercise || exercise.type !== 'strength') continue;
    const at = setTimestamp(set, sessionDates);
    if (Number.isNaN(at) || nowMs - at > weekMs || at > nowMs) continue;

    if (exercise.force === 'push') pushSets++;
    if (exercise.force === 'pull') pullSets++;
    if (exercise.primary.includes('quads')) quadSets++;
    if (exercise.primary.includes('hamstrings') || exercise.primary.includes('glutes')) posteriorSets++;
  }

  const callouts: BalanceCallout[] = [];

  if (pushSets + pullSets >= MIN_SETS_TO_JUDGE) {
    if (pushSets > pullSets * IMBALANCE_RATIO) {
      callouts.push({
        key: 'push_heavy', label: 'Push-heavy week', tone: 'watch',
        detail: `${pushSets} pushing sets to ${pullSets} pulling this week. Over time that pattern is associated with shoulder niggles — rows and pulldowns restore the balance.`,
      });
    } else if (pullSets > pushSets * IMBALANCE_RATIO) {
      callouts.push({
        key: 'pull_heavy', label: 'Pull-heavy week', tone: 'watch',
        detail: `${pullSets} pulling sets to ${pushSets} pushing this week. Nothing wrong with a pull block — just make it a choice, not an accident.`,
      });
    } else {
      callouts.push({
        key: 'push_pull_ok', label: 'Push and pull in balance', tone: 'ok',
        detail: `${pushSets} pushing to ${pullSets} pulling sets this week.`,
      });
    }
  } else {
    callouts.push({
      key: 'push_pull_na', label: 'Push / pull — not enough data', tone: 'info',
      detail: 'Fewer than 10 pushing-plus-pulling sets logged this week, which is too small a sample to judge.',
    });
  }

  if (quadSets + posteriorSets >= MIN_SETS_TO_JUDGE * 0.8) {
    if (quadSets > posteriorSets * IMBALANCE_RATIO) {
      callouts.push({
        key: 'quad_heavy', label: 'Quad-dominant week', tone: 'watch',
        detail: `${quadSets} quad-led sets to ${posteriorSets} for the hamstrings and glutes. The posterior chain does not train itself — hinges and curls even it out.`,
      });
    } else if (posteriorSets > quadSets * IMBALANCE_RATIO) {
      callouts.push({
        key: 'posterior_heavy', label: 'Posterior-chain-dominant week', tone: 'watch',
        detail: `${posteriorSets} hamstring/glute-led sets to ${quadSets} for the quads this week.`,
      });
    } else {
      callouts.push({
        key: 'legs_ok', label: 'Quads and posterior chain in balance', tone: 'ok',
        detail: `${quadSets} quad-led to ${posteriorSets} hamstring/glute-led sets this week.`,
      });
    }
  } else {
    callouts.push({
      key: 'legs_na', label: 'Lower body — not enough data', tone: 'info',
      detail: 'Too few lower-body sets logged this week to say anything about balance.',
    });
  }

  return { pushSets, pullSets, quadSets, posteriorSets, callouts };
}

/* ============================================================
   Niggles & session cautions
   ============================================================ */

export function activeNiggles(niggles: Niggle[]): Niggle[] {
  return niggles.filter((n) => !n.resolved_date);
}

export interface CautionReason {
  kind: 'fatigued' | 'niggle';
  muscle: MuscleGroup;
  severity?: NiggleSeverity;
  detail: string;
}

export interface ExerciseCaution {
  slug: string;
  name: string;
  reasons: CautionReason[];
  /** Library alternatives that avoid every flagged muscle. Suggestions only. */
  alternatives: string[];
}

/** A niggle flags an exercise when the muscle leads it, or assists it and the
 *  niggle is more than mild tightness. */
function niggleApplies(n: Niggle, primary: MuscleGroup[], secondary: MuscleGroup[]): boolean {
  if (primary.includes(n.muscle)) return true;
  return n.severity >= 2 && secondary.includes(n.muscle);
}

/**
 * Cross-checks a planned session against muscle freshness and active niggles.
 * Every flag is advisory — the output explains itself and proposes swaps, it
 * never removes anything from the plan.
 */
export function sessionCautions(
  planned: Array<Pick<PlannedExercise, 'exercise_slug'>>,
  freshness: MuscleFreshness[],
  niggles: Niggle[],
  equipment?: Equipment[],
): ExerciseCaution[] {
  const byMuscle = freshnessByMuscle(freshness);
  const active = activeNiggles(niggles);
  const out: ExerciseCaution[] = [];
  const seen = new Set<string>();

  for (const pe of planned) {
    if (seen.has(pe.exercise_slug)) continue;
    seen.add(pe.exercise_slug);
    const exercise = getExercise(pe.exercise_slug);
    if (!exercise) continue;

    const reasons: CautionReason[] = [];
    for (const m of exercise.primary) {
      const f = byMuscle.get(m);
      if (f && f.status === 'fatigued') {
        reasons.push({
          kind: 'fatigued', muscle: m,
          detail: `still recovering from recent training (freshness ${f.freshness}/100)`,
        });
      }
    }
    for (const n of active) {
      if (niggleApplies(n, exercise.primary, exercise.secondary)) {
        reasons.push({
          kind: 'niggle', muscle: n.muscle, severity: n.severity,
          detail: `you logged a ${SEVERITY_LABEL[n.severity].toLowerCase()} here on ${n.started_date}`,
        });
      }
    }
    if (!reasons.length) continue;

    const flagged = new Set(reasons.map((r) => r.muscle));
    const alternatives = exercise.alternatives
      .map((slug) => getExercise(slug))
      .filter((alt): alt is NonNullable<typeof alt> => !!alt)
      .filter((alt) => !alt.primary.some((m) => flagged.has(m)))
      .filter((alt) => !active.some((n) => niggleApplies(n, alt.primary, alt.secondary)))
      .filter((alt) => !equipment || canPerform(alt, equipment))
      .slice(0, 3)
      .map((alt) => alt.slug);

    out.push({ slug: exercise.slug, name: exercise.name, reasons, alternatives });
  }
  return out;
}

export const SEVERITY_LABEL: Record<NiggleSeverity, string> = {
  1: 'Tightness',
  2: 'Ache',
  3: 'Pain',
};

export const SEVERITY_HELP: Record<NiggleSeverity, string> = {
  1: 'Feels tight or stiff, but does not change how you move.',
  2: 'Noticeable during exercise; you would rather not load it hard.',
  3: 'Actual pain, or it alters your movement. Worth professional eyes.',
};

export const FRESHNESS_STATUS_META: Record<FreshnessStatus, { label: string; hint: string }> = {
  fresh: { label: 'Fresh', hint: 'Fully recovered — a good day to train it hard.' },
  recovering: { label: 'Recovering', hint: 'Partially recovered. Light or moderate work is fine; save max efforts.' },
  fatigued: { label: 'Fatigued', hint: 'Recently worked hard. Training it again now buys little and costs recovery.' },
};
