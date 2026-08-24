import type { Exercise } from '@/types';

export interface ExerciseGuide {
  videoUrl: string;
  setupCue: string;
  movementCue: string;
  finishCue: string;
  images: Array<{ src: string; alt: string; label?: string }>;
  imageSource: 'fithub' | 'repdb';
}

const REPDB_ASSET_ROOT = 'https://exercise-dataset.com/images/flat';

/** FitHub slugs whose artwork comes from the attributed RepDB free dataset. */
const REPDB_IDS: Record<string, string> = {
  'barbell-bench-press': 'bench-press',
  'dumbbell-bench-press': 'db-bench-press',
  'incline-dumbbell-press': 'incline-db-press',
  'incline-barbell-press': 'incline-bench-press',
  'push-up': 'push-up',
  'incline-push-up': 'incline-push-ups',
  'machine-chest-press': 'chest-press-machine',
  'dumbbell-fly': 'db-fly',
  'pec-deck': 'machine-chest-fly',
  'dip-chest': 'dips',
  'pull-up': 'pull-up',
  'assisted-pull-up': 'assisted-pull-ups',
  'lat-pulldown': 'lat-pulldown',
  'barbell-row': 'barbell-row',
  'dumbbell-row': 'single-arm-db-row',
  'seated-cable-row': 'wide-grip-seated-cable-row',
  'chest-supported-row': 'chest-supported-db-row',
  'inverted-row': 'inverted-row',
  'straight-arm-pulldown': 'straight-arm-pulldown',
  deadlift: 'deadlift',
  'romanian-deadlift': 'romanian-deadlift',
  'trap-bar-deadlift': 'hex-bar-deadlift',
  'back-extension': 'back-extension',
  'face-pull': 'face-pull',
  shrug: 'db-shrug',
  'overhead-press': 'ohp',
  'dumbbell-shoulder-press': 'dumbbell-shoulder-press',
  'machine-shoulder-press': 'machine-shoulder-press',
  'arnold-press': 'arnold-press',
  'lateral-raise': 'lateral-raise',
  'cable-lateral-raise': 'cable-lateral-raise',
  'rear-delt-fly': 'rear-delt-fly',
  'upright-row': 'cable-upright-row',
  'barbell-curl': 'barbell-curl',
  'dumbbell-curl': 'bicep-curl',
  'hammer-curl': 'hammer-curl',
  'cable-curl': 'cable-curl',
  'preacher-curl': 'preacher-curl',
  'chin-up': 'chin-ups',
  'triceps-pushdown': 'tricep-pushdown',
  'overhead-triceps-extension': 'overhead-tricep-extension',
  'skull-crusher': 'skull-crusher',
  'close-grip-bench-press': 'close-grip-bench-press',
  'bench-dip': 'bench-dips',
  'back-squat': 'squat',
  'front-squat': 'front-squat',
  'goblet-squat': 'goblet-squat',
  'bodyweight-squat': 'bodyweight-squat',
  'leg-press': 'leg-press',
  'hack-squat': 'hack-squat',
  'bulgarian-split-squat': 'bulgarian-split-squat',
  lunge: 'lunge',
  'leg-extension': 'leg-extension',
  'leg-curl': 'leg-curl',
  'nordic-curl': 'nordic-hamstring-curl',
  'hip-thrust': 'hip-thrust',
  'glute-bridge': 'glute-bridge',
  'cable-kickback': 'cable-kickback',
  'hip-abduction': 'hip-abduction',
  'calf-raise': 'standing-calf-raise',
  'seated-calf-raise': 'seated-calf-raise',
  'good-morning': 'good-morning',
  plank: 'plank',
  'side-plank': 'side-plank',
  'dead-bug': 'dead-bug',
  'bird-dog': 'bird-dog-hold',
  'ab-wheel': 'ab-wheel-rollout',
  'leg-raise': 'hanging-leg-raise',
  'lying-leg-raise': 'lying-leg-raise',
  'russian-twist': 'russian-twist',
  crunch: 'crunches',
  burpee: 'burpees',
  'mountain-climber': 'mountain-climbers',
  'jumping-jack': 'jumping-jacks',
  'kettlebell-swing': 'kettlebell-swing',
  'wall-sit': 'wall-sit',
  'farmer-carry': 'kettlebell-farmers-walk',
};

const REPDB_SINGLE_POSE = new Set([
  'bird-dog-hold', 'burpees', 'kettlebell-farmers-walk', 'plank', 'side-plank', 'wall-sit',
]);

const REPDB_IMAGE_ID_OVERRIDES: Record<string, string> = {
  'standing-calf-raise': 'machine-calf-raise',
};

/** Purpose-made two-frame images for exercises not present in RepDB. */
const FITHUB_IMAGE_SLUGS = new Set([
  'cable-fly-low-to-high', 't-bar-row', 'band-pull-apart', 'machine-lateral-raise',
  'reverse-pec-deck', 'dip-triceps', 'step-up', 'seated-leg-curl', 'hollow-hold',
  'pallof-press', 'cable-woodchop', 'treadmill-run', 'outdoor-run', 'brisk-walk',
  'stationary-bike', 'cycling', 'rowing', 'elliptical', 'jump-rope', 'cat-cow',
  'hip-flexor-stretch', 'pigeon-stretch', 'figure-four-stretch', 'thoracic-rotation',
  'shoulder-dislocate', 'ankle-mobilization', 'downward-dog', 'foam-roll-quads',
  'worlds-greatest-stretch', 'child-pose',
]);

/**
 * Drawn by scripts/make-band-guides.mjs as SVG rather than PNG: they are line
 * drawings, so they stay crisp at any size and cost a fraction of the weight.
 */
const FITHUB_SVG_SLUGS = new Set([
  'banded-chest-press', 'banded-row', 'banded-lat-pulldown', 'banded-overhead-press',
  'banded-lateral-raise', 'banded-squat', 'banded-romanian-deadlift',
  'banded-bicep-curl', 'banded-triceps-pressdown', 'banded-glute-kickback',
]);

/**
 * Every library exercise gets a useful visual-reference destination without
 * depending on a brittle list of individual video IDs. The exact exercise
 * name and "proper form" keep the results focused while allowing YouTube to
 * surface current, accessible demonstrations in the user's region.
 */
export function exerciseGuideFor(
  exercise: Pick<Exercise, 'slug' | 'name' | 'instructions'>,
): ExerciseGuide {
  const instructions = exercise.instructions.filter(Boolean);
  const middle = Math.floor((instructions.length - 1) / 2);
  const query = `${exercise.name} exercise proper form tutorial`;

  if (FITHUB_IMAGE_SLUGS.has(exercise.slug) || FITHUB_SVG_SLUGS.has(exercise.slug)) {
    const ext = FITHUB_SVG_SLUGS.has(exercise.slug) ? 'svg' : 'png';
    return {
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      setupCue: instructions[0] ?? `Set up for ${exercise.name} with a stable, comfortable position.`,
      movementCue: instructions[middle] ?? instructions[0] ?? 'Move slowly and stay in control.',
      finishCue: instructions[instructions.length - 1] ?? 'Return to the starting position under control.',
      images: [{
        src: `/exercise-guides/${exercise.slug}.${ext}`,
        alt: `${exercise.name} start and finish positions`,
      }],
      imageSource: 'fithub',
    };
  }

  const repdbId = REPDB_IDS[exercise.slug];
  const repdbImageId = repdbId ? REPDB_IMAGE_ID_OVERRIDES[repdbId] ?? repdbId : '';
  const images = repdbId
    ? REPDB_SINGLE_POSE.has(repdbId)
      ? [{ src: `${REPDB_ASSET_ROOT}/${repdbImageId}-main.webp`, alt: `${exercise.name} form`, label: 'Position' }]
      : [
          { src: `${REPDB_ASSET_ROOT}/${repdbImageId}-start.webp`, alt: `${exercise.name} starting position`, label: 'Start' },
          { src: `${REPDB_ASSET_ROOT}/${repdbImageId}-peak.webp`, alt: `${exercise.name} peak position`, label: 'Finish' },
        ]
    : [];

  return {
    videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    setupCue: instructions[0] ?? `Set up for ${exercise.name} with a stable, comfortable position.`,
    movementCue: instructions[middle] ?? instructions[0] ?? 'Move slowly and stay in control.',
    finishCue: instructions[instructions.length - 1] ?? 'Return to the starting position under control.',
    images,
    imageSource: 'repdb',
  };
}
