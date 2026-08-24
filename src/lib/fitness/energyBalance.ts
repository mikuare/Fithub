import type { BodyMeasurement, FitnessProfile, GoalKind } from '@/types';
import { addDays, diffDays, today } from '@/lib/date';
import { clamp, round } from '@/lib/utils';

/* ============================================================
   Energy balance
   The half of nutrition that closes the loop: not "what should I
   eat" but "is what I am eating actually working, and by how much
   am I off". Everything here is read from logged bodyweight, so it
   stays silent until there is enough of it to mean something.
   General guidance, not dietetics.
   ============================================================ */

/** Energy in a kilogram of body mass. The textbook figure; real life is messier. */
const KCAL_PER_KG = 7700;

export interface WeightPoint { date: string; kg: number }

/** Logged bodyweight, oldest first. */
export function weightSeries(measurements: BodyMeasurement[], sinceDays = 56): WeightPoint[] {
  const cutoff = addDays(today(), -sinceDays);
  return measurements
    .filter((m): m is BodyMeasurement & { weight_kg: number } => typeof m.weight_kg === 'number' && m.weight_kg > 0)
    .filter((m) => m.date >= cutoff)
    .map((m) => ({ date: m.date, kg: m.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The weight to plan from: what was last logged, falling back to the profile.
 * The profile figure is captured once at onboarding and goes stale the moment
 * the plan starts working, which is exactly when it matters most.
 */
export function currentWeightKg(
  measurements: BodyMeasurement[],
  profile: Pick<FitnessProfile, 'weight_kg'> | null,
): number | null {
  const series = weightSeries(measurements, 3650);
  return series.length ? series[series.length - 1].kg : profile?.weight_kg ?? null;
}

export interface WeightTrend {
  /** Kilograms per week. Negative is losing. */
  kgPerWeek: number;
  /** As a share of bodyweight per week — the figure the guidance bands are set in. */
  pctPerWeek: number;
  /** Weigh-ins the line was fitted through. */
  points: number;
  /** Days between the first and last weigh-in. */
  spanDays: number;
  latestKg: number;
}

/**
 * Least-squares slope through logged weight. A straight line beats first-vs-last
 * because daily bodyweight swings a kilo on water alone, and one bad morning
 * should not rewrite the plan.
 */
export function weightTrend(measurements: BodyMeasurement[], windowDays = 28): WeightTrend | null {
  const series = weightSeries(measurements, windowDays);
  if (series.length < 3) return null;

  const spanDays = diffDays(series[series.length - 1].date, series[0].date);
  if (spanDays < 14) return null;

  const x = series.map((p) => diffDays(p.date, series[0].date));
  const y = series.map((p) => p.kg);
  const n = series.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const denom = x.reduce((a, v) => a + (v - mx) ** 2, 0);
  if (denom === 0) return null;
  const slope = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / denom;

  const latestKg = series[series.length - 1].kg;
  const kgPerWeek = slope * 7;
  return {
    kgPerWeek: round(kgPerWeek, 2),
    pctPerWeek: round((kgPerWeek / latestKg) * 100, 2),
    points: n,
    spanDays,
    latestKg,
  };
}

export interface RateBand {
  /** Share of bodyweight per week the goal calls for. Negative is loss. */
  low: number;
  high: number;
  label: string;
  /** Null when the goal implies no particular direction for the scale. */
  directional: boolean;
}

/**
 * What the scale should be doing for each goal, as a share of bodyweight per
 * week. Fat loss much faster than ~1%/wk costs muscle; muscle gain much faster
 * than ~0.5%/wk is mostly fat. Goals that are not about bodyweight say so.
 */
export function targetRateBand(goal: GoalKind): RateBand {
  switch (goal) {
    case 'lose_fat':
      return { low: -1.0, high: -0.4, label: '0.4–1.0% of bodyweight down per week', directional: true };
    case 'build_muscle':
      return { low: 0.15, high: 0.5, label: '0.15–0.5% of bodyweight up per week', directional: true };
    case 'gain_strength':
      return { low: 0, high: 0.35, label: 'steady to slightly up', directional: true };
    case 'maintain':
      return { low: -0.25, high: 0.25, label: 'flat, within normal fluctuation', directional: true };
    default:
      return { low: -0.25, high: 0.25, label: 'not driven by the scale', directional: false };
  }
}

export type BalanceStatus =
  | 'not_enough_data'
  | 'not_weight_driven'
  | 'on_track'
  | 'too_slow'
  | 'too_fast'
  | 'wrong_way';

export interface EnergyVerdict {
  status: BalanceStatus;
  trend: WeightTrend | null;
  band: RateBand;
  headline: string;
  detail: string;
  /** Daily calorie change that would bring the trend into the band. Null when no change is called for. */
  deltaKcal: number | null;
  /** The target that change implies. Null when no change is called for. */
  suggestedCalories: number | null;
  /** What to do when calories are not the lever. */
  action: string | null;
}

/**
 * Compares what the scale is actually doing against what the goal needs, and
 * turns the gap into a calorie number. Stays quiet until there are at least
 * three weigh-ins over two weeks, because anything less is noise wearing a
 * trend's clothes.
 */
export function energyVerdict(
  measurements: BodyMeasurement[],
  goal: GoalKind,
  currentCalories: number,
  windowDays = 28,
): EnergyVerdict {
  const band = targetRateBand(goal);
  const trend = weightTrend(measurements, windowDays);

  if (!band.directional) {
    return {
      status: 'not_weight_driven', trend, band,
      headline: 'The scale is not the scoreboard here',
      detail: 'Your goal is not measured in bodyweight, so FitHub will not push your calories around based on it. Judge this one on the sessions.',
      deltaKcal: null, suggestedCalories: null, action: null,
    };
  }

  if (!trend) {
    const logged = weightSeries(measurements, windowDays).length;
    return {
      status: 'not_enough_data', trend: null, band,
      headline: 'Not enough weigh-ins to call it yet',
      detail: logged === 0
        ? 'Log your weight a few times and FitHub can tell you whether your calories are actually doing what you want.'
        : `${logged} weigh-in${logged === 1 ? '' : 's'} logged. Three or more, spread over at least two weeks, and this becomes a real read rather than a guess.`,
      deltaKcal: null, suggestedCalories: null,
      action: 'Log your weight on the Progress page — same time of day, a couple of times a week.',
    };
  }

  const rate = trend.pctPerWeek;
  const mid = (band.low + band.high) / 2;
  const evidence = `Over ${trend.spanDays} days and ${trend.points} weigh-ins you are ${trend.kgPerWeek === 0 ? 'flat' : `${trend.kgPerWeek > 0 ? 'up' : 'down'} ${Math.abs(trend.kgPerWeek)} kg per week`} (${Math.abs(rate)}% of bodyweight).`;

  if (rate >= band.low && rate <= band.high) {
    return {
      status: 'on_track', trend, band,
      headline: 'It is working — change nothing',
      detail: `${evidence} That is inside the ${band.label} this goal calls for. The plan is doing its job; let it keep running.`,
      deltaKcal: null, suggestedCalories: null, action: null,
    };
  }

  // How far off the middle of the band we are, converted back into daily calories.
  const gapKgPerWeek = ((mid - rate) / 100) * trend.latestKg;
  // Damped: the arithmetic overshoots because intake, output and water all move together.
  const raw = (gapKgPerWeek * KCAL_PER_KG) / 7 * 0.5;
  const deltaKcal = Math.round(clamp(raw, -300, 300) / 25) * 25;
  const suggested = Math.max(1200, currentCalories + deltaKcal);

  const losing = band.high < 0;
  const wrongWay = losing ? rate > 0 : rate < 0;

  if (wrongWay) {
    return {
      status: 'wrong_way', trend, band,
      headline: losing ? 'Moving the wrong way' : 'Losing weight while trying to build',
      detail: `${evidence} That is the opposite of what ${losing ? 'fat loss' : 'this goal'} needs. Before changing anything, check the logging is honest — untracked oils, drinks and weekends are the usual explanation, not metabolism.`,
      deltaKcal: deltaKcal || null,
      suggestedCalories: deltaKcal ? suggested : null,
      action: 'Log everything for one full week — including weekends — then let this read again.',
    };
  }

  const tooFast = losing ? rate < band.low : rate > band.high;
  if (tooFast) {
    return {
      status: 'too_fast', trend, band,
      headline: losing ? 'Faster than it should be' : 'Gaining faster than you can build',
      detail: losing
        ? `${evidence} Quicker than ${Math.abs(band.low)}% a week starts costing muscle and makes the diet harder to finish. Easing off is not a setback.`
        : `${evidence} Above ${band.high}% a week, most of the extra is fat rather than muscle. Slowing the gain keeps it lean.`,
      deltaKcal, suggestedCalories: suggested,
      action: null,
    };
  }

  return {
    status: 'too_slow', trend, band,
    headline: losing ? 'Stalled — the deficit has closed' : 'Not enough to build on',
    detail: losing
      ? `${evidence} A deficit set for a heavier you becomes maintenance as you lose. This is the normal reason progress flattens, and it is a number problem, not a willpower one.`
      : `${evidence} You are eating close to maintenance, so there is little spare energy to build with.`,
    deltaKcal, suggestedCalories: suggested,
    action: null,
  };
}

export const BALANCE_META: Record<BalanceStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'muted' }> = {
  not_enough_data: { label: 'No read yet', tone: 'muted' },
  not_weight_driven: { label: 'Not applicable', tone: 'muted' },
  on_track: { label: 'On track', tone: 'success' },
  too_slow: { label: 'Too slow', tone: 'warn' },
  too_fast: { label: 'Too fast', tone: 'warn' },
  wrong_way: { label: 'Off course', tone: 'danger' },
};
