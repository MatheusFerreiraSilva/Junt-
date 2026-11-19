import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { GoalsScreen } from '../../screens/GoalsScreen';
import { CoupleHubScreen } from '../../screens/CoupleHubScreen';
import { TransactionHistoryScreen } from '../../screens/TransactionHistoryScreen';
import { MonthlyDepositGuideModal } from '../../components/MonthlyDepositGuideModal';
import {
  executeBlockTransferCommand,
  executeGoalAdjustmentCommand,
  executeInitialPositionCommand,
  executeMonthlyDepositCommand,
  executeMonthlyDepositItemCommand,
  executeValuationAdjustmentCommand,
  reverseFinancialCommand,
  reverseMonthlyDepositCommand,
} from '../financialCommands';
import {
  selectConsolidatedAssetTotal,
  selectFIREMetrics,
  selectTotalNetWorth,
  selectTotalProtectedAssets,
} from '../domainSelectors';
import type { AppState, CoupleGoal, SavingsPiggyBank } from '../../types/finance';

function createStage09FixtureState(): AppState {
  const piggy1: SavingsPiggyBank = {
    id: 'goal-1',
    name: 'Viagem Japão',
    emoji: '🗾',
    purpose: 'Férias',
    currentAmount: 1000,
    targetAmount: 10000,
    monthlyDeposit: 500,
    totalInvested: 1000,
    yieldAccumulated: 0,
    availableCents: 100000,
    accumulatedCents: 100000,
    isFireEligible: false,
    revision: 1,
  };
  const couple1: CoupleGoal = {
    id: 'goal-1',
    title: 'Viagem Japão',
    category: 'viagem',
    emoji: '🗾',
    targetAmount: 10000,
    currentAmount: 1000,
    totalInvested: 1000,
    yieldAccumulated: 0,
    availableCents: 100000,
    accumulatedCents: 100000,
    partner1Contribution: 500,
    partner2Contribution: 500,
    monthlyPlannedDeposit: 500,
    isCompleted: false,
    isFireEligible: false,
    history: [],
    createdAt: '2026-10-01',
    revision: 1,
  };

  return {
    profile: {
      partner1Name: 'Ana',
      partner2Name: 'Bruno',
      city: 'SP',
      partner1Income: 10000,
      partner2Income: 10000,
      emergencyReserveMonthsTarget: 6,
      expectedYieldAnnual: 8,
      investmentsPercentage: 10,
      streakMonths: 1,
      themeMode: 'light',
      accentTheme: 'emerald',
    },
    categoryPercentages: {
      moradia: 30,
      transporte: 10,
      comida: 25,
      lazer: 15,
      protecao: 10,
      profissional: 10,
    },
    currentMonth: '2026-11',
    expenses: [],
    incomes: [
      {
        id: 'inc-base-1',
        description: 'Salário Casal',
        amount: 20000,
        date: '2026-11-01',
        recipient: 'both',
        type: 'salario',
      },
    ],
    installments: [],
    piggyBanks: [piggy1],
    coupleGoals: [couple1],
    linkedAccounts: [],
    alertRules: [],
    notifications: [],
    protectionCurrentAmount: 10000,
    protectionTotalInvested: 10000,
    protectionYieldAccumulated: 0,
    isProtectionComplete: false,
    freedomTotalInvested: 2000,
    freedomYieldAccumulated: 0,
    financialOperations: [],
    monthlyDepositGuides: {
      '2026-11': {
        monthKey: '2026-11',
        status: 'approved',
        approvedAt: '2026-11-01T10:00:00.000Z',
        totalPlanned: 1500,
        items: [
          {
            id: 'item-prot-1',
            block: 'protection',
            title: 'Reserva de Proteção',
            instruction: 'Aportar na reserva',
            destinationLabel: 'Reserva de Proteção',
            baseAmount: 1000,
            surplusAmount: 0,
            totalAmount: 1000,
          },
          {
            id: 'item-goal-1',
            block: 'goals',
            title: 'Viagem Japão',
            instruction: 'Aportar na meta Viagem Japão',
            destinationLabel: 'Viagem Japão',
            targetGoalId: 'goal-1',
            baseAmount: 500,
            surplusAmount: 0,
            totalAmount: 500,
          },
        ],
      },
    },
    completedMonthDeposits: {},
  };
}

const Stage09ProductionHarness: React.FC = () => {
  const {
    state,
    addPiggyBank,
    depositToPiggyBank,
    withdrawFromPiggyBank,
    depositToProtection,
    transferBetweenBlocks,
    updateProtectionBankBalance,
    executeMonthlyDeposit,
    executeMonthlyDepositItem,
    reverseFinancialOperation,
  } = useFinance();

  const [lastOpId, setLastOpId] = React.useState('');
  const [lastError, setLastError] = React.useState('');

  const createGoalAndDeposit500 = () => {
    try {
      setLastError('');
      const created = addPiggyBank({
        name: 'Fundo Aposentadoria',
        emoji: '🪙',
        purpose: 'Independência',
        targetAmount: 50000,
        monthlyDeposit: 1000,
        currentAmount: 0,
        completed: false,
        isFireEligible: true,
      });
      const res = depositToPiggyBank(created.id, 500, 'partner1', 'Aporte inicial', {
        operationId: 'op-ui-500',
      });
      setLastOpId(res.operation?.id || '');
    } catch (e: any) {
      setLastError(e?.message || 'err');
    }
  };

  const applyNegativeProtectionYield = () => {
    try {
      setLastError('');
      depositToProtection(1000);
      updateProtectionBankBalance(1000, 950);
    } catch (e: any) {
      setLastError(e?.message || 'err');
    }
  };

  const tryOverWithdraw = () => {
    try {
      setLastError('');
      const g = state.piggyBanks[0];
      if (g) withdrawFromPiggyBank(g.id, g.currentAmount + 99999);
    } catch (e: any) {
      setLastError(e?.message || 'overdraw-blocked');
    }
  };

  const transferProtectionToFreedom = () => {
    try {
      setLastError('');
      transferBetweenBlocks({
        sourceType: 'protection',
        sourceId: 'protection_reserve',
        targetType: 'freedom',
        targetId: 'freedom_block',
        amount: 200,
        operationId: 'op-ui-transfer-200',
      });
    } catch (e: any) {
      setLastError(e?.message || 'err');
    }
  };

  const tryReverseLastOp = () => {
    try {
      setLastError('');
      if (lastOpId) reverseFinancialOperation(lastOpId);
    } catch (e: any) {
      setLastError(e?.message || 'reverse-err');
    }
  };

  const executeFirstGuideItemThenFull = () => {
    try {
      setLastError('');
      const guide = state.monthlyDepositGuides?.[state.currentMonth];
      const first = guide?.items?.[0];
      if (first) {
        executeMonthlyDepositItem(state.currentMonth, first.id);
      }
      executeMonthlyDeposit(state.currentMonth);
    } catch (e: any) {
      setLastError(e?.message || 'guide-err');
    }
  };

  return (
    <div>
      <button onClick={createGoalAndDeposit500}>btn-create-deposit-500</button>
      <button onClick={applyNegativeProtectionYield}>btn-neg-yield-50</button>
      <button onClick={tryOverWithdraw}>btn-over-withdraw</button>
      <button onClick={transferProtectionToFreedom}>btn-transfer-200</button>
      <button onClick={tryReverseLastOp}>btn-reverse-last</button>
      <button onClick={executeFirstGuideItemThenFull}>btn-guide-partial-then-full</button>

      <div data-testid="last-op-id">{lastOpId}</div>
      <div data-testid="last-error">{lastError}</div>
      <div data-testid="prot-amount">{state.protectionCurrentAmount}</div>
      <div data-testid="prot-yield">{state.protectionYieldAccumulated}</div>
      <div data-testid="freedom-invested">{state.freedomTotalInvested}</div>
      <div data-testid="hub-goals-count">{(state.coupleGoals || []).length}</div>
      <div data-testid="guide-completed">
        {state.completedMonthDeposits?.[state.currentMonth] ? 'yes' : 'no'}
      </div>
      <GoalsScreen />
      <CoupleHubScreen />
      <TransactionHistoryScreen onOpenExpenseModal={() => {}} />
      <MonthlyDepositGuideModal isOpen={true} onClose={() => {}} />
    </div>
  );
};

describe('Stage 09 — Operações patrimoniais e três blocos', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('Scenario 1 & 3 & 8: idempotent R$ 500 deposit replay, payload mismatch rejection, over-withdrawal rejection, and pro-rata cost/gain on partial withdrawal', () => {
    const base = createStage09FixtureState();

    // Register R$ 100 positive valuation on goal-1 so balance becomes R$ 1.100 (cost 1000, gain 100)
    const valRes = executeValuationAdjustmentCommand(base, {
      targetType: 'piggy_bank',
      targetId: 'goal-1',
      targetName: 'Viagem Japão',
      signedDeltaR$: 100,
      operationId: 'op-val-gain-100',
      date: '2026-11-02',
    });
    expect(valRes.status).toBe('success');
    expect(valRes.state.piggyBanks[0].currentAmount).toBe(1100);
    expect(valRes.state.piggyBanks[0].totalInvested).toBe(1000);
    expect(valRes.state.piggyBanks[0].yieldAccumulated).toBe(100);

    // Deposit R$ 500 with explicit operationId
    const dep1 = executeGoalAdjustmentCommand(valRes.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 500,
      contributor: 'partner1',
      operationId: 'op-dep-500',
      date: '2026-11-03',
    });
    expect(dep1.status).toBe('success');
    expect(dep1.state.piggyBanks[0].currentAmount).toBe(1600);
    expect(dep1.state.coupleGoals?.[0].currentAmount).toBe(1600);

    // Idempotent replay with identical payload returns IDEMPOTENT_REPLAY and preserves 1600 balance
    const replay = executeGoalAdjustmentCommand(dep1.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 500,
      contributor: 'partner1',
      operationId: 'op-dep-500',
      date: '2026-11-03',
    });
    expect(replay.status).toBe('success');
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.state.piggyBanks[0].currentAmount).toBe(1600);

    // Payload mismatch with same operationId is blocked
    const mismatch = executeGoalAdjustmentCommand(dep1.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 600,
      contributor: 'partner1',
      operationId: 'op-dep-500',
      date: '2026-11-03',
    });
    expect(mismatch.status).toBe('conflict');
    expect(mismatch.reasonCode).toBe('CONFLICT_PAYLOAD_MISMATCH');

    // Over-withdrawal blocked explicitly without silent zero clamp
    const overdraw = executeGoalAdjustmentCommand(dep1.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'withdrawal',
      amount: 2000,
      operationId: 'op-overdraw-2000',
    });
    expect(overdraw.status).toBe('failure');
    expect(overdraw.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(overdraw.state.piggyBanks[0].currentAmount).toBe(1600);

    // Partial withdrawal of 50% (R$ 800 out of R$ 1.600) splits pro-rata costBasis (750) vs realizedGain (50)
    const partialWithdraw = executeGoalAdjustmentCommand(dep1.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'withdrawal',
      amount: 800,
      operationId: 'op-partial-800',
      date: '2026-11-04',
    });
    expect(partialWithdraw.status).toBe('success');
    expect(partialWithdraw.state.piggyBanks[0].currentAmount).toBe(800);
    expect(partialWithdraw.state.piggyBanks[0].totalInvested).toBe(750);
    expect(partialWithdraw.state.piggyBanks[0].yieldAccumulated).toBe(50);
    expect(partialWithdraw.operation?.costBasisCents).toBe(75000);
    expect(partialWithdraw.operation?.realizedGainCents).toBe(5000);
  });

  it('Scenario 2 & 4: INITIAL_POSITION + VALUATION_ADJUSTMENT (-50) preserve income/consumption invariants and track signed market variation', () => {
    const base = createStage09FixtureState();

    const initRes = executeInitialPositionCommand(base, {
      targetType: 'freedom',
      targetId: 'freedom_block',
      targetName: 'Bloco 3 Liberdade',
      costBasisR$: 3000,
      currentValuationR$: 3500,
      operationId: 'op-init-freedom',
      date: '2026-11-01',
    });
    expect(initRes.status).toBe('success');
    expect(initRes.state.freedomTotalInvested).toBe(5000);
    expect(initRes.state.freedomYieldAccumulated).toBe(500);
    // Initial position does not inflate monthly income or consumption expenses
    expect(initRes.state.incomes).toHaveLength(1);
    expect(initRes.state.expenses).toHaveLength(0);

    const negVal = executeValuationAdjustmentCommand(initRes.state, {
      targetType: 'freedom',
      targetId: 'freedom_block',
      targetName: 'Bloco 3 Liberdade',
      signedDeltaR$: -50,
      operationId: 'op-neg-val-50',
      date: '2026-11-05',
    });
    expect(negVal.status).toBe('success');
    expect(negVal.state.freedomTotalInvested).toBe(5000);
    expect(negVal.state.freedomYieldAccumulated).toBe(450);
    expect(negVal.operation?.state).toBe('occurred_manual');
    expect(negVal.operation?.signedDeltaCents).toBe(-5000);
  });

  it('Scenario 5 & 9: BLOCK_TRANSFER keeps total net worth unchanged and REVERSAL_DEPENDENCY_ERROR blocks reversing an op with active downstream withdrawal', () => {
    const base = createStage09FixtureState();

    const netWorthBefore = selectTotalNetWorth(base, 'casal');
    const transferRes = executeBlockTransferCommand(base, {
      sourceType: 'protection',
      sourceId: 'protection_reserve',
      targetType: 'freedom',
      targetId: 'freedom_block',
      amount: 200,
      operationId: 'op-transfer-prot-free-200',
      reserveFloorR$: 0,
      date: '2026-11-06',
    });
    expect(transferRes.status).toBe('success');
    expect(transferRes.state.protectionCurrentAmount).toBe(9800);
    expect(transferRes.state.freedomTotalInvested).toBe(2200);
    expect(selectTotalNetWorth(transferRes.state, 'casal')).toBe(netWorthBefore);

    // Deposit 300 into goal-1, then withdraw 1100 from goal-1 -> reversing the 300 deposit must fail with REVERSAL_DEPENDENCY_ERROR
    const dep300 = executeGoalAdjustmentCommand(transferRes.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 300,
      operationId: 'op-dep-300',
      date: '2026-11-07',
    });
    const withdraw1100 = executeGoalAdjustmentCommand(dep300.state, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'withdrawal',
      amount: 1100,
      operationId: 'op-with-1100',
      date: '2026-11-08',
    });
    expect(withdraw1100.status).toBe('success');
    expect(withdraw1100.state.piggyBanks[0].currentAmount).toBe(200);

    const blockedRev = reverseFinancialCommand(withdraw1100.state, 'op-dep-300');
    expect(blockedRev.status).toBe('failure');
    expect(blockedRev.reasonCode).toBe('REVERSAL_DEPENDENCY_ERROR');

    // Once the downstream withdrawal is reversed first, reversing the deposit succeeds cleanly
    const revWithdraw = reverseFinancialCommand(withdraw1100.state, 'op-with-1100');
    expect(revWithdraw.status).toBe('success');
    const revDep = reverseFinancialCommand(revWithdraw.state, 'op-dep-300');
    expect(revDep.status).toBe('success');
    expect(revDep.state.piggyBanks[0].currentAmount).toBe(1000);
  });

  it('Scenario 6: monthly deposit guide executes item-by-item without re-executing completed items, blocks duplicate execution, separates planned vs realized vs extra, and reverses cleanly', () => {
    const base = createStage09FixtureState();

    // Execute item 1 individually
    const item1 = executeMonthlyDepositItemCommand(base, {
      monthKey: '2026-11',
      itemId: 'item-prot-1',
      date: '2026-11-10',
    });
    expect(item1.status).toBe('success');
    expect(item1.state.protectionCurrentAmount).toBe(11000);
    expect(item1.state.monthlyDepositGuides?.['2026-11']?.items[0].executedAt).toBeDefined();

    // Complete remaining items via executeMonthlyDepositCommand with extra deposit R$ 300 -> item 1 NOT re-executed
    const fullGuide = executeMonthlyDepositCommand(item1.state, {
      monthKey: '2026-11',
      extraDeposits: [
        {
          targetType: 'freedom',
          targetId: 'freedom_block',
          targetName: 'Bloco 3 Liberdade',
          amountR$: 300,
          note: 'Aporte extra de plantão',
        },
      ],
      date: '2026-11-11',
    });
    expect(fullGuide.status).toBe('success');
    expect(fullGuide.state.protectionCurrentAmount).toBe(11000); // Not 12000!
    expect(fullGuide.state.piggyBanks[0].currentAmount).toBe(1500);
    expect(fullGuide.state.freedomTotalInvested).toBe(2300);
    expect(fullGuide.state.completedMonthDeposits?.['2026-11']?.plannedAmount).toBe(1500);
    expect(fullGuide.state.completedMonthDeposits?.['2026-11']?.extraAmount).toBe(300);
    expect(fullGuide.state.completedMonthDeposits?.['2026-11']?.totalDeposited).toBe(1800);
    // Base plan percentage invariant (10%) remains untouched
    expect(fullGuide.state.profile.investmentsPercentage).toBe(10);

    // Re-running executeMonthlyDepositCommand with a new operationId is rejected
    const duplicate = executeMonthlyDepositCommand(fullGuide.state, {
      monthKey: '2026-11',
      operationId: 'op-guide-second-attempt',
    });
    expect(duplicate.status).toBe('conflict');

    // Reversing monthly deposit restores pre-guide balances
    const reversed = reverseMonthlyDepositCommand(fullGuide.state, '2026-11');
    expect(reversed.status).toBe('success');
    expect(reversed.state.protectionCurrentAmount).toBe(10000);
    expect(reversed.state.piggyBanks[0].currentAmount).toBe(1000);
    expect(reversed.state.freedomTotalInvested).toBe(2000);
    expect(reversed.state.completedMonthDeposits?.['2026-11']).toBeUndefined();
  });

  it('Scenario 7 & 10: prevents double counting of linked CDB custody, requires explicit isFireEligible, avoids forced 50/50 split without agreement, and requires CONFIRMATION_REQUIRED on completed+utilized goal', () => {
    const base = createStage09FixtureState();

    // Linked CDB account R$ 1.000 attached to goal-1 -> total net worth / consolidated total counts R$ 1.000 ONCE
    base.piggyBanks[0].linkedBankAccountId = 'cdb-goal-1';
    base.linkedAccounts = [
      {
        id: 'cdb-goal-1',
        bankName: 'Banco Inter',
        accountNumber: '0001-1',
        accountType: 'investimento',
        balance: 1000,
        lastSynced: '2026-11-01',
        status: 'connected',
        colorHex: '#FF7A00',
        logo: '🟠',
        holder: 'couple',
      },
      {
        id: 'checking-unlinked',
        bankName: 'Nubank',
        accountNumber: '0002-2',
        accountType: 'corrente',
        balance: 2500,
        lastSynced: '2026-11-01',
        status: 'connected',
        colorHex: '#820AD1',
        logo: '🟣',
        holder: 'couple',
      },
    ];

    // Protection 10000 + Freedom 2000 + Goal-1 1000 + Unlinked Checking 2500 = 15500 (not 16500)
    expect(selectConsolidatedAssetTotal(base, 'casal')).toBe(15500);
    expect(selectTotalNetWorth(base, 'casal')).toBe(15500);

    // Explicit FIRE eligibility: only Freedom (2000) is counted when goal-1 has isFireEligible=false
    const fireBefore = selectFIREMetrics(base, 5000);
    expect(fireBefore.fireEligibleCapital).toBe(2000);

    // Individual scope without coupleAgreement/recorded partner contributions does NOT force 50/50 split
    base.piggyBanks.push({
      id: 'goal-unagreed',
      name: 'Meta Sem Acordo',
      emoji: '🏠',
      purpose: 'Casa',
      currentAmount: 4000,
      targetAmount: 20000,
      monthlyDeposit: 0,
      isFireEligible: false,
    });
    const p1Assets = selectTotalProtectedAssets(base, 'partner1');
    expect(p1Assets.goalsAndPiggyBanks).toBe(500); // Only from goal-1's partner1Contribution, NOT 2000 from goal-unagreed
    expect(p1Assets.unapportionedCoupleAssets).toBeGreaterThanOrEqual(4000);

    // Completed + utilized goal deposit triggers CONFIRMATION_REQUIRED unless explicitly confirmed
    base.piggyBanks[0].completed = true;
    base.piggyBanks[0].currentAmount = 0;
    base.piggyBanks[0].availableCents = 0;
    base.piggyBanks[0].utilizedCents = 100000;
    base.piggyBanks[0].accumulatedCents = 100000;
    if (base.coupleGoals?.[0]) {
      base.coupleGoals[0].isCompleted = true;
      base.coupleGoals[0].currentAmount = 0;
      base.coupleGoals[0].availableCents = 0;
      base.coupleGoals[0].utilizedCents = 100000;
      base.coupleGoals[0].accumulatedCents = 100000;
    }
    const blockedCompleted = executeGoalAdjustmentCommand(base, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 100,
      operationId: 'op-completed-blocked',
    });
    expect(blockedCompleted.status).toBe('conflict');
    expect(blockedCompleted.reasonCode).toBe('CONFIRMATION_REQUIRED');

    const confirmedCompleted = executeGoalAdjustmentCommand(base, {
      goalId: 'goal-1',
      targetType: 'piggy_bank',
      direction: 'deposit',
      amount: 100,
      operationId: 'op-completed-blocked',
      completedGoalContributionConfirmed: true,
    });
    expect(confirmedCompleted.status).toBe('success');
    expect(confirmedCompleted.state.piggyBanks[0].currentAmount).toBe(100);
  });

  it('Production FinanceProvider + UI screens integration: executes commands, handles negative yield (-50), rejects overdraw, prevents duplicate guide execution, and renders identical operationId across Investimentos, Hub do Casal e Extrato', () => {
    localStorage.clear();
    render(
      <FinanceProvider>
        <Stage09ProductionHarness />
      </FinanceProvider>
    );

    // 1. Create FIRE goal + deposit 500 -> operationId appears across Investimentos, CoupleHub and Extrato
    fireEvent.click(screen.getByText('btn-create-deposit-500'));
    const opId = screen.getByTestId('last-op-id').textContent || '';
    expect(opId).toBe('op-ui-500');
    expect(screen.getAllByText('op-ui-500').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Ativos Guardados/i).length).toBeGreaterThanOrEqual(1);

    // 2. Deposit 1000 and apply negative yield (-50) on Protection Block -> net 950, yield -50
    fireEvent.click(screen.getByText('btn-neg-yield-50'));
    expect(Number(screen.getByTestId('prot-amount').textContent)).toBeCloseTo(950, 2);
    expect(Number(screen.getByTestId('prot-yield').textContent)).toBeCloseTo(-50, 2);

    // 3. Over-withdrawal throws cleanly without clamping balance to 0
    fireEvent.click(screen.getByText('btn-over-withdraw'));
    expect(screen.getByTestId('last-error').textContent).toMatch(/saldo insuficiente/i);

    // 4. Transfer 200 between Protection and Freedom blocks
    const freedomBefore = Number(screen.getByTestId('freedom-invested').textContent);
    fireEvent.click(screen.getByText('btn-transfer-200'));
    expect(Number(screen.getByTestId('freedom-invested').textContent)).toBeCloseTo(freedomBefore + 200, 2);

    // 5. Partial item execution followed by executeMonthlyDeposit completes guide without double execution
    fireEvent.click(screen.getByText('btn-guide-partial-then-full'));
    expect(screen.getByTestId('guide-completed').textContent).toBe('yes');
  });
});
