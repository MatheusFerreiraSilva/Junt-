import React, { useState } from 'react';
import {
  Sparkles,
  Heart,
  TrendingUp,
  Target,
  Shield,
  X,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Coffee,
  Smile,
  Zap,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { AIPredictiveInsight, CategoryKey } from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface AIPredictiveInsightsCardProps {
  className?: string;
  onOpenGoalModal?: () => void;
  onNavigateToGoals?: () => void;
  onOpenExpenseModal?: (categoryKey?: CategoryKey) => void;
}

export const AIPredictiveInsightsCard: React.FC<AIPredictiveInsightsCardProps> = ({
  className = '',
  onOpenGoalModal,
  onNavigateToGoals,
  onOpenExpenseModal,
}) => {
  const {
    aiPredictiveInsights,
    applyAISuggestionAction,
    dismissAISuggestion,
    state,
  } = useFinance();

  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  const activeInsights = aiPredictiveInsights.filter(i => i.status === 'active');

  const handleActionClick = (
    insightId: string,
    actionType: 'use_reward' | 'send_to_goal' | 'keep_buffer',
    feedbackMessage: string
  ) => {
    applyAISuggestionAction(insightId, actionType);
    setAppliedFeedback(feedbackMessage);
    setTimeout(() => {
      setAppliedFeedback(null);
    }, 5000);
  };

  if (activeInsights.length === 0) {
    return (
      <div
        className={`bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 rounded-3xl p-5 sm:p-6 border-2 border-emerald-400/30 dark:border-emerald-700/30 shadow-xs flex flex-wrap items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-2xl font-bold shadow-xs shrink-0">
            🕊️
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white font-display">
                Inteligência do Junto — Sincronia em Dia!
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Pacing Ativo
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              O motor de IA está acompanhando o ritmo de abastecimento e as sobras de vocês. Assim que uma oportunidade de recompensa surgir, ela aparecerá aqui!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <span>{state.profile.partner1Name} &amp; {state.profile.partner2Name} em harmonia ✓</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toast Feedback */}
      {appliedFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
            <span>{appliedFeedback}</span>
          </div>
          <button
            onClick={() => setAppliedFeedback(null)}
            className="p-1 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* List of Insights */}
      {activeInsights.map(insight => {
        const isReward = insight.type === 'reward_proposal';
        const isFatigue = insight.type === 'fatigue_pattern';
        const isEfficiency = insight.type === 'efficiency_proposal';

        const borderTheme = isReward
          ? 'border-amber-400/80 dark:border-amber-600/80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-pink-500/10'
          : isFatigue
          ? 'border-sky-400/80 dark:border-sky-600/80 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-teal-500/10'
          : 'border-emerald-400/80 dark:border-emerald-600/80 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/10';

        return (
          <div
            key={insight.id}
            className={`rounded-3xl p-5 sm:p-7 border-2 shadow-md space-y-4 transition-all duration-300 ${borderTheme}`}
          >
            {/* Top Bar with Badge & Dismiss */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  {insight.emoji}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isReward
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                          : isFatigue
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-950 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {insight.badgeText}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      IA do Junto • Sugestão Contextual
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display mt-0.5">
                    {insight.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissAISuggestion(insight.id)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="Pular sugestão"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Empathetic & Warm Message Body */}
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-white/70 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              {insight.message}
            </p>

            {/* AS 3 OPÇÕES RÁPIDAS DE 1 TOQUE */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Escolha com 1 toque o que vocês preferem fazer:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Opção 1: Gostei, vamos usar! */}
                {insight.options.useReward && (
                  <button
                    type="button"
                    onClick={() =>
                      handleActionClick(
                        insight.id,
                        'use_reward',
                        '✨ Recompensa ativada! Limite ajustado para o momento especial de vocês.'
                      )
                    }
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-left transition-all shadow-md active:scale-95 cursor-pointer flex flex-col justify-between space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>Opção 1</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div>
                      <div className="text-xs font-black font-display leading-snug">
                        {insight.options.useReward.label}
                      </div>
                      <p className="text-[10px] text-amber-100 font-medium line-clamp-2 mt-0.5">
                        {insight.options.useReward.description}
                      </p>
                    </div>
                  </button>
                )}

                {/* Opção 2: Mandar para o Cofrinho [Nome] */}
                {insight.options.sendToGoal && (
                  <button
                    type="button"
                    onClick={() =>
                      handleActionClick(
                        insight.id,
                        'send_to_goal',
                        `🎯 Sobra de ${formatCurrency(insight.options.sendToGoal?.amount || 0)} transferida direto para seu objetivo!`
                      )
                    }
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white text-left transition-all shadow-md active:scale-95 cursor-pointer flex flex-col justify-between space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-emerald-200" />
                        <span>Opção 2</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div>
                      <div className="text-xs font-black font-display leading-snug">
                        {insight.options.sendToGoal.label}
                      </div>
                      <p className="text-[10px] text-emerald-100 font-medium line-clamp-2 mt-0.5">
                        {insight.options.sendToGoal.description}
                      </p>
                    </div>
                  </button>
                )}

                {/* Opção 3: Manter guardado na conta */}
                {insight.options.keepBuffer && (
                  <button
                    type="button"
                    onClick={() =>
                      handleActionClick(
                        insight.id,
                        'keep_buffer',
                        '🛡️ Saldo preservado na conta como amortecedor de caixa para o mês.'
                      )
                    }
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 text-left transition-all shadow-xs active:scale-95 cursor-pointer flex flex-col justify-between space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-slate-500" />
                        <span>Opção 3</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div>
                      <div className="text-xs font-black font-display leading-snug">
                        {insight.options.keepBuffer.label}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 mt-0.5">
                        {insight.options.keepBuffer.description}
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
