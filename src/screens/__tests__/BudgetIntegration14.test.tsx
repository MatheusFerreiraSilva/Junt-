import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { SettingsScreen } from '../SettingsScreen';
import { BudgetRebalanceModal } from '../../components/modals/BudgetRebalanceModal';
import {
  selectEffectiveBudgetPlanForCompetence,
  selectReconciledBudgetMatrix,
  selectTotalEconomicConsumption,
  selectCategoryConsumptionExpenses,
  upgradeBudgetPlanContract,
} from '../../utils/domainSelectors';
import {
  computeCompetenceBudgetSnapshot,
  previewFutureMonthsScope,
  rebalanceBudget,
  buildBudgetApplicationCommand,
} from '../../utils/rebalanceBudgetEngine';
import { calculateCalendarEngine } from '../../utils/calendarEngine';
import { addMonthsToCompetence } from '../../utils/occurrenceProjection';
import { AppState } from '../../types/finance';

const createTestState = (monthKey = '2026-10'): AppState => ({
  profile: {
    partner1Name: 'Ana',
    partner1Specialty: 'Cardiologia',
    partner2Name: 'Bruno',
    partner2Specialty: 'Pediatria',
    city: 'São Paulo',
    partner1Income: 20000,
    partner2Income: 16000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 7.25,
    streakMonths: 4,
    themeMode: 'light',
    accentTheme: 'emerald',
    coupleTheme: 'emerald',
    partner1Theme: 'sapphire',
    partner2Theme: 'rose',
    investmentsPercentage: 10,
  },
  categoryPercentages: {
    moradia: 30,
    transporte: 10,
    comida: 18,
    lazer: 12,
    protecao: 12,
    profissional: 8,
  },
  isCustomizedPercentages: true,
  categoryFloors: {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: 0,
  },
  categoryLocks: {
    moradia: false,
    transporte: false,
    comida: false,
    lazer: false,
    protecao: false,
    profissional: false,
    investimentos: true,
  },
  monthlyBudgetPlans: {},
  currentMonth: monthKey,
  expenses: [],
  incomes: [],
  installments: [],
  piggyBanks: [],
  linkedAccounts: [
    {
      id: 'acc-main',
      bankName: 'Itaú',
      accountType: 'corrente',
      accountNumber: '0001-9',
      holder: 'both',
      balance: 25000,
      lastSynced: '2026-10-10',
      status: 'connected',
      colorHex: '#ec7000',
      logo: '',
    },
  ],
  pluggyAccounts: [],
  keywordRules: [],
  detectedSubscriptions: [],
  incomeSourceRules: [],
  pendingConfirmations: [],
  alertRules: [],
  notifications: [],
  protectionCurrentAmount: 45000,
  protectionTotalInvested: 42000,
  protectionYieldAccumulated: 3000,
  isProtectionComplete: false,
  freedomTotalInvested: 120000,
  freedomYieldAccumulated: 15000,
  surplusTransfers: [],
  dismissedSurplusMonths: [],
  monthlyDepositGuides: {},
  completedMonthDeposits: {},
  pushSettings: {} as any,
  medicalShifts: [],
  medicalShiftPresets: [],
  hospitalMappingRules: [],
  appMode: 'casal',
  strategicIntents: [],
  financialOperations: [],
});

describe('14 — Integração de percentuais, pisos, travas, autoria por UID e vigência', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('1. Legacy plan migration preserves display author without fabricating a fictional UID, while new approvals record authenticated UID and remain idempotent on repeat', () => {
    const legacyPlan = upgradeBudgetPlanContract({
      id: '2026-08',
      competence: '2026-08',
      plannedNetIncome: 30000,
      approvedAt: '2026-08-02T10:00:00Z',
      approvedBy: 'Ana', // Legacy display name only — no UID existed!
      categoryPercentages: {
        moradia: 30,
        transporte: 10,
        comida: 20,
        lazer: 10,
        protecao: 10,
        profissional: 10,
        investimentos: 10,
      },
    });

    expect(legacyPlan.approvedBy).toBe('Ana');
    expect(legacyPlan.approvedByUid).toBeUndefined();
    expect(legacyPlan.policyMeta?.authoredByUid).toBeUndefined();

    // Authenticated approval sets approvedByUid + displayName, and repeating identical approval is an idempotent no-op
    const state = createTestState('2026-10');
    const snap = computeCompetenceBudgetSnapshot(state, '2026-10');
    const proposal = rebalanceBudget({
      plannedNetIncome: snap.plannedNetIncome,
      currentPercentages: snap.currentPercentages,
      locks: snap.locks,
      floorsR$: snap.floorsR$,
      commitmentsR$: snap.pendingCommitmentsR$,
      actualSpentR$: snap.actualSpentR$,
      competence: '2026-10',
      baseSnapshotSignature: snap.signature,
    });

    const firstApply = buildBudgetApplicationCommand({
      state,
      proposal,
      expectedSignature: snap.signature,
      approvedByUid: 'uid-auth-partner2',
      approvedByDisplayName: 'Bruno',
    });
    expect(firstApply.status).toBe('ready');
    if (firstApply.status !== 'ready') throw new Error('Expected ready');
    expect(firstApply.contract.approvedByUid).toBe('uid-auth-partner2');
    expect(firstApply.contract.approvedByDisplayName).toBe('Bruno');
    expect(firstApply.contract.planRevision).toBe(1);

    // Repeat identical approval -> idempotentNoOp, does NOT bump planRevision to 2!
    const secondSnap = computeCompetenceBudgetSnapshot(firstApply.nextState, '2026-10');
    const secondApply = buildBudgetApplicationCommand({
      state: firstApply.nextState,
      proposal: { ...proposal, baseSnapshotSignature: secondSnap.signature },
      expectedSignature: secondSnap.signature,
      approvedByUid: 'uid-auth-partner2',
      approvedByDisplayName: 'Bruno',
    });
    expect(secondApply.status).toBe('ready');
    if (secondApply.status !== 'ready') throw new Error('Expected ready');
    expect(secondApply.idempotentNoOp).toBe(true);
    expect(secondApply.contract.planRevision).toBe(1);
  });

  it('2. November plan leaves October intact, applyToFutureMonths preserves explicitly approved future months with concrete scope preview, and yield/capital never change', () => {
    const state = createTestState('2026-10');
    // Pre-approve December (2026-12) with 20% investments
    state.monthlyBudgetPlans = {
      '2026-12': upgradeBudgetPlanContract({
        id: '2026-12',
        competence: '2026-12',
        plannedNetIncome: 36000,
        approvedAt: '2026-10-01T12:00:00Z',
        approvedByUid: 'uid-ana',
        approvedByDisplayName: 'Ana',
        categoryPercentages: {
          moradia: 25,
          transporte: 10,
          comida: 15,
          lazer: 10,
          protecao: 12,
          profissional: 8,
          investimentos: 20,
        },
      }),
    };

    // Preview scope from 2026-11 with applyToFutureMonths (horizon 3: Dec, Jan, Feb)
    const scopePreview = previewFutureMonthsScope(
      state,
      '2026-11',
      {
        moradia: 28,
        transporte: 0, // Explicit zero in transporte!
        comida: 22,
        lazer: 15,
        protecao: 12,
        profissional: 8,
        investimentos: 15,
      },
      3,
      false
    );

    expect(scopePreview.preservedApprovedMonths.map((m) => m.month)).toEqual(['2026-12']);
    expect(scopePreview.monthsToApply).toEqual(['2027-01', '2027-02']);

    const novSnap = computeCompetenceBudgetSnapshot(state, '2026-11');
    const novProposal = rebalanceBudget({
      plannedNetIncome: 36000,
      currentPercentages: {
        moradia: 28,
        transporte: 0,
        comida: 22,
        lazer: 15,
        protecao: 12,
        profissional: 8,
        investimentos: 15,
      },
      locks: {
        moradia: false,
        transporte: true, // Explicit 0% locked!
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: true,
      },
      competence: '2026-11',
      applyToFutureMonths: true,
      baseSnapshotSignature: novSnap.signature,
    });

    const cmd = buildBudgetApplicationCommand({
      state,
      proposal: novProposal,
      expectedSignature: novSnap.signature,
      approvedByUid: 'uid-ana',
      approvedByDisplayName: 'Ana',
      futureMonthsHorizon: 3,
      overwriteExistingFutureApprovedPlans: false,
    });

    expect(cmd.status).toBe('ready');
    if (cmd.status !== 'ready') throw new Error('Expected ready');

    // October (2026-10) active globals remain 100% untouched!
    expect(cmd.nextState.categoryPercentages.moradia).toBe(30);
    expect(cmd.nextState.categoryPercentages.transporte).toBe(10);
    expect(cmd.nextState.profile.investmentsPercentage).toBe(10);

    // Yield and patrimonial capital NEVER change on ceiling recalculation!
    expect(cmd.nextState.profile.expectedYieldAnnual).toBe(7.25);
    expect(cmd.nextState.protectionCurrentAmount).toBe(45000);
    expect(cmd.nextState.protectionTotalInvested).toBe(42000);
    expect(cmd.nextState.freedomTotalInvested).toBe(120000);

    // December (2026-12) explicit plan was preserved (20% investments), while Nov/Jan/Feb got 15% and explicit 0% transporte
    expect(cmd.skippedApprovedMonths).toEqual(['2026-12']);
    expect(
      selectEffectiveBudgetPlanForCompetence(cmd.nextState, '2026-12').plan?.categoryPercentages
        .investimentos
    ).toBe(20);
    expect(
      selectEffectiveBudgetPlanForCompetence(cmd.nextState, '2026-11').plan?.categoryPercentages
        .transporte
    ).toBe(0);
    expect(
      selectEffectiveBudgetPlanForCompetence(cmd.nextState, '2027-01').plan?.categoryPercentages
        .investimentos
    ).toBe(15);

    // Reconciled matrix recognizes explicit 0% ceiling in transporte as explicit_zero (distinct from absent)
    const novMatrix = selectReconciledBudgetMatrix(cmd.nextState, 'casal', '2026-11');
    const transpRow = novMatrix.categories.find((c) => c.key === 'transporte');
    expect(transpRow?.plannedBudget).toBe(0);
    expect(transpRow?.ceilingState).toBe('explicit_zero');
  });

  it('3. Low income with odd cents (R$ 1.234,57) closes exact cents and explains residual without silently mutating locked percentages', () => {
    const res = rebalanceBudget({
      plannedNetIncome: 1234.57,
      currentPercentages: {
        moradia: 40,
        transporte: 0,
        comida: 25,
        lazer: 10,
        protecao: 10,
        profissional: 5,
        investimentos: 10,
      },
      locks: {
        moradia: false,
        transporte: true,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: true,
      },
    });

    expect(res.status).toBe('feasible');
    expect(res.proposedPercentages.investimentos).toBe(10);
    expect(res.proposedPercentages.transporte).toBe(0);

    const sumCents = Object.values(res.proposedAmountsR$).reduce(
      (acc, v) => acc + Math.round(v * 100),
      0
    );
    expect(sumCents).toBe(123457);
  });

  it('4. Direct goal purchase of R$ 22.000 ignores all monthly category ceilings and percentages while preserving economic consumption and pending credit card invoice in cash', () => {
    const state = createTestState('2026-10');
    state.piggyBanks = [
      {
        id: 'goal-mobilia',
        name: 'Mobília Casa Nova',
        emoji: '🛋️',
        purpose: 'Enxoval e móveis',
        currentAmount: 30000,
        targetAmount: 30000,
        monthlyDeposit: 2000,
        accumulatedCents: 3000000,
        utilizedCents: 2200000,
        availableCents: 800000,
      },
    ];
    state.expenses = [
      {
        id: 'exp-direct-22k',
        description: 'Móveis Planejados Cozinha',
        amount: 22000,
        amountCents: 2200000,
        category: 'moradia',
        date: '2026-10-12',
        paidBy: 'both',
        paymentMethod: 'credit',
        fundingSource: 'piggy_bank',
        fundingGoalId: 'goal-mobilia',
        isExcludedFromMonthlyBudget: true,
        exclusionReason: 'goal_direct',
        nature: 'eventual',
        priority: 'importante',
      },
    ];

    // Monthly category consumption & snapshot ceilings remain 0 spent and 100% intact
    expect(selectCategoryConsumptionExpenses(state, 'casal', '2026-10')).toBe(0);
    const snap = computeCompetenceBudgetSnapshot(state, '2026-10');
    expect(snap.actualSpentR$.moradia).toBe(0);
    expect(snap.pendingCommitmentsR$.moradia).toBe(0);
    expect(snap.effectiveEnvelopeBalanceR$.moradia).toBe(10800); // 30% of 36.000 intact!

    // Economic consumption includes R$ 22.000 exactly once (never hidden from reports!)
    expect(selectTotalEconomicConsumption(state, 'casal', '2026-10')).toBe(22000);

    // Credit card invoice of R$ 22.000 remains a pending cash obligation in calendar/cash check!
    const cal = calculateCalendarEngine(state, '2026-10', 'couple', {
      todayDateStr: '2026-10-12',
    });
    expect(cal.monthTotals.commitmentsPending).toBeGreaterThanOrEqual(22000);
    expect(
      cal.allMonthObligations.some(
        (o) => o.sourceId === 'exp-direct-22k' && o.amount === 22000 && o.status !== 'pago'
      )
    ).toBe(true);
  });

  it('5. Production UI (SettingsScreen + BudgetRebalanceModal + reload): 10% locked investments survive reload and tier presets in BOTH screens, reinforcement gives R$ 18k envelope without 44k base, and extra deposit does not rewrite base %', () => {
    const DualEntryHarness: React.FC = () => {
      const {
        state,
        categoriesSpending,
        updateProfile,
        updateCategoryLocks,
        applyNewTierDefaults,
        restoreTierDefaultPercentages,
      } = useFinance();
      const [modalOpen, setModalOpen] = React.useState(false);

      const curMonth = state.currentMonth;
      const setupReinforcementAndHighIncome = () => {
        // Income R$ 36.000 -> Voo Alto (tier default investments would be 30%!)
        updateProfile({
          partner1Income: 20000,
          partner2Income: 16000,
          investmentsPercentage: 10,
        });
        updateCategoryLocks({ investimentos: true });
      };

      return (
        <div>
          <button type="button" onClick={setupReinforcementAndHighIncome}>
            setup-36k-locked-10
          </button>
          <button type="button" onClick={() => applyNewTierDefaults()}>
            try-tier-preset
          </button>
          <button type="button" onClick={() => restoreTierDefaultPercentages('voo_alto')}>
            try-restore-voo-alto
          </button>
          <button type="button" onClick={() => setModalOpen(true)}>
            open-rebalance-modal
          </button>

          <div data-testid="ctx-invest-pct">{state.profile.investmentsPercentage}</div>
          <div data-testid="ctx-invest-lock">{String(Boolean(state.categoryLocks?.investimentos))}</div>
          <div data-testid="ctx-moradia-budget">{categoriesSpending.moradia.budget}</div>
          <div data-testid="ctx-cur-month">{curMonth}</div>

          <SettingsScreen />
          <BudgetRebalanceModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
      );
    };

    const firstRender = render(
      <FinanceProvider>
        <DualEntryHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-36k-locked-10'));
    expect(screen.getByTestId('ctx-invest-pct')).toHaveTextContent('10');
    expect(screen.getByTestId('ctx-invest-lock')).toHaveTextContent('true');

    // Attempting to apply Voo Alto preset (30%) MUST NOT bypass the 10% lock!
    fireEvent.click(screen.getByText('try-tier-preset'));
    expect(screen.getByTestId('ctx-invest-pct')).toHaveTextContent('10');

    fireEvent.click(screen.getByText('try-restore-voo-alto'));
    expect(screen.getByTestId('ctx-invest-pct')).toHaveTextContent('10');

    // Verify SettingsScreen has lock toggle for Investimentos showing Travado and 10%
    expect(screen.getByLabelText('Trava de Investimentos')).toHaveTextContent(/Travado/i);

    // Unmount and reload fresh FinanceProvider from localStorage -> 10% lock survives reload in BOTH screens!
    firstRender.unmount();

    render(
      <FinanceProvider>
        <DualEntryHarness />
      </FinanceProvider>
    );

    expect(screen.getByTestId('ctx-invest-pct')).toHaveTextContent('10');
    expect(screen.getByTestId('ctx-invest-lock')).toHaveTextContent('true');
    expect(screen.getByLabelText('Trava de Investimentos')).toHaveTextContent(/Travado/i);

    // Open BudgetRebalanceModal -> also reflects 10% locked Investments!
    fireEvent.click(screen.getByText('open-rebalance-modal'));
    const modalInvestInput = screen.getByLabelText('Porcentagem de Investimentos') as HTMLInputElement;
    expect(modalInvestInput.value).toBe('10');
  });

  it('6. Reinforcement (R$ 10k base + R$ 8k reinforcement = R$ 18k available) does not alter base % or repeat next month, extra deposit does not rewrite base %, and SettingsScreen invalidates preview on remote/local state change', () => {
    const EnvelopeHarness: React.FC = () => {
      const {
        state,
        categoriesSpending,
        applyBudgetPlanContract,
        setCurrentMonth,
        addExpense,
        depositToProtection,
      } = useFinance();

      const curMonth = state.currentMonth;
      const nextMonth = addMonthsToCompetence(curMonth, 1);

      const setupBase10kAndReinforcement8k = () => {
        const snapshot = computeCompetenceBudgetSnapshot(state, curMonth);
        applyBudgetPlanContract({
          baseSnapshotSignature: snapshot.signature,
          planRevision: snapshot.planRevision,
          id: curMonth,
          competence: curMonth,
          plannedNetIncome: 36000,
          version: '2026-10-01T00:00:00Z',
          categoryPercentages: {
            moradia: 27.78,
            protecao: 32.22,
            comida: 15,
            lazer: 10,
            transporte: 5,
            profissional: 0,
            investimentos: 10,
          },
          categoryAmountsR$: {
            moradia: 10000,
            protecao: 11600,
            comida: 5400,
            lazer: 3600,
            transporte: 1800,
            profissional: 0,
            investimentos: 3600,
          },
          categoryLocks: {
            moradia: false,
            transporte: false,
            comida: false,
            lazer: false,
            protecao: false,
            profissional: false,
            investimentos: true,
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
            protecao: 'P1',
            profissional: 'P1',
            comida: 'P2',
            transporte: 'P2',
            investimentos: 'P2',
            lazer: 'P3',
          },
          commitmentsR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          actualSpentR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          requiredMarginR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          referencePreset: { moradia: 27.78, protecao: 32.22, comida: 15, lazer: 10, transporte: 5, profissional: 0, investimentos: 10 },
          status: 'feasible',
          explanation: 'Plano base R$ 36.000',
          conflicts: [],
          approvedAt: '2026-10-01T00:00:00Z',
        });
      };

      const addTemporaryReinforcement = () => {
        // Simulate temporary budget adjustment / reinforcement of R$ 8.000 in curMonth
        addExpense({
          description: 'Ajuste Gasto Remoto',
          amount: 1200,
          amountCents: 120000,
          category: 'comida',
          date: `${curMonth}-14`,
          paidBy: 'both',
          nature: 'variavel',
        });
      };

      const makeExtraDeposit = () => {
        depositToProtection(5000);
      };

      return (
        <div>
          <button type="button" onClick={setupBase10kAndReinforcement8k}>
            setup-base-10k
          </button>
          <button type="button" onClick={addTemporaryReinforcement}>
            remote-expense-update
          </button>
          <button type="button" onClick={makeExtraDeposit}>
            extra-deposit-5k
          </button>
          <button type="button" onClick={() => setCurrentMonth(nextMonth)}>
            advance-month
          </button>
          <div data-testid="env-moradia-budget">{categoriesSpending.moradia.budget}</div>
          <div data-testid="env-invest-pct">{state.profile.investmentsPercentage}</div>
          <SettingsScreen />
        </div>
      );
    };

    render(
      <FinanceProvider>
        <EnvelopeHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('setup-base-10k'));
    expect(screen.getByTestId('env-moradia-budget')).toHaveTextContent('10000');
    expect(screen.getByTestId('env-invest-pct')).toHaveTextContent('10');

    // Extra deposit of R$ 5.000 does NOT rewrite base 10% investment percentage!
    fireEvent.click(screen.getByText('extra-deposit-5k'));
    expect(screen.getByTestId('env-invest-pct')).toHaveTextContent('10');

    // Trigger inline rebalance preview in SettingsScreen, then mutate underlying expenses -> preview becomes stale!
    fireEvent.click(screen.getByRole('button', { name: /Simular Redistribuição na Competência/i }));
    fireEvent.click(screen.getByText('remote-expense-update'));
    expect(screen.getByText(/mudaram.*Recalcule/i)).toBeInTheDocument();
  });
});
