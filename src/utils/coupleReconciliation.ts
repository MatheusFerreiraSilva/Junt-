import { ExpenseItem, CategoryKey, PaidBy } from '../types/finance';
import { CATEGORIES_BASE } from '../context/FinanceContext';

export interface DuplicateGroup {
  id: string;
  primary: ExpenseItem;
  duplicates: ExpenseItem[];
  reason: string;
  amount: number;
  date: string;
}

export interface CoupleSettlementSummary {
  partner1Name: string;
  partner2Name: string;
  partner1PaidJoint: number;
  partner2PaidJoint: number;
  totalJoint: number;
  splitMode: 'fifty_fifty' | 'proportional';
  partner1TargetShare: number;
  partner2TargetShare: number;
  debtor: 'partner1' | 'partner2' | 'none';
  debtorName: string;
  creditorName: string;
  transferAmount: number;
  isBalanced: boolean;
}

export interface PredictiveBurnAlert {
  categoryKey: CategoryKey;
  categoryName: string;
  categoryEmoji: string;
  spent: number;
  budget: number;
  percentUsed: number;
  burnRatePerDay: number;
  projectedBurstDay: number | null;
  safeDailyTarget: number;
  daysUntilBurst: number | null;
  severity: 'nominal' | 'warning' | 'critical';
  recommendation: string;
}

/**
 * Detects suspicious duplicate expenses in the given list.
 * Identifies entries with:
 * 1. Same amount, same date, same category.
 * 2. Same amount and identical/very similar description within +- 24 hours.
 */
export function detectDuplicateExpenses(expenses: ExpenseItem[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();

  for (let i = 0; i < expenses.length; i++) {
    const a = expenses[i];
    if (processedIds.has(a.id)) continue;

    const matchedDuplicates: ExpenseItem[] = [];

    for (let j = i + 1; j < expenses.length; j++) {
      const b = expenses[j];
      if (processedIds.has(b.id)) continue;

      const sameAmount = Math.abs(a.amount - b.amount) < 0.01;
      const sameCategory = a.category === b.category;
      const sameDate = a.date === b.date;

      const descA = a.description.trim().toLowerCase();
      const descB = b.description.trim().toLowerCase();
      const sameDesc = descA === descB;

      // Date difference in days
      const dateDiffDays = Math.abs(
        (new Date(a.date).getTime() - new Date(b.date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Match criteria 1: Same date, exact amount, and same category
      // Match criteria 2: Within 1 day, exact amount, and same description
      if ((sameDate && sameAmount && sameCategory) || (dateDiffDays <= 1 && sameAmount && sameDesc)) {
        matchedDuplicates.push(b);
        processedIds.add(b.id);
      }
    }

    if (matchedDuplicates.length > 0) {
      processedIds.add(a.id);
      groups.push({
        id: `dup-${a.id}`,
        primary: a,
        duplicates: matchedDuplicates,
        reason:
          a.date === matchedDuplicates[0].date
            ? `Valor idêntico (R$ ${a.amount.toFixed(2)}) lançado no mesmo dia (${a.date})`
            : `Mesmo valor e descrição em datas consecutivas`,
        amount: a.amount,
        date: a.date,
      });
    }
  }

  return groups;
}

/**
 * Calculates the exact settlement for joint expenses between the couple.
 */
export function calculateCoupleSettlement({
  expenses,
  currentMonth,
  partner1Name,
  partner2Name,
  partner1Income,
  partner2Income,
  splitMode = 'fifty_fifty',
}: {
  expenses: ExpenseItem[];
  currentMonth: string;
  partner1Name: string;
  partner2Name: string;
  partner1Income: number;
  partner2Income: number;
  splitMode?: 'fifty_fifty' | 'proportional';
}): CoupleSettlementSummary {
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));

  let partner1PaidJoint = 0;
  let partner2PaidJoint = 0;

  monthExpenses.forEach((exp) => {
    // Joint / shared expenses
    if (exp.paidBy === 'both') {
      const p1Custom = exp.splitPartner1Pct ?? 50;
      const p2Custom = exp.splitPartner2Pct ?? 50;
      // In default both, they both split the commitment
      // If one paid the full bill upfront on their card/account:
      // In standard app model, if recorded as 'both', it's joint.
      // But if paidBy is partner1 and marked split or joint:
      partner1PaidJoint += (exp.amount * p1Custom) / 100;
      partner2PaidJoint += (exp.amount * p2Custom) / 100;
    } else if (exp.paidBy === 'partner1') {
      // If partner 1 paid for a shared item (or custom split)
      if (exp.splitPartner2Pct && exp.splitPartner2Pct > 0) {
        partner1PaidJoint += exp.amount; // Partner 1 disbursed 100% of the money
      }
    } else if (exp.paidBy === 'partner2') {
      // If partner 2 paid for a shared item (or custom split)
      if (exp.splitPartner1Pct && exp.splitPartner1Pct > 0) {
        partner2PaidJoint += exp.amount; // Partner 2 disbursed 100% of the money
      }
    }
  });

  // Also include general joint purchases:
  // If user marks joint expenses where P1 or P2 physically paid:
  const totalJoint = partner1PaidJoint + partner2PaidJoint;
  const totalIncome = partner1Income + partner2Income;

  let partner1TargetShare = totalJoint * 0.5;
  let partner2TargetShare = totalJoint * 0.5;

  if (splitMode === 'proportional' && totalIncome > 0) {
    const p1Pct = partner1Income / totalIncome;
    const p2Pct = partner2Income / totalIncome;
    partner1TargetShare = totalJoint * p1Pct;
    partner2TargetShare = totalJoint * p2Pct;
  }

  // Net difference
  // If P1 paid more than target share, P2 owes P1 the difference
  const diff = partner1PaidJoint - partner1TargetShare;

  let debtor: 'partner1' | 'partner2' | 'none' = 'none';
  let debtorName = '';
  let creditorName = '';
  let transferAmount = 0;

  if (Math.abs(diff) < 0.05 || totalJoint === 0) {
    debtor = 'none';
    transferAmount = 0;
  } else if (diff > 0) {
    // Partner 1 paid more than their target -> Partner 2 must transfer to Partner 1
    debtor = 'partner2';
    debtorName = partner2Name;
    creditorName = partner1Name;
    transferAmount = diff;
  } else {
    // Partner 2 paid more than their target -> Partner 1 must transfer to Partner 2
    debtor = 'partner1';
    debtorName = partner1Name;
    creditorName = partner2Name;
    transferAmount = Math.abs(diff);
  }

  return {
    partner1Name,
    partner2Name,
    partner1PaidJoint,
    partner2PaidJoint,
    totalJoint,
    splitMode,
    partner1TargetShare,
    partner2TargetShare,
    debtor,
    debtorName,
    creditorName,
    transferAmount,
    isBalanced: debtor === 'none',
  };
}

/**
 * Calculates predictive burn rate and projections for categories before they burst.
 */
export function calculatePredictiveBurnRates({
  categoriesSpending,
  currentMonth,
}: {
  categoriesSpending: Record<
    CategoryKey,
    { spent: number; budget: number; remaining: number; percentageUsed: number; isOver: boolean }
  >;
  currentMonth: string;
}): PredictiveBurnAlert[] {
  const alerts: PredictiveBurnAlert[] = [];

  // Determine days passed and total days in current month
  const now = new Date();
  const year = parseInt(currentMonth.split('-')[0], 10);
  const month = parseInt(currentMonth.split('-')[1], 10);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // If viewing current calendar month, use real today date; else assume 30 days
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const currentDay = isCurrentMonth ? Math.max(1, now.getDate()) : 15;
  const daysRemaining = Math.max(0, totalDaysInMonth - currentDay);

  (Object.keys(categoriesSpending) as CategoryKey[]).forEach((catKey) => {
    const spend = categoriesSpending[catKey];
    if (!spend || spend.budget <= 0) return;

    const catBase = CATEGORIES_BASE[catKey];
    const burnRatePerDay = currentDay > 0 ? spend.spent / currentDay : 0;
    const safeDailyTarget =
      daysRemaining > 0 && spend.remaining > 0 ? spend.remaining / daysRemaining : 0;

    let projectedBurstDay: number | null = null;
    let daysUntilBurst: number | null = null;
    let severity: 'nominal' | 'warning' | 'critical' = 'nominal';
    let recommendation = 'Ritmo sob controle para o mês.';

    if (spend.isOver) {
      severity = 'critical';
      recommendation = `Categoria já ultrapassou o teto em R$ ${Math.abs(spend.remaining).toFixed(2)}.`;
    } else if (burnRatePerDay > 0) {
      // Days needed at current burn rate to reach budget limit
      const daysToExhaustBudget = spend.budget / burnRatePerDay;
      projectedBurstDay = Math.ceil(daysToExhaustBudget);

      if (projectedBurstDay < totalDaysInMonth) {
        daysUntilBurst = Math.max(1, projectedBurstDay - currentDay);
        severity = daysUntilBurst <= 5 ? 'critical' : 'warning';
        recommendation = `No ritmo atual (R$ ${burnRatePerDay.toFixed(
          2
        )}/dia), o orçamento esgotará no dia ${projectedBurstDay}. Limitem a R$ ${safeDailyTarget.toFixed(
          2
        )}/dia para fechar no positivo.`;
      }
    }

    if (severity !== 'nominal') {
      alerts.push({
        categoryKey: catKey,
        categoryName: catBase?.name || catKey,
        categoryEmoji: catBase?.emoji || '💳',
        spent: spend.spent,
        budget: spend.budget,
        percentUsed: spend.percentageUsed,
        burnRatePerDay,
        projectedBurstDay,
        safeDailyTarget,
        daysUntilBurst,
        severity,
        recommendation,
      });
    }
  });

  // Sort by most critical first
  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return (a.daysUntilBurst || 99) - (b.daysUntilBurst || 99);
  });
}
