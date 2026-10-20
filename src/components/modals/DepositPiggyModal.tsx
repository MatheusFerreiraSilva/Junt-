import React, { useState } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { SavingsPiggyBank } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface DepositPiggyModalProps {
  isOpen: boolean;
  onClose: () => void;
  bank: SavingsPiggyBank | null;
}

export const DepositPiggyModal: React.FC<DepositPiggyModalProps> = ({ isOpen, onClose, bank }) => {
  const { depositToPiggyBank, withdrawFromPiggyBank } = useFinance();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');

  if (!isOpen || !bank) return null;

  const quickVals = [100, 200, 500, 1000, 1500];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(',', '.'));
    if (!val || val <= 0) return;

    if (mode === 'deposit') {
      depositToPiggyBank(bank.id, val);
    } else {
      withdrawFromPiggyBank(bank.id, val);
    }
    setAmount('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{bank.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">{bank.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Guardado até agora: {formatCurrency(bank.currentAmount)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setMode('deposit')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'deposit'
                  ? 'bg-accent-surface text-accent-themed border border-accent-themed shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              🌱 Guardar Dinheiro
            </button>
            <button
              type="button"
              onClick={() => setMode('withdraw')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'withdraw'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              💸 Retirar do Cofrinho
            </button>
          </div>

          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {mode === 'deposit' ? 'Quanto vocês querem guardar agora?' : 'Quanto vocês precisam retirar?'}
            </label>
            <div className="relative max-w-xs mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 dark:text-slate-500">R$</span>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full pl-14 pr-4 py-3.5 text-2xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:outline-none focus:border-accent-primary focus:bg-white dark:focus:bg-slate-800/90 transition-all tabular-nums"
              />
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {quickVals.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-surface hover:text-accent-themed text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
            {mode === 'deposit' ? (
              <>
                Meta do cofrinho: <strong>{formatCurrency(bank.targetAmount)}</strong>. Falta{' '}
                <strong className="text-accent-themed font-bold">
                  {formatCurrency(
                    Math.max(
                      0,
                      bank.targetAmount - (bank.currentAmount + (parseFloat(amount.replace(',', '.')) || 0))
                    )
                  )}
                </strong>
                .
              </>
            ) : (
              <>
                Saldo restante ficará em:{' '}
                <strong className="text-slate-900 dark:text-white font-bold">
                  {formatCurrency(
                    Math.max(0, bank.currentAmount - (parseFloat(amount.replace(',', '.')) || 0))
                  )}
                </strong>
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                mode === 'deposit'
                  ? 'btn-primary-accent shadow-black/10'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              <Check className="w-4 h-4" />
              {mode === 'deposit' ? 'Guardar no Cofrinho' : 'Confirmar Retirada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
