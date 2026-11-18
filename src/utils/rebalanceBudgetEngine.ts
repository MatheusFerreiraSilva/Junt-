import {
  AppState,
  BudgetPlanContract,
  CategoryKey,
  CategoryMatrixEntryCents,
  DestinationKey,
  MacroGroupAllocation,
  MacroGroupKey,
} from '../types/finance';
import { readOperationAmountCents } from './financialCommands';
import {
  addMonthsToCompetence,
  apportionCentsByScope,
  mapToCanonicalCategoryKey,
  projectCanonicalExpenseSlices,
  projectInstallmentOccurrencesForCompetence,
  projectSharedFixedOccurrences,
  roundMoney,
  selectCanonicalFixedBillsRegistry,
  toSafeCents,
} from './occurrenceProjection';
import {
  allocateIncomeByPolicy,
  DEFAULT_CATEGORY_GROUP_MAPPING,
  selectEligibleNetIncomeReceived,
  selectGoalDirectConsumptionExpenses,
  selectGrossBankInflows,
  selectPlannedNetIncome,
  upgradeBudgetPlanContract,
} from './domainSelectors';

export type PriorityLevel = 'P1' | 'P2' | 'P3';

export const ALL_CATEGORIES: CategoryKey[] = [
  'moradia',
  'transporte',
  'comida',
  'lazer',
  'protecao',
  'profissional',
];

export const ALL_DESTINATIONS: DestinationKey[] = [
  'moradia',
  'transporte',
  'comida',
  'lazer',
  'protecao',
  'profissional',
  'investimentos',
];

export const DESTINATION_NAMES: Record<DestinationKey, string> = {
  moradia: 'Moradia',
  transporte: 'Transporte',
  comida: 'Comida & Conveniência',
  lazer: 'Lazer',
  protecao: 'Proteção',
  profissional: 'Profissional',
  investimentos: 'Investimentos',
};

export const DEFAULT_PRIORITIES: Record<DestinationKey, PriorityLevel> = {
  moradia: 'P1',
  protecao: 'P1',
  profissional: 'P1',
  comida: 'P2',
  transporte: 'P2',
  investimentos: 'P2',
  lazer: 'P3',
};

export interface CategoryNatureBreakdownR$ {
  fixedR$: number;
  variableR$: number;
  unclassifiedR$?: number;
}

export interface GroupTargetsPct {
  fixos: number;
  variaveis: number;
  investimentos: number;
}

export interface RebalanceParams {
  plannedNetIncome: number;
  currentPercentages: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floorsR$?: Record<DestinationKey, number>;
  /** Pending obligations ONLY (not yet settled in expenses) */
  commitmentsR$?: Record<DestinationKey, number>;
  /** Realized spending in competence (distinct from pending commitments!) */
  actualSpentR$?: Record<DestinationKey, number>;
  actualSpentByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
  pendingByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
  priorities?: Record<DestinationKey, PriorityLevel>;
  referencePreset?: Record<DestinationKey, number>;
  groupTargetsPct?: GroupTargetsPct;
  enforceGroupCeilings?: boolean;
  competence?: string; // YYYY-MM
  applyToFutureMonths?: boolean;
  baseSnapshotSignature?: string;
}

export interface RebalanceConflict {
  destination: DestinationKey;
  type:
    | 'lock_below_commitments'
    | 'floor_exceeds_budget'
    | 'sum_locks_exceeds_100'
    | 'total_required_exceeds_income'
    | 'group_ceiling_exceeded'
    | 'category_group_lock_conflict'
    | 'invalid_input';
  message: string;
  requiredR$: number;
  allocatedR$: number;
}

export interface RebalanceResult {
  status: 'feasible' | 'infeasible';
  competence: string;
  plannedNetIncome: number;
  version: string;
  baseSnapshotSignature?: string;
  proposedPercentages: Record<DestinationKey, number>;
  proposedAmountsR$: Record<DestinationKey, number>;
  oldPercentages: Record<DestinationKey, number>;
  oldAmountsR$: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floorsR$: Record<DestinationKey, number>;
  commitmentsR$: Record<DestinationKey, number>;
  actualSpentR$: Record<DestinationKey, number>;
  requiredMarginR$: Record<DestinationKey, number>;
  macroGroups: Record<MacroGroupKey, MacroGroupAllocation>;
  categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents>;
  totalPercentagesSum: number; // 100.00 when feasible
  totalProposedR$: number; // equal to plannedNetIncome when feasible
  totalRequiredR$: number;
  deficitR$: number; // > 0 if infeasible
  conflicts: RebalanceConflict[];
  explanation: string;
  recoveryOptions: string[];
  referencePreset: Record<DestinationKey, number>;
  applyToFutureMonths: boolean;
}

/**
 * Fallback weights ONLY when neither referencePreset nor currentPercentages provide valid weights.
 * Notice: investments defaults to 10% (60/30/10 policy), NEVER imposing 30% automatically!
 */
const NEUTRAL_POLICY_FALLBACK_WEIGHTS: Record<DestinationKey, number> = {
  moradia: 35,
  protecao: 25,
  comida: 15,
  lazer: 10,
  transporte: 5,
  profissional: 0,
  investimentos: 10,
};

/**
 * Generates an explicit personalized group ratio proposal when user selects a custom investment target (e.g. 15% -> 60/25/15),
 * never imposing 30% or hiding the policy change.
 */
export function proposeCustomInvestmentRatio(
  targetInvestPct: number,
  currentGroupRatios: { fixedPct: number; varPct: number; investPct: number } = {
    fixedPct: 60,
    varPct: 30,
    investPct: 10,
  }
): {
  isCustomPolicy: boolean;
  policyLabel: string;
  proposedGroupRatios: { fixedPct: number; varPct: number; investPct: number };
  explanation: string;
} {
  const safeInvest = Math.max(0, Math.min(100, roundMoney(targetInvestPct)));
  const remainingForConsumption = roundMoney(100 - safeInvest);
  const prevConsumption = currentGroupRatios.fixedPct + currentGroupRatios.varPct;

  let nextFixedPct = currentGroupRatios.fixedPct;
  let nextVarPct = currentGroupRatios.varPct;

  if (remainingForConsumption <= 0) {
    nextFixedPct = 0;
    nextVarPct = 0;
  } else if (safeInvest > currentGroupRatios.investPct) {
    const delta = roundMoney(safeInvest - currentGroupRatios.investPct);
    // Prefer adjusting variable consumption first while preserving fixed commitments when possible
    if (currentGroupRatios.varPct >= delta) {
      nextFixedPct = currentGroupRatios.fixedPct;
      nextVarPct = roundMoney(currentGroupRatios.varPct - delta);
    } else {
      nextVarPct = 0;
      nextFixedPct = remainingForConsumption;
    }
  } else if (safeInvest < currentGroupRatios.investPct) {
    const delta = roundMoney(currentGroupRatios.investPct - safeInvest);
    nextFixedPct = currentGroupRatios.fixedPct;
    nextVarPct = roundMoney(currentGroupRatios.varPct + delta);
  } else if (Math.abs(prevConsumption - remainingForConsumption) > 0.01) {
    nextFixedPct = roundMoney((remainingForConsumption * 2) / 3);
    nextVarPct = roundMoney(remainingForConsumption - nextFixedPct);
  }

  const isStandard603010 =
    Math.abs(nextFixedPct - 60) < 0.01 &&
    Math.abs(nextVarPct - 30) < 0.01 &&
    Math.abs(safeInvest - 10) < 0.01;

  return {
    isCustomPolicy: !isStandard603010,
    policyLabel: isStandard603010
      ? 'Política 60/30/10'
      : `Política Personalizada (${nextFixedPct}/${nextVarPct}/${safeInvest})`,
    proposedGroupRatios: {
      fixedPct: nextFixedPct,
      varPct: nextVarPct,
      investPct: safeInvest,
    },
    explanation: isStandard603010
      ? 'Proporção padrão 60% Fixos / 30% Variáveis / 10% Investimentos.'
      : `Proposta personalizada explícita (${nextFixedPct}/${nextVarPct}/${safeInvest}) para acomodar ${safeInvest}% em Investimentos.`,
  };
}

export interface CompetenceBudgetSnapshot {
  competence: string;
  plannedNetIncome: number;
  eligibleReceivedIncomeR$: number;
  grossBankInflowsR$: number;
  goalDirectConsumptionR$: number;
  actualSpentR$: Record<DestinationKey, number>;
  pendingCommitmentsR$: Record<DestinationKey, number>;
  totalCommittedAndSpentR$: Record<DestinationKey, number>;
  floorsR$: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  currentPercentages: Record<DestinationKey, number>;
  actualSpentByNatureR$: Record<CategoryKey, CategoryNatureBreakdownR$>;
  pendingByNatureR$: Record<CategoryKey, CategoryNatureBreakdownR$>;
  categoryReinforcementsR$: Record<CategoryKey, number>;
  netCategoryReallocationsR$: Record<CategoryKey, number>;
  effectiveEnvelopeBalanceR$: Record<CategoryKey, number>;
  planRevision: number;
  hasApprovedPlan: boolean;
  approvedPlan?: BudgetPlanContract;
  signature: string;
}

/**
 * Seleciona o plano orçamentário vigente para uma competência:
 * 1. Plano explicitamente salvo em `monthlyBudgetPlans[competence]`, se existir;
 * 2. Plano anterior mais recente com `applyToFutureMonths === true` e `plan.competence <= competence`, se existir;
 * 3. `undefined` (usa projeção compatível do estado vigente sem inventar aprovação humana).
 */
export function selectEffectiveBudgetPlanForCompetence(
  state: Pick<AppState, 'monthlyBudgetPlans'>,
  competence: string
): { plan?: BudgetPlanContract; source: 'explicit_month' | 'inherited_future' | 'none' } {
  const plans = state.monthlyBudgetPlans || {};
  if (plans[competence]) {
    return {
      plan: upgradeBudgetPlanContract(plans[competence]),
      source: 'explicit_month',
    };
  }

  const inheritedCandidates = Object.values(plans)
    .filter((p) => p && p.applyToFutureMonths && p.competence && p.competence < competence)
    .sort((a, b) => a.competence.localeCompare(b.competence));

  if (inheritedCandidates.length > 0) {
    const latest = inheritedCandidates[inheritedCandidates.length - 1];
    return {
      plan: upgradeBudgetPlanContract({
        ...latest,
        id: competence,
        competence,
      }),
      source: 'inherited_future',
    };
  }

  return { plan: undefined, source: 'none' };
}

/**
 * Computa snapshot canônico por competência integrando seletores 29B (`occurrenceProjection` + `domainSelectors`):
 * - Distingue estritamente `actualSpentR$` (gastos realizados e baixas confirmadas) de `pendingCommitmentsR$` (contas fixas e parcelas vincendas ainda não liquidadas).
 * - Nunca conta duas vezes parcela já liquidada em `expenses` nem conta fixa já paga.
 * - Exclui compras diretas de objetivo (`Path B`) das linhas mensais das 6 categorias, preservando consumo econômico geral.
 * - Calcula reforços temporários (`CATEGORY_REINFORCEMENT`) apenas na competência do reforço sem alterar os percentuais-base nem repetir no mês seguinte.
 */
export function computeCompetenceBudgetSnapshot(
  state: AppState,
  competenceMonth?: string
): CompetenceBudgetSnapshot {
  const competence = competenceMonth || state.currentMonth || new Date().toISOString().slice(0, 7);
  const { plan: effectivePlan, source: planSource } = selectEffectiveBudgetPlanForCompetence(
    state,
    competence
  );

  const plannedNetIncome =
    effectivePlan && effectivePlan.plannedNetIncome > 0
      ? roundMoney(effectivePlan.plannedNetIncome)
      : selectPlannedNetIncome(state, 'casal', competence);

  const eligibleReceivedIncomeR$ = selectEligibleNetIncomeReceived(state, 'casal', competence);
  const grossBankInflowsR$ = selectGrossBankInflows(state, 'casal', competence);
  const goalDirectConsumptionR$ = selectGoalDirectConsumptionExpenses(state, 'casal', competence);

  const actualFixedCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  const actualVarCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  const actualUnclassifiedCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  const pendingFixedCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  const pendingVarCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };

  // 1. Ocorrências fixas compartilhadas de 29B (contas fixas reconciliadas + fatias diretas fixas + parcelas fixas)
  const { occurrences: fixedOccs } = projectSharedFixedOccurrences(state, competence, 'couple');
  for (const occ of fixedOccs) {
    const cat = mapToCanonicalCategoryKey(occ.categoryKey);
    if (occ.status === 'paid') {
      actualFixedCents[cat] += occ.apportionedAmountCents;
    } else {
      pendingFixedCents[cat] += occ.apportionedAmountCents;
    }
  }

  // 2. Fatias de despesas variáveis / eventuais / sem natureza confiável na competência
  const expenses = state.expenses || [];
  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );
  const { bills: canonicalBills } = selectCanonicalFixedBillsRegistry(state);
  const canonicalBillIds = new Set(canonicalBills.map((b) => b.id));

  for (const exp of expenses) {
    if (!exp) continue;
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    if (exp.linkedBillId && canonicalBillIds.has(exp.linkedBillId)) continue;
    if (exp.installmentId) continue;

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });

    for (const slice of slices) {
      if (slice.competenceMonth !== competence) continue;
      if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') continue;
      if (slice.hasReliableNature && slice.resolvedNature === 'fixa') continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        'couple',
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (!split.isInScope) continue;

      const cat = mapToCanonicalCategoryKey(slice.category);
      if (slice.hasReliableNature) {
        actualVarCents[cat] += split.scopedCents;
      } else {
        actualUnclassifiedCents[cat] += split.scopedCents;
      }
    }
  }

  // 3. Ocorrências de compras parceladas de natureza não fixa (29B)
  const instOccurrences = projectInstallmentOccurrencesForCompetence(state, competence, 'couple');
  for (const instOcc of instOccurrences) {
    if (instOcc.isFixedNature) continue;
    const cat = mapToCanonicalCategoryKey(instOcc.category);
    if (instOcc.status === 'paid' || instOcc.status === 'advanced') {
      actualVarCents[cat] += instOcc.scopedCents;
    } else {
      pendingVarCents[cat] += instOcc.scopedCents;
    }
  }

  // 4. Aportes realizados no mês em Investimentos
  let actualInvestDepositedCents = 0;
  for (const op of state.financialOperations || []) {
    if (op.type !== 'GOAL_DEPOSIT') continue;
    const opComp = op.competence || (op.date ? op.date.slice(0, 7) : '');
    if (opComp !== competence) continue;
    if (op.state === 'reverted' || op.state === 'estornado' || op.state === 'planned') continue;
    actualInvestDepositedCents += readOperationAmountCents(op);
  }

  // 5. Reforços temporários (26A/26C) e realocações entre categorias na competência
  const reinforcementCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  for (const op of state.financialOperations || []) {
    if (op.type !== 'CATEGORY_REINFORCEMENT') continue;
    if (op.state === 'reverted' || op.state === 'estornado' || op.state === 'planned') continue;
    const opComp = op.competence || (op.date ? op.date.slice(0, 7) : '');
    if (opComp !== competence) continue;
    if (op.targetRef?.type === 'category' && op.targetRef.id) {
      const cat = mapToCanonicalCategoryKey(op.targetRef.id);
      reinforcementCents[cat] += readOperationAmountCents(op);
    }
  }

  // Temporary budget adjustments if present for this competence
  for (const adj of Object.values(state.temporaryBudgetAdjustments || {})) {
    if (!adj) continue;
    if (adj.expiresAt && adj.expiresAt.slice(0, 7) === competence) {
      const cat = mapToCanonicalCategoryKey(adj.category);
      reinforcementCents[cat] += toSafeCents(adj.amount);
    }
  }

  const netReallocCents: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };

  const actualSpentR$: Record<DestinationKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: roundMoney(actualInvestDepositedCents / 100),
  };
  const pendingCommitmentsR$: Record<DestinationKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: 0,
  };
  const totalCommittedAndSpentR$: Record<DestinationKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: roundMoney(actualInvestDepositedCents / 100),
  };
  const actualSpentByNatureR$: Record<CategoryKey, CategoryNatureBreakdownR$> = {} as any;
  const pendingByNatureR$: Record<CategoryKey, CategoryNatureBreakdownR$> = {} as any;
  const categoryReinforcementsR$: Record<CategoryKey, number> = {} as any;
  const netCategoryReallocationsR$: Record<CategoryKey, number> = {} as any;

  for (const cat of ALL_CATEGORIES) {
    const realCents = actualFixedCents[cat] + actualVarCents[cat] + actualUnclassifiedCents[cat];
    const pendCents = pendingFixedCents[cat] + pendingVarCents[cat];
    actualSpentR$[cat] = roundMoney(realCents / 100);
    pendingCommitmentsR$[cat] = roundMoney(pendCents / 100);
    totalCommittedAndSpentR$[cat] = roundMoney((realCents + pendCents) / 100);
    actualSpentByNatureR$[cat] = {
      fixedR$: roundMoney(actualFixedCents[cat] / 100),
      variableR$: roundMoney(actualVarCents[cat] / 100),
      unclassifiedR$: roundMoney(actualUnclassifiedCents[cat] / 100),
    };
    pendingByNatureR$[cat] = {
      fixedR$: roundMoney(pendingFixedCents[cat] / 100),
      variableR$: roundMoney(pendingVarCents[cat] / 100),
    };
    categoryReinforcementsR$[cat] = roundMoney(reinforcementCents[cat] / 100);
    netCategoryReallocationsR$[cat] = roundMoney(netReallocCents[cat] / 100);
  }

  // Percentages, locks & floors resolution prioritizing competence plan when present
  const currentPercentages: Record<DestinationKey, number> = effectivePlan
    ? {
        moradia: effectivePlan.categoryPercentages.moradia ?? 30,
        transporte: effectivePlan.categoryPercentages.transporte ?? 10,
        comida: effectivePlan.categoryPercentages.comida ?? 15,
        lazer: effectivePlan.categoryPercentages.lazer ?? 15,
        protecao: effectivePlan.categoryPercentages.protecao ?? 10,
        profissional: effectivePlan.categoryPercentages.profissional ?? 10,
        investimentos: effectivePlan.categoryPercentages.investimentos ?? 10,
      }
    : {
        moradia: state.categoryPercentages?.moradia ?? 30,
        transporte: state.categoryPercentages?.transporte ?? 10,
        comida: state.categoryPercentages?.comida ?? 15,
        lazer: state.categoryPercentages?.lazer ?? 15,
        protecao: state.categoryPercentages?.protecao ?? 10,
        profissional: state.categoryPercentages?.profissional ?? 10,
        investimentos: state.profile?.investmentsPercentage ?? 10,
      };

  const locks: Record<DestinationKey, boolean> = effectivePlan?.categoryLocks
    ? { ...effectivePlan.categoryLocks }
    : {
        moradia: Boolean(state.categoryLocks?.moradia),
        transporte: Boolean(state.categoryLocks?.transporte),
        comida: Boolean(state.categoryLocks?.comida),
        lazer: Boolean(state.categoryLocks?.lazer),
        protecao: Boolean(state.categoryLocks?.protecao),
        profissional: Boolean(state.categoryLocks?.profissional),
        investimentos: Boolean(state.categoryLocks?.investimentos),
      };

  const rawInvestFloor = state.categoryFloors?.investimentos ?? 0;
  // In SettingsScreen, categoryFloors.investimentos may be stored as % (0-100); in BudgetPlanContract.categoryFloorsR$ it is R$.
  const investFloorFromGlobalR$ =
    rawInvestFloor > 0 && rawInvestFloor <= 100
      ? roundMoney((plannedNetIncome * rawInvestFloor) / 100)
      : roundMoney(rawInvestFloor);

  const floorsR$: Record<DestinationKey, number> = effectivePlan?.categoryFloorsR$
    ? { ...effectivePlan.categoryFloorsR$ }
    : {
        moradia: roundMoney(state.categoryFloors?.moradia ?? 0),
        transporte: roundMoney(state.categoryFloors?.transporte ?? 0),
        comida: roundMoney(state.categoryFloors?.comida ?? 0),
        lazer: roundMoney(state.categoryFloors?.lazer ?? 0),
        protecao: roundMoney(state.categoryFloors?.protecao ?? 0),
        profissional: roundMoney(state.categoryFloors?.profissional ?? 0),
        investimentos: investFloorFromGlobalR$,
      };

  // Envelope balance = base + confirmed reinforcements + net reallocations - realized consumption
  const effectiveEnvelopeBalanceR$: Record<CategoryKey, number> = {} as any;
  for (const cat of ALL_CATEGORIES) {
    const baseR$ =
      effectivePlan?.categoryAmountsR$?.[cat] !== undefined
        ? roundMoney(effectivePlan.categoryAmountsR$[cat])
        : roundMoney((plannedNetIncome * (currentPercentages[cat] ?? 0)) / 100);
    effectiveEnvelopeBalanceR$[cat] = roundMoney(
      baseR$ +
        categoryReinforcementsR$[cat] +
        netCategoryReallocationsR$[cat] -
        actualSpentR$[cat]
    );
  }

  const explicitPlan = state.monthlyBudgetPlans?.[competence];
  const planRevision = explicitPlan?.planRevision ?? 0;

  const signaturePayload = {
    competence,
    plannedNetIncome,
    actualSpentR$,
    pendingCommitmentsR$,
    floorsR$,
    locks,
    planRevision,
  };
  const signature = JSON.stringify(signaturePayload);

  return {
    competence,
    plannedNetIncome,
    eligibleReceivedIncomeR$,
    grossBankInflowsR$,
    goalDirectConsumptionR$,
    actualSpentR$,
    pendingCommitmentsR$,
    totalCommittedAndSpentR$,
    floorsR$,
    locks,
    currentPercentages,
    actualSpentByNatureR$,
    pendingByNatureR$,
    categoryReinforcementsR$,
    netCategoryReallocationsR$,
    effectiveEnvelopeBalanceR$,
    planRevision,
    hasApprovedPlan: planSource === 'explicit_month',
    approvedPlan: explicitPlan ? upgradeBudgetPlanContract(explicitPlan) : undefined,
    signature,
  };
}

/**
 * Constrói matriz Categoria × Grupo (Fixos vs Variáveis) fechando linhas e colunas em centavos inteiros.
 */
function buildConsistentCategoryGroupMatrix(params: {
  incomeCents: number;
  proposedCategoryCents: Record<DestinationKey, number>;
  groupTargetsPct?: GroupTargetsPct;
  actualSpentByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
  pendingByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
}): {
  macroGroups: Record<MacroGroupKey, MacroGroupAllocation>;
  categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents>;
} {
  const { incomeCents, proposedCategoryCents, groupTargetsPct, actualSpentByNatureR$, pendingByNatureR$ } = params;
  const investCents = proposedCategoryCents.investimentos || 0;
  const consumptionCents = Math.max(0, incomeCents - investCents);

  // Required fixed & variable minimums per category from realized + pending nature
  const minFixedByCat: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  const minVarByCat: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };

  for (const cat of ALL_CATEGORIES) {
    const act = actualSpentByNatureR$?.[cat];
    const pend = pendingByNatureR$?.[cat];
    const reqFix = toSafeCents(act?.fixedR$ || 0) + toSafeCents(pend?.fixedR$ || 0);
    const reqVar =
      toSafeCents(act?.variableR$ || 0) +
      toSafeCents(act?.unclassifiedR$ || 0) +
      toSafeCents(pend?.variableR$ || 0);
    const catCap = proposedCategoryCents[cat] || 0;
    minFixedByCat[cat] = Math.min(catCap, reqFix);
    minVarByCat[cat] = Math.min(Math.max(0, catCap - minFixedByCat[cat]), reqVar);
  }

  let targetFixedCents: number;
  let fixedPct: number;
  let varPct: number;
  const investPct = incomeCents > 0 ? roundMoney((investCents / incomeCents) * 100) : 0;

  if (groupTargetsPct) {
    const policyAlloc = allocateIncomeByPolicy(incomeCents / 100, {
      fixedPct: groupTargetsPct.fixos,
      varPct: groupTargetsPct.variaveis,
      investPct: groupTargetsPct.investimentos,
    });
    // Ensure consumptionCents = targetFixedCents + targetVarCents
    targetFixedCents = Math.min(consumptionCents, policyAlloc.macroGroups.fixos.cents);
    fixedPct = groupTargetsPct.fixos;
    varPct = groupTargetsPct.variaveis;
  } else {
    // Derive natural fixed share from category nature or default mapping
    let naturalFixedCents = 0;
    for (const cat of ALL_CATEGORIES) {
      const catTotal = proposedCategoryCents[cat] || 0;
      const reqFix = minFixedByCat[cat];
      const reqVar = minVarByCat[cat];
      if (reqFix + reqVar > 0) {
        const remaining = Math.max(0, catTotal - reqFix - reqVar);
        const defaultFixShare = DEFAULT_CATEGORY_GROUP_MAPPING[cat] === 'fixos' ? remaining : 0;
        naturalFixedCents += reqFix + defaultFixShare;
      } else {
        if (DEFAULT_CATEGORY_GROUP_MAPPING[cat] === 'fixos') {
          naturalFixedCents += catTotal;
        }
      }
    }
    targetFixedCents = Math.min(consumptionCents, naturalFixedCents);
    fixedPct = incomeCents > 0 ? roundMoney((targetFixedCents / incomeCents) * 100) : 60;
    varPct = roundMoney(Math.max(0, 100 - fixedPct - investPct));
  }

  // Clamp targetFixedCents to feasible bounds [sum(minFixed), consumptionCents - sum(minVar)]
  const sumMinFixed = ALL_CATEGORIES.reduce((s, c) => s + minFixedByCat[c], 0);
  const sumMinVar = ALL_CATEGORIES.reduce((s, c) => s + minVarByCat[c], 0);
  const maxPossibleFixed = Math.max(sumMinFixed, consumptionCents - sumMinVar);
  const effectiveFixedCents = Math.max(sumMinFixed, Math.min(maxPossibleFixed, targetFixedCents));
  const effectiveVarCents = Math.max(0, consumptionCents - effectiveFixedCents);

  // Allocate effectiveFixedCents across categories respecting [minFixedByCat[c], catTotal - minVarByCat[c]]
  const fixedAllocated: Record<CategoryKey, number> = { ...minFixedByCat };
  let remainingFixedToAssign = effectiveFixedCents - sumMinFixed;

  // Priority order: categories mapped to 'fixos' first (moradia, protecao), then mixed/other categories
  const catOrderForFixed: CategoryKey[] = [
    'moradia',
    'protecao',
    'transporte',
    'profissional',
    'comida',
    'lazer',
  ];

  for (const cat of catOrderForFixed) {
    if (remainingFixedToAssign <= 0) break;
    const catCap = (proposedCategoryCents[cat] || 0) - minVarByCat[cat];
    const room = Math.max(0, catCap - fixedAllocated[cat]);
    if (room > 0) {
      // If groupTargetsPct wasn't forcing non-fixed categories into fixed, only fill natural/required first;
      // here we fill in priority order so row totals and column totals close to the exact cent!
      const add = Math.min(room, remainingFixedToAssign);
      fixedAllocated[cat] += add;
      remainingFixedToAssign -= add;
    }
  }

  const categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents> = {} as any;
  for (const cat of ALL_CATEGORIES) {
    const totalCents = proposedCategoryCents[cat] || 0;
    const fixedCents = Math.min(totalCents, fixedAllocated[cat]);
    const variableCents = Math.max(0, totalCents - fixedCents);
    categoryMatrixCents[cat] = {
      fixedCents,
      variableCents,
      totalCents,
    };
  }

  const finalFixedGroupCents = ALL_CATEGORIES.reduce((s, c) => s + categoryMatrixCents[c].fixedCents, 0);
  const finalVarGroupCents = ALL_CATEGORIES.reduce((s, c) => s + categoryMatrixCents[c].variableCents, 0);

  const macroGroups: Record<MacroGroupKey, MacroGroupAllocation> = {
    fixos: {
      percentage: groupTargetsPct ? groupTargetsPct.fixos : fixedPct,
      amountR$: roundMoney(finalFixedGroupCents / 100),
    },
    variaveis: {
      percentage: groupTargetsPct ? groupTargetsPct.variaveis : varPct,
      amountR$: roundMoney(finalVarGroupCents / 100),
    },
    investimentos: {
      percentage: groupTargetsPct ? groupTargetsPct.investimentos : investPct,
      amountR$: roundMoney(investCents / 100),
    },
  };

  return { macroGroups, categoryMatrixCents };
}

/**
 * Motor determinístico de redistribuição orçamentária do Juntô (25A + 25C).
 * Função pura, sem dependências externas ou chamadas assíncronas:
 * - Distingue `actualSpentR$` (realizado) de `commitmentsR$` (compromissos pendentes únicos) e `floorsR$` (pisos).
 * - Nunca impõe preset de 30% de investimentos sem escolha/referência explícita.
 * - Corrige o defeito de piso após quota (`leftoverBp < 0`), garantindo soma exata de 10.000 pontos-base (100,00%) e centavos inteiros.
 * - Fecha linhas (categorias) e colunas (grupos Fixos / Variáveis / Investimentos) em centavos.
 */
export function rebalanceBudget(params: RebalanceParams): RebalanceResult {
  const competence = params.competence || new Date().toISOString().slice(0, 7);
  const plannedNetIncome = Number(params.plannedNetIncome) || 0;
  const currentPcts = { ...params.currentPercentages };
  const locks = { ...params.locks };
  const floors = { ...(params.floorsR$ || {}) } as Record<DestinationKey, number>;
  const commitments = { ...(params.commitmentsR$ || {}) } as Record<DestinationKey, number>;
  const actualSpent = { ...(params.actualSpentR$ || {}) } as Record<DestinationKey, number>;
  const priorities = { ...DEFAULT_PRIORITIES, ...(params.priorities || {}) };
  const applyToFutureMonths = Boolean(params.applyToFutureMonths);
  const version = new Date().toISOString();

  // Do NOT impose 30% investments automatically when referencePreset is omitted!
  const hasExplicitRefPreset = Boolean(params.referencePreset);
  const refPreset: Record<DestinationKey, number> = {} as any;

  ALL_DESTINATIONS.forEach((dest) => {
    if (typeof currentPcts[dest] !== 'number' || Number.isNaN(currentPcts[dest])) {
      currentPcts[dest] = hasExplicitRefPreset
        ? params.referencePreset![dest] ?? NEUTRAL_POLICY_FALLBACK_WEIGHTS[dest]
        : NEUTRAL_POLICY_FALLBACK_WEIGHTS[dest];
    }
    refPreset[dest] = hasExplicitRefPreset
      ? params.referencePreset![dest] ?? currentPcts[dest]
      : currentPcts[dest];

    if (typeof locks[dest] !== 'boolean') {
      locks[dest] = false;
    }
    if (typeof floors[dest] !== 'number' || Number.isNaN(floors[dest]) || floors[dest] < 0) {
      floors[dest] = 0;
    }
    if (typeof commitments[dest] !== 'number' || Number.isNaN(commitments[dest]) || commitments[dest] < 0) {
      commitments[dest] = 0;
    }
    if (typeof actualSpent[dest] !== 'number' || Number.isNaN(actualSpent[dest]) || actualSpent[dest] < 0) {
      actualSpent[dest] = 0;
    }
  });

  const oldAmountsR$: Record<DestinationKey, number> = {} as any;
  ALL_DESTINATIONS.forEach((dest) => {
    oldAmountsR$[dest] = roundMoney((plannedNetIncome * (currentPcts[dest] || 0)) / 100);
  });

  const conflicts: RebalanceConflict[] = [];

  // Validation: income > 0
  if (plannedNetIncome <= 0 || Number.isNaN(plannedNetIncome) || !Number.isFinite(plannedNetIncome)) {
    conflicts.push({
      destination: 'moradia',
      type: 'invalid_input',
      message: 'Renda líquida planejada é inválida ou menor/igual a zero.',
      requiredR$: 0,
      allocatedR$: 0,
    });

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      baseSnapshotSignature: params.baseSnapshotSignature,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      actualSpent,
      requiredMarginR$: oldAmountsR$,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: 'A renda líquida informada é inválida. Informe um valor maior que zero para recalcular.',
      recoveryOptions: ['Informe a renda mensal líquida planejada do casal acima de R$ 0,00.'],
      deficitR$: 0,
      totalRequiredR$: 0,
    });
  }

  // Validate percentage ranges (0..100, finite)
  let hasInvalidPct = false;
  ALL_DESTINATIONS.forEach((dest) => {
    const val = currentPcts[dest];
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val) || val < 0 || val > 100) {
      hasInvalidPct = true;
      conflicts.push({
        destination: dest,
        type: 'invalid_input',
        message: `Porcentagem de ${DESTINATION_NAMES[dest]} (${val}) fora do intervalo válido (0-100%).`,
        requiredR$: 0,
        allocatedR$: 0,
      });
    }
  });

  if (hasInvalidPct) {
    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      baseSnapshotSignature: params.baseSnapshotSignature,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      actualSpent,
      requiredMarginR$: oldAmountsR$,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: 'Existem valores de porcentagem inválidos no formulário. Corrija para continuar.',
      recoveryOptions: ['Ajuste todas as porcentagens para valores finitos entre 0% e 100%.'],
      deficitR$: 0,
      totalRequiredR$: 0,
    });
  }

  const incomeCents = toSafeCents(plannedNetIncome);

  // Required need per destination = max(floorR$, actualSpentR$ + pendingCommitmentsR$)
  // Notice: actualSpentR$ and pendingCommitmentsR$ are strictly disjoint (settled items are NOT in commitmentsR$)
  const requiredMarginR$: Record<DestinationKey, number> = {} as any;
  const hardMinCents: Record<DestinationKey, number> = {} as any;
  const hardMinBp: Record<DestinationKey, number> = {} as any;

  ALL_DESTINATIONS.forEach((dest) => {
    const consumedAndPendingCents = toSafeCents(actualSpent[dest]) + toSafeCents(commitments[dest]);
    const floorCents = toSafeCents(floors[dest]);
    const reqCents = Math.max(floorCents, consumedAndPendingCents);
    hardMinCents[dest] = reqCents;
    requiredMarginR$[dest] = roundMoney(reqCents / 100);
    hardMinBp[dest] = incomeCents > 0 ? Math.ceil((reqCents / incomeCents) * 10000) : 0;
  });

  // Check explicit group ceilings if requested (e.g. Fixed Realized 4.200 > Fixed Ceiling 3.600 -> Deficit 600)
  if (params.groupTargetsPct && params.enforceGroupCeilings) {
    const groupAlloc = allocateIncomeByPolicy(plannedNetIncome, {
      fixedPct: params.groupTargetsPct.fixos,
      varPct: params.groupTargetsPct.variaveis,
      investPct: params.groupTargetsPct.investimentos,
    });

    let totalFixedReqCents = 0;
    let totalVarReqCents = 0;
    for (const cat of ALL_CATEGORIES) {
      const actNat = params.actualSpentByNatureR$?.[cat];
      const pendNat = params.pendingByNatureR$?.[cat];
      if (actNat || pendNat) {
        totalFixedReqCents += toSafeCents(actNat?.fixedR$ || 0) + toSafeCents(pendNat?.fixedR$ || 0);
        totalVarReqCents +=
          toSafeCents(actNat?.variableR$ || 0) +
          toSafeCents(actNat?.unclassifiedR$ || 0) +
          toSafeCents(pendNat?.variableR$ || 0);
      } else if (DEFAULT_CATEGORY_GROUP_MAPPING[cat] === 'fixos') {
        totalFixedReqCents += hardMinCents[cat];
      } else {
        totalVarReqCents += hardMinCents[cat];
      }
    }

    if (totalFixedReqCents > groupAlloc.macroGroups.fixos.cents) {
      const excessFixedR$ = roundMoney(
        (totalFixedReqCents - groupAlloc.macroGroups.fixos.cents) / 100
      );
      const reqFixedR$ = roundMoney(totalFixedReqCents / 100);
      const ceilFixedR$ = groupAlloc.macroGroups.fixos.amountR$;
      conflicts.push({
        destination: 'moradia',
        type: 'group_ceiling_exceeded',
        message: `As despesas e obrigações fixas (R$ ${reqFixedR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excedem o teto do grupo Fixos de ${params.groupTargetsPct.fixos}% (R$ ${ceilFixedR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) em R$ ${excessFixedR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        requiredR$: reqFixedR$,
        allocatedR$: ceilFixedR$,
      });

      return buildInfeasibleResult({
        competence,
        plannedNetIncome,
        version,
        baseSnapshotSignature: params.baseSnapshotSignature,
        currentPcts,
        oldAmountsR$,
        locks,
        floors,
        commitments,
        actualSpent,
        requiredMarginR$,
        refPreset,
        groupTargetsPct: params.groupTargetsPct,
        actualSpentByNatureR$: params.actualSpentByNatureR$,
        pendingByNatureR$: params.pendingByNatureR$,
        conflicts,
        applyToFutureMonths,
        explanation: `Plano inviável na política ${params.groupTargetsPct.fixos}/${params.groupTargetsPct.variaveis}/${params.groupTargetsPct.investimentos}: o realizado/comprometido fixo excede o teto do grupo em R$ ${excessFixedR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        recoveryOptions: [
          `Ampliar temporariamente o grupo de Fixos em pelo menos R$ ${excessFixedR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} reduzindo Variáveis ou Investimentos.`,
          'Revisar contas fixas pendentes ou renegociar contratos recorrentes para os próximos meses.',
        ],
        deficitR$: excessFixedR$,
        totalRequiredR$: reqFixedR$,
      });
    }

    if (totalVarReqCents > groupAlloc.macroGroups.variaveis.cents) {
      const excessVarR$ = roundMoney(
        (totalVarReqCents - groupAlloc.macroGroups.variaveis.cents) / 100
      );
      const reqVarR$ = roundMoney(totalVarReqCents / 100);
      const ceilVarR$ = groupAlloc.macroGroups.variaveis.amountR$;
      conflicts.push({
        destination: 'comida',
        type: 'group_ceiling_exceeded',
        message: `Os gastos e compromissos variáveis (R$ ${reqVarR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excedem o teto do grupo Variáveis de ${params.groupTargetsPct.variaveis}% (R$ ${ceilVarR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) em R$ ${excessVarR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        requiredR$: reqVarR$,
        allocatedR$: ceilVarR$,
      });

      return buildInfeasibleResult({
        competence,
        plannedNetIncome,
        version,
        baseSnapshotSignature: params.baseSnapshotSignature,
        currentPcts,
        oldAmountsR$,
        locks,
        floors,
        commitments,
        actualSpent,
        requiredMarginR$,
        refPreset,
        groupTargetsPct: params.groupTargetsPct,
        actualSpentByNatureR$: params.actualSpentByNatureR$,
        pendingByNatureR$: params.pendingByNatureR$,
        conflicts,
        applyToFutureMonths,
        explanation: `Plano inviável na política ${params.groupTargetsPct.fixos}/${params.groupTargetsPct.variaveis}/${params.groupTargetsPct.investimentos}: o realizado/comprometido variável excede o teto do grupo em R$ ${excessVarR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        recoveryOptions: [
          `Redirecionar margem livre ou revisar o alvo do grupo Variáveis (+R$ ${excessVarR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        ],
        deficitR$: excessVarR$,
        totalRequiredR$: reqVarR$,
      });
    }
  }

  // Locked allocations
  const lockedBp: Record<DestinationKey, number> = {} as any;
  let sumLockedBp = 0;
  let sumLockedCents = 0;

  ALL_DESTINATIONS.forEach((dest) => {
    if (locks[dest]) {
      const bp = Math.round((currentPcts[dest] || 0) * 100);
      lockedBp[dest] = bp;
      sumLockedBp += bp;

      const destCents = Math.round((incomeCents * bp) / 10000);
      sumLockedCents += destCents;
      const destR$ = roundMoney(destCents / 100);

      if (destCents + 1 < hardMinCents[dest]) {
        conflicts.push({
          destination: dest,
          type: 'lock_below_commitments',
          message: `A trava de ${currentPcts[dest]}% (R$ ${destR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) em ${DESTINATION_NAMES[dest]} está abaixo do mínimo necessário de R$ ${requiredMarginR$[dest].toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (realizado + pendentes/piso).`,
          requiredR$: requiredMarginR$[dest],
          allocatedR$: destR$,
        });
      }
    }
  });

  // Conflict between locked Investments and explicit groupTargetsPct.investimentos
  if (
    params.groupTargetsPct &&
    locks.investimentos &&
    Math.abs((currentPcts.investimentos || 0) - params.groupTargetsPct.investimentos) > 0.01
  ) {
    const catInvR$ = roundMoney((plannedNetIncome * (currentPcts.investimentos || 0)) / 100);
    const grpInvR$ = roundMoney((plannedNetIncome * params.groupTargetsPct.investimentos) / 100);
    conflicts.push({
      destination: 'investimentos',
      type: 'category_group_lock_conflict',
      message: `Conflito explícito entre trava de Investimentos (${currentPcts.investimentos}%) e alvo do grupo Investimentos (${params.groupTargetsPct.investimentos}%). Escolha qual diretriz manter.`,
      requiredR$: grpInvR$,
      allocatedR$: catInvR$,
    });
  }

  // Sum of locks > 100%
  if (sumLockedBp > 10000) {
    const sumLockedPct = (sumLockedBp / 100).toFixed(2);
    const sumLockedR$ = roundMoney(sumLockedCents / 100);
    conflicts.push({
      destination: 'investimentos',
      type: 'sum_locks_exceeds_100',
      message: `As travas selecionadas somam ${sumLockedPct}%, ultrapassando o limite máximo de 100% da renda.`,
      requiredR$: sumLockedR$,
      allocatedR$: plannedNetIncome,
    });

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      baseSnapshotSignature: params.baseSnapshotSignature,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      actualSpent,
      requiredMarginR$,
      refPreset,
      groupTargetsPct: params.groupTargetsPct,
      actualSpentByNatureR$: params.actualSpentByNatureR$,
      pendingByNatureR$: params.pendingByNatureR$,
      conflicts,
      applyToFutureMonths,
      explanation: `As travas somam ${sumLockedPct}%, excedendo 100% da renda. Destrave ao menos uma categoria ou reduza os percentuais travados.`,
      recoveryOptions: [
        'Destrave uma ou mais destinações para permitir redistribuição automática.',
        `Reduza as porcentagens travadas em ${(sumLockedBp / 100 - 100).toFixed(2)}% para fechar em 100%.`,
      ],
      deficitR$: Math.max(0, roundMoney(sumLockedR$ - plannedNetIncome)),
      totalRequiredR$: sumLockedR$,
    });
  }

  // Required minimums for unlocked destinations
  let sumUnlockedMinCents = 0;
  let sumUnlockedMinBp = 0;
  ALL_DESTINATIONS.forEach((dest) => {
    if (!locks[dest]) {
      sumUnlockedMinCents += hardMinCents[dest];
      sumUnlockedMinBp += hardMinBp[dest];
    }
  });

  const totalRequiredCents = sumLockedCents + sumUnlockedMinCents;
  const totalRequiredR$ = roundMoney(totalRequiredCents / 100);
  const totalRequiredBp = sumLockedBp + sumUnlockedMinBp;

  if (totalRequiredCents > incomeCents + 1 || totalRequiredBp > 10000 || conflicts.length > 0) {
    const deficitCents = Math.max(0, totalRequiredCents - incomeCents);
    const deficit = roundMoney(deficitCents / 100);

    if (totalRequiredCents > incomeCents + 1 || totalRequiredBp > 10000) {
      conflicts.push({
        destination: 'moradia',
        type: 'total_required_exceeds_income',
        message: `O total necessário entre travas, realizado e obrigações pendentes (R$ ${totalRequiredR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede a renda planejada em R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        requiredR$: totalRequiredR$,
        allocatedR$: plannedNetIncome,
      });
    }

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      baseSnapshotSignature: params.baseSnapshotSignature,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      actualSpent,
      requiredMarginR$,
      refPreset,
      groupTargetsPct: params.groupTargetsPct,
      actualSpentByNatureR$: params.actualSpentByNatureR$,
      pendingByNatureR$: params.pendingByNatureR$,
      conflicts,
      applyToFutureMonths,
      explanation: `Plano inviável: compromissos, realizado e travas somam R$ ${totalRequiredR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, gerando um déficit de R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      recoveryOptions: [
        'Destrave categorias com trava rígida acima do mínimo obrigatório.',
        'Revise pisos manuais ou renegocie despesas pendentes antes de aprovar novo teto.',
        'Mesmo com plano em revisão, novos gastos reais continuam podendo ser registrados normalmente com exibição transparente do desvio.',
      ],
      deficitR$: deficit,
      totalRequiredR$,
    });
  }

  // ============================================================================
  // EXACT BASIS-POINT REDISTRIBUTION OF UNLOCKED MARGIN (10000 - sumLockedBp)
  // Fixes the floor-after-quota > 100% defect via water-filling / slack distribution!
  // ============================================================================
  const remainingBp = 10000 - sumLockedBp;
  const unlockedDests = ALL_DESTINATIONS.filter((dest) => !locks[dest]);
  const proposedBp: Record<DestinationKey, number> = {} as any;

  ALL_DESTINATIONS.forEach((dest) => {
    if (locks[dest]) {
      proposedBp[dest] = lockedBp[dest];
    }
  });

  if (unlockedDests.length > 0) {
    const weights: Record<DestinationKey, number> = {} as any;
    const rawWeightSum = unlockedDests.reduce(
      (s, dest) => s + (hasExplicitRefPreset ? refPreset[dest] : currentPcts[dest]),
      0
    );
    unlockedDests.forEach((dest) => {
      if (rawWeightSum > 0) {
        weights[dest] = hasExplicitRefPreset ? refPreset[dest] : currentPcts[dest];
      } else {
        weights[dest] = NEUTRAL_POLICY_FALLBACK_WEIGHTS[dest] > 0 ? NEUTRAL_POLICY_FALLBACK_WEIGHTS[dest] : 1;
      }
    });

    // Iterative water-filling: any unlocked destination whose unconstrained proportional share
    // falls below hardMinBp[dest] is pinned to hardMinBp[dest], and the remaining basis points
    // are distributed proportionally among the remaining unpinned unlocked destinations!
    // Because sum(hardMinBp[unlocked]) <= remainingBp is already verified above, this is
    // mathematically guaranteed to converge to an exact sum of `remainingBp` (100.00% total)
    // while respecting every hardMinBp[dest].
    const pinnedBp = new Map<DestinationKey, number>();
    let freePool = [...unlockedDests];
    let availableBp = remainingBp;
    let changed = true;

    while (changed && freePool.length > 0) {
      changed = false;
      const sumFreeWeight = freePool.reduce((s, d) => s + weights[d], 0) || freePool.length;
      for (const dest of [...freePool]) {
        const w = sumFreeWeight > 0 ? weights[dest] : 1;
        const exactShare = (availableBp * w) / sumFreeWeight;
        if (exactShare < hardMinBp[dest]) {
          pinnedBp.set(dest, hardMinBp[dest]);
          availableBp -= hardMinBp[dest];
          freePool = freePool.filter((d) => d !== dest);
          changed = true;
        }
      }
    }

    pinnedBp.forEach((bp, dest) => {
      proposedBp[dest] = bp;
    });

    if (freePool.length > 0) {
      const sumFreeWeight = freePool.reduce((s, d) => s + weights[d], 0) || freePool.length;
      const remainders: { dest: DestinationKey; remainder: number; priority: PriorityLevel }[] = [];
      let sumFloored = 0;

      freePool.forEach((dest) => {
        const w = sumFreeWeight > 0 ? weights[dest] : 1;
        const exactBp = (availableBp * w) / sumFreeWeight;
        const floorVal = Math.max(hardMinBp[dest], Math.floor(exactBp));
        proposedBp[dest] = floorVal;
        sumFloored += floorVal;
        remainders.push({
          dest,
          remainder: exactBp - Math.floor(exactBp),
          priority: priorities[dest] || 'P2',
        });
      });

      let leftoverBp = availableBp - sumFloored;

      remainders.sort((a, b) => {
        if (Math.abs(b.remainder - a.remainder) > 0.0001) {
          return b.remainder - a.remainder;
        }
        const pMap: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3 };
        return pMap[a.priority] - pMap[b.priority];
      });

      let rIdx = 0;
      while (leftoverBp > 0 && remainders.length > 0) {
        const target = remainders[rIdx % remainders.length].dest;
        proposedBp[target] += 1;
        leftoverBp -= 1;
        rIdx++;
      }

      // Defensive guard if rounding ever caused leftoverBp < 0: trim 1bp at a time only from destinations with slack > hardMinBp
      if (leftoverBp < 0) {
        const reverseOrder = [...remainders].reverse();
        let guard = 0;
        while (leftoverBp < 0 && guard < 10000) {
          let trimmedAny = false;
          for (const item of reverseOrder) {
            if (leftoverBp === 0) break;
            if (proposedBp[item.dest] > hardMinBp[item.dest]) {
              proposedBp[item.dest] -= 1;
              leftoverBp += 1;
              trimmedAny = true;
            }
          }
          if (!trimmedAny) break;
          guard++;
        }
      }
    }
  }

  // Convert proposed basis points to percentages and exact integer cents
  const proposedPcts: Record<DestinationKey, number> = {} as any;
  const proposedCents: Record<DestinationKey, number> = {} as any;
  let totalCentsAllocated = 0;

  ALL_DESTINATIONS.forEach((dest) => {
    const bp = proposedBp[dest] ?? 0;
    proposedPcts[dest] = Number((bp / 100).toFixed(2));
    const cents = Math.round((incomeCents * bp) / 10000);
    proposedCents[dest] = cents;
    totalCentsAllocated += cents;
  });

  // Adjust residual cents so sum(proposedCents) === incomeCents without violating hardMinCents
  const centDiff = incomeCents - totalCentsAllocated;
  if (centDiff !== 0) {
    const candidates = unlockedDests.length > 0 ? [...unlockedDests] : [...ALL_DESTINATIONS];
    candidates.sort((a, b) => proposedCents[b] - proposedCents[a]);

    if (centDiff > 0) {
      proposedCents[candidates[0]] += centDiff;
    } else {
      let toRemove = Math.abs(centDiff);
      for (const dest of candidates) {
        if (toRemove <= 0) break;
        const slack = Math.max(0, proposedCents[dest] - hardMinCents[dest]);
        const cut = Math.min(slack, toRemove);
        proposedCents[dest] -= cut;
        toRemove -= cut;
      }
      if (toRemove > 0) {
        proposedCents[candidates[0]] = Math.max(0, proposedCents[candidates[0]] - toRemove);
      }
    }
  }

  const proposedAmountsR$: Record<DestinationKey, number> = {} as any;
  ALL_DESTINATIONS.forEach((dest) => {
    proposedAmountsR$[dest] = roundMoney(proposedCents[dest] / 100);
  });

  const { macroGroups, categoryMatrixCents } = buildConsistentCategoryGroupMatrix({
    incomeCents,
    proposedCategoryCents: proposedCents,
    groupTargetsPct: params.groupTargetsPct,
    actualSpentByNatureR$: params.actualSpentByNatureR$,
    pendingByNatureR$: params.pendingByNatureR$,
  });

  const sumProposedBp = ALL_DESTINATIONS.reduce((s, d) => s + (proposedBp[d] || 0), 0);
  const sumProposedCents = ALL_DESTINATIONS.reduce((s, d) => s + (proposedCents[d] || 0), 0);

  const lockedSummary = ALL_DESTINATIONS.filter((d) => locks[d])
    .map((d) => `${DESTINATION_NAMES[d]} (${proposedPcts[d]}%)`)
    .join(', ');

  const explanation = lockedSummary
    ? `Mantivemos a trava explícita em: ${lockedSummary}. A margem restante foi redistribuída em centavos exatos respeitando realizado, obrigações pendentes e pisos.`
    : 'Sugerimos a redistribuição equilibrada em 100,00% da renda planejada, fechando categorias e grupos em centavos exatos.';

  return {
    status: 'feasible',
    competence,
    plannedNetIncome: roundMoney(incomeCents / 100),
    version,
    baseSnapshotSignature: params.baseSnapshotSignature,
    proposedPercentages: proposedPcts,
    proposedAmountsR$,
    oldPercentages: currentPcts,
    oldAmountsR$,
    locks,
    floorsR$: floors,
    commitmentsR$: commitments,
    actualSpentR$: actualSpent,
    requiredMarginR$,
    macroGroups,
    categoryMatrixCents,
    totalPercentagesSum: Number((sumProposedBp / 100).toFixed(2)),
    totalProposedR$: roundMoney(sumProposedCents / 100),
    totalRequiredR$,
    deficitR$: 0,
    conflicts: [],
    explanation,
    recoveryOptions: [],
    referencePreset: refPreset,
    applyToFutureMonths,
  };
}

function buildInfeasibleResult(data: {
  competence: string;
  plannedNetIncome: number;
  version: string;
  baseSnapshotSignature?: string;
  currentPcts: Record<DestinationKey, number>;
  oldAmountsR$: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floors: Record<DestinationKey, number>;
  commitments: Record<DestinationKey, number>;
  actualSpent: Record<DestinationKey, number>;
  requiredMarginR$: Record<DestinationKey, number>;
  refPreset: Record<DestinationKey, number>;
  groupTargetsPct?: GroupTargetsPct;
  actualSpentByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
  pendingByNatureR$?: Partial<Record<CategoryKey, CategoryNatureBreakdownR$>>;
  conflicts: RebalanceConflict[];
  applyToFutureMonths: boolean;
  explanation: string;
  recoveryOptions: string[];
  deficitR$: number;
  totalRequiredR$: number;
}): RebalanceResult {
  const sumPcts = ALL_DESTINATIONS.reduce((s, d) => s + (data.currentPcts[d] || 0), 0);
  const incomeCents = Math.max(0, toSafeCents(data.plannedNetIncome));
  const oldCents: Record<DestinationKey, number> = {} as any;
  ALL_DESTINATIONS.forEach((d) => {
    oldCents[d] = Math.max(0, toSafeCents(data.oldAmountsR$[d] || 0));
  });

  const { macroGroups, categoryMatrixCents } = buildConsistentCategoryGroupMatrix({
    incomeCents,
    proposedCategoryCents: oldCents,
    groupTargetsPct: data.groupTargetsPct,
    actualSpentByNatureR$: data.actualSpentByNatureR$,
    pendingByNatureR$: data.pendingByNatureR$,
  });

  return {
    status: 'infeasible',
    competence: data.competence,
    plannedNetIncome: data.plannedNetIncome,
    version: data.version,
    baseSnapshotSignature: data.baseSnapshotSignature,
    proposedPercentages: data.currentPcts,
    proposedAmountsR$: data.oldAmountsR$,
    oldPercentages: data.currentPcts,
    oldAmountsR$: data.oldAmountsR$,
    locks: data.locks,
    floorsR$: data.floors,
    commitmentsR$: data.commitments,
    actualSpentR$: data.actualSpent,
    requiredMarginR$: data.requiredMarginR$,
    macroGroups,
    categoryMatrixCents,
    totalPercentagesSum: Number(sumPcts.toFixed(2)),
    totalProposedR$: roundMoney(
      ALL_DESTINATIONS.reduce((s, d) => s + (data.oldAmountsR$[d] || 0), 0)
    ),
    totalRequiredR$: data.totalRequiredR$,
    deficitR$: data.deficitR$,
    conflicts: data.conflicts,
    explanation: data.explanation,
    recoveryOptions: data.recoveryOptions,
    referencePreset: data.refPreset,
    applyToFutureMonths: data.applyToFutureMonths,
  };
}

export interface BuildBudgetApplicationCommandInput {
  state: AppState;
  proposal: RebalanceResult;
  expectedSignature?: string;
  expectedPlanRevision?: number;
  approvedByUid?: string;
  approvedByDisplayName?: string;
  futureMonthsHorizon?: number; // e.g. 12 months ahead when applyToFutureMonths is true
  overwriteExistingFutureApprovedPlans?: boolean;
  nowIso?: string;
}

export type BuildBudgetApplicationCommandResult =
  | {
      status: 'ready';
      contract: BudgetPlanContract;
      nextState: AppState;
      appliedMonths: string[];
      skippedApprovedMonths: string[];
      idempotentNoOp?: boolean;
    }
  | {
      status: 'stale_base' | 'revision_conflict' | 'infeasible_proposal';
      reason: string;
      currentSnapshot: CompetenceBudgetSnapshot;
    };

/**
 * Comando puro de aplicação de plano orçamentário com:
 * 1. Checagem de versão/revisão e assinatura da base usada na prévia (`stale_base` / `revision_conflict`);
 * 2. Vigência estrita por competência:
 *    - Plano futuro (`competence > state.currentMonth`) NÃO altera percentuais/travas globais do mês corrente nem meses anteriores!
 *    - Plano histórico (`competence < state.currentMonth`) NÃO reescreve preferências globais vigentes!
 *    - `applyToFutureMonths` propaga para o horizonte futuro preservando meses que já possuam plano explicitamente aprovado (a menos que `overwriteExistingFutureApprovedPlans` seja confirmado).
 * 3. Autoria identificada por UID autenticado (`approvedByUid`), mantendo nome apenas para exibição (`approvedByDisplayName` / `approvedBy`).
 */
export function buildBudgetApplicationCommand(
  input: BuildBudgetApplicationCommandInput
): BuildBudgetApplicationCommandResult {
  const {
    state,
    proposal,
    expectedSignature,
    expectedPlanRevision,
    approvedByUid,
    approvedByDisplayName,
    futureMonthsHorizon = 6,
    overwriteExistingFutureApprovedPlans = false,
    nowIso,
  } = input;

  const competence = proposal.competence;
  const currentSnapshot = computeCompetenceBudgetSnapshot(state, competence);

  if (proposal.status !== 'feasible') {
    return {
      status: 'infeasible_proposal',
      reason: proposal.explanation || 'Não é possível aprovar uma proposta inviável.',
      currentSnapshot,
    };
  }

  const sigToVerify = expectedSignature ?? proposal.baseSnapshotSignature;
  if (sigToVerify && sigToVerify !== currentSnapshot.signature) {
    return {
      status: 'stale_base',
      reason:
        'Os dados de renda, gastos realizados, obrigações pendentes ou travas mudaram desde o cálculo da prévia. Recalcule a simulação antes de aprovar.',
      currentSnapshot,
    };
  }

  const existingExplicitPlan = state.monthlyBudgetPlans?.[competence];
  if (
    expectedPlanRevision !== undefined &&
    (existingExplicitPlan?.planRevision ?? 0) !== expectedPlanRevision
  ) {
    return {
      status: 'revision_conflict',
      reason: `Conflito de revisão no plano de ${competence}: esperado v${expectedPlanRevision}, encontrado v${existingExplicitPlan?.planRevision ?? 0}.`,
      currentSnapshot,
    };
  }

  // Idempotency: if existing plan already has identical percentages, locks, floors and income, avoid creating a redundant revision
  if (existingExplicitPlan) {
    const sameIncome =
      toSafeCents(existingExplicitPlan.plannedNetIncome) === toSafeCents(proposal.plannedNetIncome);
    const samePcts = ALL_DESTINATIONS.every(
      (d) =>
        Math.abs(
          (existingExplicitPlan.categoryPercentages?.[d] ?? 0) -
            (proposal.proposedPercentages[d] ?? 0)
        ) < 0.001
    );
    const sameLocks = ALL_DESTINATIONS.every(
      (d) => Boolean(existingExplicitPlan.categoryLocks?.[d]) === Boolean(proposal.locks[d])
    );
    const sameFloors = ALL_DESTINATIONS.every(
      (d) =>
        toSafeCents(existingExplicitPlan.categoryFloorsR$?.[d] ?? 0) ===
        toSafeCents(proposal.floorsR$[d] ?? 0)
    );
    const sameFutureFlag =
      Boolean(existingExplicitPlan.applyToFutureMonths) === Boolean(proposal.applyToFutureMonths);

    if (sameIncome && samePcts && sameLocks && sameFloors && sameFutureFlag) {
      return {
        status: 'ready',
        contract: upgradeBudgetPlanContract(existingExplicitPlan),
        nextState: state,
        appliedMonths: [competence],
        skippedApprovedMonths: [],
        idempotentNoOp: true,
      };
    }
  }

  const timestamp = nowIso || new Date().toISOString();
  const nextRevision = (existingExplicitPlan?.planRevision ?? 0) + 1;
  const cleanUid = approvedByUid && approvedByUid.trim() ? approvedByUid.trim() : undefined;
  const displayAuthor =
    approvedByDisplayName?.trim() ||
    cleanUid ||
    state.profile.partner1Name ||
    'Casal';

  const appliedMonths: string[] = [competence];
  const skippedApprovedMonths: string[] = [];

  const nextMonthlyPlans: Record<string, BudgetPlanContract> = {
    ...(state.monthlyBudgetPlans || {}),
  };

  if (proposal.applyToFutureMonths && futureMonthsHorizon > 0) {
    for (let i = 1; i <= futureMonthsHorizon; i++) {
      const targetFutureMonth = addMonthsToCompetence(competence, i);
      const existingFuture = nextMonthlyPlans[targetFutureMonth];
      const hasExplicitApproval = Boolean(existingFuture && existingFuture.approvedAt);
      if (hasExplicitApproval && !overwriteExistingFutureApprovedPlans) {
        skippedApprovedMonths.push(targetFutureMonth);
        continue;
      }

      const futureContract = upgradeBudgetPlanContract({
        id: targetFutureMonth,
        competence: targetFutureMonth,
        plannedNetIncome: proposal.plannedNetIncome,
        version: timestamp,
        schemaVersion: '2.0',
        planRevision: (existingFuture?.planRevision ?? 0) + 1,
        policyMeta: {
          policyId: `policy-${proposal.macroGroups.fixos.percentage}-${proposal.macroGroups.variaveis.percentage}-${proposal.macroGroups.investimentos.percentage}`,
          policyName: `Política Orçamentária ${proposal.macroGroups.fixos.percentage}/${proposal.macroGroups.variaveis.percentage}/${proposal.macroGroups.investimentos.percentage}`,
          policyVersion: '2.0',
          validFrom: competence,
          authoredByUid: cleanUid,
          incomeSourceMode: 'planned_net',
        },
        macroGroups: proposal.macroGroups,
        categoryPercentages: proposal.proposedPercentages,
        categoryAmountsR$: proposal.proposedAmountsR$,
        categoryMatrixCents: proposal.categoryMatrixCents,
        categoryLocks: proposal.locks,
        categoryFloorsR$: proposal.floorsR$,
        categoryPriorities: DEFAULT_PRIORITIES,
        commitmentsR$: {
          moradia: 0,
          transporte: 0,
          comida: 0,
          lazer: 0,
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
        actualSpentR$: {
          moradia: 0,
          transporte: 0,
          comida: 0,
          lazer: 0,
          protecao: 0,
          profissional: 0,
          investimentos: 0,
        },
        requiredMarginR$: proposal.proposedAmountsR$,
        referencePreset: proposal.referencePreset,
        status: 'feasible',
        explanation: `Plano propagado a partir de ${competence}.`,
        conflicts: [],
        approvedAt: timestamp,
        approvedBy: displayAuthor,
        approvedByUid: cleanUid,
        approvedByDisplayName: approvedByDisplayName?.trim(),
        applyToFutureMonths: false,
      });

      nextMonthlyPlans[targetFutureMonth] = futureContract;
      appliedMonths.push(targetFutureMonth);
    }
  }

  const baseContract = upgradeBudgetPlanContract({
    id: competence,
    competence,
    plannedNetIncome: proposal.plannedNetIncome,
    version: timestamp,
    schemaVersion: '2.0',
    planRevision: nextRevision,
    policyMeta: {
      policyId: `policy-${proposal.macroGroups.fixos.percentage}-${proposal.macroGroups.variaveis.percentage}-${proposal.macroGroups.investimentos.percentage}`,
      policyName: `Política Orçamentária ${proposal.macroGroups.fixos.percentage}/${proposal.macroGroups.variaveis.percentage}/${proposal.macroGroups.investimentos.percentage}`,
      policyVersion: '2.0',
      validFrom: competence,
      authoredByUid: cleanUid,
      incomeSourceMode: 'planned_net',
    },
    macroGroups: proposal.macroGroups,
    categoryPercentages: proposal.proposedPercentages,
    categoryAmountsR$: proposal.proposedAmountsR$,
    categoryMatrixCents: proposal.categoryMatrixCents,
    categoryLocks: proposal.locks,
    categoryFloorsR$: proposal.floorsR$,
    categoryPriorities: DEFAULT_PRIORITIES,
    commitmentsR$: proposal.commitmentsR$,
    actualSpentR$: proposal.actualSpentR$,
    requiredMarginR$: proposal.requiredMarginR$,
    referencePreset: proposal.referencePreset,
    status: proposal.status,
    explanation: proposal.explanation,
    conflicts: proposal.conflicts.map((c) => c.message),
    approvedAt: timestamp,
    approvedBy: displayAuthor,
    approvedByUid: cleanUid,
    approvedByDisplayName: approvedByDisplayName?.trim(),
    baseSnapshotSignature: currentSnapshot.signature,
    applyToFutureMonths: proposal.applyToFutureMonths,
    appliedFutureMonths: appliedMonths.slice(1),
    skippedApprovedMonths,
  });

  nextMonthlyPlans[competence] = baseContract;

  // Global compatibility projection ONLY updates when the approved plan applies to `state.currentMonth`!
  // Planning a future month (e.g. 2026-11 while in 2026-10) or editing a historical month (< 2026-10)
  // NEVER overwrites the active current month's global percentages, locks or investmentsPercentage!
  const affectsCurrentActiveMonth = appliedMonths.includes(state.currentMonth);

  const nextCategoryPercentages: Record<CategoryKey, number> = affectsCurrentActiveMonth
    ? {
        moradia: baseContract.categoryPercentages.moradia ?? state.categoryPercentages.moradia,
        transporte: baseContract.categoryPercentages.transporte ?? state.categoryPercentages.transporte,
        comida: baseContract.categoryPercentages.comida ?? state.categoryPercentages.comida,
        lazer: baseContract.categoryPercentages.lazer ?? state.categoryPercentages.lazer,
        protecao: baseContract.categoryPercentages.protecao ?? state.categoryPercentages.protecao,
        profissional:
          baseContract.categoryPercentages.profissional ?? state.categoryPercentages.profissional,
      }
    : state.categoryPercentages;

  const nextCategoryLocks = affectsCurrentActiveMonth
    ? {
        ...(state.categoryLocks || {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: false,
        }),
        ...baseContract.categoryLocks,
      }
    : state.categoryLocks;

  const nextInvestmentsPercentage = affectsCurrentActiveMonth
    ? baseContract.categoryPercentages.investimentos ?? state.profile.investmentsPercentage
    : state.profile.investmentsPercentage;

  const nextState: AppState = {
    ...state,
    monthlyBudgetPlans: nextMonthlyPlans,
    categoryPercentages: nextCategoryPercentages,
    categoryLocks: nextCategoryLocks,
    isCustomizedPercentages: affectsCurrentActiveMonth ? true : state.isCustomizedPercentages,
    profile: affectsCurrentActiveMonth
      ? {
          ...state.profile,
          investmentsPercentage: nextInvestmentsPercentage,
        }
      : state.profile,
  };

  return {
    status: 'ready',
    contract: baseContract,
    nextState,
    appliedMonths,
    skippedApprovedMonths,
  };
}
