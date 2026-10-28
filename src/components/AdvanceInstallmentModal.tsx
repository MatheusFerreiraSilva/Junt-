import { remainingInstallmentValue } from '../utils/installmentMoney';
import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  Shield,
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Layers,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { InstallmentPurchase, CategoryKey } from '../types/finance';
import { formatCurrency, formatMonthYear, addMonths } from '../utils/formatters';

interface AdvanceInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInstallment?: InstallmentPurchase | null;
}

export const AdvanceInstallmentModal: React.FC<AdvanceInstallmentModalProps> = ({
  isOpen,
  onClose,
  targetInstallment,
}) => {
  const {
    state,
    activeInstallments,
    emergencyReserveFloorAmount,
    emergencyReserveExcessAmount,
    categoriesSpending,
    totalIncome,
    advanceInstallmentPayment,
  } = useFinance();

  // If no specific installment passed, let user pick from active consumption installments
  const [selectedInstId, setSelectedInstId] = useState<string>(
    targetInstallment?.id || (activeInstallments[0]?.id ?? '')
  );

  const currentInst = useMemo(() => {
    if (targetInstallment) return targetInstallment;
    return activeInstallments.find(i => i.id === selectedInstId) || activeInstallments[0] || null;
  }, [targetInstallment, activeInstallments, selectedInstId]);

  const remainingInstallmentsCount = currentInst
    ? Math.max(1, currentInst.installmentsCount - currentInst.paidInstallmentsCount)
    : 1;

  const [installmentsToAdvance, setInstallmentsToAdvance] = useState<number>(1);
  const [fundingMode, setFundingMode] = useState<'reserve' | 'goal' | 'surplus' | 'custom'>('reserve');

  // Funding inputs for custom split
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    state.piggyBanks.find(g => !g.completed && g.currentAmount > 0)?.id || ''
  );
  const [reserveInput, setReserveInput] = useState<string>('');
  const [goalInput, setGoalInput] = useState<string>('');
  const [surplusInput, setSurplusInput] = useState<string>('');

  // Total required
  const totalAdvanceAmount = useMemo(() => {
    if (!currentInst) return 0;
    return remainingInstallmentValue(currentInst, installmentsToAdvance);
  }, [currentInst, installmentsToAdvance]);

  // Available amounts from each source
  const availableReserveExcess = emergencyReserveExcessAmount;
  const availableGoalBalance = useMemo(() => {
    const goal = state.piggyBanks.find(g => g.id === selectedGoalId);
    return goal ? goal.currentAmount : 0;
  }, [state.piggyBanks, selectedGoalId]);
  const availableSurplus = useMemo(() => {
    return Math.max(0, categoriesSpending['lazer']?.remaining || 0);
  }, [categoriesSpending]);

  // Synchronize default amounts when changing mode or installments count
  const allocatedAmounts = useMemo(() => {
    if (fundingMode === 'reserve') {
      const fromReserve = Math.min(totalAdvanceAmount, availableReserveExcess);
      return {
        fromReserve,
        fromGoal: 0,
        fromSurplus: 0,
        total: fromReserve,
      };
    }
    if (fundingMode === 'goal') {
      const fromGoal = Math.min(totalAdvanceAmount, availableGoalBalance);
      return {
        fromReserve: 0,
        fromGoal,
        fromSurplus: 0,
        total: fromGoal,
      };
    }
    if (fundingMode === 'surplus') {
      const fromSurplus = Math.min(totalAdvanceAmount, availableSurplus);
      return {
        fromReserve: 0,
        fromGoal: 0,
        fromSurplus,
        total: fromSurplus,
      };
    }
    // Custom mixed mode
    const fromReserve = parseFloat(reserveInput) || 0;
    const fromGoal = parseFloat(goalInput) || 0;
    const fromSurplus = parseFloat(surplusInput) || 0;
    return {
      fromReserve,
      fromGoal,
      fromSurplus,
      total: fromReserve + fromGoal + fromSurplus,
    };
  }, [
    fundingMode,
    totalAdvanceAmount,
    availableReserveExcess,
    availableGoalBalance,
    availableSurplus,
    reserveInput,
    goalInput,
    surplusInput,
  ]);

  const diffAmount = totalAdvanceAmount - allocatedAmounts.total;
  const isExactCoverage = Math.abs(diffAmount) < 0.01;
  const canConfirm =
    isExactCoverage &&
    totalAdvanceAmount > 0 &&
    allocatedAmounts.fromReserve <= availableReserveExcess &&
    allocatedAmounts.fromGoal <= availableGoalBalance;

  // Impact preview
  const newEndMonth = useMemo(() => {
    if (!currentInst) return '';
    const newRemaining = remainingInstallmentsCount - installmentsToAdvance;
    if (newRemaining <= 0) return 'Quitada neste mês! 🏆';
    return formatMonthYear(addMonths(state.currentMonth, newRemaining));
  }, [currentInst, remainingInstallmentsCount, installmentsToAdvance, state.currentMonth]);

  const handleFillMaxFromAvailable = () => {
    if (fundingMode === 'custom') {
      let needed = totalAdvanceAmount;
      const res = Math.min(needed, availableReserveExcess);
      needed -= res;
      const goal = Math.min(needed, availableGoalBalance);
      needed -= goal;
      const sur = Math.min(needed, availableSurplus);

      setReserveInput(res > 0 ? res.toString() : '');
      setGoalInput(goal > 0 ? goal.toString() : '');
      setSurplusInput(sur > 0 ? sur.toString() : '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInst || !canConfirm) return;

    advanceInstallmentPayment({
      installmentId: currentInst.id,
      installmentsToAdvance,
      totalAdvanceAmount,
      funding: {
        fromProtectionExcess: allocatedAmounts.fromReserve,
        fromGoalId: allocatedAmounts.fromGoal > 0 ? selectedGoalId : undefined,
        fromGoalAmount: allocatedAmounts.fromGoal,
        fromMonthSurplus: allocatedAmounts.fromSurplus,
      },
      note: `Adiantamento de ${installmentsToAdvance}x parcela(s) com fontes customizadas`,
    });

    onClose();
  };

  if (!isOpen || !currentInst) return null;

  const cat = CATEGORIES_BASE[currentInst.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold shadow-xs">
              ⚡
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-display">
                Adiantar Parcelas Inteligente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pague parcelas futuras, libere margem no teto de 20% e elimine dívidas mais rápido.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {/* Target Installment Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{cat.emoji}</span>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                    {currentInst.title}
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {cat.name} · {currentInst.bankName || 'Cartão'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Valor da Parcela:
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white tabular-nums font-display">
                  {formatCurrency(currentInst.installmentAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Pagas: <strong>{currentInst.paidInstallmentsCount}</strong> de <strong>{currentInst.installmentsCount}</strong> parcelas
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                Restam {remainingInstallmentsCount}x de {formatCurrency(currentInst.installmentAmount)}
              </span>
            </div>
          </div>

          {/* STEP 1: Select How Many Installments to Advance */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>1. Quantas parcelas desejam adiantar?</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold normal-case">
                Total: {formatCurrency(totalAdvanceAmount)}
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3].filter(n => n <= remainingInstallmentsCount).map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setInstallmentsToAdvance(num)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    installmentsToAdvance === num
                      ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/40 shadow-sm font-black'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  <span className="text-xs font-bold block">{num}x Parcela{num > 1 ? 's' : ''}</span>
                  <span className="text-[11px] opacity-90 tabular-nums">
                    {formatCurrency(remainingInstallmentValue(currentInst, num))}
                  </span>
                </button>
              ))}

              {/* Pay all remaining button */}
              <button
                type="button"
                onClick={() => setInstallmentsToAdvance(remainingInstallmentsCount)}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  installmentsToAdvance === remainingInstallmentsCount
                    ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/40 shadow-sm font-black'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                }`}
              >
                <span className="text-xs font-bold block">Quitar Todas! 🎉</span>
                <span className="text-[11px] opacity-90 tabular-nums">
                  {remainingInstallmentsCount}x ({formatCurrency(remainingInstallmentValue(currentInst))})
                </span>
              </button>
            </div>
          </div>

          {/* STEP 2: Choose Funding Source */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. De onde desejam debitar esse adiantamento?
              </label>
              {fundingMode === 'custom' && (
                <button
                  type="button"
                  onClick={handleFillMaxFromAvailable}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Preenchimento Automático
                </button>
              )}
            </div>

            {/* Mode selection tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFundingMode('reserve')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fundingMode === 'reserve'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Excesso Reserva</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Disp: {formatCurrency(availableReserveExcess)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFundingMode('goal')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fundingMode === 'goal'
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-950 dark:text-sky-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Target className="w-4 h-4 text-sky-600" />
                  <span>Do Cofrinho X</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Disp: {formatCurrency(availableGoalBalance)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFundingMode('surplus')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fundingMode === 'surplus'
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 text-purple-950 dark:text-purple-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Sobra do Mês</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Disp: {formatCurrency(availableSurplus)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFundingMode('custom')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fundingMode === 'custom'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-950 dark:text-amber-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Misto / Custom</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Dividir entre fontes
                </div>
              </button>
            </div>

            {/* Mode Specific Inputs */}
            {fundingMode === 'reserve' && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Débito do Excesso da Reserva de Emergência</span>
                  </span>
                  <span className="tabular-nums font-black">{formatCurrency(allocatedAmounts.fromReserve)}</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug">
                  🛡️ <strong>Regra Sagrada Atendida:</strong> O piso de 3 meses de despesas (<strong>{formatCurrency(emergencyReserveFloorAmount)}</strong>) continua 100% blindado e intocado. Apenas o excesso acumulado é utilizado para quitar a dívida.
                </p>
                {availableReserveExcess < totalAdvanceAmount && (
                  <div className="text-xs text-rose-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Excesso disponível ({formatCurrency(availableReserveExcess)}) é menor que o valor total ({formatCurrency(totalAdvanceAmount)}). Use o modo Misto / Custom para complementar.</span>
                  </div>
                )}
              </div>
            )}

            {fundingMode === 'goal' && (
              <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-sky-950 dark:text-sky-100 block">
                    Escolha de qual Cofrinho / Objetivo debitar:
                  </label>
                  <select
                    value={selectedGoalId}
                    onChange={e => setSelectedGoalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    {state.piggyBanks.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.emoji} {g.name} — Saldo: {formatCurrency(g.currentAmount)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-200">
                  <span>Valor a descontar deste objetivo:</span>
                  <span className="tabular-nums font-black">{formatCurrency(allocatedAmounts.fromGoal)}</span>
                </div>
                {availableGoalBalance < totalAdvanceAmount && (
                  <div className="text-xs text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Saldo no cofrinho selecionado ({formatCurrency(availableGoalBalance)}) é menor que o total ({formatCurrency(totalAdvanceAmount)}).</span>
                  </div>
                )}
              </div>
            )}

            {fundingMode === 'surplus' && (
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-950 dark:text-purple-100">
                  <span>Débito da Sobra do Mês (Orçamento Livre / Lazer):</span>
                  <span className="tabular-nums font-black">{formatCurrency(allocatedAmounts.fromSurplus)}</span>
                </div>
                <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-snug">
                  Usando a margem livre deste mês para matar dívidas futuras. Ótima escolha para começar o próximo mês mais leve!
                </p>
                {availableSurplus < totalAdvanceAmount && (
                  <div className="text-xs text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Sobra livre de Lazer ({formatCurrency(availableSurplus)}) é menor que o adiantamento ({formatCurrency(totalAdvanceAmount)}).</span>
                  </div>
                )}
              </div>
            )}

            {fundingMode === 'custom' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Personalizem exatamente quanto retirar de cada fonte:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Reserve Excess input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>🛡️ Excesso Reserva</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        Max {formatCurrency(availableReserveExcess)}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={reserveInput}
                        onChange={e => setReserveInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Goal input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>🎯 Do Cofrinho</span>
                      <span className="text-[10px] text-sky-600 font-semibold">
                        Max {formatCurrency(availableGoalBalance)}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={goalInput}
                        onChange={e => setGoalInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Surplus input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>🎮 Sobra Lazer</span>
                      <span className="text-[10px] text-purple-600 font-semibold">
                        Max {formatCurrency(availableSurplus)}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={surplusInput}
                        onChange={e => setSurplusInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {state.piggyBanks.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 font-medium mr-2">Cofrinho de débito:</span>
                    <select
                      value={selectedGoalId}
                      onChange={e => setSelectedGoalId(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      {state.piggyBanks.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.emoji} {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Allocation Balance Status Bar */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
              isExactCoverage
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                : diffAmount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isExactCoverage ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>
                {isExactCoverage
                  ? 'Cobertura exata de 100%! Pronto para adiantar.'
                  : diffAmount > 0
                  ? `Falta alocar ${formatCurrency(diffAmount)} das fontes`
                  : `Valor alocado excede o necessário em ${formatCurrency(Math.abs(diffAmount))}`}
              </span>
            </div>

            <span className="tabular-nums font-black">
              {formatCurrency(allocatedAmounts.total)} / {formatCurrency(totalAdvanceAmount)}
            </span>
          </div>

          {/* STEP 3: Instant Impact Preview */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
              🚀 Impacto Instantâneo no Orçamento do Casal:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    + {formatCurrency(currentInst.installmentAmount)}/mês Liberados
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Margem destravada no teto de 20% do cartão.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    Término Antecipado
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Nova previsão de quitação: {newEndMonth}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canConfirm}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all active:scale-95 ${
                canConfirm
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 cursor-pointer'
                  : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Confirmar Adiantamento ({formatCurrency(totalAdvanceAmount)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
