import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingDown,
  Trash2,
  Check,
  Shield,
  Home,
  Building,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Wallet,
  Zap,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { InstallmentPurchase } from '../types/finance';
import {
  formatCurrency,
  addMonths,
  formatShortMonthYear,
  formatMonthYear,
  getNextMonth,
} from '../utils/formatters';
import { AdvanceInstallmentModal } from '../components/AdvanceInstallmentModal';

interface InstallmentsScreenProps {
  onOpenInstallmentModal: () => void;
}

export const InstallmentsScreen: React.FC<InstallmentsScreenProps> = ({
  onOpenInstallmentModal,
}) => {
  const {
    state,
    totalIncome,
    activeInstallments,
    totalActiveInstallmentsAmountMonth,
    nextMonthCommittedInstallmentsAmount,
    installmentCommitmentPercentage,
    installmentLimitPercentage,
    isInstallmentCommitmentHigh,
    toggleInitialHomePhase,
    markInstallmentPaidStep,
    deleteInstallment,
    getExpenseSplit,
  } = useFinance();

  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedAdvanceInst, setSelectedAdvanceInst] = useState<InstallmentPurchase | null>(null);

  const nextMonthKey = getNextMonth(state.currentMonth);
  const completedInstallments = state.installments.filter(i => !i.active);
  const isInitialHomePhase = !!state.profile.isInitialHomePhase;

  // Projection for the next 7 months of how installment debt reduces
  const monthProjections = Array.from({ length: 7 }).map((_, idx) => {
    const monthKey = addMonths(state.currentMonth, idx);
    let committed = 0;
    activeInstallments.forEach(inst => {
      const remainingPayments = inst.installmentsCount - inst.paidInstallmentsCount;
      if (remainingPayments > idx) {
        committed += inst.installmentAmount;
      }
    });

    const reliefAmount = Math.max(0, totalActiveInstallmentsAmountMonth - committed);

    return {
      monthKey,
      committed,
      pctOfIncome: totalIncome > 0 ? Math.round((committed / totalIncome) * 100) : 0,
      reliefAmount,
      isReliefMonth: idx > 0 && reliefAmount > 0,
    };
  });

  // Sort active installments by due day if present
  const sortedActiveInstallments = [...activeInstallments].sort(
    (a, b) => (a.dueDay || 10) - (b.dueDay || 10)
  );

  const freeIncomeAmount = Math.max(0, totalIncome - totalActiveInstallmentsAmountMonth);
  const freeIncomePercentage = totalIncome > 0 ? Math.round((freeIncomeAmount / totalIncome) * 100) : 100;

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2 flex-wrap">
            <span>Compras Parceladas & Teto de 20%</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
              🛡️ Teto Oficial: 20% da Renda Líquida
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Controle de cartões, quitação antecipada inteligente e distinção clara de financiamentos estruturais.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setSelectedAdvanceInst(null);
              setIsAdvanceModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Adiantar parcelas de compras no cartão com fontes customizadas"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>⚡ Adiantar Parcelas</span>
          </button>

          <button
            onClick={onOpenInstallmentModal}
            className="btn-primary-accent flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Parcela</span>
          </button>
        </div>
      </div>

      {/* TOP SECTION: 3 KEY PILLARS (Regra de Ouro, Cumprimento de Vencimento, Orçamento Seguro) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pillar 1: Regra de Ouro & Termômetro de Comprometimento (Teto Oficial de 20%) */}
        <div
          className={`p-5 rounded-3xl border-2 flex flex-col justify-between transition-all ${
            isInstallmentCommitmentHigh
              ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-200'
              : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Teto de Parcelas no Cartão (20%)</span>
              </span>
              <span className="text-xl">
                {isInstallmentCommitmentHigh ? '⚠️' : '🛡️'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-display tabular-nums">
                  {installmentCommitmentPercentage}%
                </span>
                <span className="text-xs font-bold opacity-80">
                  / teto de 20% ({formatCurrency(totalIncome * 0.20)})
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
                <span>Margem livre no cartão:</span>
                <span className="font-extrabold tabular-nums">
                  {formatCurrency(Math.max(0, totalIncome * 0.20 - totalActiveInstallmentsAmountMonth))}
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-1 leading-relaxed font-medium">
                {isInstallmentCommitmentHigh
                  ? `Atenção: as parcelas de consumo no cartão ultrapassaram o teto de 20%. Usem o adiantamento para liberar margem.`
                  : `Excelente! O limite de até 20% está rigorosamente respeitado. Financiamentos estruturais (imobiliário e veicular) são isentos deste teto.`}
              </p>
            </div>
          </div>

          {/* Visual Gauge Bar */}
          <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>Comprometimento do Cartão</span>
              <span>{isInstallmentCommitmentHigh ? 'Acima de 20% ⚠️' : 'Zona Segura (< 20%) ✅'}</span>
            </div>
            <div className="relative h-3 bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isInstallmentCommitmentHigh ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (installmentCommitmentPercentage / 20) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pillar 2: Cumprimento de Vencimentos & Faturas em Dia */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>Cumprimento de Vencimento</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                Faturas em Dia ✓
              </span>
            </div>

            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums font-display">
                {formatCurrency(totalActiveInstallmentsAmountMonth)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total de parcelas com vencimento neste mês ({activeInstallments.length} compras)
              </div>
            </div>

            {/* Quick Bill Due Dates List */}
            <div className="space-y-1.5 pt-1">
              {sortedActiveInstallments.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span className="text-slate-400 text-[10px] font-bold">Dia {item.dueDay || 10}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.title}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                    {formatCurrency(item.installmentAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>Sem juros ou atrasos · Pagamentos debitados em dia</span>
          </div>
        </div>

        {/* Pillar 3: Orçamento Livre & Alívio Mensal */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span>Renda 100% Livre de Parcelas</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                {freeIncomePercentage}% Livre
              </span>
            </div>

            <div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-display">
                {formatCurrency(freeIncomeAmount)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Disponível da renda mensal de {formatCurrency(totalIncome)} para investimentos e vida
              </div>
            </div>

            {/* Relief Milestone Callout */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Próximo Alívio Previsto:</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight">
                Em <strong>Janeiro de 2027</strong>, 2 compras serão quitadas liberando <strong>+R$ 1.300/mês</strong> no bolso do casal!
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Comprometido no próximo mês:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(nextMonthCommittedInstallmentsAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* GRÁFICO DE ALÍVIO DAS PARCELAS (PRÓXIMOS 7 MESES) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-display flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-500" />
              <span>Gráfico de Alívio das Parcelas (Trajetória de Liberação do Orçamento)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhe mês a mês a queda dos compromissos e o dinheiro que volta a ficar 100% livre para o casal:
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Seguro (≤{installmentLimitPercentage}%)</span>
            </span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Mês Atual</span>
            </span>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-52 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
            {/* Reference dashed line for limit */}
            <div
              className="absolute left-0 right-0 border-b-2 border-dashed border-amber-500/60 z-10 pointer-events-none"
              style={{ bottom: isInitialHomePhase ? '65%' : '45%' }}
            >
              <span className="absolute right-2 -top-4 text-[9px] font-extrabold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 shadow-2xs">
                Teto Seguro ({installmentLimitPercentage}%)
              </span>
            </div>

            {(() => {
              const maxVal = Math.max(...monthProjections.map(p => p.committed), totalIncome * 0.15 || 3000);

              return monthProjections.map((proj, idx) => {
                const heightPct = Math.min(100, Math.max(16, Math.round((proj.committed / maxVal) * 100)));
                const isCurrent = idx === 0;

                return (
                  <div key={proj.monthKey} className="flex flex-col items-center justify-end h-full group relative">
                    {/* Value Badge on top of bar */}
                    <div className="text-[10px] font-black text-slate-900 dark:text-white tabular-nums mb-1 whitespace-nowrap">
                      {formatCurrency(proj.committed)}
                    </div>

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[54px] rounded-t-2xl transition-all duration-500 flex flex-col justify-between p-1.5 shadow-xs ${
                        proj.pctOfIncome > installmentLimitPercentage
                          ? 'bg-rose-500'
                          : isCurrent
                          ? 'bg-amber-500'
                          : 'bg-emerald-500 dark:bg-emerald-600'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      {/* Top icon in bar */}
                      <div className="text-[9px] text-center text-white/90 font-bold">
                        {isCurrent ? '📍' : proj.committed === 0 ? '🎉' : '🛡️'}
                      </div>

                      {/* Percentage label inside bar */}
                      <div className="text-[10px] font-black text-white text-center">
                        {proj.pctOfIncome}%
                      </div>
                    </div>

                    {/* Month Label below bar */}
                    <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mt-2 truncate max-w-full text-center">
                      {formatShortMonthYear(proj.monthKey)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Monthly Progression Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {monthProjections.map((proj, idx) => (
            <div
              key={proj.monthKey}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                idx === 0
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-bold shadow-2xs'
                  : proj.committed === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-semibold opacity-75">
                {formatShortMonthYear(proj.monthKey)}
              </div>
              <div className="text-xs font-black tabular-nums my-0.5">
                {formatCurrency(proj.committed)}
              </div>
              <div
                className={`text-[10px] font-bold ${
                  proj.pctOfIncome > installmentLimitPercentage
                    ? 'text-rose-500'
                    : proj.reliefAmount > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {proj.reliefAmount > 0 ? `+${formatCurrency(proj.reliefAmount)} livre` : `${proj.pctOfIncome}% renda`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DETALHAMENTO DE ORIGEM, VENCIMENTOS E TÉRMINO DAS PARCELAS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-display">
              Detalhamento de Origem e Término das Parcelas ({activeInstallments.length} ativas)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Onde vai cada parcela, quanto falta, de qual cartão/banco sai, dia do vencimento e quem paga.
            </p>
          </div>

          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
            Total Devedor Restante: {formatCurrency(
              activeInstallments.reduce(
                (sum, i) => sum + (i.installmentsCount - i.paidInstallmentsCount) * i.installmentAmount,
                0
              )
            )}
          </span>
        </div>

        {activeInstallments.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <span className="text-4xl block">🎉</span>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              Parabéns! O casal não possui nenhuma compra parcelada ativa.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              100% da renda do casal está totalmente livre para viver, desfrutar e investir sem compromissos futuros.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedActiveInstallments.map(item => {
              const cat = CATEGORIES_BASE[item.category];
              const remainingCount = item.installmentsCount - item.paidInstallmentsCount;
              const remainingTotal = remainingCount * item.installmentAmount;
              const progressPct = Math.min(
                100,
                Math.round((item.paidInstallmentsCount / item.installmentsCount) * 100)
              );

              // Calculate exact end month
              const endMonthKey = addMonths(item.startMonth, item.installmentsCount - 1);
              const split = getExpenseSplit(
                item.installmentAmount,
                item.paidBy,
                item.splitPartner1Pct,
                item.splitPartner2Pct
              );

              const bankDisplay = item.bankName || 'Itaú Personalité';
              const storeDisplay = item.store || 'Compra com parcelamento sem juros';
              const dueDayDisplay = item.dueDay || 10;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 transition-all space-y-4"
                >
                  {/* Top Card Line */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl shadow-xs shrink-0">
                        {cat.emoji}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                              item.type === 'financing'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                            }`}
                          >
                            {item.type === 'financing'
                              ? '🏛️ Financiamento Estrutural (Isento do Teto)'
                              : '💳 Parcela de Consumo (Teto 20%)'}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Loja/Destino: {storeDisplay}
                          </span>
                          <span>·</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {item.installmentsCount}x de {formatCurrency(item.installmentAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                        Faltam {remainingCount}x de {formatCurrency(item.installmentAmount)}
                      </div>
                      <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                        Saldo restante: {formatCurrency(remainingTotal)}
                      </div>
                    </div>
                  </div>

                  {/* 5 Points Detail Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
                    {/* 1. Onde vai */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                        🎯 Categoria
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {cat.name} ({cat.emoji})
                      </span>
                    </div>

                    {/* 2. Vencimento da Fatura */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                        📅 Vencimento da Fatura
                      </span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">
                        Todo dia {dueDayDisplay}
                      </span>
                    </div>

                    {/* 3. De onde sai */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                        🏦 Cartão / Banco
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <span>💳</span>
                        <span>{bankDisplay}</span>
                      </span>
                    </div>

                    {/* 4. Pagador / Origem */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                        👥 Divisão / Pagador
                      </span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        {split.label}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">
                        {item.paidInstallmentsCount} de {item.installmentsCount} parcelas pagas ({progressPct}%)
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {progressPct === 100 ? 'Quitado ✓' : `Término previsto: ${formatMonthYear(endMonthKey)}`}
                      </span>
                    </div>

                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions for this installment */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <button
                      onClick={() => deleteInstallment(item.id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors"
                      title="Excluir do app"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedAdvanceInst(item);
                          setIsAdvanceModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                        title="Adiantar parcelas desta compra"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>⚡ Adiantar Parcelas</span>
                      </button>

                      <button
                        onClick={() => markInstallmentPaidStep(item.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Registrar Parcela (+1)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLETED INSTALLMENTS (CONQUISTAS RECENTES) */}
      {completedInstallments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-display">
                Parcelas Quitadas Recentemente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Conquistas do casal: dívidas quitadas que liberaram dinheiro todo mês para os investimentos!
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {completedInstallments.map(item => {
              const cat = CATEGORIES_BASE[item.category];
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{cat.emoji}</span>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.installmentsCount} parcelas pagas · Total de {formatCurrency(item.totalAmount)} ({item.bankName || 'Cartão'})
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                      +{formatCurrency(item.installmentAmount)} liberados/mês!
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">100% PAGO ✅</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE ADIANTAMENTO DE PARCELAS */}
      <AdvanceInstallmentModal
        isOpen={isAdvanceModalOpen}
        onClose={() => {
          setIsAdvanceModalOpen(false);
          setSelectedAdvanceInst(null);
        }}
        targetInstallment={selectedAdvanceInst}
      />
    </div>
  );
};
