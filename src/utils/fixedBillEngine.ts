import {
  AppState,
  CategoryKey,
  CeilingState,
  ExpenseNature,
  ExpensePriority,
  FixedBillRegistryConflict,
  PaidBy,
} from '../types/finance';
import { selectReconciledBudgetMatrix } from './domainSelectors';
import {
  projectSharedFixedOccurrences,
  roundMoney,
} from './occurrenceProjection';

export type DomainScope = 'casal' | 'partner1' | 'partner2';

export interface FixedBillOccurrence {
  occurrenceId: string; // `${billId}:${monthKey}` para recorrências ou ID estável de fatia/parcela
  billId: string;
  title: string;
  category: CategoryKey;
  amountPlanned: number;
  amountEffective: number;
  apportionedAmount: number;
  amountPlannedCents?: number;
  amountEffectiveCents?: number;
  apportionedAmountCents?: number;
  dueDate: string; // YYYY-MM-DD
  competenceMonth: string; // YYYY-MM
  assignedPayer: PaidBy;
  status: 'paid' | 'pending' | 'overdue';
  paidAt?: string;
  paidAmount?: number;
  paymentMethod?: string;
  linkedExpenseId?: string;
  linkedSliceId?: string;
  isEssential: boolean;
  priority?: ExpensePriority;
  nature?: ExpenseNature;
  sourceType?: 'fixed_bill' | 'fixed_expense' | 'fixed_installment';
  isRecurring: boolean;
  active: boolean;
  isDirectExpense?: boolean;
}

export interface FixedCategoryBreakdown {
  categoryKey: CategoryKey;
  categoryName: string;
  emoji: string;
  fixedSpentR$: number;
  pendingR$: number;
  committedR$: number;
  pctOfFixedCeiling: number; // comprometido / teto_fixo_global * 100
  pctOfFixedCommitted: number; // comprometido / total_fixo_comprometido * 100
  localCategoryCeilingR$: number;
  pctOfLocalCategoryCeiling: number;
  occurrences: FixedBillOccurrence[];
}

export interface FixedBillsSummaryResult {
  competenceMonth: string;
  scope: DomainScope;
  fixedCeilingR$: number;
  hasExplicitCeiling: boolean;
  ceilingState: CeilingState;
  denominatorLabel: string;
  realizedLiquidR$: number;
  pendingR$: number;
  projectedCommittedR$: number;
  signedMarginR$: number;
  pctConsumedOfCeiling: number;
  pctConsumedOfCeilingNullable: number | null;
  hasExcess: boolean;
  excessR$: number;
  categories: FixedCategoryBreakdown[];
  allOccurrences: FixedBillOccurrence[];
  registryConflicts: FixedBillRegistryConflict[];
}

const CATEGORY_META: Record<CategoryKey, { name: string; emoji: string; isEssentialDefault: boolean }> = {
  moradia: { name: 'Moradia', emoji: '🏠', isEssentialDefault: true },
  comida: { name: 'Comida & Conveniência', emoji: '🍽️', isEssentialDefault: true },
  lazer: { name: 'Lazer', emoji: '🎮', isEssentialDefault: false },
  protecao: { name: 'Proteção', emoji: '🛡️', isEssentialDefault: true },
  profissional: { name: 'Profissional', emoji: '📚', isEssentialDefault: false },
  transporte: { name: 'Transporte & Mobilidade', emoji: '🚗', isEssentialDefault: true },
};

/**
 * 28I & 29B: Deriva todas as ocorrências de contas e despesas fixas para uma competência (YYYY-MM),
 * compartilhando a mesma projeção canônica sem ciclos com Matriz, Calendário e Termômetro.
 */
export function selectFixedBillOccurrences(
  state: AppState,
  competenceMonth: string,
  scope: DomainScope = 'casal',
  todayDateStr?: string
): FixedBillOccurrence[] {
  const { occurrences } = projectSharedFixedOccurrences(
    state,
    competenceMonth,
    scope,
    todayDateStr
  );

  return occurrences.map((occ) => {
    const occurrenceId =
      occ.sourceType === 'fixed_bill'
        ? `${occ.sourceId}:${competenceMonth}`
        : occ.sourceType === 'fixed_expense'
        ? occ.linkedSliceId && !occ.id.startsWith('occ-exp-')
          ? `direct-slice:${occ.linkedExpenseId}:${occ.linkedSliceId}`
          : `direct-exp:${occ.linkedExpenseId || occ.sourceId}`
        : occ.id;

    return {
      occurrenceId,
      billId: occ.sourceId,
      title: occ.title,
      category: occ.categoryKey,
      amountPlanned: occ.plannedAmountR$,
      amountEffective: occ.effectiveAmountR$,
      apportionedAmount: occ.apportionedAmountR$,
      amountPlannedCents: occ.plannedAmountCents,
      amountEffectiveCents: occ.effectiveAmountCents,
      apportionedAmountCents: occ.apportionedAmountCents,
      dueDate: occ.dueDateStr,
      competenceMonth: occ.competenceMonth,
      assignedPayer: occ.paidBy,
      status: occ.status,
      paidAt: occ.paidDate,
      paidAmount: occ.status === 'paid' ? occ.effectiveAmountR$ : undefined,
      paymentMethod: occ.paymentMethod,
      linkedExpenseId: occ.linkedExpenseId,
      linkedSliceId: occ.linkedSliceId,
      isEssential: occ.isEssential,
      priority: occ.priority,
      nature: occ.nature,
      sourceType: occ.sourceType,
      isRecurring: occ.isRecurring,
      active: occ.active,
      isDirectExpense: occ.sourceType === 'fixed_expense',
    };
  });
}

/**
 * 28I & 29B: Calcula a síntese completa do Painel de Fixos do Mês preservando os três denominadores
 * e reconciliando teto zero explícito vs ausência de teto, splits em centavos e cadastros.
 */
export function calculateFixedBillsSummary(
  state: AppState,
  competenceMonth: string,
  scope: DomainScope = 'casal',
  todayDateStr?: string
): FixedBillsSummaryResult {
  const { registryConflicts } = projectSharedFixedOccurrences(
    state,
    competenceMonth,
    scope,
    todayDateStr
  );
  const occurrences = selectFixedBillOccurrences(state, competenceMonth, scope, todayDateStr);
  const matrixResult = selectReconciledBudgetMatrix(state, scope, competenceMonth);

  const fixosBlock = matrixResult.structureBlocks.fixos;
  const fixedCeilingR$ = fixosBlock.plannedBudget || 0;
  const ceilingState: CeilingState = fixosBlock.ceilingState;
  const hasExplicitCeiling = fixosBlock.hasExplicitCeiling;
  const denominatorLabel = fixosBlock.denominatorLabel;

  const realizedLiquidCents = occurrences
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + (o.apportionedAmountCents ?? Math.round(o.apportionedAmount * 100)), 0);

  const pendingCents = occurrences
    .filter((o) => o.status === 'pending' || o.status === 'overdue')
    .reduce((sum, o) => sum + (o.apportionedAmountCents ?? Math.round(o.apportionedAmount * 100)), 0);

  const projectedCommittedCents = realizedLiquidCents + pendingCents;
  const fixedCeilingCents = Math.round(fixedCeilingR$ * 100);

  const realizedLiquidR$ = roundMoney(realizedLiquidCents / 100);
  const pendingR$ = roundMoney(pendingCents / 100);
  const projectedCommittedR$ = roundMoney(projectedCommittedCents / 100);
  const signedMarginR$ = roundMoney((fixedCeilingCents - projectedCommittedCents) / 100);

  const pctConsumedOfCeilingNullable =
    hasExplicitCeiling && fixedCeilingCents > 0
      ? roundMoney((projectedCommittedCents / fixedCeilingCents) * 100)
      : null;
  const pctConsumedOfCeiling = pctConsumedOfCeilingNullable ?? 0;

  const hasExcess = hasExplicitCeiling && projectedCommittedCents > fixedCeilingCents;
  const excessR$ = hasExcess ? roundMoney((projectedCommittedCents - fixedCeilingCents) / 100) : 0;

  const categoryKeys: CategoryKey[] = [
    'moradia',
    'transporte',
    'comida',
    'lazer',
    'protecao',
    'profissional',
  ];
  const categories: FixedCategoryBreakdown[] = categoryKeys.map((catKey) => {
    const catMeta = CATEGORY_META[catKey];
    const catOccs = occurrences.filter((o) => o.category === catKey);

    const fixedSpentCents = catOccs
      .filter((o) => o.status === 'paid')
      .reduce((s, o) => s + (o.apportionedAmountCents ?? Math.round(o.apportionedAmount * 100)), 0);
    const pendingCatCents = catOccs
      .filter((o) => o.status === 'pending' || o.status === 'overdue')
      .reduce((s, o) => s + (o.apportionedAmountCents ?? Math.round(o.apportionedAmount * 100)), 0);
    const committedCents = fixedSpentCents + pendingCatCents;

    const fixedSpentR$ = roundMoney(fixedSpentCents / 100);
    const pendingCatR$ = roundMoney(pendingCatCents / 100);
    const committedR$ = roundMoney(committedCents / 100);

    // Denominador 1: % do Teto Global de Fixos
    const pctOfFixedCeiling =
      hasExplicitCeiling && fixedCeilingCents > 0
        ? roundMoney((committedCents / fixedCeilingCents) * 100)
        : 0;

    // Denominador 2: % do Total Fixo Comprometido
    const pctOfFixedCommitted =
      projectedCommittedCents > 0
        ? roundMoney((committedCents / projectedCommittedCents) * 100)
        : 0;

    // Denominador 3: % do Teto Local da própria Categoria
    const categoryRow = matrixResult.categories.find((c) => c.key === catKey);
    const localCategoryCeilingR$ = categoryRow?.plannedBudget || 0;
    const localCategoryCeilingCents = Math.round(localCategoryCeilingR$ * 100);
    const pctOfLocalCategoryCeiling =
      localCategoryCeilingCents > 0
        ? roundMoney((committedCents / localCategoryCeilingCents) * 100)
        : 0;

    return {
      categoryKey: catKey,
      categoryName: catMeta.name,
      emoji: catMeta.emoji,
      fixedSpentR$,
      pendingR$: pendingCatR$,
      committedR$,
      pctOfFixedCeiling,
      pctOfFixedCommitted,
      localCategoryCeilingR$,
      pctOfLocalCategoryCeiling,
      occurrences: catOccs,
    };
  });

  return {
    competenceMonth,
    scope,
    fixedCeilingR$,
    hasExplicitCeiling,
    ceilingState,
    denominatorLabel,
    realizedLiquidR$,
    pendingR$,
    projectedCommittedR$,
    signedMarginR$,
    pctConsumedOfCeiling,
    pctConsumedOfCeilingNullable,
    hasExcess,
    excessR$,
    categories,
    allOccurrences: occurrences,
    registryConflicts,
  };
}
