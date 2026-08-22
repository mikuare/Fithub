import type { Units } from '@/types';
import { round } from '@/lib/utils';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const KM_PER_MI = 1.609344;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;
export const kmToMi = (km: number) => km / KM_PER_MI;
export const miToKm = (mi: number) => mi * KM_PER_MI;

export const weightUnit = (u: Units) => (u === 'metric' ? 'kg' : 'lb');
export const lengthUnit = (u: Units) => (u === 'metric' ? 'cm' : 'in');
export const distanceUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi');

/** Canonical kg -> display value in the user's unit. */
export function displayWeight(kg: number | null | undefined, u: Units, dp = 1): number | null {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return null;
  return round(u === 'metric' ? kg : kgToLb(kg), dp);
}

/** Display value in the user's unit -> canonical kg. */
export function inputWeightToKg(value: number, u: Units): number {
  return u === 'metric' ? value : lbToKg(value);
}

export function displayLength(cm: number | null | undefined, u: Units, dp = 1): number | null {
  if (cm === null || cm === undefined || !Number.isFinite(cm)) return null;
  return round(u === 'metric' ? cm : cmToIn(cm), dp);
}

export function inputLengthToCm(value: number, u: Units): number {
  return u === 'metric' ? value : inToCm(value);
}

export function displayDistance(km: number | null | undefined, u: Units, dp = 2): number | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  return round(u === 'metric' ? km : kmToMi(km), dp);
}

export function inputDistanceToKm(value: number, u: Units): number {
  return u === 'metric' ? value : miToKm(value);
}

/** "62.5 kg" / "137.8 lb" — the single place weights get stringified. */
export function fmtWeight(kg: number | null | undefined, u: Units, dp = 1): string {
  const v = displayWeight(kg, u, dp);
  if (v === null) return '—';
  const clean = Number.isInteger(v) ? String(v) : String(round(v, dp));
  return `${clean} ${weightUnit(u)}`;
}

export function fmtLength(cm: number | null | undefined, u: Units, dp = 1): string {
  const v = displayLength(cm, u, dp);
  return v === null ? '—' : `${v} ${lengthUnit(u)}`;
}

export function fmtDistance(km: number | null | undefined, u: Units, dp = 2): string {
  const v = displayDistance(km, u, dp);
  return v === null ? '—' : `${v} ${distanceUnit(u)}`;
}

/** Smallest sensible increment for the loaded weight in the given unit. */
export function weightStep(u: Units): number {
  return u === 'metric' ? 2.5 : 5;
}

/** Round a target load to something you can actually load on a bar. */
export function roundToPlate(kg: number, u: Units): number {
  const stepKg = u === 'metric' ? 1.25 : lbToKg(2.5);
  return round(Math.round(kg / stepKg) * stepKg, 2);
}

/** Plate breakdown per side for a barbell. Returns [] when it cannot be loaded exactly. */
export function platesPerSide(totalKg: number, barKg: number, u: Units): number[] {
  const plates = u === 'metric'
    ? [25, 20, 15, 10, 5, 2.5, 1.25]
    : [45, 35, 25, 10, 5, 2.5].map(lbToKg);
  let side = (totalKg - barKg) / 2;
  if (side <= 0.01) return [];
  const out: number[] = [];
  for (const p of plates) {
    while (side >= p - 0.001 && out.length < 20) {
      out.push(u === 'metric' ? p : round(kgToLb(p), 1));
      side -= p;
    }
  }
  return side > 0.05 ? [] : out;
}
