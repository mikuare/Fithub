import { round } from '@/lib/utils';

/* ============================================================
   Walk Mode — the measurable parts.
   Step detection from accelerometer magnitude and distance from
   GPS fixes, as pure incremental classes so the algorithms are
   testable with synthetic data. The sensors themselves live in
   the Walk page; everything here is deterministic.

   Honesty note baked into the design: this counts only while the
   app is in the foreground with the screen on — a web app gets
   no background pedometer on iOS or Android, and Walk Mode says
   so instead of pretending.
   ============================================================ */

/* ---------------- step detection ---------------- */

const SMOOTH_ALPHA = 0.3;      // fast smoothing of the magnitude signal
const BASELINE_ALPHA = 0.02;   // slow-moving gravity baseline
const STEP_THRESHOLD = 1.0;    // m/s² above baseline that reads as a stride
const RESET_FRACTION = 0.5;    // hysteresis: must fall back below this × threshold
const MIN_STEP_MS = 300;       // faster than ~200 steps/min is not walking
const MAX_GAP_MS = 2500;       // a longer pause ends the rhythm
const CONFIRM_STEPS = 3;       // candidates needed before any step counts

/**
 * Incremental pedometer over accelerometer magnitude (gravity included).
 * A step is a peak above a self-adjusting baseline, rate-limited to a human
 * cadence — and nothing counts until three rhythmic candidates confirm an
 * actual walk, so a bump or a picked-up phone stays at zero.
 */
export class StepDetector {
  steps = 0;

  private smooth = 0;
  private baseline = 0;
  private ready = false;
  private above = false;
  private lastCandidateAt = 0;
  private streak = 0;

  /** Feed one accelerometer sample; `t` is milliseconds on any monotonic clock. */
  addSample(t: number, magnitude: number): void {
    if (!Number.isFinite(magnitude)) return;
    if (!this.ready) {
      this.smooth = magnitude;
      this.baseline = magnitude;
      this.ready = true;
      return;
    }
    this.smooth += SMOOTH_ALPHA * (magnitude - this.smooth);
    this.baseline += BASELINE_ALPHA * (this.smooth - this.baseline);
    const deviation = this.smooth - this.baseline;

    if (!this.above && deviation > STEP_THRESHOLD) {
      this.above = true;
      this.candidate(t);
    } else if (this.above && deviation < STEP_THRESHOLD * RESET_FRACTION) {
      this.above = false;
    }
  }

  private candidate(t: number): void {
    const gap = t - this.lastCandidateAt;
    if (this.lastCandidateAt !== 0 && gap < MIN_STEP_MS) return; // too fast — same stride
    if (this.lastCandidateAt === 0 || gap > MAX_GAP_MS) {
      this.streak = 1;            // rhythm broken (or first ever) — start confirming again
    } else {
      this.streak++;
    }
    this.lastCandidateAt = t;
    if (this.streak === CONFIRM_STEPS) this.steps += CONFIRM_STEPS;
    else if (this.streak > CONFIRM_STEPS) this.steps += 1;
  }
}

/* ---------------- distance from GPS ---------------- */

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Reported horizontal accuracy in metres. */
  accuracyM: number;
  /** Milliseconds, any consistent clock. */
  t: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: Pick<GeoPoint, 'lat' | 'lon'>, b: Pick<GeoPoint, 'lat' | 'lon'>): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

const MAX_ACCURACY_M = 50;   // fixes fuzzier than this are ignored outright
const MAX_SPEED_MS = 4.5;    // ~16 km/h — beyond a brisk walk/jog, treat as a GPS jump

/**
 * Accumulates walked distance from GPS fixes, defensively: inaccurate fixes
 * are dropped, impossible jumps resynchronise instead of adding phantom
 * kilometres, and jitter below the accuracy floor waits until real movement
 * accumulates past it.
 */
export class DistanceTracker {
  totalKm = 0;

  private last: GeoPoint | null = null;

  addPoint(p: GeoPoint): void {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
    if (p.accuracyM > MAX_ACCURACY_M) return;
    if (!this.last) {
      this.last = p;
      return;
    }
    const dtS = (p.t - this.last.t) / 1000;
    if (dtS <= 0) return;

    const km = haversineKm(this.last, p);
    const speed = (km * 1000) / dtS;
    if (speed > MAX_SPEED_MS) {
      // Teleport — a tunnel exit or multipath glitch. Resync, add nothing.
      this.last = p;
      return;
    }
    // Standing still wobbles the fix; only bank movement beyond the noise floor.
    const noiseM = Math.min(p.accuracyM, this.last.accuracyM) * 0.5;
    if (km * 1000 < noiseM) return;

    this.totalKm += km;
    this.last = p;
  }
}

/* ---------------- formatting helpers ---------------- */

/** Minutes per km, or null when there is not enough signal to be honest. */
export function walkPaceMinPerKm(distanceKm: number, elapsedMs: number): number | null {
  if (distanceKm < 0.05 || elapsedMs <= 0) return null;
  return round(elapsedMs / 60000 / distanceKm, 1);
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null) return '—';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
}
