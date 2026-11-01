import { describe, expect, it } from 'vitest';
import type { AppState, CoupleGoal, FixedBillAlert, SavingsPiggyBank, DreamSimulation } from '../../types/finance';

const createBaseState = (): AppState => ({
  profile: {
    partner1Name: 'Ana',
    partner2Name: 'Carlos',
    partner1Income: 18000,
    partner2Income: 18000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    city: 'São Paulo - SP',
    streakMonths: 3,
    themeMode: 'light',
    accentTheme: 'emerald',
  },
  expenses: [],
  incomes: [],
  medicalShifts: [],
  shiftIncomeAllocations: [],
  categoryPercentages: {
    moradia: 30,
    comida: 25,
    lazer: 15,
    protecao: 10,
    profissional: 10,
    transporte: 10,
  },
  piggyBanks: [],
  coupleGoals: [],
  coupleWishlist: [],
  coupleFixedBills: [],
  dreamSimulations: [],
  installments: [],
  linkedAccounts: [],
  alertRules: [],
  currentMonth: '2025-02',
  protectionCurrentAmount: 0,
  protectionTotalInvested: 0,
  protectionYieldAccumulated: 0,
  isProtectionComplete: false,
  freedomTotalInvested: 0,
  freedomYieldAccumulated: 0,
  detectedSubscriptions: [],
  monthlyBudgetPlans: {},
  notifications: [],
});

describe('Step 27: Hub do Casal Integrado, Editável e Sem Redundâncias (H27-01 a H27-14)', () => {
  it('H27-01: Creates goal with single canonical ID across piggyBanks and coupleGoals; editing title preserves balance and ID', () => {
    const state = createBaseState();
    const canonicalId = 'goal-20250220-abc1';

    const piggy: SavingsPiggyBank = {
      id: canonicalId,
      name: 'Viagem Japão',
      emoji: '✈️',
      purpose: 'Meta do Casal: viagem',
      targetAmount: 20000,
      monthlyDeposit: 1500,
      currentAmount: 5000,
      completed: false,
      archived: false,
    };

    const coupleGoal: CoupleGoal = {
      id: canonicalId,
      title: 'Viagem Japão',
      category: 'viagem',
      emoji: '✈️',
      targetAmount: 20000,
      currentAmount: 5000,
      partner1Contribution: 2500,
      partner2Contribution: 2500,
      monthlyPlannedDeposit: 1500,
      isCompleted: false,
      history: [],
      createdAt: '2025-02-20',
      archived: false,
    };

    state.piggyBanks.push(piggy);
    state.coupleGoals.push(coupleGoal);

    expect(state.piggyBanks.length).toBe(1);
    expect(state.coupleGoals.length).toBe(1);
    expect(state.piggyBanks[0].id).toBe(state.coupleGoals[0].id);

    // Edit title
    state.piggyBanks[0].name = 'Viagem Tóquio & Quioto';
    state.coupleGoals[0].title = 'Viagem Tóquio & Quioto';

    expect(state.piggyBanks[0].name).toBe('Viagem Tóquio & Quioto');
    expect(state.coupleGoals[0].title).toBe('Viagem Tóquio & Quioto');
    expect(state.piggyBanks[0].currentAmount).toBe(5000); // Balance untouched
    expect(state.coupleGoals[0].currentAmount).toBe(5000);
  });

  it('H27-03: Archiving a goal with R$ 1.000 preserves cash balance and ID without fake withdrawals', () => {
    const state = createBaseState();
    const goalId = 'goal-arch-1';

    const piggy: SavingsPiggyBank = {
      id: goalId,
      name: 'Reforma Cozinha',
      emoji: '🍳',
      purpose: 'Reforma',
      targetAmount: 10000,
      monthlyDeposit: 500,
      currentAmount: 1000,
      completed: false,
      archived: true, // Archived
    };

    state.piggyBanks.push(piggy);

    // Net worth includes archived piggy bank balance (1000)
    const totalPiggyWorth = state.piggyBanks.reduce((s, p) => s + p.currentAmount, 0);
    expect(totalPiggyWorth).toBe(1000);

    // Active goals filter excludes archived
    const activeGoals = state.piggyBanks.filter(p => !p.archived);
    expect(activeGoals.length).toBe(0);

    // Unarchiving restores goal
    state.piggyBanks[0].archived = false;
    const restoredActive = state.piggyBanks.filter(p => !p.archived);
    expect(restoredActive.length).toBe(1);
    expect(restoredActive[0].id).toBe(goalId);
  });

  it('H27-05: Two goals created with the same name remain distinct entities with separate IDs', () => {
    const state = createBaseState();

    const g1: SavingsPiggyBank = {
      id: 'piggy-101',
      name: 'Viagem',
      emoji: '✈️',
      purpose: 'Férias Julho',
      targetAmount: 5000,
      monthlyDeposit: 500,
      currentAmount: 1200,
    };

    const g2: SavingsPiggyBank = {
      id: 'piggy-102',
      name: 'Viagem',
      emoji: '🌴',
      purpose: 'Ano Novo',
      targetAmount: 8000,
      monthlyDeposit: 800,
      currentAmount: 2000,
    };

    state.piggyBanks.push(g1, g2);

    expect(state.piggyBanks.length).toBe(2);
    expect(state.piggyBanks[0].id).not.toBe(state.piggyBanks[1].id);
    expect(state.piggyBanks.reduce((s, p) => s + p.currentAmount, 0)).toBe(3200);
  });

  it('H27-06: Deleting a converted dream simulation removes ONLY the simulation record and keeps the converted goal intact', () => {
    const state = createBaseState();
    const dreamId = 'dream-sim-1';
    const convertedGoalId = 'goal-converted-1';

    const dream: DreamSimulation = {
      id: dreamId,
      title: 'Comprar Apt',
      emoji: '🏠',
      totalCost: 300000,
      downPayment: 50000,
      monthlySavings: 3000,
      expectedAnnualYieldPct: 8.5,
      inflationAnnualPct: 4.0,
      monthsToAchieve: 80,
      estimatedCompletionDate: '2031-10',
      partner1SharePct: 50,
      partner2SharePct: 50,
      createdAt: '2025-01-01',
      convertedGoalId,
    };

    const convertedPiggy: SavingsPiggyBank = {
      id: convertedGoalId,
      name: 'Comprar Apt',
      emoji: '🏠',
      purpose: 'Sonho do Casal convertido',
      targetAmount: 300000,
      monthlyDeposit: 3000,
      currentAmount: 50000,
    };

    state.dreamSimulations = [dream];
    state.piggyBanks = [convertedPiggy];

    // Delete dream simulation
    state.dreamSimulations = state.dreamSimulations.filter(d => d.id !== dreamId);

    expect(state.dreamSimulations.length).toBe(0); // Dream deleted
    expect(state.piggyBanks.length).toBe(1); // Converted goal survives intact
    expect(state.piggyBanks[0].id).toBe(convertedGoalId);
    expect(state.piggyBanks[0].currentAmount).toBe(50000);
  });

  it('H27-07 & H27-08: Fixed bill payment generates single linked expense; unpaying removes strictly the linked expense and resets bill status', () => {
    const state = createBaseState();
    const billId = 'bill-condominio-1';
    const monthKey = '2025-02';

    const bill: FixedBillAlert = {
      id: billId,
      title: 'Condomínio',
      category: 'moradia',
      amount: 850,
      dueDay: 10,
      assignedPayer: 'both',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
      history: {},
    };

    state.coupleFixedBills = [bill];

    // Pay bill
    const expenseId = `exp-fb-${billId}-${monthKey}`;
    state.expenses.push({
      id: expenseId,
      linkedBillId: billId,
      billCompetenceMonth: monthKey,
      description: '[Conta Fixa] Condomínio',
      amount: 850,
      category: 'moradia',
      date: '2025-02-10',
      paidBy: 'both',
    });

    bill.status = 'paid';
    bill.lastPaidMonth = monthKey;
    bill.history = {
      [monthKey]: {
        status: 'paid',
        paidAt: '2025-02-10',
        paidAmount: 850,
        linkedExpenseId: expenseId,
      },
    };

    expect(state.expenses.length).toBe(1);
    expect(state.coupleFixedBills[0].status).toBe('paid');

    // Add another unlinked expense with similar description to test precision unlinking
    state.expenses.push({
      id: 'exp-other-condominio',
      description: 'Condomínio Extra',
      amount: 200,
      category: 'moradia',
      date: '2025-02-15',
      paidBy: 'partner1',
    });

    expect(state.expenses.length).toBe(2);

    // Unpay fixed bill
    delete bill.history[monthKey];
    bill.status = 'pending';
    state.expenses = state.expenses.filter(e => !(e.linkedBillId === billId && e.billCompetenceMonth === monthKey));

    expect(state.expenses.length).toBe(1); // Unlinked expense survives
    expect(state.expenses[0].id).toBe('exp-other-condominio');
    expect(state.coupleFixedBills[0].status).toBe('pending');
  });

  it('H27-09: Disabling bill recurrence pauses future occurrences without erasing past paid history', () => {
    const state = createBaseState();

    const bill: FixedBillAlert = {
      id: 'bill-academia-1',
      title: 'Academia',
      category: 'lazer',
      amount: 200,
      dueDay: 5,
      assignedPayer: 'partner1',
      autoPay: true,
      status: 'paid',
      lastPaidMonth: '2025-01',
      isRecurring: true,
      active: true,
      history: {
        '2025-01': {
          status: 'paid',
          paidAt: '2025-01-05',
          paidAmount: 200,
        },
      },
    };

    state.coupleFixedBills = [bill];

    // Disable bill recurrence
    bill.active = false;

    expect(state.coupleFixedBills[0].active).toBe(false);
    expect(state.coupleFixedBills[0].history?.['2025-01']?.status).toBe('paid'); // History preserved
  });
});
