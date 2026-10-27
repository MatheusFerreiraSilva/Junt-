import React, { useState, useMemo } from 'react';
import {
  Stethoscope,
  Plus,
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Link,
  Edit2,
  Trash2,
  Flame,
  Award,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { MedicalShift, ShiftSector } from '../types/finance';
import {
  SECTOR_CONFIG,
  CONTRACT_CONFIG,
  calculateShiftMetrics,
  calculateHourlyYieldRanking,
  projectCashFlowTimeline,
} from '../utils/shiftsEngine';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { MedicalShiftModal } from '../components/modals/MedicalShiftModal';
import { ReconcileShiftPaymentModal } from '../components/modals/ReconcileShiftPaymentModal';

export const MedicalShiftsScreen: React.FC = () => {
  const {
    medicalShifts,
    state,
    totalActiveInstallmentsAmountMonth,
    deleteMedicalShift,
  } = useFinance();

  // State
  const [partnerFilter, setPartnerFilter] = useState<'both' | 'partner1' | 'partner2'>('both');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received' | 'overdue'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal states
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<MedicalShift | null>(null);
  const [reconcilingShift, setReconcilingShift] = useState<MedicalShift | null>(null);

  // Filtered shifts by partner
  const partnerShifts = useMemo(() => {
    const list = medicalShifts || [];
    if (partnerFilter === 'both') return list;
    return list.filter((s) => s.partner === partnerFilter);
  }, [medicalShifts, partnerFilter]);

  // Monthly Metrics
  const monthlyMetrics = useMemo(() => {
    return calculateShiftMetrics(partnerShifts, selectedMonth, partnerFilter);
  }, [partnerShifts, selectedMonth, partnerFilter]);

  // Hourly Yield Ranking
  const hourlyRanking = useMemo(() => {
    return calculateHourlyYieldRanking(partnerShifts);
  }, [partnerShifts]);

  // Total Fixed Expenses for the couple
  const totalFixedExpensesAmount = useMemo(() => {
    const expenses = state?.expenses || [];
    const fixedCategories = ['housing', 'bills', 'services', 'education', 'health'];
    const fixedExpensesThisMonth = expenses
      .filter((e) => fixedCategories.includes(e.category))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const baseFixed = fixedExpensesThisMonth > 0
      ? fixedExpensesThisMonth + (totalActiveInstallmentsAmountMonth || 0)
      : 8500;
    return Math.max(baseFixed, 6000);
  }, [state?.expenses, totalActiveInstallmentsAmountMonth]);

  // Estimated average monthly net income (derived from shifts or default base 25000)
  const averageMonthlyIncome = useMemo(() => {
    const totalShiftEarnings = partnerShifts.reduce((acc, s) => acc + s.grossAmount, 0);
    return Math.max(totalShiftEarnings / 3, totalFixedExpensesAmount * 1.35, 22000);
  }, [partnerShifts, totalFixedExpensesAmount]);

  // Cash Flow Timeline for next 6 months
  const cashFlowTimeline = useMemo(() => {
    return projectCashFlowTimeline(
      partnerShifts,
      totalFixedExpensesAmount,
      averageMonthlyIncome,
      selectedMonth,
      6
    );
  }, [partnerShifts, totalFixedExpensesAmount, averageMonthlyIncome, selectedMonth]);

  // Prescription for selected month
  const activeMonthProjection = useMemo(() => {
    return cashFlowTimeline.find((t) => t.monthKey === selectedMonth) || cashFlowTimeline[0];
  }, [cashFlowTimeline, selectedMonth]);

  const recommendations = activeMonthProjection?.recommendation;

  // Filtered shifts for the list view
  const displayShifts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return partnerShifts.filter((shift) => {
      const matchesMonth =
        shift.dateWorked.startsWith(selectedMonth) ||
        (shift.estimatedPayDate && shift.estimatedPayDate.startsWith(selectedMonth));

      if (!matchesMonth) return false;

      const isOverdue =
        shift.status === 'overdue' || (shift.status === 'pending' && shift.estimatedPayDate < todayStr);

      if (statusFilter === 'all') return true;
      if (statusFilter === 'received') return shift.status === 'received';
      if (statusFilter === 'overdue') return isOverdue;
      if (statusFilter === 'pending') return shift.status === 'pending' && !isOverdue;
      return true;
    }).sort((a, b) => new Date(b.dateWorked).getTime() - new Date(a.dateWorked).getTime());
  }, [partnerShifts, selectedMonth, statusFilter]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formattedMonthLabel = useMemo(() => {
    return formatMonthYear(selectedMonth);
  }, [selectedMonth]);

  const handleEdit = (shift: MedicalShift) => {
    setEditingShift(shift);
    setIsShiftModalOpen(true);
  };

  const handleOpenNewShift = () => {
    setEditingShift(null);
    setIsShiftModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111318] p-5 sm:p-6 rounded-[28px] border border-stone-200/80 dark:border-stone-800 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-semibold">
            <Stethoscope className="w-3.5 h-3.5" />
            Escalas & Plantões Médicos
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
            Gestão de Plantões & Caixa
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-xl">
            Previsão real de recebimento (D+30 a D+90), termômetro R$/hora e prevenção contra meses secos do casal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleOpenNewShift}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            + Novo Plantão
          </button>
        </div>
      </div>

      {/* Control Bar: Partner Toggle & Month Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/70 dark:bg-stone-900/70 backdrop-blur-md p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800">
        {/* Partner Filter */}
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setPartnerFilter('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              partnerFilter === 'both'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Casal (Todos)
          </button>
          <button
            type="button"
            onClick={() => setPartnerFilter('partner1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              partnerFilter === 'partner1'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <span>👨‍⚕️</span> Dr. Rafael
          </button>
          <button
            type="button"
            onClick={() => setPartnerFilter('partner2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              partnerFilter === 'partner2'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <span>👩‍⚕️</span> Dra. Amanda
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-800 dark:text-stone-200 capitalize min-w-[130px] text-center">
            {formattedMonthLabel}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bento Grid Layer 1: Monthly Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Hours Worked */}
        <div className="p-4 rounded-[22px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold text-stone-500">Horas em Plantão</span>
            <Clock className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-stone-900 dark:text-white">
              {monthlyMetrics.totalHours}h
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {monthlyMetrics.shiftsCount} plantões neste mês
            </p>
          </div>
        </div>

        {/* Total Expected Gross */}
        <div className="p-4 rounded-[22px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold text-stone-500">Produção Bruta</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-stone-900 dark:text-white">
              {formatCurrency(monthlyMetrics.totalGross)}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Média R$ {monthlyMetrics.averageRatePerHour}/h
            </p>
          </div>
        </div>

        {/* Already Received */}
        <div className="p-4 rounded-[22px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Já Recebido
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(monthlyMetrics.totalReceived)}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Em conta / Extrato conciliado
            </p>
          </div>
        </div>

        {/* Pending & Overdue */}
        <div className="p-4 rounded-[22px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              A Receber (D+30 a 90)
            </span>
            {monthlyMetrics.totalOverdue > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <Clock className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(monthlyMetrics.totalPending)}
            </span>
            {monthlyMetrics.totalOverdue > 0 ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 flex items-center gap-1">
                <span>⚠️</span> {formatCurrency(monthlyMetrics.totalOverdue)} em atraso
              </p>
            ) : (
              <p className="text-[11px] text-stone-500 mt-0.5">
                Dentro do prazo de faturamento
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid Layer 2: Yield Thermometer & Cash Flow Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hourly Yield Thermometer (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-[26px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Termômetro de Rentabilidade
                </h3>
                <p className="text-[11px] text-stone-500">Qual plantão vale mais por hora de sono e esforço?</p>
              </div>
            </div>
            <Award className="w-4 h-4 text-amber-500" />
          </div>

          {/* Ranking list */}
          <div className="space-y-2.5">
            {hourlyRanking.length === 0 ? (
              <p className="text-xs text-stone-400 py-4 text-center">
                Cadastre seus plantões para visualizar o ranking de R$/hora.
              </p>
            ) : (
              hourlyRanking.map((item, idx) => {
                const isBest = idx === 0;
                const sectorConf = SECTOR_CONFIG[item.sector];
                return (
                  <div
                    key={item.key}
                    className={`p-3 rounded-2xl border transition-all ${
                      isBest
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                        : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200/60 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isBest
                            ? 'bg-amber-500 text-white font-extrabold text-xs shadow-xs'
                            : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold text-xs'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                              {item.hospitalName}
                            </span>
                            {isBest && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-white font-bold">
                                Mais Rentável
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-stone-500">
                            <span>{sectorConf?.emoji}</span>
                            <span>{sectorConf?.label || item.sector}</span>
                            <span>•</span>
                            <span>{item.shiftsCount} plantões</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-sm text-stone-900 dark:text-stone-100">
                          R$ {item.ratePerHour}/h
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {formatCurrency(item.totalEarned)} total
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cash Flow Timeline & Dry Month Detector (7 Cols) */}
        <div className="lg:col-span-7 p-5 rounded-[26px] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Previsão de Fluxo de Caixa (Próximos 6 Meses)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Calculado com os prazos reais de pagamento (CLT D+5, PJ D+30 a D+90)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 block">Contas Fixas do Casal</span>
              <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                {formatCurrency(totalFixedExpensesAmount)}/mês
              </span>
            </div>
          </div>

          {/* Timeline Monthly Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {cashFlowTimeline.map((item) => {
              const isSelected = item.monthKey === selectedMonth;
              const isDry = item.recommendation.isDryMonth;
              return (
                <div
                  key={item.monthKey}
                  onClick={() => setSelectedMonth(item.monthKey)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-500 ring-2 ring-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10'
                      : 'border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 capitalize">
                      {item.monthLabel}
                    </span>
                    {isDry ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        Alerta Seco
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Seguro
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <span className="text-[10px] text-stone-400 block">Entrada Prevista:</span>
                    <span className={`text-sm font-extrabold block ${
                      isDry ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {formatCurrency(item.projectedIncome)}
                    </span>
                    <div className="text-[10px] text-stone-500">
                      Cobertura: {(item.coverageRatio * 100).toFixed(0)}% das contas
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3-Tier Recommendation Engine Banner */}
          {recommendations && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Prescrição de Escala para {formattedMonthLabel}
                  </span>
                </div>
                <span className="text-[11px] text-stone-500">
                  Valor médio por plantão: <strong>{formatCurrency(recommendations.averageShiftValue)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* Level 1: Fixed Expenses */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block">
                    1. Blindagem de Contas
                  </span>
                  <p className="font-extrabold text-sm text-stone-900 dark:text-stone-100 mt-1">
                    {recommendations.shiftsToCoverFixed === 0
                      ? '✅ Contas cobertas'
                      : `+${recommendations.shiftsToCoverFixed} plantões`}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Para garantir o total de contas fixas ({formatCurrency(totalFixedExpensesAmount)}) sem dívidas.
                  </p>
                </div>

                {/* Level 2: Maintain Lifestyle */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">
                    2. Estilo de Vida
                  </span>
                  <p className="font-extrabold text-sm text-stone-900 dark:text-stone-100 mt-1">
                    {recommendations.shiftsToMaintainLifestyle === 0
                      ? '✅ Na média mensal'
                      : `+${recommendations.shiftsToMaintainLifestyle} plantões`}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Para manter a média de renda e conforto de vocês ({formatCurrency(averageMonthlyIncome)}).
                  </p>
                </div>

                {/* Level 3: Accelerate Growth */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                    3. Acelerar Sonhos
                  </span>
                  <p className="font-extrabold text-sm text-stone-900 dark:text-stone-100 mt-1">
                    +{recommendations.shiftsToAccelerateGains} plantões
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Para alavancar investimentos, caixinhas e crescimento patrimonial (+20%).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shifts Feed & Status Filters */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-[28px] border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
              Plantões de {formattedMonthLabel} ({displayShifts.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: 'A Receber' },
              { id: 'received', label: 'Recebidos' },
              { id: 'overdue', label: 'Atrasados' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Shifts */}
        {displayShifts.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
                Nenhum plantão encontrado com estes filtros
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
                Clique em &ldquo;+ Novo Plantão&rdquo; para registrar uma nova escala ou navegue pelos outros meses.
              </p>
            </div>
            <button
              onClick={handleOpenNewShift}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-xs hover:bg-teal-700 transition-all"
            >
              + Adicionar Plantão
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayShifts.map((shift) => {
              const contract = CONTRACT_CONFIG[shift.contractType];
              const sectorConf = SECTOR_CONFIG[shift.sector];
              const isReceived = shift.status === 'received';
              const todayStr = new Date().toISOString().split('T')[0];
              const isOverdue =
                shift.status === 'overdue' || (shift.status === 'pending' && shift.estimatedPayDate < todayStr);
              const hourly = shift.durationHours > 0 ? shift.grossAmount / shift.durationHours : 0;

              return (
                <div
                  key={shift.id}
                  className={`p-4 rounded-[22px] border transition-all flex flex-col justify-between space-y-3 ${
                    isReceived
                      ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                      : isOverdue
                      ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30'
                      : 'bg-stone-50/70 dark:bg-stone-800/40 border-stone-200/80 dark:border-stone-800 hover:border-teal-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                        isReceived
                          ? 'bg-emerald-500/15'
                          : isOverdue
                          ? 'bg-rose-500/15'
                          : 'bg-teal-500/15'
                      }`}>
                        {sectorConf?.emoji || '🩺'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-stone-500">
                            {shift.partner === 'partner1' ? '👨‍⚕️ Dr. Rafael' : '👩‍⚕️ Dra. Amanda'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold">
                            {shift.durationHours}h
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                          {shift.hospitalName}
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          {shift.title} • {contract?.short}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-stone-900 dark:text-stone-100 block">
                        {formatCurrency(shift.grossAmount)}
                      </span>
                      <span className="text-[10px] text-stone-400 font-medium">
                        R$ {hourly.toFixed(0)}/h
                      </span>
                    </div>
                  </div>

                  {/* Dates & Payment Details */}
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-stone-200/60 dark:border-stone-800/60 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Realizado em:</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {new Date(shift.dateWorked + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block">
                        {isReceived ? 'Recebido em:' : 'Previsão de Crédito:'}
                      </span>
                      <span className={`font-bold ${
                        isReceived
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {isReceived && shift.actualPayDate
                          ? new Date(shift.actualPayDate + 'T12:00:00').toLocaleDateString('pt-BR')
                          : new Date(shift.estimatedPayDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Open Finance badge if linked */}
                  {shift.linkedIncomeId && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                      <Link className="w-3.5 h-3.5" />
                      Reconciliado com extrato Open Finance
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 dark:border-stone-800/60">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(shift)}
                        className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500"
                        title="Editar plantão"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMedicalShift(shift.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600"
                        title="Excluir plantão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!isReceived ? (
                      <button
                        type="button"
                        onClick={() => setReconcilingShift(shift)}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Dar Baixa / Extrato
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Recebido
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <MedicalShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => {
          setIsShiftModalOpen(false);
          setEditingShift(null);
        }}
        shiftToEdit={editingShift}
      />

      <ReconcileShiftPaymentModal
        isOpen={!!reconcilingShift}
        onClose={() => setReconcilingShift(null)}
        shift={reconcilingShift}
      />
    </div>
  );
};
