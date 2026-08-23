import type { Equipment, Exercise, Experience, GoalKind, MuscleGroup } from '@/types';
import type { Phase } from '@/store/timer';
import { EXERCISES, EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import { repScheme } from './calculations';
import { canPerform } from './program';
import { equipmentGuideFor } from './equipmentGuides';
import { uid } from '@/lib/id';

/* ============================================================
   Practice builder
   "I have this bit of kit and I want to train this — what do I
   actually do?" Picks real movements out of the library, gives
   each one sets, reps and rest, and turns the whole thing into
   timer phases so it can be run rather than just read.

   Everything here is pure, so the picks are testable and the
   same inputs always give the same session.
   ============================================================ */

export type PracticeTarget =
  | 'abs' | 'biceps' | 'triceps' | 'chest' | 'back' | 'shoulders'
  | 'legs' | 'glutes' | 'full_body' | 'cardio';

export const PRACTICE_TARGETS: Array<{ value: PracticeTarget; label: string; muscles: MuscleGroup[] }> = [
  { value: 'abs', label: 'Abs & core', muscles: ['core', 'obliques'] },
  { value: 'biceps', label: 'Biceps', muscles: ['biceps', 'forearms'] },
  { value: 'triceps', label: 'Triceps', muscles: ['triceps'] },
  { value: 'chest', label: 'Chest', muscles: ['chest'] },
  { value: 'back', label: 'Back', muscles: ['back', 'lats', 'traps'] },
  { value: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { value: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'calves'] },
  { value: 'glutes', label: 'Glutes', muscles: ['glutes'] },
  { value: 'full_body', label: 'Full body', muscles: ['full_body', 'chest', 'back', 'quads', 'glutes', 'core'] },
  { value: 'cardio', label: 'Cardio', muscles: ['cardio'] },
];

export const PRACTICE_GOALS: Array<{ value: GoalKind; label: string; hint: string }> = [
  { value: 'build_muscle', label: 'Build muscle', hint: 'Moderate reps, 90s rest' },
  { value: 'gain_strength', label: 'Get stronger', hint: 'Low reps, long rest' },
  { value: 'lose_fat', label: 'Burn fat', hint: 'Higher reps, short rest' },
  { value: 'improve_endurance', label: 'Endurance', hint: 'Light and controlled' },
  { value: 'general_fitness', label: 'General fitness', hint: 'A balanced middle' },
];

const TARGET_MUSCLES: Record<PracticeTarget, MuscleGroup[]> =
  Object.fromEntries(PRACTICE_TARGETS.map((t) => [t.value, t.muscles])) as Record<PracticeTarget, MuscleGroup[]>;

/* ---------------- equipment search ---------------- */

/**
 * What people actually type when they look for their kit. Brand names,
 * regional names and near-misses all land on the closest thing FitHub
 * knows, rather than on an empty result.
 */
const ALIASES: Record<Equipment, string[]> = {
  dumbbells: ['dumbbell', 'db', 'free weights', 'hand weights', 'adjustable dumbbell'],
  barbell: ['bar', 'olympic bar', 'ez bar', 'ez curl bar', 'curl bar', 'straight bar', 'weight bar', 'trap bar', 'hex bar'],
  bench: ['weight bench', 'flat bench', 'incline bench', 'adjustable bench'],
  squat_rack: ['power rack', 'rack', 'cage', 'power cage', 'squat stand', 'half rack'],
  cable: ['cable machine', 'pulley', 'cable tower', 'functional trainer', 'lat machine', 'cable crossover'],
  smith: ['smith machine'],
  treadmill: ['running machine', 'walking pad', 'runner'],
  bike: ['exercise bike', 'spin bike', 'stationary bike', 'air bike', 'assault bike', 'recumbent bike', 'cycling machine'],
  bands: ['resistance band', 'band', 'loop band', 'mini band', 'theraband', 'tube band', 'booty band', 'chest expander'],
  kettlebell: ['kettle bell', 'kb', 'girya'],
  pullup_bar: ['pull up bar', 'chin up bar', 'doorway bar', 'chinning bar', 'hanging bar'],
  machine: ['weight machine', 'leg press', 'chest press machine', 'pin loaded', 'selectorised', 'lat pulldown machine'],
  bodyweight: ['no equipment', 'none', 'nothing', 'calisthenics', 'body weight', 'floor'],
  medicine_ball: ['med ball', 'slam ball', 'wall ball'],
  jump_rope: ['skipping rope', 'skip rope', 'speed rope', 'jumping rope'],
  box: ['plyo box', 'jump box', 'aerobic step', 'step platform', 'plyometric box'],
  rower: ['rowing machine', 'erg', 'row erg', 'concept 2', 'concept2'],
  ankle_strap: ['ankle cuff', 'leg strap', 'ankle attachment', 'leg cuff', 'ankle weights'],
  power_twister: ['twister bar', 'spring bar', 'arm twister', 'bullworker', 'steel twister'],
  ab_wheel: ['ab roller', 'abdominal wheel', 'roller wheel', 'ab carver'],
  suspension: ['trx', 'suspension straps', 'gym straps', 'sling trainer', 'suspension trainer'],
  foam_roller: ['foam roll', 'massage roller', 'trigger point roller'],
  stability_ball: ['swiss ball', 'yoga ball', 'exercise ball', 'gym ball', 'balance ball', 'birth ball'],
  dip_bars: ['dip bar', 'parallel bars', 'parallettes', 'dip station', 'dip stand', 'push up bars'],
  elliptical: ['cross trainer', 'crosstrainer', 'elliptical machine'],
  mat: ['yoga mat', 'exercise mat', 'gym mat', 'floor mat', 'pilates mat'],
  hand_gripper: ['grip trainer', 'hand grip', 'grip strengthener', 'captains of crush', 'gripper', 'hand exerciser'],
};

/** True when `needle` appears in `haystack` as a whole word sequence. */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface EquipmentMatch {
  equipment: Equipment;
  label: string;
  /** Why it matched, shown to the user so a fuzzy hit is never a surprise. */
  reason: string;
}

/**
 * Finds the kit somebody typed. Returns ranked matches — an empty array
 * means FitHub genuinely does not know it, and the caller says so instead
 * of inventing an answer.
 */
export function searchEquipment(query: string): EquipmentMatch[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  const words = q.split(' ').filter((w) => w.length > 2);

  const scored = EQUIPMENT_OPTIONS.map((equipment) => {
    const label = EQUIPMENT_LABEL[equipment] ?? equipment;
    const names = [normalise(label), normalise(equipment.replace(/_/g, ' ')), ...ALIASES[equipment].map(normalise)];

    let score = 0;
    let reason = '';
    for (const name of names) {
      if (name === q) { score = Math.max(score, 100); reason = `“${query.trim()}” is ${label.toLowerCase()}`; }
      // The query inside a name is a prefix/partial ("kettle" → kettlebell).
      // A name inside the query has to land on whole words, or two-letter
      // aliases like "db" match the middle of "sandbag".
      else if (name.includes(q) || containsWords(q, name)) {
        const s = 70 + Math.min(name.length, 20);
        if (s > score) { score = s; reason = `Matches ${name}`; }
      }
    }
    if (score === 0 && words.length) {
      const hits = words.filter((w) => names.some((n) => n.includes(w))).length;
      if (hits > 0) { score = 30 + hits * 5; reason = `Close to ${label.toLowerCase()}`; }
    }
    // Last resort: they typed an exercise name rather than a piece of kit.
    if (score === 0) {
      const exercise = EXERCISES.find((e) => normalise(e.name).includes(q) && e.equipment.includes(equipment));
      if (exercise) { score = 25; reason = `${exercise.name} uses it`; }
    }
    return { equipment, label, reason, score };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ equipment, label, reason }) => ({ equipment, label, reason }));
}

/* ---------------- session building ---------------- */

export interface PracticeStep {
  kind: 'warmup' | 'exercise' | 'cooldown';
  slug: string | null;
  name: string;
  /** One line on what this step is for. */
  detail: string;
  /** The numbered how-to for the movement. */
  cues: string[];
  mistakes: string[];
  sets: number;
  /** Null for timed work. */
  reps: number | null;
  /** Seconds per set. Always set — reps are converted to a working estimate. */
  seconds: number;
  restSeconds: number;
}

export interface Practice {
  /** Null when the user searched for kit FitHub does not know. */
  equipment: Equipment | null;
  equipmentLabel: string;
  target: PracticeTarget;
  targetLabel: string;
  goal: GoalKind;
  steps: PracticeStep[];
  totalSeconds: number;
  /** Set when the build had to compromise, so the UI can be honest about it. */
  note: string | null;
}

const DIFFICULTY_CEILING: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/** Working seconds for a set of `reps`, matching the programme estimator. */
function secondsForReps(reps: number): number {
  return Math.max(20, Math.round(reps * 3.5));
}

function pickExercises(
  equipment: Equipment | null,
  target: PracticeTarget,
  experience: Experience,
  count: number,
): Exercise[] {
  const muscles = TARGET_MUSCLES[target];
  const owned: Equipment[] = equipment ? [equipment] : [];
  const ceiling = DIFFICULTY_CEILING[experience];

  const scored = EXERCISES
    .filter((e) => canPerform(e, owned))
    .filter((e) => DIFFICULTY_RANK[e.difficulty] <= ceiling)
    .map((e) => {
      const primary = e.primary.filter((m) => muscles.includes(m)).length;
      const secondary = e.secondary.filter((m) => muscles.includes(m)).length;
      if (primary === 0 && secondary === 0) return null;

      let score = primary * 10 + secondary * 3;
      // Strongly prefer movements that actually use the chosen kit — the whole
      // point of picking it. Bodyweight only fills gaps.
      if (equipment && e.equipment.includes(equipment)) score += 25;
      if (e.mechanic === 'compound') score += 4;
      score += DIFFICULTY_RANK[e.difficulty];
      return { exercise: e, score };
    })
    .filter((x): x is { exercise: Exercise; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.exercise.slug.localeCompare(b.exercise.slug));

  return scored.slice(0, count).map((x) => x.exercise);
}

export function buildPractice(opts: {
  equipment: Equipment | null;
  /** Free text, used only when equipment is null. */
  unknownLabel?: string;
  target: PracticeTarget;
  goal: GoalKind;
  experience: Experience;
}): Practice {
  const { equipment, target, goal, experience } = opts;
  const targetLabel = PRACTICE_TARGETS.find((t) => t.value === target)?.label ?? target;
  const wanted = target === 'full_body' ? 5 : 4;

  const kitLabel = equipment
    ? (EQUIPMENT_LABEL[equipment] ?? equipment).toLowerCase()
    : (opts.unknownLabel || 'no equipment');

  let note: string | null = null;
  let chosen = pickExercises(equipment, target, experience, wanted);

  // Nothing at this trainee's level, but something above it exists.
  if (chosen.length === 0) {
    chosen = pickExercises(equipment, target, 'advanced', wanted);
    if (chosen.length > 0) {
      note = `Everything FitHub has for ${targetLabel.toLowerCase()} with ${kitLabel} is above ${experience} level. Take these carefully and use the easier variation on each exercise page.`;
    }
  }

  // The pairing genuinely does not exist — say so, then give something useful.
  if (chosen.length === 0) {
    chosen = pickExercises(null, 'full_body', experience, wanted);
    note = `Nothing in FitHub's library trains ${targetLabel.toLowerCase()} with ${kitLabel}. This is a full-body bodyweight practice instead.`;
  }

  if (!note) {
    if (!equipment) {
      note = opts.unknownLabel
        ? `FitHub does not know “${opts.unknownLabel}” yet, so this is a bodyweight practice for the same muscles. The steps still apply if your kit loads the same movement.`
        : 'Bodyweight practice — no equipment needed.';
    } else if (chosen.every((e) => !e.equipment.includes(equipment))) {
      // The kit and the target do not meet — say so rather than pretending a
      // bodyweight session was what was asked for.
      note = `FitHub has no ${targetLabel.toLowerCase()} exercises for a ${kitLabel}, so this practice is bodyweight work for the same muscles.`;
    }
  }

  const guide = equipment ? equipmentGuideFor(equipment) : null;
  const steps: PracticeStep[] = [];

  steps.push({
    kind: 'warmup',
    slug: null,
    name: 'Warm-up',
    detail: guide?.plan[0]?.detail ?? 'Loosen the joints you are about to load and do one easy set of the first movement.',
    cues: guide
      ? [guide.steps[0], guide.steps[1]].filter(Boolean)
      : ['Move every joint you are about to load through its full range.', 'Do one easy set of the first exercise at about half effort.'],
    mistakes: [],
    sets: 1,
    reps: null,
    seconds: 180,
    restSeconds: 30,
  });

  for (const exercise of chosen) {
    const scheme = repScheme(goal, experience, exercise.mechanic);
    const timed = exercise.type === 'timed' || exercise.type === 'mobility';
    const cardio = exercise.type === 'cardio';

    const sets = cardio ? 1 : timed ? Math.max(2, scheme.sets - 1) : scheme.sets;
    const reps = cardio || timed ? null : scheme.reps;
    const seconds = cardio
      ? 8 * 60
      : timed
        ? (experience === 'beginner' ? 30 : 45)
        : secondsForReps(scheme.reps);

    steps.push({
      kind: 'exercise',
      slug: exercise.slug,
      name: exercise.name,
      detail: cardio
        ? `${Math.round(seconds / 60)} minutes steady · ${scheme.intensityNote}`
        : timed
          ? `${sets} sets × ${seconds}s hold · ${scheme.restSeconds}s rest`
          : `${sets} sets × ${reps} reps · ${scheme.restSeconds}s rest · ${scheme.intensityNote}`,
      cues: exercise.instructions,
      mistakes: exercise.mistakes,
      sets,
      reps,
      seconds,
      restSeconds: cardio ? 60 : timed ? 45 : scheme.restSeconds,
    });
  }

  steps.push({
    kind: 'cooldown',
    slug: null,
    name: 'Cool down',
    detail: guide?.plan[guide.plan.length - 1]?.detail ?? 'Bring your breathing down and stretch what you just trained.',
    cues: ['Walk or breathe easy until your heart rate settles.', 'Stretch the muscles you trained, 30 seconds each.'],
    mistakes: [],
    sets: 1,
    reps: null,
    seconds: 180,
    restSeconds: 0,
  });

  const totalSeconds = steps.reduce(
    (total, s) => total + s.sets * s.seconds + Math.max(0, s.sets - 1) * s.restSeconds,
    0,
  );

  return {
    equipment,
    equipmentLabel: equipment ? (EQUIPMENT_LABEL[equipment] ?? equipment) : (opts.unknownLabel || 'Bodyweight'),
    target,
    targetLabel,
    goal,
    steps,
    totalSeconds,
    note,
  };
}

/* ---------------- running it ---------------- */

export interface PracticeRun {
  phases: Phase[];
  /** phase index → index into practice.steps, so the UI can show the cues. */
  stepOfPhase: number[];
}

/** Turns a practice into timer phases the shared timer store can run. */
export function practiceToPhases(practice: Practice): PracticeRun {
  const phases: Phase[] = [];
  const stepOfPhase: number[] = [];

  const push = (phase: Phase, stepIndex: number) => {
    phases.push(phase);
    stepOfPhase.push(stepIndex);
  };

  practice.steps.forEach((step, stepIndex) => {
    for (let set = 1; set <= step.sets; set++) {
      push({
        id: uid('ph'),
        label: step.name,
        kind: step.kind === 'warmup' ? 'prepare' : step.kind === 'cooldown' ? 'cooldown' : 'work',
        seconds: step.seconds,
        round: step.sets > 1 ? set : undefined,
        totalRounds: step.sets > 1 ? step.sets : undefined,
      }, stepIndex);

      const lastSetOfLastStep = stepIndex === practice.steps.length - 1 && set === step.sets;
      if (step.restSeconds > 0 && !lastSetOfLastStep) {
        push({
          id: uid('ph'),
          label: set === step.sets ? `Rest — next: ${practice.steps[stepIndex + 1]?.name ?? 'finish'}` : 'Rest',
          kind: 'rest',
          seconds: step.restSeconds,
        }, stepIndex);
      }
    }
  });

  return { phases, stepOfPhase };
}
