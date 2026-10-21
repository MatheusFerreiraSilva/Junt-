import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { formatCurrency, getMonthProgress } from '../utils/formatters';
import { AIPredictiveInsightsCard } from './AIPredictiveInsightsCard';
import { FoodPacingWeeklyCard } from './FoodPacingWeeklyCard';
import { CategoryKey } from '../types/finance';

interface WeeklySurplusHubProps {
  onOpenExpenseModal: (categoryKey?: CategoryKey) => void;
  onNavigateToGoals: () => void;
}

export const WeeklySurplusHub: React.FC<WeeklySurplusHubProps> = ({
  onOpenExpenseModal,
  onNavigateToGoals,
}) => {
  const {
    state,
    categoriesSpending,
    foodPacingMetrics,
    aiPredictiveInsights,
    triggerCelebration,
  } = useFinance();

  const progress = getMonthProgress(state.currentMonth);
  const [recalibrationToast, setRecalibrationToast] = useState<string | null>(null);

  // Categorias com excesso no mês
  const blownCategories = (Object.keys(categoriesSpending) as CategoryKey[])
    .filter(k => categoriesSpending[k].isOver)
    .map(k => ({
      key: k,
      name: CATEGORIES_BASE[k].name,
      emoji: CATEGORIES_BASE[k].emoji,
      overAmount: categoriesSpending[k].spent - categoriesSpending[k].budget,
    }));

  // Categorias com sobras ativas
  const surplusCategories = (Object.keys(categoriesSpending) as CategoryKey[])
    .filter(k => !categoriesSpending[k].isOver && categoriesSpending[k].remaining > 0)
    .map(k => ({
      key: k,
      name: CATEGORIES_BASE[k].name,
      emoji: CATEGORIES_BASE[k].emoji,
      remaining: categoriesSpending[k].remaining,
    }));

  const totalSurplus = surplusCategories.reduce((acc, c) => acc + c.remaining, 0);
  const totalOver = blownCategories.reduce((acc, c) => acc + c.overAmount, 0);

  // Recalibragem suave do ritmo diário considerando os dias restantes
  const currentWeek = foodPacingMetrics.weeks.find(w => w.isCurrentWeek) || foodPacingMetrics.weeks[0];
  const daysRemaining = Math.max(1, progress.daysRemaining);

  // Cálculo de média segura atualizada
  const safeDailyRemaining = Math.max(
    0,
    Math.round((foodPacingMetrics.operationalBudgetRemaining || 0) / daysRemaining)
  );

  const handleApplyRecalibration = () => {
    triggerCelebration();
    setRecalibrationToast(
      `Ritmo recalibrado com sucesso! Média segura ajustada para ${formatCurrency(safeDailyRemaining)}/dia para os próximos ${daysRemaining} dias.`
    );
    setTimeout(() => setRecalibrationToast(null), 4000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast de Notificação de Recalibragem */}
      {recalibrationToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{recalibrationToast}</span>
          </div>
          <button
            onClick={() => setRecalibrationToast(null)}
            className="text-white/80 hover:text-white font-bold text-xs cursor-pointer ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* HEADER / HERO DA ÁREA DEDICADA DE SOBRAS & RITMO */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white shadow-xl border border-emerald-500/30">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center text-xl font-black">
                🌿
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white font-display">
                  Hub de Sobras, Ritmo &amp; Excessos Semanais
                </h3>
                <p className="text-xs text-emerald-200/80 font-medium">
                  Gestão empática do fluxo semanal de {state.profile.partner1Name} &amp; {state.profile.partner2Name}
                </p>
              </div>
            </div>

            {/* Status da Semana */}
            <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Semana {currentWeek.weekNumber} de 4 ({currentWeek.dayRange})</span>
            </div>
          </div>

          {/* Cards de Métricas Rápidas do Hub */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
                Ritmo Seguro da Semana
              </span>
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                {formatCurrency(foodPacingMetrics.dailySafePacing)}
                <span className="text-xs font-normal text-emerald-200/80 ml-1">/dia</span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Pacing seguro para lanches e delivery
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
                Sobra Total nas Categorias
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 tabular-nums">
                {formatCurrency(totalSurplus)}
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Disponível para celebração ou reserva
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 space-y-1">
              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
                Fôlego do Mês
              </span>
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                {daysRemaining} dias
              </div>
              <p className="text-[11px] text-emerald-200/80">
                {progress.percentPassed}% do mês transcorrido
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: RADAR EMPÁTICO DE RECALIBRAGEM (QUANDO HOUVER EXCESSO) */}
      {blownCategories.length > 0 ? (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 shadow-md space-y-4">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-2xl bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 flex items-center justify-center text-xl shrink-0">
              🤝
            </span>
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100">
                  Radar Empático de Recalibragem
                </span>
                <span className="text-xs text-amber-800 dark:text-amber-300 font-bold">
                  Zero julgamento · Rotina de casal real
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 font-display">
                A rotina puxou mais esta semana? Vamos recalibrar juntos com carinho.
              </h4>
              <p className="text-xs text-amber-900/90 dark:text-amber-200 font-medium leading-relaxed">
                Identificamos que {blownCategories.map(c => `${c.emoji} ${c.name} (+${formatCurrency(c.overAmount)})`).join(', ')} ultrapassou o ritmo previsto.
                Plantões pesados ou semanas intensas fazem parte da vida. Não há motivo para neura: basta ajustar o ritmo dos próximos {daysRemaining} dias!
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                Novo Ritmo Diário Sugerido pela IA
              </span>
              <div className="text-lg font-black text-slate-950 dark:text-white tabular-nums flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(safeDailyRemaining)}/dia</span>
                <span className="text-xs font-normal text-slate-500">nos {daysRemaining} dias restantes</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyRecalibration}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recalibrar Média com 1 Toque</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-400/50 dark:border-emerald-600/50 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg">
              ✨
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-950 dark:text-white">
                Ritmo semanal 100% sob controle!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Nenhum excesso identificado. Vocês estão administrando a rotina com excelência.
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700">
            Parabéns ao Casal 👏
          </span>
        </div>
      )}

      {/* SEÇÃO 2: MOTOR DE SUGESTÕES CONTEXTUAIS DA IA (3 OPÇÕES RÁPIDAS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-themed" />
            <h4 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
              Sugestões Contextuais &amp; Análise de Sobras da IA
            </h4>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {aiPredictiveInsights.length} oportunidade{aiPredictiveInsights.length === 1 ? '' : 's'} ativa{aiPredictiveInsights.length === 1 ? '' : 's'}
          </span>
        </div>

        <AIPredictiveInsightsCard
          onNavigateToGoals={onNavigateToGoals}
          onOpenExpenseModal={onOpenExpenseModal}
        />
      </div>

      {/* SEÇÃO 3: INTELIGÊNCIA DE ABASTECIMENTO E PACING SEMANAL DE COMIDA */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <div>
              <h4 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                Inteligência de Abastecimento &amp; Pacing de Comida
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Separação dos 3 pilares funcionais (Estrutural, Rotina e Conveniência) e blocos semanais
              </p>
            </div>
          </div>
        </div>

        <FoodPacingWeeklyCard
          onOpenExpenseModal={() => onOpenExpenseModal('comida')}
        />
      </div>
    </div>
  );
};
