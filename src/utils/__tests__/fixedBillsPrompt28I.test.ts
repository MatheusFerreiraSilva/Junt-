import { describe, expect, it } from 'vitest';
import { AppState, FixedBillAlert, ExpenseItem } from '../../types/finance';
import { calculateFixedBillsSummary, selectFixedBillOccurrences } from '../fixedBillEngine';

const createBaseState = (monthKey: string = '2025-02'): AppState => ({
  profile: {
    partner1Name: 'Médico A',
    partner1Specialty: 'Cardiologia',
    partner2Name: 'Médica B',
    partner2Specialty: 'Dermatologia',
    city: 'São Paulo',
    partner1Income: 6000,
    partner2Income: 4000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 3,
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
    comida: 15,
    lazer: 15,
    protecao: 10,
    profissional: 10,
  },
  isCustomizedPercentages: false,
  categoryFloors: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
  categoryLocks: { moradia: false, transporte: false, comida: false, lazer: false, protecao: false, profissional: false, investimentos: false },
  monthlyBudgetPlans: {},
  currentMonth: monthKey,
  expenses: [],
  incomes: [
    { id: 'inc-1', amount: 6000, description: 'Salário A', date: `${monthKey}-05`, recipient: 'partner1', type: 'fixed' },
    { id: 'inc-2', amount: 4000, description: 'Salário B', date: `${monthKey}-05`, recipient: 'partner2', type: 'fixed' },
  ],
  installments: [],
  piggyBanks: [],
  linkedAccounts: [],
  pluggyAccounts: [],
  keywordRules: [],
  detectedSubscriptions: [],
  incomeSourceRules: [],
  pendingConfirmations: [],
  alertRules: [],
  notifications: [],
  protectionCurrentAmount: 0,
  protectionTotalInvested: 0,
  protectionYieldAccumulated: 0,
  isProtectionComplete: false,
  freedomTotalInvested: 0,
  freedomYieldAccumulated: 0,
  surplusTransfers: [],
  dismissedSurplusMonths: [],
  monthlyDepositGuides: {},
  completedMonthDeposits: {},
  pushSettings: {} as any,
  medicalShifts: [],
  medicalShiftPresets: [],
  hospitalMappingRules: [],
  appMode: 'casal',
  coupleFixedBills: [],
  collegeModeData: { active: false, courseName: 'Medicina', currentSemester: 1, totalSemesters: 12, monthlyStipend: 0, totalInvestedInCollege: 0, studentName: 'Estudante' },
  strategicIntents: [],
});

describe('Prompt 28I — Painel de Fixos, Calendário e Contas Fixas', () => {
  it('Proof 1: R$ 4.000 teto, Aluguel R$ 3.600 (Moradia) e Streaming R$ 100 (Lazer) display 90%, 2.5%, 92.5% and R$ 300 margin; +R$ 350 produces R$ 50 excess', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-aluguel',
        title: 'Aluguel Apto',
        category: 'moradia',
        amount: 3600,
        dueDay: 5,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
        active: true,
      },
      {
        id: 'bill-streaming',
        title: 'Netflix & Spotify',
        category: 'lazer',
        amount: 100,
        dueDay: 15,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
        active: true,
      },
    ];

    const summary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-01');
    expect(summary.fixedCeilingR$).toBe(4000); // 40% of R$ 10.000
    expect(summary.projectedCommittedR$).toBe(3700);
    expect(summary.signedMarginR$).toBe(300);
    expect(summary.pctConsumedOfCeiling).toBe(92.5);

    const moradiaCat = summary.categories.find(c => c.categoryKey === 'moradia');
    const lazerCat = summary.categories.find(c => c.categoryKey === 'lazer');

    expect(moradiaCat?.pctOfFixedCeiling).toBe(90);
    expect(lazerCat?.pctOfFixedCeiling).toBe(2.5);

    // Add extra R$ 350 fixed bill
    state.coupleFixedBills.push({
      id: 'bill-extra',
      title: 'Seguro Residencial Extra',
      category: 'protecao',
      amount: 350,
      dueDay: 20,
      assignedPayer: 'both',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
      active: true,
    });

    const updatedSummary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-01');
    expect(updatedSummary.projectedCommittedR$).toBe(4050);
    expect(updatedSummary.hasExcess).toBe(true);
    expect(updatedSummary.excessR$).toBe(50);
  });

  it('Proof 2: Paying streaming moves R$ 100 from pending to realized; actual payment R$ 120 gives R$ 3.720 committed; unpaying reopens only target occurrence', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-aluguel',
        title: 'Aluguel Apto',
        category: 'moradia',
        amount: 3600,
        dueDay: 5,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
        active: true,
      },
      {
        id: 'bill-streaming',
        title: 'Streaming',
        category: 'lazer',
        amount: 100,
        dueDay: 15,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
        active: true,
      },
    ];

    // Pay streaming with exact amount R$ 100
    state.coupleFixedBills[1].history = {
      '2025-02': { status: 'paid', paidAt: '2025-02-15', paidAmount: 100, paidBy: 'both' }
    };
    state.coupleFixedBills[1].lastPaidMonth = '2025-02';

    let summary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-01');
    expect(summary.realizedLiquidR$).toBe(100);
    expect(summary.pendingR$).toBe(3600);
    expect(summary.projectedCommittedR$).toBe(3700);

    // Pay with actual amount R$ 120 (reajuste na fatura)
    state.coupleFixedBills[1].history['2025-02'].paidAmount = 120;
    summary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-01');
    expect(summary.realizedLiquidR$).toBe(120);
    expect(summary.projectedCommittedR$).toBe(3720);

    // Unpay streaming for 2025-02
    delete state.coupleFixedBills[1].history['2025-02'];
    state.coupleFixedBills[1].status = 'pending';
    summary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-01');
    expect(summary.realizedLiquidR$).toBe(0);
    expect(summary.pendingR$).toBe(3700);
  });

  it('Proof 3: Paying February in March does not settle March; short month clamps day 31 to last day of Feb', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-condominio',
        title: 'Condomínio',
        category: 'moradia',
        amount: 1200,
        dueDay: 31, // Day 31 clamped to Feb 28
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
        active: true,
        history: {
          '2025-02': { status: 'paid', paidAt: '2025-03-05', paidAmount: 1200, paidBy: 'both' }
        }
      }
    ];

    // February summary: Feb is paid
    const febOccs = selectFixedBillOccurrences(state, '2025-02', 'casal', '2025-02-01');
    expect(febOccs[0].dueDate).toBe('2025-02-28'); // Clamped day 31 to last day of Feb
    expect(febOccs[0].status).toBe('paid');
    expect(febOccs[0].paidAt).toBe('2025-03-05');

    // March summary: March occurrence remains pending! (Paying Feb in March did not settle March)
    const marOccs = selectFixedBillOccurrences(state, '2025-03', 'casal', '2025-03-01');
    expect(marOccs[0].status).toBe('pending');
  });

  it('Proof 3 (Cont.): Deactivated recurrence stops generating future occurrences while preserving past history', () => {
    const state = createBaseState('2025-03');
    state.coupleFixedBills = [
      {
        id: 'bill-academia-cancelada',
        title: 'Academia Antiga',
        category: 'lazer',
        amount: 150,
        dueDay: 10,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
        active: false, // Desativada após janeiro
        history: {
          '2025-01': { status: 'paid', paidAt: '2025-01-10', paidAmount: 150, paidBy: 'both' }
        }
      }
    ];

    // January has history -> preserved
    const janOccs = selectFixedBillOccurrences(state, '2025-01', 'casal');
    expect(janOccs).toHaveLength(1);
    expect(janOccs[0].status).toBe('paid');

    // March is after deactivation without history -> not generated!
    const marOccs = selectFixedBillOccurrences(state, '2025-03', 'casal');
    expect(marOccs).toHaveLength(0);
  });

  it('Proof 4: Variable Luz bill with due date is excluded from fixed numerator and assigned to variable group', () => {
    const state = createBaseState('2025-02');
    state.expenses = [
      {
        id: 'exp-luz-var',
        description: 'Conta de Luz Enel',
        amount: 250,
        date: '2025-02-12',
        category: 'moradia',
        paidBy: 'both',
        nature: 'variavel', // Variável!
        fundingSource: 'month_budget',
      }
    ];

    const summary = calculateFixedBillsSummary(state, '2025-02', 'casal');
    expect(summary.realizedLiquidR$).toBe(0); // Not in fixed numerator!
    expect(summary.allOccurrences.some(o => o.title.includes('Conta de Luz'))).toBe(false);
  });
});
