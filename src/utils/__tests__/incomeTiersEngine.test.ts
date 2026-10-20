import { describe, expect, it } from 'vitest';
import {
  LIFE_TIERS,
  calculateBonusShift50_50,
  calculateNetLiquidFromGross,
  calculateTierProgress,
  getLifeTier,
} from '../incomeTiersEngine';

describe('incomeTiersEngine', () => {
  it('selects the correct life tier at the boundaries', () => {
    expect(getLifeTier(0).key).toBe('decolagem');
    expect(getLifeTier(18_000).key).toBe('decolagem');
    expect(getLifeTier(18_001).key).toBe('tracao');
    expect(getLifeTier(35_001).key).toBe('voo_alto');
    expect(getLifeTier(60_001).key).toBe('orbita');
  });

  it('calculates progress inside a tier', () => {
    const progress = calculateTierProgress(25_000, LIFE_TIERS.tracao);
    expect(progress.percentage).toBe(41);
    expect(progress.amountToNext).toBeCloseTo(10_000.01, 2);
    expect(progress.nextTierName).toBe('Fase Voo Alto');
    expect(progress.isMaxTier).toBe(false);
  });

  it('marks the top tier as complete', () => {
    const progress = calculateTierProgress(80_000, LIFE_TIERS.orbita);
    expect(progress.percentage).toBe(100);
    expect(progress.amountToNext).toBe(0);
    expect(progress.isMaxTier).toBe(true);
  });

  it('calculates PJ net liquid after tax and accounting', () => {
    const result = calculateNetLiquidFromGross(10_000, 6, 350);
    expect(result.taxAmount).toBe(600);
    expect(result.netLiquid).toBe(9_050);
    expect(result.effectiveRate).toBe(9.5);
  });

  it('splits a bonus 50/50 above the baseline', () => {
    const bonus = calculateBonusShift50_50(12_000, 10_000);
    expect(bonus.excessAmount).toBe(2_000);
    expect(bonus.toInvestments).toBe(1_000);
    expect(bonus.toLeisure).toBe(1_000);
    expect(bonus.hasBonus).toBe(true);
  });

  it('ignores very small surpluses', () => {
    const bonus = calculateBonusShift50_50(10_030, 10_000);
    expect(bonus.excessAmount).toBe(30);
    expect(bonus.hasBonus).toBe(false);
  });
});
