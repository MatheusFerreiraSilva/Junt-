import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { upgradeBudgetPlanContract } from '../../utils/domainSelectors';
import { computeCompetenceBudgetSnapshot } from '../../utils/rebalanceBudgetEngine';

function Harness() {
  const { state, categories, categoriesSpending, totalBudget, applyBudgetPlanContract, setCurrentMonth } = useFinance();
  const plan = upgradeBudgetPlanContract({
    id: '2099-02', competence: '2099-02', plannedNetIncome: 10000,
    status: 'infeasible', explanation: 'inviável', approvedByUid: 'forged',
    baseSnapshotSignature: computeCompetenceBudgetSnapshot(state, '2099-02').signature, planRevision: 0,
    categoryPercentages: { moradia: 20, transporte: 10, comida: 20, lazer: 10, protecao: 20, profissional: 10, investimentos: 10 },
  });
  return <>
    <button onClick={() => applyBudgetPlanContract(plan)}>invalid</button>
    <button onClick={() => setCurrentMonth('2099-02')}>navigate</button>
    <button onClick={() => setCurrentMonth('2099-01')}>back</button>
    <div data-testid="housing">{state.categoryPercentages.moradia}</div>
    <div data-testid="housing-budget">{categories.moradia.budget}</div>
    <div data-testid="housing-envelope">{categoriesSpending.moradia.budget}</div>
    <div data-testid="total-budget">{totalBudget}</div>
    <div data-testid="plan">{state.monthlyBudgetPlans?.['2099-02']?.status || 'none'}</div>
    <div data-testid="month">{state.currentMonth}</div>
  </>;
}

describe('contract application guard', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  it('projects each month without saving that projection as the global policy', () => {
    const future = upgradeBudgetPlanContract({ id: '2099-02', competence: '2099-02', plannedNetIncome: 10000,
      status: 'feasible', approvedAt: '2099-01-01', categoryPercentages: { moradia: 20, transporte: 10, comida: 20, lazer: 10, protecao: 20, profissional: 10, investimentos: 10 } });
    localStorage.setItem('junto_app_financeiro_state_v5:local', JSON.stringify({ version: 1, coupleId: null, state: {
      currentMonth: '2099-01', profile: { partner1Income: 10000, partner2Income: 0 }, categoryPercentages: { moradia: 35, transporte: 5, comida: 15, lazer: 10, protecao: 25, profissional: 0 }, monthlyBudgetPlans: { '2099-02': future }
    }}));
    render(<FinanceProvider><Harness /></FinanceProvider>);
    expect(screen.getByTestId('housing')).toHaveTextContent('35');
    expect(screen.getByTestId('housing-budget')).toHaveTextContent('3500');
    fireEvent.click(screen.getByText('navigate'));
    expect(screen.getByTestId('housing')).toHaveTextContent('20');
    expect(screen.getByTestId('housing-budget')).toHaveTextContent('2000');
    expect(screen.getByTestId('housing-envelope')).toHaveTextContent('2000');
    expect(screen.getByTestId('total-budget')).toHaveTextContent('9000');
    expect(JSON.parse(localStorage.getItem('junto_app_financeiro_state_v5:local')!).state.categoryPercentages.moradia).toBe(35);
    fireEvent.click(screen.getByText('back'));
    expect(screen.getByTestId('housing')).toHaveTextContent('35');
  });
  it('does not apply an infeasible future contract', () => {
    render(<FinanceProvider><Harness /></FinanceProvider>);
    fireEvent.click(screen.getByText('invalid'));
    expect(screen.getByTestId('plan')).toHaveTextContent('none');
  });
});
