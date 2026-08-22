import { describe, expect, it } from 'vitest';
import {
  DistanceTracker, StepDetector, formatPace, haversineKm, walkPaceMinPerKm,
} from '@/lib/fitness/walk';

const GRAVITY = 9.81;

/** Feed a synthetic walking signal: a sine at `cadenceHz` sampled at 50 Hz. */
function walkSignal(detector: StepDetector, seconds: number, cadenceHz: number, amplitude = 2, startMs = 0) {
  const rate = 50;
  for (let i = 0; i < seconds * rate; i++) {
    const t = startMs + (i / rate) * 1000;
    detector.addSample(t, GRAVITY + amplitude * Math.sin(2 * Math.PI * cadenceHz * (i / rate)));
  }
  return startMs + seconds * 1000;
}

describe('StepDetector', () => {
  it('counts a steady walk within tolerance', () => {
    const d = new StepDetector();
    walkSignal(d, 30, 2); // 2 steps/second for 30 s = 60 true steps
    expect(d.steps).toBeGreaterThanOrEqual(54);
    expect(d.steps).toBeLessThanOrEqual(62);
  });

  it('stays at zero when the phone is still', () => {
    const d = new StepDetector();
    for (let i = 0; i < 1500; i++) {
      d.addSample(i * 20, GRAVITY + (Math.random() - 0.5) * 0.4); // sensor noise only
    }
    expect(d.steps).toBe(0);
  });

  it('ignores a single jolt — three rhythmic steps are needed before anything counts', () => {
    const d = new StepDetector();
    // Still, then one sharp bump (phone picked up), then still again.
    for (let i = 0; i < 100; i++) d.addSample(i * 20, GRAVITY);
    d.addSample(2020, GRAVITY + 5);
    d.addSample(2040, GRAVITY + 5);
    for (let i = 0; i < 100; i++) d.addSample(2100 + i * 20, GRAVITY);
    expect(d.steps).toBe(0);
  });

  it('re-requires confirmation after a long pause', () => {
    const d = new StepDetector();
    const t1 = walkSignal(d, 10, 2); // ~20 steps
    const afterWalk = d.steps;
    // 10 s standing still — the rhythm is broken.
    for (let i = 0; i < 500; i++) d.addSample(t1 + i * 20, GRAVITY);
    // Two isolated bumps after the pause should not count.
    d.addSample(t1 + 10500, GRAVITY + 4);
    for (let i = 0; i < 20; i++) d.addSample(t1 + 10520 + i * 20, GRAVITY);
    expect(d.steps).toBe(afterWalk);
  });

  it('rate-limits implausibly fast spikes', () => {
    const d = new StepDetector();
    // 20 Hz vibration — far beyond a human cadence.
    walkSignal(d, 5, 20, 3);
    expect(d.steps).toBeLessThanOrEqual(3 + Math.ceil(5000 / 300) + 1); // bounded by the cadence floor, not the spike rate
  });
});

describe('haversineKm', () => {
  it('measures one degree of latitude as ~111 km', () => {
    const km = haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112.5);
  });

  it('returns zero for identical points', () => {
    expect(haversineKm({ lat: 14.5995, lon: 120.9842 }, { lat: 14.5995, lon: 120.9842 })).toBe(0);
  });
});

describe('DistanceTracker', () => {
  // ~0.00090 degrees latitude ≈ 100 m.
  const step = 0.0009;

  it('accumulates a straight walk', () => {
    const t = new DistanceTracker();
    for (let i = 0; i <= 10; i++) {
      t.addPoint({ lat: 14 + step * i, lon: 121, accuracyM: 8, t: i * 60_000 }); // 100 m per minute
    }
    expect(t.totalKm).toBeGreaterThan(0.9);
    expect(t.totalKm).toBeLessThan(1.1);
  });

  it('ignores fixes with poor accuracy', () => {
    const t = new DistanceTracker();
    t.addPoint({ lat: 14, lon: 121, accuracyM: 8, t: 0 });
    t.addPoint({ lat: 14 + step, lon: 121, accuracyM: 120, t: 60_000 }); // fuzzy — dropped
    expect(t.totalKm).toBe(0);
  });

  it('treats an impossible jump as a glitch and adds nothing', () => {
    const t = new DistanceTracker();
    t.addPoint({ lat: 14, lon: 121, accuracyM: 8, t: 0 });
    t.addPoint({ lat: 14.1, lon: 121, accuracyM: 8, t: 30_000 }); // ~11 km in 30 s
    expect(t.totalKm).toBe(0);
    // …but resyncs, so walking continues to count from the new position.
    t.addPoint({ lat: 14.1 + step, lon: 121, accuracyM: 8, t: 90_000 });
    expect(t.totalKm).toBeGreaterThan(0.09);
  });

  it('does not bank standing-still jitter below the noise floor', () => {
    const t = new DistanceTracker();
    t.addPoint({ lat: 14, lon: 121, accuracyM: 20, t: 0 });
    for (let i = 1; i <= 20; i++) {
      t.addPoint({ lat: 14 + 0.00003 * (i % 2), lon: 121, accuracyM: 20, t: i * 5_000 }); // ±3 m wobble
    }
    expect(t.totalKm).toBe(0);
  });
});

describe('pace', () => {
  it('computes and formats minutes per km', () => {
    const pace = walkPaceMinPerKm(2, 24 * 60_000); // 2 km in 24 min
    expect(pace).toBe(12);
    expect(formatPace(pace)).toBe('12:00 /km');
  });

  it('declines to invent a pace from too little distance', () => {
    expect(walkPaceMinPerKm(0.02, 60_000)).toBeNull();
    expect(formatPace(null)).toBe('—');
  });
});
