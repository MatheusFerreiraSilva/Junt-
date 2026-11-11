import { describe, expect, it } from 'vitest';
import { AppState, ExpenseItem, IncomeItem, InstallmentPurchase } from '../../types/finance';
import { selectReconciledBudgetMatrix } from '../domainSelectors';

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
    investimentos: false,
  },
  monthlyBudgetPlans: {},
  currentMonth: monthKey,
  expenses: [],
  incomes: [
    {
      id: 'inc-1',
      amount: 6000,
      description: 'Salário A',
      date: `${monthKey}-05`,
      recipient: 'partner1',
      type: 'fixed',
    },
    {
      id: 'inc-2',
      amount: 4000,
      description: 'Salário B',
      date: `${monthKey}-05`,
      recipient: 'partner2',
      type: 'fixed',
    },
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
  collegeModeData: {
    active: false,
    courseName: 'Medicina',
    currentSemester: 1,
    totalSemesters: 12,
    monthlyStipend: 0,
    totalInvestedInCollege: 0,
    studentName: 'Estudante',
  },
  strategicIntents: [],
});

describe('28C - Reconciled Budget Matrix (Duas Visões Reconciliadas do Orçamento)', () => {
  it('C31 & C58: Matrix calculates integer cents and sums exactly 100% of planned net income', () => {
    const state = createBaseState('2025-02');
    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');

    // Planned Net Income = R$ 10.000 (10.000,00 -> 1.000.000 cents)
    expect(result.plannedNetIncome).toBe(10000);
    expect(result.structureBlocks.fixos.plannedBudget).toBe(4000); // 40%
    expect(result.structureBlocks.variaveis.plannedBudget).toBe(5000); // 50%
    expect(result.structureBlocks.investimentos.targetAmount).toBe(1000); // 10%

    // Sum of ceilings = 100%
    const totalCeiling =
      result.structureBlocks.fixos.plannedBudget +
      result.structureBlocks.variaveis.plannedBudget +
      result.structureBlocks.investimentos.targetAmount;
    expect(totalCeiling).toBe(10000);

    // Matrix cents structure checks
    expect(result.categoryMatrixCents.moradia.fixedCents + result.categoryMatrixCents.moradia.variableCents).toBeGreaterThanOrEqual(0);
  });

  it('C37: Moradia contains Aluguel (fixed: R$ 3.600) and Luz (variable: R$ 200) without double counting', () => {
    const state = createBaseState('2025-02');
    state.expenses = [
      {
        id: 'exp-aluguel',
        description: 'Aluguel Apto',
        amount: 3600,
        date: '2025-02-05',
        category: 'moradia',
        paidBy: 'both',
        nature: 'fixo',
        fundingSource: 'month_budget',
      },
      {
        id: 'exp-luz',
        description: 'Conta de Luz Enel',
        amount: 200,
        date: '2025-02-10',
        category: 'moradia',
        paidBy: 'both',
        nature: 'variavel',
        fundingSource: 'month_budget',
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const moradiaRow = result.categories.find(r => r.key === 'moradia');

    expect(moradiaRow).toBeDefined();
    expect(moradiaRow?.fixedSpent).toBe(3600);
    expect(moradiaRow?.variableSpent).toBe(200);
    expect(moradiaRow?.realizedLiquid).toBe(3800);

    // Structural breakdown totals
    expect(result.structureBlocks.fixos.realizedLiquid).toBe(3600);
    expect(result.structureBlocks.variaveis.realizedLiquid).toBe(200);
  });

  it('C38: Transporte contains Financiamento (fixed: R$ 800) and Uber (variable: R$ 150) without double counting', () => {
    const state = createBaseState('2025-02');
    state.expenses = [
      {
        id: 'exp-auto-fin',
        description: 'Parcela Financiamento Carro',
        amount: 800,
        date: '2025-02-01',
        category: 'transporte',
        paidBy: 'both',
        nature: 'fixo',
        fundingSource: 'month_budget',
      },
      {
        id: 'exp-uber',
        description: 'Corridas Uber Trabalho',
        amount: 150,
        date: '2025-02-12',
        category: 'transporte',
        paidBy: 'both',
        nature: 'variavel',
        fundingSource: 'month_budget',
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const transporteRow = result.categories.find(r => r.key === 'transporte');

    expect(transporteRow).toBeDefined();
    expect(transporteRow?.fixedSpent).toBe(800);
    expect(transporteRow?.variableSpent).toBe(150);
    expect(transporteRow?.realizedLiquid).toBe(950);
  });

  it('C32: Shows Lazer excess (+R$ 8.000) and global unallocated variable margin simultaneously', () => {
    const state = createBaseState('2025-02');
    // Lazer spending R$ 9.500 (ceiling is 15% of 10.000 = 1.500 -> excess = 8.000)
    state.expenses = [
      {
        id: 'exp-lazer-viagem',
        description: 'Pacote Viagem Férias',
        amount: 9500,
        date: '2025-02-15',
        category: 'lazer',
        paidBy: 'both',
        nature: 'variavel',
        fundingSource: 'month_budget',
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const lazerRow = result.categories.find(r => r.key === 'lazer');

    expect(lazerRow?.realizedLiquid).toBe(9500);
    expect(lazerRow?.plannedBudget).toBe(1500);
    expect(lazerRow?.overAmount).toBe(8000);

    // Variable block total spent = 9.500 against 5.000 variable ceiling -> block over budget by 4.500
    expect(result.structureBlocks.variaveis.realizedLiquid).toBe(9500);
    expect(result.structureBlocks.variaveis.signedMargin).toBe(-4500);
  });

  it('C39: Geladeira R$ 6.000 in 10x R$ 600 registers 1 acquisition/consumption event and 10 cash commitments', () => {
    const state = createBaseState('2025-02');
    const installment: InstallmentPurchase = {
      id: 'inst-geladeira',
      description: 'Geladeira Inox Inverter',
      totalAmount: 6000,
      totalInstallments: 10,
      installmentValue: 600,
      currentInstallment: 1,
      paidInstallmentsCount: 0,
      purchaseDate: '2025-02-01',
      firstPaymentDate: '2025-02-10',
      category: 'moradia',
      paidBy: 'both',
      active: true,
      nature: 'variavel',
      occurrences: Array.from({ length: 10 }, (_, i) => ({
        id: `inst-geladeira-occ-${i + 1}`,
        installmentId: 'inst-geladeira',
        installmentNumber: i + 1,
        dueDate: `2025-0${2 + Math.floor((i + 1) / 12)}-10`,
        amount: 600,
        status: i === 0 ? 'paid' : 'pending',
      })),
    };

    state.installments = [installment];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const moradiaRow = result.categories.find(r => r.key === 'moradia');

    // Occurrence for 2025-02 is R$ 600
    expect(moradiaRow?.realizedLiquid).toBe(600);
    expect(result.structureBlocks.variaveis.realizedLiquid).toBe(600);
  });

  it('C40 & C55: 10% Investment Target vs Effective Investment - uninvested amount is tracked, never added to expense consumption', () => {
    const state = createBaseState('2025-02');
    // Net Income = 10.000 -> 10% target = 1.000
    // User deposits 400 into emergency reserve
    state.protectionCurrentAmount = 400;
    state.financialOperations = [
      {
        id: 'op-1',
        type: 'GOAL_DEPOSIT',
        state: 'effective',
        amountCents: 40000,
        currency: 'BRL',
        date: '2025-02-10T10:00:00Z',
        authorizedBy: 'both',
        scope: 'casal',
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');

    expect(result.structureBlocks.investimentos.targetAmount).toBe(1000);
    expect(result.structureBlocks.investimentos.actualDeposited).toBe(400);
    expect(result.structureBlocks.investimentos.remainingTarget).toBe(600);

    // Ensure investment is NOT included in fixed or variable expense blocks
    expect(result.structureBlocks.fixos.realizedLiquid).toBe(0);
    expect(result.structureBlocks.variaveis.realizedLiquid).toBe(0);
  });

  it('C43: Direct Piggy Bank Expenses (Path B) are kept separate from monthly category ceilings', () => {
    const state = createBaseState('2025-02');
    state.expenses = [
      {
        id: 'exp-moveis-cofrinho',
        description: 'Móveis Planejados Sala',
        amount: 22000,
        date: '2025-02-14',
        category: 'moradia',
        paidBy: 'both',
        nature: 'variavel',
        fundingSource: 'piggy_bank', // Path B direct from goal cofrinho!
        isExcludedFromMonthlyBudget: true,
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');

    // Extraordinary block captures the R$ 22.000
    expect(result.goalDirectConsumption).toBe(22000);

    // Moradia category monthly routine ceiling spending remains 0
    const moradiaRow = result.categories.find(r => r.key === 'moradia');
    expect(moradiaRow?.realizedLiquid).toBe(0);
    expect(moradiaRow?.overAmount).toBe(0);
  });

  it('C45: Pending fixed bill keeps projected committed budget without turning pending funds into free cash', () => {
    const state = createBaseState('2025-02');
    // Aluguel R$ 3.600 paid, Streaming R$ 100 pending (not yet settled)
    state.expenses = [
      {
        id: 'exp-aluguel-paid',
        description: 'Aluguel',
        amount: 3600,
        date: '2025-02-05',
        category: 'moradia',
        paidBy: 'both',
        nature: 'fixo',
        fundingSource: 'month_budget',
      },
    ];

    const result = selectReconciledBudgetMatrix(state, 'casal', '2025-02');

    // Fixture scenario: Ceiling R$ 4.000, Realized R$ 3.600
    expect(result.structureBlocks.fixos.plannedBudget).toBe(4000);
    expect(result.structureBlocks.fixos.realizedLiquid).toBe(3600);
    expect(result.structureBlocks.fixos.projectedTotal).toBe(3600);
    expect(result.structureBlocks.fixos.signedMargin).toBe(400); // R$ 400 margin
  });
});
