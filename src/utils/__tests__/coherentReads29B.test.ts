import { describe, expect, it } from 'vitest';
import { AppState, BudgetPlanContract, ExpenseItem, FixedBillAlert } from '../../types/finance';
import {
  apportionCentsByScope,
  selectCanonicalFixedBillsRegistry,
} from '../occurrenceProjection';
import {
  selectReconciledBudgetMatrix,
  selectSplitsCategorySpending,
  selectTotalCashDisbursements,
  executeExpenseDeleteCommand,
} from '../domainSelectors';
import { calculateFixedBillsSummary, selectFixedBillOccurrences } from '../fixedBillEngine';
import { calculateCalendarEngine } from '../calendarEngine';
import { calculateThermometerEngine } from '../thermometerEngine';

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
  coupleFixedBills: [],
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

const makeZeroFixedPlan = (competence: string): BudgetPlanContract => ({
  competence,
  plannedNetIncome: 10000,
  version: '2.0',
  macroGroups: {
    fixos: { percentage: 0, amountR$: 0 },
    variaveis: { percentage: 80, amountR$: 8000 },
    investimentos: { percentage: 20, amountR$: 2000 },
  },
  categoryPercentages: {
    moradia: 0,
    transporte: 20,
    comida: 30,
    lazer: 20,
    protecao: 0,
    profissional: 10,
    investimentos: 20,
  },
  categoryAmountsR$: {
    moradia: 0,
    transporte: 2000,
    comida: 3000,
    lazer: 2000,
    protecao: 0,
    profissional: 1000,
    investimentos: 2000,
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
    profissional: 10,
    investimentos: 20,
  },
  status: 'feasible',
  explanation: 'Plano com teto fixo zero explícito',
  conflicts: [],
});

describe('29B — Leituras coerentes de compras, Fixos e competências (R29-10 a R29-18)', () => {
  it('R29-10: Conta fixa de fevereiro paga em 05/03 quita apenas fevereiro (competência) e registra saída de caixa em março sem baixar março', () => {
    const state = createBaseState('2025-03');
    const rentBill: FixedBillAlert = {
      id: 'bill-condo',
      title: 'Condomínio',
      category: 'moradia',
      amount: 1200,
      amountCents: 120000,
      dueDay: 10,
      assignedPayer: 'both',
      autoPay: false,
      status: 'paid',
      lastPaidMonth: '2025-02',
      isRecurring: true,
      active: true,
      history: {
        '2025-02': {
          status: 'paid',
          paidAt: '2025-03-05',
          paidAmount: 1200,
          paidBy: 'both',
          paymentMethod: 'pix',
          linkedExpenseId: 'exp-condo-feb',
        },
      },
    };
    state.coupleFixedBills = [rentBill];
    state.expenses = [
      {
        id: 'exp-condo-feb',
        linkedBillId: 'bill-condo',
        billCompetenceMonth: '2025-02',
        description: '[Conta Fixa] Condomínio Fev',
        amount: 1200,
        amountCents: 120000,
        category: 'moradia',
        nature: 'fixa',
        classificationOrigin: 'origin_link',
        date: '2025-03-05', // pago em março!
        paidBy: 'both',
        paymentMethod: 'pix',
        fundingSource: 'month_budget',
      },
    ];

    // 1. Fevereiro (2025-02): ocorrência baixada, consumo realizado R$ 1.200, caixa R$ 0
    const febPanel = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-03-06');
    const febMatrix = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const febCalendar = calculateCalendarEngine(state, '2025-02', 'couple', {
      todayDateStr: '2025-03-06',
    });
    const febCash = selectTotalCashDisbursements(state, 'casal', '2025-02');

    expect(febPanel.realizedLiquidR$).toBe(1200);
    expect(febPanel.pendingR$).toBe(0);
    expect(febMatrix.structureBlocks.fixos.realizedLiquid).toBe(1200);
    expect(febMatrix.structureBlocks.fixos.pendingCommitments).toBe(0);
    expect(febCalendar.allMonthObligations.find((o) => o.sourceId === 'bill-condo')?.status).toBe(
      'pago'
    );
    expect(febCash).toBe(0);

    // 2. Março (2025-03): ocorrência permanece PENDENTE, consumo realizado R$ 0, desembolso de caixa R$ 1.200
    const marPanel = calculateFixedBillsSummary(state, '2025-03', 'casal', '2025-03-06');
    const marMatrix = selectReconciledBudgetMatrix(state, 'casal', '2025-03');
    const marCalendar = calculateCalendarEngine(state, '2025-03', 'couple', {
      todayDateStr: '2025-03-06',
    });
    const marThermo = calculateThermometerEngine(state, 'couple', {
      todayDateStr: '2025-03-06',
    });
    const marCash = selectTotalCashDisbursements(state, 'casal', '2025-03');

    expect(marPanel.realizedLiquidR$).toBe(0);
    expect(marPanel.pendingR$).toBe(1200);
    expect(marPanel.allOccurrences[0].status).toBe('pending');
    expect(marMatrix.structureBlocks.fixos.realizedLiquid).toBe(0);
    expect(marMatrix.structureBlocks.fixos.pendingCommitments).toBe(1200);
    expect(marCalendar.allMonthObligations.find((o) => o.sourceId === 'bill-condo')?.status).toBe(
      'previsto'
    );
    expect(marCalendar.monthTotals.expense).toBe(1200); // lançamento civil do dia 05/03 no grid de caixa
    expect(marThermo.spentSoFar).toBe(0); // não consome competência de março!
    expect(marThermo.pendingCommitmentsAmount).toBe(1200); // março segue pendente!
    expect(marCash).toBe(1200);

    // 3. Fallback legado: sem billCompetenceMonth explícita, usa prefixo da data civil
    const legacyState = createBaseState('2025-03');
    legacyState.coupleFixedBills = [
      { ...rentBill, id: 'bill-legacy', status: 'pending', lastPaidMonth: undefined, history: {} },
    ];
    legacyState.expenses = [
      {
        id: 'exp-legacy-mar',
        linkedBillId: 'bill-legacy',
        description: 'Condomínio Legado',
        amount: 1200,
        category: 'moradia',
        date: '2025-03-09',
        paidBy: 'both',
      },
    ];
    expect(selectFixedBillOccurrences(legacyState, '2025-03', 'casal')[0].status).toBe('paid');
  });

  it('R29-11: Reconcilia coupleFixedBills e fixedBillAlerts sem ignorar array vazio, deduplica por ID e sinaliza conflito substantivo', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = []; // array vazio anteriormente escondia fixedBillAlerts via `||`!
    state.fixedBillAlerts = [
      {
        id: 'bill-internet',
        title: 'Fibra Óptica',
        category: 'moradia',
        amount: 150,
        dueDay: 12,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
      },
    ];

    const panelEmptyPrimary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-05');
    const matrixEmptyPrimary = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const calendarEmptyPrimary = calculateCalendarEngine(state, '2025-02', 'couple', {
      todayDateStr: '2025-02-05',
    });
    const thermoEmptyPrimary = calculateThermometerEngine(state, 'couple', {
      todayDateStr: '2025-02-05',
    });

    expect(panelEmptyPrimary.pendingR$).toBe(150);
    expect(matrixEmptyPrimary.structureBlocks.fixos.pendingCommitments).toBe(150);
    expect(calendarEmptyPrimary.allMonthObligations).toHaveLength(1);
    expect(thermoEmptyPrimary.pendingCommitmentsAmount).toBe(150);

    // Agora com ambos preenchidos: um ID compartilhado com conflito de valor e um ID exclusivo de cada lista
    state.coupleFixedBills = [
      {
        id: 'bill-internet',
        title: 'Fibra Óptica',
        category: 'moradia',
        amount: 180, // diverge dos R$ 150 do legado!
        dueDay: 12,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
      },
      {
        id: 'bill-seguro',
        title: 'Seguro Vida',
        category: 'protecao',
        amount: 220,
        dueDay: 20,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];
    state.fixedBillAlerts.push({
      id: 'bill-crm',
      title: 'Anuidade CRM',
      category: 'profissional',
      amount: 100,
      dueDay: 25,
      assignedPayer: 'partner1',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
    });

    const reg = selectCanonicalFixedBillsRegistry(state);
    expect(reg.bills.map((b) => b.id).sort()).toEqual([
      'bill-crm',
      'bill-internet',
      'bill-seguro',
    ]);
    expect(reg.conflicts).toHaveLength(1);
    expect(reg.conflicts[0].billId).toBe('bill-internet');

    const panelMerged = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-05');
    const matrixMerged = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    expect(panelMerged.pendingR$).toBe(500); // 180 + 220 + 100 sem duplicar bill-internet
    expect(matrixMerged.structureBlocks.fixos.pendingCommitments).toBe(500);
    expect(panelMerged.registryConflicts).toHaveLength(1);
    expect(matrixMerged.registryConflicts).toHaveLength(1);
  });

  it('R29-12: Compra única de supermercado de R$ 800 com splits aloca centavos exatos por fatia em todos os leitores', () => {
    const state = createBaseState('2025-02');
    const splitPurchase: ExpenseItem = {
      id: 'exp-super-800',
      description: 'Compra Supermercado Completa',
      amount: 800,
      amountCents: 80000,
      category: 'comida',
      date: '2025-02-14',
      paidBy: 'both',
      paymentMethod: 'debit',
      fundingSource: 'month_budget',
      splits: [
        {
          id: 'sp-comida',
          category: 'comida',
          subcategory: 'Alimentação',
          amount: 520,
          amountCents: 52000,
          nature: 'variavel',
          priority: 'essencial',
          classificationOrigin: 'manual_confirmed',
        },
        {
          id: 'sp-limpeza-fixa',
          category: 'limpeza' as any,
          subcategory: 'Contrato Mensal Água/Insumos',
          amount: 180,
          amountCents: 18000,
          nature: 'fixa',
          priority: 'essencial',
          classificationOrigin: 'manual_confirmed',
        },
        {
          id: 'sp-lazer',
          category: 'lazer',
          subcategory: 'Vinhos & Petiscos',
          amount: 100,
          amountCents: 10000,
          nature: 'variavel',
          priority: 'dispensavel',
          classificationOrigin: 'manual_confirmed',
        },
      ],
    };
    state.expenses = [splitPurchase];

    const rawSplitSpending = selectSplitsCategorySpending(state, 'casal', '2025-02');
    expect(rawSplitSpending['comida']).toBe(520);
    expect((rawSplitSpending as any)['limpeza']).toBe(180);
    expect(rawSplitSpending['lazer']).toBe(100);

    const matrix = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    const comidaRow = matrix.categories.find((c) => c.key === 'comida')!;
    const moradiaRow = matrix.categories.find((c) => c.key === 'moradia')!;
    const lazerRow = matrix.categories.find((c) => c.key === 'lazer')!;

    expect(comidaRow.realizedLiquid).toBe(520);
    expect(comidaRow.variableSpent).toBe(520);
    expect(moradiaRow.realizedLiquid).toBe(180); // 'limpeza' reconciliada em moradia
    expect(moradiaRow.fixedSpent).toBe(180);
    expect(lazerRow.realizedLiquid).toBe(100);
    expect(lazerRow.variableSpent).toBe(100);
    expect(matrix.totalRealizedLiquid).toBe(800);
    expect(matrix.totalProjectedConsumption).toBe(800);

    // Painel de Fixos enxerga APENAS a fatia fixa de R$ 180 (nunca os R$ 800 do pai!)
    const fixedSummary = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-15');
    expect(fixedSummary.realizedLiquidR$).toBe(180);
    expect(fixedSummary.allOccurrences).toHaveLength(1);
    expect(fixedSummary.allOccurrences[0].amountEffective).toBe(180);

    // Termômetro enxerga exatamente R$ 800 realizados
    const thermo = calculateThermometerEngine(state, 'couple', { todayDateStr: '2025-02-15' });
    expect(thermo.spentSoFar).toBe(800);
  });

  it('R29-13: Separa categoria, natureza, prioridade e recorrência (Moradia fixa+variável essencial; Lazer fixo opcional; detectedSubscriptions fora de Fixos)', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-aluguel',
        title: 'Aluguel',
        category: 'moradia',
        amount: 2500,
        dueDay: 5,
        assignedPayer: 'both',
        autoPay: false,
        status: 'paid',
        isRecurring: true,
        priority: 'essencial',
        nature: 'fixa',
        history: {
          '2025-02': { status: 'paid', paidAt: '2025-02-05', paidAmount: 2500 },
        },
      },
      {
        id: 'bill-streaming',
        title: 'Streaming 4K',
        category: 'lazer',
        amount: 55.9,
        dueDay: 15,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
        priority: 'dispensavel',
        nature: 'fixa',
      },
      {
        id: 'bill-terapia-casal',
        title: 'Mentoria Essencial em Lazer',
        category: 'lazer',
        amount: 144.1,
        dueDay: 18,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
        priority: 'essencial', // prioridade explícita essencial mesmo em categoria lazer!
        nature: 'fixa',
      },
    ];
    state.expenses = [
      {
        id: 'exp-aluguel-feb',
        linkedBillId: 'bill-aluguel',
        billCompetenceMonth: '2025-02',
        description: 'Aluguel',
        amount: 2500,
        category: 'moradia',
        nature: 'fixa',
        priority: 'essencial',
        classificationOrigin: 'origin_link',
        date: '2025-02-05',
        paidBy: 'both',
      },
      {
        id: 'exp-luz-variavel',
        description: 'Conta de Luz Variável',
        amount: 240,
        category: 'moradia',
        nature: 'variavel',
        priority: 'essencial',
        classificationOrigin: 'manual_confirmed',
        date: '2025-02-12',
        paidBy: 'both',
      },
    ];
    // Assinatura apenas detectada automaticamente não pode virar conta fixa sem confirmação
    state.detectedSubscriptions = [
      {
        id: 'sub-unconfirmed',
        merchant: 'App Desconhecido',
        amount: 39.9,
        frequency: 'mensal',
        category: 'lazer',
        lastDate: '2025-01-20',
        dueDay: 20,
        status: 'active',
        payer: 'both',
      },
    ];

    const panel = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-10');
    const matrix = selectReconciledBudgetMatrix(state, 'casal', '2025-02');

    // Fixos: 2500 realizados + (55.90 + 144.10 = 200) pendentes = 2700 (sem sub-unconfirmed de 39.90!)
    expect(panel.realizedLiquidR$).toBe(2500);
    expect(panel.pendingR$).toBe(200);
    expect(panel.projectedCommittedR$).toBe(2700);
    expect(matrix.structureBlocks.fixos.projectedTotal).toBe(2700);

    // Moradia na matriz tem 2500 fixo + 240 variável = 2740
    const moradiaRow = matrix.categories.find((c) => c.key === 'moradia')!;
    expect(moradiaRow.fixedSpent).toBe(2500);
    expect(moradiaRow.variableSpent).toBe(240);
    expect(moradiaRow.realizedLiquid).toBe(2740);

    // Prioridade respeitada por item (não engessada pela categoria lazer)
    const streamingOcc = panel.allOccurrences.find((o) => o.billId === 'bill-streaming')!;
    const terapiaOcc = panel.allOccurrences.find((o) => o.billId === 'bill-terapia-casal')!;
    expect(streamingOcc.isEssential).toBe(false);
    expect(terapiaOcc.isEssential).toBe(true);
  });

  it('R29-14: Natureza desconhecida/pendente não é tratada silenciosamente como variável e preserva o total consumido', () => {
    const state = createBaseState('2025-02');
    state.expenses = [
      {
        id: 'exp-confirmed-var',
        description: 'Restaurante Confirmado',
        amount: 150,
        category: 'comida',
        nature: 'variavel',
        classificationOrigin: 'manual_confirmed',
        date: '2025-02-08',
        paidBy: 'both',
      },
      {
        id: 'exp-unknown-raw',
        description: 'Compra Importada Sem Natureza',
        amount: 210,
        category: 'comida',
        // sem nature, sem linkedBillId, sem installmentId, sem regra autorizada!
        date: '2025-02-09',
        paidBy: 'both',
      },
      {
        id: 'exp-invalid-nature',
        description: 'Natureza Estranha',
        amount: 90,
        category: 'lazer',
        nature: 'misteriosa' as any,
        date: '2025-02-10',
        paidBy: 'both',
      },
    ];

    const matrix = selectReconciledBudgetMatrix(state, 'casal', '2025-02');
    expect(matrix.structureBlocks.variaveis.realizedLiquid).toBe(150);
    expect(matrix.structureBlocks.fixos.realizedLiquid).toBe(0);
    expect(matrix.unclassifiedSpent).toBe(300); // 210 + 90
    expect(matrix.unclassifiedCents).toBe(30000);
    expect(matrix.pendingClassificationCount).toBe(2);
    expect(matrix.totalRealizedLiquid).toBe(450); // 150 + 300 preservado integralmente!
    expect(matrix.totalProjectedConsumption).toBe(450);

    const comidaRow = matrix.categories.find((c) => c.key === 'comida')!;
    expect(comidaRow.variableSpent).toBe(150);
    expect(comidaRow.unclassifiedSpent).toBe(210);
    expect(comidaRow.realizedLiquid).toBe(360);
  });

  it('R29-15: Distingue teto zero explícito de ausência de teto e não inventa teto individual de 50%', () => {
    // Caso 1: Sem plano, sem renda declarada, sem customização -> teto ausente
    const absentState = createBaseState('2025-02');
    absentState.profile.partner1Income = 0;
    absentState.profile.partner2Income = 0;
    absentState.incomes = [];
    absentState.coupleFixedBills = [
      {
        id: 'b-1',
        title: 'Taxa Conta',
        category: 'moradia',
        amount: 50,
        dueDay: 10,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];

    const absentMatrix = selectReconciledBudgetMatrix(absentState, 'casal', '2025-02');
    const absentPanel = calculateFixedBillsSummary(absentState, '2025-02', 'casal', '2025-02-05');
    expect(absentMatrix.hasExplicitCeiling).toBe(false);
    expect(absentMatrix.ceilingState).toBe('absent');
    expect(absentPanel.hasExplicitCeiling).toBe(false);
    expect(absentPanel.ceilingState).toBe('absent');
    expect(absentPanel.hasExcess).toBe(false);

    // Caso 2: Plano aprovado com teto de fixos explicitamente ZERO -> hasExplicitCeiling = true, ceilingState = 'explicit_zero'
    const zeroCeilingState = createBaseState('2025-02');
    zeroCeilingState.monthlyBudgetPlans = {
      '2025-02': makeZeroFixedPlan('2025-02'),
    };
    zeroCeilingState.coupleFixedBills = absentState.coupleFixedBills;

    const zeroMatrix = selectReconciledBudgetMatrix(zeroCeilingState, 'casal', '2025-02');
    const zeroPanel = calculateFixedBillsSummary(zeroCeilingState, '2025-02', 'casal', '2025-02-05');
    expect(zeroMatrix.structureBlocks.fixos.hasExplicitCeiling).toBe(true);
    expect(zeroMatrix.structureBlocks.fixos.ceilingState).toBe('explicit_zero');
    expect(zeroPanel.hasExplicitCeiling).toBe(true);
    expect(zeroPanel.ceilingState).toBe('explicit_zero');
    expect(zeroPanel.fixedCeilingR$).toBe(0);
    expect(zeroPanel.hasExcess).toBe(true);
    expect(zeroPanel.excessR$).toBe(50);

    // Caso 3: Escopo individual partner1 sem partnerCeilings aprovado -> não inventa 50% do teto do casal
    const p1MatrixNoIndividualPlan = selectReconciledBudgetMatrix(
      zeroCeilingState,
      'partner1',
      '2025-02'
    );
    expect(p1MatrixNoIndividualPlan.hasExplicitCeiling).toBe(false);
    expect(p1MatrixNoIndividualPlan.ceilingState).toBe('absent');
    expect(p1MatrixNoIndividualPlan.structureBlocks.variaveis.plannedBudget).toBe(0);
  });

  it('R29-16: Rateio de valor ímpar R$ 100,01 (10001 centavos) fecha exatamente 50,01 + 50,00 = 100,01 em todos os motores', () => {
    const split = apportionCentsByScope(10001, 'couple', 'both', 50, 50);
    expect(split.partner1Cents).toBe(5001);
    expect(split.partner2Cents).toBe(5000);
    expect(split.partner1Cents + split.partner2Cents).toBe(10001);

    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-odd',
        title: 'Taxa Condominial Ímpar',
        category: 'moradia',
        amount: 100.01,
        amountCents: 10001,
        dueDay: 15,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];
    state.expenses = [
      {
        id: 'exp-odd',
        description: 'Padaria Ímpar',
        amount: 100.01,
        amountCents: 10001,
        category: 'comida',
        nature: 'variavel',
        classificationOrigin: 'manual_confirmed',
        date: '2025-02-10',
        paidBy: 'both',
      },
    ];

    const p1Panel = calculateFixedBillsSummary(state, '2025-02', 'partner1', '2025-02-10');
    const p2Panel = calculateFixedBillsSummary(state, '2025-02', 'partner2', '2025-02-10');
    const couplePanel = calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-10');
    expect(p1Panel.pendingR$).toBe(50.01);
    expect(p2Panel.pendingR$).toBe(50.0);
    expect(Number((p1Panel.pendingR$ + p2Panel.pendingR$).toFixed(2))).toBe(couplePanel.pendingR$);

    const p1Matrix = selectReconciledBudgetMatrix(state, 'partner1', '2025-02');
    const p2Matrix = selectReconciledBudgetMatrix(state, 'partner2', '2025-02');
    expect(p1Matrix.structureBlocks.variaveis.realizedLiquid).toBe(50.01);
    expect(p2Matrix.structureBlocks.variaveis.realizedLiquid).toBe(50.0);

    const p1Cal = calculateCalendarEngine(state, '2025-02', 'partner1', {
      todayDateStr: '2025-02-10',
    });
    const p2Cal = calculateCalendarEngine(state, '2025-02', 'partner2', {
      todayDateStr: '2025-02-10',
    });
    expect(p1Cal.monthTotals.expense).toBe(50.01);
    expect(p2Cal.monthTotals.expense).toBe(50.0);
    expect(p1Cal.monthTotals.commitmentsPending).toBe(50.01);
    expect(p2Cal.monthTotals.commitmentsPending).toBe(50.0);

    const thermo = calculateThermometerEngine(state, 'couple', { todayDateStr: '2025-02-10' });
    expect(thermo.partner1Spent).toBe(50.01);
    expect(thermo.partner2Spent).toBe(50.0);
    expect(Number((thermo.partner1Spent + thermo.partner2Spent).toFixed(2))).toBe(100.01);
  });

  it('R29-17: Exclusão de despesa vinculada (executeExpenseDeleteCommand) reabre ocorrência em Painel, Matriz, Calendário e Termômetro', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-energia',
        title: 'Energia Fixa',
        category: 'moradia',
        amount: 320,
        amountCents: 32000,
        dueDay: 18,
        assignedPayer: 'both',
        autoPay: false,
        status: 'paid',
        isRecurring: true,
        lastPaidMonth: '2025-02',
        history: {
          '2025-02': {
            status: 'paid',
            paidAt: '2025-02-18',
            paidAmount: 320,
            linkedExpenseId: 'exp-fb-bill-energia-2025-02',
          },
        },
      },
    ];
    state.fixedBillAlerts = [...state.coupleFixedBills];
    state.expenses = [
      {
        id: 'exp-fb-bill-energia-2025-02',
        linkedBillId: 'bill-energia',
        billCompetenceMonth: '2025-02',
        description: '[Conta Fixa] Energia Fixa',
        amount: 320,
        amountCents: 32000,
        category: 'moradia',
        nature: 'fixa',
        classificationOrigin: 'origin_link',
        date: '2025-02-18',
        paidBy: 'both',
      },
    ];

    expect(calculateFixedBillsSummary(state, '2025-02', 'casal', '2025-02-10').realizedLiquidR$).toBe(320);

    const delRes = executeExpenseDeleteCommand(state, 'exp-fb-bill-energia-2025-02');
    expect(delRes.status).toBe('success');

    const nextState = delRes.state;
    const panel = calculateFixedBillsSummary(nextState, '2025-02', 'casal', '2025-02-10');
    const matrix = selectReconciledBudgetMatrix(nextState, 'casal', '2025-02');
    const cal = calculateCalendarEngine(nextState, '2025-02', 'couple', {
      todayDateStr: '2025-02-10',
    });
    const thermo = calculateThermometerEngine(nextState, 'couple', {
      todayDateStr: '2025-02-10',
    });

    expect(panel.realizedLiquidR$).toBe(0);
    expect(panel.pendingR$).toBe(320);
    expect(matrix.structureBlocks.fixos.realizedLiquid).toBe(0);
    expect(matrix.structureBlocks.fixos.pendingCommitments).toBe(320);
    expect(cal.allMonthObligations.find((o) => o.sourceId === 'bill-energia')?.status).toBe(
      'previsto'
    );
    expect(thermo.spentSoFar).toBe(0);
    expect(thermo.pendingCommitmentsAmount).toBe(320);
  });

  it('R29-18: Vencimento dia 31 ajusta para 28/29 em fevereiro e recorrência encerrada preserva passado sem gerar futuro', () => {
    const state = createBaseState('2025-02');
    state.coupleFixedBills = [
      {
        id: 'bill-clube',
        title: 'Clube Esportivo',
        category: 'lazer',
        amount: 400,
        dueDay: 31,
        assignedPayer: 'both',
        autoPay: false,
        status: 'paid',
        isRecurring: true,
        lastPaidMonth: '2024-02',
        active: false, // encerrada para o futuro!
        validFrom: '2024-01',
        validTo: '2024-12',
        history: {
          '2024-02': {
            status: 'paid',
            paidAt: '2024-02-29',
            paidAmount: 400,
          },
        },
      },
      {
        id: 'bill-ativa-31',
        title: 'Plano Saúde Dia 31',
        category: 'protecao',
        amount: 900,
        dueDay: 31,
        assignedPayer: 'both',
        autoPay: true,
        status: 'pending',
        isRecurring: true,
        active: true,
        validFrom: '2024-01',
        validTo: '2025-06',
      },
    ];

    // Fevereiro bissexto 2024: ambas aparecem com vencimento 2024-02-29
    const feb2024Occs = selectFixedBillOccurrences(state, '2024-02', 'casal', '2024-02-10');
    expect(feb2024Occs).toHaveLength(2);
    expect(feb2024Occs.find((o) => o.billId === 'bill-clube')?.dueDate).toBe('2024-02-29');
    expect(feb2024Occs.find((o) => o.billId === 'bill-clube')?.status).toBe('paid');
    expect(feb2024Occs.find((o) => o.billId === 'bill-ativa-31')?.dueDate).toBe('2024-02-29');

    // Fevereiro não-bissexto 2025: bill-clube não gera ocorrência; bill-ativa-31 ajusta para 2025-02-28
    const feb2025Occs = selectFixedBillOccurrences(state, '2025-02', 'casal', '2025-02-10');
    expect(feb2025Occs).toHaveLength(1);
    expect(feb2025Occs[0].billId).toBe('bill-ativa-31');
    expect(feb2025Occs[0].dueDate).toBe('2025-02-28');

    // Julho 2025 (após validTo 2025-06): nenhuma ocorrência futura gerada
    const jul2025Occs = selectFixedBillOccurrences(state, '2025-07', 'casal', '2025-07-01');
    expect(jul2025Occs).toHaveLength(0);
  });
});
