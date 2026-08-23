import type { BillingCurrency, BillingCycle, ISODate, SubscriptionTier } from '@/types';
import { addMonths } from '@/lib/date';

/* ============================================================
   Plans & entitlements
   One source of truth for what each tier costs, what it unlocks
   and how billing periods roll. Pure and tested — the pricing
   page, the paywall gates and the checkout all read from here.
   ============================================================ */

export const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, plus: 1, pro: 2 };

/** Features the app actually gates. Everything else is free forever —
 *  including data export and account deletion, which are never paywalled. */
export type PlanFeature =
  | 'body_map'
  | 'weekly_review'
  | 'monthly_report'
  | 'unlimited_goals'
  | 'exercise_guides'
  | 'fitcoach';

const FEATURE_MIN_TIER: Record<PlanFeature, SubscriptionTier> = {
  body_map: 'plus',
  weekly_review: 'plus',
  monthly_report: 'plus',
  unlimited_goals: 'plus',
  exercise_guides: 'plus',
  fitcoach: 'pro',
};

export function hasFeature(tier: SubscriptionTier, feature: PlanFeature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function minTierFor(feature: PlanFeature): SubscriptionTier {
  return FEATURE_MIN_TIER[feature];
}

/** Active goals allowed on the Free tier; null means unlimited. */
export const FREE_GOAL_LIMIT = 3;

export function goalLimit(tier: SubscriptionTier): number | null {
  return hasFeature(tier, 'unlimited_goals') ? null : FREE_GOAL_LIMIT;
}

/* ---------------- pricing ---------------- */

/** Regional price points, not conversions — PHP is priced for the market
 *  GCash and Maya serve, the way real subscriptions are. */
const PRICES: Record<BillingCurrency, Record<Exclude<SubscriptionTier, 'free'>, Record<BillingCycle, number>>> = {
  USD: {
    plus: { monthly: 4.99, yearly: 39.99 },
    pro: { monthly: 9.99, yearly: 79.99 },
  },
  PHP: {
    plus: { monthly: 149, yearly: 1190 },
    pro: { monthly: 299, yearly: 2390 },
  },
};

export function priceFor(tier: SubscriptionTier, cycle: BillingCycle, currency: BillingCurrency): number {
  if (tier === 'free') return 0;
  return PRICES[currency][tier][cycle];
}

/** Whole-percent saving of yearly against twelve months of monthly. */
export function yearlySavingsPct(tier: Exclude<SubscriptionTier, 'free'>, currency: BillingCurrency): number {
  const monthly = priceFor(tier, 'monthly', currency) * 12;
  const yearly = priceFor(tier, 'yearly', currency);
  return Math.round((1 - yearly / monthly) * 100);
}

const CURRENCY_SYMBOL: Record<BillingCurrency, string> = { USD: '$', PHP: '₱' };

export function formatPrice(amount: number, currency: BillingCurrency): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const rendered = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${rendered}`;
}

export function periodEndFrom(start: ISODate, cycle: BillingCycle): ISODate {
  return addMonths(start, cycle === 'monthly' ? 1 : 12);
}

/* ---------------- marketing copy ---------------- */

export interface PlanDef {
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  highlight: boolean;
  bullets: string[];
}

export const PLANS: PlanDef[] = [
  {
    tier: 'free',
    name: 'Free',
    tagline: 'The full training core, free forever.',
    highlight: false,
    bullets: [
      'Generated programme from your goal & equipment',
      'Live workout mode with rest timers',
      'Progress charts, personal records & streaks',
      `Up to ${FREE_GOAL_LIMIT} active goals`,
      'Recovery check-ins, habits & nutrition log',
      'Exercise library, achievements & challenges',
      'Full data export — your data is always yours',
    ],
  },
  {
    tier: 'plus',
    name: 'Plus',
    tagline: 'Understand your body, not just your workouts.',
    highlight: true,
    bullets: [
      'Everything in Free',
      'Body Map — muscle freshness heat map',
      'Niggle journal with exercise cautions',
      'Weekly review with wins & opportunities',
      'Month-over-month training report',
      'Visual form guides with exercise video references',
      'Unlimited active goals',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    tagline: 'A coach in your corner, every day.',
    highlight: false,
    bullets: [
      'Everything in Plus',
      'FitCoach — answers grounded in your own data',
      'Early access to new features',
      'Priority support',
    ],
  },
];

export const TIER_LABEL: Record<SubscriptionTier, string> = { free: 'Free', plus: 'Plus', pro: 'Pro' };

/** Payment rails shown at checkout. Sandbox until a provider is connected. */
export const PAYMENT_METHODS: Array<{
  kind: 'card' | 'gcash' | 'maya' | 'grabpay';
  label: string;
  detail: string;
}> = [
  { kind: 'card', label: 'Credit / debit card', detail: 'Visa, Mastercard, Amex, JCB — billed in USD or PHP' },
  { kind: 'gcash', label: 'GCash', detail: 'Philippines — pay from your GCash wallet' },
  { kind: 'maya', label: 'Maya', detail: 'Philippines — pay from your Maya wallet' },
  { kind: 'grabpay', label: 'GrabPay', detail: 'Southeast Asia — pay from your GrabPay balance' },
];
