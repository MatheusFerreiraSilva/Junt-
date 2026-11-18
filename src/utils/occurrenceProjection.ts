import {
  AppState,
  CategoryKey,
  CategoryKeywordRule,
  ClassificationOrigin,
  ExpenseItem,
  ExpenseNature,
  ExpensePriority,
  FixedBillAlert,
  FixedBillRegistryConflict,
  FundingSourceType,
  InstallmentPurchase,
  PaidBy,
  PolicyMacroGroup,
  SplitLineType,
  TransactionSplit,
} from '../types/finance';
import { buildInstallmentSchedule } from './installmentMoney';

export type ProjectionScope = 'couple' | 'casal' | 'partner1' | 'partner2';
export type NormalizedProjectionScope = 'couple' | 'partner1' | 'partner2';
export type ResolvedSliceNature = 'fixa' | 'variavel' | 'eventual' | 'unknown';

export const CATEGORY_PRESENTATION_META: Record<
  CategoryKey,
  { label: string; emoji: string; isEssentialDefault: boolean }
> = {
  moradia: { label: 'Moradia', emoji: '🏠', isEssentialDefault: true },
  protecao: { label: 'Proteção & Saúde', emoji: '🛡️', isEssentialDefault: true },
  comida: { label: 'Comida & Supermercado', emoji: '🛒', isEssentialDefault: true },
  transporte: { label: 'Transporte', emoji: '🚗', isEssentialDefault: true },
  profissional: { label: 'Profissional & Estudos', emoji: '📚', isEssentialDefault: false },
  lazer: { label: 'Lazer & Estilo de Vida', emoji: '🎉', isEssentialDefault: false },
};

export const CANONICAL_CATEGORY_ALIAS_MAP: Record<string, CategoryKey> = {
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

export function mapToCanonicalCategoryKey(rawCat?: string): CategoryKey {
  if (!rawCat) return 'moradia';
  return CANONICAL_CATEGORY_ALIAS_MAP[rawCat] || 'moradia';
}

/**
 * Arredondamento determinístico para 2 casas decimais compatível com centavos.
 */
export function roundMoney(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Converte valor monetário (amountCents prioritário ou amount em R$) para centavos inteiros seguros.
 */
export function toSafeCents(amountR$?: number, amountCents?: number): number {
  if (typeof amountCents === 'number' && Number.isFinite(amountCents)) {
    return Math.round(amountCents);
  }
  if (typeof amountR$ === 'number' && Number.isFinite(amountR$)) {
    return Math.round((amountR$ + Math.sign(amountR$) * Number.EPSILON) * 100);
  }
  return 0;
}

export function normalizeProjectionScope(scope?: string): NormalizedProjectionScope {
  if (scope === 'partner1') return 'partner1';
  if (scope === 'partner2') return 'partner2';
  return 'couple';
}

/**
 * Retorna a quantidade exata de dias em um mês (respeitando anos bissextos).
 */
export function getDaysInMonth(year: number, month1Indexed: number): number {
  return new Date(year, month1Indexed, 0).getDate();
}

/**
 * Limita o dia do vencimento ao último dia válido do mês (ex: 31 -> 28/29 em fev).
 */
export function clampDayToMonth(year: number, month1Indexed: number, day: number): number {
  const maxDay = getDaysInMonth(year, month1Indexed);
  return Math.max(1, Math.min(day, maxDay));
}

/**
 * Soma meses a uma competência YYYY-MM de forma determinística.
 */
export function addMonthsToCompetence(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = (monthKey || '2026-01').split('-');
  const year = Number(yStr) || 2026;
  const month0 = (Number(mStr) || 1) - 1;
  const totalMonths = year * 12 + month0 + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth1 = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth1).padStart(2, '0')}`;
}

/**
 * 29B (R29-10): Resolve a competência de uma despesa.
 * Quando billCompetenceMonth está explícita (YYYY-MM), a data de pagamento (caixa) NUNCA muda a competência.
 * A data civil só é usada como fallback quando não há competência explícita.
 */
export function resolveExpenseCompetenceMonth(
  exp: Pick<ExpenseItem, 'date' | 'billCompetenceMonth'>
): string {
  if (exp.billCompetenceMonth && /^\d{4}-\d{2}$/.test(exp.billCompetenceMonth)) {
    return exp.billCompetenceMonth;
  }
  return (exp.date || '').slice(0, 7);
}

/**
 * 29B (R29-10): Verifica se um lançamento de despesa quita a ocorrência de uma conta fixa na competência alvo.
 * - Com billCompetenceMonth explícita: exige igualdade estrita com competenceMonth (pagamento em março de conta de fevereiro NÃO baixa março).
 * - Sem billCompetenceMonth (legado): usa prefixo da data de pagamento como fallback documentado.
 */
export function doesExpenseMatchBillCompetence(
  exp: Pick<ExpenseItem, 'linkedBillId' | 'billCompetenceMonth' | 'date'> & { id?: string },
  billId: string,
  competenceMonth: string
): boolean {
  if (
    exp.id === `exp-fb-${billId}-${competenceMonth}` &&
    (!exp.billCompetenceMonth || exp.billCompetenceMonth === competenceMonth)
  ) {
    return true;
  }
  if (!exp.linkedBillId || exp.linkedBillId !== billId) return false;
  if (exp.billCompetenceMonth && /^\d{4}-\d{2}$/.test(exp.billCompetenceMonth)) {
    return exp.billCompetenceMonth === competenceMonth;
  }
  return Boolean(exp.date && exp.date.startsWith(competenceMonth));
}

export interface ApportionedCentsBreakdown {
  coupleCents: number;
  partner1Cents: number;
  partner2Cents: number;
  scopedCents: number;
  isInScope: boolean;
}

/**
 * 29B (R29-16): Rateio determinístico em centavos inteiros por escopo e percentuais da entidade.
 * Garante partner1Cents + partner2Cents === coupleCents (ex.: R$ 100,01 50/50 -> 5001 + 5000 = 10001 centavos).
 */
export function apportionCentsByScope(
  totalCents: number,
  scope: ProjectionScope,
  payer: PaidBy | string | undefined,
  splitPartner1Pct?: number,
  splitPartner2Pct?: number,
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal'
): ApportionedCentsBreakdown {
  const safeTotal = Math.round(Number.isFinite(totalCents) ? totalCents : 0);
  const normScope = normalizeProjectionScope(scope);

  let p1Cents = 0;
  let p2Cents = 0;

  if (assignedTo === 'partner1') {
    p1Cents = safeTotal;
    p2Cents = 0;
  } else if (assignedTo === 'partner2') {
    p1Cents = 0;
    p2Cents = safeTotal;
  } else if (payer === 'partner1') {
    p1Cents = safeTotal;
    p2Cents = 0;
  } else if (payer === 'partner2') {
    p1Cents = 0;
    p2Cents = safeTotal;
  } else {
    const p1Pct =
      typeof splitPartner1Pct === 'number' && Number.isFinite(splitPartner1Pct)
        ? Math.max(0, Math.min(100, splitPartner1Pct))
        : typeof splitPartner2Pct === 'number' && Number.isFinite(splitPartner2Pct)
        ? Math.max(0, Math.min(100, 100 - splitPartner2Pct))
        : 50;
    p1Cents = Math.round((safeTotal * p1Pct) / 100);
    p2Cents = safeTotal - p1Cents;
  }

  const isInScope =
    normScope === 'couple'
      ? true
      : normScope === 'partner1'
      ? assignedTo === 'partner1' ||
        (assignedTo !== 'partner2' &&
          (payer === 'partner1' ||
            ((payer === 'both' || payer === 'casal' || payer === 'couple' || payer === 'custom' || !payer) &&
              (splitPartner1Pct === undefined || splitPartner1Pct > 0))))
      : assignedTo === 'partner2' ||
        (assignedTo !== 'partner1' &&
          (payer === 'partner2' ||
            ((payer === 'both' || payer === 'casal' || payer === 'couple' || payer === 'custom' || !payer) &&
              (splitPartner2Pct === undefined || splitPartner2Pct > 0 || (splitPartner1Pct !== undefined && splitPartner1Pct < 100)))));

  const scopedCents =
    normScope === 'couple' ? safeTotal : normScope === 'partner1' ? p1Cents : p2Cents;

  return {
    coupleCents: safeTotal,
    partner1Cents: p1Cents,
    partner2Cents: p2Cents,
    scopedCents,
    isInScope,
  };
}

/**
 * Facade em R$ derivada de centavos inteiros (preserva assinatura histórica de calendarEngine).
 */
export function getApportionedAmount(
  amount: number,
  scope: ProjectionScope,
  payer: PaidBy | undefined,
  splitP1Pct?: number,
  splitP2Pct?: number,
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal'
): number {
  const cents = toSafeCents(amount);
  const res = apportionCentsByScope(cents, scope, payer, splitP1Pct, splitP2Pct, assignedTo);
  return roundMoney(res.scopedCents / 100);
}

/**
 * 29B (R29-13): Resolve se um item é essencial respeitando a prioridade própria do item/fatia/conta,
 * usando o default da categoria apenas quando o registro legado não declara prioridade explícita.
 */
export function resolveIsEssentialFromPriority(
  priority: ExpensePriority | undefined,
  fallbackCategory: CategoryKey
): boolean {
  if (priority === 'essencial' || priority === 'necessario') return true;
  if (priority === 'dispensavel' || priority === 'desejo' || priority === 'importante') return false;
  return CATEGORY_PRESENTATION_META[fallbackCategory]?.isEssentialDefault ?? false;
}

export interface CanonicalFixedBillsRegistryResult {
  bills: FixedBillAlert[];
  conflicts: FixedBillRegistryConflict[];
  sourceById: Record<string, 'coupleFixedBills' | 'fixedBillAlerts' | 'merged'>;
}

/**
 * 29B (R29-11): Reconcilia coupleFixedBills e fixedBillAlerts sem ignorar um quando o outro está vazio ([]).
 * Deduplica por ID comprovado, mescla histórico de baixas e sinaliza conflitos substantivos se o mesmo ID divergir.
 */
export function selectCanonicalFixedBillsRegistry(
  state: Pick<AppState, 'coupleFixedBills' | 'fixedBillAlerts'>
): CanonicalFixedBillsRegistryResult {
  const primaryList = (state.coupleFixedBills || []).filter((b) => b && !b.isDeleted);
  const legacyList = (state.fixedBillAlerts || []).filter((b) => b && !b.isDeleted);

  const byId = new Map<string, FixedBillAlert>();
  const sourceById: Record<string, 'coupleFixedBills' | 'fixedBillAlerts' | 'merged'> = {};
  const conflicts: FixedBillRegistryConflict[] = [];

  const normalizeBill = (b: FixedBillAlert): FixedBillAlert => {
    const cents = toSafeCents(b.amount, b.amountCents);
    const derivedDueDay =
      b.dueDay ||
      (b.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ? Number(b.dueDate.slice(8, 10)) || 10 : 10);
    return {
      ...b,
      title: b.title || (b as any).description || 'Conta Fixa',
      category: b.category || 'moradia',
      amount: roundMoney(cents / 100),
      amountCents: cents,
      dueDay: Math.max(1, Math.min(31, derivedDueDay)),
      assignedPayer: b.assignedPayer || b.assignedTo || 'both',
      autoPay: Boolean(b.autoPay),
      status: b.status || 'pending',
      isRecurring: b.isRecurring !== undefined ? b.isRecurring : !b.dueDate,
    };
  };

  for (const rawPrimary of primaryList) {
    if (!rawPrimary.id) continue;
    byId.set(rawPrimary.id, normalizeBill(rawPrimary));
    sourceById[rawPrimary.id] = 'coupleFixedBills';
  }

  for (const rawLegacy of legacyList) {
    if (!rawLegacy.id) continue;
    const normLegacy = normalizeBill(rawLegacy);
    const existing = byId.get(normLegacy.id);

    if (!existing) {
      byId.set(normLegacy.id, normLegacy);
      sourceById[normLegacy.id] = 'fixedBillAlerts';
      continue;
    }

    // Deduplicação por ID comprovado com verificação de conflitos substantivos
    const conflictParts: string[] = [];
    if (toSafeCents(existing.amount, existing.amountCents) !== toSafeCents(normLegacy.amount, normLegacy.amountCents)) {
      conflictParts.push(`valor (${existing.amount} vs ${normLegacy.amount})`);
    }
    if (existing.category && normLegacy.category && existing.category !== normLegacy.category) {
      conflictParts.push(`categoria (${existing.category} vs ${normLegacy.category})`);
    }
    if (rawPrimaryHasDueDay(existing) && rawPrimaryHasDueDay(normLegacy) && existing.dueDay !== normLegacy.dueDay) {
      conflictParts.push(`vencimento (${existing.dueDay} vs ${normLegacy.dueDay})`);
    }
    if (
      existing.title &&
      normLegacy.title &&
      existing.title.trim().toLowerCase() !== normLegacy.title.trim().toLowerCase()
    ) {
      conflictParts.push(`título ("${existing.title}" vs "${normLegacy.title}")`);
    }

    if (conflictParts.length > 0) {
      conflicts.push({
        billId: normLegacy.id,
        reason: `Conflito entre coupleFixedBills e fixedBillAlerts para "${normLegacy.id}": ${conflictParts.join(', ')}.`,
      });
    }

    const mergedHistory = {
      ...(normLegacy.history || {}),
      ...(existing.history || {}),
    };

    byId.set(normLegacy.id, {
      ...normLegacy,
      ...existing,
      history: Object.keys(mergedHistory).length > 0 ? mergedHistory : existing.history,
      splitPartner1Pct: existing.splitPartner1Pct ?? normLegacy.splitPartner1Pct,
      splitPartner2Pct: existing.splitPartner2Pct ?? normLegacy.splitPartner2Pct,
      priority: existing.priority ?? normLegacy.priority,
      nature: existing.nature ?? normLegacy.nature,
      validFrom: existing.validFrom ?? normLegacy.validFrom,
      validTo: existing.validTo ?? normLegacy.validTo,
      dueDate: existing.dueDate ?? normLegacy.dueDate,
    });
    sourceById[normLegacy.id] = 'merged';
  }

  return {
    bills: Array.from(byId.values()),
    conflicts,
    sourceById,
  };
}

function rawPrimaryHasDueDay(b: FixedBillAlert): boolean {
  return typeof b.dueDay === 'number' && Number.isFinite(b.dueDay) && b.dueDay > 0;
}

/**
 * 29B (R29-18): Verifica se uma conta fixa está vigente para a competência alvo.
 * - Se já houve baixa/pagamento registrado naquela competência, preserva a ocorrência histórica.
 * - Se desativada (active === false) ou estornada sem histórico pago no mês, não gera ocorrência futura.
 * - Respeita validFrom, validTo e dueDate pontual (quando isRecurring === false).
 */
export function isFixedBillActiveInCompetence(
  bill: FixedBillAlert,
  competenceMonth: string,
  hasPaidEvidenceInCompetence: boolean
): boolean {
  if (bill.isDeleted) return false;
  if (hasPaidEvidenceInCompetence) return true;

  if (bill.active === false) return false;
  if ((bill.status as string) === 'estornado') return false;

  if (bill.dueDate && !bill.isRecurring) {
    return bill.dueDate.slice(0, 7) === competenceMonth;
  }

  if (bill.validFrom && /^\d{4}-\d{2}/.test(bill.validFrom)) {
    if (competenceMonth < bill.validFrom.slice(0, 7)) return false;
  }

  if (bill.validTo && /^\d{4}-\d{2}/.test(bill.validTo)) {
    if (competenceMonth > bill.validTo.slice(0, 7)) return false;
  }

  return true;
}

export interface SliceNatureClassification {
  hasReliableNature: boolean;
  resolvedNature: ResolvedSliceNature;
  nature: ExpenseNature;
  priority: ExpensePriority;
  policyMacroGroup: PolicyMacroGroup;
  classificationOrigin: ClassificationOrigin;
}

/**
 * 29B (R29-13 & R29-14): Determina natureza e prioridade de uma fatia/despesa sem inventar 'variavel'
 * quando a natureza é desconhecida ou pendente de classificação.
 */
export function classifyExpenseSliceNature(
  exp: ExpenseItem,
  split?: TransactionSplit,
  options?: {
    keywordRules?: CategoryKeywordRule[];
    installments?: InstallmentPurchase[];
  }
): SliceNatureClassification {
  const rawMacro = split?.policyMacroGroup ?? exp.policyMacroGroup;
  const rawOrigin = split?.classificationOrigin ?? exp.classificationOrigin;
  const rawNature = (split?.nature ?? exp.nature) as string | undefined;
  const category = (split?.category || exp.category || 'moradia') as CategoryKey;

  const resolvePriority = (fallback?: ExpensePriority): ExpensePriority => {
    const p = split?.priority ?? exp.priority ?? fallback;
    if (p) return p;
    return CATEGORY_PRESENTATION_META[category]?.isEssentialDefault ? 'essencial' : 'dispensavel';
  };

  // Se marcado explicitamente como pendente ou sugestão automática não confirmada sem natureza manual
  if (rawMacro === 'pendente') {
    return {
      hasReliableNature: false,
      resolvedNature: 'unknown',
      nature: 'variavel',
      priority: resolvePriority('importante'),
      policyMacroGroup: 'pendente',
      classificationOrigin: rawOrigin || 'auto_suggestion',
    };
  }

  if (rawOrigin === 'auto_suggestion' && rawOrigin !== ('manual_confirmed' as any)) {
    // Sugestão não confirmada sem regra autorizada permanece pendente na matriz estrutural
    if (!rawNature || (rawNature !== 'fixa' && rawNature !== 'fixo' && rawNature !== 'variavel' && rawNature !== 'eventual')) {
      return {
        hasReliableNature: false,
        resolvedNature: 'unknown',
        nature: 'variavel',
        priority: resolvePriority('importante'),
        policyMacroGroup: 'pendente',
        classificationOrigin: 'auto_suggestion',
      };
    }
  }

  // Natureza explícita conhecida
  if (rawNature === 'fixa' || rawNature === 'fixo') {
    return {
      hasReliableNature: true,
      resolvedNature: 'fixa',
      nature: rawNature as ExpenseNature,
      priority: resolvePriority(),
      policyMacroGroup: rawMacro || 'fixos',
      classificationOrigin: rawOrigin || 'manual_confirmed',
    };
  }

  if (rawNature === 'variavel' || rawNature === 'eventual') {
    return {
      hasReliableNature: true,
      resolvedNature: rawNature,
      nature: rawNature,
      priority: resolvePriority(),
      policyMacroGroup: rawMacro || 'variaveis',
      classificationOrigin: rawOrigin || 'manual_confirmed',
    };
  }

  // Natureza preenchida com valor desconhecido/inválido (ex.: 'desconhecida', 'unknown')
  if (rawNature !== undefined && rawNature !== '') {
    return {
      hasReliableNature: false,
      resolvedNature: 'unknown',
      nature: 'variavel',
      priority: resolvePriority('importante'),
      policyMacroGroup: 'pendente',
      classificationOrigin: rawOrigin || 'auto_suggestion',
    };
  }

  // Sem natureza explícita: verificar vínculo de origem (conta fixa ou parcelamento)
  if (exp.linkedBillId) {
    return {
      hasReliableNature: true,
      resolvedNature: 'fixa',
      nature: 'fixa',
      priority: resolvePriority('essencial'),
      policyMacroGroup: 'fixos',
      classificationOrigin: rawOrigin || 'origin_link',
    };
  }

  if (exp.installmentId) {
    const linkedInst = options?.installments?.find((i) => i.id === exp.installmentId);
    const instIsFixed =
      linkedInst?.nature === 'fixa' ||
      linkedInst?.nature === 'fixo' ||
      linkedInst?.type === 'financing';
    const derivedNature: ExpenseNature = instIsFixed
      ? 'fixa'
      : linkedInst?.nature === 'eventual'
      ? 'eventual'
      : 'variavel';
    return {
      hasReliableNature: true,
      resolvedNature: instIsFixed ? 'fixa' : derivedNature === 'eventual' ? 'eventual' : 'variavel',
      nature: derivedNature,
      priority: resolvePriority(linkedInst?.priority || 'importante'),
      policyMacroGroup: instIsFixed ? 'fixos' : 'variaveis',
      classificationOrigin: rawOrigin || 'origin_link',
    };
  }

  // Regra autorizada por palavra-chave
  if (options?.keywordRules && options.keywordRules.length > 0 && exp.description) {
    const normDesc = exp.description
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const matchedAuth = options.keywordRules.find((r) => {
      if (!r.isAuthorizedRule || !r.keyword) return false;
      const normKw = r.keyword
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normDesc.includes(normKw);
    });
    if (matchedAuth && matchedAuth.nature) {
      const isFixed = matchedAuth.nature === 'fixa' || matchedAuth.nature === 'fixo';
      return {
        hasReliableNature: true,
        resolvedNature: isFixed ? 'fixa' : matchedAuth.nature === 'eventual' ? 'eventual' : 'variavel',
        nature: matchedAuth.nature,
        priority: resolvePriority(matchedAuth.priority),
        policyMacroGroup: matchedAuth.policyMacroGroup || (isFixed ? 'fixos' : 'variaveis'),
        classificationOrigin: 'authorized_rule',
      };
    }
  }

  // Registro sem natureza confiável: classificação pendente (não inventa variável!)
  return {
    hasReliableNature: false,
    resolvedNature: 'unknown',
    nature: 'variavel',
    priority: resolvePriority('importante'),
    policyMacroGroup: 'pendente',
    classificationOrigin: rawOrigin || 'auto_suggestion',
  };
}

export interface SharedExpenseSliceProjection {
  splitId: string;
  expenseId: string;
  parentExpenseId: string;
  parentExpense: ExpenseItem;
  amount: number;
  amountCents: number;
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
  fundingSource: FundingSourceType;
  fundingGoalId?: string;
  fundingGoalName?: string;
  isExcludedFromMonthlyBudget: boolean;
  exclusionReason?: 'manual' | 'asset_funding' | 'goal_direct';
  date: string;
  competenceMonth: string;
  cashMonth: string;
  paidBy: PaidBy;
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal';
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  bankName?: string;
  store?: string;
  lineType: SplitLineType;
  targetDate?: string;
  isPostponable?: boolean;
  isVirtualSingleSplit: boolean;
}

/**
 * Projeta fatias canônicas de uma despesa preservando centavos inteiros, competência explícita e confiabilidade da natureza.
 */
export function projectCanonicalExpenseSlices(
  exp: ExpenseItem,
  options?: {
    keywordRules?: CategoryKeywordRule[];
    installments?: InstallmentPurchase[];
  }
): SharedExpenseSliceProjection[] {
  const competenceMonth = resolveExpenseCompetenceMonth(exp);
  const cashMonth = (exp.date || '').slice(0, 7);

  if (exp.splits && exp.splits.length > 0) {
    return exp.splits.map((s, idx) => {
      const cents = toSafeCents(s.amount, s.amountCents);
      const cat = (s.category || exp.category || 'moradia') as CategoryKey;
      const cls = classifyExpenseSliceNature(exp, s, options);
      const fundingSource: FundingSourceType = s.fundingSource || exp.fundingSource || 'month_budget';
      const isExcluded = Boolean(exp.isExcludedFromMonthlyBudget || fundingSource !== 'month_budget');
      const sliceCompetence =
        exp.billCompetenceMonth && /^\d{4}-\d{2}$/.test(exp.billCompetenceMonth)
          ? exp.billCompetenceMonth
          : s.targetDate && /^\d{4}-\d{2}/.test(s.targetDate)
          ? s.targetDate.slice(0, 7)
          : competenceMonth;

      return {
        splitId: s.id || `${exp.id}-split-${idx}`,
        expenseId: exp.id,
        parentExpenseId: exp.id,
        parentExpense: exp,
        amount: roundMoney(cents / 100),
        amountCents: cents,
        category: cat,
        subcategory: s.subcategory || exp.subcategory,
        nature: cls.nature,
        resolvedNature: cls.resolvedNature,
        hasReliableNature: cls.hasReliableNature,
        priority: cls.priority,
        isEssential: resolveIsEssentialFromPriority(cls.priority, cat),
        policyMacroGroup: cls.policyMacroGroup,
        classificationOrigin: cls.classificationOrigin,
        notes: s.notes || exp.notes,
        fundingSource,
        fundingGoalId: s.fundingGoalId || exp.fundingGoalId,
        fundingGoalName: exp.fundingGoalName,
        isExcludedFromMonthlyBudget: isExcluded,
        exclusionReason: exp.exclusionReason,
        date: exp.date,
        competenceMonth: sliceCompetence,
        cashMonth,
        paidBy: ((s as any).paidBy || exp.paidBy) as PaidBy,
        assignedTo: (s as any).assignedTo || exp.assignedTo,
        paymentMethod: exp.paymentMethod,
        bankName: exp.bankName,
        store: exp.store,
        lineType: s.lineType || 'item',
        targetDate: s.targetDate,
        isPostponable: s.isPostponable,
        isVirtualSingleSplit: false,
      };
    });
  }

  const cents = toSafeCents(exp.amount, exp.amountCents);
  const cat = (exp.category || 'moradia') as CategoryKey;
  const cls = classifyExpenseSliceNature(exp, undefined, options);
  const fundingSource: FundingSourceType = exp.fundingSource || 'month_budget';
  const isExcluded = Boolean(exp.isExcludedFromMonthlyBudget || fundingSource !== 'month_budget');

  return [
    {
      splitId: `${exp.id}-virtual-split-0`,
      expenseId: exp.id,
      parentExpenseId: exp.id,
      parentExpense: exp,
      amount: roundMoney(cents / 100),
      amountCents: cents,
      category: cat,
      subcategory: exp.subcategory,
      nature: cls.nature,
      resolvedNature: cls.resolvedNature,
      hasReliableNature: cls.hasReliableNature,
      priority: cls.priority,
      isEssential: resolveIsEssentialFromPriority(cls.priority, cat),
      policyMacroGroup: cls.policyMacroGroup,
      classificationOrigin: cls.classificationOrigin,
      notes: exp.notes,
      fundingSource,
      fundingGoalId: exp.fundingGoalId,
      fundingGoalName: exp.fundingGoalName,
      isExcludedFromMonthlyBudget: isExcluded,
      exclusionReason: exp.exclusionReason,
      date: exp.date,
      competenceMonth,
      cashMonth,
      paidBy: exp.paidBy,
      assignedTo: exp.assignedTo,
      paymentMethod: exp.paymentMethod,
      bankName: exp.bankName,
      store: exp.store,
      lineType: 'item',
      isVirtualSingleSplit: true,
    },
  ];
}

export interface ProjectedInstallmentOccurrence {
  occurrenceId: string;
  installmentId: string;
  title: string;
  category: CategoryKey;
  competenceMonth: string;
  dueDate: string;
  dueDay: number;
  installmentNumber: number;
  totalInstallments: number;
  plannedCents: number;
  effectiveCents: number;
  scopedCents: number;
  partner1Cents: number;
  partner2Cents: number;
  status: 'paid' | 'pending' | 'overdue' | 'advanced';
  isFixedNature: boolean;
  isEssential: boolean;
  nature: ExpenseNature;
  priority: ExpensePriority;
  paidBy: PaidBy;
  bankName?: string;
  linkedExpenseId?: string;
  alreadyInExpenses: boolean;
  isExcludedFromMonthlyBudget?: boolean;
}

/**
 * 29B: Projeta ocorrências de parcelamentos para uma competência unificando o contrato 08/17 (buildInstallmentSchedule)
 * e o formato de ocorrências explícitas 28C (inst.occurrences), sem duplicar aquisição ou baixas já lançadas em expenses.
 */
export function projectInstallmentOccurrencesForCompetence(
  state: Pick<AppState, 'installments' | 'expenses'>,
  competenceMonth: string,
  scope: ProjectionScope = 'couple',
  todayDateStr?: string
): ProjectedInstallmentOccurrence[] {
  const today = todayDateStr || new Date().toISOString().slice(0, 10);
  const [yearNum, monthNum] = competenceMonth.split('-').map(Number);
  const results: ProjectedInstallmentOccurrence[] = [];
  const expenses = state.expenses || [];

  for (const inst of state.installments || []) {
    if (!inst) continue;

    const linkedExpense = expenses.find(
      (e) => e.installmentId === inst.id && resolveExpenseCompetenceMonth(e) === competenceMonth
    );
    const isGoalOrExcluded = Boolean(
      inst.isExcludedFromMonthlyBudget ||
        (inst.fundingSource && inst.fundingSource !== 'month_budget') ||
        linkedExpense?.isExcludedFromMonthlyBudget ||
        (linkedExpense?.fundingSource && linkedExpense.fundingSource !== 'month_budget')
    );
    const isFixedNature =
      inst.nature === 'fixa' || inst.nature === 'fixo' || inst.type === 'financing';
    const resolvedNature: ExpenseNature = isFixedNature
      ? 'fixa'
      : inst.nature === 'eventual'
      ? 'eventual'
      : 'variavel';
    const cat = (inst.category || 'moradia') as CategoryKey;
    const priority: ExpensePriority =
      inst.priority || (CATEGORY_PRESENTATION_META[cat]?.isEssentialDefault ? 'essencial' : 'importante');
    const isEssential = resolveIsEssentialFromPriority(priority, cat);
    const title = inst.title || inst.description || 'Compra Parcelada';

    // Caso A: Array explícito inst.occurrences (ex.: fixture C39 de 28C)
    if (Array.isArray(inst.occurrences) && inst.occurrences.length > 0) {
      const baseStartMonth =
        inst.startMonth ||
        (inst.firstPaymentDate && /^\d{4}-\d{2}/.test(inst.firstPaymentDate)
          ? inst.firstPaymentDate.slice(0, 7)
          : undefined);
      const uniqueDueMonths = new Set(
        inst.occurrences
          .map((o: any) => (typeof o?.dueDate === 'string' ? o.dueDate.slice(0, 7) : ''))
          .filter(Boolean)
      );
      const allShareSameDueMonth = inst.occurrences.length > 1 && uniqueDueMonths.size === 1;

      for (const occ of inst.occurrences) {
        if (!occ || occ.status === 'estornado') continue;
        const instNum = Number(occ.installmentNumber) || 1;
        const occComp =
          occ.competenceMonth && /^\d{4}-\d{2}$/.test(occ.competenceMonth)
            ? occ.competenceMonth
            : allShareSameDueMonth && baseStartMonth
            ? addMonthsToCompetence(baseStartMonth, instNum - 1)
            : typeof occ.dueDate === 'string'
            ? occ.dueDate.slice(0, 7)
            : '';

        if (occComp !== competenceMonth) continue;

        const rawCents = toSafeCents(
          occ.amountR$ ?? occ.amount ?? inst.installmentValue ?? inst.installmentAmount,
          occ.effectivePaidCents ?? occ.amountCents
        );
        const split = apportionCentsByScope(
          rawCents,
          scope,
          inst.paidBy || 'both',
          inst.splitPartner1Pct,
          inst.splitPartner2Pct
        );
        if (!split.isInScope) continue;

        const rawDay =
          inst.dueDay ||
          (typeof occ.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(occ.dueDate)
            ? Number(occ.dueDate.slice(8, 10))
            : 10);
        const safeDay = clampDayToMonth(yearNum, monthNum, rawDay || 10);
        const dueDate = `${competenceMonth}-${String(safeDay).padStart(2, '0')}`;

        const isPaid =
          Boolean(linkedExpense) ||
          occ.status === 'paid' ||
          occ.status === 'pago' ||
          occ.status === 'antecipado';
        const status: ProjectedInstallmentOccurrence['status'] =
          occ.status === 'antecipado'
            ? 'advanced'
            : isPaid
            ? 'paid'
            : dueDate < today
            ? 'overdue'
            : 'pending';

        results.push({
          occurrenceId: occ.occurrenceId || occ.id || `${inst.id}:${instNum}:${competenceMonth}`,
          installmentId: inst.id,
          title,
          category: cat,
          competenceMonth,
          dueDate,
          dueDay: safeDay,
          installmentNumber: instNum,
          totalInstallments: inst.totalInstallments || inst.installmentsCount || inst.occurrences.length,
          plannedCents: rawCents,
          effectiveCents: linkedExpense ? toSafeCents(linkedExpense.amount, linkedExpense.amountCents) : rawCents,
          scopedCents: split.scopedCents,
          partner1Cents: split.partner1Cents,
          partner2Cents: split.partner2Cents,
          status,
          isFixedNature,
          isEssential,
          nature: resolvedNature,
          priority,
          paidBy: inst.paidBy || 'both',
          bankName: inst.bankName,
          linkedExpenseId: linkedExpense?.id,
          alreadyInExpenses: Boolean(linkedExpense),
          isExcludedFromMonthlyBudget: isGoalOrExcluded,
        });
      }
      continue;
    }

    // Caso B: Contrato canônico de cronograma 08/17 (buildInstallmentSchedule)
    const schedule = buildInstallmentSchedule(
      {
        ...inst,
        id: inst.id,
        category: cat,
        active: inst.active ?? true,
        paidBy: inst.paidBy || 'both',
        totalAmount: inst.totalAmount,
        installmentsCount: inst.installmentsCount || inst.totalInstallments || 1,
        startMonth:
          inst.startMonth ||
          (inst.firstPaymentDate ? inst.firstPaymentDate.slice(0, 7) : competenceMonth),
        dueDay: inst.dueDay || 10,
        paidInstallmentsCount: inst.paidInstallmentsCount || 0,
        occurrenceRecords: inst.occurrenceRecords,
      },
      today
    );
    const entry = schedule.find((s) => s.competenceMonth === competenceMonth);
    if (!entry || entry.status === 'estornado') continue;

    const plannedCents = entry.amountCents;
    const effectiveCents = linkedExpense
      ? toSafeCents(linkedExpense.amount, linkedExpense.amountCents)
      : entry.effectivePaidCents ?? entry.amountCents;

    const split = apportionCentsByScope(
      effectiveCents,
      scope,
      inst.paidBy || 'both',
      inst.splitPartner1Pct,
      inst.splitPartner2Pct
    );
    if (!split.isInScope) continue;

    const safeDay = clampDayToMonth(yearNum, monthNum, inst.dueDay || 10);
    const dueDate = `${competenceMonth}-${String(safeDay).padStart(2, '0')}`;
    const isPaid =
      Boolean(linkedExpense) || entry.status === 'pago' || entry.status === 'antecipado';
    const status: ProjectedInstallmentOccurrence['status'] =
      entry.status === 'antecipado'
        ? 'advanced'
        : isPaid
        ? 'paid'
        : dueDate < today
        ? 'overdue'
        : 'pending';

    results.push({
      occurrenceId: entry.occurrenceId,
      installmentId: inst.id,
      title,
      category: cat,
      competenceMonth,
      dueDate,
      dueDay: safeDay,
      installmentNumber: entry.installmentNumber,
      totalInstallments: inst.installmentsCount || inst.totalInstallments || schedule.length,
      plannedCents,
      effectiveCents,
      scopedCents: split.scopedCents,
      partner1Cents: split.partner1Cents,
      partner2Cents: split.partner2Cents,
      status,
      isFixedNature,
      isEssential,
      nature: resolvedNature,
      priority,
      paidBy: inst.paidBy || 'both',
      bankName: inst.bankName,
      linkedExpenseId: linkedExpense?.id,
      alreadyInExpenses: Boolean(linkedExpense),
      isExcludedFromMonthlyBudget: isGoalOrExcluded,
    });
  }

  return results;
}

export interface SharedFixedOccurrenceProjection {
  id: string;
  sourceType: 'fixed_bill' | 'fixed_expense' | 'fixed_installment';
  sourceId: string;
  title: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  categoryEmoji: string;
  competenceMonth: string;
  dueDay: number;
  dueDateStr: string;
  plannedAmountCents: number;
  effectiveAmountCents: number;
  apportionedAmountCents: number;
  partner1AmountCents: number;
  partner2AmountCents: number;
  plannedAmountR$: number;
  effectiveAmountR$: number;
  apportionedAmountR$: number;
  status: 'paid' | 'pending' | 'overdue';
  paidDate?: string;
  paymentMethod?: string;
  paidBy: PaidBy;
  linkedExpenseId?: string;
  linkedSliceId?: string;
  isEssential: boolean;
  priority: ExpensePriority;
  nature: ExpenseNature;
  autoPay: boolean;
  isRecurring: boolean;
  active: boolean;
  bankAccountOrCard?: string;
  alreadyInExpenses: boolean;
}

/**
 * 29B: Projeção única compartilhada de ocorrências fixas da competência.
 * Alimenta Painel de Fixos, Matriz Orçamentária, Calendário, Termômetro e Couple Hub sem ciclos.
 */
export function projectSharedFixedOccurrences(
  state: AppState,
  competenceMonth: string,
  scope: ProjectionScope = 'couple',
  todayDateStr?: string
): {
  occurrences: SharedFixedOccurrenceProjection[];
  registryConflicts: FixedBillRegistryConflict[];
} {
  const today = todayDateStr || new Date().toISOString().slice(0, 10);
  const [yearNum, monthNum] = competenceMonth.split('-').map(Number);
  const { bills: canonicalBills, conflicts: registryConflicts } = selectCanonicalFixedBillsRegistry(state);
  const expenses = state.expenses || [];
  const occurrences: SharedFixedOccurrenceProjection[] = [];
  const matchedExpenseIdsForBills = new Set<string>();

  // 1. Contas fixas cadastradas (coupleFixedBills + fixedBillAlerts reconciliados)
  for (const bill of canonicalBills) {
    const historyEntry = bill.history?.[competenceMonth];
    const matchingExpense = expenses.find((e) =>
      doesExpenseMatchBillCompetence(e, bill.id, competenceMonth)
    );
    if (matchingExpense) {
      matchedExpenseIdsForBills.add(matchingExpense.id);
    }

    // Verifica baixa: history explícita da competência, linkedExpense da competência,
    // ou legado sem history onde status === 'paid' && lastPaidMonth === competenceMonth (ou sem lastPaidMonth quando dueDate é desta competência)
    const hasHistoryForCompetence = Boolean(historyEntry);
    const isLegacySinglePaid =
      !hasHistoryForCompetence &&
      ((bill.lastPaidMonth === competenceMonth &&
        bill.status !== 'pending' &&
        (bill.status as string) !== 'estornado') ||
        ((bill.status === 'paid' || (bill.status as string) === 'pago') &&
          !bill.lastPaidMonth &&
          bill.dueDate?.slice(0, 7) === competenceMonth));

    const isPaid =
      historyEntry?.status === 'paid' || Boolean(matchingExpense) || isLegacySinglePaid;

    if (!isFixedBillActiveInCompetence(bill, competenceMonth, isPaid)) {
      continue;
    }

    const plannedCents = toSafeCents(bill.amount, bill.amountCents);
    const effectiveCents = isPaid
      ? matchingExpense
        ? toSafeCents(matchingExpense.amount, matchingExpense.amountCents)
        : historyEntry?.paidAmount !== undefined
        ? toSafeCents(historyEntry.paidAmount)
        : plannedCents
      : plannedCents;

    const effectivePayer: PaidBy =
      (matchingExpense?.paidBy ||
        historyEntry?.paidBy ||
        bill.assignedPayer ||
        bill.assignedTo ||
        'both') as PaidBy;

    const splitP1 = matchingExpense?.splitPartner1Pct ?? bill.splitPartner1Pct;
    const splitP2 = matchingExpense?.splitPartner2Pct ?? bill.splitPartner2Pct;
    const split = apportionCentsByScope(effectiveCents, scope, effectivePayer, splitP1, splitP2);
    if (!split.isInScope) continue;

    const safeDueDay = clampDayToMonth(yearNum, monthNum, bill.dueDay || 10);
    const dueDateStr = `${competenceMonth}-${String(safeDueDay).padStart(2, '0')}`;
    const status: 'paid' | 'pending' | 'overdue' = isPaid
      ? 'paid'
      : historyEntry?.status === 'overdue' || dueDateStr < today
      ? 'overdue'
      : 'pending';

    const catKey = mapToCanonicalCategoryKey(bill.category);
    const meta = CATEGORY_PRESENTATION_META[catKey] || CATEGORY_PRESENTATION_META.moradia;
    const priority: ExpensePriority =
      bill.priority ||
      matchingExpense?.priority ||
      (meta.isEssentialDefault ? 'essencial' : 'dispensavel');
    const isEssential = resolveIsEssentialFromPriority(bill.priority ?? matchingExpense?.priority, catKey);

    occurrences.push({
      id: `occ-bill-${bill.id}-${competenceMonth}`,
      sourceType: 'fixed_bill',
      sourceId: bill.id,
      title: bill.title,
      categoryKey: catKey,
      categoryLabel: meta.label,
      categoryEmoji: meta.emoji,
      competenceMonth,
      dueDay: safeDueDay,
      dueDateStr,
      plannedAmountCents: plannedCents,
      effectiveAmountCents: effectiveCents,
      apportionedAmountCents: split.scopedCents,
      partner1AmountCents: split.partner1Cents,
      partner2AmountCents: split.partner2Cents,
      plannedAmountR$: roundMoney(plannedCents / 100),
      effectiveAmountR$: roundMoney(effectiveCents / 100),
      apportionedAmountR$: roundMoney(split.scopedCents / 100),
      status,
      paidDate: isPaid ? matchingExpense?.date || historyEntry?.paidAt || dueDateStr : undefined,
      paymentMethod: isPaid ? matchingExpense?.paymentMethod || historyEntry?.paymentMethod : undefined,
      paidBy: effectivePayer,
      linkedExpenseId: matchingExpense?.id || historyEntry?.linkedExpenseId,
      isEssential,
      priority,
      nature: bill.nature || 'fixa',
      autoPay: Boolean(bill.autoPay),
      isRecurring: bill.isRecurring !== undefined ? bill.isRecurring : true,
      active: bill.active !== false,
      bankAccountOrCard: bill.bankAccountOrCard,
      alreadyInExpenses: Boolean(matchingExpense),
    });
  }

  // 2. Fatias diretas de natureza fixa (respeitando splits e prioridade por fatia — R29-12 & R29-13)
  const parentIdsWithSplits = new Set(
    expenses.filter((e) => e.splits && e.splits.length > 0).map((e) => e.id)
  );

  for (const exp of expenses) {
    if (!exp) continue;
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    if (exp.linkedBillId && matchedExpenseIdsForBills.has(exp.id)) continue;
    // Se tem linkedBillId mas pertence a outra competência, não entra nesta competência
    if (exp.linkedBillId && !doesExpenseMatchBillCompetence(exp, exp.linkedBillId, competenceMonth)) {
      continue;
    }

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });

    for (const slice of slices) {
      if (slice.competenceMonth !== competenceMonth) continue;
      if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') continue;
      if (!slice.hasReliableNature || slice.resolvedNature !== 'fixa') continue;
      // Se veio de uma parcela fixa já tratada abaixo? Não: se já está em expenses, tratamos aqui ou no vínculo de parcela sem duplicar!
      if (exp.installmentId) continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (!split.isInScope) continue;

      const catKey = mapToCanonicalCategoryKey(slice.category);
      const meta = CATEGORY_PRESENTATION_META[catKey] || CATEGORY_PRESENTATION_META.moradia;
      const dayNum = Number((exp.date || '').split('-')[2] || 1);
      const occId = slice.isVirtualSingleSplit
        ? `occ-exp-${exp.id}`
        : `occ-slice-${exp.id}-${slice.splitId}`;
      const sliceTitle = slice.isVirtualSingleSplit
        ? exp.description
        : `${exp.description} (${slice.subcategory || slice.notes || meta.label})`;

      occurrences.push({
        id: occId,
        sourceType: 'fixed_expense',
        sourceId: slice.isVirtualSingleSplit ? exp.id : slice.splitId,
        title: sliceTitle,
        categoryKey: catKey,
        categoryLabel: meta.label,
        categoryEmoji: meta.emoji,
        competenceMonth,
        dueDay: Math.max(1, Math.min(31, dayNum || 1)),
        dueDateStr: exp.date,
        plannedAmountCents: slice.amountCents,
        effectiveAmountCents: slice.amountCents,
        apportionedAmountCents: split.scopedCents,
        partner1AmountCents: split.partner1Cents,
        partner2AmountCents: split.partner2Cents,
        plannedAmountR$: slice.amount,
        effectiveAmountR$: slice.amount,
        apportionedAmountR$: roundMoney(split.scopedCents / 100),
        status: 'paid',
        paidDate: exp.date,
        paymentMethod: exp.paymentMethod,
        paidBy: slice.paidBy,
        linkedExpenseId: exp.id,
        linkedSliceId: slice.splitId,
        isEssential: slice.isEssential,
        priority: slice.priority,
        nature: slice.nature,
        autoPay: false,
        isRecurring: false,
        active: true,
        bankAccountOrCard: exp.bankName,
        alreadyInExpenses: true,
      });
    }
  }

  // 3. Parcelas estruturais / de natureza fixa (sem duplicar se já lançadas em expenses)
  const instOccurrences = projectInstallmentOccurrencesForCompetence(
    state,
    competenceMonth,
    scope,
    today
  );
  for (const instOcc of instOccurrences) {
    if (!instOcc.isFixedNature) continue;
    if (instOcc.isExcludedFromMonthlyBudget) continue;
    const catKey = mapToCanonicalCategoryKey(instOcc.category);
    const meta = CATEGORY_PRESENTATION_META[catKey] || CATEGORY_PRESENTATION_META.moradia;
    const normStatus: 'paid' | 'pending' | 'overdue' =
      instOcc.status === 'paid' || instOcc.status === 'advanced'
        ? 'paid'
        : instOcc.status === 'overdue'
        ? 'overdue'
        : 'pending';

    occurrences.push({
      id: `occ-inst-${instOcc.installmentId}-${competenceMonth}-${instOcc.installmentNumber}`,
      sourceType: 'fixed_installment',
      sourceId: instOcc.installmentId,
      title: `${instOcc.title} (${instOcc.installmentNumber}/${instOcc.totalInstallments})`,
      categoryKey: catKey,
      categoryLabel: meta.label,
      categoryEmoji: meta.emoji,
      competenceMonth,
      dueDay: instOcc.dueDay,
      dueDateStr: instOcc.dueDate,
      plannedAmountCents: instOcc.plannedCents,
      effectiveAmountCents: instOcc.effectiveCents,
      apportionedAmountCents: instOcc.scopedCents,
      partner1AmountCents: instOcc.partner1Cents,
      partner2AmountCents: instOcc.partner2Cents,
      plannedAmountR$: roundMoney(instOcc.plannedCents / 100),
      effectiveAmountR$: roundMoney(instOcc.effectiveCents / 100),
      apportionedAmountR$: roundMoney(instOcc.scopedCents / 100),
      status: normStatus,
      paidDate: normStatus === 'paid' ? instOcc.dueDate : undefined,
      paidBy: instOcc.paidBy,
      linkedExpenseId: instOcc.linkedExpenseId,
      isEssential: instOcc.isEssential,
      priority: instOcc.priority,
      nature: instOcc.nature,
      autoPay: false,
      isRecurring: true,
      active: true,
      bankAccountOrCard: instOcc.bankName,
      alreadyInExpenses: instOcc.alreadyInExpenses,
    });
  }

  occurrences.sort((a, b) => {
    const statusOrder = { overdue: 0, pending: 1, paid: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.dueDay - b.dueDay;
  });

  return { occurrences, registryConflicts };
}
