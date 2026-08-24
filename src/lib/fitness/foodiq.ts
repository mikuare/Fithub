import type { GoalKind } from '@/types';
import type { FoodItem } from '@/data/foods';
import { clamp, round } from '@/lib/utils';

/* ============================================================
   Food IQ
   What a food does for you, and how well it serves the goal you
   are actually training for — computed from the macros on record
   and the food's tags. No invented micronutrients, no food
   shaming: a food is never "bad", it is a fit or a trade-off,
   with the reasoning shown. General guidance, not dietetics.
   ============================================================ */

export interface MacroSource {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags?: string[];
}

export interface FoodProfile {
  /** Grams of protein per 100 kcal — the density that matters for training. */
  proteinPer100kcal: number | null;
  /** Share of calories from each macro, 0–100, clamped for rounding noise. */
  proteinShare: number;
  carbShare: number;
  fatShare: number;
  leadMacro: 'protein' | 'carbs' | 'fat' | 'balanced';
}

export function foodProfile(food: MacroSource): FoodProfile {
  const kcal = food.calories;
  if (kcal <= 0) {
    return { proteinPer100kcal: null, proteinShare: 0, carbShare: 0, fatShare: 0, leadMacro: 'balanced' };
  }
  const proteinShare = clamp((food.protein_g * 4 * 100) / kcal, 0, 100);
  const carbShare = clamp((food.carbs_g * 4 * 100) / kcal, 0, 100);
  const fatShare = clamp((food.fat_g * 9 * 100) / kcal, 0, 100);
  const top = Math.max(proteinShare, carbShare, fatShare);
  const leadMacro = top < 45 ? 'balanced'
    : top === proteinShare ? 'protein'
    : top === carbShare ? 'carbs'
    : 'fat';
  return {
    proteinPer100kcal: round((food.protein_g / kcal) * 100, 1),
    proteinShare: Math.round(proteinShare),
    carbShare: Math.round(carbShare),
    fatShare: Math.round(fatShare),
    leadMacro,
  };
}

export interface FoodBenefit {
  title: string;
  detail: string;
}

/** Honest, macro-grounded statements about what this food contributes. */
export function foodBenefits(food: MacroSource): FoodBenefit[] {
  const p = foodProfile(food);
  const tags = food.tags ?? [];
  const out: FoodBenefit[] = [];
  const p100 = p.proteinPer100kcal ?? 0;

  if (food.calories > 0 && food.calories < 10) {
    out.push({ title: 'Effectively calorie-free', detail: 'Enjoy it freely — it will not move your energy balance either way.' });
    return out;
  }
  if (p100 >= 10) {
    out.push({
      title: 'Very protein-dense',
      detail: `${food.protein_g} g of protein for ${food.calories} kcal. Protein rebuilds trained muscle and is the most filling macronutrient per calorie.`,
    });
  } else if (p100 >= 5) {
    out.push({
      title: 'Solid protein contribution',
      detail: `${food.protein_g} g of protein per serving helps you reach the daily total that training runs on.`,
    });
  }
  if (tags.includes('vegetable')) {
    out.push({
      title: 'High volume, few calories',
      detail: 'Vegetables fill the plate and the stomach for very little energy — the easiest way to eat more while consuming less.',
    });
  }
  if (tags.includes('fruit') && p.carbShare >= 50) {
    out.push({
      title: 'Quick natural carbohydrate',
      detail: 'Fruit delivers fast fuel with water and, typically, fibre — a strong pick around training sessions.',
    });
  }
  if (p.leadMacro === 'carbs' && !tags.includes('fruit') && !tags.includes('vegetable')) {
    out.push({
      title: 'Mostly carbohydrate',
      detail: 'Carbs are the preferred fuel for hard sets and conditioning — most useful in the meals around your training.',
    });
  }
  if (p.leadMacro === 'fat') {
    out.push({
      title: 'Energy-dense fat source',
      detail: 'Fat carries flavour, supports hormones and keeps meals satisfying — and its density makes portions easy to underestimate.',
    });
  }
  if (tags.includes('fish') && food.fat_g >= 5) {
    out.push({
      title: 'Oily fish',
      detail: 'Oily fish is a well-known source of omega-3 fats alongside its protein.',
    });
  }
  if (tags.includes('supplement')) {
    out.push({
      title: 'Convenient top-up',
      detail: 'Powders and bars are for closing the gap on busy days — whole food first, this second.',
    });
  }
  if (!out.length) {
    out.push({
      title: 'Mixed contribution',
      detail: `Roughly ${p.proteinShare}% protein, ${p.carbShare}% carbs and ${p.fatShare}% fat by calories.`,
    });
  }
  return out;
}

/* ---------------- goal fit ---------------- */

export type GoalFitBand = 'strong' | 'solid' | 'situational';

export interface GoalFit {
  band: GoalFitBand;
  reasons: string[];
  /** Internal ordering value — do not display; the band and reasons are the story. */
  rank: number;
}

const BAND_CUTOFFS: Record<string, { strong: number; solid: number }> = {
  lose_fat: { strong: 55, solid: 20 },
  build_muscle: { strong: 50, solid: 22 },
  gain_strength: { strong: 50, solid: 22 },
  improve_endurance: { strong: 50, solid: 22 },
  default: { strong: 45, solid: 20 },
};

export function goalFit(food: MacroSource, goal: GoalKind): GoalFit {
  const p = foodProfile(food);
  const tags = food.tags ?? [];
  const p100 = p.proteinPer100kcal ?? 0;
  const veg = tags.includes('vegetable');
  const fruit = tags.includes('fruit');
  const reasons: string[] = [];
  let rank = 0;

  if (food.calories > 0 && food.calories < 10) {
    return { band: 'strong', rank: 60, reasons: ['Effectively calorie-free — fits any goal.'] };
  }

  switch (goal) {
    case 'lose_fat':
      rank = p100 * 4 + (veg ? 30 : 0) + (fruit ? 18 : 0);
      if (p100 >= 10) reasons.push('Lots of protein per calorie — keeps muscle and hunger in check while in a deficit.');
      if (veg) reasons.push('High food volume for few calories makes a deficit easier to live with.');
      if (fruit) reasons.push('Satisfying natural sweetness for a modest calorie cost.');
      if (!reasons.length) reasons.push('Fine within your calorie budget — just portion it deliberately, since it brings more energy than protein.');
      break;
    case 'build_muscle':
    case 'gain_strength':
      rank = p100 * 3 + (food.calories >= 100 ? 10 : 0) + p.carbShare * 0.15;
      if (p100 >= 8) reasons.push('Protein-dense — the raw material for the muscle you are training to build.');
      if (p.carbShare >= 55) reasons.push('Carbohydrate to fuel hard sessions and top up glycogen between them.');
      if (food.calories >= 150 && p100 >= 5) reasons.push('Meaningful calories help when the goal is to grow.');
      if (!reasons.length) reasons.push('Adds energy but little protein — pair it with a protein source.');
      break;
    case 'improve_endurance':
      rank = p.carbShare * 0.6 + (fruit ? 15 : 0) + p100 * 1.5;
      if (p.carbShare >= 55) reasons.push('Carb-led — the fuel endurance work actually burns.');
      if (fruit) reasons.push('Quick, easy-to-digest energy around long sessions.');
      if (p100 >= 8) reasons.push('Protein still matters for recovery between sessions.');
      if (!reasons.length) reasons.push('Low in carbohydrate — better placed away from key sessions.');
      break;
    default:
      rank = p100 * 2 + (veg ? 20 : 0) + (fruit ? 10 : 0)
        + (p.proteinShare <= 60 && p.carbShare <= 60 && p.fatShare <= 60 ? 10 : 0);
      if (p100 >= 8) reasons.push('Good protein for its calories.');
      if (veg || fruit) reasons.push('Whole plant food — a staple of any balanced pattern.');
      if (!reasons.length) reasons.push('Fits a balanced week — the pattern over time matters more than any single food.');
  }

  const cutoffs = BAND_CUTOFFS[goal] ?? BAND_CUTOFFS.default;
  const band: GoalFitBand = rank >= cutoffs.strong ? 'strong' : rank >= cutoffs.solid ? 'solid' : 'situational';
  return { band, rank: round(rank, 1), reasons };
}

export const GOAL_FIT_META: Record<GoalFitBand, { label: string; hint: string }> = {
  strong: { label: 'Strong pick', hint: 'Pulls directly toward your goal.' },
  solid: { label: 'Solid', hint: 'Earns its place in a normal day.' },
  situational: { label: 'Situational', hint: 'Fine by choice — just know what it brings.' },
};

export function rankFoodsForGoal<T extends MacroSource>(foods: T[], goal: GoalKind, limit = 5): T[] {
  return [...foods]
    .filter((f) => f.calories >= 10)
    .sort((a, b) => goalFit(b, goal).rank - goalFit(a, goal).rank)
    .slice(0, limit);
}

export const GOAL_LABEL: Record<GoalKind, string> = {
  lose_fat: 'losing body fat',
  build_muscle: 'building muscle',
  gain_strength: 'gaining strength',
  improve_endurance: 'improving endurance',
  general_fitness: 'general fitness',
  mobility: 'mobility',
  maintain: 'maintaining',
};

/* ---------------- goal eating strategy ---------------- */

export interface EatingStrategy {
  headline: string;
  calorieStance: string;
  /** Grams of protein per kg of body weight, low..high. Mainstream sports-nutrition ranges. */
  proteinPerKg: [number, number];
  proteinPerDayG: [number, number] | null;
  /** Roughly 0.4 g/kg per meal is where a single meal stops adding much. */
  perMealProteinG: number | null;
  carbNote: string;
  tips: string[];
}

export function goalEatingStrategy(goal: GoalKind, weightKg: number | null): EatingStrategy {
  const base: Record<string, Omit<EatingStrategy, 'proteinPerDayG' | 'perMealProteinG'>> = {
    lose_fat: {
      headline: 'Protect muscle, stay full, keep the deficit boring',
      calorieStance: 'A moderate calorie deficit — FitHub’s target already builds one in.',
      proteinPerKg: [1.8, 2.4],
      carbNote: 'Keep enough carbohydrate around training to lift well; trim it elsewhere first.',
      tips: [
        'Anchor every meal with a protein source — it is the most filling macro per calorie.',
        'Use vegetables for volume: a bigger plate for the same calories.',
      ],
    },
    build_muscle: {
      headline: 'Fuel the building, not just the training',
      calorieStance: 'A small surplus — your target sits slightly above maintenance.',
      proteinPerKg: [1.6, 2.2],
      carbNote: 'Put carbohydrate in the meals before and after training, where it works hardest.',
      tips: [
        'Spread protein across 3–5 meals rather than one giant dinner.',
        'If the scale is not moving after a few weeks, add ~150–200 kcal of mostly carbs.',
      ],
    },
    gain_strength: {
      headline: 'Eat like the training matters, because it does',
      calorieStance: 'Maintenance to a small surplus — strength is built recovered and fuelled.',
      proteinPerKg: [1.6, 2.2],
      carbNote: 'Carbohydrate before heavy sessions is the cheapest performance enhancer there is.',
      tips: [
        'A pre-training meal 1–3 hours out — carbs plus some protein — pays off in the top sets.',
        'Do not train heavy while aggressively cutting; pick one goal at a time.',
      ],
    },
    improve_endurance: {
      headline: 'Carbohydrate is the fuel, protein is the repair',
      calorieStance: 'Around maintenance — long sessions raise the bill, so eat to the work.',
      proteinPerKg: [1.2, 1.6],
      carbNote: 'Carbs are the priority macro: fuel before, during (when sessions run long) and after.',
      tips: [
        'Refuel within a couple of hours of long sessions — carbs plus protein.',
        'Hydration and electrolytes matter more here than in any other goal.',
      ],
    },
    default: {
      headline: 'Consistent, boring, effective',
      calorieStance: 'Around maintenance — the target adapts if your goal changes.',
      proteinPerKg: [1.2, 1.6],
      carbNote: 'Mostly whole-food carbohydrate, scaled to how active the day actually is.',
      tips: [
        'Protein and plants at most meals covers most of what matters.',
        'The pattern over weeks beats any single day — log honestly and move on.',
      ],
    },
  };

  const s = base[goal] ?? base.default;
  const proteinPerDayG: [number, number] | null = weightKg
    ? [Math.round(s.proteinPerKg[0] * weightKg), Math.round(s.proteinPerKg[1] * weightKg)]
    : null;
  return {
    ...s,
    proteinPerDayG,
    perMealProteinG: weightKg ? Math.round(0.4 * weightKg) : null,
  };
}

/* ---------------- what to eat right now ---------------- */

export interface MacroRemaining {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  overCalories: boolean;
}

export function remainingMacros(
  totals: { calories: number; protein: number; carbs: number; fat: number },
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
): MacroRemaining {
  return {
    calories: Math.max(0, Math.round(targets.calories - totals.calories)),
    protein: Math.max(0, Math.round(targets.protein_g - totals.protein)),
    carbs: Math.max(0, Math.round(targets.carbs_g - totals.carbs)),
    fat: Math.max(0, Math.round(targets.fat_g - totals.fat)),
    overCalories: totals.calories > targets.calories,
  };
}

export interface FoodSuggestion {
  food: FoodItem;
  reason: string;
}

/**
 * Foods that fit what is left of today. When protein is lagging it leads the
 * ranking — that is the macro people actually miss. Returns nothing when the
 * day is essentially done, rather than nudging someone to eat for its own sake.
 */
export function suggestFoods(
  foods: FoodItem[],
  remaining: MacroRemaining,
  goal: GoalKind,
  limit = 3,
): FoodSuggestion[] {
  if (remaining.overCalories || remaining.calories < 80) return [];
  const proteinLagging = remaining.protein >= 15;

  return foods
    .filter((f) => f.calories >= 10 && f.calories <= remaining.calories + 30)
    .filter((f) => !(f.tags ?? []).includes('drink'))
    .map((f) => {
      const fit = goalFit(f, goal);
      const p100 = foodProfile(f).proteinPer100kcal ?? 0;
      const score = fit.rank + (proteinLagging ? p100 * 3 : 0);
      return { f, fit, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ f }) => ({
      food: f,
      reason: proteinLagging && f.protein_g >= 8
        ? `${f.protein_g} g protein toward the ${remaining.protein} g you still need`
        : `${f.calories} kcal fits the ${remaining.calories} kcal you have left`,
    }));
}

/* ---------------- what to go easy on ----------------
   The other half of the picture. A food is still never "bad" — but a goal
   you are actually chasing does make some foods harder to live with, and
   saying so plainly is more useful than pretending everything is equal.
   Crucially, "go easy" is only computed for goals that genuinely call for
   it: someone maintaining is told to restrict nothing, because nothing
   about their goal requires it.
   ---------------------------------------------------- */

/** Grams (or millilitres) in a serving string like '100 g' or '30 g scoop'. Null when it is '1 medium'. */
export function servingGrams(serving: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(g|ml)\b/i.exec(serving);
  return m ? Number(m[1]) : null;
}

/** Calories per 100 g — how easy the food is to eat more of without noticing. Null when the serving has no weight. */
export function energyDensity(food: { calories: number; serving?: string }): number | null {
  const g = food.serving ? servingGrams(food.serving) : null;
  if (!g || g <= 0) return null;
  return round((food.calories / g) * 100, 0);
}

export type FoodStance = 'eat' | 'portion' | 'limit';

export interface StanceVerdict {
  stance: FoodStance;
  /** Why, stated in the terms of the goal actually being trained for. */
  reason: string;
  /** Concrete handling advice. Null when the food needs none. */
  portion: string | null;
  /** Internal ordering value — do not display. */
  rank: number;
}

export const STANCE_META: Record<FoodStance, { label: string; tone: 'success' | 'warn' | 'danger' }> = {
  eat: { label: 'Eat freely', tone: 'success' },
  portion: { label: 'Mind the portion', tone: 'warn' },
  limit: { label: 'Go easy', tone: 'danger' },
};

export interface GoalLimitPolicy {
  /** Does this goal genuinely require holding anything back? */
  applies: boolean;
  /** One-line rule of thumb for the goal. */
  rule: string;
  eatHeading: string;
  limitHeading: string;
  /** Shown in place of a limit list when the goal does not call for one. */
  noLimitNote: string | null;
}

export const GOAL_LIMIT_POLICY: Record<GoalKind, GoalLimitPolicy> = {
  lose_fat: {
    applies: true,
    rule: 'Protein and volume first. What you go easy on is energy density, not any particular food.',
    eatHeading: 'Lead your plate with these',
    limitHeading: 'Go easy on these',
    noLimitNote: null,
  },
  build_muscle: {
    applies: true,
    rule: 'Nothing is off limits — the risk is filling up on food that neither builds nor fuels.',
    eatHeading: 'Build the day around these',
    limitHeading: 'Do not fill up on these first',
    noLimitNote: null,
  },
  gain_strength: {
    applies: true,
    rule: 'Eat to recover. The only real mistake is turning up to heavy sessions under-fuelled.',
    eatHeading: 'Build the day around these',
    limitHeading: 'Do not fill up on these first',
    noLimitNote: null,
  },
  improve_endurance: {
    applies: true,
    rule: 'This is about timing, not banning. Carbs near sessions, everything else away from them.',
    eatHeading: 'Fuel with these',
    limitHeading: 'Keep these away from sessions',
    noLimitNote: null,
  },
  general_fitness: {
    applies: false,
    rule: 'Mostly whole food, protein at most meals, and a pattern you can keep.',
    eatHeading: 'Reliable staples',
    limitHeading: '',
    noLimitNote: 'Your goal does not call for restricting anything. FitHub only shows a “go easy” list when the goal you picked actually needs one — change your goal to fat loss or muscle gain and it appears.',
  },
  maintain: {
    applies: false,
    rule: 'You are holding steady. Consistency is the whole strategy.',
    eatHeading: 'Reliable staples',
    limitHeading: '',
    noLimitNote: 'Maintaining needs no restriction list. Eat the way you already eat and watch the trend, not the day.',
  },
  mobility: {
    applies: false,
    rule: 'Mobility work is not driven by diet. Eat enough, eat well, and get on with the sessions.',
    eatHeading: 'Reliable staples',
    limitHeading: '',
    noLimitNote: 'Nothing about mobility training calls for holding foods back, so FitHub does not invent a list.',
  },
};

interface Signal { weight: number; reason: string; portion?: string }

function verdictFrom(signals: Signal[], relief: number, fallback: string): StanceVerdict {
  const rank = Math.max(0, signals.reduce((a, s) => a + s.weight, 0) + relief);
  const stance: FoodStance = rank >= 35 ? 'limit' : rank >= 16 ? 'portion' : 'eat';
  const lead = [...signals].sort((a, b) => b.weight - a.weight)[0];
  return {
    stance,
    rank: round(rank, 1),
    reason: stance === 'eat' || !lead ? fallback : lead.reason,
    portion: stance === 'eat' ? null : lead?.portion ?? null,
  };
}

/**
 * Where a food sits for the goal being trained for: eat freely, mind the
 * portion, or go easy — with the number that drove the call. Goals that do
 * not call for restriction never return anything but 'eat'.
 */
export function foodStance(food: MacroSource & { serving?: string }, goal: GoalKind): StanceVerdict {
  const p = foodProfile(food);
  const tags = food.tags ?? [];
  const p100 = p.proteinPer100kcal ?? 0;
  const kcal = food.calories;
  const ed = energyDensity(food);
  const veg = tags.includes('vegetable');
  const fruit = tags.includes('fruit');
  const proteinRescue = p100 >= 9 && food.protein_g >= 8;

  if (kcal > 0 && kcal < 10) {
    return { stance: 'eat', rank: 0, reason: 'Effectively calorie-free — it changes nothing either way.', portion: null };
  }
  if (!GOAL_LIMIT_POLICY[goal].applies) {
    return { stance: 'eat', rank: 0, reason: 'Your goal does not call for holding this back.', portion: null };
  }

  const s: Signal[] = [];
  let relief = 0;

  switch (goal) {
    case 'lose_fat': {
      s.push({
        weight: clamp((kcal - 110) / 6, 0, 28),
        reason: `${kcal} kcal a serving is a real slice of a deficit.`,
        portion: `Measure it — one serving is ${food.serving ?? 'a portion'}, and a second one doubles the cost.`,
      });
      if (ed !== null && ed >= 350 && kcal >= 100) {
        s.push({
          weight: clamp((ed - 350) / 12, 0, 18),
          reason: `${ed} kcal per 100 g — a small extra handful costs more than it looks like it should.`,
          portion: 'Weigh it once so you know what the portion actually looks like.',
        });
      }
      s.push({
        weight: clamp((6 - p100) * 5, 0, 30),
        reason: `Only ${round(p100, 1)} g of protein per 100 kcal — it brings energy without the fullness protein buys.`,
        portion: 'Pair it with a protein source so the meal still holds you.',
      });
      if (p.fatShare >= 55 && p100 < 8) {
        s.push({ weight: 10, reason: `${p.fatShare}% of its calories are fat — the densest macro, and the easiest to under-count.`, portion: 'Serve it with a spoon, not a pour.' });
      }
      if (tags.includes('drink') && kcal >= 50) {
        s.push({ weight: 12, reason: 'Liquid calories barely register as food — you will be as hungry afterwards.', portion: 'Drink it alongside a meal rather than instead of one.' });
      }
      if (tags.includes('snack')) {
        s.push({ weight: 8, reason: 'Snack food is eaten past the point of noticing.', portion: 'Portion it onto a plate instead of eating from the packet.' });
      }
      if (veg) relief -= 35;
      if (fruit) relief -= 15;
      if (proteinRescue) relief -= 12;
      return verdictFrom(s, relief, 'Protein-dense and filling — this is what a deficit should be built on.');
    }

    case 'build_muscle':
    case 'gain_strength': {
      s.push({
        weight: clamp((90 - kcal) / 3, 0, 25),
        reason: `${kcal} kcal a serving does very little toward the surplus you are trying to hold.`,
        portion: 'Fine to eat — just not as the thing that fills you before the protein and carbs do.',
      });
      s.push({
        weight: clamp((5 - p100) * 4, 0, 20),
        reason: `${round(p100, 1)} g of protein per 100 kcal — it feeds the day but supplies little to build with.`,
        portion: 'Put a protein source on the plate first, then add this.',
      });
      if (p.fatShare >= 60 && p100 < 4) {
        s.push({ weight: 12, reason: `${p.fatShare}% fat with almost no protein — useful calories, but nothing to build from.`, portion: 'Use it to top up calories, not to replace a protein serving.' });
      }
      if (veg) {
        s.push({ weight: 10, reason: 'High volume for the calories — the exact thing that fills a bulker up too early.', portion: 'Eat it after your protein and carbs, not before them.' });
      }
      if (tags.includes('drink') && p100 < 3) {
        s.push({ weight: 8, reason: 'Fills the stomach without contributing to the session or the recovery.', portion: 'Keep it away from the half hour before a meal.' });
      }
      if (proteinRescue) relief -= 20;
      if (p.carbShare >= 55 && kcal >= 80) relief -= 12;
      return verdictFrom(s, relief, 'Protein or fuel in a form your training can actually use — eat this without thinking about it.');
    }

    case 'improve_endurance': {
      s.push({
        weight: clamp((45 - p.carbShare) * 0.5, 0, 25),
        reason: `Only ${p.carbShare}% of its calories are carbohydrate — not the fuel a long session burns.`,
        portion: 'Move it to a meal well away from your key sessions.',
      });
      if (p.fatShare >= 50) {
        s.push({ weight: 15, reason: `${p.fatShare}% fat digests slowly — uncomfortable sitting in you when the session starts.`, portion: 'Leave 3+ hours between this and a hard session.' });
      }
      if (kcal >= 150 && p.carbShare < 30) {
        s.push({ weight: 8, reason: 'A heavy serving that does not refill glycogen.', portion: 'Keep it for rest days and easy days.' });
      }
      if (veg) relief -= 10;
      if (p.carbShare >= 60) relief -= 15;
      // Endurance restricts nothing outright — protein still repairs what the
      // sessions break down, so a protein source can only ever be a timing note.
      relief -= clamp(food.protein_g * 0.8, 0, 16);
      return verdictFrom(s, relief, 'Carb-led and easy to digest — this is what fuels the work.');
    }

    default:
      return { stance: 'eat', rank: 0, reason: 'Your goal does not call for holding this back.', portion: null };
  }
}

export interface PlateEntry {
  food: FoodItem;
  verdict: StanceVerdict;
  fit: GoalFit;
}

export interface GoalPlate {
  policy: GoalLimitPolicy;
  /** Foods that pull toward the goal, best first. */
  eat: PlateEntry[];
  /** Foods to go easy on. Always empty when the goal does not call for restriction. */
  easy: PlateEntry[];
}

/**
 * The two-sided answer: what to lean on, and what to go easy on — but only
 * where the goal earns a "go easy" list. Goals like maintaining or mobility
 * get staples and an explicit note that nothing needs restricting, rather
 * than a manufactured list of forbidden foods.
 */
export function goalPlate(foods: FoodItem[], goal: GoalKind, limit = 4): GoalPlate {
  const policy = GOAL_LIMIT_POLICY[goal];
  const scored = foods
    .filter((f) => f.calories >= 10)
    .map((food) => ({ food, verdict: foodStance(food, goal), fit: goalFit(food, goal) }));

  const eat = scored
    .filter((e) => e.verdict.stance === 'eat')
    .sort((a, b) => b.fit.rank - a.fit.rank)
    .slice(0, limit);

  // Building muscle scores whole plant food as "volume that fills you early",
  // which is true but makes a list headed by broccoli read as "avoid vegetables".
  // The nuance survives on the food itself; the list stays off that hook.
  const crowdingGoal = goal === 'build_muscle' || goal === 'gain_strength';
  const easy = policy.applies
    ? scored
      .filter((e) => e.verdict.stance !== 'eat')
      .filter((e) => !(crowdingGoal && (e.food.tags.includes('vegetable') || e.food.tags.includes('fruit'))))
      .sort((a, b) => b.verdict.rank - a.verdict.rank)
      .slice(0, limit)
    : [];

  return { policy, eat, easy };
}
