import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import { CategoryKey, PaidBy } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallmentModal: React.FC<InstallmentModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    totalIncome,
    totalActiveInstallmentsAmountMonth,
    installmentLimitPercentage,
    addInstallment,
    triggerCelebration,
  } = useFinance();

  const [step, setStep] = useState<number>(1);
  const [title, setTitle] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(6);
  const [category, setCategory] = useState<CategoryKey>('moradia');
  const [paidBy, setPaidBy] = useState<PaidBy>('both');
  const [splitPartner1Pct, setSplitPartner1Pct] = useState<number>(50);
  const [bankName, setBankName] = useState<string>('Itaú Personalité');
  const [successCelebration, setSuccessCelebration] = useState(false);

  if (!isOpen) return null;

  const partner1IncomePct = totalIncome > 0 ? Math.round((state.profile.partner1Income / totalIncome) * 100) : 50;

  const quickParcelExamples = [
    'Sofá Retrátil',
    'Geladeira Inverter',
    'Passagens de Férias',
    'Notebook / Celular',
    'Móveis do Quarto',
    'Pneus do Carro',
  ];

  const parsedTotal = parseFloat(totalAmount.replace(',', '.')) || 0;
  const calculatedInstallmentAmount = +(parsedTotal / installmentsCount).toFixed(2);

  // Impact on installment limit rule
  const limitPct = installmentLimitPercentage || (state.profile.isInitialHomePhase ? 20 : 10);
  const projectedTotalMonthly = totalActiveInstallmentsAmountMonth + calculatedInstallmentAmount;
  const projectedPct = totalIncome > 0 ? Math.round((projectedTotalMonthly / totalIncome) * 100) : 0;
  const willExceedLimit = projectedPct > limitPct;

  const handleNext = () => {
    if (step === 1) {
      if (!title.trim()) return;
      setStep(2);
    } else if (step === 2) {
      if (!parsedTotal || parsedTotal <= 0) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      handleSave();
    }
  };

  const handleSave = () => {
    const p1Pct =
      paidBy === 'partner1'
        ? 100
        : paidBy === 'partner2'
        ? 0
        : paidBy === 'both'
        ? 50
        : splitPartner1Pct;
    const p2Pct = 100 - p1Pct;

    addInstallment({
      title: title.trim(),
      category,
      totalAmount: parsedTotal,
      installmentsCount,
      installmentAmount: calculatedInstallmentAmount,
      startMonth: state.currentMonth,
      paidBy,
      splitPartner1Pct: p1Pct,
      splitPartner2Pct: p2Pct,
      bankName: bankName || 'Itaú Personalité',
    });

    setSuccessCelebration(true);
    triggerCelebration();

    setTimeout(() => {
      setSuccessCelebration(false);
      setStep(1);
      setTitle('');
      setTotalAmount('');
      setInstallmentsCount(6);
      onClose();
    }, 1300);
  };

  const handleClose = () => {
    setStep(1);
    setTitle('');
    setTotalAmount('');
    setInstallmentsCount(6);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
              📦
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                Registrar Parcela
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Passo {step} de 5</p>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-center">
          {successCelebration ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-surface text-accent-primary flex items-center justify-center mb-4">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">Parcelamento Registrado!</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-xs">
                {title}: {installmentsCount}x de {formatCurrency(calculatedInstallmentAmount)} adicionadas
                automaticamente ao orçamento dos próximos meses!
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-accent-themed bg-accent-surface px-3 py-1.5 rounded-full border border-accent-themed">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                Segurança das finanças garantida
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: O que foi comprado? */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Passo 1</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">O que foi parcelado?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dê um nome claro para vocês lembrarem</p>
                  </div>

                  <div className="max-w-md mx-auto w-full">
                    <input
                      type="text"
                      autoFocus
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="Ex: Sofá Retrátil, Passagens Férias"
                      className="w-full px-4 py-3.5 text-base font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-center"
                    />
                  </div>

                  {/* Quick Suggestions */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickParcelExamples.map(example => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setTitle(example)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-800 dark:hover:text-amber-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: Qual o valor total? */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Passo 2</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Qual o valor total da compra?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">O valor cheio somando todas as parcelas</p>
                  </div>

                  <div className="relative max-w-xs mx-auto">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 dark:text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="0,00"
                      className="w-full pl-14 pr-4 py-4 text-3xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 transition-all tabular-nums"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Em quantas vezes? */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Passo 3</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Em quantas parcelas?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total: {formatCurrency(parsedTotal)}</p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-md mx-auto w-full">
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(count => {
                      const perMonth = parsedTotal / count;
                      const isSelected = installmentsCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setInstallmentsCount(count)}
                          className={`p-3 rounded-2xl border-2 text-center transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-base font-extrabold text-slate-900 dark:text-white">{count}x</div>
                          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">
                            {formatCurrency(perMonth)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Impact preview */}
                  <div
                    className={`max-w-md mx-auto p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                      willExceedLimit
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                        : 'bg-accent-surface border-accent-themed text-accent-themed'
                    }`}
                  >
                    {willExceedLimit ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <Check className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>
                        {installmentsCount} parcelas de <strong>{formatCurrency(calculatedInstallmentAmount)}</strong>/mês.
                      </div>
                      <div className="mt-0.5 text-[11px] opacity-90">
                        Comprometimento total da renda passará para <strong>{projectedPct}%</strong>{' '}
                        {willExceedLimit ? `(acima do teto seguro de ${limitPct}%) ⚠️` : `(dentro do limite seguro de ${limitPct}%) ✅`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Qual categoria? */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Passo 4</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Qual categoria pertence?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      O app vai descontar {formatCurrency(calculatedInstallmentAmount)} desta área a cada mês
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto w-full">
                    {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
                      const cat = CATEGORIES_BASE[key];
                      const isSelected = category === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCategory(key)}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/60 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-2xl shrink-0">{cat.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{cat.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{cat.description}</div>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 5: Quem comprou / Divisão do casal? */}
              {step === 5 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Passo 5</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Quem paga essas parcelas?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dividido igualmente, por porcentagem ou 100% individual?</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto w-full">
                    {/* Option 1: Casal 50/50 */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('both')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'both'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🤝</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Casal (50/50)</span>
                      </div>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                        {formatCurrency(calculatedInstallmentAmount / 2)} cada/mês
                      </p>
                    </button>

                    {/* Option 2: Custom Percentage */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('custom')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'custom'
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">⚖️</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Porcentagem (%)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                        {splitPartner1Pct}% / {100 - splitPartner1Pct}%
                      </p>
                    </button>

                    {/* Option 3: Só Partner 1 */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('partner1')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'partner1'
                          ? 'border-accent-primary bg-accent-surface shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full btn-primary-accent text-white flex items-center justify-center font-bold text-xs">
                          {state.profile.partner1Name[0]}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          Só {state.profile.partner1Name}
                        </span>
                      </div>
                      <p className="text-[11px] text-accent-themed font-semibold">100% individual</p>
                    </button>

                    {/* Option 4: Só Partner 2 */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('partner2')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'partner2'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          {state.profile.partner2Name[0]}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          Só {state.profile.partner2Name}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">100% individual</p>
                    </button>
                  </div>

                  {/* Bank Account / Credit Card Selector */}
                  <div className="pt-2 max-w-md mx-auto w-full space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      De qual conta ou cartão sai este débito? 🏦
                    </label>
                    <select
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="Nubank Ultravioleta">🟣 Nubank Ultravioleta</option>
                      <option value="Itaú Personalité">🟠 Itaú Personalité</option>
                      <option value="BTG Pactual Banking">🔵 BTG Pactual Banking</option>
                      <option value="XP Investimentos">🟡 XP Investimentos</option>
                      <option value="Outra Conta Bancária">🏦 Outra Conta Bancária</option>
                    </select>
                  </div>

                  {/* Percentage Slider when 'custom' selected */}
                  {paidBy === 'custom' && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 max-w-md mx-auto w-full">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
                        <span>{state.profile.partner1Name}: {splitPartner1Pct}% ({formatCurrency((calculatedInstallmentAmount * splitPartner1Pct) / 100)}/mês)</span>
                        <span>{state.profile.partner2Name}: {100 - splitPartner1Pct}% ({formatCurrency((calculatedInstallmentAmount * (100 - splitPartner1Pct)) / 100)}/mês)</span>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="99"
                        value={splitPartner1Pct}
                        onChange={e => setSplitPartner1Pct(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-600"
                      />

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(50)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 50 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          50/50
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(partner1IncomePct)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === partner1IncomePct ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          Rendas ({partner1IncomePct}% / {100 - partner1IncomePct}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(60)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 60 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          60 / 40
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(70)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 70 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          70 / 30
                        </button>
                      </div>
                    </div>
                  )}
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
              disabled={
                (step === 1 && !title.trim()) ||
                (step === 2 && (!parsedTotal || parsedTotal <= 0))
              }
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {step === 5 ? (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Parcela
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
