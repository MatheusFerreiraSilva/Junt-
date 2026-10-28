import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Check,
  TrendingUp,
  Sliders,
  ArrowRightLeft,
  Shield,
  Target,
  Heart,
  Zap,
  Calendar,
  ChevronRight,
  Info,
  Clock,
  Stethoscope,
  History,
  AlertCircle,
  HelpCircle,
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

type HubTab = 'simulator' | 'vessels' | 'insights' | 'history';

export const WeeklySurplusHub: React.FC<WeeklySurplusHubProps> = ({
  onOpenExpenseModal,
  onNavigateToGoals,
}) => {
  const {
    state,
    categoriesSpending,
    foodPacingMetrics,
    aiPredictiveInsights,
    surplusTransfers,
    reallocateCategoryBudget,
    coverExpenseDeficitWithShift,
    distributeSurplusPercentages,
    triggerCelebration,
  } = useFinance();

  const progress = getMonthProgress(state.currentMonth);
  const [activeTab, setActiveTab] = useState<HubTab>('simulator');
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  // Categorias com excesso no mês
  const blownCategories = useMemo(() => {
    return (Object.keys(categoriesSpending) as CategoryKey[])
      .filter(k => categoriesSpending[k].isOver)
      .map(k => ({
        key: k,
        name: CATEGORIES_BASE[k].name,
        emoji: CATEGORIES_BASE[k].emoji,
        budget: categoriesSpending[k].budget,
        spent: categoriesSpending[k].spent,
        overAmount: Math.round((categoriesSpending[k].spent - categoriesSpending[k].budget) * 100) / 100,
      }));
  }, [categoriesSpending]);

  // Categorias com sobras ativas
  const surplusCategories = useMemo(() => {
    return (Object.keys(categoriesSpending) as CategoryKey[])
      .filter(k => !categoriesSpending[k].isOver && categoriesSpending[k].remaining > 0)
      .map(k => ({
        key: k,
        name: CATEGORIES_BASE[k].name,
        emoji: CATEGORIES_BASE[k].emoji,
        budget: categoriesSpending[k].budget,
        spent: categoriesSpending[k].spent,
        remaining: Math.round(categoriesSpending[k].remaining * 100) / 100,
      }));
  }, [categoriesSpending]);

  const totalSurplus = useMemo(() => {
    return surplusCategories.reduce((acc, c) => acc + c.remaining, 0);
  }, [surplusCategories]);

  const totalOver = useMemo(() => {
    return blownCategories.reduce((acc, c) => acc + c.overAmount, 0);
  }, [blownCategories]);

  const daysRemaining = Math.max(1, progress.daysRemaining);
  const currentWeek = foodPacingMetrics.weeks.find(w => w.isCurrentWeek) || foodPacingMetrics.weeks[0];

  // Cálculo de média segura diária
  const safeDailyRemaining = Math.max(
    0,
    Math.round((foodPacingMetrics.operationalBudgetRemaining || 0) / daysRemaining)
  );

  // =========================================================================
  // ESTADO DO SIMULADOR DE DESTINAÇÃO PERCENTUAL DAS SOBRAS
  // =========================================================================
  const [selectedSourceCategory, setSelectedSourceCategory] = useState<CategoryKey | 'all'>('all');
  const availableAmountToAllocate = useMemo(() => {
    if (selectedSourceCategory === 'all') return totalSurplus;
    const cat = surplusCategories.find(c => c.key === selectedSourceCategory);
    return cat ? cat.remaining : 0;
  }, [selectedSourceCategory, totalSurplus, surplusCategories]);

  // Metas do casal ativas
  const activeGoals = useMemo(() => {
    return state.piggyBanks.filter(g => !g.completed);
  }, [state.piggyBanks]);

  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => {
    return activeGoals[0]?.id || state.piggyBanks[0]?.id || '';
  });

  // Percentuais configuráveis pelo casal
  const [percentages, setPercentages] = useState<{
    goal: number;
    protection: number;
    leisure: number;
    freedom: number;
  }>({
    goal: 50,
    protection: 25,
    leisure: 15,
    freedom: 10,
  });

  const totalAllocatedPercent = percentages.goal + percentages.protection + percentages.leisure + percentages.freedom;

  const handlePercentageChange = (key: keyof typeof percentages, value: number) => {
    const val = Math.max(0, Math.min(100, Math.round(value)));
    setPercentages(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  const applyPreset = (preset: { goal: number; protection: number; leisure: number; freedom: number }) => {
    setPercentages(preset);
  };

  const normalizeToHundred = () => {
    if (totalAllocatedPercent === 0) {
      setPercentages({ goal: 50, protection: 30, leisure: 20, freedom: 0 });
      return;
    }
    const factor = 100 / totalAllocatedPercent;
    const g = Math.round(percentages.goal * factor);
    const p = Math.round(percentages.protection * factor);
    const l = Math.round(percentages.leisure * factor);
    const f = Math.max(0, 100 - (g + p + l));
    setPercentages({ goal: g, protection: p, leisure: l, freedom: f });
  };

  // Valores em R$ calculados em tempo real
  const calculatedAmounts = useMemo(() => {
    const base = availableAmountToAllocate;
    return {
      goal: Math.round((base * (percentages.goal / 100)) * 100) / 100,
      protection: Math.round((base * (percentages.protection / 100)) * 100) / 100,
      leisure: Math.round((base * (percentages.leisure / 100)) * 100) / 100,
      freedom: Math.round((base * (percentages.freedom / 100)) * 100) / 100,
    };
  }, [availableAmountToAllocate, percentages]);

  // Projeção Interativa de Antecipação de Metas
  const selectedGoal = useMemo(() => {
    return state.piggyBanks.find(g => g.id === selectedGoalId) || activeGoals[0] || state.piggyBanks[0];
  }, [state.piggyBanks, selectedGoalId, activeGoals]);

  const goalAccelerationInsight = useMemo(() => {
    if (!selectedGoal || calculatedAmounts.goal <= 0) return null;
    const remainingToTarget = Math.max(0, selectedGoal.targetAmount - selectedGoal.currentAmount);
    if (remainingToTarget <= 0) return { daysSaved: 0, weeksSaved: 0, newPercent: 100 };

    // Estimativa do ritmo mensal médio para esta meta
    const monthlyRate = Math.max(200, (selectedGoal.targetAmount * 0.08)); // ou ~8% ao mês
    const daysSaved = Math.round((calculatedAmounts.goal / monthlyRate) * 30);
    const weeksSaved = Math.max(1, Math.round(daysSaved / 7));
    const newAmount = selectedGoal.currentAmount + calculatedAmounts.goal;
    const newPercent = Math.min(100, Math.round((newAmount / selectedGoal.targetAmount) * 100));

    return {
      daysSaved: Math.max(3, daysSaved),
      weeksSaved,
      newPercent,
      currentPercent: Math.round((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100),
      currentAmount: selectedGoal.currentAmount,
      newAmount,
    };
  }, [selectedGoal, calculatedAmounts.goal]);

  const handleExecuteDistribution = () => {
    if (availableAmountToAllocate <= 0) {
      showToast('Nenhuma sobra disponível nesta seleção.', 'info');
      return;
    }
    if (totalAllocatedPercent !== 100) {
      normalizeToHundred();
    }

    const allocations = [
      {
        targetType: 'goal' as const,
        targetGoalId: selectedGoal?.id,
        targetGoalName: selectedGoal?.name || 'Cofrinho de Metas',
        percentage: percentages.goal,
        amount: calculatedAmounts.goal,
      },
      {
        targetType: 'protection' as const,
        targetGoalName: 'Reserva de Emergência',
        percentage: percentages.protection,
        amount: calculatedAmounts.protection,
      },
      {
        targetType: 'leisure' as const,
        targetGoalName: 'Recompensa Livre do Casal',
        percentage: percentages.leisure,
        amount: calculatedAmounts.leisure,
      },
      {
        targetType: 'freedom' as const,
        targetGoalName: 'Bloco Liberdade',
        percentage: percentages.freedom,
        amount: calculatedAmounts.freedom,
      },
    ].filter(a => a.amount > 0);

    distributeSurplusPercentages(
      allocations,
      selectedSourceCategory === 'all' ? undefined : selectedSourceCategory
    );

    showToast(
      `Distribuição concluída! R$ ${formatCurrency(availableAmountToAllocate)} foram aplicados de acordo com os percentuais de vocês.`
    );
  };

  // =========================================================================
  // ESTADO DO PAINEL DE RESOULUÇÃO DE EXCESSOS (VASOS & PLANTÕES)
  // =========================================================================
  const [selectedBlownKey, setSelectedBlownKey] = useState<CategoryKey>(() => {
    return blownCategories[0]?.key || 'comida';
  });
  const [selectedDonorKey, setSelectedDonorKey] = useState<CategoryKey>(() => {
    return surplusCategories[0]?.key || 'transporte';
  });
  const [transferAmountInput, setTransferAmountInput] = useState<string>('');

  const targetBlownCategory = useMemo(() => {
    return blownCategories.find(c => c.key === selectedBlownKey) || blownCategories[0];
  }, [blownCategories, selectedBlownKey]);

  const targetDonorCategory = useMemo(() => {
    return surplusCategories.find(c => c.key === selectedDonorKey) || surplusCategories[0];
  }, [surplusCategories, selectedDonorKey]);

  // Sugestão de transferência que zera o furo sem ultrapassar a sobra do doador
  const maxPossibleTransfer = useMemo(() => {
    if (!targetBlownCategory || !targetDonorCategory) return 0;
    return Math.min(targetBlownCategory.overAmount, targetDonorCategory.remaining);
  }, [targetBlownCategory, targetDonorCategory]);

  const handleApplyVesselsTransfer = (amountToTransfer?: number) => {
    const finalAmount = amountToTransfer ?? Number(transferAmountInput || maxPossibleTransfer);
    if (!finalAmount || finalAmount <= 0) return;
    if (!targetDonorCategory || !targetBlownCategory) return;

    reallocateCategoryBudget(
      targetDonorCategory.key,
      targetBlownCategory.key,
      finalAmount,
      `Vaso Comunicante: ${targetDonorCategory.name} cobriu ${targetBlownCategory.name}`
    );

    setTransferAmountInput('');
    showToast(
      `Vasos nivelados! R$ ${formatCurrency(finalAmount)} transferidos de ${targetDonorCategory.name} para equilibrar ${targetBlownCategory.name}.`
    );
  };

  // Plantões médicos disponíveis para compensação
  const candidateMedicalShifts = useMemo(() => {
    return (state.medicalShifts || []).filter(s => {
      // Plantões do mês corrente
      return s.dateWorked.startsWith(state.currentMonth);
    });
  }, [state.medicalShifts, state.currentMonth]);

  const handleApplyShiftCover = (shiftId: string, amount: number) => {
    if (!targetBlownCategory) return;
    coverExpenseDeficitWithShift(shiftId, targetBlownCategory.key, amount);
    showToast(
      `Furo de ${targetBlownCategory.name} amortizado com o plantão médico selecionado!`
    );
  };

  const handleApplyRecalibration = () => {
    triggerCelebration();
    showToast(
      `Ritmo diário recalibrado para ${formatCurrency(safeDailyRemaining)}/dia nos próximos ${daysRemaining} dias.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast de Notificação de Feedback */}
      {feedbackToast && (
        <div className={`p-4 rounded-2xl text-white font-bold text-xs flex items-center justify-between shadow-lg transition-all ${
          feedbackToast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{feedbackToast.message}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-white/80 hover:text-white font-bold text-xs cursor-pointer ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO CONSOLIDADO: BALANÇO DE SOBRAS, EXCESSOS & RITMO DIÁRIO              */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center text-2xl font-black">
                🌿
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white font-display">
                  Hub de Sobras, Ritmo &amp; Vasos Comunicantes
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-0.5">
                  <span>{state.profile.partner1Name} &amp; {state.profile.partner2Name}</span>
                  <span aria-hidden="true">·</span>
                  <span>Semana {currentWeek.weekNumber} de 4</span>
                  <span aria-hidden="true">·</span>
                  <span>{daysRemaining} dias restantes</span>
                </div>
              </div>
            </div>

            {/* Status Indicador de Equilíbrio Geral */}
            <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${
              blownCategories.length === 0
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${blownCategories.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>
                {blownCategories.length === 0
                  ? 'Ritmo 100% Equilibrado'
                  : `${blownCategories.length} categoria(s) para nivelar`}
              </span>
            </div>
          </div>

          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Sobra Acumulada */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Sobra Total nas Categorias
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                {formatCurrency(totalSurplus)}
              </div>
              <p className="text-[11px] text-slate-400">
                {surplusCategories.length} categoria(s) com folga neste mês
              </p>
            </div>

            {/* 2. Excessos a Compensar */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Furos / Excessos a Compensar
              </span>
              <div className={`text-xl sm:text-2xl font-black tabular-nums ${totalOver > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {formatCurrency(totalOver)}
              </div>
              <p className="text-[11px] text-slate-400">
                {blownCategories.length > 0 ? 'Nivelável via Vasos ou Plantões' : 'Nenhum excesso ativo'}
              </p>
            </div>

            {/* 3. Ritmo Diário Seguro */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Média Segura Restante
              </span>
              <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                {formatCurrency(safeDailyRemaining)}
                <span className="text-xs font-normal text-slate-400 ml-1">/dia</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Para manter as contas no azul até o fim do mês
              </p>
            </div>
          </div>

          {/* Switcher de Abas do Hub */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-white/10 border border-white/10 pt-1">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulador de Sobras (%)</span>
            </button>

            <button
              onClick={() => setActiveTab('vessels')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                activeTab === 'vessels'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Vasos &amp; Plantões</span>
              {blownCategories.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center ml-1">
                  {blownCategories.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'insights'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pacing &amp; Sugestões</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Histórico ({surplusTransfers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: SIMULADOR INTERATIVO DE DIVISÃO PERCENTUAL DE SOBRAS               */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {totalSurplus <= 0 ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center text-2xl font-black">
                🌱
              </span>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma sobra disponível para direcionamento no momento
                </h4>
                <p className="text-xs text-slate-500">
                  Assim que alguma categoria de gastos fechar abaixo do previsto ou vocês registrarem receitas extras, as sobras aparecerão automaticamente aqui para simulação!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Header do Simulador */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-lg font-black text-slate-950 dark:text-white font-display">
                      Simulador de Destinação Percentual
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Definam exatamente quantos por cento da sobra vai para cada pote dos sonhos de vocês.
                  </p>
                </div>

                {/* Seletor da Fonte da Sobra */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Fonte:</span>
                  <select
                    value={selectedSourceCategory}
                    onChange={e => setSelectedSourceCategory(e.target.value as any)}
                    aria-label="Selecionar categoria de origem da sobra"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="all">Todas as Categorias ({formatCurrency(totalSurplus)})</option>
                    {surplusCategories.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.emoji} {cat.name} ({formatCurrency(cat.remaining)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botões Rápidos de Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Atalhos de Proporção para Casais:</span>
                  <button
                    onClick={normalizeToHundred}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Ajustar Soma para 100%
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset({ goal: 50, protection: 25, leisure: 15, freedom: 10 })}
                    className="p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white block">Equilibrado</span>
                    <span className="text-[10px] text-slate-500">50% Sonhos · 25% Reserva</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset({ goal: 70, protection: 15, leisure: 10, freedom: 5 })}
                    className="p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white block">Aceleração Total</span>
                    <span className="text-[10px] text-slate-500">70% na Caixinha Alvo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset({ goal: 20, protection: 60, leisure: 15, freedom: 5 })}
                    className="p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white block">Reserva Turbo</span>
                    <span className="text-[10px] text-slate-500">60% Blindagem Inicial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset({ goal: 30, protection: 20, leisure: 40, freedom: 10 })}
                    className="p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white block">Recompensa Livre</span>
                    <span className="text-[10px] text-slate-500">40% Lazer Sem Culpa</span>
                  </button>
                </div>
              </div>

              {/* 4 Sliders Interativos de Destinação */}
              <div className="space-y-4 pt-2">
                {/* 1. Caixinha / Meta Prioritária */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                        1. Caixinha dos Sonhos / Meta do Casal
                      </span>
                    </div>

                    {/* Seletor de Meta */}
                    {activeGoals.length > 0 && (
                      <select
                        value={selectedGoalId}
                        onChange={e => setSelectedGoalId(e.target.value)}
                        aria-label="Selecionar meta para receber sobra"
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white"
                      >
                        {activeGoals.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.emoji || '🎯'} {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={percentages.goal}
                      onChange={e => handlePercentageChange('goal', Number(e.target.value))}
                      aria-label="Porcentagem para Caixinha dos Sonhos"
                      className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <div className="w-24 text-right">
                      <span className="text-base font-black text-slate-950 dark:text-white tabular-nums">
                        {percentages.goal}%
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block tabular-nums">
                        {formatCurrency(calculatedAmounts.goal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Reserva de Emergência */}
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        2. Colchão da Reserva de Emergência
                      </span>
                    </div>
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Blindagem financeira
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={percentages.protection}
                      onChange={e => handlePercentageChange('protection', Number(e.target.value))}
                      aria-label="Porcentagem para Reserva de Emergência"
                      className="flex-1 accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <div className="w-24 text-right">
                      <span className="text-base font-black text-slate-950 dark:text-white tabular-nums">
                        {percentages.protection}%
                      </span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block tabular-nums">
                        {formatCurrency(calculatedAmounts.protection)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Recompensa Livre do Casal / Lazer sem Culpa */}
                <div className="p-4 rounded-2xl bg-pink-50/60 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-pink-900 dark:text-pink-200">
                        3. Recompensa do Casal (Lazer Livre sem Culpa)
                      </span>
                    </div>
                    <span className="text-xs text-pink-700 dark:text-pink-300 font-medium">
                      Jantar a dois ou respiro
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={percentages.leisure}
                      onChange={e => handlePercentageChange('leisure', Number(e.target.value))}
                      aria-label="Porcentagem para Recompensa do Casal"
                      className="flex-1 accent-pink-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <div className="w-24 text-right">
                      <span className="text-base font-black text-slate-950 dark:text-white tabular-nums">
                        {percentages.leisure}%
                      </span>
                      <span className="text-xs font-bold text-pink-600 dark:text-pink-400 block tabular-nums">
                        {formatCurrency(calculatedAmounts.leisure)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Bloco Liberdade / Futuro */}
                <div className="p-4 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-violet-900 dark:text-violet-200">
                        4. Bloco Liberdade Financeira (FIRE)
                      </span>
                    </div>
                    <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">
                      Independência do casal
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={percentages.freedom}
                      onChange={e => handlePercentageChange('freedom', Number(e.target.value))}
                      aria-label="Porcentagem para Bloco Liberdade"
                      className="flex-1 accent-violet-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <div className="w-24 text-right">
                      <span className="text-base font-black text-slate-950 dark:text-white tabular-nums">
                        {percentages.freedom}%
                      </span>
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400 block tabular-nums">
                        {formatCurrency(calculatedAmounts.freedom)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status de Soma dos Percentuais */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${totalAllocatedPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Soma das alocações: <strong>{totalAllocatedPercent}%</strong>
                  </span>
                  {totalAllocatedPercent !== 100 && (
                    <span className="text-xs text-amber-600 font-semibold hidden sm:inline">
                      ({totalAllocatedPercent < 100 ? `Faltam ${100 - totalAllocatedPercent}%` : `Ultrapassou em ${totalAllocatedPercent - 100}%`})
                    </span>
                  )}
                </div>

                {totalAllocatedPercent !== 100 && (
                  <button
                    type="button"
                    onClick={normalizeToHundred}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                  >
                    Equilibrar em 100%
                  </button>
                )}
              </div>

              {/* PROJEÇÃO DINÂMICA DE ANTECIPAÇÃO DA META */}
              {goalAccelerationInsight && selectedGoal && (
                <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                        Impacto Vivo no Sonho do Casal
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20">
                      +{goalAccelerationInsight.daysSaved} dias antecipados
                    </span>
                  </div>

                  <h5 className="text-sm sm:text-base font-black">
                    Ao direcionar {percentages.goal}% ({formatCurrency(calculatedAmounts.goal)}) para "{selectedGoal.name}", vocês antecipam a conquista em cerca de {goalAccelerationInsight.weeksSaved} semana{goalAccelerationInsight.weeksSaved > 1 ? 's' : ''}!
                  </h5>

                  {/* Barra comparativa de progresso */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-emerald-100 font-bold">
                      <span>Progresso: {goalAccelerationInsight.currentPercent}%</span>
                      <span className="text-white font-black">→ {goalAccelerationInsight.newPercent}% com esta sobra</span>
                    </div>
                    <div className="h-2.5 w-full bg-black/20 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-500"
                        style={{ width: `${goalAccelerationInsight.newPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botão de Ação Principal */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteDistribution}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all text-white font-black text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>Consolidar Distribuição de {formatCurrency(availableAmountToAllocate)} &amp; Celebrar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: VASOS COMUNICANTES & COMPENSAÇÃO POR PLANTÃO EXTRA                 */}
      {/* ========================================================================= */}
      {activeTab === 'vessels' && (
        <div className="space-y-6">
          {blownCategories.length === 0 ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 inline-flex items-center justify-center text-2xl font-black">
                ✨
              </span>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Todas as categorias estão sob controle!
                </h4>
                <p className="text-xs text-slate-500">
                  Nenhum excesso identificado neste mês. Caso alguma área precise de reforço em semanas de plantão pesado, os vasos comunicantes e opções de plantão extra estarão prontos para nivelar o orçamento.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Radar Empático */}
              <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 flex items-center justify-center text-xl shrink-0">
                    🤝
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-amber-950 dark:text-amber-100">
                      Rotina médica puxada? Vamos nivelar sem julgamentos!
                    </h4>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed">
                      Semanas de plantões intensos, congressos ou imprevistos exigem flexibilidade. Vocês têm <strong>{formatCurrency(totalOver)}</strong> em categorias que pedem equilíbrio. Escolham a ferramenta mais prática abaixo:
                    </p>
                  </div>
                </div>

                {/* 1. VASOS COMUNICANTES VISUAIS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        Mecanismo 1: Vasos Comunicantes (Transferência entre Categorias)
                      </h5>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Nivela saldo positivo com saldo devedor
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Categoria com Excesso (Destino) */}
                    <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                        Categoria a Compensar:
                      </span>
                      <select
                        value={selectedBlownKey}
                        onChange={e => setSelectedBlownKey(e.target.value as any)}
                        aria-label="Selecionar categoria com excesso a compensar"
                        className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-slate-900 dark:text-white"
                      >
                        {blownCategories.map(c => (
                          <option key={c.key} value={c.key}>
                            {c.emoji} {c.name} (+{formatCurrency(c.overAmount)})
                          </option>
                        ))}
                      </select>
                      {targetBlownCategory && (
                        <div className="text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                          <span>Gasto além do teto:</span>
                          <strong className="tabular-nums">+{formatCurrency(targetBlownCategory.overAmount)}</strong>
                        </div>
                      )}
                    </div>

                    {/* Categoria com Sobra (Origem) */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Categoria Doadora (com Sobra):
                      </span>
                      {surplusCategories.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          Nenhuma categoria com sobra ativa no momento. Usem a opção de Plantão Extra abaixo!
                        </p>
                      ) : (
                        <>
                          <select
                            value={selectedDonorKey}
                            onChange={e => setSelectedDonorKey(e.target.value as any)}
                            aria-label="Selecionar categoria doadora com sobra"
                            className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white"
                          >
                            {surplusCategories.map(c => (
                              <option key={c.key} value={c.key}>
                                {c.emoji} {c.name} (Sobra de {formatCurrency(c.remaining)})
                              </option>
                            ))}
                          </select>
                          {targetDonorCategory && (
                            <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                              <span>Disponível para doar:</span>
                              <strong className="tabular-nums">{formatCurrency(targetDonorCategory.remaining)}</strong>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ação de Nivelamento */}
                  {targetDonorCategory && targetBlownCategory && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Transferência sugerida: <strong>{formatCurrency(maxPossibleTransfer)}</strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyVesselsTransfer(maxPossibleTransfer)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Nivelar Vasos com 1 Toque ({formatCurrency(maxPossibleTransfer)})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. COMPENSAÇÃO POR PLANTÃO EXTRA */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        Mecanismo 2: Compensação Direta por Plantão Médico Extra
                      </h5>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Amortiza o excesso com rendimentos de escala
                    </span>
                  </div>

                  {candidateMedicalShifts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 flex items-center justify-between">
                      <span>Nenhum plantão médico registrado neste mês.</span>
                      <button
                        onClick={() => onOpenExpenseModal()}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Registrar na aba Plantões →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">
                        Vincule um plantão do mês para absorver o furo em {targetBlownCategory?.name}:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {candidateMedicalShifts.slice(0, 4).map(shift => (
                          <div
                            key={shift.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <strong className="text-slate-900 dark:text-white block">
                                {shift.hospitalName}
                              </strong>
                              <span className="text-[11px] text-slate-500">
                                {shift.dateWorked} · {shift.durationHours}h · {formatCurrency(shift.netAmount || shift.grossAmount)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleApplyShiftCover(shift.id, targetBlownCategory?.overAmount || 100)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                            >
                              Amortizar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. RECALIBRAGEM SUAVE DO LIMITE DIÁRIO */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Mecanismo 3: Recalibragem de Ritmo
                    </span>
                    <div className="text-base font-black text-slate-950 dark:text-white">
                      Média diária segura ajustada para: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(safeDailyRemaining)}/dia</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyRecalibration}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalibrar Média dos {daysRemaining} Dias</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: PACING DE ABASTECIMENTO (COMIDA) & SUGESTÕES PREDITIVAS             */}
      {/* ========================================================================= */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Sugestões Contextuais */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                  Sugestões da IA para Alocação de Sobras
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {aiPredictiveInsights.length} ativa(s)
              </span>
            </div>

            <AIPredictiveInsightsCard
              onNavigateToGoals={onNavigateToGoals}
              onOpenExpenseModal={onOpenExpenseModal}
            />
          </div>

          {/* Inteligência de Comida */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <div>
                  <h4 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                    Inteligência de Abastecimento &amp; Pacing de Comida
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Separação dos 3 pilares (Estrutural, Rotina e Conveniência) e semanas
                  </p>
                </div>
              </div>
            </div>

            <FoodPacingWeeklyCard
              onOpenExpenseModal={() => onOpenExpenseModal('comida')}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: HISTÓRICO DE AUDITORIA & MOVIMENTAÇÕES DE SOBRAS                   */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-base font-black text-slate-950 dark:text-white">
                Histórico de Realocações do Casal
              </h4>
              <p className="text-xs text-slate-500">
                Auditoria de todas as transferências, vasos comunicantes e aportes derivados de sobras
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {surplusTransfers.length} registro(s)
            </span>
          </div>

          {surplusTransfers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhuma movimentação de sobra registrada ainda. Conforme vocês utilizarem o Simulador ou os Vasos Comunicantes, o histórico completo ficará registrado aqui.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {surplusTransfers.map(tr => (
                <div key={tr.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {tr.targetGoalName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {tr.targetType === 'category' ? '· Vaso Comunicante' : tr.targetType === 'shift_offset' ? '· Plantão Extra' : '· Destinação Percentual'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {tr.note || 'Transferência realizada'} · {tr.date}
                    </p>
                  </div>

                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{formatCurrency(tr.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
