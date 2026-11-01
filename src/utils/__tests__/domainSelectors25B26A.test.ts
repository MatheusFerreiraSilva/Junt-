import { describe, it, expect } from 'vitest';
import {
  resolveExpenseClassification,
  validateTransactionSplits,
  applyTemporalScopeUpdate,
  selectEligibleNetIncomeReceived,
  selectPlannedNetIncome,
  selectGrossBankInflows,
  selectCategoryConsumptionExpenses,
  selectGoalDirectConsumptionExpenses,
  selectTotalEconomicConsumption,
  selectTotalCashDisbursements,
  selectGoalBalanceBreakdown,
  validatePiggyBankSliceAllocation,
  selectConsolidatedAssetTotal,
  executeFinancialOperation,
} from '../domainSelectors';
import {
  AppState,
  CategoryKeywordRule,
  ExpenseItem,
  TransactionSplit,
  BudgetPlanContract,
  SavingsPiggyBank,
  CoupleGoal,
  FinancialOperationRecord,
} from '../../types/finance';

describe('25B & 26A: Natureza, Prioridade, Dinheiro, Finalidade e Consumo', () => {
  const sampleKeywordRules: CategoryKeywordRule[] = [
    {
      id: 'kw-netflix',
      keyword: 'NETFLIX',
      category: 'lazer',
      nature: 'fixa',
      priority: 'dispensavel',
      policyMacroGroup: 'fixos',
      ruleVersion: '1.0',
      isAuthorizedRule: true,
    },
    {
      id: 'kw-supermercado',
      keyword: 'SUPERMERCADO',
      category: 'comida',
      nature: 'variavel',
      priority: 'essencial',
      policyMacroGroup: 'variaveis',
      ruleVersion: '1.0',
      isAuthorizedRule: true,
    },
    {
      id: 'kw-uber',
      keyword: 'UBER',
      category: 'transporte',
      nature: 'variavel',
      priority: 'importante',
      policyMacroGroup: 'variaveis',
      ruleVersion: '1.0',
      isAuthorizedRule: false,
    },
  ];

  describe('25B: Classificação Separada de Natureza, Prioridade e Grupo', () => {
    it('strict mode: supermercado variável essencial fica no grupo variáveis e streaming fixo dispensável permanece em fixos', () => {
      const groceryExp: Partial<ExpenseItem> = {
        id: 'e-groc',
        description: 'Supermercado Pão de Açúcar',
        amount: 350,
        category: 'comida',
      };
      const streamingExp: Partial<ExpenseItem> = {
        id: 'e-stream',
        description: 'Netflix Mensalidade',
        amount: 55.9,
        category: 'lazer',
      };

      const resolvedGrocery = resolveExpenseClassification(groceryExp, {
        keywordRules: sampleKeywordRules,
        needsBasedMode: false,
      });
      expect(resolvedGrocery.nature).toBe('variavel');
      expect(resolvedGrocery.priority).toBe('essencial');
      expect(resolvedGrocery.policyMacroGroup).toBe('variaveis');
      expect(resolvedGrocery.needsBasedOverride).toBe(false);

      const resolvedStreaming = resolveExpenseClassification(streamingExp, {
        keywordRules: sampleKeywordRules,
        needsBasedMode: false,
      });
      expect(resolvedStreaming.nature).toBe('fixa');
      expect(resolvedStreaming.priority).toBe('dispensavel');
      expect(resolvedStreaming.policyMacroGroup).toBe('fixos');
      expect(resolvedStreaming.needsBasedOverride).toBe(false);
    });

    it('needs-based mode: somente se escolhido explicitamente, supermercado essencial mapeia para fixos sem mudar natureza técnica variável', () => {
      const groceryExp: Partial<ExpenseItem> = {
        id: 'e-groc',
        description: 'Supermercado Pão de Açúcar',
        amount: 350,
        category: 'comida',
      };

      const resolvedGrocery = resolveExpenseClassification(groceryExp, {
        keywordRules: sampleKeywordRules,
        needsBasedMode: true, // Escolha explícita do casal
      });
      expect(resolvedGrocery.nature).toBe('variavel'); // Natureza técnica permanece variável!
      expect(resolvedGrocery.priority).toBe('essencial');
      expect(resolvedGrocery.policyMacroGroup).toBe('fixos'); // Grupo efetivo na política de necessidades
      expect(resolvedGrocery.needsBasedOverride).toBe(true);
    });

    it('precedência única: manual confirmado > regra autorizada > vínculo origem > sugestão automática', () => {
      // 1. Manual confirmado
      const manualItem: Partial<ExpenseItem> = {
        id: 'm1',
        description: 'Netflix Corporativo',
        classificationOrigin: 'manual_confirmed',
        nature: 'fixa',
        priority: 'essencial',
        policyMacroGroup: 'fixos',
        classificationReason: 'Assinatura obrigatória para trabalho',
      };
      const resManual = resolveExpenseClassification(manualItem, { keywordRules: sampleKeywordRules });
      expect(resManual.classificationOrigin).toBe('manual_confirmed');
      expect(resManual.priority).toBe('essencial');

      // 2. Vínculo de origem (conta fixa ou parcela)
      const linkedBillItem: Partial<ExpenseItem> = {
        id: 'b1',
        description: 'Condomínio Mensal',
        linkedBillId: 'bill-cond-1',
      };
      const resBill = resolveExpenseClassification(linkedBillItem, { keywordRules: sampleKeywordRules });
      expect(resBill.classificationOrigin).toBe('origin_link');
      expect(resBill.nature).toBe('fixa');
      expect(resBill.policyMacroGroup).toBe('fixos');

      // 3. Sugestão automática para lançamento não autorizado
      const autoItem: Partial<ExpenseItem> = {
        id: 'u1',
        description: 'Corrida UBER Hospital',
      };
      const resAuto = resolveExpenseClassification(autoItem, { keywordRules: sampleKeywordRules });
      expect(resAuto.classificationOrigin).toBe('auto_suggestion');
      expect(resAuto.nature).toBe('variavel');

      // 4. Lançamento ambíguo fica em 'pendente' mas permanece no total
      const ambiguousItem: Partial<ExpenseItem> = {
        id: 'amb1',
        description: 'Pagamento Desconhecido XYZ 123',
      };
      const resAmbiguous = resolveExpenseClassification(ambiguousItem, { keywordRules: sampleKeywordRules });
      expect(resAmbiguous.policyMacroGroup).toBe('pendente');
    });

    it('divisão explícita (splits) preserva soma exata em centavos em R$ 100,01', () => {
      const splits: TransactionSplit[] = [
        {
          id: 'sp-1',
          amount: 70.0,
          amountCents: 7000,
          category: 'comida',
          nature: 'variavel',
          priority: 'essencial',
          policyMacroGroup: 'variaveis',
          classificationOrigin: 'manual_confirmed',
          notes: 'Alimentos essenciais de mercado',
        },
        {
          id: 'sp-2',
          amount: 30.01,
          amountCents: 3001,
          category: 'lazer',
          nature: 'eventual',
          priority: 'dispensavel',
          policyMacroGroup: 'variaveis',
          classificationOrigin: 'manual_confirmed',
          notes: 'Vinho e petiscos de lazer',
        },
      ];

      const validation = validateTransactionSplits(100.01, splits);
      expect(validation.isValid).toBe(true);
      expect(validation.totalCents).toBe(10001);
      expect(validation.splitSumCents).toBe(10001);
      expect(validation.discrepancyCents).toBe(0);

      // Discrepância de 1 centavo deve ser rejeitada
      const invalidSplits = [
        { ...splits[0], amountCents: 7000 },
        { ...splits[1], amountCents: 3000 }, // Total 10000 cents ao invés de 10001
      ];
      const invalidValidation = validateTransactionSplits(100.01, invalidSplits);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.discrepancyCents).toBe(1);
    });

    it('alcance temporal: future_occurrences não reclassifica competências fechadas', () => {
      const expenses: ExpenseItem[] = [
        {
          id: 'e-past',
          description: 'Streaming Música',
          amount: 20,
          category: 'lazer',
          date: '2026-08-15',
          paidBy: 'partner1',
          nature: 'variavel',
        },
        {
          id: 'e-current',
          description: 'Streaming Música',
          amount: 20,
          category: 'lazer',
          date: '2026-10-15',
          paidBy: 'partner1',
          nature: 'variavel',
        },
        {
          id: 'e-future',
          description: 'Streaming Música',
          amount: 20,
          category: 'lazer',
          date: '2026-11-15',
          paidBy: 'partner1',
          nature: 'variavel',
        },
      ];

      const closedMonths = ['2026-08', '2026-09'];
      const result = applyTemporalScopeUpdate(
        expenses,
        'e-current',
        { nature: 'fixa', priority: 'dispensavel', policyMacroGroup: 'fixos' },
        'future_occurrences',
        closedMonths
      );

      // Mês passado fechado (2026-08) NÃO foi alterado
      const past = result.updatedExpenses.find(e => e.id === 'e-past');
      expect(past?.nature).toBe('variavel');

      // Mês atual e futuro foram atualizados
      const current = result.updatedExpenses.find(e => e.id === 'e-current');
      expect(current?.nature).toBe('fixa');
      const future = result.updatedExpenses.find(e => e.id === 'e-future');
      expect(future?.nature).toBe('fixa');
      expect(result.affectedMonths).toContain('2026-10');
      expect(result.affectedMonths).toContain('2026-11');
      expect(result.affectedMonths).not.toContain('2026-08');
    });
  });

  describe('26A: Contratos Distintos de Dinheiro, Finalidade, Consumo e Orçamento', () => {
    const createBaseState = (): AppState => ({
      profile: {
        partner1Name: 'Matheus',
        partner2Name: 'Beatriz',
        city: 'São Paulo',
        partner1Income: 18000,
        partner2Income: 18000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6.5,
        streakMonths: 6,
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
      monthlyBudgetPlans: {
        '2026-10': {
          competence: '2026-10',
          plannedNetIncome: 36000,
          version: '1.0',
          schemaVersion: '2.0',
          categoryPercentages: {
            moradia: 30,
            comida: 25,
            lazer: 15,
            protecao: 10,
            profissional: 10,
            transporte: 10,
            investimentos: 10,
          },
          categoryAmountsR$: {
            moradia: 10800,
            comida: 9000,
            lazer: 5400,
            protecao: 3600,
            profissional: 3600,
            transporte: 3600,
            investimentos: 3600,
          },
          categoryLocks: {
            moradia: false,
            comida: false,
            lazer: false,
            protecao: false,
            profissional: false,
            transporte: false,
            investimentos: false,
          },
          categoryFloorsR$: {
            moradia: 0,
            comida: 0,
            lazer: 0,
            protecao: 0,
            profissional: 0,
            transporte: 0,
            investimentos: 3600,
          },
          categoryPriorities: {
            moradia: 'P1',
            comida: 'P2',
            lazer: 'P3',
            protecao: 'P1',
            profissional: 'P1',
            transporte: 'P2',
            investimentos: 'P2',
          },
          commitmentsR$: {
            moradia: 0,
            comida: 0,
            lazer: 0,
            protecao: 0,
            profissional: 0,
            transporte: 0,
            investimentos: 0,
          },
          actualSpentR$: {
            moradia: 0,
            comida: 0,
            lazer: 0,
            protecao: 0,
            profissional: 0,
            transporte: 0,
            investimentos: 0,
          },
          requiredMarginR$: {
            moradia: 10800,
            comida: 9000,
            lazer: 5400,
            protecao: 3600,
            profissional: 3600,
            transporte: 3600,
            investimentos: 3600,
          },
          referencePreset: {
            moradia: 30,
            comida: 25,
            lazer: 15,
            protecao: 10,
            profissional: 10,
            transporte: 10,
            investimentos: 10,
          },
          status: 'feasible',
          explanation: 'Plano aprovado',
          conflicts: [],
        },
      },
      expenses: [],
      incomes: [],
      installments: [],
      piggyBanks: [],
      coupleGoals: [],
      linkedAccounts: [],
      alertRules: [],
      notifications: [],
      protectionCurrentAmount: 50000,
      protectionTotalInvested: 50000,
      protectionYieldAccumulated: 0,
      isProtectionComplete: true,
      freedomTotalInvested: 100000,
      freedomYieldAccumulated: 0,
      financialOperations: [],
    });

    it('renda elegível recebida não aumenta por resgate (R$ 36.000 recebidos + R$ 8.000 resgatados = R$ 36.000 de renda e R$ 44.000 de entradas)', () => {
      const state = createBaseState();
      state.incomes = [
        {
          id: 'inc-salario-p1',
          description: 'Salário Líquido P1',
          amount: 18000,
          date: '2026-10-05',
          recipient: 'partner1',
          type: 'salario',
          status: 'received',
          classification: 'pf_net',
        },
        {
          id: 'inc-salario-p2',
          description: 'Salário Líquido P2',
          amount: 18000,
          date: '2026-10-05',
          recipient: 'partner2',
          type: 'salario',
          status: 'received',
          classification: 'pf_net',
        },
        {
          id: 'inc-resgate',
          description: 'Resgate Cofrinho Viagem para Conta',
          amount: 8000,
          date: '2026-10-10',
          recipient: 'both',
          type: 'outro',
          status: 'received',
          classification: 'principal_redemption', // Resgate de patrimônio
        },
      ];

      const eligibleIncome = selectEligibleNetIncomeReceived(state, 'casal', '2026-10');
      expect(eligibleIncome).toBe(36000); // Exclui estritamente os R$ 8.000 de resgate

      const grossInflows = selectGrossBankInflows(state, 'casal', '2026-10');
      expect(grossInflows).toBe(44000); // Entradas bancárias totais refletem os R$ 44.000

      const plannedIncome = selectPlannedNetIncome(state, 'casal', '2026-10');
      expect(plannedIncome).toBe(36000);
    });

    it('gasto direto financiado por caixinha aparece no consumo econômico total e não no teto mensal da categoria', () => {
      const state = createBaseState();
      state.expenses = [
        {
          id: 'exp-aluguel',
          description: 'Aluguel do Apê',
          amount: 3000,
          category: 'moradia',
          date: '2026-10-05',
          paidBy: 'both',
          fundingSource: 'month_budget',
          isExcludedFromMonthlyBudget: false,
        },
        {
          id: 'exp-mobilia-meta',
          description: 'Sofá e Mesa da Reforma',
          amount: 5000,
          category: 'moradia', // Categoria analítica é moradia
          date: '2026-10-12',
          paidBy: 'both',
          fundingSource: 'piggy_bank', // Financiado por objetivo/meta
          fundingGoalId: 'goal-reforma',
          isExcludedFromMonthlyBudget: true, // Não debita teto mensal
        },
      ];

      // O teto mensal de Moradia só deve registrar os R$ 3.000 do orçamento do mês
      const categorySpent = selectCategoryConsumptionExpenses(state, 'casal', '2026-10');
      expect(categorySpent).toBe(3000);

      // O consumo direto financiado por caixinha registra os R$ 5.000
      const goalDirectSpent = selectGoalDirectConsumptionExpenses(state, 'casal', '2026-10');
      expect(goalDirectSpent).toBe(5000);

      // O consumo econômico total registra a soma real de ambos: R$ 8.000
      const totalEconomic = selectTotalEconomicConsumption(state, 'casal', '2026-10');
      expect(totalEconomic).toBe(8000);
    });

    it('validação de fatias exclusivas: R$ 8.000 dividido em R$ 3.000 orçamento e R$ 5.000 compra direta é válido; usar 8k em ambos é rejeitado', () => {
      const availableCents = 800000; // R$ 8.000,00

      // Dividir 3k e 5k
      const validSlice = validatePiggyBankSliceAllocation(availableCents, 300000, 500000);
      expect(validSlice.isValid).toBe(true);
      expect(validSlice.remainingAvailableCents).toBe(0);

      // Tentar usar 8k em ambos (16k total) deve falhar sem clamp silencioso
      const invalidSlice = validatePiggyBankSliceAllocation(availableCents, 800000, 800000);
      expect(invalidSlice.isValid).toBe(false);
      expect(invalidSlice.error).toContain('Saldo disponível insuficiente');
    });

    it('consolidação patrimonial: CDB de R$ 250.000 vinculado a uma meta de R$ 250.000 não duplica patrimônio', () => {
      const state = createBaseState();
      state.linkedAccounts = [
        {
          id: 'cdb-itau-1',
          bankName: 'Itaú Private',
          accountType: 'investimento',
          accountNumber: '12345-6',
          holder: 'both',
          balance: 250000,
          lastSynced: '2026-10-30',
          status: 'connected',
          colorHex: '#EC7000',
          logo: 'itau',
        },
      ];
      state.coupleGoals = [
        {
          id: 'goal-imovel',
          title: 'Entrada do Apartamento',
          category: 'imovel',
          emoji: '🏢',
          targetAmount: 500000,
          currentAmount: 250000,
          partner1Contribution: 125000,
          partner2Contribution: 125000,
          monthlyPlannedDeposit: 5000,
          isCompleted: false,
          history: [],
          createdAt: '2026-01-01',
          linkedBankAccountId: 'cdb-itau-1', // Vínculo explícito de custódia
        },
      ];

      // Total protegido inclui a meta (250k) + reserva (50k) + liberdade (100k) = 400k.
      // O CDB vinculado não deve adicionar outros 250k redundantes (que resultariam em 650k).
      const consolidated = selectConsolidatedAssetTotal(state, 'casal');
      expect(consolidated).toBe(400000); // 250k meta + 50k reserva + 100k liberdade, sem duplicar o CDB!
    });

    it('execução atômica e idempotente de operação financeira sem clamp silencioso', () => {
      const state = createBaseState();
      const goal: CoupleGoal = {
        id: 'goal-viagem',
        title: 'Viagem Japão',
        category: 'viagem',
        emoji: '✈️',
        targetAmount: 20000,
        currentAmount: 5000,
        partner1Contribution: 2500,
        partner2Contribution: 2500,
        monthlyPlannedDeposit: 1000,
        isCompleted: false,
        history: [],
        createdAt: '2026-01-01',
      };
      state.coupleGoals = [goal];
      state.piggyBanks = [
        {
          id: 'goal-viagem',
          name: 'Viagem Japão',
          emoji: '✈️',
          purpose: 'Férias',
          currentAmount: 5000,
          targetAmount: 20000,
          monthlyDeposit: 1000,
        },
      ];

      const opDeposit: FinancialOperationRecord = {
        id: 'op-dep-1',
        type: 'GOAL_DEPOSIT',
        amountCents: 150000,
        amountR$: 1500,
        authorizedBy: 'partner1',
        sourceRef: { type: 'income', id: 'inc-1' },
        targetRef: { type: 'piggy_bank', id: 'goal-viagem' },
        competence: '2026-10',
        date: '2026-10-15',
        revision: 1,
        state: 'processing',
        createdAt: '2026-10-15T12:00:00Z',
      };

      const afterDeposit = executeFinancialOperation(state, opDeposit);
      expect(afterDeposit.coupleGoals?.[0].currentAmount).toBe(6500);
      expect(afterDeposit.piggyBanks?.[0].currentAmount).toBe(6500);

      // Idempotência: reexecutar a mesma operação não aumenta o saldo novamente
      const replayed = executeFinancialOperation(afterDeposit, opDeposit);
      expect(replayed.coupleGoals?.[0].currentAmount).toBe(6500);

      // Tentativa de compra direta com saldo insuficiente deve lançar erro e proibir clamp silencioso
      const opOverspend: FinancialOperationRecord = {
        id: 'op-over-1',
        type: 'GOAL_DIRECT_PURCHASE',
        amountCents: 1000000, // R$ 10.000 excede os R$ 6.500 disponíveis
        amountR$: 10000,
        authorizedBy: 'both',
        sourceRef: { type: 'piggy_bank', id: 'goal-viagem' },
        targetRef: { type: 'expense', id: 'exp-passagens' },
        competence: '2026-10',
        date: '2026-10-16',
        revision: 2,
        state: 'processing',
        createdAt: '2026-10-16T12:00:00Z',
      };

      expect(() => executeFinancialOperation(afterDeposit, opOverspend)).toThrowError(
        /Saldo insuficiente/
      );
    });
  });
});
