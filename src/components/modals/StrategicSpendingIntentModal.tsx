import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Shield,
  Target,
  Calendar,
  Check,
  CreditCard,
  Zap,
  Users,
  User,
  Info,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import { CategoryKey, FundingSourceType } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface StrategicSpendingIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CategoryKey;
  defaultSource?: FundingSourceType;
  defaultGoalId?: string;
}

export const StrategicSpendingIntentModal: React.FC<StrategicSpendingIntentModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'moradia',
  defaultSource = 'reserve_excess',
  defaultGoalId,
}) => {
  const {
    state,
    emergencyReserveFloorAmount,
    emergencyReserveExcessAmount,
    addStrategicIntent,
    triggerCelebration,
  } = useFinance();

  const [title, setTitle] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [category, setCategory] = useState<CategoryKey>(defaultCategory);
  const [targetSource, setTargetSource] = useState<FundingSourceType>(defaultSource);
  const [targetGoalId, setTargetGoalId] = useState<string>(defaultGoalId || (state.piggyBanks[0]?.id ?? ''));
  const [assignedTo, setAssignedTo] = useState<'couple' | 'partner1' | 'partner2'>('couple');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'debit' | 'credit' | 'cash'>('pix');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const p1Name = state.profile.partner1Name || 'Parceiro 1';
  const p2Name = state.profile.partner2Name || 'Parceiro 2';
  const selectedGoal = state.piggyBanks.find((g) => g.id === targetGoalId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(estimatedAmount.replace(',', '.'));
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) return;

    addStrategicIntent({
      title: title.trim(),
      estimatedAmount: numAmount,
      category,
      targetSource,
      targetGoalId: targetSource === 'piggy_bank' ? targetGoalId : undefined,
      targetGoalName: targetSource === 'piggy_bank' ? selectedGoal?.name : undefined,
      targetPartner: assignedTo !== 'couple' ? assignedTo : undefined,
      assignedTo,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    triggerCelebration();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[#FAF7F2] dark:bg-[#121316] text-[#111318] dark:text-[#F8FAFC] rounded-t-[32px] sm:rounded-[32px] border border-stone-200/80 dark:border-stone-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intent-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-200/80 dark:border-stone-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#A6D8FF] text-[#111318] text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Alocação Proativa de Recursos
            </div>
            <h2 id="intent-title" className="text-xl sm:text-2xl font-black font-display tracking-tight">
              Intenção de Gasto Estratégico
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Declare a fonte da compra antecipadamente. A margem da categoria no mês continuará 100% livre.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título & Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Título do Gasto Planejado *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Mobília Sala no PIX, Passagem Noronha..."
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm font-semibold text-[#111318] dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#111318] dark:focus:ring-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Valor Estimado (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm font-black text-[#111318] dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#111318] dark:focus:ring-white tabular-nums font-display"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Categoria Relacionada
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map((catKey) => {
                const info = CATEGORIES_BASE[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800 font-black shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-base">{info.emoji}</span>
                    <span className="text-xs text-[#111318] dark:text-white truncate">{info.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* De onde sairá o dinheiro */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>Fonte Pagadora Pretendida *</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                Independente de margem no mês
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Excesso da Reserva */}
              <button
                type="button"
                onClick={() => setTargetSource('reserve_excess')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 flex flex-col justify-between min-h-[92px] ${
                  targetSource === 'reserve_excess'
                    ? 'border-[#111318] dark:border-white bg-[#F0F8FF] dark:bg-sky-950/40 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-[#A6D8FF] text-[#111318] flex items-center justify-center text-sm">
                    🛡️
                  </span>
                  {targetSource === 'reserve_excess' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
                </div>
                <div>
                  <span className="block font-black text-xs text-[#111318] dark:text-white">
                    Excesso da Reserva
                  </span>
                  <span className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold tabular-nums">
                    {formatCurrency(emergencyReserveExcessAmount)} livres
                  </span>
                </div>
              </button>

              {/* Caixinha de Objetivo */}
              <button
                type="button"
                onClick={() => setTargetSource('piggy_bank')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 flex flex-col justify-between min-h-[92px] ${
                  targetSource === 'piggy_bank'
                    ? 'border-[#111318] dark:border-white bg-[#FFF0F7] dark:bg-pink-950/40 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-[#FFC2E2] text-[#111318] flex items-center justify-center text-sm">
                    🎯
                  </span>
                  {targetSource === 'piggy_bank' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
                </div>
                <div>
                  <span className="block font-black text-xs text-[#111318] dark:text-white">
                    Caixinha de Sonhos
                  </span>
                  <span className="text-[10px] text-pink-700 dark:text-pink-300 font-semibold">
                    Cofrinho específico
                  </span>
                </div>
              </button>

              {/* Orçamento do Mês */}
              <button
                type="button"
                onClick={() => setTargetSource('month_budget')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 flex flex-col justify-between min-h-[92px] ${
                  targetSource === 'month_budget'
                    ? 'border-[#111318] dark:border-white bg-[#FFF9ED] dark:bg-amber-950/40 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-[#FFC875] text-[#111318] flex items-center justify-center text-sm">
                    📅
                  </span>
                  {targetSource === 'month_budget' && <Check className="w-4 h-4 text-[#111318] dark:text-white" />}
                </div>
                <div>
                  <span className="block font-black text-xs text-[#111318] dark:text-white">
                    Orçamento do Mês
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                    Rotina mensal da casa
                  </span>
                </div>
              </button>
            </div>

            {/* Sub-selector for Caixinha if selected */}
            {targetSource === 'piggy_bank' && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 animate-in fade-in">
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Vincular a qual Caixinha?
                </label>
                {state.piggyBanks.length === 0 ? (
                  <p className="text-xs text-amber-600">Nenhum cofrinho criado ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {state.piggyBanks.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setTargetGoalId(g.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          targetGoalId === g.id
                            ? 'border-[#111318] dark:border-white bg-[#FAF7F2] dark:bg-stone-800 font-bold'
                            : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{g.emoji}</span>
                          <div className="min-w-0">
                            <span className="text-xs truncate block">{g.name}</span>
                            <span className="text-[10px] text-stone-500 tabular-nums">
                              {formatCurrency(g.currentAmount)}
                            </span>
                          </div>
                        </div>
                        {targetGoalId === g.id && <Check className="w-3.5 h-3.5 text-[#111318] dark:text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* De quem é & Forma de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                De quem é este gasto?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAssignedTo('couple')}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                    assignedTo === 'couple'
                      ? 'border-[#111318] dark:border-white bg-[#111318] text-white dark:bg-white dark:text-[#111318]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  Casal 50/50
                </button>
                <button
                  type="button"
                  onClick={() => setAssignedTo('partner1')}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer truncate ${
                    assignedTo === 'partner1'
                      ? 'border-[#111318] dark:border-white bg-[#111318] text-white dark:bg-white dark:text-[#111318]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {p1Name}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignedTo('partner2')}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer truncate ${
                    assignedTo === 'partner2'
                      ? 'border-[#111318] dark:border-white bg-[#111318] text-white dark:bg-white dark:text-[#111318]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {p2Name}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Forma de Pagamento Prevista
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    paymentMethod !== 'credit'
                      ? 'border-[#111318] dark:border-white bg-[#111318] text-white dark:bg-white dark:text-[#111318]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  PIX / À Vista
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'credit'
                      ? 'border-[#111318] dark:border-white bg-[#111318] text-white dark:bg-white dark:text-[#111318]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Cartão
                </button>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Já combinado com a loja para entrega sábado."
              className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-[#111318] dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#111318]"
            />
          </div>

          {/* Soft reassurance card */}
          <div className="p-3.5 rounded-2xl bg-[#D8C7FF]/25 border border-[#D8C7FF] text-[#111318] dark:text-[#F8FAFC] text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Reconciliação Automática:</strong> Assim que a compra for debitada no banco conectado via Pluggy ou registrada no PIX, o Juntô vinculará automaticamente esta intenção e blindará a categoria correspondente de falsos estouros.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200/80 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-[#111318] hover:bg-black text-white dark:bg-white dark:hover:bg-stone-100 dark:text-[#111318] text-xs font-black tracking-wide shadow-md hover:scale-[1.02] active:scale-98 transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Salvar Intenção Estratégica
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
