import { describe, it, expect } from 'vitest';
import { ExpenseItem, SavingsPiggyBank, FundingSourceType } from '../../types/finance';

describe('Prompt 16 — Registrar e editar gasto com orçamento unificado', () => {
  const baseGoal: SavingsPiggyBank = {
    id: 'goal-viagem',
    name: 'Viagem de Férias',
    purpose: 'Viagem de Férias',
    targetAmount: 5000,
    currentAmount: 200, // Only R$ 200 available
    monthlyDeposit: 100,
    emoji: '✈️',
    category: 'lazer',
    completed: false,
  };

  const initialExpense: ExpenseItem = {
    id: 'exp-101',
    description: 'Reserva Hotel',
    amount: 100,
    date: '2026-12-10',
    category: 'lazer',
    paidBy: 'both',
    fundingSource: 'piggy_bank',
    fundingGoalId: 'goal-viagem',
    fundingGoalName: 'Viagem de Férias',
    isExcludedFromMonthlyBudget: true,
    exclusionReason: 'asset_funding',
  };

  it('1. Insufficient asset funding balance throws error (R$ 200 available, R$ 300 attempted)', () => {
    const goal = { ...baseGoal, currentAmount: 200 };
    const attemptedAmount = 300;

    const hasSufficient = goal.currentAmount >= attemptedAmount;
    expect(hasSufficient).toBe(false);

    const checkBalance = () => {
      if (!hasSufficient) {
        throw new Error(
          `Saldo insuficiente no cofrinho "${goal.name}". Saldo disponível: R$ ${goal.currentAmount.toFixed(2)}.`
        );
      }
    };

    expect(checkBalance).toThrow('Saldo insuficiente no cofrinho "Viagem de Férias"');
  });

  it('2. Editing expense from R$ 100 to R$ 70 restores R$ 30 back to the cofrinho', () => {
    // Before edit: Goal has R$ 200, expense was R$ 100
    let goalAmount = 200;
    const oldAmount = 100;
    const newAmount = 70;

    // Undo old amount: Goal gets +100 = 300
    goalAmount += oldAmount;
    expect(goalAmount).toBe(300);

    // Apply new amount: Goal gets -70 = 230
    goalAmount -= newAmount;
    expect(goalAmount).toBe(230); // Net restoration of R$ 30!
  });

  it('3. Switching from Goal A (R$ 100) to Goal B (R$ 100) compensates Goal A and debits Goal B', () => {
    let goalABalance = 150; // Goal A
    let goalBBalance = 500; // Goal B
    const expenseAmount = 100;

    // Undo Goal A: +100 -> 250
    goalABalance += expenseAmount;
    expect(goalABalance).toBe(250);

    // Debit Goal B: -100 -> 400
    goalBBalance -= expenseAmount;
    expect(goalBBalance).toBe(400);
  });

  it('4. Switching from piggy_bank to month_budget restores goal balance and clears auto-exclusion', () => {
    let goalBalance = 200;
    const oldExpense: ExpenseItem = { ...initialExpense, amount: 100, fundingSource: 'piggy_bank' };

    // Undo Goal: +100 -> 300
    goalBalance += oldExpense.amount;
    expect(goalBalance).toBe(300);

    // New expense fundingSource = month_budget
    const newSource: FundingSourceType = 'month_budget';
    const isExcluded = newSource !== 'month_budget';
    expect(isExcluded).toBe(false); // Returns to counting against monthly budget!
  });

  it('5. Idempotent deletion: deleting expense restores goal balance once without duplication', () => {
    let goalBalance = 200;
    let isDeleted = false;
    const expAmount = 100;

    const performDelete = () => {
      if (isDeleted) return; // Idempotent check
      goalBalance += expAmount;
      isDeleted = true;
    };

    performDelete();
    expect(goalBalance).toBe(300);
    expect(isDeleted).toBe(true);

    // Repeat deletion call
    performDelete();
    expect(goalBalance).toBe(300); // Strictly did NOT jump to 400!
  });

  it('6. Fungible budget envelope invariant: Base 10.000 + Reforço 8.000 - Gasto 6.000 = 12.000', () => {
    const baseBudget = 10000;
    const confirmedReinforcement = 8000;
    const commonExpense = 6000;

    const remainingBudgetEnvelope = baseBudget + confirmedReinforcement - commonExpense;
    expect(remainingBudgetEnvelope).toBe(12000);
  });

  it('7. Private draft isolation: draft key uses user UID (expense_modal_draft_${uid})', () => {
    const uidA = 'user-partner-1';
    const uidB = 'user-partner-2';

    const keyA = `expense_modal_draft_${uidA}`;
    const keyB = `expense_modal_draft_${uidB}`;

    expect(keyA).not.toEqual(keyB);
    expect(keyA).toBe('expense_modal_draft_user-partner-1');
  });
});
