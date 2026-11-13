import type {
  AppState,
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
  PaidBy,
  SavingsPiggyBank,
  StrategicSpendingIntent,
  TransactionSplit,
} from '../types/finance';

const MAX_REAIS_BOUND = 90071992547409;
const MAX_EXPENSE_REAIS = 10000000;
const VALID_SCOPES = new Set(['couple', 'casal', 'partner1', 'partner2']);

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
  >,
  normalizedCents: number
): string {
  const payload = {
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
  let nextProtAmount = state.protectionCurrentAmount || 0;
  let nextProtInvested = state.protectionTotalInvested || 0;
  let nextProtComplete = Boolean(state.isProtectionComplete);

  const piggyById = new Map(nextPiggyBanks.map((p) => [p.id, p]));
  const coupleGoalById = new Map(nextCoupleGoals.map((g) => [g.id, g]));

  const findGoal = (goalId: string) => {
    const piggy = piggyById.get(goalId);
    const coupleGoal = coupleGoalById.get(goalId);
    if (!piggy && !coupleGoal) return { exists: false as const };
    const archived = Boolean(piggy?.archived || coupleGoal?.archived || piggy?.isDeleted || coupleGoal?.isDeleted);
    const currentEntity = piggy || coupleGoal!;
    return {
      exists: true as const,
      archived,
      piggy,
      coupleGoal,
      revision: currentEntity.revision ?? 0,
      availableCents: getGoalAvailableCents(currentEntity),
      accumulatedCents: getGoalAccumulatedCents(currentEntity),
      committedCents: isValidFiniteNumber(currentEntity.committedCents) ? Math.round(currentEntity.committedCents) : 0,
      utilizedCents: isValidFiniteNumber(currentEntity.utilizedCents) ? Math.round(currentEntity.utilizedCents) : 0,
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

  const applyGoalCentsUpdate = (
    goalId: string,
    delta: {
      accumulatedDeltaCents: number;
      committedDeltaCents: number;
      utilizedDeltaCents: number;
      contributionDeltaCents: number; // + for deposit, - for withdrawal/purchase
      historyType?: 'deposit' | 'withdrawal';
      historyNote?: string;
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

    if (goalInfo.piggy) {
      const targetCents = Math.round((goalInfo.piggy.targetAmount || 0) * 100);
      nextPiggyBanks = nextPiggyBanks.map((p) => {
        if (p.id !== goalId) return p;
        const nextTotalInvested =
          p.totalInvested !== undefined
            ? Math.max(0, Math.round((p.totalInvested || 0) * 100 + delta.accumulatedDeltaCents)) / 100
            : undefined;
        return {
          ...p,
          currentAmount: newCurrentAmount,
          accumulatedCents: newAccumulatedCents,
          committedCents: newCommittedCents,
          utilizedCents: newUtilizedCents,
          availableCents: newAvailableCents,
          totalInvested: nextTotalInvested,
          completed: targetCents > 0 ? newAvailableCents >= targetCents : p.completed,
          revision: nextRevision,
          lastOperationId: rawOperation.id,
        };
      });
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), goalId]));
    }

    if (goalInfo.coupleGoal) {
      const targetCents = Math.round((goalInfo.coupleGoal.targetAmount || 0) * 100);
      let p1DeltaCents = 0;
      let p2DeltaCents = 0;
      if (delta.contributionDeltaCents !== 0) {
        if (contributorRole === 'partner1') p1DeltaCents = delta.contributionDeltaCents;
        else if (contributorRole === 'partner2') p2DeltaCents = delta.contributionDeltaCents;
        else {
          p1DeltaCents = Math.trunc(delta.contributionDeltaCents / 2);
          p2DeltaCents = delta.contributionDeltaCents - p1DeltaCents;
        }
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
                  money.amountR$,
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

  // Validate sourceRef / targetRef and execute transition by type
  if (rawOperation.type === 'GOAL_DEPOSIT') {
    if (!rawOperation.sourceRef?.type || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Aporte exige origem válida (sourceRef).', state);
    }
    if (rawOperation.targetRef?.type !== 'piggy_bank' || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Aporte exige meta/cofrinho de destino válido (targetRef).', state);
    }
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

    applyGoalCentsUpdate(goalId, {
      accumulatedDeltaCents: money.amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: money.amountCents,
      historyType: 'deposit',
    });
  } else if (rawOperation.type === 'GOAL_WITHDRAWAL') {
    if (rawOperation.sourceRef?.type !== 'piggy_bank' || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Resgate exige meta/cofrinho de origem válido (sourceRef).', state);
    }
    if (!rawOperation.targetRef?.type || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Resgate exige destino válido (targetRef).', state);
    }
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
    if (goalInfo.availableCents < money.amountCents) {
      return failResult(
        'failure',
        'INSUFFICIENT_FUNDS',
        `Saldo insuficiente na meta "${goalInfo.piggy?.name || goalInfo.coupleGoal?.title || goalId}" (R$ ${(goalInfo.availableCents / 100).toFixed(2)}) para operação de R$ ${money.amountR$.toFixed(2)}. Não é permitido clamp silencioso.`,
        state
      );
    }

    applyGoalCentsUpdate(goalId, {
      accumulatedDeltaCents: -money.amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: -money.amountCents,
      historyType: 'withdrawal',
    });
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
        historyType: 'withdrawal',
        historyNote: rawOperation.notes || `Compra direta: ${rawOperation.targetRef.name || rawOperation.targetRef.id}`,
      });
    } else if (rawOperation.sourceRef.type === 'reserve') {
      const currentProtCents = Math.round((state.protectionCurrentAmount || 0) * 100);
      const currentInvestedCents = Math.round((state.protectionTotalInvested || 0) * 100);
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
      const nextInvestedCents = Math.max(0, currentInvestedCents - money.amountCents);
      nextProtAmount = nextProtCents / 100;
      nextProtInvested = nextInvestedCents / 100;
      nextProtComplete = floorCents > 0 ? nextProtCents >= floorCents : state.isProtectionComplete;
      touched.protectionUpdated = true;
    } else {
      return failResult('failure', 'INVALID_REFS', `Origem não suportada em compra direta: "${rawOperation.sourceRef.type}".`, state);
    }
  } else if (rawOperation.type === 'GOAL_TRANSFER') {
    if (
      rawOperation.sourceRef?.type !== 'piggy_bank' ||
      !rawOperation.sourceRef?.id?.trim() ||
      rawOperation.targetRef?.type !== 'piggy_bank' ||
      !rawOperation.targetRef?.id?.trim()
    ) {
      return failResult('failure', 'INVALID_REFS', 'Transferência exige cofrinho de origem e cofrinho de destino válidos.', state);
    }
    const sourceId = rawOperation.sourceRef.id;
    const targetId = rawOperation.targetRef.id;
    if (sourceId === targetId) {
      return failResult('failure', 'INVALID_REFS', 'Origem e destino da transferência devem ser distintos.', state);
    }
    const sourceInfo = findGoal(sourceId);
    const targetInfo = findGoal(targetId);
    if (!sourceInfo.exists) {
      return failResult('failure', 'GOAL_NOT_FOUND', `Meta de origem "${sourceId}" não encontrada.`, state);
    }
    if (!targetInfo.exists) {
      return failResult('failure', 'GOAL_NOT_FOUND', `Meta de destino "${targetId}" não encontrada.`, state);
    }
    if (sourceInfo.archived || targetInfo.archived) {
      return failResult('failure', 'GOAL_ARCHIVED', 'Transferência não permitida envolvendo meta arquivada.', state);
    }
    const revErr = checkExpectedRevision(sourceInfo.revision, `meta ${sourceId}`);
    if (revErr) return revErr;
    if (sourceInfo.availableCents < money.amountCents) {
      return failResult(
        'failure',
        'INSUFFICIENT_FUNDS',
        `Saldo insuficiente na meta de origem "${sourceId}" (R$ ${(sourceInfo.availableCents / 100).toFixed(2)}) para transferência de R$ ${money.amountR$.toFixed(2)}.`,
        state
      );
    }

    applyGoalCentsUpdate(sourceId, {
      accumulatedDeltaCents: -money.amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: -money.amountCents,
      historyType: 'withdrawal',
      historyNote: rawOperation.notes || `Transferência para ${targetId}`,
    });
    applyGoalCentsUpdate(targetId, {
      accumulatedDeltaCents: money.amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: money.amountCents,
      historyType: 'deposit',
      historyNote: rawOperation.notes || `Transferência recebida de ${sourceId}`,
    });
  } else if (rawOperation.type === 'CATEGORY_REINFORCEMENT') {
    if (rawOperation.sourceRef?.type !== 'piggy_bank' || !rawOperation.sourceRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Reforço de categoria exige cofrinho de origem válido.', state);
    }
    if (rawOperation.targetRef?.type !== 'category' || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Reforço de categoria exige categoria de destino válida.', state);
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
      historyType: 'withdrawal',
      historyNote: rawOperation.notes || `Reforço categoria ${rawOperation.targetRef.id}`,
    });
  } else {
    // EXPENSE_RECORD / INCOME_RECORD
    if (!rawOperation.sourceRef?.type || !rawOperation.sourceRef?.id?.trim() || !rawOperation.targetRef?.type || !rawOperation.targetRef?.id?.trim()) {
      return failResult('failure', 'INVALID_REFS', 'Operação financeira requer sourceRef e targetRef válidos.', state);
    }
  }

  const persistedOp: FinancialOperationRecord = {
    ...rawOperation,
    amountCents: money.amountCents,
    amountR$: money.amountR$,
    authorizedBy,
    authoredByUid: rawOperation.authoredByUid || authorizedBy,
    scope: rawOperation.scope ? normalizeCommandScope(rawOperation.scope) : 'couple',
    competence: rawOperation.competence || dateStr.slice(0, 7),
    occurredAt,
    confirmedAt: nowIso,
    state: resolvedState,
    commandFingerprint: normalizedFingerprint,
    createdAt: rawOperation.createdAt || nowIso,
  };

  const nextState: AppState = {
    ...state,
    financialOperations: [...existingOps, persistedOp],
    piggyBanks: nextPiggyBanks,
    coupleGoals: nextCoupleGoals,
    protectionCurrentAmount: nextProtAmount,
    protectionTotalInvested: nextProtInvested,
    isProtectionComplete: nextProtComplete,
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
  const original = ops.find((op) => op.id === operationId);
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

  const nowIso = meta?.nowIso || new Date().toISOString();
  const reversalId = meta?.reversalOperationId || `rev-${operationId}`;
  const touched: FinancialCommandTouchedEntities = {
    financialOperations: [operationId],
  };

  let nextPiggyBanks = [...(state.piggyBanks || [])];
  let nextCoupleGoals = [...(state.coupleGoals || [])];
  let nextProtAmount = state.protectionCurrentAmount || 0;
  let nextProtInvested = state.protectionTotalInvested || 0;
  let nextProtComplete = Boolean(state.isProtectionComplete);

  const findGoal = (goalId: string) => {
    const piggy = nextPiggyBanks.find((p) => p.id === goalId);
    const coupleGoal = nextCoupleGoals.find((g) => g.id === goalId);
    if (!piggy && !coupleGoal) return { exists: false as const };
    if (piggy?.isDeleted || coupleGoal?.isDeleted) return { exists: false as const };
    const currentEntity = piggy || coupleGoal!;
    return {
      exists: true as const,
      piggy,
      coupleGoal,
      revision: currentEntity.revision ?? 0,
      availableCents: getGoalAvailableCents(currentEntity),
      accumulatedCents: getGoalAccumulatedCents(currentEntity),
      committedCents: isValidFiniteNumber(currentEntity.committedCents) ? Math.round(currentEntity.committedCents) : 0,
      utilizedCents: isValidFiniteNumber(currentEntity.utilizedCents) ? Math.round(currentEntity.utilizedCents) : 0,
    };
  };

  const applyGoalReversalDelta = (
    goalId: string,
    delta: {
      accumulatedDeltaCents: number;
      committedDeltaCents: number;
      utilizedDeltaCents: number;
      contributionDeltaCents: number;
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
          completed: targetCents > 0 ? newAvailable >= targetCents : p.completed,
          revision: nextRevision,
          lastOperationId: reversalId,
        };
      });
      touched.piggyBanks = Array.from(new Set([...(touched.piggyBanks || []), goalId]));
    }

    if (info.coupleGoal) {
      const targetCents = Math.round((info.coupleGoal.targetAmount || 0) * 100);
      let p1Delta = 0;
      let p2Delta = 0;
      if (delta.contributionDeltaCents !== 0) {
        if (original.authorizedBy === 'partner1') p1Delta = delta.contributionDeltaCents;
        else if (original.authorizedBy === 'partner2') p2Delta = delta.contributionDeltaCents;
        else {
          p1Delta = Math.trunc(delta.contributionDeltaCents / 2);
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

  if (original.type === 'GOAL_DEPOSIT') {
    const goalId = original.targetRef?.id;
    if (!goalId) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Operação de aporte sem destino vinculado.', state);
    }
    const info = findGoal(goalId);
    if (!info.exists) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', `Meta "${goalId}" não existe mais para estorno do aporte.`, state);
    }
    if (info.availableCents < amountCents) {
      return failResult(
        'failure',
        'INSUFFICIENT_FUNDS',
        `Estorno de aporte bloqueado: saldo disponível em "${goalId}" (R$ ${(info.availableCents / 100).toFixed(2)}) é menor que R$ ${(amountCents / 100).toFixed(2)}.`,
        state
      );
    }
    applyGoalReversalDelta(goalId, {
      accumulatedDeltaCents: -amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: -amountCents,
    });
  } else if (original.type === 'GOAL_WITHDRAWAL') {
    const goalId = original.sourceRef?.id;
    if (!goalId) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Operação de resgate sem origem vinculada.', state);
    }
    const info = findGoal(goalId);
    if (!info.exists) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', `Meta "${goalId}" não existe mais para estorno do resgate.`, state);
    }
    applyGoalReversalDelta(goalId, {
      accumulatedDeltaCents: amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: amountCents,
    });
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
      });
    } else if (original.sourceRef?.type === 'reserve') {
      const floorCents =
        meta?.reserveFloorCents !== undefined
          ? Math.round(meta.reserveFloorCents)
          : Math.round((meta?.reserveFloorR$ ?? 0) * 100);
      const nextProtCents = Math.round((state.protectionCurrentAmount || 0) * 100) + amountCents;
      const nextInvestedCents = Math.round((state.protectionTotalInvested || 0) * 100) + amountCents;
      nextProtAmount = nextProtCents / 100;
      nextProtInvested = nextInvestedCents / 100;
      nextProtComplete = floorCents > 0 ? nextProtCents >= floorCents : state.isProtectionComplete;
      touched.protectionUpdated = true;
    }
  } else if (original.type === 'CATEGORY_REINFORCEMENT') {
    const goalId = original.sourceRef?.id;
    if (!goalId || !findGoal(goalId).exists) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta de reforço ausente para estorno.', state);
    }
    applyGoalReversalDelta(goalId, {
      accumulatedDeltaCents: 0,
      committedDeltaCents: -amountCents,
      utilizedDeltaCents: 0,
      contributionDeltaCents: 0,
    });
  } else if (original.type === 'GOAL_TRANSFER') {
    const sourceId = original.sourceRef?.id;
    const targetId = original.targetRef?.id;
    if (!sourceId || !targetId) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Transferência sem metas válidas.', state);
    }
    const sourceInfo = findGoal(sourceId);
    const targetInfo = findGoal(targetId);
    if (!sourceInfo.exists || !targetInfo.exists) {
      return failResult('failure', 'REVERSAL_DEPENDENCY_ERROR', 'Meta de origem ou destino ausente para estorno.', state);
    }
    if (targetInfo.availableCents < amountCents) {
      return failResult(
        'failure',
        'INSUFFICIENT_FUNDS',
        `Estorno de transferência bloqueado: saldo insuficiente em "${targetId}".`,
        state
      );
    }
    applyGoalReversalDelta(targetId, {
      accumulatedDeltaCents: -amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: -amountCents,
    });
    applyGoalReversalDelta(sourceId, {
      accumulatedDeltaCents: amountCents,
      committedDeltaCents: 0,
      utilizedDeltaCents: 0,
      contributionDeltaCents: amountCents,
    });
  }

  const revertedOriginal: FinancialOperationRecord = {
    ...original,
    state: 'reverted',
    revertedBy: reversalId,
    reversedAt: nowIso,
    notes: meta?.reason ? `${original.notes ? original.notes + ' | ' : ''}Estornado: ${meta.reason}` : original.notes,
  };

  const nextState: AppState = {
    ...state,
    financialOperations: ops.map((op) => (op.id === operationId ? revertedOriginal : op)),
    piggyBanks: nextPiggyBanks,
    coupleGoals: nextCoupleGoals,
    protectionCurrentAmount: nextProtAmount,
    protectionTotalInvested: nextProtInvested,
    isProtectionComplete: nextProtComplete,
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
  if (target.linkedBillId && target.billCompetenceMonth) {
    nextBills = nextBills.map((b) => {
      if (b.id !== target.linkedBillId) return b;
      const history = { ...(b.history || {}) };
      delete history[target.billCompetenceMonth!];
      return { ...b, status: 'pending' as const, history };
    });
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
  const opId = params.operationId || `op-${params.direction}-${params.goalId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
        : { type: 'piggy_bank', id: params.goalId },
    targetRef:
      params.direction === 'deposit'
        ? { type: 'piggy_bank', id: params.goalId }
        : { type: 'external', id: 'manual-resgate', name: 'Resgate manual' },
    competence: dateStr.slice(0, 7),
    date: dateStr,
    occurredAt: dateStr,
    confirmedAt: nowIso,
    expectedRevision: params.expectedRevision,
    state: params.reconciliationRef ? 'reconciled' : 'occurred_manual',
    reconciliationRef: params.reconciliationRef,
    notes: params.note,
  };

  return runFinancialCommand(state, op, { nowIso, contributor });
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
