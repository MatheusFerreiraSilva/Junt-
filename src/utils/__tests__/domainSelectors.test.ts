import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  isEntityInScope,
  selectEffectiveIncomeTotal,
  selectConsumptionExpensesTotal,
  selectPendingObligationsTotal,
  selectLiquidOperationalCash,
  selectTotalProtectedAssets,
  selectTotalNetWorth,
  validateDomainChecksum,
  selectAnnualYield,
  selectFreedomMetrics,
  selectFIREMetrics,
  selectEligibleNetIncome,
  allocateIncomeByPolicy,
  upgradeBudgetPlanContract,
  createStandardBudgetPlanContract,
} from '../domainSelectors';
import { AppState, BudgetPlanContract } from '../../types/finance';

const createSampleState = (): AppState => ({
  profile: {
    partner1Name: 'Matheus',
    partner1Specialty: 'Internal Medicine',
    partner2Name: 'Beatriz',
    partner2Specialty: 'Dermatology',
    city: 'São Paulo',
    partner1Income: 8000,
    partner2Income: 7000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 4,
    themeMode: 'light',
    accentTheme: 'emerald',
  },
  categoryPercentages: {
    moradia: 30,
    comida: 25,
    lazer: 15,
    protecao: 10,
    profissional: 10,
    transporte: 10,
  },
  currentMonth: '2026-10',
  expenses: [
    {
      id: 'e1',
      description: 'Supermercado',
      amount: 450.5,
      category: 'comida',
      date: '2026-10-05',
      paidBy: 'partner1',
    },
    {
      id: 'e2',
      description: 'Aluguel do Apê',
      amount: 2500,
      category: 'moradia',
      date: '2026-10-01',
      paidBy: 'both',
    },
    {
      id: 'e3',
      description: 'Aporte Cofrinho Viagem',
      amount: 300,
      category: 'lazer',
      date: '2026-10-10',
      paidBy: 'partner2',
      isExcludedFromMonthlyBudget: true, // Internal transfer, excluded from consumption
    },
  ],
  incomes: [
    {
      id: 'i1',
      description: 'Bolsa Residência P1',
      amount: 4106.09,
      date: '2026-10-05',
      recipient: 'partner1',
      type: 'salario',
    },
    {
      id: 'i2',
      description: 'Plantão Einstein P2',
      amount: 1800,
      date: '2026-10-12',
      recipient: 'partner2',
      type: 'extra',
    },
  ],
  installments: [
    {
      id: 'inst1',
      title: 'Stethoscope Littmann',
      category: 'profissional',
      totalAmount: 1200,
      installmentsCount: 6,
      installmentAmount: 200,
      startMonth: '2026-09',
      paidInstallmentsCount: 1,
      active: true,
      paidBy: 'partner1',
    },
  ],
  coupleFixedBills: [
    {
      id: 'b1',
      title: 'Condomínio',
      category: 'moradia',
      amount: 600,
      dueDay: 15,
      assignedPayer: 'both',
      autoPay: false,
      status: 'pending',
      isRecurring: true,
    },
  ],
  piggyBanks: [
    {
      id: 'pb1',
      name: 'Viagem Itália',
      emoji: '✈️',
      purpose: 'Férias',
      currentAmount: 5000,
      targetAmount: 15000,
      monthlyDeposit: 500,
    },
  ],
  protectionCurrentAmount: 24000,
  protectionTotalInvested: 24000,
  protectionYieldAccumulated: 800,
  isProtectionComplete: true,
  freedomTotalInvested: 10000,
  freedomYieldAccumulated: 400,
  linkedAccounts: [
    {
      id: 'acc1',
      bankName: 'Nubank',
      accountType: 'corrente',
      accountNumber: '1234',
      holder: 'partner1',
      balance: 3200.5,
      lastSynced: '2026-10-28',
      status: 'connected',
      colorHex: '#8A05BE',
      logo: 'nubank',
    },
    {
      id: 'acc2',
      bankName: 'Itaú',
      accountType: 'corrente',
      accountNumber: '5678',
      holder: 'partner2',
      balance: 2800,
      lastSynced: '2026-10-28',
      status: 'connected',
      colorHex: '#EC7000',
      logo: 'itau',
    },
  ],
  alertRules: [],
  notifications: [],
});

describe('domainSelectors', () => {
  it('roundMoney cleanly formats cents without floating point errors', () => {
    expect(roundMoney(10.12345)).toBe(10.12);
    expect(roundMoney(4106.08999)).toBe(4106.09);
  });

  it('isEntityInScope respects scope filtering', () => {
    expect(isEntityInScope('partner1', 'casal')).toBe(true);
    expect(isEntityInScope('partner1', 'partner1')).toBe(true);
    expect(isEntityInScope('partner1', 'partner2')).toBe(false);
    expect(isEntityInScope('both', 'partner1')).toBe(true);
  });

  it('selectEffectiveIncomeTotal correctly sums economic incomes for casal, P1 and P2', () => {
    const state = createSampleState();
    expect(selectEffectiveIncomeTotal(state, 'casal', '2026-10')).toBe(5906.09);
    expect(selectEffectiveIncomeTotal(state, 'partner1', '2026-10')).toBe(4106.09);
    expect(selectEffectiveIncomeTotal(state, 'partner2', '2026-10')).toBe(1800);
  });

  it('selectConsumptionExpensesTotal excludes budget-excluded internal transfers', () => {
    const state = createSampleState();
    expect(selectConsumptionExpensesTotal(state, 'casal', '2026-10')).toBe(2950.5);
    expect(selectConsumptionExpensesTotal(state, 'partner1', '2026-10')).toBe(1700.5);
    expect(selectConsumptionExpensesTotal(state, 'partner2', '2026-10')).toBe(1250);
  });

  it('selectPendingObligationsTotal identifies pending bills and active installments', () => {
    const state = createSampleState();
    // Fixed bill 'Condomínio' R$600 + Installment 'Stethoscope' R$200 = R$800
    expect(selectPendingObligationsTotal(state, 'casal', '2026-10')).toBe(800);
  });

  it('selectLiquidOperationalCash sums connected account balances', () => {
    const state = createSampleState();
    // acc1 (P1: 3200.50) + acc2 (P2: 2800.00) = 6000.50
    expect(selectLiquidOperationalCash(state, 'casal')).toBe(6000.5);
    expect(selectLiquidOperationalCash(state, 'partner1')).toBe(3200.5);
    expect(selectLiquidOperationalCash(state, 'partner2')).toBe(2800);
  });

  it('selectTotalProtectedAssets calculates protection, freedom and piggy bank balances', () => {
    const state = createSampleState();
    const result = selectTotalProtectedAssets(state, 'casal');
    expect(result.protection).toBe(24000);
    expect(result.freedom).toBe(10400); // 10000 invested + 400 yield
    expect(result.goalsAndPiggyBanks).toBe(5000);
    expect(result.totalProtected).toBe(39400);
  });

  it('selectTotalNetWorth combines liquid cash and protected assets', () => {
    const state = createSampleState();
    // 6000.50 + 39400 = 45400.50
    expect(selectTotalNetWorth(state, 'casal')).toBe(45400.5);
  });

  it('validateDomainChecksum verifies mathematical integrity between P1, P2 and couple totals', () => {
    const state = createSampleState();
    const checksum = validateDomainChecksum(state, '2026-10');
    expect(checksum.isChecksumValid).toBe(true);
    expect(checksum.p1Income + checksum.p2Income).toBe(checksum.coupleIncome);
  });

  it('selectAnnualYield respects explicit 0 yield', () => {
    const state = createSampleState();
    state.profile.expectedYieldAnnual = 0;
    expect(selectAnnualYield(state)).toBe(0);

    delete (state.profile as any).expectedYieldAnnual;
    expect(selectAnnualYield(state)).toBe(6.5);
  });

  it('selectFreedomMetrics preserves negative yield when market value drops below total invested', () => {
    const state = createSampleState();
    state.freedomTotalInvested = 10000;
    state.freedomYieldAccumulated = -500;
    const freedom = selectFreedomMetrics(state);
    expect(freedom.totalInvested).toBe(10000);
    expect(freedom.yieldAccumulated).toBe(-500);
    expect(freedom.currentAmount).toBe(9500);
  });

  it('selectFIREMetrics computes target and returns Infinity when pace is 0 and target not reached', () => {
    const state = createSampleState();
    state.freedomTotalInvested = 10000;
    state.freedomYieldAccumulated = 0;
    state.piggyBanks = [];
    state.coupleGoals = [];
    state.profile.expectedYieldAnnual = 0; // 0% yield

    // monthlyExpenses = 2000 => target = 600000
    const fire = selectFIREMetrics(state, 2000, 0);
    expect(fire.fireTargetNetWorth).toBe(600000);
    expect(fire.fireEligibleCapital).toBe(10000);
    expect(fire.estimatedYearsToFIRE).toBe(Infinity);
  });

  describe('Stage 25A: Contract, Policy & Base Income Selectors', () => {
    it('selectEligibleNetIncome excludes internal transfers, loans, principal redemptions, refunds and unconfirmed shift forecasts', () => {
      const state = createSampleState();
      state.incomes = [
        { id: 'i1', description: 'Salário Líquido', amount: 5000, date: '2026-10-01', recipient: 'partner1', type: 'salario', classification: 'pf_net' },
        { id: 'i2', description: 'Transferência entre parceiros', amount: 1000, date: '2026-10-02', recipient: 'partner2', type: 'outro', status: 'internal_transfer', classification: 'internal_transfer' },
        { id: 'i3', description: 'Empréstimo bancário', amount: 2000, date: '2026-10-03', recipient: 'partner1', type: 'outro', classification: 'loan' },
        { id: 'i4', description: 'Resgate Cofrinho', amount: 1500, date: '2026-10-04', recipient: 'partner2', type: 'outro', classification: 'principal_redemption' },
        { id: 'i5', description: 'Reembolso Amil', amount: 300, date: '2026-10-05', recipient: 'partner1', type: 'restituicao', classification: 'refund' },
        { id: 'i6', description: 'Previsão Plantão Não-Confirmado', amount: 1200, date: '2026-10-06', recipient: 'partner2', type: 'extra', status: 'pending', classification: 'forecast' },
        { id: 'i7', description: 'Plantão Conciliado PJ', amount: 2000, date: '2026-10-07', recipient: 'partner2', type: 'extra', classification: 'pj_gross', taxRatePercent: 6, monthlyAccountingCost: 0 },
      ];

      // Eligible = i1 (5000) + i7 (2000 - 6% tax = 1880) = 6880
      const eligible = selectEligibleNetIncome(state, 'casal', '2026-10');
      expect(eligible).toBe(6880);
    });

    it('allocateIncomeByPolicy calculates exact integer cents under 60/30/10 policy for R$ 6.000', () => {
      const allocation = allocateIncomeByPolicy(6000);
      expect(allocation.totalCents).toBe(600000);
      expect(allocation.macroGroups.fixos.amountR$).toBe(3600); // 60%
      expect(allocation.macroGroups.variaveis.amountR$).toBe(1800); // 30%
      expect(allocation.macroGroups.investimentos.amountR$).toBe(600); // 10%
      expect(allocation.macroGroups.fixos.amountR$ + allocation.macroGroups.variaveis.amountR$ + allocation.macroGroups.investimentos.amountR$).toBe(6000);
    });

    it('allocateIncomeByPolicy handles zero or negative income without fake goals', () => {
      const zeroAlloc = allocateIncomeByPolicy(0);
      expect(zeroAlloc.totalCents).toBe(0);
      expect(zeroAlloc.macroGroups.fixos.amountR$).toBe(0);
      expect(zeroAlloc.macroGroups.variaveis.amountR$).toBe(0);
      expect(zeroAlloc.macroGroups.investimentos.amountR$).toBe(0);

      const negAlloc = allocateIncomeByPolicy(-500);
      expect(negAlloc.totalCents).toBe(0);
      expect(negAlloc.macroGroups.fixos.amountR$).toBe(0);
    });

    it('allocateIncomeByPolicy preserves exact cent sums on odd amounts', () => {
      const oddAlloc = allocateIncomeByPolicy(100.01); // 10001 cents
      expect(oddAlloc.totalCents).toBe(10001);
      const sumR$ = parseFloat((oddAlloc.macroGroups.fixos.amountR$ + oddAlloc.macroGroups.variaveis.amountR$ + oddAlloc.macroGroups.investimentos.amountR$).toFixed(2));
      expect(sumR$).toBe(100.01);
    });

    it('upgradeBudgetPlanContract upgrades historical contracts to v2.0 without erasing approvals', () => {
      const historicalPlan: Partial<BudgetPlanContract> = {
        competence: '2026-09',
        plannedNetIncome: 10000,
        version: '1.0',
        approvedAt: '2026-09-01T10:00:00Z',
        approvedBy: 'Matheus & Beatriz',
        categoryPercentages: {
          moradia: 35,
          protecao: 15,
          comida: 20,
          lazer: 10,
          transporte: 5,
          profissional: 0,
          investimentos: 15, // Historical 15% investment plan
        },
      };

      const upgraded = upgradeBudgetPlanContract(historicalPlan);
      expect(upgraded.schemaVersion).toBe('2.0');
      expect(upgraded.approvedAt).toBe('2026-09-01T10:00:00Z');
      expect(upgraded.approvedBy).toBe('Matheus & Beatriz');
      expect(upgraded.policyMeta?.policyId).toBe('policy-50-35-15');
      expect(upgraded.macroGroups?.investimentos.amountR$).toBe(1500); // 15% of 10k
      expect(upgraded.macroGroups?.fixos.amountR$).toBe(5000); // 35+15 = 50%
      expect(upgraded.macroGroups?.variaveis.amountR$).toBe(3500); // 20+10+5 = 35%
    });

    it('createStandardBudgetPlanContract creates approved v2.0 contract', () => {
      const contract = createStandardBudgetPlanContract('2026-11', 8000, 'Matheus');
      expect(contract.competence).toBe('2026-11');
      expect(contract.plannedNetIncome).toBe(8000);
      expect(contract.schemaVersion).toBe('2.0');
      expect(contract.macroGroups?.fixos.amountR$).toBe(4800); // 60% of 8k
      expect(contract.macroGroups?.variaveis.amountR$).toBe(2400); // 30% of 8k
      expect(contract.macroGroups?.investimentos.amountR$).toBe(800); // 10% of 8k
    });
  });
});
