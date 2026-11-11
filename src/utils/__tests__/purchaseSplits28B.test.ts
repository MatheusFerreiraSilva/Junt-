import { describe, it, expect } from 'vitest';
import {
  projectExpenseSplits,
  apportionSplitsByPercentage,
  apportionDiscountOrFreight,
  selectSplitsCategorySpending,
  validateTransactionSplits,
} from '../domainSelectors';
import { calculateFoodPacingMetrics } from '../foodPacingEngine';
import { ExpenseItem, TransactionSplit } from '../../types/finance';

describe('Prompt #28B — Compra única com divisão por finalidade', () => {
  // C01: Mercado de R$ 800 com 4 grupos -> Uma única compra e débito; 4 alocações nos agrupamentos
  it('C01: divide compra única de R$ 800 em 4 finalidades respeitando centavos exatos (80.000 centavos)', () => {
    const splits: TransactionSplit[] = [
      {
        id: 'split-1',
        category: 'comida',
        amount: 520,
        amountCents: 52000,
        percentage: 65,
        nature: 'variavel',
        priority: 'necessario',
        label: 'Alimentação do Mês',
        description: 'Alimentação do Mês',
      },
      {
        id: 'split-2',
        category: 'limpeza',
        amount: 90,
        amountCents: 9000,
        percentage: 11.25,
        nature: 'variavel',
        priority: 'necessario',
        label: 'Produtos de Limpeza',
        description: 'Produtos de Limpeza',
      },
      {
        id: 'split-3',
        category: 'lazer',
        amount: 140,
        amountCents: 14000,
        percentage: 17.5,
        nature: 'variavel',
        priority: 'desejo',
        label: 'Snacks e Vinhos',
        description: 'Snacks e Vinhos',
      },
      {
        id: 'split-4',
        category: 'farmacia',
        amount: 50,
        amountCents: 5000,
        percentage: 6.25,
        nature: 'variavel',
        priority: 'necessario',
        label: 'Itens de Higiene e Farmácia',
        description: 'Itens de Higiene e Farmácia',
      },
    ];

    const purchase: ExpenseItem = {
      id: 'exp-mercado-800',
      description: 'Supermercado Mensal',
      store: 'Supermercado Pão de Açúcar',
      amount: 800,
      amountCents: 80000,
      category: 'comida',
      date: '2026-11-05',
      paidBy: 'casal',
      assignedTo: 'casal',
      nature: 'variavel',
      priority: 'necessario',
      splits,
    };

    // Validação de integridade de centavos
    const validation = validateTransactionSplits(800, splits);
    expect(validation.isValid).toBe(true);
    expect(validation.totalSplitsAmount).toBe(800);
    expect(validation.diffCents).toBe(0);

    // Projeção de slices
    const slices = projectExpenseSplits(purchase);
    expect(slices).toHaveLength(4);

    const sumSlices = slices.reduce((acc, s) => acc + s.amount, 0);
    expect(sumSlices).toBe(800);

    // Rateio por categorias no estado global
    const mockState = {
      expenses: [purchase],
    };
    const spendingByCategory = selectSplitsCategorySpending(mockState as any, 'casal', '2026-11');

    expect(spendingByCategory['comida']).toBe(520);
    expect(spendingByCategory['limpeza']).toBe(90);
    expect(spendingByCategory['lazer']).toBe(140);
    expect(spendingByCategory['farmacia']).toBe(50);
  });

  // C02 & C03: Fluxo simples sem divisão projeta slice único virtual
  it('C02/C03: compra simples sem divisão gera slice virtual idêntico ao total e categoria original', () => {
    const simpleExpense: ExpenseItem = {
      id: 'exp-simples-1',
      description: 'Almoço Executivo',
      amount: 45.5,
      amountCents: 4550,
      category: 'comida',
      date: '2026-11-05',
      paidBy: 'partner1',
      nature: 'variavel',
      priority: 'necessario',
    };

    const slices = projectExpenseSplits(simpleExpense);
    expect(slices).toHaveLength(1);
    expect(slices[0].amount).toBe(45.5);
    expect(slices[0].category).toBe('comida');
    expect(slices[0].parentExpenseId).toBe('exp-simples-1');
  });

  // C04 & C25: Finalidade real sem inferência forçada pelo estabelecimento
  it('C04/C25: permite classificar farmácia ou mercado com itens de naturezas e prioridades divergentes', () => {
    const splits: TransactionSplit[] = [
      {
        id: 's1',
        category: 'saude',
        amount: 80,
        amountCents: 8000,
        nature: 'variavel',
        priority: 'necessario',
        label: 'Remédios de Uso Contínuo',
      },
      {
        id: 's2',
        category: 'lazer',
        amount: 30,
        amountCents: 3000,
        nature: 'variavel',
        priority: 'desejo',
        label: 'Chocolates Importados',
      },
    ];

    const validation = validateTransactionSplits(110, splits);
    expect(validation.isValid).toBe(true);

    const slices = projectExpenseSplits({
      id: 'farm-1',
      description: 'Droga Raia',
      store: 'Droga Raia Jardins',
      amount: 110,
      amountCents: 11000,
      category: 'saude',
      date: '2026-11-05',
      paidBy: 'partner2',
      nature: 'variavel',
      priority: 'necessario',
      splits,
    });

    expect(slices[0].category).toBe('saude');
    expect(slices[0].priority).toBe('necessario');
    expect(slices[1].category).toBe('lazer');
    expect(slices[1].priority).toBe('desejo');
  });

  // C05: Rateio percentual com algoritmo Hare-Niemeyer (maiores restos) sem perder centavos
  it('C05: alocação percentual determinística por Hare-Niemeyer para R$ 199,99 fecha em 19.999 centavos exatos', () => {
    const items = [
      { percentage: 33.33, label: 'Parte 1' },
      { percentage: 33.33, label: 'Parte 2' },
      { percentage: 33.34, label: 'Parte 3' },
    ];

    const result = apportionSplitsByPercentage(199.99, items);
    const totalCents = result.reduce((sum, item) => sum + item.amountCents, 0);
    const totalAmount = result.reduce((sum, item) => sum + item.amount, 0);

    expect(totalCents).toBe(19999);
    expect(Math.round(totalAmount * 100)).toBe(19999);
  });

  // C06: Frete e desconto preservam total líquido
  it('C06: rateio de frete e desconto preserva soma líquida exata', () => {
    const baseSplits: TransactionSplit[] = [
      { id: '1', category: 'casa', amount: 100, amountCents: 10000, nature: 'variavel', priority: 'necessario' },
      { id: '2', category: 'vestuario', amount: 100, amountCents: 10000, nature: 'variavel', priority: 'desejo' },
    ];

    // Frete de R$ 20 distribuído proporcionalmente
    const splitsWithFreight = apportionDiscountOrFreight(baseSplits, 20, 'freight');
    const totalWithFreight = splitsWithFreight.reduce((s, x) => s + x.amount, 0);
    expect(totalWithFreight).toBe(220);
    expect(splitsWithFreight[0].amount).toBe(110);
    expect(splitsWithFreight[1].amount).toBe(110);

    // Desconto de R$ 30 distribuído proporcionalmente
    const splitsWithDiscount = apportionDiscountOrFreight(baseSplits, 30, 'discount');
    const totalWithDiscount = splitsWithDiscount.reduce((s, x) => s + x.amount, 0);
    expect(totalWithDiscount).toBe(170);
    expect(splitsWithDiscount[0].amount).toBe(85);
    expect(splitsWithDiscount[1].amount).toBe(85);
  });

  // C19: Titularidade (assignedTo) e pagador (paidBy) operam de forma independente
  it('C19: suporta compra do casal paga por um dos cônjuges com assignedTo e paidBy desacoplados', () => {
    const expense: ExpenseItem = {
      id: 'compra-casal-p1',
      description: 'Supermercado Geral',
      amount: 300,
      amountCents: 30000,
      category: 'comida',
      date: '2026-11-05',
      paidBy: 'partner1', // Quem desembolsou
      assignedTo: 'casal', // Titularidade da despesa
      nature: 'variavel',
      priority: 'necessario',
      splits: [
        { id: 's1', category: 'comida', amount: 200, amountCents: 20000, assignedTo: 'casal' },
        { id: 's2', category: 'lazer', amount: 100, amountCents: 10000, assignedTo: 'partner2' },
      ],
    };

    const slices = projectExpenseSplits(expense);
    expect(slices[0].assignedTo).toBe('casal');
    expect(slices[0].paidBy).toBe('partner1');
    expect(slices[1].assignedTo).toBe('partner2');
    expect(slices[1].paidBy).toBe('partner1');
  });

  // C44: Food Pacing Engine isola estritamente fatias de comida de compras divididas
  it('C44: food pacing considera unicamente as fatias de comida e ignora fatias de outras categorias em compra de mercado', () => {
    const expenses: ExpenseItem[] = [
      {
        id: 'mercado-dividido',
        description: 'Hipermercado Grande',
        amount: 800,
        amountCents: 80000,
        category: 'comida',
        date: '2026-11-03',
        paidBy: 'casal',
        nature: 'variavel',
        priority: 'necessario',
        splits: [
          {
            id: 's-comida',
            category: 'comida',
            amount: 520,
            amountCents: 52000,
            description: 'Abastecimento Mensal de Alimentos',
            nature: 'variavel',
            priority: 'necessario',
          },
          {
            id: 's-limpeza',
            category: 'limpeza',
            amount: 90,
            amountCents: 9000,
            description: 'Sabão em pó e desinfetante',
          },
          {
            id: 's-lazer',
            category: 'lazer',
            amount: 190,
            amountCents: 19000,
            description: 'Vinhos e petiscos',
          },
        ],
      },
    ];

    const metrics = calculateFoodPacingMetrics(expenses, '2026-11', 2000);

    // Apenas R$ 520 de comida devem ser computados no totalFoodSpent, e não R$ 800!
    expect(metrics.totalFoodSpent).toBe(520);
    expect(metrics.hasInitialStockup).toBe(true); // 520 >= 300 ou 20%
    expect(metrics.structuralSpent).toBe(520); // 'Abastecimento Mensal' classificado como estrutural
  });
});
