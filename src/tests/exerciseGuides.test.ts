import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@/data/exercises';
import { exerciseGuideFor } from '@/lib/fitness/exerciseGuides';

describe('exercise visual guides', () => {
  it('provides images, a reference-video destination and three cues for every exercise', () => {
    for (const exercise of EXERCISES) {
      const guide = exerciseGuideFor(exercise);
      expect(guide.images.length).toBeGreaterThan(0);
      expect(guide.images.every((image) => image.src.length > 0 && image.alt.includes(exercise.name))).toBe(true);
      expect(guide.videoUrl).toContain('youtube.com/results?search_query=');
      expect(decodeURIComponent(guide.videoUrl)).toContain(exercise.name);
      expect(guide.setupCue.length).toBeGreaterThan(0);
      expect(guide.movementCue.length).toBeGreaterThan(0);
      expect(guide.finishCue.length).toBeGreaterThan(0);
    }
  });
});
