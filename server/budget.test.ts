import { describe, expect, it } from 'vitest';
import { buildBudgetFallback, validBudget } from './budget';

describe('server budget validation', () => {
  it.each([true, false])('allocates exactly 100 percent for initial=%s', initial => {
    const budget = buildBudgetFallback(1000, 200, initial);
    expect(Object.values(budget.recommendedPercentages).reduce((a, b) => a + b, 0)).toBe(100);
    expect(validBudget(budget, 1000)).toBe(true);
  });
  it('keeps zero income free from invented minimum expenses', () => {
    const budget = buildBudgetFallback(0, 0, true);
    expect(validBudget(budget, 0)).toBe(true);
    expect(budget.recommendedFloors.comida).toBe(0);
  });
  it('rejects malformed, inconsistent and unaffordable model output', () => {
    expect(validBudget({}, 1000)).toBe(false);
    const budget = buildBudgetFallback(1000, 200, true);
    expect(validBudget({ ...budget, recommendedPercentages: { ...budget.recommendedPercentages, lazer: 99 } }, 1000)).toBe(false);
    expect(validBudget({ ...budget, recommendedFloors: { ...budget.recommendedFloors, moradia: 2000 } }, 1000)).toBe(false);
    expect(validBudget({ ...budget, recommendedPercentages: { ...budget.recommendedPercentages, comida: NaN } }, 1000)).toBe(false);
  });
});
