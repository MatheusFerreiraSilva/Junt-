import React, { useState } from 'react';
import {
  X,
  Shield,
  Target,
  Unlock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';

interface ReallocateReserveExcessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReallocateReserveExcessModal: React.FC<ReallocateReserveExcessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    state,
    emergencyReserveFloorAmount,
    emergencyReserveExcessAmount,
    reallocateReserveExcess,
  } = useFinance();

  const [targetType, setTargetType] = useState<'goal' | 'freedom'>('goal');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    state.piggyBanks.find(g => !g.completed)?.id || (state.piggyBanks[0]?.id ?? '')
  );
  const [amountInput, setAmountInput] = useState<string>('');

  if (!isOpen) return null;

  const numericAmount = parseFloat(amountInput) || 0;
  const maxExcess = emergencyReserveExcessAmount;
  const isExceeding = numericAmount > maxExcess;
  const isValidAmount = numericAmount > 0 && !isExceeding;

  const selectedGoal = state.piggyBanks.find(g => g.id === selectedGoalId);

  const handlePercentageQuick = (pct: number) => {
    const val = Math.round(maxExcess * (pct / 100));
    setAmountInput(val.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;

    reallocateReserveExcess(
      numericAmount,
      targetType,
      targetType === 'goal' ? selectedGoalId : undefined,
      targetType === 'goal' ? selectedGoal?.name : 'Bloco 3 Liberdade'
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold shadow-xs">
              ✨
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-display">
                Realocar Excesso da Reserva
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transfira o excedente da reserva para acelerar objetivos mantendo o piso sagrado blindado.
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
          {/* Reserve Status Callout (Piso vs Excesso) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-100">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Status da Reserva de Proteção</span>
              </span>
              <span className="tabular-nums font-black">
                Total Hoje: {formatCurrency(state.protectionCurrentAmount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  🛡️ Piso Blindado (3 Meses)
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums block mt-0.5">
                  {formatCurrency(emergencyReserveFloorAmount)}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Intocável contra compras
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  🌟 Excesso Disponível
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                  {formatCurrency(maxExcess)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Liberado p/ transferir
                </span>
              </div>
            </div>
          </div>

          {/* Destination Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              1. Para onde desejam transferir o excesso?
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('goal')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  targetType === 'goal'
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-950 dark:text-sky-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Target className="w-4 h-4 text-sky-600" />
                  <span>Cofrinho / Objetivo</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Viagens, Carro, Reforma, Sonhos
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('freedom')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  targetType === 'freedom'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-950 dark:text-amber-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Unlock className="w-4 h-4 text-amber-600" />
                  <span>Bloco 3 Liberdade</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Investimentos de Longo Prazo
                </div>
              </button>
            </div>

            {targetType === 'goal' && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                  Escolha o Cofrinho de destino:
                </label>
                <select
                  value={selectedGoalId}
                  onChange={e => setSelectedGoalId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {state.piggyBanks.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.name} — Atual: {formatCurrency(g.currentAmount)} / Meta: {formatCurrency(g.targetAmount)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Amount Input & Quick Percentage Buttons */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Quanto desejam transferir?
              </label>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Disponível: {formatCurrency(maxExcess)}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-3 text-base font-extrabold text-slate-400">R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border text-base font-black tabular-nums transition-all ${
                  isExceeding
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/40 text-rose-600'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400/40 text-slate-900 dark:text-white'
                }`}
              />
            </div>

            {/* Quick % buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map(pct => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => handlePercentageQuick(pct)}
                  disabled={maxExcess <= 0}
                  className="py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                >
                  {pct}% {pct === 100 ? '(Tudo)' : ''}
                </button>
              ))}
            </div>

            {isExceeding && (
              <div className="text-xs text-rose-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>O valor excede o excesso disponível ({formatCurrency(maxExcess)}). O piso de 3 meses não pode ser violado.</span>
              </div>
            )}
          </div>

          {/* Live Remaining Reserve Feedback */}
          {isValidAmount && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Saldo restante na reserva após realocação:
              </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-black tabular-nums font-display">
                {formatCurrency(state.protectionCurrentAmount - numericAmount)}
              </strong>
            </div>
          )}

          {/* Footer Buttons */}
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
              disabled={!isValidAmount}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all active:scale-95 ${
                isValidAmount
                  ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                  : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Confirmar Transferência</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
