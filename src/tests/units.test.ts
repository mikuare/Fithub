import { describe, expect, it } from 'vitest';
import {
  kgToLb, lbToKg, displayWeight, inputWeightToKg, fmtWeight, fmtLength, fmtDistance,
  roundToPlate, platesPerSide, weightStep, displayLength, inputLengthToCm,
} from '@/lib/fitness/units';

describe('conversions round-trip', () => {
  it('kg <-> lb', () => {
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 6);
  });
  it('display and input are inverses', () => {
    expect(inputWeightToKg(displayWeight(80, 'imperial', 4)!, 'imperial')).toBeCloseTo(80, 2);
    expect(inputLengthToCm(displayLength(180, 'imperial', 4)!, 'imperial')).toBeCloseTo(180, 2);
  });
});

describe('formatting', () => {
  it('renders an em dash for missing values rather than NaN', () => {
    expect(fmtWeight(null, 'metric')).toBe('—');
    expect(fmtLength(undefined, 'metric')).toBe('—');
    expect(fmtDistance(null, 'imperial')).toBe('—');
  });
  it('uses the right unit suffix', () => {
    expect(fmtWeight(60, 'metric')).toBe('60 kg');
    expect(fmtWeight(lbToKg(132), 'imperial')).toBe('132 lb');
    expect(fmtDistance(5, 'metric')).toBe('5 km');
  });
});

describe('plate maths', () => {
  it('rounds to a loadable increment', () => {
    expect(roundToPlate(63.7, 'metric')).toBe(63.75);
    expect(weightStep('metric')).toBe(2.5);
    expect(weightStep('imperial')).toBe(5);
  });

  it('breaks a barbell load into plates per side, heaviest first', () => {
    // 100 kg on a 20 kg bar is 40 kg per side: 25 + 15.
    expect(platesPerSide(100, 20, 'metric')).toEqual([25, 15]);
    expect(platesPerSide(60, 20, 'metric')).toEqual([20]);
    expect(platesPerSide(62.5, 20, 'metric')).toEqual([20, 1.25]);
    expect(platesPerSide(140, 20, 'metric')).toEqual([25, 25, 10]);
  });

  it('returns nothing when the bar alone is heavier than the target', () => {
    expect(platesPerSide(20, 20, 'metric')).toEqual([]);
    expect(platesPerSide(15, 20, 'metric')).toEqual([]);
  });

  it('returns nothing when the load cannot be made exactly', () => {
    expect(platesPerSide(21, 20, 'metric')).toEqual([]);
  });
});
