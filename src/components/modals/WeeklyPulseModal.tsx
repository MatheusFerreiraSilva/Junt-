import React from 'react';
import {
  X,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Heart,
  ChevronRight,
  ShieldCheck,
  Target,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';
import { WeeklyPulseData } from '../../utils/notificationEngine';

interface WeeklyPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  pulseData: WeeklyPulseData;
  onExecuteAction: (action: WeeklyPulseData['actionItem']) => void;
}

export const WeeklyPulseModal: React.FC<WeeklyPulseModalProps> = ({
  isOpen,
  onClose,
  pulseData,
  onExecuteAction,
}) => {
  const { state } = useFinance();

  if (!isOpen) return null;

  const isCollege = state.appMode === 'faculdade';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shrink-0 font-bold shadow-sm">
              🕊️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg font-display text-white">
                  {pulseData.title}
                </h3>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                  Domingo 19h30
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-1">{pulseData.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* 5 Distinct Blocks Container */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* ========================================================================= */}
          {/* BLOCO 1 - A SEMANA EM TRÊS NÚMEROS (Legíveis em 2 segundos) */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
              Bloco 1 — A Semana em Três Números
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  Entrou na Semana
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-display tabular-nums my-1">
                  {formatCurrency(pulseData.incomeThisWeek)}
                </span>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">
                  Receitas registradas nos últimos 7 dias
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  Saiu na Semana
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-display tabular-nums my-1">
                  {formatCurrency(pulseData.spentThisWeek)}
                </span>
                <span className="text-[10px] text-rose-800 dark:text-rose-300 font-medium">
                  Total de gastos dos últimos 7 dias
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                  Ainda Podem Gastar
                </span>
                <span className="text-2xl sm:text-3xl font-black text-indigo-900 dark:text-indigo-200 font-display tabular-nums my-1">
                  {formatCurrency(pulseData.remainingThisMonth)}
                </span>
                <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-medium">
                  Margem livre para o resto do mês
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 2 - A OBSERVAÇÃO DA SEMANA (Visão que o usuário não saberia sozinho) */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Bloco 2 — A Observação da Semana
              </span>
              {pulseData.observationMetric && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                  {pulseData.observationMetric}
                </span>
              )}
            </div>
            <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
              {pulseData.observationTitle}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {pulseData.observationText}
            </p>
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 3 - A AÇÃO DA SEMANA (Uma só, com botão direto) */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/40 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                ⚡
              </span>
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider block">
                  Bloco 3 — A Ação Recomendada da Semana (Uma Só)
                </span>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                  {pulseData.actionTitle}
                </h4>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {pulseData.actionText}
            </p>

            <button
              onClick={() => {
                onExecuteAction(pulseData.actionItem);
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <span>{pulseData.actionItem.label}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 4 - A SEMANA QUE VEM (Preparação: contas, parcelas, eventos) */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
              Bloco 4 — A Semana que Vem (Sem Surpresas)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pulseData.upcomingEvents.map(evt => (
                <div
                  key={evt.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {evt.title}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {evt.amount && (
                      <span className="font-black text-slate-900 dark:text-white block tabular-nums">
                        {formatCurrency(evt.amount)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">{evt.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 5 - O TOQUE HUMANO (Mensagem empática que muda toda semana) */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex items-center gap-3">
            <span className="text-2xl shrink-0">
              {pulseData.humanTouchMood === 'good'
                ? '🌿'
                : pulseData.humanTouchMood === 'tight'
                ? '💪'
                : pulseData.humanTouchMood === 'conquest'
                ? '🏆'
                : '✨'}
            </span>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bloco 5 — O Toque Humano
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                "{pulseData.humanTouchMessage}"
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Ritual de Domingo Juntô · Horário de Brasília
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
          >
            Fechar Pulso
          </button>
        </div>
      </div>
    </div>
  );
};
