import {
  AppState,
  CategoryKey,
  ExpenseItem,
  FixedBillAlert,
  InstallmentPurchase,
  LifeTierInfo,
  MedicalShift,
  PaidBy,
} from '../types/finance';
import { installmentInMonth } from './installmentMoney';

export const roundMoney = (val: number): number => Math.round(val * 100) / 100;

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
  expenseBudget: number; // Denominator for expense budget
  spentSoFar: number;
  pendingCommitmentsAmount: number;
  pendingCommitmentsList: { id: string; title: string; amount: number; type: 'bill' | 'installment' | 'pending_expense'; dueDate?: string }[];
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
  prioritizedActions: { id: string; title: string; description: string; actionType: 'review_pending' | 'pay_bill' | 'sync_bank' | 'adjust_pacing' | 'simulate_delay' | 'reconcile_cash' }[];

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

/**
 * Pure deterministic calculation engine for Juntô's Month Thermometer
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
  const month = parseInt(monthStr, 10) || (now.getUTCMonth() + 1);

  // Number of days in the current month (handles leap year automatically via Date(year, month, 0))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const isCurrentMonthActive = todayDateStr.startsWith(currentMonthKey);
  const isPastMonth = todayDateStr > `${currentMonthKey}-31`;

  let currentDayOfMonth = 1;
  if (isCurrentMonthActive) {
    currentDayOfMonth = parseInt(todayDateStr.slice(8, 10), 10) || 1;
  } else if (isPastMonth) {
    currentDayOfMonth = daysInMonth;
  }

  // Days remaining in month including today if active
  const daysRemainingInMonth = isPastMonth
    ? 0
    : isCurrentMonthActive
    ? Math.max(1, daysInMonth - currentDayOfMonth + 1)
    : daysInMonth;

  // 2. Scope-based declared income
  let declaredIncome = 0;
  if (scope === 'partner1') {
    declaredIncome = state.profile.partner1Income || 0;
  } else if (scope === 'partner2') {
    declaredIncome = state.profile.partner2Income || 0;
  } else {
    declaredIncome = (state.profile.partner1Income || 0) + (state.profile.partner2Income || 0);
  }
  declaredIncome = roundMoney(declaredIncome);

  // Programmed savings / investments (default 10% or profile setting)
  const investmentsPct = state.profile.investmentsPercentage ?? 10;
  const programmedSavings = roundMoney(declaredIncome * (investmentsPct / 100));

  // Expense budget (excluding savings)
  const expenseBudget = Math.max(0, roundMoney(declaredIncome - programmedSavings));

  // 3. Filter current month expenses EXCLUDING non-economic expenses
  const currentMonthExpenses = (state.expenses || []).filter(exp => {
    if (!exp.date.startsWith(currentMonthKey)) return false;

    // Filter by scope
    if (scope === 'partner1' && exp.paidBy === 'partner2') return false;
    if (scope === 'partner2' && exp.paidBy === 'partner1') return false;

    // Exclude non-monthly-budget items (e.g. funded directly from reserve, piggy bank or allowance)
    const isExcluded =
      exp.isExcludedFromMonthlyBudget ||
      (exp.fundingSource && exp.fundingSource !== 'month_budget');

    // Exclude internal transfers or reimbursement records
    if (exp.notes?.toLowerCase().includes('reembolso interno') || exp.description?.toLowerCase().includes('transferência entre contas')) {
      return false;
    }

    return !isExcluded;
  });

  // Calculate spent so far with scope-precise apportioning
  let partner1Spent = 0;
  let partner2Spent = 0;
  let bothSpent = 0;
  let spentSoFar = 0;

  currentMonthExpenses.forEach(exp => {
    let p1Amount = 0;
    let p2Amount = 0;

    if (exp.paidBy === 'partner1') {
      p1Amount = exp.amount;
    } else if (exp.paidBy === 'partner2') {
      p2Amount = exp.amount;
    } else {
      // both or custom
      const p1Pct = typeof exp.splitPartner1Pct === 'number' ? exp.splitPartner1Pct : 50;
      const p2Pct = typeof exp.splitPartner2Pct === 'number' ? exp.splitPartner2Pct : (100 - p1Pct);
      p1Amount = roundMoney(exp.amount * (p1Pct / 100));
      p2Amount = roundMoney(exp.amount * (p2Pct / 100));
      bothSpent += exp.amount;
    }

    partner1Spent += p1Amount;
    partner2Spent += p2Amount;

    if (scope === 'couple') {
      spentSoFar += exp.amount;
    } else if (scope === 'partner1') {
      spentSoFar += p1Amount;
    } else if (scope === 'partner2') {
      spentSoFar += p2Amount;
    }
  });

  spentSoFar = roundMoney(spentSoFar);
  partner1Spent = roundMoney(partner1Spent);
  partner2Spent = roundMoney(partner2Spent);
  bothSpent = roundMoney(bothSpent);

  // 4. Canonical pending commitments (Fixed bills + Active installments not yet in expenses)
  const pendingCommitmentsList: { id: string; title: string; amount: number; type: 'bill' | 'installment' | 'pending_expense'; dueDate?: string }[] = [];

  // A) Fixed bills due in current month not yet paid (canonical matching via linkedBillId / lastPaidMonth)
  (state.coupleFixedBills || []).forEach(bill => {
    // Check canonical payment proof in expenses or bill metadata
    const alreadyPaidCanonical = currentMonthExpenses.some(
      exp =>
        (exp.linkedBillId === bill.id && (exp.billCompetenceMonth === currentMonthKey || exp.date.startsWith(currentMonthKey))) ||
        exp.id === `exp-fb-${bill.id}-${currentMonthKey}`
    );
    const isAlreadyPaid =
      bill.lastPaidMonth === currentMonthKey ||
      (bill.status === 'paid' && bill.lastPaidMonth === currentMonthKey) ||
      alreadyPaidCanonical;

    if (!isAlreadyPaid) {
      if (scope === 'partner1' && bill.assignedPayer === 'partner2') return;
      if (scope === 'partner2' && bill.assignedPayer === 'partner1') return;

      const dueDay = Math.min(daysInMonth, bill.dueDay || 10);
      const dueDate = `${currentMonthKey}-${String(dueDay).padStart(2, '0')}`;

      let billAmount = bill.amount;
      if (scope === 'partner1') {
        billAmount = bill.assignedPayer === 'both' || bill.assignedPayer === 'custom' ? roundMoney(bill.amount * 0.5) : bill.amount;
      } else if (scope === 'partner2') {
        billAmount = bill.assignedPayer === 'both' || bill.assignedPayer === 'custom' ? roundMoney(bill.amount * 0.5) : bill.amount;
      }

      pendingCommitmentsList.push({
        id: `bill-${bill.id}`,
        title: bill.title,
        amount: billAmount,
        type: 'bill',
        dueDate,
      });
    }
  });

  // B) Active installments due in current month not yet in expenses
  (state.installments || []).forEach(inst => {
    if (!inst.active) return;
    const activeMonthAmount = installmentInMonth(inst, currentMonthKey);
    if (activeMonthAmount <= 0) return; // Not active/due in current month (future or expired)

    if (scope === 'partner1' && inst.paidBy === 'partner2') return;
    if (scope === 'partner2' && inst.paidBy === 'partner1') return;

    const alreadyInExpenses = currentMonthExpenses.some(exp => exp.installmentId === inst.id);
    if (!alreadyInExpenses) {
      const instDueDay = Math.min(daysInMonth, inst.dueDay || 10);
      const dueDate = `${currentMonthKey}-${String(instDueDay).padStart(2, '0')}`;

      let instAmount = activeMonthAmount;
      if (scope === 'partner1') {
        if (inst.paidBy === 'both' || inst.paidBy === 'custom') {
          const p1Pct = typeof inst.splitPartner1Pct === 'number' ? inst.splitPartner1Pct : 50;
          instAmount = roundMoney(activeMonthAmount * (p1Pct / 100));
        }
      } else if (scope === 'partner2') {
        if (inst.paidBy === 'both' || inst.paidBy === 'custom') {
          const p2Pct = typeof inst.splitPartner2Pct === 'number' ? inst.splitPartner2Pct : (100 - (inst.splitPartner1Pct ?? 50));
          instAmount = roundMoney(activeMonthAmount * (p2Pct / 100));
        }
      }

      pendingCommitmentsList.push({
        id: `inst-${inst.id}`,
        title: `${inst.title} (${inst.paidInstallmentsCount + 1}/${inst.installmentsCount})`,
        amount: instAmount,
        type: 'installment',
        dueDate,
      });
    }
  });

  const pendingCommitmentsAmount = roundMoney(pendingCommitmentsList.reduce((sum, item) => sum + item.amount, 0));
  const totalConsumedAmount = roundMoney(spentSoFar + pendingCommitmentsAmount);

  // 5. Signed margin & Deficit
  const signedMargin = roundMoney(expenseBudget - totalConsumedAmount);
  const suggestedNewMargin = Math.max(0, signedMargin);
  const deficitAmount = Math.max(0, -signedMargin);
  const isOverBudget = signedMargin < 0;

  const budgetConsumedPercent =
    expenseBudget > 0 ? Math.round((totalConsumedAmount / expenseBudget) * 100) : null;

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

  if (expenseBudget <= 0 || declaredIncome <= 0) {
    statusState = 'dados_insuficientes';
    statusLabel = 'Dados Insuficientes';
    statusDescription = 'Cadastrem a renda de vocês nos ajustes para ativar o orçamento determinístico.';
  } else if (isOverBudget) {
    statusState = 'ajuste_necessario';
    statusLabel = 'Ajuste Necessário';
    statusDescription = `O consumo excedeu o orçamento em ${formatCurrency(deficitAmount)}. Recomendamos recalibrar compras do fim de semana.`;
  } else if (percentVal > 85 || (daysRemainingInMonth > 10 && percentVal > (currentDayOfMonth / daysInMonth) * 100 + 20)) {
    statusState = 'atencao';
    statusLabel = 'Atenção ao Ritmo';
    statusDescription = 'O orçamento está em ritmo acelerado. Vale conferir os próximos vencimentos.';
  }

  // 8. Reading B: Caixa Informado & Cobertura de Extrato
  let reconciledBankBalance = 0;
  let hasCashReconciliation = false;
  let protectedFunds = 0;
  let availableCash = 0;

  // Use only verified linked accounts with valid balances (no unverified duplicate open finance accounts)
  const validAccounts = (state.linkedAccounts || []).filter(acc => {
    if (acc.status === 'error') return false;
    if (typeof acc.balance !== 'number' || Number.isNaN(acc.balance)) return false;
    if (scope === 'partner1' && acc.holder === 'partner2') return false;
    if (scope === 'partner2' && acc.holder === 'partner1') return false;
    return true;
  });

  if (validAccounts.length > 0) {
    hasCashReconciliation = true;
    reconciledBankBalance = roundMoney(validAccounts.reduce((sum, acc) => sum + acc.balance, 0));

    // Protected Funds (Reserves + Piggy Banks) partitioned by scope
    if (scope === 'couple') {
      protectedFunds = (state.protectionCurrentAmount || 0) + (state.piggyBanks || []).reduce((sum, b) => sum + (b.currentAmount || 0), 0);
    } else if (scope === 'partner1') {
      const reserveShare = roundMoney((state.protectionCurrentAmount || 0) * 0.5);
      const piggyShare = (state.piggyBanks || []).reduce((sum, b) => {
        const sharePct = b.coupleAgreement?.type === 'proportional' ? (b.coupleAgreement.partner1SharePct / 100) : 0.5;
        return sum + roundMoney((b.currentAmount || 0) * sharePct);
      }, 0);
      protectedFunds = reserveShare + piggyShare;
    } else {
      const reserveShare = roundMoney((state.protectionCurrentAmount || 0) * 0.5);
      const piggyShare = (state.piggyBanks || []).reduce((sum, b) => {
        const sharePct = b.coupleAgreement?.type === 'proportional' ? (b.coupleAgreement.partner2SharePct / 100) : 0.5;
        return sum + roundMoney((b.currentAmount || 0) * sharePct);
      }, 0);
      protectedFunds = reserveShare + piggyShare;
    }
    protectedFunds = roundMoney(protectedFunds);
    availableCash = roundMoney(reconciledBankBalance - protectedFunds);
  }

  // Medical Receivables (Pending vs Confirmed)
  let pendingMedicalReceivables = 0;
  let confirmedMedicalReceivables = 0;

  (state.medicalShifts || []).forEach(shift => {
    // Exclude cancelled shifts
    if (shift.executionStatus === 'cancelled') return;
    if (scope === 'partner1' && shift.partner === 'partner2') return;
    if (scope === 'partner2' && shift.partner === 'partner1') return;

    const totalCents = Math.round((shift.netAmount ?? shift.grossAmount ?? 0) * 100);
    const allocatedCents = (state.shiftIncomeAllocations || []).reduce(
      (sum, ledger) => sum + (ledger.allocations[shift.id] || 0),
      0
    );
    const outstandingCents = Math.max(0, totalCents - allocatedCents);

    const payMonth = (shift.estimatedPayDate || shift.dateWorked).slice(0, 7);
    const actualPayMonth = shift.actualPayDate ? shift.actualPayDate.slice(0, 7) : undefined;

    if (shift.status === 'received') {
      if ((actualPayMonth && actualPayMonth === currentMonthKey) || (!actualPayMonth && payMonth === currentMonthKey)) {
        confirmedMedicalReceivables += totalCents / 100;
      }
    } else {
      // Pending or overdue
      const isDueOrOverdue =
        payMonth === currentMonthKey ||
        shift.status === 'overdue' ||
        (Boolean(shift.estimatedPayDate) && shift.estimatedPayDate < todayDateStr);

      if (isDueOrOverdue) {
        pendingMedicalReceivables += outstandingCents / 100;
      }

      if (allocatedCents > 0 && ((actualPayMonth && actualPayMonth === currentMonthKey) || payMonth === currentMonthKey)) {
        confirmedMedicalReceivables += allocatedCents / 100;
      }
    }
  });

  pendingMedicalReceivables = roundMoney(pendingMedicalReceivables);
  confirmedMedicalReceivables = roundMoney(confirmedMedicalReceivables);

  // 9. Moving 7-Day Window & Daily Limit
  const exceptionalReservations = options?.exceptionalReservations || [];
  const exceptionalReservationsAmount = exceptionalReservations
    .filter(r => r.confirmed)
    .reduce((sum, r) => sum + r.amount, 0);

  const netMarginForDailyLimit = Math.max(0, signedMargin - exceptionalReservationsAmount);
  const safeDailyLimit =
    daysRemainingInMonth > 0 && netMarginForDailyLimit > 0
      ? Math.round(netMarginForDailyLimit / daysRemainingInMonth)
      : 0;

  const effectiveDailyLimitAfterReservations = safeDailyLimit;

  // Next 7 days commitments (includes both bills and active installments)
  const next7DaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const moving7DayCommitments = pendingCommitmentsList
    .filter(c => c.dueDate && c.dueDate >= todayDateStr && c.dueDate <= next7DaysEnd)
    .map(c => ({
      id: c.id,
      title: c.title,
      amount: c.amount,
      date: c.dueDate || todayDateStr,
    }));

  const moving7DayCommitmentsAmount = roundMoney(moving7DayCommitments.reduce((sum, c) => sum + c.amount, 0));

  // 10. Closing Projections: separate historical run-rate from ceiling scenario
  const elapsedDays = Math.max(1, currentDayOfMonth);
  const dailyRunRate = spentSoFar / elapsedDays;
  const remainingDays = Math.max(0, daysInMonth - currentDayOfMonth);
  const projectedVariableRemaining = roundMoney(dailyRunRate * remainingDays);

  const baseProjectedClosingSpent = roundMoney(spentSoFar + pendingCommitmentsAmount + projectedVariableRemaining);
  const baseProjectedClosingMargin = roundMoney(expenseBudget - baseProjectedClosingSpent);

  const ceilingScenarioSpent = isOverBudget ? totalConsumedAmount : expenseBudget;
  const ceilingScenarioMargin = roundMoney(expenseBudget - ceilingScenarioSpent);

  // Tight scenario (e.g. delayed medical shift or +10% variable spend)
  const tightShiftDelay = options?.tightShiftDelayAmount || 0;
  const tightProjectedClosingSpent = roundMoney(baseProjectedClosingSpent + (isOverBudget ? 0 : expenseBudget * 0.1));
  const tightProjectedClosingMargin = roundMoney(expenseBudget - tightProjectedClosingSpent - tightShiftDelay);

  const projectionHypotheses = [
    `Compromissos fixos e parcelas de ${formatCurrency(pendingCommitmentsAmount)} contados exatamente 1x`,
    `Projeção histórica por ritmo realizado de ${formatCurrency(roundMoney(dailyRunRate))}/dia (${remainingDays} dias restantes)`,
    `Cenário teto limitando gastos a ${formatCurrency(safeDailyLimit)}/dia nos ${daysRemainingInMonth} dias`,
    `Aportes programados de ${formatCurrency(programmedSavings)} blindados no início do mês`,
  ];

  // 11. Coverage & Confidence Status (Explicit check-in)
  let lastImportDate: string | undefined;
  let lastEntryDate: string | undefined;

  if (state.expenses && state.expenses.length > 0) {
    const dates = state.expenses.map(e => e.date).sort();
    lastEntryDate = dates[dates.length - 1];
  }

  if (state.bankImportedTransactions && state.bankImportedTransactions.length > 0) {
    const dates = state.bankImportedTransactions.map(t => t.date).sort();
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
    coverageMessage = 'Lançamentos presentes, mas conferência semanal do casal ainda pendente.';
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
      description: 'Conectem ou informem o saldo para visualizar a leitura de caixa conjunto.',
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

  // What Changed Summary (Diff since last check-in)
  let newEntriesSinceConference = currentMonthExpenses;
  if (lastConferredDate) {
    newEntriesSinceConference = currentMonthExpenses.filter(e => e.date > lastConferredDate);
  }

  const whatChangedSummary = {
    newEntriesCount: newEntriesSinceConference.length,
    newEntriesTotal: roundMoney(newEntriesSinceConference.reduce((sum, e) => sum + e.amount, 0)),
    marginDelta: signedMargin,
    lastCheckedAt: lastConferredDate,
  };

  return {
    scope,
    monthKey: currentMonthKey,
    todayDateStr,
    declaredIncome,
    programmedSavings,
    expenseBudget,
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
