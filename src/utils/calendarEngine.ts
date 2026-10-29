import {
  CategoryKey,
  ExpenseItem,
  IncomeItem,
  InstallmentPurchase,
  MedicalShift,
  PaidBy,
  AppState,
} from '../types/finance';
import { installmentInMonth } from './installmentMoney';
import { roundMoney } from './thermometerEngine';

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
 * Total days in given month with leap year safety (Date.UTC).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Clamps any due day (e.g. 31) to the actual maximum days of that month (28, 29, 30, or 31).
 */
export function clampDayToMonth(year: number, month: number, day: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(maxDays, Math.max(1, day));
}

/**
 * Calculates apportioned value based on view scope and custom/50-50 splits.
 */
export function getApportionedAmount(
  amount: number,
  scope: 'couple' | 'partner1' | 'partner2',
  payer: PaidBy | undefined,
  splitPartner1Pct: number = 50,
  splitPartner2Pct: number = 50
): number {
  if (scope === 'couple') return roundMoney(amount);
  if (payer === 'partner1') return scope === 'partner1' ? roundMoney(amount) : 0;
  if (payer === 'partner2') return scope === 'partner2' ? roundMoney(amount) : 0;

  // both or custom
  if (scope === 'partner1') {
    const p1 = typeof splitPartner1Pct === 'number' ? splitPartner1Pct : 50;
    return roundMoney(amount * (p1 / 100));
  }
  const p2 = typeof splitPartner2Pct === 'number' ? splitPartner2Pct : (100 - (splitPartner1Pct ?? 50));
  return roundMoney(amount * (p2 / 100));
}

/**
 * Pure deterministic calculation engine for the Financial Calendar Screen.
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
  const validAccounts = (state.linkedAccounts || []).filter(acc => {
    if (acc.status === 'error') return false;
    if (typeof acc.balance !== 'number' || Number.isNaN(acc.balance)) return false;
    if (viewMode === 'partner1' && acc.holder === 'partner2') return false;
    if (viewMode === 'partner2' && acc.holder === 'partner1') return false;
    return true;
  });

  const hasCashReconciliation = validAccounts.length > 0;
  const reconciledBankBalance = roundMoney(validAccounts.reduce((sum, acc) => sum + acc.balance, 0));

  let protectedFunds = 0;
  if (hasCashReconciliation) {
    if (viewMode === 'couple') {
      protectedFunds = (state.protectionCurrentAmount || 0) + (state.piggyBanks || []).reduce((sum, b) => sum + (b.currentAmount || 0), 0);
    } else if (viewMode === 'partner1') {
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
  }
  protectedFunds = roundMoney(protectedFunds);
  const availableCash = hasCashReconciliation ? roundMoney(reconciledBankBalance - protectedFunds) : 0;

  // 2. Generate Canonical Obligations for activeMonth
  const allObligations: CalendarObligation[] = [];

  // A) Fixed Bills
  (state.coupleFixedBills || []).forEach(bill => {
    if (viewMode === 'partner1' && bill.assignedPayer === 'partner2') return;
    if (viewMode === 'partner2' && bill.assignedPayer === 'partner1') return;

    const originalDueDay = clampDayToMonth(year, month, bill.dueDay || 10);
    const standardDueDate = `${activeMonth}-${String(originalDueDay).padStart(2, '0')}`;
    const effectiveDueDate = options?.postponedObligations?.[`bill-${bill.id}`] || standardDueDate;
    const isPostponed = Boolean(options?.postponedObligations?.[`bill-${bill.id}`]);

    const apportionedAmt = getApportionedAmount(bill.amount, viewMode, bill.assignedPayer, 50, 50);

    // Canonical matching of paid bill in expenses
    const paidExpense = (state.expenses || []).find(e =>
      (e.linkedBillId === bill.id && (e.billCompetenceMonth === activeMonth || e.date.startsWith(activeMonth))) ||
      e.id === `exp-fb-${bill.id}-${activeMonth}`
    );

    const isPaid =
      Boolean(paidExpense) ||
      bill.lastPaidMonth === activeMonth ||
      (bill.status === 'paid' && bill.lastPaidMonth === activeMonth);

    let status: ObligationStatus = 'previsto';
    if (isPaid) {
      status = 'pago';
    } else if (effectiveDueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: `bill-${bill.id}`,
      sourceId: bill.id,
      type: 'fixed_bill',
      title: bill.title,
      category: bill.category,
      amount: apportionedAmt,
      originalAmount: bill.amount,
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      status,
      payer: bill.assignedPayer,
      assignedToPartner: bill.assignedPayer === 'both' ? 'couple' : bill.assignedPayer,
      linkedExpenseId: paidExpense?.id,
      notes: bill.autoPay ? 'Débito automático' : undefined,
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // B) Subscriptions
  (state.detectedSubscriptions || []).forEach(sub => {
    if (sub.status === 'dismissed') return;
    if (viewMode === 'partner1' && sub.payer === 'partner2') return;
    if (viewMode === 'partner2' && sub.payer === 'partner1') return;

    const originalDueDay = clampDayToMonth(year, month, sub.dueDay || 15);
    const standardDueDate = `${activeMonth}-${String(originalDueDay).padStart(2, '0')}`;
    const effectiveDueDate = options?.postponedObligations?.[`sub-${sub.id}`] || standardDueDate;
    const isPostponed = Boolean(options?.postponedObligations?.[`sub-${sub.id}`]);

    const apportionedAmt = getApportionedAmount(sub.amount, viewMode, sub.payer || 'both', 50, 50);

    // Check if paid in expenses
    const paidExpense = (state.expenses || []).find(e =>
      (e.notes?.includes(sub.id) || e.description.toLowerCase().includes(sub.merchant.toLowerCase())) &&
      e.date.startsWith(activeMonth)
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
      category: sub.category,
      amount: apportionedAmt,
      originalAmount: sub.amount,
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      status,
      payer: sub.payer || 'both',
      linkedExpenseId: paidExpense?.id,
      notes: sub.frequency === 'mensal' ? 'Assinatura Mensal' : undefined,
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // C) Active & Historical Installments in activeMonth
  (state.installments || []).forEach(inst => {
    // Check if installment is due in activeMonth using canonical engine
    const activeMonthAmount = installmentInMonth(inst, activeMonth);
    if (activeMonthAmount <= 0) return; // Not active in this competence month

    if (viewMode === 'partner1' && inst.paidBy === 'partner2') return;
    if (viewMode === 'partner2' && inst.paidBy === 'partner1') return;

    const [instY, instM] = inst.startMonth.split('-').map(Number);
    const currentNumber = (year - instY) * 12 + (month - instM) + 1;

    const originalDueDay = clampDayToMonth(year, month, inst.dueDay || 10);
    const standardDueDate = `${activeMonth}-${String(originalDueDay).padStart(2, '0')}`;
    const effectiveDueDate = options?.postponedObligations?.[`inst-${inst.id}`] || standardDueDate;
    const isPostponed = Boolean(options?.postponedObligations?.[`inst-${inst.id}`]);

    const apportionedAmt = getApportionedAmount(
      activeMonthAmount,
      viewMode,
      inst.paidBy,
      inst.splitPartner1Pct ?? 50,
      inst.splitPartner2Pct ?? 50
    );

    // Check if already in expenses
    const paidExpense = (state.expenses || []).find(e =>
      e.installmentId === inst.id &&
      (e.date.startsWith(activeMonth) || e.installmentIndex === currentNumber)
    );

    const isPaid = Boolean(paidExpense);

    let status: ObligationStatus = 'previsto';
    if (isPaid) {
      status = 'pago';
    } else if (effectiveDueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: `inst-${inst.id}`,
      sourceId: inst.id,
      type: 'installment',
      title: `${inst.title} (${currentNumber}/${inst.installmentsCount})`,
      category: inst.category,
      amount: apportionedAmt,
      originalAmount: activeMonthAmount,
      dueDate: effectiveDueDate,
      dueDay: parseInt(effectiveDueDate.slice(8, 10), 10),
      status,
      payer: inst.paidBy,
      linkedExpenseId: paidExpense?.id,
      installmentInfo: {
        currentNumber,
        totalNumber: inst.installmentsCount,
        bankName: inst.bankName,
      },
      isSimulatedPostponed: isPostponed,
      originalDueDate: isPostponed ? standardDueDate : undefined,
    });
  });

  // D) Medical Shift Receivables for activeMonth
  (state.medicalShifts || []).forEach(shift => {
    if (shift.executionStatus === 'cancelled') return;
    if (viewMode === 'partner1' && shift.partner === 'partner2') return;
    if (viewMode === 'partner2' && shift.partner === 'partner1') return;

    const payDate = shift.actualPayDate || shift.estimatedPayDate || shift.dateWorked;
    if (!payDate.startsWith(activeMonth)) return;

    const totalVal = shift.netAmount ?? shift.grossAmount ?? 0;
    const dueDay = clampDayToMonth(year, month, parseInt(payDate.slice(8, 10), 10) || 15);
    const dueDate = `${activeMonth}-${String(dueDay).padStart(2, '0')}`;

    let status: ObligationStatus = 'previsto';
    if (shift.status === 'received') {
      status = 'pago';
    } else if (shift.status === 'overdue' || dueDate < todayStr) {
      status = 'vencido';
    }

    allObligations.push({
      id: `shift-rec-${shift.id}`,
      sourceId: shift.id,
      type: 'medical_receivable',
      title: `Recebível: ${shift.title}`,
      category: 'profissional',
      amount: roundMoney(totalVal),
      originalAmount: roundMoney(totalVal),
      dueDate,
      dueDay,
      status,
      payer: shift.partner,
      notes: `${shift.hospitalName} (${shift.durationHours}h)`,
    });
  });

  // 3. Concentration of Commitments Analysis
  const concentrationAlerts: DayConcentrationAlert[] = [];
  const dayCommitmentBuckets: Record<number, { amount: number; count: number; dateStr: string }> = {};

  allObligations
    .filter(o => o.type !== 'medical_receivable')
    .forEach(o => {
      if (!dayCommitmentBuckets[o.dueDay]) {
        dayCommitmentBuckets[o.dueDay] = { amount: 0, count: 0, dateStr: o.dueDate };
      }
      dayCommitmentBuckets[o.dueDay].amount = roundMoney(dayCommitmentBuckets[o.dueDay].amount + o.amount);
      dayCommitmentBuckets[o.dueDay].count += 1;
    });

  const totalMonthCommitments = roundMoney(
    allObligations.filter(o => o.type !== 'medical_receivable').reduce((sum, o) => sum + o.amount, 0)
  );

  Object.entries(dayCommitmentBuckets).forEach(([dayKey, bucket]) => {
    const dayNum = parseInt(dayKey, 10);
    const isHeavyAmount = bucket.amount >= 1000 || (totalMonthCommitments > 0 && bucket.amount / totalMonthCommitments >= 0.35);
    const isMultipleBills = bucket.count >= 3 && bucket.amount >= 400;

    if (isHeavyAmount || isMultipleBills) {
      const severity: 'high' | 'medium' = bucket.amount >= 1500 ? 'high' : 'medium';
      concentrationAlerts.push({
        dateStr: bucket.dateStr,
        dayNum,
        totalAmount: bucket.amount,
        obligationsCount: bucket.count,
        severity,
        message: `Concentração no dia ${dayNum}: ${bucket.count} pagamentos totalizando R$ ${bucket.amount.toLocaleString('pt-BR')}`,
      });
    }
  });

  concentrationAlerts.sort((a, b) => b.totalAmount - a.totalAmount);

  // 4. Build Days Grid (with padding before and after)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  const days: CalendarDayCalculatedData[] = [];

  let totalMonthIncome = 0;
  let totalMonthExpense = 0;

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

  // Current month days
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const dateStr = `${activeMonth}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;

    // Real Expenses
    const dayExpenses = (state.expenses || []).filter(e => e.date === dateStr);
    const calculatedDayExpenses = dayExpenses
      .filter(e => {
        if (viewMode === 'partner1' && e.paidBy === 'partner2') return false;
        if (viewMode === 'partner2' && e.paidBy === 'partner1') return false;
        return true;
      })
      .map(e => ({
        item: e,
        apportionedAmount: getApportionedAmount(
          e.amount,
          viewMode,
          e.paidBy,
          e.splitPartner1Pct ?? 50,
          e.splitPartner2Pct ?? (100 - (e.splitPartner1Pct ?? 50))
        ),
      }));

    const dayExpSum = roundMoney(calculatedDayExpenses.reduce((sum, e) => sum + e.apportionedAmount, 0));

    // Real Incomes
    const dayIncomes = (state.incomes || []).filter(i => i.date === dateStr);
    const calculatedDayIncomes = dayIncomes
      .filter(i => {
        if (viewMode === 'partner1' && i.recipient === 'partner2') return false;
        if (viewMode === 'partner2' && i.recipient === 'partner1') return false;
        return true;
      })
      .map(i => ({
        item: i,
        apportionedAmount:
          viewMode !== 'couple' && i.recipient === 'both'
            ? roundMoney(i.amount / 2)
            : roundMoney(i.amount),
      }));

    const dayIncSum = roundMoney(calculatedDayIncomes.reduce((sum, i) => sum + i.apportionedAmount, 0));

    // Obligations on this date
    const dayObligations = allObligations.filter(o => o.dueDate === dateStr);
    const dayCommitmentsSum = roundMoney(
      dayObligations.filter(o => o.type !== 'medical_receivable').reduce((sum, o) => sum + o.amount, 0)
    );

    // Shifts worked on this day
    const dayShiftsWorked = (state.medicalShifts || []).filter(s => {
      if (s.dateWorked !== dateStr) return false;
      if (s.executionStatus === 'cancelled') return false;
      if (viewMode === 'partner1' && s.partner === 'partner2') return false;
      if (viewMode === 'partner2' && s.partner === 'partner1') return false;
      return true;
    });

    totalMonthIncome = roundMoney(totalMonthIncome + dayIncSum);
    totalMonthExpense = roundMoney(totalMonthExpense + dayExpSum);

    days.push({
      dateStr,
      dayNum,
      isCurrentMonth: true,
      isToday,
      expenses: calculatedDayExpenses,
      incomes: calculatedDayIncomes,
      obligations: dayObligations,
      medicalShiftsWorked: dayShiftsWorked,
      totalExpense: dayExpSum,
      totalIncome: dayIncSum,
      totalCommitments: dayCommitmentsSum,
      net: roundMoney(dayIncSum - dayExpSum),
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
  const next7DaysEnd = new Date(todayDateObj.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const next30DaysEnd = new Date(todayDateObj.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const filterAgendaObligations = (endDate: string) => {
    return allObligations
      .filter(o => o.dueDate >= todayStr && o.dueDate <= endDate && o.type !== 'medical_receivable')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  };

  const obligations7Days = filterAgendaObligations(next7DaysEnd);
  const totalCommitments7Days = roundMoney(obligations7Days.reduce((sum, o) => sum + o.amount, 0));

  const obligations30Days = filterAgendaObligations(next30DaysEnd);
  const totalCommitments30Days = roundMoney(obligations30Days.reduce((sum, o) => sum + o.amount, 0));

  const agenda7Days: UpcomingAgendaSummary = {
    periodDays: 7,
    totalCommitments: totalCommitments7Days,
    obligations: obligations7Days,
    availableCash,
    hasCashReconciliation,
    isCashSufficient: !hasCashReconciliation || availableCash >= totalCommitments7Days,
    cashDeficit: hasCashReconciliation ? Math.max(0, roundMoney(totalCommitments7Days - availableCash)) : 0,
    concentrationAlerts: concentrationAlerts.filter(a => a.dateStr >= todayStr && a.dateStr <= next7DaysEnd),
  };

  const agenda30Days: UpcomingAgendaSummary = {
    periodDays: 30,
    totalCommitments: totalCommitments30Days,
    obligations: obligations30Days,
    availableCash,
    hasCashReconciliation,
    isCashSufficient: !hasCashReconciliation || availableCash >= totalCommitments30Days,
    cashDeficit: hasCashReconciliation ? Math.max(0, roundMoney(totalCommitments30Days - availableCash)) : 0,
    concentrationAlerts: concentrationAlerts.filter(a => a.dateStr >= todayStr && a.dateStr <= next30DaysEnd),
  };

  const commitmentsPaid = roundMoney(
    allObligations
      .filter(o => o.status === 'pago' && o.type !== 'medical_receivable')
      .reduce((sum, o) => sum + o.amount, 0)
  );

  const commitmentsPending = roundMoney(
    allObligations
      .filter(o => o.status !== 'pago' && o.type !== 'medical_receivable')
      .reduce((sum, o) => sum + o.amount, 0)
  );

  return {
    activeMonth,
    daysGrid: days,
    monthTotals: {
      income: totalMonthIncome,
      expense: totalMonthExpense,
      commitmentsTotal: totalMonthCommitments,
      commitmentsPending,
      commitmentsPaid,
      balance: roundMoney(totalMonthIncome - totalMonthExpense),
    },
    allMonthObligations: allObligations,
    concentrationAlerts,
    agenda7Days,
    agenda30Days,
  };
}
