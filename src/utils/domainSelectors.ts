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
  PaidBy,
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
  FundingSourceType,
  SplitLineType,
  ReconciledBudgetMatrixResult,
  ReconciledStructureBlock,
  ReconciledInvestmentBlock,
  ReconciledCategoryRow,
  CategoryMatrixEntryCents,
  CeilingState,
  FixedBillRegistryConflict,
} from '../types/finance';
import {
  readOperationAmountCents,
} from './financialCommands';
import {
  apportionCentsByScope,
  CATEGORY_PRESENTATION_META,
  projectCanonicalExpenseSlices,
  projectInstallmentOccurrencesForCompetence,
  projectSharedFixedOccurrences,
  resolveExpenseCompetenceMonth,
  selectCanonicalFixedBillsRegistry,
  toSafeCents,
  type ResolvedSliceNature,
} from './occurrenceProjection';

export {
  roundMoneyCentsCompatible,
  normalizeMonetaryBoundary,
  readOperationAmountCents,
  normalizeCommandScope,
  computeOperationFingerprint,
  runFinancialCommand,
  executeFinancialOperation,
  reverseFinancialCommand,
  executeExpenseCreateCommand,
  executeExpenseEditCommand,
  executeExpenseDeleteCommand,
  executeReconcileIntentCommand,
  executeExpenseTriageCommand,
  executeGoalAdjustmentCommand,
  executeIntentConversionCommand,
  type MonetaryNormalizationInput,
  type MonetaryNormalizationResult,
  type RunFinancialCommandOptions,
  type ExpenseCommandContextOptions,
  type GoalAdjustmentCommandParams,
  type IntentConversionCommandParams,
} from './financialCommands';

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
  owner: PaidBy | string | undefined,
  scope: DomainScope
): boolean {
  if (scope === 'casal') return true;
  if (!owner || owner === 'both' || owner === 'casal' || owner === 'couple' || owner === 'custom') return true;
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
  * Computes total consumption expenses for scope and month (in exact integer cents).
  */
export function selectConsumptionExpensesTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = state.expenses || [];
  let totalCents = 0;
  for (const exp of expenses) {
    if (exp.isExcludedFromMonthlyBudget) continue;
    const expComp = resolveExpenseCompetenceMonth(exp);
    if (monthKey && expComp !== monthKey) continue;
    const split = apportionCentsByScope(
      toSafeCents(exp.amount, exp.amountCents),
      scope,
      exp.paidBy,
      exp.splitPartner1Pct,
      exp.splitPartner2Pct,
      exp.assignedTo
    );
    if (split.isInScope) {
      totalCents += split.scopedCents;
    }
  }
  return roundMoney(totalCents / 100);
}

/**
  * Computes pending financial obligations (fixed bills + credit installments) due in monthKey not yet in expenses.
  * Delegates to shared occurrence projections (reconciling coupleFixedBills + fixedBillAlerts and explicit competence).
  */
export function selectPendingObligationsTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  if (!monthKey) return 0;
  let totalPendingCents = 0;

  const { occurrences: fixedOccs } = projectSharedFixedOccurrences(state, monthKey, scope);
  for (const occ of fixedOccs) {
    if (occ.status !== 'paid') {
      totalPendingCents += occ.apportionedAmountCents;
    }
  }

  const instOccs = projectInstallmentOccurrencesForCompetence(state, monthKey, scope);
  for (const instOcc of instOccs) {
    if (instOcc.isFixedNature) continue; // já incluído em fixedOccs
    if (instOcc.status !== 'paid' && instOcc.status !== 'advanced') {
      totalPendingCents += instOcc.scopedCents;
    }
  }

  return roundMoney(totalPendingCents / 100);
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

  // 28C: Construção da Matriz Categoria x Natureza em Centavos
  const categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents> = plan.categoryMatrixCents || {
    moradia: {
      fixedCents: Math.round((categoryAmountsR$.moradia || 0) * 80),
      variableCents: Math.round((categoryAmountsR$.moradia || 0) * 20),
      totalCents: Math.round((categoryAmountsR$.moradia || 0) * 100),
    },
    protecao: {
      fixedCents: Math.round((categoryAmountsR$.protecao || 0) * 80),
      variableCents: Math.round((categoryAmountsR$.protecao || 0) * 20),
      totalCents: Math.round((categoryAmountsR$.protecao || 0) * 100),
    },
    transporte: {
      fixedCents: Math.round((categoryAmountsR$.transporte || 0) * 50),
      variableCents: Math.round((categoryAmountsR$.transporte || 0) * 50),
      totalCents: Math.round((categoryAmountsR$.transporte || 0) * 100),
    },
    comida: {
      fixedCents: 0,
      variableCents: Math.round((categoryAmountsR$.comida || 0) * 100),
      totalCents: Math.round((categoryAmountsR$.comida || 0) * 100),
    },
    lazer: {
      fixedCents: 0,
      variableCents: Math.round((categoryAmountsR$.lazer || 0) * 100),
      totalCents: Math.round((categoryAmountsR$.lazer || 0) * 100),
    },
    profissional: {
      fixedCents: Math.round((categoryAmountsR$.profissional || 0) * 50),
      variableCents: Math.round((categoryAmountsR$.profissional || 0) * 50),
      totalCents: Math.round((categoryAmountsR$.profissional || 0) * 100),
    },
  };

  const totalVarCategoryBudgetR$ = (categoryAmountsR$.comida || 0) + (categoryAmountsR$.lazer || 0) + (categoryAmountsR$.transporte || 0) + (categoryAmountsR$.profissional || 0);
  const totalVarBudgetR$ = macroGroups.variaveis.amountR$;
  const unassignedVariableMarginR$ = Math.max(0, roundMoney(totalVarBudgetR$ - totalVarCategoryBudgetR$));
  const unassignedVariableMarginCents = Math.round(unassignedVariableMarginR$ * 100);

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
    categoryMatrixCents,
    unassignedVariableMarginCents,
    unassignedVariableMarginR$,
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
    approvedByUid: plan.approvedByUid,
    approvedByDisplayName: plan.approvedByDisplayName,
    baseSnapshotSignature: plan.baseSnapshotSignature,
    applyToFutureMonths: Boolean(plan.applyToFutureMonths),
    appliedFutureMonths: plan.appliedFutureMonths,
    skippedApprovedMonths: plan.skippedApprovedMonths,
    partnerCeilings: plan.partnerCeilings,
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
  totalSplitsAmount: number;
  discrepancyCents: number;
  diffCents: number;
  error?: string;
} {
  const totalCents = Math.round(totalAmount * 100);
  if (!splits || splits.length < 2) {
    return {
      isValid: false,
      totalCents,
      splitSumCents: 0,
      totalSplitsAmount: 0,
      discrepancyCents: totalCents,
      diffCents: totalCents,
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
      totalSplitsAmount: splitSumCents / 100,
      discrepancyCents,
      diffCents: discrepancyCents,
      error: `A soma das partes (R$ ${(splitSumCents / 100).toFixed(2)}) difere do total original (R$ ${(totalCents / 100).toFixed(2)}) em ${Math.abs(discrepancyCents)} centavos.`,
    };
  }

  return {
    isValid: true,
    totalCents,
    splitSumCents,
    totalSplitsAmount: splitSumCents / 100,
    discrepancyCents: 0,
    diffCents: 0,
  };
}

/**
 * 28B: Representação projetada de uma fatia de despesa para consumo analítico.
 * Cada fatia carrega sua finalidade (categoria), natureza, prioridade e fonte de custeio,
 * sem duplicar transações financeiras na conta bancária.
 */
export interface ProjectedExpenseSlice {
  splitId: string;
  expenseId: string;
  parentExpenseId: string;
  parentExpense: ExpenseItem;
  amount: number; // in R$
  amountCents: number; // integer cents
  category: CategoryKey;
  subcategory?: string;
  nature: ExpenseNature;
  resolvedNature: ResolvedSliceNature;
  hasReliableNature: boolean;
  priority: ExpensePriority;
  isEssential: boolean;
  policyMacroGroup: PolicyMacroGroup;
  classificationOrigin: ClassificationOrigin;
  notes?: string;
  fundingSource?: FundingSourceType;
  fundingGoalId?: string;
  fundingGoalName?: string;
  isExcludedFromMonthlyBudget?: boolean;
  exclusionReason?: 'manual' | 'asset_funding' | 'goal_direct';
  date: string;
  competenceMonth: string;
  cashMonth: string;
  paidBy: PaidBy;
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal';
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  bankName?: string;
  store?: string;
  lineType?: SplitLineType;
  targetDate?: string;
  isPostponable?: boolean;
  isVirtualSingleSplit: boolean;
}

/**
 * 28B & 29B: Projeta as fatias de uma despesa preservando centavos inteiros,
 * competência explícita e confiabilidade da natureza (sem inventar 'variavel' no desconhecido).
 */
export function projectExpenseSplits(
  exp: ExpenseItem,
  options?: {
    keywordRules?: CategoryKeywordRule[];
    installments?: InstallmentPurchase[];
  }
): ProjectedExpenseSlice[] {
  return projectCanonicalExpenseSlices(exp, options);
}

/**
 * 28B: Alocação determinística de centavos por percentual usando o método dos maiores restos (Hare-Niemeyer).
 * Garante que a soma das parcelas em centavos inteiros seja estritamente igual ao total em centavos,
 * com desempate determinístico e estável por índice. (C05)
 */
export function apportionSplitsByPercentage<T extends { percentage: number }>(
  totalAmount: number,
  items: T[]
): Array<T & { amount: number; amountCents: number }> {
  const totalCents = Math.round(totalAmount * 100);
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    return [
      {
        ...items[0],
        amountCents: totalCents,
        amount: totalCents / 100,
      },
    ];
  }

  const sumPct = items.reduce((acc, it) => acc + (it.percentage || 0), 0);
  const effectiveSumPct = sumPct > 0 ? sumPct : items.length;

  let totalBaseCents = 0;
  const quotas = items.map((it, idx) => {
    const pct = sumPct > 0 ? it.percentage : 1;
    const exactQuota = (totalCents * pct) / effectiveSumPct;
    const baseCents = Math.floor(exactQuota);
    const remainder = exactQuota - baseCents;
    totalBaseCents += baseCents;
    return {
      index: idx,
      baseCents,
      remainder,
      item: it,
    };
  });

  const remainderCents = totalCents - totalBaseCents;

  const sortedIndices = quotas
    .map((q) => q.index)
    .sort((a, b) => {
      const diff = quotas[b].remainder - quotas[a].remainder;
      if (Math.abs(diff) > 1e-9) return diff;
      return a - b;
    });

  const bonusCentSet = new Set(sortedIndices.slice(0, remainderCents));

  return quotas.map((q) => {
    const finalCents = q.baseCents + (bonusCentSet.has(q.index) ? 1 : 0);
    return {
      ...q.item,
      amountCents: finalCents,
      amount: roundMoney(finalCents / 100),
    };
  });
}

/**
 * 28B: Rateio explícito de frete ou desconto entre as linhas de itens,
 * preservando o total líquido com soma exata em centavos. (C06)
 */
export function apportionDiscountOrFreight(
  splits: TransactionSplit[],
  adjustmentAmount: number,
  type: 'discount' | 'freight'
): TransactionSplit[] {
  const adjustmentCents = Math.round(adjustmentAmount * 100);
  if (adjustmentCents === 0 || !splits || splits.length === 0) return splits;

  // Filtrar apenas linhas de itens (não fretes ou descontos anteriores)
  const itemSplits = splits.filter((s) => !s.lineType || s.lineType === 'item');
  if (itemSplits.length === 0) return splits;

  const totalItemCents = itemSplits.reduce((acc, s) => acc + s.amountCents, 0);
  if (totalItemCents <= 0) return splits;

  let allocatedCentsSum = 0;
  const quotas = itemSplits.map((s, idx) => {
    const exactShare = (adjustmentCents * s.amountCents) / totalItemCents;
    const baseShare = Math.floor(exactShare);
    const remainder = exactShare - baseShare;
    allocatedCentsSum += baseShare;
    return {
      id: s.id,
      index: idx,
      baseShare,
      remainder,
    };
  });

  const remainderToDistribute = adjustmentCents - allocatedCentsSum;
  const sorted = quotas
    .slice()
    .sort((a, b) => {
      const diff = b.remainder - a.remainder;
      if (Math.abs(diff) > 1e-9) return diff;
      return a.index - b.index;
    });

  const bonusSet = new Set(sorted.slice(0, remainderToDistribute).map((q) => q.id));

  return splits.map((s) => {
    if (s.lineType && s.lineType !== 'item') return s;
    const q = quotas.find((item) => item.id === s.id);
    if (!q) return s;

    const deltaCents = q.baseShare + (bonusSet.has(s.id) ? 1 : 0);
    const nextCents = type === 'discount' ? Math.max(0, s.amountCents - deltaCents) : s.amountCents + deltaCents;
    return {
      ...s,
      amountCents: nextCents,
      amount: roundMoney(nextCents / 100),
    };
  });
}

/**
 * 28B: Seletor comum de fatias com competência e escopo.
 * Rastreia as despesas e suas divisões sem duplicar transações pai/filho.
 */
export function selectExpenseSlices(
  expenses: ExpenseItem[],
  scope: DomainScope = 'casal',
  monthKey?: string,
  options?: {
    keywordRules?: CategoryKeywordRule[];
    installments?: InstallmentPurchase[];
  }
): ProjectedExpenseSlice[] {
  if (!expenses || expenses.length === 0) return [];

  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );

  const slices: ProjectedExpenseSlice[] = [];

  for (const exp of expenses) {
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) {
      continue;
    }

    const expSlices = projectExpenseSplits(exp, options);
    for (const slice of expSlices) {
      if (monthKey && slice.competenceMonth !== monthKey) {
        continue;
      }
      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (!split.isInScope) {
        continue;
      }
      slices.push(slice);
    }
  }

  return slices;
}

/**
 * 28B & 29B: Total gasto por categoria a partir das fatias projetadas em centavos inteiros.
 * Aloca exatamente a parcela de cada grupo à sua categoria correspondente sem deriva de ponto flutuante. (C01, C44, R29-12, R29-16)
 */
export function selectSplitsCategorySpending(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): Record<CategoryKey, number> {
  const centsByCat: Record<string, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };

  const slices = selectExpenseSlices(state.expenses || [], scope, monthKey, {
    keywordRules: state.keywordRules,
    installments: state.installments,
  });

  for (const slice of slices) {
    if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') {
      continue;
    }
    const cat = slice.category;
    if (centsByCat[cat] === undefined) {
      centsByCat[cat] = 0;
    }
    const split = apportionCentsByScope(
      slice.amountCents,
      scope,
      slice.paidBy,
      slice.parentExpense.splitPartner1Pct,
      slice.parentExpense.splitPartner2Pct,
      slice.assignedTo
    );
    if (!split.isInScope) continue;
    centsByCat[cat] += split.scopedCents;
  }

  const res = {} as Record<CategoryKey, number>;
  for (const [key, cents] of Object.entries(centsByCat)) {
    (res as any)[key] = roundMoney(cents / 100);
  }
  return res;
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
  const plan = monthKey ? state.monthlyBudgetPlans?.[monthKey] : undefined;
  if (scope === 'casal') {
    if (plan && typeof plan.plannedNetIncome === 'number' && Number.isFinite(plan.plannedNetIncome)) {
      return Math.max(0, roundMoney(plan.plannedNetIncome));
    }
    const p1 = state.profile.partner1Income || 0;
    const p2 = state.profile.partner2Income || 0;
    return roundMoney(p1 + p2);
  }

  // 29B (R29-15): Um teto/plano individual ausente NUNCA é automaticamente metade arbitrária do plano do casal.
  const partnerCeiling = plan?.partnerCeilings?.[scope];
  if (partnerCeiling && typeof partnerCeiling.plannedNetIncome === 'number' && Number.isFinite(partnerCeiling.plannedNetIncome)) {
    return Math.max(0, roundMoney(partnerCeiling.plannedNetIncome));
  }
  return scope === 'partner1'
    ? roundMoney(state.profile.partner1Income || 0)
    : roundMoney(state.profile.partner2Income || 0);
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

  let totalCents = 0;
  for (const inc of inflows) {
    const split = apportionCentsByScope(
      toSafeCents(inc.amount),
      scope,
      inc.recipient || 'both'
    );
    if (split.isInScope) {
      totalCents += split.scopedCents;
    }
  }

  return roundMoney(totalCents / 100);
}

/**
 * 26A & 29B: Consumo econômico que debita os tetos mensais das categorias (por competência, em centavos inteiros).
 * Exclui compras financiadas diretamente por caixinhas/metas (Path B).
 */
export function selectCategoryConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const slices = selectExpenseSlices(state.expenses || [], scope, monthKey, {
    keywordRules: state.keywordRules,
    installments: state.installments,
  });

  let totalCents = 0;
  for (const slice of slices) {
    if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') {
      continue;
    }
    const split = apportionCentsByScope(
      slice.amountCents,
      scope,
      slice.paidBy,
      slice.parentExpense.splitPartner1Pct,
      slice.parentExpense.splitPartner2Pct,
      slice.assignedTo
    );
    if (split.isInScope) {
      totalCents += split.scopedCents;
    }
  }

  return roundMoney(totalCents / 100);
}

/**
 * 26A & 29B: Consumo financiado diretamente por objetivos/caixinhas (Path B, em centavos inteiros).
 * Carrega a etiqueta analítica (ex: moradia/mobília), mas não debita o teto mensal da categoria.
 */
export function selectGoalDirectConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = state.expenses || [];
  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );

  let totalCents = 0;
  for (const exp of expenses) {
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });
    for (const slice of slices) {
      if (monthKey && slice.competenceMonth !== monthKey) continue;
      const isDirectGoal =
        slice.fundingSource === 'piggy_bank' ||
        Boolean(slice.isExcludedFromMonthlyBudget && slice.fundingGoalId);
      if (!isDirectGoal) continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (split.isInScope) {
        totalCents += split.scopedCents;
      }
    }
  }

  return roundMoney(totalCents / 100);
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
 * 26A & 29B: Desembolso financeiro total por DATA DE CAIXA (caixa efetivamente saído das contas operacionais no mês civil).
 * Distingue estritamente data de pagamento (caixa) de competência orçamentária!
 */
export function selectTotalCashDisbursements(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = state.expenses || [];
  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );

  let cashExpenseCents = 0;
  for (const exp of expenses) {
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    if (monthKey && (!exp.date || !exp.date.startsWith(monthKey))) continue;
    if (exp.paymentMethod === 'credit') continue;

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });
    for (const slice of slices) {
      const isRoutineOrGoal =
        !slice.isExcludedFromMonthlyBudget ||
        slice.fundingSource === 'month_budget' ||
        slice.fundingSource === 'piggy_bank' ||
        Boolean(slice.fundingGoalId);
      if (!isRoutineOrGoal) continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (split.isInScope) {
        cashExpenseCents += split.scopedCents;
      }
    }
  }

  const ops = state.financialOperations || [];
  let depositsCents = 0;
  for (const op of ops) {
    if (op.type !== 'GOAL_DEPOSIT') continue;
    if (monthKey && op.date && !op.date.startsWith(monthKey)) continue;
    if (op.state === 'reverted' || op.state === 'estornado') continue;
    const opScope =
      op.scope && op.scope !== 'couple' && op.scope !== 'casal'
        ? op.scope
        : (op.authorizedBy as any) || op.scope;
    const split = apportionCentsByScope(readOperationAmountCents(op), scope, opScope);
    if (split.isInScope) {
      depositsCents += split.scopedCents;
    }
  }

  return roundMoney((cashExpenseCents + depositsCents) / 100);
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
    (op) =>
      (op.sourceRef?.id === goal.id || op.targetRef?.id === goal.id) &&
      op.state !== 'reverted' &&
      op.state !== 'estornado'
  );

  let opsCommittedCents = 0;
  let opsUtilizedCents = 0;

  for (const op of goalOps) {
    const opCents = readOperationAmountCents(op);
    if (op.sourceRef?.id === goal.id && op.type === 'GOAL_DIRECT_PURCHASE') {
      opsUtilizedCents += opCents;
    } else if (op.sourceRef?.id === goal.id && op.type === 'CATEGORY_REINFORCEMENT') {
      opsCommittedCents += opCents;
    }
  }

  const committedCents = Math.max(goal.committedCents ?? 0, opsCommittedCents);
  const utilizedCents = Math.max(goal.utilizedCents ?? 0, opsUtilizedCents);
  const accumulatedCents =
    typeof goal.accumulatedCents === 'number' && Number.isFinite(goal.accumulatedCents)
      ? goal.accumulatedCents
      : typeof goal.availableCents === 'number' && Number.isFinite(goal.availableCents)
      ? goal.availableCents + (goal.committedCents ?? 0) + (goal.utilizedCents ?? 0)
      : currentAmountCents;

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

const CANONICAL_CATEGORY_ALIAS_MAP: Record<string, CategoryKey> = {
  moradia: 'moradia',
  casa: 'moradia',
  limpeza: 'moradia',
  transporte: 'transporte',
  comida: 'comida',
  alimentacao: 'comida',
  lazer: 'lazer',
  vestuario: 'lazer',
  protecao: 'protecao',
  saude: 'protecao',
  farmacia: 'protecao',
  profissional: 'profissional',
};

function mapToCanonicalMatrixCategory(rawCat?: string): CategoryKey {
  if (!rawCat) return 'moradia';
  return CANONICAL_CATEGORY_ALIAS_MAP[rawCat] || 'moradia';
}

/**
 * 28C & 29B: Seletor unificado para as Duas Visões Reconciliadas do Orçamento (Categorias vs Estrutura).
 * Reconcilia Plano Aprovado por Competência, Ocorrências Compartilhadas (coupleFixedBills + fixedBillAlerts),
 * Fatias Classificadas (splits em centavos exatos), Natureza Desconhecida (pendente sem inventar variável),
 * Teto Zero Explícito vs Ausência de Teto, Rateio Individual sem metade arbitrária e Aportes.
 */
export function selectReconciledBudgetMatrix(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): ReconciledBudgetMatrixResult {
  const currentMonthKey = monthKey || state.currentMonth || '2026-11';
  const plannedNetIncome = selectPlannedNetIncome(state, scope, currentMonthKey);
  const receivedEligibleNetIncome = selectEligibleNetIncomeReceived(state, scope, currentMonthKey);

  const plan = state.monthlyBudgetPlans?.[currentMonthKey];
  let fixedPct = plan?.macroGroups?.fixos?.percentage ?? 60;
  let varPct = plan?.macroGroups?.variaveis?.percentage ?? 30;
  let investPct = plan?.macroGroups?.investimentos?.percentage ?? 10;

  if (!plan && state.categoryPercentages) {
    const p = state.categoryPercentages;
    const f = (p.moradia ?? 0) + (p.protecao ?? 0);
    const v = (p.comida ?? 0) + (p.lazer ?? 0) + (p.transporte ?? 0) + (p.profissional ?? 0);
    const i = p.investimentos ?? state.profile?.investmentsPercentage ?? 10;
    if (Math.abs(f + v + i - 100) < 1) {
      fixedPct = f;
      varPct = v;
      investPct = i;
    }
  } else if (plan && !plan.macroGroups && plan.categoryPercentages) {
    const p = plan.categoryPercentages;
    fixedPct = (p.moradia ?? 0) + (p.protecao ?? 0);
    varPct = (p.comida ?? 0) + (p.lazer ?? 0) + (p.transporte ?? 0) + (p.profissional ?? 0);
    investPct = p.investimentos ?? 10;
  }

  // 29B (R29-15): Teto explícito (positivo ou zero) vs ausência de teto, sem metade arbitrária para escopo individual
  let hasExplicitCeiling = false;
  let fixedBudget = 0;
  let varBudget = 0;
  let investTarget = 0;

  if (scope === 'casal') {
    hasExplicitCeiling =
      Boolean(plan) || Boolean(state.isCustomizedPercentages) || plannedNetIncome > 0;
    if (hasExplicitCeiling) {
      fixedBudget =
        plan?.macroGroups?.fixos?.amountR$ !== undefined
          ? roundMoney(plan.macroGroups.fixos.amountR$)
          : roundMoney((plannedNetIncome * fixedPct) / 100);
      varBudget =
        plan?.macroGroups?.variaveis?.amountR$ !== undefined
          ? roundMoney(plan.macroGroups.variaveis.amountR$)
          : roundMoney((plannedNetIncome * varPct) / 100);
      investTarget =
        plan?.macroGroups?.investimentos?.amountR$ !== undefined
          ? roundMoney(plan.macroGroups.investimentos.amountR$)
          : roundMoney((plannedNetIncome * investPct) / 100);
    }
  } else {
    const partnerCeiling = plan?.partnerCeilings?.[scope];
    if (partnerCeiling) {
      hasExplicitCeiling = true;
      fixedBudget =
        partnerCeiling.fixedCeilingR$ !== undefined
          ? roundMoney(partnerCeiling.fixedCeilingR$)
          : roundMoney((plannedNetIncome * fixedPct) / 100);
      varBudget =
        partnerCeiling.variableCeilingR$ !== undefined
          ? roundMoney(partnerCeiling.variableCeilingR$)
          : roundMoney((plannedNetIncome * varPct) / 100);
      investTarget =
        partnerCeiling.investTargetR$ !== undefined
          ? roundMoney(partnerCeiling.investTargetR$)
          : roundMoney((plannedNetIncome * investPct) / 100);
    } else {
      hasExplicitCeiling = false;
      fixedBudget = 0;
      varBudget = 0;
      investTarget = 0;
    }
  }

  const resolveCeilingState = (explicit: boolean, ceilingVal: number): CeilingState => {
    if (!explicit) return 'absent';
    return ceilingVal > 0 ? 'explicit_positive' : 'explicit_zero';
  };

  const overallCeilingState: CeilingState = resolveCeilingState(
    hasExplicitCeiling,
    roundMoney(fixedBudget + varBudget)
  );
  const fixedCeilingState: CeilingState = resolveCeilingState(hasExplicitCeiling, fixedBudget);
  const varCeilingState: CeilingState = resolveCeilingState(hasExplicitCeiling, varBudget);

  const catFixedCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const catVarCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const catUnclassifiedCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const catPendingFixedCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const catPendingVarCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };

  // 1. Ocorrências fixas compartilhadas (contas fixas reconciliadas + fatias diretas fixas + parcelas fixas)
  const { occurrences: fixedOccurrences, registryConflicts } = projectSharedFixedOccurrences(
    state,
    currentMonthKey,
    scope
  );

  for (const occ of fixedOccurrences) {
    const cat = mapToCanonicalMatrixCategory(occ.categoryKey);
    if (occ.status === 'paid') {
      catFixedCents[cat] += occ.apportionedAmountCents;
    } else {
      catPendingFixedCents[cat] += occ.apportionedAmountCents;
    }
  }

  // 2. Fatias de despesas variáveis / eventuais / natureza desconhecida (R29-12, R29-13, R29-14, R29-16)
  const expenses = state.expenses || [];
  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );
  const { bills: canonicalBills } = selectCanonicalFixedBillsRegistry(state);
  const canonicalBillIds = new Set(canonicalBills.map((b) => b.id));

  let pendingClassificationCount = 0;
  const pendingClassificationSliceIds: string[] = [];

  for (const exp of expenses) {
    if (!exp) continue;
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    // Se vinculada a conta fixa cadastrada ou parcela, já foi reconciliada nas projeções dedicadas sem duplicar
    if (exp.linkedBillId && canonicalBillIds.has(exp.linkedBillId)) continue;
    if (exp.installmentId) continue;

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });

    for (const slice of slices) {
      if (slice.competenceMonth !== currentMonthKey) continue;
      if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') continue;
      // Fatia direta de natureza fixa confiável já entrou em projectSharedFixedOccurrences
      if (slice.hasReliableNature && slice.resolvedNature === 'fixa') continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (!split.isInScope) continue;

      const cat = mapToCanonicalMatrixCategory(slice.category);
      if (slice.hasReliableNature) {
        catVarCents[cat] += split.scopedCents;
      } else {
        catUnclassifiedCents[cat] += split.scopedCents;
        pendingClassificationCount += 1;
        pendingClassificationSliceIds.push(slice.splitId);
      }
    }
  }

  // 3. Ocorrências de compras parceladas de consumo (natureza não fixa)
  const instOccurrences = projectInstallmentOccurrencesForCompetence(
    state,
    currentMonthKey,
    scope
  );
  for (const instOcc of instOccurrences) {
    if (instOcc.isFixedNature) continue; // já incluída em fixedOccurrences
    const cat = mapToCanonicalMatrixCategory(instOcc.category);
    if (instOcc.status === 'paid' || instOcc.status === 'advanced') {
      catVarCents[cat] += instOcc.scopedCents;
    } else {
      catPendingVarCents[cat] += instOcc.scopedCents;
    }
  }

  const CATEGORY_NAMES_MAP: Record<CategoryKey, { name: string; emoji: string }> = {
    moradia: { name: 'Moradia', emoji: '🏠' },
    comida: { name: 'Comida & Conveniência', emoji: '🍽️' },
    lazer: { name: 'Lazer', emoji: '🎮' },
    protecao: { name: 'Proteção', emoji: '🛡️' },
    profissional: { name: 'Profissional', emoji: '📚' },
    transporte: { name: 'Transporte & Mobilidade', emoji: '🚗' },
  };

  // 4. Cálculo das Linhas por Categoria
  const categoryKeys: CategoryKey[] = [
    'moradia',
    'transporte',
    'comida',
    'lazer',
    'protecao',
    'profissional',
  ];
  const categoryPercentages = plan?.categoryPercentages || state.categoryPercentages || {
    moradia: 30,
    transporte: 10,
    comida: 25,
    lazer: 15,
    protecao: 10,
    profissional: 0,
  };

  let totalAllocatedVarCatBudget = 0;
  const categories: ReconciledCategoryRow[] = categoryKeys.map((key) => {
    const catInfo = CATEGORY_NAMES_MAP[key] || { name: key, emoji: '🏷️' };
    const pct = categoryPercentages[key] ?? 0;

    let plannedBudget = 0;
    if (hasExplicitCeiling) {
      if (scope === 'casal' && plan?.categoryAmountsR$?.[key] !== undefined) {
        plannedBudget = roundMoney(plan.categoryAmountsR$[key]);
      } else if (
        scope !== 'casal' &&
        plan?.partnerCeilings?.[scope]?.categoryAmountsR$?.[key] !== undefined
      ) {
        plannedBudget = roundMoney(plan.partnerCeilings[scope]!.categoryAmountsR$![key]!);
      } else {
        plannedBudget = roundMoney((plannedNetIncome * pct) / 100);
      }
    }

    const catCeilingState = resolveCeilingState(hasExplicitCeiling, plannedBudget);
    const fixedSpent = roundMoney(catFixedCents[key] / 100);
    const variableSpent = roundMoney(catVarCents[key] / 100);
    const unclassifiedSpent = roundMoney(catUnclassifiedCents[key] / 100);
    const realizedLiquid = roundMoney(
      (catFixedCents[key] + catVarCents[key] + catUnclassifiedCents[key]) / 100
    );
    const pendingCommitments = roundMoney(
      (catPendingFixedCents[key] + catPendingVarCents[key]) / 100
    );
    const projectedTotal = roundMoney(realizedLiquid + pendingCommitments);
    const signedMargin = roundMoney(plannedBudget - projectedTotal);
    const isOverCeiling = hasExplicitCeiling && projectedTotal > plannedBudget;
    const overAmount = isOverCeiling ? roundMoney(projectedTotal - plannedBudget) : 0;
    const percentageUsed =
      !hasExplicitCeiling
        ? 0
        : plannedBudget > 0
        ? Math.min(100, Math.round((projectedTotal / plannedBudget) * 100))
        : projectedTotal > 0
        ? 100
        : 0;

    if (key !== 'moradia' && key !== 'protecao') {
      totalAllocatedVarCatBudget += plannedBudget;
    }

    return {
      key,
      name: catInfo.name,
      emoji: catInfo.emoji,
      plannedBudget,
      fixedSpent,
      variableSpent,
      unclassifiedSpent,
      realizedLiquid,
      pendingCommitments,
      projectedTotal,
      signedMargin,
      isOverCeiling,
      overAmount,
      percentageUsed,
      hasExplicitCeiling,
      ceilingState: catCeilingState,
    };
  });

  // 5. Blocos de Estrutura (Fixos, Variáveis e Pendentes de Classificação separados)
  const totalFixedRealizedCents = Object.values(catFixedCents).reduce((s, v) => s + v, 0);
  const totalVarRealizedCents = Object.values(catVarCents).reduce((s, v) => s + v, 0);
  const totalUnclassifiedCents = Object.values(catUnclassifiedCents).reduce((s, v) => s + v, 0);
  const totalPendingFixedCents = Object.values(catPendingFixedCents).reduce((s, v) => s + v, 0);
  const totalPendingVarCents = Object.values(catPendingVarCents).reduce((s, v) => s + v, 0);

  const totalFixedSpent = roundMoney(totalFixedRealizedCents / 100);
  const totalVarSpent = roundMoney(totalVarRealizedCents / 100);
  const totalUnclassifiedSpent = roundMoney(totalUnclassifiedCents / 100);
  const fixedPendingTotal = roundMoney(totalPendingFixedCents / 100);
  const varPendingTotal = roundMoney(totalPendingVarCents / 100);

  const fixedProjectedTotal = roundMoney((totalFixedRealizedCents + totalPendingFixedCents) / 100);
  const varProjectedTotal = roundMoney((totalVarRealizedCents + totalPendingVarCents) / 100);

  const fixosBlock: ReconciledStructureBlock = {
    key: 'fixos',
    title: 'Despesas Fixas & Compromissos',
    plannedBudget: fixedBudget,
    realizedLiquid: totalFixedSpent,
    pendingCommitments: fixedPendingTotal,
    projectedTotal: fixedProjectedTotal,
    signedMargin: roundMoney(fixedBudget - fixedProjectedTotal),
    isOverCeiling: hasExplicitCeiling && fixedProjectedTotal > fixedBudget,
    overAmount: hasExplicitCeiling ? Math.max(0, roundMoney(fixedProjectedTotal - fixedBudget)) : 0,
    percentageUsed:
      !hasExplicitCeiling
        ? 0
        : fixedBudget > 0
        ? Math.min(100, Math.round((fixedProjectedTotal / fixedBudget) * 100))
        : fixedProjectedTotal > 0
        ? 100
        : 0,
    hasExplicitCeiling,
    ceilingState: fixedCeilingState,
    denominatorLabel:
      fixedCeilingState === 'absent'
        ? 'Sem teto fixo aprovado'
        : fixedCeilingState === 'explicit_zero'
        ? 'Teto fixo explícito R$ 0,00'
        : `Teto fixo aprovado (${fixedPct}%)`,
  };

  const unallocatedVariableMargin = Math.max(
    0,
    roundMoney(varBudget - totalAllocatedVarCatBudget)
  );

  const variaveisBlock: ReconciledStructureBlock = {
    key: 'variaveis',
    title: 'Gastos Variáveis & Rotina',
    plannedBudget: varBudget,
    realizedLiquid: totalVarSpent,
    pendingCommitments: varPendingTotal,
    projectedTotal: varProjectedTotal,
    signedMargin: roundMoney(varBudget - varProjectedTotal),
    unallocatedVariableMargin,
    isOverCeiling: hasExplicitCeiling && varProjectedTotal > varBudget,
    overAmount: hasExplicitCeiling ? Math.max(0, roundMoney(varProjectedTotal - varBudget)) : 0,
    percentageUsed:
      !hasExplicitCeiling
        ? 0
        : varBudget > 0
        ? Math.min(100, Math.round((varProjectedTotal / varBudget) * 100))
        : varProjectedTotal > 0
        ? 100
        : 0,
    hasExplicitCeiling,
    ceilingState: varCeilingState,
    denominatorLabel:
      varCeilingState === 'absent'
        ? 'Sem teto variável aprovado'
        : varCeilingState === 'explicit_zero'
        ? 'Teto variável explícito R$ 0,00'
        : `Teto variável aprovado (${varPct}%)`,
  };

  // 6. Bloco de Investimentos (Aporte de Longo Prazo)
  const ops = state.financialOperations || [];
  let actualDepositedCents = 0;
  for (const op of ops) {
    if (op.type !== 'GOAL_DEPOSIT') continue;
    if (currentMonthKey && op.date && !op.date.startsWith(currentMonthKey)) continue;
    if (op.state === 'reverted' || op.state === 'estornado') continue;
    const opScope =
      op.scope && op.scope !== 'couple' && op.scope !== 'casal'
        ? op.scope
        : (op.authorizedBy as any) || op.scope;
    const split = apportionCentsByScope(readOperationAmountCents(op), scope, opScope);
    if (split.isInScope) {
      actualDepositedCents += split.scopedCents;
    }
  }
  const actualDeposited = roundMoney(actualDepositedCents / 100);
  const remainingTarget = Math.max(0, roundMoney(investTarget - actualDeposited));

  const investimentosBlock: ReconciledInvestmentBlock = {
    targetAmount: investTarget,
    actualDeposited,
    remainingTarget,
    isGoalMet: investTarget > 0 ? actualDeposited >= investTarget : actualDeposited >= 0 && hasExplicitCeiling,
    percentageMet:
      investTarget > 0
        ? Math.min(100, Math.round((actualDeposited / investTarget) * 100))
        : 0,
  };

  // 7. Path B: Consumo Direto de Caixinha / Reserva (C43)
  const goalDirectConsumption = selectGoalDirectConsumptionExpenses(state, scope, currentMonthKey);

  // 8. Saída Efetiva de Caixa no Mês Civil (Pix / Débito / Dinheiro à vista por DATA DE CAIXA, não competência)
  let cashOutflowCents = 0;
  for (const exp of expenses) {
    if (!exp) continue;
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    if (!exp.date || !exp.date.startsWith(currentMonthKey)) continue;
    if (exp.paymentMethod === 'credit') continue;

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });
    for (const slice of slices) {
      if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') continue;
      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (split.isInScope) {
        cashOutflowCents += split.scopedCents;
      }
    }
  }
  const cashOutflowSpent = roundMoney(cashOutflowCents / 100);

  // 9. Matriz em centavos para o contrato v2.0
  const categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents> = {} as any;
  for (const key of categoryKeys) {
    categoryMatrixCents[key] = {
      fixedCents: catFixedCents[key],
      variableCents: catVarCents[key],
      unclassifiedCents: catUnclassifiedCents[key],
      totalCents: catFixedCents[key] + catVarCents[key] + catUnclassifiedCents[key],
    };
  }

  const totalPlannedBudget = roundMoney(fixedBudget + varBudget);
  const totalRealizedLiquid = roundMoney(
    (totalFixedRealizedCents + totalVarRealizedCents + totalUnclassifiedCents) / 100
  );
  const totalPendingCommitments = roundMoney(
    (totalPendingFixedCents + totalPendingVarCents) / 100
  );
  const totalProjectedConsumption = roundMoney(totalRealizedLiquid + totalPendingCommitments);
  const totalSignedMargin = roundMoney(totalPlannedBudget - totalProjectedConsumption);

  return {
    competence: currentMonthKey,
    scope,
    plannedNetIncome,
    receivedEligibleNetIncome,
    policyRatios: { fixedPct, varPct, investPct },
    hasExplicitCeiling,
    ceilingState: overallCeilingState,
    structureBlocks: {
      fixos: fixosBlock,
      variaveis: variaveisBlock,
      investimentos: investimentosBlock,
    },
    categories,
    totalPlannedBudget,
    totalRealizedLiquid,
    totalPendingCommitments,
    totalProjectedConsumption,
    totalSignedMargin,
    unclassifiedSpent: totalUnclassifiedSpent,
    unclassifiedCents: totalUnclassifiedCents,
    pendingClassificationCount,
    pendingClassificationSliceIds,
    registryConflicts,
    goalDirectConsumption,
    cashOutflowSpent,
    categoryMatrixCents,
    unassignedVariableMarginCents: Math.round(unallocatedVariableMargin * 100),
  };
}

