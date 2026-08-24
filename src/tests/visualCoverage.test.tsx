import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExerciseVisualGuide } from '@/components/workout/ExerciseVisualGuide';
import { useData } from '@/store/data';
import { EXERCISES, EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import { equipmentGuideFor } from '@/lib/fitness/equipmentGuides';
import { exerciseGuideFor } from '@/lib/fitness/exerciseGuides';

/* ============================================================
   Visual coverage
   A pre-deploy guard: nothing in the app should ever render as
   a nameless box or a broken image. Every piece of kit needs a
   drawing, every exercise needs artwork and cues, every local
   asset has to exist on disk, and any remote host has to be one
   the service worker actually caches.
   ============================================================ */

/** Equipment with an explicit case in the art switch, read from the source. */
const drawnEquipment = new Set(
  [...readFileSync('src/components/EquipmentArt.tsx', 'utf8').matchAll(/case '([a-z_]+)':/g)]
    .map((m) => m[1]),
);

/** Origins the service worker is configured to cache art from. */
const cachedOrigins: string[] = JSON.parse(
  /REMOTE_ART_ORIGINS = (\[[^\]]*\])/.exec(readFileSync('public/sw.js', 'utf8'))![1].replace(/'/g, '"'),
);

describe('equipment visual coverage', () => {
  it('gives every selectable piece of kit a label, a guide and its own drawing', () => {
    for (const equipment of EQUIPMENT_OPTIONS) {
      expect(EQUIPMENT_LABEL[equipment], `${equipment} has no label`).toBeTruthy();
      expect(equipmentGuideFor(equipment), `${equipment} has no guide`).toBeTruthy();
      // Without an explicit case the art switch falls through to a bare circle,
      // which reads as "FitHub does not know what this is".
      expect(drawnEquipment.has(equipment), `${equipment} falls back to the generic circle`).toBe(true);
    }
  });
});

describe('exercise visual coverage', () => {
  it('gives every exercise artwork and three cues', () => {
    for (const exercise of EXERCISES) {
      const guide = exerciseGuideFor(exercise);
      expect(guide.images.length, `${exercise.slug} has no artwork`).toBeGreaterThan(0);
      expect(guide.setupCue.length, `${exercise.slug} setup cue`).toBeGreaterThan(0);
      expect(guide.movementCue.length, `${exercise.slug} movement cue`).toBeGreaterThan(0);
      expect(guide.finishCue.length, `${exercise.slug} finish cue`).toBeGreaterThan(0);
      expect(guide.videoUrl, `${exercise.slug} video`).toContain('youtube.com/results');
      for (const image of guide.images) {
        expect(image.src.length, `${exercise.slug} empty src`).toBeGreaterThan(0);
        expect(image.alt, `${exercise.slug} alt must name the exercise`).toContain(exercise.name);
      }
    }
  });

  it('ships every local image it references', () => {
    const missing: string[] = [];
    for (const exercise of EXERCISES) {
      for (const image of exerciseGuideFor(exercise).images) {
        if (!image.src.startsWith('/')) continue;
        if (!existsSync(`public${image.src}`)) missing.push(`${exercise.slug} -> public${image.src}`);
      }
    }
    expect(missing, `local artwork missing from public/`).toEqual([]);
  });

  it('only points at remote hosts the service worker caches for offline use', () => {
    const uncached = new Set<string>();
    for (const exercise of EXERCISES) {
      for (const image of exerciseGuideFor(exercise).images) {
        if (image.src.startsWith('/')) continue;
        const origin = new URL(image.src).origin;
        if (!cachedOrigins.includes(origin)) uncached.add(origin);
      }
    }
    // A new art host must be added to REMOTE_ART_ORIGINS in public/sw.js, or
    // every image it serves goes blank the moment the user is offline.
    expect([...uncached]).toEqual([]);
  });

  it('serves the band exercises from local files, so the new kit works offline', () => {
    for (const exercise of EXERCISES.filter((e) => e.slug.startsWith('banded-'))) {
      const [image] = exerciseGuideFor(exercise).images;
      expect(image.src, exercise.slug).toMatch(/^\/exercise-guides\/.+\.svg$/);
      expect(existsSync(`public${image.src}`), exercise.slug).toBe(true);
    }
  });
});

/* ---------------- the fallback actually renders ---------------- */

describe('artwork failure fallback', () => {
  it('replaces a broken image with what the exercise trains, not a broken icon', () => {
    // The guide is a paid feature; without a tier the panel is the paywall.
    useData.setState({
      subscription: {
        user_id: 'u1', tier: 'pro', cycle: 'yearly', status: 'active', currency: 'USD',
        started_at: '2026-01-01T00:00:00.000Z', renews_at: '2027-01-01T00:00:00.000Z',
        cancel_at_period_end: false, card_last4: '4242', card_brand: 'visa',
      },
    } as never);

    // An exercise whose artwork is remote, so it is the one that can break.
    const exercise = EXERCISES.find((e) => !exerciseGuideFor(e).images[0].src.startsWith('/'))!;
    const { container, getByText } = render(
      <MemoryRouter><ExerciseVisualGuide exercise={exercise} /></MemoryRouter>,
    );

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) fireEvent.error(img);

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(getByText(/Artwork unavailable/i)).toBeTruthy();
    // The muscle map is inline SVG, so it renders with no network at all.
    expect(container.querySelector('svg')).toBeTruthy();
    cleanup();
  });
});
