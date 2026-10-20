import React, { useState } from 'react';
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Sparkles,
  Info,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

export const CoupleSettlementCard: React.FC = () => {
  const {
    state,
    coupleSettlement,
    settlementSplitMode,
    setSettlementSplitMode,
    recordSettlementCompleted,
  } = useFinance();

  const [copied, setCopied] = useState(false);
  const [settled, setSettled] = useState(false);

  const handleCopySummary = () => {
    if (coupleSettlement.isBalanced) {
      navigator.clipboard.writeText(
        `Oi amor! ❤️ Nossas contas de ${formatMonthYear(
          state.currentMonth
        )} no Juntô estão perfeitamente equilibradas (50/50)! Não há transferências pendentes entre nós. 🎉`
      );
    } else {
      navigator.clipboard.writeText(
        `Oi amor! ❤️ Segue o fechamento de ${formatMonthYear(
          state.currentMonth
        )} do Juntô:\n` +
          `• Total de gastos em conjunto: ${formatCurrency(coupleSettlement.totalJoint)}\n` +
          `• ${coupleSettlement.partner1Name} pagou: ${formatCurrency(coupleSettlement.partner1PaidJoint)}\n` +
          `• ${coupleSettlement.partner2Name} pagou: ${formatCurrency(coupleSettlement.partner2PaidJoint)}\n` +
          `⚖️ Para equilibrar o mês, ${coupleSettlement.debtorName} transfere ${formatCurrency(
            coupleSettlement.transferAmount
          )} para ${coupleSettlement.creditorName}.`
      );
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSettle = () => {
    recordSettlementCompleted();
    setSettled(true);
    setTimeout(() => setSettled(false), 4000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-5 transition-colors">
      {/* Card Header & Split Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xl font-black border border-indigo-200 dark:border-indigo-800 shrink-0">
            ⚖️
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display leading-tight">
              Calculadora de Acerto de Contas do Casal
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Compensação automatizada para que ninguém pague mais do que o combinado
            </p>
          </div>
        </div>

        {/* 50/50 vs Proportional Segmented Switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setSettlementSplitMode('fifty_fifty')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              settlementSplitMode === 'fifty_fifty'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            50/50 Exato
          </button>
          <button
            type="button"
            onClick={() => setSettlementSplitMode('proportional')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              settlementSplitMode === 'proportional'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Proporcional à Renda
          </button>
        </div>
      </div>

      {/* Breakdown Comparison Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>👤 {coupleSettlement.partner1Name} desembolsou</span>
            <span className="font-mono">{formatCurrency(coupleSettlement.partner1PaidJoint)}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <span>Cota justa esperada ({settlementSplitMode === 'fifty_fifty' ? '50%' : 'proporcional'}):</span>
            <span className="font-mono">{formatCurrency(coupleSettlement.partner1TargetShare)}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>👤 {coupleSettlement.partner2Name} desembolsou</span>
            <span className="font-mono">{formatCurrency(coupleSettlement.partner2PaidJoint)}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <span>Cota justa esperada ({settlementSplitMode === 'fifty_fifty' ? '50%' : 'proporcional'}):</span>
            <span className="font-mono">{formatCurrency(coupleSettlement.partner2TargetShare)}</span>
          </div>
        </div>
      </div>

      {/* Main Verdict Box */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
          coupleSettlement.isBalanced
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
            : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100'
        }`}
      >
        {coupleSettlement.isBalanced ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-black text-sm sm:text-base">
                Contas do Mês 100% Equilibradas! 🎉
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Ambos contribuíram exatamente com a sua cota nas despesas conjuntas de {formatMonthYear(state.currentMonth)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                Transferência de Compensação Sugerida
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  {coupleSettlement.debtorName}
                </span>
                <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-display tabular-nums">
                  {formatCurrency(coupleSettlement.transferAmount)}
                </span>
                <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  {coupleSettlement.creditorName}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Ao fazer esse Pix, os gastos compartilhados do casal estarão perfeitamente quitados.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Pix / Detalhes'}</span>
              </button>

              <button
                type="button"
                onClick={handleSettle}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{settled ? 'Acerto Quitado! 🎉' : 'Marcar como Quitado'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
