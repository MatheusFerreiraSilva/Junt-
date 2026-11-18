import {
  CategoryKey,
  ExpenseItem,
  IncomeItem,
  MedicalShift,
  PaidBy,
  AppState,
} from '../types/finance';
import { getShiftBalance } from './shiftsEngine';
import {
  apportionCentsByScope,
  clampDayToMonth,
  doesExpenseMatchBillCompetence,
  getApportionedAmount,
  getDaysInMonth,
  isFixedBillActiveInCompetence,
  mapToCanonicalCategoryKey,
  projectInstallmentOccurrencesForCompetence,
  roundMoney,
  selectCanonicalFixedBillsRegistry,
  toSafeCents,
} from './occurrenceProjection';

export { getDaysInMonth, clampDayToMonth, getApportionedAmount };

export type ObligationType = 'fixed_bill' | 'subscription' | 'installment' | 'medical_receivable';
export type ObligationStatus = 'previsto' | 'vencido' | 'parcial' | 'pago' | 'cancelado';

export interface CalendarObligation {
  id: string;
  sourceId: string;
  type: ObligationType;
  title: string;
  category: CategoryKey;
  amount: number;
  originalAmount: number;
  dueDate: string; // YYYY-MM-DD
  dueDay: number;
  competenceMonth?: string; // YYYY-MM
  status: ObligationStatus;
  payer: PaidBy;
  assignedToPartner?: 'partner1' | 'partner2' | 'couple';
  linkedExpenseId?: string;
  installmentInfo?: {
    currentNumber: number;
    totalNumber: number;
    bankName?: string;
  };
  notes?: string;
  isSimulatedPostponed?: boolean;
  originalDueDate?: string;
}

export interface DayConcentrationAlert {
  dateStr: string;
  dayNum: number;
  totalAmount: number;
  obligationsCount: number;
  severity: 'high' | 'medium';
  message: string;
}

export interface UpcomingAgendaSummary {
  periodDays: 7 | 30;
  totalCommitments: number;
  obligations: CalendarObligation[];
  availableCash: number;
  hasCashReconciliation: boolean;
  isCashSufficient: boolean;
  cashDeficit: number;
  concentrationAlerts: DayConcentrationAlert[];
}

export interface CalendarDayCalculatedData {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  expenses: { item: ExpenseItem; apportionedAmount: number }[];
  incomes: { item: IncomeItem; apportionedAmount: number }[];
  obligations: CalendarObligation[];
  medicalShiftsWorked: MedicalShift[];
  totalExpense: number;
  totalIncome: number;
  totalCommitments: number;
  net: number; // totalIncome - totalExpense
}

export interface CalendarMonthCalculatedResult {
  activeMonth: string; // YYYY-MM
  daysGrid: CalendarDayCalculatedData[];
  monthTotals: {
    income: number;
    expense: number;
    commitmentsTotal: number;
    commitmentsPending: number;
    commitmentsPaid: number;
    balance: number;
  };
  allMonthObligations: CalendarObligation[];
  concentrationAlerts: DayConcentrationAlert[];
  agenda7Days: UpcomingAgendaSummary;
  agenda30Days: UpcomingAgendaSummary;
}

/**
 * Pure deterministic calculation engine for the Financial Calendar Screen.
 * Reconciled in 29B with canonical fixed bills registry, explicit competence settlement,
 * vigência, unified installment projection, and exact integer-cent partner apportioning.
 */
export function calculateCalendarEngine(
  state: AppState,
  activeMonth: string,
  viewMode: 'couple' | 'partner1' | 'partner2' = 'couple',
  options?: {
    todayDateStr?: string;
    postponedObligations?: Record<string, string>; // obligationId -> newDueDate (YYYY-MM-DD)
  }
): CalendarMonthCalculatedResult {
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDays = getDaysInMonth(year, month);

  const now = options?.todayDateStr ? new Date(options.todayDateStr + 'T12:00:00Z') : new Date();
  const todayStr = options?.todayDateStr || now.toISOString().slice(0, 10);

  // 1. Calculate Available Cash from Valid Connected Accounts
  const validAccounts = (state.linkedAccounts || []).filter((acc) => {
    if (acc.status === 'error') return false;
    if (typeof acc.balance !== 'number' || Number.isNaN(acc.balance)) return false;
    if (viewMode === 'partner1' && acc.holder === 'partner2') return false;
    if (viewMode === 'partner2' && acc.holder === 'partner1') return false;
    return true;
  });

  const hasCashReconciliation = validAccounts.length > 0;
  const reconciledBankBalance = roundMoney(
    validAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  );

  let protectedFunds = 0;
  if (hasCashReconciliation) {
    if (viewMode === 'couple') {
      protectedFunds =
        (state.protectionCurrentAmount || 0) +
        (state.piggyBanks || []).reduce((sum, b) => sum + (b.currentAmount || 0), 0);
    } else if (viewMode === 'partner1') {
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
  }
  protectedFunds = roundMoney(protectedFunds);
  const availableCash = hasCashReconciliation
    ? roundMoney(reconciledBankBalance - protectedFunds)
    : 0;

  // 2. Generate Canonical Obligations for activeMonth
  const allObligations: CalendarObligation[] = [];
  const { bills: canonicalBills } = selectCanonicalFixedBillsRegistry(state);
  const normalizedBillTitles = new Set(
    canonicalBills.map((b) => (b.title || '').trim().toLowerCase()).filter(Boolean)
  );

  // A) Canonical Fixed Bills (coupleFixedBills + fixedBillAlerts reconciled, R29-10, R29-11, R29-16, R29-18)
  canonicalBills.forEach((bill) => {
    const hist = bill.history?.[activeMonth];
    const paidExpense = (state.expenses || []).find((e) =>
      doesExpenseMatchBillCompetence(e, bill.id, activeMonth)
    );
    const hasHistoryForMonth = Boolean(hist);
    const isLegacySinglePaid =
      !hasHistoryForMonth &&
      ((bill.lastPaidMonth === activeMonth &&
        bill.status !== 'pending' &&
        (bill.status as string) !== 'estornado') ||
        ((bill.status === 'paid' || (bill.status as string) === 'pago') &&
          !bill.lastPaidMonth &&
          bill.dueDate?.slice(0, 7) === activeMonth));

    const isPaid = hist?.status === 'paid' || Boolean(paidExpense) || isLegacySinglePaid;

    if (!isFixedBillActiveInCompetence(bill, activeMonth, isPaid)) {
      return;
    }

    const plannedCents = toSafeCents(bill.amount, bill.amountCents);
    const effectiveCents = isPaid
      ? paidExpense
        ? toSafeCents(paidExpense.amount, paidExpense.amountCents)
        : hist?.paidAmount !== undefined
        ? toSafeCents(hist.paidAmount)
        : plannedCents
      : plannedCents;

    const effectivePayer: PaidBy =
      (paidExpense?.paidBy || hist?.paidBy || bill.assignedPayer || bill.assignedTo || 'both') as PaidBy;
    const splitP1 = paidExpense?.splitPartner1Pct ?? bill.splitPartner1Pct;
    const splitP2 = paidExpense?.splitPartner2Pct ?? bill.splitPartner2Pct;
    const split = apportionCentsByScope(effectiveCents, viewMode, effectivePayer, splitP1, splitP2);
    if (!split.isInScope) return;

    const originalDueDay = clampDayToMonth(year, month, bill.dueDay || 10);
    const standardDueDate = `${activeMonth}-${String(originalDueDay).padStart(2, '0')}`;
    const effectiveDueDate = options?.postponedObligations?.[`bill-${bill.id}`] || standardDueDate;
    const isPostponed = Boolean(options?.postponedObligations?.[`bill-${bill.id}`]);

    let status: ObligationStatus = 'previsto';
    if (isPaid) {
      status = 'pago';
    } else if (hist?.status === 'overdue' || effectiveDueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: `bill-${bill.id}`,
      sourceId: bill.id,
      type: 'fixed_bill',
      title: bill.title,
      category: mapToCanonicalCategoryKey(bill.category),
      amount: roundMoney(split.scopedCents / 100),
      originalAmount: roundMoney(plannedCents / 100),
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      competenceMonth: activeMonth,
      status,
      payer: effectivePayer,
      assignedToPartner:
        effectivePayer === 'both' ||
        effectivePayer === 'custom' ||
        effectivePayer === 'casal' ||
        effectivePayer === 'couple'
          ? 'couple'
          : effectivePayer,
      linkedExpenseId: paidExpense?.id ?? hist?.linkedExpenseId,
      notes: bill.autoPay ? 'Débito automático' : undefined,
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // B) Detected Subscriptions (advisory agenda items; never duplicated when already promoted to fixed bills)
  (state.detectedSubscriptions || []).forEach((sub) => {
    if (sub.status === 'dismissed') return;
    if (normalizedBillTitles.has((sub.merchant || '').trim().toLowerCase())) return;

    const subCents = toSafeCents(sub.amount);
    const split = apportionCentsByScope(subCents, viewMode, sub.payer || 'both');
    if (!split.isInScope) return;

    const originalDueDay = clampDayToMonth(year, month, sub.dueDay || 15);
    const standardDueDate = `${activeMonth}-${String(originalDueDay).padStart(2, '0')}`;
    const effectiveDueDate = options?.postponedObligations?.[`sub-${sub.id}`] || standardDueDate;
    const isPostponed = Boolean(options?.postponedObligations?.[`sub-${sub.id}`]);

    const paidExpense = (state.expenses || []).find(
      (e) =>
        (e.notes?.includes(sub.id) ||
          e.description.toLowerCase().includes(sub.merchant.toLowerCase())) &&
        (e.billCompetenceMonth ? e.billCompetenceMonth === activeMonth : e.date.startsWith(activeMonth))
    );

    const isPaid = Boolean(paidExpense);

    let status: ObligationStatus = 'previsto';
    if (isPaid) {
      status = 'pago';
    } else if (effectiveDueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: `sub-${sub.id}`,
      sourceId: sub.id,
      type: 'subscription',
      title: sub.merchant,
      category: mapToCanonicalCategoryKey(sub.category),
      amount: roundMoney(split.scopedCents / 100),
      originalAmount: roundMoney(subCents / 100),
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      competenceMonth: activeMonth,
      status,
      payer: sub.payer || 'both',
      linkedExpenseId: paidExpense?.id,
      notes: sub.frequency === 'mensal' ? 'Assinatura Mensal' : undefined,
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // C) Active & Historical Installments in activeMonth (unified 08/17 + 28C projection)
  const instOccurrences = projectInstallmentOccurrencesForCompetence(
    state,
    activeMonth,
    viewMode,
    todayStr
  );
  const instCountBySource = new Map<string, number>();
  instOccurrences.forEach((o) => {
    instCountBySource.set(o.installmentId, (instCountBySource.get(o.installmentId) || 0) + 1);
  });

  instOccurrences.forEach((instOcc) => {
    const baseKey = `inst-${instOcc.installmentId}`;
    const oblId =
      (instCountBySource.get(instOcc.installmentId) || 0) > 1
        ? `${baseKey}-${instOcc.installmentNumber}`
        : baseKey;
    const standardDueDate = instOcc.dueDate;
    const effectiveDueDate =
      options?.postponedObligations?.[oblId] ||
      options?.postponedObligations?.[baseKey] ||
      standardDueDate;
    const isPostponed = Boolean(
      options?.postponedObligations?.[oblId] || options?.postponedObligations?.[baseKey]
    );

    const isPaid = instOcc.status === 'paid' || instOcc.status === 'advanced';
    let status: ObligationStatus = 'previsto';
    if (isPaid) {
      status = 'pago';
    } else if (effectiveDueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: oblId,
      sourceId: instOcc.installmentId,
      type: 'installment',
      title: `${instOcc.title} (${instOcc.installmentNumber}/${instOcc.totalInstallments})`,
      category: mapToCanonicalCategoryKey(instOcc.category),
      amount: roundMoney(instOcc.scopedCents / 100),
      originalAmount: roundMoney(instOcc.plannedCents / 100),
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      competenceMonth: activeMonth,
      status,
      payer: instOcc.paidBy,
      linkedExpenseId: instOcc.linkedExpenseId,
      installmentInfo: {
        currentNumber: instOcc.installmentNumber,
        totalNumber: instOcc.totalInstallments,
        bankName: instOcc.bankName,
      },
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // D) Medical Shift Receivables for activeMonth
  (state.medicalShifts || []).forEach((shift) => {
    if (shift.executionStatus === 'cancelled' || shift.executionStatus === 'replaced') return;
    if (viewMode === 'partner1' && shift.partner === 'partner2') return;
    if (viewMode === 'partner2' && shift.partner === 'partner1') return;

    const payDate = shift.actualPayDate || shift.estimatedPayDate || shift.dateWorked;
    if (!payDate.startsWith(activeMonth)) return;

    const balance = getShiftBalance(shift, state.shiftIncomeAllocations || []);
    const dueDay = clampDayToMonth(year, month, parseInt(payDate.slice(8, 10), 10) || 15);
    const dueDate = `${activeMonth}-${String(dueDay).padStart(2, '0')}`;

    let status: ObligationStatus = 'previsto';
    if (balance.isFullyPaid) {
      status = 'pago';
    } else if (balance.isPartiallyPaid) {
      status = 'parcial';
    } else if (shift.status === 'overdue' || dueDate < todayStr) {
      status = 'vencido';
    }

    const displayAmount =
      balance.pendingAmount > 0 ? balance.pendingAmount : balance.expectedAmount;

    allObligations.push({
      id: `shift-rec-${shift.id}`,
      sourceId: shift.id,
      type: 'medical_receivable',
      title: `Recebível: ${shift.title}`,
      category: 'profissional',
      amount: roundMoney(displayAmount),
      originalAmount: roundMoney(balance.expectedAmount),
      dueDate,
      dueDay,
      competenceMonth: activeMonth,
      status,
      payer: shift.partner,
      notes: `${shift.hospitalName} (${shift.durationHours}h)`,
    });
  });

  // 3. Concentration of Commitments Analysis
  const concentrationAlerts: DayConcentrationAlert[] = [];
  const dayCommitmentBuckets: Record<number, { amountCents: number; count: number; dateStr: string }> = {};

  allObligations
    .filter((o) => o.type !== 'medical_receivable')
    .forEach((o) => {
      if (!dayCommitmentBuckets[o.dueDay]) {
        dayCommitmentBuckets[o.dueDay] = { amountCents: 0, count: 0, dateStr: o.dueDate };
      }
      dayCommitmentBuckets[o.dueDay].amountCents += toSafeCents(o.amount);
      dayCommitmentBuckets[o.dueDay].count += 1;
    });

  const totalMonthCommitmentsCents = allObligations
    .filter((o) => o.type !== 'medical_receivable')
    .reduce((sum, o) => sum + toSafeCents(o.amount), 0);
  const totalMonthCommitments = roundMoney(totalMonthCommitmentsCents / 100);

  Object.entries(dayCommitmentBuckets).forEach(([dayKey, bucket]) => {
    const dayNum = parseInt(dayKey, 10);
    const bucketAmount = roundMoney(bucket.amountCents / 100);
    const isHeavyAmount =
      bucketAmount >= 1000 ||
      (totalMonthCommitments > 0 && bucketAmount / totalMonthCommitments >= 0.35);
    const isMultipleBills = bucket.count >= 3 && bucketAmount >= 400;

    if (isHeavyAmount || isMultipleBills) {
      const severity: 'high' | 'medium' = bucketAmount >= 1500 ? 'high' : 'medium';
      concentrationAlerts.push({
        dateStr: bucket.dateStr,
        dayNum,
        totalAmount: bucketAmount,
        obligationsCount: bucket.count,
        severity,
        message: `Concentração no dia ${dayNum}: ${bucket.count} pagamentos totalizando R$ ${bucketAmount.toLocaleString('pt-BR')}`,
      });
    }
  });

  concentrationAlerts.sort((a, b) => b.totalAmount - a.totalAmount);

  // 4. Build Days Grid (with padding before and after)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  const days: CalendarDayCalculatedData[] = [];

  let totalMonthIncomeCents = 0;
  let totalMonthExpenseCents = 0;

  // Pad beginning with previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const dStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    days.push({
      dateStr: dStr,
      dayNum,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      expenses: [],
      incomes: [],
      obligations: [],
      medicalShiftsWorked: [],
      totalExpense: 0,
      totalIncome: 0,
      totalCommitments: 0,
      net: 0,
    });
  }

  const parentIdsWithSplits = new Set(
    (state.expenses || [])
      .filter((e) => e.splits && e.splits.length > 0)
      .map((e) => e.id)
  );

  // Current month days (cash/execution date view for transactions + competence obligations on due date)
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const dateStr = `${activeMonth}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;

    // Real Expenses on civil date (avoiding splitParentId duplicate rows)
    const dayExpenses = (state.expenses || []).filter(
      (e) => e.date === dateStr && !(e.splitParentId && parentIdsWithSplits.has(e.splitParentId))
    );
    const calculatedDayExpenses: { item: ExpenseItem; apportionedAmount: number; cents: number }[] = [];
    for (const e of dayExpenses) {
      const expCents = toSafeCents(e.amount, e.amountCents);
      const split = apportionCentsByScope(
        expCents,
        viewMode,
        e.paidBy,
        e.splitPartner1Pct,
        e.splitPartner2Pct,
        e.assignedTo
      );
      if (!split.isInScope) continue;
      calculatedDayExpenses.push({
        item: e,
        apportionedAmount: roundMoney(split.scopedCents / 100),
        cents: split.scopedCents,
      });
    }

    const dayExpCents = calculatedDayExpenses.reduce((sum, e) => sum + e.cents, 0);
    const dayExpSum = roundMoney(dayExpCents / 100);

    // Real Incomes on civil date
    const dayIncomes = (state.incomes || []).filter((i) => i.date === dateStr);
    const calculatedDayIncomes: { item: IncomeItem; apportionedAmount: number; cents: number }[] = [];
    for (const inc of dayIncomes) {
      const incCents = toSafeCents(inc.amount);
      const split = apportionCentsByScope(incCents, viewMode, inc.recipient);
      if (!split.isInScope) continue;
      calculatedDayIncomes.push({
        item: inc,
        apportionedAmount: roundMoney(split.scopedCents / 100),
        cents: split.scopedCents,
      });
    }

    const dayIncCents = calculatedDayIncomes.reduce((sum, i) => sum + i.cents, 0);
    const dayIncSum = roundMoney(dayIncCents / 100);

    // Obligations on this date
    const dayObligations = allObligations.filter((o) => o.dueDate === dateStr);
    const dayCommitmentsCents = dayObligations
      .filter((o) => o.type !== 'medical_receivable')
      .reduce((sum, o) => sum + toSafeCents(o.amount), 0);
    const dayCommitmentsSum = roundMoney(dayCommitmentsCents / 100);

    // Shifts worked on this day
    const dayShiftsWorked = (state.medicalShifts || []).filter((s) => {
      if (s.dateWorked !== dateStr) return false;
      if (s.executionStatus === 'cancelled') return false;
      if (viewMode === 'partner1' && s.partner === 'partner2') return false;
      if (viewMode === 'partner2' && s.partner === 'partner1') return false;
      return true;
    });

    totalMonthIncomeCents += dayIncCents;
    totalMonthExpenseCents += dayExpCents;

    days.push({
      dateStr,
      dayNum,
      isCurrentMonth: true,
      isToday,
      expenses: calculatedDayExpenses.map(({ item, apportionedAmount }) => ({
        item,
        apportionedAmount,
      })),
      incomes: calculatedDayIncomes.map(({ item, apportionedAmount }) => ({
        item,
        apportionedAmount,
      })),
      obligations: dayObligations,
      medicalShiftsWorked: dayShiftsWorked,
      totalExpense: dayExpSum,
      totalIncome: dayIncSum,
      totalCommitments: dayCommitmentsSum,
      net: roundMoney((dayIncCents - dayExpCents) / 100),
    });
  }

  // Pad end to complete 7-day grid rows (35 or 42 cells)
  const remainingDays = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingDays; i++) {
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const dStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({
      dateStr: dStr,
      dayNum: i,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      expenses: [],
      incomes: [],
      obligations: [],
      medicalShiftsWorked: [],
      totalExpense: 0,
      totalIncome: 0,
      totalCommitments: 0,
      net: 0,
    });
  }

  // 5. Agendas for Next 7 Days and Next 30 Days with Cash Reconciliation
  const todayDateObj = new Date(todayStr + 'T12:00:00Z');
  const next7DaysEnd = new Date(todayDateObj.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const next30DaysEnd = new Date(todayDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const filterAgendaObligations = (endDate: string) => {
    return allObligations
      .filter((o) => o.dueDate >= todayStr && o.dueDate <= endDate && o.type !== 'medical_receivable')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  };

  const obligations7Days = filterAgendaObligations(next7DaysEnd);
  const totalCommitments7Days = roundMoney(
    obligations7Days.reduce((sum, o) => sum + toSafeCents(o.amount), 0) / 100
  );

  const obligations30Days = filterAgendaObligations(next30DaysEnd);
  const totalCommitments30Days = roundMoney(
    obligations30Days.reduce((sum, o) => sum + toSafeCents(o.amount), 0) / 100
  );

  const agenda7Days: UpcomingAgendaSummary = {
    periodDays: 7,
    totalCommitments: totalCommitments7Days,
    obligations: obligations7Days,
    availableCash,
    hasCashReconciliation,
    isCashSufficient: !hasCashReconciliation || availableCash >= totalCommitments7Days,
    cashDeficit: hasCashReconciliation
      ? Math.max(0, roundMoney(totalCommitments7Days - availableCash))
      : 0,
    concentrationAlerts: concentrationAlerts.filter(
      (a) => a.dateStr >= todayStr && a.dateStr <= next7DaysEnd
    ),
  };

  const agenda30Days: UpcomingAgendaSummary = {
    periodDays: 30,
    totalCommitments: totalCommitments30Days,
    obligations: obligations30Days,
    availableCash,
    hasCashReconciliation,
    isCashSufficient: !hasCashReconciliation || availableCash >= totalCommitments30Days,
    cashDeficit: hasCashReconciliation
      ? Math.max(0, roundMoney(totalCommitments30Days - availableCash))
      : 0,
    concentrationAlerts: concentrationAlerts.filter(
      (a) => a.dateStr >= todayStr && a.dateStr <= next30DaysEnd
    ),
  };

  const commitmentsPaid = roundMoney(
    allObligations
      .filter((o) => o.status === 'pago' && o.type !== 'medical_receivable')
      .reduce((sum, o) => sum + toSafeCents(o.amount), 0) / 100
  );

  const commitmentsPending = roundMoney(
    allObligations
      .filter((o) => o.status !== 'pago' && o.type !== 'medical_receivable')
      .reduce((sum, o) => sum + toSafeCents(o.amount), 0) / 100
  );

  const totalMonthIncome = roundMoney(totalMonthIncomeCents / 100);
  const totalMonthExpense = roundMoney(totalMonthExpenseCents / 100);

  return {
    activeMonth,
    daysGrid: days,
    monthTotals: {
      income: totalMonthIncome,
      expense: totalMonthExpense,
      commitmentsTotal: totalMonthCommitments,
      commitmentsPending,
      commitmentsPaid,
      balance: roundMoney((totalMonthIncomeCents - totalMonthExpenseCents) / 100),
    },
    allMonthObligations: allObligations,
    concentrationAlerts,
    agenda7Days,
    agenda30Days,
  };
}
