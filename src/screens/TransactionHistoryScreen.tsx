import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  CreditCard,
  Building,
  User,
  Users,
  Tag,
  Trash2,
  Edit3,
  Plus,
  ArrowUpDown,
  Download,
  ShoppingBag,
  Utensils,
  Home,
  Tv,
  Sparkles,
  CheckCircle2,
  ListFilter,
  X,
  Info,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { CategoryKey, PaidBy, ExpenseItem, IncomeItem } from '../types/finance';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { DuplicateReconciliationCard } from '../components/DuplicateReconciliationCard';
import { TransactionTriageBottomSheet } from '../components/modals/TransactionTriageBottomSheet';
import { StatementAuditModal } from '../components/modals/StatementAuditModal';
import {
  buildUnifiedLedger,
  StatementItem,
  StatementDirection,
  normalizeSearchTerm,
} from '../utils/unifiedLedger';

interface TransactionHistoryScreenProps {
  onOpenExpenseModal: () => void;
  onOpenTriageModal?: (expense: ExpenseItem) => void;
}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  onOpenExpenseModal,
  onOpenTriageModal,
}) => {
  const {
    state,
    deleteExpense,
    deleteIncome,
    getExpenseSplit,
    viewMode,
    detectedDuplicates,
  } = useFinance();

  const [triageExpense, setTriageExpense] = useState<ExpenseItem | null>(null);
  const [inspectAuditItem, setInspectAuditItem] = useState<StatementItem | null>(null);

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<StatementDirection | 'all'>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  // Month selector defaults to currentMonth for global month synchronization
  const [selectedMonth, setSelectedMonth] = useState<string>(state.currentMonth || 'all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Build unified ledger stream
  const ledgerStream = useMemo(() => {
    return buildUnifiedLedger(state, viewMode);
  }, [state, viewMode]);

  // Filtered ledger calculation
  const filteredLedger = useMemo(() => {
    const { text: termText, numVal: termNumVal } = normalizeSearchTerm(searchTerm);

    return ledgerStream.filter(item => {
      // 1. Month Filter
      if (selectedMonth !== 'all' && !item.date.startsWith(selectedMonth)) {
        return false;
      }

      // 2. Direction Filter (Inflow, Outflow, Internal Transfer)
      if (selectedDirection !== 'all' && item.direction !== selectedDirection) {
        return false;
      }

      // 3. Origin Filter
      if (selectedOrigin !== 'all' && item.origin !== selectedOrigin) {
        return false;
      }

      // 4. PaidBy Filter
      if (selectedPaidBy !== 'all' && item.paidBy !== selectedPaidBy) {
        return false;
      }

      // 5. Category Filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 6. Search Term (Text or Brazilian Comma Amount e.g. "800,00")
      if (termText) {
        const titleMatch = item.title.toLowerCase().includes(termText);
        const catMatch = item.categoryName.toLowerCase().includes(termText);
        const bankMatch = (item.bankName || '').toLowerCase().includes(termText);
        const fitidMatch = (item.fitid || '').toLowerCase().includes(termText);
        const notesMatch = (item.notes || '').toLowerCase().includes(termText);

        let amountMatch = false;
        if (termNumVal !== undefined) {
          amountMatch = Math.abs(item.amount - termNumVal) < 0.01 || item.amount.toString().includes(termText);
        } else {
          amountMatch = item.amount.toString().includes(termText);
        }

        if (!titleMatch && !catMatch && !bankMatch && !fitidMatch && !notesMatch && !amountMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
  }, [ledgerStream, selectedMonth, selectedDirection, selectedOrigin, selectedPaidBy, selectedCategory, searchTerm, sortBy]);

  // Totals Breakdown for Filtered View
  const totalsSummary = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalTransfers = 0;

    filteredLedger.forEach(item => {
      if (item.direction === 'inflow') {
        totalInflow += item.amount;
      } else if (item.direction === 'outflow') {
        totalOutflow += item.amount;
      } else if (item.direction === 'internal') {
        totalTransfers += item.amount;
      }
    });

    const netFlow = totalInflow - totalOutflow;

    return {
      totalInflow,
      totalOutflow,
      totalTransfers,
      netFlow,
      count: filteredLedger.length,
    };
  }, [filteredLedger]);

  const handleDeleteItem = (item: StatementItem) => {
    if (item.entityType === 'expense') {
      deleteExpense(item.entityId);
    } else if (item.entityType === 'income') {
      // Safely unlink medical shifts if linked
      deleteIncome(item.entityId, true);
    }
  };

  const handleEditItem = (item: StatementItem) => {
    if (item.entityType === 'expense' && item.rawExpense) {
      if (onOpenTriageModal) {
        onOpenTriageModal(item.rawExpense);
      } else {
        setTriageExpense(item.rawExpense);
      }
    } else {
      setInspectAuditItem(item);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Screen Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Extrato Financeiro Unificado
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Histórico completo e rastreável de entradas, saídas e transferências do casal.
          </p>
        </div>

        <button
          onClick={onOpenExpenseModal}
          className="btn-primary-accent flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-xs transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Duplicate Reconciliation Alert Card if any duplicates exist */}
      {detectedDuplicates.length > 0 && (
        <DuplicateReconciliationCard />
      )}

      {/* SUMMARY TOTALS CARDS (Entradas, Saídas, Fluxo Líquido e Transferências) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Flow */}
        <div
          className={`p-4 rounded-3xl border shadow-xs transition-colors space-y-1 ${
            totalsSummary.netFlow >= 0
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/60'
              : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚖️</span> Fluxo Líquido
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {totalsSummary.count} itens
            </span>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black tabular-nums font-display ${
              totalsSummary.netFlow >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-700 dark:text-rose-300'
            }`}
          >
            {totalsSummary.netFlow >= 0 ? '+ ' : ''}
            {formatCurrency(totalsSummary.netFlow)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Balanço consolidado (Entradas - Saídas no filtro selecionado)
          </p>
        </div>

        {/* Entradas / Receitas */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1 transition-colors">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Total Entradas
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-display">
            {formatCurrency(totalsSummary.totalInflow)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Receitas, salários e reembolsos
          </p>
        </div>

        {/* Saídas / Despesas */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1 transition-colors">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Total Saídas
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-display">
            {formatCurrency(totalsSummary.totalOutflow)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Gastos e compras da rotina
          </p>
        </div>

        {/* Transferências Internas (Vasos Comunicantes) */}
        <div className="p-4 rounded-3xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 shadow-xs space-y-1 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transferências
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              0 impacto líquido
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100 tabular-nums font-display">
            {formatCurrency(totalsSummary.totalTransfers)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nivelamentos internos (Vasos Comunicantes)
          </p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5 transition-colors">
        {/* Search input with comma support */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por descrição, valor (ex: 800,00), banco ou FITID..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-accent-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Mês / Competência (Sincronizado com o seletor global do app) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Mês / Período:
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
            >
              <option value="all">🗓️ Todo o Histórico</option>
              <option value={state.currentMonth}>✨ Mês Atual ({state.currentMonth})</option>
              {Array.from(
                new Set(
                  ledgerStream.map(i => i.competenceMonth).filter(m => m !== state.currentMonth)
                )
              ).map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Direção / Tipo (Entrada, Saída, Transferência) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Direção / Tipo:
            </label>
            <select
              value={selectedDirection}
              onChange={e => setSelectedDirection(e.target.value as StatementDirection | 'all')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
            >
              <option value="all">Todas as Direções</option>
              <option value="inflow">💰 Entradas (Receitas)</option>
              <option value="outflow">💳 Saídas (Despesas)</option>
              <option value="internal">🔄 Transferências Internas</option>
            </select>
          </div>

          {/* Origem */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Origem do Lançamento:
            </label>
            <select
              value={selectedOrigin}
              onChange={e => setSelectedOrigin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
            >
              <option value="all">Todas as Origens</option>
              <option value="manual">✍️ Manual (GASTEI)</option>
              <option value="pluggy_import">🏦 Extrato Bancário (Meu Pluggy)</option>
              <option value="shift_payout">🩺 Plantão Médico</option>
              <option value="installment">💳 Parcelamento de Cartão</option>
              <option value="fixed_bill">🏠 Conta Fixa</option>
              <option value="surplus_transfer">🔄 Vaso Comunicante</option>
            </select>
          </div>

          {/* Titularidade */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Titular / Divisão:
            </label>
            <select
              value={selectedPaidBy}
              onChange={e => setSelectedPaidBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
            >
              <option value="all">Todos os Titulares</option>
              <option value="both">🤝 Casal (Em Conjunto)</option>
              <option value="partner1">Só {state.profile.partner1Name}</option>
              <option value="partner2">Só {state.profile.partner2Name}</option>
            </select>
          </div>
        </div>

        {/* Sorting controls and Category Quick Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Todas as Categorias
            </button>
            {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  selectedCategory === key
                    ? 'bg-accent-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{CATEGORIES_BASE[key].emoji}</span>
                <span>{CATEGORIES_BASE[key].name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <span className="text-slate-400 text-[11px]">Ordenação:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-[11px]"
            >
              <option value="date-desc">Mais recentes</option>
              <option value="date-asc">Mais antigos</option>
              <option value="amount-desc">Maior valor</option>
              <option value="amount-asc">Menor valor</option>
            </select>
          </div>
        </div>
      </div>

      {/* UNIFIED TRANSACTIONS STREAM LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
            Lançamentos ({filteredLedger.length})
          </h3>
          <span className="text-xs text-slate-400">
            {selectedMonth === 'all' ? 'Todo o Histórico' : `Período: ${selectedMonth}`}
          </span>
        </div>

        {filteredLedger.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <span className="text-3xl block">🍃</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhum lançamento encontrado para esses filtros
            </p>
            <p className="text-xs text-slate-400">
              Tente limpar a busca ou selecionar outro período/categoria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLedger.map(item => {
              const isInflow = item.direction === 'inflow';
              const isTransfer = item.direction === 'internal';

              return (
                <div
                  key={item.id}
                  className="py-3.5 flex items-center justify-between gap-3 group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Direction Emoji Icon */}
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 border ${
                        isInflow
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                          : isTransfer
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      {item.categoryEmoji}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {item.title}
                        </span>

                        {/* Origin Badges */}
                        {item.origin === 'pluggy_import' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                            🏦 Extrato
                          </span>
                        )}
                        {item.origin === 'shift_payout' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                            🩺 Plantão
                          </span>
                        )}
                        {item.origin === 'surplus_transfer' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 shrink-0">
                            🔄 Nivelamento
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {item.categoryName}
                        </span>
                        <span>·</span>
                        <span>{item.date.split('-').reverse().join('/')}</span>
                        <span>·</span>

                        {/* PaidBy Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.paidByName}
                        </span>

                        {item.fitid && (
                          <span className="text-[10px] font-mono opacity-70">
                            [FITID OK]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Amount Formatted */}
                    <div className="text-right">
                      <div
                        className={`font-black text-sm sm:text-base tabular-nums font-display ${
                          isInflow
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : isTransfer
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isInflow ? '+ ' : isTransfer ? '' : '- '}
                        {formatCurrency(item.amount)}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {/* Audit Inspector Button ("Por que este registro está aqui?") */}
                      <button
                        type="button"
                        onClick={() => setInspectAuditItem(item)}
                        className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors"
                        title="Rastreabilidade: Por que este registro está aqui?"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                        title="Editar lançamento"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete / Storno Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="w-8 h-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                        title="Excluir ou Estornar lançamento"
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

      {/* Audit Inspector Modal ("Por que este registro está aqui?") */}
      <StatementAuditModal
        item={inspectAuditItem}
        onClose={() => setInspectAuditItem(null)}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />

      {/* Triage Bottom Sheet Modal for Editing Expenses */}
      {triageExpense && (
        <TransactionTriageBottomSheet
          isOpen={!!triageExpense}
          expense={triageExpense}
          onClose={() => setTriageExpense(null)}
        />
      )}
    </div>
  );
};
