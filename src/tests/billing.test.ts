import { describe, expect, it } from 'vitest';
import {
  FREE_GOAL_LIMIT, PLANS, TIER_RANK, formatPrice, goalLimit, hasFeature, minTierFor,
  periodEndFrom, priceFor, yearlySavingsPct,
} from '@/lib/billing/plans';
import {
  cvcValid, detectBrand, expiryValid, formatCardNumber, last4, luhnValid,
  maskMobile, phMobileValid,
} from '@/lib/billing/card';

describe('plans & entitlements', () => {
  it('ranks tiers free < plus < pro', () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.plus);
    expect(TIER_RANK.plus).toBeLessThan(TIER_RANK.pro);
  });

  it('plus unlocks the body map, pro additionally unlocks fitcoach', () => {
    expect(hasFeature('free', 'body_map')).toBe(false);
    expect(hasFeature('plus', 'body_map')).toBe(true);
    expect(hasFeature('plus', 'fitcoach')).toBe(false);
    expect(hasFeature('pro', 'fitcoach')).toBe(true);
    expect(hasFeature('pro', 'body_map')).toBe(true);
    expect(minTierFor('fitcoach')).toBe('pro');
  });

  it('limits active goals on free and removes the limit on paid tiers', () => {
    expect(goalLimit('free')).toBe(FREE_GOAL_LIMIT);
    expect(goalLimit('plus')).toBeNull();
    expect(goalLimit('pro')).toBeNull();
  });

  it('free costs nothing in every currency and cycle', () => {
    expect(priceFor('free', 'monthly', 'USD')).toBe(0);
    expect(priceFor('free', 'yearly', 'PHP')).toBe(0);
  });

  it('yearly is genuinely cheaper than twelve months of monthly', () => {
    for (const tier of ['plus', 'pro'] as const) {
      for (const currency of ['USD', 'PHP'] as const) {
        expect(priceFor(tier, 'yearly', currency)).toBeLessThan(priceFor(tier, 'monthly', currency) * 12);
        const pct = yearlySavingsPct(tier, currency);
        expect(pct).toBeGreaterThan(0);
        expect(pct).toBeLessThan(100);
      }
    }
  });

  it('pro costs more than plus everywhere', () => {
    for (const cycle of ['monthly', 'yearly'] as const) {
      for (const currency of ['USD', 'PHP'] as const) {
        expect(priceFor('pro', cycle, currency)).toBeGreaterThan(priceFor('plus', cycle, currency));
      }
    }
  });

  it('formats prices with the right symbol and precision', () => {
    expect(formatPrice(4.99, 'USD')).toBe('$4.99');
    expect(formatPrice(1190, 'PHP')).toBe('₱1,190');
    expect(formatPrice(0, 'USD')).toBe('$0');
  });

  it('rolls billing periods by calendar months', () => {
    expect(periodEndFrom('2026-01-15', 'monthly')).toBe('2026-02-15');
    expect(periodEndFrom('2026-01-15', 'yearly')).toBe('2027-01-15');
  });

  it('every marketed plan has copy and bullets', () => {
    expect(PLANS.map((p) => p.tier)).toEqual(['free', 'plus', 'pro']);
    for (const plan of PLANS) {
      expect(plan.bullets.length).toBeGreaterThan(2);
      expect(plan.tagline.length).toBeGreaterThan(0);
    }
  });
});

describe('card validation', () => {
  it('accepts the classic test numbers and rejects a typo', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
    expect(luhnValid('5555 5555 5555 4444')).toBe(true);
    expect(luhnValid('4242 4242 4242 4241')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
  });

  it('detects brands from the leading digits', () => {
    expect(detectBrand('4242424242424242')).toBe('visa');
    expect(detectBrand('5555555555554444')).toBe('mastercard');
    expect(detectBrand('2223003122003222')).toBe('mastercard');
    expect(detectBrand('378282246310005')).toBe('amex');
    expect(detectBrand('3530111333300000')).toBe('jcb');
    expect(detectBrand('6011111111111117')).toBe('unknown');
  });

  it('groups digits for display, amex included', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
  });

  it('validates expiry as MM/YY in the future', () => {
    const now = new Date('2026-08-23T12:00:00');
    expect(expiryValid('08/26', now)).toBe(true);  // expires end of month
    expect(expiryValid('07/26', now)).toBe(false);
    expect(expiryValid('01/30', now)).toBe(true);
    expect(expiryValid('13/30', now)).toBe(false);
    expect(expiryValid('0130', now)).toBe(false);
  });

  it('cvc length depends on brand', () => {
    expect(cvcValid('123', 'visa')).toBe(true);
    expect(cvcValid('1234', 'visa')).toBe(false);
    expect(cvcValid('1234', 'amex')).toBe(true);
    expect(cvcValid('123', 'amex')).toBe(false);
  });

  it('keeps only the last four digits', () => {
    expect(last4('4242 4242 4242 4242')).toBe('4242');
  });

  it('validates and masks Philippine wallet numbers', () => {
    expect(phMobileValid('09171234567')).toBe(true);
    expect(phMobileValid('+63 917 123 4567')).toBe(true);
    expect(phMobileValid('0817 123 4567')).toBe(false);
    expect(phMobileValid('0917123456')).toBe(false);
    expect(maskMobile('09171234567')).toBe('09•• ••• 4567');
    expect(maskMobile('+639171234567')).toBe('09•• ••• 4567');
  });
});
