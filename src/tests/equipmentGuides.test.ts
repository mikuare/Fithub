import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_LABEL, EQUIPMENT_OPTIONS, EXERCISES, IMPLIED_EQUIPMENT, expandEquipment,
} from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { searchEquipment } from '@/lib/fitness/practice';
import type { GoalKind } from '@/types';
import {
  equipmentGoalRoutine, equipmentGuideFor, equipmentVideoUrl, exercisesUsing,
  guideMinutes, hasGoalRoutine,
} from '@/lib/fitness/equipmentGuides';

describe('equipment guides', () => {
  it('covers every piece of equipment the pickers offer', () => {
    for (const equipment of EQUIPMENT_OPTIONS) {
      expect(equipmentGuideFor(equipment), `no guide for ${equipment}`).toBeTruthy();
      expect(EQUIPMENT_LABEL[equipment], `no label for ${equipment}`).toBeTruthy();
    }
  });

  it('gives every guide steps, a timed plan and safety notes', () => {
    for (const equipment of EQUIPMENT_OPTIONS) {
      const guide = equipmentGuideFor(equipment)!;
      expect(guide.steps.length, `${equipment} steps`).toBeGreaterThanOrEqual(4);
      expect(guide.safety.length, `${equipment} safety`).toBeGreaterThan(0);
      expect(guide.trains.length, `${equipment} trains`).toBeGreaterThan(0);
      expect(guide.plan.length, `${equipment} plan`).toBeGreaterThan(0);
      for (const row of guide.plan) expect(row.minutes).toBeGreaterThan(0);
      // A session nobody could fit in, or one over an hour, is a data mistake.
      expect(guideMinutes(guide), `${equipment} minutes`).toBeGreaterThanOrEqual(5);
      expect(guideMinutes(guide), `${equipment} minutes`).toBeLessThanOrEqual(60);
    }
  });

  it('includes the ankle strap and the power twister with real instructions', () => {
    const ankle = equipmentGuideFor('ankle_strap')!;
    expect(ankle.steps.join(' ')).toMatch(/cuff/i);
    expect(ankle.trains).toContain('Glutes');

    const twister = equipmentGuideFor('power_twister')!;
    expect(twister.steps.join(' ')).toMatch(/spring/i);
    expect(twister.safety.join(' ')).toMatch(/snap/i);
  });

  it('returns a video reference only where the guide declares one', () => {
    const withVideo = equipmentGuideFor('ankle_strap')!;
    expect(equipmentVideoUrl(withVideo)).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);

    // "How to use a mat" is not something anyone needs to watch, and the UI
    // says so rather than opening an empty search.
    const withoutVideo = equipmentGuideFor('mat')!;
    expect(withoutVideo.videoQuery).toBeNull();
    expect(equipmentVideoUrl(withoutVideo)).toBeNull();
  });

  it('links equipment to the exercises that actually need it', () => {
    const dumbbell = exercisesUsing('dumbbells');
    expect(dumbbell.length).toBeGreaterThan(0);
    expect(dumbbell.every((e) => e.equipment.includes('dumbbells'))).toBe(true);

    // Nothing in the library needs one yet; the guide still stands alone.
    expect(exercisesUsing('power_twister')).toEqual([]);
  });
});

const GOALS: GoalKind[] = [
  'lose_fat', 'build_muscle', 'gain_strength', 'improve_endurance',
  'general_fitness', 'mobility', 'maintain',
];

describe('11pc resistance band set', () => {
  it('is offered by the pickers with a guide of its own', () => {
    expect(EQUIPMENT_OPTIONS).toContain('band_set');
    expect(EQUIPMENT_LABEL.band_set).toMatch(/11pc/i);
    const guide = equipmentGuideFor('band_set')!;
    expect(guide.steps.length).toBeGreaterThanOrEqual(8);
    expect(guide.summary).toMatch(/door anchor/i);
  });

  it('warns about the two things that actually injure people', () => {
    const safety = equipmentGuideFor('band_set')!.safety.join(' ');
    expect(safety).toMatch(/opens? towards you|pull side/i); // door swinging into your face
    expect(safety).toMatch(/inspect|nick|split|crack/i);     // a perished tube snapping
  });

  it('is matched from how the product is actually listed for sale', () => {
    const listing = '11pcs Resistance Bands Set Workout Fintess Exercise Tube Door Anchor Ankle';
    expect(searchEquipment(listing)[0]?.equipment).toBe('band_set');
    for (const q of ['resistance band set', 'tube band set', 'door anchor set']) {
      expect(searchEquipment(q).some((m) => m.equipment === 'band_set'), q).toBe(true);
    }
  });

  it('unlocks the tubes, the anchor and the ankle cuffs from one tick', () => {
    const owned = expandEquipment(['band_set']);
    expect(owned.has('bands')).toBe(true);
    expect(owned.has('ankle_strap')).toBe(true);
    expect(IMPLIED_EQUIPMENT.band_set).toEqual(['bands', 'ankle_strap']);
  });

  it('can actually programme every movement its routines name', () => {
    const usable = EXERCISES.filter((e) => canPerform(e, ['band_set']));
    const named = [
      'banded-chest-press', 'banded-row', 'banded-lat-pulldown', 'banded-overhead-press',
      'banded-squat', 'banded-romanian-deadlift', 'banded-bicep-curl',
      'banded-triceps-pressdown', 'banded-glute-kickback',
    ];
    for (const slug of named) {
      expect(usable.some((e) => e.slug === slug), `${slug} not performable with the kit`).toBe(true);
    }
  });

  it('covers push, pull, legs and hips so a whole body session is possible', () => {
    const cats = new Set(
      EXERCISES.filter((e) => canPerform(e, ['band_set']) && e.equipment.includes('bands'))
        .map((e) => e.category),
    );
    for (const c of ['chest', 'back', 'shoulders', 'legs', 'glutes']) expect(cats).toContain(c);
  });

  it('lists what the kit can do alone before what still needs a gym', () => {
    const listed = exercisesUsing('band_set', 6);
    const owned = expandEquipment(['band_set']);
    const soloable = listed.map((e) => e.equipment.every((x) => owned.has(x)));
    // Once the list stops being soloable it must not start again.
    expect(soloable).toEqual([...soloable].sort((a, b) => Number(b) - Number(a)));
    expect(soloable[0]).toBe(true);
  });
});

describe('goal routines', () => {
  it('gives the band set a routine for every goal', () => {
    expect(hasGoalRoutine('band_set')).toBe(true);
    for (const goal of GOALS) {
      const r = equipmentGoalRoutine('band_set', goal)!;
      expect(r, goal).toBeTruthy();
      expect(r.steps.length, goal).toBeGreaterThanOrEqual(4);
      expect(r.dose.length, goal).toBeGreaterThan(10);
      expect(r.weekly.length, goal).toBeGreaterThan(5);
      for (const step of r.steps) {
        expect(step.title.length, goal).toBeGreaterThan(5);
        expect(step.detail.length, goal).toBeGreaterThan(20);
        expect(step.cue.length, goal).toBeGreaterThan(10);
      }
    }
  });

  it('actually differs by goal rather than relabelling one routine', () => {
    const distinct = new Set(
      (['lose_fat', 'build_muscle', 'gain_strength', 'improve_endurance', 'mobility'] as GoalKind[])
        .map((g) => equipmentGoalRoutine('band_set', g)!.headline),
    );
    expect(distinct.size).toBe(5);
  });

  it('admits where the kit is the wrong tool instead of overselling it', () => {
    expect(equipmentGoalRoutine('band_set', 'gain_strength')!.caveat).toMatch(/ceiling|falls short|serves worst/i);
    expect(equipmentGoalRoutine('band_set', 'improve_endurance')!.caveat).toMatch(/cardio|heart|running/i);
    expect(equipmentGoalRoutine('band_set', 'build_muscle')!.caveat).toMatch(/cap|dumbbell/i);
  });

  it('returns null for kit with nothing goal-specific to say', () => {
    for (const eq of ['dumbbells', 'treadmill', 'mat'] as const) {
      expect(hasGoalRoutine(eq)).toBe(false);
      expect(equipmentGoalRoutine(eq, 'lose_fat')).toBeNull();
    }
  });
});
