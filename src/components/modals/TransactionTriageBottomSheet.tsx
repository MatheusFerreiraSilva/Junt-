import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Shield,
  Target,
  Calendar,
  Wallet,
  Users,
  User,
  CreditCard,
  Zap,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import { ExpenseItem, FundingSourceType } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface TransactionTriageBottomSheetProps {
  isOpen: boolean;
  expense: ExpenseItem | null;
  onClose: () => void;
}

export const TransactionTriageBottomSheet: React.FC<TransactionTriageBottomSheetProps> = ({
  isOpen,
  expense,
  onClose,
}) => {
  const {
    state,
    emergencyReserveFloorAmount,
    emergencyReserveExcessAmount,
    updateExpenseTriage,
    triggerCelebration,
  } = useFinance();

  const [assignedTo, setAssignedTo] = useState<'couple' | 'partner1' | 'partner2'>('couple');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'debit' | 'credit' | 'cash'>('pix');
  const [fundingSource, setFundingSource] = useState<FundingSourceType>('month_budget');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  const p1Name = state.profile.partner1Name || 'Parceiro 1';
  const p2Name = state.profile.partner2Name || 'Parceiro 2';

  // Initialize from expense data when opened
  useEffect(() => {
    if (expense) {
      if (expense.assignedTo) {
        setAssignedTo(expense.assignedTo);
      } else if (expense.paidBy === 'partner1') {
        setAssignedTo('partner1');
      } else if (expense.paidBy === 'partner2') {
        setAssignedTo('partner2');
      } else {
        setAssignedTo('couple');
      }

      setPaymentMethod(expense.paymentMethod || (expense.installmentId ? 'credit' : 'pix'));
      setFundingSource(expense.fundingSource || 'month_budget');
      setSelectedGoalId(expense.fundingGoalId || (state.piggyBanks[0]?.id ?? ''));
    }
  }, [expense, state.piggyBanks]);

  if (!isOpen || !expense) return null;

  const catInfo = CATEGORIES_BASE[expense.category];
  const selectedGoal = state.piggyBanks.find((g) => g.id === selectedGoalId);

  const handleSave = () => {
    const isExcluded = fundingSource !== 'month_budget';
    updateExpenseTriage(expense.id, {
      assignedTo,
      paymentMethod,
      fundingSource,
      fundingGoalId: fundingSource === 'piggy_bank' ? selectedGoalId : undefined,
      fundingGoalName: fundingSource === 'piggy_bank' ? selectedGoal?.name : undefined,
      isExcludedFromMonthlyBudget: isExcluded,
    });
    triggerCelebration();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#FAF7F2] dark:bg-[#121316] text-[#111318] dark:text-[#F8FAFC] rounded-t-[32px] sm:rounded-[32px] border border-stone-200/80 dark:border-stone-800 shadow-2xl p-6 sm:p-7 space-y-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="triage-title"
      >
        {/* Header with pill drag indicator for mobile */}
        <div className="space-y-3">
          <div className="w-12 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D8C7FF] text-[#111318] text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Triagem Inteligente Omnipresente
              </div>
              <h2 id="triage-title" className="text-xl sm:text-2xl font-black font-display tracking-tight">
                Origem & Fonte do Gasto
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors cursor-pointer shrink-0"
              aria-label="Fechar triagem"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current transaction summary card */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#F8F4EC] dark:bg-stone-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                {catInfo?.emoji || '🏷️'}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-[#111318] dark:text-white truncate">
                  {expense.description}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {catInfo?.name || 'Gasto'} · {expense.date}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 pl-2">
              <span className="text-base font-black text-rose-600 dark:text-rose-400 font-display tabular-nums">
                {formatCurrency(expense.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PERGUNTA 1: DE QUEM É ESTE GASTO?                                         */}
        {/* ========================================================================= */}
        <div className="space-y-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#111318] text-white flex items-center justify-center text-[11px] font-black">
              1
            </span>
            De quem é este gasto?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Casal 50/50 */}
            <button
              type="button"
              onClick={() => setAssignedTo('couple')}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[78px] ${
                assignedTo === 'couple'
                  ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800/90 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Users className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                {assignedTo === 'couple' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <div>
                <span className="block font-black text-xs text-[#111318] dark:text-white">
                  Do Casal
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  50/50 · Pote Único
                </span>
              </div>
            </button>

            {/* Partner 1 */}
            <button
              type="button"
              onClick={() => setAssignedTo('partner1')}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[78px] ${
                assignedTo === 'partner1'
                  ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800/90 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                {assignedTo === 'partner1' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <div>
                <span className="block font-black text-xs text-[#111318] dark:text-white truncate">
                  {p1Name}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  Pessoal (100%)
                </span>
              </div>
            </button>

            {/* Partner 2 */}
            <button
              type="button"
              onClick={() => setAssignedTo('partner2')}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[78px] ${
                assignedTo === 'partner2'
                  ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800/90 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <User className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                {assignedTo === 'partner2' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <div>
                <span className="block font-black text-xs text-[#111318] dark:text-white truncate">
                  {p2Name}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  Pessoal (100%)
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PERGUNTA 2: QUAL É A FORMA DE PAGAMENTO?                                  */}
        {/* ========================================================================= */}
        <div className="space-y-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#111318] text-white flex items-center justify-center text-[11px] font-black">
              2
            </span>
            Qual é a Forma de Pagamento?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('pix')}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                paymentMethod !== 'credit'
                  ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#B8E0B0] text-[#111318] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-black text-xs text-[#111318] dark:text-white">
                  À Vista / PIX / Débito
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  Sai na hora da conta
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('credit')}
              className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                paymentMethod === 'credit'
                  ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#FFC875] text-[#111318] flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-black text-xs text-[#111318] dark:text-white">
                  Cartão de Crédito
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  Fatura / Parcelado
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PERGUNTA 3: DE ONDE SAI O DINHEIRO DESTE GASTO?                           */}
        {/* ========================================================================= */}
        <div className="space-y-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#111318] text-white flex items-center justify-center text-[11px] font-black">
                3
              </span>
              De onde sai o dinheiro deste gasto?
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              Autonomia sem limiar
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Opção A: Orçamento do Mês */}
            <button
              type="button"
              onClick={() => setFundingSource('month_budget')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                fundingSource === 'month_budget'
                  ? 'border-[#111318] dark:border-white bg-[#FFF9ED] dark:bg-stone-800 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-sm">
                    📅
                  </span>
                  <span className="font-black text-xs text-[#111318] dark:text-white">
                    Orçamento do Mês
                  </span>
                </div>
                {fundingSource === 'month_budget' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Rotina diária da casa (moradia, comida, contas do mês).
              </p>
            </button>

            {/* Opção B: Excesso da Reserva */}
            <button
              type="button"
              onClick={() => setFundingSource('reserve_excess')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                fundingSource === 'reserve_excess'
                  ? 'border-[#111318] dark:border-white bg-[#F0F8FF] dark:bg-sky-950/40 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#A6D8FF] text-[#111318] flex items-center justify-center text-sm">
                    🛡️
                  </span>
                  <span className="font-black text-xs text-[#111318] dark:text-white">
                    Excesso da Reserva
                  </span>
                </div>
                {fundingSource === 'reserve_excess' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Disponível acima de 3 meses sagrados ({formatCurrency(emergencyReserveExcessAmount)} livres).
              </p>
            </button>

            {/* Opção C: Caixinha / Cofrinho */}
            <button
              type="button"
              onClick={() => setFundingSource('piggy_bank')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                fundingSource === 'piggy_bank'
                  ? 'border-[#111318] dark:border-white bg-[#FFF0F7] dark:bg-pink-950/40 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#FFC2E2] text-[#111318] flex items-center justify-center text-sm">
                    🎯
                  </span>
                  <span className="font-black text-xs text-[#111318] dark:text-white">
                    Caixinha de Objetivo
                  </span>
                </div>
                {fundingSource === 'piggy_bank' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Paga por cofrinho específico guardado previamente.
              </p>
            </button>

            {/* Opção D: Mesada Individual */}
            <button
              type="button"
              onClick={() => setFundingSource('personal_allowance')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                fundingSource === 'personal_allowance'
                  ? 'border-[#111318] dark:border-white bg-[#F6F2FF] dark:bg-purple-950/40 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#D8C7FF] text-[#111318] flex items-center justify-center text-sm">
                    💼
                  </span>
                  <span className="font-black text-xs text-[#111318] dark:text-white">
                    Mesada Individual
                  </span>
                </div>
                {fundingSource === 'personal_allowance' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Não afeta o pote único do casal nem o orçamento mensal.
              </p>
            </button>
          </div>

          {/* Sub-selection for Caixinha if piggy_bank selected */}
          {fundingSource === 'piggy_bank' && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 animate-in fade-in">
              <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 dark:text-stone-400">
                Escolha a Caixinha Pagadora:
              </label>
              {state.piggyBanks.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhuma caixinha cadastrada ainda. Crie uma na aba Caixinhas!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.piggyBanks.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGoalId(g.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedGoalId === g.id
                          ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800 font-bold'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{g.emoji}</span>
                        <div className="min-w-0">
                          <span className="text-xs truncate block">{g.name}</span>
                          <span className="text-[10px] text-stone-500 tabular-nums">
                            Saldo: {formatCurrency(g.currentAmount)}
                          </span>
                        </div>
                      </div>
                      {selectedGoalId === g.id && <Check className="w-3.5 h-3.5 text-[#111318] dark:text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* IMPACT BANNER (PRESERVAÇÃO DO ORÇAMENTO DA CATEGORIA)                      */}
        {/* ========================================================================= */}
        <div
          className={`p-4 rounded-2xl border text-xs space-y-1 transition-all ${
            fundingSource !== 'month_budget'
              ? 'bg-[#F3FAF1] dark:bg-emerald-950/40 border-[#B8E0B0] dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
          }`}
        >
          <div className="flex items-center gap-2 font-black">
            {fundingSource !== 'month_budget' ? (
              <>
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Blindagem Orçamentária Ativada</span>
              </>
            ) : (
              <>
                <Info className="w-4 h-4 text-stone-500" />
                <span>Alocação no Orçamento da Rotina</span>
              </>
            )}
          </div>
          <p className="text-[11px] leading-relaxed">
            {fundingSource === 'reserve_excess'
              ? `Este gasto de ${formatCurrency(expense.amount)} sairá do Excesso da Reserva. A margem da categoria ${catInfo?.name} no mês permanece 100% intocada para o dia a dia da casa!`
              : fundingSource === 'piggy_bank'
              ? `O valor de ${formatCurrency(expense.amount)} será debitado do cofrinho "${selectedGoal?.name || 'Objetivo'}". A margem mensal de ${catInfo?.name} não é reduzida!`
              : fundingSource === 'personal_allowance'
              ? `Gasto 100% pessoal de ${assignedTo === 'partner1' ? p1Name : p2Name}. Não consome o teto compartilhado do casal.`
              : `Este gasto consumirá normalmente o saldo mensal de ${catInfo?.name}.`}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* CONFIRMATION ACTION BUTTON                                                */}
        {/* ========================================================================= */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200/80 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-3 rounded-2xl bg-[#111318] hover:bg-black text-white dark:bg-white dark:hover:bg-stone-100 dark:text-[#111318] text-xs font-black tracking-wide shadow-md hover:scale-[1.02] active:scale-98 transition-all cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirmar Triagem
          </button>
        </div>
      </div>
    </div>
  );
};
