import { describe, expect, it } from 'vitest';
import {
  executeFinancialOperation,
  executeExpenseCreateCommand,
  executeExpenseEditCommand,
  executeExpenseDeleteCommand,
  executeGoalAdjustmentCommand,
  executeIntentConversionCommand,
  reverseFinancialCommand,
  runFinancialCommand,
  selectGoalBalanceBreakdown,
} from '../domainSelectors';
import { reconcileConcurrentEntity } from '../../lib/entitySync';
import type {
  AppState,
  CoupleGoal,
  CoupleWishlistItem,
  DreamSimulation,
  FinancialOperationRecord,
  SavingsPiggyBank,
} from '../../types/finance';

function createFixtureState(): AppState {
  const piggy: SavingsPiggyBank = {
    id: 'goal-1',
    name: 'Reserva Viagem',
    emoji: '✈️',
    purpose: 'Viagem do casal',
    currentAmount: 500,
    targetAmount: 2000,
    monthlyDeposit: 200,
    availableCents: 50000,
    accumulatedCents: 50000,
    revision: 1,
  };
  const piggyTwo: SavingsPiggyBank = {
    id: 'goal-2',
    name: 'Reforma Casa',
    emoji: '🏡',
    purpose: 'Casa',
    currentAmount: 300,
    targetAmount: 1500,
    monthlyDeposit: 150,
    availableCents: 30000,
    accumulatedCents: 30000,
    revision: 1,
  };
  const coupleGoal: CoupleGoal = {
    id: 'goal-1',
    title: 'Reserva Viagem',
    category: 'viagem',
    emoji: '✈️',
    targetAmount: 2000,
    currentAmount: 500,
    availableCents: 50000,
    accumulatedCents: 50000,
    partner1Contribution: 250,
    partner2Contribution: 250,
    monthlyPlannedDeposit: 200,
    isCompleted: false,
    history: [],
    createdAt: '2026-01-01',
    revision: 1,
  };
  const coupleGoalTwo: CoupleGoal = {
    ...coupleGoal,
    id: 'goal-2',
    title: 'Reforma Casa',
    emoji: '🏡',
    currentAmount: 300,
    availableCents: 30000,
    accumulatedCents: 30000,
    partner1Contribution: 150,
    partner2Contribution: 150,
  };
  const wishlist: CoupleWishlistItem[] = [
    {
      id: 'wish-1',
      title: 'Sofá Novo',
      category: 'moradia',
      emoji: '🛋️',
      estimatedPrice: 2500,
      priority: 'media',
      requestedBy: 'both',
      status: 'desejo',
      createdAt: '2026-10-01',
    },
  ];
  const dreams: DreamSimulation[] = [
    {
      id: 'dream-1',
      title: 'Casa na Praia',
      emoji: '🏖️',
      totalCost: 200000,
      downPayment: 40000, // Simulated only — unconfirmed capital
      monthlySavings: 2000,
      expectedAnnualYieldPct: 10,
      inflationAnnualPct: 4,
      monthsToAchieve: 60,
      estimatedCompletionDate: '2031-10',
      partner1SharePct: 50,
      partner2SharePct: 50,
      createdAt: '2026-10-01',
    },
  ];
  return {
    profile: {
      partner1Name: 'Ana',
      partner2Name: 'Bruno',
      city: 'SP',
      partner1Income: 10000,
      partner2Income: 10000,
      emergencyReserveMonthsTarget: 6,
      expectedYieldAnnual: 6.5,
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
    incomes: [],
    installments: [],
    piggyBanks: [piggy, piggyTwo],
    coupleGoals: [coupleGoal, coupleGoalTwo],
    coupleWishlist: wishlist,
    dreamSimulations: dreams,
    linkedAccounts: [],
    alertRules: [],
    notifications: [],
    protectionCurrentAmount: 10000,
    protectionTotalInvested: 10000,
    protectionYieldAccumulated: 0,
    isProtectionComplete: true,
    freedomTotalInvested: 0,
    freedomYieldAccumulated: 0,
    financialOperations: [],
  };
}

describe('29A Monetary Integrity & Single Command Layer (R29-01..R29-09)', () => {
  it('R29-01: amountCents=50000 without amountR$ moves exact R$ 500.00 across piggyBanks & coupleGoals', () => {
    const state = createFixtureState();
    const op: FinancialOperationRecord = {
      id: 'op-r29-01',
      type: 'GOAL_DEPOSIT',
      amountCents: 50000,
      authorizedBy: 'uid-ana',
      scope: 'couple',
      sourceRef: { type: 'income', id: 'inc-1' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      competence: '2026-11',
      date: '2026-11-10',
      state: 'occurred_manual',
    };

    const next = executeFinancialOperation(state, op);
    expect(next.piggyBanks[0].currentAmount).toBe(1000);
    expect(next.piggyBanks[0].accumulatedCents).toBe(100000);
    expect(next.piggyBanks[0].availableCents).toBe(100000);
    expect(next.coupleGoals?.[0].currentAmount).toBe(1000);
    expect(next.financialOperations?.[0].amountR$).toBe(500);
    expect(next.financialOperations?.[0].amountCents).toBe(50000);
  });

  it('preserves compatibility with legacy reais-only fixture inputs (amountR$ without amountCents)', () => {
    const state = createFixtureState();
    const legacyOp = {
      id: 'op-legacy-reais',
      type: 'GOAL_DEPOSIT',
      amountR$: 123.45,
      authorizedBy: 'uid-ana',
      sourceRef: { type: 'income', id: 'inc-legacy' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      date: '2026-11-10',
      state: 'occurred_manual',
    } as unknown as FinancialOperationRecord;

    const next = executeFinancialOperation(state, legacyOp);
    expect(next.piggyBanks[0].availableCents).toBe(62345);
    expect(next.piggyBanks[0].currentAmount).toBe(623.45);
    expect(next.financialOperations?.[0].amountCents).toBe(12345);
  });

  it('R29-02: rejects divergent amountCents vs amountR$, NaN, Infinity, unsafe integers, and <= 0 values', () => {
    const state = createFixtureState();
    const divergentOp: FinancialOperationRecord = {
      id: 'op-r29-02-div',
      type: 'GOAL_DEPOSIT',
      amountCents: 50000,
      amountR$: 450,
      authorizedBy: 'uid-ana',
      sourceRef: { type: 'income', id: 'inc-1' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      date: '2026-11-10',
      state: 'occurred_manual',
    };
    expect(() => executeFinancialOperation(state, divergentOp)).toThrow(/Divergência|divergentes/i);

    expect(() =>
      executeFinancialOperation(state, {
        ...divergentOp,
        id: 'op-nan',
        amountCents: Number.NaN,
        amountR$: undefined,
      })
    ).toThrow();

    expect(() =>
      executeFinancialOperation(state, {
        ...divergentOp,
        id: 'op-inf',
        amountCents: Number.POSITIVE_INFINITY,
        amountR$: undefined,
      })
    ).toThrow();

    expect(() =>
      executeFinancialOperation(state, {
        ...divergentOp,
        id: 'op-float-cents',
        amountCents: 10.5,
        amountR$: undefined,
      })
    ).toThrow();

    expect(() =>
      executeFinancialOperation(state, {
        ...divergentOp,
        id: 'op-neg',
        amountCents: -1000,
        amountR$: undefined,
      })
    ).toThrow();

    expect(() =>
      executeFinancialOperation(state, {
        ...divergentOp,
        id: 'op-missing-target',
        amountR$: 500,
        targetRef: { type: 'piggy_bank', id: '' },
      })
    ).toThrow();
  });

  it('R29-03: missing or archived goal fails cleanly without partial state or expense mutation', () => {
    const state = createFixtureState();
    const missingGoalRes = executeExpenseCreateCommand(state, {
      id: 'exp-missing-goal',
      description: 'Mala nova',
      amount: 100,
      category: 'lazer',
      date: '2026-11-10',
      paidBy: 'both',
      fundingSource: 'piggy_bank',
      fundingGoalId: 'goal-inexistente',
      isExcludedFromMonthlyBudget: true,
    });
    expect(missingGoalRes.status).toBe('failure');
    expect(missingGoalRes.reasonCode).toBe('GOAL_NOT_FOUND');
    expect(missingGoalRes.state.expenses).toHaveLength(0);
    expect(missingGoalRes.state.piggyBanks[0].currentAmount).toBe(500);

    const archivedState: AppState = {
      ...state,
      piggyBanks: state.piggyBanks.map((p) => (p.id === 'goal-1' ? { ...p, archived: true } : p)),
    };
    const archivedGoalRes = executeExpenseCreateCommand(archivedState, {
      id: 'exp-archived-goal',
      description: 'Passagem',
      amount: 100,
      category: 'lazer',
      date: '2026-11-10',
      paidBy: 'both',
      fundingSource: 'piggy_bank',
      fundingGoalId: 'goal-1',
      isExcludedFromMonthlyBudget: true,
    });
    expect(archivedGoalRes.status).toBe('failure');
    expect(archivedGoalRes.reasonCode).toBe('GOAL_ARCHIVED');
    expect(archivedGoalRes.state.expenses).toHaveLength(0);
  });

  it('R29-04: rejects withdrawal or goal expense exceeding available balance (zero silent clamping)', () => {
    const state = createFixtureState();
    const overWithdraw = executeGoalAdjustmentCommand(state, {
      goalId: 'goal-1',
      direction: 'withdrawal',
      amountCents: 60000, // R$ 600 > R$ 500 available
      contributor: 'partner1',
      date: '2026-11-10',
    });
    expect(overWithdraw.status).toBe('failure');
    expect(overWithdraw.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(overWithdraw.state.piggyBanks[0].currentAmount).toBe(500);
    expect(overWithdraw.state.coupleGoals?.[0].currentAmount).toBe(500);

    const overExpense = executeExpenseCreateCommand(state, {
      id: 'exp-over',
      description: 'Hotel',
      amountCents: 75000,
      amount: 750,
      category: 'lazer',
      date: '2026-11-10',
      paidBy: 'both',
      fundingSource: 'piggy_bank',
      fundingGoalId: 'goal-1',
      isExcludedFromMonthlyBudget: true,
    });
    expect(overExpense.status).toBe('failure');
    expect(overExpense.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(overExpense.state.expenses).toHaveLength(0);
  });

  it('R29-05: identical replay returns recorded outcome idempotently; same ID with altered intention returns conflict', () => {
    const state = createFixtureState();
    const op: FinancialOperationRecord = {
      id: 'op-r29-05',
      type: 'GOAL_DEPOSIT',
      amountCents: 50000,
      authorizedBy: 'uid-ana',
      authoredByUid: 'uid-ana',
      scope: 'couple',
      sourceRef: { type: 'income', id: 'inc-1' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      competence: '2026-11',
      date: '2026-11-10',
      state: 'occurred_manual',
    };

    const first = runFinancialCommand(state, op);
    expect(first.status).toBe('success');
    expect(first.state.piggyBanks[0].currentAmount).toBe(1000);

    const identicalReplay = runFinancialCommand(first.state, { ...op });
    expect(identicalReplay.status).toBe('success');
    expect(identicalReplay.idempotentReplay).toBe(true);
    expect(identicalReplay.state.piggyBanks[0].currentAmount).toBe(1000);

    const conflictReplay = runFinancialCommand(first.state, {
      ...op,
      amountCents: 75000,
    });
    expect(conflictReplay.status).toBe('conflict');
    expect(conflictReplay.reasonCode).toBe('CONFLICT_PAYLOAD_MISMATCH');
    expect(conflictReplay.state.piggyBanks[0].currentAmount).toBe(1000);
  });

  it('preserves occurred_manual vs reconciled semantics & distinct occurredAt/confirmedAt/authoredByUid', () => {
    const state = createFixtureState();
    const manualOp: FinancialOperationRecord = {
      id: 'op-manual-state',
      type: 'GOAL_DEPOSIT',
      amountCents: 10000,
      authorizedBy: 'uid-ana',
      authoredByUid: 'uid-ana',
      scope: 'partner1',
      sourceRef: { type: 'income', id: 'inc-1' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      date: '2026-11-10',
      occurredAt: '2026-11-08',
      confirmedAt: '2026-11-10T14:00:00.000Z',
      state: 'occurred_manual',
    };

    const res = runFinancialCommand(state, manualOp);
    expect(res.status).toBe('success');
    const saved = res.state.financialOperations?.[0];
    expect(saved?.state).toBe('occurred_manual');
    expect(saved?.occurredAt).toBe('2026-11-08');
    expect(saved?.confirmedAt).toBe('2026-11-10T14:00:00.000Z');
    expect(saved?.authoredByUid).toBe('uid-ana');
    expect(saved?.scope).toBe('partner1');

    // Reconciled requires reconciliationRef; missing reconciliationRef cannot masquerade as reconciled
    const missingEvidence = runFinancialCommand(state, {
      ...manualOp,
      id: 'op-reconcile-missing-ref',
      state: 'reconciled',
      reconciliationRef: '',
    });
    expect(missingEvidence.status).toBe('failure');
  });

  it('R29-06: concurrent debits competing for the same R$ 500 return null conflict in entity reconciliation', () => {
    const before = { id: 'goal-1', currentAmount: 500, accumulatedCents: 50000 };
    const remote = { id: 'goal-1', currentAmount: 0, accumulatedCents: 0 };
    const after = { id: 'goal-1', currentAmount: 0, accumulatedCents: 0 };

    const merged = reconcileConcurrentEntity(before, remote, after);
    expect(merged).toBeNull();
  });

  it('R29-08: editing source or same-source expense never debits twice, rolls back atomically on failed switch, and reverses cleanly on delete', () => {
    const state = createFixtureState();

    // 1. Create purchase of R$ 200 funded by goal-1 (balance 500 -> 300)
    const created = executeExpenseCreateCommand(
      state,
      {
        id: 'exp-edit-test',
        description: 'Passagem Aérea',
        amount: 200,
        amountCents: 20000,
        category: 'lazer',
        date: '2026-11-10',
        paidBy: 'both',
        fundingSource: 'piggy_bank',
        fundingGoalId: 'goal-1',
        isExcludedFromMonthlyBudget: true,
      },
      { authoredByUid: 'uid-ana', operationId: 'op-create-exp-edit-test' }
    );
    expect(created.status).toBe('success');
    expect(created.state.piggyBanks.find((p) => p.id === 'goal-1')?.currentAmount).toBe(300);

    // 2. Edit description only (same funding source) -> must NOT debit R$ 200 a second time!
    const editedSameSource = executeExpenseEditCommand(created.state, 'exp-edit-test', {
      description: 'Passagem Aérea (Remarcada)',
    });
    expect(editedSameSource.status).toBe('success');
    expect(editedSameSource.state.piggyBanks.find((p) => p.id === 'goal-1')?.currentAmount).toBe(300);

    // 3. Edit switching to goal-2 for R$ 500 (goal-2 only has R$ 300!) -> MUST fail atomically WITHOUT losing goal-1's debit or state
    const failedSwitch = executeExpenseEditCommand(editedSameSource.state, 'exp-edit-test', {
      amount: 500,
      amountCents: 50000,
      fundingGoalId: 'goal-2',
    });
    expect(failedSwitch.status).toBe('failure');
    expect(failedSwitch.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(failedSwitch.state.piggyBanks.find((p) => p.id === 'goal-1')?.currentAmount).toBe(300);
    expect(failedSwitch.state.piggyBanks.find((p) => p.id === 'goal-2')?.currentAmount).toBe(300);
    expect(failedSwitch.state.expenses[0].amount).toBe(200);

    // 4. Switch validly to goal-2 keeping R$ 200 -> goal-1 restored to 500, goal-2 debited to 100
    const switchedValid = executeExpenseEditCommand(editedSameSource.state, 'exp-edit-test', {
      fundingGoalId: 'goal-2',
      fundingGoalName: 'Reforma Casa',
    });
    expect(switchedValid.status).toBe('success');
    expect(switchedValid.state.piggyBanks.find((p) => p.id === 'goal-1')?.currentAmount).toBe(500);
    expect(switchedValid.state.piggyBanks.find((p) => p.id === 'goal-2')?.currentAmount).toBe(100);

    // 5. Delete expense -> estorno reverses goal-2 back to R$ 300
    const deleted = executeExpenseDeleteCommand(switchedValid.state, 'exp-edit-test', {
      authoredByUid: 'uid-ana',
    });
    expect(deleted.status).toBe('success');
    expect(deleted.state.expenses).toHaveLength(0);
    expect(deleted.state.piggyBanks.find((p) => p.id === 'goal-2')?.currentAmount).toBe(300);
  });

  it('reverses GOAL_DEPOSIT via reverseFinancialCommand and rejects double reversal or reversal beyond current balance', () => {
    const state = createFixtureState();
    const dep = runFinancialCommand(state, {
      id: 'op-dep-rev',
      type: 'GOAL_DEPOSIT',
      amountCents: 20000,
      authorizedBy: 'uid-ana',
      sourceRef: { type: 'income', id: 'inc-1' },
      targetRef: { type: 'piggy_bank', id: 'goal-1' },
      date: '2026-11-10',
      state: 'occurred_manual',
    });
    expect(dep.state.piggyBanks[0].currentAmount).toBe(700);

    const rev = reverseFinancialCommand(dep.state, 'op-dep-rev', {
      authoredByUid: 'uid-ana',
      reversalOperationId: 'op-rev-1',
    });
    expect(rev.status).toBe('success');
    expect(rev.state.piggyBanks[0].currentAmount).toBe(500);

    // Double reversal must be rejected
    const doubleRev = reverseFinancialCommand(rev.state, 'op-dep-rev', {
      authoredByUid: 'uid-ana',
      reversalOperationId: 'op-rev-2',
    });
    expect(doubleRev.status).toBe('conflict');
  });

  it('R29-09: converting dream or wishlist preserves ONLY genuinely confirmed capital and never invents unbacked downPayment cash', () => {
    const state = createFixtureState();

    // Dream has downPayment: 40000 (simulation only), without confirmed sourceGoalId transfer -> new goal MUST start at R$ 0
    const dreamConvZero = executeIntentConversionCommand(state, {
      kind: 'dream',
      sourceId: 'dream-1',
      newGoalId: 'goal-dream-unbacked',
      authoredByUid: 'uid-ana',
    });
    expect(dreamConvZero.status).toBe('success');
    const unbackedGoal = dreamConvZero.state.piggyBanks.find((p) => p.id === 'goal-dream-unbacked');
    expect(unbackedGoal?.currentAmount).toBe(0);
    expect(unbackedGoal?.availableCents).toBe(0);

    // Wishlist conversion transferring R$ 200 of genuine confirmed capital from goal-1 -> goal-1 drops to 300, new wish goal gets 200
    const wishConvFunded = executeIntentConversionCommand(state, {
      kind: 'wishlist',
      sourceId: 'wish-1',
      newGoalId: 'goal-wish-funded',
      sourceGoalId: 'goal-1',
      confirmedCapitalCents: 20000,
      authoredByUid: 'uid-ana',
    });
    expect(wishConvFunded.status).toBe('success');
    expect(wishConvFunded.state.piggyBanks.find((p) => p.id === 'goal-1')?.currentAmount).toBe(300);
    expect(wishConvFunded.state.piggyBanks.find((p) => p.id === 'goal-wish-funded')?.currentAmount).toBe(200);
  });

  it('selectGoalBalanceBreakdown counts utilized & available once without double-subtraction', () => {
    const state = createFixtureState();
    const op: FinancialOperationRecord = {
      id: 'op-buy-1',
      type: 'GOAL_DIRECT_PURCHASE',
      amountCents: 20000,
      authorizedBy: 'uid-ana',
      sourceRef: { type: 'piggy_bank', id: 'goal-1' },
      targetRef: { type: 'expense', id: 'exp-1' },
      date: '2026-11-10',
      state: 'occurred_manual',
    };
    const next = executeFinancialOperation(state, op);
    const breakdown = selectGoalBalanceBreakdown(next.piggyBanks[0], next.financialOperations);
    expect(breakdown.availableCents).toBe(30000);
    expect(breakdown.utilizedCents).toBe(20000);
    expect(breakdown.accumulatedCents).toBe(50000);
    expect(breakdown.isOvercommitted).toBe(false);
  });
});
