import {
  AppState,
  ExpenseItem,
  IncomeItem,
  InstallmentPurchase,
  FixedBillAlert,
  SavingsPiggyBank,
  CoupleGoal,
  MedicalShift,
  BankImportedTransaction,
  SurplusTransferRecord,
  CategoryKey,
  BudgetPlanContract,
  MacroGroupKey,
  MacroGroupAllocation,
  BudgetPlanPolicyMeta,
  DestinationKey,
  ExpenseNature,
  ExpensePriority,
  PolicyMacroGroup,
  ClassificationOrigin,
  TemporalScope,
  TransactionSplit,
  CategoryKeywordRule,
  FinancialOperationRecord,
  FinancialOperationType,
  FinancialOperationState,
} from '../types/finance';

export type DomainScope = 'casal' | 'partner1' | 'partner2';
export type AccountingBasis = 'caixa' | 'competencia' | 'plano';

export type FinancialEventType =
  | 'ECONOMIC_EXPENSE'       // Lançamento econômico de consumo (aluguel, mercado, lazer)
  | 'ECONOMIC_INCOME'        // Receita líquida recebida (salário, bolsa, plantão)
  | 'RESERVE_APORTE'         // Transferência para reserva/cofrinho (reduz caixa operacional, eleva patrimônio)
  | 'RESERVE_RESGATE'         // Resgate da reserva/cofrinho (eleva caixa operacional, reduz patrimônio)
  | 'COUPLE_SETTLEMENT'      // Acerto financeiro entre parceiros (transferência interna P1 <-> P2)
  | 'OBLIGATION_FORECAST'    // Previsão/Obrigação futura (conta fixa pendente, parcela vincenda)
  | 'RECEIVABLE_FORECAST';   // Recebível futuro (plantão realizado/agendado aguardando pagamento)

export interface NormalizedFinancialEvent {
  id: string;
  eventType: FinancialEventType;
  title: string;
  amount: number; // Em centavos de Real preservados (ex: 150.50)
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  owner: 'partner1' | 'partner2' | 'both';
  category?: CategoryKey;
  targetGoalId?: string;
  canonicalSource: string;
  affectsMonthlyBudget: boolean;
  affectsLiquidCash: boolean;
  affectsNetWorth: boolean;
}

/**
  * Safely rounds amounts to exactly 2 decimal places to prevent float precision drift.
  */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
  * Checks if an entity belongs to the requested scope.
  */
export function isEntityInScope(
  owner: 'partner1' | 'partner2' | 'both' | 'custom' | undefined,
  scope: DomainScope
): boolean {
  if (scope === 'casal') return true;
  if (!owner || owner === 'both') return true;
  return owner === scope;
}

/**
  * Selects all canonical economic incomes for a given scope and month.
  */
export function selectCanonicalIncomes(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): IncomeItem[] {
  const incomes = state.incomes || [];
  return incomes.filter((inc) => {
    if (monthKey && inc.date && !inc.date.startsWith(monthKey)) return false;
    const recipientOwner = inc.recipient === 'partner1' ? 'partner1' : inc.recipient === 'partner2' ? 'partner2' : 'both';
    return isEntityInScope(recipientOwner, scope);
  });
}

/**
  * Computes total effective economic income for scope and month.
  */
export function selectEffectiveIncomeTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const incomes = selectCanonicalIncomes(state, 'casal', monthKey);
  const total = incomes.reduce((sum, inc) => {
    if (scope === 'casal') return sum + (inc.amount || 0);
    if (inc.recipient === scope) return sum + (inc.amount || 0);
    if (inc.recipient === 'both') return sum + (inc.amount || 0) * 0.5;
    return sum;
  }, 0);
  return roundMoney(total);
}

/**
  * Selects all canonical consumption expenses (excluding excluded/internal funding items).
  */
export function selectCanonicalConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): ExpenseItem[] {
  const expenses = state.expenses || [];
  return expenses.filter((exp) => {
    if (monthKey && exp.date && !exp.date.startsWith(monthKey)) return false;
    if (exp.isExcludedFromMonthlyBudget) return false;
    return isEntityInScope(exp.paidBy, scope);
  });
}

/**
  * Computes total consumption expenses for scope and month.
  */
export function selectConsumptionExpensesTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = selectCanonicalConsumptionExpenses(state, 'casal', monthKey);
  const total = expenses.reduce((sum, exp) => {
    if (scope === 'casal') return sum + (exp.amount || 0);
    if (exp.paidBy === scope) return sum + (exp.amount || 0);
    if (exp.paidBy === 'both') {
      const pct = scope === 'partner1' ? (exp.splitPartner1Pct ?? 50) : (exp.splitPartner2Pct ?? 50);
      return sum + ((exp.amount || 0) * pct) / 100;
    }
    return sum;
  }, 0);
  return roundMoney(total);
}

/**
  * Computes pending financial obligations (fixed bills + credit installments) due in monthKey not yet in expenses.
  */
export function selectPendingObligationsTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  if (!monthKey) return 0;
  let total = 0;

  const currentMonthExpenses = (state.expenses || []).filter((e) => e.date && e.date.startsWith(monthKey));

  // A) Pending fixed bills
  (state.coupleFixedBills || []).forEach((bill) => {
    if (bill.status === 'paid') return;
    if (!isEntityInScope(bill.assignedPayer, scope)) return;

    const dueDayStr = String(bill.dueDay).padStart(2, '0');
    const fullDate = `${monthKey}-${dueDayStr}`;
    const alreadyInExpenses = currentMonthExpenses.some(
      (e) => e.description.toLowerCase().trim() === bill.title.toLowerCase().trim() && e.date === fullDate
    );
    if (!alreadyInExpenses) {
      total += bill.amount || 0;
    }
  });

  // B) Pending active credit card installments
  (state.installments || []).forEach((inst) => {
    if (!inst.active) return;
    if (!isEntityInScope(inst.paidBy, scope)) return;

    const alreadyInExpenses = currentMonthExpenses.some((e) => e.installmentId === inst.id);
    if (!alreadyInExpenses) {
      total += inst.installmentAmount || 0;
    }
  });

  return roundMoney(total);
}

/**
  * Computes total liquid operational cash balance by summing connected bank accounts and adjusting for incomes, expenses, and reserve transfers.
  */
export function selectLiquidOperationalCash(
  state: AppState,
  scope: DomainScope = 'casal'
): number {
  const linkedAccounts = state.linkedAccounts || [];
  const pluggyAccounts = state.pluggyAccounts || [];

  let baseBankBalance = 0;

  linkedAccounts.forEach((acc) => {
    if (isEntityInScope(acc.holder, scope)) {
      baseBankBalance += acc.balance || 0;
    }
  });

  pluggyAccounts.forEach((acc) => {
    if (acc.status === 'connected' && acc.accountType === 'corrente') {
      if (isEntityInScope(acc.owner, scope)) {
        baseBankBalance += acc.balance || 0;
      }
    }
  });

  return roundMoney(baseBankBalance);
}

/**
  * Selects configured annual yield percentage (above inflation), respecting explicit 0%.
  */
export function selectAnnualYield(state: AppState): number {
  if (state.profile?.expectedYieldAnnual !== undefined && state.profile?.expectedYieldAnnual !== null) {
    return state.profile.expectedYieldAnnual;
  }
  return 6.5; // Default fallback only when undefined or null
}

/**
  * Selects emergency reserve metrics (Block 1).
  */
export function selectEmergencyReserveMetrics(state: AppState, monthlyExpenses: number) {
  const currentAmount = state.protectionCurrentAmount || 0;
  const totalInvested = state.protectionTotalInvested || 0;
  const yieldAccumulated = state.protectionYieldAccumulated ?? (currentAmount - totalInvested);
  const targetMonths = state.profile?.emergencyReserveMonthsTarget || 6;
  const targetAmount = roundMoney(monthlyExpenses * targetMonths);
  const monthsCovered = monthlyExpenses > 0 ? Number((currentAmount / monthlyExpenses).toFixed(1)) : 0;

  return {
    currentAmount: roundMoney(currentAmount),
    totalInvested: roundMoney(totalInvested),
    yieldAccumulated: roundMoney(yieldAccumulated),
    targetMonths,
    targetAmount,
    monthsCovered,
    isComplete: currentAmount >= targetAmount && targetAmount > 0,
  };
}

/**
  * Selects Freedom Investment metrics (Block 3).
  * Preserves negative yield returns when market value drops below invested amount.
  */
export function selectFreedomMetrics(state: AppState) {
  const totalInvested = state.freedomTotalInvested || 0;
  const yieldAccumulated = state.freedomYieldAccumulated ?? 0;
  const currentAmount = roundMoney(totalInvested + yieldAccumulated);

  return {
    totalInvested: roundMoney(totalInvested),
    yieldAccumulated: roundMoney(yieldAccumulated),
    currentAmount,
  };
}

/**
  * Selects Piggy Banks and Couple Goals metrics (Block 2).
  * Separates short-term consumption goals from FIRE-eligible long-term capital.
  */
export function selectPiggyAndGoalsMetrics(state: AppState) {
  const piggyBanks = state.piggyBanks || [];
  const coupleGoals = state.coupleGoals || [];

  let totalPiggyAmount = 0;
  let totalPiggyInvested = 0;
  let totalPiggyYield = 0;
  let fireEligibleGoalsAmount = 0;
  let monthlyPlannedPace = 0;

  piggyBanks.forEach((pb) => {
    const cur = pb.currentAmount || 0;
    const inv = pb.totalInvested ?? cur;
    const yld = pb.yieldAccumulated ?? (cur - inv);
    totalPiggyAmount += cur;
    totalPiggyInvested += inv;
    totalPiggyYield += yld;
    monthlyPlannedPace += pb.monthlyDeposit || 0;

    if (pb.isFireEligible) {
      fireEligibleGoalsAmount += cur;
    }
  });

  coupleGoals.forEach((cg) => {
    const existsInPiggy = piggyBanks.some((pb) => pb.id === cg.id);
    if (!existsInPiggy) {
      const cur = cg.currentAmount || 0;
      totalPiggyAmount += cur;
      monthlyPlannedPace += cg.monthlyPlannedDeposit || 0;
      if (cg.category === 'liberdade' || cg.category === 'reserva') {
        fireEligibleGoalsAmount += cur;
      }
    }
  });

  return {
    totalPiggyAmount: roundMoney(totalPiggyAmount),
    totalPiggyInvested: roundMoney(totalPiggyInvested),
    totalPiggyYield: roundMoney(totalPiggyYield),
    fireEligibleGoalsAmount: roundMoney(fireEligibleGoalsAmount),
    monthlyPlannedPace: roundMoney(monthlyPlannedPace),
  };
}

/**
  * Computes canonical FIRE metrics using Block 3 + FIRE eligible goals.
  */
export function selectFIREMetrics(
  state: AppState,
  monthlyExpenses: number,
  customInvestmentPace?: number
) {
  const annualYieldPct = selectAnnualYield(state);
  const annualYield = annualYieldPct / 100;
  const monthlyRate = annualYield / 12;

  const freedomMetrics = selectFreedomMetrics(state);
  const piggyMetrics = selectPiggyAndGoalsMetrics(state);

  // Eligible FIRE Capital strictly = Block 3 (Freedom) + FIRE Eligible Goals
  const fireEligibleCapital = roundMoney(freedomMetrics.currentAmount + piggyMetrics.fireEligibleGoalsAmount);
  const fireTargetNetWorth = roundMoney(monthlyExpenses * 300); // 300x monthly (25x annual)
  const fireProgressPct = fireTargetNetWorth > 0
    ? Math.min(100, Math.round((fireEligibleCapital / fireTargetNetWorth) * 100))
    : 0;

  const monthlyInvestmentPace = customInvestmentPace !== undefined
    ? customInvestmentPace
    : piggyMetrics.monthlyPlannedPace;

  let estimatedYearsToFIRE: number = Infinity;

  if (fireTargetNetWorth <= 0) {
    estimatedYearsToFIRE = 0;
  } else if (fireEligibleCapital >= fireTargetNetWorth) {
    estimatedYearsToFIRE = 0;
  } else if (monthlyInvestmentPace <= 0) {
    if (monthlyRate > 0 && fireEligibleCapital > 0) {
      let sim = fireEligibleCapital;
      let months = 0;
      while (sim < fireTargetNetWorth && months < 600) {
        sim = sim * (1 + monthlyRate);
        months++;
      }
      if (sim >= fireTargetNetWorth) {
        estimatedYearsToFIRE = Number((months / 12).toFixed(1));
      } else {
        estimatedYearsToFIRE = Infinity;
      }
    } else {
      estimatedYearsToFIRE = Infinity;
    }
  } else {
    let sim = fireEligibleCapital;
    let months = 0;
    while (sim < fireTargetNetWorth && months < 600) {
      sim = (sim + monthlyInvestmentPace) * (1 + monthlyRate);
      months++;
    }
    if (sim >= fireTargetNetWorth) {
      estimatedYearsToFIRE = Number((months / 12).toFixed(1));
    } else {
      estimatedYearsToFIRE = Infinity;
    }
  }

  return {
    fireEligibleCapital,
    fireTargetNetWorth,
    fireProgressPct,
    estimatedYearsToFIRE,
    monthlyInvestmentPace,
    annualYieldPct,
  };
}

/**
  * Computes total protected assets (Emergency Reserve + Freedom Investments + Piggy Banks / Couple Goals).
  */
export function selectTotalProtectedAssets(
  state: AppState,
  scope: DomainScope = 'casal'
): {
  protection: number;
  freedom: number;
  goalsAndPiggyBanks: number;
  totalProtected: number;
} {
  const protection = roundMoney(state.protectionCurrentAmount || 0);
  const freedom = selectFreedomMetrics(state).currentAmount;
  const goalsAndPiggyBanks = selectPiggyAndGoalsMetrics(state).totalPiggyAmount;

  let protectionShare = protection;
  let freedomShare = freedom;
  let goalsShare = goalsAndPiggyBanks;

  if (scope !== 'casal') {
    protectionShare = roundMoney(protection / 2);
    freedomShare = roundMoney(freedom / 2);
    goalsShare = roundMoney(goalsAndPiggyBanks / 2);
  }

  const totalProtected = roundMoney(protectionShare + freedomShare + goalsShare);

  return {
    protection: protectionShare,
    freedom: freedomShare,
    goalsAndPiggyBanks: goalsShare,
    totalProtected,
  };
}

/**
  * Computes total Net Worth (Liquid Operational Cash + Protected Assets).
  */
export function selectTotalNetWorth(
  state: AppState,
  scope: DomainScope = 'casal'
): number {
  const liquidCash = selectLiquidOperationalCash(state, scope);
  const { totalProtected } = selectTotalProtectedAssets(state, scope);
  return roundMoney(liquidCash + totalProtected);
}

/**
  * Validates domain mathematical integrity:
  * Ensures P1_Total + P2_Total + Joint_Unassigned === Consolidado_Casal without orphaned drift.
  */
export function validateDomainChecksum(
  state: AppState,
  monthKey: string
): {
  isChecksumValid: boolean;
  p1Income: number;
  p2Income: number;
  coupleIncome: number;
  p1Expenses: number;
  p2Expenses: number;
  coupleExpenses: number;
  incomeDiscrepancy: number;
  expenseDiscrepancy: number;
} {
  const p1Income = selectEffectiveIncomeTotal(state, 'partner1', monthKey);
  const p2Income = selectEffectiveIncomeTotal(state, 'partner2', monthKey);
  const coupleIncome = selectEffectiveIncomeTotal(state, 'casal', monthKey);

  const p1Expenses = selectConsumptionExpensesTotal(state, 'partner1', monthKey);
  const p2Expenses = selectConsumptionExpensesTotal(state, 'partner2', monthKey);
  const coupleExpenses = selectConsumptionExpensesTotal(state, 'casal', monthKey);

  const incomeDiscrepancy = roundMoney(coupleIncome - (p1Income + p2Income));
  const expenseDiscrepancy = roundMoney(coupleExpenses - (p1Expenses + p2Expenses));

  // In standard model, items owned by 'both' belong to couple total and split between P1 & P2
  const isChecksumValid = Math.abs(incomeDiscrepancy) <= 0.05 && Math.abs(expenseDiscrepancy) <= 0.05;

  return {
    isChecksumValid,
    p1Income,
    p2Income,
    coupleIncome,
    p1Expenses,
    p2Expenses,
    coupleExpenses,
    incomeDiscrepancy,
    expenseDiscrepancy,
  };
}

/**
 * Default mapping of categories to macro groups (fixos vs variaveis).
 * Essentiality is a separate dimension: food (essential) can be variable; streaming (recurrent) can be fixed.
 */
export const DEFAULT_CATEGORY_GROUP_MAPPING: Record<CategoryKey, 'fixos' | 'variaveis'> = {
  moradia: 'fixos',
  protecao: 'fixos',
  comida: 'variaveis',
  lazer: 'variaveis',
  transporte: 'variaveis',
  profissional: 'variaveis',
};

/**
 * Calculates the eligible net income for a month and scope.
 * EXCLUDES non-income movements:
 * - Internal transfers, loans, principal redemptions, refunds
 * - Reinvested passive income (unless explicitly flagged to include)
 * - Unconfirmed shift projections / forecasts (previsão não é caixa)
 * Handles PJ gross revenue deductions without double-deducting PF net salary.
 */
export function selectEligibleNetIncome(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string,
  options: { includePassiveReinvested?: boolean } = {}
): number {
  const incomes = state.incomes || [];
  const nonEligibleClassifications = new Set([
    'internal_transfer',
    'loan',
    'emprestimo',
    'principal_redemption',
    'resgate_principal',
    'refund',
    'reembolso',
  ]);

  if (!options.includePassiveReinvested) {
    nonEligibleClassifications.add('passive_reinvested');
    nonEligibleClassifications.add('renda_passiva_reinvestida');
  }

  const eligibleIncomes = incomes.filter((inc) => {
    if (monthKey && inc.date && !inc.date.startsWith(monthKey)) return false;
    if (inc.status === 'internal_transfer') return false;
    if (inc.classification && nonEligibleClassifications.has(inc.classification)) return false;
    // Unconfirmed forecasts / predictions are not cash
    if (inc.classification === 'forecast' || inc.status === 'pending' || inc.status === 'projected') return false;
    const recipientOwner = inc.recipient === 'partner1' ? 'partner1' : inc.recipient === 'partner2' ? 'partner2' : 'both';
    return isEntityInScope(recipientOwner, scope);
  });

  const total = eligibleIncomes.reduce((sum, inc) => {
    let rawAmount = inc.amount || 0;
    // Calculate net for PJ gross revenue if tax rate / deductions specified
    if (inc.classification === 'pj_gross' && inc.taxRatePercent !== undefined && inc.taxRatePercent > 0) {
      const tax = (rawAmount * Math.min(40, Math.max(0, inc.taxRatePercent))) / 100;
      const accounting = inc.monthlyAccountingCost || 0;
      rawAmount = Math.max(0, rawAmount - tax - accounting);
    }

    if (scope === 'casal') return sum + rawAmount;
    if (inc.recipient === scope) return sum + rawAmount;
    if (inc.recipient === 'both') return sum + rawAmount * 0.5;
    return sum;
  }, 0);

  return roundMoney(total);
}

export interface PolicyAllocationResult {
  eligibleNetIncome: number;
  totalCents: number;
  policy: {
    fixedPct: number;
    varPct: number;
    investPct: number;
  };
  macroGroups: {
    fixos: { percentage: number; amountR$: number; cents: number };
    variaveis: { percentage: number; amountR$: number; cents: number };
    investimentos: { percentage: number; amountR$: number; cents: number };
  };
}

/**
 * Deterministic integer cents allocation for a policy ratio (default 60% fixos / 30% variáveis / 10% investimentos).
 * Guarantees exact cent sum without float precision loss.
 * Income <= 0 yields 0% executed, R$ 0 targets, and no fake investment goals.
 */
export function allocateIncomeByPolicy(
  eligibleNetIncome: number,
  policy = { fixedPct: 60, varPct: 30, investPct: 10 }
): PolicyAllocationResult {
  const safeIncome = Math.max(0, eligibleNetIncome);
  const totalCents = Math.round(safeIncome * 100);

  if (totalCents <= 0) {
    return {
      eligibleNetIncome: 0,
      totalCents: 0,
      policy,
      macroGroups: {
        fixos: { percentage: policy.fixedPct, amountR$: 0, cents: 0 },
        variaveis: { percentage: policy.varPct, amountR$: 0, cents: 0 },
        investimentos: { percentage: policy.investPct, amountR$: 0, cents: 0 },
      },
    };
  }

  const fixedCents = Math.round(totalCents * (policy.fixedPct / 100));
  const varCents = Math.round(totalCents * (policy.varPct / 100));
  const investCents = totalCents - fixedCents - varCents; // Residual integer cents assignment to exact sum

  return {
    eligibleNetIncome: safeIncome,
    totalCents,
    policy,
    macroGroups: {
      fixos: { percentage: policy.fixedPct, amountR$: fixedCents / 100, cents: fixedCents },
      variaveis: { percentage: policy.varPct, amountR$: varCents / 100, cents: varCents },
      investimentos: { percentage: policy.investPct, amountR$: investCents / 100, cents: investCents },
    },
  };
}

/**
 * Upgrades historical or partial BudgetPlanContract to full Contract v2.0 without losing approvals or locks.
 */
export function upgradeBudgetPlanContract(plan: Partial<BudgetPlanContract>): BudgetPlanContract {
  const competence = plan.competence || '2026-10';
  const plannedNetIncome = Math.max(0, plan.plannedNetIncome || 0);

  const defaultCategoryPercentages: Record<DestinationKey, number> = {
    moradia: 30,
    protecao: 10,
    comida: 25,
    lazer: 15,
    transporte: 10,
    profissional: 0,
    investimentos: 10,
  };

  const categoryPercentages: Record<DestinationKey, number> = {
    ...defaultCategoryPercentages,
    ...(plan.categoryPercentages || {}),
  };

  const categoryAmountsR$: Record<DestinationKey, number> = {} as any;
  for (const k of Object.keys(categoryPercentages) as DestinationKey[]) {
    categoryAmountsR$[k] = roundMoney((plannedNetIncome * (categoryPercentages[k] || 0)) / 100);
  }

  const groupMapping = {
    ...DEFAULT_CATEGORY_GROUP_MAPPING,
    ...(plan.categoryGroupMapping || {}),
  };

  let fixosPct = (categoryPercentages.moradia || 0) + (categoryPercentages.protecao || 0);
  let varPct = (categoryPercentages.comida || 0) + (categoryPercentages.lazer || 0) + (categoryPercentages.transporte || 0) + (categoryPercentages.profissional || 0);
  let investPct = categoryPercentages.investimentos ?? 10;

  const totalGroupPct = fixosPct + varPct + investPct;
  if (Math.abs(totalGroupPct - 100) > 0.01) {
    fixosPct = 60;
    varPct = 30;
    investPct = 10;
  }

  const allocation = allocateIncomeByPolicy(plannedNetIncome, { fixedPct: fixosPct, varPct, investPct });

  const macroGroups = plan.macroGroups || {
    fixos: { percentage: fixosPct, amountR$: allocation.macroGroups.fixos.amountR$ },
    variaveis: { percentage: varPct, amountR$: allocation.macroGroups.variaveis.amountR$ },
    investimentos: { percentage: investPct, amountR$: allocation.macroGroups.investimentos.amountR$ },
  };

  const policyMeta: BudgetPlanPolicyMeta = plan.policyMeta || {
    policyId: `policy-${fixosPct}-${varPct}-${investPct}`,
    policyName: `Política Orçamentária ${fixosPct}/${varPct}/${investPct}`,
    policyVersion: '1.0',
    validFrom: competence,
    authoredByUid: plan.approvedBy,
    incomeSourceMode: 'planned_net',
  };

  return {
    id: plan.id || competence,
    competence,
    plannedNetIncome,
    version: plan.version || new Date().toISOString(),
    schemaVersion: '2.0',
    planRevision: plan.planRevision || 1,
    policyMeta,
    macroGroups,
    categoryGroupMapping: groupMapping,
    categoryPercentages,
    categoryAmountsR$: plan.categoryAmountsR$ || categoryAmountsR$,
    categoryLocks: plan.categoryLocks || {
      moradia: false,
      transporte: false,
      comida: false,
      lazer: false,
      protecao: false,
      profissional: false,
      investimentos: false,
    },
    categoryFloorsR$: plan.categoryFloorsR$ || {
      moradia: 0,
      transporte: 0,
      comida: 0,
      lazer: 0,
      protecao: 0,
      profissional: 0,
      investimentos: roundMoney(plannedNetIncome * (investPct / 100)),
    },
    categoryPriorities: plan.categoryPriorities || {
      moradia: 'P1',
      protecao: 'P1',
      profissional: 'P1',
      comida: 'P2',
      transporte: 'P2',
      investimentos: 'P2',
      lazer: 'P3',
    },
    commitmentsR$: plan.commitmentsR$ || {
      moradia: 0,
      transporte: 0,
      comida: 0,
      lazer: 0,
      protecao: 0,
      profissional: 0,
      investimentos: 0,
    },
    actualSpentR$: plan.actualSpentR$ || {
      moradia: 0,
      transporte: 0,
      comida: 0,
      lazer: 0,
      protecao: 0,
      profissional: 0,
      investimentos: 0,
    },
    requiredMarginR$: plan.requiredMarginR$ || categoryAmountsR$,
    referencePreset: plan.referencePreset || categoryPercentages,
    status: plan.status || 'feasible',
    explanation: plan.explanation || 'Plano aprovado e validado sob o contrato v2.0.',
    conflicts: plan.conflicts || [],
    approvedAt: plan.approvedAt,
    approvedBy: plan.approvedBy,
    applyToFutureMonths: Boolean(plan.applyToFutureMonths),
  };
}

/**
 * Creates a standard approved budget plan contract for a given month and income using 60/30/10 policy.
 */
export function createStandardBudgetPlanContract(
  competence: string,
  plannedNetIncome: number,
  approvedBy = 'Casal',
  policyRatios = { fixedPct: 60, varPct: 30, investPct: 10 }
): BudgetPlanContract {
  const allocation = allocateIncomeByPolicy(plannedNetIncome, policyRatios);

  const categoryPercentages: Record<DestinationKey, number> = {
    moradia: 35,
    protecao: 25,
    comida: 15,
    lazer: 10,
    transporte: 5,
    profissional: 0,
    investimentos: policyRatios.investPct,
  };

  return upgradeBudgetPlanContract({
    competence,
    plannedNetIncome,
    approvedAt: new Date().toISOString(),
    approvedBy,
    categoryPercentages,
    macroGroups: {
      fixos: { percentage: policyRatios.fixedPct, amountR$: allocation.macroGroups.fixos.amountR$ },
      variaveis: { percentage: policyRatios.varPct, amountR$: allocation.macroGroups.variaveis.amountR$ },
      investimentos: { percentage: policyRatios.investPct, amountR$: allocation.macroGroups.investimentos.amountR$ },
    },
  });
}

// ==========================================
// 25B: RESOLVEDOR DE CLASSIFICAÇÃO SEPARADA (NATUREZA, PRIORIDADE E GRUPO DA POLÍTICA)
// ==========================================

export interface ClassificationContext {
  keywordRules?: CategoryKeywordRule[];
  policyContract?: BudgetPlanContract;
  needsBasedMode?: boolean;
}

export interface ResolvedClassification {
  nature: ExpenseNature;
  priority: ExpensePriority;
  policyMacroGroup: PolicyMacroGroup;
  classificationOrigin: ClassificationOrigin;
  classificationReason: string;
  ruleVersion: string;
  needsBasedOverride: boolean;
}

/**
 * 25B: Precedência única para resolução de classificação:
 * 1. manual_confirmed: correção/escolha manual confirmada (maior prioridade)
 * 2. authorized_rule: regra de categorização autorizada/configurada
 * 3. origin_link: vínculo confiável de origem (conta fixa, parcela vincenda)
 * 4. auto_suggestion: sugestão automática (menor prioridade, revisável pelo usuário)
 *
 * Padrão estrito:
 * - Fixos: obrigações estáveis/recorrentes -> macro grupo 'fixos' (ex: streaming fixo dispensável permanece em fixos).
 * - Variáveis: consumo volátil -> macro grupo 'variaveis' (ex: supermercado variável essencial permanece em variaveis).
 * - Eventual: despesas ocasionais -> macro grupo aprovado ou 'pendente', sem exclusão dos totais.
 * - Modo por necessidades (apenas se optado explicitamente): despesas essenciais podem ser mapeadas
 *   para o grupo de necessidades sem alterar a natureza técnica.
 */
export function resolveExpenseClassification(
  item: Partial<ExpenseItem | BankImportedTransaction>,
  context: ClassificationContext = {}
): ResolvedClassification {
  const needsBased = Boolean(
    context.needsBasedMode || context.policyContract?.policyMeta?.policyMode === 'needs_based'
  );

  // 1. Correção manual confirmada (Precedência 1)
  if (item.classificationOrigin === 'manual_confirmed' && item.nature && item.priority) {
    let macroGroup: PolicyMacroGroup =
      item.policyMacroGroup || (item.nature === 'fixa' ? 'fixos' : 'variaveis');
    if (needsBased && item.priority === 'essencial') {
      macroGroup = 'fixos';
    }
    return {
      nature: item.nature,
      priority: item.priority,
      policyMacroGroup: macroGroup,
      classificationOrigin: 'manual_confirmed',
      classificationReason: item.classificationReason || 'Classificação confirmada manualmente pelo usuário',
      ruleVersion: item.ruleVersion || '1.0',
      needsBasedOverride: needsBased && item.priority === 'essencial' && item.nature === 'variavel',
    };
  }

  // 2. Regra autorizada (Precedência 2)
  const rules = context.keywordRules || [];
  const desc = (item.description || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchedAuthRule = rules.find((r) => {
    if (!r.isAuthorizedRule) return false;
    const normKw = r.keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return desc.includes(normKw);
  });

  if (matchedAuthRule) {
    const nature = matchedAuthRule.nature || 'variavel';
    const priority = matchedAuthRule.priority || 'importante';
    let macroGroup = matchedAuthRule.policyMacroGroup || (nature === 'fixa' ? 'fixos' : 'variaveis');
    if (needsBased && priority === 'essencial') {
      macroGroup = 'fixos';
    }
    return {
      nature,
      priority,
      policyMacroGroup: macroGroup,
      classificationOrigin: 'authorized_rule',
      classificationReason: `Regra autorizada "${matchedAuthRule.keyword}" (v${matchedAuthRule.ruleVersion || '1.0'})`,
      ruleVersion: matchedAuthRule.ruleVersion || '1.0',
      needsBasedOverride: needsBased && priority === 'essencial' && nature === 'variavel',
    };
  }

  // 3. Vínculo confiável de origem (Precedência 3)
  const exp = item as ExpenseItem;
  if (exp.linkedBillId) {
    return {
      nature: 'fixa',
      priority: 'essencial',
      policyMacroGroup: 'fixos',
      classificationOrigin: 'origin_link',
      classificationReason: `Vínculo de origem com conta fixa recorrente (${exp.linkedBillId})`,
      ruleVersion: '1.0',
      needsBasedOverride: false,
    };
  }

  if (exp.installmentId) {
    const nature: ExpenseNature = exp.nature || 'fixa';
    const priority: ExpensePriority = exp.priority || 'importante';
    let macroGroup: PolicyMacroGroup = nature === 'fixa' ? 'fixos' : 'variaveis';
    if (needsBased && priority === 'essencial') {
      macroGroup = 'fixos';
    }
    return {
      nature,
      priority,
      policyMacroGroup: macroGroup,
      classificationOrigin: 'origin_link',
      classificationReason: `Vínculo de origem com compra parcelada (${exp.installmentId})`,
      ruleVersion: '1.0',
      needsBasedOverride: needsBased && priority === 'essencial' && nature === 'variavel',
    };
  }

  // 4. Sugestão automática (Precedência 4)
  const matchedSuggestionRule = rules.find((r) => {
    const normKw = r.keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return desc.includes(normKw);
  });

  if (matchedSuggestionRule) {
    const nature = matchedSuggestionRule.nature || 'variavel';
    const priority = matchedSuggestionRule.priority || 'importante';
    let macroGroup = matchedSuggestionRule.policyMacroGroup || (nature === 'fixa' ? 'fixos' : 'variaveis');
    if (needsBased && priority === 'essencial') {
      macroGroup = 'fixos';
    }
    return {
      nature,
      priority,
      policyMacroGroup: macroGroup,
      classificationOrigin: 'auto_suggestion',
      classificationReason: `Sugestão automática por palavra-chave "${matchedSuggestionRule.keyword}" (revisável)`,
      ruleVersion: matchedSuggestionRule.ruleVersion || '1.0',
      needsBasedOverride: needsBased && priority === 'essencial' && nature === 'variavel',
    };
  }

  // Lançamento ambíguo permanece no total financeiro e em 'pendente'
  return {
    nature: 'variavel',
    priority: 'importante',
    policyMacroGroup: 'pendente',
    classificationOrigin: 'auto_suggestion',
    classificationReason: 'Lançamento sem correspondência direta: pendente de classificação pelo casal',
    ruleVersion: '1.0',
    needsBasedOverride: false,
  };
}

/**
 * 25B: Validação de divisão explícita (splits) de um lançamento:
 * Garante soma exata em centavos inteiros e preservação de origem canônica única.
 */
export function validateTransactionSplits(
  totalAmount: number,
  splits: TransactionSplit[]
): {
  isValid: boolean;
  totalCents: number;
  splitSumCents: number;
  discrepancyCents: number;
  error?: string;
} {
  const totalCents = Math.round(totalAmount * 100);
  if (!splits || splits.length < 2) {
    return {
      isValid: false,
      totalCents,
      splitSumCents: 0,
      discrepancyCents: totalCents,
      error: 'A divisão deve conter pelo menos 2 partes.',
    };
  }

  const splitSumCents = splits.reduce(
    (sum, s) => sum + (s.amountCents || Math.round((s.amount || 0) * 100)),
    0
  );
  const discrepancyCents = totalCents - splitSumCents;

  if (discrepancyCents !== 0) {
    return {
      isValid: false,
      totalCents,
      splitSumCents,
      discrepancyCents,
      error: `A soma das partes (R$ ${(splitSumCents / 100).toFixed(2)}) difere do total original (R$ ${(totalCents / 100).toFixed(2)}) em ${Math.abs(discrepancyCents)} centavos.`,
    };
  }

  return {
    isValid: true,
    totalCents,
    splitSumCents,
    discrepancyCents: 0,
  };
}

/**
 * 25B: Atualização com alcance temporal seguro:
 * 'this_occurrence' | 'future_occurrences' | 'selected_history'.
 * Protege estritamente competências fechadas contra modificação retroativa.
 */
export function applyTemporalScopeUpdate(
  expenses: ExpenseItem[],
  targetExpenseId: string,
  updatePatch: Partial<ExpenseItem>,
  scope: TemporalScope,
  closedMonths: string[] = []
): { updatedExpenses: ExpenseItem[]; affectedCount: number; affectedMonths: string[] } {
  const target = expenses.find((e) => e.id === targetExpenseId);
  if (!target) return { updatedExpenses: expenses, affectedCount: 0, affectedMonths: [] };

  const closedSet = new Set(closedMonths);
  const affectedMonths = new Set<string>();
  let affectedCount = 0;

  const targetDesc = target.description.trim().toUpperCase();

  const next = expenses.map((e) => {
    const month = e.date ? e.date.slice(0, 7) : '';

    if (scope === 'this_occurrence') {
      if (e.id === targetExpenseId) {
        if (closedSet.has(month)) return e;
        affectedCount++;
        if (month) affectedMonths.add(month);
        return { ...e, ...updatePatch };
      }
      return e;
    }

    if (scope === 'future_occurrences') {
      if (
        e.id === targetExpenseId ||
        (e.description.trim().toUpperCase() === targetDesc && e.date >= target.date)
      ) {
        if (closedSet.has(month)) return e; // Competência fechada é intocável
        affectedCount++;
        if (month) affectedMonths.add(month);
        return { ...e, ...updatePatch };
      }
      return e;
    }

    if (scope === 'selected_history') {
      if (e.id === targetExpenseId) {
        if (closedSet.has(month)) return e;
        affectedCount++;
        if (month) affectedMonths.add(month);
        return { ...e, ...updatePatch };
      }
      return e;
    }

    return e;
  });

  return {
    updatedExpenses: next,
    affectedCount,
    affectedMonths: Array.from(affectedMonths),
  };
}

// ==========================================
// 26A: SELETORES E CONTRATOS DISTINTOS (DINHEIRO, FINALIDADE, CONSUMO E ORÇAMENTO)
// ==========================================

/**
 * 26A: Renda líquida elegível efetivamente recebida em caixa no período.
 * Exclui expressamente:
 * - Resgates de ativos/caixinhas (principal_redemption, resgate_principal)
 * - Transferências internas
 * - Empréstimos (loan, emprestimo)
 * - Reembolsos / devoluções (refund, reembolso)
 * - Renda passiva reinvestida
 * - Previsões e plantões não confirmados (forecast, pending, projected)
 *
 * Exemplo do produto: R$ 36.000 de salário recebido + R$ 8.000 de resgate de cofrinho
 * continuam sendo exatamente R$ 36.000 de renda elegível recebida!
 */
export function selectEligibleNetIncomeReceived(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const incomes = state.incomes || [];
  const nonEligible = new Set([
    'internal_transfer',
    'loan',
    'emprestimo',
    'principal_redemption',
    'resgate_principal',
    'refund',
    'reembolso',
    'reimbursement',
    'passive_reinvested',
    'renda_passiva_reinvestida',
    'forecast',
  ]);

  const receivedIncomes = incomes.filter((inc) => {
    if (monthKey && inc.date && !inc.date.startsWith(monthKey)) return false;
    if (inc.status === 'internal_transfer') return false;
    if (inc.status === 'pending' || inc.status === 'projected') return false;
    if (inc.isForecast) return false;
    if (inc.classification && nonEligible.has(inc.classification)) return false;
    const recipientOwner =
      inc.recipient === 'partner1' ? 'partner1' : inc.recipient === 'partner2' ? 'partner2' : 'both';
    return isEntityInScope(recipientOwner, scope);
  });

  const total = receivedIncomes.reduce((sum, inc) => {
    let raw = inc.amount || 0;
    if (inc.classification === 'pj_gross' && inc.taxRatePercent && inc.taxRatePercent > 0) {
      const tax = (raw * Math.min(40, Math.max(0, inc.taxRatePercent))) / 100;
      const accounting = inc.monthlyAccountingCost || 0;
      raw = Math.max(0, raw - tax - accounting);
    }
    if (scope === 'casal') return sum + raw;
    if (inc.recipient === scope) return sum + raw;
    if (inc.recipient === 'both') return sum + raw * 0.5;
    return sum;
  }, 0);

  return roundMoney(total);
}

/**
 * 26A: Renda líquida planejada no contrato orçamentário aprovado.
 * O plano aprovado continua sendo o planejamento; não é apagado porque a renda entrou parcialmente.
 */
export function selectPlannedNetIncome(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  if (monthKey && state.monthlyBudgetPlans?.[monthKey]?.plannedNetIncome !== undefined) {
    const planIncome = state.monthlyBudgetPlans[monthKey].plannedNetIncome;
    if (scope === 'casal') return planIncome;
    return roundMoney(planIncome * 0.5);
  }
  const p1 = state.profile.partner1Income || 0;
  const p2 = state.profile.partner2Income || 0;
  if (scope === 'partner1') return p1;
  if (scope === 'partner2') return p2;
  return roundMoney(p1 + p2);
}

/**
 * 26A: Entradas bancárias brutas totais (créditos nas contas operacionais,
 * incluindo salários, resgates, transferências e reembolsos).
 * No exemplo do produto: R$ 36.000 recebidos + R$ 8.000 resgatados = R$ 44.000 de entradas bancárias.
 */
export function selectGrossBankInflows(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const incomes = state.incomes || [];
  const inflows = incomes.filter((inc) => {
    if (monthKey && inc.date && !inc.date.startsWith(monthKey)) return false;
    if (inc.status === 'pending' || inc.status === 'projected') return false;
    if (inc.isForecast) return false;
    const recipientOwner =
      inc.recipient === 'partner1' ? 'partner1' : inc.recipient === 'partner2' ? 'partner2' : 'both';
    return isEntityInScope(recipientOwner, scope);
  });

  const total = inflows.reduce((sum, inc) => {
    if (scope === 'casal') return sum + (inc.amount || 0);
    if (inc.recipient === scope) return sum + (inc.amount || 0);
    if (inc.recipient === 'both') return sum + (inc.amount || 0) * 0.5;
    return sum;
  }, 0);

  return roundMoney(total);
}

/**
 * 26A: Consumo econômico que debita os tetos mensais das categorias.
 * Exclui compras financiadas diretamente por caixinhas/metas (Path B).
 */
export function selectCategoryConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = state.expenses || [];
  const total = expenses.reduce((sum, exp) => {
    if (monthKey && exp.date && !exp.date.startsWith(monthKey)) return sum;
    if (!isEntityInScope(exp.paidBy, scope)) return sum;

    // Compras financiadas por caixinha ou excluídas do orçamento do mês não debitam o teto da categoria!
    if (exp.fundingSource === 'piggy_bank' || exp.isExcludedFromMonthlyBudget) {
      return sum;
    }

    let itemAmt = exp.amount || 0;
    if (exp.splits && exp.splits.length > 0) {
      itemAmt = exp.splits
        .filter((s) => s.fundingSource !== 'piggy_bank')
        .reduce((acc, s) => acc + s.amountCents / 100, 0);
    }

    if (scope === 'casal') return sum + itemAmt;
    if (exp.paidBy === scope) return sum + itemAmt;
    if (exp.paidBy === 'both') {
      const pct = scope === 'partner1' ? (exp.splitPartner1Pct ?? 50) : (exp.splitPartner2Pct ?? 50);
      return sum + (itemAmt * pct) / 100;
    }
    return sum;
  }, 0);

  return roundMoney(total);
}

/**
 * 26A: Consumo financiado diretamente por objetivos/caixinhas (Path B).
 * Carrega a etiqueta analítica (ex: moradia/mobília), mas não debita o teto mensal da categoria.
 */
export function selectGoalDirectConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = state.expenses || [];
  const total = expenses.reduce((sum, exp) => {
    if (monthKey && exp.date && !exp.date.startsWith(monthKey)) return sum;
    if (!isEntityInScope(exp.paidBy, scope)) return sum;

    let directGoalAmt = 0;
    if (exp.fundingSource === 'piggy_bank' || (exp.isExcludedFromMonthlyBudget && exp.fundingGoalId)) {
      directGoalAmt = exp.amount || 0;
    } else if (exp.splits && exp.splits.length > 0) {
      directGoalAmt = exp.splits
        .filter((s) => s.fundingSource === 'piggy_bank' || s.fundingGoalId)
        .reduce((acc, s) => acc + s.amountCents / 100, 0);
    }

    if (directGoalAmt <= 0) return sum;

    if (scope === 'casal') return sum + directGoalAmt;
    if (exp.paidBy === scope) return sum + directGoalAmt;
    if (exp.paidBy === 'both') {
      const pct = scope === 'partner1' ? (exp.splitPartner1Pct ?? 50) : (exp.splitPartner2Pct ?? 50);
      return sum + (directGoalAmt * pct) / 100;
    }
    return sum;
  }, 0);

  return roundMoney(total);
}

/**
 * 26A: Consumo econômico total = consumo de categorias + consumo direto de objetivos.
 */
export function selectTotalEconomicConsumption(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const category = selectCategoryConsumptionExpenses(state, scope, monthKey);
  const goalDirect = selectGoalDirectConsumptionExpenses(state, scope, monthKey);
  return roundMoney(category + goalDirect);
}

/**
 * 26A: Desembolso financeiro total (caixa efetivamente saído das contas operacionais).
 * Consumo econômico + aportes em caixinhas/metas.
 */
export function selectTotalCashDisbursements(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const economicConsumption = selectTotalEconomicConsumption(state, scope, monthKey);
  const ops = state.financialOperations || [];
  const deposits = ops.filter((op) => {
    if (op.type !== 'GOAL_DEPOSIT') return false;
    if (monthKey && !op.date.startsWith(monthKey)) return false;
    if (op.state === 'reverted') return false;
    return isEntityInScope(op.authorizedBy as any, scope);
  });
  const depositsTotal = deposits.reduce((sum, op) => sum + op.amountCents / 100, 0);
  return roundMoney(economicConsumption + depositsTotal);
}

/**
 * 26A: Balanço transparente de objetivo:
 * - acumulado (total poupado)
 * - comprometido (bloqueado para compra ou reforço pendente)
 * - utilizado (gasto efetivamente realizado)
 * - disponível (acumulado - comprometido - utilizado)
 * Nunca faz clamp silencioso se disponível for negativo.
 */
export function selectGoalBalanceBreakdown(
  goal: CoupleGoal | SavingsPiggyBank,
  operations: FinancialOperationRecord[] = []
): {
  accumulatedCents: number;
  committedCents: number;
  utilizedCents: number;
  availableCents: number;
  isCompleted: boolean;
  isOvercommitted: boolean;
} {
  const currentAmountCents = Math.round((goal.currentAmount || 0) * 100);
  const targetAmountCents = Math.round((goal.targetAmount || 0) * 100);

  const goalOps = operations.filter(
    (op) => (op.sourceRef.id === goal.id || op.targetRef.id === goal.id) && op.state !== 'reverted'
  );

  const accumulatedCents = goal.accumulatedCents ?? currentAmountCents;
  let committedCents = goal.committedCents ?? 0;
  let utilizedCents = goal.utilizedCents ?? 0;

  for (const op of goalOps) {
    if (op.sourceRef.id === goal.id && op.type === 'GOAL_DIRECT_PURCHASE') {
      utilizedCents += op.amountCents;
    } else if (op.sourceRef.id === goal.id && op.type === 'CATEGORY_REINFORCEMENT') {
      committedCents += op.amountCents;
    }
  }

  const availableCents = accumulatedCents - committedCents - utilizedCents;
  const isOvercommitted = availableCents < 0;
  const isCompleted = targetAmountCents > 0 && accumulatedCents >= targetAmountCents;

  return {
    accumulatedCents,
    committedCents,
    utilizedCents,
    availableCents,
    isCompleted,
    isOvercommitted,
  };
}

/**
 * 26A: Validação de fatias exclusivas de cofrinho:
 * Permite dividir R$ 8.000 em R$ 3.000 para orçamento e R$ 5.000 para compra,
 * mas não utilizar os mesmos R$ 8.000 integralmente nos dois caminhos.
 */
export function validatePiggyBankSliceAllocation(
  availableCents: number,
  reinforcementCents: number,
  directPurchaseCents: number
): {
  isValid: boolean;
  remainingAvailableCents: number;
  error?: string;
} {
  if (reinforcementCents < 0 || directPurchaseCents < 0) {
    return {
      isValid: false,
      remainingAvailableCents: availableCents,
      error: 'Valores de alocação não podem ser negativos.',
    };
  }

  const totalRequestedCents = reinforcementCents + directPurchaseCents;
  if (totalRequestedCents > availableCents) {
    return {
      isValid: false,
      remainingAvailableCents: availableCents - totalRequestedCents,
      error: `Saldo disponível insuficiente (R$ ${(availableCents / 100).toFixed(2)}) para atender reforço de R$ ${(reinforcementCents / 100).toFixed(2)} e compra direta de R$ ${(directPurchaseCents / 100).toFixed(2)}. Fatias são mutuamente exclusivas.`,
    };
  }

  return {
    isValid: true,
    remainingAvailableCents: availableCents - totalRequestedCents,
  };
}

/**
 * 26A: Consolidação patrimonial que previne contagem dupla entre conta/CDB e metas.
 * CDB de R$ 250.000 vinculado a uma meta de R$ 250.000 representa R$ 250.000 de patrimônio, NÃO R$ 500.000.
 */
export function selectConsolidatedAssetTotal(
  state: AppState,
  scope: DomainScope = 'casal'
): number {
  const accounts = state.linkedAccounts || [];
  const piggyBanks = state.piggyBanks || [];
  const coupleGoals = state.coupleGoals || [];

  const linkedAccountIds = new Set<string>();
  piggyBanks.forEach((p) => {
    if (p.linkedBankAccountId) linkedAccountIds.add(p.linkedBankAccountId);
  });
  coupleGoals.forEach((g) => {
    if (g.linkedBankAccountId) linkedAccountIds.add(g.linkedBankAccountId);
  });

  let unlinkedAccountBalances = 0;
  accounts.forEach((acc) => {
    if (linkedAccountIds.has(acc.id)) {
      return; // Já representado pela meta
    }
    if (isEntityInScope(acc.holder, scope)) {
      unlinkedAccountBalances += acc.balance || 0;
    }
  });

  const { totalProtected } = selectTotalProtectedAssets(state, scope);
  return roundMoney(unlinkedAccountBalances + totalProtected);
}

/**
 * 26A: Executa comando/operação financeira de forma atômica, idempotente e consistente.
 * Nunca silencia erros de saldo com clamping arbitrário. Mantém espelhos síncronos entre caixinhas e metas.
 */
export function executeFinancialOperation(
  state: AppState,
  operation: FinancialOperationRecord
): AppState {
  const existingOps = state.financialOperations || [];
  // Idempotência
  if (existingOps.some((op) => op.id === operation.id)) {
    return state;
  }

  const nextOps = [...existingOps, { ...operation, state: 'reconciled' as const }];
  let nextPiggyBanks = [...(state.piggyBanks || [])];
  let nextCoupleGoals = [...(state.coupleGoals || [])];

  if (operation.type === 'GOAL_DEPOSIT') {
    const goalId = operation.targetRef.id;
    const amtR$ = operation.amountR$;

    nextPiggyBanks = nextPiggyBanks.map((p) => {
      if (p.id !== goalId) return p;
      const current = roundMoney((p.currentAmount || 0) + amtR$);
      return { ...p, currentAmount: current, accumulatedCents: Math.round(current * 100) };
    });

    nextCoupleGoals = nextCoupleGoals.map((g) => {
      if (g.id !== goalId) return g;
      const current = roundMoney((g.currentAmount || 0) + amtR$);
      return { ...g, currentAmount: current, accumulatedCents: Math.round(current * 100) };
    });
  } else if (operation.type === 'GOAL_DIRECT_PURCHASE' || operation.type === 'GOAL_WITHDRAWAL') {
    const goalId = operation.sourceRef.id;
    const amtR$ = operation.amountR$;
    const targetGoal =
      nextPiggyBanks.find((p) => p.id === goalId) || nextCoupleGoals.find((g) => g.id === goalId);

    if (targetGoal) {
      const current = targetGoal.currentAmount || 0;
      if (current < amtR$) {
        throw new Error(
          `Saldo insuficiente na meta ${targetGoal.id} (R$ ${current.toFixed(2)}) para operação de R$ ${amtR$.toFixed(2)}. Não é permitido clamp silencioso.`
        );
      }

      nextPiggyBanks = nextPiggyBanks.map((p) => {
        if (p.id !== goalId) return p;
        const newAmt = roundMoney((p.currentAmount || 0) - amtR$);
        return { ...p, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      });

      nextCoupleGoals = nextCoupleGoals.map((g) => {
        if (g.id !== goalId) return g;
        const newAmt = roundMoney((g.currentAmount || 0) - amtR$);
        return { ...g, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      });
    }
  } else if (operation.type === 'GOAL_TRANSFER') {
    const sourceId = operation.sourceRef.id;
    const targetId = operation.targetRef.id;
    const amtR$ = operation.amountR$;

    const sourceGoal =
      nextPiggyBanks.find((p) => p.id === sourceId) || nextCoupleGoals.find((g) => g.id === sourceId);
    if (!sourceGoal || (sourceGoal.currentAmount || 0) < amtR$) {
      throw new Error(
        `Saldo insuficiente na meta de origem ${sourceId} para transferência de R$ ${amtR$.toFixed(2)}.`
      );
    }

    nextPiggyBanks = nextPiggyBanks.map((p) => {
      if (p.id === sourceId) {
        const newAmt = roundMoney((p.currentAmount || 0) - amtR$);
        return { ...p, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      }
      if (p.id === targetId) {
        const newAmt = roundMoney((p.currentAmount || 0) + amtR$);
        return { ...p, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      }
      return p;
    });

    nextCoupleGoals = nextCoupleGoals.map((g) => {
      if (g.id === sourceId) {
        const newAmt = roundMoney((g.currentAmount || 0) - amtR$);
        return { ...g, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      }
      if (g.id === targetId) {
        const newAmt = roundMoney((g.currentAmount || 0) + amtR$);
        return { ...g, currentAmount: newAmt, accumulatedCents: Math.round(newAmt * 100) };
      }
      return g;
    });
  }

  return {
    ...state,
    financialOperations: nextOps,
    piggyBanks: nextPiggyBanks,
    coupleGoals: nextCoupleGoals,
  };
}
