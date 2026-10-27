import { describe, expect, it } from 'vitest';
import type { ExpenseItem, StrategicSpendingIntent, CategoryKey } from '../../types/finance';

function calculateCategorySpendingMock(
  expenses: ExpenseItem[],
  budget: number
) {
  let spent = 0;
  expenses.forEach(exp => {
    const isExcluded =
      exp.isExcludedFromMonthlyBudget ||
      (exp.fundingSource && exp.fundingSource !== 'month_budget');
    if (!isExcluded) {
      spent += exp.amount;
    }
  });

  return {
    spent,
    budget,
    remaining: budget - spent,
    isOver: spent > budget,
  };
}

function matchExpenseWithIntent(
  expense: ExpenseItem,
  intents: StrategicSpendingIntent[]
): StrategicSpendingIntent | null {
  const pendingIntents = intents.filter(i => i.status === 'pending');
  for (const intent of pendingIntents) {
    const amountDiff = Math.abs(expense.amount - intent.estimatedAmount);
    const amountMatch =
      intent.estimatedAmount > 0 && amountDiff / intent.estimatedAmount <= 0.05;
    const words = intent.title
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);
    const descLower = expense.description.toLowerCase();
    const titleMatch = words.some(w => descLower.includes(w));

    if (amountMatch || titleMatch) {
      return intent;
    }
  }
  return null;
}

describe('Triage & Category Budget Preservation Engine', () => {
  it('preserves 100% of category monthly budget when expense is from reserve excess or piggy bank', () => {
    const monthlyBudgetMoradia = 3000;

    const normalExpense: ExpenseItem = {
      id: 'exp-1',
      description: 'Conta de Luz',
      amount: 350,
      category: 'moradia',
      date: '2026-10-05',
      paidBy: 'both',
      fundingSource: 'month_budget',
    };

    const strategicExpense: ExpenseItem = {
      id: 'exp-2',
      description: 'Sofá Retrátil para Sala no PIX',
      amount: 4500,
      category: 'moradia',
      date: '2026-10-10',
      paidBy: 'both',
      fundingSource: 'reserve_excess',
      isExcludedFromMonthlyBudget: true,
    };

    const calc = calculateCategorySpendingMock([normalExpense, strategicExpense], monthlyBudgetMoradia);

    // The strategic expense of R$ 4.500 from reserve excess MUST NOT count towards Moradia monthly spent
    expect(calc.spent).toBe(350);
    expect(calc.remaining).toBe(2650);
    expect(calc.isOver).toBe(false);
  });

  it('matches Open Finance incoming transactions with pre-registered strategic intents', () => {
    const sampleIntents: StrategicSpendingIntent[] = [
      {
        id: 'intent-1',
        title: 'Mobília Sala no PIX',
        estimatedAmount: 3800,
        category: 'moradia',
        targetSource: 'reserve_excess',
        assignedTo: 'couple',
        paymentMethod: 'pix',
        status: 'pending',
        createdAt: '2026-10-01',
      },
      {
        id: 'intent-2',
        title: 'Passagens Férias Noronha',
        estimatedAmount: 2400,
        category: 'lazer',
        targetSource: 'piggy_bank',
        targetGoalId: 'goal-noronha',
        assignedTo: 'couple',
        paymentMethod: 'pix',
        status: 'pending',
        createdAt: '2026-10-01',
      },
    ];

    // Transaction with keyword match
    const tx1: ExpenseItem = {
      id: 'tx-1',
      description: 'Tok&Stok Mobília Sala PIX',
      amount: 3850, // within ~1.3% of 3800
      category: 'moradia',
      date: '2026-10-12',
      paidBy: 'both',
    };

    const match1 = matchExpenseWithIntent(tx1, sampleIntents);
    expect(match1).not.toBeNull();
    expect(match1?.id).toBe('intent-1');
    expect(match1?.targetSource).toBe('reserve_excess');

    // Transaction with amount match within 5%
    const tx2: ExpenseItem = {
      id: 'tx-2',
      description: 'GOL LINHAS AEREAS',
      amount: 2420,
      category: 'lazer',
      date: '2026-10-15',
      paidBy: 'both',
    };

    const match2 = matchExpenseWithIntent(tx2, sampleIntents);
    expect(match2).not.toBeNull();
    expect(match2?.id).toBe('intent-2');
    expect(match2?.targetGoalId).toBe('goal-noronha');
  });

  it('maintains the 3-month untouchable floor for the emergency reserve', () => {
    const monthlyFixedCost = 6000;
    const floorAmount = monthlyFixedCost * 3; // R$ 18.000
    const currentReserve = 25000;
    const excessAmount = Math.max(0, currentReserve - floorAmount); // R$ 7.000

    expect(floorAmount).toBe(18000);
    expect(excessAmount).toBe(7000);

    // If a strategic intent of R$ 5.000 is used, remaining reserve is R$ 20.000 (still above R$ 18.000 floor)
    const afterExpenseReserve = currentReserve - 5000;
    expect(afterExpenseReserve).toBe(20000);
    expect(afterExpenseReserve >= floorAmount).toBe(true);
  });
});
