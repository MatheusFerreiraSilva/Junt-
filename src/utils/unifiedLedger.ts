import {
  AppState,
  CategoryKey,
  PaidBy,
  ExpenseItem,
  IncomeItem,
  SurplusTransferRecord,
  FinancialOperationRecord,
} from '../types/finance';
import { getCategoryInfo } from '../context/FinanceContext';

export type StatementType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'investment_deposit'
  | 'investment_withdrawal'
  | 'reconciliation_adjustment'
  | 'valuation_adjustment'
  | 'initial_position'
  | 'block_transfer';

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
  operationId?: string;
  costBasisR$?: number;
  realizedGainR$?: number;
  grossAmountR$?: number;
  netAmountR$?: number;
  differenceToReviewR$?: number;
  withdrawalChannel?: 'virtual_reallocation' | 'asset_redemption';
  settlementStatus?: FinancialOperationRecord['settlementStatus'];
  bankTransactionId?: string;
  planningDivergenceR$?: number;
}

export interface StatementItem {
  id: string; // unique ledger statement ID
  entityType: 'expense' | 'income' | 'surplus_transfer' | 'shift_payout' | 'financial_operation';
  entityId: string; // canonical entity ID
  operationId?: string;
  operationType?: FinancialOperationRecord['type'];
  valuationDirection?: 'gain' | 'loss';
  costBasisR$?: number;
  realizedGainR$?: number;
  grossAmountR$?: number;
  netAmountR$?: number;
  differenceToReviewR$?: number;
  withdrawalChannel?: 'virtual_reallocation' | 'asset_redemption';
  settlementStatus?: FinancialOperationRecord['settlementStatus'];
  bankTransactionId?: string;
  planningDivergenceR$?: number;
  type: StatementType;
  direction: StatementDirection;
  title: string;
  amount: number; // exact amount in R$ (signed for valuation adjustments)
  date: string; // YYYY-MM-DD
  competenceMonth: string; // YYYY-MM
  category?: CategoryKey | string;
  categoryName: string;
  categoryEmoji: string;
  paidBy: PaidBy;
  paidByName: string;
  bankName?: string;
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  origin:
    | 'manual'
    | 'pluggy_import'
    | 'ofx_import'
    | 'shift_payout'
    | 'installment'
    | 'fixed_bill'
    | 'surplus_transfer'
    | 'patrimonial_command'
    | 'monthly_guide';
  status: 'confirmed' | 'pending' | 'reconciled' | 'reverted';
  fitid?: string;
  notes?: string;
  auditDetails: StatementAuditDetails;
  rawExpense?: ExpenseItem;
  rawIncome?: IncomeItem;
  rawTransfer?: SurplusTransferRecord;
  rawOperation?: FinancialOperationRecord;
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

  const expenseOperationIds = new Set<string>();
  const surplusIdsFromOps = new Set<string>();

  // 1. Process Expenses (Outflows)
  (state.expenses || []).forEach((exp) => {
    if (exp.operationId) expenseOperationIds.add(exp.operationId);
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
      operationId: exp.operationId,
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
        fundingSourceLabel:
          exp.fundingSource === 'piggy_bank'
            ? 'Caixinha'
            : exp.fundingSource === 'reserve_excess'
            ? 'Reserva'
            : 'Orçamento do Mês',
        operationId: exp.operationId,
      },
      rawExpense: exp,
    });
  });

  // 2. Process Incomes (Inflows)
  (state.incomes || []).forEach((inc) => {
    if (viewMode === 'partner1' && inc.recipient === 'partner2') return;
    if (viewMode === 'partner2' && inc.recipient === 'partner1') return;

    const dateStr = inc.date || new Date().toISOString().slice(0, 10);
    const competence = dateStr.slice(0, 7);

    const linkedShift = (state.medicalShifts || []).find(
      (s) => s.linkedIncomeId === inc.id || s.id === inc.id
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

  // 3. Process Patrimonial Financial Operations (single operationId across Hub, Investimentos, and Extrato)
  const formatAssetName = (ref?: FinancialOperationRecord['sourceRef'] | FinancialOperationRecord['targetRef']) => {
    if (!ref) return 'Ativo';
    if (ref.name) return ref.name;
    if (ref.type === 'protection' || ref.type === 'reserve') return 'Proteção (Reserva)';
    if (ref.type === 'freedom') return 'Liberdade Financeira';
    if (ref.type === 'piggy_bank') {
      return (
        state.piggyBanks?.find((p) => p.id === ref.id)?.name ||
        state.coupleGoals?.find((g) => g.id === ref.id)?.title ||
        ref.id
      );
    }
    return ref.id;
  };

  (state.financialOperations || []).forEach((op) => {
    if (op.surplusTransferId) surplusIdsFromOps.add(op.surplusTransferId);
    // Avoid duplicating expense-linked operations (already projected with op.operationId on expense item)
    if (op.expenseId || expenseOperationIds.has(op.id)) return;
    if (op.type === 'EXPENSE_RECORD' || op.type === 'INCOME_RECORD') return;

    const opScope = op.scope || 'couple';
    if (viewMode === 'partner1' && opScope === 'partner2') return;
    if (viewMode === 'partner2' && opScope === 'partner1') return;

    const dateStr = op.date || new Date().toISOString().slice(0, 10);
    const competence = op.competence || dateStr.slice(0, 7);
    const absAmountR$ = op.amountR$ ?? op.amountCents / 100;
    const isReverted = op.state === 'reverted' || op.state === 'estornado';
    const isReconciled = op.state === 'reconciled';
    const isPending =
      op.state === 'planned' ||
      op.state === 'pending_settlement' ||
      op.settlementStatus === 'planned' ||
      op.settlementStatus === 'pending_settlement';
    const status: StatementItem['status'] = isReverted
      ? 'reverted'
      : isPending
      ? 'pending'
      : isReconciled
      ? 'reconciled'
      : 'confirmed';

    const paidBy: PaidBy =
      op.authorizedBy === 'partner1'
        ? 'partner1'
        : op.authorizedBy === 'partner2'
        ? 'partner2'
        : 'both';

    let stmtType: StatementType = 'transfer';
    let direction: StatementDirection = 'internal';
    let title = op.notes || 'Operação Patrimonial';
    let categoryEmoji = '💎';
    let categoryName = 'Patrimônio';
    let amount = absAmountR$;

    const grossAmountR$ = op.grossAmountCents !== undefined ? op.grossAmountCents / 100 : undefined;
    const netAmountR$ = op.netAmountCents !== undefined ? op.netAmountCents / 100 : undefined;
    const differenceToReviewR$ =
      op.differenceToReviewCents !== undefined && op.differenceToReviewCents > 0
        ? op.differenceToReviewCents / 100
        : undefined;
    const planningDivergenceR$ =
      op.planningDivergenceCents !== undefined && op.planningDivergenceCents > 0
        ? op.planningDivergenceCents / 100
        : undefined;

    if (op.type === 'GOAL_DEPOSIT') {
      stmtType = 'investment_deposit';
      direction = 'internal';
      title = `Aporte → ${formatAssetName(op.targetRef)}`;
      categoryEmoji = op.guideMonthKey ? '📅' : '📥';
      categoryName = op.isExtraAporte ? 'Aporte Extra' : op.guideMonthKey ? 'Guia Mensal de Aportes' : 'Aporte Patrimonial';
    } else if (op.type === 'GOAL_WITHDRAWAL') {
      stmtType = 'investment_withdrawal';
      direction = 'internal';
      const channelTag =
        op.withdrawalChannel === 'virtual_reallocation'
          ? '[Realocação Virtual]'
          : op.withdrawalChannel === 'asset_redemption'
          ? '[Resgate Real]'
          : '';
      const stageTag = isPending ? '[Em liquidação]' : planningDivergenceR$ ? '[Divergência]' : '';
      title = `${[stageTag, channelTag].filter(Boolean).join(' ')} Resgate ← ${formatAssetName(op.sourceRef)}`.trim();
      categoryEmoji = isPending ? '⏳' : op.withdrawalChannel === 'virtual_reallocation' ? '🔀' : '📤';
      categoryName =
        op.withdrawalChannel === 'virtual_reallocation'
          ? 'Realocação Virtual (Sem Caixa Bancário)'
          : 'Resgate de Ativo (Sem Renda Nova)';
      if (netAmountR$ !== undefined) {
        amount = netAmountR$;
      }
    } else if (op.type === 'GOAL_TRANSFER' || op.type === 'BLOCK_TRANSFER') {
      stmtType = 'block_transfer';
      direction = 'internal';
      title = `Transferência: ${formatAssetName(op.sourceRef)} → ${formatAssetName(op.targetRef)}`;
      categoryEmoji = '🔁';
      categoryName = 'Transferência entre Blocos';
    } else if (op.type === 'INITIAL_POSITION') {
      stmtType = 'initial_position';
      direction = 'internal';
      title = `Posição Inicial: ${formatAssetName(op.targetRef)}`;
      categoryEmoji = '🏛️';
      categoryName = 'Posição Inicial (Sem Fluxo de Caixa)';
    } else if (op.type === 'VALUATION_ADJUSTMENT') {
      stmtType = 'valuation_adjustment';
      direction = 'internal';
      const signedCents = op.signedDeltaCents ?? (op.valuationDirection === 'loss' ? -op.amountCents : op.amountCents);
      amount = signedCents / 100;
      title = `${amount < 0 ? 'Variação Negativa' : 'Rendimento'}: ${formatAssetName(op.targetRef)}`;
      categoryEmoji = amount < 0 ? '📉' : '📈';
      categoryName = 'Ajuste de Avaliação / Rendimento';
    } else if (op.type === 'GOAL_DIRECT_PURCHASE') {
      stmtType = 'investment_withdrawal';
      direction = 'outflow';
      title = `Compra Direta: ${formatAssetName(op.sourceRef)} → ${formatAssetName(op.targetRef)}`;
      categoryEmoji = '🎯';
      categoryName = 'Compra Direta de Objetivo';
    } else if (op.type === 'CATEGORY_REINFORCEMENT') {
      stmtType = 'transfer';
      direction = 'internal';
      const targetCatInfo = op.targetRef?.id ? getCategoryInfo(op.targetRef.id) : undefined;
      const targetCatLabel = targetCatInfo?.name || op.targetRef?.name || op.targetRef?.id || 'Categoria';
      const evidenceTag = isReconciled ? '[Conciliado]' : op.sourceOperationId ? '[Manual]' : '[Cofrinho]';
      title = `${evidenceTag} Reforço em ${targetCatLabel} (${competence}) ← ${formatAssetName(op.sourceRef)}`;
      categoryEmoji = '🟦';
      categoryName = `Reforço Temporário (${targetCatLabel})`;
    } else if (op.type === 'CATEGORY_REALLOCATION') {
      stmtType = 'transfer';
      direction = 'internal';
      const fromLabel = op.sourceRef?.id ? getCategoryInfo(op.sourceRef.id).name : (op.sourceRef?.name || 'Origem');
      const toLabel = op.targetRef?.id ? getCategoryInfo(op.targetRef.id).name : (op.targetRef?.name || 'Destino');
      title = `Realocação de Orçamento (${competence}): ${fromLabel} → ${toLabel}`;
      categoryEmoji = '⚖️';
      categoryName = 'Realocação entre Categorias';
    }

    const costBasisR$ = op.costBasisCents !== undefined ? op.costBasisCents / 100 : undefined;
    const realizedGainR$ = op.realizedGainCents !== undefined ? op.realizedGainCents / 100 : undefined;
    const destAccName = op.destinationAccountId
      ? (state.linkedAccounts || []).find(
          (a) => a.id === op.destinationAccountId || a.canonicalAccountId === op.destinationAccountId
        )?.bankName ||
        (state.pluggyAccounts || []).find(
          (p) => p.id === op.destinationAccountId || p.canonicalAccountId === op.destinationAccountId
        )?.bankName ||
        op.destinationAccountId
      : undefined;

    items.push({
      id: `stmt-op-${op.id}`,
      entityType: 'financial_operation',
      entityId: op.id,
      operationId: op.id,
      operationType: op.type,
      valuationDirection: op.valuationDirection,
      costBasisR$,
      realizedGainR$,
      grossAmountR$,
      netAmountR$,
      differenceToReviewR$,
      withdrawalChannel: op.withdrawalChannel,
      settlementStatus: op.settlementStatus,
      bankTransactionId: op.bankTransactionId,
      planningDivergenceR$,
      type: stmtType,
      direction,
      title: isReverted ? `[ESTORNADO] ${title}` : title,
      amount,
      date: dateStr,
      competenceMonth: competence,
      category:
        op.type === 'CATEGORY_REINFORCEMENT' || op.type === 'CATEGORY_REALLOCATION'
          ? op.targetRef?.id || 'investimentos'
          : 'investimentos',
      categoryName,
      categoryEmoji,
      paidBy,
      paidByName: getPaidByLabel(paidBy),
      bankName: destAccName,
      origin: op.guideMonthKey ? 'monthly_guide' : 'patrimonial_command',
      status,
      fitid: op.reconciliationRef,
      notes: op.notes,
      auditDetails: {
        sourceDescription:
          op.type === 'VALUATION_ADJUSTMENT'
            ? 'Ajuste de avaliação de mercado (não é aporte, gasto nem renda)'
            : op.type === 'INITIAL_POSITION'
            ? 'Saldo de abertura patrimonial (não altera renda nem aporte do mês)'
            : op.type === 'CATEGORY_REINFORCEMENT'
            ? isReconciled
              ? `Reforço temporário de categoria com resgate conciliado em banco (competência ${competence}, sem inflar renda)`
              : `Reforço temporário de categoria declarado/manual para ${competence} (sem inflar renda ou % base)`
            : op.type === 'CATEGORY_REALLOCATION'
            ? `Realocação interna de teto entre categorias na competência ${competence} (sem gerar despesa negativa)`
            : op.type === 'GOAL_WITHDRAWAL'
            ? isPending
              ? 'Solicitação/resgate em liquidação (ainda não libera caixa operacional)'
              : op.withdrawalChannel === 'virtual_reallocation'
              ? 'Realocação virtual de finalidade (sem entrada bancária nem renda nova)'
              : 'Resgate de ativo financeiro (não infla renda do mês)'
            : `Comando rastreável (${op.id})`,
        linkedEvent: op.notes || (op.sourceOperationId ? `Vinculado ao resgate ${op.sourceOperationId}` : undefined),
        linkedEntityId: op.targetRef?.id || op.sourceRef?.id,
        operationId: op.id,
        costBasisR$,
        realizedGainR$,
        grossAmountR$,
        netAmountR$,
        differenceToReviewR$,
        withdrawalChannel: op.withdrawalChannel,
        settlementStatus: op.settlementStatus,
        bankTransactionId: op.bankTransactionId,
        planningDivergenceR$,
      },
      rawOperation: op,
    });
  });

  // 4. Process Surplus Transfers / Vasos Comunicantes (Internal Transfers)
  (state.surplusTransfers || []).forEach((tr) => {
    if (surplusIdsFromOps.has(tr.id)) return;
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
