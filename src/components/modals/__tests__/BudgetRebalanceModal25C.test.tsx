import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { FinanceProvider, useFinance } from '../../../context/FinanceContext';
import { BudgetRebalanceModal } from '../BudgetRebalanceModal';
import { addMonthsToCompetence } from '../../../utils/occurrenceProjection';

const RebalanceHarness: React.FC = () => {
  const {
    state,
    updateProfile,
    addExpense,
    addInstallment,
    recordInstallmentPayment,
    updateCategoryLocks,
  } = useFinance();
  const [open, setOpen] = useState(true);

  const curMonth = state.currentMonth;
  const nextMonth = addMonthsToCompetence(curMonth, 1);

  const setupIncomeAndSettledInstallment = () => {
    updateProfile({ partner1Income: 6000, partner2Income: 4000, investmentsPercentage: 10 });
    updateCategoryLocks({ investimentos: true });
    // Create R$ 3.000 purchase in 3x R$ 1.000 starting curMonth and settle installment #1
    const inst = addInstallment({
      title: 'Notebook Estudos',
      category: 'profissional',
      totalAmount: 3000,
      installmentsCount: 3,
      startMonth: curMonth,
      dueDay: 10,
      paidBy: 'both',
      nature: 'variavel',
    });
    recordInstallmentPayment(inst.id, 1);
  };

  const addLateExpenseInCurrentMonth = () => {
    addExpense({
      description: 'Curso Congresso',
      amount: 1500,
      amountCents: 150000,
      category: 'profissional',
      date: `${curMonth}-15`,
      paidBy: 'both',
      nature: 'variavel',
    });
  };

  const curPlan = state.monthlyBudgetPlans?.[curMonth];
  const futurePlan = state.monthlyBudgetPlans?.[nextMonth];

  return (
    <div>
      <button type="button" onClick={setupIncomeAndSettledInstallment}>
        setup-scenario
      </button>
      <button type="button" onClick={addLateExpenseInCurrentMonth}>
        mutate-after-preview
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        reopen-modal
      </button>

      <div data-testid="current-month">{curMonth}</div>
      <div data-testid="next-month">{nextMonth}</div>
      <div data-testid="global-moradia-pct">{state.categoryPercentages.moradia}</div>
      <div data-testid="global-invest-pct">{state.profile.investmentsPercentage}</div>
      <div data-testid="cur-plan-moradia">{curPlan ? curPlan.categoryPercentages.moradia : 'none'}</div>
      <div data-testid="future-plan-moradia">
        {futurePlan ? futurePlan.categoryPercentages.moradia : 'none'}
      </div>
      <div data-testid="future-plan-actual-prof">
        {curPlan ? curPlan.actualSpentR$.profissional : 'none'}
      </div>
      <div data-testid="future-plan-pending-prof">
        {curPlan ? curPlan.commitmentsR$.profissional : 'none'}
      </div>

      <BudgetRebalanceModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
};

describe('25C BudgetRebalanceModal + Real FinanceProvider Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('does not double count settled installment in commitmentsR$, preserves 10% locked investments, and invalidates stale preview when underlying expense changes', () => {
    render(
      <FinanceProvider>
        <RebalanceHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-scenario'));
    // Reopen to sync initial percentages/locks
    fireEvent.click(screen.getByLabelText('Fechar modal de reequilíbrio'));
    fireEvent.click(screen.getByText('reopen-modal'));

    // Calculate proposal
    fireEvent.click(screen.getByRole('button', { name: /Solicitar Redistribuição do Orçamento/i }));
    expect(screen.getByText(/Plano Viável/i)).toBeInTheDocument();

    // Mutate state while preview is open -> approve button becomes disabled and stale alert appears!
    fireEvent.click(screen.getByText('mutate-after-preview'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Recalcule a prévia/i);
    const approveBtn = screen.getByRole('button', { name: /Aprovar e Salvar Plano do Casal/i });
    expect(approveBtn).toBeDisabled();

    // Recalculate and approve
    fireEvent.click(screen.getByRole('button', { name: /Recalcular/i }));
    expect(approveBtn).not.toBeDisabled();
    fireEvent.click(approveBtn);

    // Settled installment #1 (R$ 1.000) + new expense (R$ 1.500) = R$ 2.500 realized; pending commitments = R$ 0 (NOT R$ 1.000!)
    expect(screen.getByTestId('future-plan-actual-prof')).toHaveTextContent('2500');
    expect(screen.getByTestId('future-plan-pending-prof')).toHaveTextContent('0');
    expect(screen.getByTestId('global-invest-pct')).toHaveTextContent('10');
  });

  it('approving a future competence plan stores the future contract without mutating current active month percentages', () => {
    render(
      <FinanceProvider>
        <RebalanceHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-scenario'));
    const nextMonth = screen.getByTestId('next-month').textContent!;

    fireEvent.change(screen.getByLabelText('Competência do plano'), {
      target: { value: nextMonth },
    });

    // Lock Moradia at 24% for future month only
    fireEvent.change(screen.getByLabelText('Porcentagem de Moradia'), {
      target: { value: '24' },
    });
    const lockButtons = screen.getAllByRole('button', { name: /Destravado|Travado/i });
    // First destination in ALL_DESTINATIONS is moradia
    fireEvent.click(lockButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: /Solicitar Redistribuição do Orçamento/i }));
    fireEvent.click(screen.getByRole('button', { name: /Aprovar e Salvar Plano do Casal/i }));

    // Global moradia for currentMonth remains 30%, while future month plan is 24%
    expect(screen.getByTestId('global-moradia-pct')).toHaveTextContent('30');
    expect(screen.getByTestId('future-plan-moradia')).toHaveTextContent('24');
  });
});
