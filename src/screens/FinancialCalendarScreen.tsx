import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Repeat,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  DollarSign,
  X,
  Check,
  Tag,
  Trash2,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE, ACCENT_THEMES } from '../context/FinanceContext';
import { CategoryKey, PaidBy, ExpenseItem, IncomeItem, DetectedSubscription, InstallmentPurchase } from '../types/finance';
import { formatCurrency, formatMonthYear, getNextMonth, getPreviousMonth } from '../utils/formatters';

interface FinancialCalendarScreenProps {
  onOpenExpenseModal: (categoryKey?: CategoryKey, date?: string) => void;
  onOpenIncomeModal: (date?: string) => void;
  onOpenInstallmentModal: () => void;
}

interface CalendarDayData {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  subscriptions: DetectedSubscription[];
  fixedBills: { id: string; title: string; amount: number; category: CategoryKey; dueDay: number; payer?: PaidBy }[];
  installments: { installment: InstallmentPurchase; currentNumber: number; amount: number }[];
  totalExpense: number;
  totalIncome: number;
  totalCommitments: number;
  net: number;
}

export const FinancialCalendarScreen: React.FC<FinancialCalendarScreenProps> = ({
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenInstallmentModal,
}) => {
  const {
    state,
    viewMode,
    addExpense,
    addSubscription,
    removeSubscription,
    confirmSubscriptionAsExpense,
  } = useFinance();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Selected Month (YYYY-MM) and Selected Day for detailed drawer
  const [activeMonth, setActiveMonth] = useState<string>(state.currentMonth || todayMonthStr);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr.startsWith(activeMonth) ? todayStr : `${activeMonth}-01`);

  // Modal / drawer state for adding a fixed bill / subscription
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<CategoryKey>('moradia');
  const [newBillDay, setNewBillDay] = useState<number>(10);
  const [newBillType, setNewBillType] = useState<'fixo' | 'assinatura'>('fixo');
  const [newBillPayer, setNewBillPayer] = useState<PaidBy>('both');

  // Default recurring fixed bills for Brazilian couples (if none registered yet)
  const defaultBills = useMemo(() => {
    // If user has already added subscriptions, we use them
    const subs = state.detectedSubscriptions || [];
    if (subs.length > 0) return [];
    
    // Default smart templates to start with
    return [
      { id: 'def-aluguel', title: 'Aluguel / Condomínio', amount: 1850, category: 'moradia' as CategoryKey, dueDay: 10, payer: 'both' as PaidBy },
      { id: 'def-luz', title: 'Conta de Energia (Luz)', amount: 195, category: 'moradia' as CategoryKey, dueDay: 15, payer: 'both' as PaidBy },
      { id: 'def-internet', title: 'Internet Fibra 500MB', amount: 119, category: 'moradia' as CategoryKey, dueDay: 12, payer: 'both' as PaidBy },
      { id: 'def-netflix', title: 'Netflix 4K', amount: 55.90, category: 'lazer' as CategoryKey, dueDay: 18, payer: 'both' as PaidBy },
      { id: 'def-spotify', title: 'Spotify Premium Casal', amount: 34.90, category: 'lazer' as CategoryKey, dueDay: 22, payer: 'both' as PaidBy },
    ];
  }, [state.detectedSubscriptions]);

  // Navigate Months
  const handlePrevMonth = () => {
    const prev = getPreviousMonth(activeMonth);
    setActiveMonth(prev);
    setSelectedDate(`${prev}-01`);
  };

  const handleNextMonth = () => {
    const next = getNextMonth(activeMonth);
    setActiveMonth(next);
    setSelectedDate(`${next}-01`);
  };

  const handleJumpToToday = () => {
    setActiveMonth(todayMonthStr);
    setSelectedDate(todayStr);
  };

  // Filter transactions based on viewMode
  const filteredExpenses = useMemo(() => {
    return state.expenses.filter(e => {
      if (viewMode === 'partner1') {
        return e.paidBy === 'partner1' || (e.paidBy === 'both' && (e.splitPartner1Pct || 50) > 0);
      }
      if (viewMode === 'partner2') {
        return e.paidBy === 'partner2' || (e.paidBy === 'both' && (e.splitPartner2Pct || 50) > 0);
      }
      return true;
    });
  }, [state.expenses, viewMode]);

  const filteredIncomes = useMemo(() => {
    return state.incomes.filter(i => {
      if (viewMode === 'partner1') return i.recipient === 'partner1' || i.recipient === 'both';
      if (viewMode === 'partner2') return i.recipient === 'partner2' || i.recipient === 'both';
      return true;
    });
  }, [state.incomes, viewMode]);

  // Combine user subscriptions and default bills
  const allActiveSubscriptions = useMemo(() => {
    return (state.detectedSubscriptions || []).filter(s => s.status === 'active');
  }, [state.detectedSubscriptions]);

  // Calendar Calculation for activeMonth
  const { daysGrid, monthTotals, upcomingItems } = useMemo(() => {
    const [yearStr, monthStr] = activeMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed

    // Days in current month
    const totalDays = new Date(year, month, 0).getDate();
    // Weekday of 1st day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

    // Previous month total days
    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

    const days: CalendarDayData[] = [];

    let totalMonthIncome = 0;
    let totalMonthExpense = 0;
    let totalMonthFixed = 0;
    let totalMonthInstallments = 0;

    // Pad beginning with previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dStr = `${prevY}-${prevM.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        expenses: [],
        incomes: [],
        subscriptions: [],
        fixedBills: [],
        installments: [],
        totalExpense: 0,
        totalIncome: 0,
        totalCommitments: 0,
        net: 0,
      });
    }

    // Days of the current month
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${activeMonth}-${dayNum.toString().padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      // Real Expenses on this day
      const dayExpenses = filteredExpenses.filter(e => e.date === dateStr);
      const dayExpSum = dayExpenses.reduce((sum, e) => {
        if (viewMode === 'partner1' && e.paidBy === 'both') {
          return sum + (e.amount * (e.splitPartner1Pct || 50)) / 100;
        }
        if (viewMode === 'partner2' && e.paidBy === 'both') {
          return sum + (e.amount * (e.splitPartner2Pct || 50)) / 100;
        }
        return sum + e.amount;
      }, 0);

      // Real Incomes on this day
      const dayIncomes = filteredIncomes.filter(i => i.date === dateStr);
      let dayIncSum = dayIncomes.reduce((sum, i) => sum + i.amount, 0);

      // Default Salary entry on day 5 if profile has salary and no salary entered on day 5
      if (dayNum === 5 && dayIncomes.length === 0) {
        if (viewMode === 'couple') {
          const combined = (state.profile.partner1Income || 0) + (state.profile.partner2Income || 0);
          if (combined > 0) {
            dayIncSum += combined;
            dayIncomes.push({
              id: 'renda-casal-mensal',
              description: 'Renda Mensal do Casal (Salários)',
              amount: combined,
              date: dateStr,
              recipient: 'both',
              type: 'salario',
            });
          }
        } else if (viewMode === 'partner1' && state.profile.partner1Income > 0) {
          dayIncSum += state.profile.partner1Income;
          dayIncomes.push({
            id: 'renda-p1-mensal',
            description: `Salário Mensal (${state.profile.partner1Name})`,
            amount: state.profile.partner1Income,
            date: dateStr,
            recipient: 'partner1',
            type: 'salario',
          });
        } else if (viewMode === 'partner2' && state.profile.partner2Income > 0) {
          dayIncSum += state.profile.partner2Income;
          dayIncomes.push({
            id: 'renda-p2-mensal',
            description: `Salário Mensal (${state.profile.partner2Name})`,
            amount: state.profile.partner2Income,
            date: dateStr,
            recipient: 'partner2',
            type: 'salario',
          });
        }
      }

      // Subscriptions falling on this day of month
      const daySubs = allActiveSubscriptions.filter(s => (s.dueDay || 15) === dayNum);

      // Default fixed bills falling on this day (if no custom subscriptions exist)
      const dayBills = defaultBills.filter(b => b.dueDay === dayNum);

      // Installments due on this day
      // An installment is active if startMonth <= activeMonth and (months diff) < installmentsCount
      const dayInstallments: { installment: InstallmentPurchase; currentNumber: number; amount: number }[] = [];
      (state.installments || []).forEach(inst => {
        if (!inst.active) return;
        const instDueDay = inst.dueDay || 10;
        if (instDueDay !== dayNum) return;

        // Calculate installment index for this month
        const [instY, instM] = inst.startMonth.split('-').map(Number);
        const monthsPassed = (year - instY) * 12 + (month - instM);
        if (monthsPassed >= 0 && monthsPassed < inst.installmentsCount) {
          dayInstallments.push({
            installment: inst,
            currentNumber: monthsPassed + 1,
            amount: inst.installmentAmount,
          });
        }
      });

      const daySubsSum = daySubs.reduce((sum, s) => sum + s.amount, 0);
      const dayBillsSum = dayBills.reduce((sum, b) => sum + b.amount, 0);
      const dayInstSum = dayInstallments.reduce((sum, i) => sum + i.amount, 0);

      const totalCommitments = daySubsSum + dayBillsSum + dayInstSum;

      totalMonthIncome += dayIncSum;
      totalMonthExpense += dayExpSum;
      totalMonthFixed += daySubsSum + dayBillsSum;
      totalMonthInstallments += dayInstSum;

      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday,
        expenses: dayExpenses,
        incomes: dayIncomes,
        subscriptions: daySubs,
        fixedBills: dayBills,
        installments: dayInstallments,
        totalExpense: dayExpSum,
        totalIncome: dayIncSum,
        totalCommitments,
        net: dayIncSum - dayExpSum,
      });
    }

    // Pad end to complete 7-day grid rows (35 or 42 days)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const dStr = `${nextY}-${nextM.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        expenses: [],
        incomes: [],
        subscriptions: [],
        fixedBills: [],
        installments: [],
        totalExpense: 0,
        totalIncome: 0,
        totalCommitments: 0,
        net: 0,
      });
    }

    // Upcoming due items in next 7 days from today
    const upcoming: {
      type: 'fixed' | 'subscription' | 'installment';
      title: string;
      amount: number;
      dateStr: string;
      daysRemaining: number;
      category: CategoryKey;
    }[] = [];

    const todayDateObj = new Date();
    days.filter(d => d.isCurrentMonth).forEach(d => {
      const [dY, dM, dD] = d.dateStr.split('-').map(Number);
      const dayDateObj = new Date(dY, dM - 1, dD);
      const diffTime = dayDateObj.getTime() - todayDateObj.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        d.fixedBills.forEach(b => {
          upcoming.push({
            type: 'fixed',
            title: b.title,
            amount: b.amount,
            dateStr: d.dateStr,
            daysRemaining: diffDays,
            category: b.category,
          });
        });
        d.subscriptions.forEach(s => {
          upcoming.push({
            type: 'subscription',
            title: s.merchant,
            amount: s.amount,
            dateStr: d.dateStr,
            daysRemaining: diffDays,
            category: s.category,
          });
        });
        d.installments.forEach(i => {
          upcoming.push({
            type: 'installment',
            title: `${i.installment.title} (${i.currentNumber}/${i.installment.installmentsCount})`,
            amount: i.amount,
            dateStr: d.dateStr,
            daysRemaining: diffDays,
            category: i.installment.category,
          });
        });
      }
    });

    return {
      daysGrid: days,
      monthTotals: {
        income: totalMonthIncome,
        expense: totalMonthExpense,
        fixed: totalMonthFixed,
        installments: totalMonthInstallments,
        balance: totalMonthIncome - totalMonthExpense,
      },
      upcomingItems: upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining),
    };
  }, [activeMonth, filteredExpenses, filteredIncomes, allActiveSubscriptions, defaultBills, state.installments, state.profile, viewMode, todayStr]);

  // Selected Day Details
  const selectedDayData = useMemo(() => {
    return daysGrid.find(d => d.dateStr === selectedDate) || null;
  }, [daysGrid, selectedDate]);

  // Formatter for day full title
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${weekdays[dateObj.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
  }, [selectedDate]);

  // Handler to register a bill or subscription as an actual expense
  const handleRegisterBillAsExpense = (title: string, amount: number, category: CategoryKey, dateStr: string) => {
    addExpense({
      description: title,
      amount,
      category,
      date: dateStr,
      paidBy: viewMode === 'partner1' ? 'partner1' : viewMode === 'partner2' ? 'partner2' : 'both',
      splitPartner1Pct: 50,
      splitPartner2Pct: 50,
    });
  };

  // Handler to create a new recurring fixed bill or subscription
  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newBillAmount.replace(',', '.'));
    if (!newBillTitle.trim() || !val || val <= 0) return;

    addSubscription({
      merchant: newBillTitle.trim(),
      amount: val,
      category: newBillCategory,
      frequency: 'mensal',
      dueDay: newBillDay,
      lastDate: `${activeMonth}-${newBillDay.toString().padStart(2, '0')}`,
      status: 'active',
      payer: newBillPayer,
      notes: newBillType === 'fixo' ? 'Gasto Fixo Mensal' : 'Assinatura Recorrente',
    });

    setIsAddBillOpen(false);
    setNewBillTitle('');
    setNewBillAmount('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ========================================================================= */}
      {/* TOP HEADER: TITLE, MONTH CONTROLS, VIEW MODE INDICATOR                    */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-accent-surface text-accent-themed border border-accent-themed inline-flex">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Calendário Financeiro
            </h1>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Conexão Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Acompanhe o que você ganhou, gastou, contas fixas, assinaturas e parcelas dia a dia.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleJumpToToday}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Ir para o mês e dia atual"
          >
            Hoje
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white min-w-[130px] text-center select-none">
              {formatMonthYear(activeMonth)}
            </span>

            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddBillOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            title="Adicionar nova conta fixa ou assinatura recorrente"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Conta Fixa</span>
            <span className="sm:hidden">Conta</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MONTH SUMMARY METRIC STRIP                                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Receitas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Receitas do Mês</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(monthTotals.income)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Entradas confirmadas</div>
        </div>

        {/* Gastos Realizados */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Gastos Realizados</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
            {formatCurrency(monthTotals.expense)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Despesas pagas no mês</div>
        </div>

        {/* Saldo Líquido do Mês */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Saldo Operacional</span>
            <DollarSign className={`w-4 h-4 ${monthTotals.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className={`text-base sm:text-lg font-black ${monthTotals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(monthTotals.balance)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Entradas menos saídas</div>
        </div>

        {/* Gastos Fixos & Assinaturas Previstas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Contas & Assinaturas</span>
            <Repeat className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
            {formatCurrency(monthTotals.fixed)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Recorrentes previstas</div>
        </div>

        {/* Parcelas de Cartão */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Parcelas no Mês</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
            {formatCurrency(monthTotals.installments)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Faturas de cartões</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UPCOMING BILLS ALERT (PRÓXIMOS VENCIMENTOS)                                */}
      {/* ========================================================================= */}
      {upcomingItems.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-200">
                Atenção: Vencimentos nos Próximos 7 Dias
              </h3>
            </div>
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
              {upcomingItems.length} {upcomingItems.length === 1 ? 'item agendado' : 'itens agendados'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {upcomingItems.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                onClick={() => setSelectedDate(item.dateStr)}
                className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-400 transition-all text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                    {item.daysRemaining === 0 ? 'Vence HOJE!' : item.daysRemaining === 1 ? 'Vence amanhã' : `Vence em ${item.daysRemaining} dias`} · Dia {item.dateStr.slice(-2)}
                  </div>
                </div>
                <div className="font-extrabold text-slate-900 dark:text-white shrink-0">
                  {formatCurrency(item.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COLOR HEATMAP LEGEND                                                      */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700 dark:text-slate-300">Cores dos Dias:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500/25 border border-emerald-400" />
            <span>Saldo Positivo (Ganhou +)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500/20 border border-rose-400" />
            <span>Gasto Alto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500/20 border border-amber-400" />
            <span>Gasto Moderado</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700 dark:text-slate-300">Marcadores:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Receita</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Gasto</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Gasto Fixo</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Assinatura</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Parcela</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN VIEW: CALENDAR GRID + DAY DETAILS PANEL                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Month Grid (7 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {/* Weekday Labels with High Contrast */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-black text-slate-800 dark:text-slate-200 select-none">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {daysGrid.map((day, idx) => {
              const isSelected = day.dateStr === selectedDate;

              // Color Gradient Logic based on financial performance with sharp contrast
              let dayBgClass = 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs hover:border-slate-500';

              if (day.isCurrentMonth) {
                if (day.totalIncome > 0 && day.totalExpense === 0) {
                  // Pure green gain day
                  dayBgClass = 'bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-500 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100 font-extrabold shadow-xs';
                } else if (day.totalIncome > day.totalExpense) {
                  // Net positive gain day
                  dayBgClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs';
                } else if (day.totalExpense > 0 && day.totalIncome === 0) {
                  // Pure expense day
                  if (day.totalExpense >= 500) {
                    dayBgClass = 'bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-500 dark:border-rose-500 text-rose-950 dark:text-rose-100 font-extrabold shadow-xs';
                  } else if (day.totalExpense >= 150) {
                    dayBgClass = 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-bold shadow-xs';
                  } else {
                    dayBgClass = 'bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 font-bold shadow-xs';
                  }
                } else if (day.totalExpense > 0 && day.totalIncome > 0) {
                  // Mixed day
                  if (day.net < 0) {
                    dayBgClass = 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-bold';
                  } else {
                    dayBgClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-bold';
                  }
                } else if (day.totalCommitments > 0) {
                  // Scheduled commitments / bills
                  dayBgClass = 'bg-purple-50 dark:bg-purple-950/50 border-2 border-purple-400 dark:border-purple-600 text-purple-950 dark:text-purple-100 font-bold shadow-xs';
                } else {
                  dayBgClass = 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-slate-500';
                }
              } else {
                // Out of current month
                dayBgClass = 'opacity-25 bg-slate-100/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 cursor-default pointer-events-none';
              }

              return (
                <button
                  key={`${day.dateStr}-${idx}`}
                  onClick={() => day.isCurrentMonth && setSelectedDate(day.dateStr)}
                  disabled={!day.isCurrentMonth}
                  className={`relative min-h-[62px] sm:min-h-[82px] p-1.5 sm:p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between select-none cursor-pointer group ${dayBgClass} ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg scale-[1.03] z-10 border-emerald-500'
                      : 'hover:scale-[1.01]'
                  } ${day.isToday ? 'border-2 border-emerald-600 dark:border-emerald-400' : ''}`}
                >
                  {/* Top line in day cell: Day Number + "Hoje" tag */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs sm:text-sm font-black ${day.isToday ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-950 dark:text-white'}`}>
                      {day.dayNum}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-400">
                        Hoje
                      </span>
                    )}
                  </div>

                  {/* Middle preview on desktop */}
                  {day.isCurrentMonth && (
                    <div className="hidden sm:block text-[11px] leading-tight font-black truncate my-1">
                      {day.totalIncome > 0 && (
                        <div className="text-emerald-700 dark:text-emerald-300 truncate">
                          +{formatCurrency(day.totalIncome, false)}
                        </div>
                      )}
                      {day.totalExpense > 0 && (
                        <div className="text-rose-700 dark:text-rose-300 truncate">
                          -{formatCurrency(day.totalExpense, false)}
                        </div>
                      )}
                      {day.totalExpense === 0 && day.totalIncome === 0 && day.totalCommitments > 0 && (
                        <div className="text-purple-700 dark:text-purple-300 truncate">
                          {formatCurrency(day.totalCommitments, false)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom indicator dots / badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                    {day.incomes.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Receita" />
                    )}
                    {day.expenses.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" title="Gasto Realizado" />
                    )}
                    {day.fixedBills.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 shadow-xs" title="Gasto Fixo" />
                    )}
                    {day.subscriptions.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 shadow-xs" title="Assinatura" />
                    )}
                    {day.installments.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs" title="Parcela" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Day Details Panel ("O Que Aconteceu Nesse Dia") */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            {/* Header of Day */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Detalhes do Dia
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white capitalize">
                {formattedSelectedDate}
              </h2>
            </div>

            {/* Daily Balance Ribbon */}
            {selectedDayData && (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Ganhei</div>
                  <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
                    +{formatCurrency(selectedDayData.totalIncome)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Gastei</div>
                  <div className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 truncate">
                    -{formatCurrency(selectedDayData.totalExpense)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Saldo</div>
                  <div className={`text-xs sm:text-sm font-black truncate ${selectedDayData.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(selectedDayData.net)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar for this Day: Quick add expense or income with this exact date */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenExpenseModal(undefined, selectedDate)}
                className="flex-1 btn-primary-accent flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold text-white shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Gastei Neste Dia</span>
              </button>

              <button
                onClick={() => onOpenIncomeModal(selectedDate)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Receita Neste Dia</span>
              </button>
            </div>

            {/* Ledger Breakdown for the Day */}
            <div className="space-y-4 pt-1 max-h-[480px] overflow-y-auto pr-1">
              {/* 1. Receitas do Dia */}
              {selectedDayData && selectedDayData.incomes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Receitas Recebidas ({selectedDayData.incomes.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDayData.incomes.map(inc => (
                      <div
                        key={inc.id}
                        className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                            {inc.description}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {inc.recipient === 'partner1'
                              ? state.profile.partner1Name
                              : inc.recipient === 'partner2'
                              ? state.profile.partner2Name
                              : 'Conta do Casal'}
                          </div>
                        </div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                          +{formatCurrency(inc.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Gastos Realizados */}
              {selectedDayData && selectedDayData.expenses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Gastos Realizados ({selectedDayData.expenses.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDayData.expenses.map(exp => (
                      <div
                        key={exp.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-base shrink-0">
                            {CATEGORIES_BASE[exp.category]?.emoji || '💸'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {exp.description}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{CATEGORIES_BASE[exp.category]?.name || 'Gasto'}</span>
                              <span>·</span>
                              <span>
                                {exp.paidBy === 'partner1'
                                  ? state.profile.partner1Name
                                  : exp.paidBy === 'partner2'
                                  ? state.profile.partner2Name
                                  : 'Casal (50/50)'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-rose-600 dark:text-rose-400 shrink-0">
                          -{formatCurrency(exp.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Gastos Fixos & Assinaturas Agendadas */}
              {selectedDayData && (selectedDayData.fixedBills.length > 0 || selectedDayData.subscriptions.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Gastos Fixos & Assinaturas Agendadas</span>
                  </div>
                  <div className="space-y-1.5">
                    {/* Fixed Bills */}
                    {selectedDayData.fixedBills.map(bill => (
                      <div
                        key={bill.id}
                        className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-purple-950 dark:text-purple-200 truncate">
                            {bill.title}
                          </div>
                          <div className="text-[10px] text-purple-700 dark:text-purple-400">
                            Gasto Fixo Mensal · Vence no dia {bill.dueDay}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-black text-purple-900 dark:text-purple-200">
                            {formatCurrency(bill.amount)}
                          </span>
                          <button
                            onClick={() => handleRegisterBillAsExpense(bill.title, bill.amount, bill.category, selectedDate)}
                            className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-95"
                            title="Registrar como despesa paga agora"
                          >
                            Pagar
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Subscriptions */}
                    {selectedDayData.subscriptions.map(sub => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sky-950 dark:text-sky-200 truncate">
                            {sub.merchant}
                          </div>
                          <div className="text-[10px] text-sky-700 dark:text-sky-400">
                            Assinatura Recorrente ({CATEGORIES_BASE[sub.category]?.name || 'Lazer'})
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-black text-sky-900 dark:text-sky-200">
                            {formatCurrency(sub.amount)}
                          </span>
                          <button
                            onClick={() => handleRegisterBillAsExpense(sub.merchant, sub.amount, sub.category, selectedDate)}
                            className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer active:scale-95"
                            title="Registrar como despesa paga agora"
                          >
                            Pagar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Parcelas de Cartão de Crédito */}
              {selectedDayData && selectedDayData.installments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Parcelas a Vencer no Cartão ({selectedDayData.installments.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDayData.installments.map((instItem, idx) => (
                      <div
                        key={`${instItem.installment.id}-${idx}`}
                        className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-amber-950 dark:text-amber-200 truncate">
                            {instItem.installment.title}
                          </div>
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <span>Parcela {instItem.currentNumber} de {instItem.installment.installmentsCount}</span>
                            <span>·</span>
                            <span>{instItem.installment.bankName || 'Cartão'}</span>
                          </div>
                        </div>
                        <div className="font-black text-amber-900 dark:text-amber-200 shrink-0">
                          {formatCurrency(instItem.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State for Day */}
              {selectedDayData &&
                selectedDayData.expenses.length === 0 &&
                selectedDayData.incomes.length === 0 &&
                selectedDayData.fixedBills.length === 0 &&
                selectedDayData.subscriptions.length === 0 &&
                selectedDayData.installments.length === 0 && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto stroke-1" />
                    <p className="text-xs">
                      Nenhuma transação, gasto fixo ou parcela registrada para este dia.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Use os botões acima para lançar o que aconteceu!
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR CONTA FIXA OU ASSINATURA                                 */}
      {/* ========================================================================= */}
      {isAddBillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600">
                  <Repeat className="w-5 h-5" />
                </span>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Nova Conta Fixa ou Assinatura
                </h3>
              </div>
              <button
                onClick={() => setIsAddBillOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-3.5">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Despesa</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBillType('fixo')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newBillType === 'fixo'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    📄 Gasto Fixo (Luz, Aluguel...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBillType('assinatura')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newBillType === 'assinatura'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🔄 Assinatura (Streaming...)
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Descrição / Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel, Netflix, Internet, Luz"
                  value={newBillTitle}
                  onChange={e => setNewBillTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Amount and Due Day Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Valor Mensal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={newBillAmount}
                    onChange={e => setNewBillAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newBillDay}
                    onChange={e => setNewBillDay(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Categoria do Orçamento</label>
                <select
                  value={newBillCategory}
                  onChange={e => setNewBillCategory(e.target.value as CategoryKey)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="moradia">🏠 Moradia & Casa</option>
                  <option value="comida">🍽️ Alimentação & Supermercado</option>
                  <option value="lazer">🎉 Lazer & Serviços</option>
                  <option value="protecao">🛡️ Proteção & Saúde</option>
                  <option value="profissional">💼 Carreira & Profissional</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBillOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md active:scale-95 transition-all"
                >
                  Salvar no Calendário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
