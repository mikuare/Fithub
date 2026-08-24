import type {
  Exercise, Experience, FitnessProfile, GoalKind, MuscleGroup, PlannedExercise,
  Program, ProgramDay, SessionKind, Weekday, Equipment, Difficulty,
} from '@/types';
import { EXERCISES, expandEquipment } from '@/data/exercises';
import { repScheme } from './calculations';
import { uid } from '@/lib/id';
import { nowISO } from '@/lib/date';
import { clamp } from '@/lib/utils';

/* ------------------------------------------------------------------
   Split selection
   ------------------------------------------------------------------ */

export interface SplitDay {
  kind: SessionKind;
  title: string;
  focus: string;
  slots: Slot[];
}

interface Slot {
  muscles: MuscleGroup[];
  mechanic: 'compound' | 'isolation' | 'any';
  /** Priority slots are kept when a session has to be trimmed for time. */
  core?: boolean;
}

const PUSH: SplitDay = {
  kind: 'push', title: 'Push', focus: 'Chest · Shoulders · Triceps',
  slots: [
    { muscles: ['chest'], mechanic: 'compound', core: true },
    { muscles: ['shoulders'], mechanic: 'compound', core: true },
    { muscles: ['chest'], mechanic: 'any', core: true },
    { muscles: ['shoulders'], mechanic: 'isolation' },
    { muscles: ['triceps'], mechanic: 'any', core: true },
    { muscles: ['triceps'], mechanic: 'isolation' },
  ],
};

const PULL: SplitDay = {
  kind: 'pull', title: 'Pull', focus: 'Back · Biceps · Rear delts',
  slots: [
    { muscles: ['lats', 'back'], mechanic: 'compound', core: true },
    { muscles: ['back'], mechanic: 'compound', core: true },
    { muscles: ['lats', 'back'], mechanic: 'any', core: true },
    { muscles: ['shoulders', 'traps'], mechanic: 'isolation' },
    { muscles: ['biceps'], mechanic: 'any', core: true },
    { muscles: ['biceps', 'forearms'], mechanic: 'isolation' },
  ],
};

const LEGS: SplitDay = {
  kind: 'legs', title: 'Legs', focus: 'Quads · Hamstrings · Glutes · Calves',
  slots: [
    { muscles: ['quads'], mechanic: 'compound', core: true },
    { muscles: ['hamstrings', 'glutes'], mechanic: 'compound', core: true },
    { muscles: ['quads', 'glutes'], mechanic: 'any', core: true },
    { muscles: ['hamstrings'], mechanic: 'isolation' },
    { muscles: ['glutes'], mechanic: 'any' },
    { muscles: ['calves'], mechanic: 'isolation', core: true },
  ],
};

const UPPER: SplitDay = {
  kind: 'upper', title: 'Upper Body', focus: 'Chest · Back · Shoulders · Arms',
  slots: [
    { muscles: ['chest'], mechanic: 'compound', core: true },
    { muscles: ['lats', 'back'], mechanic: 'compound', core: true },
    { muscles: ['shoulders'], mechanic: 'compound', core: true },
    { muscles: ['back'], mechanic: 'any', core: true },
    { muscles: ['biceps'], mechanic: 'isolation' },
    { muscles: ['triceps'], mechanic: 'isolation' },
  ],
};

const LOWER: SplitDay = {
  kind: 'lower', title: 'Lower Body', focus: 'Quads · Hamstrings · Glutes · Core',
  slots: [
    { muscles: ['quads'], mechanic: 'compound', core: true },
    { muscles: ['hamstrings', 'glutes'], mechanic: 'compound', core: true },
    { muscles: ['quads', 'glutes'], mechanic: 'any', core: true },
    { muscles: ['hamstrings'], mechanic: 'isolation' },
    { muscles: ['calves'], mechanic: 'isolation' },
    { muscles: ['core'], mechanic: 'any', core: true },
  ],
};

const FULL: SplitDay = {
  kind: 'full_body', title: 'Full Body', focus: 'One session, every major pattern',
  slots: [
    { muscles: ['quads', 'glutes'], mechanic: 'compound', core: true },
    { muscles: ['chest'], mechanic: 'compound', core: true },
    { muscles: ['lats', 'back'], mechanic: 'compound', core: true },
    { muscles: ['hamstrings', 'glutes'], mechanic: 'compound', core: true },
    { muscles: ['shoulders'], mechanic: 'any' },
    { muscles: ['core'], mechanic: 'any', core: true },
  ],
};

const CORE_CARDIO: SplitDay = {
  kind: 'cardio', title: 'Cardio + Core', focus: 'Conditioning and trunk strength',
  slots: [
    { muscles: ['cardio'], mechanic: 'any', core: true },
    { muscles: ['core'], mechanic: 'any', core: true },
    { muscles: ['obliques', 'core'], mechanic: 'any', core: true },
    { muscles: ['core'], mechanic: 'isolation' },
  ],
};

const CONDITIONING: SplitDay = {
  kind: 'cardio', title: 'Conditioning', focus: 'Steady or interval cardio',
  slots: [
    { muscles: ['cardio'], mechanic: 'any', core: true },
    { muscles: ['cardio', 'full_body'], mechanic: 'any' },
  ],
};

const RECOVERY: SplitDay = {
  kind: 'recovery', title: 'Recovery', focus: 'Easy movement and mobility',
  slots: [
    { muscles: ['cardio'], mechanic: 'any', core: true },
    { muscles: ['lower_back', 'core'], mechanic: 'any', core: true },
    { muscles: ['glutes'], mechanic: 'any' },
    { muscles: ['shoulders'], mechanic: 'any' },
  ],
};

const MOBILITY: SplitDay = {
  kind: 'mobility', title: 'Mobility', focus: 'Range of motion and tissue quality',
  slots: [
    { muscles: ['full_body'], mechanic: 'any', core: true },
    { muscles: ['quads', 'glutes'], mechanic: 'any', core: true },
    { muscles: ['back', 'obliques'], mechanic: 'any', core: true },
    { muscles: ['lower_back'], mechanic: 'any' },
  ],
};

const REST: SplitDay = { kind: 'rest', title: 'Rest', focus: 'Planned recovery — part of the plan, not a gap in it', slots: [] };

export interface SplitPlan {
  name: string;
  description: string;
  sequence: SplitDay[];
}

/** Choose a training split from days available, experience and goal. */
export function chooseSplit(daysPerWeek: number, experience: Experience, goal: GoalKind): SplitPlan {
  const d = clamp(daysPerWeek, 1, 7);
  const cardioHeavy = goal === 'lose_fat' || goal === 'improve_endurance';

  if (goal === 'mobility') {
    return {
      name: 'Mobility Focus',
      description: 'Mobility work most days, with two full-body strength sessions to keep the new range usable.',
      sequence: Array.from({ length: d }, (_, i) => (i % 3 === 0 ? FULL : MOBILITY)),
    };
  }

  if (d <= 2) {
    return {
      name: 'Full Body',
      description: 'With two sessions a week, hitting every major muscle each time gives you the most progress per session.',
      sequence: Array.from({ length: d }, () => FULL),
    };
  }

  if (d === 3) {
    if (experience === 'beginner') {
      return {
        name: 'Full Body ×3',
        description: 'The most effective structure for a beginner: each major pattern is practised three times a week, which is exactly what drives early skill and strength gains.',
        sequence: [FULL, FULL, FULL],
      };
    }
    return {
      name: 'Push / Pull / Legs',
      description: 'A classic three-way split. Each session covers a group of muscles that naturally work together.',
      sequence: [PUSH, PULL, LEGS],
    };
  }

  if (d === 4) {
    if (cardioHeavy) {
      return {
        name: 'Upper / Lower + Conditioning',
        description: 'Two strength sessions and two conditioning sessions — a strong pairing when body composition or endurance is the goal.',
        sequence: [UPPER, CONDITIONING, LOWER, CORE_CARDIO],
      };
    }
    return {
      name: 'Upper / Lower ×2',
      description: 'Each half of the body trained twice a week — the best-supported frequency for building muscle and strength.',
      sequence: [UPPER, LOWER, UPPER, LOWER],
    };
  }

  if (d === 5) {
    if (cardioHeavy) {
      return {
        name: 'Upper / Lower / Full + Cardio',
        description: 'Three resistance sessions built around two conditioning days.',
        sequence: [UPPER, CONDITIONING, LOWER, CORE_CARDIO, FULL],
      };
    }
    return {
      name: 'Push / Pull / Legs + Upper / Lower',
      description: 'Five sessions that hit each muscle group roughly twice a week without excessive overlap.',
      sequence: [PUSH, PULL, LEGS, UPPER, LOWER],
    };
  }

  if (d === 6) {
    return {
      name: 'Push / Pull / Legs ×2',
      description: 'A high-frequency split for experienced trainees. Each muscle group is trained twice a week with moderate per-session volume.',
      sequence: [PUSH, PULL, LEGS, PUSH, PULL, LEGS],
    };
  }

  return {
    name: 'Push / Pull / Legs + Active Recovery',
    description: 'Six training days with a built-in active-recovery day. Training seven hard days a week is not a plan — it is a countdown.',
    sequence: [PUSH, PULL, LEGS, RECOVERY, PUSH, PULL, LEGS],
  };
}

/* ------------------------------------------------------------------
   Exercise selection
   ------------------------------------------------------------------ */

const DIFFICULTY_RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const EXPERIENCE_CEILING: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function canPerform(exercise: Exercise, equipment: Equipment[]): boolean {
  const owned = expandEquipment(equipment);
  return exercise.equipment.every((e) => owned.has(e));
}

/** Small deterministic PRNG so "regenerate" varies but stays reproducible. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

interface PickContext {
  equipment: Equipment[];
  experience: Experience;
  activities: string[];
  used: Set<string>;
  random: () => number;
  avoidAdvanced: boolean;
}

function scoreExercise(e: Exercise, slot: Slot, ctx: PickContext): number {
  let score = 0;
  const primaryHit = e.primary.filter((m) => slot.muscles.includes(m)).length;
  const secondaryHit = e.secondary.filter((m) => slot.muscles.includes(m)).length;
  if (primaryHit === 0 && secondaryHit === 0) return -1;
  score += primaryHit * 10 + secondaryHit * 2;

  if (slot.mechanic !== 'any' && e.mechanic === slot.mechanic) score += 6;
  if (slot.mechanic !== 'any' && e.mechanic !== slot.mechanic) score -= 4;

  // Match the trainee's level: prefer the hardest exercise they can handle,
  // but never above their ceiling.
  const rank = DIFFICULTY_RANK[e.difficulty];
  const ceiling = ctx.avoidAdvanced ? Math.min(EXPERIENCE_CEILING[ctx.experience], 1) : EXPERIENCE_CEILING[ctx.experience];
  if (rank > ceiling) return -1;
  score += rank * 2;

  // Preference nudges from the activities the user said they enjoy.
  if (e.type === 'cardio') {
    if (ctx.activities.includes('running') && (e.slug === 'outdoor-run' || e.slug === 'treadmill-run')) score += 8;
    if (ctx.activities.includes('walking') && e.slug === 'brisk-walk') score += 8;
    if (ctx.activities.includes('cycling') && (e.slug === 'cycling' || e.slug === 'stationary-bike')) score += 8;
    if (ctx.activities.includes('swimming')) score += 0;
    if (ctx.activities.includes('hiit') && (e.slug === 'burpee' || e.slug === 'jump-rope' || e.slug === 'mountain-climber')) score += 6;
  }
  if (ctx.activities.includes('calisthenics') && e.equipment.length === 1 && e.equipment[0] === 'bodyweight') score += 3;
  if (ctx.activities.includes('weightlifting') && (e.equipment.includes('barbell') || e.equipment.includes('dumbbells'))) score += 3;
  if (ctx.activities.includes('yoga') && e.category === 'mobility') score += 4;

  score += ctx.random() * 3; // tie-break variety
  return score;
}

function pickForSlot(slot: Slot, ctx: PickContext): Exercise | null {
  let best: Exercise | null = null;
  let bestScore = 0;
  for (const e of EXERCISES) {
    if (ctx.used.has(e.slug)) continue;
    if (!canPerform(e, ctx.equipment)) continue;
    const s = scoreExercise(e, slot, ctx);
    if (s > bestScore) { best = e; bestScore = s; }
  }
  return best;
}

/* ------------------------------------------------------------------
   Session assembly
   ------------------------------------------------------------------ */

export function estimateSessionMinutes(exercises: PlannedExercise[]): number {
  let seconds = 300; // warm-up allowance
  for (const pe of exercises) {
    const target = pe.target_seconds ?? 0;
    if (target > 0) {
      seconds += pe.sets * (target + pe.rest_seconds);
    } else {
      const reps = pe.target_reps ?? 10;
      seconds += pe.sets * (Math.round(reps * 3.5) + 10 + pe.rest_seconds);
    }
  }
  return Math.max(10, Math.round(seconds / 60));
}

function buildDay(
  template: SplitDay,
  weekday: Weekday,
  profile: FitnessProfile,
  ctx: PickContext,
): ProgramDay {
  if (template.kind === 'rest') {
    return {
      id: uid('pd'), weekday, kind: 'rest', title: template.title,
      focus: template.focus, est_minutes: 0, exercises: [],
    };
  }

  const chosen: Array<{ exercise: Exercise; slot: Slot }> = [];
  for (const slot of template.slots) {
    const e = pickForSlot(slot, ctx);
    if (!e) continue;
    ctx.used.add(e.slug);
    chosen.push({ exercise: e, slot });
  }

  let planned: PlannedExercise[] = chosen.map(({ exercise }, i) => {
    const scheme = repScheme(profile.primary_goal, profile.experience, exercise.mechanic);
    const isCardio = exercise.type === 'cardio';
    const isTimed = exercise.type === 'timed' || exercise.type === 'mobility';
    const cardioMinutes =
      template.kind === 'recovery' ? 20 : profile.primary_goal === 'improve_endurance' ? 30 : 22;

    return {
      id: uid('pe'),
      exercise_slug: exercise.slug,
      order: i,
      sets: isCardio ? 1 : isTimed ? Math.max(2, scheme.sets - 1) : scheme.sets,
      target_reps: isCardio || isTimed ? null : scheme.reps,
      target_seconds: isCardio ? cardioMinutes * 60 : isTimed ? (profile.experience === 'beginner' ? 30 : 45) : null,
      target_weight_kg: null,
      rest_seconds: isCardio ? 0 : isTimed ? 45 : scheme.restSeconds,
      notes: '',
      superset_group: null,
    };
  });

  // Trim to fit the user's session length, dropping non-core slots first.
  const budget = profile.session_minutes;
  let guard = 0;
  while (estimateSessionMinutes(planned) > budget + 6 && planned.length > 3 && guard++ < 10) {
    const droppableIndex = [...planned]
      .map((p, i) => ({ p, i, core: chosen[i]?.slot.core ?? false }))
      .filter((x) => !x.core)
      .pop()?.i;
    if (droppableIndex === undefined) break;
    planned = planned.filter((_, i) => i !== droppableIndex);
    chosen.splice(droppableIndex, 1);
  }
  // If there is spare time and the session is short, add a set to the main lifts.
  if (estimateSessionMinutes(planned) < budget - 12 && planned.length) {
    planned = planned.map((p, i) => (i < 2 && p.target_reps ? { ...p, sets: Math.min(p.sets + 1, 5) } : p));
  }
  planned = planned.map((p, i) => ({ ...p, order: i }));

  return {
    id: uid('pd'),
    weekday,
    kind: template.kind,
    title: template.title,
    focus: template.focus,
    est_minutes: estimateSessionMinutes(planned),
    exercises: planned,
  };
}

/* ------------------------------------------------------------------
   Weekday assignment
   ------------------------------------------------------------------ */

/**
 * Spread training days as evenly as possible across the week and prefer the
 * days the user actually said they can train. Back-to-back hard sessions of
 * the same kind are avoided where the schedule allows it.
 */
export function assignWeekdays(count: number, preferred: Weekday[]): Weekday[] {
  const wanted = [...new Set(preferred)].sort((a, b) => a - b);
  if (wanted.length >= count) return wanted.slice(0, count) as Weekday[];

  const chosen = [...wanted];
  const spacedDefaults: Record<number, Weekday[]> = {
    1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
  };
  for (const d of spacedDefaults[clamp(count, 1, 7)] ?? []) {
    if (chosen.length >= count) break;
    if (!chosen.includes(d)) chosen.push(d);
  }
  let cursor: Weekday = 0;
  while (chosen.length < count && cursor <= 6) {
    if (!chosen.includes(cursor)) chosen.push(cursor);
    cursor = (cursor + 1) as Weekday;
  }
  return chosen.sort((a, b) => a - b).slice(0, count) as Weekday[];
}

/* ------------------------------------------------------------------
   Public entry point
   ------------------------------------------------------------------ */

export interface GenerateOptions {
  seed?: number;
  name?: string;
}

export function generateProgram(profile: FitnessProfile, userId: string, opts: GenerateOptions = {}): Program {
  const days = clamp(profile.days_per_week, 1, 7);
  const split = chooseSplit(days, profile.experience, profile.primary_goal);
  const trainingDays = assignWeekdays(days, profile.preferred_days);
  const random = rng(opts.seed ?? Math.floor(Math.random() * 1e9));

  const programDays: ProgramDay[] = [];
  split.sequence.slice(0, days).forEach((template, i) => {
    const ctx: PickContext = {
      equipment: profile.equipment,
      experience: profile.experience,
      activities: profile.activities,
      used: new Set<string>(),
      random,
      avoidAdvanced: profile.safety.flagged || profile.experience === 'beginner',
    };
    programDays.push(buildDay(template, trainingDays[i], profile, ctx));
  });

  // Every non-training weekday becomes an explicit recovery or rest day, so the
  // calendar never has silent gaps the user has to interpret.
  const trainingSet = new Set(trainingDays);
  const restCandidates: Weekday[] = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((d) => !trainingSet.has(d));
  const wantsActiveRecovery = profile.primary_goal === 'lose_fat' || profile.activities.includes('walking');
  restCandidates.forEach((d, i) => {
    const useRecovery = wantsActiveRecovery && i === 0 && days < 6;
    if (useRecovery) {
      const ctx: PickContext = {
        equipment: profile.equipment, experience: profile.experience,
        activities: profile.activities, used: new Set<string>(), random,
        avoidAdvanced: true,
      };
      programDays.push(buildDay(RECOVERY, d, profile, ctx));
    } else {
      programDays.push(buildDay(REST, d, profile, {
        equipment: profile.equipment, experience: profile.experience,
        activities: profile.activities, used: new Set<string>(), random,
        avoidAdvanced: true,
      }));
    }
  });

  programDays.sort((a, b) => a.weekday - b.weekday);

  return {
    id: uid('prog'),
    user_id: userId,
    name: opts.name ?? `${split.name} — ${GOAL_LABEL[profile.primary_goal]}`,
    goal: profile.primary_goal,
    experience: profile.experience,
    days_per_week: days,
    split: split.name,
    week_count: 8,
    active: true,
    generated: true,
    created_by: userId,
    created_at: nowISO(),
    days: programDays,
    notes: split.description,
  };
}

export const GOAL_LABEL: Record<GoalKind, string> = {
  lose_fat: 'Lose body fat',
  build_muscle: 'Build muscle',
  gain_strength: 'Gain strength',
  improve_endurance: 'Improve endurance',
  general_fitness: 'General fitness',
  mobility: 'Improve mobility',
  maintain: 'Maintain fitness',
};

export const SESSION_KIND_META: Record<SessionKind, { label: string; tone: string; icon: string }> = {
  push: { label: 'Push', tone: 'brand', icon: 'ChevronsUp' },
  pull: { label: 'Pull', tone: 'accent', icon: 'ChevronsDown' },
  legs: { label: 'Legs', tone: 'info', icon: 'Footprints' },
  upper: { label: 'Upper', tone: 'brand', icon: 'ArrowUp' },
  lower: { label: 'Lower', tone: 'info', icon: 'ArrowDown' },
  full_body: { label: 'Full Body', tone: 'accent', icon: 'PersonStanding' },
  cardio: { label: 'Cardio', tone: 'warn', icon: 'HeartPulse' },
  core: { label: 'Core', tone: 'warn', icon: 'Circle' },
  mobility: { label: 'Mobility', tone: 'success', icon: 'Sparkles' },
  recovery: { label: 'Recovery', tone: 'success', icon: 'Leaf' },
  rest: { label: 'Rest', tone: 'muted', icon: 'Moon' },
  custom: { label: 'Custom', tone: 'muted', icon: 'Wrench' },
};

/** Weekly hard sets per muscle group across the program — used by the balance chart. */
export function weeklyVolumeByMuscle(program: Program | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!program) return out;
  for (const day of program.days) {
    for (const pe of day.exercises) {
      const e = EXERCISES.find((x) => x.slug === pe.exercise_slug);
      if (!e || e.type === 'cardio') continue;
      for (const m of e.primary) out[m] = (out[m] ?? 0) + pe.sets;
      for (const m of e.secondary) out[m] = (out[m] ?? 0) + pe.sets * 0.5;
    }
  }
  return out;
}
