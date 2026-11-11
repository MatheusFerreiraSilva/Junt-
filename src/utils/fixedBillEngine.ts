import { AppState, CategoryKey, FixedBillAlert, PaidBy, ExpenseItem } from '../types/finance';
import { roundMoney, selectReconciledBudgetMatrix } from './domainSelectors';
import { getDaysInMonth, clampDayToMonth, getApportionedAmount } from './calendarEngine';

export type DomainScope = 'casal' | 'partner1' | 'partner2';

export interface FixedBillOccurrence {
  occurrenceId: string; // `${billId}:${monthKey}`
  billId: string;
  title: string;
  category: CategoryKey;
  amountPlanned: number;
  amountEffective: number;
  apportionedAmount: number;
  dueDate: string; // YYYY-MM-DD
  competenceMonth: string; // YYYY-MM
  assignedPayer: PaidBy;
  status: 'paid' | 'pending' | 'overdue';
  paidAt?: string;
  paidAmount?: number;
  paymentMethod?: string;
  linkedExpenseId?: string;
  isEssential: boolean;
  isRecurring: boolean;
  active: boolean;
  isDirectExpense?: boolean; // Se for gasto fixo sem cadastro prévio em coupleFixedBills
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
  realizedLiquidR$: number;
  pendingR$: number;
  projectedCommittedR$: number;
  signedMarginR$: number;
  pctConsumedOfCeiling: number;
  hasExcess: boolean;
  excessR$: number;
  categories: FixedCategoryBreakdown[];
  allOccurrences: FixedBillOccurrence[];
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
 * Deriva todas as ocorrências de contas e despesas fixas para uma determinada competência (YYYY-MM).
 */
export function selectFixedBillOccurrences(
  state: AppState,
  competenceMonth: string,
  scope: DomainScope = 'casal',
  todayDateStr?: string
): FixedBillOccurrence[] {
  const todayStr = todayDateStr || new Date().toISOString().slice(0, 10);
  const [yearStr, monthStr] = competenceMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  const occurrences: FixedBillOccurrence[] = [];
  const bills = (state.coupleFixedBills || state.fixedBillAlerts || []).filter(b => !b.isDeleted);
  const expenses = state.expenses || [];

  // A) Recorrências registradas em coupleFixedBills
  for (const bill of bills) {
    const hist = bill.history?.[competenceMonth];

    // Se a conta está inativa e não possui histórico para este mês, não gera ocorrência futura (Proof 3)
    if (bill.active === false && !hist) {
      continue;
    }

    // Filtra por escopo de parceiro
    if (scope === 'partner1' && bill.assignedPayer === 'partner2') continue;
    if (scope === 'partner2' && bill.assignedPayer === 'partner1') continue;

    const clampedDay = clampDayToMonth(year, month, bill.dueDay || 10);
    const dueDate = `${competenceMonth}-${String(clampedDay).padStart(2, '0')}`;

    // Busca despesa baixada explicitamente vinculada no extrato
    const linkedExpense = expenses.find(
      (e) =>
        (e.linkedBillId === bill.id && (e.billCompetenceMonth === competenceMonth || e.date.startsWith(competenceMonth))) ||
        e.id === `exp-fb-${bill.id}-${competenceMonth}`
    );

    const isPaid =
      hist?.status === 'paid' ||
      Boolean(linkedExpense) ||
      (bill.lastPaidMonth === competenceMonth && bill.status === 'paid');

    let status: 'paid' | 'pending' | 'overdue' = 'pending';
    if (isPaid) {
      status = 'paid';
    } else if (hist?.status === 'overdue' || (dueDate < todayStr && !isPaid)) {
      status = 'overdue';
    }

    const paidAmount = hist?.paidAmount ?? linkedExpense?.amount;
    const paidAt = hist?.paidAt ?? linkedExpense?.date;
    const amountPlanned = bill.amount;
    const amountEffective = status === 'paid' ? (paidAmount ?? amountPlanned) : amountPlanned;
    const apportionedAmount = getApportionedAmount(amountEffective, scope, bill.assignedPayer, 50, 50);

    const categoryKey = bill.category || 'moradia';
    const catMeta = CATEGORY_META[categoryKey] || { name: categoryKey, emoji: '🏷️', isEssentialDefault: false };

    occurrences.push({
      occurrenceId: `${bill.id}:${competenceMonth}`,
      billId: bill.id,
      title: bill.title,
      category: categoryKey,
      amountPlanned,
      amountEffective,
      apportionedAmount,
      dueDate,
      competenceMonth,
      assignedPayer: bill.assignedPayer,
      status,
      paidAt,
      paidAmount,
      paymentMethod: hist?.paymentMethod ?? linkedExpense?.paymentMethod,
      linkedExpenseId: linkedExpense?.id ?? hist?.linkedExpenseId,
      isEssential: catMeta.isEssentialDefault,
      isRecurring: bill.isRecurring ?? true,
      active: bill.active ?? true,
      isDirectExpense: false,
    });
  }

  // B) Lançamentos fixos diretos no extrato da competência (sem cadastro de recorrência em coupleFixedBills)
  const directFixedExpenses = expenses.filter((e) => {
    if (!e.date.startsWith(competenceMonth)) return false;
    if (e.isExcludedFromMonthlyBudget) return false;
    if (e.fundingSource && e.fundingSource !== 'month_budget') return false;
    const isFixo = e.nature === 'fixo' || e.nature === 'fixa';
    if (!isFixo) return false;
    // Se já está vinculado a uma conta de coupleFixedBills, não duplica!
    if (e.linkedBillId && occurrences.some((o) => o.billId === e.linkedBillId)) return false;
    if (occurrences.some((o) => o.linkedExpenseId === e.id)) return false;
    return true;
  });

  for (const exp of directFixedExpenses) {
    if (scope === 'partner1' && exp.paidBy === 'partner2') continue;
    if (scope === 'partner2' && exp.paidBy === 'partner1') continue;

    const amountEffective = exp.amount;
    const apportionedAmount = getApportionedAmount(
      amountEffective,
      scope,
      exp.paidBy,
      exp.splitPartner1Pct ?? 50,
      exp.splitPartner2Pct ?? 50
    );

    const categoryKey = exp.category || 'moradia';
    const catMeta = CATEGORY_META[categoryKey] || { name: categoryKey, emoji: '🏷️', isEssentialDefault: false };

    occurrences.push({
      occurrenceId: `direct-exp:${exp.id}`,
      billId: exp.id,
      title: exp.description,
      category: categoryKey,
      amountPlanned: exp.amount,
      amountEffective,
      apportionedAmount,
      dueDate: exp.date,
      competenceMonth,
      assignedPayer: exp.paidBy,
      status: 'paid', // Lançamento no extrato já foi realizado
      paidAt: exp.date,
      paidAmount: exp.amount,
      paymentMethod: exp.paymentMethod,
      linkedExpenseId: exp.id,
      isEssential: catMeta.isEssentialDefault,
      isRecurring: false,
      active: true,
      isDirectExpense: true,
    });
  }

  return occurrences;
}

/**
 * Calcula a síntese completa do Painel de Fixos do Mês (Prompt 28I).
 */
export function calculateFixedBillsSummary(
  state: AppState,
  competenceMonth: string,
  scope: DomainScope = 'casal',
  todayDateStr?: string
): FixedBillsSummaryResult {
  const occurrences = selectFixedBillOccurrences(state, competenceMonth, scope, todayDateStr);
  const matrixResult = selectReconciledBudgetMatrix(state, scope, competenceMonth);

  const fixedCeilingR$ = matrixResult.structureBlocks.fixos.plannedBudget || 0;
  const hasExplicitCeiling = fixedCeilingR$ > 0;

  // Realizado líquido fixo (apenas itens com status === 'paid')
  const realizedLiquidR$ = roundMoney(
    occurrences
      .filter((o) => o.status === 'paid')
      .reduce((sum, o) => sum + o.apportionedAmount, 0)
  );

  // Pendências não reconhecidas (status === 'pending' ou 'overdue')
  const pendingR$ = roundMoney(
    occurrences
      .filter((o) => o.status === 'pending' || o.status === 'overdue')
      .reduce((sum, o) => sum + o.apportionedAmount, 0)
  );

  // Comprometido Projetado = Realizado + Pendentes
  const projectedCommittedR$ = roundMoney(realizedLiquidR$ + pendingR$);

  // Margem Assinada = Teto - Comprometido
  const signedMarginR$ = roundMoney(fixedCeilingR$ - projectedCommittedR$);

  // Percentual consumido do teto
  const pctConsumedOfCeiling = hasExplicitCeiling
    ? roundMoney((projectedCommittedR$ / fixedCeilingR$) * 100)
    : 0;

  const hasExcess = projectedCommittedR$ > fixedCeilingR$ && hasExplicitCeiling;
  const excessR$ = hasExcess ? roundMoney(projectedCommittedR$ - fixedCeilingR$) : 0;

  // Agrupamento por Categoria
  const categoryKeys: CategoryKey[] = ['moradia', 'transporte', 'comida', 'lazer', 'protecao', 'profissional'];
  const categories: FixedCategoryBreakdown[] = categoryKeys.map((catKey) => {
    const catMeta = CATEGORY_META[catKey];
    const catOccs = occurrences.filter((o) => o.category === catKey);

    const fixedSpentR$ = roundMoney(
      catOccs.filter((o) => o.status === 'paid').reduce((s, o) => s + o.apportionedAmount, 0)
    );
    const pendingCatR$ = roundMoney(
      catOccs.filter((o) => o.status === 'pending' || o.status === 'overdue').reduce((s, o) => s + o.apportionedAmount, 0)
    );
    const committedR$ = roundMoney(fixedSpentR$ + pendingCatR$);

    // % do Teto Global de Fixos (ex: R$ 3.600 ÷ R$ 4.000 = 90%)
    const pctOfFixedCeiling = hasExplicitCeiling
      ? roundMoney((committedR$ / fixedCeilingR$) * 100)
      : 0;

    // % do Total Fixo Comprometido (ex: R$ 3.600 ÷ R$ 3.700 = 97.3%)
    const pctOfFixedCommitted = projectedCommittedR$ > 0
      ? roundMoney((committedR$ / projectedCommittedR$) * 100)
      : 0;

    // Teto local da própria categoria (se houver na matriz 28C)
    const categoryRow = matrixResult.categories.find((c) => c.key === catKey);
    const localCategoryCeilingR$ = categoryRow?.plannedBudget || 0;
    const pctOfLocalCategoryCeiling = localCategoryCeilingR$ > 0
      ? roundMoney((committedR$ / localCategoryCeilingR$) * 100)
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
    realizedLiquidR$,
    pendingR$,
    projectedCommittedR$,
    signedMarginR$,
    pctConsumedOfCeiling,
    hasExcess,
    excessR$,
    categories,
    allOccurrences: occurrences,
  };
}
