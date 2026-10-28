import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { PaidBy } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({ isOpen, onClose, defaultDate }) => {
  const { state, addIncome, triggerCelebration } = useFinance();
  const [step, setStep] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<PaidBy>('partner1');
  const [incomeType, setIncomeType] = useState<'salario' | 'bonus' | 'extra' | 'restituicao' | 'outro'>('salario');
  const [description, setDescription] = useState<string>('');
  const [successCelebration, setSuccessCelebration] = useState(false);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const quickIncomeTypes = [
    { key: 'salario', label: 'Salário Mensal', emoji: '💼' },
    { key: 'bonus', label: 'Bônus / PLR', emoji: '🎁' },
    { key: 'extra', label: 'Trabalho Extra / Freela', emoji: '⚡' },
    { key: 'restituicao', label: 'Restituição / Reembolso', emoji: '🏛️' },
    { key: 'outro', label: 'Outro Ganho', emoji: '✨' },
  ] as const;

  const handleNext = () => {
    if (step === 1) {
      const val = parseFloat(amount.replace(',', '.'));
      if (!val || val <= 0) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleSave();
    }
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    const typeObj = quickIncomeTypes.find(t => t.key === incomeType);
    const partnerName =
      recipient === 'partner1'
        ? state.profile.partner1Name
        : recipient === 'partner2'
        ? state.profile.partner2Name
        : 'Casal';

    const finalDesc = description.trim() || `${typeObj?.label || 'Entrada'} (${partnerName})`;
    const today = defaultDate || new Date().toISOString().split('T')[0];

    addIncome({
      description: finalDesc,
      amount: numAmount,
      date: today,
      recipient,
      type: incomeType,
    });

    setSuccessCelebration(true);
    triggerCelebration();

    setTimeout(() => {
      setSuccessCelebration(false);
      setStep(1);
      setAmount('');
      setDescription('');
      onClose();
    }, 1200);
  };

  const handleClose = () => {
    setStep(1);
    setAmount('');
    setDescription('');
    onClose();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Registrar receita" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
              💰
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                Registrar Entrada
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Passo {step} de 3</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-center">
          {successCelebration ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-surface text-accent-primary flex items-center justify-center mb-4">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">Entrada Registrada!</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-xs">
                {formatCurrency(parseFloat(amount.replace(',', '.')) || 0)} somados ao orçamento do casal!
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-accent-themed bg-accent-surface px-3 py-1.5 rounded-full border border-accent-themed">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                Mais tranquilidade para o mês do casal
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Quanto entrou? */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Passo 1</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Quanto entrou na conta?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Digite o valor líquido que caiu</p>
                  </div>

                  <div className="relative max-w-xs mx-auto">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 dark:text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="0,00"
                      className="w-full pl-14 pr-4 py-4 text-3xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all tabular-nums"
                    />
                  </div>

                  {/* Suggestions for salaries */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAmount(state.profile.partner1Income.toString())}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Salário {state.profile.partner1Name} ({formatCurrency(state.profile.partner1Income)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(state.profile.partner2Income.toString())}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Salário {state.profile.partner2Name} ({formatCurrency(state.profile.partner2Income)})
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: De quem foi? */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Passo 2</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">De quem é esse dinheiro?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Quem recebeu essa entrada?</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => setRecipient('partner1')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                        recipient === 'partner1'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-accent-surface text-accent-primary flex items-center justify-center font-bold text-lg mb-2">
                        {state.profile.partner1Name[0]}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{state.profile.partner1Name}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecipient('partner2')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                        recipient === 'partner2'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-lg mb-2">
                        {state.profile.partner2Name[0]}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{state.profile.partner2Name}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecipient('both')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                        recipient === 'both'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 flex items-center justify-center font-bold text-lg mb-2">
                        💑
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">Ambos / Conjunto</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Qual o motivo? */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Passo 3</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Qual o motivo da entrada?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Identifique de forma simples</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto w-full">
                    {quickIncomeTypes.map(item => {
                      const isSelected = incomeType === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setIncomeType(item.key)}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/60 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-2xl shrink-0">{item.emoji}</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.label}</span>
                          {isSelected && (
                            <span className="ml-auto w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="max-w-md mx-auto w-full pt-2">
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Descrição opcional (ex: Freela de Design)"
                      className="w-full px-4 py-2.5 text-xs text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!successCelebration && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 font-semibold text-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && (!amount || parseFloat(amount.replace(',', '.')) <= 0)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {step === 3 ? (
                <>
                  <Check className="w-4 h-4" />
                  Concluir Entrada
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
