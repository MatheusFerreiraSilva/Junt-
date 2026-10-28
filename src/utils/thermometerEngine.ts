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

  // Programmed savings / investments (default 10% or profile setting)
  const investmentsPct = state.profile.investmentsPercentage ?? 10;
  const programmedSavings = Math.round(declaredIncome * (investmentsPct / 100));

  // Expense budget (excluding savings)
  const expenseBudget = Math.max(0, declaredIncome - programmedSavings);

  // 3. Filter current month expenses matching scope and EXCLUDING non-economic expenses
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

  // Calculate spent so far
  let partner1Spent = 0;
  let partner2Spent = 0;
  let bothSpent = 0;
  let spentSoFar = 0;

  currentMonthExpenses.forEach(exp => {
    spentSoFar += exp.amount;
    if (exp.paidBy === 'partner1') partner1Spent += exp.amount;
    else if (exp.paidBy === 'partner2') partner2Spent += exp.amount;
    else bothSpent += exp.amount;
  });

  // 4. Canonical pending commitments (Fixed bills + Active installments not yet in expenses)
  const pendingCommitmentsList: { id: string; title: string; amount: number; type: 'bill' | 'installment' | 'pending_expense'; dueDate?: string }[] = [];

  // A) Fixed bills due in current month not yet paid
  (state.coupleFixedBills || []).forEach(bill => {
    if (bill.status === 'pending' || (bill.status !== 'paid' && bill.lastPaidMonth !== currentMonthKey)) {
      if (scope === 'partner1' && bill.assignedPayer === 'partner2') return;
      if (scope === 'partner2' && bill.assignedPayer === 'partner1') return;

      const dueDay = Math.min(daysInMonth, bill.dueDay || 10);
      const dueDate = `${currentMonthKey}-${String(dueDay).padStart(2, '0')}`;

      // Check if bill is already represented in currentMonthExpenses
      const alreadyInExpenses = currentMonthExpenses.some(
        exp => exp.description.toLowerCase().includes(bill.title.toLowerCase())
      );

      if (!alreadyInExpenses) {
        pendingCommitmentsList.push({
          id: `bill-${bill.id}`,
          title: bill.title,
          amount: bill.amount,
          type: 'bill',
          dueDate,
        });
      }
    }
  });

  // B) Active installments due in current month not yet in expenses
  (state.installments || []).forEach(inst => {
    if (!inst.active) return;
    if (scope === 'partner1' && inst.paidBy === 'partner2') return;
    if (scope === 'partner2' && inst.paidBy === 'partner1') return;

    const alreadyInExpenses = currentMonthExpenses.some(exp => exp.installmentId === inst.id);
    if (!alreadyInExpenses) {
      pendingCommitmentsList.push({
        id: `inst-${inst.id}`,
        title: `${inst.title} (${inst.paidInstallmentsCount + 1}/${inst.installmentsCount})`,
        amount: inst.monthlyAmount,
        type: 'installment',
      });
    }
  });

  const pendingCommitmentsAmount = pendingCommitmentsList.reduce((sum, item) => sum + item.amount, 0);
  const totalConsumedAmount = spentSoFar + pendingCommitmentsAmount;

  // 5. Signed margin & Deficit
  const signedMargin = expenseBudget - totalConsumedAmount;
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

  const userAccounts = (state.pluggyAccounts || []).concat(
    (state.linkedAccounts || []).map(a => ({
      id: a.id,
      name: a.bankName,
      balance: a.balance,
      lastSynced: a.lastSynced,
      owner: a.holder,
    } as any))
  );

  userAccounts.forEach(acc => {
    if (scope === 'partner1' && acc.owner === 'partner2') return;
    if (scope === 'partner2' && acc.owner === 'partner1') return;
    if (typeof acc.balance === 'number') {
      reconciledBankBalance += acc.balance;
      hasCashReconciliation = true;
    }
  });

  // Protected Funds (Reserves + Piggy Banks)
  let protectedFunds = state.protectionCurrentAmount || 0;
  (state.piggyBanks || []).forEach(b => {
    protectedFunds += b.currentAmount || 0;
  });

  const availableCash = reconciledBankBalance - protectedFunds;

  // Medical Receivables (Pending vs Confirmed)
  let pendingMedicalReceivables = 0;
  let confirmedMedicalReceivables = 0;

  (state.medicalShifts || []).forEach(shift => {
    if (!shift.dateWorked.startsWith(currentMonthKey)) return;
    if (scope === 'partner1' && shift.partner === 'partner2') return;
    if (scope === 'partner2' && shift.partner === 'partner1') return;

    const amt = shift.netAmount || shift.grossAmount || 0;
    if (shift.status === 'received') {
      confirmedMedicalReceivables += amt;
    } else if (shift.status === 'pending') {
      pendingMedicalReceivables += amt;
    }
  });

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

  // Next 7 days commitments
  const next7DaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const moving7DayCommitments = pendingCommitmentsList
    .filter(c => c.dueDate && c.dueDate >= todayDateStr && c.dueDate <= next7DaysEnd)
    .map(c => ({
      id: c.id,
      title: c.title,
      amount: c.amount,
      date: c.dueDate || todayDateStr,
    }));

  const moving7DayCommitmentsAmount = moving7DayCommitments.reduce((sum, c) => sum + c.amount, 0);

  // 10. Closing Projections
  const estimatedRemainingVariable = safeDailyLimit * daysRemainingInMonth;
  const baseProjectedClosingSpent = totalConsumedAmount + estimatedRemainingVariable;
  const baseProjectedClosingMargin = expenseBudget - baseProjectedClosingSpent;

  // Tight scenario (e.g. delayed medical shift or +15% variable spend)
  const tightShiftDelay = options?.tightShiftDelayAmount || 0;
  const tightProjectedClosingSpent = baseProjectedClosingSpent + (isOverBudget ? 0 : Math.round(expenseBudget * 0.1));
  const tightProjectedClosingMargin = baseProjectedClosingMargin - tightShiftDelay - (isOverBudget ? 0 : Math.round(expenseBudget * 0.1));

  const projectionHypotheses = [
    `Compromissos fixos e parcelas de ${formatCurrency(pendingCommitmentsAmount)} contados exatamente 1x`,
    `Ritmo diário variável de ${formatCurrency(safeDailyLimit)} nos ${daysRemainingInMonth} dias restantes`,
    `Aportes programados de ${formatCurrency(programmedSavings)} já blindados no início do mês`,
  ];

  // 11. Coverage & Confidence Status
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

  const lastConferredDate = options?.lastWeeklyCheckInAt || state.lastAcknowledgedTierKey || todayDateStr;

  let coverageStatus: 'conferido' | 'parcial' | 'pendente_conferencia' = 'conferido';
  let coverageMessage = 'Registros do casal revisados e alinhados com o plano.';

  if (!lastImportDate && !lastEntryDate) {
    coverageStatus = 'pendente_conferencia';
    coverageMessage = 'Nenhum lançamento registrado neste mês ainda.';
  } else if (lastImportDate && lastImportDate < `${currentMonthKey}-10`) {
    coverageStatus = 'parcial';
    coverageMessage = 'Extrato bancário precisa de atualização para a segunda metade do mês.';
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

  // What Changed Summary
  const whatChangedSummary = {
    newEntriesCount: currentMonthExpenses.length,
    newEntriesTotal: spentSoFar,
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
