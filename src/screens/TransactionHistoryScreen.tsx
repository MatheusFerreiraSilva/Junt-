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
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { CategoryKey, PaidBy, ExpenseItem } from '../types/finance';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { DuplicateReconciliationCard } from '../components/DuplicateReconciliationCard';
import { TransactionTriageBottomSheet } from '../components/modals/TransactionTriageBottomSheet';

interface TransactionHistoryScreenProps {
  onOpenExpenseModal: () => void;
  onOpenTriageModal?: (expense: ExpenseItem) => void;
}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  onOpenExpenseModal,
  onOpenTriageModal,
}) => {
  const { state, deleteExpense, getExpenseSplit, viewMode, detectedDuplicates } = useFinance();
  const [triageExpense, setTriageExpense] = useState<ExpenseItem | null>(null);

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Standard subcategories list for quick filtering
  const subcategoryList = [
    { id: 'all', label: 'Todas as Subcategorias', icon: '🏷️' },
    { id: 'delivery', label: 'Delivery / iFood', icon: '🛵' },
    { id: 'supermercado', label: 'Supermercado', icon: '🛒' },
    { id: 'restaurante', label: 'Restaurante / Jantar', icon: '🍽️' },
    { id: 'eletrodomesticos', label: 'Eletrodomésticos & Móveis', icon: '🖥️' },
    { id: 'aluguel', label: 'Aluguel & Condomínio', icon: '🏠' },
    { id: 'contas', label: 'Contas (Luz, Água, Net)', icon: '⚡' },
    { id: 'farmacia', label: 'Farmácia & Saúde', icon: '💊' },
    { id: 'viagem', label: 'Viagem & Passeios', icon: '✈️' },
    { id: 'cursos', label: 'Cursos & Livros', icon: '📚' },
  ];

  // Helper to detect subcategory or tags from expense description/category
  const getSubcategoryBadge = (expense: ExpenseItem) => {
    if (expense.subcategory) return expense.subcategory;

    const desc = expense.description.toLowerCase();
    if (desc.includes('ifood') || desc.includes('delivery') || desc.includes('uber eats') || desc.includes('rappi')) {
      return 'Delivery';
    }
    if (desc.includes('supermercado') || desc.includes('mercado') || desc.includes('feira') || desc.includes('carrefour') || desc.includes('pão de açúcar')) {
      return 'Supermercado';
    }
    if (desc.includes('geladeira') || desc.includes('tv') || desc.includes('sofá') || desc.includes('máquina') || desc.includes('ar condicionado') || desc.includes('eletro')) {
      return 'Eletrodomésticos';
    }
    if (desc.includes('aluguel') || desc.includes('condomínio')) {
      return 'Moradia/Aluguel';
    }
    if (desc.includes('luz') || desc.includes('energia') || desc.includes('água') || desc.includes('internet') || desc.includes('gás')) {
      return 'Contas Fixas';
    }
    if (desc.includes('farmácia') || desc.includes('drogaria') || desc.includes('remédio')) {
      return 'Farmácia';
    }
    if (desc.includes('restaurante') || desc.includes('jantar') || desc.includes('almoço') || desc.includes('sushi') || desc.includes('outback')) {
      return 'Restaurantes';
    }
    return CATEGORIES_BASE[expense.category]?.name || 'Geral';
  };

  // Filtered expenses calculation
  const filteredExpenses = useMemo(() => {
    return state.expenses.filter(exp => {
      // View mode filter (Individual vs Couple)
      if (viewMode === 'partner1' && exp.paidBy === 'partner2') return false;
      if (viewMode === 'partner2' && exp.paidBy === 'partner1') return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const subcat = getSubcategoryBadge(exp).toLowerCase();
        const matchesDesc = exp.description.toLowerCase().includes(term);
        const matchesBank = (exp.bankName || '').toLowerCase().includes(term);
        const matchesCat = CATEGORIES_BASE[exp.category]?.name.toLowerCase().includes(term);
        const matchesSubcat = subcat.includes(term);
        const matchesAmount = exp.amount.toString().includes(term);

        if (!matchesDesc && !matchesBank && !matchesCat && !matchesSubcat && !matchesAmount) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }

      // Subcategory filter
      if (selectedSubcategory !== 'all') {
        const subcat = getSubcategoryBadge(exp).toLowerCase();
        if (selectedSubcategory === 'delivery' && !subcat.includes('delivery')) return false;
        if (selectedSubcategory === 'supermercado' && !subcat.includes('supermercado')) return false;
        if (selectedSubcategory === 'restaurante' && !subcat.includes('restaurante')) return false;
        if (selectedSubcategory === 'eletrodomesticos' && !subcat.includes('eletrodoméstico')) return false;
        if (selectedSubcategory === 'aluguel' && !subcat.includes('aluguel')) return false;
        if (selectedSubcategory === 'contas' && !subcat.includes('contas')) return false;
        if (selectedSubcategory === 'farmacia' && !subcat.includes('farmácia')) return false;
        if (selectedSubcategory === 'viagem' && !subcat.includes('viagem')) return false;
        if (selectedSubcategory === 'cursos' && !subcat.includes('curso')) return false;
      }

      // PaidBy filter
      if (selectedPaidBy !== 'all' && exp.paidBy !== selectedPaidBy) {
        return false;
      }

      // Month filter
      if (selectedMonth !== 'all' && !exp.date.startsWith(selectedMonth)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
  }, [state.expenses, viewMode, searchTerm, selectedCategory, selectedSubcategory, selectedPaidBy, selectedMonth, sortBy]);

  // Aggregate totals for the filtered set
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // List of available months in expenses
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    state.expenses.forEach(e => {
      if (e.date && e.date.length >= 7) {
        monthsSet.add(e.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [state.expenses]);

  const partner1Name = state.profile.partner1Name;
  const partner2Name = state.profile.partner2Name;

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Main Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2 flex-wrap">
            <span>Histórico de Transações Detalhado</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
              Filtros Inteligentes
            </span>
            {detectedDuplicates.length > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold animate-pulse">
                ⚠️ {detectedDuplicates.length} Duplicidades Detectadas
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pesquise por delivery, comida, eletrodomésticos, mercados e filtre gastos por casal, data ou categoria.
          </p>
        </div>

        <button
          onClick={onOpenExpenseModal}
          className="btn-primary-accent flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Novo Gasto</span>
        </button>
      </div>

      {/* INTELLIGENT DUPLICATE RECONCILIATION CARD */}
      <DuplicateReconciliationCard />

      {/* SEARCH BAR & QUICK FILTERS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por iFood, Delivery, Geladeira, Supermercado, Itaú..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent font-bold text-slate-700 dark:text-slate-200 pr-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="date-desc">Mais Recentes Primeiro</option>
              <option value="date-asc">Mais Antigos Primeiro</option>
              <option value="amount-desc">Maior Valor em R$</option>
              <option value="amount-asc">Menor Valor em R$</option>
            </select>
          </div>
        </div>

        {/* SUBCATEGORY QUICK FILTER CHIPS (Delivery, Comida, Eletrodomésticos, etc.) */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Filtros Rápido de Subcategoria:
          </span>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {subcategoryList.map(sub => {
              const isSelected = selectedSubcategory === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(sub.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span>{sub.icon}</span>
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECONDARY DROPDOWN FILTERS (Categoria Base, Mês e Quem Pagou) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Área Financeira
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="all">Todas as Áreas (Moradia, Comida, Lazer...)</option>
              <option value="moradia">🏠 Moradia</option>
              <option value="comida">🍽️ Comida</option>
              <option value="lazer">🎮 Lazer</option>
              <option value="protecao">🛡️ Proteção</option>
              <option value="profissional">📚 Profissional</option>
            </select>
          </div>

          {/* Month Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Mês da Transação
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="all">Todos os Meses</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  📅 {formatMonthYear(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Who Paid Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Origem do Pagamento
            </label>
            <select
              value={selectedPaidBy}
              onChange={e => setSelectedPaidBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="all">Qualquer Pagador</option>
              <option value="both">👥 Ambos (Divisão 50/50)</option>
              <option value="partner1">👤 {partner1Name}</option>
              <option value="partner2">👤 {partner2Name}</option>
            </select>
          </div>
        </div>
      </div>

      {/* FILTER SUMMARY BADGE CARD */}
      <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            📊
          </span>
          <div>
            <span className="font-extrabold text-slate-900 dark:text-white block">
              Resultados da Busca ({filteredExpenses.length} transações encontradas)
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Soma total dos gastos filtrados: <strong className="text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(filteredTotal)}</strong>
            </span>
          </div>
        </div>

        {(searchTerm || selectedCategory !== 'all' || selectedSubcategory !== 'all' || selectedPaidBy !== 'all' || selectedMonth !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setSelectedSubcategory('all');
              setSelectedPaidBy('all');
              setSelectedMonth('all');
            }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* TRANSACTIONS DETAILED LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <span className="text-4xl block">🔍</span>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Nenhuma transação encontrada para essa busca
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tente alterar os termos da busca, selecionar outra subcategoria ou limpar os filtros para ver mais resultados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredExpenses.map(item => {
              const cat = CATEGORIES_BASE[item.category];
              const subcatBadge = getSubcategoryBadge(item);
              const split = getExpenseSplit(
                item.amount,
                item.paidBy,
                item.splitPartner1Pct,
                item.splitPartner2Pct
              );
              const bankDisplay = item.bankName || 'Cartão/Conta Bancária';

              return (
                <div
                  key={item.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 p-2.5 rounded-2xl transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-[220px]">
                    <span className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-2xs mt-0.5">
                      {cat?.emoji || '💳'}
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {item.description}
                        </h4>

                        {/* Subcategory badge */}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold border border-slate-200 dark:border-slate-700">
                          {subcatBadge}
                        </span>

                        {/* Triagem & Funding Source Badges */}
                        {item.reconciledWithIntent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D8C7FF]/40 text-purple-900 dark:text-purple-200 text-[10px] font-black border border-[#D8C7FF]">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            Reconciliado Pluggy
                          </span>
                        ) : item.fundingSource === 'reserve_excess' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#A6D8FF]/40 text-sky-900 dark:text-sky-200 text-[10px] font-black border border-[#A6D8FF]">
                            🛡️ Excesso da Reserva
                          </span>
                        ) : item.fundingSource === 'piggy_bank' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFC2E2]/40 text-pink-900 dark:text-pink-200 text-[10px] font-black border border-[#FFC2E2]">
                            🎯 {item.fundingGoalName || 'Caixinha'}
                          </span>
                        ) : item.fundingSource === 'personal_allowance' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-black border border-stone-300">
                            💼 Mesada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenTriageModal) onOpenTriageModal(item);
                              else setTriageExpense(item);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[10px] font-bold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                          >
                            ⚡ Triar Fonte
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>📅 {item.date}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          💳 {bankDisplay}
                        </span>
                        <span>·</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {split.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums block font-display">
                        -{formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">
                        {item.fundingSource && item.fundingSource !== 'month_budget' ? 'Blindado do Mês' : cat?.name || 'Gasto'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (onOpenTriageModal) onOpenTriageModal(item);
                        else setTriageExpense(item);
                      }}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Triar ou alterar fonte pagadora"
                    >
                      <Tag className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deleteExpense(item.id)}
                      className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Excluir este gasto do app"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM SHEET DE TRIAGEM INTELIGENTE OMNIPRESENTE */}
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
