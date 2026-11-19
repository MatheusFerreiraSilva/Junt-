import {
  AppState,
  CeilingState,
  ExpenseItem,
  PaidBy,
  ReinforcementProvenanceRef,
} from '../types/finance';
import {
  apportionCentsByScope,
  clampDayToMonth,
  doesExpenseMatchBillCompetence,
  getDaysInMonth,
  isFixedBillActiveInCompetence,
  projectCanonicalExpenseSlices,
  projectInstallmentOccurrencesForCompetence,
  roundMoney,
  selectCanonicalFixedBillsRegistry,
  toSafeCents,
} from './occurrenceProjection';
import {
  selectCategoryReinforcementSummary,
  selectEffectiveBudgetPlanForCompetence,
  selectVerifiableCashSummary,
} from './domainSelectors';

export { roundMoney };

export type ThermometerScope = 'couple' | 'partner1' | 'partner2';

export type ThermometerStatusState =
  | 'dentro_do_plano'
  | 'atencao'
  | 'ajuste_necessario'
  | 'dados_insuficientes';

export interface RingSegmentFill {
  index: number;
  label: string;
  color: string;
  fillFraction: number; // 0.0 to 1.0
  startPercent: number; // e.g. 0, 20, 40, 60, 80
  endPercent: number; // e.g. 20, 40, 60, 80, 100
}

export interface ExceptionalReservation {
  id: string;
  title: string;
  amount: number;
  date: string;
  confirmed: boolean;
}

export interface ThermometerEngineResult {
  scope: ThermometerScope;
  monthKey: string;
  todayDateStr: string;

  // Reading A: Plano do Mês
  declaredIncome: number;
  programmedSavings: number;
  baseExpenseBudget?: number; // Meta habitual de despesas (antes de reforços temporários)
  reinforcementAmount?: number; // Reforço temporário ativo na competência
  reallocationNetAmount?: number; // Realocações líquidas na competência
  hasTemporaryReinforcement?: boolean;
  reinforcementSources?: ReinforcementProvenanceRef[];
  verifiableCashStatus?: 'known' | 'partial' | 'unknown';
  expenseBudget: number; // Denominator for expense budget (base + reforço ativo)
  hasExplicitCeiling?: boolean;
  ceilingState?: CeilingState;
  spentSoFar: number;
  pendingCommitmentsAmount: number;
  pendingCommitmentsList: {
    id: string;
    title: string;
    amount: number;
    type: 'bill' | 'installment' | 'pending_expense';
    dueDate?: string;
  }[];
  totalConsumedAmount: number; // spentSoFar + pendingCommitmentsAmount
  signedMargin: number; // expenseBudget - totalConsumedAmount
  suggestedNewMargin: number; // Math.max(0, signedMargin)
  deficitAmount: number; // Math.max(0, -signedMargin)
  budgetConsumedPercent: number | null; // null if expenseBudget === 0
  isOverBudget: boolean;

  // Ring 5-Segment Math
  ringSegments: RingSegmentFill[];
  overflowPercent: number; // Percent above 100% if over budget
  overflowAmount: number; // Amount above budget if over budget

  // Status State
  statusState: ThermometerStatusState;
  statusLabel: string;
  statusDescription: string;

  // Scope Split Summary
  partner1Spent: number;
  partner2Spent: number;
  bothSpent: number;

  // Reading B: Caixa Informado & Cobertura
  hasCashReconciliation: boolean;
  reconciledBankBalance: number;
  protectedFunds: number; // Reserve + piggy banks for scope
  availableCash: number;
  pendingMedicalReceivables: number;
  confirmedMedicalReceivables: number;

  // Moving 7-Day Window & Calendar Week
  daysInMonth: number;
  currentDayOfMonth: number;
  daysRemainingInMonth: number; // includes today if month active
  safeDailyLimit: number;
  exceptionalReservationsAmount: number;
  effectiveDailyLimitAfterReservations: number;
  moving7DayCommitmentsAmount: number;
  moving7DayCommitments: { id: string; title: string; amount: number; date: string }[];

  // Closing Projections (Scenarios)
  baseProjectedClosingSpent: number;
  baseProjectedClosingMargin: number;
  ceilingScenarioSpent?: number;
  ceilingScenarioMargin?: number;
  tightProjectedClosingSpent: number;
  tightProjectedClosingMargin: number;
  projectionHypotheses: string[];

  // Coverage & Confidence
  lastImportDate?: string;
  lastEntryDate?: string;
  lastConferredDate?: string;
  coverageStatus: 'conferido' | 'parcial' | 'pendente_conferencia';
  coverageMessage: string;

  // Decision Actions (Top 3)
  prioritizedActions: {
    id: string;
    title: string;
    description: string;
    actionType:
      | 'review_pending'
      | 'pay_bill'
      | 'sync_bank'
      | 'adjust_pacing'
      | 'simulate_delay'
      | 'reconcile_cash';
  }[];

  // What Changed Since Last Check
  whatChangedSummary: {
    newEntriesCount: number;
    newEntriesTotal: number;
    marginDelta: number;
    lastCheckedAt?: string;
  };
}

/**
 * Palette for the 5 segmented arcs representing successive 20% intervals (0-20, 20-40, 40-60, 60-80, 80-100)
 */
export const RING_SEGMENTS_CONFIG = [
  { color: '#10B981', label: '0% a 20% — Início Seguro' },
  { color: '#3B82F6', label: '20% a 40% — Estrutura Base' },
  { color: '#F59E0B', label: '40% a 60% — Ritmo Semanal' },
  { color: '#EC4899', label: '60% a 80% — Atenção de Consumo' },
  { color: '#8B5CF6', label: '80% a 100% — Teto do Plano' },
];

function isInternalTransferOrReimbursement(exp: ExpenseItem): boolean {
  const notes = (exp.notes || '').toLowerCase();
  const desc = (exp.description || '').toLowerCase();
  return notes.includes('reembolso interno') || desc.includes('transferência entre contas');
}

/**
 * Pure deterministic calculation engine for Juntô's Month Thermometer.
 * Reconciled in 29B with approved competence plans, canonical fixed bills,
 * explicit competence settlement, split slices, and exact integer-cent apportioning.
 */
export function calculateThermometerEngine(
  state: AppState,
  scope: ThermometerScope = 'couple',
  options?: {
    todayDateStr?: string;
    exceptionalReservations?: ExceptionalReservation[];
    lastWeeklyCheckInAt?: string;
    tightShiftDelayAmount?: number;
  }
): ThermometerEngineResult {
  const currentMonthKey = state.currentMonth || new Date().toISOString().slice(0, 7);
  const now = options?.todayDateStr ? new Date(options.todayDateStr + 'T12:00:00Z') : new Date();
  const todayDateStr = options?.todayDateStr || now.toISOString().slice(0, 10);

  // 1. Date math with timezone safety
  const [yearStr, monthStr] = currentMonthKey.split('-');
  const year = parseInt(yearStr, 10) || now.getUTCFullYear();
  const month = parseInt(monthStr, 10) || now.getUTCMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);

  const isCurrentMonthActive = todayDateStr.startsWith(currentMonthKey);
  const isPastMonth = todayDateStr > `${currentMonthKey}-31`;

  let currentDayOfMonth = 1;
  if (isCurrentMonthActive) {
    currentDayOfMonth = parseInt(todayDateStr.slice(8, 10), 10) || 1;
  } else if (isPastMonth) {
    currentDayOfMonth = daysInMonth;
  }

  const daysRemainingInMonth = isPastMonth
    ? 0
    : isCurrentMonthActive
    ? Math.max(1, daysInMonth - currentDayOfMonth + 1)
    : daysInMonth;

  // 2. Scope-based declared income & approved competence plan prioritization (R29-15 & 14)
  const plan = selectEffectiveBudgetPlanForCompetence(state, currentMonthKey).plan;
  let declaredIncome = 0;
  let programmedSavings = 0;
  let expenseBudget = 0;
  let hasExplicitCeiling = false;

  if (scope === 'couple' && plan) {
    declaredIncome = roundMoney(plan.plannedNetIncome || 0);
    const invPct =
      plan.macroGroups?.investimentos?.percentage ?? state.profile?.investmentsPercentage ?? 10;
    programmedSavings =
      plan.macroGroups?.investimentos?.amountR$ !== undefined
        ? roundMoney(plan.macroGroups.investimentos.amountR$)
        : roundMoney(declaredIncome * (invPct / 100));
    if (
      plan.macroGroups?.fixos?.amountR$ !== undefined ||
      plan.macroGroups?.variaveis?.amountR$ !== undefined
    ) {
      expenseBudget = Math.max(
        0,
        roundMoney(
          (plan.macroGroups?.fixos?.amountR$ ?? 0) + (plan.macroGroups?.variaveis?.amountR$ ?? 0)
        )
      );
    } else {
      expenseBudget = Math.max(0, roundMoney(declaredIncome - programmedSavings));
    }
    hasExplicitCeiling = true;
  } else if (
    (scope === 'partner1' || scope === 'partner2') &&
    plan?.partnerCeilings?.[scope] !== undefined
  ) {
    const pc = plan.partnerCeilings[scope]!;
    declaredIncome = roundMoney(
      pc.plannedNetIncome ??
        (scope === 'partner1' ? state.profile?.partner1Income || 0 : state.profile?.partner2Income || 0)
    );
    programmedSavings = roundMoney(pc.investTargetR$ ?? 0);
    if (pc.fixedCeilingR$ !== undefined || pc.variableCeilingR$ !== undefined) {
      expenseBudget = Math.max(
        0,
        roundMoney((pc.fixedCeilingR$ ?? 0) + (pc.variableCeilingR$ ?? 0))
      );
    } else {
      expenseBudget = Math.max(0, roundMoney(declaredIncome - programmedSavings));
    }
    hasExplicitCeiling = true;
  } else {
    if (scope === 'partner1') {
      declaredIncome = state.profile?.partner1Income || 0;
    } else if (scope === 'partner2') {
      declaredIncome = state.profile?.partner2Income || 0;
    } else {
      declaredIncome = (state.profile?.partner1Income || 0) + (state.profile?.partner2Income || 0);
    }
    declaredIncome = roundMoney(declaredIncome);
    const investmentsPct = state.profile?.investmentsPercentage ?? 10;
    programmedSavings = roundMoney(declaredIncome * (investmentsPct / 100));
    expenseBudget = Math.max(0, roundMoney(declaredIncome - programmedSavings));
    hasExplicitCeiling = declaredIncome > 0 || Boolean(state.isCustomizedPercentages);
  }

  const domainScope = scope === 'couple' ? 'casal' : scope;
  const reinforcementSummary = selectCategoryReinforcementSummary(state, domainScope, currentMonthKey);
  const cashSummary = selectVerifiableCashSummary(state, domainScope, todayDateStr);

  const baseExpenseBudget = roundMoney(expenseBudget);
  const reinforcementAmount = roundMoney(reinforcementSummary.totalReinforcementCents / 100);
  const reallocationNetAmount = roundMoney(reinforcementSummary.totalNetReallocCents / 100);
  const baseExpenseBudgetCents = toSafeCents(baseExpenseBudget);
  const effectiveExpenseBudgetCents = Math.max(
    0,
    baseExpenseBudgetCents +
      reinforcementSummary.totalReinforcementCents +
      reinforcementSummary.totalNetReallocCents
  );
  expenseBudget = roundMoney(effectiveExpenseBudgetCents / 100);
  hasExplicitCeiling = hasExplicitCeiling || reinforcementSummary.totalReinforcementCents > 0;

  const ceilingState: CeilingState = !hasExplicitCeiling
    ? 'absent'
    : expenseBudget > 0
    ? 'explicit_positive'
    : 'explicit_zero';

  // 3. Competence-reconciled routine expense slices in exact integer cents (R29-10, R29-12, R29-16)
  const parentIdsWithSplits = new Set(
    (state.expenses || [])
      .filter((e) => e.splits && e.splits.length > 0)
      .map((e) => e.id)
  );

  let partner1SpentCents = 0;
  let partner2SpentCents = 0;
  let bothSpentCents = 0;
  let spentSoFarCents = 0;
  const matchedCompetenceExpenses: ExpenseItem[] = [];

  for (const exp of state.expenses || []) {
    if (!exp) continue;
    if (exp.splitParentId && parentIdsWithSplits.has(exp.splitParentId)) continue;
    if (isInternalTransferOrReimbursement(exp)) continue;

    const slices = projectCanonicalExpenseSlices(exp, {
      keywordRules: state.keywordRules,
      installments: state.installments,
    });

    let expTouchedInCompetence = false;

    for (const slice of slices) {
      if (slice.competenceMonth !== currentMonthKey) continue;
      if (slice.isExcludedFromMonthlyBudget || slice.fundingSource !== 'month_budget') continue;

      const split = apportionCentsByScope(
        slice.amountCents,
        scope,
        slice.paidBy,
        exp.splitPartner1Pct,
        exp.splitPartner2Pct,
        slice.assignedTo
      );
      if (!split.isInScope) continue;

      expTouchedInCompetence = true;
      partner1SpentCents += split.partner1Cents;
      partner2SpentCents += split.partner2Cents;
      if (slice.paidBy !== 'partner1' && slice.paidBy !== 'partner2') {
        bothSpentCents += split.coupleCents;
      }
      spentSoFarCents += split.scopedCents;
    }

    if (expTouchedInCompetence) {
      matchedCompetenceExpenses.push(exp);
    }
  }

  const spentSoFar = roundMoney(spentSoFarCents / 100);
  const partner1Spent = roundMoney(partner1SpentCents / 100);
  const partner2Spent = roundMoney(partner2SpentCents / 100);
  const bothSpent = roundMoney(bothSpentCents / 100);

  // 4. Canonical pending commitments (Fixed bills + Active installments not yet settled in competence)
  const pendingCommitmentsList: {
    id: string;
    title: string;
    amount: number;
    type: 'bill' | 'installment' | 'pending_expense';
    dueDate?: string;
  }[] = [];
  let pendingCommitmentsCents = 0;

  // A) Canonical fixed bills (coupleFixedBills + fixedBillAlerts reconciled, R29-10, R29-11, R29-17, R29-18)
  const { bills: canonicalBills } = selectCanonicalFixedBillsRegistry(state);
  canonicalBills.forEach((bill) => {
    const hist = bill.history?.[currentMonthKey];
    const paidExpense = (state.expenses || []).find((exp) =>
      doesExpenseMatchBillCompetence(exp, bill.id, currentMonthKey)
    );
    const hasHistoryForMonth = Boolean(hist);
    const isLegacySinglePaid =
      !hasHistoryForMonth &&
      ((bill.lastPaidMonth === currentMonthKey &&
        bill.status !== 'pending' &&
        (bill.status as string) !== 'estornado') ||
        ((bill.status === 'paid' || (bill.status as string) === 'pago') &&
          !bill.lastPaidMonth &&
          bill.dueDate?.slice(0, 7) === currentMonthKey));

    const isAlreadyPaid =
      hist?.status === 'paid' || Boolean(paidExpense) || isLegacySinglePaid;

    if (!isFixedBillActiveInCompetence(bill, currentMonthKey, isAlreadyPaid)) {
      return;
    }

    if (!isAlreadyPaid) {
      const billCents = toSafeCents(bill.amount, bill.amountCents);
      const split = apportionCentsByScope(
        billCents,
        scope,
        bill.assignedPayer || bill.assignedTo || 'both',
        bill.splitPartner1Pct,
        bill.splitPartner2Pct
      );
      if (!split.isInScope) return;

      const dueDay = clampDayToMonth(year, month, bill.dueDay || 10);
      const dueDate = `${currentMonthKey}-${String(dueDay).padStart(2, '0')}`;

      pendingCommitmentsCents += split.scopedCents;
      pendingCommitmentsList.push({
        id: `bill-${bill.id}`,
        title: bill.title,
        amount: roundMoney(split.scopedCents / 100),
        type: 'bill',
        dueDate,
      });
    }
  });

  // B) Active installments due in currentMonthKey not yet paid/advanced or in expenses
  const activeInstallmentsOnly = (state.installments || []).filter((inst) => inst.active !== false);
  const instOccurrences = projectInstallmentOccurrencesForCompetence(
    { installments: activeInstallmentsOnly, expenses: state.expenses },
    currentMonthKey,
    scope,
    todayDateStr
  );

  instOccurrences.forEach((instOcc) => {
    if (instOcc.alreadyInExpenses || instOcc.status === 'paid' || instOcc.status === 'advanced') {
      return;
    }
    pendingCommitmentsCents += instOcc.scopedCents;
    pendingCommitmentsList.push({
      id: `inst-${instOcc.installmentId}`,
      title: `${instOcc.title} (${instOcc.installmentNumber}/${instOcc.totalInstallments})`,
      amount: roundMoney(instOcc.scopedCents / 100),
      type: 'installment',
      dueDate: instOcc.dueDate,
    });
  });

  const pendingCommitmentsAmount = roundMoney(pendingCommitmentsCents / 100);
  const totalConsumedCents = spentSoFarCents + pendingCommitmentsCents;
  const totalConsumedAmount = roundMoney(totalConsumedCents / 100);

  // 5. Signed margin & Deficit
  const expenseBudgetCents = toSafeCents(expenseBudget);
  const signedMarginCents = expenseBudgetCents - totalConsumedCents;
  const signedMargin = roundMoney(signedMarginCents / 100);
  const suggestedNewMargin = Math.max(0, signedMargin);
  const deficitAmount = Math.max(0, -signedMargin);
  const isOverBudget = hasExplicitCeiling && signedMarginCents < 0;

  const budgetConsumedPercent =
    expenseBudgetCents > 0 ? Math.round((totalConsumedCents / expenseBudgetCents) * 100) : null;

  // 6. 5-Segment Ring Math (Fractional fill per 20% block)
  const percentVal = budgetConsumedPercent !== null ? budgetConsumedPercent : 0;
  const ringSegments: RingSegmentFill[] = RING_SEGMENTS_CONFIG.map((conf, i) => {
    const startPercent = i * 20;
    const endPercent = (i + 1) * 20;

    let fillFraction = 0;
    if (percentVal >= endPercent) {
      fillFraction = 1.0;
    } else if (percentVal <= startPercent) {
      fillFraction = 0.0;
    } else {
      fillFraction = (percentVal - startPercent) / 20;
    }

    return {
      index: i,
      label: conf.label,
      color: conf.color,
      fillFraction: Math.min(1.0, Math.max(0.0, fillFraction)),
      startPercent,
      endPercent,
    };
  });

  const overflowPercent = percentVal > 100 ? percentVal - 100 : 0;
  const overflowAmount = isOverBudget ? deficitAmount : 0;

  // 7. Status State Determination
  let statusState: ThermometerStatusState = 'dentro_do_plano';
  let statusLabel = 'Dentro do Plano';
  let statusDescription = 'Os gastos e compromissos estão em equilíbrio com o orçamento do mês.';

  if (!hasExplicitCeiling || (ceilingState !== 'explicit_zero' && (expenseBudget <= 0 || declaredIncome <= 0))) {
    statusState = 'dados_insuficientes';
    statusLabel = 'Dados Insuficientes';
    statusDescription =
      'Cadastrem a renda de vocês nos ajustes para ativar o orçamento determinístico.';
  } else if (isOverBudget) {
    statusState = 'ajuste_necessario';
    statusLabel = 'Ajuste Necessário';
    statusDescription = `O consumo excedeu o orçamento em ${formatCurrency(deficitAmount)}. Recomendamos recalibrar compras do fim de semana.`;
  } else if (
    percentVal > 85 ||
    (daysRemainingInMonth > 10 && percentVal > (currentDayOfMonth / daysInMonth) * 100 + 20)
  ) {
    statusState = 'atencao';
    statusLabel = 'Atenção ao Ritmo';
    statusDescription =
      'O orçamento está em ritmo acelerado. Vale conferir os próximos vencimentos.';
  }

  // 8. Reading B: Caixa Informado & Cobertura de Extrato
  let reconciledBankBalance = 0;
  let hasCashReconciliation = false;
  let protectedFunds = 0;
  let availableCash = 0;

  const validAccounts = (state.linkedAccounts || []).filter((acc) => {
    if (acc.status === 'error') return false;
    if (typeof acc.balance !== 'number' || Number.isNaN(acc.balance)) return false;
    if (scope === 'partner1' && acc.holder === 'partner2') return false;
    if (scope === 'partner2' && acc.holder === 'partner1') return false;
    return true;
  });

  if (validAccounts.length > 0) {
    hasCashReconciliation = true;
    reconciledBankBalance = roundMoney(
      validAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    );

    if (scope === 'couple') {
      protectedFunds =
        (state.protectionCurrentAmount || 0) +
        (state.piggyBanks || []).reduce((sum, b) => sum + (b.currentAmount || 0), 0);
    } else if (scope === 'partner1') {
      const reserveShare = roundMoney((state.protectionCurrentAmount || 0) * 0.5);
      const piggyShare = (state.piggyBanks || []).reduce((sum, b) => {
        const sharePct =
          b.coupleAgreement?.type === 'proportional'
            ? b.coupleAgreement.partner1SharePct / 100
            : 0.5;
        return sum + roundMoney((b.currentAmount || 0) * sharePct);
      }, 0);
      protectedFunds = reserveShare + piggyShare;
    } else {
      const reserveShare = roundMoney((state.protectionCurrentAmount || 0) * 0.5);
      const piggyShare = (state.piggyBanks || []).reduce((sum, b) => {
        const sharePct =
          b.coupleAgreement?.type === 'proportional'
            ? b.coupleAgreement.partner2SharePct / 100
            : 0.5;
        return sum + roundMoney((b.currentAmount || 0) * sharePct);
      }, 0);
      protectedFunds = reserveShare + piggyShare;
    }
    protectedFunds = roundMoney(protectedFunds);
    availableCash = roundMoney(reconciledBankBalance - protectedFunds);
  }

  // Medical Receivables (Pending vs Confirmed — projected income never unlocks cash!)
  let pendingMedicalReceivables = 0;
  let confirmedMedicalReceivables = 0;

  (state.medicalShifts || []).forEach((shift) => {
    if (shift.executionStatus === 'cancelled' || shift.executionStatus === 'replaced') return;
    if (scope === 'partner1' && shift.partner === 'partner2') return;
    if (scope === 'partner2' && shift.partner === 'partner1') return;

    const totalExpected =
      shift.netAmount !== undefined ? shift.netAmount : shift.grossAmount ?? 0;
    const totalCents = Math.round(totalExpected * 100);
    const allocatedCents = (state.shiftIncomeAllocations || []).reduce(
      (sum, ledger) => sum + (ledger.allocations[shift.id] || 0),
      0
    );
    const outstandingCents = Math.max(0, totalCents - allocatedCents);

    const payMonth = (shift.estimatedPayDate || shift.dateWorked).slice(0, 7);
    const actualPayMonth = shift.actualPayDate ? shift.actualPayDate.slice(0, 7) : undefined;

    if (shift.status === 'received') {
      if (
        (actualPayMonth && actualPayMonth === currentMonthKey) ||
        (!actualPayMonth && payMonth === currentMonthKey)
      ) {
        confirmedMedicalReceivables += totalCents / 100;
      }
    } else {
      const isDueOrOverdue =
        payMonth === currentMonthKey ||
        shift.status === 'overdue' ||
        (Boolean(shift.estimatedPayDate) && shift.estimatedPayDate < todayDateStr);

      if (isDueOrOverdue) {
        pendingMedicalReceivables += outstandingCents / 100;
      }

      if (
        allocatedCents > 0 &&
        ((actualPayMonth && actualPayMonth === currentMonthKey) || payMonth === currentMonthKey)
      ) {
        confirmedMedicalReceivables += allocatedCents / 100;
      }
    }
  });

  pendingMedicalReceivables = roundMoney(pendingMedicalReceivables);
  confirmedMedicalReceivables = roundMoney(confirmedMedicalReceivables);

  // 9. Moving 7-Day Window & Daily Limit
  const exceptionalReservations = options?.exceptionalReservations || [];
  const exceptionalReservationsAmount = exceptionalReservations
    .filter((r) => r.confirmed)
    .reduce((sum, r) => sum + r.amount, 0);

  const netMarginForDailyLimit = Math.max(0, signedMargin - exceptionalReservationsAmount);
  const safeDailyLimit =
    daysRemainingInMonth > 0 && netMarginForDailyLimit > 0
      ? Math.round(netMarginForDailyLimit / daysRemainingInMonth)
      : 0;

  const effectiveDailyLimitAfterReservations = safeDailyLimit;

  const next7DaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const moving7DayCommitments = pendingCommitmentsList
    .filter((c) => c.dueDate && c.dueDate >= todayDateStr && c.dueDate <= next7DaysEnd)
    .map((c) => ({
      id: c.id,
      title: c.title,
      amount: c.amount,
      date: c.dueDate || todayDateStr,
    }));

  const moving7DayCommitmentsAmount = roundMoney(
    moving7DayCommitments.reduce((sum, c) => sum + toSafeCents(c.amount), 0) / 100
  );

  // 10. Closing Projections: separate historical run-rate from ceiling scenario
  const elapsedDays = Math.max(1, currentDayOfMonth);
  const dailyRunRate = spentSoFar / elapsedDays;
  const remainingDays = Math.max(0, daysInMonth - currentDayOfMonth);
  const projectedVariableRemaining = roundMoney(dailyRunRate * remainingDays);

  const baseProjectedClosingSpent = roundMoney(
    spentSoFar + pendingCommitmentsAmount + projectedVariableRemaining
  );
  const baseProjectedClosingMargin = roundMoney(expenseBudget - baseProjectedClosingSpent);

  const ceilingScenarioSpent = isOverBudget ? totalConsumedAmount : expenseBudget;
  const ceilingScenarioMargin = roundMoney(expenseBudget - ceilingScenarioSpent);

  const tightShiftDelay = options?.tightShiftDelayAmount || 0;
  const tightProjectedClosingSpent = roundMoney(
    baseProjectedClosingSpent + (isOverBudget ? 0 : expenseBudget * 0.1)
  );
  const tightProjectedClosingMargin = roundMoney(
    expenseBudget - tightProjectedClosingSpent - tightShiftDelay
  );

  const projectionHypotheses = [
    `Compromissos fixos e parcelas de ${formatCurrency(pendingCommitmentsAmount)} contados exatamente 1x`,
    `Projeção histórica por ritmo realizado de ${formatCurrency(roundMoney(dailyRunRate))}/dia (${remainingDays} dias restantes)`,
    `Cenário teto limitando gastos a ${formatCurrency(safeDailyLimit)}/dia nos ${daysRemainingInMonth} dias`,
    `Aportes programados de ${formatCurrency(programmedSavings)} blindados no início do mês`,
  ];

  // 11. Coverage & Confidence Status
  let lastImportDate: string | undefined;
  let lastEntryDate: string | undefined;

  if (state.expenses && state.expenses.length > 0) {
    const dates = state.expenses.map((e) => e.date).sort();
    lastEntryDate = dates[dates.length - 1];
  }

  if (state.bankImportedTransactions && state.bankImportedTransactions.length > 0) {
    const dates = state.bankImportedTransactions.map((t) => t.date).sort();
    lastImportDate = dates[dates.length - 1];
  }

  const lastConferredDate = options?.lastWeeklyCheckInAt || state.lastWeeklyCheckInAt;

  let coverageStatus: 'conferido' | 'parcial' | 'pendente_conferencia' = 'pendente_conferencia';
  let coverageMessage = 'Nenhuma conferência semanal registrada pelo casal ainda neste mês.';

  if (lastConferredDate) {
    coverageStatus = 'conferido';
    coverageMessage = `Conferência do casal realizada em ${lastConferredDate}.`;
  } else if (lastImportDate || lastEntryDate) {
    coverageStatus = 'parcial';
    coverageMessage =
      'Lançamentos presentes, mas conferência semanal do casal ainda pendente.';
  }

  // 12. Top 3 Prioritized Decision Actions
  const prioritizedActions: ThermometerEngineResult['prioritizedActions'] = [];

  if (isOverBudget) {
    prioritizedActions.push({
      id: 'act-rebalance',
      title: 'Ajustar Gastos das Próximas Semanas',
      description: `O orçamento excedeu R$ ${deficitAmount.toLocaleString('pt-BR')}. Rever passeios ou adiar uma compra reequilibra o mês.`,
      actionType: 'adjust_pacing',
    });
  }

  if (pendingCommitmentsList.length > 0) {
    const topPending = pendingCommitmentsList[0];
    prioritizedActions.push({
      id: 'act-pay-bill',
      title: `Confirmar Vencimento: ${topPending.title}`,
      description: `Valor de R$ ${topPending.amount.toLocaleString('pt-BR')} pendente no plano do mês.`,
      actionType: 'pay_bill',
    });
  }

  if (!hasCashReconciliation) {
    prioritizedActions.push({
      id: 'act-reconcile-cash',
      title: 'Conferir Saldo dos Bancos',
      description:
        'Conectem ou informem o saldo para visualizar a leitura de caixa conjunto.',
      actionType: 'reconcile_cash',
    });
  }

  if (prioritizedActions.length < 3) {
    prioritizedActions.push({
      id: 'act-review-pending',
      title: 'Revisar Lançamentos Pendentes',
      description: 'Conferir se houve novos lançamentos manuais ou no extrato bancário.',
      actionType: 'review_pending',
    });
  }

  // What Changed Summary
  let newEntriesSinceConference = matchedCompetenceExpenses;
  if (lastConferredDate) {
    newEntriesSinceConference = matchedCompetenceExpenses.filter(
      (e) => e.date > lastConferredDate
    );
  }

  const whatChangedSummary = {
    newEntriesCount: newEntriesSinceConference.length,
    newEntriesTotal: roundMoney(
      newEntriesSinceConference.reduce(
        (sum, e) => sum + toSafeCents(e.amount, e.amountCents),
        0
      ) / 100
    ),
    marginDelta: signedMargin,
    lastCheckedAt: lastConferredDate,
  };

  return {
    scope,
    monthKey: currentMonthKey,
    todayDateStr,
    declaredIncome,
    programmedSavings,
    baseExpenseBudget,
    reinforcementAmount,
    reallocationNetAmount,
    hasTemporaryReinforcement: reinforcementSummary.totalReinforcementCents > 0,
    reinforcementSources: reinforcementSummary.allSources,
    verifiableCashStatus: cashSummary.status,
    expenseBudget,
    hasExplicitCeiling,
    ceilingState,
    spentSoFar,
    pendingCommitmentsAmount,
    pendingCommitmentsList,
    totalConsumedAmount,
    signedMargin,
    suggestedNewMargin,
    deficitAmount,
    budgetConsumedPercent,
    isOverBudget,
    ringSegments,
    overflowPercent,
    overflowAmount,
    statusState,
    statusLabel,
    statusDescription,
    partner1Spent,
    partner2Spent,
    bothSpent,
    hasCashReconciliation,
    reconciledBankBalance,
    protectedFunds,
    availableCash,
    pendingMedicalReceivables,
    confirmedMedicalReceivables,
    daysInMonth,
    currentDayOfMonth,
    daysRemainingInMonth,
    safeDailyLimit,
    exceptionalReservationsAmount,
    effectiveDailyLimitAfterReservations,
    moving7DayCommitmentsAmount,
    moving7DayCommitments,
    baseProjectedClosingSpent,
    baseProjectedClosingMargin,
    ceilingScenarioSpent,
    ceilingScenarioMargin,
    tightProjectedClosingSpent,
    tightProjectedClosingMargin,
    projectionHypotheses,
    lastImportDate,
    lastEntryDate,
    lastConferredDate,
    coverageStatus,
    coverageMessage,
    prioritizedActions: prioritizedActions.slice(0, 3),
    whatChangedSummary,
  };
}

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
