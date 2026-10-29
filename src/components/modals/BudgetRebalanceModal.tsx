import React, { useState, useMemo } from 'react';
import {
  X,
  Lock,
  Unlock,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  DestinationKey,
  BudgetPlanContract,
  CategoryKey,
} from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';
import {
  rebalanceBudget,
  ALL_DESTINATIONS,
  DESTINATION_NAMES,
  RebalanceResult,
} from '../../utils/rebalanceBudgetEngine';

interface BudgetRebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompetence?: string;
}

export const BudgetRebalanceModal: React.FC<BudgetRebalanceModalProps> = ({
  isOpen,
  onClose,
  initialCompetence,
}) => {
  const {
    state,
    totalIncome,
    activeLifeTier,
    categoryLocks,
    updateCategoryLocks,
    applyBudgetPlanContract,
    activeInstallments,
  } = useFinance();

  const [competence, setCompetence] = useState<string>(
    initialCompetence || state.currentMonth || new Date().toISOString().slice(0, 7)
  );

  const [applyToFutureMonths, setApplyToFutureMonths] = useState(false);

  // Initialize editable percentages from current state
  const [percentages, setPercentages] = useState<Record<DestinationKey, number>>(() => ({
    moradia: state.categoryPercentages.moradia ?? 30,
    transporte: state.categoryPercentages.transporte ?? 10,
    comida: state.categoryPercentages.comida ?? 15,
    lazer: state.categoryPercentages.lazer ?? 15,
    protecao: state.categoryPercentages.protecao ?? 10,
    profissional: state.categoryPercentages.profissional ?? 10,
    investimentos: state.profile.investmentsPercentage ?? 20,
  }));

  // Initialize locks state
  const [locks, setLocks] = useState<Record<DestinationKey, boolean>>(() => ({
    moradia: categoryLocks.moradia ?? false,
    transporte: categoryLocks.transporte ?? false,
    comida: categoryLocks.comida ?? false,
    lazer: categoryLocks.lazer ?? false,
    protecao: categoryLocks.protecao ?? false,
    profissional: categoryLocks.profissional ?? false,
    investimentos: categoryLocks.investimentos ?? false,
  }));

  // Proposal result state from engine
  const [proposal, setProposal] = useState<RebalanceResult | null>(null);

  // Active LifeTier Reference Preset
  const referencePreset = useMemo<Record<DestinationKey, number>>(() => {
    return {
      moradia: activeLifeTier.percentages.moradia ?? 22,
      transporte: activeLifeTier.percentages.transporte ?? 10,
      comida: activeLifeTier.percentages.comida ?? 11,
      lazer: activeLifeTier.percentages.lazer ?? 15,
      protecao: activeLifeTier.percentages.protecao ?? 7,
      profissional: activeLifeTier.percentages.profissional ?? 5,
      investimentos: (activeLifeTier.percentages as any).investimentos ?? 30,
    };
  }, [activeLifeTier]);

  // Active Commitments calculation for selected competence month
  const commitments = useMemo<Record<DestinationKey, number>>(() => {
    const res: Record<DestinationKey, number> = {
      moradia: 0,
      transporte: 0,
      comida: 0,
      lazer: 0,
      protecao: 0,
      profissional: 0,
      investimentos: 0,
    };

    // 1. Confirmed manual expenses in this month
    state.expenses.forEach(e => {
      if (e.date.startsWith(competence) && !e.isExcludedFromMonthlyBudget) {
        if (e.category && (e.category in res)) {
          res[e.category as CategoryKey] += e.amount;
        }
      }
    });

    // 2. Active installments
    activeInstallments.forEach(inst => {
      if (inst.category && (inst.category in res)) {
        const alreadyInExpenses = state.expenses.some(
          e => e.date.startsWith(competence) && e.installmentId === inst.id
        );
        if (!alreadyInExpenses) {
          res[inst.category as CategoryKey] += inst.installmentAmount;
        }
      }
    });

    return res;
  }, [state.expenses, activeInstallments, competence]);

  // Floors from state
  const floors = useMemo<Record<DestinationKey, number>>(() => {
    return {
      moradia: state.categoryFloors?.moradia ?? 0,
      transporte: state.categoryFloors?.transporte ?? 0,
      comida: state.categoryFloors?.comida ?? 0,
      lazer: state.categoryFloors?.lazer ?? 0,
      protecao: state.categoryFloors?.protecao ?? 0,
      profissional: state.categoryFloors?.profissional ?? 0,
      investimentos: state.categoryFloors?.investimentos ?? 0,
    };
  }, [state.categoryFloors]);

  if (!isOpen) return null;

  const handleToggleLock = (dest: DestinationKey) => {
    setLocks(prev => ({ ...prev, [dest]: !prev[dest] }));
    setProposal(null); // invalidate previous proposal
  };

  const handlePercentageChange = (dest: DestinationKey, val: number) => {
    const num = Math.max(0, Math.min(100, val));
    setPercentages(prev => ({ ...prev, [dest]: num }));
    setProposal(null);
  };

  const handleCalculateRebalance = () => {
    const res = rebalanceBudget({
      plannedNetIncome: totalIncome,
      currentPercentages: percentages,
      locks,
      floorsR$: floors,
      commitmentsR$: commitments,
      referencePreset,
      competence,
      applyToFutureMonths,
    });

    setProposal(res);
  };

  const handleApprovePlan = () => {
    if (!proposal || proposal.status !== 'feasible') return;

    const contract: BudgetPlanContract = {
      competence,
      plannedNetIncome: totalIncome,
      version: new Date().toISOString(),
      categoryPercentages: proposal.proposedPercentages,
      categoryAmountsR$: proposal.proposedAmountsR$,
      categoryLocks: locks,
      categoryFloorsR$: floors,
      categoryPriorities: {
        moradia: 'P1',
        protecao: 'P1',
        profissional: 'P1',
        comida: 'P2',
        transporte: 'P2',
        investimentos: 'P2',
        lazer: 'P3',
      },
      commitmentsR$: commitments,
      actualSpentR$: commitments,
      requiredMarginR$: proposal.proposedAmountsR$,
      referencePreset,
      status: proposal.status,
      explanation: proposal.explanation,
      conflicts: proposal.conflicts.map(c => c.message),
      approvedAt: new Date().toISOString(),
      approvedBy: state.profile.partner1Name || 'Casal',
      applyToFutureMonths,
    };

    updateCategoryLocks(locks);
    applyBudgetPlanContract(contract);
    onClose();
  };

  const totalCurrentPctSum = Number(
    Object.values(percentages).reduce((s, p) => s + p, 0).toFixed(2)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-lg">
              ⚖️
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg font-display">
                Reequilibrar Orçamento Respeitando minhas Travas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fixe prioridades (ex: Investimentos 10%) e o sistema calcula a melhor redistribuição.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Competence Month & Future Scope Selection */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent-primary shrink-0" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Competência:</span>
            <input
              type="month"
              value={competence}
              onChange={e => {
                setCompetence(e.target.value);
                setProposal(null);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs"
            />
          </div>

          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToFutureMonths}
              onChange={e => setApplyToFutureMonths(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <span>Usar também nos próximos meses</span>
          </label>
        </div>

        {/* Renda Líquida e Banner Educativo do Degrau */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Renda Líquida Aprovada: {formatCurrency(totalIncome)}
              </span>
              <span className="text-amber-800/80 dark:text-amber-300/80 block text-[11px]">
                Degrau Atual: {activeLifeTier.name} (Sugestão de referência)
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300/60">
            {totalCurrentPctSum}% alocado
          </span>
        </div>

        {/* Destinations Edit Table with Locks and Reference Presets */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>Destinação</span>
            <span>Ref. Degrau vs Escolha</span>
            <span>Porcentagem (%) & Trava</span>
          </div>

          {ALL_DESTINATIONS.map(dest => {
            const isLocked = locks[dest];
            const currentVal = percentages[dest] ?? 0;
            const currentR$ = (totalIncome * currentVal) / 100;
            const refVal = referencePreset[dest] ?? 0;
            const commitmentR$ = commitments[dest] || 0;
            const floorR$ = floors[dest] || 0;
            const hMinR$ = Math.max(floorR$, commitmentR$);

            const isInvest = dest === 'investimentos';

            return (
              <div
                key={dest}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isLocked
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                  {/* Dest Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {isInvest ? '🎯' : '🏷️'} {DESTINATION_NAMES[dest]}
                    </span>
                    {hMinR$ > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        Mín: {formatCurrency(hMinR$)}
                      </span>
                    )}
                  </div>

                  {/* Ref vs User choice */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums text-right shrink-0">
                    <span className="opacity-75">Ref: {refVal}%</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(currentR$)}
                    </span>
                  </div>

                  {/* Lock Toggle Button & Input */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleLock(dest)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                        isLocked
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                      title={isLocked ? 'Destinação travada no reequilíbrio' : 'Clique para travar esta destinação'}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                      <span>{isLocked ? 'Travado' : 'Destravado'}</span>
                    </button>

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={currentVal}
                      onChange={e =>
                        handlePercentageChange(dest, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white text-xs text-right tabular-nums focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="font-bold text-slate-400">%</span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={currentVal}
                  onChange={e => handlePercentageChange(dest, parseFloat(e.target.value) || 0)}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            );
          })}
        </div>

        {/* Action Button: Solicitar Redistribuição */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleCalculateRebalance}
            className="w-full btn-primary-accent py-3 rounded-2xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <Sliders className="w-4 h-4" />
            <span>Solicitar Redistribuição do Orçamento</span>
          </button>
        </div>

        {/* Proposal Output Box */}
        {proposal && (
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Proposta de Reequilíbrio Calculada</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  proposal.status === 'feasible'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {proposal.status === 'feasible' ? '✅ Plano Viável' : '⚠️ Plano Inviável'}
              </span>
            </div>

            {/* Explanation portuguese */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {proposal.explanation}
            </p>

            {/* If Infeasible Warning Alert */}
            {proposal.status === 'infeasible' && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Déficit Identificado: {formatCurrency(proposal.deficitR$)}</span>
                </div>
                {proposal.conflicts.map((c, i) => (
                  <div key={i} className="text-[11px] opacity-90">
                    • {c.message}
                  </div>
                ))}
              </div>
            )}

            {/* Before vs After Table */}
            {proposal.status === 'feasible' && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Proposta Antes vs Depois
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {ALL_DESTINATIONS.map(dest => {
                    const oldPct = proposal.oldPercentages[dest] ?? 0;
                    const newPct = proposal.proposedPercentages[dest] ?? 0;
                    const newR$ = proposal.proposedAmountsR$[dest] ?? 0;
                    const isLocked = proposal.locks[dest];

                    return (
                      <div
                        key={dest}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {isLocked && <Lock className="w-3 h-3 text-amber-600 shrink-0" />}
                          <span>{DESTINATION_NAMES[dest]}</span>
                        </div>

                        <div className="text-right tabular-nums">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {newPct}% ({formatCurrency(newR$)})
                          </div>
                          {oldPct !== newPct && (
                            <div className="text-[10px] text-slate-400">
                              Anterior: {oldPct}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!proposal || proposal.status !== 'feasible'}
            onClick={handleApprovePlan}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all ${
              proposal && proposal.status === 'feasible'
                ? 'btn-primary-accent'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aprovar e Salvar Plano do Casal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
