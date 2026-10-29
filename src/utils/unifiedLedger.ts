import { AppState, CategoryKey, PaidBy, ExpenseItem, IncomeItem, SurplusTransferRecord, MedicalShift } from '../types/finance';
import { CATEGORIES_BASE, getCategoryInfo } from '../context/FinanceContext';

export type StatementType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'investment_deposit'
  | 'investment_withdrawal'
  | 'reconciliation_adjustment';

export type StatementDirection = 'inflow' | 'outflow' | 'internal';

export interface StatementAuditDetails {
  sourceDescription: string;
  linkedEvent?: string;
  linkedEntityId?: string;
  fitid?: string;
  createdAt?: string;
  isExcludedFromMonthlyBudget?: boolean;
  fundingSourceLabel?: string;
  shiftHospitalName?: string;
  shiftDate?: string;
}

export interface StatementItem {
  id: string; // unique ledger statement ID
  entityType: 'expense' | 'income' | 'surplus_transfer' | 'shift_payout';
  entityId: string; // canonical entity ID
  type: StatementType;
  direction: StatementDirection;
  title: string;
  amount: number; // exact amount in R$
  date: string; // YYYY-MM-DD
  competenceMonth: string; // YYYY-MM
  category?: CategoryKey | string;
  categoryName: string;
  categoryEmoji: string;
  paidBy: PaidBy;
  paidByName: string;
  bankName?: string;
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  origin: 'manual' | 'pluggy_import' | 'ofx_import' | 'shift_payout' | 'installment' | 'fixed_bill' | 'surplus_transfer';
  status: 'confirmed' | 'pending' | 'reconciled';
  fitid?: string;
  notes?: string;
  auditDetails: StatementAuditDetails;
  rawExpense?: ExpenseItem;
  rawIncome?: IncomeItem;
  rawTransfer?: SurplusTransferRecord;
}

/**
 * Normaliza o termo de busca por valor numérico (suporta formato brasileiro com vírgula).
 * Ex: "800,50" -> "800.50", "1.250,00" -> "1250.00"
 */
export function normalizeSearchTerm(term: string): { text: string; numVal?: number } {
  const clean = term.trim();
  if (!clean) return { text: '' };

  const lower = clean.toLowerCase();

  // Try parsing Brazilian currency number formatted string
  const sanitizedNumStr = clean.replace(/\./g, '').replace(',', '.');
  const numVal = parseFloat(sanitizedNumStr);

  return {
    text: lower,
    numVal: !isNaN(numVal) && isFinite(numVal) ? numVal : undefined,
  };
}

/**
 * Constrói a leitura unificada de todas as entidades financeiras canônicas em um único extrato rastreável.
 * Não duplica arrays de estado.
 */
export function buildUnifiedLedger(
  state: AppState,
  viewMode: 'couple' | 'partner1' | 'partner2' = 'couple'
): StatementItem[] {
  const items: StatementItem[] = [];

  const partner1Name = state.profile?.partner1Name || 'Parceiro 1';
  const partner2Name = state.profile?.partner2Name || 'Parceiro 2';

  const getPaidByLabel = (paidBy: PaidBy): string => {
    if (paidBy === 'partner1') return partner1Name;
    if (paidBy === 'partner2') return partner2Name;
    if (paidBy === 'custom') return 'Divisão Customizada';
    return 'Casal (Em Conjunto)';
  };

  // 1. Process Expenses (Outflows)
  (state.expenses || []).forEach(exp => {
    // View mode filter
    if (viewMode === 'partner1' && exp.paidBy === 'partner2') return;
    if (viewMode === 'partner2' && exp.paidBy === 'partner1') return;

    const catInfo = getCategoryInfo(exp.category);
    const dateStr = exp.date || new Date().toISOString().slice(0, 10);
    const competence = dateStr.slice(0, 7);

    let origin: StatementItem['origin'] = 'manual';
    if (exp.bankName) origin = 'pluggy_import';
    else if (exp.installmentId) origin = 'installment';
    else if (exp.linkedBillId) origin = 'fixed_bill';

    let linkedEvent: string | undefined = undefined;
    if (exp.installmentId) {
      linkedEvent = `Parcela ${exp.installmentIndex || 1}/${exp.installmentTotal || 12}`;
    } else if (exp.fundingGoalName) {
      linkedEvent = `Financiado por Caixinha "${exp.fundingGoalName}"`;
    } else if (exp.fundingSource === 'reserve_excess') {
      linkedEvent = 'Financiado pelo Excesso da Reserva de Emergência';
    }

    items.push({
      id: `stmt-exp-${exp.id}`,
      entityType: 'expense',
      entityId: exp.id,
      type: 'expense',
      direction: 'outflow',
      title: exp.description || catInfo.name,
      amount: exp.amount,
      date: dateStr,
      competenceMonth: competence,
      category: exp.category,
      categoryName: catInfo.name,
      categoryEmoji: catInfo.emoji,
      paidBy: exp.paidBy || 'both',
      paidByName: getPaidByLabel(exp.paidBy || 'both'),
      bankName: exp.bankName,
      paymentMethod: exp.paymentMethod,
      origin,
      status: 'confirmed',
      fitid: exp.bankName ? `fitid-exp-${exp.id}` : undefined,
      notes: exp.notes,
      auditDetails: {
        sourceDescription: exp.bankName
          ? `Importado do extrato bancário ${exp.bankName}`
          : 'Lançamento manual registrado no GASTEI',
        linkedEvent,
        linkedEntityId: exp.installmentId || exp.linkedBillId || exp.fundingGoalId,
        isExcludedFromMonthlyBudget: exp.isExcludedFromMonthlyBudget,
        fundingSourceLabel: exp.fundingSource === 'piggy_bank'
          ? 'Caixinha'
          : exp.fundingSource === 'reserve_excess'
          ? 'Reserva'
          : 'Orçamento do Mês',
      },
      rawExpense: exp,
    });
  });

  // 2. Process Incomes (Inflows)
  (state.incomes || []).forEach(inc => {
    if (viewMode === 'partner1' && inc.recipient === 'partner2') return;
    if (viewMode === 'partner2' && inc.recipient === 'partner1') return;

    const dateStr = inc.date || new Date().toISOString().slice(0, 10);
    const competence = dateStr.slice(0, 7);

    // Check if linked to a medical shift
    const linkedShift = (state.medicalShifts || []).find(
      s => s.linkedIncomeId === inc.id || s.id === inc.id
    );

    let origin: StatementItem['origin'] = 'manual';
    if (linkedShift) origin = 'shift_payout';

    let linkedEvent: string | undefined = undefined;
    if (linkedShift) {
      linkedEvent = `Plantão ${linkedShift.hospitalName || 'Médico'} (${linkedShift.dateWorked.split('-').reverse().join('/')})`;
    } else if (inc.type === 'salario') {
      linkedEvent = 'Salário / Pro-labore Regular';
    } else if (inc.type === 'bonus') {
      linkedEvent = 'Bônus / Produção Extra';
    } else if (inc.type === 'restituicao') {
      linkedEvent = 'Restituição / Reembolso';
    }

    items.push({
      id: `stmt-inc-${inc.id}`,
      entityType: 'income',
      entityId: inc.id,
      type: 'income',
      direction: 'inflow',
      title: inc.description || 'Receita',
      amount: inc.amount,
      date: dateStr,
      competenceMonth: competence,
      category: 'receita',
      categoryName: 'Entrada / Receita',
      categoryEmoji: '💰',
      paidBy: inc.recipient || 'both',
      paidByName: getPaidByLabel(inc.recipient || 'both'),
      origin,
      status: 'confirmed',
      notes: undefined,
      auditDetails: {
        sourceDescription: linkedShift
          ? `Pagamento de plantão médico vinculado a ${linkedShift.hospitalName}`
          : 'Lançamento manual de receita no perfil',
        linkedEvent,
        linkedEntityId: linkedShift?.id,
        shiftHospitalName: linkedShift?.hospitalName,
        shiftDate: linkedShift?.dateWorked,
      },
      rawIncome: inc,
    });
  });

  // 3. Process Surplus Transfers / Vasos Comunicantes (Internal Transfers)
  (state.surplusTransfers || []).forEach(tr => {
    const dateStr = tr.date || new Date().toISOString().slice(0, 10);
    const competence = tr.monthKey || dateStr.slice(0, 7);
    const sourceCatInfo = getCategoryInfo(tr.sourceCategory);

    items.push({
      id: `stmt-tr-${tr.id}`,
      entityType: 'surplus_transfer',
      entityId: tr.id,
      type: 'transfer',
      direction: 'internal',
      title: `Vaso Comunicante: ${sourceCatInfo.name} → ${tr.targetGoalName}`,
      amount: tr.amount,
      date: dateStr,
      competenceMonth: competence,
      category: tr.sourceCategory,
      categoryName: `Transferência (${sourceCatInfo.name})`,
      categoryEmoji: '🔄',
      paidBy: 'both',
      paidByName: 'Casal (Em Conjunto)',
      origin: 'surplus_transfer',
      status: 'confirmed',
      notes: tr.note,
      auditDetails: {
        sourceDescription: 'Transferência interna de Nivelamento (Vaso Comunicante)',
        linkedEvent: `Compensação sem culpa: sobra de ${sourceCatInfo.name} direcionada para ${tr.targetGoalName}`,
        linkedEntityId: tr.sourceCategory,
      },
      rawTransfer: tr,
    });
  });

  // Sort by date descending
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
