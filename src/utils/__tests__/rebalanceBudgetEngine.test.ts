import { describe, it, expect } from 'vitest';
import {
  rebalanceBudget,
  RebalanceParams,
  computeCompetenceBudgetSnapshot,
  proposeCustomInvestmentRatio,
  buildBudgetApplicationCommand,
} from '../rebalanceBudgetEngine';
import { AppState, BudgetPlanContract } from '../../types/finance';

const createTestAppState = (monthKey = '2026-10'): AppState => ({
  profile: {
    partner1Name: 'Ana',
    partner1Specialty: 'Clínica Médica',
    partner2Name: 'Bruno',
    partner2Specialty: 'Ortopedia',
    city: 'São Paulo - SP',
    partner1Income: 20000,
    partner2Income: 16000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 2,
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
  strategicIntents: [],
  financialOperations: [],
});

describe('rebalanceBudgetEngine', () => {
  it('Example H.1 & H.2: Preset Voo Alto with locked 10% investments redistributes remaining 90% proportionally', () => {
    const params: RebalanceParams = {
      plannedNetIncome: 10000,
      currentPercentages: {
        moradia: 22,
        transporte: 10,
        comida: 11,
        lazer: 15,
        protecao: 7,
        profissional: 5,
        investimentos: 10, // Locked at 10%
      },
      locks: {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: true, // Locked
      },
      referencePreset: {
        moradia: 22,
        transporte: 10,
        comida: 11,
        lazer: 15,
        protecao: 7,
        profissional: 5,
        investimentos: 30,
      },
    };

    const res = rebalanceBudget(params);

    expect(res.status).toBe('feasible');
    expect(res.proposedPercentages.investimentos).toBe(10);
    expect(res.proposedPercentages.moradia).toBe(28.29);
    expect(res.proposedPercentages.transporte).toBe(12.86);
    expect(res.proposedPercentages.comida).toBe(14.14);
    expect(res.proposedPercentages.lazer).toBe(19.28);
    expect(res.proposedPercentages.protecao).toBe(9);
    expect(res.proposedPercentages.profissional).toBe(6.43);

    // Sum of all 7 destinations equals exactly 100.00%
    const sumPcts = Object.values(res.proposedPercentages).reduce((s, p) => s + p, 0);
    expect(Number(sumPcts.toFixed(2))).toBe(100);

    // Sum of all 7 amounts equals exactly R$ 10,000.00
    const sumR$ = Object.values(res.proposedAmountsR$).reduce((s, a) => s + a, 0);
    expect(Number(sumR$.toFixed(2))).toBe(10000);
  });

  it('Example H.3: Income 10,000 with investments 10% and moradia 30% locked', () => {
    const params: RebalanceParams = {
      plannedNetIncome: 10000,
      currentPercentages: {
        moradia: 30,
        transporte: 10,
        comida: 11,
        lazer: 15,
        protecao: 7,
        profissional: 5,
        investimentos: 10,
      },
      locks: {
        moradia: true,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: true,
      },
    };

    const res = rebalanceBudget(params);

    expect(res.status).toBe('feasible');
    expect(res.proposedPercentages.investimentos).toBe(10);
    expect(res.proposedPercentages.moradia).toBe(30);

    // Sum of all percentages = 100.00%
    const sumPcts = Object.values(res.proposedPercentages).reduce((s, p) => s + p, 0);
    expect(Number(sumPcts.toFixed(2))).toBe(100);
  });

  it('Example H.4: Income 10,000, locked investments 10% (R$1,000) and hard minimums of R$9,500 returns infeasible with deficit', () => {
    const params: RebalanceParams = {
      plannedNetIncome: 10000,
      currentPercentages: {
        moradia: 30,
        transporte: 10,
        comida: 20,
        lazer: 10,
        protecao: 10,
        profissional: 10,
        investimentos: 10,
      },
      locks: {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: true,
      },
      commitmentsR$: {
        moradia: 3500,
        transporte: 1500,
        comida: 2000,
        lazer: 1000,
        protecao: 1000,
        profissional: 500,
        investimentos: 0,
      },
    };

    const res = rebalanceBudget(params);

    expect(res.status).toBe('infeasible');
    expect(res.deficitR$).toBe(500); // 1,000 + 9,500 = 10,500 -> Deficit R$ 500
    expect(res.conflicts.length).toBeGreaterThan(0);
    expect(res.explanation).toContain('inviável');
  });

  it('Example H.5: Registered consumption + commitments of R$2,500 is recognized as hard minimum need', () => {
    const params: RebalanceParams = {
      plannedNetIncome: 10000,
      currentPercentages: {
        moradia: 20,
        transporte: 10,
        comida: 15,
        lazer: 15,
        protecao: 10,
        profissional: 10,
        investimentos: 20,
      },
      locks: {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: false,
      },
      commitmentsR$: {
        comida: 2500, // 25% of 10000
        moradia: 0,
        transporte: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
    };

    const res = rebalanceBudget(params);

    expect(res.status).toBe('feasible');
    expect(res.proposedAmountsR$.comida).toBeGreaterThanOrEqual(2500);
    expect(res.proposedPercentages.comida).toBeGreaterThanOrEqual(25);
  });

  it('handles zero income and extreme percentage inputs safely', () => {
    const params: RebalanceParams = {
      plannedNetIncome: 0,
      currentPercentages: {
        moradia: 20,
        transporte: 10,
        comida: 15,
        lazer: 15,
        protecao: 10,
        profissional: 10,
        investimentos: 20,
      },
      locks: {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: false,
      },
    };

    const res = rebalanceBudget(params);

    expect(res.status).toBe('infeasible');
    expect(res.explanation).toContain('renda');
  });

  describe('25C — Grupos, matriz categoria × grupo, centavos, realizado vs pendentes e vigência', () => {
    it('reproduces and fixes floor-after-quota > 100% bug: guarantees exact 100.00% sum even when hardMinBp raises one unlocked bucket above quota', () => {
      // Scenario where moradia has huge weight (90) and lazer has tiny weight (10),
      // while lazer has hardMin of 30% (R$ 3.000 on R$ 10.000).
      // Previously: moradia got floor(9000)=9000 and lazer got max(1000, 3000)=3000 -> sum = 12000 bp (120%!) while totalPercentagesSum claimed 100!
      const res = rebalanceBudget({
        plannedNetIncome: 10000,
        currentPercentages: {
          moradia: 90,
          transporte: 0,
          comida: 0,
          lazer: 10,
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
        locks: {
          moradia: false,
          transporte: true,
          comida: true,
          lazer: false,
          protecao: true,
          profissional: true,
          investimentos: true,
        },
        referencePreset: {
          moradia: 90,
          transporte: 0,
          comida: 0,
          lazer: 10,
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
        floorsR$: {
          moradia: 0,
          transporte: 0,
          comida: 0,
          lazer: 3000, // 30% minimum
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
      });

      expect(res.status).toBe('feasible');
      expect(res.proposedPercentages.lazer).toBeGreaterThanOrEqual(30);
      expect(res.proposedPercentages.moradia).toBeLessThanOrEqual(70);

      const actualSumPct = Object.values(res.proposedPercentages).reduce((s, p) => s + p, 0);
      expect(Number(actualSumPct.toFixed(2))).toBe(100);

      const actualSumR$ = Object.values(res.proposedAmountsR$).reduce((s, v) => s + v, 0);
      expect(Number(actualSumR$.toFixed(2))).toBe(10000);
    });

    it('closes R$ 6.000 into 3.600 / 1.800 / 600 and R$ 6.000,01 in exact integer cents across rows and macroGroup columns', () => {
      const baseLocks = {
        moradia: false,
        transporte: false,
        comida: false,
        lazer: false,
        protecao: false,
        profissional: false,
        investimentos: false,
      };
      const basePcts = {
        moradia: 45,
        protecao: 15,
        comida: 15,
        lazer: 10,
        transporte: 5,
        profissional: 0,
        investimentos: 10,
      };

      const res6000 = rebalanceBudget({
        plannedNetIncome: 6000,
        currentPercentages: basePcts,
        locks: baseLocks,
        groupTargetsPct: { fixos: 60, variaveis: 30, investimentos: 10 },
      });

      expect(res6000.status).toBe('feasible');
      expect(res6000.macroGroups?.fixos.amountR$).toBe(3600);
      expect(res6000.macroGroups?.variaveis.amountR$).toBe(1800);
      expect(res6000.macroGroups?.investimentos.amountR$).toBe(600);

      // R$ 6.000,01 (600001 cents) -> rows and columns close in exact integer cents
      const resOdd = rebalanceBudget({
        plannedNetIncome: 6000.01,
        currentPercentages: basePcts,
        locks: baseLocks,
        groupTargetsPct: { fixos: 60, variaveis: 30, investimentos: 10 },
      });

      expect(resOdd.status).toBe('feasible');
      const totalPropCents = Object.values(resOdd.proposedAmountsR$).reduce(
        (s, v) => s + Math.round(v * 100),
        0
      );
      expect(totalPropCents).toBe(600001);

      const fixCents = Math.round((resOdd.macroGroups?.fixos.amountR$ || 0) * 100);
      const varCents = Math.round((resOdd.macroGroups?.variaveis.amountR$ || 0) * 100);
      const invCents = Math.round((resOdd.macroGroups?.investimentos.amountR$ || 0) * 100);
      expect(fixCents + varCents + invCents).toBe(600001);

      // Matrix rows x columns closure: sum of category fixedCents == fixos.cents, variableCents == variaveis.cents
      const matrix = resOdd.categoryMatrixCents!;
      expect(matrix).toBeDefined();
      let sumRowFixed = 0;
      let sumRowVar = 0;
      for (const cat of ['moradia', 'transporte', 'comida', 'lazer', 'protecao', 'profissional'] as const) {
        const row = matrix[cat];
        expect(row.fixedCents + row.variableCents).toBe(row.totalCents);
        expect(row.totalCents).toBe(Math.round(resOdd.proposedAmountsR$[cat] * 100));
        sumRowFixed += row.fixedCents;
        sumRowVar += row.variableCents;
      }
      expect(sumRowFixed).toBe(fixCents);
      expect(sumRowVar).toBe(varCents);
    });

    it('supports mixed-nature categories (e.g. moradia with fixed rent + variable electricity) closing rows and columns simultaneously', () => {
      const res = rebalanceBudget({
        plannedNetIncome: 6000,
        currentPercentages: {
          moradia: 45,
          protecao: 15,
          comida: 15,
          lazer: 10,
          transporte: 5,
          profissional: 0,
          investimentos: 10,
        },
        locks: {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: true,
        },
        actualSpentByNatureR$: {
          moradia: { fixedR$: 2200, variableR$: 300 }, // Mixed nature in Moradia!
          transporte: { fixedR$: 400, variableR$: 100 }, // Mixed nature in Transporte!
        },
        groupTargetsPct: { fixos: 60, variaveis: 30, investimentos: 10 },
      });

      expect(res.status).toBe('feasible');
      const matrix = res.categoryMatrixCents!;
      expect(matrix.moradia.fixedCents).toBeGreaterThanOrEqual(220000);
      expect(matrix.moradia.variableCents).toBeGreaterThanOrEqual(30000);
      expect(matrix.moradia.fixedCents + matrix.moradia.variableCents).toBe(matrix.moradia.totalCents);

      const sumFixed = Object.values(matrix).reduce((s, r) => s + r.fixedCents, 0);
      const sumVar = Object.values(matrix).reduce((s, r) => s + r.variableCents, 0);
      const invCents = Math.round(res.proposedAmountsR$.investimentos * 100);
      expect(sumFixed + sumVar + invCents).toBe(600000);
    });

    it('never imposes 30% investment preset automatically when user did not pass referencePreset or locked 10% across tier/phase change', () => {
      // Without referencePreset, currentPercentages (with 10% investments) are respected as weights instead of forcing 30%!
      const res = rebalanceBudget({
        plannedNetIncome: 40000, // Voo Alto income level
        currentPercentages: {
          moradia: 35,
          protecao: 25,
          comida: 15,
          lazer: 10,
          transporte: 5,
          profissional: 0,
          investimentos: 10,
        },
        locks: {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: true, // Locked at 10%
        },
      });

      expect(res.status).toBe('feasible');
      expect(res.proposedPercentages.investimentos).toBe(10);

      // Selecting 15% investments produces an explicit personalized proposal (e.g. 60/25/15) without silently imposing 30%
      const custom15 = proposeCustomInvestmentRatio(15, { fixedPct: 60, varPct: 30, investPct: 10 });
      expect(custom15.isCustomPolicy).toBe(true);
      expect(custom15.proposedGroupRatios.investPct).toBe(15);
      expect(
        custom15.proposedGroupRatios.fixedPct +
          custom15.proposedGroupRatios.varPct +
          custom15.proposedGroupRatios.investPct
      ).toBe(100);
    });

    it('detects locks > 100% conflict and fixed realized 4.200 exceeding 3.600 ceiling by 600', () => {
      const lockConflict = rebalanceBudget({
        plannedNetIncome: 6000,
        currentPercentages: {
          moradia: 60,
          transporte: 20,
          comida: 25,
          lazer: 0,
          protecao: 0,
          profissional: 0,
          investimentos: 10,
        },
        locks: {
          moradia: true,
          transporte: true,
          comida: true,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: false,
        },
      });
      expect(lockConflict.status).toBe('infeasible');
      expect(lockConflict.conflicts.some((c) => c.type === 'sum_locks_exceeds_100')).toBe(true);

      // Realized fixed 4.200 vs approved fixed group ceiling 3.600 (60% of 6.000) -> excess / deficit of R$ 600
      const fixedOver = rebalanceBudget({
        plannedNetIncome: 6000,
        currentPercentages: {
          moradia: 45,
          protecao: 15,
          comida: 15,
          lazer: 10,
          transporte: 5,
          profissional: 0,
          investimentos: 10,
        },
        locks: {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: true,
        },
        actualSpentR$: {
          moradia: 4200,
          transporte: 0,
          comida: 0,
          lazer: 0,
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
        actualSpentByNatureR$: {
          moradia: { fixedR$: 4200, variableR$: 0 },
        },
        groupTargetsPct: { fixos: 60, variaveis: 30, investimentos: 10 },
        enforceGroupCeilings: true,
      });

      expect(fixedOver.status).toBe('infeasible');
      expect(fixedOver.deficitR$).toBe(600);
      expect(fixedOver.conflicts.some((c) => c.type === 'group_ceiling_exceeded')).toBe(true);
    });

    it('separates actualSpentR$ from pending commitmentsR$ via 29B selectors without double counting settled installments or paid fixed bills', () => {
      const state = createTestAppState('2026-10');
      // Paid fixed bill R$ 2.000 + settled installment #1 R$ 500 + pending installment #2 in another purchase R$ 300
      state.coupleFixedBills = [
        {
          id: 'bill-condo',
          title: 'Condomínio',
          category: 'moradia',
          amount: 2000,
          amountCents: 200000,
          dueDay: 10,
          assignedPayer: 'both',
          autoPay: false,
          status: 'paid',
          isRecurring: true,
          history: {
            '2026-10': { status: 'paid', paidAt: '2026-10-10', paidAmount: 2000 },
          },
        },
        {
          id: 'bill-luz',
          title: 'Energia',
          category: 'moradia',
          amount: 250,
          amountCents: 25000,
          dueDay: 20,
          assignedPayer: 'both',
          autoPay: false,
          status: 'pending',
          isRecurring: true,
        },
      ];
      state.expenses = [
        {
          id: 'exp-fb-bill-condo-2026-10',
          description: 'Condomínio',
          amount: 2000,
          amountCents: 200000,
          category: 'moradia',
          date: '2026-10-10',
          paidBy: 'both',
          linkedBillId: 'bill-condo',
          billCompetenceMonth: '2026-10',
          nature: 'fixa',
        },
        {
          id: 'exp-inst-1',
          description: 'Sofá (1/5)',
          amount: 500,
          amountCents: 50000,
          category: 'moradia',
          date: '2026-10-12',
          paidBy: 'both',
          installmentId: 'inst-sofa',
          installmentIndex: 1,
          nature: 'variavel',
        },
      ];
      state.installments = [
        {
          id: 'inst-sofa',
          title: 'Sofá',
          category: 'moradia',
          totalAmount: 2500,
          installmentsCount: 5,
          installmentAmount: 500,
          startMonth: '2026-10',
          paidInstallmentsCount: 1,
          active: true,
          paidBy: 'both',
          nature: 'variavel',
        },
        {
          id: 'inst-mesa',
          title: 'Mesa',
          category: 'moradia',
          totalAmount: 900,
          installmentsCount: 3,
          installmentAmount: 300,
          startMonth: '2026-10',
          paidInstallmentsCount: 0,
          active: true,
          paidBy: 'both',
          nature: 'variavel',
        },
      ];

      const snap = computeCompetenceBudgetSnapshot(state, '2026-10');
      // Realized in moradia = 2000 (condo) + 500 (sofa #1) = 2500 (NOT counted again in commitments!)
      expect(snap.actualSpentR$.moradia).toBe(2500);
      // Pending commitments in moradia = 250 (luz pending) + 300 (mesa #1 pending) = 550
      expect(snap.pendingCommitmentsR$.moradia).toBe(550);
      // Total committed/consumed need = 2500 + 550 = 3050
      expect(snap.totalCommittedAndSpentR$.moradia).toBe(3050);
    });

    it('rejects stale preview base/version on approval and prevents future competence plan from mutating current month globals', () => {
      const state = createTestAppState('2026-10');
      const octPlan: BudgetPlanContract = {
        id: '2026-10',
        competence: '2026-10',
        plannedNetIncome: 36000,
        version: '2026-10-01T10:00:00Z',
        planRevision: 1,
        categoryPercentages: {
          moradia: 30,
          transporte: 10,
          comida: 18,
          lazer: 12,
          protecao: 12,
          profissional: 8,
          investimentos: 10,
        },
        categoryAmountsR$: {
          moradia: 10800,
          transporte: 3600,
          comida: 6480,
          lazer: 4320,
          protecao: 4320,
          profissional: 2880,
          investimentos: 3600,
        },
        categoryLocks: state.categoryLocks as any,
        categoryFloorsR$: state.categoryFloors as any,
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
        referencePreset: { moradia: 30, transporte: 10, comida: 18, lazer: 12, protecao: 12, profissional: 8, investimentos: 10 },
        status: 'feasible',
        explanation: 'Outubro aprovado',
        conflicts: [],
        approvedAt: '2026-10-01T10:00:00Z',
        approvedBy: 'uid-ana',
      };
      state.monthlyBudgetPlans = { '2026-10': octPlan };

      // Future plan for 2026-11
      const novSnap = computeCompetenceBudgetSnapshot(state, '2026-11');
      const novProposal = rebalanceBudget({
        plannedNetIncome: 36000,
        currentPercentages: {
          moradia: 25,
          transporte: 10,
          comida: 20,
          lazer: 15,
          protecao: 10,
          profissional: 5,
          investimentos: 15,
        },
        locks: {
          moradia: true,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: true,
        },
        competence: '2026-11',
        actualSpentR$: novSnap.actualSpentR$,
        commitmentsR$: novSnap.pendingCommitmentsR$,
        baseSnapshotSignature: novSnap.signature,
      });

      const applyNov = buildBudgetApplicationCommand({
        state,
        proposal: novProposal,
        expectedSignature: novSnap.signature,
        approvedByUid: 'uid-ana',
        approvedByDisplayName: 'Ana',
      });

      expect(applyNov.status).toBe('ready');
      if (applyNov.status !== 'ready') throw new Error('Expected ready');
      // Future plan (2026-11) MUST NOT overwrite currentMonth (2026-10) global percentages or October's plan!
      expect(applyNov.nextState.categoryPercentages.moradia).toBe(30);
      expect(applyNov.nextState.profile.investmentsPercentage).toBe(10);
      expect(applyNov.nextState.monthlyBudgetPlans?.['2026-10']?.categoryPercentages.moradia).toBe(30);
      expect(applyNov.nextState.monthlyBudgetPlans?.['2026-11']?.categoryPercentages.moradia).toBe(25);
      expect(applyNov.nextState.monthlyBudgetPlans?.['2026-11']?.categoryPercentages.investimentos).toBe(15);

      // Now simulate state changing (new expense added in 2026-11) before approving stale preview -> conflict!
      const mutatedState: AppState = {
        ...state,
        expenses: [
          ...state.expenses,
          {
            id: 'exp-new-nov',
            description: 'Aluguel Novo',
            amount: 4500,
            amountCents: 450000,
            category: 'moradia',
            date: '2026-11-05',
            paidBy: 'both',
            nature: 'fixa',
          },
        ],
      };

      const staleAttempt = buildBudgetApplicationCommand({
        state: mutatedState,
        proposal: novProposal,
        expectedSignature: novSnap.signature,
        approvedByUid: 'uid-ana',
      });
      expect(staleAttempt.status).toBe('stale_base');
    });

    it('preserves explicit 30% legacy plan and ensures R$ 10k base + R$ 8k reinforcement - R$ 6k spent = R$ 12k nominal without changing 60/30/10 or repeating next month', () => {
      const state = createTestAppState('2026-10');
      state.incomes = [
        { id: 'inc-sal', description: 'Salário', amount: 36000, date: '2026-10-05', recipient: 'both', type: 'salario' },
        {
          id: 'inc-resgate',
          description: 'Resgate Cofrinho Reforma',
          amount: 8000,
          date: '2026-10-06',
          recipient: 'both',
          type: 'outro',
          classification: 'principal_redemption',
        },
      ];
      state.financialOperations = [
        {
          id: 'op-reinf-moradia-oct',
          type: 'CATEGORY_REINFORCEMENT',
          amountCents: 800000,
          amountR$: 8000,
          authorizedBy: 'uid-ana',
          authoredByUid: 'uid-ana',
          sourceRef: { type: 'piggy_bank', id: 'goal-reforma' },
          targetRef: { type: 'category', id: 'moradia' },
          competence: '2026-10',
          date: '2026-10-06',
          state: 'occurred_manual',
        },
      ];
      state.expenses = [
        {
          id: 'exp-moradia-oct',
          description: 'Aluguel + Contas',
          amount: 6000,
          amountCents: 600000,
          category: 'moradia',
          date: '2026-10-10',
          paidBy: 'both',
          nature: 'fixa',
          fundingSource: 'month_budget',
        },
      ];

      // Base moradia = R$ 10.000 (on R$ 36.000 planned income -> ~27.78%)
      // Also include a legacy 2026-09 explicit 30% investments plan to prove it is preserved as legitimate history!
      state.monthlyBudgetPlans = {
        '2026-09': {
          id: '2026-09',
          competence: '2026-09',
          plannedNetIncome: 40000,
          version: '2026-09-01T00:00:00Z',
          categoryPercentages: {
            moradia: 22,
            transporte: 10,
            comida: 11,
            lazer: 15,
            protecao: 7,
            profissional: 5,
            investimentos: 30,
          },
          categoryAmountsR$: {
            moradia: 8800,
            transporte: 4000,
            comida: 4400,
            lazer: 6000,
            protecao: 2800,
            profissional: 2000,
            investimentos: 12000,
          },
          categoryLocks: state.categoryLocks as any,
          categoryFloorsR$: state.categoryFloors as any,
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
          referencePreset: { moradia: 22, transporte: 10, comida: 11, lazer: 15, protecao: 7, profissional: 5, investimentos: 30 },
          status: 'feasible',
          explanation: 'Plano legado explícito 30%',
          conflicts: [],
          approvedAt: '2026-09-01T00:00:00Z',
        },
        '2026-10': {
          id: '2026-10',
          competence: '2026-10',
          plannedNetIncome: 36000,
          version: '2026-10-01T00:00:00Z',
          macroGroups: {
            fixos: { percentage: 60, amountR$: 21600 },
            variaveis: { percentage: 30, amountR$: 10800 },
            investimentos: { percentage: 10, amountR$: 3600 },
          },
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
          categoryLocks: state.categoryLocks as any,
          categoryFloorsR$: state.categoryFloors as any,
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
          explanation: 'Plano 60/30/10',
          conflicts: [],
        },
      };

      const octSnap = computeCompetenceBudgetSnapshot(state, '2026-10');
      expect(octSnap.eligibleReceivedIncomeR$).toBe(36000); // Redemption excluded from income!
      expect(octSnap.grossBankInflowsR$).toBe(44000); // R$ 36k + R$ 8k = R$ 44k bank inflows
      expect(octSnap.categoryReinforcementsR$.moradia).toBe(8000);
      // Base 10.000 + Reinforcement 8.000 - Spent 6.000 = 12.000 nominal envelope balance
      expect(octSnap.effectiveEnvelopeBalanceR$.moradia).toBe(12000);
      // Policy remains 60/30/10 on R$ 36.000 (not R$ 44.000)
      expect(state.monthlyBudgetPlans['2026-10'].macroGroups?.fixos.percentage).toBe(60);
      expect(state.monthlyBudgetPlans['2026-10'].macroGroups?.variaveis.percentage).toBe(30);
      expect(state.monthlyBudgetPlans['2026-10'].macroGroups?.investimentos.percentage).toBe(10);

      // Legacy explicit 30% plan in 2026-09 remains 30% (never retroactively downgraded to 10%)
      const sepSnap = computeCompetenceBudgetSnapshot(state, '2026-09');
      expect(sepSnap.currentPercentages.investimentos).toBe(30);
      expect(sepSnap.approvedPlan?.categoryPercentages.investimentos).toBe(30);

      // Next month (2026-11) does NOT repeat temporary reinforcement automatically
      const novSnap = computeCompetenceBudgetSnapshot(state, '2026-11');
      expect(novSnap.categoryReinforcementsR$.moradia).toBe(0);
    });
  });
});
