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

  it('9. Despesa compartilhada de R$ 100 com divisão 70/30 produz R$ 100 no escopo casal, R$ 70 no parceiro 1 e R$ 30 no parceiro 2', () => {
    const state = createBaseState();
    state.expenses = [
      {
        id: 'e-split',
        description: 'Jantar Comemorativo',
        amount: 100,
        category: 'lazer',
        date: '2026-10-05',
        paidBy: 'both',
        splitPartner1Pct: 70,
        splitPartner2Pct: 30,
      },
    ];

    const resultCouple = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });
    const resultP1 = calculateThermometerEngine(state, 'partner1', { todayDateStr: '2026-10-15' });
    const resultP2 = calculateThermometerEngine(state, 'partner2', { todayDateStr: '2026-10-15' });

    expect(resultCouple.spentSoFar).toBe(100);
    expect(resultP1.spentSoFar).toBe(70);
    expect(resultP2.spentSoFar).toBe(30);
  });

  it('10. Parcela futura não pesa no mês atual; parcela ativa com vencimento nos próximos 7 dias aparece na janela móvel', () => {
    const state = createBaseState();
    state.installments = [
      {
        id: 'inst-future',
        title: 'Notebook Futuro',
        category: 'profissional',
        totalAmount: 3000,
        installmentsCount: 10,
        installmentAmount: 300,
        startMonth: '2026-11', // Começa no próximo mês
        paidInstallmentsCount: 0,
        active: true,
        paidBy: 'both',
        dueDay: 18,
      },
      {
        id: 'inst-active',
        title: 'Estetoscópio',
        category: 'profissional',
        totalAmount: 1200,
        installmentsCount: 6,
        installmentAmount: 200,
        startMonth: '2026-10', // Ativo neste mês (10)
        paidInstallmentsCount: 0,
        active: true,
        paidBy: 'both',
        dueDay: 18, // Vence no dia 18, dentro da janela 15-22
      },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    // A parcela futura não pode entrar em compromissos pendentes
    expect(result.pendingCommitmentsList.some(c => c.id === 'inst-inst-future')).toBe(false);

    // A parcela ativa deste mês entra em compromissos pendentes
    const activeEntry = result.pendingCommitmentsList.find(c => c.id === 'inst-inst-active');
    expect(activeEntry).toBeDefined();
    expect(activeEntry?.amount).toBe(200);

    // A parcela com vencimento no dia 18 aparece nos próximos 7 dias (15 a 22)
    const inMovingWindow = result.moving7DayCommitments.find(c => c.id === 'inst-inst-active');
    expect(inMovingWindow).toBeDefined();
    expect(inMovingWindow?.date).toBe('2026-10-18');
  });

  it('11. Contas fixas são identificadas canonicamente por linkedBillId/billCompetenceMonth e não por busca solta de texto', () => {
    const state = createBaseState();
    state.coupleFixedBills = [
      {
        id: 'bill-enel',
        title: 'Energia Enel',
        category: 'moradia',
        amount: 250,
        dueDay: 10,
        assignedPayer: 'both',
        autoPay: false,
        status: 'pending',
        isRecurring: true,
      },
    ];

    // Despesa cujo texto contém a palavra 'energia', mas não é o pagamento da conta fixa
    state.expenses = [
      {
        id: 'exp-cafe',
        description: 'Bebida com muita energia para o plantão',
        amount: 25,
        category: 'comida',
        date: '2026-10-08',
        paidBy: 'both',
      },
    ];

    const resultBefore = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });
    // Não pode dar match solto na palavra 'energia'
    expect(resultBefore.pendingCommitmentsList.some(c => c.id === 'bill-bill-enel')).toBe(true);

    // Agora vincula canonicamente
    state.expenses.push({
      id: 'exp-real-bill',
      description: 'Pagamento de conta',
      amount: 250,
      category: 'moradia',
      date: '2026-10-10',
      paidBy: 'both',
      linkedBillId: 'bill-enel',
      billCompetenceMonth: '2026-10',
    });

    const resultAfter = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });
    // Agora que está vinculada canonicamente, não está mais pendente
    expect(resultAfter.pendingCommitmentsList.some(c => c.id === 'bill-bill-enel')).toBe(false);
  });

  it('12. Caixa sem contas bancárias válidas cadastradas resulta em hasCashReconciliation=false e availableCash=0 sem travar o plano', () => {
    const state = createBaseState();
    state.linkedAccounts = []; // Sem contas cadastradas

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    expect(result.hasCashReconciliation).toBe(false);
    expect(result.availableCash).toBe(0);
    expect(result.reconciledBankBalance).toBe(0);
    // O Plano do Mês continua 100% determinístico e funcional
    expect(result.expenseBudget).toBe(8000);
    expect(result.signedMargin).toBe(8000);
  });

  it('13. Plantões médicos desconsideram plantão cancelado e diferenciam data de pagamento de data trabalhada', () => {
    const state = createBaseState();
    state.medicalShifts = [
      {
        id: 'shift-cancelled',
        partner: 'partner1',
        title: 'Plantão Desmarcado',
        hospitalName: 'Hospital São Luiz',
        sector: 'porta',
        contractType: 'pj_privado',
        dateWorked: '2026-10-01',
        durationHours: 12,
        grossAmount: 1500,
        netAmount: 1500,
        estimatedPayDate: '2026-10-15',
        status: 'pending',
        executionStatus: 'cancelled', // CANCELADO!
      },
      {
        id: 'shift-september-paid-october',
        partner: 'partner1',
        title: 'Plantão Trabalhado em Setembro',
        hospitalName: 'Hospital Alvorada',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-09-28', // Trabalhado no mês anterior
        durationHours: 12,
        grossAmount: 1800,
        netAmount: 1800,
        estimatedPayDate: '2026-10-20', // Mas com previsão de recebimento em OUTUBRO
        status: 'pending',
        executionStatus: 'performed',
      },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });

    // Plantão cancelado não pode entrar nos recebíveis
    // Plantão trabalhado em setembro mas com recebimento previsto para outubro deve entrar!
    expect(result.pendingMedicalReceivables).toBe(1800);
  });

  it('14. Separa projeção por ritmo realizado de cenário teto e cenário de aperto', () => {
    const state = createBaseState(); // Orçamento R$ 8.000
    // Em 10 dias de 31 gastou R$ 2.000 (média R$ 200/dia)
    state.expenses = [
      { id: 'e1', description: 'Gastos 10 dias', amount: 2000, category: 'comida', date: '2026-10-10', paidBy: 'both' },
    ];

    const result = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-10' });

    // Ritmo realizado = 2000 / 10 = 200/dia. Restam 21 dias (31 - 10) -> Projeção variável restante = 4200
    // Projeção final ritmo = 2000 + 4200 = 6200 -> Margem = 8000 - 6200 = 1800
    expect(result.baseProjectedClosingSpent).toBe(6200);
    expect(result.baseProjectedClosingMargin).toBe(1800);

    // Cenário teto consome até o teto do plano
    expect(result.ceilingScenarioSpent).toBe(8000);
    expect(result.ceilingScenarioMargin).toBe(0);
  });

  it('15. Conferência semanal não assume conferido na abertura e rastreia lançamentos recentes', () => {
    const state = createBaseState();
    state.expenses = [
      { id: 'e1', description: 'Gasto Dia 5', amount: 300, category: 'lazer', date: '2026-10-05', paidBy: 'both' },
      { id: 'e2', description: 'Gasto Dia 12', amount: 500, category: 'lazer', date: '2026-10-12', paidBy: 'both' },
    ];

    // Sem conferência prévia
    const resultSemConf = calculateThermometerEngine(state, 'couple', { todayDateStr: '2026-10-15' });
    expect(resultSemConf.coverageStatus).toBe('parcial'); // tem lançamentos mas sem check-in
    expect(resultSemConf.lastConferredDate).toBeUndefined();

    // Com conferência prévia no dia 10
    const resultComConf = calculateThermometerEngine(state, 'couple', {
      todayDateStr: '2026-10-15',
      lastWeeklyCheckInAt: '2026-10-10',
    });
    expect(resultComConf.coverageStatus).toBe('conferido');
    expect(resultComConf.lastConferredDate).toBe('2026-10-10');
    // Apenas o lançamento do dia 12 ocorreu após a conferência do dia 10
    expect(resultComConf.whatChangedSummary.newEntriesCount).toBe(1);
    expect(resultComConf.whatChangedSummary.newEntriesTotal).toBe(500);
  });
});

