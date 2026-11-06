import type {
  InstallmentPurchase,
  InstallmentOccurrenceRecord,
  AdvanceInstallmentFundingSource,
} from '../types/finance';

// Keep public BRL fields compatible with legacy records. Distribute the integer
// cent remainder over the first installments; their sum always equals the total.
export function installmentCents(totalOrItem: number | InstallmentPurchase, countArg?: number): number[] {
  let total: number;
  let count: number;

  if (typeof totalOrItem === 'object' && totalOrItem !== null) {
    total = totalOrItem.totalAmount;
    count = totalOrItem.installmentsCount;
  } else {
    total = totalOrItem;
    count = countArg!;
  }

  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count < 1 || count > 600) {
    throw new Error('Parcelamento inválido.');
  }
  const cents = Math.round(total * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Valor fora do limite.');
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function installmentValue(item: InstallmentPurchase, index = item.paidInstallmentsCount): number {
  return (installmentCents(item.totalAmount, item.installmentsCount)[index] ?? 0) / 100;
}

export function remainingInstallmentValue(
  item: InstallmentPurchase,
  count = item.installmentsCount - item.paidInstallmentsCount
): number {
  return (
    installmentCents(item.totalAmount, item.installmentsCount)
      .slice(item.paidInstallmentsCount, item.paidInstallmentsCount + Math.max(0, count))
      .reduce((sum, cents) => sum + cents, 0) / 100
  );
}

export function installmentInMonth(item: InstallmentPurchase, month: string): number {
  const [sy, sm] = item.startMonth.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  const index = (y - sy) * 12 + m - sm;
  if (!Number.isInteger(index) || index < 0 || index >= item.installmentsCount) return 0;
  return installmentValue(item, index);
}

/**
 * Calculates competence YYYY-MM for installment index (0 to count-1) civilly across year boundaries.
 */
export function getInstallmentCompetence(startMonth: string, index0: number): string {
  const [sy, sm] = startMonth.split('-').map(Number);
  const totalMonths = sy * 12 + (sm - 1) + index0;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Calculates due date clamped to actual days of the month.
 */
export function getInstallmentDueDate(competenceMonth: string, dueDay: number = 10): string {
  const [y, m] = competenceMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, dueDay || 10), daysInMonth);
  return `${competenceMonth}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Canonical occurrence identity: purchaseId:installmentNumber:competenceMonth
 */
export function generateOccurrenceId(
  purchaseId: string,
  installmentNumber: number,
  competenceMonth: string
): string {
  return `${purchaseId}:${installmentNumber}:${competenceMonth}`;
}

/**
 * Builds the canonical schedule of concrete installment occurrences.
 * Exact integer-cent allocations ensure the sum of all occurrences equals totalAmount with zero cent loss.
 * Preserves existing recorded statuses and migrates legacy paid counts safely without inventing fake receipts.
 */
export function buildInstallmentSchedule(
  item: InstallmentPurchase,
  todayStr?: string
): InstallmentOccurrenceRecord[] {
  const today =
    todayStr ||
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const centsArray = installmentCents(item.totalAmount, item.installmentsCount);
  const existingRecords = item.occurrenceRecords || {};

  return centsArray.map((cents, index0) => {
    const installmentNumber = index0 + 1;
    const competenceMonth = getInstallmentCompetence(item.startMonth, index0);
    const occurrenceId = generateOccurrenceId(item.id, installmentNumber, competenceMonth);
    const dueDate = getInstallmentDueDate(competenceMonth, item.dueDay);

    const existing = existingRecords[occurrenceId];
    if (existing) {
      return {
        ...existing,
        occurrenceId,
        purchaseId: item.id,
        installmentNumber,
        competenceMonth,
        dueDate,
        amountCents: cents,
        amountR$: cents / 100,
      };
    }

    // Legacy convention migration: first item.paidInstallmentsCount occurrences are marked 'pago'
    let status: InstallmentOccurrenceRecord['status'] = 'previsto';
    let paidAt: string | undefined = undefined;

    if (index0 < item.paidInstallmentsCount) {
      status = 'pago';
      paidAt = dueDate;
    } else if (dueDate < today) {
      status = 'vencido';
    }

    return {
      occurrenceId,
      purchaseId: item.id,
      installmentNumber,
      competenceMonth,
      dueDate,
      amountCents: cents,
      amountR$: cents / 100,
      status,
      paidAt,
    };
  });
}

export interface PayOccurrenceResult {
  updatedItem: InstallmentPurchase;
  paidOccurrence: InstallmentOccurrenceRecord;
  alreadyPaid: boolean;
}

/**
 * Idempotent occurrence payment.
 * A repeat attempt or timeout in another session pays the same occurrence once.
 * A new click NEVER pays the next occurrence by mistake!
 */
export function payOccurrence(
  item: InstallmentPurchase,
  targetOccurrenceIdOrNumber?: string | number,
  paymentRef?: { operationId?: string; date?: string; expenseId?: string }
): PayOccurrenceResult {
  const schedule = buildInstallmentSchedule(item);

  // Identify target occurrence
  let targetOcc: InstallmentOccurrenceRecord | undefined;
  if (typeof targetOccurrenceIdOrNumber === 'string') {
    targetOcc = schedule.find(
      o => o.occurrenceId === targetOccurrenceIdOrNumber || o.occurrenceId.startsWith(targetOccurrenceIdOrNumber)
    );
  } else if (typeof targetOccurrenceIdOrNumber === 'number') {
    targetOcc = schedule.find(o => o.installmentNumber === targetOccurrenceIdOrNumber);
  } else {
    // If not specified, target the first unpaid occurrence
    targetOcc = schedule.find(o => o.status !== 'pago' && o.status !== 'antecipado');
  }

  if (!targetOcc) {
    // Everything already paid
    return {
      updatedItem: item,
      paidOccurrence: schedule[schedule.length - 1],
      alreadyPaid: true,
    };
  }

  // Idempotency check: if already paid, do NOT advance or pay the next!
  if (targetOcc.status === 'pago' || targetOcc.status === 'antecipado') {
    return {
      updatedItem: item,
      paidOccurrence: targetOcc,
      alreadyPaid: true,
    };
  }

  const paidDate =
    paymentRef?.date ||
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const updatedOcc: InstallmentOccurrenceRecord = {
    ...targetOcc,
    status: 'pago',
    paidAt: paidDate,
    paymentOperationId: paymentRef?.operationId || paymentRef?.expenseId,
  };

  const nextRecords: Record<string, InstallmentOccurrenceRecord> = {
    ...(item.occurrenceRecords || {}),
  };
  schedule.forEach(o => {
    if (o.occurrenceId === updatedOcc.occurrenceId) {
      nextRecords[o.occurrenceId] = updatedOcc;
    } else if (!nextRecords[o.occurrenceId]) {
      nextRecords[o.occurrenceId] = o;
    }
  });

  const paidCount = Object.values(nextRecords).filter(
    o => o.status === 'pago' || o.status === 'antecipado'
  ).length;

  const isCompleted = paidCount >= item.installmentsCount;

  const updatedItem: InstallmentPurchase = {
    ...item,
    paidInstallmentsCount: paidCount,
    active: !isCompleted,
    completedNotified: isCompleted ? false : item.completedNotified,
    occurrenceRecords: nextRecords,
  };

  return {
    updatedItem,
    paidOccurrence: updatedOcc,
    alreadyPaid: false,
  };
}

export interface AdvanceOccurrencesResult {
  updatedItem: InstallmentPurchase;
  advancedOccurrences: InstallmentOccurrenceRecord[];
  totalOriginalCents: number;
  totalNominalCents: number;
  effectivePaidCents: number;
  totalEffectivePaidCents: number;
  discountCents: number;
  totalDiscountCents: number;
}

/**
 * Advances concrete occurrences with exact discount and funding source tracking.
 */
export function advanceOccurrences(
  item: InstallmentPurchase,
  options: {
    count?: number;
    countToAdvance?: number;
    specificOccurrenceIds?: string[];
    discountR$?: number;
    discountCents?: number;
    funding: AdvanceInstallmentFundingSource;
    operationId?: string;
    date?: string;
  }
): AdvanceOccurrencesResult {
  const schedule = buildInstallmentSchedule(item);
  const unpaid = schedule.filter(o => o.status !== 'pago' && o.status !== 'antecipado');

  const rawCount = options.count ?? options.countToAdvance ?? 1;
  let selected: InstallmentOccurrenceRecord[] = [];
  if (options.specificOccurrenceIds && options.specificOccurrenceIds.length > 0) {
    const idSet = new Set(options.specificOccurrenceIds);
    selected = unpaid.filter(o => idSet.has(o.occurrenceId));
  } else {
    // Default: select the last N unpaid occurrences (standard Brazilian card debt advance)
    const count = Math.min(Math.max(1, rawCount), unpaid.length);
    selected = unpaid.slice(unpaid.length - count);
  }

  if (selected.length === 0) {
    return {
      updatedItem: item,
      advancedOccurrences: [],
      totalOriginalCents: 0,
      totalNominalCents: 0,
      effectivePaidCents: 0,
      totalEffectivePaidCents: 0,
      discountCents: 0,
      totalDiscountCents: 0,
    };
  }

  const totalOriginalCents = selected.reduce((sum, o) => sum + o.amountCents, 0);
  const discountCents = options.discountCents !== undefined
    ? options.discountCents
    : Math.round(Math.max(0, options.discountR$ || 0) * 100);
  const effectivePaidCents = Math.max(0, totalOriginalCents - discountCents);

  const advanceDate =
    options.date ||
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  // Distribute discount proportionally across selected occurrences
  const updatedSelected: InstallmentOccurrenceRecord[] = selected.map((occ, idx) => {
    const occShare = totalOriginalCents > 0 ? occ.amountCents / totalOriginalCents : 1 / selected.length;
    const occDiscount = idx === selected.length - 1
      ? discountCents - selected.slice(0, idx).reduce((s, o) => s + Math.round((discountCents * o.amountCents) / totalOriginalCents), 0)
      : Math.round(discountCents * occShare);
    const occEffective = Math.max(0, occ.amountCents - occDiscount);

    return {
      ...occ,
      status: 'antecipado' as const,
      paidAt: advanceDate,
      paymentOperationId: options.operationId,
      discountCents: occDiscount,
      effectivePaidCents: occEffective,
      fundingSource: options.funding,
    };
  });

  const nextRecords: Record<string, InstallmentOccurrenceRecord> = {
    ...(item.occurrenceRecords || {}),
  };
  schedule.forEach(o => {
    const advanced = updatedSelected.find(a => a.occurrenceId === o.occurrenceId);
    if (advanced) {
      nextRecords[o.occurrenceId] = advanced;
    } else if (!nextRecords[o.occurrenceId]) {
      nextRecords[o.occurrenceId] = o;
    }
  });

  const paidCount = Object.values(nextRecords).filter(
    o => o.status === 'pago' || o.status === 'antecipado'
  ).length;

  const isCompleted = paidCount >= item.installmentsCount;

  const updatedItem: InstallmentPurchase = {
    ...item,
    paidInstallmentsCount: paidCount,
    active: !isCompleted,
    completedNotified: isCompleted ? false : item.completedNotified,
    occurrenceRecords: nextRecords,
  };

  return {
    updatedItem,
    advancedOccurrences: updatedSelected,
    totalOriginalCents,
    totalNominalCents: totalOriginalCents,
    effectivePaidCents,
    totalEffectivePaidCents: effectivePaidCents,
    discountCents,
    totalDiscountCents: discountCents,
  };
}

export interface ReverseOccurrenceResult {
  updatedItem: InstallmentPurchase;
  reversedOccurrence: InstallmentOccurrenceRecord;
  alreadyReversed: boolean;
  restoredFunding?: AdvanceInstallmentFundingSource;
  restoredExpenseId?: string;
  returnedToGoal?: { goalId: string; amountR$: number };
  returnedToReserveExcessR$?: number;
  returnedToMonthSurplusR$?: number;
}

/**
 * Reverses a payment or advance on a concrete occurrence and returns the restored funding source.
 * Never affects other independent occurrences.
 */
export function reverseOccurrencePayment(
  item: InstallmentPurchase,
  targetOccurrenceIdOrNumber: string | number
): ReverseOccurrenceResult {
  const schedule = buildInstallmentSchedule(item);

  const targetOcc = schedule.find(o =>
    typeof targetOccurrenceIdOrNumber === 'number'
      ? o.installmentNumber === targetOccurrenceIdOrNumber
      : o.occurrenceId === targetOccurrenceIdOrNumber || o.occurrenceId.startsWith(targetOccurrenceIdOrNumber)
  );

  if (!targetOcc || (targetOcc.status !== 'pago' && targetOcc.status !== 'antecipado')) {
    return {
      updatedItem: item,
      reversedOccurrence: targetOcc || schedule[0],
      alreadyReversed: true,
    };
  }

  const restoredFunding = targetOcc.fundingSource;
  const restoredExpenseId = targetOcc.paymentOperationId;

  const returnedToGoal = restoredFunding?.fromGoalId && (restoredFunding.fromGoalAmount || 0) > 0
    ? { goalId: restoredFunding.fromGoalId, amountR$: restoredFunding.fromGoalAmount || 0 }
    : undefined;
  const returnedToReserveExcessR$ = restoredFunding?.fromProtectionExcess || 0;
  const returnedToMonthSurplusR$ = restoredFunding?.fromMonthSurplus || 0;

  const reversedOcc: InstallmentOccurrenceRecord = {
    ...targetOcc,
    status: 'estornado',
    paidAt: undefined,
    paymentOperationId: undefined,
    discountCents: undefined,
    effectivePaidCents: undefined,
    fundingSource: undefined,
  };

  const nextRecords: Record<string, InstallmentOccurrenceRecord> = {
    ...(item.occurrenceRecords || {}),
  };
  schedule.forEach(o => {
    if (o.occurrenceId === reversedOcc.occurrenceId) {
      nextRecords[o.occurrenceId] = reversedOcc;
    } else if (!nextRecords[o.occurrenceId]) {
      nextRecords[o.occurrenceId] = o;
    }
  });

  const paidCount = Object.values(nextRecords).filter(
    o => o.status === 'pago' || o.status === 'antecipado'
  ).length;

  const updatedItem: InstallmentPurchase = {
    ...item,
    paidInstallmentsCount: paidCount,
    active: true, // Re-opened purchase
    occurrenceRecords: nextRecords,
  };

  return {
    updatedItem,
    reversedOccurrence: reversedOcc,
    alreadyReversed: false,
    restoredFunding,
    restoredExpenseId,
    returnedToGoal,
    returnedToReserveExcessR$,
    returnedToMonthSurplusR$,
  };
}

/**
 * Pure preview of advance payment impact by competence month without mutating state.
 */
export function previewAdvanceImpact(
  item: InstallmentPurchase,
  countToAdvance: number,
  discountR$: number = 0
): {
  selectedOccurrences: InstallmentOccurrenceRecord[];
  originalTotal: number;
  discountTotal: number;
  effectiveTotal: number;
  nominalTotalR$: number;
  discountR$: number;
  effectiveTotalR$: number;
  newRemainingCount: number;
  relievedMonths: { monthKey: string; reliefAmount: number }[];
} {
  const schedule = buildInstallmentSchedule(item);
  const unpaid = schedule.filter(o => o.status !== 'pago' && o.status !== 'antecipado');
  const count = Math.min(Math.max(1, countToAdvance), unpaid.length);
  const selected = unpaid.slice(unpaid.length - count);

  const originalTotalCents = selected.reduce((sum, o) => sum + o.amountCents, 0);
  const discountTotalCents = Math.round(Math.max(0, discountR$) * 100);
  const effectiveTotalCents = Math.max(0, originalTotalCents - discountTotalCents);

  const relievedMonths = selected.map(o => ({
    monthKey: o.competenceMonth,
    reliefAmount: o.amountR$,
  }));

  const originalTotal = originalTotalCents / 100;
  const discountTotal = discountTotalCents / 100;
  const effectiveTotal = effectiveTotalCents / 100;

  return {
    selectedOccurrences: selected,
    originalTotal,
    discountTotal,
    effectiveTotal,
    nominalTotalR$: originalTotal,
    discountR$: discountTotal,
    effectiveTotalR$: effectiveTotal,
    newRemainingCount: Math.max(0, unpaid.length - count),
    relievedMonths,
  };
}
