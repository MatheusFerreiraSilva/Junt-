import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { FinanceProvider, useFinance } from '../../../context/FinanceContext';
import { DepositPiggyModal } from '../DepositPiggyModal';
import { ExpenseModal } from '../ExpenseModal';
import { TransactionTriageBottomSheet } from '../TransactionTriageBottomSheet';

const Harness: React.FC<{ mode: 'expense' | 'deposit' | 'triage' }> = ({ mode }) => {
  const {
    state,
    addPiggyBank,
    addExpense,
    editExpense,
    deleteExpense,
    depositToPiggyBank,
    addDreamSimulation,
    convertDreamToGoal,
  } = useFinance();
  const [modalOpen, setModalOpen] = useState(true);
  const [lastError, setLastError] = useState('');

  const setupTestBank = () => {
    addPiggyBank({
      name: 'Viagem Casal',
      emoji: '✈️',
      purpose: 'Férias',
      targetAmount: 2000,
      currentAmount: 0,
      monthlyDeposit: 200,
    });
  };

  const depositFirstBank = () => {
    const bank = state.piggyBanks[0];
    if (bank) depositToPiggyBank(bank.id, 500);
  };

  const createFirstExpense = () => {
    const bank = state.piggyBanks[0];
    if (!bank) return;
    addExpense({
      description: 'Hotel Praia',
      amount: 200,
      amountCents: 20000,
      category: 'lazer',
      date: `${state.currentMonth}-10`,
      paidBy: 'both',
      fundingSource: 'piggy_bank',
      fundingGoalId: bank.id,
      isExcludedFromMonthlyBudget: true,
    });
  };

  const editFirstExpenseSameSource = () => {
    const exp = state.expenses[0];
    if (!exp) return;
    editExpense(exp.id, { description: 'Hotel Praia Atualizado' });
  };

  const createDream = () => {
    addDreamSimulation({
      title: 'Casa Própria',
      emoji: '🏠',
      totalCost: 300000,
      downPayment: 60000,
      monthlySavings: 3000,
      expectedAnnualYieldPct: 10,
      inflationAnnualPct: 4,
      monthsToAchieve: 60,
      estimatedCompletionDate: '2031-11',
      partner1SharePct: 50,
      partner2SharePct: 50,
    });
  };

  const convertFirstDream = () => {
    const dream = state.dreamSimulations?.[0];
    if (dream) convertDreamToGoal(dream.id);
  };

  const triggerOverdrawExpense = () => {
    const bank = state.piggyBanks[0];
    if (!bank) return;
    try {
      addExpense({
        description: 'Excesso',
        amount: 9999,
        amountCents: 999900,
        category: 'lazer',
        date: `${state.currentMonth}-10`,
        paidBy: 'both',
        fundingSource: 'piggy_bank',
        fundingGoalId: bank.id,
        isExcludedFromMonthlyBudget: true,
      });
    } catch (err: any) {
      setLastError(err.message);
    }
  };

  const deleteFirstExpense = () => {
    const exp = state.expenses[0];
    if (exp) deleteExpense(exp.id);
  };

  const firstBank = state.piggyBanks[0] || null;
  const firstExpense = state.expenses[0] || null;

  return (
    <div>
      <button type="button" onClick={setupTestBank}>
        setup-bank
      </button>
      <button type="button" onClick={depositFirstBank}>
        deposit-500
      </button>
      <button type="button" onClick={createFirstExpense}>
        create-expense-200
      </button>
      <button type="button" onClick={editFirstExpenseSameSource}>
        edit-expense-same-source
      </button>
      <button type="button" onClick={deleteFirstExpense}>
        delete-expense
      </button>
      <button type="button" onClick={triggerOverdrawExpense}>
        overdraw-expense
      </button>
      <button type="button" onClick={createDream}>
        create-dream
      </button>
      <button type="button" onClick={convertFirstDream}>
        convert-dream
      </button>

      <div data-testid="bank-balance">{firstBank ? firstBank.currentAmount : 'none'}</div>
      <div data-testid="banks-count">{state.piggyBanks.length}</div>
      <div data-testid="second-bank-balance">
        {state.piggyBanks[1] ? state.piggyBanks[1].currentAmount : 'none'}
      </div>
      <div data-testid="expenses-count">{state.expenses.length}</div>
      <div data-testid="ops-count">{(state.financialOperations || []).length}</div>
      <div data-testid="ctx-error">{lastError}</div>

      {mode === 'expense' && (
        <ExpenseModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      )}
      {mode === 'deposit' && (
        <DepositPiggyModal isOpen={modalOpen} onClose={() => setModalOpen(false)} bank={firstBank} />
      )}
      {mode === 'triage' && (
        <TransactionTriageBottomSheet
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          expense={firstExpense}
        />
      )}
    </div>
  );
};

describe('29A UI Modals + Real FinanceProvider Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('executes addExpense (piggy_bank), editExpense without double debit, deleteExpense estorno, overdraw block, and R29-09 dream conversion through real FinanceProvider', () => {
    render(
      <FinanceProvider>
        <Harness mode="deposit" />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-bank'));
    fireEvent.click(screen.getByText('deposit-500'));
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('500');

    // Create R$ 200 expense + edit description -> balance stays R$ 300 (no double debit!)
    fireEvent.click(screen.getByText('create-expense-200'));
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('300');
    fireEvent.click(screen.getByText('edit-expense-same-source'));
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('300');
    expect(screen.getByTestId('expenses-count')).toHaveTextContent('1');

    // Trying to spend R$ 9999 fails without altering balance or creating expense
    fireEvent.click(screen.getByText('overdraw-expense'));
    expect(screen.getByTestId('ctx-error').textContent).toMatch(/insuficiente/i);
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('300');
    expect(screen.getByTestId('expenses-count')).toHaveTextContent('1');

    // Delete expense -> estorno brings balance back to R$ 500
    fireEvent.click(screen.getByText('delete-expense'));
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('500');
    expect(screen.getByTestId('expenses-count')).toHaveTextContent('0');

    // Dream conversion with R$ 60k unconfirmed downPayment starts at R$ 0
    fireEvent.click(screen.getByText('create-dream'));
    fireEvent.click(screen.getByText('convert-dream'));
    expect(screen.getByTestId('banks-count')).toHaveTextContent('2');
    expect(screen.getByTestId('second-bank-balance')).toHaveTextContent('0');
  });

  it('DepositPiggyModal displays inline alert and stays open when withdrawal exceeds balance', () => {
    render(
      <FinanceProvider>
        <Harness mode="deposit" />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-bank'));
    fireEvent.click(screen.getByText('deposit-500'));
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('500');

    fireEvent.click(screen.getByText(/Retirar do Cofrinho/i));
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Retirada/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/insuficiente/i);
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('500');
    // Modal still open
    expect(screen.getByRole('button', { name: /Confirmar Retirada/i })).toBeInTheDocument();
  });

  it('ExpenseModal Step 5 supports selecting Caixinha de Objetivo and blocks overdraw inline without partial save', () => {
    render(
      <FinanceProvider>
        <Harness mode="expense" />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-bank'));
    fireEvent.click(screen.getByText('deposit-500'));

    // Enter R$ 700 > R$ 500 in piggy bank
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '700' } });
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    }

    fireEvent.click(screen.getByText(/Caixinha de Objetivo/i));
    fireEvent.click(screen.getByRole('button', { name: /Concluir Gasto/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/insuficiente/i);
    expect(screen.getByTestId('expenses-count')).toHaveTextContent('0');
    expect(screen.getByTestId('bank-balance')).toHaveTextContent('500');
  });
});
