import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { DuplicateGroup } from '../utils/coupleReconciliation';
import { formatCurrency } from '../utils/formatters';

export const DuplicateReconciliationCard: React.FC = () => {
  const { detectedDuplicates, resolveDuplicateMerge } = useFinance();
  const [dismissedGroupIds, setDismissedGroupIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  const activeGroups = detectedDuplicates.filter((g) => !dismissedGroupIds.has(g.id));

  if (activeGroups.length === 0) {
    return null;
  }

  const handleDismiss = (groupId: string) => {
    setDismissedGroupIds((prev) => new Set([...prev, groupId]));
  };

  const handleMergeAll = () => {
    activeGroups.forEach((group) => {
      const idsToDelete = group.duplicates.map((d) => d.id);
      resolveDuplicateMerge(group.primary.id, idsToDelete);
    });
  };

  return (
    <div className="bg-amber-50/90 dark:bg-amber-950/40 rounded-3xl p-5 border-2 border-amber-300 dark:border-amber-700 shadow-md space-y-4 transition-colors animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 flex items-center justify-center text-xl shrink-0">
            🔍
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-amber-950 dark:text-amber-100 font-display">
                Conciliação Inteligente: {activeGroups.length} Lançamento(s) Suspeito(s)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-400">
                Detecção Automática
              </span>
            </div>
            <p className="text-xs text-amber-900 dark:text-amber-300 font-medium">
              Transações com valores ou descrições idênticas no mesmo dia. Desejam unificar ou manter ambas?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeGroups.length > 1 && (
            <button
              type="button"
              onClick={handleMergeAll}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              Unificar Todas (Manter 1 de cada)
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white/80 dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
            title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Duplicate Groups List */}
      {isExpanded && (
        <div className="space-y-3 pt-1">
          {activeGroups.map((group) => {
            const cat = CATEGORIES_BASE[group.primary.category];
            const duplicateIds = group.duplicates.map((d) => d.id);

            return (
              <div
                key={group.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat?.emoji || '💳'}</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {group.primary.description}
                    </span>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCurrency(group.amount)}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      📅 {group.date}
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    {group.duplicates.length + 1} lançamentos idênticos encontrados
                  </span>
                </div>

                {/* Candidates List */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-slate-900 dark:text-white">Lançamento Principal:</span>
                      <span>{group.primary.description}</span>
                      <span className="text-slate-400 font-mono">({group.primary.paidBy})</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                      Será mantido
                    </span>
                  </div>

                  {group.duplicates.map((dup, idx) => (
                    <div
                      key={dup.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          Possível Cópia #{idx + 1}:
                        </span>
                        <span>{dup.description}</span>
                        <span className="text-slate-400 font-mono">({dup.paidBy})</span>
                      </div>
                      <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400">
                        Será removido na unificação
                      </span>
                    </div>
                  ))}
                </div>

                {/* Group Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDismiss(group.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Manter Ambos (São Gastos Diferentes)
                  </button>

                  <button
                    type="button"
                    onClick={() => resolveDuplicateMerge(group.primary.id, duplicateIds)}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Unificar (Excluir Cópia)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
