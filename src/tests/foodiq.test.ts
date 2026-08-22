import { afterEach, describe, expect, it } from 'vitest';
import {
  CAMERA_BLOCKER_COPY, describeCameraFailure, diagnoseCamera, requestCameraStream,
} from '@/lib/fitness/scanEngine';
import {
  foodBenefits, foodProfile, goalEatingStrategy, goalFit, rankFoodsForGoal,
  remainingMacros, suggestFoods,
} from '@/lib/fitness/foodiq';
import { barcodeValid, mapOffProduct, normalizeBarcode, offProductUrl } from '@/lib/fitness/barcode';
import { FOODS } from '@/data/foods';

const chicken = FOODS.find((f) => f.name.startsWith('Chicken breast'))!;
const rice = FOODS.find((f) => f.name.startsWith('White rice'))!;
const broccoli = FOODS.find((f) => f.name.startsWith('Broccoli'))!;
const chocolate = FOODS.find((f) => f.name.startsWith('Dark chocolate'))!;
const banana = FOODS.find((f) => f.name === 'Banana')!;
const coffee = FOODS.find((f) => f.name.startsWith('Coffee'))!;

describe('foodProfile', () => {
  it('computes protein density and macro shares', () => {
    const p = foodProfile(chicken);
    expect(p.proteinPer100kcal).toBeGreaterThan(15);
    expect(p.leadMacro).toBe('protein');
  });

  it('handles zero-calorie foods without dividing by zero', () => {
    const p = foodProfile({ name: 'Water', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(p.proteinPer100kcal).toBeNull();
    expect(p.leadMacro).toBe('balanced');
  });

  it('clamps rounding noise so shares never exceed 100', () => {
    expect(foodProfile(banana).carbShare).toBeLessThanOrEqual(100);
  });
});

describe('foodBenefits', () => {
  it('leads with protein for protein-dense foods', () => {
    expect(foodBenefits(chicken)[0].title).toMatch(/protein-dense/i);
  });

  it('calls out volume for vegetables', () => {
    expect(foodBenefits(broccoli).some((b) => /volume/i.test(b.title))).toBe(true);
  });

  it('treats near-zero-calorie items as calorie-free', () => {
    expect(foodBenefits(coffee)[0].title).toMatch(/calorie-free/i);
  });

  it('always says something honest', () => {
    for (const f of FOODS) expect(foodBenefits(f).length).toBeGreaterThan(0);
  });
});

describe('goalFit', () => {
  it('ranks chicken above chocolate for fat loss, with reasons', () => {
    const c = goalFit(chicken, 'lose_fat');
    const d = goalFit(chocolate, 'lose_fat');
    expect(c.rank).toBeGreaterThan(d.rank);
    expect(c.band).toBe('strong');
    expect(d.band).toBe('situational');
    expect(d.reasons.length).toBeGreaterThan(0); // a trade-off, never just "bad"
  });

  it('rates carbs higher for endurance than for fat loss', () => {
    expect(goalFit(rice, 'improve_endurance').rank).toBeGreaterThan(goalFit(rice, 'lose_fat').rank);
    expect(goalFit(rice, 'improve_endurance').band).toBe('strong');
  });

  it('rewards protein plus calories for muscle building', () => {
    expect(goalFit(chicken, 'build_muscle').band).toBe('strong');
    expect(goalFit(rice, 'build_muscle').band).toBe('solid');
  });

  it('top-ranked foods for fat loss are protein- or volume-led', () => {
    const top = rankFoodsForGoal(FOODS, 'lose_fat', 5);
    for (const f of top) {
      const p = foodProfile(f);
      expect((p.proteinPer100kcal ?? 0) >= 5 || (f.tags ?? []).includes('vegetable')).toBe(true);
    }
  });
});

describe('goalEatingStrategy', () => {
  it('gives grams per day once weight is known', () => {
    const s = goalEatingStrategy('lose_fat', 80);
    expect(s.proteinPerDayG).toEqual([144, 192]);
    expect(s.perMealProteinG).toBe(32);
  });

  it('degrades honestly without a body weight', () => {
    const s = goalEatingStrategy('build_muscle', null);
    expect(s.proteinPerDayG).toBeNull();
    expect(s.perMealProteinG).toBeNull();
    expect(s.proteinPerKg[0]).toBeGreaterThan(0);
  });

  it('demands more protein per kg when cutting than for endurance', () => {
    expect(goalEatingStrategy('lose_fat', 70).proteinPerKg[0])
      .toBeGreaterThan(goalEatingStrategy('improve_endurance', 70).proteinPerKg[0]);
  });
});

describe('remainingMacros & suggestFoods', () => {
  const targets = { calories: 2200, protein_g: 150, carbs_g: 230, fat_g: 70 };

  it('never reports negative remaining and flags overshoot', () => {
    const r = remainingMacros({ calories: 2500, protein: 160, carbs: 250, fat: 80 }, targets);
    expect(r.calories).toBe(0);
    expect(r.overCalories).toBe(true);
  });

  it('suggests protein-forward foods when protein is lagging', () => {
    const r = remainingMacros({ calories: 1400, protein: 60, carbs: 180, fat: 50 }, targets);
    const s = suggestFoods(FOODS, r, 'build_muscle');
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].food.protein_g).toBeGreaterThanOrEqual(8);
    expect(s[0].reason).toMatch(/protein/);
  });

  it('suggests nothing when the day is done or overshot', () => {
    const done = remainingMacros({ calories: 2180, protein: 150, carbs: 225, fat: 70 }, targets);
    expect(suggestFoods(FOODS, done, 'lose_fat')).toHaveLength(0);
    const over = remainingMacros({ calories: 2400, protein: 150, carbs: 230, fat: 75 }, targets);
    expect(suggestFoods(FOODS, over, 'lose_fat')).toHaveLength(0);
  });

  it('only suggests foods that fit the remaining calories', () => {
    const r = remainingMacros({ calories: 2050, protein: 120, carbs: 220, fat: 65 }, targets);
    for (const s of suggestFoods(FOODS, r, 'lose_fat')) {
      expect(s.food.calories).toBeLessThanOrEqual(r.calories + 30);
    }
  });
});

describe('barcode validation', () => {
  it('accepts valid EAN-13, UPC-A and EAN-8 codes', () => {
    expect(barcodeValid('5449000000996')).toBe(true);  // EAN-13
    expect(barcodeValid('4006381333931')).toBe(true);  // EAN-13
    expect(barcodeValid('036000291452')).toBe(true);   // UPC-A
    expect(barcodeValid('96385074')).toBe(true);       // EAN-8
  });

  it('rejects wrong check digits, lengths and junk', () => {
    expect(barcodeValid('5449000000997')).toBe(false);
    expect(barcodeValid('12345')).toBe(false);
    expect(barcodeValid('')).toBe(false);
    expect(barcodeValid('abcdefghijklm')).toBe(false);
  });

  it('normalizes spaces and punctuation before checking', () => {
    expect(normalizeBarcode('544 9000-000996')).toBe('5449000000996');
    expect(barcodeValid('544 9000-000996')).toBe(true);
  });

  it('sends only the digits to Open Food Facts', () => {
    expect(offProductUrl('544 9000-000996')).toBe('https://world.openfoodfacts.org/api/v0/product/5449000000996.json');
  });
});

describe('camera diagnosis', () => {
  const secure = window.isSecureContext;
  const mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  afterEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
    if (mediaDevices) Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
    else delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
  });

  it('blames an insecure context first — the plain-http phone-testing trap', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    expect(diagnoseCamera(true)).toBe('insecure_context');
    expect(CAMERA_BLOCKER_COPY.insecure_context.body).toMatch(/https/i);
  });

  it('reports a missing camera API when the context is secure', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    expect(diagnoseCamera(true)).toBe('no_camera_api'); // jsdom has no mediaDevices
  });

  it('reports a missing decoder after the secure camera checks pass', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.reject(new Error('not called')) },
      configurable: true,
    });
    expect(diagnoseCamera(false)).toBe('no_engine');
    expect(diagnoseCamera(true)).toBeNull();
  });

  it('has copy for every blocker it can return', () => {
    for (const key of ['insecure_context', 'no_camera_api', 'no_engine'] as const) {
      expect(CAMERA_BLOCKER_COPY[key].title.length).toBeGreaterThan(0);
      expect(CAMERA_BLOCKER_COPY[key].body.length).toBeGreaterThan(0);
    }
  });
});

describe('mobile camera startup', () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream;

  it('falls back to an unconstrained camera when a phone rejects rear-camera constraints', async () => {
    const calls: MediaStreamConstraints[] = [];
    const getUserMedia = async (constraints: MediaStreamConstraints) => {
      calls.push(constraints);
      if (calls.length === 1) {
        throw Object.assign(new Error('unsupported constraint'), { name: 'OverconstrainedError' });
      }
      return stream;
    };

    await expect(requestCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(calls).toHaveLength(2);
    expect(calls[0].video).toMatchObject({ facingMode: { ideal: 'environment' } });
    expect(calls[1]).toEqual({ video: true, audio: false });
  });

  it('does not show a second permission prompt after access is denied', async () => {
    let calls = 0;
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getUserMedia = async () => { calls += 1; throw denied; };

    await expect(requestCameraStream(getUserMedia)).rejects.toBe(denied);
    expect(calls).toBe(1);
    expect(describeCameraFailure(denied)).toMatchObject({
      kind: 'denied',
      title: 'Camera permission was blocked',
    });
  });

  it('gives specific recovery advice when another app owns the camera', () => {
    const busy = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    expect(describeCameraFailure(busy)).toMatchObject({ kind: 'busy' });
    expect(describeCameraFailure(busy).body).toMatch(/other apps/i);
  });
});

describe('mapOffProduct', () => {
  const full = {
    status: 1,
    product: {
      product_name: 'Peanut Butter Crunchy',
      brands: 'NutCo, OtherBrand',
      serving_size: '32 g',
      nutriments: {
        'energy-kcal_100g': 588, proteins_100g: 25.1, carbohydrates_100g: 20, fat_100g: 50,
        'energy-kcal_serving': 188, proteins_serving: 8, carbohydrates_serving: 6.4, fat_serving: 16,
      },
    },
  };

  it('maps a complete product with per-serving values', () => {
    const p = mapOffProduct(full)!;
    expect(p.name).toBe('Peanut Butter Crunchy');
    expect(p.brand).toBe('NutCo');
    expect(p.per100g.calories).toBe(588);
    expect(p.perServing?.protein_g).toBe(8);
    expect(p.complete).toBe(true);
  });

  it('converts kJ when kcal is absent', () => {
    const p = mapOffProduct({
      status: 1,
      product: { product_name: 'Juice', nutriments: { energy_100g: 180, carbohydrates_100g: 10 } },
    })!;
    expect(p.per100g.calories).toBe(43);
    expect(p.per100g.protein_g).toBeNull();
    expect(p.complete).toBe(false);
    expect(p.perServing).toBeNull();
  });

  it('keeps valid numeric strings from community nutrition records', () => {
    const p = mapOffProduct({
      status: 1,
      product: {
        product_name: 'String values',
        nutriments: {
          'energy-kcal_100g': '120', proteins_100g: '8.5', carbohydrates_100g: '14', fat_100g: '3.2',
        },
      },
    })!;
    expect(p.per100g).toEqual({ calories: 120, protein_g: 8.5, carbs_g: 14, fat_g: 3.2 });
    expect(p.complete).toBe(true);
  });

  it('returns null for unknown products and nameless entries', () => {
    expect(mapOffProduct({ status: 0 })).toBeNull();
    expect(mapOffProduct({ status: 1, product: { nutriments: {} } })).toBeNull();
    expect(mapOffProduct(null)).toBeNull();
  });
});
