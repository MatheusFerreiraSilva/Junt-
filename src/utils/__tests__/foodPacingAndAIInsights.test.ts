import { describe, it, expect } from 'vitest';
import { classifyFoodPillar, calculateFoodPacingMetrics } from '../foodPacingEngine';
import { generateAIPredictiveInsights } from '../aiPredictiveInsightsEngine';
import { ExpenseItem, AppState } from '../../types/finance';

describe('foodPacingEngine', () => {
  it('classifies 3 pillars accurately based on description and amount', () => {
    expect(classifyFoodPillar('Supermercado Carrefour')).toBe('estrutural');
    expect(classifyFoodPillar('Almoço Restaurante por Quilo no Plantão')).toBe('rotina');
    expect(classifyFoodPillar('iFood Hamburgueria')).toBe('conveniencia');
    expect(classifyFoodPillar('Zé Delivery cerveja')).toBe('conveniencia');
  });

  it('recognizes structural stock-up in days 1-10 without false alarm and computes 4 weekly pacing blocks', () => {
    const expenses: ExpenseItem[] = [
      {
        id: 'exp-1',
        description: 'Compra Grande Atacadão Mensal',
        amount: 800,
        category: 'comida',
        paidBy: 'both',
        date: '2026-10-03',
        foodPillar: 'estrutural',
      },
      {
        id: 'exp-2',
        description: 'Almoço plantão',
        amount: 45,
        category: 'comida',
        paidBy: 'partner1',
        date: '2026-10-04',
        foodPillar: 'rotina',
      },
    ];

    const metrics = calculateFoodPacingMetrics(expenses, '2026-10', 2000);

    expect(metrics.totalFoodBudget).toBe(2000);
    expect(metrics.structuralSpent).toBe(800);
    expect(metrics.hasInitialStockup).toBe(true);
    // Operational budget remaining: 2000 - 800 = 1200
    expect(metrics.operationalBudgetRemaining).toBe(1200);
    expect(metrics.weeks.length).toBe(4);
    // Weekly budget per block: 1200 / 4 = 300
    expect(metrics.weeks[0].allocatedBudget).toBe(300);
  });
});

describe('aiPredictiveInsightsEngine', () => {
  it('generates fatigue insight when delivery increases and delivers the 3 one-touch options without guilt', () => {
    const mockState: Partial<AppState> = {
      profile: {
        partner1Name: 'Dra. Bia',
        partner1Specialty: 'Dermatologia',
        partner2Name: 'Dr. Lucas',
        partner2Specialty: 'Cardiologia',
        city: 'São Paulo - SP',
        partner1Income: 8000,
        partner2Income: 7000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6.5,
        streakMonths: 4,
        themeMode: 'light',
        accentTheme: 'emerald',
      },
      piggyBanks: [
        {
          id: 'g1',
          name: 'Viagem Japão',
          emoji: '✈️',
          purpose: 'Férias do casal',
          targetAmount: 20000,
          currentAmount: 8500,
          monthlyDeposit: 1000,
          completed: false,
        },
      ],
      appliedAIInsights: {},
      expenses: [],
    };

    const expenses: ExpenseItem[] = [
      {
        id: 'e1',
        description: 'iFood jantar após plantão 24h',
        amount: 120,
        category: 'comida',
        paidBy: 'both',
        date: '2026-10-18',
        foodPillar: 'conveniencia',
      },
      {
        id: 'e2',
        description: 'iFood almoço hospital',
        amount: 85,
        category: 'comida',
        paidBy: 'both',
        date: '2026-10-19',
        foodPillar: 'conveniencia',
      },
      {
        id: 'e3',
        description: 'Rappi mercado express',
        amount: 90,
        category: 'comida',
        paidBy: 'both',
        date: '2026-10-20',
        foodPillar: 'conveniencia',
      },
    ];

    const foodPacing = calculateFoodPacingMetrics(expenses, '2026-10', 2200);

    const categoriesSpending: any = {
      comida: { spent: 295, budget: 2200, remaining: 1905, percentageUsed: 13, isOver: false },
      lazer: { spent: 200, budget: 800, remaining: 600, percentageUsed: 25, isOver: false },
      moradia: { spent: 2500, budget: 3000, remaining: 500, percentageUsed: 83, isOver: false },
      transporte: { spent: 300, budget: 600, remaining: 300, percentageUsed: 50, isOver: false },
      profissional: { spent: 100, budget: 400, remaining: 300, percentageUsed: 25, isOver: false },
    };

    const insights = generateAIPredictiveInsights({
      categoriesSpending,
      foodPacing,
      expenses,
      currentMonthKey: '2026-10',
      piggyBanks: mockState.piggyBanks || [],
      partner1Name: 'Dra. Bia',
      partner2Name: 'Dr. Lucas',
      appliedInsights: {},
    });

    expect(insights.length).toBeGreaterThan(0);
    // Every insight must strictly have the 3 options
    insights.forEach(insight => {
      expect(insight.options).toBeDefined();
      expect(insight.options.useReward).toBeDefined();
      expect(insight.options.sendToGoal).toBeDefined();
      expect(insight.options.keepBuffer).toBeDefined();
    });
  });
});
