import React from 'react';
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

  const foodRemaining = categoriesSpending.comida?.remaining ?? (totalFoodBudget - totalFoodSpent);
  const isOverFoodBudget = foodRemaining < 0;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border-2 border-slate-200/90 dark:border-slate-800 shadow-md space-y-6 transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center text-2xl font-bold shadow-xs shrink-0">
            🍽️
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                Inteligência de Comida, Abastecimento & Pacing
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                100% da Alimentação
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              Gestão em 3 pilares: grande abastecimento inicial isolado e pacing semanal seguro para delivery e rotina.
            </p>
          </div>
        </div>

        {/* Totals Badge */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
            Orçamento de Comida
          </span>
          <span className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
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

      {/* RECONHECIMENTO DO ABASTECIMENTO INICIAL (CALLOUT DA IA) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-sky-400/40 dark:border-sky-600/40 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-sky-950 dark:text-sky-200">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              {hasInitialStockup
                ? 'Abastecimento da Casa Reconhecido com Sucesso!'
                : 'Pacing Inteligente Pronto para o Mês'}
            </span>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            Zero Alarme Falso de Estouro
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
          {hasInitialStockup ? (
            <>
              A IA reconheceu <strong>{formatCurrency(structuralSpent)}</strong> em compras estruturais de mercado, açougue e feira. Esse investimento inicial <strong>não é tratado como descontrole</strong>. O saldo operacional líquido de{' '}
              <strong className="text-sky-900 dark:text-sky-200">{formatCurrency(operationalBudgetRemaining)}</strong> foi fracionado em 4 semanas para delivery e lanches!
            </>
          ) : (
            <>
              Grandes compras de supermercado e limpeza da casa são automaticamente isoladas das refeições de rotina e delivery, garantindo previsibilidade semanal exata.
            </>
          )}
        </p>
      </div>

      {/* OS 3 PILARES FUNCIONAIS: GRID */}
      <div className="space-y-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
          Distribuição nos 3 Pilares de Alimentação do Casal:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pilar 1: Estrutural */}
          <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-teal-950 dark:text-teal-200">
                <span className="text-lg">🛒</span>
                <span>{pillars.estrutural.title}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-200/60 dark:bg-teal-900/60 text-teal-950 dark:text-teal-200">
                {pillars.estrutural.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
              {formatCurrency(structuralSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.estrutural.description}
            </p>
          </div>

          {/* Pilar 2: Rotina */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-amber-950 dark:text-amber-200">
                <span className="text-lg">🍲</span>
                <span>{pillars.rotina.title}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200">
                {pillars.rotina.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
              {formatCurrency(routineSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.rotina.description}
            </p>
          </div>

          {/* Pilar 3: Conveniência */}
          <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-purple-950 dark:text-purple-200">
                <span className="text-lg">🛵</span>
                <span>{pillars.conveniencia.title}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200/60 dark:bg-purple-900/60 text-purple-950 dark:text-purple-200">
                {pillars.conveniencia.percentageOfFoodSpent}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
              {formatCurrency(convenienceSpent)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
              {pillars.conveniencia.description}
            </p>
          </div>
        </div>
      </div>

      {/* PACING SEMANAL DE CONVENIÊNCIA & ROTINA: AS 4 SEMANAS */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black text-slate-950 dark:text-white flex items-center gap-1.5 font-display">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Pacing Semanal de Conveniência & Rotina (4 Blocos)</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Cota semanal calculada: <strong>{formatCurrency(weeklyQuota)}/semana</strong> para almoços e delivery.
            </span>
          </div>

          {currentWeekRemaining > 0 && dailySafePacing > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 text-xs font-black border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Semana {currentWeekNumber}: Média segura de {formatCurrency(dailySafePacing)}/dia</span>
            </div>
          )}
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {weeks.map(w => {
            const pct = w.allocatedBudget > 0 ? Math.min(100, Math.round((w.spent / w.allocatedBudget) * 100)) : 0;
            const isCur = w.isCurrentWeek;

            return (
              <div
                key={w.weekNumber}
                className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 relative ${
                  isCur
                    ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                {isCur && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-sky-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                    Semana Atual 📍
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {w.label}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      w.status === 'future'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        : w.status === 'over'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        : w.status === 'warning'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {w.status === 'future'
                      ? 'Aguardando'
                      : w.status === 'over'
                      ? 'Passou'
                      : w.status === 'warning'
                      ? 'Atenção'
                      : 'Equilibrado ✓'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(w.spent)}
                  </span>
                  <span className="text-slate-500 text-[10px] font-bold">
                    cota {formatCurrency(w.allocatedBudget)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      w.status === 'over'
                        ? 'bg-rose-500'
                        : w.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                    }`}
                    style={{ width: `${w.status === 'future' ? 0 : pct}%` }}
                  />
                </div>

                <div className="text-[11px] font-extrabold flex justify-between pt-0.5">
                  <span className="text-slate-500">Saldo restante:</span>
                  <span
                    className={
                      w.remaining < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {w.remaining < 0
                      ? `- ${formatCurrency(Math.abs(w.remaining))}`
                      : formatCurrency(w.remaining)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
