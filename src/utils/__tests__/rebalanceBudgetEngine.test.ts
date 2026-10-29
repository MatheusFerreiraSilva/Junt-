import { describe, it, expect } from 'vitest';
import { rebalanceBudget, RebalanceParams } from '../rebalanceBudgetEngine';

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
});
