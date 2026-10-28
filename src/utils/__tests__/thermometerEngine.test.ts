import { describe, it, expect } from 'vitest';
import { calculateThermometerEngine } from '../thermometerEngine';
import { AppState } from '../../types/finance';

const sampleProfile = {
  partner1Name: 'Rafael',
  partner2Name: 'Amanda',
  partner1Specialty: 'Geral',
  partner2Specialty: 'Geral',
  city: 'São Paulo',
  partner1Income: 5000,
  partner2Income: 5000,
  emergencyReserveMonthsTarget: 6,
  expectedYieldAnnual: 6.5,
  streakMonths: 4,
  themeMode: 'dark' as const,
  accentTheme: 'emerald' as const,
  investmentsPercentage: 20, // R$ 2.000 de aportes -> Orçamento de Despesas R$ 8.000
};

const createBaseState = (): AppState => ({
  profile: { ...sampleProfile },
  categoryPercentages: {
    moradia: 30,
    transporte: 15,
    comida: 25,
    lazer: 10,
    protecao: 10,
    profissional: 10,
  },
  expenses: [],
  incomes: [],
  installments: [],
  piggyBanks: [],
  currentMonth: '2026-10',
  linkedAccounts: [],
  alertRules: [],
  notifications: [],
  protectionCurrentAmount: 0,
  protectionTotalInvested: 0,
  protectionYieldAccumulated: 0,
  isProtectionComplete: false,
  freedomTotalInvested: 0,
  freedomYieldAccumulated: 0,
});

describe('Thermometer Engine (Determinístico & Testável)', () => {
  it('1. Calcula 50% de consumo em orçamento de R$ 8.000 com gastos de R$ 4.000 sem usar renda bruta como denominador', () => {
    const state = createBaseState();
    state.expenses = [
      {
        id: 'e1',
        description: 'Mercado',
        amount: 4000,
        category: 'comida',
        date: '2026-10-10',
        paidBy: 'both',
      },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.declaredIncome).toBe(10000);
    expect(result.programmedSavings).toBe(2000);
    expect(result.expenseBudget).toBe(8000);
    expect(result.spentSoFar).toBe(4000);
    expect(result.totalConsumedAmount).toBe(4000);
    expect(result.budgetConsumedPercent).toBe(50);
    expect(result.signedMargin).toBe(4000);
    expect(result.isOverBudget).toBe(false);
    expect(result.statusState).toBe('dentro_do_plano');
  });

  it('2. Calcula estouro de R$ 500 com gastos de R$ 7.000 e conta pendente de R$ 1.500 no orçamento de R$ 8.000', () => {
    const state = createBaseState();
    state.expenses = [
      { id: 'e1', description: 'Gasto R$ 7.000', amount: 7000, category: 'lazer', date: '2026-10-05', paidBy: 'both' },
    ];
    state.coupleFixedBills = [
      {
        id: 'b1',
        title: 'Aluguel Pendente',
        category: 'moradia',
        amount: 1500,
        dueDay: 20,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.expenseBudget).toBe(8000);
    expect(result.spentSoFar).toBe(7000);
    expect(result.pendingCommitmentsAmount).toBe(1500);
    expect(result.totalConsumedAmount).toBe(8500);
    expect(result.signedMargin).toBe(-500);
    expect(result.suggestedNewMargin).toBe(0);
    expect(result.deficitAmount).toBe(500);
    expect(result.isOverBudget).toBe(true);
    expect(result.statusState).toBe('ajuste_necessario');
  });

  it('3. Limita o anel visual sem ocultar o déficit quando o consumo atinge 110% (R$ 8.800 em R$ 8.000)', () => {
    const state = createBaseState();
    state.expenses = [
      { id: 'e1', description: 'Super Gasto', amount: 8800, category: 'lazer', date: '2026-10-12', paidBy: 'both' },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.budgetConsumedPercent).toBe(110);
    expect(result.overflowPercent).toBe(10);
    expect(result.overflowAmount).toBe(800);
    expect(result.deficitAmount).toBe(800);

    // Todos os 5 segmentos devem estar preenchidos em 1.0 (100%)
    result.ringSegments.forEach(seg => {
      expect(seg.fillFraction).toBe(1.0);
    });
  });

  it('4. Trata com segurança orçamento zero e renda zero sem gerar NaN ou Infinity', () => {
    const state = createBaseState();
    state.profile.partner1Income = 0;
    state.profile.partner2Income = 0;

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.declaredIncome).toBe(0);
    expect(result.expenseBudget).toBe(0);
    expect(result.budgetConsumedPercent).toBeNull();
    expect(result.statusState).toBe('dados_insuficientes');
    expect(Number.isNaN(result.signedMargin)).toBe(false);
    expect(Number.isFinite(result.signedMargin)).toBe(true);
  });

  it('5. Calcula a janela de dias restantes e ano bissexto corretamente em fevereiro', () => {
    const state = createBaseState();
    state.currentMonth = '2028-02'; // 2028 é ano bissexto (29 dias em fev)

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2028-02-15' });

    expect(result.daysInMonth).toBe(29);
    expect(result.currentDayOfMonth).toBe(15);
    expect(result.daysRemainingInMonth).toBe(15); // 29 - 15 + 1 (inclui hoje)
  });

  it('6. Escopo por parceiro filtra gastos e orçamentos coerentemente sem misturar contas', () => {
    const state = createBaseState();
    state.expenses = [
      { id: 'e1', description: 'Gasto Rafael', amount: 1000, category: 'profissional', date: '2026-10-05', paidBy: 'partner1' },
      { id: 'e2', description: 'Gasto Amanda', amount: 2000, category: 'profissional', date: '2026-10-06', paidBy: 'partner2' },
    ];

    const resultP1 = calculateThermometerEngine(state, 'partner1', { todayDateStr: '2026-10-15' });
    const resultP2 = calculateThermometerEngine(state, 'partner2', { todayDateStr: '2026-10-15' });

    expect(resultP1.declaredIncome).toBe(5000);
    expect(resultP1.expenseBudget).toBe(4000);
    expect(resultP1.spentSoFar).toBe(1000);

    expect(resultP2.declaredIncome).toBe(5000);
    expect(resultP2.expenseBudget).toBe(4000);
    expect(resultP2.spentSoFar).toBe(2000);
  });

  it('7. Separa recebíveis de plantões pendentes de recebíveis já confirmados', () => {
    const state = createBaseState();
    state.medicalShifts = [
      {
        id: 's1',
        partner: 'partner1',
        title: 'Plantão Unimed',
        hospitalName: 'Hospital Einstein',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-10-02',
        durationHours: 12,
        grossAmount: 1200,
        netAmount: 1200,
        estimatedPayDate: '2026-10-10',
        status: 'received',
      },
      {
        id: 's2',
        partner: 'partner1',
        title: 'Plantão Samaritano',
        hospitalName: 'Hospital Samaritano',
        sector: 'porta',
        contractType: 'pj_privado',
        dateWorked: '2026-10-08',
        durationHours: 12,
        grossAmount: 500,
        netAmount: 500,
        estimatedPayDate: '2026-10-25',
        status: 'pending',
      },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.confirmedMedicalReceivables).toBe(1200);
    expect(result.pendingMedicalReceivables).toBe(500);
  });

  it('8. Desconta reserva de gasto excepcional no cálculo da margem e do ritmo diário', () => {
    const state = createBaseState(); // Orçamento R$ 8.000

    const result = calculateThermometerEngine(state, 'couple', {
      todayDateStr: '2026-10-15',
      exceptionalReservations: [
        { id: 'r1', title: 'Viagem Fim de Semana', amount: 800, date: '2026-10-20', confirmed: true },
      ],
    });

    expect(result.signedMargin).toBe(8000);
    expect(result.exceptionalReservationsAmount).toBe(800);
    // Margem líquida para limite diário = 8000 - 800 = 7200
    // Dias restantes = 17 (31 - 15 + 1)
    // 7200 / 17 = 423,5 -> Math.round = 424
    expect(result.effectiveDailyLimitAfterReservations).toBe(424);
  });
});
