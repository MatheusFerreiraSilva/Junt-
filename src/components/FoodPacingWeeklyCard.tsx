import React, { useState } from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  Bike,
  Sparkles,
  ShieldCheck,
  Calendar,
  AlertCircle,
  TrendingDown,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';

interface FoodPacingWeeklyCardProps {
  onOpenExpenseModal?: () => void;
  className?: string;
}

export const FoodPacingWeeklyCard: React.FC<FoodPacingWeeklyCardProps> = ({
  onOpenExpenseModal,
  className = '',
}) => {
  const { foodPacingMetrics, categoriesSpending } = useFinance();
  const {
    totalFoodBudget,
    totalFoodSpent,
    structuralSpent,
    routineSpent,
    convenienceSpent,
    operationalBudgetRemaining,
    weeklyQuota,
    weeks,
    currentWeekNumber,
    currentWeekRemaining,
    dailySafePacing,
    hasInitialStockup,
    pillars,
  } = foodPacingMetrics;

  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(currentWeekNumber);

  const foodRemaining = categoriesSpending.comida?.remaining ?? (totalFoodBudget - totalFoodSpent);
  const isOverFoodBudget = foodRemaining < 0;

  const activeWeekData = weeks.find((w) => w.weekNumber === selectedWeekNumber) || weeks[0];

  return (
    <div
      className={`clay-card p-6 sm:p-8 space-y-6 transition-all bento-card-skyblue ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-[#111318] text-white flex items-center justify-center text-2xl font-bold shadow-xs shrink-0">
            🍽️
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-[#111318] dark:text-white font-display">
                Comida, Abastecimento &amp; Pacing
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-[#111318] dark:text-white border border-[#A6D8FF]">
                100% da Alimentação
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              Gestão em 3 pilares: grande abastecimento inicial isolado e pacing semanal seguro para delivery.
            </p>
          </div>
        </div>

        {/* Totals Badge */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
            Orçamento de Comida
          </span>
          <span className="text-lg sm:text-xl font-black text-[#111318] dark:text-white tabular-nums font-display">
            {formatCurrency(totalFoodSpent)}{' '}
            <span className="text-xs font-bold text-slate-500">/ {formatCurrency(totalFoodBudget)}</span>
          </span>
          <span
            className={`text-[11px] font-black block ${
              isOverFoodBudget ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {isOverFoodBudget
              ? `Passou ${formatCurrency(Math.abs(foodRemaining))}`
              : `Restam ${formatCurrency(foodRemaining)} livres`}
          </span>
        </div>
      </div>

      {/* RECONHECIMENTO DO ABASTECIMENTO ESTRUTURAL */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-[#A6D8FF] dark:border-sky-800/60 space-y-2 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-sky-950 dark:text-sky-200">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              {hasInitialStockup
                ? 'Abastecimento da Casa Reconhecido com Sucesso!'
                : 'Pacing Inteligente Pronto para o Mês'}
            </span>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#111318] text-white">
            Zero Alarme Falso
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
          {hasInitialStockup ? (
            <>
              A IA reconheceu <strong>{formatCurrency(structuralSpent)}</strong> em compras estruturais de mercado e açougue. Esse investimento inicial <strong>não é tratado como descontrole</strong>. O saldo operacional líquido de{' '}
              <strong className="text-sky-900 dark:text-sky-200">{formatCurrency(operationalBudgetRemaining)}</strong> foi fracionado em 4 semanas para delivery e lanches!
            </>
          ) : (
            <>
              Grandes compras de supermercado e limpeza da casa são automaticamente isoladas das refeições de rotina e delivery, garantindo previsibilidade semanal exata.
            </>
          )}
        </p>
      </div>

      {/* SELETOR DE PACING SEMANAL EM PÍLULAS (CARROSSEL COM FUNDO PRETO SÓLIDO #111318 NA SEMANA ATIVA) */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black text-[#111318] dark:text-white flex items-center gap-1.5 font-display">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Acompanhamento Semanal em Pílulas</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Cota semanal calculada: <strong>{formatCurrency(weeklyQuota)}/semana</strong> para almoços e delivery.
            </span>
          </div>

          {currentWeekRemaining > 0 && dailySafePacing > 0 && (
            <div className="px-3 py-1 rounded-full bg-[#111318] text-white text-xs font-black flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Semana {currentWeekNumber}: {formatCurrency(dailySafePacing)}/dia</span>
            </div>
          )}
        </div>

        {/* Carousel / Strip of Rounded Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {weeks.map((w) => {
            const isSelected = selectedWeekNumber === w.weekNumber;
            const isCur = w.isCurrentWeek;

            return (
              <button
                key={w.weekNumber}
                type="button"
                onClick={() => setSelectedWeekNumber(w.weekNumber)}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#111318] text-white shadow-md scale-102 ring-2 ring-[#111318]/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{w.label}</span>
                {isCur && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSelected ? 'bg-amber-300' : 'bg-sky-500'
                    }`}
                  />
                )}
                <span
                  className={`text-[10px] tabular-nums font-bold ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {formatCurrency(w.spent)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Selected Week Spotlight Bento Card */}
        {activeWeekData && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#111318] dark:text-white">
                  {activeWeekData.label} {activeWeekData.isCurrentWeek ? '(Semana em Andamento 📍)' : ''}
                </span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    activeWeekData.status === 'future'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : activeWeekData.status === 'over'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : activeWeekData.status === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  }`}
                >
                  {activeWeekData.status === 'future'
                    ? 'Aguardando'
                    : activeWeekData.status === 'over'
                    ? 'Passou do Limite'
                    : activeWeekData.status === 'warning'
                    ? 'Atenção'
                    : 'Equilibrado ✓'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-black text-[#111318] dark:text-white tabular-nums">
                  {formatCurrency(activeWeekData.spent)}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  / cota {formatCurrency(activeWeekData.allocatedBudget)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activeWeekData.status === 'over'
                    ? 'bg-rose-500'
                    : activeWeekData.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-[#111318]'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    activeWeekData.allocatedBudget > 0
                      ? Math.round((activeWeekData.spent / activeWeekData.allocatedBudget) * 100)
                      : 0
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 dark:text-slate-400">Saldo da semana:</span>
              <span
                className={`font-black tabular-nums ${
                  activeWeekData.remaining < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {activeWeekData.remaining < 0
                  ? `- ${formatCurrency(Math.abs(activeWeekData.remaining))}`
                  : `+ ${formatCurrency(activeWeekData.remaining)} livres`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* OS 3 PILARES FUNCIONAIS: GRID */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
          Distribuição nos 3 Pilares de Alimentação do Casal:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pilar 1: Estrutural */}
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-[#A6D8FF] dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-sky-950 dark:text-sky-200">
                <span className="text-lg">🛒</span>
                <span>{pillars.estrutural.title}</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-200">
                {pillars.estrutural.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-[#111318] dark:text-white tabular-nums font-display">
              {formatCurrency(structuralSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.estrutural.description}
            </p>
          </div>

          {/* Pilar 2: Rotina */}
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-[#FFC875] dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-amber-950 dark:text-amber-200">
                <span className="text-lg">🍲</span>
                <span>{pillars.rotina.title}</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200">
                {pillars.rotina.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-[#111318] dark:text-white tabular-nums font-display">
              {formatCurrency(routineSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.rotina.description}
            </p>
          </div>

          {/* Pilar 3: Conveniência */}
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-[#D8C7FF] dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-purple-950 dark:text-purple-200">
                <span className="text-lg">🛵</span>
                <span>{pillars.conveniencia.title}</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-200">
                {pillars.conveniencia.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-[#111318] dark:text-white tabular-nums font-display">
              {formatCurrency(convenienceSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.conveniencia.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
