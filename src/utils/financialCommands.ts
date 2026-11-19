import type {
  AppState,
  BankImportedTransaction,
  CategoryKey,
  CoupleGoal,
  CoupleGoalContribution,
  DreamSimulation,
  ExpenseItem,
  FinancialCommandReasonCode,
  FinancialCommandResult,
  FinancialCommandTouchedEntities,
  FinancialOperationRecord,
  FinancialOperationState,
  FundingSourceType,
  LinkedBankAccount,
  MonthlyDepositGuide,
  MonthlyDepositItem,
  MonthDepositCompletionRecord,
  PaidBy,
  SavingsPiggyBank,
  StrategicSpendingIntent,
  SurplusTransferRecord,
  TransactionSplit,
  WithdrawalPurposePartition,
} from '../types/finance';
import {
  apportionCentsByScope,
  CANONICAL_CATEGORY_ALIAS_MAP,
  CATEGORY_PRESENTATION_META,
  mapToCanonicalCategoryKey,
  projectCanonicalExpenseSlices,
  projectInstallmentOccurrencesForCompetence,
  projectSharedFixedOccurrences,
  resolveExpenseCompetenceMonth,
  selectCanonicalFixedBillsRegistry,
  toSafeCents,
} from './occurrenceProjection';

const MAX_REAIS_BOUND = 90071992547409;
const MAX_EXPENSE_REAIS = 10000000;
const VALID_SCOPES = new Set(['couple', 'casal', 'partner1', 'partner2']);
const CANONICAL_CATEGORY_KEYS: CategoryKey[] = [
  'moradia',
  'transporte',
  'comida',
  'lazer',
  'protecao',
  'profissional',
];
const CANONICAL_CATEGORY_SET = new Set<string>(CANONICAL_CATEGORY_KEYS);

function resolveCanonicalReinforcementCategory(rawId?: string): CategoryKey | null {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim().toLowerCase();
  if (CANONICAL_CATEGORY_SET.has(trimmed)) return trimmed as CategoryKey;
  return CANONICAL_CATEGORY_ALIAS_MAP[trimmed] || null;
}

export interface MonetaryNormalizationInput {
  amountCents?: unknown;
  amountR$?: unknown;
  amount?: unknown;
}

export type MonetaryNormalizationResult =
  | {
      ok: true;
      amountCents: number;
      amountR$: number;
      reasonCode?: never;
      error?: never;
    }
  | {
      ok: false;
      amountCents?: never;
      amountR$?: never;
      reasonCode: 'INVALID_AMOUNT' | 'DIVERGENT_AMOUNTS';
      error: string;
    };

export function roundMoneyCentsCompatible(val: number): number {
  return Math.round(val * 100) / 100;
}

function isValidFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Normalizes monetary inputs using safe integer cents as the single authoritative unit.
 * - Accepts `amountCents` directly (must be safe integer > 0)
 * - Accepts legacy reais aliases (`amountR$` / `amount`) with documented `Math.round(val * 100)` conversion
 * - Requires exact equivalence when both cents and reais are supplied
 * - Rejects NaN, Infinity, non-integer cents, unsafe integers, and <= 0 values
 */
export function normalizeMonetaryBoundary(
  input: MonetaryNormalizationInput,
  options?: { allowZero?: boolean }
): MonetaryNormalizationResult {
  const hasCents = input.amountCents !== undefined;
  const hasReaisDollar = input.amountR$ !== undefined;
  const hasReaisAlias = input.amount !== undefined;

  if (!hasCents && !hasReaisDollar && !hasReaisAlias) {
    return {
      ok: false,
      reasonCode: 'INVALID_AMOUNT',
      error: 'Valor monetário ausente: informe amountCents ou valor em reais válido.',
    };
  }

  let centsFromCentsField: number | undefined;
  if (hasCents) {
    if (!isValidFiniteNumber(input.amountCents) || !Number.isSafeInteger(input.amountCents)) {
      return {
        ok: false,
        reasonCode: 'INVALID_AMOUNT',
        error: 'amountCents inválido: esperado inteiro seguro em centavos.',
      };
    }
    if (options?.allowZero ? input.amountCents < 0 : input.amountCents <= 0) {
      return {
        ok: false,
        reasonCode: 'INVALID_AMOUNT',
        error: 'amountCents deve ser positivo e maior que zero.',
      };
    }
    centsFromCentsField = input.amountCents;
  }

  const convertReais = (
    raw: unknown,
    fieldName: string
  ): { ok: true; cents: number; error?: never } | { ok: false; cents?: never; error: string } => {
    if (!isValidFiniteNumber(raw)) {
      return { ok: false, error: `${fieldName} inválido (NaN ou infinito).` };
    }
    if (raw > MAX_REAIS_BOUND) {
      return { ok: false, error: `${fieldName} excede o limite seguro.` };
    }
    if (options?.allowZero ? raw < 0 : raw <= 0) {
      return { ok: false, error: `${fieldName} deve ser maior que zero.` };
    }
    const rounded = Math.round(raw * 100);
    if (!Number.isSafeInteger(rounded) || (options?.allowZero ? rounded < 0 : rounded <= 0)) {
      return { ok: false, error: `${fieldName} não pôde ser convertido para centavos inteiros seguros.` };
    }
    return { ok: true, cents: rounded };
  };

  let centsFromReaisDollar: number | undefined;
  if (hasReaisDollar) {
    const conv = convertReais(input.amountR$, 'amountR$');
    if (!conv.ok) {
      return { ok: false, reasonCode: 'INVALID_AMOUNT', error: conv.error || 'amountR$ inválido.' };
    }
    centsFromReaisDollar = conv.cents;
  }

  let centsFromReaisAlias: number | undefined;
  if (hasReaisAlias) {
    const conv = convertReais(input.amount, 'amount');
    if (!conv.ok) {
      return { ok: false, reasonCode: 'INVALID_AMOUNT', error: conv.error || 'amount inválido.' };
    }
    centsFromReaisAlias = conv.cents;
  }

  if (centsFromReaisDollar !== undefined && centsFromReaisAlias !== undefined && centsFromReaisDollar !== centsFromReaisAlias) {
    return {
      ok: false,
      reasonCode: 'DIVERGENT_AMOUNTS',
      error: `Campos monetários divergentes: amountR$ (${centsFromReaisDollar}c) != amount (${centsFromReaisAlias}c).`,
    };
  }

  const resolvedReaisCents = centsFromReaisDollar ?? centsFromReaisAlias;
  if (centsFromCentsField !== undefined && resolvedReaisCents !== undefined && centsFromCentsField !== resolvedReaisCents) {
    return {
      ok: false,
      reasonCode: 'DIVERGENT_AMOUNTS',
      error: `Divergência monetária: amountCents (${centsFromCentsField}) difere do valor em reais (${resolvedReaisCents} centavos).`,
    };
  }

  const finalCents = centsFromCentsField ?? resolvedReaisCents!;
  return {
    ok: true,
    amountCents: finalCents,
    amountR$: finalCents / 100,
  };
}

/**
 * Reads an operation's authoritative cents without treating optional `amountR$` as a guaranteed number.
 */
export function readOperationAmountCents(op: { amountCents?: unknown; amountR$?: unknown; amount?: unknown }): number {
  if (isValidFiniteNumber(op.amountCents) && Number.isSafeInteger(op.amountCents)) {
    return op.amountCents;
  }
  if (isValidFiniteNumber(op.amountR$)) {
    return Math.round(op.amountR$ * 100);
  }
  if (isValidFiniteNumber(op.amount)) {
    return Math.round(op.amount * 100);
  }
  return 0;
}

export function normalizeCommandScope(scope: unknown): 'couple' | 'partner1' | 'partner2' {
  if (scope === 'partner1') return 'partner1';
  if (scope === 'partner2') return 'partner2';
  return 'couple';
}

export function computeOperationFingerprint(
  op: Pick<
    FinancialOperationRecord,
    | 'id'
    | 'type'
    | 'authorizedBy'
    | 'authoredByUid'
    | 'scope'
    | 'sourceRef'
    | 'targetRef'
    | 'competence'
    | 'date'
    | 'reversalOf'
    | 'expenseId'
    | 'intentId'
    | 'reconciliationRef'
    | 'expectedRevision'
    | 'signedDeltaCents'
    | 'valuationDirection'
    | 'costBasisCents'
    | 'postValuationCents'
    | 'guideMonthKey'
    | 'guideItemId'
    | 'completedGoalContributionConfirmed'
    | 'withdrawalChannel'
    | 'settlementStatus'
    | 'settlementDate'
    | 'destinationAccountId'
    | 'grossAmountCents'
    | 'netAmountCents'
    | 'differenceToReviewCents'
    | 'partitions'
    | 'sourceOperationId'
    | 'bankTransactionId'
    | 'overrideInsufficientPlanning'
    | 'planningDivergenceCents'
  >,
  normalizedCents: number
): string {
  const payload: Record<string, unknown> = {
    id: op.id,
    type: op.type,
    amountCents: normalizedCents,
    authorizedBy: String(op.authorizedBy || '').trim(),
    authoredByUid: op.authoredByUid ? String(op.authoredByUid).trim() : '',
    scope: op.scope ? normalizeCommandScope(op.scope) : 'couple',
    sourceType: op.sourceRef?.type || '',
    sourceId: op.sourceRef?.id || '',
    targetType: op.targetRef?.type || '',
    targetId: op.targetRef?.id || '',
    competence: op.competence || (op.date ? op.date.slice(0, 7) : ''),
    date: op.date || '',
    reversalOf: op.reversalOf || '',
    expenseId: op.expenseId || '',
    intentId: op.intentId || '',
    reconciliationRef: op.reconciliationRef || '',
    expectedRevision: op.expectedRevision ?? null,
  };
  if (
    op.signedDeltaCents !== undefined ||
    op.valuationDirection !== undefined ||
    op.costBasisCents !== undefined ||
    op.postValuationCents !== undefined ||
    op.guideMonthKey !== undefined ||
    op.guideItemId !== undefined ||
    op.completedGoalContributionConfirmed !== undefined
  ) {
    payload.signedDeltaCents = op.signedDeltaCents ?? null;
    payload.valuationDirection = op.valuationDirection ?? null;
    payload.costBasisCents = op.costBasisCents ?? null;
    payload.postValuationCents = op.postValuationCents ?? null;
    payload.guideMonthKey = op.guideMonthKey ?? null;
    payload.guideItemId = op.guideItemId ?? null;
    payload.completedGoalContributionConfirmed = op.completedGoalContributionConfirmed ?? null;
  }
  if (
    op.withdrawalChannel !== undefined ||
    op.settlementStatus !== undefined ||
    op.settlementDate !== undefined ||
    op.destinationAccountId !== undefined ||
    op.grossAmountCents !== undefined ||
    op.netAmountCents !== undefined ||
    op.differenceToReviewCents !== undefined ||
    op.partitions !== undefined ||
    op.sourceOperationId !== undefined ||
    op.bankTransactionId !== undefined ||
    op.overrideInsufficientPlanning !== undefined ||
    op.planningDivergenceCents !== undefined
  ) {
    payload.withdrawalChannel = op.withdrawalChannel ?? null;
    payload.settlementStatus = op.settlementStatus ?? null;
    payload.settlementDate = op.settlementDate ?? null;
    payload.destinationAccountId = op.destinationAccountId ?? null;
    payload.grossAmountCents = op.grossAmountCents ?? null;
    payload.netAmountCents = op.netAmountCents ?? null;
    payload.differenceToReviewCents = op.differenceToReviewCents ?? null;
    payload.partitions = op.partitions ?? null;
    payload.sourceOperationId = op.sourceOperationId ?? null;
    payload.bankTransactionId = op.bankTransactionId ?? null;
    payload.overrideInsufficientPlanning = op.overrideInsufficientPlanning ?? null;
    payload.planningDivergenceCents = op.planningDivergenceCents ?? null;
  }
  return JSON.stringify(payload);
}

function getGoalAvailableCents(goal: SavingsPiggyBank | CoupleGoal): number {
  if (isValidFiniteNumber(goal.availableCents) && Number.isSafeInteger(goal.availableCents)) {
    return goal.availableCents;
  }
  return Math.round((goal.currentAmount || 0) * 100);
}

function getGoalAccumulatedCents(goal: SavingsPiggyBank | CoupleGoal): number {
  if (isValidFiniteNumber(goal.accumulatedCents) && Number.isSafeInteger(goal.accumulatedCents)) {
    return goal.accumulatedCents;
  }
  const available = getGoalAvailableCents(goal);
  const committed = isValidFiniteNumber(goal.committedCents) ? Math.round(goal.committedCents) : 0;
  const utilized = isValidFiniteNumber(goal.utilizedCents) ? Math.round(goal.utilizedCents) : 0;
  return available + committed + utilized;
}

function failResult(
  status: 'conflict' | 'failure',
  reasonCode: FinancialCommandReasonCode,
  message: string,
  state: AppState,
  operation?: FinancialOperationRecord
): FinancialCommandResult {
  return {
    status,
    reasonCode,
    message,
    state,
    operation,
  };
}

function resolveAuthorDisplayName(state: AppState, authorizedBy: string, contributor?: 'partner1' | 'partner2' | 'both'): string {
  const p1 = state.profile?.partner1Name || 'Pessoa 1';
  const p2 = state.profile?.partner2Name === 'Aguardando Par...' ? 'Pessoa 2' : (state.profile?.partner2Name || 'Pessoa 2');
  const who = contributor || (authorizedBy === 'partner1' ? 'partner1' : authorizedBy === 'partner2' ? 'partner2' : 'both');
  if (who === 'partner1') return p1;
  if (who === 'partner2') return p2;
  return `${p1} & ${p2}`;
}

function buildGoalHistoryEntry(
  id: string,
  contributor: 'partner1' | 'partner2' | 'both',
  contributorName: string,
  amountR$: number,
  date: string,
  type: 'deposit' | 'withdrawal',
  note?: string
): CoupleGoalContribution {
  return {
    id,
    contributor,
    contributorName,
    amount: Math.abs(amountR$),
    date,
    type,
    note,
  };
}

export interface RunFinancialCommandOptions {
  reserveFloorR$?: number;
  reserveFloorCents?: number;
  nowIso?: string;
  contributor?: 'partner1' | 'partner2' | 'both';
}

/**
 * Pure, authoritative financial domain command executor.
 * Uses integer cents as single source of truth, enforces validation & preconditions,
 * separates occurred_manual from reconciled, rejects silent negative clamps,
 * and projects piggyBanks + coupleGoals mirrors synchronously.
 */
export function runFinancialCommand(
  state: AppState,
  rawOperation: FinancialOperationRecord & { amount?: number },
  options?: RunFinancialCommandOptions
): FinancialCommandResult {
  if (!rawOperation || typeof rawOperation.id !== 'string' || !rawOperation.id.trim()) {
    return failResult('failure', 'INVALID_REFS', 'ID da operação é obrigatório.', state);
  }

  const authorizedBy = String(rawOperation.authorizedBy || rawOperation.authoredByUid || '').trim();
  if (!authorizedBy) {
    return failResult('failure', 'INVALID_AUTH', 'Autoria da operação (UID ou parceiro) é obrigatória.', state);
  }

  if (rawOperation.scope !== undefined && !VALID_SCOPES.has(String(rawOperation.scope))) {
    return failResult('failure', 'INVALID_SCOPE', `Escopo inválido: "${String(rawOperation.scope)}".`, state);
  }

  const money = normalizeMonetaryBoundary({
    amountCents: rawOperation.amountCents,
    amountR$: rawOperation.amountR$,
    amount: rawOperation.amount,
  });
  if (!money.ok) {
    return failResult('failure', money.reasonCode || 'INVALID_AMOUNT', money.error || 'Valor monetário inválido.', state);
  }

  const dateStr = (rawOperation.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return failResult('failure', 'INVALID_DATE', `Data da operação inválida: "${dateStr}".`, state);
  }
  const parsedDate = new Date(`${dateStr}T12:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateStr) {
    return failResult('failure', 'INVALID_DATE', `Data civil inválida: "${dateStr}".`, state);
  }

  const normalizedFingerprint = computeOperationFingerprint(rawOperation, money.amountCents);
  const existingOps = state.financialOperations || [];
  let nextFinancialOperations = [...existingOps];
  const existingOp = existingOps.find((op) => op.id === rawOperation.id);

  if (existingOp) {
    const existingCents = readOperationAmountCents(existingOp);
    const existingFingerprint = existingOp.commandFingerprint || computeOperationFingerprint(existingOp, existingCents);
    if (existingFingerprint === normalizedFingerprint) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Operação já registrada anteriormente (replay idempotente).',
        state,
        operation: existingOp,
        idempotentReplay: true,
      };
    }
    return failResult(
      'conflict',
      'CONFLICT_PAYLOAD_MISMATCH',
      `Conflito de replay: operação "${rawOperation.id}" já registrada com intenção diferente.`,
      state,
      existingOp
    );
  }

  // Validate state semantics: never promote occurred_manual -> reconciled implicitly!
  if (rawOperation.state === 'reverted' || rawOperation.state === 'estornado') {
    return failResult(
      'failure',
      'REVERSAL_DEPENDENCY_ERROR',
      'Estornos devem ser executados pelo comando de estorno com operação original.',
      state
    );
  }

  let resolvedState: FinancialOperationState;
  const hasReconciliationEvidence = Boolean(rawOperation.reconciliationRef && rawOperation.reconciliationRef.trim().length > 0);
  if (rawOperation.state === 'reconciled') {
    if (!hasReconciliationEvidence) {
      return failResult(
        'failure',
        'INVALID_RECONCILIATION',
        'Operação marcada como "reconciled" exige evidência explícita (reconciliationRef).',
        state
      );
    }
    resolvedState = 'reconciled';
  } else if (rawOperation.state === 'pending_settlement') {
    resolvedState = 'pending_settlement';
  } else if (rawOperation.state === 'planned' && rawOperation.type === 'GOAL_WITHDRAWAL') {
    resolvedState = 'planned';
  } else if (rawOperation.state === 'occurred_manual') {
    resolvedState = 'occurred_manual';
  } else if (rawOperation.state === 'processing' || rawOperation.state === 'planned' || !rawOperation.state) {
    resolvedState = hasReconciliationEvidence ? 'reconciled' : 'occurred_manual';
  } else {
    resolvedState = rawOperation.state;
  }

  const nowIso = options?.nowIso || rawOperation.confirmedAt || new Date().toISOString();
  const occurredAt = rawOperation.occurredAt || dateStr;
  const touched: FinancialCommandTouchedEntities = {
    financialOperations: [rawOperation.id],
  };

  let nextPiggyBanks = [...(state.piggyBanks || [])];
  let nextCoupleGoals = [...(state.coupleGoals || [])];
  const nextLinkedAccounts = [...(state.linkedAccounts || [])];
  let nextProtAmount = state.protectionCurrentAmount || 0;
  let nextProtInvested = state.protectionTotalInvested ?? nextProtAmount;
  let nextProtYield =
    state.protectionYieldAccumulated ?? roundMoneyCentsCompatible(nextProtAmount - nextProtInvested);
  let nextProtComplete = Boolean(state.isProtectionComplete);
  let nextFreeInvested = state.freedomTotalInvested || 0;
  let nextFreeYield = state.freedomYieldAccumulated || 0;
  let opValuationMeta: Partial<FinancialOperationRecord> = {};

  const piggyById = new Map(nextPiggyBanks.map((p) => [p.id, p]));
  const coupleGoalById = new Map(nextCoupleGoals.map((g) => [g.id, g]));

  const findGoal = (goalId: string) => {
    const piggy = piggyById.get(goalId);
    const coupleGoal = coupleGoalById.get(goalId);
    if (!piggy && !coupleGoal) return { exists: false as const };
    const archived = Boolean(piggy?.archived || coupleGoal?.archived || piggy?.isDeleted || coupleGoal?.isDeleted);
    const currentEntity = piggy || coupleGoal!;
    const availCents = getGoalAvailableCents(currentEntity);
    const rawInvested = piggy?.totalInvested ?? coupleGoal?.totalInvested;
    const costCents = isValidFiniteNumber(rawInvested) ? Math.round(rawInvested * 100) : availCents;
    return {
      exists: true as const,
      archived,
      piggy,
      coupleGoal,
      revision: currentEntity.revision ?? 0,
      availableCents: availCents,
      accumulatedCents: getGoalAccumulatedCents(currentEntity),
      committedCents: isValidFiniteNumber(currentEntity.committedCents) ? Math.round(currentEntity.committedCents) : 0,
      utilizedCents: isValidFiniteNumber(currentEntity.utilizedCents) ? Math.round(currentEntity.utilizedCents) : 0,
      costCents,
    };
  };

  const checkExpectedRevision = (actualRevision: number, entityLabel: string): FinancialCommandResult | null => {
    if (rawOperation.expectedRevision !== undefined && rawOperation.expectedRevision !== actualRevision) {
      return failResult(
        'conflict',
        'CONFLICT_REVISION',
        `Conflito de revisão em ${entityLabel}: esperado ${rawOperation.expectedRevision}, atual ${actualRevision}.`,
        state
      );
    }
    return null;
  };

  const contributorRole: 'partner1' | 'partner2' | 'both' =
    options?.contributor ||
    (authorizedBy === 'partner1' ? 'partner1' : authorizedBy === 'partner2' ? 'partner2' : 'both');
  const contributorName = resolveAuthorDisplayName(state, authorizedBy, contributorRole);

  const normalizeAssetRefType = (t?: string): 'piggy_bank' | 'protection' | 'freedom' | null => {
    if (t === 'piggy_bank') return 'piggy_bank';
    if (t === 'protection' || t === 'reserve') return 'protection';
    if (t === 'freedom') return 'freedom';
    return null;
  };

  const computeProRataCostAndGain = (preCostCents: number, preValCents: number, withdrawCents: number) => {
    if (withdrawCents >= preValCents) {
      const costReducedCents = preCostCents;
      return {
        costReducedCents,
        realizedGainCents: withdrawCents - costReducedCents,
        postCostCents: 0,
        postValCents: 0,
      };
    }
    const costReducedCents = Math.min(preCostCents, Math.round((preCostCents * withdrawCents) / preValCents));
    return {
      costReducedCents,
      realizedGainCents: withdrawCents - costReducedCents,
      postCostCents: Math.max(0, preCostCents - costReducedCents),
      postValCents: Math.max(0, preValCents - withdrawCents),
    };
  };

  const applyGoalCentsUpdate = (
    goalId: string,
    delta: {
      accumulatedDeltaCents: number;
      committedDeltaCents: number;
      utilizedDeltaCents: number;
      contributionDeltaCents: number; // + for deposit, - for withdrawal/purchase
      costBasisDeltaCents?: number;
      liberatedDeltaCents?: number;
      uncoveredDivergenceDeltaCents?: number;
      historyType?: 'deposit' | 'withdrawal';
      historyNote?: string;
      historyAmountR$?: number;
    }
  ) => {
    const goalInfo = findGoal(goalId);
    if (!goalInfo.exists) return;

    const newAccumulatedCents = goalInfo.accumulatedCents + delta.accumulatedDeltaCents;
    const newCommittedCents = goalInfo.committedCents + delta.committedDeltaCents;
    const newUtilizedCents = goalInfo.utilizedCents + delta.utilizedDeltaCents;
    const newAvailableCents = newAccumulatedCents - newCommittedCents - newUtilizedCents;
    const newCurrentAmount = newAvailableCents / 100;
    const nextRevision = goalInfo.revision + 1;

    const effectiveCostDelta = delta.costBasisDeltaCents ?? delta.accumulatedDeltaCents;
    const hasExplicitCostTracking =
      goalInfo.piggy?.totalInvested !== undefined ||
      goalInfo.coupleGoal?.totalInvested !== undefined ||
      delta.costBasisDeltaCents !== undefined ||
      rawOperation.type === 'INITIAL_POSITION' ||
      rawOperation.type === 'VALUATION_ADJUSTMENT';
    const nextCostCents = Math.max(0, goalInfo.costCents + effectiveCostDelta);
    const nextYieldCents = newAvailableCents - nextCostCents;
    const prevLiberated = goalInfo.piggy?.liberatedReservedCents ?? goalInfo.coupleGoal?.liberatedReservedCents ?? 0;
    const nextLiberated = Math.max(0, prevLiberated + (delta.liberatedDeltaCents ?? 0));
    const prevDivergence = goalInfo.piggy?.uncoveredDivergenceCents ?? goalInfo.coupleGoal?.uncoveredDivergenceCents ?? 0;
    const nextDivergence = Math.max(0, prevDivergence + (delta.uncoveredDivergenceDeltaCents ?? 0));

    if (goalInfo.piggy) {
      const targetCents = Math.round((goalInfo.piggy.targetAmount || 0) * 100);
      nextPiggyBanks = nextPiggyBanks.map((p) => {
        if (p.id !== goalId) return p;
        return {
          ...p,
          currentAmount: newCurrentAmount,
          accumulatedCents: newAccumulatedCents,
          committedCents: newCommittedCents,
          utilizedCents: newUtilizedCents,
          availableCents: newAvailableCents,
          ...(nextLiberated > 0 || p.liberatedReservedCents !== undefined ? { liberatedReservedCents: nextLiberated } : {}),
          ...(nextDivergence > 0 || p.uncoveredDivergenceCents !== undefined ? { uncoveredDivergenceCents: nextDivergence } : {}),
          ...(hasExplicitCostTracking
            ? {
                totalInvested: nextCostCents / 100,
                yieldAccumulated: nextYieldCents / 100,
              }
            : {}),
          completed: targetCents > 0 ? newAvailableCents >= targetCents : p.completed,
          revision: nextRevision,
          lastOperationId: rawOperation.id,
        };
      });
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), goalId]));
    }

    if (goalInfo.coupleGoal) {
      const targetCents = Math.round((goalInfo.coupleGoal.targetAmount || 0) * 100);
      const agreement = goalInfo.coupleGoal.coupleAgreement;
      let p1DeltaCents = 0;
      let p2DeltaCents = 0;
      if (delta.contributionDeltaCents !== 0) {
        if (contributorRole === 'partner1') p1DeltaCents = delta.contributionDeltaCents;
        else if (contributorRole === 'partner2') p2DeltaCents = delta.contributionDeltaCents;
        else if (agreement) {
          p1DeltaCents = Math.round((delta.contributionDeltaCents * (agreement.partner1SharePct || 0)) / 100);
          p2DeltaCents = delta.contributionDeltaCents - p1DeltaCents;
        }
        // Without explicit coupleAgreement or partner role, do not force 50/50 split on coupleGoal contributions
      }

      const histEntryId = `hist-${rawOperation.id}`;
      nextCoupleGoals = nextCoupleGoals.map((g) => {
        if (g.id !== goalId) return g;
        const nextP1Cents = Math.max(0, Math.round((g.partner1Contribution || 0) * 100) + p1DeltaCents);
        const nextP2Cents = Math.max(0, Math.round((g.partner2Contribution || 0) * 100) + p2DeltaCents);
        const alreadyInHist = (g.history || []).some((h) => h.id === histEntryId);
        const nextHistory =
          delta.historyType && !alreadyInHist
            ? [
                buildGoalHistoryEntry(
                  histEntryId,
                  contributorRole,
                  contributorName,
                  delta.historyAmountR$ ?? money.amountR$,
                  dateStr,
                  delta.historyType,
                  delta.historyNote || rawOperation.notes
                ),
                ...(g.history || []),
              ]
            : g.history;

        return {
          ...g,
          currentAmount: newCurrentAmount,
          accumulatedCents: newAccumulatedCents,
          committedCents: newCommittedCents,
          utilizedCents: newUtilizedCents,
          availableCents: newAvailableCents,
          ...(nextLiberated > 0 || g.liberatedReservedCents !== undefined ? { liberatedReservedCents: nextLiberated } : {}),
          ...(nextDivergence > 0 || g.uncoveredDivergenceCents !== undefined ? { uncoveredDivergenceCents: nextDivergence } : {}),
          ...(hasExplicitCostTracking
            ? {
                totalInvested: nextCostCents / 100,
                yieldAccumulated: nextYieldCents / 100,
              }
            : {}),
          partner1Contribution: nextP1Cents / 100,
          partner2Contribution: nextP2Cents / 100,
          isCompleted: targetCents > 0 ? newAvailableCents >= targetCents : g.isCompleted,
          history: nextHistory,
          revision: nextRevision,
          lastOperationId: rawOperation.id,
        };
      });
      touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), goalId]));
    }
  };

  const refreshGoalMaps = () => {
    piggyById.clear();
    nextPiggyBanks.forEach((p) => piggyById.set(p.id, p));
    coupleGoalById.clear();
    nextCoupleGoals.forEach((g) => coupleGoalById.set(g.id, g));
  };

  const checkCompletedUtilizedGoalGuard = (goalInfo: Extract<ReturnType<typeof findGoal>, { exists: true }>, goalId: string) => {
    const targetGoalCents = Math.round(((goalInfo.piggy?.targetAmount ?? goalInfo.coupleGoal?.targetAmount) || 0) * 100);
    const isCompletedGoal = Boolean(
      goalInfo.piggy?.completed ||
        goalInfo.coupleGoal?.isCompleted ||
        (targetGoalCents > 0 && goalInfo.accumulatedCents >= targetGoalCents)
    );
    if (
      isCompletedGoal &&
      goalInfo.utilizedCents > 0 &&
      goalInfo.availableCents === 0 &&
      rawOperation.completedGoalContributionConfirmed !== true
    ) {
      return failResult(
        'conflict',
        'CONFIRMATION_REQUIRED',
        `A meta "${goalInfo.piggy?.name || goalInfo.coupleGoal?.title || goalId}" já foi concluída e integralmente utilizada. Confirme explicitamente antes de redirecionar um novo aporte.`,
        state
      );
    }
    return null;
  };

  // Validate sourceRef / targetRef and execute transition by type
  if (rawOperation.type === 'GOAL_DEPOSIT') {
    if (!rawOperation.sourceRef?.type || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Aporte exige origem válida (sourceRef).', state);
    }
    const targetKind = normalizeAssetRefType(rawOperation.targetRef?.type);
    if (!targetKind || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Aporte exige destino patrimonial válido (targetRef).', state);
    }
    if (targetKind === 'piggy_bank') {
      const goalId = rawOperation.targetRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta/cofrinho "${goalId}" não encontrado para aporte.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Meta/cofrinho "${goalId}" está arquivado e não aceita novos aportes.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;
      const compErr = checkCompletedUtilizedGoalGuard(goalInfo, goalId);
      if (compErr) return compErr;

      applyGoalCentsUpdate(goalId, {
        accumulatedDeltaCents: money.amountCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: money.amountCents,
        costBasisDeltaCents: money.amountCents,
        historyType: 'deposit',
      });
      opValuationMeta = {
        costBasisCents: money.amountCents,
        postCostBasisCents: goalInfo.costCents + money.amountCents,
        postValuationCents: goalInfo.availableCents + money.amountCents,
      };
    } else if (targetKind === 'protection') {
      const preValCents = Math.round(nextProtAmount * 100);
      const preCostCents = Math.round(nextProtInvested * 100);
      const postValCents = preValCents + money.amountCents;
      const postCostCents = preCostCents + money.amountCents;
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = postValCents / 100;
      nextProtInvested = postCostCents / 100;
      nextProtYield = (postValCents - postCostCents) / 100;
      if (floorCents > 0) {
        nextProtComplete = postValCents >= floorCents;
      }
      touched.protectionUpdated = true;
      opValuationMeta = {
        costBasisCents: money.amountCents,
        postCostBasisCents: postCostCents,
        postValuationCents: postValCents,
      };
    } else {
      // freedom
      const preCostCents = Math.round(nextFreeInvested * 100);
      const preYieldCents = Math.round(nextFreeYield * 100);
      const postCostCents = preCostCents + money.amountCents;
      nextFreeInvested = postCostCents / 100;
      touched.freedomUpdated = true;
      opValuationMeta = {
        costBasisCents: money.amountCents,
        postCostBasisCents: postCostCents,
        postValuationCents: postCostCents + preYieldCents,
      };
    }
  } else if (rawOperation.type === 'GOAL_WITHDRAWAL') {
    const sourceKind = normalizeAssetRefType(rawOperation.sourceRef?.type);
    if (!sourceKind || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Resgate exige ativo/meta de origem válido (sourceRef).', state);
    }
    if (!rawOperation.targetRef?.type || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Resgate exige destino válido (targetRef).', state);
    }

    const grossCents = rawOperation.grossAmountCents ?? money.amountCents;
    const netCents = rawOperation.netAmountCents ?? money.amountCents;
    if (!Number.isSafeInteger(grossCents) || grossCents <= 0 || !Number.isSafeInteger(netCents) || netCents <= 0) {
      return failResult('failure', 'INVALID_AMOUNT', 'Valores bruto e líquido do resgate devem ser inteiros positivos em centavos.', state);
    }
    if (netCents > grossCents) {
      return failResult('failure', 'DIVERGENT_AMOUNTS', 'Valor líquido do resgate não pode exceder o valor bruto.', state);
    }
    const diffToReviewCents = grossCents - netCents;
    const channel: 'virtual_reallocation' | 'asset_redemption' = rawOperation.withdrawalChannel || 'asset_redemption';

    if (rawOperation.partitions && rawOperation.partitions.length > 0) {
      let partSum = 0;
      for (const part of rawOperation.partitions) {
        if (!Number.isSafeInteger(part.amountCents) || part.amountCents <= 0) {
          return failResult('failure', 'INVALID_AMOUNT', 'Todas as partições do resgate devem ter valor inteiro positivo em centavos.', state);
        }
        partSum += part.amountCents;
      }
      if (partSum !== netCents) {
        return failResult(
          'failure',
          'DIVERGENT_AMOUNTS',
          `A soma das partições (R$ ${(partSum / 100).toFixed(2)}) deve igualar exatamente o valor líquido (R$ ${(netCents / 100).toFixed(2)}).`,
          state
        );
      }
    }

    const earmarkedNetCents =
      rawOperation.partitions && rawOperation.partitions.length > 0
        ? rawOperation.partitions.reduce((s, p) => s + (p.targetType !== 'cash_free' ? p.amountCents : 0), 0)
        : channel === 'virtual_reallocation' || rawOperation.targetRef.type === 'category'
        ? netCents
        : 0;

    const isPendingStage = resolvedState === 'planned' || resolvedState === 'pending_settlement';

    const creditDestinationCheckingAccount = (creditCents: number) => {
      if (channel !== 'asset_redemption' || !rawOperation.destinationAccountId || creditCents <= 0) return;
      const targetAccId = rawOperation.destinationAccountId;
      const idx = nextLinkedAccounts.findIndex(
        (a) => a.id === targetAccId || a.canonicalAccountId === targetAccId
      );
      if (idx >= 0) {
        const acc = nextLinkedAccounts[idx];
        if (acc.accountType === 'cartao') return;
        const nextBalanceCents = Math.round((acc.balance || 0) * 100) + creditCents;
        nextLinkedAccounts[idx] = {
          ...acc,
          balance: nextBalanceCents / 100,
          revision: (acc.revision ?? 0) + 1,
          lastOperationId: rawOperation.id,
        };
        touched.linkedAccounts = Array.from(new Set([...(touched.linkedAccounts || []), acc.id]));
      }
    };

    if (sourceKind === 'piggy_bank') {
      const goalId = rawOperation.sourceRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta/cofrinho "${goalId}" não encontrado para resgate.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Meta/cofrinho "${goalId}" está arquivado e não permite resgate.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;

      const shortfallCents = Math.max(0, grossCents - goalInfo.availableCents);
      if (shortfallCents > 0 && rawOperation.overrideInsufficientPlanning !== true) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente na meta "${goalInfo.piggy?.name || goalInfo.coupleGoal?.title || goalId}" (R$ ${(goalInfo.availableCents / 100).toFixed(2)}) para operação de R$ ${(grossCents / 100).toFixed(2)}. Não é permitido clamp silencioso.`,
          state
        );
      }

      if (resolvedState === 'planned') {
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus: 'planned',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
        };
      } else if (resolvedState === 'pending_settlement') {
        const lockCents = Math.min(grossCents, goalInfo.availableCents);
        if (lockCents > 0) {
          applyGoalCentsUpdate(goalId, {
            accumulatedDeltaCents: 0,
            committedDeltaCents: lockCents,
            utilizedDeltaCents: 0,
            contributionDeltaCents: 0,
            costBasisDeltaCents: 0,
          });
        }
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus: 'pending_settlement',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
        };
      } else {
        const actualDebitCents = Math.min(grossCents, goalInfo.availableCents);
        const divergenceCents = grossCents - actualDebitCents;
        const proRata = computeProRataCostAndGain(goalInfo.costCents, goalInfo.availableCents, actualDebitCents);
        applyGoalCentsUpdate(goalId, {
          accumulatedDeltaCents: -actualDebitCents,
          committedDeltaCents: 0,
          utilizedDeltaCents: 0,
          contributionDeltaCents: -actualDebitCents,
          costBasisDeltaCents: -proRata.costReducedCents,
          liberatedDeltaCents: earmarkedNetCents,
          uncoveredDivergenceDeltaCents: divergenceCents,
          historyType: 'withdrawal',
          historyAmountR$: actualDebitCents / 100,
        });
        creditDestinationCheckingAccount(netCents);
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus:
            divergenceCents > 0
              ? 'divergent'
              : resolvedState === 'reconciled'
              ? 'reconciled'
              : 'occurred_manual',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
          planningDivergenceCents: divergenceCents > 0 ? divergenceCents : undefined,
          costBasisCents: proRata.costReducedCents,
          realizedGainCents: proRata.realizedGainCents,
          postCostBasisCents: proRata.postCostCents,
          postValuationCents: proRata.postValCents,
        };
      }
    } else if (sourceKind === 'protection') {
      const preValCents = Math.round(nextProtAmount * 100);
      const preCostCents = Math.round(nextProtInvested * 100);
      if (preValCents < grossCents && rawOperation.overrideInsufficientPlanning !== true) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente no Bloco 1 Proteção (R$ ${(preValCents / 100).toFixed(2)}) para resgate de R$ ${(grossCents / 100).toFixed(2)}.`,
          state
        );
      }
      if (isPendingStage) {
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus: resolvedState === 'pending_settlement' ? 'pending_settlement' : 'planned',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
        };
      } else {
        const actualDebitCents = Math.min(grossCents, preValCents);
        const divergenceCents = grossCents - actualDebitCents;
        const proRata = computeProRataCostAndGain(preCostCents, preValCents, actualDebitCents);
        const floorCents =
          options?.reserveFloorCents !== undefined
            ? Math.round(options.reserveFloorCents)
            : Math.round((options?.reserveFloorR$ ?? 0) * 100);
        nextProtAmount = proRata.postValCents / 100;
        nextProtInvested = proRata.postCostCents / 100;
        nextProtYield = (proRata.postValCents - proRata.postCostCents) / 100;
        nextProtComplete = floorCents > 0 ? proRata.postValCents >= floorCents : state.isProtectionComplete;
        touched.protectionUpdated = true;
        creditDestinationCheckingAccount(netCents);
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus:
            divergenceCents > 0
              ? 'divergent'
              : resolvedState === 'reconciled'
              ? 'reconciled'
              : 'occurred_manual',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
          planningDivergenceCents: divergenceCents > 0 ? divergenceCents : undefined,
          costBasisCents: proRata.costReducedCents,
          realizedGainCents: proRata.realizedGainCents,
          postCostBasisCents: proRata.postCostCents,
          postValuationCents: proRata.postValCents,
        };
      }
    } else {
      const preCostCents = Math.round(nextFreeInvested * 100);
      const preYieldCents = Math.round(nextFreeYield * 100);
      const preValCents = preCostCents + preYieldCents;
      if (preValCents < grossCents && rawOperation.overrideInsufficientPlanning !== true) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente no Bloco 3 Liberdade (R$ ${(preValCents / 100).toFixed(2)}) para resgate de R$ ${(grossCents / 100).toFixed(2)}.`,
          state
        );
      }
      if (isPendingStage) {
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus: resolvedState === 'pending_settlement' ? 'pending_settlement' : 'planned',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
        };
      } else {
        const actualDebitCents = Math.min(grossCents, preValCents);
        const divergenceCents = grossCents - actualDebitCents;
        const proRata = computeProRataCostAndGain(preCostCents, preValCents, actualDebitCents);
        nextFreeInvested = proRata.postCostCents / 100;
        nextFreeYield = (proRata.postValCents - proRata.postCostCents) / 100;
        touched.freedomUpdated = true;
        creditDestinationCheckingAccount(netCents);
        opValuationMeta = {
          withdrawalChannel: channel,
          settlementStatus:
            divergenceCents > 0
              ? 'divergent'
              : resolvedState === 'reconciled'
              ? 'reconciled'
              : 'occurred_manual',
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          differenceToReviewCents: diffToReviewCents,
          planningDivergenceCents: divergenceCents > 0 ? divergenceCents : undefined,
          costBasisCents: proRata.costReducedCents,
          realizedGainCents: proRata.realizedGainCents,
          postCostBasisCents: proRata.postCostCents,
          postValuationCents: proRata.postValCents,
        };
      }
    }
  } else if (rawOperation.type === 'GOAL_DIRECT_PURCHASE') {
    if (!rawOperation.sourceRef?.type || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Compra direta exige origem patrimonial válida (sourceRef).', state);
    }
    if (!rawOperation.targetRef?.type || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Compra direta exige destino válido (targetRef).', state);
    }

    if (rawOperation.sourceRef.type === 'piggy_bank') {
      const goalId = rawOperation.sourceRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Caixinha/meta "${goalId}" não encontrada.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Caixinha/meta "${goalId}" está arquivada para novo uso.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;
      if (goalInfo.availableCents < money.amountCents) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente na meta "${goalInfo.piggy?.name || goalInfo.coupleGoal?.title || goalId}" (R$ ${(goalInfo.availableCents / 100).toFixed(2)}) para operação de R$ ${money.amountR$.toFixed(2)}. Não é permitido clamp silencioso.`,
          state
        );
      }

      applyGoalCentsUpdate(goalId, {
        accumulatedDeltaCents: 0,
        committedDeltaCents: 0,
        utilizedDeltaCents: money.amountCents,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
        historyType: 'withdrawal',
        historyNote: rawOperation.notes || `Compra direta: ${rawOperation.targetRef.name || rawOperation.targetRef.id}`,
      });
    } else if (rawOperation.sourceRef.type === 'reserve' || rawOperation.sourceRef.type === 'protection') {
      const currentProtCents = Math.round((state.protectionCurrentAmount || 0) * 100);
      const currentInvestedCents = Math.round((state.protectionTotalInvested ?? state.protectionCurrentAmount ?? 0) * 100);
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      const excessCents = Math.max(0, currentProtCents - floorCents);
      if (excessCents < money.amountCents) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente no excesso da reserva de emergência (R$ ${(excessCents / 100).toFixed(2)}) para operação de R$ ${money.amountR$.toFixed(2)}.`,
          state
        );
      }
      const nextProtCents = currentProtCents - money.amountCents;
      const proRata = computeProRataCostAndGain(currentInvestedCents, currentProtCents, money.amountCents);
      nextProtAmount = nextProtCents / 100;
      nextProtInvested = proRata.postCostCents / 100;
      nextProtYield = (nextProtCents - proRata.postCostCents) / 100;
      nextProtComplete = floorCents > 0 ? nextProtCents >= floorCents : state.isProtectionComplete;
      touched.protectionUpdated = true;
    } else {
      return failResult('failure', 'INVALID_REFS', `Origem não suportada em compra direta: "${rawOperation.sourceRef.type}".`, state);
    }
  } else if (rawOperation.type === 'GOAL_TRANSFER' || rawOperation.type === 'BLOCK_TRANSFER') {
    const srcKind = normalizeAssetRefType(rawOperation.sourceRef?.type);
    const dstKind = normalizeAssetRefType(rawOperation.targetRef?.type);
    if (!srcKind || !rawOperation.sourceRef?.id?.trim() || !dstKind || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Transferência exige origem e destino patrimoniais válidos.', state);
    }
    const sourceId = rawOperation.sourceRef.id;
    const targetId = rawOperation.targetRef.id;
    if (srcKind === dstKind && (srcKind !== 'piggy_bank' || sourceId === targetId)) {
      return failResult('failure', 'INVALID_REFS', 'Origem e destino da transferência devem ser distintos.', state);
    }

    let srcValCents = 0;
    let srcCostCents = 0;
    if (srcKind === 'piggy_bank') {
      const sourceInfo = findGoal(sourceId);
      if (!sourceInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta de origem "${sourceId}" não encontrada.`, state);
      }
      if (sourceInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', 'Transferência não permitida envolvendo meta arquivada.', state);
      }
      const revErr = checkExpectedRevision(sourceInfo.revision, `meta ${sourceId}`);
      if (revErr) return revErr;
      srcValCents = sourceInfo.availableCents;
      srcCostCents = sourceInfo.costCents;
    } else if (srcKind === 'protection') {
      srcValCents = Math.round(nextProtAmount * 100);
      srcCostCents = Math.round(nextProtInvested * 100);
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      if (floorCents > 0 && srcValCents - floorCents < money.amountCents) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Excesso da Proteção insuficiente (R$ ${((Math.max(0, srcValCents - floorCents)) / 100).toFixed(2)}) para transferência de R$ ${money.amountR$.toFixed(2)}.`,
          state
        );
      }
    } else {
      srcCostCents = Math.round(nextFreeInvested * 100);
      srcValCents = srcCostCents + Math.round(nextFreeYield * 100);
    }

    if (srcValCents < money.amountCents) {
      return failResult(
        'failure',
        'INSUFFICIENT_FUNDS',
        `Saldo insuficiente na origem "${sourceId}" (R$ ${(srcValCents / 100).toFixed(2)}) para transferência de R$ ${money.amountR$.toFixed(2)}.`,
        state
      );
    }

    if (dstKind === 'piggy_bank') {
      const targetInfo = findGoal(targetId);
      if (!targetInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta de destino "${targetId}" não encontrada.`, state);
      }
      if (targetInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', 'Transferência não permitida envolvendo meta arquivada.', state);
      }
      const compErr = checkCompletedUtilizedGoalGuard(targetInfo, targetId);
      if (compErr) return compErr;
    }

    const proRata = computeProRataCostAndGain(srcCostCents, srcValCents, money.amountCents);
    opValuationMeta = {
      costBasisCents: proRata.costReducedCents,
      realizedGainCents: proRata.realizedGainCents,
      postCostBasisCents: proRata.postCostCents,
      postValuationCents: proRata.postValCents,
    };

    // Debit source
    if (srcKind === 'piggy_bank') {
      applyGoalCentsUpdate(sourceId, {
        accumulatedDeltaCents: -money.amountCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: -money.amountCents,
        costBasisDeltaCents: -proRata.costReducedCents,
        historyType: 'withdrawal',
        historyNote: rawOperation.notes || `Transferência para ${rawOperation.targetRef.name || targetId}`,
      });
      refreshGoalMaps();
    } else if (srcKind === 'protection') {
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = proRata.postValCents / 100;
      nextProtInvested = proRata.postCostCents / 100;
      nextProtYield = (proRata.postValCents - proRata.postCostCents) / 100;
      if (floorCents > 0) nextProtComplete = proRata.postValCents >= floorCents;
      touched.protectionUpdated = true;
    } else {
      nextFreeInvested = proRata.postCostCents / 100;
      nextFreeYield = (proRata.postValCents - proRata.postCostCents) / 100;
      touched.freedomUpdated = true;
    }

    // Credit target
    if (dstKind === 'piggy_bank') {
      applyGoalCentsUpdate(targetId, {
        accumulatedDeltaCents: money.amountCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: money.amountCents,
        costBasisDeltaCents: money.amountCents,
        historyType: 'deposit',
        historyNote: rawOperation.notes || `Transferência recebida de ${rawOperation.sourceRef.name || sourceId}`,
      });
    } else if (dstKind === 'protection') {
      const dstVal = Math.round(nextProtAmount * 100) + money.amountCents;
      const dstCost = Math.round(nextProtInvested * 100) + money.amountCents;
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = dstVal / 100;
      nextProtInvested = dstCost / 100;
      nextProtYield = (dstVal - dstCost) / 100;
      if (floorCents > 0) nextProtComplete = dstVal >= floorCents;
      touched.protectionUpdated = true;
    } else {
      nextFreeInvested = (Math.round(nextFreeInvested * 100) + money.amountCents) / 100;
      touched.freedomUpdated = true;
    }
  } else if (rawOperation.type === 'INITIAL_POSITION') {
    const targetKind = normalizeAssetRefType(rawOperation.targetRef?.type);
    if (!targetKind || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Posição inicial exige ativo/meta de destino válido (targetRef).', state);
    }
    const initValCents = rawOperation.postValuationCents ?? money.amountCents;
    const initCostCents = rawOperation.costBasisCents ?? initValCents;
    if (!Number.isSafeInteger(initValCents) || initValCents < 0 || !Number.isSafeInteger(initCostCents) || initCostCents < 0) {
      return failResult('failure', 'INVALID_AMOUNT', 'Posição inicial exige custo e avaliação não negativos em centavos.', state);
    }

    if (targetKind === 'piggy_bank') {
      const goalId = rawOperation.targetRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta "${goalId}" não encontrada para posição inicial.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Meta "${goalId}" está arquivada.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;

      applyGoalCentsUpdate(goalId, {
        accumulatedDeltaCents: initValCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: initCostCents,
        costBasisDeltaCents: initCostCents,
        historyType: 'deposit',
        historyNote: rawOperation.notes || 'Posição inicial confirmada',
      });
      opValuationMeta = {
        costBasisCents: initCostCents,
        postCostBasisCents: goalInfo.costCents + initCostCents,
        postValuationCents: goalInfo.availableCents + initValCents,
      };
    } else if (targetKind === 'protection') {
      const postVal = Math.round(nextProtAmount * 100) + initValCents;
      const postCost = Math.round(nextProtInvested * 100) + initCostCents;
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = postVal / 100;
      nextProtInvested = postCost / 100;
      nextProtYield = (postVal - postCost) / 100;
      if (floorCents > 0) nextProtComplete = postVal >= floorCents;
      touched.protectionUpdated = true;
      opValuationMeta = {
        costBasisCents: initCostCents,
        postCostBasisCents: postCost,
        postValuationCents: postVal,
      };
    } else {
      const preCost = Math.round(nextFreeInvested * 100);
      const preYield = Math.round(nextFreeYield * 100);
      const postCost = preCost + initCostCents;
      const postVal = preCost + preYield + initValCents;
      nextFreeInvested = postCost / 100;
      nextFreeYield = (postVal - postCost) / 100;
      touched.freedomUpdated = true;
      opValuationMeta = {
        costBasisCents: initCostCents,
        postCostBasisCents: postCost,
        postValuationCents: postVal,
      };
    }
  } else if (rawOperation.type === 'VALUATION_ADJUSTMENT') {
    const targetKind = normalizeAssetRefType(rawOperation.targetRef?.type);
    if (!targetKind || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Ajuste de avaliação exige ativo/meta de destino válido (targetRef).', state);
    }
    let signedDeltaCents: number;
    if (rawOperation.signedDeltaCents !== undefined) {
      if (!isValidFiniteNumber(rawOperation.signedDeltaCents) || !Number.isSafeInteger(rawOperation.signedDeltaCents)) {
        return failResult('failure', 'INVALID_AMOUNT', 'signedDeltaCents inválido para ajuste de avaliação.', state);
      }
      if (Math.abs(rawOperation.signedDeltaCents) !== money.amountCents) {
        return failResult('failure', 'DIVERGENT_AMOUNTS', 'signedDeltaCents difere da magnitude em amountCents.', state);
      }
      signedDeltaCents = rawOperation.signedDeltaCents;
    } else {
      signedDeltaCents = rawOperation.valuationDirection === 'loss' ? -money.amountCents : money.amountCents;
    }
    const direction: 'gain' | 'loss' = signedDeltaCents < 0 ? 'loss' : 'gain';

    if (targetKind === 'piggy_bank') {
      const goalId = rawOperation.targetRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta "${goalId}" não encontrada para ajuste de avaliação.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Meta "${goalId}" está arquivada.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;
      const postVal = goalInfo.availableCents + signedDeltaCents;
      if (postVal < 0) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Ajuste de avaliação deixaria saldo negativo na meta "${goalId}" (R$ ${(postVal / 100).toFixed(2)}).`,
          state
        );
      }
      applyGoalCentsUpdate(goalId, {
        accumulatedDeltaCents: signedDeltaCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
      });
      opValuationMeta = {
        valuationDirection: direction,
        signedDeltaCents,
        costBasisCents: goalInfo.costCents,
        postCostBasisCents: goalInfo.costCents,
        postValuationCents: postVal,
      };
    } else if (targetKind === 'protection') {
      const preVal = Math.round(nextProtAmount * 100);
      const preCost = Math.round(nextProtInvested * 100);
      const postVal = preVal + signedDeltaCents;
      if (postVal < 0) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Ajuste deixaria Bloco 1 Proteção com saldo negativo.', state);
      }
      const floorCents =
        options?.reserveFloorCents !== undefined
          ? Math.round(options.reserveFloorCents)
          : Math.round((options?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = postVal / 100;
      nextProtYield = (postVal - preCost) / 100;
      if (floorCents > 0) nextProtComplete = postVal >= floorCents;
      touched.protectionUpdated = true;
      opValuationMeta = {
        valuationDirection: direction,
        signedDeltaCents,
        costBasisCents: preCost,
        postCostBasisCents: preCost,
        postValuationCents: postVal,
      };
    } else {
      const preCost = Math.round(nextFreeInvested * 100);
      const preVal = preCost + Math.round(nextFreeYield * 100);
      const postVal = preVal + signedDeltaCents;
      if (postVal < 0) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Ajuste deixaria Bloco 3 Liberdade com saldo negativo.', state);
      }
      nextFreeYield = (postVal - preCost) / 100;
      touched.freedomUpdated = true;
      opValuationMeta = {
        valuationDirection: direction,
        signedDeltaCents,
        costBasisCents: preCost,
        postCostBasisCents: preCost,
        postValuationCents: postVal,
      };
    }
  } else if (rawOperation.type === 'CATEGORY_REINFORCEMENT') {
    if (
      resolvedState === 'planned' ||
      resolvedState === 'pending_settlement' ||
      rawOperation.settlementStatus === 'planned' ||
      rawOperation.settlementStatus === 'pending_settlement'
    ) {
      return failResult(
        'failure',
        'INVALID_REFS',
        'Reforço temporário de categoria exige origem confirmada (não pode ficar planejado ou em liquidação).',
        state
      );
    }

    const targetCategory =
      rawOperation.targetRef?.type === 'category'
        ? resolveCanonicalReinforcementCategory(rawOperation.targetRef?.id)
        : null;
    if (!targetCategory) {
      return failResult('failure', 'INVALID_REFS', 'Reforço de categoria exige categoria canônica de destino válida.', state);
    }

    const resolvedCompetence = rawOperation.competence || dateStr.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(resolvedCompetence)) {
      return failResult('failure', 'INVALID_DATE', `Competência inválida para reforço: "${resolvedCompetence}".`, state);
    }

    if (rawOperation.sourceOperationId) {
      // Caminho A: Reforço originado de um resgate (GOAL_WITHDRAWAL) já liquidado/confirmado
      const wIdx = nextFinancialOperations.findIndex((o) => o.id === rawOperation.sourceOperationId);
      if (wIdx < 0) {
        return failResult(
          'failure',
          'OPERATION_NOT_FOUND',
          `Resgate de origem "${rawOperation.sourceOperationId}" não encontrado para reforço.`,
          state
        );
      }
      const withdrawalOp = nextFinancialOperations[wIdx];
      if (withdrawalOp.type !== 'GOAL_WITHDRAWAL') {
        return failResult(
          'failure',
          'INVALID_REFS',
          `Operação "${withdrawalOp.id}" não é um resgate patrimonial válido para reforçar categorias.`,
          state
        );
      }
      if (withdrawalOp.state === 'reverted' || withdrawalOp.state === 'estornado') {
        return failResult(
          'failure',
          'REVERSAL_DEPENDENCY_ERROR',
          `Resgate "${withdrawalOp.id}" já foi estornado e não pode financiar reforço.`,
          state
        );
      }
      if (
        withdrawalOp.state === 'planned' ||
        withdrawalOp.state === 'pending_settlement' ||
        withdrawalOp.settlementStatus === 'planned' ||
        withdrawalOp.settlementStatus === 'pending_settlement'
      ) {
        return failResult(
          'failure',
          'INVALID_REFS',
          `Resgate "${withdrawalOp.id}" está planejado ou em liquidação e não pode reforçar categorias até ser confirmado.`,
          state
        );
      }

      const wNetCents = withdrawalOp.netAmountCents ?? withdrawalOp.amountCents;
      const priorDownstreamCents = nextFinancialOperations
        .filter(
          (o) =>
            o.id !== rawOperation.id &&
            o.sourceOperationId === withdrawalOp.id &&
            o.state !== 'reverted' &&
            o.state !== 'estornado'
        )
        .reduce((sum, o) => sum + readOperationAmountCents(o), 0);
      const remainingNetCents = Math.max(0, wNetCents - priorDownstreamCents);
      if (money.amountCents > remainingNetCents) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Valor do reforço (R$ ${money.amountR$.toFixed(2)}) excede o líquido elegível restante do resgate (R$ ${(remainingNetCents / 100).toFixed(2)}).`,
          state
        );
      }

      if (withdrawalOp.partitions && withdrawalOp.partitions.length > 0) {
        const eligiblePartitionFilter = (p: WithdrawalPurposePartition) =>
          p.targetType === 'category_reinforcement' || p.targetType === 'cash_free';
        const matchingPartitions = withdrawalOp.partitions.filter(eligiblePartitionFilter);
        const totalPartitionRemaining = matchingPartitions.reduce(
          (sum, p) => sum + Math.max(0, p.amountCents - (p.consumedCents || 0)),
          0
        );
        if (money.amountCents > totalPartitionRemaining) {
          return failResult(
            'failure',
            'INSUFFICIENT_FUNDS',
            `Saldo elegível nas partições de reforço/caixa do resgate (R$ ${(totalPartitionRemaining / 100).toFixed(2)}) é insuficiente para R$ ${money.amountR$.toFixed(2)}.`,
            state
          );
        }

        // Consome partições compatíveis primeiro (categoria específica -> category_reinforcement -> cash_free)
        let toConsume = money.amountCents;
        const partitionOrder = [...withdrawalOp.partitions]
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => eligiblePartitionFilter(p) && Math.max(0, p.amountCents - (p.consumedCents || 0)) > 0)
          .sort((a, b) => {
            const rank = (p: WithdrawalPurposePartition) => {
              if (p.targetType === 'category_reinforcement' && p.targetId && resolveCanonicalReinforcementCategory(p.targetId) === targetCategory) {
                return 0;
              }
              if (p.targetType === 'category_reinforcement') return 1;
              return 2;
            };
            return rank(a.p) - rank(b.p);
          });

        const nextPartitions = withdrawalOp.partitions.map((p) => ({ ...p }));
        for (const item of partitionOrder) {
          if (toConsume <= 0) break;
          const part = nextPartitions[item.idx];
          const avail = Math.max(0, part.amountCents - (part.consumedCents || 0));
          const take = Math.min(avail, toConsume);
          if (take > 0) {
            part.consumedCents = (part.consumedCents || 0) + take;
            toConsume -= take;
          }
        }

        const updatedWithdrawal: FinancialOperationRecord = {
          ...withdrawalOp,
          partitions: nextPartitions,
          revision: (withdrawalOp.revision ?? 1) + 1,
        };
        updatedWithdrawal.commandFingerprint = computeOperationFingerprint(
          updatedWithdrawal,
          readOperationAmountCents(updatedWithdrawal)
        );
        nextFinancialOperations[wIdx] = updatedWithdrawal;
        touched.financialOperations = Array.from(
          new Set([...(touched.financialOperations || []), withdrawalOp.id])
        );
      }

      if (withdrawalOp.sourceRef?.type === 'piggy_bank' && withdrawalOp.sourceRef.id) {
        const gid = withdrawalOp.sourceRef.id;
        const goalInfo = findGoal(gid);
        if (goalInfo.exists) {
          const revErr = checkExpectedRevision(goalInfo.revision, `meta ${gid}`);
          if (revErr) return revErr;
          const prevLib = goalInfo.piggy?.liberatedReservedCents ?? goalInfo.coupleGoal?.liberatedReservedCents ?? 0;
          if (prevLib > 0) {
            const consumedLib = Math.min(prevLib, money.amountCents);
            applyGoalCentsUpdate(gid, {
              accumulatedDeltaCents: 0,
              committedDeltaCents: 0,
              utilizedDeltaCents: 0,
              contributionDeltaCents: 0,
              costBasisDeltaCents: 0,
              liberatedDeltaCents: -consumedLib,
            });
            opValuationMeta = {
              ...opValuationMeta,
              postValuationCents: consumedLib,
            };
          }
        }
      }

      if (withdrawalOp.state === 'reconciled' && resolvedState !== 'reconciled') {
        resolvedState = 'reconciled';
      }
      if (!rawOperation.reconciliationRef && withdrawalOp.reconciliationRef) {
        opValuationMeta = {
          ...opValuationMeta,
          reconciliationRef: withdrawalOp.reconciliationRef,
        };
      }
      if (!rawOperation.bankTransactionId && withdrawalOp.bankTransactionId) {
        opValuationMeta = {
          ...opValuationMeta,
          bankTransactionId: withdrawalOp.bankTransactionId,
        };
      }
    } else {
      // Caminho B: Reserva direta de meta/cofrinho elegível (comprometimento virtual no cofrinho)
      if (rawOperation.sourceRef?.type !== 'piggy_bank' || !rawOperation.sourceRef?.id?.trim()) {
        return failResult(
          'failure',
          'INVALID_REFS',
          'Reforço de categoria exige cofrinho de origem válido ou resgate liquidado vinculado.',
          state
        );
      }
      const goalId = rawOperation.sourceRef.id;
      const goalInfo = findGoal(goalId);
      if (!goalInfo.exists) {
        return failResult('failure', 'GOAL_NOT_FOUND', `Meta "${goalId}" não encontrada para reforço.`, state);
      }
      if (goalInfo.archived) {
        return failResult('failure', 'GOAL_ARCHIVED', `Meta "${goalId}" arquivada para novo reforço.`, state);
      }
      const revErr = checkExpectedRevision(goalInfo.revision, `meta ${goalId}`);
      if (revErr) return revErr;
      if (goalInfo.availableCents < money.amountCents) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Saldo insuficiente na meta "${goalId}" para reforço de R$ ${money.amountR$.toFixed(2)}.`,
          state
        );
      }

      applyGoalCentsUpdate(goalId, {
        accumulatedDeltaCents: 0,
        committedDeltaCents: money.amountCents,
        utilizedDeltaCents: 0,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
        historyType: 'withdrawal',
        historyNote: rawOperation.notes || `Reforço categoria ${targetCategory}`,
      });
    }
  } else if (rawOperation.type === 'CATEGORY_REALLOCATION') {
    if (
      resolvedState === 'planned' ||
      resolvedState === 'pending_settlement' ||
      rawOperation.settlementStatus === 'planned' ||
      rawOperation.settlementStatus === 'pending_settlement'
    ) {
      return failResult('failure', 'INVALID_REFS', 'Realocação entre categorias exige confirmação efetiva.', state);
    }
    const fromCat =
      rawOperation.sourceRef?.type === 'category'
        ? resolveCanonicalReinforcementCategory(rawOperation.sourceRef?.id)
        : null;
    const toCat =
      rawOperation.targetRef?.type === 'category'
        ? resolveCanonicalReinforcementCategory(rawOperation.targetRef?.id)
        : null;
    if (!fromCat || !toCat || fromCat === toCat) {
      return failResult(
        'failure',
        'INVALID_REFS',
        'Realocação exige duas categorias canônicas distintas de origem e destino.',
        state
      );
    }
    const resolvedCompetence = rawOperation.competence || dateStr.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(resolvedCompetence)) {
      return failResult('failure', 'INVALID_DATE', `Competência inválida para realocação: "${resolvedCompetence}".`, state);
    }
  } else {
    // EXPENSE_RECORD / INCOME_RECORD / MONTHLY_GUIDE_ITEM / MONTHLY_GUIDE_EXECUTION
    if (!rawOperation.sourceRef?.type || !rawOperation.sourceRef?.id?.trim() || !rawOperation.targetRef?.type || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Operação financeira requer sourceRef e targetRef válidos.', state);
    }
    if (
      rawOperation.type === 'EXPENSE_RECORD' &&
      rawOperation.sourceRef.type === 'piggy_bank' &&
      resolvedState !== 'planned' &&
      resolvedState !== 'pending_settlement'
    ) {
      const goalInfo = findGoal(rawOperation.sourceRef.id);
      if (goalInfo.exists) {
        const prevLib = goalInfo.piggy?.liberatedReservedCents ?? goalInfo.coupleGoal?.liberatedReservedCents ?? 0;
        if (prevLib > 0) {
          const consumedLib = Math.min(prevLib, money.amountCents);
          applyGoalCentsUpdate(rawOperation.sourceRef.id, {
            accumulatedDeltaCents: 0,
            committedDeltaCents: 0,
            utilizedDeltaCents: 0,
            contributionDeltaCents: 0,
            costBasisDeltaCents: 0,
            liberatedDeltaCents: -consumedLib,
          });
          opValuationMeta = {
            ...opValuationMeta,
            postValuationCents: consumedLib,
          };
        }
      }
    }
  }

  const persistedOp: FinancialOperationRecord = {
    ...rawOperation,
    ...opValuationMeta,
    amountCents: money.amountCents,
    amountR$: money.amountR$,
    authorizedBy,
    authoredByUid: rawOperation.authoredByUid || authorizedBy,
    scope: rawOperation.scope ? normalizeCommandScope(rawOperation.scope) : 'couple',
    competence: rawOperation.competence || dateStr.slice(0, 7),
    occurredAt,
    confirmedAt: nowIso,
    state: resolvedState,
    revision: rawOperation.revision ?? 1,
    commandFingerprint: normalizedFingerprint,
    createdAt: rawOperation.createdAt || nowIso,
  };

  const nextState: AppState = {
    ...state,
    financialOperations: [...nextFinancialOperations, persistedOp],
    piggyBanks: nextPiggyBanks,
    coupleGoals: nextCoupleGoals,
    linkedAccounts: nextLinkedAccounts,
    protectionCurrentAmount: nextProtAmount,
    protectionTotalInvested: nextProtInvested,
    ...(state.protectionYieldAccumulated !== undefined || touched.protectionUpdated
      ? { protectionYieldAccumulated: nextProtYield }
      : {}),
    isProtectionComplete: nextProtComplete,
    ...(state.freedomTotalInvested !== undefined || touched.freedomUpdated
      ? { freedomTotalInvested: nextFreeInvested }
      : {}),
    ...(state.freedomYieldAccumulated !== undefined || touched.freedomUpdated
      ? { freedomYieldAccumulated: nextFreeYield }
      : {}),
  };

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Operação executada com integridade.',
    state: nextState,
    operation: persistedOp,
    touchedEntities: touched,
  };
}

/**
 * Backward-compatible wrapper that throws descriptive Errors on conflict/failure.
 */
export function executeFinancialOperation(
  state: AppState,
  operation: FinancialOperationRecord & { amount?: number },
  options?: RunFinancialCommandOptions
): AppState {
  const result = runFinancialCommand(state, operation, options);
  if (result.status !== 'success') {
    throw new Error(result.message);
  }
  return result.state;
}

/**
 * Reverses a previously confirmed financial operation safely:
 * - Verifies original operation exists
 * - Rejects duplicate reversal (or returns idempotent replay if matching reversalOperationId)
 * - Checks target/source dependencies & non-negative balance invariants (never clamps negative)
 * - Restores piggyBanks + coupleGoals mirrors + protection reserve coherently
 */
export function reverseFinancialCommand(
  state: AppState,
  operationId: string,
  meta?: {
    reversalOperationId?: string;
    authoredByUid?: string;
    nowIso?: string;
    reserveFloorR$?: number;
    reserveFloorCents?: number;
    reason?: string;
  }
): FinancialCommandResult {
  const ops = state.financialOperations || [];
  const origIndex = ops.findIndex((op) => op.id === operationId);
  const original = origIndex >= 0 ? ops[origIndex] : undefined;
  if (!original) {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Operação original "${operationId}" não encontrada para estorno.`, state);
  }

  if (original.state === 'reverted' || original.state === 'estornado') {
    if (meta?.reversalOperationId && original.revertedBy === meta.reversalOperationId) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Estorno já registrado anteriormente (replay idempotente).',
        state,
        operation: original,
        idempotentReplay: true,
      };
    }
    return failResult('conflict', 'CONFLICT_ALREADY_REVERTED', `Operação "${operationId}" já foi estornada anteriormente.`, state, original);
  }

  const amountCents = readOperationAmountCents(original);
  if (amountCents <= 0) {
    return failResult('failure', 'INVALID_AMOUNT', `Operação "${operationId}" possui valor inválido para estorno.`, state, original);
  }

  const assetKey = (ref?: { type?: string; id?: string }): string | null => {
    if (!ref?.type) return null;
    if (ref.type === 'piggy_bank' && ref.id) return `piggy_bank:${ref.id}`;
    if (ref.type === 'protection' || ref.type === 'reserve') return 'protection';
    if (ref.type === 'freedom') return 'freedom';
    return null;
  };

  // Dependency check: reject reversing an inbound/init/positive-valuation operation
  // if a subsequent active operation consumed, withdrew, transferred, or adjusted that same asset.
  const creditedAssetKey = (() => {
    if (original.type === 'GOAL_DEPOSIT' || original.type === 'INITIAL_POSITION' || original.type === 'GOAL_TRANSFER' || original.type === 'BLOCK_TRANSFER') {
      return assetKey(original.targetRef);
    }
    if (original.type === 'VALUATION_ADJUSTMENT' && (original.signedDeltaCents ?? (original.valuationDirection === 'loss' ? -1 : 1)) > 0) {
      return assetKey(original.targetRef);
    }
    return null;
  })();

  if (creditedAssetKey) {
    const dependentOp = ops.slice(origIndex + 1).find((laterOp) => {
      if (laterOp.state === 'reverted' || laterOp.state === 'estornado') return false;
      const touchesSource =
        (laterOp.type === 'GOAL_WITHDRAWAL' ||
          laterOp.type === 'GOAL_TRANSFER' ||
          laterOp.type === 'BLOCK_TRANSFER' ||
          laterOp.type === 'GOAL_DIRECT_PURCHASE' ||
          laterOp.type === 'CATEGORY_REINFORCEMENT') &&
        assetKey(laterOp.sourceRef) === creditedAssetKey;
      const touchesValuation = laterOp.type === 'VALUATION_ADJUSTMENT' && assetKey(laterOp.targetRef) === creditedAssetKey;
      return touchesSource || touchesValuation;
    });
    if (dependentOp) {
      return failResult(
        'failure',
        'REVERSAL_DEPENDENCY_ERROR',
        `Estorno bloqueado: a operação "${dependentOp.id}" (${dependentOp.type}) dependeu do saldo desta operação.`,
        state,
        original
      );
    }
  }

  const nowIso = meta?.nowIso || new Date().toISOString();
  const reversalId = meta?.reversalOperationId || `rev-${operationId}`;
  const touched: FinancialCommandTouchedEntities = {
    financialOperations: [operationId],
  };

  let nextPiggyBanks = [...(state.piggyBanks || [])];
  let nextCoupleGoals = [...(state.coupleGoals || [])];
  const nextLinkedAccounts = [...(state.linkedAccounts || [])];
  const nextBankTransactions = [...(state.bankImportedTransactions || [])];
  let nextProtAmount = state.protectionCurrentAmount || 0;
  let nextProtInvested = state.protectionTotalInvested ?? nextProtAmount;
  let nextProtYield =
    state.protectionYieldAccumulated ?? roundMoneyCentsCompatible(nextProtAmount - nextProtInvested);
  let nextProtComplete = Boolean(state.isProtectionComplete);
  let nextFreeInvested = state.freedomTotalInvested || 0;
  let nextFreeYield = state.freedomYieldAccumulated || 0;

  const findGoal = (goalId: string) => {
    const piggy = nextPiggyBanks.find((p) => p.id === goalId);
    const coupleGoal = nextCoupleGoals.find((g) => g.id === goalId);
    if (!piggy && !coupleGoal) return { exists: false as const };
    if (piggy?.isDeleted || coupleGoal?.isDeleted) return { exists: false as const };
    const currentEntity = piggy || coupleGoal!;
    const availCents = getGoalAvailableCents(currentEntity);
    const rawInvested = piggy?.totalInvested ?? coupleGoal?.totalInvested;
    const costCents = isValidFiniteNumber(rawInvested) ? Math.round(rawInvested * 100) : availCents;
    return {
      exists: true as const,
      piggy,
      coupleGoal,
      revision: currentEntity.revision ?? 0,
      availableCents: availCents,
      accumulatedCents: getGoalAccumulatedCents(currentEntity),
      committedCents: isValidFiniteNumber(currentEntity.committedCents) ? Math.round(currentEntity.committedCents) : 0,
      utilizedCents: isValidFiniteNumber(currentEntity.utilizedCents) ? Math.round(currentEntity.utilizedCents) : 0,
      liberatedReservedCents: isValidFiniteNumber(currentEntity.liberatedReservedCents) ? Math.round(currentEntity.liberatedReservedCents) : 0,
      uncoveredDivergenceCents: isValidFiniteNumber(currentEntity.uncoveredDivergenceCents) ? Math.round(currentEntity.uncoveredDivergenceCents) : 0,
      costCents,
    };
  };

  const applyGoalReversalDelta = (
    goalId: string,
    delta: {
      accumulatedDeltaCents: number;
      committedDeltaCents: number;
      utilizedDeltaCents: number;
      contributionDeltaCents: number;
      costBasisDeltaCents?: number;
      liberatedDeltaCents?: number;
      uncoveredDivergenceDeltaCents?: number;
    }
  ) => {
    const info = findGoal(goalId);
    if (!info.exists) return;

    const newAccumulated = info.accumulatedCents + delta.accumulatedDeltaCents;
    const newCommitted = Math.max(0, info.committedCents + delta.committedDeltaCents);
    const newUtilized = Math.max(0, info.utilizedCents + delta.utilizedDeltaCents);
    const newAvailable = newAccumulated - newCommitted - newUtilized;
    const newAmountR$ = newAvailable / 100;
    const nextRevision = info.revision + 1;

    const hasExplicitCostTracking =
      info.piggy?.totalInvested !== undefined ||
      info.coupleGoal?.totalInvested !== undefined ||
      delta.costBasisDeltaCents !== undefined;
    const nextCostCents = Math.max(0, info.costCents + (delta.costBasisDeltaCents ?? delta.accumulatedDeltaCents));
    const nextYieldCents = newAvailable - nextCostCents;
    const nextLiberated = Math.max(0, info.liberatedReservedCents + (delta.liberatedDeltaCents ?? 0));
    const nextDivergence = Math.max(0, info.uncoveredDivergenceCents + (delta.uncoveredDivergenceDeltaCents ?? 0));

    if (info.piggy) {
      const targetCents = Math.round((info.piggy.targetAmount || 0) * 100);
      nextPiggyBanks = nextPiggyBanks.map((p) => {
        if (p.id !== goalId) return p;
        return {
          ...p,
          currentAmount: newAmountR$,
          accumulatedCents: newAccumulated,
          committedCents: newCommitted,
          utilizedCents: newUtilized,
          availableCents: newAvailable,
          ...(nextLiberated > 0 || p.liberatedReservedCents !== undefined ? { liberatedReservedCents: nextLiberated } : {}),
          ...(nextDivergence > 0 || p.uncoveredDivergenceCents !== undefined ? { uncoveredDivergenceCents: nextDivergence } : {}),
          ...(hasExplicitCostTracking
            ? {
                totalInvested: nextCostCents / 100,
                yieldAccumulated: nextYieldCents / 100,
              }
            : {}),
          completed: targetCents > 0 ? newAvailable >= targetCents : p.completed,
          revision: nextRevision,
          lastOperationId: reversalId,
        };
      });
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), goalId]));
    }

    if (info.coupleGoal) {
      const targetCents = Math.round((info.coupleGoal.targetAmount || 0) * 100);
      const agreement = info.coupleGoal.coupleAgreement;
      let p1Delta = 0;
      let p2Delta = 0;
      if (delta.contributionDeltaCents !== 0) {
        if (original.authorizedBy === 'partner1') p1Delta = delta.contributionDeltaCents;
        else if (original.authorizedBy === 'partner2') p2Delta = delta.contributionDeltaCents;
        else if (agreement) {
          p1Delta = Math.round((delta.contributionDeltaCents * (agreement.partner1SharePct || 0)) / 100);
          p2Delta = delta.contributionDeltaCents - p1Delta;
        }
      }
      nextCoupleGoals = nextCoupleGoals.map((g) => {
        if (g.id !== goalId) return g;
        const nextP1 = Math.max(0, Math.round((g.partner1Contribution || 0) * 100) + p1Delta);
        const nextP2 = Math.max(0, Math.round((g.partner2Contribution || 0) * 100) + p2Delta);
        return {
          ...g,
          currentAmount: newAmountR$,
          accumulatedCents: newAccumulated,
          committedCents: newCommitted,
          utilizedCents: newUtilized,
          availableCents: newAvailable,
          ...(nextLiberated > 0 || g.liberatedReservedCents !== undefined ? { liberatedReservedCents: nextLiberated } : {}),
          ...(nextDivergence > 0 || g.uncoveredDivergenceCents !== undefined ? { uncoveredDivergenceCents: nextDivergence } : {}),
          ...(hasExplicitCostTracking
            ? {
                totalInvested: nextCostCents / 100,
                yieldAccumulated: nextYieldCents / 100,
              }
            : {}),
          partner1Contribution: nextP1 / 100,
          partner2Contribution: nextP2 / 100,
          isCompleted: targetCents > 0 ? newAvailable >= targetCents : g.isCompleted,
          history: (g.history || []).filter((h) => h.id !== `hist-${operationId}`),
          revision: nextRevision,
          lastOperationId: reversalId,
        };
      });
      touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), goalId]));
    }
  };

  if (original.type === 'GOAL_DEPOSIT' || original.type === 'INITIAL_POSITION') {
    const tType = original.targetRef?.type;
    const valToReverse = original.type === 'INITIAL_POSITION' ? (original.postValuationCents ?? amountCents) : amountCents;
    const costToReverse = original.costBasisCents ?? valToReverse;

    if (tType === 'protection' || tType === 'reserve') {
      const curVal = Math.round(nextProtAmount * 100);
      if (curVal < valToReverse) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Saldo insuficiente na Proteção para estorno.', state);
      }
      const postVal = curVal - valToReverse;
      const postCost = Math.max(0, Math.round(nextProtInvested * 100) - costToReverse);
      const floorCents =
        meta?.reserveFloorCents !== undefined
          ? Math.round(meta.reserveFloorCents)
          : Math.round((meta?.reserveFloorR$ ?? 0) * 100);
      nextProtAmount = postVal / 100;
      nextProtInvested = postCost / 100;
      nextProtYield = (postVal - postCost) / 100;
      if (floorCents > 0) nextProtComplete = postVal >= floorCents;
      touched.protectionUpdated = true;
    } else if (tType === 'freedom') {
      const curCost = Math.round(nextFreeInvested * 100);
      const curYield = Math.round(nextFreeYield * 100);
      const curVal = curCost + curYield;
      if (curVal < valToReverse) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Saldo insuficiente na Liberdade para estorno.', state);
      }
      const postVal = curVal - valToReverse;
      const postCost = Math.max(0, curCost - costToReverse);
      nextFreeInvested = postCost / 100;
      nextFreeYield = (postVal - postCost) / 100;
      touched.freedomUpdated = true;
    } else {
      const goalId = original.targetRef?.id;
      if (!goalId) {
        return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Operação sem destino vinculado.', state);
      }
      const info = findGoal(goalId);
      if (!info.exists) {
        return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', `Meta "${goalId}" não existe mais para estorno.`, state);
      }
      if (info.availableCents < valToReverse) {
        return failResult(
          'failure',
          'INSUFFICIENT_FUNDS',
          `Estorno bloqueado: saldo disponível em "${goalId}" (R$ ${(info.availableCents / 100).toFixed(2)}) é menor que R$ ${(valToReverse / 100).toFixed(2)}.`,
          state
        );
      }
      applyGoalReversalDelta(goalId, {
        accumulatedDeltaCents: -valToReverse,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: -costToReverse,
        costBasisDeltaCents: -costToReverse,
      });
    }
  } else if (original.type === 'GOAL_WITHDRAWAL') {
    const downstreamOp = ops.slice(origIndex + 1).find(
      (laterOp) =>
        laterOp.state !== 'reverted' &&
        laterOp.state !== 'estornado' &&
        laterOp.sourceOperationId === original.id
    );
    if (downstreamOp) {
      return failResult(
        'failure',
        'REVERSAL_DEPENDENCY_ERROR',
        `Estorno bloqueado: a operação "${downstreamOp.id}" (${downstreamOp.type}) já consumiu o saldo liberado por este resgate.`,
        state,
        original
      );
    }
    const downstreamExp = (state.expenses || []).find((e) => e.operationId === original.id);
    if (downstreamExp) {
      return failResult(
        'failure',
        'REVERSAL_DEPENDENCY_ERROR',
        `Estorno bloqueado: a despesa "${downstreamExp.description}" já consumiu o saldo liberado por este resgate.`,
        state,
        original
      );
    }
    const consumedPartition = (original.partitions || []).find((p) => (p.consumedCents || 0) > 0);
    if (consumedPartition) {
      return failResult(
        'failure',
        'REVERSAL_DEPENDENCY_ERROR',
        `Estorno bloqueado: a partição "${consumedPartition.targetLabel || consumedPartition.targetType}" já teve consumo registrado.`,
        state,
        original
      );
    }

    const origGrossCents = original.grossAmountCents ?? amountCents;
    const origNetCents = original.netAmountCents ?? amountCents;
    const origDivergenceCents = original.planningDivergenceCents ?? 0;
    const actualDebitedCents = Math.max(0, origGrossCents - origDivergenceCents);
    const channel: 'virtual_reallocation' | 'asset_redemption' = original.withdrawalChannel || 'asset_redemption';
    const origEarmarkedCents =
      original.partitions && original.partitions.length > 0
        ? original.partitions.reduce((s, p) => s + (p.targetType !== 'cash_free' ? p.amountCents : 0), 0)
        : channel === 'virtual_reallocation' || original.targetRef?.type === 'category'
        ? origNetCents
        : 0;

    if (original.state === 'planned') {
      // Operação apenas planejada: não alterou saldo nem caixa
    } else if (original.state === 'pending_settlement') {
      if (original.sourceRef?.type === 'piggy_bank' && original.sourceRef?.id) {
        const info = findGoal(original.sourceRef.id);
        if (info.exists && info.committedCents > 0) {
          const releaseLockCents = Math.min(origGrossCents, info.committedCents);
          applyGoalReversalDelta(original.sourceRef.id, {
            accumulatedDeltaCents: 0,
            committedDeltaCents: -releaseLockCents,
            utilizedDeltaCents: 0,
            contributionDeltaCents: 0,
            costBasisDeltaCents: 0,
          });
        }
      }
    } else {
      const sType = original.sourceRef?.type;
      const costToRestore = original.costBasisCents ?? actualDebitedCents;
      if (sType === 'protection' || sType === 'reserve') {
        const postVal = Math.round(nextProtAmount * 100) + actualDebitedCents;
        const postCost = Math.round(nextProtInvested * 100) + costToRestore;
        const floorCents =
          meta?.reserveFloorCents !== undefined
            ? Math.round(meta.reserveFloorCents)
            : Math.round((meta?.reserveFloorR$ ?? 0) * 100);
        nextProtAmount = postVal / 100;
        nextProtInvested = postCost / 100;
        nextProtYield = (postVal - postCost) / 100;
        if (floorCents > 0) nextProtComplete = postVal >= floorCents;
        touched.protectionUpdated = true;
      } else if (sType === 'freedom') {
        const curCost = Math.round(nextFreeInvested * 100);
        const curYield = Math.round(nextFreeYield * 100);
        const postVal = curCost + curYield + actualDebitedCents;
        const postCost = curCost + costToRestore;
        nextFreeInvested = postCost / 100;
        nextFreeYield = (postVal - postCost) / 100;
        touched.freedomUpdated = true;
      } else {
        const goalId = original.sourceRef?.id;
        if (!goalId) {
          return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Operação de resgate sem origem vinculada.', state);
        }
        const info = findGoal(goalId);
        if (!info.exists) {
          return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', `Meta "${goalId}" não existe mais para estorno do resgate.`, state);
        }
        if (origEarmarkedCents > 0 && info.liberatedReservedCents < origEarmarkedCents) {
          return failResult(
            'failure',
            'REVERSAL_DEPENDENCY_ERROR',
            `Estorno bloqueado: parte do saldo liberado por este resgate em "${goalId}" já foi utilizada em finalidade posterior.`,
            state,
            original
          );
        }
        applyGoalReversalDelta(goalId, {
          accumulatedDeltaCents: actualDebitedCents,
          committedDeltaCents: 0,
          utilizedDeltaCents: 0,
          contributionDeltaCents: actualDebitedCents,
          costBasisDeltaCents: costToRestore,
          liberatedDeltaCents: -origEarmarkedCents,
          uncoveredDivergenceDeltaCents: -origDivergenceCents,
        });
      }

      if (channel === 'asset_redemption' && original.destinationAccountId && origNetCents > 0) {
        const accIdx = nextLinkedAccounts.findIndex(
          (a) => a.id === original.destinationAccountId || a.canonicalAccountId === original.destinationAccountId
        );
        if (accIdx >= 0 && nextLinkedAccounts[accIdx].accountType !== 'cartao') {
          const curBalCents = Math.round((nextLinkedAccounts[accIdx].balance || 0) * 100);
          nextLinkedAccounts[accIdx] = {
            ...nextLinkedAccounts[accIdx],
            balance: (curBalCents - origNetCents) / 100,
            revision: (nextLinkedAccounts[accIdx].revision ?? 0) + 1,
            lastOperationId: reversalId,
          };
          touched.linkedAccounts = Array.from(new Set([...(touched.linkedAccounts || []), nextLinkedAccounts[accIdx].id]));
        }
      }
    }

    if (original.bankTransactionId) {
      const txIdx = nextBankTransactions.findIndex((t) => t.id === original.bankTransactionId);
      if (txIdx >= 0) {
        nextBankTransactions[txIdx] = {
          ...nextBankTransactions[txIdx],
          status: 'pending',
          reconciledOperationId: undefined,
        };
        touched.bankImportedTransactions = Array.from(
          new Set([...(touched.bankImportedTransactions || []), nextBankTransactions[txIdx].id])
        );
      }
    }
  } else if (original.type === 'VALUATION_ADJUSTMENT') {
    const signedDelta =
      original.signedDeltaCents ?? (original.valuationDirection === 'loss' ? -amountCents : amountCents);
    const reverseDelta = -signedDelta;
    const tType = original.targetRef?.type;
    if (tType === 'protection' || tType === 'reserve') {
      const postVal = Math.round(nextProtAmount * 100) + reverseDelta;
      if (postVal < 0) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Estorno deixaria Proteção negativa.', state);
      }
      nextProtAmount = postVal / 100;
      nextProtYield = (postVal - Math.round(nextProtInvested * 100)) / 100;
      touched.protectionUpdated = true;
    } else if (tType === 'freedom') {
      const curCost = Math.round(nextFreeInvested * 100);
      const postVal = curCost + Math.round(nextFreeYield * 100) + reverseDelta;
      if (postVal < 0) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Estorno deixaria Liberdade negativa.', state);
      }
      nextFreeYield = (postVal - curCost) / 100;
      touched.freedomUpdated = true;
    } else {
      const goalId = original.targetRef?.id;
      const info = goalId ? findGoal(goalId) : { exists: false as const };
      if (!goalId || !info.exists) {
        return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta ausente para estorno de avaliação.', state);
      }
      if (info.availableCents + reverseDelta < 0) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Estorno deixaria meta com saldo negativo.', state);
      }
      applyGoalReversalDelta(goalId, {
        accumulatedDeltaCents: reverseDelta,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
      });
    }
  } else if (original.type === 'GOAL_DIRECT_PURCHASE') {
    if (original.sourceRef?.type === 'piggy_bank') {
      const goalId = original.sourceRef.id;
      const info = findGoal(goalId);
      if (!info.exists) {
        return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', `Meta "${goalId}" não existe mais para estorno.`, state);
      }
      applyGoalReversalDelta(goalId, {
        accumulatedDeltaCents: 0,
        committedDeltaCents: 0,
        utilizedDeltaCents: -amountCents,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
      });
    } else if (original.sourceRef?.type === 'reserve' || original.sourceRef?.type === 'protection') {
      const floorCents =
        meta?.reserveFloorCents !== undefined
          ? Math.round(meta.reserveFloorCents)
          : Math.round((meta?.reserveFloorR$ ?? 0) * 100);
      const nextProtCents = Math.round((state.protectionCurrentAmount || 0) * 100) + amountCents;
      const nextInvestedCents = Math.round((state.protectionTotalInvested ?? state.protectionCurrentAmount ?? 0) * 100) + amountCents;
      nextProtAmount = nextProtCents / 100;
      nextProtInvested = nextInvestedCents / 100;
      nextProtYield = (nextProtCents - nextInvestedCents) / 100;
      nextProtComplete = floorCents > 0 ? nextProtCents >= floorCents : state.isProtectionComplete;
      touched.protectionUpdated = true;
    }
  } else if (original.type === 'CATEGORY_REINFORCEMENT') {
    if (original.sourceOperationId) {
      const wIdx = nextFinancialOperations.findIndex((o) => o.id === original.sourceOperationId);
      if (wIdx >= 0) {
        const wOp = nextFinancialOperations[wIdx];
        if (wOp.partitions && wOp.partitions.length > 0) {
          let toRestore = amountCents;
          const nextPartitions = wOp.partitions.map((p) => {
            if (toRestore <= 0) return { ...p };
            const consumed = p.consumedCents || 0;
            const takeBack = Math.min(consumed, toRestore);
            toRestore -= takeBack;
            return { ...p, consumedCents: consumed - takeBack };
          });
          const updatedW: FinancialOperationRecord = {
            ...wOp,
            partitions: nextPartitions,
            revision: (wOp.revision ?? 1) + 1,
          };
          updatedW.commandFingerprint = computeOperationFingerprint(updatedW, readOperationAmountCents(updatedW));
          nextFinancialOperations[wIdx] = updatedW;
          touched.financialOperations = Array.from(
            new Set([...(touched.financialOperations || []), wOp.id])
          );
        }
      }
      const restoredLib = original.postValuationCents ?? 0;
      const goalId = original.sourceRef?.id;
      if (restoredLib > 0 && goalId && findGoal(goalId).exists) {
        applyGoalReversalDelta(goalId, {
          accumulatedDeltaCents: 0,
          committedDeltaCents: 0,
          utilizedDeltaCents: 0,
          contributionDeltaCents: 0,
          costBasisDeltaCents: 0,
          liberatedDeltaCents: restoredLib,
        });
      }
    } else {
      const goalId = original.sourceRef?.id;
      if (!goalId || !findGoal(goalId).exists) {
        return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta de reforço ausente para estorno.', state);
      }
      applyGoalReversalDelta(goalId, {
        accumulatedDeltaCents: 0,
        committedDeltaCents: -amountCents,
        utilizedDeltaCents: 0,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
      });
    }
  } else if (original.type === 'CATEGORY_REALLOCATION') {
    // Realocação entre categorias é uma transferência interna de teto: o marcador estornado a exclui da matriz.
  } else if (original.type === 'EXPENSE_RECORD' && original.sourceRef?.type === 'piggy_bank' && original.sourceRef?.id) {
    const goalId = original.sourceRef.id;
    const restoredLib = original.postValuationCents ?? 0;
    if (restoredLib > 0 && findGoal(goalId).exists) {
      applyGoalReversalDelta(goalId, {
        accumulatedDeltaCents: 0,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: 0,
        costBasisDeltaCents: 0,
        liberatedDeltaCents: restoredLib,
      });
    }
  } else if (original.type === 'GOAL_TRANSFER' || original.type === 'BLOCK_TRANSFER') {
    const srcType = original.sourceRef?.type;
    const dstType = original.targetRef?.type;
    const sourceId = original.sourceRef?.id;
    const targetId = original.targetRef?.id;
    const restoredSrcCost = original.costBasisCents ?? amountCents;

    if (!srcType || !dstType || !sourceId || !targetId) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Transferência sem referências válidas.', state);
    }

    // Validate destination has enough balance to return
    if (dstType === 'piggy_bank') {
      const targetInfo = findGoal(targetId);
      if (!targetInfo.exists) return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta de destino ausente para estorno.', state);
      if (targetInfo.availableCents < amountCents) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', `Estorno de transferência bloqueado: saldo insuficiente em "${targetId}".`, state);
      }
      applyGoalReversalDelta(targetId, {
        accumulatedDeltaCents: -amountCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: -amountCents,
        costBasisDeltaCents: -amountCents,
      });
    } else if (dstType === 'protection' || dstType === 'reserve') {
      const dstVal = Math.round(nextProtAmount * 100);
      if (dstVal < amountCents) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Estorno bloqueado: saldo insuficiente na Proteção.', state);
      }
      const postVal = dstVal - amountCents;
      const postCost = Math.max(0, Math.round(nextProtInvested * 100) - amountCents);
      nextProtAmount = postVal / 100;
      nextProtInvested = postCost / 100;
      nextProtYield = (postVal - postCost) / 100;
      touched.protectionUpdated = true;
    } else if (dstType === 'freedom') {
      const curCost = Math.round(nextFreeInvested * 100);
      const curVal = curCost + Math.round(nextFreeYield * 100);
      if (curVal < amountCents) {
        return failResult('failure', 'INSUFFICIENT_FUNDS', 'Estorno bloqueado: saldo insuficiente na Liberdade.', state);
      }
      const postVal = curVal - amountCents;
      const postCost = Math.max(0, curCost - amountCents);
      nextFreeInvested = postCost / 100;
      nextFreeYield = (postVal - postCost) / 100;
      touched.freedomUpdated = true;
    }

    // Restore source
    if (srcType === 'piggy_bank') {
      const sourceInfo = findGoal(sourceId);
      if (!sourceInfo.exists) return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta de origem ausente para estorno.', state);
      applyGoalReversalDelta(sourceId, {
        accumulatedDeltaCents: amountCents,
        committedDeltaCents: 0,
        utilizedDeltaCents: 0,
        contributionDeltaCents: amountCents,
        costBasisDeltaCents: restoredSrcCost,
      });
    } else if (srcType === 'protection' || srcType === 'reserve') {
      const postVal = Math.round(nextProtAmount * 100) + amountCents;
      const postCost = Math.round(nextProtInvested * 100) + restoredSrcCost;
      nextProtAmount = postVal / 100;
      nextProtInvested = postCost / 100;
      nextProtYield = (postVal - postCost) / 100;
      touched.protectionUpdated = true;
    } else if (srcType === 'freedom') {
      const curCost = Math.round(nextFreeInvested * 100);
      const curVal = curCost + Math.round(nextFreeYield * 100);
      const postVal = curVal + amountCents;
      const postCost = curCost + restoredSrcCost;
      nextFreeInvested = postCost / 100;
      nextFreeYield = (postVal - postCost) / 100;
      touched.freedomUpdated = true;
    }
  }

  const revertedOriginal: FinancialOperationRecord = {
    ...original,
    state: 'reverted',
    revertedBy: reversalId,
    reversedAt: nowIso,
    revision: (original.revision ?? 1) + 1,
    notes: meta?.reason ? `${original.notes ? original.notes + ' | ' : ''}Estornado: ${meta.reason}` : original.notes,
  };

  const nextState: AppState = {
    ...state,
    financialOperations: ops.map((op) => (op.id === operationId ? revertedOriginal : op)),
    piggyBanks: nextPiggyBanks,
    coupleGoals: nextCoupleGoals,
    linkedAccounts: nextLinkedAccounts,
    ...(state.bankImportedTransactions || touched.bankImportedTransactions
      ? { bankImportedTransactions: nextBankTransactions }
      : {}),
    protectionCurrentAmount: nextProtAmount,
    protectionTotalInvested: nextProtInvested,
    ...(state.protectionYieldAccumulated !== undefined || touched.protectionUpdated
      ? { protectionYieldAccumulated: nextProtYield }
      : {}),
    isProtectionComplete: nextProtComplete,
    ...(state.freedomTotalInvested !== undefined || touched.freedomUpdated
      ? { freedomTotalInvested: nextFreeInvested }
      : {}),
    ...(state.freedomYieldAccumulated !== undefined || touched.freedomUpdated
      ? { freedomYieldAccumulated: nextFreeYield }
      : {}),
  };

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Estorno executado com integridade.',
    state: nextState,
    operation: revertedOriginal,
    touchedEntities: touched,
  };
}

// =========================================================================
// UNIFIED HIGH-LEVEL DOMAIN COMMANDS FOR FINANCE CONTEXT & UI ADAPTERS
// =========================================================================

function validateSplitsInCents(
  totalCents: number,
  splits: TransactionSplit[]
): { ok: true; splits: TransactionSplit[]; error?: never } | { ok: false; splits?: never; error: string } {
  let allocatedCents = 0;
  const normalized: TransactionSplit[] = splits.map((s, idx) => {
    const splitBoundary = normalizeMonetaryBoundary({ amountCents: s.amountCents, amount: s.amount });
    if (!splitBoundary.ok) {
      throw new Error(splitBoundary.error || 'Divisão com valor inválido.');
    }
    if (s.lineType === 'discount') {
      allocatedCents -= splitBoundary.amountCents;
    } else {
      allocatedCents += splitBoundary.amountCents;
    }
    return {
      ...s,
      id: s.id || `split-${Date.now()}-${idx}`,
      amountCents: splitBoundary.amountCents,
      amount: splitBoundary.amountR$,
    };
  });

  if (allocatedCents !== totalCents) {
    return {
      ok: false,
      error: `A soma das divisões (${(allocatedCents / 100).toFixed(2)}) difere do total (${(totalCents / 100).toFixed(2)}).`,
    };
  }
  return { ok: true, splits: normalized };
}

export interface ExpenseCommandContextOptions {
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  reserveFloorR$?: number;
  nowIso?: string;
  id?: string;
  operationId?: string;
  reconciliationRef?: string;
}

export function executeExpenseCreateCommand(
  state: AppState,
  expenseInput: Omit<ExpenseItem, 'id' | 'amount'> & { id?: string; amount?: number; amountCents?: number },
  options?: ExpenseCommandContextOptions
): FinancialCommandResult {
  const money = normalizeMonetaryBoundary({
    amountCents: expenseInput.amountCents,
    amount: expenseInput.amount,
  });
  if (!money.ok) {
    return failResult(
      'failure',
      money.reasonCode || 'INVALID_AMOUNT',
      'Informe um valor de despesa válido e maior que zero (até R$ 10.000.000).',
      state
    );
  }
  if (money.amountR$ > MAX_EXPENSE_REAIS) {
    return failResult('failure', 'INVALID_AMOUNT', 'Informe um valor de despesa válido e maior que zero (até R$ 10.000.000).', state);
  }

  const desc = (expenseInput.description || '').trim();
  if (!desc) {
    return failResult('failure', 'INVALID_REFS', 'Informe a descrição da despesa.', state);
  }

  const dateStr = expenseInput.date
    ? expenseInput.date
    : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return failResult('failure', 'INVALID_DATE', `Data civil inválida: "${dateStr}".`, state);
  }
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  if (!Number.isFinite(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== dateStr) {
    return failResult('failure', 'INVALID_DATE', `Data civil inválida: "${dateStr}".`, state);
  }

  let normalizedSplits: TransactionSplit[] | undefined;
  if (expenseInput.splits && expenseInput.splits.length > 0) {
    try {
      const splitCheck = validateSplitsInCents(money.amountCents, expenseInput.splits);
      if (!splitCheck.ok) {
        return failResult('failure', 'DIVERGENT_AMOUNTS', splitCheck.error || 'Divisões divergentes.', state);
      }
      normalizedSplits = splitCheck.splits;
    } catch (err: any) {
      return failResult('failure', 'INVALID_AMOUNT', err?.message || 'Divisões inválidas.', state);
    }
  }

  const expenseId = expenseInput.id || options?.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const existingExp = (state.expenses || []).find((e) => e.id === expenseId);
  if (existingExp) {
    const existingCents = isValidFiniteNumber(existingExp.amountCents)
      ? existingExp.amountCents
      : Math.round((existingExp.amount || 0) * 100);
    if (
      existingCents === money.amountCents &&
      existingExp.description === desc &&
      existingExp.date === dateStr &&
      (existingExp.fundingSource || 'month_budget') === (expenseInput.fundingSource || 'month_budget') &&
      existingExp.fundingGoalId === expenseInput.fundingGoalId
    ) {
      const linkedOp = existingExp.operationId
        ? (state.financialOperations || []).find((op) => op.id === existingExp.operationId)
        : undefined;
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Despesa já registrada (replay idempotente).',
        state,
        expense: existingExp,
        operation: linkedOp,
        idempotentReplay: true,
      };
    }
    return failResult('conflict', 'CONFLICT_PAYLOAD_MISMATCH', `Conflito: despesa "${expenseId}" já existe com dados distintos.`, state);
  }

  const fundingSource: FundingSourceType = expenseInput.fundingSource || 'month_budget';
  if (fundingSource === 'piggy_bank' && (!expenseInput.fundingGoalId || !expenseInput.fundingGoalId.trim())) {
    return failResult('failure', 'GOAL_NOT_FOUND', 'Selecione uma caixinha/meta válida para debitar esta compra.', state);
  }

  const exclusionReason =
    expenseInput.exclusionReason ||
    (fundingSource !== 'month_budget'
      ? 'asset_funding'
      : expenseInput.isExcludedFromMonthlyBudget
      ? 'manual'
      : undefined);
  const isExcluded = fundingSource !== 'month_budget' || !!expenseInput.isExcludedFromMonthlyBudget;

  const authoredByUid = options?.authoredByUid || expenseInput.authoredByUid || expenseInput.paidBy || 'both';
  const scope = options?.scope || 'couple';
  const nowIso = options?.nowIso || new Date().toISOString();
  const operationId =
    expenseInput.operationId ||
    options?.operationId ||
    (fundingSource === 'piggy_bank' || fundingSource === 'reserve_excess' ? `op-exp-${expenseId}` : undefined);

  let workingState = state;
  let recordedOp: FinancialOperationRecord | undefined;
  const touched: FinancialCommandTouchedEntities = {
    expenses: [expenseId],
  };

  if (fundingSource === 'piggy_bank' || fundingSource === 'reserve_excess') {
    const opRecord: FinancialOperationRecord = {
      id: operationId!,
      type: 'GOAL_DIRECT_PURCHASE',
      amountCents: money.amountCents,
      amountR$: money.amountR$,
      authorizedBy: expenseInput.paidBy || 'both',
      authoredByUid,
      scope,
      sourceRef:
        fundingSource === 'piggy_bank'
          ? { type: 'piggy_bank', id: expenseInput.fundingGoalId!, name: expenseInput.fundingGoalName }
          : { type: 'reserve', id: 'protection_reserve', name: 'Excesso da Reserva' },
      targetRef: { type: 'expense', id: expenseId, name: desc },
      competence: dateStr.slice(0, 7),
      date: dateStr,
      occurredAt: dateStr,
      confirmedAt: nowIso,
      state: options?.reconciliationRef ? 'reconciled' : 'occurred_manual',
      reconciliationRef: options?.reconciliationRef,
      expenseId,
      intentId: expenseInput.strategicIntentId,
      notes: `Compra: ${desc}`,
    };

    const opRes = runFinancialCommand(workingState, opRecord, {
      reserveFloorR$: options?.reserveFloorR$,
      nowIso,
      contributor: expenseInput.paidBy === 'partner1' ? 'partner1' : expenseInput.paidBy === 'partner2' ? 'partner2' : 'both',
    });
    if (opRes.status !== 'success') {
      return opRes;
    }
    workingState = opRes.state;
    recordedOp = opRes.operation;
    Object.assign(touched, opRes.touchedEntities);
    touched.expenses = [expenseId];
  }

  let resolvedGoalName = expenseInput.fundingGoalName;
  if (fundingSource === 'piggy_bank' && expenseInput.fundingGoalId && !resolvedGoalName) {
    const goal = workingState.piggyBanks.find((p) => p.id === expenseInput.fundingGoalId);
    resolvedGoalName = goal?.name;
  }

  const newExpense: ExpenseItem = {
    ...expenseInput,
    id: expenseId,
    description: desc,
    store: expenseInput.store?.trim(),
    amount: money.amountR$,
    amountCents: money.amountCents,
    date: dateStr,
    splits: normalizedSplits,
    fundingSource,
    fundingGoalId: fundingSource === 'piggy_bank' ? expenseInput.fundingGoalId : undefined,
    fundingGoalName: fundingSource === 'piggy_bank' ? resolvedGoalName : undefined,
    isExcludedFromMonthlyBudget: isExcluded,
    exclusionReason,
    triageDone: expenseInput.triageDone ?? (fundingSource !== 'month_budget'),
    operationId: recordedOp?.id,
    authoredByUid,
  };

  let nextIntents = workingState.strategicIntents || [];
  if (newExpense.strategicIntentId) {
    const matchedIntent = nextIntents.find((i) => i.id === newExpense.strategicIntentId);
    if (matchedIntent) {
      nextIntents = nextIntents.map((intent) =>
        intent.id === newExpense.strategicIntentId
          ? { ...intent, status: 'executed' as const, matchedExpenseId: newExpense.id }
          : intent
      );
      touched.strategicIntents = [newExpense.strategicIntentId];
    }
  }

  const nextState: AppState = {
    ...workingState,
    expenses: [newExpense, ...workingState.expenses],
    strategicIntents: nextIntents,
  };

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Despesa registrada com integridade.',
    state: nextState,
    expense: newExpense,
    operation: recordedOp,
    touchedEntities: touched,
  };
}

export function executeExpenseEditCommand(
  state: AppState,
  targetId: string,
  updates: Partial<ExpenseItem>,
  options?: ExpenseCommandContextOptions
): FinancialCommandResult {
  const currentOld = (state.expenses || []).find((e) => e.id === targetId);
  if (!currentOld) {
    return failResult('failure', 'EXPENSE_NOT_FOUND', `Despesa "${targetId}" não encontrada para edição.`, state);
  }

  const draftDesc = (updates.description !== undefined ? updates.description : currentOld.description).trim();
  if (!draftDesc) {
    return failResult('failure', 'INVALID_REFS', 'Informe a descrição da despesa.', state);
  }

  const hasUpdatedAmount = updates.amountCents !== undefined || updates.amount !== undefined;
  const amountCheck = hasUpdatedAmount
    ? normalizeMonetaryBoundary({ amountCents: updates.amountCents, amount: updates.amount })
    : normalizeMonetaryBoundary({ amountCents: currentOld.amountCents, amount: currentOld.amount });
  if (!amountCheck.ok || amountCheck.amountR$ > MAX_EXPENSE_REAIS) {
    return failResult('failure', 'INVALID_AMOUNT', 'Informe um valor de despesa válido e maior que zero (até R$ 10.000.000).', state);
  }

  const draftDate = updates.date !== undefined ? updates.date : currentOld.date;
  if (draftDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) {
      return failResult('failure', 'INVALID_DATE', `Data civil inválida: "${draftDate}".`, state);
    }
    const dObj = new Date(`${draftDate}T12:00:00Z`);
    if (!Number.isFinite(dObj.getTime()) || dObj.toISOString().slice(0, 10) !== draftDate) {
      return failResult('failure', 'INVALID_DATE', `Data civil inválida: "${draftDate}".`, state);
    }
  }

  let normalizedSplits = currentOld.splits;
  if (updates.splits !== undefined) {
    if (updates.splits && updates.splits.length > 0) {
      try {
        const splitCheck = validateSplitsInCents(amountCheck.amountCents, updates.splits);
        if (!splitCheck.ok) {
          return failResult('failure', 'DIVERGENT_AMOUNTS', splitCheck.error || 'Divisões divergentes.', state);
        }
        normalizedSplits = splitCheck.splits;
      } catch (err: any) {
        return failResult('failure', 'INVALID_AMOUNT', err?.message || 'Divisões inválidas.', state);
      }
    } else {
      normalizedSplits = undefined;
    }
  }

  const oldCents = isValidFiniteNumber(currentOld.amountCents)
    ? currentOld.amountCents
    : Math.round((currentOld.amount || 0) * 100);
  const oldSource: FundingSourceType = currentOld.fundingSource || 'month_budget';
  const newSource: FundingSourceType = updates.fundingSource !== undefined ? updates.fundingSource : oldSource;
  const newGoalId =
    newSource === 'piggy_bank'
      ? updates.fundingGoalId !== undefined
        ? updates.fundingGoalId
        : currentOld.fundingGoalId
      : undefined;

  if (newSource === 'piggy_bank' && (!newGoalId || !newGoalId.trim())) {
    return failResult('failure', 'GOAL_NOT_FOUND', 'Selecione uma caixinha/meta válida para esta despesa.', state);
  }

  const nowIso = options?.nowIso || new Date().toISOString();
  const fundingChanged =
    oldSource !== newSource ||
    (oldSource === 'piggy_bank' && currentOld.fundingGoalId !== newGoalId) ||
    ((oldSource === 'piggy_bank' || oldSource === 'reserve_excess') && oldCents !== amountCheck.amountCents);

  let workingState = state;
  const touched: FinancialCommandTouchedEntities = {
    expenses: [targetId],
  };
  const mergeTouched = (sub?: FinancialCommandTouchedEntities) => {
    if (!sub) return;
    if (sub.financialOperations) touched.financialOperations = Array.from(new Set([...(touched.financialOperations || []), ...sub.financialOperations]));
    if (sub.piggyBanks) touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), ...sub.piggyBanks]));
    if (sub.coupleGoals) touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), ...sub.coupleGoals]));
    if (sub.protectionUpdated) touched.protectionUpdated = true;
  };

  let nextOperationId = currentOld.operationId;
  let finalOp: FinancialOperationRecord | undefined;

  if (fundingChanged) {
    // 1. Reverse previous asset funding cleanly
    if (currentOld.operationId && (workingState.financialOperations || []).some((o) => o.id === currentOld.operationId && o.state !== 'reverted' && o.state !== 'estornado')) {
      const revRes = reverseFinancialCommand(workingState, currentOld.operationId, {
        nowIso,
        reserveFloorR$: options?.reserveFloorR$,
        authoredByUid: options?.authoredByUid,
        reason: 'Edição de despesa/fonte pagadora',
      });
      if (revRes.status !== 'success') {
        return failResult(revRes.status, revRes.reasonCode, revRes.message, state);
      }
      workingState = revRes.state;
      mergeTouched(revRes.touchedEntities);
    } else if (oldSource === 'reserve_excess') {
      const floorCents = Math.round((options?.reserveFloorR$ ?? 0) * 100);
      const nextProtCents = Math.round((workingState.protectionCurrentAmount || 0) * 100) + oldCents;
      const nextInvestedCents = Math.round((workingState.protectionTotalInvested || 0) * 100) + oldCents;
      workingState = {
        ...workingState,
        protectionCurrentAmount: nextProtCents / 100,
        protectionTotalInvested: nextInvestedCents / 100,
        isProtectionComplete: floorCents > 0 ? nextProtCents >= floorCents : workingState.isProtectionComplete,
      };
      touched.protectionUpdated = true;
    } else if (oldSource === 'piggy_bank' && currentOld.fundingGoalId) {
      const oldGoalId = currentOld.fundingGoalId;
      workingState = {
        ...workingState,
        piggyBanks: workingState.piggyBanks.map((g) => {
          if (g.id !== oldGoalId) return g;
          const availCents = getGoalAvailableCents(g) + oldCents;
          const accCents = getGoalAccumulatedCents(g);
          const nextUtilized = Math.max(0, (g.utilizedCents || 0) - oldCents);
          const targetCents = Math.round((g.targetAmount || 0) * 100);
          return {
            ...g,
            currentAmount: availCents / 100,
            availableCents: availCents,
            accumulatedCents: accCents,
            utilizedCents: nextUtilized,
            completed: targetCents > 0 ? availCents >= targetCents : g.completed,
            revision: (g.revision ?? 0) + 1,
          };
        }),
        coupleGoals: (workingState.coupleGoals || []).map((g) => {
          if (g.id !== oldGoalId) return g;
          const availCents = getGoalAvailableCents(g) + oldCents;
          const accCents = getGoalAccumulatedCents(g);
          const nextUtilized = Math.max(0, (g.utilizedCents || 0) - oldCents);
          const targetCents = Math.round((g.targetAmount || 0) * 100);
          return {
            ...g,
            currentAmount: availCents / 100,
            availableCents: availCents,
            accumulatedCents: accCents,
            utilizedCents: nextUtilized,
            isCompleted: targetCents > 0 ? availCents >= targetCents : g.isCompleted,
            revision: (g.revision ?? 0) + 1,
          };
        }),
      };
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), oldGoalId]));
      touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), oldGoalId]));
    }

    nextOperationId = undefined;

    // 2. Apply new asset funding on restored state
    if (newSource === 'piggy_bank' || newSource === 'reserve_excess') {
      const newOpId = options?.operationId || `op-exp-${targetId}-rev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const opRecord: FinancialOperationRecord = {
        id: newOpId,
        type: 'GOAL_DIRECT_PURCHASE',
        amountCents: amountCheck.amountCents,
        amountR$: amountCheck.amountR$,
        authorizedBy: updates.paidBy || currentOld.paidBy || 'both',
        authoredByUid: options?.authoredByUid || currentOld.authoredByUid || currentOld.paidBy || 'both',
        scope: options?.scope || 'couple',
        sourceRef:
          newSource === 'piggy_bank'
            ? { type: 'piggy_bank', id: newGoalId!, name: updates.fundingGoalName || currentOld.fundingGoalName }
            : { type: 'reserve', id: 'protection_reserve', name: 'Excesso da Reserva' },
        targetRef: { type: 'expense', id: targetId, name: draftDesc },
        competence: (draftDate || currentOld.date).slice(0, 7),
        date: draftDate || currentOld.date,
        occurredAt: draftDate || currentOld.date,
        confirmedAt: nowIso,
        state: options?.reconciliationRef ? 'reconciled' : 'occurred_manual',
        reconciliationRef: options?.reconciliationRef,
        expenseId: targetId,
        notes: `Edição de compra: ${draftDesc}`,
      };
      const opRes = runFinancialCommand(workingState, opRecord, {
        reserveFloorR$: options?.reserveFloorR$,
        nowIso,
        contributor: (updates.paidBy || currentOld.paidBy) === 'partner1' ? 'partner1' : (updates.paidBy || currentOld.paidBy) === 'partner2' ? 'partner2' : 'both',
      });
      if (opRes.status !== 'success') {
        // Abort cleanly returning original state (no orphaned reversal!)
        return failResult(opRes.status, opRes.reasonCode, opRes.message, state);
      }
      workingState = opRes.state;
      finalOp = opRes.operation;
      nextOperationId = newOpId;
      mergeTouched(opRes.touchedEntities);
    }
  }

  let exclusionReason = updates.exclusionReason;
  let isExcluded = updates.isExcludedFromMonthlyBudget;
  if (newSource !== 'month_budget') {
    isExcluded = true;
    exclusionReason = 'asset_funding';
  } else if (oldSource !== 'month_budget') {
    if (currentOld.exclusionReason === 'manual' || exclusionReason === 'manual') {
      isExcluded = true;
      exclusionReason = 'manual';
    } else {
      isExcluded = false;
      exclusionReason = undefined;
    }
  } else if (isExcluded === undefined) {
    isExcluded = currentOld.isExcludedFromMonthlyBudget;
    exclusionReason = currentOld.exclusionReason;
  }

  const goalName =
    newSource === 'piggy_bank'
      ? updates.fundingGoalName || workingState.piggyBanks.find((p) => p.id === newGoalId)?.name || currentOld.fundingGoalName
      : undefined;

  const updatedExpense: ExpenseItem = {
    ...currentOld,
    ...updates,
    id: targetId,
    description: draftDesc,
    store: updates.store !== undefined ? updates.store?.trim() : currentOld.store,
    amount: amountCheck.amountR$,
    amountCents: amountCheck.amountCents,
    date: draftDate || currentOld.date,
    splits: normalizedSplits,
    fundingSource: newSource,
    fundingGoalId: newGoalId,
    fundingGoalName: goalName,
    isExcludedFromMonthlyBudget: isExcluded,
    exclusionReason,
    operationId: nextOperationId,
  };

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Despesa atualizada com integridade.',
    state: {
      ...workingState,
      expenses: workingState.expenses.map((e) => (e.id === targetId ? updatedExpense : e)),
    },
    expense: updatedExpense,
    operation: finalOp,
    touchedEntities: touched,
  };
}

export function executeExpenseDeleteCommand(
  state: AppState,
  expenseId: string,
  options?: ExpenseCommandContextOptions
): FinancialCommandResult {
  const target = (state.expenses || []).find((e) => e.id === expenseId);
  if (!target) {
    return {
      status: 'success',
      reasonCode: 'IDEMPOTENT_REPLAY',
      message: 'Despesa já removida.',
      state,
      idempotentReplay: true,
    };
  }

  const nowIso = options?.nowIso || new Date().toISOString();
  let workingState = state;
  const touched: FinancialCommandTouchedEntities = {
    expenses: [expenseId],
  };

  let nextBills = workingState.coupleFixedBills || [];
  let nextLegacyBills = workingState.fixedBillAlerts;
  if (target.linkedBillId) {
    const compMonth = resolveExpenseCompetenceMonth(target);
    const reopenBillForMonth = (b: typeof nextBills[number]) => {
      if (b.id !== target.linkedBillId) return b;
      const history = { ...(b.history || {}) };
      if (compMonth) {
        delete history[compMonth];
      }
      const remainingPaidMonths = Object.entries(history)
        .filter(([, h]) => h?.status === 'paid')
        .map(([k]) => k)
        .sort();
      const nextLastPaid =
        remainingPaidMonths.length > 0
          ? remainingPaidMonths[remainingPaidMonths.length - 1]
          : b.lastPaidMonth === compMonth
          ? undefined
          : b.lastPaidMonth;
      return {
        ...b,
        status: (remainingPaidMonths.length > 0 ? 'paid' : 'pending') as 'paid' | 'pending',
        lastPaidMonth: nextLastPaid,
        history,
      };
    };
    nextBills = nextBills.map(reopenBillForMonth);
    if (Array.isArray(nextLegacyBills)) {
      nextLegacyBills = nextLegacyBills.map(reopenBillForMonth);
    }
    touched.coupleFixedBills = [target.linkedBillId];
  }

  const targetCents = isValidFiniteNumber(target.amountCents)
    ? target.amountCents
    : Math.round((target.amount || 0) * 100);

  if (target.operationId && (workingState.financialOperations || []).some((o) => o.id === target.operationId && o.state !== 'reverted' && o.state !== 'estornado')) {
    const revRes = reverseFinancialCommand(workingState, target.operationId, {
      nowIso,
      reserveFloorR$: options?.reserveFloorR$,
      authoredByUid: options?.authoredByUid,
      reason: 'Exclusão de despesa',
    });
    if (revRes.status !== 'success') {
      return failResult(revRes.status, revRes.reasonCode, revRes.message, state);
    }
    workingState = revRes.state;
    if (revRes.touchedEntities?.financialOperations) touched.financialOperations = revRes.touchedEntities.financialOperations;
    if (revRes.touchedEntities?.piggyBanks) touched.piggyBanks = revRes.touchedEntities.piggyBanks;
    if (revRes.touchedEntities?.coupleGoals) touched.coupleGoals = revRes.touchedEntities.coupleGoals;
    if (revRes.touchedEntities?.protectionUpdated) touched.protectionUpdated = true;
  } else if (target.fundingSource === 'reserve_excess') {
    const floorCents = Math.round((options?.reserveFloorR$ ?? 0) * 100);
    const nextProtCents = Math.round((workingState.protectionCurrentAmount || 0) * 100) + targetCents;
    const nextInvCents = Math.round((workingState.protectionTotalInvested || 0) * 100) + targetCents;
    workingState = {
      ...workingState,
      protectionCurrentAmount: nextProtCents / 100,
      protectionTotalInvested: nextInvCents / 100,
      isProtectionComplete: floorCents > 0 ? nextProtCents >= floorCents : workingState.isProtectionComplete,
    };
    touched.protectionUpdated = true;
  } else if (target.fundingSource === 'piggy_bank' && target.fundingGoalId) {
    const gId = target.fundingGoalId;
    workingState = {
      ...workingState,
      piggyBanks: workingState.piggyBanks.map((g) => {
        if (g.id !== gId) return g;
        const availCents = getGoalAvailableCents(g) + targetCents;
        const targetCentsGoal = Math.round((g.targetAmount || 0) * 100);
        return {
          ...g,
          currentAmount: availCents / 100,
          availableCents: availCents,
          utilizedCents: Math.max(0, (g.utilizedCents || 0) - targetCents),
          completed: targetCentsGoal > 0 ? availCents >= targetCentsGoal : g.completed,
          revision: (g.revision ?? 0) + 1,
        };
      }),
      coupleGoals: (workingState.coupleGoals || []).map((g) => {
        if (g.id !== gId) return g;
        const availCents = getGoalAvailableCents(g) + targetCents;
        const targetCentsGoal = Math.round((g.targetAmount || 0) * 100);
        return {
          ...g,
          currentAmount: availCents / 100,
          availableCents: availCents,
          utilizedCents: Math.max(0, (g.utilizedCents || 0) - targetCents),
          isCompleted: targetCentsGoal > 0 ? availCents >= targetCentsGoal : g.isCompleted,
          revision: (g.revision ?? 0) + 1,
        };
      }),
    };
    touched.piggyBanks = [gId];
    touched.coupleGoals = [gId];
  }

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Despesa excluída e saldos restaurados.',
    state: {
      ...workingState,
      expenses: workingState.expenses.filter((e) => e.id !== expenseId),
      coupleFixedBills: nextBills,
      ...(nextLegacyBills !== undefined ? { fixedBillAlerts: nextLegacyBills } : {}),
    },
    expense: target,
    touchedEntities: touched,
  };
}

export function executeReconcileIntentCommand(
  state: AppState,
  expenseId: string,
  intentId: string,
  options?: ExpenseCommandContextOptions
): FinancialCommandResult {
  const targetExp = (state.expenses || []).find((e) => e.id === expenseId);
  if (!targetExp) {
    return failResult('failure', 'EXPENSE_NOT_FOUND', `Despesa "${expenseId}" não encontrada para reconciliação.`, state);
  }
  const targetIntent = (state.strategicIntents || []).find((i) => i.id === intentId);
  if (!targetIntent) {
    return failResult('failure', 'INTENT_NOT_FOUND', `Intenção estratégica "${intentId}" não encontrada.`, state);
  }

  if (targetIntent.status === 'matched' || targetIntent.status === 'executed') {
    if (targetIntent.matchedExpenseId === expenseId && targetExp.strategicIntentId === intentId) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Intenção já reconciliada com esta despesa.',
        state,
        expense: targetExp,
        idempotentReplay: true,
      };
    }
    return failResult(
      'conflict',
      'CONFLICT_ALREADY_MATCHED',
      `Conflito: intenção "${targetIntent.title}" já foi reconciliada com outra despesa.`,
      state
    );
  }

  const fundingSource = targetIntent.targetSource;
  const isExcluded = fundingSource !== 'month_budget';

  const editRes = executeExpenseEditCommand(
    state,
    expenseId,
    {
      category: targetIntent.category,
      fundingSource,
      fundingGoalId: fundingSource === 'piggy_bank' ? targetIntent.targetGoalId : undefined,
      fundingGoalName: fundingSource === 'piggy_bank' ? targetIntent.targetGoalName : undefined,
      strategicIntentId: intentId,
      isExcludedFromMonthlyBudget: isExcluded,
      triageDone: true,
      reconciledWithIntent: true,
    },
    {
      ...options,
      reconciliationRef: options?.reconciliationRef || (targetExp.bankName ? `bank:${targetExp.id}` : undefined),
    }
  );
  if (editRes.status !== 'success') {
    return editRes;
  }

  const updatedIntents: StrategicSpendingIntent[] = (editRes.state.strategicIntents || []).map((i) =>
    i.id === intentId ? { ...i, status: 'matched' as const, matchedExpenseId: expenseId } : i
  );

  return {
    ...editRes,
    state: {
      ...editRes.state,
      strategicIntents: updatedIntents,
    },
    touchedEntities: {
      ...editRes.touchedEntities,
      strategicIntents: [intentId],
    },
  };
}

export function executeExpenseTriageCommand(
  state: AppState,
  expenseId: string,
  triageData: {
    assignedTo?: 'couple' | 'partner1' | 'partner2';
    paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
    fundingSource?: FundingSourceType;
    fundingGoalId?: string;
    fundingGoalName?: string;
    isExcludedFromMonthlyBudget?: boolean;
  },
  options?: ExpenseCommandContextOptions
): FinancialCommandResult {
  const targetExp = (state.expenses || []).find((e) => e.id === expenseId);
  if (!targetExp) {
    return failResult('failure', 'EXPENSE_NOT_FOUND', `Despesa "${expenseId}" não encontrada para triagem.`, state);
  }

  const newSource = triageData.fundingSource || targetExp.fundingSource || 'month_budget';
  const isExcluded = newSource !== 'month_budget';
  const paidBy: PaidBy =
    triageData.assignedTo === 'partner1'
      ? 'partner1'
      : triageData.assignedTo === 'partner2'
      ? 'partner2'
      : triageData.assignedTo === 'couple'
      ? 'both'
      : targetExp.paidBy;

  return executeExpenseEditCommand(
    state,
    expenseId,
    {
      ...triageData,
      fundingSource: newSource,
      fundingGoalId: newSource === 'piggy_bank' ? triageData.fundingGoalId : undefined,
      fundingGoalName: newSource === 'piggy_bank' ? triageData.fundingGoalName : undefined,
      isExcludedFromMonthlyBudget: isExcluded,
      triageDone: true,
      paidBy,
    },
    options
  );
}

export interface GoalAdjustmentCommandParams {
  goalId: string;
  targetType?: 'piggy_bank' | 'protection' | 'freedom';
  direction: 'deposit' | 'withdrawal';
  amount?: number;
  amountCents?: number;
  contributor?: 'partner1' | 'partner2' | 'both';
  note?: string;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  expectedRevision?: number;
  reconciliationRef?: string;
  completedGoalContributionConfirmed?: boolean;
  reserveFloorR$?: number;
  reserveFloorCents?: number;
  nowIso?: string;
}

export function executeGoalAdjustmentCommand(
  state: AppState,
  params: GoalAdjustmentCommandParams
): FinancialCommandResult {
  const money = normalizeMonetaryBoundary({ amountCents: params.amountCents, amount: params.amount });
  if (!money.ok) {
    return failResult('failure', money.reasonCode || 'INVALID_AMOUNT', money.error || 'Valor monetário inválido.', state);
  }

  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const nowIso = params.nowIso || new Date().toISOString();
  const contributor = params.contributor || 'both';
  const targetType = params.targetType || 'piggy_bank';
  const opId = params.operationId || `op-${params.direction}-${targetType}-${params.goalId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const assetLabel =
    targetType === 'protection'
      ? 'Bloco 1 · Reserva de Emergência'
      : targetType === 'freedom'
      ? 'Bloco 3 · Liberdade Financeira'
      : state.piggyBanks.find((p) => p.id === params.goalId)?.name || params.goalId;

  const op: FinancialOperationRecord = {
    id: opId,
    type: params.direction === 'deposit' ? 'GOAL_DEPOSIT' : 'GOAL_WITHDRAWAL',
    amountCents: money.amountCents,
    amountR$: money.amountR$,
    authorizedBy: contributor,
    authoredByUid: params.authoredByUid || contributor,
    scope: params.scope || 'couple',
    sourceRef:
      params.direction === 'deposit'
        ? { type: 'income', id: 'manual-aporte', name: 'Aporte manual' }
        : { type: targetType, id: params.goalId, name: assetLabel },
    targetRef:
      params.direction === 'deposit'
        ? { type: targetType, id: params.goalId, name: assetLabel }
        : { type: 'external', id: 'manual-resgate', name: 'Resgate manual' },
    competence: dateStr.slice(0, 7),
    date: dateStr,
    occurredAt: dateStr,
    confirmedAt: nowIso,
    expectedRevision: params.expectedRevision,
    state: params.reconciliationRef ? 'reconciled' : 'occurred_manual',
    reconciliationRef: params.reconciliationRef,
    completedGoalContributionConfirmed: params.completedGoalContributionConfirmed,
    notes: params.note,
  };

  return runFinancialCommand(state, op, {
    nowIso,
    contributor,
    reserveFloorR$: params.reserveFloorR$,
    reserveFloorCents: params.reserveFloorCents,
  });
}

export interface BlockTransferCommandParams {
  sourceType: 'piggy_bank' | 'protection' | 'freedom';
  sourceId: string;
  sourceName?: string;
  targetType: 'piggy_bank' | 'protection' | 'freedom';
  targetId: string;
  targetName?: string;
  amount?: number;
  amountCents?: number;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  note?: string;
  reserveFloorR$?: number;
  reserveFloorCents?: number;
  completedGoalContributionConfirmed?: boolean;
  nowIso?: string;
}

export function executeBlockTransferCommand(
  state: AppState,
  params: BlockTransferCommandParams
): FinancialCommandResult {
  const money = normalizeMonetaryBoundary({ amountCents: params.amountCents, amount: params.amount });
  if (!money.ok) {
    return failResult('failure', money.reasonCode || 'INVALID_AMOUNT', money.error || 'Valor monetário inválido.', state);
  }
  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const opId = params.operationId || `op-transfer-${params.sourceType}-${params.targetType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const opType = params.sourceType === 'piggy_bank' && params.targetType === 'piggy_bank' ? 'GOAL_TRANSFER' : 'BLOCK_TRANSFER';

  return runFinancialCommand(
    state,
    {
      id: opId,
      type: opType,
      amountCents: money.amountCents,
      amountR$: money.amountR$,
      authorizedBy: params.authoredByUid || 'both',
      authoredByUid: params.authoredByUid || 'both',
      scope: params.scope || 'couple',
      sourceRef: { type: params.sourceType, id: params.sourceId, name: params.sourceName },
      targetRef: { type: params.targetType, id: params.targetId, name: params.targetName },
      competence: dateStr.slice(0, 7),
      date: dateStr,
      occurredAt: dateStr,
      confirmedAt: nowIso,
      state: 'occurred_manual',
      completedGoalContributionConfirmed: params.completedGoalContributionConfirmed,
      notes: params.note || `Transferência entre blocos (${params.sourceName || params.sourceId} → ${params.targetName || params.targetId})`,
    },
    {
      nowIso,
      reserveFloorR$: params.reserveFloorR$,
      reserveFloorCents: params.reserveFloorCents,
    }
  );
}

export interface InitialPositionCommandParams {
  targetType: 'piggy_bank' | 'protection' | 'freedom';
  targetId: string;
  targetName?: string;
  costBasisR$?: number;
  costBasisCents?: number;
  currentValuationR$?: number;
  currentValuationCents?: number;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  note?: string;
  reserveFloorR$?: number;
  nowIso?: string;
}

export function executeInitialPositionCommand(
  state: AppState,
  params: InitialPositionCommandParams
): FinancialCommandResult {
  const valCheck = normalizeMonetaryBoundary({
    amountCents: params.currentValuationCents ?? params.costBasisCents,
    amount: params.currentValuationR$ ?? params.costBasisR$,
  });
  if (!valCheck.ok) {
    return failResult('failure', valCheck.reasonCode || 'INVALID_AMOUNT', valCheck.error || 'Valor de posição inicial inválido.', state);
  }
  const costCents =
    params.costBasisCents !== undefined
      ? params.costBasisCents
      : params.costBasisR$ !== undefined
      ? Math.round(params.costBasisR$ * 100)
      : valCheck.amountCents;
  if (!Number.isSafeInteger(costCents) || costCents < 0) {
    return failResult('failure', 'INVALID_AMOUNT', 'Custo base da posição inicial inválido.', state);
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const opId = params.operationId || `op-init-${params.targetType}-${params.targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return runFinancialCommand(
    state,
    {
      id: opId,
      type: 'INITIAL_POSITION',
      amountCents: valCheck.amountCents,
      amountR$: valCheck.amountR$,
      costBasisCents: costCents,
      postValuationCents: valCheck.amountCents,
      authorizedBy: params.authoredByUid || 'both',
      authoredByUid: params.authoredByUid || 'both',
      scope: params.scope || 'couple',
      sourceRef: { type: 'external', id: 'opening-balance', name: 'Saldo de abertura' },
      targetRef: { type: params.targetType, id: params.targetId, name: params.targetName },
      competence: dateStr.slice(0, 7),
      date: dateStr,
      occurredAt: dateStr,
      confirmedAt: nowIso,
      state: 'occurred_manual',
      notes: params.note || 'Posição patrimonial inicial registrada',
    },
    { nowIso, reserveFloorR$: params.reserveFloorR$ }
  );
}

export interface ValuationAdjustmentCommandParams {
  targetType: 'piggy_bank' | 'protection' | 'freedom';
  targetId: string;
  targetName?: string;
  signedDeltaR$?: number;
  signedDeltaCents?: number;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  note?: string;
  reconciliationRef?: string;
  reserveFloorR$?: number;
  nowIso?: string;
}

export function executeValuationAdjustmentCommand(
  state: AppState,
  params: ValuationAdjustmentCommandParams
): FinancialCommandResult {
  const rawSigned =
    params.signedDeltaCents !== undefined
      ? params.signedDeltaCents
      : params.signedDeltaR$ !== undefined
      ? Math.round(params.signedDeltaR$ * 100)
      : NaN;
  if (!isValidFiniteNumber(rawSigned) || !Number.isSafeInteger(rawSigned) || rawSigned === 0) {
    return failResult('failure', 'INVALID_AMOUNT', 'Variação de avaliação deve ser diferente de zero em centavos.', state);
  }
  const absCents = Math.abs(rawSigned);
  const direction: 'gain' | 'loss' = rawSigned < 0 ? 'loss' : 'gain';
  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const opId = params.operationId || `op-val-${params.targetType}-${params.targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return runFinancialCommand(
    state,
    {
      id: opId,
      type: 'VALUATION_ADJUSTMENT',
      amountCents: absCents,
      amountR$: absCents / 100,
      signedDeltaCents: rawSigned,
      valuationDirection: direction,
      authorizedBy: params.authoredByUid || 'both',
      authoredByUid: params.authoredByUid || 'both',
      scope: params.scope || 'couple',
      sourceRef: { type: 'external', id: 'market-valuation', name: 'Marcação / Rendimento de mercado' },
      targetRef: { type: params.targetType, id: params.targetId, name: params.targetName },
      competence: dateStr.slice(0, 7),
      date: dateStr,
      occurredAt: dateStr,
      confirmedAt: nowIso,
      state: params.reconciliationRef ? 'reconciled' : 'occurred_manual',
      reconciliationRef: params.reconciliationRef,
      notes: params.note || (direction === 'loss' ? 'Variação negativa de rendimento' : 'Rendimento positivo de avaliação'),
    },
    { nowIso, reserveFloorR$: params.reserveFloorR$ }
  );
}

export interface ExecuteMonthlyDepositItemParams {
  monthKey: string;
  itemId: string;
  extraAmountR$?: number;
  extraAmountCents?: number;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  reserveFloorR$?: number;
  completedGoalContributionConfirmed?: boolean;
  nowIso?: string;
}

function getGuideItemTargetRef(
  state: AppState,
  item: MonthlyDepositItem
): { targetType: 'protection' | 'freedom' | 'piggy_bank'; targetId: string; targetName: string } {
  if (item.block === 'protection') {
    return { targetType: 'protection', targetId: 'protection_reserve', targetName: 'Reserva de Emergência' };
  }
  if (item.block === 'freedom') {
    return { targetType: 'freedom', targetId: 'freedom_block', targetName: 'Liberdade Financeira' };
  }
  const resolvedId = item.targetGoalId || state.piggyBanks.find((p) => p.name === item.destinationLabel)?.id || '';
  return { targetType: 'piggy_bank', targetId: resolvedId, targetName: item.destinationLabel };
}

export function executeMonthlyDepositItemCommand(
  state: AppState,
  params: ExecuteMonthlyDepositItemParams
): FinancialCommandResult {
  const guide = state.monthlyDepositGuides?.[params.monthKey];
  if (!guide) {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Guia de aportes para ${params.monthKey} não encontrada.`, state);
  }
  const item = (guide.items || []).find((i) => i.id === params.itemId);
  if (!item) {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Item "${params.itemId}" não encontrado na guia de ${params.monthKey}.`, state);
  }

  const opId = params.operationId || `op-guide-item-${params.monthKey}-${item.id}`;
  if (item.executedAt || item.executedOperationId) {
    if (item.executedOperationId === opId) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Item da guia já executado anteriormente.',
        state,
        idempotentReplay: true,
      };
    }
    return failResult('conflict', 'CONFLICT_ALREADY_MATCHED', `Item "${item.title}" já foi executado anteriormente.`, state);
  }

  const baseCents = Math.round((item.totalAmount || 0) * 100);
  const extraCents =
    params.extraAmountCents !== undefined
      ? Math.max(0, Math.round(params.extraAmountCents))
      : Math.max(0, Math.round((params.extraAmountR$ || 0) * 100));
  const totalCents = baseCents + extraCents;
  if (totalCents <= 0) {
    return failResult('failure', 'INVALID_AMOUNT', 'Valor do item da guia deve ser positivo.', state);
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const target = getGuideItemTargetRef(state, item);
  const authoredBy = params.authoredByUid || 'both';

  const depRes = runFinancialCommand(
    state,
    {
      id: opId,
      type: 'GOAL_DEPOSIT',
      amountCents: totalCents,
      amountR$: totalCents / 100,
      authorizedBy: authoredBy,
      authoredByUid: authoredBy,
      scope: params.scope || 'couple',
      sourceRef: { type: 'guide', id: `guide:${params.monthKey}`, name: `Guia ${params.monthKey}` },
      targetRef: { type: target.targetType, id: target.targetId, name: target.targetName },
      competence: params.monthKey,
      date: dateStr,
      occurredAt: dateStr,
      confirmedAt: nowIso,
      state: 'occurred_manual',
      guideMonthKey: params.monthKey,
      guideItemId: item.id,
      isExtraAporte: extraCents > 0,
      completedGoalContributionConfirmed: params.completedGoalContributionConfirmed,
      notes: `Aporte da Guia (${params.monthKey}): ${item.title}${extraCents > 0 ? ` (+R$ ${(extraCents / 100).toFixed(2)} extra)` : ''}`,
    },
    { nowIso, reserveFloorR$: params.reserveFloorR$ }
  );

  if (depRes.status !== 'success') {
    return depRes;
  }

  let nextState = depRes.state;
  const updatedItems: MonthlyDepositItem[] = guide.items.map((it) =>
    it.id === item.id
      ? {
          ...it,
          executedAt: nowIso,
          executedOperationId: opId,
          executedAmount: totalCents / 100,
          executedByUid: authoredBy,
        }
      : it
  );
  const allPositiveExecuted = updatedItems.every((it) => it.totalAmount <= 0 || Boolean(it.executedAt));
  const updatedGuide: MonthlyDepositGuide = {
    ...guide,
    items: updatedItems,
    status: allPositiveExecuted ? 'completed' : guide.status,
    completedAt: allPositiveExecuted ? nowIso : guide.completedAt,
    revision: (guide.revision ?? 0) + 1,
    lastOperationId: opId,
  };

  let nextSurplusTransfers = nextState.surplusTransfers || [];
  let surplusUpdated = false;
  if (item.surplusAmount > 0) {
    const stId = `st-guide-${params.monthKey}-${item.id}`;
    if (!nextSurplusTransfers.some((s) => s.id === stId)) {
      nextSurplusTransfers = [
        {
          id: stId,
          sourceCategory: 'all_surplus',
          targetType: item.block === 'protection' ? 'protection' : item.block === 'freedom' ? 'freedom' : 'goal',
          targetGoalId: item.targetGoalId,
          targetGoalName: item.destinationLabel,
          amount: item.surplusAmount,
          date: dateStr,
          monthKey: params.monthKey,
          note: `Sobra redirecionada via Guia (${item.title})`,
        },
        ...nextSurplusTransfers,
      ];
      surplusUpdated = true;
    }
  }

  let nextCompleted = nextState.completedMonthDeposits;
  if (allPositiveExecuted) {
    const totalDeposited = updatedItems.reduce((acc, it) => acc + (it.executedAmount ?? it.totalAmount), 0);
    const completionRec: MonthDepositCompletionRecord = {
      monthKey: params.monthKey,
      completedAt: nowIso,
      totalDeposited: roundMoneyCentsCompatible(totalDeposited),
      plannedAmount: roundMoneyCentsCompatible(guide.totalPlanned),
      extraAmount: roundMoneyCentsCompatible(Math.max(0, totalDeposited - guide.totalPlanned)),
      items: updatedItems,
      operationId: opId,
      executedByUid: authoredBy,
    };
    nextCompleted = {
      ...(nextState.completedMonthDeposits || {}),
      [params.monthKey]: completionRec,
    };
  }

  nextState = {
    ...nextState,
    monthlyDepositGuides: {
      ...(nextState.monthlyDepositGuides || {}),
      [params.monthKey]: updatedGuide,
    },
    ...(nextCompleted ? { completedMonthDeposits: nextCompleted } : {}),
    ...(surplusUpdated ? { surplusTransfers: nextSurplusTransfers } : {}),
  };

  return {
    ...depRes,
    state: nextState,
    touchedEntities: {
      ...depRes.touchedEntities,
      guideUpdated: true,
      guideMonthKey: params.monthKey,
      ...(surplusUpdated ? { surplusTransfersUpdated: true } : {}),
    },
  };
}

export interface ExecuteMonthlyDepositParams {
  monthKey: string;
  extraDeposits?: Array<{ targetType: 'protection' | 'freedom' | 'piggy_bank'; targetId: string; targetName?: string; amountR$: number; note?: string }>;
  operationId?: string;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  reserveFloorR$?: number;
  completedGoalContributionConfirmed?: boolean;
  nowIso?: string;
}

export function executeMonthlyDepositCommand(
  state: AppState,
  params: ExecuteMonthlyDepositParams
): FinancialCommandResult {
  const existingCompletion = state.completedMonthDeposits?.[params.monthKey];
  const guide = state.monthlyDepositGuides?.[params.monthKey];
  const opId = params.operationId || `op-guide-${params.monthKey}`;

  if (existingCompletion || guide?.status === 'completed') {
    if (existingCompletion?.operationId === opId || guide?.lastOperationId === opId) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: `Guia de ${params.monthKey} já foi executada com esta operação.`,
        state,
        idempotentReplay: true,
      };
    }
    return failResult(
      'conflict',
      'CONFLICT_ALREADY_MATCHED',
      `Guia de ${params.monthKey} já foi concluída anteriormente. Não é permitido duplicar os aportes do mês.`,
      state
    );
  }

  if (!guide || !guide.items || guide.items.length === 0) {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Guia de ${params.monthKey} sem itens programados.`, state);
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const authoredBy = params.authoredByUid || 'both';

  let workingState = state;
  const touched: FinancialCommandTouchedEntities = {
    guideUpdated: true,
    guideMonthKey: params.monthKey,
  };
  const mergeTouched = (sub?: FinancialCommandTouchedEntities) => {
    if (!sub) return;
    if (sub.financialOperations) touched.financialOperations = Array.from(new Set([...(touched.financialOperations || []), ...sub.financialOperations]));
    if (sub.piggyBanks) touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), ...sub.piggyBanks]));
    if (sub.coupleGoals) touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), ...sub.coupleGoals]));
    if (sub.protectionUpdated) touched.protectionUpdated = true;
    if (sub.freedomUpdated) touched.freedomUpdated = true;
    if (sub.surplusTransfersUpdated) touched.surplusTransfersUpdated = true;
  };

  let pendingExecutedSumCents = 0;
  let extraSumCents = 0;

  // Execute ONLY pending (not yet individually executed) positive items
  const pendingItems = guide.items.filter((it) => it.totalAmount > 0 && !it.executedAt && !it.executedOperationId);
  for (const item of pendingItems) {
    const itemRes = executeMonthlyDepositItemCommand(workingState, {
      monthKey: params.monthKey,
      itemId: item.id,
      operationId: `${opId}:item:${item.id}`,
      authoredByUid: authoredBy,
      scope: params.scope,
      date: dateStr,
      reserveFloorR$: params.reserveFloorR$,
      completedGoalContributionConfirmed: params.completedGoalContributionConfirmed,
      nowIso,
    });
    if (itemRes.status !== 'success') {
      return failResult(itemRes.status, itemRes.reasonCode, itemRes.message, state);
    }
    workingState = itemRes.state;
    pendingExecutedSumCents += Math.round(item.totalAmount * 100);
    mergeTouched(itemRes.touchedEntities);
  }

  // Handle explicit extra deposits separately from the 10% base plan
  for (let idx = 0; idx < (params.extraDeposits || []).length; idx++) {
    const extra = params.extraDeposits![idx];
    const extraCents = Math.round((extra.amountR$ || 0) * 100);
    if (extraCents <= 0) continue;
    const extraOpId = `${opId}:extra:${idx}`;
    const res = runFinancialCommand(
      workingState,
      {
        id: extraOpId,
        type: 'GOAL_DEPOSIT',
        amountCents: extraCents,
        amountR$: extraCents / 100,
        authorizedBy: authoredBy,
        authoredByUid: authoredBy,
        scope: params.scope || 'couple',
        sourceRef: { type: 'income', id: `extra-aporte-${params.monthKey}`, name: 'Aporte extra do mês' },
        targetRef: { type: extra.targetType, id: extra.targetId, name: extra.targetName },
        competence: params.monthKey,
        date: dateStr,
        occurredAt: dateStr,
        confirmedAt: nowIso,
        state: 'occurred_manual',
        guideMonthKey: params.monthKey,
        isExtraAporte: true,
        completedGoalContributionConfirmed: params.completedGoalContributionConfirmed,
        notes: extra.note || `Aporte extra (${params.monthKey})`,
      },
      { nowIso, reserveFloorR$: params.reserveFloorR$ }
    );
    if (res.status !== 'success') {
      return failResult(res.status, res.reasonCode, res.message, state);
    }
    workingState = res.state;
    extraSumCents += extraCents;
    mergeTouched(res.touchedEntities);
  }

  const finalGuide = workingState.monthlyDepositGuides?.[params.monthKey] || guide;
  const previouslyExecutedR$ = guide.items
    .filter((it) => Boolean(it.executedAt))
    .reduce((acc, it) => acc + (it.executedAmount ?? it.totalAmount), 0);
  const totalDepositedR$ = roundMoneyCentsCompatible(
    previouslyExecutedR$ + (pendingExecutedSumCents + extraSumCents) / 100
  );

  const completedRecord: MonthDepositCompletionRecord = {
    monthKey: params.monthKey,
    completedAt: nowIso,
    totalDeposited: totalDepositedR$,
    plannedAmount: roundMoneyCentsCompatible(guide.totalPlanned),
    extraAmount: roundMoneyCentsCompatible(extraSumCents / 100),
    items: finalGuide.items,
    operationId: opId,
    executedByUid: authoredBy,
  };

  const completedGuide: MonthlyDepositGuide = {
    ...finalGuide,
    status: 'completed',
    completedAt: nowIso,
    revision: (finalGuide.revision ?? 0) + 1,
    lastOperationId: opId,
  };

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: `Aportes de ${params.monthKey} confirmados sem alterar o plano base.`,
    state: {
      ...workingState,
      monthlyDepositGuides: {
        ...(workingState.monthlyDepositGuides || {}),
        [params.monthKey]: completedGuide,
      },
      completedMonthDeposits: {
        ...(workingState.completedMonthDeposits || {}),
        [params.monthKey]: completedRecord,
      },
    },
    touchedEntities: touched,
  };
}

export function reverseMonthlyDepositCommand(
  state: AppState,
  monthKey: string,
  meta?: { authoredByUid?: string; nowIso?: string; reserveFloorR$?: number }
): FinancialCommandResult {
  const completion = state.completedMonthDeposits?.[monthKey];
  const guide = state.monthlyDepositGuides?.[monthKey];
  if (!completion && !guide) {
    return {
      status: 'success',
      reasonCode: 'IDEMPOTENT_REPLAY',
      message: 'Nenhum depósito confirmado para desfazer.',
      state,
      idempotentReplay: true,
    };
  }

  let workingState = state;
  const touched: FinancialCommandTouchedEntities = {
    guideUpdated: true,
    guideMonthKey: monthKey,
  };
  const mergeTouched = (sub?: FinancialCommandTouchedEntities) => {
    if (!sub) return;
    if (sub.financialOperations) touched.financialOperations = Array.from(new Set([...(touched.financialOperations || []), ...sub.financialOperations]));
    if (sub.piggyBanks) touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), ...sub.piggyBanks]));
    if (sub.coupleGoals) touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), ...sub.coupleGoals]));
    if (sub.protectionUpdated) touched.protectionUpdated = true;
    if (sub.freedomUpdated) touched.freedomUpdated = true;
  };

  const opsToReverse = (workingState.financialOperations || []).filter(
    (op) => op.guideMonthKey === monthKey && op.state !== 'reverted' && op.state !== 'estornado'
  );
  for (let i = opsToReverse.length - 1; i >= 0; i--) {
    const revRes = reverseFinancialCommand(workingState, opsToReverse[i].id, {
      authoredByUid: meta?.authoredByUid,
      nowIso: meta?.nowIso,
      reserveFloorR$: meta?.reserveFloorR$,
      reason: `Estorno da guia ${monthKey}`,
    });
    if (revRes.status !== 'success') {
      return failResult(revRes.status, revRes.reasonCode, revRes.message, state);
    }
    workingState = revRes.state;
    mergeTouched(revRes.touchedEntities);
  }

  const nextCompleted = { ...(workingState.completedMonthDeposits || {}) };
  delete nextCompleted[monthKey];

  const nextGuides = { ...(workingState.monthlyDepositGuides || {}) };
  if (nextGuides[monthKey]) {
    nextGuides[monthKey] = {
      ...nextGuides[monthKey],
      status: 'approved',
      completedAt: undefined,
      revision: (nextGuides[monthKey].revision ?? 0) + 1,
      items: nextGuides[monthKey].items.map((it) => ({
        ...it,
        executedAt: undefined,
        executedOperationId: undefined,
        executedAmount: undefined,
        executedByUid: undefined,
      })),
    };
  }

  const nextSurplusTransfers = (workingState.surplusTransfers || []).filter(
    (st) => !(st.monthKey === monthKey && st.id.startsWith(`st-guide-${monthKey}-`))
  );
  if (nextSurplusTransfers.length !== (workingState.surplusTransfers || []).length) {
    touched.surplusTransfersUpdated = true;
  }

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: `Confirmação da guia ${monthKey} revertida com integridade.`,
    state: {
      ...workingState,
      monthlyDepositGuides: nextGuides,
      completedMonthDeposits: nextCompleted,
      surplusTransfers: nextSurplusTransfers,
    },
    touchedEntities: touched,
  };
}

export interface IntentConversionCommandParams {
  kind: 'dream' | 'wishlist';
  sourceId: string;
  newGoalId?: string;
  sourceGoalId?: string;
  confirmedCapitalCents?: number;
  confirmedCapitalR$?: number;
  authoredByUid?: string;
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  date?: string;
  nowIso?: string;
}

/**
 * R29-09: Converting a dream simulation or wishlist item into a real goal preserves
 * ONLY genuinely confirmed capital (either already held in an existing converted goal
 * or explicitly transferred from an existing confirmed goal). Unconfirmed simulation
 * downPayment numbers remain informational and NEVER mint unbacked cash.
 */
export function executeIntentConversionCommand(
  state: AppState,
  params: IntentConversionCommandParams
): FinancialCommandResult & { goalId?: string; piggy?: SavingsPiggyBank } {
  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);

  if (params.kind === 'wishlist') {
    const item = (state.coupleWishlist || []).find((w) => w.id === params.sourceId);
    if (!item) {
      return failResult('failure', 'INTENT_NOT_FOUND', 'Desejo não encontrado.', state);
    }
    if (item.status === 'convertido_meta' && item.convertedGoalId) {
      const existingPiggy = state.piggyBanks.find((p) => p.id === item.convertedGoalId);
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Desejo já convertido em meta preservando saldo confirmado.',
        state,
        idempotentReplay: true,
        goalId: item.convertedGoalId,
        piggy: existingPiggy,
      };
    }

    const goalId = params.newGoalId || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const targetCents = Math.max(0, Math.round((item.estimatedPrice || 0) * 100));
    const newPiggy: SavingsPiggyBank = {
      id: goalId,
      name: item.title,
      emoji: item.emoji,
      purpose: `Desejo do Casal convertido: ${item.notes || item.category}`,
      targetAmount: targetCents / 100,
      monthlyDeposit: Math.round(targetCents / 6) / 100,
      currentAmount: 0,
      accumulatedCents: 0,
      committedCents: 0,
      utilizedCents: 0,
      availableCents: 0,
      completed: false,
      revision: 1,
    };

    let nextState: AppState = {
      ...state,
      piggyBanks: [...state.piggyBanks, newPiggy],
      coupleWishlist: (state.coupleWishlist || []).map((w) =>
        w.id === item.id ? { ...w, status: 'convertido_meta' as const, convertedGoalId: goalId } : w
      ),
    };

    const touched: FinancialCommandTouchedEntities = {
      piggyBanks: [goalId],
      coupleWishlist: [item.id],
    };

    if (params.sourceGoalId && (params.confirmedCapitalCents || params.confirmedCapitalR$)) {
      const capitalCheck = normalizeMonetaryBoundary({
        amountCents: params.confirmedCapitalCents,
        amountR$: params.confirmedCapitalR$,
      });
      if (!capitalCheck.ok) {
        return failResult('failure', capitalCheck.reasonCode || 'INVALID_AMOUNT', capitalCheck.error || 'Valor monetário inválido.', state);
      }
      const trRes = runFinancialCommand(nextState, {
        id: `op-conv-wish-${item.id}`,
        type: 'GOAL_TRANSFER',
        amountCents: capitalCheck.amountCents,
        amountR$: capitalCheck.amountR$,
        authorizedBy: params.authoredByUid || 'both',
        authoredByUid: params.authoredByUid || 'both',
        scope: params.scope || 'couple',
        sourceRef: { type: 'piggy_bank', id: params.sourceGoalId },
        targetRef: { type: 'piggy_bank', id: goalId },
        competence: dateStr.slice(0, 7),
        date: dateStr,
        state: 'occurred_manual',
        notes: `Capital confirmado transferido na conversão de desejo "${item.title}"`,
      }, { nowIso });
      if (trRes.status !== 'success') {
        return failResult(trRes.status, trRes.reasonCode, trRes.message, state);
      }
      nextState = trRes.state;
      touched.financialOperations = trRes.touchedEntities?.financialOperations;
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), ...(trRes.touchedEntities?.piggyBanks || [])]));
    }

    return {
      status: 'success',
      reasonCode: 'EXECUTED',
      message: 'Desejo convertido em meta preservando capital confirmado.',
      state: nextState,
      goalId,
      piggy: nextState.piggyBanks.find((p) => p.id === goalId) || newPiggy,
      touchedEntities: touched,
    };
  }

  // Dream conversion
  const dream = (state.dreamSimulations || []).find((d) => d.id === params.sourceId);
  if (!dream) {
    return failResult('failure', 'INTENT_NOT_FOUND', 'Sonho não encontrado.', state);
  }
  if (dream.convertedGoalId) {
    const existingPiggy = state.piggyBanks.find((p) => p.id === dream.convertedGoalId);
    if (existingPiggy) {
      return {
        status: 'success',
        reasonCode: 'IDEMPOTENT_REPLAY',
        message: 'Sonho já convertido preservando capital confirmado.',
        state,
        idempotentReplay: true,
        goalId: dream.convertedGoalId,
        piggy: existingPiggy,
      };
    }
  }

  const goalId = params.newGoalId || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const targetCents = Math.max(0, Math.round((dream.totalCost || 0) * 100));
  const plannedNote = dream.downPayment > 0 ? ` · entrada planejada R$ ${dream.downPayment.toFixed(2)}` : '';

  const newPiggy: SavingsPiggyBank = {
    id: goalId,
    name: dream.title,
    emoji: dream.emoji || '🏠',
    purpose: `Sonho do Casal convertido (${dream.monthsToAchieve} meses previstos${plannedNote})`,
    targetAmount: targetCents / 100,
    monthlyDeposit: dream.monthlySavings,
    // Never fabricate confirmed capital from unconfirmed simulation downPayment!
    currentAmount: 0,
    accumulatedCents: 0,
    committedCents: 0,
    utilizedCents: 0,
    availableCents: 0,
    completed: false,
    revision: 1,
  };

  const newCoupleGoal: CoupleGoal = {
    id: goalId,
    title: dream.title,
    category: 'outro',
    emoji: dream.emoji || '🏠',
    targetAmount: targetCents / 100,
    currentAmount: 0,
    accumulatedCents: 0,
    committedCents: 0,
    utilizedCents: 0,
    availableCents: 0,
    partner1Contribution: 0,
    partner2Contribution: 0,
    monthlyPlannedDeposit: dream.monthlySavings,
    isCompleted: false,
    history: [],
    createdAt: dateStr,
    revision: 1,
  };

  let nextState: AppState = {
    ...state,
    piggyBanks: [...state.piggyBanks, newPiggy],
    coupleGoals: [...(state.coupleGoals || []), newCoupleGoal],
    dreamSimulations: (state.dreamSimulations || []).map((d) =>
      d.id === dream.id ? { ...d, convertedGoalId: goalId } : d
    ),
  };

  const touched: FinancialCommandTouchedEntities = {
    piggyBanks: [goalId],
    coupleGoals: [goalId],
    dreamSimulations: [dream.id],
  };

  // If the caller specified an actual confirmed funding goal & capital to transfer into the converted goal, transfer it atomically
  if (params.sourceGoalId && (params.confirmedCapitalCents !== undefined || params.confirmedCapitalR$ !== undefined)) {
    const capitalCheck = normalizeMonetaryBoundary({
      amountCents: params.confirmedCapitalCents,
      amountR$: params.confirmedCapitalR$,
    });
    if (!capitalCheck.ok) {
      return failResult('failure', capitalCheck.reasonCode || 'INVALID_AMOUNT', capitalCheck.error || 'Valor monetário inválido.', state);
    }
    const trRes = runFinancialCommand(nextState, {
      id: `op-conv-dream-${dream.id}`,
      type: 'GOAL_TRANSFER',
      amountCents: capitalCheck.amountCents,
      amountR$: capitalCheck.amountR$,
      authorizedBy: params.authoredByUid || 'both',
      authoredByUid: params.authoredByUid || 'both',
      scope: params.scope || 'couple',
      sourceRef: { type: 'piggy_bank', id: params.sourceGoalId },
      targetRef: { type: 'piggy_bank', id: goalId },
      competence: dateStr.slice(0, 7),
      date: dateStr,
      state: 'occurred_manual',
      notes: `Capital confirmado transferido na conversão do sonho "${dream.title}"`,
    }, { nowIso });
    if (trRes.status !== 'success') {
      return failResult(trRes.status, trRes.reasonCode, trRes.message, state);
    }
    nextState = trRes.state;
    touched.financialOperations = trRes.touchedEntities?.financialOperations;
    touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), ...(trRes.touchedEntities?.piggyBanks || [])]));
    touched.coupleGoals = Array.from(new Set([...(touched.coupleGoals || []), ...(trRes.touchedEntities?.coupleGoals || [])]));
  }

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Sonho convertido em meta preservando capital realmente confirmado.',
    state: nextState,
    goalId,
    piggy: nextState.piggyBanks.find((p) => p.id === goalId) || newPiggy,
    touchedEntities: touched,
  };
}

// =========================================================================
// STAGE 26B: WITHDRAWALS, LIQUIDATIONS, STATEMENT RECONCILIATION & PAIRING
// =========================================================================

export interface GoalWithdrawalCommandParams {
  goalId: string;
  sourceType?: 'piggy_bank' | 'protection' | 'freedom';
  withdrawalChannel?: 'virtual_reallocation' | 'asset_redemption';
  executionMode?: 'planned' | 'pending_settlement' | 'occurred_manual' | 'reconciled';
  grossAmountCents?: number;
  grossAmountR$?: number;
  netAmountCents?: number;
  netAmountR$?: number;
  destinationAccountId?: string;
  settlementDate?: string;
  competence?: string;
  date?: string;
  partitions?: WithdrawalPurposePartition[];
  principalCents?: number;
  interestCents?: number;
  taxCents?: number;
  feeCents?: number;
  overrideInsufficientPlanning?: boolean;
  reconciliationRef?: string;
  bankTransactionId?: string;
  operationId?: string;
  authorizedBy?: string;
  authoredByUid?: string;
  contributor?: 'partner1' | 'partner2' | 'both';
  scope?: 'couple' | 'casal' | 'partner1' | 'partner2';
  note?: string;
  expectedRevision?: number;
  reserveFloorR$?: number;
  reserveFloorCents?: number;
  nowIso?: string;
}

export interface GoalWithdrawalPreviewResult {
  ok: boolean;
  reasonCode?: FinancialCommandReasonCode;
  error?: string;
  sourceName: string;
  sourceAvailableCents: number;
  channel: 'virtual_reallocation' | 'asset_redemption';
  executionMode: 'planned' | 'pending_settlement' | 'occurred_manual' | 'reconciled';
  destinationAccountId?: string;
  destinationAccountName?: string;
  grossAmountCents: number;
  netAmountCents: number;
  differenceToReviewCents: number;
  partitions: WithdrawalPurposePartition[];
  earmarkedNetCents: number;
  freeCashNetCents: number;
  competence: string;
  incomeImpactCents: 0;
  requiresDivergenceOverride: boolean;
  planningDivergenceCents: number;
  warnings: string[];
}

interface ResolvedWithdrawalAmounts {
  ok: boolean;
  grossCents: number;
  netCents: number;
  diffCents: number;
  reasonCode?: 'INVALID_AMOUNT' | 'DIVERGENT_AMOUNTS';
  error?: string;
}

function resolveWithdrawalAmounts(params: GoalWithdrawalCommandParams): ResolvedWithdrawalAmounts {
  const grossCheck = normalizeMonetaryBoundary({
    amountCents: params.grossAmountCents ?? params.netAmountCents,
    amountR$: params.grossAmountR$ ?? params.netAmountR$,
  });
  if (!grossCheck.ok) {
    return {
      ok: false,
      grossCents: 0,
      netCents: 0,
      diffCents: 0,
      reasonCode: grossCheck.reasonCode || 'INVALID_AMOUNT',
      error: grossCheck.error || 'Valor bruto de resgate inválido.',
    };
  }
  const hasExplicitNet = params.netAmountCents !== undefined || params.netAmountR$ !== undefined;
  let netCents = grossCheck.amountCents;
  if (hasExplicitNet) {
    const netCheck = normalizeMonetaryBoundary({
      amountCents: params.netAmountCents,
      amountR$: params.netAmountR$,
    });
    if (!netCheck.ok) {
      return {
        ok: false,
        grossCents: 0,
        netCents: 0,
        diffCents: 0,
        reasonCode: netCheck.reasonCode || 'INVALID_AMOUNT',
        error: netCheck.error || 'Valor líquido de resgate inválido.',
      };
    }
    netCents = netCheck.amountCents;
  }
  if (netCents > grossCheck.amountCents) {
    return {
      ok: false,
      grossCents: 0,
      netCents: 0,
      diffCents: 0,
      reasonCode: 'DIVERGENT_AMOUNTS',
      error: `Valor líquido (R$ ${(netCents / 100).toFixed(2)}) não pode ser maior que o valor bruto (R$ ${(grossCheck.amountCents / 100).toFixed(2)}).`,
    };
  }
  return {
    ok: true,
    grossCents: grossCheck.amountCents,
    netCents,
    diffCents: grossCheck.amountCents - netCents,
  };
}

function resolveWithdrawalSourceInfo(
  state: AppState,
  sourceType: 'piggy_bank' | 'protection' | 'freedom',
  goalId: string
): { exists: boolean; archived?: boolean; name: string; availableCents: number } {
  if (sourceType === 'protection') {
    return {
      exists: true,
      name: 'Bloco 1 · Reserva de Emergência',
      availableCents: Math.round((state.protectionCurrentAmount || 0) * 100),
    };
  }
  if (sourceType === 'freedom') {
    return {
      exists: true,
      name: 'Bloco 3 · Liberdade Financeira',
      availableCents:
        Math.round((state.freedomTotalInvested || 0) * 100) +
        Math.round((state.freedomYieldAccumulated || 0) * 100),
    };
  }
  const piggy = (state.piggyBanks || []).find((p) => p.id === goalId);
  const coupleGoal = (state.coupleGoals || []).find((g) => g.id === goalId);
  if (!piggy && !coupleGoal) {
    return { exists: false, name: goalId, availableCents: 0 };
  }
  const archived = Boolean(piggy?.archived || coupleGoal?.archived || piggy?.isDeleted || coupleGoal?.isDeleted);
  const entity = (piggy || coupleGoal)!;
  return {
    exists: true,
    archived,
    name: piggy?.name || coupleGoal?.title || goalId,
    availableCents: getGoalAvailableCents(entity),
  };
}

export function previewGoalWithdrawal(
  state: AppState,
  params: GoalWithdrawalCommandParams
): GoalWithdrawalPreviewResult {
  const sourceType = params.sourceType || 'piggy_bank';
  const channel = params.withdrawalChannel || 'asset_redemption';
  const executionMode = params.executionMode || 'occurred_manual';
  const dateStr = params.date || new Date().toISOString().slice(0, 10);
  const competence = params.competence || dateStr.slice(0, 7);
  const sourceInfo = resolveWithdrawalSourceInfo(state, sourceType, params.goalId);

  const destAcc = params.destinationAccountId
    ? (state.linkedAccounts || []).find(
        (a) => a.id === params.destinationAccountId || a.canonicalAccountId === params.destinationAccountId
      ) ||
      (state.pluggyAccounts || []).find(
        (p) => p.id === params.destinationAccountId || p.canonicalAccountId === params.destinationAccountId
      )
    : undefined;
  const destinationAccountName = destAcc?.bankName || params.destinationAccountId;

  const amounts = resolveWithdrawalAmounts(params);
  if (!amounts.ok) {
    return {
      ok: false,
      reasonCode: amounts.reasonCode,
      error: amounts.error,
      sourceName: sourceInfo.name,
      sourceAvailableCents: sourceInfo.availableCents,
      channel,
      executionMode,
      destinationAccountId: params.destinationAccountId,
      destinationAccountName,
      grossAmountCents: 0,
      netAmountCents: 0,
      differenceToReviewCents: 0,
      partitions: params.partitions || [],
      earmarkedNetCents: 0,
      freeCashNetCents: 0,
      competence,
      incomeImpactCents: 0,
      requiresDivergenceOverride: false,
      planningDivergenceCents: 0,
      warnings: [],
    };
  }

  if (!sourceInfo.exists) {
    return {
      ok: false,
      reasonCode: 'GOAL_NOT_FOUND',
      error: `Ativo ou meta "${params.goalId}" não encontrado.`,
      sourceName: sourceInfo.name,
      sourceAvailableCents: 0,
      channel,
      executionMode,
      destinationAccountId: params.destinationAccountId,
      destinationAccountName,
      grossAmountCents: amounts.grossCents,
      netAmountCents: amounts.netCents,
      differenceToReviewCents: amounts.diffCents,
      partitions: params.partitions || [],
      earmarkedNetCents: 0,
      freeCashNetCents: 0,
      competence,
      incomeImpactCents: 0,
      requiresDivergenceOverride: false,
      planningDivergenceCents: 0,
      warnings: [],
    };
  }

  if (sourceInfo.archived) {
    return {
      ok: false,
      reasonCode: 'GOAL_ARCHIVED',
      error: `Meta "${sourceInfo.name}" está arquivada e não aceita novos resgates.`,
      sourceName: sourceInfo.name,
      sourceAvailableCents: sourceInfo.availableCents,
      channel,
      executionMode,
      destinationAccountId: params.destinationAccountId,
      destinationAccountName,
      grossAmountCents: amounts.grossCents,
      netAmountCents: amounts.netCents,
      differenceToReviewCents: amounts.diffCents,
      partitions: params.partitions || [],
      earmarkedNetCents: 0,
      freeCashNetCents: 0,
      competence,
      incomeImpactCents: 0,
      requiresDivergenceOverride: false,
      planningDivergenceCents: 0,
      warnings: [],
    };
  }

  const partitions = params.partitions || [];
  if (partitions.length > 0) {
    let sum = 0;
    for (const p of partitions) {
      if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) {
        return {
          ok: false,
          reasonCode: 'INVALID_AMOUNT',
          error: 'Partição com valor inválido em centavos.',
          sourceName: sourceInfo.name,
          sourceAvailableCents: sourceInfo.availableCents,
          channel,
          executionMode,
          destinationAccountId: params.destinationAccountId,
          destinationAccountName,
          grossAmountCents: amounts.grossCents,
          netAmountCents: amounts.netCents,
          differenceToReviewCents: amounts.diffCents,
          partitions,
          earmarkedNetCents: 0,
          freeCashNetCents: 0,
          competence,
          incomeImpactCents: 0,
          requiresDivergenceOverride: false,
          planningDivergenceCents: 0,
          warnings: [],
        };
      }
      sum += p.amountCents;
    }
    if (sum !== amounts.netCents) {
      return {
        ok: false,
        reasonCode: 'DIVERGENT_AMOUNTS',
        error: `Soma das partições (R$ ${(sum / 100).toFixed(2)}) difere do líquido (R$ ${(amounts.netCents / 100).toFixed(2)}).`,
        sourceName: sourceInfo.name,
        sourceAvailableCents: sourceInfo.availableCents,
        channel,
        executionMode,
        destinationAccountId: params.destinationAccountId,
        destinationAccountName,
        grossAmountCents: amounts.grossCents,
        netAmountCents: amounts.netCents,
        differenceToReviewCents: amounts.diffCents,
        partitions,
        earmarkedNetCents: 0,
        freeCashNetCents: 0,
        competence,
        incomeImpactCents: 0,
        requiresDivergenceOverride: false,
        planningDivergenceCents: 0,
        warnings: [],
      };
    }
  }

  const earmarkedNetCents =
    partitions.length > 0
      ? partitions.reduce((s, p) => s + (p.targetType !== 'cash_free' ? p.amountCents : 0), 0)
      : channel === 'virtual_reallocation'
      ? amounts.netCents
      : 0;
  const freeCashNetCents = amounts.netCents - earmarkedNetCents;

  const shortfall = Math.max(0, amounts.grossCents - sourceInfo.availableCents);
  const requiresDivergenceOverride = shortfall > 0;
  const warnings: string[] = [];

  if (executionMode === 'planned' || executionMode === 'pending_settlement') {
    warnings.push('Operação ainda em solicitação/liquidação: não libera caixa livre nem reforça gastos antes de ocorrer.');
  }
  if (amounts.diffCents > 0) {
    warnings.push(
      `Diferença entre bruto e líquido: R$ ${(amounts.diffCents / 100).toFixed(2)} para revisar no extrato (sem atribuição automática de IR/IOF/taxa).`
    );
  }
  if (requiresDivergenceOverride) {
    warnings.push(
      `Saldo planejado atual (R$ ${(sourceInfo.availableCents / 100).toFixed(2)}) é menor que o resgate em R$ ${(shortfall / 100).toFixed(2)}. Exige confirmação explícita de divergência real.`
    );
  }

  const blockedByBalance = requiresDivergenceOverride && params.overrideInsufficientPlanning !== true;

  return {
    ok: !blockedByBalance,
    reasonCode: blockedByBalance ? 'INSUFFICIENT_FUNDS' : undefined,
    error: blockedByBalance
      ? `Saldo insuficiente (R$ ${(sourceInfo.availableCents / 100).toFixed(2)}) para resgate de R$ ${(amounts.grossCents / 100).toFixed(2)}.`
      : undefined,
    sourceName: sourceInfo.name,
    sourceAvailableCents: sourceInfo.availableCents,
    channel,
    executionMode,
    destinationAccountId: params.destinationAccountId,
    destinationAccountName,
    grossAmountCents: amounts.grossCents,
    netAmountCents: amounts.netCents,
    differenceToReviewCents: amounts.diffCents,
    partitions,
    earmarkedNetCents,
    freeCashNetCents,
    competence,
    incomeImpactCents: 0,
    requiresDivergenceOverride,
    planningDivergenceCents: shortfall,
    warnings,
  };
}

export function executeWithdrawalCommand(
  state: AppState,
  params: GoalWithdrawalCommandParams
): FinancialCommandResult {
  const amounts = resolveWithdrawalAmounts(params);
  if (!amounts.ok) {
    return failResult('failure', amounts.reasonCode, amounts.error, state);
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const dateStr = params.date || nowIso.slice(0, 10);
  const competence = params.competence || dateStr.slice(0, 7);
  const sourceType = params.sourceType || 'piggy_bank';
  const channel: 'virtual_reallocation' | 'asset_redemption' = params.withdrawalChannel || 'asset_redemption';
  const executionMode = params.executionMode || (params.reconciliationRef ? 'reconciled' : 'occurred_manual');
  const authorizedBy = params.authorizedBy || params.contributor || params.authoredByUid || 'both';
  const authoredByUid = params.authoredByUid || authorizedBy;
  const opId = params.operationId || `op-withdraw-${sourceType}-${params.goalId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const existingOp = (state.financialOperations || []).find((o) => o.id === opId);
  if (
    existingOp &&
    existingOp.type === 'GOAL_WITHDRAWAL' &&
    (existingOp.state === 'planned' || existingOp.state === 'pending_settlement') &&
    (executionMode === 'occurred_manual' || executionMode === 'reconciled')
  ) {
    if (params.expectedRevision !== undefined && (existingOp.revision ?? 1) !== params.expectedRevision) {
      return failResult(
        'conflict',
        'CONFLICT_REVISION',
        `Conflito de revisão na operação ${opId}: esperado ${params.expectedRevision}, atual ${existingOp.revision ?? 1}.`,
        state,
        existingOp
      );
    }
    // Settle existing planned / pending_settlement withdrawal in-place without duplicating operation
    let workingState = state;
    const settledReleaseTouched: FinancialCommandTouchedEntities = {};
    if (existingOp.state === 'pending_settlement' && existingOp.sourceRef?.type === 'piggy_bank') {
      const gid = existingOp.sourceRef.id;
      const lockedGross = existingOp.grossAmountCents ?? existingOp.amountCents;
      const pb = (workingState.piggyBanks || []).find((p) => p.id === gid);
      const cg = (workingState.coupleGoals || []).find((g) => g.id === gid);
      const curCommitted = pb?.committedCents ?? cg?.committedCents ?? 0;
      const releaseCents = Math.min(lockedGross, curCommitted);
      if (releaseCents > 0) {
        workingState = {
          ...workingState,
          piggyBanks: (workingState.piggyBanks || []).map((p) => {
            if (p.id !== gid) return p;
            const nextCommitted = (p.committedCents ?? 0) - releaseCents;
            const nextAvailable = getGoalAvailableCents(p) + releaseCents;
            return {
              ...p,
              committedCents: nextCommitted,
              availableCents: nextAvailable,
              currentAmount: nextAvailable / 100,
            };
          }),
          coupleGoals: (workingState.coupleGoals || []).map((g) => {
            if (g.id !== gid) return g;
            const nextCommitted = (g.committedCents ?? 0) - releaseCents;
            const nextAvailable = getGoalAvailableCents(g) + releaseCents;
            return {
              ...g,
              committedCents: nextCommitted,
              availableCents: nextAvailable,
              currentAmount: nextAvailable / 100,
            };
          }),
        };
        settledReleaseTouched.piggyBanks = [gid];
        settledReleaseTouched.coupleGoals = [gid];
      }
    }

    const tempOpId = `${opId}__settle_tmp`;
    const stateWithoutOldOp: AppState = {
      ...workingState,
      financialOperations: (workingState.financialOperations || []).filter((o) => o.id !== opId),
    };
    const settleParams: GoalWithdrawalCommandParams = {
      ...params,
      goalId: params.goalId || existingOp.sourceRef?.id || '',
      sourceType: params.sourceType || (existingOp.sourceRef?.type as any) || 'piggy_bank',
      withdrawalChannel: params.withdrawalChannel || existingOp.withdrawalChannel || channel,
      destinationAccountId: params.destinationAccountId ?? existingOp.destinationAccountId,
      partitions: params.partitions ?? existingOp.partitions,
      date: dateStr,
      competence,
      operationId: tempOpId,
      expectedRevision: undefined,
    };
    const res = executeWithdrawalCommand(stateWithoutOldOp, settleParams);
    if (res.status !== 'success' || !res.operation) {
      return failResult(res.status === 'conflict' ? 'conflict' : 'failure', res.reasonCode, res.message, state, existingOp);
    }

    const finalizedOp: FinancialOperationRecord = {
      ...res.operation,
      id: opId,
      revision: (existingOp.revision ?? 1) + 1,
      createdAt: existingOp.createdAt || res.operation.createdAt,
      reconciledAt: executionMode === 'reconciled' ? nowIso : undefined,
      reconciledByUid: executionMode === 'reconciled' ? authoredByUid : undefined,
      bankTransactionId: params.bankTransactionId ?? existingOp.bankTransactionId,
    };
    finalizedOp.commandFingerprint = computeOperationFingerprint(finalizedOp, finalizedOp.amountCents);

    const updatedState: AppState = {
      ...res.state,
      financialOperations: (state.financialOperations || []).map((o) => (o.id === opId ? finalizedOp : o)),
      piggyBanks: res.state.piggyBanks.map((p) =>
        p.lastOperationId === tempOpId ? { ...p, lastOperationId: opId } : p
      ),
      coupleGoals: (res.state.coupleGoals || []).map((g) =>
        g.lastOperationId === tempOpId ? { ...g, lastOperationId: opId } : g
      ),
      linkedAccounts: (res.state.linkedAccounts || []).map((a) =>
        a.lastOperationId === tempOpId ? { ...a, lastOperationId: opId } : a
      ),
    };

    return {
      ...res,
      state: updatedState,
      operation: finalizedOp,
      touchedEntities: {
        ...settledReleaseTouched,
        ...res.touchedEntities,
        financialOperations: [opId],
      },
    };
  }

  const sourceInfo = resolveWithdrawalSourceInfo(state, sourceType, params.goalId);
  const targetRef: FinancialOperationRecord['targetRef'] =
    channel === 'asset_redemption' && params.destinationAccountId
      ? { type: 'account', id: params.destinationAccountId, name: params.destinationAccountId }
      : { type: 'external', id: channel === 'virtual_reallocation' ? 'virtual_reallocation' : 'asset_redemption', name: params.note || 'Resgate' };

  const opRecord: FinancialOperationRecord = {
    id: opId,
    type: 'GOAL_WITHDRAWAL',
    amountCents: amounts.grossCents,
    amountR$: amounts.grossCents / 100,
    authorizedBy,
    authoredByUid,
    scope: params.scope || 'couple',
    sourceRef: { type: sourceType, id: params.goalId, name: sourceInfo.name },
    targetRef,
    competence,
    date: dateStr,
    occurredAt: dateStr,
    confirmedAt: nowIso,
    expectedRevision: params.expectedRevision,
    state: executionMode,
    reconciliationRef: params.reconciliationRef,
    withdrawalChannel: channel,
    settlementStatus: executionMode,
    settlementDate: params.settlementDate,
    destinationAccountId: params.destinationAccountId,
    grossAmountCents: amounts.grossCents,
    netAmountCents: amounts.netCents,
    differenceToReviewCents: amounts.diffCents,
    principalCents: params.principalCents,
    interestCents: params.interestCents,
    taxCents: params.taxCents,
    feeCents: params.feeCents,
    partitions: params.partitions,
    bankTransactionId: params.bankTransactionId,
    overrideInsufficientPlanning: params.overrideInsufficientPlanning,
    reconciledAt: executionMode === 'reconciled' ? nowIso : undefined,
    reconciledByUid: executionMode === 'reconciled' ? authoredByUid : undefined,
    notes: params.note,
  };

  return runFinancialCommand(state, opRecord, {
    nowIso,
    contributor: params.contributor || 'both',
    reserveFloorR$: params.reserveFloorR$,
    reserveFloorCents: params.reserveFloorCents,
  });
}

export interface ReconcileWithdrawalStatementParams {
  bankTransactionId: string;
  operationId: string;
  netAmountCents?: number;
  netAmountR$?: number;
  grossAmountCents?: number;
  taxCents?: number;
  feeCents?: number;
  reconciledByUid: string;
  reconciliationRef?: string;
  destinationAccountId?: string;
  nowIso?: string;
}

export function reconcileWithdrawalWithStatementCommand(
  state: AppState,
  params: ReconcileWithdrawalStatementParams
): FinancialCommandResult {
  const txs = state.bankImportedTransactions || [];
  const bankTx = txs.find((t) => t.id === params.bankTransactionId);
  if (!bankTx) {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Lançamento bancário "${params.bankTransactionId}" não encontrado.`, state);
  }
  const ops = state.financialOperations || [];
  const op = ops.find((o) => o.id === params.operationId);
  if (!op || op.type !== 'GOAL_WITHDRAWAL') {
    return failResult('failure', 'OPERATION_NOT_FOUND', `Operação de resgate "${params.operationId}" não encontrada.`, state);
  }
  if (op.state === 'reverted' || op.state === 'estornado') {
    return failResult('conflict', 'CONFLICT_ALREADY_REVERTED', `Operação "${op.id}" já foi estornada.`, state, op);
  }

  if (
    bankTx.status === 'reconciled' &&
    bankTx.reconciledOperationId === op.id &&
    op.state === 'reconciled' &&
    op.bankTransactionId === bankTx.id
  ) {
    return {
      status: 'success',
      reasonCode: 'IDEMPOTENT_REPLAY',
      message: 'Resgate já conciliado com este lançamento bancário.',
      state,
      operation: op,
      idempotentReplay: true,
    };
  }

  if (bankTx.reconciledOperationId && bankTx.reconciledOperationId !== op.id) {
    return failResult(
      'conflict',
      'CONFLICT_ALREADY_MATCHED',
      `Conflito: lançamento bancário "${bankTx.id}" já está conciliado com a operação "${bankTx.reconciledOperationId}".`,
      state,
      op
    );
  }
  if (op.bankTransactionId && op.bankTransactionId !== bankTx.id) {
    return failResult(
      'conflict',
      'CONFLICT_ALREADY_MATCHED',
      `Conflito: operação "${op.id}" já está conciliada com outro lançamento bancário ("${op.bankTransactionId}").`,
      state,
      op
    );
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const effectiveRef = params.reconciliationRef || bankTx.fitid || `stmt:${bankTx.id}`;
  const targetNetCents =
    params.netAmountCents ??
    (params.netAmountR$ !== undefined ? Math.round(params.netAmountR$ * 100) : Math.round((bankTx.amount || 0) * 100));
  if (!Number.isSafeInteger(targetNetCents) || targetNetCents <= 0) {
    return failResult('failure', 'INVALID_AMOUNT', 'Valor líquido conciliado inválido.', state, op);
  }
  const targetGrossCents = params.grossAmountCents ?? op.grossAmountCents ?? op.amountCents;
  if (targetNetCents > targetGrossCents) {
    return failResult(
      'failure',
      'DIVERGENT_AMOUNTS',
      `Valor líquido do extrato (R$ ${(targetNetCents / 100).toFixed(2)}) excede o valor bruto registrado (R$ ${(targetGrossCents / 100).toFixed(2)}).`,
      state,
      op
    );
  }
  const diffCents = targetGrossCents - targetNetCents;
  const destAccId = params.destinationAccountId || op.destinationAccountId || bankTx.canonicalAccountId || bankTx.accountId;

  let workingState = state;
  let updatedOp: FinancialOperationRecord;
  let touched: FinancialCommandTouchedEntities = {
    financialOperations: [op.id],
    bankImportedTransactions: [bankTx.id],
  };

  if (op.state === 'planned' || op.state === 'pending_settlement') {
    const settleRes = executeWithdrawalCommand(workingState, {
      operationId: op.id,
      goalId: op.sourceRef?.id || '',
      sourceType: (op.sourceRef?.type as any) || 'piggy_bank',
      withdrawalChannel: op.withdrawalChannel || 'asset_redemption',
      executionMode: 'reconciled',
      grossAmountCents: targetGrossCents,
      netAmountCents: targetNetCents,
      destinationAccountId: destAccId,
      date: bankTx.date || op.date,
      competence: op.competence,
      partitions: op.partitions,
      taxCents: params.taxCents ?? op.taxCents,
      feeCents: params.feeCents ?? op.feeCents,
      reconciliationRef: effectiveRef,
      bankTransactionId: bankTx.id,
      overrideInsufficientPlanning: op.overrideInsufficientPlanning,
      authoredByUid: params.reconciledByUid,
      authorizedBy: op.authorizedBy,
      note: op.notes,
      nowIso,
    });
    if (settleRes.status !== 'success' || !settleRes.operation) {
      return settleRes;
    }
    workingState = settleRes.state;
    updatedOp = settleRes.operation;
    touched = {
      ...settleRes.touchedEntities,
      financialOperations: [op.id],
      bankImportedTransactions: [bankTx.id],
    };
  } else {
    const prevNetCents = op.netAmountCents ?? op.amountCents;
    const netDeltaCents = targetNetCents - prevNetCents;
    const nextLinkedAccounts = [...(workingState.linkedAccounts || [])];
    if (netDeltaCents !== 0 && op.withdrawalChannel !== 'virtual_reallocation' && destAccId) {
      const idx = nextLinkedAccounts.findIndex((a) => a.id === destAccId || a.canonicalAccountId === destAccId);
      if (idx >= 0 && nextLinkedAccounts[idx].accountType !== 'cartao') {
        const curCents = Math.round((nextLinkedAccounts[idx].balance || 0) * 100);
        nextLinkedAccounts[idx] = {
          ...nextLinkedAccounts[idx],
          balance: (curCents + netDeltaCents) / 100,
          revision: (nextLinkedAccounts[idx].revision ?? 0) + 1,
          lastOperationId: op.id,
        };
        touched.linkedAccounts = [nextLinkedAccounts[idx].id];
      }
    }
    updatedOp = {
      ...op,
      state: 'reconciled',
      settlementStatus: op.planningDivergenceCents ? 'divergent' : 'reconciled',
      grossAmountCents: targetGrossCents,
      netAmountCents: targetNetCents,
      differenceToReviewCents: diffCents,
      taxCents: params.taxCents ?? op.taxCents,
      feeCents: params.feeCents ?? op.feeCents,
      destinationAccountId: destAccId,
      reconciliationRef: effectiveRef,
      bankTransactionId: bankTx.id,
      reconciledAt: nowIso,
      reconciledByUid: params.reconciledByUid,
      revision: (op.revision ?? 1) + 1,
    };
    updatedOp.commandFingerprint = computeOperationFingerprint(updatedOp, updatedOp.amountCents);
    workingState = {
      ...workingState,
      linkedAccounts: nextLinkedAccounts,
      financialOperations: (workingState.financialOperations || []).map((o) => (o.id === op.id ? updatedOp : o)),
    };
  }

  const updatedTxs: BankImportedTransaction[] = (workingState.bankImportedTransactions || []).map((t) =>
    t.id === bankTx.id
      ? {
          ...t,
          status: 'reconciled',
          reconciledOperationId: updatedOp.id,
        }
      : t
  );

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Resgate conciliado com o extrato sem gerar receita fictícia.',
    state: {
      ...workingState,
      bankImportedTransactions: updatedTxs,
    },
    operation: updatedOp,
    touchedEntities: touched,
  };
}

export interface ConfirmInternalTransferPairParams {
  debitTxId: string;
  creditTxId: string;
  authorizedBy: string;
  note?: string;
}

export function confirmInternalTransferPairCommand(
  state: AppState,
  params: ConfirmInternalTransferPairParams
): FinancialCommandResult {
  if (!params.debitTxId || !params.creditTxId || params.debitTxId === params.creditTxId) {
    return failResult('failure', 'INVALID_REFS', 'Selecione duas transações bancárias distintas para pareamento interno.', state);
  }
  const txs = state.bankImportedTransactions || [];
  const debitTx = txs.find((t) => t.id === params.debitTxId);
  const creditTx = txs.find((t) => t.id === params.creditTxId);
  if (!debitTx || !creditTx) {
    return failResult('failure', 'OPERATION_NOT_FOUND', 'Uma ou ambas as transações do pareamento não foram encontradas.', state);
  }

  if (
    debitTx.status === 'internal_transfer' &&
    creditTx.status === 'internal_transfer' &&
    debitTx.pairedTransferTransactionId === creditTx.id &&
    creditTx.pairedTransferTransactionId === debitTx.id
  ) {
    return {
      status: 'success',
      reasonCode: 'IDEMPOTENT_REPLAY',
      message: 'Transferência interna já confirmada entre as duas pernas.',
      state,
      idempotentReplay: true,
    };
  }

  if (
    (debitTx.status !== 'pending' && debitTx.status !== 'internal_transfer') ||
    (creditTx.status !== 'pending' && creditTx.status !== 'internal_transfer') ||
    (debitTx.pairedTransferTransactionId && debitTx.pairedTransferTransactionId !== creditTx.id) ||
    (creditTx.pairedTransferTransactionId && creditTx.pairedTransferTransactionId !== debitTx.id)
  ) {
    return failResult('conflict', 'CONFLICT_ALREADY_MATCHED', 'Uma das transações já foi classificada ou vinculada anteriormente.', state);
  }

  if (debitTx.direction === creditTx.direction) {
    return failResult('failure', 'INVALID_REFS', 'Pareamento interno exige uma saída (débito) e uma entrada (crédito).', state);
  }

  const debitCents = Math.round((debitTx.amount || 0) * 100);
  const creditCents = Math.round((creditTx.amount || 0) * 100);
  if (debitCents !== creditCents || debitCents <= 0) {
    return failResult('failure', 'DIVERGENT_AMOUNTS', 'As duas pernas da transferência interna devem possuir exatamente o mesmo valor em centavos.', state);
  }

  const updatedTxs: BankImportedTransaction[] = txs.map((t) => {
    if (t.id === debitTx.id) {
      return { ...t, status: 'internal_transfer', pairedTransferTransactionId: creditTx.id };
    }
    if (t.id === creditTx.id) {
      return { ...t, status: 'internal_transfer', pairedTransferTransactionId: debitTx.id };
    }
    return t;
  });

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message: 'Transferência interna entre contas confirmada sem gerar receita ou despesa.',
    state: {
      ...state,
      bankImportedTransactions: updatedTxs,
    },
    touchedEntities: {
      bankImportedTransactions: [debitTx.id, creditTx.id],
    },
  };
}

// ==========================================
// 26C — ORÇAMENTO UNIFICADO E REFORÇO TEMPORÁRIO COM ORIGEM AZUL
// ==========================================

export type ReinforcementDistributionMode = 'single_100' | 'custom_percent' | 'equal_split';

export interface ReinforcementDistributionTargetInput {
  category: CategoryKey;
  percentage?: number;
}

export interface ReinforcementDistributionItem {
  category: CategoryKey;
  categoryName: string;
  percentage: number;
  basisPoints: number;
  amountCents: number;
  amountR$: number;
}

export interface ReinforcementDistributionResult {
  ok: boolean;
  error?: string;
  mode: ReinforcementDistributionMode;
  totalSourceCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  totalPercentage: number;
  residualPercentage: number;
  hasPercentageResidue: boolean;
  exceeds100Percent: boolean;
  items: ReinforcementDistributionItem[];
}

export interface EligibleReinforcementSource {
  id: string;
  kind: 'goal_withdrawal' | 'piggy_bank';
  label: string;
  subtitle: string;
  eligible: boolean;
  blockedReason?: string;
  remainingCents: number;
  remainingR$: number;
  sourceRefType: NonNullable<FinancialOperationRecord['sourceRef']>['type'];
  sourceRefId: string;
  sourceOperationId?: string;
  goalId?: string;
  isReconciled: boolean;
  evidenceType: 'bank_reconciled' | 'manual_declared' | 'virtual_earmark';
  date?: string;
  competence?: string;
  revision?: number;
}

export interface PreviewCategoryReinforcementParams {
  sourceKind: 'goal_withdrawal' | 'piggy_bank';
  sourceId: string; // withdrawal operationId OR piggy_bank id
  competence?: string;
  scope?: 'casal' | 'partner1' | 'partner2';
  amountCents?: number;
  amountR$?: number;
  mode: ReinforcementDistributionMode;
  targets: ReinforcementDistributionTargetInput[];
}

export interface CategoryReinforcementPreviewRow {
  category: CategoryKey;
  categoryName: string;
  categoryEmoji: string;
  baseHabitualBudgetR$: number;
  baseHabitualBudgetCents: number;
  basePercentage: number;
  existingReinforcementR$: number;
  existingReallocNetR$: number;
  newReinforcementCents: number;
  newReinforcementR$: number;
  newEffectiveBudgetCents: number;
  newEffectiveBudgetR$: number;
  projectedSpentCents: number;
  projectedSpentR$: number;
  currentNominalBalanceCents: number;
  currentNominalBalanceR$: number;
  newNominalBalanceCents: number;
  newNominalBalanceR$: number;
  percentageApplied: number;
}

export interface PreviewCategoryReinforcementResult {
  ok: boolean;
  reasonCode?: FinancialCommandReasonCode;
  error?: string;
  competence: string;
  scope: 'casal' | 'partner1' | 'partner2';
  sourceLabel: string;
  sourceKind: 'goal_withdrawal' | 'piggy_bank';
  sourceAvailableCents: number;
  isSourceReconciled: boolean;
  sourceEvidenceType: 'bank_reconciled' | 'manual_declared' | 'virtual_earmark';
  totalIncomeUnchangedR$: number;
  distribution: ReinforcementDistributionResult;
  requiresResidueConfirmation: boolean;
  verifiableCashStatus: 'known' | 'partial' | 'unknown';
  verifiableCashNotice?: string;
  categoryPreviews: CategoryReinforcementPreviewRow[];
}

export interface ExecuteCategoryReinforcementParams extends PreviewCategoryReinforcementParams {
  authorizedBy: string;
  authoredByUid?: string;
  date?: string;
  note?: string;
  operationIdPrefix?: string;
  confirmUnallocatedRemainder?: boolean;
  expectedRevision?: number;
  reconciliationRef?: string;
}

export interface ExecuteCategoryReallocationParams {
  fromCategory: CategoryKey;
  toCategory: CategoryKey;
  amountCents?: number;
  amountR$?: number;
  competence?: string;
  date?: string;
  authorizedBy: string;
  authoredByUid?: string;
  scope?: 'casal' | 'partner1' | 'partner2';
  note?: string;
  operationId?: string;
}

/**
 * 26C: Distribuição determinística em centavos inteiros.
 * - `single_100`: 100% em uma categoria canônica
 * - `custom_percent`: usa basis points exatos (ex: 33,33% * 3 = 99,99% -> resíduo de 0,01% e centavos não alocados)
 * - `equal_split`: maior resto determinístico em centavos sem perda
 */
export function distributeReinforcementCents(
  totalCents: number,
  targets: ReinforcementDistributionTargetInput[],
  mode: ReinforcementDistributionMode
): ReinforcementDistributionResult {
  const safeTotal = Number.isSafeInteger(totalCents) && totalCents > 0 ? totalCents : 0;
  const deduped: ReinforcementDistributionTargetInput[] = [];
  const seen = new Set<CategoryKey>();
  for (const t of targets || []) {
    const resolved = resolveCanonicalReinforcementCategory(t.category);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    deduped.push({ category: resolved, percentage: t.percentage });
  }

  if (safeTotal <= 0 || deduped.length === 0) {
    return {
      ok: false,
      error: safeTotal <= 0 ? 'Informe um valor positivo em centavos para distribuir.' : 'Selecione ao menos uma categoria de destino.',
      mode,
      totalSourceCents: safeTotal,
      allocatedCents: 0,
      unallocatedCents: safeTotal,
      totalPercentage: 0,
      residualPercentage: 100,
      hasPercentageResidue: false,
      exceeds100Percent: false,
      items: [],
    };
  }

  if (mode === 'single_100') {
    const target = deduped[0];
    const meta = CATEGORY_PRESENTATION_META[target.category] || { label: target.category, emoji: '🏷️' };
    return {
      ok: true,
      mode,
      totalSourceCents: safeTotal,
      allocatedCents: safeTotal,
      unallocatedCents: 0,
      totalPercentage: 100,
      residualPercentage: 0,
      hasPercentageResidue: false,
      exceeds100Percent: false,
      items: [
        {
          category: target.category,
          categoryName: meta.label,
          percentage: 100,
          basisPoints: 10000,
          amountCents: safeTotal,
          amountR$: roundMoneyCentsCompatible(safeTotal / 100),
        },
      ],
    };
  }

  if (mode === 'equal_split') {
    const count = deduped.length;
    const baseCents = Math.floor(safeTotal / count);
    const remCents = safeTotal - baseCents * count;
    const baseBps = Math.floor(10000 / count);
    const remBps = 10000 - baseBps * count;

    const items: ReinforcementDistributionItem[] = deduped.map((t, idx) => {
      const amountCents = baseCents + (idx < remCents ? 1 : 0);
      const bps = baseBps + (idx < remBps ? 1 : 0);
      const meta = CATEGORY_PRESENTATION_META[t.category] || { label: t.category, emoji: '🏷️' };
      return {
        category: t.category,
        categoryName: meta.label,
        percentage: Math.round(bps) / 100,
        basisPoints: bps,
        amountCents,
        amountR$: roundMoneyCentsCompatible(amountCents / 100),
      };
    });

    return {
      ok: true,
      mode,
      totalSourceCents: safeTotal,
      allocatedCents: safeTotal,
      unallocatedCents: 0,
      totalPercentage: 100,
      residualPercentage: 0,
      hasPercentageResidue: false,
      exceeds100Percent: false,
      items,
    };
  }

  // custom_percent: mantém precisão de 2 casas decimais (basis points: 100% = 10000 bps)
  let totalBps = 0;
  let allocatedCents = 0;
  const items: ReinforcementDistributionItem[] = deduped.map((t) => {
    const rawPct = typeof t.percentage === 'number' && Number.isFinite(t.percentage) ? Math.max(0, t.percentage) : 0;
    const bps = Math.round(rawPct * 100);
    totalBps += bps;
    const amountCents = Math.floor((safeTotal * bps) / 10000);
    allocatedCents += amountCents;
    const meta = CATEGORY_PRESENTATION_META[t.category] || { label: t.category, emoji: '🏷️' };
    return {
      category: t.category,
      categoryName: meta.label,
      percentage: bps / 100,
      basisPoints: bps,
      amountCents,
      amountR$: roundMoneyCentsCompatible(amountCents / 100),
    };
  });

  if (totalBps > 10000) {
    return {
      ok: false,
      error: `A soma das porcentagens (${(totalBps / 100).toFixed(2)}%) ultrapassa 100%. Ajuste antes de confirmar.`,
      mode,
      totalSourceCents: safeTotal,
      allocatedCents,
      unallocatedCents: safeTotal - allocatedCents,
      totalPercentage: totalBps / 100,
      residualPercentage: 0,
      hasPercentageResidue: false,
      exceeds100Percent: true,
      items,
    };
  }

  const residualBps = Math.max(0, 10000 - totalBps);
  const unallocatedCents = Math.max(0, safeTotal - allocatedCents);
  const hasPercentageResidue = residualBps > 0 || unallocatedCents > 0;

  return {
    ok: allocatedCents > 0,
    error: allocatedCents <= 0 ? 'Informe porcentagens positivas para alocar ao menos R$ 0,01.' : undefined,
    mode,
    totalSourceCents: safeTotal,
    allocatedCents,
    unallocatedCents,
    totalPercentage: totalBps / 100,
    residualPercentage: residualBps / 100,
    hasPercentageResidue,
    exceeds100Percent: false,
    items,
  };
}

/**
 * 26C: Lista origens elegíveis (e bloqueadas por liquidação pendente) para reforço de categorias.
 */
export function listEligibleReinforcementSources(
  state: AppState
): EligibleReinforcementSource[] {
  const ops = state.financialOperations || [];
  const results: EligibleReinforcementSource[] = [];

  const getGoalLabel = (ref?: FinancialOperationRecord['sourceRef']): string => {
    if (!ref) return 'Origem Patrimonial';
    if (ref.name && ref.name.trim()) return ref.name;
    if (ref.type === 'protection' || ref.type === 'reserve') return 'Proteção (Reserva)';
    if (ref.type === 'freedom') return 'Liberdade Financeira';
    if (ref.type === 'piggy_bank') {
      return (
        state.piggyBanks?.find((p) => p.id === ref.id)?.name ||
        state.coupleGoals?.find((g) => g.id === ref.id)?.title ||
        ref.id
      );
    }
    return ref.id || 'Meta';
  };

  for (const op of ops) {
    if (!op || op.type !== 'GOAL_WITHDRAWAL') continue;
    if (op.state === 'reverted' || op.state === 'estornado') continue;

    const isPending =
      op.state === 'planned' ||
      op.state === 'pending_settlement' ||
      op.settlementStatus === 'planned' ||
      op.settlementStatus === 'pending_settlement';
    const wNetCents = op.netAmountCents ?? op.amountCents;
    const usedDownstream = ops
      .filter(
        (other) =>
          other.sourceOperationId === op.id &&
          other.state !== 'reverted' &&
          other.state !== 'estornado'
      )
      .reduce((s, o) => s + readOperationAmountCents(o), 0);

    let partitionRemaining = Math.max(0, wNetCents - usedDownstream);
    if (op.partitions && op.partitions.length > 0) {
      const partAvail = op.partitions
        .filter((p) => p.targetType === 'category_reinforcement' || p.targetType === 'cash_free')
        .reduce((s, p) => s + Math.max(0, p.amountCents - (p.consumedCents || 0)), 0);
      partitionRemaining = Math.min(partitionRemaining, partAvail);
    }

    if (!isPending && partitionRemaining <= 0) continue;

    const isReconciled = op.state === 'reconciled' || Boolean(op.reconciliationRef || op.bankTransactionId);
    const goalName = getGoalLabel(op.sourceRef);
    results.push({
      id: op.id,
      kind: 'goal_withdrawal',
      label: `Resgate: ${goalName}`,
      subtitle: isPending
        ? `Aguardando liquidação (${op.date})`
        : isReconciled
        ? `Conciliado em banco • ${op.date}`
        : `Liquidado (manual) • ${op.date}`,
      eligible: !isPending && partitionRemaining > 0,
      blockedReason: isPending
        ? 'Resgate planejado ou em liquidação ainda não pode reforçar o orçamento do mês.'
        : undefined,
      remainingCents: isPending ? wNetCents : partitionRemaining,
      remainingR$: roundMoneyCentsCompatible((isPending ? wNetCents : partitionRemaining) / 100),
      sourceRefType: op.sourceRef?.type || 'piggy_bank',
      sourceRefId: op.sourceRef?.id || op.id,
      sourceOperationId: op.id,
      goalId: op.sourceRef?.type === 'piggy_bank' ? op.sourceRef.id : undefined,
      isReconciled,
      evidenceType: isReconciled ? 'bank_reconciled' : 'manual_declared',
      date: op.date,
      competence: op.competence || op.date.slice(0, 7),
      revision: op.revision,
    });
  }

  const seenGoals = new Set<string>();
  const addPiggySource = (g: SavingsPiggyBank | CoupleGoal, label: string) => {
    if (seenGoals.has(g.id) || g.isDeleted || g.archived) return;
    seenGoals.add(g.id);
    const availCents = getGoalAvailableCents(g);
    if (availCents <= 0) return;
    results.push({
      id: g.id,
      kind: 'piggy_bank',
      label: `Cofrinho: ${label}`,
      subtitle: 'Reserva virtual direta da meta',
      eligible: true,
      remainingCents: availCents,
      remainingR$: roundMoneyCentsCompatible(availCents / 100),
      sourceRefType: 'piggy_bank',
      sourceRefId: g.id,
      goalId: g.id,
      isReconciled: false,
      evidenceType: 'virtual_earmark',
      revision: g.revision ?? 0,
    });
  };

  (state.piggyBanks || []).forEach((p) => addPiggySource(p, p.name));
  (state.coupleGoals || []).forEach((g) => addPiggySource(g, g.title));

  return results;
}

function resolveSnapshotCashStatus(state: AppState): {
  status: 'known' | 'partial' | 'unknown';
  notice?: string;
} {
  const checking = (state.linkedAccounts || []).filter((a) => a.accountType !== 'cartao' && a.accountType !== 'investimento');
  const anchors = state.cashBalanceAnchors || [];
  if (checking.length === 0 && anchors.length === 0) {
    return {
      status: 'unknown',
      notice: 'Caixa verificável desconhecido: nenhuma conta corrente confirmada vinculada. O reforço altera o teto do plano sem provar saldo bancário.',
    };
  }
  const hasUnknown =
    anchors.some((a) => a.balanceStatus === 'unknown') ||
    checking.some((a) => !Number.isFinite(a.balance) || a.status === 'error');
  const hasKnown =
    anchors.some((a) => a.balanceStatus === 'known') ||
    checking.some((a) => Number.isFinite(a.balance) && a.status !== 'error');
  if (hasUnknown && hasKnown) {
    return {
      status: 'partial',
      notice: 'Caixa verificável parcial: nem todas as contas operacionais possuem saldo confirmado atualizado.',
    };
  }
  if (hasUnknown && !hasKnown) {
    return {
      status: 'unknown',
      notice: 'Caixa verificável desconhecido: há conta com saldo pendente de confirmação.',
    };
  }
  return { status: 'known' };
}

/**
 * 26C: Prévia não-mutante de reforço temporário por competência e categoria,
 * exibindo renda inalterada, base habitual, reforço, novo orçamento efetivo e saldo nominal assinado.
 */
export function previewCategoryReinforcement(
  state: AppState,
  params: PreviewCategoryReinforcementParams
): PreviewCategoryReinforcementResult {
  const competence = params.competence || state.currentMonth || '2026-11';
  const scope: 'casal' | 'partner1' | 'partner2' = params.scope || 'casal';
  const sources = listEligibleReinforcementSources(state);
  const selectedSource = sources.find(
    (s) => s.kind === params.sourceKind && (s.id === params.sourceId || s.sourceOperationId === params.sourceId)
  );
  const cashCheck = resolveSnapshotCashStatus(state);

  const plan = state.monthlyBudgetPlans?.[competence];
  const profileIncome =
    scope === 'casal'
      ? (state.profile?.partner1Income || 0) + (state.profile?.partner2Income || 0)
      : scope === 'partner1'
      ? state.profile?.partner1Income || 0
      : state.profile?.partner2Income || 0;
  const plannedNetIncome =
    scope === 'casal'
      ? plan?.plannedNetIncome !== undefined && Number.isFinite(plan.plannedNetIncome)
        ? Math.max(0, plan.plannedNetIncome)
        : profileIncome
      : plan?.partnerCeilings?.[scope]?.plannedNetIncome ?? profileIncome;

  const failPreview = (
    reasonCode: FinancialCommandReasonCode,
    error: string,
    avail = 0
  ): PreviewCategoryReinforcementResult => ({
    ok: false,
    reasonCode,
    error,
    competence,
    scope,
    sourceLabel: selectedSource?.label || 'Origem não selecionada',
    sourceKind: params.sourceKind,
    sourceAvailableCents: avail,
    isSourceReconciled: Boolean(selectedSource?.isReconciled),
    sourceEvidenceType: selectedSource?.evidenceType || 'manual_declared',
    totalIncomeUnchangedR$: roundMoneyCentsCompatible(plannedNetIncome),
    distribution: {
      ok: false,
      error,
      mode: params.mode,
      totalSourceCents: 0,
      allocatedCents: 0,
      unallocatedCents: 0,
      totalPercentage: 0,
      residualPercentage: 100,
      hasPercentageResidue: false,
      exceeds100Percent: false,
      items: [],
    },
    requiresResidueConfirmation: false,
    verifiableCashStatus: cashCheck.status,
    verifiableCashNotice: cashCheck.notice,
    categoryPreviews: [],
  });

  if (!/^\d{4}-\d{2}$/.test(competence)) {
    return failPreview('INVALID_DATE', `Competência inválida: "${competence}".`);
  }
  if (!selectedSource) {
    return failPreview('OPERATION_NOT_FOUND', 'Origem do reforço não encontrada ou já integralmente alocada.');
  }
  if (!selectedSource.eligible) {
    return failPreview('INVALID_REFS', selectedSource.blockedReason || 'Origem bloqueada para reforço.', selectedSource.remainingCents);
  }

  const desiredCents =
    params.amountCents !== undefined
      ? Math.round(params.amountCents)
      : params.amountR$ !== undefined
      ? Math.round(params.amountR$ * 100)
      : selectedSource.remainingCents;

  if (!Number.isSafeInteger(desiredCents) || desiredCents <= 0) {
    return failPreview('INVALID_AMOUNT', 'Informe um valor positivo em centavos para reforçar.', selectedSource.remainingCents);
  }
  if (desiredCents > selectedSource.remainingCents) {
    return failPreview(
      'INSUFFICIENT_FUNDS',
      `Valor solicitado (R$ ${(desiredCents / 100).toFixed(2)}) excede o líquido elegível (R$ ${(selectedSource.remainingCents / 100).toFixed(2)}).`,
      selectedSource.remainingCents
    );
  }

  const distribution = distributeReinforcementCents(desiredCents, params.targets, params.mode);
  if (!distribution.ok) {
    return {
      ...failPreview('INVALID_AMOUNT', distribution.error || 'Distribuição inválida.', selectedSource.remainingCents),
      distribution,
    };
  }

  // Calcular gastos já reconhecidos + reforços/realocações ativos na competência em centavos inteiros
  const existingReinfCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const existingReallocNetCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };
  const spentCents: Record<CategoryKey, number> = {
    moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0,
  };

  for (const op of state.financialOperations || []) {
    if (!op) continue;
    if (
      op.state === 'reverted' ||
      op.state === 'estornado' ||
      op.state === 'planned' ||
      op.state === 'pending_settlement' ||
      op.settlementStatus === 'planned' ||
      op.settlementStatus === 'pending_settlement'
    ) {
      continue;
    }
    const opComp = op.competence || (op.date ? op.date.slice(0, 7) : '');
    if (opComp !== competence) continue;
    const rawCents = readOperationAmountCents(op);
    if (rawCents <= 0) continue;

    if (op.type === 'CATEGORY_REINFORCEMENT' && op.targetRef?.type === 'category') {
      const cat = resolveCanonicalReinforcementCategory(op.targetRef.id);
      if (cat) existingReinfCents[cat] += rawCents;
    } else if (
      op.type === 'CATEGORY_REALLOCATION' &&
      op.sourceRef?.type === 'category' &&
      op.targetRef?.type === 'category'
    ) {
      const fromCat = resolveCanonicalReinforcementCategory(op.sourceRef.id);
      const toCat = resolveCanonicalReinforcementCategory(op.targetRef.id);
      if (fromCat && toCat && fromCat !== toCat) {
        existingReallocNetCents[fromCat] -= rawCents;
        existingReallocNetCents[toCat] += rawCents;
      }
    }
  }

  if (scope === 'casal') {
    for (const adj of Object.values(state.temporaryBudgetAdjustments || {})) {
      if (adj && adj.expiresAt && adj.expiresAt.slice(0, 7) === competence) {
        const cat = resolveCanonicalReinforcementCategory(adj.category);
        if (cat) existingReinfCents[cat] += toSafeCents(adj.amount);
      }
    }
  }

  // Ocorrências fixas + fatias variáveis + parcelas para saldo nominal preciso
  const { occurrences: fixedOccs } = projectSharedFixedOccurrences(state, competence, scope);
  for (const occ of fixedOccs) {
    const cat = mapToCanonicalCategoryKey(occ.categoryKey);
    spentCents[cat] += occ.apportionedAmountCents;
  }

  const expenses = state.expenses || [];
  const parentIdsWithSplits = new Set(expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id));
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
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (split.isInScope) {
        spentCents[mapToCanonicalCategoryKey(slice.category)] += split.scopedCents;
      }
    }
  }
  const instOccs = projectInstallmentOccurrencesForCompetence(state, competence, scope);
  for (const instOcc of instOccs) {
    if (instOcc.isFixedNature || instOcc.isExcludedFromMonthlyBudget) continue;
    spentCents[mapToCanonicalCategoryKey(instOcc.category)] += instOcc.scopedCents;
  }

  const pcts = plan?.categoryPercentages || state.categoryPercentages || {
    moradia: 30, transporte: 10, comida: 25, lazer: 15, protecao: 10, profissional: 0,
  };

  const categoryPreviews: CategoryReinforcementPreviewRow[] = distribution.items.map((item) => {
    const cat = item.category;
    const basePct = pcts[cat] ?? 0;
    let baseBudgetCents = 0;
    if (scope === 'casal' && plan?.categoryAmountsR$?.[cat] !== undefined) {
      baseBudgetCents = Math.round(plan.categoryAmountsR$[cat] * 100);
    } else if (scope !== 'casal' && plan?.partnerCeilings?.[scope]?.categoryAmountsR$?.[cat] !== undefined) {
      baseBudgetCents = Math.round(plan.partnerCeilings[scope]!.categoryAmountsR$![cat]! * 100);
    } else {
      baseBudgetCents = Math.round((plannedNetIncome * basePct) / 100 * 100);
    }
    const existingReinf = existingReinfCents[cat];
    const existingRealloc = existingReallocNetCents[cat];
    const curEffCents = baseBudgetCents + existingReinf + existingRealloc;
    const newEffCents = curEffCents + item.amountCents;
    const spent = spentCents[cat];
    const curBalanceCents = curEffCents - spent;
    const newBalanceCents = newEffCents - spent;
    const meta = CATEGORY_PRESENTATION_META[cat] || { label: cat, emoji: '🏷️' };

    return {
      category: cat,
      categoryName: meta.label,
      categoryEmoji: meta.emoji,
      baseHabitualBudgetR$: roundMoneyCentsCompatible(baseBudgetCents / 100),
      baseHabitualBudgetCents: baseBudgetCents,
      basePercentage: basePct,
      existingReinforcementR$: roundMoneyCentsCompatible(existingReinf / 100),
      existingReallocNetR$: roundMoneyCentsCompatible(existingRealloc / 100),
      newReinforcementCents: item.amountCents,
      newReinforcementR$: item.amountR$,
      newEffectiveBudgetCents: newEffCents,
      newEffectiveBudgetR$: roundMoneyCentsCompatible(newEffCents / 100),
      projectedSpentCents: spent,
      projectedSpentR$: roundMoneyCentsCompatible(spent / 100),
      currentNominalBalanceCents: curBalanceCents,
      currentNominalBalanceR$: roundMoneyCentsCompatible(curBalanceCents / 100),
      newNominalBalanceCents: newBalanceCents,
      newNominalBalanceR$: roundMoneyCentsCompatible(newBalanceCents / 100),
      percentageApplied: item.percentage,
    };
  });

  return {
    ok: true,
    competence,
    scope,
    sourceLabel: selectedSource.label,
    sourceKind: selectedSource.kind,
    sourceAvailableCents: selectedSource.remainingCents,
    isSourceReconciled: selectedSource.isReconciled,
    sourceEvidenceType: selectedSource.evidenceType,
    totalIncomeUnchangedR$: roundMoneyCentsCompatible(plannedNetIncome),
    distribution,
    requiresResidueConfirmation: distribution.hasPercentageResidue,
    verifiableCashStatus: cashCheck.status,
    verifiableCashNotice: cashCheck.notice,
    categoryPreviews,
  };
}

/**
 * 26C: Executa atomicamente reforço(s) temporário(s) em categoria(s) usando o pipeline de comandos canônico.
 * Exige confirmação explícita quando houver resíduo de porcentagem (ex: 33,33% * 3 = 99,99%).
 */
export function executeCategoryReinforcementCommand(
  state: AppState,
  params: ExecuteCategoryReinforcementParams
): FinancialCommandResult {
  const preview = previewCategoryReinforcement(state, params);
  if (!preview.ok) {
    return failResult('failure', preview.reasonCode || 'INVALID_AMOUNT', preview.error || 'Prévia de reforço inválida.', state);
  }

  if (preview.requiresResidueConfirmation && params.confirmUnallocatedRemainder !== true) {
    return failResult(
      'conflict',
      'CONFIRMATION_REQUIRED',
      `Distribuição soma ${preview.distribution.totalPercentage.toFixed(2)}% (resíduo de ${preview.distribution.residualPercentage.toFixed(2)}% / R$ ${(preview.distribution.unallocatedCents / 100).toFixed(2)} não alocado). Ajuste ou confirme explicitamente antes de gravar.`,
      state
    );
  }

  const sources = listEligibleReinforcementSources(state);
  const selectedSource = sources.find(
    (s) => s.kind === params.sourceKind && (s.id === params.sourceId || s.sourceOperationId === params.sourceId)
  )!;

  const dateStr = params.date || `${preview.competence}-15`;
  const opPrefix =
    params.operationIdPrefix ||
    `op-reinf-${preview.competence}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  let workingState = state;
  const createdOps: FinancialOperationRecord[] = [];
  const mergedTouched: FinancialCommandTouchedEntities = {
    financialOperations: [],
    piggyBanks: [],
    coupleGoals: [],
  };

  for (let i = 0; i < preview.distribution.items.length; i++) {
    const item = preview.distribution.items[i];
    if (item.amountCents <= 0) continue;

    const opRecord: FinancialOperationRecord = {
      id: `${opPrefix}-${i + 1}-${item.category}`,
      type: 'CATEGORY_REINFORCEMENT',
      amountCents: item.amountCents,
      amountR$: item.amountR$,
      authorizedBy: params.authorizedBy,
      authoredByUid: params.authoredByUid || params.authorizedBy,
      scope: preview.scope === 'casal' ? 'couple' : preview.scope,
      sourceRef: {
        type: selectedSource.sourceRefType,
        id: selectedSource.sourceRefId,
        name: selectedSource.label.replace(/^Resgate:\s*|^Cofrinho:\s*/i, ''),
      },
      targetRef: {
        type: 'category',
        id: item.category,
        name: item.categoryName,
      },
      sourceOperationId: selectedSource.sourceOperationId,
      competence: preview.competence,
      date: dateStr,
      state: selectedSource.isReconciled ? 'reconciled' : 'occurred_manual',
      reconciliationRef: params.reconciliationRef || (selectedSource.isReconciled ? `reinf:${selectedSource.id}` : undefined),
      expectedRevision: i === 0 ? params.expectedRevision : undefined,
      notes:
        params.note ||
        `Reforço temporário (${item.percentage.toFixed(2).replace('.', ',')}%) em ${item.categoryName} para ${preview.competence}`,
    };

    const stepRes = runFinancialCommand(workingState, opRecord);
    if (stepRes.status !== 'success' || !stepRes.operation) {
      // Rollback completo retornando state original intocado
      return failResult(
        stepRes.status === 'conflict' ? 'conflict' : 'failure',
        stepRes.reasonCode,
        stepRes.message,
        state
      );
    }

    workingState = stepRes.state;
    createdOps.push(stepRes.operation);
    if (stepRes.touchedEntities?.financialOperations) {
      mergedTouched.financialOperations = Array.from(
        new Set([...(mergedTouched.financialOperations || []), ...stepRes.touchedEntities.financialOperations])
      );
    }
    if (stepRes.touchedEntities?.piggyBanks) {
      mergedTouched.piggyBanks = Array.from(
        new Set([...(mergedTouched.piggyBanks || []), ...stepRes.touchedEntities.piggyBanks])
      );
    }
    if (stepRes.touchedEntities?.coupleGoals) {
      mergedTouched.coupleGoals = Array.from(
        new Set([...(mergedTouched.coupleGoals || []), ...stepRes.touchedEntities.coupleGoals])
      );
    }
  }

  return {
    status: 'success',
    reasonCode: 'EXECUTED',
    message:
      createdOps.length === 1
        ? 'Reforço temporário registrado no orçamento da competência.'
        : `${createdOps.length} reforços temporários registrados no orçamento da competência.`,
    state: workingState,
    operation: createdOps[0],
    operations: createdOps,
    touchedEntities: mergedTouched,
  };
}

/**
 * 26C: Executa realocação canônica entre categorias na competência (CATEGORY_REALLOCATION)
 * substituindo despesas negativas legadas por comando rastreável sem inflar renda.
 */
export function executeCategoryReallocationCommand(
  state: AppState,
  params: ExecuteCategoryReallocationParams
): FinancialCommandResult {
  const fromCat = resolveCanonicalReinforcementCategory(params.fromCategory);
  const toCat = resolveCanonicalReinforcementCategory(params.toCategory);
  if (!fromCat || !toCat || fromCat === toCat) {
    return failResult('failure', 'INVALID_REFS', 'Selecione duas categorias canônicas distintas para realocar orçamento.', state);
  }
  const money = normalizeMonetaryBoundary({
    amountCents: params.amountCents,
    amountR$: params.amountR$,
  });
  if (!money.ok) {
    return failResult('failure', money.reasonCode, money.error, state);
  }
  const competence = params.competence || state.currentMonth || '2026-11';
  if (!/^\d{4}-\d{2}$/.test(competence)) {
    return failResult('failure', 'INVALID_DATE', `Competência inválida: "${competence}".`, state);
  }
  const dateStr = params.date || `${competence}-15`;
  const fromLabel = CATEGORY_PRESENTATION_META[fromCat]?.label || fromCat;
  const toLabel = CATEGORY_PRESENTATION_META[toCat]?.label || toCat;

  const opRecord: FinancialOperationRecord = {
    id: params.operationId || `op-realloc-${competence}-${fromCat}-${toCat}-${Date.now().toString(36)}`,
    type: 'CATEGORY_REALLOCATION',
    amountCents: money.amountCents,
    amountR$: money.amountR$,
    authorizedBy: params.authorizedBy,
    authoredByUid: params.authoredByUid || params.authorizedBy,
    scope: params.scope === 'partner1' || params.scope === 'partner2' ? params.scope : 'couple',
    sourceRef: { type: 'category', id: fromCat, name: fromLabel },
    targetRef: { type: 'category', id: toCat, name: toLabel },
    competence,
    date: dateStr,
    state: 'occurred_manual',
    notes: params.note || `Realocação de orçamento: ${fromLabel} → ${toLabel} (${competence})`,
  };

  return runFinancialCommand(state, opRecord);
}
