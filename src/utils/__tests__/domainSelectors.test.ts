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
} from '../domainSelectors';
import { AppState } from '../../types/finance';

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
});
