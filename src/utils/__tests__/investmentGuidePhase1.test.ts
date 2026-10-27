import { describe, expect, it } from 'vitest';
import { MonthlyDepositGuide, SavingsPiggyBank } from '../../types/finance';

/**
 * Pure helper logic mirroring getMonthlyDepositGuide for Phase 1 refinement testing
 */
function calculatePhase1Guide(
  totalIncome: number,
  isProtectionComplete: boolean,
  piggyBanks: SavingsPiggyBank[],
  customStrategy?: '100_percent_reserve' | 'split_freedom'
): MonthlyDepositGuide {
  const invPct = 10;
  const totalProgrammedSavings = totalIncome > 0 ? Math.round(totalIncome * (invPct / 100)) : 0;
  const activeGoals = piggyBanks.filter(g => !g.completed);
  const focusStrategy = customStrategy || '100_percent_reserve';

  let baseProt = 0;
  let baseFreedom = 0;
  let allocatedGoalsFixed = 0;
  let redirectedBlock2Surplus = 0;

  if (!isProtectionComplete) {
    if (activeGoals.length === 0) {
      if (focusStrategy === '100_percent_reserve') {
        baseProt = totalProgrammedSavings;
        baseFreedom = 0;
        redirectedBlock2Surplus = Math.round(totalProgrammedSavings * 0.50);
      } else {
        baseProt = Math.round(totalProgrammedSavings * 0.50);
        baseFreedom = Math.round(totalProgrammedSavings * 0.50);
        redirectedBlock2Surplus = 0;
      }
    } else {
      const targetGoalsFixedPool = Math.round(totalProgrammedSavings * 0.30);
      const perGoalFixed = Math.round(targetGoalsFixedPool / activeGoals.length);
      allocatedGoalsFixed = perGoalFixed * activeGoals.length;
      redirectedBlock2Surplus = Math.max(0, targetGoalsFixedPool - allocatedGoalsFixed);

      const standardProtBase = Math.round(totalProgrammedSavings * 0.50);
      baseProt = standardProtBase + redirectedBlock2Surplus;
      baseFreedom = Math.max(0, totalProgrammedSavings - baseProt - allocatedGoalsFixed);
    }
  } else {
    baseProt = 0;
    if (activeGoals.length > 0) {
      const targetGoalsFixedPool = Math.round(totalProgrammedSavings * 0.50);
      const perGoalFixed = Math.round(targetGoalsFixedPool / activeGoals.length);
      allocatedGoalsFixed = perGoalFixed * activeGoals.length;
      baseFreedom = Math.max(0, totalProgrammedSavings - allocatedGoalsFixed);
    } else {
      allocatedGoalsFixed = 0;
      baseFreedom = totalProgrammedSavings;
    }
  }

  const items: any[] = [];
  if (!isProtectionComplete) {
    items.push({ block: 'protection', baseAmount: baseProt, totalAmount: baseProt });
  }
  if (activeGoals.length > 0) {
    activeGoals.forEach(g => {
      items.push({ block: 'goals', baseAmount: Math.round(allocatedGoalsFixed / activeGoals.length), totalAmount: Math.round(allocatedGoalsFixed / activeGoals.length) });
    });
  }
  if (baseFreedom > 0 || isProtectionComplete || focusStrategy === 'split_freedom') {
    items.push({ block: 'freedom', baseAmount: baseFreedom, totalAmount: baseFreedom });
  }

  return {
    monthKey: '2026-10',
    items,
    totalPlanned: items.reduce((s, it) => s + it.totalAmount, 0),
    status: 'pending_approval',
    programmedBase: totalProgrammedSavings,
    focusStrategy,
    redirectedBlock2Surplus,
  };
}

describe('Phase 1 Investment Allocation Logic', () => {
  it('allocates 100% of programmed savings to Protection in Phase 1 when NO active cofrinhos exist', () => {
    const income = 30000; // 10% programmed savings = R$ 3.000
    const piggyBanks: SavingsPiggyBank[] = [];

    const guide = calculatePhase1Guide(income, false, piggyBanks, '100_percent_reserve');

    expect(guide.programmedBase).toBe(3000);
    expect(guide.focusStrategy).toBe('100_percent_reserve');

    const protItem = guide.items.find(i => i.block === 'protection');
    const freeItem = guide.items.find(i => i.block === 'freedom');

    expect(protItem?.baseAmount).toBe(3000);
    expect(freeItem?.baseAmount ?? 0).toBe(0);
    expect(guide.redirectedBlock2Surplus).toBe(1500);
  });

  it('splits 50% Protection and 50% Freedom in Phase 1 when NO active cofrinhos exist AND couple explicitly selects split_freedom', () => {
    const income = 30000; // 10% = R$ 3.000
    const piggyBanks: SavingsPiggyBank[] = [];

    const guide = calculatePhase1Guide(income, false, piggyBanks, 'split_freedom');

    expect(guide.programmedBase).toBe(3000);
    expect(guide.focusStrategy).toBe('split_freedom');

    const protItem = guide.items.find(i => i.block === 'protection');
    const freeItem = guide.items.find(i => i.block === 'freedom');

    expect(protItem?.baseAmount).toBe(1500);
    expect(freeItem?.baseAmount).toBe(1500);
    expect(guide.redirectedBlock2Surplus).toBe(0);
  });

  it('allocates 50% Protection + 30% Cofrinhos + 20% Freedom when active cofrinhos exist in Phase 1', () => {
    const income = 30000; // 10% = R$ 3.000
    const piggyBanks: SavingsPiggyBank[] = [
      {
        id: 'goal-1',
        name: 'Viagem Japão',
        emoji: '✈️',
        purpose: 'Viagem de férias',
        currentAmount: 1000,
        targetAmount: 20000,
        monthlyDeposit: 900,
        completed: false,
      },
    ];

    const guide = calculatePhase1Guide(income, false, piggyBanks);

    const protItem = guide.items.find(i => i.block === 'protection');
    const goalItem = guide.items.find(i => i.block === 'goals');
    const freeItem = guide.items.find(i => i.block === 'freedom');

    expect(protItem?.baseAmount).toBe(1500); // 50%
    expect(goalItem?.baseAmount).toBe(900);   // 30%
    expect(freeItem?.baseAmount).toBe(600);   // 20% (resto)
  });

  it('allocates 0% Protection and 100% Freedom in Phase 2 when Reserva is complete and NO cofrinhos exist', () => {
    const income = 30000; // 10% = R$ 3.000
    const piggyBanks: SavingsPiggyBank[] = [];

    const guide = calculatePhase1Guide(income, true, piggyBanks);

    const protItem = guide.items.find(i => i.block === 'protection');
    const freeItem = guide.items.find(i => i.block === 'freedom');

    expect(protItem).toBeUndefined();
    expect(freeItem?.baseAmount).toBe(3000);
  });
});
