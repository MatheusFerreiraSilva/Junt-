import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { DestinationKey } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';
import {
  rebalanceBudget,
  computeCompetenceBudgetSnapshot,
  proposeCustomInvestmentRatio,
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
    applyBudgetRebalanceProposal,
  } = useFinance();

  const [competence, setCompetence] = useState<string>(
    initialCompetence || state.currentMonth || new Date().toISOString().slice(0, 7)
  );
  const [applyToFutureMonths, setApplyToFutureMonths] = useState(false);
  const [overwriteApprovedFutureMonths, setOverwriteApprovedFutureMonths] = useState(false);
  const [useTierReferenceWeights, setUseTierReferenceWeights] = useState(false);

  // Live canonical snapshot for the selected competence using 29B selectors
  const liveSnapshot = useMemo(
    () => computeCompetenceBudgetSnapshot(state, competence),
    [state, competence]
  );

  const effectivePlannedIncome =
    liveSnapshot.plannedNetIncome > 0 ? liveSnapshot.plannedNetIncome : totalIncome;

  const [percentages, setPercentages] = useState<Record<DestinationKey, number>>(() => ({
    ...liveSnapshot.currentPercentages,
  }));

  const [locks, setLocks] = useState<Record<DestinationKey, boolean>>(() => ({
    ...liveSnapshot.locks,
  }));

  const [proposal, setProposal] = useState<RebalanceResult | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number>(0);
  const [approvalWarning, setApprovalWarning] = useState<string | null>(null);

  // Synchronize editable state when modal opens or selected competence changes
  useEffect(() => {
    if (!isOpen) return;
    setPercentages({ ...liveSnapshot.currentPercentages });
    setLocks({ ...liveSnapshot.locks });
    setProposal(null);
    setPreviewSignature(null);
    setPreviewRevision(liveSnapshot.planRevision);
    setApprovalWarning(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, competence]);

  // Detect if underlying data changed after calculating proposal (stale preview invalidation)
  const isPreviewStale = Boolean(
    proposal && previewSignature && previewSignature !== liveSnapshot.signature
  );

  // Active LifeTier Reference Preset (informational reference only — NEVER imposed unless user opts in!)
  const tierReferencePreset = useMemo<Record<DestinationKey, number>>(() => {
    return {
      moradia: activeLifeTier.percentages.moradia ?? 30,
      transporte: activeLifeTier.percentages.transporte ?? 10,
      comida: activeLifeTier.percentages.comida ?? 15,
      lazer: activeLifeTier.percentages.lazer ?? 15,
      protecao: activeLifeTier.percentages.protecao ?? 10,
      profissional: activeLifeTier.percentages.profissional ?? 10,
      investimentos: activeLifeTier.percentages.investimentos ?? 10,
    };
  }, [activeLifeTier]);

  const customInvestProposal = useMemo(
    () => proposeCustomInvestmentRatio(percentages.investimentos ?? 10),
    [percentages.investimentos]
  );

  if (!isOpen) return null;

  const handleToggleLock = (dest: DestinationKey) => {
    setLocks((prev) => ({ ...prev, [dest]: !prev[dest] }));
    setProposal(null);
    setApprovalWarning(null);
  };

  const handlePercentageChange = (dest: DestinationKey, val: number) => {
    const safeVal = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
    setPercentages((prev) => ({ ...prev, [dest]: safeVal }));
    setProposal(null);
    setApprovalWarning(null);
  };

  const handleCalculateRebalance = () => {
    setApprovalWarning(null);
    const res = rebalanceBudget({
      plannedNetIncome: effectivePlannedIncome,
      currentPercentages: percentages,
      locks,
      floorsR$: liveSnapshot.floorsR$,
      commitmentsR$: liveSnapshot.pendingCommitmentsR$,
      actualSpentR$: liveSnapshot.actualSpentR$,
      actualSpentByNatureR$: liveSnapshot.actualSpentByNatureR$,
      pendingByNatureR$: liveSnapshot.pendingByNatureR$,
      referencePreset: useTierReferenceWeights ? tierReferencePreset : undefined,
      competence,
      applyToFutureMonths,
      baseSnapshotSignature: liveSnapshot.signature,
    });

    setProposal(res);
    setPreviewSignature(liveSnapshot.signature);
    setPreviewRevision(liveSnapshot.planRevision);
  };

  const handleApprovePlan = () => {
    if (!proposal || proposal.status !== 'feasible') return;

    const result = applyBudgetRebalanceProposal(proposal, {
      expectedSignature: previewSignature ?? undefined,
      expectedPlanRevision: previewRevision,
      overwriteExistingFutureApprovedPlans: overwriteApprovedFutureMonths,
    });

    if (result.status !== 'ready') {
      setApprovalWarning(result.reason);
      setProposal(null);
      setPreviewSignature(null);
      return;
    }

    onClose();
  };

  const totalCurrentPctSum = Number(
    Object.values(percentages)
      .reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0)
      .toFixed(2)
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
                Fixe prioridades (ex: Investimentos 10%) e o sistema calcula a redistribuição exata em centavos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de reequilíbrio"
            className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Competence Month & Future Scope Selection */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent-primary shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-300">Competência:</span>
              <input
                type="month"
                aria-label="Competência do plano"
                value={competence}
                onChange={(e) => {
                  setCompetence(e.target.value);
                  setProposal(null);
                  setApprovalWarning(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs"
              />
              {competence > state.currentMonth && (
                <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 font-bold text-[10px]">
                  Planejamento Futuro (não altera {state.currentMonth})
                </span>
              )}
            </div>

            <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToFutureMonths}
                onChange={(e) => {
                  setApplyToFutureMonths(e.target.checked);
                  setProposal(null);
                }}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span>Usar também nos próximos meses</span>
            </label>
          </div>

          {applyToFutureMonths && (
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span>
                Propaga pelos próximos 6 meses preservando meses que já tenham planos aprovados.
              </span>
              <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteApprovedFutureMonths}
                  onChange={(e) => setOverwriteApprovedFutureMonths(e.target.checked)}
                  className="rounded text-amber-600 w-3.5 h-3.5"
                />
                <span>Substituir meses futuros já aprovados</span>
              </label>
            </div>
          )}
        </div>

        {/* Renda Líquida e Política Personalizada vs Referência */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Renda Líquida Planejada: {formatCurrency(effectivePlannedIncome)}
                </span>
                <span className="text-amber-800/80 dark:text-amber-300/80 block text-[11px]">
                  {customInvestProposal.policyLabel} • Referência da faixa: {activeLifeTier.name}
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300/60">
              {totalCurrentPctSum}% alocado
            </span>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-amber-900 dark:text-amber-200 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={useTierReferenceWeights}
              onChange={(e) => {
                setUseTierReferenceWeights(e.target.checked);
                setProposal(null);
              }}
              className="rounded text-amber-600 w-3.5 h-3.5"
            />
            <span>
              Usar pesos sugeridos da faixa {activeLifeTier.name} nas categorias destravadas (opcional)
            </span>
          </label>
        </div>

        {/* Stale / Conflict Alert */}
        {(approvalWarning || isPreviewStale) && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {approvalWarning ||
                  'Os gastos ou compromissos desta competência mudaram. Recalcule a prévia antes de aprovar.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCalculateRebalance}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-[11px] shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Recalcular</span>
            </button>
          </div>
        )}

        {/* Destinations Edit Table with Locks, Realized, Pending Commitments and Floors */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>Destinação & Compromissos</span>
            <span>Ref. Faixa vs Escolha</span>
            <span>Porcentagem (%) & Trava</span>
          </div>

          {ALL_DESTINATIONS.map((dest) => {
            const isLocked = locks[dest];
            const currentVal = percentages[dest] ?? 0;
            const currentR$ = (effectivePlannedIncome * currentVal) / 100;
            const refVal = tierReferencePreset[dest] ?? 0;
            const spentR$ = liveSnapshot.actualSpentR$[dest] || 0;
            const pendingR$ = liveSnapshot.pendingCommitmentsR$[dest] || 0;
            const floorR$ = liveSnapshot.floorsR$[dest] || 0;
            const hMinR$ = Math.max(floorR$, spentR$ + pendingR$);
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {isInvest ? '🎯' : '🏷️'} {DESTINATION_NAMES[dest]}
                      </span>
                      {hMinR$ > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                          Mín: {formatCurrency(hMinR$)}
                        </span>
                      )}
                    </div>
                    {(spentR$ > 0 || pendingR$ > 0 || floorR$ > 0) && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-2">
                        {spentR$ > 0 && <span>Realizado: {formatCurrency(spentR$)}</span>}
                        {pendingR$ > 0 && <span>Pendente: {formatCurrency(pendingR$)}</span>}
                        {floorR$ > 0 && <span>Piso: {formatCurrency(floorR$)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums text-right shrink-0">
                    <span className="opacity-75">Ref: {refVal}%</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(currentR$)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleLock(dest)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                        isLocked
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                      title={
                        isLocked
                          ? 'Destinação travada no reequilíbrio'
                          : 'Clique para travar esta destinação'
                      }
                    >
                      {isLocked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{isLocked ? 'Travado' : 'Destravado'}</span>
                    </button>

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      aria-label={`Porcentagem de ${DESTINATION_NAMES[dest]}`}
                      value={currentVal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        handlePercentageChange(dest, raw === '' ? 0 : parseFloat(raw));
                      }}
                      className="w-16 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white text-xs text-right tabular-nums focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="font-bold text-slate-400">%</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={currentVal}
                  onChange={(e) => handlePercentageChange(dest, parseFloat(e.target.value) || 0)}
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

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {proposal.explanation}
            </p>

            {/* MacroGroup Closure Summary */}
            {proposal.status === 'feasible' && (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-bold block">Grupo Fixos</span>
                  <strong className="text-slate-900 dark:text-white">
                    {proposal.macroGroups.fixos.percentage}% ({formatCurrency(proposal.macroGroups.fixos.amountR$)})
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-bold block">Grupo Variáveis</span>
                  <strong className="text-slate-900 dark:text-white">
                    {proposal.macroGroups.variaveis.percentage}% ({formatCurrency(proposal.macroGroups.variaveis.amountR$)})
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-bold block">Investimentos</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {proposal.macroGroups.investimentos.percentage}% ({formatCurrency(proposal.macroGroups.investimentos.amountR$)})
                  </strong>
                </div>
              </div>
            )}

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
                {proposal.recoveryOptions.length > 0 && (
                  <div className="pt-1 border-t border-rose-200/60 dark:border-rose-800/60 space-y-0.5 text-[11px]">
                    <span className="font-bold block">Opções de revisão:</span>
                    {proposal.recoveryOptions.map((opt, idx) => (
                      <div key={idx}>→ {opt}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Before vs After Table */}
            {proposal.status === 'feasible' && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Proposta Antes vs Depois
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {ALL_DESTINATIONS.map((dest) => {
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
                            <div className="text-[10px] text-slate-400">Anterior: {oldPct}%</div>
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
            disabled={!proposal || proposal.status !== 'feasible' || isPreviewStale}
            onClick={handleApprovePlan}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all ${
              proposal && proposal.status === 'feasible' && !isPreviewStale
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
