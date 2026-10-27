import React, { useState, useEffect } from 'react';
import { X, Sparkles, Calculator, Check, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { SavingsPiggyBank } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface PixDiscountComparatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: SavingsPiggyBank | null;
}

export const PixDiscountComparatorModal: React.FC<PixDiscountComparatorModalProps> = ({
  isOpen,
  onClose,
  goal,
}) => {
  const [totalPrice, setTotalPrice] = useState<number>(5000);
  const [pixDiscountPercent, setPixDiscountPercent] = useState<number>(10);
  const [installmentMonths, setInstallmentMonths] = useState<number>(10);
  const [cdiMonthlyRate, setCdiMonthlyRate] = useState<number>(0.85); // ~10.75% a.a.

  const goalTargetAmount = goal?.targetAmount;

  useEffect(() => {
    if (isOpen && goal) {
      const price = goalTargetAmount && goalTargetAmount > 0 ? goalTargetAmount : 5000;
      setTotalPrice(price);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, goal?.id, goalTargetAmount]);

  if (!isOpen) return null;

  // Real-time calculation:
  // 1. PIX payment
  const discountValue = (totalPrice * pixDiscountPercent) / 100;
  const cashPrice = Math.max(0, totalPrice - discountValue);

  // 2. Installments: Keep money yielding 100% CDI while paying installments each month
  const monthlyInstallment = installmentMonths > 0 ? totalPrice / installmentMonths : 0;
  let remainingCapital = cashPrice; // or totalPrice depending on comparison base, standard: capital needed for PIX
  let totalYieldEarned = 0;

  for (let m = 0; m < installmentMonths; m++) {
    const monthYield = remainingCapital * (cdiMonthlyRate / 100);
    totalYieldEarned += monthYield;
    remainingCapital = Math.max(0, remainingCapital + monthYield - monthlyInstallment);
  }

  const isPixBetter = discountValue > totalYieldEarned;
  const netAdvantage = Math.abs(discountValue - totalYieldEarned);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center text-2xl shrink-0 shadow-sm">
              💵
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-lg text-slate-950 dark:text-white font-display">
                  PIX com Desconto vs. 100% CDI
                </h3>
                {goal && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                    {goal.emoji} {goal.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                Descubra matematicamente se vale a pena usar o saldo do cofrinho à vista ou parcelar sem juros.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Valor Total da Compra (R$)
              </label>
              <input
                type="number"
                value={totalPrice}
                onChange={e => setTotalPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Desconto à vista no PIX (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={pixDiscountPercent}
                onChange={e => setPixDiscountPercent(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Parcelas no Cartão (sem juros)
              </label>
              <input
                type="number"
                min="1"
                max="36"
                value={installmentMonths}
                onChange={e => setInstallmentMonths(Math.max(1, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Rendimento do CDB (100% CDI líquido)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  value={cdiMonthlyRate}
                  onChange={e => setCdiMonthlyRate(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-bold">% a.m.</span>
              </div>
            </div>
          </div>

          {/* Quick presets for discount */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Descontos comuns no PIX:
            </span>
            {[5, 8, 10, 12, 15].map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => setPixDiscountPercent(pct)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-colors ${
                  pixDiscountPercent === pct
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Side by Side Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* PIX Option */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              isPixBetter
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>⚡ Opção 1: À Vista no PIX</span>
                </span>
                {isPixBetter && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                    Vencedor ✓
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
                {formatCurrency(cashPrice)}
              </div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                Economia imediata: +{formatCurrency(discountValue)} ({pixDiscountPercent}%)
              </div>
            </div>

            {/* Installments Option */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              !isPixBetter
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>💳 Opção 2: {installmentMonths}x no Cartão</span>
                </span>
                {!isPixBetter && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                    Vencedor ✓
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
                {formatCurrency(monthlyInstallment)} <span className="text-xs font-normal text-slate-500">/mês</span>
              </div>
              <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mt-1">
                Rendimento CDB acumulado: +{formatCurrency(totalYieldEarned)}
              </div>
            </div>
          </div>

          {/* Veredito Inteligente do Casal */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2">
            <div className="flex items-center gap-2 font-black text-amber-950 dark:text-amber-100 text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Veredito Inteligente do Juntô:</span>
            </div>
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              {isPixBetter ? (
                <>
                  Pagar à vista com <strong>PIX</strong> é a escolha mais vantajosa! Vocês economizam <strong>{formatCurrency(discountValue)}</strong> imediatamente, superando o ganho de <strong>{formatCurrency(totalYieldEarned)}</strong> que o CDB a 100% do CDI geraria. Vantagem líquida para o casal: <strong>+{formatCurrency(netAdvantage)}</strong>. Podem usar o cofrinho sem culpa! 🎉
                </>
              ) : (
                <>
                  <strong>Parcelar em {installmentMonths}x sem juros</strong> compensa mais! O rendimento do dinheiro no CDB a 100% do CDI gerará <strong>{formatCurrency(totalYieldEarned)}</strong>, superando o desconto do PIX em <strong>+{formatCurrency(netAdvantage)}</strong>. Mantenham o saldo rendendo e paguem as parcelas mês a mês! 📈
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs cursor-pointer shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
