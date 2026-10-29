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
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  X,
  Check,
  RotateCcw,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { CategoryKey, PaidBy } from '../types/finance';
import { formatCurrency, formatMonthYear, getNextMonth, getPreviousMonth } from '../utils/formatters';
import {
  calculateCalendarEngine,
  CalendarObligation,
  clampDayToMonth,
  getDaysInMonth,
} from '../utils/calendarEngine';

interface FinancialCalendarScreenProps {
  onOpenExpenseModal: (categoryKey?: CategoryKey, date?: string) => void;
  onOpenIncomeModal: (date?: string) => void;
  onOpenInstallmentModal: () => void;
}

export const FinancialCalendarScreen: React.FC<FinancialCalendarScreenProps> = ({
  onOpenExpenseModal,
  onOpenIncomeModal,
}) => {
  const {
    state,
    viewMode,
    addExpense,
    addSubscription,
    payFixedBill,
    unpayFixedBill,
    triggerCelebration,
  } = useFinance();

  // Current today string in YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Selected Month (YYYY-MM) is strictly local to the Calendar screen and does NOT change global state
  const [activeMonth, setActiveMonth] = useState<string>(() => state.currentMonth || todayMonthStr);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    todayStr.startsWith(activeMonth) ? todayStr : `${activeMonth}-01`
  );

  // Agenda view period: Next 7 days vs Next 30 days
  const [agendaPeriod, setAgendaPeriod] = useState<7 | 30>(7);

  // Local interactive simulation: postponed obligations due date overrides
  const [postponedObligations, setPostponedObligations] = useState<Record<string, string>>({});
  const [postponeModalItem, setPostponeModalItem] = useState<CalendarObligation | null>(null);
  const [postponeTargetDay, setPostponeTargetDay] = useState<number>(20);

  // Modal for adding a new recurring bill / subscription
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<CategoryKey>('moradia');
  const [newBillDay, setNewBillDay] = useState<number>(10);
  const [newBillType, setNewBillType] = useState<'fixo' | 'assinatura'>('fixo');
  const [newBillPayer, setNewBillPayer] = useState<PaidBy>('both');

  // Compute canonical calendar results using the deterministic engine
  const calendarData = useMemo(() => {
    return calculateCalendarEngine(state, activeMonth, viewMode, {
      todayDateStr: todayStr,
      postponedObligations,
    });
  }, [state, activeMonth, viewMode, todayStr, postponedObligations]);

  const { daysGrid, monthTotals, concentrationAlerts, agenda7Days, agenda30Days } = calendarData;
  const currentAgenda = agendaPeriod === 7 ? agenda7Days : agenda30Days;

  // Selected Day Details
  const selectedDayData = useMemo(() => {
    return daysGrid.find(d => d.dateStr === selectedDate) || null;
  }, [daysGrid, selectedDate]);

  // Navigation handlers (preserves local separation from global form competencies)
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

  // Formatter for day full title
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${weekdays[dateObj.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
  }, [selectedDate]);

  // Handler to pay an obligation canonically
  const handlePayObligation = (obligation: CalendarObligation) => {
    if (obligation.type === 'fixed_bill') {
      payFixedBill(obligation.sourceId, activeMonth);
      triggerCelebration();
    } else if (obligation.type === 'subscription') {
      addExpense({
        description: `[Assinatura] ${obligation.title}`,
        amount: obligation.originalAmount,
        category: obligation.category,
        date: selectedDate,
        paidBy: obligation.payer,
        notes: `Assinatura paga via Calendário (${obligation.sourceId})`,
        fundingSource: 'month_budget',
      });
      triggerCelebration();
    }
  };

  // Handler to unpay an obligation canonically
  const handleUnpayObligation = (obligation: CalendarObligation) => {
    if (obligation.type === 'fixed_bill') {
      unpayFixedBill(obligation.sourceId, activeMonth);
    }
  };

  // Postponement simulation handlers
  const handleConfirmPostpone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postponeModalItem) return;

    const [y, m] = activeMonth.split('-').map(Number);
    const safeDay = clampDayToMonth(y, m, postponeTargetDay);
    const newDueDate = `${activeMonth}-${String(safeDay).padStart(2, '0')}`;

    setPostponedObligations(prev => ({
      ...prev,
      [postponeModalItem.id]: newDueDate,
    }));

    setPostponeModalItem(null);
  };

  const handleRestoreOriginalDate = (obligationId: string) => {
    setPostponedObligations(prev => {
      const next = { ...prev };
      delete next[obligationId];
      return next;
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

  const careerMilestones = (['partner1', 'partner2'] as const).flatMap(partner => {
    if (viewMode !== 'couple' && viewMode !== partner) return [];
    const career = state.profile[partner === 'partner1' ? 'partner1Career' : 'partner2Career'];
    const name = state.profile[partner === 'partner1' ? 'partner1Name' : 'partner2Name'];
    return [
      { date: career?.graduationDate, label: 'Formatura prevista', name },
      { date: career?.residencyStartDate, label: 'Início previsto da residência', name },
    ].filter(item => item.date?.startsWith(activeMonth));
  });

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
              Agenda Integrada
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Acompanhe compromissos reais, parcelas ativas e históricas, plantões e vencimentos dia a dia.
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

      {/* Marcos da formação */}
      {careerMilestones.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="text-sm font-semibold">Marcos da formação neste mês</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {careerMilestones.map((item, index) => (
              <div key={index} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-slate-500 mt-1">{item.name} · {item.date && new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                <p className="text-[11px] text-slate-500 mt-2">Previsão informada por vocês. Nenhuma receita é antecipada.</p>
              </div>
            ))}
          </div>
        </section>
      )}

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

        {/* Compromissos Pendentes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">A Pagar no Mês</span>
            <Repeat className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
            {formatCurrency(monthTotals.commitmentsPending)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Contas, parcelas e assinaturas</div>
        </div>

        {/* Compromissos Já Quitados */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Quitados do Mês</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(monthTotals.commitmentsPaid)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Baixados no Hub/Extrato</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ALERTA DE CONCENTRAÇÃO DE VENCIMENTOS                                     */}
      {/* ========================================================================= */}
      {concentrationAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-start gap-3 animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <strong className="text-amber-950 dark:text-amber-200 font-black block">
              Alerta de Concentração de Vencimentos
            </strong>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5">
              {concentrationAlerts[0].message}. Vocês podem simular o adiamento de uma conta para aliviar o fluxo de caixa nos dias de maior pico.
            </p>
          </div>
          <button
            onClick={() => setSelectedDate(concentrationAlerts[0].dateStr)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-black text-xs shrink-0 cursor-pointer shadow-xs hover:bg-amber-700"
          >
            Ver Dia {concentrationAlerts[0].dayNum}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UPCOMING AGENDA: PRÓXIMOS 7 OU 30 DIAS COM CAIXA INFORMADO               */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              Agenda de Compromissos Futuros
            </h3>
            {/* Period switcher */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 ml-2">
              <button
                type="button"
                onClick={() => setAgendaPeriod(7)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                  agendaPeriod === 7
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Próximos 7 dias
              </button>
              <button
                type="button"
                onClick={() => setAgendaPeriod(30)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                  agendaPeriod === 30
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Próximos 30 dias
              </button>
            </div>
          </div>

          {/* Cash reconciliation coverage badge */}
          {currentAgenda.hasCashReconciliation ? (
            <div className="text-[11px] font-bold flex items-center gap-2">
              <span className="text-slate-500">Caixa Livre: {formatCurrency(currentAgenda.availableCash)}</span>
              {currentAgenda.isCashSufficient ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                  Cobertura 100%
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300">
                  Falta {formatCurrency(currentAgenda.cashDeficit)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400">
              Conectem contas bancárias para validar cobertura de caixa
            </span>
          )}
        </div>

        {currentAgenda.obligations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {currentAgenda.obligations.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedDate(item.dueDate)}
                className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 cursor-pointer hover:border-purple-400 transition-all text-xs shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>Dia {item.dueDate.slice(-2)}</span>
                    <span>·</span>
                    <span className={item.status === 'vencido' ? 'text-rose-600 font-bold' : item.status === 'pago' ? 'text-emerald-600 font-bold' : 'text-purple-600 font-bold'}>
                      {item.status === 'pago' ? 'Pago' : item.status === 'vencido' ? 'Vencido' : 'Previsto'}
                    </span>
                    {item.isSimulatedPostponed && (
                      <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-950 px-1 py-0.2 rounded">
                        Simulado
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-black text-slate-900 dark:text-white shrink-0">
                  {formatCurrency(item.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">
            Nenhum compromisso agendado para os próximos {agendaPeriod} dias.
          </p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLOR HEATMAP LEGEND                                                      */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700 dark:text-slate-300">Cores dos Dias:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500/25 border border-emerald-400" />
            <span>Saldo Positivo</span>
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
            <span>Conta/Assinatura</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Parcela</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Plantão</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN VIEW: CALENDAR GRID + DAY DETAILS PANEL                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Month Grid (7 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {/* Weekday Labels */}
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

              let dayBgClass = 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs hover:border-slate-500';

              if (day.isCurrentMonth) {
                if (day.totalIncome > 0 && day.totalExpense === 0) {
                  dayBgClass = 'bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-500 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100 font-extrabold shadow-xs';
                } else if (day.totalIncome > day.totalExpense) {
                  dayBgClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs';
                } else if (day.totalExpense > 0 && day.totalIncome === 0) {
                  if (day.totalExpense >= 500) {
                    dayBgClass = 'bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-500 dark:border-rose-500 text-rose-950 dark:text-rose-100 font-extrabold shadow-xs';
                  } else if (day.totalExpense >= 150) {
                    dayBgClass = 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-bold shadow-xs';
                  } else {
                    dayBgClass = 'bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 font-bold shadow-xs';
                  }
                } else if (day.totalExpense > 0 && day.totalIncome > 0) {
                  if (day.net < 0) {
                    dayBgClass = 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-bold';
                  } else {
                    dayBgClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-bold';
                  }
                } else if (day.totalCommitments > 0) {
                  dayBgClass = 'bg-purple-50 dark:bg-purple-950/50 border-2 border-purple-400 dark:border-purple-600 text-purple-950 dark:text-purple-100 font-bold shadow-xs';
                } else {
                  dayBgClass = 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-slate-500';
                }
              } else {
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
                  {/* Top line: Day number + "Hoje" tag */}
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

                  {/* Middle preview */}
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

                  {/* Bottom indicator dots */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                    {day.incomes.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Receita" />
                    )}
                    {day.expenses.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" title="Gasto Realizado" />
                    )}
                    {day.obligations.some(o => o.type === 'fixed_bill' || o.type === 'subscription') && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 shadow-xs" title="Conta ou Assinatura" />
                    )}
                    {day.obligations.some(o => o.type === 'installment') && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs" title="Parcela de Cartão" />
                    )}
                    {day.medicalShiftsWorked.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 shadow-xs" title="Plantão Médico Trabalhado" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Day Details Panel */}
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

            {/* Action Bar for this Day: Transfere a data selecionada para os formulários */}
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
            <div className="space-y-4 pt-1 max-h-[500px] overflow-y-auto pr-1">
              {/* 1. Receitas do Dia */}
              {selectedDayData && selectedDayData.incomes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Receitas Recebidas ({selectedDayData.incomes.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDayData.incomes.map(({ item, apportionedAmount }) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                            {item.description}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.recipient === 'partner1'
                              ? state.profile.partner1Name
                              : item.recipient === 'partner2'
                              ? state.profile.partner2Name
                              : 'Conta do Casal'}
                          </div>
                        </div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                          +{formatCurrency(apportionedAmount)}
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
                    {selectedDayData.expenses.map(({ item, apportionedAmount }) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-base shrink-0">
                            {CATEGORIES_BASE[item.category]?.emoji || '💸'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {item.description}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{CATEGORIES_BASE[item.category]?.name || 'Gasto'}</span>
                              <span>·</span>
                              <span>
                                {item.paidBy === 'partner1'
                                  ? state.profile.partner1Name
                                  : item.paidBy === 'partner2'
                                  ? state.profile.partner2Name
                                  : 'Casal'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-rose-600 dark:text-rose-400 shrink-0">
                          -{formatCurrency(apportionedAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Plantões Médicos Trabalhados neste Dia */}
              {selectedDayData && selectedDayData.medicalShiftsWorked.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Plantão Realizado ({selectedDayData.medicalShiftsWorked.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDayData.medicalShiftsWorked.map(shift => (
                      <div
                        key={shift.id}
                        className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-sky-950 dark:text-sky-200 truncate">
                            {shift.title} · {shift.hospitalName}
                          </div>
                          <div className="text-[10px] text-sky-700 dark:text-sky-400">
                            {shift.durationHours}h · {shift.partner === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name}
                          </div>
                        </div>
                        <span className="font-black text-sky-900 dark:text-sky-200 shrink-0">
                          {formatCurrency(shift.netAmount ?? shift.grossAmount ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Compromissos e Obrigações Agendadas */}
              {selectedDayData && selectedDayData.obligations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Compromissos Agendados ({selectedDayData.obligations.length})</span>
                  </div>
                  <div className="space-y-2">
                    {selectedDayData.obligations.map(obl => (
                      <div
                        key={obl.id}
                        className={`p-3 rounded-2xl border flex flex-col gap-2 text-xs transition-all ${
                          obl.status === 'pago'
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                            : obl.status === 'vencido'
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60'
                            : 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {obl.title}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>
                                {obl.type === 'fixed_bill'
                                  ? 'Conta Fixa'
                                  : obl.type === 'subscription'
                                  ? 'Assinatura'
                                  : obl.type === 'installment'
                                  ? 'Parcela Cartão'
                                  : 'Recebível'}
                              </span>
                              <span>·</span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-extrabold ${
                                  obl.status === 'pago'
                                    ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200'
                                    : obl.status === 'vencido'
                                    ? 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200'
                                    : 'bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200'
                                }`}
                              >
                                {obl.status === 'pago' ? 'Pago' : obl.status === 'vencido' ? 'Vencido' : 'Previsto'}
                              </span>
                              {obl.isSimulatedPostponed && (
                                <span className="text-amber-700 dark:text-amber-300 font-bold">
                                  (Adiamento Simulado)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="font-black text-slate-950 dark:text-white shrink-0 text-sm">
                            {formatCurrency(obl.amount)}
                          </div>
                        </div>

                        {/* Actions for this obligation */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                          {obl.status === 'pago' ? (
                            <button
                              type="button"
                              onClick={() => handleUnpayObligation(obl)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            >
                              Desfazer Pagamento
                            </button>
                          ) : (
                            <>
                              {obl.isSimulatedPostponed ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreOriginalDate(obl.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restaurar Data</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPostponeModalItem(obl);
                                    setPostponeTargetDay(Math.min(28, obl.dueDay + 7));
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer"
                                >
                                  Simular Adiamento
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePayObligation(obl)}
                                className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95"
                              >
                                <Check className="w-3 h-3" />
                                <span>Pagar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {selectedDayData &&
                selectedDayData.expenses.length === 0 &&
                selectedDayData.incomes.length === 0 &&
                selectedDayData.obligations.length === 0 &&
                selectedDayData.medicalShiftsWorked.length === 0 && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto stroke-1" />
                    <p className="text-xs">
                      Nenhum lançamento, conta fixa ou parcela registrada para este dia.
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

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Conta / Fornecedor</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel, Internet, Netflix"
                  value={newBillTitle}
                  onChange={e => setNewBillTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Valor Previsto (R$)</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={newBillAmount}
                    onChange={e => setNewBillAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Dia de Vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={newBillDay}
                    onChange={e => setNewBillDay(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Categoria do Orçamento</label>
                <select
                  value={newBillCategory}
                  onChange={e => setNewBillCategory(e.target.value as CategoryKey)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                >
                  <option value="moradia">🏠 Moradia (Aluguel, Luz, Gás)</option>
                  <option value="transporte">🚗 Transporte (Combustível, Seguro)</option>
                  <option value="comida">🍽️ Comida (Mercado, Feira)</option>
                  <option value="lazer">🍿 Lazer (Streaming, Assinaturas)</option>
                  <option value="protecao">🛡️ Proteção (Planos de Saúde)</option>
                  <option value="profissional">🩺 Profissional (CRM, Livros, Cursos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Responsável pelo Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBillPayer('both')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newBillPayer === 'both'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Casal (50/50)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBillPayer('partner1')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newBillPayer === 'partner1'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {state.profile.partner1Name || 'Pessoa 1'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBillPayer('partner2')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newBillPayer === 'partner2'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {state.profile.partner2Name || 'Pessoa 2'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  Salvar Conta na Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SIMULAR ADIAMENTO DE OBRIGAÇÃO                                      */}
      {/* ========================================================================= */}
      {postponeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Simular Adiamento de Vencimento
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {postponeModalItem.title} · {formatCurrency(postponeModalItem.amount)}
                </span>
              </div>
              <button
                onClick={() => setPostponeModalItem(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPostpone} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                <span className="font-black text-amber-900 dark:text-amber-200 block">
                  Simulação de Planejamento de Fluxo
                </span>
                <p className="text-amber-800 dark:text-amber-300">
                  Esta simulação projeta o alívio de caixa sem alterar o contrato com o emissor ou cobrar juros artificiais.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Nova data simulada no mês ({activeMonth})
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Dia:</span>
                  <input
                    type="number"
                    min={1}
                    max={getDaysInMonth(parseInt(activeMonth.slice(0, 4), 10), parseInt(activeMonth.slice(5, 7), 10))}
                    value={postponeTargetDay}
                    onChange={e => setPostponeTargetDay(parseInt(e.target.value, 10) || 1)}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-black text-center"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    de {formatMonthYear(activeMonth)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPostponeModalItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs active:scale-95 cursor-pointer"
                >
                  Confirmar Simulação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
