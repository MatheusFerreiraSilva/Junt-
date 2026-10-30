import { AvatarHero, MemberAvatar, CoupleFaces } from '../avatars/AvatarUI';
import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  ShieldAlert,
  BarChart2,
  Building,
  Copy,
  Check,
  User,
  Heart,
  RefreshCw,
  Mail,
  Lock,
  Trash2,
  X,
  Plus,
  Coins,
  CreditCard,
  Target,
  Zap,
  Shield,
  Eye,
  Info,
  Layers,
  ArrowUpRight,
  Edit3,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { CategoryKey, PendingIncomeConfirmation } from '../types/finance';
import {
  formatCurrency,
  getMonthProgress,
  formatShortMonthYear,
  formatMonthYear,
  getNextMonth,
  formatHumanDuration,
} from '../utils/formatters';
import { MonthSelector } from '../components/MonthSelector';
import { ScreenId } from '../components/Navigation';
import { CollegeModeView } from '../components/CollegeModeView';
import { ActiveIncomeConfirmationModal } from '../components/ActiveIncomeConfirmationModal';
import { SurplusAllocationModal } from '../components/SurplusAllocationModal';
import { MonthlyDepositGuideModal } from '../components/MonthlyDepositGuideModal';
import { DonutChart, DonutSlice } from '../components/DonutChart';
import { CoupleSettlementCard } from '../components/CoupleSettlementCard';
import { LIFE_TIERS } from '../utils/incomeTiersEngine';
import { FoodPacingWeeklyCard } from '../components/FoodPacingWeeklyCard';
import { WeeklySurplusHub } from '../components/WeeklySurplusHub';
import { MonthThermometerGauge } from '../components/MonthThermometerGauge';
import { ThermometerRaioXModal } from '../components/ThermometerRaioXModal';
import { calculateThermometerEngine, ThermometerScope } from '../utils/thermometerEngine';

interface HomeScreenProps {
  onNavigate: (screen: ScreenId, categoryKey?: CategoryKey) => void;
  onOpenExpenseModal: (categoryKey?: CategoryKey) => void;
  onOpenIncomeModal: () => void;
  onOpenInstallmentModal: () => void;
  onOpenDepositModal: (bankId: string) => void;
  onOpenAIOnboardingModal?: () => void;
  onOpenBankSyncModal?: () => void;
  onOpenWeeklyPulse?: () => void;
}

type DashboardModalType = 'thermometer' | 'tier' | 'wealth' | 'spent' | 'rhythm' | 'category' | null;
type DashboardTab = 'actions' | 'surplus' | 'split' | 'future' | 'fusion';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenInstallmentModal,
  onOpenDepositModal,
  onOpenAIOnboardingModal,
  onOpenBankSyncModal,
  onOpenWeeklyPulse,
}) => {
  const {
    state,
    totalIncome,
    totalSpentThisMonth,
    remainingToSpendThisMonth,
    isOverBudget,
    totalSavedInPiggyBanks,
    categoriesSpending,
    highestBlownCategory,
    activeInstallments,
    totalActiveInstallmentsAmountMonth,
    nextMonthCommittedInstallmentsAmount,
    installmentCommitmentPercentage,
    isInstallmentCommitmentHigh,
    justFinishedInstallment,
    partner1ShareSpent,
    partner2ShareSpent,
    jointExpensesTotal,
    partner1SoleExpensesTotal,
    partner2SoleExpensesTotal,
    viewMode,
    setViewMode,
    displayedIncome,
    displayedTotalSpent,
    displayedRemaining,
    detectedSubscriptions,
    confirmSubscriptionAsExpense,
    dismissSubscription,
    // Add profile and fusion capabilities
    currentUser,
    userProfile,
    coupleAccount,
    joinCoupleWithInviteCode,
    triggerCelebration,
    clearAllData,
    pluggyAccounts,
    syncPluggyData,
    isSyncingBanks,
    // Faixas de renda & customização
    activeLifeTier,
    tierProgress,
    bonusShiftCalculation,
    dynamicIncomeAnalysis,
    isCustomizedPercentages,
    depositToProtection,
    simulateNewDepositConfirmation,
    dismissMonthSurplusNotification,
    surplusTransfers,
    getMonthlyDepositGuide,
    executeMonthlyDeposit,
    predictiveBurnAlerts,
    aiPredictiveInsights,
  } = useFinance();

  const thermometerEngineResult = useMemo(() => {
    const scope: ThermometerScope = viewMode === 'partner1' ? 'partner1' : viewMode === 'partner2' ? 'partner2' : 'couple';
    return calculateThermometerEngine(state, scope);
  }, [state, viewMode]);

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [fusionLoading, setFusionLoading] = useState(false);
  const [fusionFeedback, setFusionFeedback] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });
  const [copiedCode, setCopiedCode] = useState(false);
  const [hideAIHero, setHideAIHero] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [activeConfirmationModal, setActiveConfirmationModal] = useState<PendingIncomeConfirmation | null>(null);
  const [isSurplusModalOpen, setIsSurplusModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Dashboard Clickable Modals State
  const [activeModal, setActiveModal] = useState<DashboardModalType>(null);
  const [selectedCategoryModalKey, setSelectedCategoryModalKey] = useState<CategoryKey | null>(null);

  // Dashboard Sub-Sections Tab State (prevents infinite vertical scrolling)
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('actions');

  const [allocatedBonus, setAllocatedBonus] = useState(false);

  const handleApplyBonusToInvestments = () => {
    if (bonusShiftCalculation.toInvestments > 0) {
      depositToProtection(bonusShiftCalculation.toInvestments);
      setAllocatedBonus(true);
      triggerCelebration();
      setTimeout(() => setAllocatedBonus(false), 3000);
    }
  };

  const handleHomeScreenFusion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim() || inviteCodeInput.trim().length !== 6) {
      setFusionFeedback({ text: 'Por favor, insira o código de 6 dígitos do seu par.', type: 'error' });
      return;
    }
    setFusionLoading(true);
    setFusionFeedback({ text: '', type: null });
    try {
      await joinCoupleWithInviteCode(inviteCodeInput.trim());
      setFusionFeedback({ text: 'Fusão realizada com sucesso! 🎉 Vocês estão conectados.', type: 'success' });
      triggerCelebration();
    } catch (err: any) {
      setFusionFeedback({ text: err.message || 'Erro ao vincular código. Tente novamente.', type: 'error' });
    } finally {
      setFusionLoading(false);
    }
  };

  const progress = getMonthProgress(state.currentMonth);
  const nextMonthKey = getNextMonth(state.currentMonth);

  const activePersonName =
    viewMode === 'partner1'
      ? state.profile.partner1Name
      : viewMode === 'partner2'
      ? state.profile.partner2Name
      : 'o casal';

  const isIndividualView = viewMode !== 'couple';

  const p1SharePct = totalSpentThisMonth > 0 ? Math.round((partner1ShareSpent / totalSpentThisMonth) * 100) : 50;
  const p2SharePct = 100 - p1SharePct;
  const p1IncomePct = totalIncome > 0 ? Math.round((state.profile.partner1Income / totalIncome) * 100) : 50;
  const p2IncomePct = 100 - p1IncomePct;

  // Order categories from highest spent to lowest spent
  const sortedCategories = useMemo(() => {
    return (Object.keys(CATEGORIES_BASE) as CategoryKey[]).sort(
      (a, b) => categoriesSpending[b].spent - categoriesSpending[a].spent
    );
  }, [categoriesSpending]);

  // Current month's expenses sorted newest first
  const currentMonthExpenses = useMemo(() => {
    return state.expenses
      .filter(e => e.date.startsWith(state.currentMonth))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.expenses, state.currentMonth]);

  // Safe daily spending calculation
  const safeDailyLimit = useMemo(() => {
    if (progress.daysRemaining <= 0 || remainingToSpendThisMonth <= 0) return 0;
    return remainingToSpendThisMonth / progress.daysRemaining;
  }, [progress.daysRemaining, remainingToSpendThisMonth]);

  // Thermometer status logic
  const budgetConsumedPercent = displayedIncome > 0 ? (displayedTotalSpent / displayedIncome) * 100 : 0;
  
  // Couple Donut Chart Data (Renda Total no centro, Economia do Mês e as 5 Áreas da Vida detalhadas)
  const coupleSavings = Math.max(0, totalIncome - displayedTotalSpent);
  const coupleDonutData: DonutSlice[] = useMemo(() => {
    const list: DonutSlice[] = [];

    // 1. Economia / Poupança do Casal
    if (coupleSavings > 0) {
      list.push({
        label: '🌱 Economia do Mês',
        value: coupleSavings,
        color: '#10B981',
        sublabel: 'Poupança conjunta',
      });
    }

    // 2. Gastos nas Áreas da Vida do Casal
    (Object.keys(CATEGORIES_BASE) as CategoryKey[]).forEach((catKey) => {
      const spent = categoriesSpending[catKey]?.spent || 0;
      if (spent > 0) {
        list.push({
          label: CATEGORIES_BASE[catKey].name,
          value: spent,
          color: CATEGORIES_BASE[catKey]?.colorHex || '#64748B',
          sublabel: `Gasto em ${CATEGORIES_BASE[catKey].name}`,
          categoryKey: catKey,
        });
      }
    });

    if (list.length === 0 && totalIncome > 0) {
      list.push({
        label: '🌱 Economia (100% da Renda)',
        value: totalIncome,
        color: '#10B981',
      });
    }

    return list;
  }, [coupleSavings, categoriesSpending, totalIncome]);

  let thermometerStatus: 'safe' | 'warning' | 'danger' = 'safe';

  if (displayedRemaining < 0) {
    thermometerStatus = 'danger';
  } else if (budgetConsumedPercent > progress.percentPassed + 15) {
    thermometerStatus = 'warning';
  }

  const tier = activeLifeTier;
  const isAboveInflection = totalIncome > 35000;

  if (state.appMode === 'faculdade') {
    return (
      <div className="space-y-6 pb-20">
      <header className="pt-2 pb-1"><p className="text-[10px] tracking-[0.16em] font-semibold uppercase text-slate-500 mb-2">O cotidiano de vocês</p><h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white" style={{ fontFamily: 'Georgia, serif', fontWeight: 400, letterSpacing: '-0.04em' }}>Um mês de cada vez.</h1><p className="text-sm text-slate-500 mt-2 leading-relaxed">Veja o que entrou, cuide dos próximos gastos e abra espaço para os seus planos.</p></header>
        <AvatarHero />
        <MonthSelector />
        <CollegeModeView onOpenExpenseModal={() => onOpenExpenseModal()} />
      </div>
    );
  }

  const openCategoryModal = (catKey: CategoryKey) => {
    setSelectedCategoryModalKey(catKey);
    setActiveModal('category');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ========================================================================= */}
      {/* HEADER DE CONTEXTO: SELETOR DE MÊS & VISÃO ATIVA                          */}
      {/* ========================================================================= */}
      <AvatarHero />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <MonthSelector />
        </div>

        {/* Quick View Mode Chip */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 shadow-2xs">
            <span className="text-sm">
              {viewMode === 'couple' ? <CoupleFaces size={24} /> : <MemberAvatar member={viewMode} size={26} />}
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white">
              {viewMode === 'couple' ? 'Visão Casal' : activePersonName}
            </span>
            {viewMode !== 'couple' && (
              <button
                onClick={() => setViewMode('couple')}
                className="text-[10px] font-black text-accent-themed underline ml-1 cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>

          {/* Quick Add Buttons */}
          <button
            onClick={() => onOpenExpenseModal()}
            className="btn-primary-accent px-3 py-1.5 rounded-2xl text-white text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Lançar gasto rápido"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Gastei</span>
          </button>
        </div>
      </div>

      {/* Alerta de Confirmação Ativa de Depósito (Meu Pluggy) */}
      {state.pendingConfirmations && state.pendingConfirmations.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white text-lg shadow-xs">
              🔔
            </span>
            <div>
              <div className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <span>{state.pendingConfirmations.length} Recebimento{state.pendingConfirmations.length > 1 ? 's' : ''} Aguardando Classificação</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  Meu Pluggy Open Finance
                </span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                Detectamos {formatCurrency(state.pendingConfirmations[0].amount)} de <strong>{state.pendingConfirmations[0].sourceName}</strong>. Como devemos classificar?
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveConfirmationModal(state.pendingConfirmations![0])}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            Classificar em 1 Toque
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOTIFICAÇÃO DE FECHAMENTO DO MÊS E RASTREIO DE SOBRAS SELETIVAS           */}
      {/* ========================================================================= */}
      {(() => {
        // Find categories with positive surplus (remaining > 0)
        const surplusCats = (Object.keys(CATEGORIES_BASE) as CategoryKey[])
          .map(k => ({
            key: k,
            name: CATEGORIES_BASE[k].name,
            emoji: CATEGORIES_BASE[k].emoji,
            remaining: Math.max(0, categoriesSpending[k]?.remaining || 0),
          }))
          .filter(c => c.remaining > 0);

        const isMonthDismissed = (state.dismissedSurplusMonths || []).includes(state.currentMonth);
        const totalSurplus = surplusCats.reduce((s, c) => s + c.remaining, 0);

        if (isMonthDismissed || surplusCats.length === 0) return null;

        return (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/50 dark:via-teal-950/40 dark:to-slate-900 border-2 border-emerald-400 dark:border-emerald-600 shadow-md space-y-3 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                  ✨
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white font-display">
                      Espaço no orçamento
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                      Planejamento do mês
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                    Há um total de <strong>{formatCurrency(totalSurplus)}</strong> ainda não utilizado no orçamento. Confira as contas pendentes antes de fazer um aporte.
                  </p>
                </div>
              </div>

              {/* Action Prompt */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSurplusModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sim, Direcionar Sobras</span>
                </button>
                <button
                  onClick={() => dismissMonthSurplusNotification(state.currentMonth)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
                >
                  Agora Não
                </button>
              </div>
            </div>

            {/* Listagem clara e individual dos saldos positivos de cada categoria */}
            <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-2">
                Saldos positivos por categoria: Vocês gostariam de jogar as sobras de alguma categoria para os seus Cofrinhos de Objetivos?
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {surplusCats.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setIsSurplusModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-300 dark:border-emerald-700/80 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:border-emerald-500 shadow-2xs cursor-pointer transition-colors"
                    title={`Clique para direcionar sobras de ${cat.name}`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCurrency(cat.remaining)}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GUIA DIDÁTICO DE APORTES DO MÊS / SELO VISUAL DE CONCLUSÃO               */}
      {/* ========================================================================= */}
      {(() => {
        const guide = getMonthlyDepositGuide(state.currentMonth);
        const completionRecord = state.completedMonthDeposits?.[state.currentMonth];
        const isCompleted = guide.status === 'completed' || !!completionRecord;

        if (isCompleted) {
          return (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border-2 border-emerald-400 dark:border-emerald-600 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shrink-0 shadow-sm animate-bounce">
                  🏆
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                      Selo de Conclusão Mensal
                    </span>
                    <span className="text-xs text-slate-500 font-bold">{formatMonthYear(state.currentMonth)}</span>
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-slate-950 dark:text-white font-display mt-0.5">
                    Os investimentos do mês de {formatMonthYear(state.currentMonth)} já foram feitos com sucesso!
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    O futuro de vocês agradece. Total guardado: <strong>{formatCurrency(completionRecord?.totalDeposited || guide.totalPlanned)}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-black border border-slate-300 dark:border-slate-700 cursor-pointer shadow-xs"
              >
                Ver Guia & Detalhes
              </button>
            </div>
          );
        }

        return (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0 shadow-sm font-black">
                  🏦
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-950 dark:text-white font-display">
                      Ficha de Aportes & Guia de Transferência
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      {formatMonthYear(state.currentMonth)}
                    </span>
                    {guide.suggestedCeiling && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Teto sugerido: {formatCurrency(guide.suggestedCeiling)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    O guia de aportes do mês ficou em <strong>{formatCurrency(guide.totalPlanned)}</strong>. Confirmamos essa distribuição?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ajustar Valores</span>
                </button>

                <button
                  type="button"
                  onClick={() => executeMonthlyDeposit(state.currentMonth)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Já fiz os aportes do mês</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* PRIORIDADE 1: O TERMÔMETRO DO MÊS (ANEL SEGMENTADO CIRCULAR EM ARCOS)      */}
      {/* ========================================================================= */}
      <MonthThermometerGauge
        engineResult={thermometerEngineResult}
        activeLifeTier={activeLifeTier}
        onOpenRaioX={() => setActiveModal('thermometer')}
      />

      {/* Atalho Inteligente para o Hub de Sobras & Excessos Semanais */}
      {aiPredictiveInsights.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('surplus');
            document.getElementById('dashboard-tabs-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full p-3.5 sm:p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-100 flex items-center justify-between text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-center text-sm font-black shrink-0">
              🌿
            </span>
            <div className="text-left">
              <span className="text-slate-900 dark:text-white font-black block sm:inline">
                {aiPredictiveInsights.length} oportunidade{aiPredictiveInsights.length === 1 ? '' : 's'} de sobra ou recompensa identificada{aiPredictiveInsights.length === 1 ? '' : 's'}
              </span>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block sm:inline sm:ml-1.5 font-medium">
                · Toque para ver no Hub de Sobras &amp; Excessos
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-black group-hover:translate-x-1 transition-transform text-xs shrink-0 ml-2">
            <span>Abrir Hub</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {/* ========================================================================= */}
      {/* PRIORIDADE 2: FAIXA DE VIDA ATUAL (CLICÁVEL - JORNADA DAS 4 FAIXAS)       */}
      {/* ========================================================================= */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActiveModal('tier')}
        onKeyDown={e => e.key === 'Enter' && setActiveModal('tier')}
        className="group relative rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 shadow-md bg-white dark:bg-slate-900 cursor-pointer hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-primary"
        style={{
          borderColor: tier.colors.border,
          boxShadow: `0 10px 30px -8px ${tier.colors.glow}`,
        }}
        aria-label="Abrir detalhes da faixa de renda e jornada"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="text-3xl sm:text-4xl p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-md border-2 border-slate-300 dark:border-slate-700 shrink-0 group-hover:scale-105 transition-transform">
              {tier.emblem}
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border-2 shadow-xs bg-slate-100 dark:bg-slate-800"
                  style={{
                    color: tier.colors.text,
                    borderColor: tier.colors.border,
                  }}
                >
                  {tier.name}
                </span>

                {isCustomizedPercentages ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100 border border-amber-400">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Personalizado Manualmente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100 border border-emerald-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Padrões Junto Ativos
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-xl font-black text-slate-950 dark:text-white tracking-tight truncate">
                {tier.tagline}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Renda do Casal
              </span>
              <span className="text-base sm:text-lg font-black text-slate-950 dark:text-white tabular-nums">
                {formatCurrency(totalIncome)}/mês
              </span>
            </div>

            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* Progress Bar toward next tier */}
        <div className="mt-4 pt-3 border-t-2 border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Progresso da Fase: {tierProgress.percentage}%</span>
            <span>
              {tierProgress.isMaxTier
                ? 'Nível Máximo Alcançado 🪐'
                : `Faltam ${formatCurrency(tierProgress.amountToNext)} para ${tierProgress.nextTierName}`}
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(6, tierProgress.percentage)}%`,
                background: `linear-gradient(90deg, ${tier.colors.primary}, ${tier.colors.secondary})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRIORIDADE 3: AS 3 PERGUNTAS ESSENCIAIS (3 CARDS BENTO CLAYMORPHIC)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Question 1: Quanto tem? -> CLICÁVEL: PATRIMÔNIO & COFRINHOS (Fresh Sage #B8E0B0) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveModal('wealth')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveModal('wealth')}
          className="group clay-card bento-card-sage p-5 flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.01] focus:outline-none"
          aria-label="Abrir detalhamento de quanto a gente tem"
        >
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-black text-[#111318] dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Quanto {isIndividualView ? activePersonName : 'a gente'} tem?</span>
            </span>
            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-sm shadow-2xs group-hover:scale-110 transition-transform">
              <span>💎</span>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black tabular-nums font-display text-[#111318] dark:text-white">
              {formatCurrency((isIndividualView ? totalSavedInPiggyBanks * 0.5 : totalSavedInPiggyBanks) + Math.max(0, displayedRemaining))}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1.5 flex items-center gap-1.5">
              <span>{formatCurrency(isIndividualView ? totalSavedInPiggyBanks * 0.5 : totalSavedInPiggyBanks)} guardados</span>
              <span>·</span>
              <span className="font-black text-emerald-800 dark:text-emerald-300">
                {formatCurrency(Math.max(0, displayedRemaining))} livres
              </span>
            </div>
          </div>
        </div>

        {/* Question 2: Quanto gastou? -> CLICÁVEL: EXTRATO DO MÊS (Warm Ochre #FFC875) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveModal('spent')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveModal('spent')}
          className="group clay-card bento-card-ochre p-5 flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.01] focus:outline-none"
          aria-label="Abrir detalhamento de quanto a gente gastou"
        >
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-black text-[#111318] dark:text-white text-xs uppercase tracking-wider">
              2. Quanto {isIndividualView ? activePersonName : 'a gente'} gastou?
            </span>
            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-sm shadow-2xs group-hover:scale-110 transition-transform">
              <span>💳</span>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[#111318] dark:text-white tabular-nums font-display">
              {formatCurrency(displayedTotalSpent)}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1.5 flex items-center gap-1.5">
              <span>{budgetConsumedPercent.toFixed(0)}% da renda</span>
              <span>·</span>
              <span className="text-slate-600 dark:text-slate-400">{currentMonthExpenses.length} lançamentos</span>
            </div>
          </div>
        </div>

        {/* Question 3: Ritmo -> CLICÁVEL: SAÚDE & CELEBRAÇÃO (Lavender #D8C7FF) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveModal('rhythm')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveModal('rhythm')}
          className="group clay-card bento-card-lavender p-5 flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.01] focus:outline-none"
          aria-label="Abrir detalhamento do ritmo do casal"
        >
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-black text-[#111318] dark:text-white text-xs uppercase tracking-wider">
              3. Ritmo {isIndividualView ? `de ${activePersonName}` : 'do casal'}
            </span>
            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-sm shadow-2xs group-hover:scale-110 transition-transform">
              <span>🎉</span>
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#111318] dark:text-white font-display">
              {state.profile.streakMonths} meses no plano
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1.5">
              Faltam {progress.daysRemaining} dias para o próximo mês
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRIORIDADE 4: AS 5 ÁREAS DA VIDA (CARDS INTERATIVOS CLICÁVEIS)            */}
      {/* ========================================================================= */}
      <div className="clay-card p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
              As 6 Áreas da Vida do Casal
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Ordenadas por maior gasto. Toque em qualquer categoria para abrir o raio-x e despesas.
            </p>
          </div>
          <button
            onClick={() => onNavigate('categories')}
            className="text-xs font-black text-accent-themed hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            Ver tela completa
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {sortedCategories.map(catKey => {
            const cat = CATEGORIES_BASE[catKey];
            const spend = categoriesSpending[catKey];
            const percent = Math.min(100, spend.percentageUsed);

            let barFill = 'bg-accent-primary';
            let statusBadge = (
              <span className="text-xs font-black text-accent-themed">
                Resta {formatCurrency(spend.remaining)}
              </span>
            );

            if (spend.isOver) {
              barFill = 'bg-rose-500';
              statusBadge = (
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  ⚠️ Passou {formatCurrency(Math.abs(spend.remaining))} do combinado
                </span>
              );
            } else if (spend.percentageUsed >= 85) {
              barFill = 'bg-amber-500';
              statusBadge = (
                <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                  Atenção amiga: resta {formatCurrency(spend.remaining)}
                </span>
              );
            }

            return (
              <div
                key={catKey}
                onClick={() => openCategoryModal(catKey)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openCategoryModal(catKey)}
                className="group p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">{cat.emoji}</span>
                    <div>
                      <span className="font-black text-slate-950 dark:text-white text-sm">{cat.name}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold ml-2 hidden sm:inline">
                        {cat.description}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-slate-950 dark:text-white tabular-nums">
                      {formatCurrency(spend.spent)}{' '}
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        / {formatCurrency(spend.budget)}
                      </span>
                    </div>
                    {statusBadge}
                  </div>
                </div>

                {/* Copo d'água / Glass Bar */}
                <div className="relative h-3.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-600">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barFill}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BALANÇO DO CASAL: GRÁFICO DE ROSCA (RENDA, ECONOMIA & 5 ÁREAS DA VIDA)    */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">👩‍❤️‍👨</span>
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                Equilíbrio do Casal: Renda, Economia &amp; Áreas da Vida
              </h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              Como cada real da renda de {state.profile.partner1Name} &amp; {state.profile.partner2Name} está distribuído neste mês.
            </p>
          </div>
          <span className="self-start sm:self-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
            {coupleSavings > 0 ? '🌱 Economia Preservada' : '⚠️ Atenção aos Gastos'}
          </span>
        </div>

        {/* Dynamic Interactive Couple Donut Chart + Companion Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart Canvas */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            <DonutChart
              data={coupleDonutData}
              size={250}
              thickness={44}
              centerTitle="Renda do Casal"
              centerValue={totalIncome}
              centerSubtitle="Receita Conjunta"
              formatter={(val) => formatCurrency(val)}
              className="w-full"
            />
            <div className="mt-2 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                👆 Toque em qualquer fatia ou legenda para destacar e fixar os valores
              </span>
            </div>
          </div>

          {/* Quick Metrics & Strategic Breakdown */}
          <div className="lg:col-span-5 space-y-3">
            {/* Metric 1: Renda Total */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Renda Total do Casal
                </span>
                <span className="text-lg font-black text-slate-950 dark:text-white tabular-nums">
                  {formatCurrency(totalIncome)}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                100% da base
              </span>
            </div>

            {/* Metric 2: Economia Mensal */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                  Economia / Poupança do Mês
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(coupleSavings)}
                </span>
              </div>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                {totalIncome > 0 ? ((coupleSavings / totalIncome) * 100).toFixed(0) : 0}% da renda
              </span>
            </div>

            {/* Metric 3: Total Gasto */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Total Comprometido em Despesas
                </span>
                <span className="text-lg font-black text-slate-950 dark:text-white tabular-nums">
                  {formatCurrency(displayedTotalSpent)}
                </span>
              </div>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
                {budgetConsumedPercent.toFixed(0)}% da renda
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 leading-snug">
              ✨ <strong>Pacto do Casal:</strong> A rosca equilibra a vida atual com a segurança de amanhã. Ao gastar menos do que a renda, a fatia verde de economia constrói a liberdade de vocês.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRIORIDADE 5: SEÇÕES COMPLEMENTARES ORGANIZADAS EM ABAS SEGMENTADAS       */}
      {/* (Evita poluição visual no dashboard e organiza por tópicos)               */}
      {/* ========================================================================= */}
      <div id="dashboard-tabs-section" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent-themed" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Explorar Mais no Dashboard
            </h4>
          </div>
          <span className="text-[11px] font-bold text-slate-500">Toque para alternar o foco</span>
        </div>

        {/* Sleek Segmented Switcher for Dashboard Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700">
          <button
            onClick={() => setActiveDashboardTab('actions')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'actions'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span>✨</span>
            <span>Ações</span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('surplus')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeDashboardTab === 'surplus'
                ? 'bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-300 shadow-sm border border-emerald-300 dark:border-emerald-700 font-black'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span>🌿</span>
            <span className="truncate">Sobras &amp; Excessos</span>
            {aiPredictiveInsights.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                {aiPredictiveInsights.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDashboardTab('split')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'split'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span>⚖️</span>
            <span>Divisão 50/50</span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('future')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'future'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span>📅</span>
            <span>Cofrinhos</span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('fusion')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'fusion'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span>🔗</span>
            <span>Fusão &amp; Bancos</span>
          </button>
        </div>

        {/* TAB 1: AÇÕES & RITUAIS */}
        {activeDashboardTab === 'actions' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => onOpenExpenseModal()}
                className="btn-primary-accent flex flex-col items-center justify-center p-4 rounded-2xl text-white font-black shadow-md active:scale-95 transition-transform cursor-pointer"
              >
                <span className="text-2xl mb-1">➕</span>
                <span className="text-xs">LANÇAR GASTO</span>
              </button>

              <button
                onClick={onOpenIncomeModal}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-600/20 active:scale-95 transition-transform cursor-pointer"
              >
                <span className="text-2xl mb-1">💰</span>
                <span className="text-xs">NOVA RECEITA</span>
              </button>

              <button
                onClick={onOpenInstallmentModal}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-md shadow-amber-600/20 active:scale-95 transition-transform cursor-pointer"
              >
                <span className="text-2xl mb-1">📦</span>
                <span className="text-xs">NOVA PARCELA</span>
              </button>
            </div>

            {/* O Pulso da Semana Ritual Banner */}
            {onOpenWeeklyPulse && (
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-950 text-white border-2 border-indigo-500 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-indigo-500/30 text-indigo-200 border-2 border-indigo-400 flex items-center justify-center text-2xl shrink-0">
                    🕊️
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base text-white font-display">
                        O Pulso da Semana — Juntô
                      </h4>
                      <span className="text-xs bg-amber-400/30 text-amber-200 border border-amber-400/50 px-2 py-0.5 rounded-full font-black">
                        Ritual Domingo 19h30
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">
                      Alinhem as finanças em 15 minutos sem estresse.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenWeeklyPulse}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <span>Abrir Ritual Semanal</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Alerta de Estouro ou Tudo em Ordem */}
            {highestBlownCategory ? (
              <div className="p-4 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-100 shadow-md flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 flex items-center justify-center shrink-0 text-xl font-black">
                  ⚠️
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm tracking-tight text-rose-950 dark:text-rose-100">
                    ATENÇÃO: Categoria passou do combinado
                  </h4>
                  <p className="text-xs text-rose-900 dark:text-rose-200 mt-0.5 font-bold">
                    <strong>{highestBlownCategory.name}</strong> passou{' '}
                    <strong>{formatCurrency(highestBlownCategory.overAmount)}</strong> do combinado este mês.
                  </p>
                </div>
                <button
                  onClick={() => openCategoryModal(highestBlownCategory.key)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black shrink-0 self-center transition-colors shadow-xs cursor-pointer"
                >
                  Ver Detalhes
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-400 dark:border-emerald-600 text-slate-900 dark:text-white shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 stroke-[2.5]" />
                  <span className="text-xs sm:text-sm font-black">
                    Tudo em ordem por aqui. Continuem assim! 👏
                  </span>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hidden sm:inline">
                  Nenhuma categoria estourou o limite
                </span>
              </div>
            )}

            {/* Alertas Preventivos Preditivos de Ritmo de Queima */}
            {!highestBlownCategory && predictiveBurnAlerts.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Alerta Preventivo de Ritmo de Gastos
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {predictiveBurnAlerts.slice(0, 2).map((alert) => (
                    <div
                      key={alert.categoryKey}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800"
                    >
                      <div>
                        <span className="font-black text-slate-900 dark:text-white">
                          {alert.categoryEmoji} {alert.categoryName}:
                        </span>{' '}
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {alert.recommendation}
                        </span>
                      </div>
                      <button
                        onClick={() => openCategoryModal(alert.categoryKey)}
                        className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline shrink-0 hover:text-amber-950 cursor-pointer"
                      >
                        Ajustar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HUB DEDICADO DE SOBRAS, RITMO & EXCESSOS SEMANAIS */}
        {activeDashboardTab === 'surplus' && (
          <WeeklySurplusHub
            onOpenExpenseModal={onOpenExpenseModal}
            onNavigateToGoals={() => onNavigate('goals')}
          />
        )}

        {/* TAB 2: DIVISÃO DO CASAL (50/50) */}
        {activeDashboardTab === 'split' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-4 transition-colors animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center text-xl font-black border border-slate-300 dark:border-slate-700">
                  ⚖️
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display leading-tight">
                    Divisão dos Gastos do Casal
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Quanto foi gasto em conjunto, quanto foi individual e a cota de cada um
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('categories')}
                className="text-xs font-black text-accent-themed hover:underline flex items-center gap-1 transition-colors"
              >
                Ver por gasto <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Visual Dual-Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-accent-primary flex items-center gap-1">
                  <span>👤</span> {state.profile.partner1Name}: {formatCurrency(partner1ShareSpent)} ({p1SharePct}%)
                </span>
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  {state.profile.partner2Name}: {formatCurrency(partner2ShareSpent)} ({p2SharePct}%) <span>👤</span>
                </span>
              </div>

              {/* Stacked Share Bar */}
              <div className="h-4 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex p-0.5 border-2 border-slate-300 dark:border-slate-700 shadow-inner">
                <div
                  className="h-full bg-accent-primary rounded-l-full transition-all duration-700"
                  style={{ width: `${p1SharePct}%` }}
                />
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-r-full transition-all duration-700"
                  style={{ width: `${p2SharePct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pt-0.5">
                <span>Renda {state.profile.partner1Name}: {formatCurrency(state.profile.partner1Income)} ({p1IncomePct}%)</span>
                <span>Renda {state.profile.partner2Name}: {formatCurrency(state.profile.partner2Income)} ({p2IncomePct}%)</span>
              </div>
            </div>

            {/* Intelligent Couple Settlement & Compensation */}
            <CoupleSettlementCard />

            {/* 3 Metric Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-purple-100/70 dark:bg-purple-950/50 border-2 border-purple-300 dark:border-purple-700 shadow-xs">
                <div className="flex items-center justify-between text-xs font-black text-purple-950 dark:text-purple-200 mb-1">
                  <span>🤝 Em Conjunto</span>
                  <span className="text-xs bg-purple-200 dark:bg-purple-900 px-2 py-0.5 rounded-md">Divididos</span>
                </div>
                <div className="text-2xl font-black text-purple-950 dark:text-purple-100 tabular-nums font-display">
                  {formatCurrency(jointExpensesTotal)}
                </div>
                <p className="text-xs text-purple-900 dark:text-purple-300 mt-1 font-semibold">
                  Mercado, moradia e despesas compartilhadas
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-700 shadow-xs">
                <div className="flex items-center justify-between text-xs font-black text-emerald-950 dark:text-emerald-200 mb-1">
                  <span>👤 Só {state.profile.partner1Name}</span>
                  <span className="text-xs bg-emerald-200 dark:bg-emerald-900 px-2 py-0.5 rounded-md">100% individual</span>
                </div>
                <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 tabular-nums font-display">
                  {formatCurrency(partner1SoleExpensesTotal)}
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-300 mt-1 font-semibold">
                  Gastos exclusivos e pessoais
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-100/70 dark:bg-blue-950/50 border-2 border-blue-300 dark:border-blue-700 shadow-xs">
                <div className="flex items-center justify-between text-xs font-black text-blue-950 dark:text-blue-200 mb-1">
                  <span>👤 Só {state.profile.partner2Name}</span>
                  <span className="text-xs bg-blue-200 dark:bg-blue-900 px-2 py-0.5 rounded-md">100% individual</span>
                </div>
                <div className="text-2xl font-black text-blue-950 dark:text-blue-100 tabular-nums font-display">
                  {formatCurrency(partner2SoleExpensesTotal)}
                </div>
                <p className="text-xs text-blue-900 dark:text-blue-300 mt-1 font-semibold">
                  Gastos exclusivos e pessoais
                </p>
              </div>
            </div>

            {/* Interactive Couple Expense Split Donut Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white font-display">
                  Proporção de Despesas do Casal
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Visão proporcional entre gastos compartilhados e despesas individuais de cada um
                </p>
              </div>

              <div className="flex justify-center py-2">
                <DonutChart
                  data={[
                    {
                      label: '🤝 Em Conjunto',
                      value: jointExpensesTotal,
                      color: '#8b5cf6',
                    },
                    {
                      label: `👤 Só ${state.profile.partner1Name}`,
                      value: partner1SoleExpensesTotal,
                      color: '#10b981',
                    },
                    {
                      label: `👤 Só ${state.profile.partner2Name}`,
                      value: partner2SoleExpensesTotal,
                      color: '#3b82f6',
                    },
                  ]}
                  size={240}
                  thickness={42}
                  centerTitle="Total Despesas"
                  centerSubtitle="Do Mês"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARCELAS & COFRINHOS */}
        {activeDashboardTab === 'future' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Parcelas do Próximo Mês */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center text-base font-black border border-amber-300 dark:border-amber-700">
                    📅
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                      Comprometido para o Próximo Mês ({nextMonthKey})
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Parcelas já contratadas que nascem descontadas no próximo mês
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('installments')}
                  className="text-xs font-black text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1 transition-colors"
                >
                  Ver todas ({activeInstallments.length})
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {isInstallmentCommitmentHigh && (
                <div className="p-3.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-700 text-xs text-rose-950 dark:text-rose-100 flex items-center gap-2 font-bold shadow-xs">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    Vocês comprometeram <strong>{installmentCommitmentPercentage}%</strong> da renda com parcelas.
                    Mantenham abaixo de 15% para proteger o orçamento!
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 shadow-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                      Total de Parcelas Mês Que Vem
                    </span>
                    <div className="text-2xl font-black text-amber-950 dark:text-amber-100 font-display tabular-nums">
                      {formatCurrency(nextMonthCommittedInstallmentsAmount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                      {installmentCommitmentPercentage}% da renda mensal
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold block">
                      (Teto seguro recomendado: 15%)
                    </span>
                  </div>
                </div>

                {activeInstallments.length === 0 ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 py-2 font-semibold">
                    Nenhuma compra parcelada ativa. Orçamento totalmente livre!
                  </div>
                ) : (
                  <div className="space-y-2 pt-2.5 border-t-2 border-amber-200 dark:border-amber-800">
                    {activeInstallments.slice(0, 3).map(item => {
                      const cat = CATEGORIES_BASE[item.category];
                      return (
                        <div key={item.id} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{cat.emoji}</span>
                            <span className="font-extrabold text-slate-950 dark:text-white truncate">
                              {item.title}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                              ({item.paidInstallmentsCount}/{item.installmentsCount}x)
                            </span>
                          </div>
                          <div className="font-black text-slate-950 dark:text-white tabular-nums shrink-0">
                            {formatCurrency(item.installmentAmount)}/mês
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Os Cofrinhos */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                    Os Cofrinhos do Casal
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Segurança e metas conjuntas sem financiamentos
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('goals')}
                  className="text-xs font-black text-accent-themed hover:underline flex items-center gap-1 transition-colors"
                >
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {state.piggyBanks.map(bank => {
                  const pct = Math.min(100, Math.round((bank.currentAmount / bank.targetAmount) * 100));
                  return (
                    <div
                      key={bank.id}
                      className="p-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl">{bank.emoji}</span>
                          <button
                            onClick={() => onOpenDepositModal(bank.id)}
                            className="px-3 py-1.5 rounded-xl bg-accent-surface text-accent-themed text-xs font-black border border-accent-themed transition-colors hover:opacity-90 cursor-pointer shadow-2xs"
                          >
                            + Guardar
                          </button>
                        </div>
                        <h4 className="font-black text-slate-950 dark:text-white text-sm">{bank.name}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">{bank.purpose}</p>

                        <div className="mt-3">
                          <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-display">
                            {formatCurrency(bank.currentAmount)}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                            Meta: {formatCurrency(bank.targetAmount)} ({pct}%)
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t-2 border-slate-200 dark:border-slate-700">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-accent-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FUSÃO & BANCOS */}
        {activeDashboardTab === 'fusion' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Bento Grid: Registration Info vs Fusion controls */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-6 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-emerald-500 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                    💑
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white font-display">
                      Status da Fusão JUNTÔ
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Sincronização em tempo real do casal na nuvem
                    </p>
                  </div>
                </div>

                <div>
                  {state.profile.partner2Name === 'Aguardando Par...' ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 text-xs font-black animate-pulse shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Aguardando Fusão do Par
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-200 text-xs font-black shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Fusão do Casal Ativa 💕
                    </span>
                  )}
                </div>
              </div>

              {/* Fusion Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invite Code */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Seu Código de Convite:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-center font-mono font-black text-sm tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700">
                      {coupleAccount?.inviteCode || 'CASAL6'}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coupleAccount?.inviteCode || 'CASAL6');
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                      title="Copiar código"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Partner Fusion Form */}
                <form onSubmit={handleHomeScreenFusion} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 space-y-2 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Conectar Código do Par:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={inviteCodeInput}
                      onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                      placeholder="EX: 7X82Q1"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono font-black uppercase text-center text-slate-950 dark:text-white"
                      disabled={fusionLoading}
                    />
                    <button
                      type="submit"
                      disabled={fusionLoading || !inviteCodeInput.trim()}
                      className="btn-primary-accent px-4 py-2 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {fusionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Conectar'}
                    </button>
                  </div>
                </form>
              </div>

              {fusionFeedback.text && (
                <div className={`p-3 rounded-xl border-2 text-xs font-bold ${
                  fusionFeedback.type === 'success'
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-100 border-rose-400 text-rose-950 dark:text-rose-200'
                }`}>
                  {fusionFeedback.text}
                </div>
              )}
            </div>

            {/* Open Finance & Meu Pluggy */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-4 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xl shrink-0 border border-emerald-300 dark:border-emerald-700">
                    🏛️
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white font-display">
                      Open Finance (Meu Pluggy)
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Sincronização bancária direta e segura
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => syncPluggyData()}
                    disabled={isSyncingBanks}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-extrabold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBanks ? 'animate-spin text-emerald-500' : ''}`} />
                    <span>{isSyncingBanks ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </button>

                  <button
                    onClick={() => onOpenBankSyncModal ? onOpenBankSyncModal() : onNavigate('settings')}
                    className="btn-primary-accent flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white font-black text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    <span>🔌</span>
                    <span>Conectar Banco</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: RAIO-X DO MÊS (AO CLICAR NO TERMÔMETRO/SALDO)                     */}
      {/* ========================================================================= */}
      <ThermometerRaioXModal
        isOpen={activeModal === 'thermometer'}
        onClose={() => setActiveModal(null)}
        engineResult={thermometerEngineResult}
        onOpenExpenseModal={() => onOpenExpenseModal()}
        onNavigateTransactions={() => onNavigate('transactions')}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: JORNADA DAS 4 FAIXAS & REGRAS DE OURO                             */}
      {/* ========================================================================= */}
      {activeModal === 'tier' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  {tier.emblem}
                </span>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight">
                    Jornada das 4 Faixas — Juntô
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Vocês estão na {tier.name} · Renda R$ {formatCurrency(totalIncome)}/mês
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                "{tier.message}"
              </p>

              {/* As 4 Fases da Jornada */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  As 4 Faixas de Liberdade Financeira:
                </span>
                <div className="space-y-2">
                  {Object.values(LIFE_TIERS).map(t => {
                    const isCurrent = t.key === tier.key;
                    return (
                      <div
                        key={t.key}
                        className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all ${
                          isCurrent
                            ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{t.emblem}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-slate-950 dark:text-white">{t.name}</span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                                  Faixa Atual
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{t.tagline}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs font-black text-slate-900 dark:text-slate-100">
                          {t.minIncome === 0
                            ? `Até R$ ${formatCurrency(t.maxIncome)}`
                            : t.maxIncome === Infinity
                            ? `Acima de R$ ${formatCurrency(t.minIncome)}`
                            : `R$ ${formatCurrency(t.minIncome)} a ${formatCurrency(t.maxIncome)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Regra de Ouro da Faixa */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 text-xs space-y-1">
                <strong className="text-indigo-950 dark:text-indigo-200 block font-black">
                  Ponto de Inflexão (R$ 35k):
                </strong>
                <p className="text-indigo-900 dark:text-indigo-300 font-medium">
                  {tier.inflectionNote}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('settings');
                }}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
              >
                Ajustar Porcentagens nos Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PATRIMÔNIO & COFRINHOS (QUANTO A GENTE TEM?)                     */}
      {/* ========================================================================= */}
      {activeModal === 'wealth' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xl font-black">
                  💎
                </span>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight">
                    Patrimônio &amp; Cofrinhos
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Total guardado e liquidez livre do casal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1 text-center">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Total Acumulado do Casal
                </span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                  {formatCurrency(totalSavedInPiggyBanks + Math.max(0, displayedRemaining))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Distribuição dos Cofrinhos:
                </span>
                {state.piggyBanks.map(b => {
                  const pct = Math.min(100, Math.round((b.currentAmount / b.targetAmount) * 100));
                  return (
                    <div key={b.id} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{b.emoji}</span>
                        <div className="min-w-0">
                          <strong className="text-xs font-black text-slate-950 dark:text-white block truncate">{b.name}</strong>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">{pct}% da meta de {formatCurrency(b.targetAmount)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-950 dark:text-white block tabular-nums">{formatCurrency(b.currentAmount)}</span>
                        <button
                          onClick={() => {
                            setActiveModal(null);
                            onOpenDepositModal(b.id);
                          }}
                          className="text-[10px] font-black text-accent-themed hover:underline cursor-pointer"
                        >
                          + Guardar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('goals');
                }}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
              >
                Gerenciar Investimentos &amp; Metas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EXTRATO DO MÊS (QUANTO A GENTE GASTOU?)                           */}
      {/* ========================================================================= */}
      {activeModal === 'spent' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xl font-black">
                  💳
                </span>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight">
                    Gastos do Mês ({formatShortMonthYear(state.currentMonth)})
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Total: {formatCurrency(displayedTotalSpent)} ({budgetConsumedPercent.toFixed(0)}% da renda)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Últimos Lançamentos Registrados:
              </span>

              {currentMonthExpenses.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-medium">
                  Nenhum gasto registrado neste mês ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {currentMonthExpenses.slice(0, 6).map(exp => {
                    const cat = CATEGORIES_BASE[exp.category];
                    return (
                      <div key={exp.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{cat.emoji}</span>
                          <div className="min-w-0">
                            <strong className="text-xs font-black text-slate-950 dark:text-white block truncate">{exp.description}</strong>
                            <span className="text-[10px] text-slate-500 font-semibold">{cat.name} · {exp.date}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-slate-950 dark:text-white tabular-nums">
                          {formatCurrency(exp.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('transactions');
                }}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
              >
                Ver Extrato Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RITMO & DISCIPLINA DO CASAL                                       */}
      {/* ========================================================================= */}
      {activeModal === 'rhythm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xl font-black">
                  🎉
                </span>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight">
                    Ritmo &amp; Sequência do Casal
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Saúde da rotina financeira conjunta
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-1 text-center">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Sequência no Azul
                </span>
                <div className="text-3xl font-black text-amber-900 dark:text-amber-200 font-display">
                  {state.profile.streakMonths} Meses Consecutivos!
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Vocês mantêm as finanças de casal alinhadas sem surpresas no fim do mês.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <strong className="text-slate-950 dark:text-white block font-black">
                  Dica de Ouro para este Mês:
                </strong>
                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  Faltam <strong>{progress.daysRemaining} dias</strong> para o próximo mês. Mantenham o gasto médio abaixo de <strong>{formatCurrency(safeDailyLimit)}/dia</strong> para fechar no azul e comemorar mais um mês consecutivo de vitória conjunta!
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
              >
                Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: RAIO-X DA CATEGORIA SELECIONADA                                  */}
      {/* ========================================================================= */}
      {activeModal === 'category' && selectedCategoryModalKey && (() => {
        const cat = CATEGORIES_BASE[selectedCategoryModalKey];
        const spend = categoriesSpending[selectedCategoryModalKey];
        const catExpenses = currentMonthExpenses.filter(e => e.category === selectedCategoryModalKey);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setActiveModal(null)} />
            <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    {cat.emoji}
                  </span>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight">
                      Raio-X: {cat.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {cat.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                {/* Metric Summary */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400 block font-bold">Total Gasto:</span>
                    <strong className="text-base font-black text-slate-950 dark:text-white block mt-0.5 tabular-nums">
                      {formatCurrency(spend.spent)}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-semibold">{spend.percentageUsed.toFixed(0)}% do teto</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400 block font-bold">Teto Combinado:</span>
                    <strong className="text-base font-black text-slate-950 dark:text-white block mt-0.5 tabular-nums">
                      {formatCurrency(spend.budget)}
                    </strong>
                    <span className={`text-[11px] font-black ${spend.isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {spend.isOver ? `Estourou ${formatCurrency(Math.abs(spend.remaining))}` : `Resta ${formatCurrency(spend.remaining)}`}
                    </span>
                  </div>
                </div>

                {/* Se for Comida & Conveniência, exibir inteligência de abastecimento e pacing semanal */}
                {selectedCategoryModalKey === 'comida' && (
                  <FoodPacingWeeklyCard
                    onOpenExpenseModal={() => {
                      setActiveModal(null);
                      onOpenExpenseModal('comida');
                    }}
                  />
                )}

                {/* Recent expenses in this category */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Lançamentos deste Mês ({catExpenses.length}):
                  </span>

                  {catExpenses.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 font-medium">
                      Nenhum gasto em {cat.name} registrado este mês.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {catExpenses.map(exp => (
                        <div key={exp.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-950 dark:text-white block">{exp.description}</span>
                            <span className="text-[10px] text-slate-500">{exp.date} · Pago por {exp.paidBy === 'both' ? 'Casal' : exp.paidBy === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name}</span>
                          </div>
                          <span className="font-black text-slate-950 dark:text-white tabular-nums">{formatCurrency(exp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => {
                    setActiveModal(null);
                    onOpenExpenseModal(selectedCategoryModalKey);
                  }}
                  className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
                >
                  + Lançar em {cat.name}
                </button>
                <button
                  onClick={() => {
                    setActiveModal(null);
                    onNavigate('categories', selectedCategoryModalKey);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-xs cursor-pointer"
                >
                  Ver Tela da Categoria
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal de Entrada Ativa */}
      {activeConfirmationModal && (
        <ActiveIncomeConfirmationModal
          confirmation={activeConfirmationModal}
          onClose={() => setActiveConfirmationModal(null)}
        />
      )}

      {/* Safety Confirmation Modal: Apagar Conteúdo Atual da Conta */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !isClearing && setShowClearModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/60 overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <span className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                ⚠️
              </span>
              <div>
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  Apagar Todo o Conteúdo Atual da Conta?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Esta ação é irreversível. Todos os gastos, receitas, parcelas e contas serão removidos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isClearing}
                onClick={async () => {
                  setIsClearing(true);
                  try {
                    await clearAllData();
                    setShowClearModal(false);
                    triggerCelebration();
                  } catch (e) {
                    console.error('Error clearing data', e);
                  } finally {
                    setIsClearing(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-rose-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Apagando Dados...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Apagar Todo o Conteúdo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alocação Seletiva de Sobras Orçamentárias */}
      <SurplusAllocationModal
        isOpen={isSurplusModalOpen}
        onClose={() => setIsSurplusModalOpen(false)}
        onOpenGoalsTab={() => onNavigate('goals')}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
      />

      {/* Modal do Guia Didático de Aportes & Ajuste de Valores */}
      <MonthlyDepositGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
};
