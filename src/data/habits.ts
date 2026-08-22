import type { HabitDefinition, ID } from '@/types';
import { uid } from '@/lib/id';

export interface HabitTemplate {
  key: string;
  name: string;
  icon: string;
  unit: HabitDefinition['unit'];
  target: number;
  color: string;
  blurb: string;
  defaultOn: boolean;
}

/** Users pick which of these they want. Nothing is mandatory. */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { key: 'water', name: 'Water', icon: 'Droplets', unit: 'ml', target: 2500, color: '#38BDF8', blurb: 'Steady hydration supports training output and recovery.', defaultOn: true },
  { key: 'sleep', name: 'Sleep', icon: 'BedDouble', unit: 'hours', target: 8, color: '#7C5CFF', blurb: 'The single biggest lever on how you feel and perform.', defaultOn: true },
  { key: 'steps', name: 'Steps', icon: 'Footprints', unit: 'steps', target: 8000, color: '#B9F227', blurb: 'Daily movement outside the gym adds up quickly.', defaultOn: true },
  { key: 'stretch', name: 'Stretching', icon: 'Sparkles', unit: 'minutes', target: 10, color: '#34C77B', blurb: 'A few minutes a day keeps hard-won range of motion.', defaultOn: false },
  { key: 'produce', name: 'Fruit & vegetables', icon: 'Apple', unit: 'servings', target: 5, color: '#F5BE3E', blurb: 'A simple, non-restrictive nutrition habit.', defaultOn: false },
  { key: 'protein', name: 'Protein with each meal', icon: 'Beef', unit: 'count', target: 3, color: '#F87171', blurb: 'Spreading protein across the day supports recovery.', defaultOn: false },
  { key: 'meditation', name: 'Meditation', icon: 'Brain', unit: 'minutes', target: 10, color: '#A78BFA', blurb: 'Stress management is part of recovery, not separate from it.', defaultOn: false },
  { key: 'mobility', name: 'Mobility session', icon: 'Move', unit: 'count', target: 1, color: '#22D3EE', blurb: 'A short daily mobility block, ticked off when done.', defaultOn: false },
];

export function habitsFromTemplates(userId: ID, keys: string[]): HabitDefinition[] {
  return HABIT_TEMPLATES.filter((t) => keys.includes(t.key)).map((t, i) => ({
    id: uid('habit'),
    user_id: userId,
    key: t.key,
    name: t.name,
    icon: t.icon,
    unit: t.unit,
    target: t.target,
    active: true,
    color: t.color,
    order: i,
  }));
}

export const HABIT_UNIT_LABEL: Record<HabitDefinition['unit'], string> = {
  count: '', ml: 'ml', hours: 'h', steps: 'steps', minutes: 'min', servings: 'servings',
};

/** Sensible one-tap increments per unit so logging takes a single tap. */
export const HABIT_STEP: Record<HabitDefinition['unit'], number> = {
  count: 1, ml: 250, hours: 0.5, steps: 500, minutes: 5, servings: 1,
};
