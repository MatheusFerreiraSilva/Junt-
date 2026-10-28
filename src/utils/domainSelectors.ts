import {
  AppState,
  ExpenseItem,
  IncomeItem,
  InstallmentPurchase,
  FixedBillAlert,
  SavingsPiggyBank,
  CoupleGoal,
  MedicalShift,
  BankImportedTransaction,
  SurplusTransferRecord,
  CategoryKey,
} from '../types/finance';

export type DomainScope = 'casal' | 'partner1' | 'partner2';
export type AccountingBasis = 'caixa' | 'competencia' | 'plano';

export type FinancialEventType =
  | 'ECONOMIC_EXPENSE'       // Lançamento econômico de consumo (aluguel, mercado, lazer)
  | 'ECONOMIC_INCOME'        // Receita líquida recebida (salário, bolsa, plantão)
  | 'RESERVE_APORTE'         // Transferência para reserva/cofrinho (reduz caixa operacional, eleva patrimônio)
  | 'RESERVE_RESGATE'         // Resgate da reserva/cofrinho (eleva caixa operacional, reduz patrimônio)
  | 'COUPLE_SETTLEMENT'      // Acerto financeiro entre parceiros (transferência interna P1 <-> P2)
  | 'OBLIGATION_FORECAST'    // Previsão/Obrigação futura (conta fixa pendente, parcela vincenda)
  | 'RECEIVABLE_FORECAST';   // Recebível futuro (plantão realizado/agendado aguardando pagamento)

export interface NormalizedFinancialEvent {
  id: string;
  eventType: FinancialEventType;
  title: string;
  amount: number; // Em centavos de Real preservados (ex: 150.50)
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  owner: 'partner1' | 'partner2' | 'both';
  category?: CategoryKey;
  targetGoalId?: string;
  canonicalSource: string;
  affectsMonthlyBudget: boolean;
  affectsLiquidCash: boolean;
  affectsNetWorth: boolean;
}

/**
  * Safely rounds amounts to exactly 2 decimal places to prevent float precision drift.
  */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
  * Checks if an entity belongs to the requested scope.
  */
export function isEntityInScope(
  owner: 'partner1' | 'partner2' | 'both' | 'custom' | undefined,
  scope: DomainScope
): boolean {
  if (scope === 'casal') return true;
  if (!owner || owner === 'both') return true;
  return owner === scope;
}

/**
  * Selects all canonical economic incomes for a given scope and month.
  */
export function selectCanonicalIncomes(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): IncomeItem[] {
  const incomes = state.incomes || [];
  return incomes.filter((inc) => {
    if (monthKey && inc.date && !inc.date.startsWith(monthKey)) return false;
    const recipientOwner = inc.recipient === 'partner1' ? 'partner1' : inc.recipient === 'partner2' ? 'partner2' : 'both';
    return isEntityInScope(recipientOwner, scope);
  });
}

/**
  * Computes total effective economic income for scope and month.
  */
export function selectEffectiveIncomeTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const incomes = selectCanonicalIncomes(state, 'casal', monthKey);
  const total = incomes.reduce((sum, inc) => {
    if (scope === 'casal') return sum + (inc.amount || 0);
    if (inc.recipient === scope) return sum + (inc.amount || 0);
    if (inc.recipient === 'both') return sum + (inc.amount || 0) * 0.5;
    return sum;
  }, 0);
  return roundMoney(total);
}

/**
  * Selects all canonical consumption expenses (excluding excluded/internal funding items).
  */
export function selectCanonicalConsumptionExpenses(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): ExpenseItem[] {
  const expenses = state.expenses || [];
  return expenses.filter((exp) => {
    if (monthKey && exp.date && !exp.date.startsWith(monthKey)) return false;
    if (exp.isExcludedFromMonthlyBudget) return false;
    return isEntityInScope(exp.paidBy, scope);
  });
}

/**
  * Computes total consumption expenses for scope and month.
  */
export function selectConsumptionExpensesTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  const expenses = selectCanonicalConsumptionExpenses(state, 'casal', monthKey);
  const total = expenses.reduce((sum, exp) => {
    if (scope === 'casal') return sum + (exp.amount || 0);
    if (exp.paidBy === scope) return sum + (exp.amount || 0);
    if (exp.paidBy === 'both') {
      const pct = scope === 'partner1' ? (exp.splitPartner1Pct ?? 50) : (exp.splitPartner2Pct ?? 50);
      return sum + ((exp.amount || 0) * pct) / 100;
    }
    return sum;
  }, 0);
  return roundMoney(total);
}

/**
  * Computes pending financial obligations (fixed bills + credit installments) due in monthKey not yet in expenses.
  */
export function selectPendingObligationsTotal(
  state: AppState,
  scope: DomainScope = 'casal',
  monthKey?: string
): number {
  if (!monthKey) return 0;
  let total = 0;

  const currentMonthExpenses = (state.expenses || []).filter((e) => e.date && e.date.startsWith(monthKey));

  // A) Pending fixed bills
  (state.coupleFixedBills || []).forEach((bill) => {
    if (bill.status === 'paid') return;
    if (!isEntityInScope(bill.assignedPayer, scope)) return;

    const dueDayStr = String(bill.dueDay).padStart(2, '0');
    const fullDate = `${monthKey}-${dueDayStr}`;
    const alreadyInExpenses = currentMonthExpenses.some(
      (e) => e.description.toLowerCase().trim() === bill.title.toLowerCase().trim() && e.date === fullDate
    );
    if (!alreadyInExpenses) {
      total += bill.amount || 0;
    }
  });

  // B) Pending active credit card installments
  (state.installments || []).forEach((inst) => {
    if (!inst.active) return;
    if (!isEntityInScope(inst.paidBy, scope)) return;

    const alreadyInExpenses = currentMonthExpenses.some((e) => e.installmentId === inst.id);
    if (!alreadyInExpenses) {
      total += inst.installmentAmount || 0;
    }
  });

  return roundMoney(total);
}

/**
  * Computes total liquid operational cash balance by summing connected bank accounts and adjusting for incomes, expenses, and reserve transfers.
  */
export function selectLiquidOperationalCash(
  state: AppState,
  scope: DomainScope = 'casal'
): number {
  const linkedAccounts = state.linkedAccounts || [];
  const pluggyAccounts = state.pluggyAccounts || [];

  let baseBankBalance = 0;

  linkedAccounts.forEach((acc) => {
    if (isEntityInScope(acc.holder, scope)) {
      baseBankBalance += acc.balance || 0;
    }
  });

  pluggyAccounts.forEach((acc) => {
    if (acc.status === 'connected' && acc.accountType === 'corrente') {
      if (isEntityInScope(acc.owner, scope)) {
        baseBankBalance += acc.balance || 0;
      }
    }
  });

  return roundMoney(baseBankBalance);
}

/**
  * Computes total protected assets (Emergency Reserve + Freedom Investments + Piggy Banks / Couple Goals).
  */
export function selectTotalProtectedAssets(
  state: AppState,
  scope: DomainScope = 'casal'
): {
  protection: number;
  freedom: number;
  goalsAndPiggyBanks: number;
  totalProtected: number;
} {
  const protection = roundMoney(state.protectionCurrentAmount || 0);
  const freedom = roundMoney(state.freedomTotalInvested || 0);

  let goalsAndPiggyBanks = 0;
  (state.piggyBanks || []).forEach((pb) => {
    goalsAndPiggyBanks += pb.currentAmount || 0;
  });

  // Scale by 0.5 for partner scopes if joint
  let protectionShare = protection;
  let freedomShare = freedom;
  let goalsShare = roundMoney(goalsAndPiggyBanks);

  if (scope !== 'casal') {
    protectionShare = roundMoney(protection / 2);
    freedomShare = roundMoney(freedom / 2);
    goalsShare = roundMoney(goalsAndPiggyBanks / 2);
  }

  const totalProtected = roundMoney(protectionShare + freedomShare + goalsShare);

  return {
    protection: protectionShare,
    freedom: freedomShare,
    goalsAndPiggyBanks: goalsShare,
    totalProtected,
  };
}

/**
  * Computes total Net Worth (Liquid Operational Cash + Protected Assets).
  */
export function selectTotalNetWorth(
  state: AppState,
  scope: DomainScope = 'casal'
): number {
  const liquidCash = selectLiquidOperationalCash(state, scope);
  const { totalProtected } = selectTotalProtectedAssets(state, scope);
  return roundMoney(liquidCash + totalProtected);
}

/**
  * Validates domain mathematical integrity:
  * Ensures P1_Total + P2_Total + Joint_Unassigned === Consolidado_Casal without orphaned drift.
  */
export function validateDomainChecksum(
  state: AppState,
  monthKey: string
): {
  isChecksumValid: boolean;
  p1Income: number;
  p2Income: number;
  coupleIncome: number;
  p1Expenses: number;
  p2Expenses: number;
  coupleExpenses: number;
  incomeDiscrepancy: number;
  expenseDiscrepancy: number;
} {
  const p1Income = selectEffectiveIncomeTotal(state, 'partner1', monthKey);
  const p2Income = selectEffectiveIncomeTotal(state, 'partner2', monthKey);
  const coupleIncome = selectEffectiveIncomeTotal(state, 'casal', monthKey);

  const p1Expenses = selectConsumptionExpensesTotal(state, 'partner1', monthKey);
  const p2Expenses = selectConsumptionExpensesTotal(state, 'partner2', monthKey);
  const coupleExpenses = selectConsumptionExpensesTotal(state, 'casal', monthKey);

  const incomeDiscrepancy = roundMoney(coupleIncome - (p1Income + p2Income));
  const expenseDiscrepancy = roundMoney(coupleExpenses - (p1Expenses + p2Expenses));

  // In standard model, items owned by 'both' belong to couple total and split between P1 & P2
  const isChecksumValid = Math.abs(incomeDiscrepancy) <= 0.05 && Math.abs(expenseDiscrepancy) <= 0.05;

  return {
    isChecksumValid,
    p1Income,
    p2Income,
    coupleIncome,
    p1Expenses,
    p2Expenses,
    coupleExpenses,
    incomeDiscrepancy,
    expenseDiscrepancy,
  };
}
