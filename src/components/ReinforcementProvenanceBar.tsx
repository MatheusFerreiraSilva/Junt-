import React, { useState } from 'react';
import { X, Info, ShieldCheck, AlertTriangle, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { ReinforcementProvenanceRef } from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface ReinforcementProvenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  competence: string;
  baseBudget: number;
  effectiveBudget: number;
  reinforcementAmount: number;
  reallocationNetAmount?: number;
  spent: number;
  sources: ReinforcementProvenanceRef[];
  verifiableCashStatus?: 'known' | 'partial' | 'unknown';
}

const formatSignedCurrency = (val: number): string => {
  if (val < -0.005) return `-${formatCurrency(Math.abs(val))}`;
  return formatCurrency(Math.abs(val) < 0.005 ? 0 : val);
};

export const ReinforcementProvenanceDialog: React.FC<ReinforcementProvenanceDialogProps> = ({
  isOpen,
  onClose,
  categoryName,
  competence,
  baseBudget,
  effectiveBudget,
  reinforcementAmount,
  reallocationNetAmount = 0,
  spent,
  sources,
  verifiableCashStatus,
}) => {
  if (!isOpen) return null;

  const nominalBalance = effectiveBudget - spent;
  const totalSourcesAmount =
    sources.length > 0
      ? sources.reduce((sum, src) => sum + (src.amountR$ || 0), 0)
      : reinforcementAmount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Origem do reforço em ${categoryName}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-sky-300 dark:border-sky-800 overflow-hidden flex flex-col max-h-[88vh] text-slate-900 dark:text-white"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-sky-50/70 dark:bg-sky-950/30">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white leading-tight">
                Origem Azul: {categoryName}
              </h3>
              <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                Competência {competence} • Reforço temporário no orçamento unificado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Fechar detalhes da origem azul"
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {/* Read-only notice */}
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-start gap-2 text-sky-950 dark:text-sky-100">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-black">Consulta somente leitura</div>
              <p className="text-[11px] font-medium leading-relaxed text-sky-900/90 dark:text-sky-200">
                Nenhuma movimentação financeira ocorre ao consultar. A meta habitual e a % do plano seguem intactas, o saldo permanece unificado ao gastar e a renda do mês não é alterada.
              </p>
            </div>
          </div>

          {/* Verifiable cash notice when unknown or partial */}
          {(verifiableCashStatus === 'unknown' || verifiableCashStatus === 'partial') && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-2 text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-black">
                  {verifiableCashStatus === 'unknown'
                    ? 'Caixa verificável desconhecido'
                    : 'Caixa verificável parcial'}
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {verifiableCashStatus === 'unknown'
                    ? 'Não há saldo bancário conciliado recente para comprovar todo o caixa livre; o reforço amplia o teto orçamentário da competência sem criar receita nova.'
                    : 'Existem pendências ou contas bancárias sem saldo confirmado recentemente.'}
                </p>
              </div>
            </div>
          )}

          {/* Budget Composition Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Meta habitual
              </span>
              <strong className="text-sm font-black text-slate-900 dark:text-white tabular-nums mt-0.5 block">
                {formatCurrency(baseBudget)}
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 block">
                Reforço temporário
              </span>
              <strong className="text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums mt-0.5 block">
                +{formatCurrency(reinforcementAmount)}
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Orçamento efetivo
              </span>
              <strong className="text-sm font-black text-slate-950 dark:text-white tabular-nums mt-0.5 block">
                {formatCurrency(effectiveBudget)}
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Consumo atual
              </span>
              <strong className="text-sm font-black text-slate-900 dark:text-white tabular-nums mt-0.5 block">
                {formatCurrency(spent)}
              </strong>
            </div>

            {Math.abs(reallocationNetAmount) > 0.005 && (
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  Realocação líquida
                </span>
                <strong className="text-sm font-black text-indigo-700 dark:text-indigo-300 tabular-nums mt-0.5 block">
                  {reallocationNetAmount >= 0 ? `+${formatCurrency(reallocationNetAmount)}` : formatSignedCurrency(reallocationNetAmount)}
                </strong>
              </div>
            )}

            <div
              className={`p-3 rounded-2xl border ${
                nominalBalance < 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                Saldo nominal
              </span>
              <strong
                className={`text-sm font-black tabular-nums mt-0.5 block ${
                  nominalBalance < 0
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {formatSignedCurrency(nominalBalance)}
              </strong>
            </div>
          </div>

          {/* Sources Provenance List */}
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Origens vinculadas ({sources.length})
            </div>

            {sources.length === 0 ? (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                Reforço registrado na competência {competence} no valor total de{' '}
                <strong className="text-slate-900 dark:text-white">{formatCurrency(reinforcementAmount)}</strong>.
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((src) => {
                  const badge =
                    src.evidenceType === 'bank_reconciled'
                      ? {
                          label: 'Conciliado em banco',
                          cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                          icon: <CheckCircle2 className="w-3 h-3" />,
                        }
                      : src.evidenceType === 'piggy_bank_reserve'
                      ? {
                          label: 'Reserva em cofrinho',
                          cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-300 dark:border-sky-800',
                          icon: <ShieldCheck className="w-3 h-3" />,
                        }
                      : {
                          label: 'Declarado manualmente',
                          cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                          icon: <FileText className="w-3 h-3" />,
                        };

                  return (
                    <div
                      key={src.operationId}
                      data-testid="provenance-source-row"
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-slate-900 dark:text-white">
                          {src.sourceName}
                        </span>
                        <span className="font-black text-sky-700 dark:text-sky-300 tabular-nums">
                          +{formatCurrency(src.amountR$)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          Competência {src.competence} • Data {src.date.split('-').reverse().join('/')}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border text-[10px] ${badge.cls}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      {(src.reconciliationRef || src.sourceOperationId || src.notes) && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-0.5 border-t border-slate-200/70 dark:border-slate-700/70">
                          {src.reconciliationRef && (
                            <div className="font-mono">Conciliação: {src.reconciliationRef}</div>
                          )}
                          {src.sourceOperationId && (
                            <div className="font-mono">Operação de origem: {src.sourceOperationId}</div>
                          )}
                          {src.notes && <div>{src.notes}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  data-testid="provenance-sources-total"
                  className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-between font-black text-sky-900 dark:text-sky-200"
                >
                  <span>
                    Total de reforços ({sources.length} {sources.length === 1 ? 'origem' : 'origens'})
                  </span>
                  <span className="tabular-nums">+{formatCurrency(totalSourcesAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs cursor-pointer"
          >
            Fechar consulta
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReinforcementProvenanceBarProps {
  spent: number;
  baseBudget: number;
  effectiveBudget: number;
  reinforcementAmount: number;
  reallocationNetAmount?: number;
  sources: ReinforcementProvenanceRef[];
  categoryName: string;
  competence: string;
  verifiableCashStatus?: 'known' | 'partial' | 'unknown';
  fillClassName?: string;
  fillColorHex?: string;
  compact?: boolean;
  onOpenProvenance?: () => void;
}

export const ReinforcementProvenanceBar: React.FC<ReinforcementProvenanceBarProps> = ({
  spent,
  baseBudget,
  effectiveBudget,
  reinforcementAmount,
  reallocationNetAmount = 0,
  sources,
  categoryName,
  competence,
  verifiableCashStatus,
  fillClassName,
  fillColorHex,
  compact = false,
  onOpenProvenance,
}) => {
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);

  const hasReinforcement = reinforcementAmount > 0.005;
  const safeEffective = effectiveBudget > 0 ? effectiveBudget : Math.max(spent, baseBudget + reinforcementAmount);
  const consumptionPercent =
    safeEffective > 0 ? Math.min(100, Math.max(0, (spent / safeEffective) * 100)) : spent > 0 ? 100 : 0;

  // Blue origin band starts where base habitual (plus any reallocation before reinforcement) ends up to effectiveBudget
  const baseSegmentCapped = Math.max(0, effectiveBudget - reinforcementAmount);
  const blueStartPct = safeEffective > 0 ? Math.min(100, (baseSegmentCapped / safeEffective) * 100) : 0;
  const blueWidthPct = hasReinforcement && safeEffective > 0
    ? Math.max(4, Math.min(100 - blueStartPct, (reinforcementAmount / safeEffective) * 100))
    : 0;

  const isOver = effectiveBudget > 0 ? spent > effectiveBudget : spent > 0;
  const resolvedFillClass = fillClassName || (isOver ? 'bg-rose-500' : 'bg-accent-primary');

  const handleOpen = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onOpenProvenance) {
      onOpenProvenance();
      return;
    }
    setIsProvenanceOpen(true);
  };

  return (
    <div className="space-y-1.5 w-full">
      <div
        className={`relative w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-600 ${
          compact ? 'h-2.5' : 'h-3.5'
        }`}
      >
        {/* Distinct Blue Origin Layer marking the reinforced ceiling slice (not a separate wallet) */}
        {hasReinforcement && (
          <div
            data-testid="blue-origin-layer"
            className="absolute top-0 bottom-0 bg-sky-500/35 dark:bg-sky-400/35 border-l-2 border-blue-600 dark:border-sky-300 pointer-events-none"
            style={{
              left: `${blueStartPct}%`,
              width: `${blueWidthPct}%`,
            }}
          />
        )}

        {/* Consumption Fill */}
        <div
          className={`relative z-10 h-full rounded-full transition-all duration-700 ${resolvedFillClass}`}
          style={{
            width: `${consumptionPercent}%`,
            backgroundColor: !isOver && fillColorHex ? fillColorHex : undefined,
          }}
        />
      </div>

      {hasReinforcement && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-600 dark:text-slate-400 font-semibold">
            Meta habitual: {formatCurrency(baseBudget)}
          </span>
          <button
            type="button"
            data-testid="blue-origin-marker-btn"
            onClick={handleOpen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleOpen(e);
              }
            }}
            aria-label={`Consultar origem azul do reforço de ${formatCurrency(reinforcementAmount)} em ${categoryName}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/70 dark:hover:bg-sky-900 text-blue-800 dark:text-sky-200 border border-blue-400/70 dark:border-sky-600 font-black transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-sky-400 inline-block" />
            <span>Origem azul: +{formatCurrency(reinforcementAmount)}</span>
          </button>
        </div>
      )}

      {!onOpenProvenance && (
        <ReinforcementProvenanceDialog
          isOpen={isProvenanceOpen}
          onClose={() => setIsProvenanceOpen(false)}
          categoryName={categoryName}
          competence={competence}
          baseBudget={baseBudget}
          effectiveBudget={effectiveBudget}
          reinforcementAmount={reinforcementAmount}
          reallocationNetAmount={reallocationNetAmount}
          spent={spent}
          sources={sources}
          verifiableCashStatus={verifiableCashStatus}
        />
      )}
    </div>
  );
};
