import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { AppState, CategoryKey, ReinforcementProvenanceRef } from '../../types/finance';
import {
  selectCategoryReinforcementSummary,
  selectGoalBalanceBreakdown,
  selectPlannedNetIncome,
  selectReconciledBudgetMatrix,
} from '../domainSelectors';
import { calculateThermometerEngine } from '../thermometerEngine';
import { computeCompetenceBudgetSnapshot } from '../rebalanceBudgetEngine';
import {
  distributeReinforcementCents,
  executeCategoryReallocationCommand,
  executeCategoryReinforcementCommand,
  executeWithdrawalCommand,
  listEligibleReinforcementSources,
  previewCategoryReinforcement,
  reverseFinancialCommand,
} from '../financialCommands';
import { buildUnifiedLedger } from '../unifiedLedger';
import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { AvatarProvider } from '../../avatars/AvatarProvider';
import { ReinforcementProvenanceBar } from '../../components/ReinforcementProvenanceBar';
import { CategoryReinforcementModal } from '../../components/modals/CategoryReinforcementModal';
import { HomeScreen } from '../../screens/HomeScreen';
import { MonthThermometerGauge } from '../../components/MonthThermometerGauge';

function makeState26C(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: {
      partner1Name: 'Ana',
      partner2Name: 'Bruno',
      city: 'São Paulo',
      partner1Income: 18000,
      partner2Income: 18000,
      emergencyReserveMonthsTarget: 6,
      expectedYieldAnnual: 6.5,
      streakMonths: 1,
      themeMode: 'light',
      accentTheme: 'emerald',
    },
    categoryPercentages: {
      moradia: 25,
      transporte: 10,
      comida: 20,
      lazer: 27.7777777778, // ~ R$ 10.000 sobre R$ 36.000 (ou usa plan amount direto)
      protecao: 10,
      profissional: 7.2222222222,
    },
    monthlyBudgetPlans: {
      '2026-11': {
        id: '2026-11',
        competence: '2026-11',
        plannedNetIncome: 36000,
        categoryPercentages: {
          moradia: 25,
          transporte: 10,
          comida: 20,
          lazer: 27.78,
          protecao: 10,
          profissional: 7.22,
        },
        categoryAmountsR$: {
          moradia: 9000,
          transporte: 3600,
          comida: 7200,
          lazer: 10000,
          protecao: 3600,
          profissional: 2600,
        },
        status: 'approved',
      },
      '2026-12': {
        id: '2026-12',
        competence: '2026-12',
        plannedNetIncome: 36000,
        categoryPercentages: {
          moradia: 25,
          transporte: 10,
          comida: 20,
          lazer: 27.78,
          protecao: 10,
          profissional: 7.22,
        },
        categoryAmountsR$: {
          moradia: 9000,
          transporte: 3600,
          comida: 7200,
          lazer: 10000,
          protecao: 3600,
          profissional: 2600,
        },
        status: 'approved',
      },
    },
    currentMonth: '2026-11',
    expenses: [],
    incomes: [],
    installments: [],
    coupleFixedBills: [],
    piggyBanks: [
      {
        id: 'goal-lazer-cdb',
        name: 'Fundo Viagem & Lazer',
        emoji: '✈️',
        purpose: 'Reserva para lazer',
        currentAmount: 15000,
        targetAmount: 20000,
        monthlyDeposit: 1000,
        availableCents: 1500000,
        accumulatedCents: 1500000,
        costBasisCents: 1200000,
        revision: 1,
      },
    ],
    coupleGoals: [
      {
        id: 'goal-lazer-cdb',
        title: 'Fundo Viagem & Lazer',
        category: 'lazer',
        emoji: '✈️',
        targetAmount: 20000,
        currentAmount: 15000,
        availableCents: 1500000,
        accumulatedCents: 1500000,
        costBasisCents: 1200000,
        partner1Contribution: 7500,
        partner2Contribution: 7500,
        monthlyPlannedDeposit: 1000,
        isCompleted: false,
        history: [],
        createdAt: '2026-09-01',
        revision: 1,
      },
    ],
    linkedAccounts: [],
    pluggyAccounts: [],
    cashBalanceAnchors: [],
    bankImportedTransactions: [],
    alertRules: [],
    notifications: [],
    protectionCurrentAmount: 20000,
    protectionTotalInvested: 20000,
    protectionYieldAccumulated: 0,
    isProtectionComplete: true,
    freedomTotalInvested: 0,
    freedomYieldAccumulated: 0,
    financialOperations: [],
    ...overrides,
  };
}

describe('Stage 26C — Unified Category Envelope, Provenance & Cent Math', () => {
  it('Scenarios 1 & 2: Base 10.000 + Reinf 8.000 = Effective 18.000 with exact signed nominal balances across 0, 6k, 10k, 18k, 20k and without reinforcement', () => {
    const baseState = makeState26C();
    // Resgate liquidado conciliado em banco de R$ 8.000 com partição para reforço
    const wRes = executeWithdrawalCommand(baseState, {
      operationId: 'op-w-8000',
      goalId: 'goal-lazer-cdb',
      grossAmountR$: 8000,
      netAmountR$: 8000,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'occurred_manual',
      date: '2026-11-05',
      authoredByUid: 'uid-ana',
    });
    expect(wRes.status).toBe('success');

    const reinfRes = executeCategoryReinforcementCommand(wRes.state, {
      operationIdPrefix: 'op-reinf-8k',
      sourceKind: 'goal_withdrawal',
      sourceId: 'op-w-8000',
      amountCents: 800000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      date: '2026-11-05',
      authorizedBy: 'uid-ana',
    });
    expect(reinfRes.status).toBe('success');

    const checkpoints = [
      { spend: 0, expectedMargin: 18000 },
      { spend: 6000, expectedMargin: 12000 },
      { spend: 10000, expectedMargin: 8000 },
      { spend: 18000, expectedMargin: 0 },
      { spend: 20000, expectedMargin: -2000 },
    ];

    for (const cp of checkpoints) {
      const testState: AppState = {
        ...reinfRes.state,
        expenses:
          cp.spend > 0
            ? [
                {
                  id: `exp-lazer-${cp.spend}`,
                  description: 'Gasto Lazer Teste',
                  amount: cp.spend,
                  category: 'lazer',
                  date: '2026-11-12',
                  paidBy: 'both',
                  nature: 'variavel',
                  fundingSource: 'month_budget',
                },
              ]
            : [],
      };
      const matrix = selectReconciledBudgetMatrix(testState, 'casal', '2026-11');
      const lazerRow = matrix.categories.find((c) => c.key === 'lazer')!;
      expect(lazerRow.basePlannedBudget).toBe(10000);
      expect(lazerRow.reinforcementAmount).toBe(8000);
      expect(lazerRow.effectiveBudget).toBe(18000);
      expect(lazerRow.plannedBudget).toBe(18000);
      expect(lazerRow.basePercentage).toBe(27.78);
      expect(lazerRow.signedMargin).toBe(cp.expectedMargin);
      expect(lazerRow.hasTemporaryReinforcement).toBe(true);
    }

    // Scenario 2: Sem reforço (Base 10.000 - Gasto 6.000 = +4.000)
    const noReinfState: AppState = {
      ...baseState,
      expenses: [
        {
          id: 'exp-lazer-6k',
          description: 'Gasto sem reforço',
          amount: 6000,
          category: 'lazer',
          date: '2026-11-12',
          paidBy: 'both',
          nature: 'variavel',
          fundingSource: 'month_budget',
        },
      ],
    };
    const matrixNoReinf = selectReconciledBudgetMatrix(noReinfState, 'casal', '2026-11');
    const lazerNoReinf = matrixNoReinf.categories.find((c) => c.key === 'lazer')!;
    expect(lazerNoReinf.basePlannedBudget).toBe(10000);
    expect(lazerNoReinf.reinforcementAmount).toBe(0);
    expect(lazerNoReinf.effectiveBudget).toBe(10000);
    expect(lazerNoReinf.signedMargin).toBe(4000);
  });

  it('Scenario 3: Monthly income R$ 36.000 stays strictly unchanged across planned income, matrix, thermometer and live preview', () => {
    const baseState = makeState26C();
    const preview = previewCategoryReinforcement(baseState, {
      sourceKind: 'piggy_bank',
      sourceId: 'goal-lazer-cdb',
      amountCents: 800000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
    });
    expect(preview.ok).toBe(true);
    expect(preview.totalIncomeUnchangedR$).toBe(36000);

    const exec = executeCategoryReinforcementCommand(baseState, {
      operationIdPrefix: 'op-reinf-inc-check',
      sourceKind: 'piggy_bank',
      sourceId: 'goal-lazer-cdb',
      amountCents: 800000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      authorizedBy: 'uid-ana',
    });
    expect(exec.status).toBe('success');

    expect(selectPlannedNetIncome(exec.state, 'casal', '2026-11').plannedNetIncome).toBe(36000);
    const matrix = selectReconciledBudgetMatrix(exec.state, 'casal', '2026-11');
    expect(matrix.plannedNetIncome).toBe(36000);
    const thermo = calculateThermometerEngine(exec.state, 'couple');
    expect(thermo.declaredIncome).toBe(36000);
    expect(thermo.reinforcementAmount).toBe(8000);
    expect(thermo.hasTemporaryReinforcement).toBe(true);
  });

  it('Scenario 4: Two reinforcements (5.000 + 3.000 = 8.000) combine into single envelope and single-slice reversal cleanly restores state', () => {
    const baseState = makeState26C();
    const wRes = executeWithdrawalCommand(baseState, {
      operationId: 'op-w-comb',
      goalId: 'goal-lazer-cdb',
      grossAmountR$: 8000,
      netAmountR$: 8000,
      withdrawalChannel: 'virtual_reallocation',
      executionMode: 'occurred_manual',
      date: '2026-11-05',
      authoredByUid: 'uid-ana',
    });
    expect(wRes.status).toBe('success');
    expect(wRes.state.piggyBanks[0].liberatedReservedCents).toBe(800000);

    const r1 = executeCategoryReinforcementCommand(wRes.state, {
      operationIdPrefix: 'op-r1',
      sourceKind: 'goal_withdrawal',
      sourceId: 'op-w-comb',
      amountCents: 500000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      authorizedBy: 'uid-ana',
      date: '2026-11-06',
    });
    expect(r1.status).toBe('success');

    const r2 = executeCategoryReinforcementCommand(r1.state, {
      operationIdPrefix: 'op-r2',
      sourceKind: 'goal_withdrawal',
      sourceId: 'op-w-comb',
      amountCents: 300000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      authorizedBy: 'uid-ana',
      date: '2026-11-07',
    });
    expect(r2.status).toBe('success');

    const matrix2 = selectReconciledBudgetMatrix(r2.state, 'casal', '2026-11');
    const lazer = matrix2.categories.find((c) => c.key === 'lazer')!;
    expect(lazer.reinforcementAmount).toBe(8000);
    expect(lazer.effectiveBudget).toBe(18000);
    expect(lazer.reinforcementSources).toHaveLength(2);
    expect(r2.state.piggyBanks[0].liberatedReservedCents).toBe(0);

    // Estornar apenas a segunda fatia (R$ 3.000)
    const opR2Id = r2.operations![0].id;
    const revR2 = reverseFinancialCommand(r2.state, opR2Id, {
      authoredByUid: 'uid-ana',
      reason: 'Estorno parcial de reforço',
    });
    expect(revR2.status).toBe('success');

    const matrixAfterRev = selectReconciledBudgetMatrix(revR2.state, 'casal', '2026-11');
    const lazerAfterRev = matrixAfterRev.categories.find((c) => c.key === 'lazer')!;
    expect(lazerAfterRev.reinforcementAmount).toBe(5000);
    expect(lazerAfterRev.effectiveBudget).toBe(15000);
    expect(lazerAfterRev.reinforcementSources).toHaveLength(1);
    expect(revR2.state.piggyBanks[0].liberatedReservedCents).toBe(300000);

    const eligibleAfterRev = listEligibleReinforcementSources(revR2.state);
    const wEligible = eligibleAfterRev.find((s) => s.id === 'op-w-comb');
    expect(wEligible?.remainingCents).toBe(300000);
  });

  it('Scenarios 5 & 6: 50/50 split between Moradia and Lazer yields exact 4.000 each and does NOT leak to 2026-12 or double-count', () => {
    const baseState = makeState26C();
    const res = executeCategoryReinforcementCommand(baseState, {
      operationIdPrefix: 'op-split-50-50',
      sourceKind: 'piggy_bank',
      sourceId: 'goal-lazer-cdb',
      amountCents: 800000,
      competence: '2026-11',
      mode: 'equal_split',
      targets: [{ category: 'moradia' }, { category: 'lazer' }],
      authorizedBy: 'uid-ana',
    });
    expect(res.status).toBe('success');

    // Competência ativa 2026-11
    const mNov = selectReconciledBudgetMatrix(res.state, 'casal', '2026-11');
    expect(mNov.categories.find((c) => c.key === 'moradia')!.reinforcementAmount).toBe(4000);
    expect(mNov.categories.find((c) => c.key === 'moradia')!.effectiveBudget).toBe(13000);
    expect(mNov.categories.find((c) => c.key === 'lazer')!.reinforcementAmount).toBe(4000);
    expect(mNov.categories.find((c) => c.key === 'lazer')!.effectiveBudget).toBe(14000);

    // Goal balance breakdown must preserve 15.000 accumulated, 8.000 committed, 7.000 available
    const goalBreak = selectGoalBalanceBreakdown(res.state, 'goal-lazer-cdb')!;
    expect(goalBreak.accumulatedCents).toBe(1500000);
    expect(goalBreak.committedCents).toBe(800000);
    expect(goalBreak.availableCents).toBe(700000);

    // Competência seguinte 2026-12 não sofre vazamento algum
    const mDec = selectReconciledBudgetMatrix(res.state, 'casal', '2026-12');
    expect(mDec.totalReinforcementAmount).toBe(0);
    expect(mDec.categories.find((c) => c.key === 'moradia')!.effectiveBudget).toBe(9000);
    expect(mDec.categories.find((c) => c.key === 'lazer')!.effectiveBudget).toBe(10000);

    const snapDec = computeCompetenceBudgetSnapshot(res.state, '2026-12');
    expect(snapDec.categories.find((c) => c.category === 'lazer')!.temporaryReinforcementCents).toBe(0);
  });

  it('Distribution residue guard: 33.33% * 3 flags 0.01% residue and unallocated cents, requiring explicit confirmation; equal_split uses largest remainder', () => {
    const resCustom = distributeReinforcementCents(
      10000,
      [
        { category: 'moradia', percentage: 33.33 },
        { category: 'comida', percentage: 33.33 },
        { category: 'lazer', percentage: 33.33 },
      ],
      'custom_percent'
    );
    expect(resCustom.ok).toBe(true);
    expect(resCustom.totalPercentage).toBe(99.99);
    expect(resCustom.residualPercentage).toBe(0.01);
    expect(resCustom.hasPercentageResidue).toBe(true);
    expect(resCustom.unallocatedCents).toBeGreaterThan(0);

    const baseState = makeState26C();
    const blockedCmd = executeCategoryReinforcementCommand(baseState, {
      sourceKind: 'piggy_bank',
      sourceId: 'goal-lazer-cdb',
      amountCents: 100000,
      competence: '2026-11',
      mode: 'custom_percent',
      targets: [
        { category: 'moradia', percentage: 33.33 },
        { category: 'comida', percentage: 33.33 },
        { category: 'lazer', percentage: 33.33 },
      ],
      authorizedBy: 'uid-ana',
    });
    expect(blockedCmd.status).toBe('conflict');
    expect(blockedCmd.reasonCode).toBe('CONFIRMATION_REQUIRED');

    const confirmedCmd = executeCategoryReinforcementCommand(baseState, {
      sourceKind: 'piggy_bank',
      sourceId: 'goal-lazer-cdb',
      amountCents: 100000,
      competence: '2026-11',
      mode: 'custom_percent',
      targets: [
        { category: 'moradia', percentage: 33.33 },
        { category: 'comida', percentage: 33.33 },
        { category: 'lazer', percentage: 33.33 },
      ],
      confirmUnallocatedRemainder: true,
      authorizedBy: 'uid-ana',
    });
    expect(confirmedCmd.status).toBe('success');

    // Equal split distributes largest remainder exactly with 0 unallocated cents
    const eq = distributeReinforcementCents(
      10000,
      [{ category: 'moradia' }, { category: 'comida' }, { category: 'lazer' }],
      'equal_split'
    );
    expect(eq.ok).toBe(true);
    expect(eq.unallocatedCents).toBe(0);
    expect(eq.hasPercentageResidue).toBe(false);
    expect(eq.items.map((i) => i.amountCents)).toEqual([3334, 3333, 3333]);
  });

  it('Blocks pending_settlement and planned withdrawals from reinforcing categories, distinguishes bank_reconciled vs manual_declared, and isolates GOAL_DIRECT_PURCHASE', () => {
    const baseState = makeState26C();
    const pendingRes = executeWithdrawalCommand(baseState, {
      operationId: 'op-w-pending',
      goalId: 'goal-lazer-cdb',
      grossAmountR$: 4000,
      netAmountR$: 4000,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'pending_settlement',
      date: '2026-11-10',
      authoredByUid: 'uid-ana',
    });
    expect(pendingRes.status).toBe('success');

    const sources = listEligibleReinforcementSources(pendingRes.state);
    const pendingSource = sources.find((s) => s.id === 'op-w-pending');
    expect(pendingSource?.eligible).toBe(false);
    expect(pendingSource?.blockedReason).toMatch(/liquidação/i);

    const attempt = executeCategoryReinforcementCommand(pendingRes.state, {
      sourceKind: 'goal_withdrawal',
      sourceId: 'op-w-pending',
      amountCents: 400000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      authorizedBy: 'uid-ana',
    });
    expect(attempt.status).toBe('failure');

    // Reconciled withdrawal distinguishes evidenceType = 'bank_reconciled'
    const reconciledState: AppState = {
      ...baseState,
      financialOperations: [
        {
          id: 'op-w-reconciled',
          type: 'GOAL_WITHDRAWAL',
          amountCents: 500000,
          grossAmountCents: 500000,
          netAmountCents: 500000,
          withdrawalChannel: 'asset_redemption',
          settlementStatus: 'reconciled',
          bankTransactionId: 'tx-btg-5000',
          reconciliationRef: 'fitid-btg-5000',
          authorizedBy: 'uid-ana',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-lazer-cdb', name: 'Fundo Viagem & Lazer' },
          targetRef: { type: 'account', id: 'acc-1', name: 'Itaú' },
          competence: '2026-11',
          date: '2026-11-11',
          state: 'reconciled',
          revision: 1,
        },
      ],
      expenses: [
        {
          id: 'exp-direct-goal',
          description: 'Passagem aérea paga direto da caixinha',
          amount: 3000,
          category: 'lazer',
          date: '2026-11-12',
          paidBy: 'both',
          fundingSource: 'goal_direct',
          fundingGoalId: 'goal-lazer-cdb',
          nature: 'variavel',
        },
      ],
    };

    const recExec = executeCategoryReinforcementCommand(reconciledState, {
      operationIdPrefix: 'op-reinf-rec',
      sourceKind: 'goal_withdrawal',
      sourceId: 'op-w-reconciled',
      amountCents: 500000,
      competence: '2026-11',
      mode: 'single_100',
      targets: [{ category: 'lazer', percentage: 100 }],
      authorizedBy: 'uid-ana',
    });
    expect(recExec.status).toBe('success');

    const summary = selectCategoryReinforcementSummary(recExec.state, 'casal', '2026-11');
    expect(summary.byCategory.lazer.reinforcementSources[0].evidenceType).toBe('bank_reconciled');
    expect(summary.byCategory.lazer.reinforcementSources[0].isReconciled).toBe(true);

    // GOAL_DIRECT_PURCHASE não consome teto mensal nem em Lazer
    const matrix = selectReconciledBudgetMatrix(recExec.state, 'casal', '2026-11');
    const lazer = matrix.categories.find((c) => c.key === 'lazer')!;
    expect(lazer.realizedLiquid).toBe(0);
    expect(matrix.goalDirectConsumption).toBe(3000);
  });

  it('Canonical CATEGORY_REALLOCATION command updates category ceilings without inflating income or creating fake expenses, and reverses cleanly', () => {
    const baseState = makeState26C();
    const reallocRes = executeCategoryReallocationCommand(baseState, {
      operationId: 'op-realloc-test-1',
      fromCategory: 'moradia',
      toCategory: 'lazer',
      amountR$: 500,
      competence: '2026-11',
      authorizedBy: 'uid-ana',
    });
    expect(reallocRes.status).toBe('success');

    const mAfter = selectReconciledBudgetMatrix(reallocRes.state, 'casal', '2026-11');
    expect(mAfter.plannedNetIncome).toBe(36000);
    expect(mAfter.categories.find((c) => c.key === 'moradia')!.effectiveBudget).toBe(8500);
    expect(mAfter.categories.find((c) => c.key === 'lazer')!.effectiveBudget).toBe(10500);
    expect(reallocRes.state.expenses).toHaveLength(0);

    const ledger = buildUnifiedLedger(reallocRes.state);
    expect(ledger.some((i) => i.operationId === 'op-realloc-test-1' && i.direction === 'internal')).toBe(true);

    const revRes = reverseFinancialCommand(reallocRes.state, 'op-realloc-test-1', {
      authoredByUid: 'uid-ana',
      reason: 'Desfazer realocação',
    });
    expect(revRes.status).toBe('success');
    const mReverted = selectReconciledBudgetMatrix(revRes.state, 'casal', '2026-11');
    expect(mReverted.categories.find((c) => c.key === 'moradia')!.effectiveBudget).toBe(9000);
    expect(mReverted.categories.find((c) => c.key === 'lazer')!.effectiveBudget).toBe(10000);
  });
});

describe('Stage 26C — Blue Origin UI, Read-Only Provenance & Non-Mutating Preview (RTL)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('ReinforcementProvenanceBar renders blue origin marker, opens read-only provenance dialog on click/Enter with 2 sources + total + verifiable cash warning without calling parent card click or mutating data', () => {
    const parentCardClick = vi.fn();
    const sources: ReinforcementProvenanceRef[] = [
      {
        operationId: 'op-reinf-1',
        sourceOperationId: 'op-w-1',
        sourceType: 'piggy_bank',
        sourceId: 'goal-1',
        sourceName: 'Resgate CDB Liquidez',
        category: 'lazer',
        competence: '2026-11',
        amountCents: 500000,
        amountR$: 5000,
        date: '2026-11-05',
        evidenceType: 'bank_reconciled',
        isReconciled: true,
        reconciliationRef: 'fitid-btg-5000',
      },
      {
        operationId: 'op-reinf-2',
        sourceType: 'piggy_bank',
        sourceId: 'goal-2',
        sourceName: 'Cofrinho Férias',
        category: 'lazer',
        competence: '2026-11',
        amountCents: 300000,
        amountR$: 3000,
        date: '2026-11-08',
        evidenceType: 'manual_declared',
        isReconciled: false,
      },
    ];

    render(
      <div role="button" tabIndex={0} onClick={parentCardClick}>
        <ReinforcementProvenanceBar
          spent={20000}
          baseBudget={10000}
          effectiveBudget={18000}
          reinforcementAmount={8000}
          sources={sources}
          categoryName="Lazer & Férias"
          competence="2026-11"
          verifiableCashStatus="unknown"
        />
      </div>
    );

    const blueBtn = screen.getByTestId('blue-origin-marker-btn');
    expect(blueBtn.textContent).toContain('Origem azul');

    // Click triggers dialog without propagating to parentCardClick
    fireEvent.click(blueBtn);
    expect(parentCardClick).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Consulta somente leitura/i)).toBeTruthy();
    expect(screen.getByText(/Caixa verificável desconhecido/i)).toBeTruthy();
    expect(screen.getAllByTestId('provenance-source-row')).toHaveLength(2);
    expect(screen.getByTestId('provenance-sources-total').textContent).toContain('2 origens');
    expect(screen.getByText(/Conciliado em banco/i)).toBeTruthy();
    expect(screen.getByText(/Declarado manualmente/i)).toBeTruthy();
    expect(screen.getByText(/-R\$\s*2\.000,00/)).toBeTruthy();

    fireEvent.click(screen.getByText('Fechar consulta'));
    expect(parentCardClick).not.toHaveBeenCalled();

    // Keyboard Enter also opens read-only dialog
    fireEvent.keyDown(blueBtn, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(parentCardClick).not.toHaveBeenCalled();
  });

  const ModalTestHarness: React.FC = () => {
    const {
      state,
      updateProfile,
      addPiggyBank,
      depositToPiggyBank,
      withdrawFromPiggyBank,
      totalIncome,
    } = useFinance();
    const [open, setOpen] = React.useState(false);

    const setupScenario = () => {
      updateProfile({ partner1Income: 18000, partner2Income: 18000 });
      addPiggyBank({
        name: 'Fundo Viagem',
        emoji: '✈️',
        purpose: 'Lazer',
        targetAmount: 20000,
        currentAmount: 0,
        monthlyDeposit: 1000,
      });
    };

    const depositAndPendingWithdraw = () => {
      const g = state.piggyBanks[0];
      if (!g) return;
      depositToPiggyBank(g.id, 10000);
      withdrawFromPiggyBank(g.id, 4000, {
        executionMode: 'pending_settlement',
        withdrawalChannel: 'asset_redemption',
      });
    };

    return (
      <div>
        <button type="button" onClick={setupScenario}>setup-scenario</button>
        <button type="button" onClick={depositAndPendingWithdraw}>seed-ops</button>
        <button type="button" onClick={() => setOpen(true)}>open-reinforce-modal</button>
        <div data-testid="income-after">{totalIncome}</div>
        <div data-testid="reinf-ops-count">
          {(state.financialOperations || []).filter((o) => o.type === 'CATEGORY_REINFORCEMENT' && o.state !== 'reverted').length}
        </div>
        <CategoryReinforcementModal
          isOpen={open}
          onClose={() => setOpen(false)}
          initialCategory={'lazer' as CategoryKey}
        />
      </div>
    );
  };

  it('CategoryReinforcementModal shows pending_settlement blocked source, live preview with unchanged income, residue warning at 33.33%*3, and commits canonical reinforcement', () => {
    render(
      <FinanceProvider>
        <AvatarProvider>
          <ModalTestHarness />
        </AvatarProvider>
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-scenario'));
    fireEvent.click(screen.getByText('seed-ops'));
    fireEvent.click(screen.getByText('open-reinforce-modal'));

    expect(screen.getByTestId('blocked-reinforcement-source').textContent).toContain('Aguardando liquidação');
    expect(screen.getByTestId('reinforcement-live-preview').textContent).toContain('Renda do mês (inalterada)');

    // Switch to custom percentage and enter 33.33% * 3 -> triggers residue warning banner
    fireEvent.click(screen.getByText('Porcentagem editável'));
    const moradiaCheckbox = screen.getByLabelText(/Moradia/i);
    const comidaCheckbox = screen.getByLabelText(/Alimentação|Comida/i);
    const lazerCheckbox = screen.getByLabelText(/Lazer/i);
    if (!(moradiaCheckbox as HTMLInputElement).checked) fireEvent.click(moradiaCheckbox);
    if (!(comidaCheckbox as HTMLInputElement).checked) fireEvent.click(comidaCheckbox);
    if (!(lazerCheckbox as HTMLInputElement).checked) fireEvent.click(lazerCheckbox);

    fireEvent.change(screen.getByLabelText(/Porcentagem para Moradia/i), { target: { value: '33.33' } });
    fireEvent.change(screen.getByLabelText(/Porcentagem para Comida/i), { target: { value: '33.33' } });
    fireEvent.change(screen.getByLabelText(/Porcentagem para Lazer/i), { target: { value: '33.33' } });

    expect(screen.getByTestId('residue-warning-banner').textContent).toContain('99.99%');

    // Trying to submit without confirmation shows alert error
    fireEvent.click(screen.getByText('Confirmar Reforço Temporário'));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('reinf-ops-count').textContent).toBe('0');

    // Switch to equal split (exact 100%) and submit
    fireEvent.click(screen.getByText(/Dividir igualmente \(100%\)/i));
    fireEvent.click(screen.getByText('Confirmar Reforço Temporário'));

    expect(Number(screen.getByTestId('reinf-ops-count').textContent)).toBe(3);
    expect(screen.getByTestId('income-after').textContent).toBe('36000');
  });

  it('HomeScreen and MonthThermometerGauge display blue origin marker and open read-only provenance without triggering parent modals', () => {
    const onOpenRaioX = vi.fn();
    const stateWithReinf = makeState26C({
      financialOperations: [
        {
          id: 'op-reinf-ui-1',
          type: 'CATEGORY_REINFORCEMENT',
          amountCents: 800000,
          amountR$: 8000,
          authorizedBy: 'uid-ana',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-lazer-cdb', name: 'Fundo Viagem & Lazer' },
          targetRef: { type: 'category', id: 'lazer', name: 'Lazer & Férias' },
          competence: '2026-11',
          date: '2026-11-05',
          state: 'reconciled',
          reconciliationRef: 'fitid-ui-1',
        },
      ],
    });
    const engine = calculateThermometerEngine(stateWithReinf, 'couple');

    render(
      <MonthThermometerGauge
        engineResult={engine}
        activeLifeTier={{
          key: 'tier-1',
          name: 'Casal em Crescimento',
          minIncome: 0,
          maxIncome: 50000,
          description: 'Plano base',
          emblem: '🌱',
          colorClass: 'bg-emerald-100',
          percentages: {
            moradia: 25,
            transporte: 10,
            comida: 20,
            lazer: 25,
            protecao: 10,
            profissional: 5,
            investimentos: 5,
          },
        }}
        onOpenRaioX={onOpenRaioX}
      />
    );

    const gaugeBlueBtn = screen.getByTestId('blue-origin-marker-btn');
    fireEvent.click(gaugeBlueBtn);
    expect(onOpenRaioX).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Fundo Viagem & Lazer/i)).toBeTruthy();
    cleanup();

    localStorage.setItem('junto_finance_state_v1', JSON.stringify(stateWithReinf));
    render(
      <FinanceProvider>
        <AvatarProvider>
          <HomeScreen
            onNavigate={() => {}}
            onOpenExpenseModal={() => {}}
            onOpenIncomeModal={() => {}}
            onOpenInstallmentModal={() => {}}
            onOpenDepositModal={() => {}}
          />
        </AvatarProvider>
      </FinanceProvider>
    );

    expect(screen.getAllByTestId('blue-origin-marker-btn').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getAllByTestId('blue-origin-marker-btn')[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Raio-X:/i)).toBeNull();
  });
});
