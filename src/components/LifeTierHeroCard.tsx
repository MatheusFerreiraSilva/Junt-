import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Shield,
  Heart,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Award,
  ArrowRight,
  PieChart,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { CategoryKey } from '../types/finance';
import { BudgetRebalanceModal } from './modals/BudgetRebalanceModal';

export const LifeTierHeroCard: React.FC = () => {
  const {
    activeLifeTier,
    tierProgress,
    bonusShiftCalculation,
    totalIncome,
    dynamicIncomeAnalysis,
    state,
    depositToProtection,
    triggerCelebration,
    simulateNewDepositConfirmation,
  } = useFinance();

  const [isExpanded, setIsExpanded] = useState(false);
  const [allocatedBonus, setAllocatedBonus] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

  const tier = activeLifeTier;
  const isAboveInflection = totalIncome > 35000;
  const isTracaoReserveActive = tier.key === 'tracao' && !state.isProtectionComplete;

  const handleApplyBonusToInvestments = () => {
    if (bonusShiftCalculation.toInvestments > 0) {
      depositToProtection(bonusShiftCalculation.toInvestments);
      setAllocatedBonus(true);
      triggerCelebration();
      setTimeout(() => setAllocatedBonus(false), 3000);
    }
  };

  const basisLabel =
    dynamicIncomeAnalysis?.basis === 'three_months_avg'
      ? 'Média últimos 3 meses'
      : dynamicIncomeAnalysis?.basis === 'current_month'
      ? 'Base: Mês atual'
      : 'Base: Renda perfil';

  return (
    <div
      className="clay-card relative p-5 sm:p-7 border-2 transition-all duration-500 overflow-hidden shadow-xl"
      style={{
        borderColor: tier.colors.border,
        boxShadow: `0 14px 40px -8px ${tier.colors.glow}`,
      }}
    >
      {/* Background Ambient Radial Glow */}
      <div
        className="absolute -right-12 -top-12 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 dark:opacity-25 transition-all duration-700"
        style={{ backgroundColor: tier.colors.primary }}
      />
      <div
        className="absolute -left-12 -bottom-12 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-15 dark:opacity-20 transition-all duration-700"
        style={{ backgroundColor: tier.colors.secondary }}
      />

      <div className="relative z-10 space-y-4">
        {/* Top Header: Badge, Emblem and Inflection Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl sm:text-4xl p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-md border-2 border-slate-300 dark:border-slate-700 shrink-0">
              {tier.emblem}
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border-2 shadow-xs bg-slate-100 dark:bg-slate-800"
                  style={{
                    color: tier.colors.text,
                    borderColor: tier.colors.border,
                  }}
                >
                  {tier.name}
                </span>

                {isAboveInflection ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-600 shadow-xs">
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    Ponto de Inflexão Superado &gt; R$ 35k · Aceleração de Patrimônio
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100 border-2 border-amber-500 dark:border-amber-600 shadow-xs">
                    <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-500" />
                    Foco: Conforto, Proteção &amp; Anti-Burnout
                  </span>
                )}

                {isTracaoReserveActive && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-950 dark:text-indigo-100 border-2 border-indigo-400 dark:border-indigo-600 shadow-xs">
                    <Shield className="w-3 h-3 stroke-[2.5]" />
                    77% dos Investimentos para Reserva
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight truncate">
                {tier.tagline}
              </h2>
            </div>
          </div>

          {/* Current Income Value Pill with High Contrast */}
          <div className="text-right bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md shrink-0">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Renda Líquida Combinada
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600">
                {basisLabel}
              </span>
            </div>
            <span
              className="text-lg sm:text-2xl font-black tracking-tight"
              style={{ color: tier.colors.text }}
            >
              {formatCurrency(totalIncome)}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">/mês</span>
            </span>
          </div>
        </div>

        {/* Motivational Message with Sharp Contrast */}
        <p className="text-xs sm:text-sm font-bold text-slate-950 dark:text-slate-100 leading-relaxed max-w-3xl bg-slate-100/90 dark:bg-slate-800/90 p-3 rounded-2xl border-2 border-slate-300 dark:border-slate-700">
          "{tier.message}"
        </p>

        {/* Progress Bar toward next tier with High-Contrast Track */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Evolução na Faixa Atual</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white font-black border border-slate-300 dark:border-slate-700">
                {tierProgress.percentage}%
              </span>
            </span>
            <span className="font-black text-slate-950 dark:text-white">
              {tierProgress.isMaxTier
                ? '🪐 Nível Máximo de Liberdade Financeira (Fase Órbita)'
                : `Faltam ${formatCurrency(tierProgress.amountToNext)} para ${tierProgress.nextTierName}`}
            </span>
          </div>

          <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5 border-2 border-slate-300 dark:border-slate-600 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-700 shadow-xs"
              style={{
                width: `${Math.max(6, tierProgress.percentage)}%`,
                background: `linear-gradient(90deg, ${tier.colors.primary}, ${tier.colors.secondary})`,
              }}
            />
          </div>
        </div>

        {/* 50/50 Extra Shift & Bonus Rule Alert (If Detected) */}
        {bonusShiftCalculation.hasBonus && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-500 space-y-3 shadow-lg animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Zap className="w-5 h-5 fill-emerald-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-950 dark:text-white">
                      Regra 50/50 Ativa · Plantões Extras &amp; Bonificações
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-400">
                      +{formatCurrency(bonusShiftCalculation.excessAmount)} excedentes
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Recebimento acima da média base! O algoritmo divide o valor sem culpa entre futuro e presente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-black">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-950 dark:text-indigo-200 border-2 border-indigo-300 dark:border-indigo-700 shadow-xs">
                  📈 50% Investimentos: {formatCurrency(bonusShiftCalculation.toInvestments)}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 shadow-xs">
                  🥂 50% Lazer: {formatCurrency(bonusShiftCalculation.toLeisure)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ✨ Os <strong>{formatCurrency(bonusShiftCalculation.toLeisure)}</strong> de Lazer já foram liberados no saldo do mês!
              </span>

              <button
                onClick={handleApplyBonusToInvestments}
                disabled={allocatedBonus}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {allocatedBonus ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Injetado nos Investimentos com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 stroke-[2.5]" />
                    <span>Injetar 50% nos Investimentos Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Expandable Category Allocation Breakdown with High Contrast */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100 hover:underline transition-colors cursor-pointer select-none bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs"
          >
            <span>{isExpanded ? 'Ocultar Distribuição Automática da Faixa' : 'Ver Distribuição Inteligente das Categorias'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4 stroke-[2.5]" /> : <ChevronDown className="w-4 h-4 stroke-[2.5]" />}
          </button>

          {/* Quick Simulation Trigger for testing live transitions */}
          <button
            onClick={() => simulateNewDepositConfirmation(9500, 'Hospital Israelita Albert Einstein (Plantão PJ)')}
            className="text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs"
            title="Simula um recebimento hospitalar capturado pelo Meu Pluggy para testar confirmação ativa e faixas de renda"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Simular Recebimento Médico PJ</span>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-black text-slate-950 dark:text-white text-sm">
                Pilares de Distribuição da {tier.name}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {tier.inflectionNote}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Moradia */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 shadow-xs">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">🏠 Moradia</div>
                <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {tier.percentages.moradia}%
                </div>
                <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  {formatCurrency((totalIncome * tier.percentages.moradia) / 100)}
                </div>
              </div>

              {/* Comida */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 shadow-xs">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">🍽️ Comida</div>
                <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {tier.percentages.comida}%
                </div>
                <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  {formatCurrency((totalIncome * tier.percentages.comida) / 100)}
                </div>
              </div>

              {/* Lazer */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 shadow-xs">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">🎉 Lazer</div>
                <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {tier.percentages.lazer}%
                  {bonusShiftCalculation.hasBonus && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black ml-1">+bônus</span>
                  )}
                </div>
                <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  {formatCurrency(
                    (totalIncome * tier.percentages.lazer) / 100 +
                      (bonusShiftCalculation.hasBonus ? bonusShiftCalculation.toLeisure : 0)
                  )}
                </div>
              </div>

              {/* Proteção */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 shadow-xs">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">🛡️ Proteção</div>
                <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {tier.percentages.protecao}%
                </div>
                <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  {formatCurrency((totalIncome * tier.percentages.protecao) / 100)}
                </div>
              </div>

              {/* Profissional */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 shadow-xs">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">💼 Carreira</div>
                <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {tier.percentages.profissional}%
                </div>
                <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  {formatCurrency((totalIncome * tier.percentages.profissional) / 100)}
                </div>
              </div>

              {/* Investimentos */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-400 dark:border-emerald-600 shadow-xs">
                <div className="text-xs font-black text-emerald-900 dark:text-emerald-200 truncate">
                  📈 Investimentos
                </div>
                <div className="text-base font-black text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {tier.percentages.investimentos}%
                </div>
                <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
                  {formatCurrency((totalIncome * tier.percentages.investimentos) / 100)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsRebalanceModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
              >
                <PieChart className="w-4 h-4" />
                <span>Reequilibrar Orçamento Respeitando minhas Travas</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <BudgetRebalanceModal
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
      />
    </div>
  );
};
