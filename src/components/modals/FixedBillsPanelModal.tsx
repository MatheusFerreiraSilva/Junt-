import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronRight,
  Shield,
  Tag,
  Calendar as CalendarIcon,
  CreditCard,
  User,
  Users,
  Info,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import { CategoryKey, PaidBy } from '../../types/finance';
import { formatCurrency, formatMonthYear, getNextMonth, getPreviousMonth } from '../../utils/formatters';
import { MonthSelector } from '../MonthSelector';
import {
  calculateFixedBillsSummary,
  FixedBillOccurrence,
  DomainScope,
} from '../../utils/fixedBillEngine';

interface FixedBillsPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
  onNavigateToExpense?: (expenseId: string) => void;
  onNavigateToCategory?: (categoryKey: CategoryKey) => void;
}

export const FixedBillsPanelModal: React.FC<FixedBillsPanelModalProps> = ({
  isOpen,
  onClose,
  initialMonth,
  onNavigateToCategory,
}) => {
  const {
    state,
    viewMode,
    payFixedBill,
    unpayFixedBill,
    triggerCelebration,
  } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialMonth || state.currentMonth || new Date().toISOString().slice(0, 7)
  );

  const [scope, setScope] = useState<DomainScope>(
    viewMode === 'partner1' ? 'partner1' : viewMode === 'partner2' ? 'partner2' : 'casal'
  );

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [filterNature, setFilterNature] = useState<'all' | 'essential' | 'optional'>('all');

  const summary = useMemo(() => {
    return calculateFixedBillsSummary(state, selectedMonth, scope);
  }, [state, selectedMonth, scope]);

  if (!isOpen) return null;

  const handlePay = (occ: FixedBillOccurrence) => {
    payFixedBill(occ.billId, selectedMonth);
    triggerCelebration();
  };

  const handleUnpay = (occ: FixedBillOccurrence) => {
    unpayFixedBill(occ.billId, selectedMonth);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* HEADER DO PAINEL */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📌</span>
              <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white font-display">
                Fixos do Mês (Prompt 28I)
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                {formatMonthYear(selectedMonth)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              Painel consolidado de compromissos fixos, vencimentos e conciliação com o teto aprovado
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Scope Switcher */}
            <div className="inline-flex p-1 bg-slate-200 dark:bg-slate-700 rounded-xl border border-slate-300 dark:border-slate-600">
              <button
                onClick={() => setScope('casal')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  scope === 'casal'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                👥 Casal
              </button>
              <button
                onClick={() => setScope('partner1')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  scope === 'partner1'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                👤 {state.profile.partner1Name || 'P1'}
              </button>
              <button
                onClick={() => setScope('partner2')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  scope === 'partner2'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                👤 {state.profile.partner2Name || 'P2'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* METRICS BAR DO TOPO (CONTRATO 28I) */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200 dark:border-indigo-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Balanço Reconciliado de Fixos ({scope === 'casal' ? 'Casal' : scope})
                </span>
              </div>

              {summary.hasExplicitCeiling ? (
                <div className="text-right">
                  <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                    Consumo: {summary.pctConsumedOfCeiling.toFixed(1)}% do Teto Fixo
                  </span>
                </div>
              ) : (
                <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-300">
                  ⚠️ Sem teto fixo aprovado
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Teto Aprovado */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Teto Aprovado
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {summary.hasExplicitCeiling ? formatCurrency(summary.fixedCeilingR$) : 'R$ 0,00'}
                </div>
              </div>

              {/* Realizado Líquido */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Realizado Líquido
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  {formatCurrency(summary.realizedLiquidR$)}
                </div>
              </div>

              {/* Pendências */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Pendentes
                </div>
                <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                  {formatCurrency(summary.pendingR$)}
                </div>
              </div>

              {/* Comprometido Projetado */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Comprometido
                </div>
                <div className="text-sm sm:text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums mt-0.5">
                  {formatCurrency(summary.projectedCommittedR$)}
                </div>
              </div>

              {/* Margem Assinada */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Margem Assinada
                </div>
                <div
                  className={`text-sm sm:text-base font-black tabular-nums mt-0.5 ${
                    summary.signedMarginR$ >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(summary.signedMarginR$)}
                </div>
              </div>
            </div>

            {/* Excesso Alert */}
            {summary.hasExcess && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center gap-2 text-rose-900 dark:text-rose-200 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  Atenção: O comprometido fixo ultrapassou o teto em {formatCurrency(summary.excessR$)}.
                </span>
              </div>
            )}
          </div>

          {/* FILTROS & NAVEGAÇÃO DE COMPETÊNCIA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Mês:</span>
              <button
                onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 border border-slate-300 dark:border-slate-600"
              >
                ‹ Anterior
              </button>
              <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums px-2">
                {formatMonthYear(selectedMonth)}
              </span>
              <button
                onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 border border-slate-300 dark:border-slate-600"
              >
                Próximo ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-2.5 py-1 text-xs font-bold rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
              >
                <option value="all">Todos os Estados</option>
                <option value="pending">Somente Pendentes</option>
                <option value="paid">Somente Baixados / Pagos</option>
              </select>

              {/* Nature filter */}
              <select
                value={filterNature}
                onChange={(e) => setFilterNature(e.target.value as any)}
                className="px-2.5 py-1 text-xs font-bold rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
              >
                <option value="all">Todas as Naturezas</option>
                <option value="essential">📌 Essenciais</option>
                <option value="optional">💡 Opcionais</option>
              </select>
            </div>
          </div>

          {/* LISTAGEM AGRUPADA POR CATEGORIA */}
          <div className="space-y-4 pt-2">
            {summary.categories.map((cat) => {
              const filteredOccs = cat.occurrences.filter((o) => {
                if (filterStatus === 'pending' && o.status === 'paid') return false;
                if (filterStatus === 'paid' && o.status !== 'paid') return false;
                if (filterNature === 'essential' && !o.isEssential) return false;
                if (filterNature === 'optional' && o.isEssential) return false;
                return true;
              });

              if (filteredOccs.length === 0 && filterStatus !== 'all') return null;

              return (
                <div
                  key={cat.categoryKey}
                  className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3"
                >
                  {/* Category Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{cat.emoji}</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {cat.categoryName}
                          {onNavigateToCategory && (
                            <button
                              onClick={() => {
                                onNavigateToCategory(cat.categoryKey);
                                onClose();
                              }}
                              className="text-[10px] text-accent-themed font-bold hover:underline"
                            >
                              Ver categoria →
                            </button>
                          )}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {cat.pctOfFixedCeiling.toFixed(1)}% do teto global de Fixos • {cat.pctOfFixedCommitted.toFixed(1)}% do total fixo comprometido
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-slate-950 dark:text-white tabular-nums">
                        Comprometido: {formatCurrency(cat.committedR$)}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Realizado: {formatCurrency(cat.fixedSpentR$)} | Pendente: {formatCurrency(cat.pendingR$)}
                      </div>
                    </div>
                  </div>

                  {/* List of occurrences inside category */}
                  <div className="space-y-2">
                    {filteredOccs.length === 0 ? (
                      <p className="text-xs font-medium text-slate-400 italic py-2 text-center">
                        Nenhum compromisso fixo nesta categoria para os filtros selecionados.
                      </p>
                    ) : (
                      filteredOccs.map((occ) => {
                        const isDifferentPayDateMonth =
                          occ.paidAt && !occ.paidAt.startsWith(selectedMonth);

                        return (
                          <div
                            key={occ.occurrenceId}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {occ.title}
                                </span>

                                <span
                                  className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${
                                    occ.isEssential
                                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {occ.isEssential ? '📌 Essencial' : '💡 Opcional'}
                                </span>

                                {occ.isDirectExpense && (
                                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    Lançamento Direto
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <span>Vencimento: {occ.dueDate.slice(8, 10)}/{occ.dueDate.slice(5, 7)}</span>
                                <span>•</span>
                                <span>Competência: {occ.competenceMonth}</span>
                                <span>•</span>
                                <span>Paga por: {occ.assignedPayer === 'both' ? 'Ambos (50-50)' : occ.assignedPayer}</span>
                              </div>

                              {isDifferentPayDateMonth && (
                                <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                  <Info className="w-3.5 h-3.5" />
                                  <span>
                                    Pago no extrato em {occ.paidAt} (Fluxo de caixa computado no mês real do pagamento)
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right">
                                <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                                  {formatCurrency(occ.apportionedAmount)}
                                </div>
                                {occ.status === 'paid' ? (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Baixado
                                  </span>
                                ) : occ.status === 'overdue' ? (
                                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Vencido
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                                    <Clock className="w-3.5 h-3.5" /> Pendente
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons */}
                              {occ.status !== 'paid' ? (
                                <button
                                  onClick={() => handlePay(occ)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-4 h-4" />
                                  Baixar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUnpay(occ)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reabrir
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
