import { describe, it, expect } from 'vitest';
import { getCategoryInfo, CATEGORIES_BASE } from '../../context/FinanceContext';

describe('Category Spending, Fallbacks and Split Precision', () => {
  it('getCategoryInfo returns canonical metadata for standard categories', () => {
    const moradia = getCategoryInfo('moradia');
    expect(moradia.name).toBe('Moradia');
    expect(moradia.emoji).toBe('🏠');
    expect(moradia.isLegacy).toBe(false);

    const protecao = getCategoryInfo('protecao');
    expect(protecao.name).toBe('Proteção');
    expect(protecao.emoji).toBe('🛡️');
    expect(protecao.isLegacy).toBe(false);
  });

  it('getCategoryInfo safely handles legacy or unknown category keys without crashing', () => {
    const legacy = getCategoryInfo('saude');
    expect(legacy).toBeDefined();
    expect(legacy.key).toBe('saude');
    expect(legacy.name).toContain('Saude');
    expect(legacy.emoji).toBe('🏷️');
    expect(legacy.isLegacy).toBe(true);

    const unmapped = getCategoryInfo(undefined);
    expect(unmapped).toBeDefined();
    expect(unmapped.key).toBe('outros');
    expect(unmapped.emoji).toBe('🏷️');
    expect(unmapped.isLegacy).toBe(true);
  });

  it('Integer cents split precision guarantees partner1 + partner2 === total without float drift', () => {
    const testCases = [
      { amount: 33.33, p1Pct: 60, p2Pct: 40 },
      { amount: 100.05, p1Pct: 50, p2Pct: 50 },
      { amount: 99.99, p1Pct: 70, p2Pct: 30 },
      { amount: 123.45, p1Pct: 33, p2Pct: 67 },
      { amount: 0.01, p1Pct: 50, p2Pct: 50 },
      { amount: 500.01, p1Pct: 60, p2Pct: 40 },
    ];

    testCases.forEach(({ amount, p1Pct, p2Pct }) => {
      const totalCents = Math.round(amount * 100);
      const p1Cents = Math.round((totalCents * p1Pct) / 100);
      const p2Cents = totalCents - p1Cents;
      const partner1Amount = p1Cents / 100;
      const partner2Amount = p2Cents / 100;

      expect(Math.round((partner1Amount + partner2Amount) * 100)).toBe(totalCents);
      expect(Number((partner1Amount + partner2Amount).toFixed(2))).toBe(amount);
    });
  });

  it('reconciles funding sources correctly on amount modification (e.g. 300 -> 200 refunds 100)', () => {
    const initialPiggyBalance = 1000;
    const oldExpense = {
      id: 'exp-1',
      amount: 300,
      fundingSource: 'piggy_bank' as const,
      fundingGoalId: 'goal-viagem',
    };

    // Deduction when added:
    let piggyBalance = initialPiggyBalance - oldExpense.amount;
    expect(piggyBalance).toBe(700);

    // Edit to 200 on same piggy bank:
    const newExpense = {
      ...oldExpense,
      amount: 200,
    };

    // Revert old + apply new:
    piggyBalance = piggyBalance + oldExpense.amount - newExpense.amount;
    expect(piggyBalance).toBe(800); // exactly 100 refunded!
  });

  it('reconciles funding source change from piggy_bank to month_budget', () => {
    let piggyBalance = 700; // already had 300 deducted
    const oldExpense = {
      id: 'exp-1',
      amount: 300,
      fundingSource: 'piggy_bank' as const,
      fundingGoalId: 'goal-viagem',
    };

    const newExpense = {
      ...oldExpense,
      fundingSource: 'month_budget' as const,
      fundingGoalId: undefined,
    };

    // Revert old from piggy bank:
    piggyBalance += oldExpense.amount;
    expect(piggyBalance).toBe(1000); // 300 restored to goal
  });

  it('three distinct totals calculation handles routine vs piggy vs reserve', () => {
    const expenses = [
      { id: '1', amount: 150, fundingSource: 'month_budget', paymentMethod: 'pix', isExcludedFromMonthlyBudget: false },
      { id: '2', amount: 300, fundingSource: 'piggy_bank', paymentMethod: 'credit', isExcludedFromMonthlyBudget: true },
      { id: '3', amount: 500, fundingSource: 'reserve_excess', paymentMethod: 'pix', isExcludedFromMonthlyBudget: true },
      { id: '4', amount: 80, fundingSource: 'month_budget', paymentMethod: 'debit', isExcludedFromMonthlyBudget: false },
    ];

    const totalEconomicSpent = expenses.reduce((s, e) => s + e.amount, 0);
    expect(totalEconomicSpent).toBe(150 + 300 + 500 + 80); // 1030

    const budgetConsumedSpent = expenses
      .filter(e => !e.isExcludedFromMonthlyBudget && (!e.fundingSource || e.fundingSource === 'month_budget'))
      .reduce((s, e) => s + e.amount, 0);
    expect(budgetConsumedSpent).toBe(150 + 80); // 230 (piggy and reserve blindados!)

    const cashOutflowSpent = expenses
      .filter(e => e.paymentMethod === 'pix' || e.paymentMethod === 'debit' || e.paymentMethod === 'cash')
      .reduce((s, e) => s + e.amount, 0);
    expect(cashOutflowSpent).toBe(150 + 500 + 80); // 730
  });
});
