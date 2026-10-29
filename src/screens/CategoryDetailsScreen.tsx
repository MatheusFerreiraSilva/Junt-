import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Edit2,
  Plus,
  Filter,
  Check,
  AlertTriangle,
  CreditCard,
  User,
  Users,
  Percent,
  Sliders,
  ShieldCheck,
  Target,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE, getCategoryInfo } from '../context/FinanceContext';
import { CategoryKey, ExpenseItem, PaidBy, FundingSourceType } from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { MonthSelector } from '../components/MonthSelector';
import { FoodPacingWeeklyCard } from '../components/FoodPacingWeeklyCard';

interface CategoryDetailsScreenProps {
  initialCategory?: CategoryKey;
  onOpenExpenseModal: (category?: CategoryKey) => void;
}

export const CategoryDetailsScreen: React.FC<CategoryDetailsScreenProps> = ({
  initialCategory,
  onOpenExpenseModal,
}) => {
  const {
    state,
    categoriesSpending,
    deleteExpense,
    editExpense,
    activeInstallments,
    getExpenseSplit,
    viewMode,
    monthlySpendingTotals,
    updateCategoryPercentages,
    activeLifeTier,
    totalIncome,
  } = useFinance();

  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    initialCategory || 'all'
  );
  const [filterPaidBy, setFilterPaidBy] = useState<PaidBy | 'all'>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'routine' | 'planned' | 'exceptional'>('all');
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isSimulatingCeiling, setIsSimulatingCeiling] = useState(false);

  // Ceiling simulation state initialized from current percentages
  const [simulatedPercentages, setSimulatedPercentages] = useState<Record<CategoryKey, number>>(() => ({
    moradia: state.categoryPercentages?.moradia ?? activeLifeTier.percentages.moradia ?? 30,
    transporte: state.categoryPercentages?.transporte ?? activeLifeTier.percentages.transporte ?? 10,
    comida: state.categoryPercentages?.comida ?? activeLifeTier.percentages.comida ?? 15,
    lazer: state.categoryPercentages?.lazer ?? activeLifeTier.percentages.lazer ?? 10,
    protecao: state.categoryPercentages?.protecao ?? activeLifeTier.percentages.protecao ?? 10,
    profissional: state.categoryPercentages?.profissional ?? activeLifeTier.percentages.profissional ?? 5,
  }));

  const openCeilingSimulation = () => {
    setSimulatedPercentages({
      moradia: state.categoryPercentages?.moradia ?? activeLifeTier.percentages.moradia ?? 30,
      transporte: state.categoryPercentages?.transporte ?? activeLifeTier.percentages.transporte ?? 10,
      comida: state.categoryPercentages?.comida ?? activeLifeTier.percentages.comida ?? 15,
      lazer: state.categoryPercentages?.lazer ?? activeLifeTier.percentages.lazer ?? 10,
      protecao: state.categoryPercentages?.protecao ?? activeLifeTier.percentages.protecao ?? 10,
      profissional: state.categoryPercentages?.profissional ?? activeLifeTier.percentages.profissional ?? 5,
    });
    setIsSimulatingCeiling(true);
  };

  const handleApplySimulatedCeilings = () => {
    updateCategoryPercentages(simulatedPercentages);
    setIsSimulatingCeiling(false);
  };

  // Month's manual expenses
  const monthExpenses = useMemo(() => {
    return state.expenses.filter(e => {
      if (!e.date.startsWith(state.currentMonth)) return false;
      if (viewMode === 'partner1') return e.paidBy === 'partner1' || e.paidBy === 'both';
      if (viewMode === 'partner2') return e.paidBy === 'partner2' || e.paidBy === 'both';
      return true;
    });
  }, [state.expenses, state.currentMonth, viewMode]);

  // Discover any legacy or unmapped categories in the expenses list
  const legacyCategoryKeys = useMemo(() => {
    const keys = new Set<string>();
    monthExpenses.forEach(e => {
      if (e.category && !CATEGORIES_BASE[e.category as CategoryKey]) {
        keys.add(e.category);
      }
    });
    return Array.from(keys);
  }, [monthExpenses]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return monthExpenses.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchPaid =
        filterPaidBy === 'all'
          ? true
          : filterPaidBy === 'both'
          ? item.paidBy === 'both' || item.paidBy === 'custom'
          : item.paidBy === filterPaidBy;

      const source = item.fundingSource || 'month_budget';
      const matchScope =
        filterScope === 'all'
          ? true
          : filterScope === 'routine'
          ? source === 'month_budget' && !item.isExcludedFromMonthlyBudget
          : filterScope === 'planned'
          ? source === 'piggy_bank'
          : source === 'reserve_excess' || item.amount >= 500;

      return matchCat && matchPaid && matchScope;
    });
  }, [monthExpenses, selectedCategory, filterPaidBy, filterScope]);

  // Active installments in this category for this month
  const categoryInstallments = useMemo(() => {
    return activeInstallments.filter(
      inst => selectedCategory === 'all' || inst.category === selectedCategory
    );
  }, [activeInstallments, selectedCategory]);

  // Category diagnostic breakdown (routine, planned, exceptional)
  const categoryDiagnostics = useMemo(() => {
    const targetExpenses = monthExpenses.filter(
      e => selectedCategory === 'all' || e.category === selectedCategory
    );

    const routine = targetExpenses.filter(
      e => !e.isExcludedFromMonthlyBudget && (!e.fundingSource || e.fundingSource === 'month_budget')
    );
    const planned = targetExpenses.filter(e => e.fundingSource === 'piggy_bank');
    const exceptional = targetExpenses.filter(
      e => e.fundingSource === 'reserve_excess' || e.amount >= 500
    );

    const routineSum = routine.reduce((s, e) => s + e.amount, 0);
    const plannedSum = planned.reduce((s, e) => s + e.amount, 0);
    const exceptionalSum = exceptional.reduce((s, e) => s + e.amount, 0);

    // Identify single largest expense that pressured the budget
    const sorted = [...targetExpenses].sort((a, b) => b.amount - a.amount);
    const topExpense = sorted[0] || null;

    return {
      routineSum,
      plannedSum,
      exceptionalSum,
      topExpense,
      count: targetExpenses.length,
    };
  }, [monthExpenses, selectedCategory]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    editExpense(editingExpense);
    setEditingExpense(null);
  };

  const currentCategoryInfo = selectedCategory !== 'all' ? getCategoryInfo(selectedCategory) : null;
  const currentCategorySpend =
    selectedCategory !== 'all' && (selectedCategory in categoriesSpending)
      ? categoriesSpending[selectedCategory as CategoryKey]
      : null;

  return (
    <div className="space-y-6 pb-20">
      <MonthSelector />

      {/* Screen Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Gastos por Categoria, Fontes & Divisão
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Acompanhe o consumo econômico real, a blindagem das caixinhas e a divisão justa do casal.
          </p>
        </div>

        <button
          onClick={openCeilingSimulation}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Simular Remanejamento de Teto</span>
        </button>
      </div>

      {/* TRÊS TOTAIS CANÔNICOS DISTINTOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Despesa Econômica Total */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1.5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🌐</span> Despesa Econômica Total
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Vida Real
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-display">
            {formatCurrency(monthlySpendingTotals.totalEconomicSpent)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Consumo total da vida do casal (inclui rotina, metas/cofrinhos, reserva e parcelas ativas).
          </p>
        </div>

        {/* 2. Consumo do Orçamento Rotineiro */}
        <div className="p-4 sm:p-5 rounded-3xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 shadow-xs space-y-1.5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯</span> Consumo do Orçamento
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              Tetos do Mês
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-900 dark:text-teal-100 tabular-nums font-display">
            {formatCurrency(monthlySpendingTotals.budgetConsumedSpent)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Débito estrito sobre os tetos mensais. Gastos de caixinhas ou da reserva estão blindados.
          </p>
        </div>

        {/* 3. Saída Efetiva de Caixa */}
        <div className="p-4 sm:p-5 rounded-3xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 shadow-xs space-y-1.5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>💸</span> Saída de Caixa
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Contas & Pix
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100 tabular-nums font-display">
            {formatCurrency(monthlySpendingTotals.cashOutflowSpent)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Valores liquidados à vista (Pix, débito e dinheiro), que baixaram o saldo bancário imediato.
          </p>
        </div>
      </div>

      {/* Category Filter Tabs with safe fallback for legacy categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          ✨ Todas as Áreas
        </button>

        {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
          const cat = getCategoryInfo(key);
          const isSelected = selectedCategory === key;
          const spend = categoriesSpending[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-accent-primary text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
              {spend?.isOver && <span className="text-rose-400">⚠️</span>}
            </button>
          );
        })}

        {/* Legacy / unmapped categories tab if any exist in data */}
        {legacyCategoryKeys.map(key => {
          const cat = getCategoryInfo(key);
          const isSelected = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${
                isSelected
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Comparative Progress Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-accent-surface text-accent-primary flex items-center justify-center text-lg font-bold">
              📊
            </span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
                Gráfico Comparativo de Gastos por Área
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe o consumo e o limite combinado de cada categoria neste mês
              </p>
            </div>
          </div>
        </div>

        {/* Visual Progress Bars */}
        <div className="space-y-3 pt-2">
          {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
            const cat = getCategoryInfo(key);
            const spend = categoriesSpending[key];
            const pct = Math.min(100, spend?.percentageUsed || 0);

            return (
              <div
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  selectedCategory === key
                    ? 'border-accent-primary bg-accent-surface/50 shadow-2xs'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.emoji}</span>
                    <span className="text-slate-900 dark:text-white font-display">{cat.name}</span>
                    {spend?.isOver && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        ⚠️ +{formatCurrency(spend.spent - spend.budget)}
                      </span>
                    )}
                  </div>

                  <div className="text-right tabular-nums">
                    <span className="text-slate-900 dark:text-white font-extrabold">
                      {formatCurrency(spend?.spent || 0)}
                    </span>
                    <span className="text-slate-400 font-normal text-[11px] ml-1">
                      / {formatCurrency(spend?.budget || 0)} ({spend?.percentageUsed || 0}%)
                    </span>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      spend?.isOver ? 'bg-rose-500' : 'bg-accent-primary'
                    }`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: !spend?.isOver ? cat.colorHex : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Category Header & Diagnostic */}
      {selectedCategory !== 'all' && currentCategoryInfo && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentCategoryInfo.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                    {currentCategoryInfo.name}
                  </h3>
                  {currentCategoryInfo.isLegacy && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Revisão Necessária
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentCategoryInfo.description}
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenExpenseModal((selectedCategory in CATEGORIES_BASE) ? (selectedCategory as CategoryKey) : undefined)}
              className="btn-primary-accent flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Gasto Aqui
            </button>
          </div>

          {/* Metric Bar */}
          {currentCategorySpend && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Combinado do mês</span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(currentCategorySpend.budget)}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Consumo do orçamento</span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(currentCategorySpend.spent)}
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border ${
                  currentCategorySpend.isOver
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                    : 'bg-accent-surface border-accent-themed text-accent-themed'
                }`}
              >
                <span className="text-xs font-medium opacity-90">
                  {currentCategorySpend.isOver ? '⚠️ Passou do combinado' : 'Ainda podem gastar'}
                </span>
                <div className="text-lg font-extrabold tabular-nums">
                  {formatCurrency(Math.abs(currentCategorySpend.remaining))}
                </div>
              </div>
            </div>
          )}

          {/* DIAGNÓSTICO POR CATEGORIA: Rotina vs Planejado vs Excepcional */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🩺</span> Diagnóstico de Natureza do Gasto
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="font-semibold text-slate-500 dark:text-slate-400">Rotina (Debita Teto)</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm tabular-nums mt-0.5">
                  {formatCurrency(categoryDiagnostics.routineSum)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Metas / Caixinhas
                </div>
                <div className="font-bold text-teal-700 dark:text-teal-300 text-sm tabular-nums mt-0.5">
                  {formatCurrency(categoryDiagnostics.plannedSum)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Excepcional / Reserva
                </div>
                <div className="font-bold text-amber-700 dark:text-amber-300 text-sm tabular-nums mt-0.5">
                  {formatCurrency(categoryDiagnostics.exceptionalSum)}
                </div>
              </div>
            </div>

            {/* Destaque do registro que causou desvio */}
            {currentCategorySpend?.isOver && categoryDiagnostics.topExpense && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Principal causador da pressão no orçamento: </span>
                  "{categoryDiagnostics.topExpense.description}" ({formatCurrency(categoryDiagnostics.topExpense.amount)}) em {categoryDiagnostics.topExpense.date.split('-').reverse().join('/')}.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Special card for Comida & Conveniência */}
      {selectedCategory === 'comida' && (
        <FoodPacingWeeklyCard onOpenExpenseModal={() => onOpenExpenseModal('comida')} />
      )}

      {/* Filters bar: Payer and Scope */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs transition-colors">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
            <Filter className="w-3.5 h-3.5 text-accent-primary" />
            Divisão do casal:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterPaidBy('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                filterPaidBy === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterPaidBy('both')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                filterPaidBy === 'both'
                  ? 'bg-purple-700 text-white'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60'
              }`}
            >
              <Users className="w-3 h-3" />
              Em Conjunto
            </button>
            <button
              onClick={() => setFilterPaidBy('partner1')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                filterPaidBy === 'partner1'
                  ? 'bg-accent-primary text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-3 h-3" />
              Só {state.profile.partner1Name}
            </button>
            <button
              onClick={() => setFilterPaidBy('partner2')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                filterPaidBy === 'partner2'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60'
              }`}
            >
              <User className="w-3 h-3" />
              Só {state.profile.partner2Name}
            </button>
          </div>
        </div>

        {/* Nature of expenditure filter (Rotina, Metas, Excepcional) */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs px-1">
          <span className="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Natureza:</span>
          <button
            onClick={() => setFilterScope('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
              filterScope === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas as Fontes
          </button>
          <button
            onClick={() => setFilterScope('routine')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
              filterScope === 'routine'
                ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🟢 Orçamento Rotina
          </button>
          <button
            onClick={() => setFilterScope('planned')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
              filterScope === 'planned'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🎯 Caixinhas / Metas
          </button>
          <button
            onClick={() => setFilterScope('exceptional')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
              filterScope === 'exceptional'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            ⚡ Excepcional / Reserva
          </button>
        </div>
      </div>

      {/* Active Installments section in this category */}
      {categoryInstallments.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-800 dark:text-amber-400" />
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Parcelas que entram automaticamente neste mês
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {categoryInstallments.map(inst => {
              const cat = getCategoryInfo(inst.category);
              const split = getExpenseSplit(
                inst.installmentAmount,
                inst.paidBy,
                inst.splitPartner1Pct,
                inst.splitPartner2Pct
              );

              return (
                <div
                  key={inst.id}
                  className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{cat.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{inst.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {inst.paidInstallmentsCount}/{inst.installmentsCount} parcelas · {split.label}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-bold text-amber-900 dark:text-amber-300 tabular-nums">
                    {formatCurrency(inst.installmentAmount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List of Direct Expenses */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
            Lançamentos ({filteredExpenses.length})
          </h3>
          <button
            onClick={() => onOpenExpenseModal((selectedCategory in CATEGORIES_BASE) ? (selectedCategory as CategoryKey) : undefined)}
            className="flex items-center gap-1 text-xs font-bold text-accent-themed hover:underline transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Gasto
          </button>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <span className="text-3xl block">🍃</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum gasto anotado com esse filtro</p>
            <p className="text-xs text-slate-400">
              Use o botão GASTEI para registrar compras em menos de 10 segundos!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredExpenses.map(item => {
              const cat = getCategoryInfo(item.category);
              const split = getExpenseSplit(
                item.amount,
                item.paidBy,
                item.splitPartner1Pct,
                item.splitPartner2Pct
              );

              const isFundedByPiggy = item.fundingSource === 'piggy_bank';
              const isFundedByReserve = item.fundingSource === 'reserve_excess';

              return (
                <div
                  key={item.id}
                  className="py-3.5 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-lg shrink-0">
                      {cat.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {item.description}
                        </span>
                        {cat.isLegacy && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                            Revisar
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{cat.name}</span>
                        <span>·</span>
                        <span>{item.date.split('-').reverse().join('/')}</span>
                        <span>·</span>

                        {/* Badges de Fonte de Financiamento */}
                        {isFundedByPiggy && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                            <span>🎯</span>
                            {item.fundingGoalName || 'Caixinha'}
                          </span>
                        )}
                        {isFundedByReserve && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <span>🛡️</span>
                            Excesso Reserva
                          </span>
                        )}

                        {/* Who Paid Badge */}
                        {item.paidBy === 'partner1' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-surface text-accent-themed border border-accent-themed">
                            Só {state.profile.partner1Name} (100%)
                          </span>
                        ) : item.paidBy === 'partner2' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Só {state.profile.partner2Name} (100%)
                          </span>
                        ) : item.paidBy === 'custom' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <span>⚖️</span>
                            {split.partner1Pct}% {state.profile.partner1Name} ({formatCurrency(split.partner1Amount)}) · {split.partner2Pct}% {state.profile.partner2Name} ({formatCurrency(split.partner2Amount)})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <span>🤝</span>
                            Casal 50/50 ({formatCurrency(split.partner1Amount)} cada)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tabular-nums">
                        {formatCurrency(item.amount)}
                      </div>
                      {split.isSplit && (
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(split.partner1Amount)} + {formatCurrency(split.partner2Amount)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingExpense(item)}
                        className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                        title="Editar gasto ou divisão"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteExpense(item.id)}
                        className="w-8 h-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                        title="Excluir gasto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Simular Remanejamento de Tetos */}
      {isSimulatingCeiling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
                  ⚖️
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
                    Simulador de Remanejamento de Tetos
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ajuste os limites das categorias para o mês sem inventar gastos artificiais.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulatingCeiling(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
                const cat = getCategoryInfo(key);
                const currentPct = simulatedPercentages[key] ?? 0;
                const spend = categoriesSpending[key];
                const simBudget = (totalIncome * currentPct) / 100;
                const simRemaining = simBudget - spend.spent;
                const isOver = simRemaining < 0;

                return (
                  <div
                    key={key}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isOver
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold tabular-nums">
                        <span className="text-slate-500">Teto: {formatCurrency(simBudget)}</span>
                        <span className={isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {isOver ? `Estouro: ${formatCurrency(Math.abs(simRemaining))}` : `Sobra: ${formatCurrency(simRemaining)}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSimulatedPercentages(prev => ({
                            ...prev,
                            [key]: Math.max(0, currentPct - 1),
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center justify-center shrink-0"
                      >
                        -1%
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={currentPct}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSimulatedPercentages(prev => ({
                            ...prev,
                            [key]: val,
                          }));
                        }}
                        className="w-full accent-amber-600"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setSimulatedPercentages(prev => ({
                            ...prev,
                            [key]: currentPct + 1,
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center justify-center shrink-0"
                      >
                        +1%
                      </button>

                      <span className="w-12 text-right font-black text-xs text-slate-900 dark:text-white tabular-nums shrink-0">
                        {currentPct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total percentage indicator */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-between font-bold">
              <span className="text-slate-600 dark:text-slate-300">Total de Despesas Alocado:</span>
              <span className="text-slate-900 dark:text-white tabular-nums">
                {Object.values(simulatedPercentages).reduce((a, b) => a + b, 0)}%
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSimulatedPercentages({
                    moradia: activeLifeTier.percentages.moradia || 30,
                    transporte: activeLifeTier.percentages.transporte || 10,
                    comida: activeLifeTier.percentages.comida || 15,
                    lazer: activeLifeTier.percentages.lazer || 10,
                    protecao: activeLifeTier.percentages.protecao || 10,
                    profissional: activeLifeTier.percentages.profissional || 5,
                  });
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Restaurar Padrão do Degrau
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimulatingCeiling(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplySimulatedCeilings}
                  className="btn-primary-accent px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                >
                  Confirmar Novos Tetos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal with Percentage, Funding Source and Payer Controls */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">
              Editar Gasto, Fonte & Divisão
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editingExpense.description}
                  onChange={e =>
                    setEditingExpense({ ...editingExpense, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingExpense.amount}
                  onChange={e =>
                    setEditingExpense({
                      ...editingExpense,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Área / Categoria
                </label>
                <select
                  value={editingExpense.category}
                  onChange={e =>
                    setEditingExpense({
                      ...editingExpense,
                      category: e.target.value as CategoryKey,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent-primary"
                >
                  {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => (
                    <option key={key} value={key}>
                      {CATEGORIES_BASE[key].emoji} {CATEGORIES_BASE[key].name}
                    </option>
                  ))}
                  {/* Option for legacy category if currently selected */}
                  {editingExpense.category && !CATEGORIES_BASE[editingExpense.category as CategoryKey] && (
                    <option value={editingExpense.category}>
                      🏷️ {editingExpense.category} (Legada)
                    </option>
                  )}
                </select>
              </div>

              {/* Fonte de Financiamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Fonte de Financiamento
                </label>
                <select
                  value={editingExpense.fundingSource || 'month_budget'}
                  onChange={e => {
                    const src = e.target.value as FundingSourceType;
                    setEditingExpense({
                      ...editingExpense,
                      fundingSource: src,
                      isExcludedFromMonthlyBudget: src !== 'month_budget',
                      fundingGoalId: src === 'piggy_bank' ? editingExpense.fundingGoalId : undefined,
                      fundingGoalName: src === 'piggy_bank' ? editingExpense.fundingGoalName : undefined,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent-primary"
                >
                  <option value="month_budget">Orçamento do Mês (Rotina da Casa)</option>
                  <option value="piggy_bank">Caixinha / Cofrinho de Objetivo</option>
                  <option value="reserve_excess">Excesso da Reserva (acima de 3 meses)</option>
                  <option value="personal_allowance">Mesada Individual</option>
                </select>
              </div>

              {/* Se a fonte for Caixinha, selecionar qual */}
              {editingExpense.fundingSource === 'piggy_bank' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Qual Caixinha / Cofrinho?
                  </label>
                  <select
                    value={editingExpense.fundingGoalId || ''}
                    onChange={e => {
                      const goalId = e.target.value;
                      const goal = state.piggyBanks.find(g => g.id === goalId);
                      setEditingExpense({
                        ...editingExpense,
                        fundingGoalId: goalId,
                        fundingGoalName: goal?.name || '',
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent-primary"
                  >
                    <option value="">Selecione uma caixinha...</option>
                    {state.piggyBanks.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Saldo: {formatCurrency(g.currentAmount)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quem Pagou / Divisão do Casal */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Quem Pagou / Como foi a Divisão?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingExpense({
                        ...editingExpense,
                        paidBy: 'both',
                        splitPartner1Pct: 50,
                        splitPartner2Pct: 50,
                      })
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      editingExpense.paidBy === 'both'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🤝 Casal (50/50)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingExpense({
                        ...editingExpense,
                        paidBy: 'custom',
                        splitPartner1Pct: editingExpense.splitPartner1Pct ?? 60,
                        splitPartner2Pct: 100 - (editingExpense.splitPartner1Pct ?? 60),
                      })
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      editingExpense.paidBy === 'custom'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ⚖️ Porcentagem (%)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingExpense({
                        ...editingExpense,
                        paidBy: 'partner1',
                        splitPartner1Pct: 100,
                        splitPartner2Pct: 0,
                      })
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      editingExpense.paidBy === 'partner1'
                        ? 'border-emerald-600 bg-accent-surface text-accent-themed'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Só {state.profile.partner1Name}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingExpense({
                        ...editingExpense,
                        paidBy: 'partner2',
                        splitPartner1Pct: 0,
                        splitPartner2Pct: 100,
                      })
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      editingExpense.paidBy === 'partner2'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Só {state.profile.partner2Name}
                  </button>
                </div>

                {/* Slider if custom percentage */}
                {editingExpense.paidBy === 'custom' && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                      <span>{state.profile.partner1Name}: {editingExpense.splitPartner1Pct ?? 60}%</span>
                      <span>{state.profile.partner2Name}: {100 - (editingExpense.splitPartner1Pct ?? 60)}%</span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="99"
                      value={editingExpense.splitPartner1Pct ?? 60}
                      onChange={e => {
                        const p1 = parseInt(e.target.value, 10);
                        setEditingExpense({
                          ...editingExpense,
                          splitPartner1Pct: p1,
                          splitPartner2Pct: 100 - p1,
                        });
                      }}
                      className="w-full accent-amber-600"
                    />

                    {(() => {
                      const split = getExpenseSplit(
                        editingExpense.amount,
                        'custom',
                        editingExpense.splitPartner1Pct ?? 60,
                        100 - (editingExpense.splitPartner1Pct ?? 60)
                      );
                      return (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatCurrency(split.partner1Amount)}</span>
                          <span>{formatCurrency(split.partner2Amount)}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-accent px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
