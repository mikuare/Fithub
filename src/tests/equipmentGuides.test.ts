import { describe, expect, it } from 'vitest';
import { EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import {
  equipmentGuideFor, equipmentVideoUrl, exercisesUsing, guideMinutes,
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
