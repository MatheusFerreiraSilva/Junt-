import { describe, it, expect } from 'vitest';
import { calculateCalendarEngine, clampDayToMonth, getDaysInMonth } from '../calendarEngine';
import { AppState } from '../../types/finance';

const createBaseState = (): AppState => ({
  profile: {
    partner1Name: 'Rafael',
    partner2Name: 'Amanda',
    city: 'São Paulo',
    partner1Income: 6000,
    partner2Income: 4000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 4,
    themeMode: 'dark' as const,
    accentTheme: 'emerald' as const,
    investmentsPercentage: 20,
  },
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

describe('Calendar Engine (Pure & Deterministic)', () => {
  it('1. Limita o dia 31 ao último dia de fevereiro corretamente em anos bissextos e não-bissextos', () => {
    // 2028 é bissexto (29 dias em fev)
    expect(getDaysInMonth(2028, 2)).toBe(29);
    expect(clampDayToMonth(2028, 2, 31)).toBe(29);

    // 2026 não é bissexto (28 dias em fev)
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);

    // Abril tem 30 dias
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
  });

  it('2. Pagamento de conta fixa do Hub aparece como "pago" no calendário e "previsto" antes de pagar', () => {
    const state = createBaseState();
    state.coupleFixedBills = [
      {
        id: 'bill-condo',
        title: 'Condomínio',
        category: 'moradia',
        amount: 800,
        dueDay: 20,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];

    // Antes de pagar no dia 15
    const resBefore = calculateCalendarEngine(state, '2026-10', 'couple', { todayDateStr: '2026-10-15' });
    const billBefore = resBefore.allMonthObligations.find(o => o.sourceId === 'bill-condo');
    expect(billBefore).toBeDefined();
    expect(billBefore?.status).toBe('previsto');
    expect(billBefore?.dueDate).toBe('2026-10-20');

    // Registrar o pagamento canônico da conta fixa
    state.expenses.push({
      id: 'exp-fb-bill-condo-2026-10',
      linkedBillId: 'bill-condo',
      billCompetenceMonth: '2026-10',
      description: '[Conta Fixa] Condomínio',
      amount: 800,
      category: 'moradia',
      date: '2026-10-18',
      paidBy: 'both',
    });
    state.coupleFixedBills[0].status = 'paid';
    state.coupleFixedBills[0].lastPaidMonth = '2026-10';

    const resAfter = calculateCalendarEngine(state, '2026-10', 'couple', { todayDateStr: '2026-10-15' });
    const billAfter = resAfter.allMonthObligations.find(o => o.sourceId === 'bill-condo');
    expect(billAfter).toBeDefined();
    expect(billAfter?.status).toBe('pago');
    expect(billAfter?.linkedExpenseId).toBe('exp-fb-bill-condo-2026-10');
  });

  it('3. Compra parcelada já concluída (inst.active === false) continua aparecendo em seus meses históricos', () => {
    const state = createBaseState();
    state.installments = [
      {
        id: 'inst-completed',
        title: 'Curso de Ultrassonografia',
        category: 'profissional',
        totalAmount: 1200,
        installmentsCount: 3,
        installmentAmount: 400,
        startMonth: '2026-06', // Junho, Julho, Agosto
        paidInstallmentsCount: 3,
        active: false, // Quitado/inativo hoje!
        paidBy: 'partner1',
        dueDay: 10,
      },
    ];

    // Em Julho/2026 (mês histórico 2 da parcela), ela DEVE aparecer no calendário
    const resJuly = calculateCalendarEngine(state, '2026-07', 'couple', { todayDateStr: '2026-10-15' });
    const instJuly = resJuly.allMonthObligations.find(o => o.sourceId === 'inst-completed');
    expect(instJuly).toBeDefined();
    expect(instJuly?.amount).toBe(400);
    expect(instJuly?.installmentInfo?.currentNumber).toBe(2);

    // Em Outubro/2026 (após o término das 3 parcelas), ela NÃO deve aparecer
    const resOct = calculateCalendarEngine(state, '2026-10', 'couple', { todayDateStr: '2026-10-15' });
    const instOct = resOct.allMonthObligations.find(o => o.sourceId === 'inst-completed');
    expect(instOct).toBeUndefined();
  });

  it('4. Pessoa 1 não recebe obrigações exclusivas da Pessoa 2 ao filtrar por parceiro', () => {
    const state = createBaseState();
    state.coupleFixedBills = [
      {
        id: 'b-p1',
        title: 'CRM Rafael',
        category: 'profissional',
        amount: 300,
        dueDay: 10,
        assignedPayer: 'partner1',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
      {
        id: 'b-p2',
        title: 'CRM Amanda',
        category: 'profissional',
        amount: 300,
        dueDay: 10,
        assignedPayer: 'partner2',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];

    const resP1 = calculateCalendarEngine(state, '2026-10', 'partner1', { todayDateStr: '2026-10-15' });
    const resP2 = calculateCalendarEngine(state, '2026-10', 'partner2', { todayDateStr: '2026-10-15' });

    // Rafael vê apenas CRM Rafael
    expect(resP1.allMonthObligations.some(o => o.sourceId === 'b-p1')).toBe(true);
    expect(resP1.allMonthObligations.some(o => o.sourceId === 'b-p2')).toBe(false);

    // Amanda vê apenas CRM Amanda
    expect(resP2.allMonthObligations.some(o => o.sourceId === 'b-p1')).toBe(false);
    expect(resP2.allMonthObligations.some(o => o.sourceId === 'b-p2')).toBe(true);
  });

  it('5. Detecta concentração de vencimentos e calcula agenda de 7 e 30 dias com caixa informado', () => {
    const state = createBaseState();
    state.coupleFixedBills = [
      { id: 'b1', title: 'Aluguel', category: 'moradia', amount: 3000, dueDay: 18, assignedPayer: 'both', autoPay: false, status: 'pending', isRecurring: true },
      { id: 'b2', title: 'Condomínio', category: 'moradia', amount: 800, dueDay: 18, assignedPayer: 'both', autoPay: false, status: 'pending', isRecurring: true },
    ];

    // Conta bancária com saldo de R$ 5.000
    state.linkedAccounts = [
      {
        id: 'acc-itau',
        bankName: 'Itaú Personalité',
        accountType: 'corrente',
        accountNumber: '12345-6',
        holder: 'both',
        balance: 5000,
        lastSynced: '2026-10-15',
        status: 'connected',
        colorHex: '#ec7000',
        logo: '',
      },
    ];

    const result = calculateCalendarEngine(state, '2026-10', 'couple', { todayDateStr: '2026-10-15' });

    // Alerta de concentração no dia 18 (R$ 3.800 em 2 contas)
    expect(result.concentrationAlerts.length).toBeGreaterThanOrEqual(1);
    expect(result.concentrationAlerts[0].dayNum).toBe(18);
    expect(result.concentrationAlerts[0].totalAmount).toBe(3800);

    // Agenda dos próximos 7 dias (15 a 22 de outubro inclui o dia 18)
    expect(result.agenda7Days.totalCommitments).toBe(3800);
    expect(result.agenda7Days.hasCashReconciliation).toBe(true);
    expect(result.agenda7Days.availableCash).toBe(5000);
    expect(result.agenda7Days.isCashSufficient).toBe(true);
  });

  it('6. Simulação de adiamento move o compromisso para uma nova data sem alterar contratos reais', () => {
    const state = createBaseState();
    state.coupleFixedBills = [
      { id: 'b1', title: 'Cartão de Crédito', category: 'moradia', amount: 1500, dueDay: 16, assignedPayer: 'both', autoPay: false, status: 'pending', isRecurring: true },
    ];

    // Simula adiar o pagamento para dia 25
    const result = calculateCalendarEngine(state, '2026-10', 'couple', {
      todayDateStr: '2026-10-15',
      postponedObligations: {
        'bill-b1': '2026-10-25',
      },
    });

    const bill = result.allMonthObligations.find(o => o.sourceId === 'b1');
    expect(bill?.isSimulatedPostponed).toBe(true);
    expect(bill?.dueDate).toBe('2026-10-25');
    expect(bill?.originalDueDate).toBe('2026-10-16');
  });

  it('7. Rateio de despesa 70/30 no dia do calendário reflete nos totais do parceiro', () => {
    const state = createBaseState();
    state.expenses = [
      {
        id: 'e1',
        description: 'Mercado Mensal',
        amount: 1000,
        category: 'comida',
        date: '2026-10-10',
        paidBy: 'both',
        splitPartner1Pct: 70,
        splitPartner2Pct: 30,
      },
    ];

    const resP1 = calculateCalendarEngine(state, '2026-10', 'partner1', { todayDateStr: '2026-10-15' });
    const resP2 = calculateCalendarEngine(state, '2026-10', 'partner2', { todayDateStr: '2026-10-15' });

    expect(resP1.monthTotals.expense).toBe(700);
    expect(resP2.monthTotals.expense).toBe(300);
  });
});
