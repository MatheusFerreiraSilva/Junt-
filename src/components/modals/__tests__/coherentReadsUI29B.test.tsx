import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { FinanceProvider, useFinance } from '../../../context/FinanceContext';
import { FixedBillsPanelModal } from '../FixedBillsPanelModal';
import { CoupleHubScreen } from '../../../screens/CoupleHubScreen';
import { calculateCalendarEngine } from '../../../utils/calendarEngine';
import { calculateThermometerEngine } from '../../../utils/thermometerEngine';

const CoherentReadsProductionHarness: React.FC = () => {
  const {
    state,
    categoriesSpending,
    reconciledBudgetMatrix,
    addFixedBill,
    payFixedBill,
    unpayFixedBill,
    addExpense,
    deleteExpense,
    applyBudgetPlanContract,
    setCurrentMonth,
  } = useFinance();

  const [panelOpen, setPanelOpen] = useState(true);
  const [panelMonth, setPanelMonth] = useState(state.currentMonth);

  const cal = calculateCalendarEngine(state, state.currentMonth, 'couple', {
    todayDateStr: `${state.currentMonth}-06`,
  });
  const thermo = calculateThermometerEngine(state, 'couple', {
    todayDateStr: `${state.currentMonth}-06`,
  });

  const setupCrossMonthScenario = () => {
    setCurrentMonth('2025-03');
    setPanelMonth('2025-03');
    const bill = addFixedBill({
      title: 'Condomínio Central',
      category: 'moradia',
      amount: 1400,
      dueDay: 10,
      assignedPayer: 'both',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
      active: true,
    });
    // Paga competência 2025-02 em 2025-03-05
    payFixedBill(bill.id, '2025-02', {
      actualDate: '2025-03-05',
      actualAmount: 1400,
      paymentMethod: 'pix',
      paidBy: 'both',
    });
  };

  const setupBillAndSettleCurrentMonth = () => {
    const bill = addFixedBill({
      title: 'Internet Fibra Casa',
      category: 'moradia',
      amount: 199.9,
      dueDay: 15,
      assignedPayer: 'both',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
      active: true,
    });
    payFixedBill(bill.id, state.currentMonth);
  };

  const reverseFirstBillCurrentMonth = () => {
    const bill = state.coupleFixedBills?.[0];
    if (bill) unpayFixedBill(bill.id, state.currentMonth);
  };

  const deleteFirstLinkedExpense = () => {
    const linked = state.expenses.find((e) => Boolean(e.linkedBillId));
    if (linked) deleteExpense(linked.id);
  };

  const addSplitSupermarket800 = () => {
    addExpense({
      description: 'Atacadão Mês',
      amount: 800,
      amountCents: 80000,
      category: 'comida',
      date: `${state.currentMonth}-10`,
      paidBy: 'both',
      paymentMethod: 'debit',
      fundingSource: 'month_budget',
      splits: [
        {
          id: 'sp-1',
          category: 'comida',
          amount: 520,
          amountCents: 52000,
          nature: 'variavel',
          priority: 'essencial',
          classificationOrigin: 'manual_confirmed',
        },
        {
          id: 'sp-2',
          category: 'limpeza' as any,
          amount: 280,
          amountCents: 28000,
          nature: 'variavel',
          priority: 'essencial',
          classificationOrigin: 'manual_confirmed',
        },
      ],
    });
  };

  const setZeroFixedCeilingPlan = () => {
    applyBudgetPlanContract({
      competence: state.currentMonth,
      plannedNetIncome: 10000,
      version: '2.0',
      macroGroups: {
        fixos: { percentage: 0, amountR$: 0 },
        variaveis: { percentage: 90, amountR$: 9000 },
        investimentos: { percentage: 10, amountR$: 1000 },
      },
      categoryPercentages: {
        moradia: 0,
        transporte: 20,
        comida: 30,
        lazer: 20,
        protecao: 0,
        profissional: 20,
        investimentos: 10,
      },
      categoryAmountsR$: {
        moradia: 0,
        transporte: 2000,
        comida: 3000,
        lazer: 2000,
        protecao: 0,
        profissional: 2000,
        investimentos: 1000,
      },
      categoryLocks: {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: false,
      },
      categoryFloorsR$: {
        moradia: 0,
        transporte: 0,
        comida: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
      categoryPriorities: {
        moradia: 'P1',
        transporte: 'P1',
        comida: 'P1',
        lazer: 'P3',
        protecao: 'P1',
        profissional: 'P2',
        investimentos: 'P1',
      },
      commitmentsR$: {
        moradia: 0,
        transporte: 0,
        comida: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
      actualSpentR$: {
        moradia: 0,
        transporte: 0,
        comida: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
      requiredMarginR$: {
        moradia: 0,
        transporte: 0,
        comida: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
      referencePreset: {
        moradia: 0,
        transporte: 20,
        comida: 30,
        lazer: 20,
        protecao: 0,
        profissional: 20,
        investimentos: 10,
      },
      status: 'feasible',
      explanation: 'Teto fixo zero explícito',
      conflicts: [],
    });
  };

  return (
    <div>
      <button onClick={setupCrossMonthScenario}>btn-cross-month</button>
      <button onClick={setupBillAndSettleCurrentMonth}>btn-settle-current</button>
      <button onClick={reverseFirstBillCurrentMonth}>btn-unpay-current</button>
      <button onClick={deleteFirstLinkedExpense}>btn-delete-linked-exp</button>
      <button onClick={addSplitSupermarket800}>btn-split-800</button>
      <button onClick={setZeroFixedCeilingPlan}>btn-zero-ceiling</button>

      <div data-testid="matrix-fixed-realized">
        {reconciledBudgetMatrix.structureBlocks.fixos.realizedLiquid}
      </div>
      <div data-testid="matrix-fixed-pending">
        {reconciledBudgetMatrix.structureBlocks.fixos.pendingCommitments}
      </div>
      <div data-testid="matrix-ceiling-state">
        {reconciledBudgetMatrix.structureBlocks.fixos.ceilingState}
      </div>
      <div data-testid="cat-comida-spent">{categoriesSpending.comida.spent}</div>
      <div data-testid="cat-moradia-spent">{categoriesSpending.moradia.spent}</div>
      <div data-testid="cal-pending">{cal.monthTotals.commitmentsPending}</div>
      <div data-testid="cal-paid">{cal.monthTotals.commitmentsPaid}</div>
      <div data-testid="thermo-spent">{thermo.spentSoFar}</div>
      <div data-testid="thermo-pending">{thermo.pendingCommitmentsAmount}</div>

      <FixedBillsPanelModal
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        initialMonth={panelMonth}
      />
      <CoupleHubScreen />
    </div>
  );
};

describe('29B UI & Production Commands — Leituras coerentes entre Painel, CoupleHub, Matriz, Calendário e Termômetro', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('sincroniza baixa, reversão (unpayFixedBill) e exclusão de despesa vinculada entre todos os consumidores de produção (R29-17)', () => {
    localStorage.clear();
    render(
      <FinanceProvider>
        <CoherentReadsProductionHarness />
      </FinanceProvider>
    );

    const baseCalPending = Number(screen.getByTestId('cal-pending').textContent);
    const baseThermoPending = Number(screen.getByTestId('thermo-pending').textContent);
    const baseMatrixFixedRealized = Number(screen.getByTestId('matrix-fixed-realized').textContent);

    // 1. Cadastra e baixa conta fixa de R$ 199,90 no mês ativo
    fireEvent.click(screen.getByText('btn-settle-current'));

    expect(Number(screen.getByTestId('matrix-fixed-realized').textContent)).toBeCloseTo(
      baseMatrixFixedRealized + 199.9,
      2
    );
    expect(Number(screen.getByTestId('cal-pending').textContent)).toBeCloseTo(baseCalPending, 2);
    expect(Number(screen.getByTestId('thermo-pending').textContent)).toBeCloseTo(
      baseThermoPending,
      2
    );

    // 2. Reabre via unpayFixedBill -> volta para pendente em Matriz, Calendário e Termômetro
    fireEvent.click(screen.getByText('btn-unpay-current'));

    expect(Number(screen.getByTestId('matrix-fixed-realized').textContent)).toBeCloseTo(
      baseMatrixFixedRealized,
      2
    );
    expect(Number(screen.getByTestId('cal-pending').textContent)).toBeCloseTo(
      baseCalPending + 199.9,
      2
    );
    expect(Number(screen.getByTestId('thermo-pending').textContent)).toBeCloseTo(
      baseThermoPending + 199.9,
      2
    );

    // 3. Baixa pelo botão real "Baixar" do FixedBillsPanelModal e depois exclui a despesa vinculada
    const baixarButtons = screen.getAllByText('Baixar');
    fireEvent.click(baixarButtons[baixarButtons.length - 1]);
    expect(Number(screen.getByTestId('matrix-fixed-realized').textContent)).toBeCloseTo(
      baseMatrixFixedRealized + 199.9,
      2
    );

    fireEvent.click(screen.getByText('btn-delete-linked-exp'));
    expect(Number(screen.getByTestId('matrix-fixed-realized').textContent)).toBeCloseTo(
      baseMatrixFixedRealized,
      2
    );
    expect(Number(screen.getByTestId('thermo-pending').textContent)).toBeCloseTo(
      baseThermoPending + 199.9,
      2
    );
  });

  it('aloca compra dividida de R$ 800 entre categorias no FinanceContext e exibe teto zero explícito no painel (R29-12 & R29-15)', () => {
    localStorage.clear();
    render(
      <FinanceProvider>
        <CoherentReadsProductionHarness />
      </FinanceProvider>
    );

    const initialComida = Number(screen.getByTestId('cat-comida-spent').textContent);
    const initialMoradia = Number(screen.getByTestId('cat-moradia-spent').textContent);

    fireEvent.click(screen.getByText('btn-split-800'));

    expect(Number(screen.getByTestId('cat-comida-spent').textContent)).toBeCloseTo(
      initialComida + 520,
      2
    );
    expect(Number(screen.getByTestId('cat-moradia-spent').textContent)).toBeCloseTo(
      initialMoradia + 280,
      2
    );

    fireEvent.click(screen.getByText('btn-zero-ceiling'));
    expect(screen.getByTestId('matrix-ceiling-state').textContent).toBe('explicit_zero');
    expect(screen.getByText('Teto Fixo Explícito: R$ 0,00')).toBeTruthy();
  });

  it('pagamento em 05/03 de conta fixa de competência 2025-02 mantém 2025-03 pendente em todos os consumidores (R29-10)', () => {
    localStorage.clear();
    render(
      <FinanceProvider>
        <CoherentReadsProductionHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('btn-cross-month'));

    // Em 2025-03, o Condomínio Central de R$ 1.400 continua pendente (não foi baixado pelo pagamento de fev!)
    expect(Number(screen.getByTestId('matrix-fixed-realized').textContent)).toBe(0);
    expect(Number(screen.getByTestId('matrix-fixed-pending').textContent)).toBeGreaterThanOrEqual(
      1400
    );
    expect(Number(screen.getByTestId('thermo-spent').textContent)).toBe(0);
    expect(Number(screen.getByTestId('thermo-pending').textContent)).toBeGreaterThanOrEqual(1400);
  });
});
