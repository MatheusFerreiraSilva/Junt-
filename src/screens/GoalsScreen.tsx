import React, { useState, useMemo, useRef } from 'react';
import {
  Shield,
  Target,
  Unlock,
  Plus,
  Check,
  Sparkles,
  TrendingUp,
  Calculator,
  DollarSign,
  AlertCircle,
  Edit3,
  ArrowRight,
  Lock,
  PieChart,
  Info,
  X,
  ChevronRight,
  RefreshCw,
  Award,
  Building,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sliders,
  Percent,
  Flame,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { SavingsPiggyBank } from '../types/finance';
import { formatCurrency, formatHumanDuration, formatMonthYear } from '../utils/formatters';
import { compressImageFile, GOAL_PHOTO_PRESETS, GoalPhotoPreset } from '../utils/imageCompressor';
import { MonthlyDepositGuideModal } from '../components/MonthlyDepositGuideModal';
import { DonutChart } from '../components/DonutChart';
import { ReallocateReserveExcessModal } from '../components/ReallocateReserveExcessModal';
import { ClaymorphicIcon, ClayIconType } from '../components/ClaymorphicIcon';
import { PixDiscountComparatorModal } from '../components/modals/PixDiscountComparatorModal';
import { StrategicSpendingIntentModal } from '../components/modals/StrategicSpendingIntentModal';
import { FundingSourceType } from '../types/finance';

interface GoalsScreenProps {
  onOpenDepositModal?: (bankId: string) => void;
}

export const GoalsScreen: React.FC<GoalsScreenProps> = () => {
  const {
    state,
    totalIncome,
    autoCalculatedProtectionTarget,
    monthlyFixedExpensesAvg,
    emergencyReserveFloorAmount,
    emergencyReserveExcessAmount,
    toggleProtectionComplete,
    depositToProtection,
    toggleGoalComplete,
    depositToGoal,
    depositToFreedom,
    addPiggyBank,
    updatePiggyBank,
    deletePiggyBank,
    updateProtectionBankBalance,
    updateFreedomBankBalance,
    updateGoalBankBalance,
    triggerCelebration,
    setProtectionComplete,
    viewMode,
    currentAccent,
    investmentCeiling,
    getMonthlyDepositGuide,
    executeMonthlyDeposit,
    resetMonthlyDeposit,
    strategicIntents,
    deleteStrategicIntent,
  } = useFinance();

  // Top Page Sub-Tabs
  const [activeTab, setActiveTab] = useState<'investments' | 'simulator'>('investments');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const [selectedIntentSource, setSelectedIntentSource] = useState<FundingSourceType>('reserve_excess');
  const [selectedIntentGoalId, setSelectedIntentGoalId] = useState<string | undefined>(undefined);

  // Modals state - Create Goal
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('🎯');
  const [goalPurpose, setGoalPurpose] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalImageUrl, setGoalImageUrl] = useState('');

  // Edit Goal Modal (Name, Target with Market Variations, Monthly, Purpose, Emoji, Photo)
  const [editingGoal, setEditingGoal] = useState<SavingsPiggyBank | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalEmoji, setEditGoalEmoji] = useState('🎯');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalMonthly, setEditGoalMonthly] = useState('');
  const [editGoalPurpose, setEditGoalPurpose] = useState('');
  const [editGoalImageUrl, setEditGoalImageUrl] = useState('');

  // Photo Selector Modal for existing Goal
  const [photoTargetGoal, setPhotoTargetGoal] = useState<SavingsPiggyBank | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Goal Modal
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Interactive Bloco 3 Liberdade Chart States
  const [freedomHorizonYears, setFreedomHorizonYears] = useState<number>(10);
  const [freedomAnnualRate, setFreedomAnnualRate] = useState<number>(6.5);
  const [freedomExtraMonthly, setFreedomExtraMonthly] = useState<number>(0);
  const [isCustomRate, setIsCustomRate] = useState<boolean>(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Protection deposit modal
  const [isProtectionModalOpen, setIsProtectionModalOpen] = useState(false);
  const [protectionDepositAmount, setProtectionDepositAmount] = useState('');

  // Freedom deposit modal
  const [isFreedomModalOpen, setIsFreedomModalOpen] = useState(false);
  const [freedomDepositAmount, setFreedomDepositAmount] = useState('');

  // Goal deposit modal
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalDepositAmount, setGoalDepositAmount] = useState('');

  // ==========================================
  // BANK BALANCE & YIELD UPDATE MODALS (AUTORIZAÇÃO DO BANCO)
  // ==========================================
  // Protection Bank Balance Editor Modal
  const [isProtectionBankModalOpen, setIsProtectionBankModalOpen] = useState(false);
  const [protInvestedInput, setProtInvestedInput] = useState('');
  const [protBankTotalInput, setProtBankTotalInput] = useState('');

  // Freedom Bank Balance Editor Modal
  const [isFreedomBankModalOpen, setIsFreedomBankModalOpen] = useState(false);
  const [freeInvestedInput, setFreeInvestedInput] = useState('');
  const [freeBankTotalInput, setFreeBankTotalInput] = useState('');

  // Goal Bank Balance Editor Modal
  const [editingGoalBankId, setEditingGoalBankId] = useState<string | null>(null);
  const [goalInvestedInput, setGoalInvestedInput] = useState('');
  const [goalBankTotalInput, setGoalBankTotalInput] = useState('');

  // PIX vs CDI Comparator Modal
  const [comparingPixGoal, setComparingPixGoal] = useState<SavingsPiggyBank | null>(null);

  // Celebration Toast Banner
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  // ==========================================
  // SIMULATOR STATES
  // ==========================================
  const [finTotalValue, setFinTotalValue] = useState<number>(150000);
  const [finDownPayment, setFinDownPayment] = useState<number>(30000);
  const [finMonths, setFinMonths] = useState<number>(60);
  const [finAnnualRate, setFinAnnualRate] = useState<number>(12);

  const [compCashPrice, setCompCashPrice] = useState<number>(4500);
  const [compInstTotal, setCompInstTotal] = useState<number>(5000);
  const [compMonths, setCompMonths] = useState<number>(10);
  const [compMonthlyYield, setCompMonthlyYield] = useState<number>(0.8);

  const [antTarget, setAntTarget] = useState<number>(30000);
  const [antCurrentMonthly, setAntCurrentMonthly] = useState<number>(1000);
  const [antExtraMonthly, setAntExtraMonthly] = useState<number>(300);

  const [passDesiredIncome, setPassDesiredIncome] = useState<number>(15000);
  const [passCurrentMonthly, setPassCurrentMonthly] = useState<number>(3000);
  const [passAnnualYield, setPassAnnualYield] = useState<number>(6.5);

  // ==========================================
  // CALCULATED PHASE LOGIC
  // ==========================================
  const protectionRemaining = Math.max(0, autoCalculatedProtectionTarget - state.protectionCurrentAmount);
  const isPhase2 = state.isProtectionComplete;

  // Profile-specific styling helpers
  const profileLabel =
    viewMode === 'partner1'
      ? state.profile.partner1Name
      : viewMode === 'partner2'
      ? state.profile.partner2Name
      : 'Casal';

  const profileThemeHeaderGradient =
    viewMode === 'partner1'
      ? 'from-slate-900 via-blue-950 to-indigo-950 border-sky-500/40'
      : viewMode === 'partner2'
      ? 'from-slate-900 via-rose-950 to-pink-950 border-rose-500/40'
      : 'from-slate-900 via-slate-950 to-emerald-950 border-emerald-500/40';

  // Recommended monthly savings
  const monthlySavingsTarget = Math.round(totalIncome * 0.10);

  // Toast helper
  const showToast = (msg: string) => {
    setCelebrationMessage(msg);
    triggerCelebration();
    setTimeout(() => {
      setCelebrationMessage(null);
    }, 8000);
  };

  // Handlers
  const handleToggleProtectionComplete = () => {
    const nextState = !state.isProtectionComplete;
    toggleProtectionComplete();
    if (nextState) {
      showToast(
        'Vocês estão protegidos! A partir de agora, esse dinheiro só sai em emergência real. 🛡️✨'
      );
    }
  };

  const handleDepositProtection = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(protectionDepositAmount.replace(',', '.')) || 0;
    if (val > 0) {
      depositToProtection(val);
      setIsProtectionModalOpen(false);
      setProtectionDepositAmount('');
      showToast(`Aporte de ${formatCurrency(val)} realizado na Reserva de Proteção com sucesso! 🛡️`);
    }
  };

  const handleDepositFreedom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(freedomDepositAmount.replace(',', '.')) || 0;
    if (val > 0) {
      depositToFreedom(val);
      setIsFreedomModalOpen(false);
      setFreedomDepositAmount('');
      showToast(`Aporte de ${formatCurrency(val)} adicionado ao bloco Liberdade! 🔓`);
    }
  };

  const handleDepositGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(goalDepositAmount.replace(',', '.')) || 0;
    if (val > 0 && selectedGoalId) {
      depositToGoal(selectedGoalId, val);
      const targetGoal = state.piggyBanks.find(g => g.id === selectedGoalId);
      setSelectedGoalId(null);
      setGoalDepositAmount('');
      showToast(`Aporte de ${formatCurrency(val)} realizado em "${targetGoal?.name || 'Objetivo'}"! 🎯`);
    }
  };

  // Handlers for Updating Bank Yield & Balances
  const handleSaveProtectionBankBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const invested = parseFloat(protInvestedInput.replace(',', '.')) || 0;
    const bankTotal = parseFloat(protBankTotalInput.replace(',', '.')) || 0;
    updateProtectionBankBalance(invested, bankTotal);
    setIsProtectionBankModalOpen(false);

    const rendimento = Math.max(0, bankTotal - invested);
    showToast(
      `Saldo da Proteção atualizado! Aportado: ${formatCurrency(invested)} · Rendimento: ${formatCurrency(rendimento)} (Economia em juros)! 🛡️`
    );
  };

  const handleSaveFreedomBankBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const invested = parseFloat(freeInvestedInput.replace(',', '.')) || 0;
    const bankTotal = parseFloat(freeBankTotalInput.replace(',', '.')) || 0;
    updateFreedomBankBalance(invested, bankTotal);
    setIsFreedomBankModalOpen(false);

    const rendimento = Math.max(0, bankTotal - invested);
    showToast(
      `Saldo da Liberdade atualizado! Aportes: ${formatCurrency(invested)} · Rendimento: ${formatCurrency(rendimento)}! 🔓`
    );
  };

  const handleSaveGoalBankBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoalBankId) return;
    const invested = parseFloat(goalInvestedInput.replace(',', '.')) || 0;
    const bankTotal = parseFloat(goalBankTotalInput.replace(',', '.')) || 0;
    updateGoalBankBalance(editingGoalBankId, invested, bankTotal);

    const targetGoal = state.piggyBanks.find(g => g.id === editingGoalBankId);
    setEditingGoalBankId(null);

    const rendimento = Math.max(0, bankTotal - invested);
    showToast(
      `Saldo de "${targetGoal?.name || 'Objetivo'}" atualizado! Investido: ${formatCurrency(invested)} · Rendimento: ${formatCurrency(rendimento)}! 🎯`
    );
  };

  const handleToggleGoalComplete = (goal: SavingsPiggyBank) => {
    toggleGoalComplete(goal.id);
    if (!goal.completed) {
      showToast(
        `Parabéns casal! "${goal.name}" foi concluído com sucesso! 🎉 Os R$ ${goal.monthlyDeposit}/mês foram liberados para novos sonhos.`
      );
    }
  };

  const handleOpenEditGoal = (goal: SavingsPiggyBank) => {
    setEditingGoal(goal);
    setEditGoalName(goal.name);
    setEditGoalEmoji(goal.emoji || '🎯');
    setEditGoalTarget(goal.targetAmount.toString());
    setEditGoalMonthly((goal.monthlyDeposit || 0).toString());
    setEditGoalPurpose(goal.purpose || '');
    setEditGoalImageUrl(goal.imageUrl || '');
  };

  const handleSaveEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;
    const target = parseFloat(editGoalTarget.replace(',', '.')) || 0;
    const monthly = parseFloat(editGoalMonthly.replace(',', '.')) || 0;
    if (!editGoalName.trim() || target <= 0) return;

    updatePiggyBank(editingGoal.id, {
      name: editGoalName.trim(),
      emoji: editGoalEmoji || '🎯',
      targetAmount: target,
      monthlyDeposit: monthly,
      purpose: editGoalPurpose.trim() || 'Conquista planejada do casal',
      imageUrl: editGoalImageUrl.trim() || undefined,
    });

    setEditingGoal(null);
    showToast(`Objetivo "${editGoalName.trim()}" atualizado com sucesso! ✨`);
  };

  const handleDeleteGoal = (id: string) => {
    const goal = state.piggyBanks.find(g => g.id === id);
    deletePiggyBank(id);
    setDeletingGoalId(null);
    showToast(`Objetivo "${goal?.name || 'Cofrinho'}" removido com sucesso.`);
  };

  const handleFileUpload = async (file: File, target: 'create' | 'edit' | 'direct', goalId?: string) => {
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file, 800, 600, 0.82);
      if (target === 'create') {
        setGoalImageUrl(compressed);
      } else if (target === 'edit') {
        setEditGoalImageUrl(compressed);
      } else if (target === 'direct' && goalId) {
        updatePiggyBank(goalId, { imageUrl: compressed });
        setPhotoTargetGoal(null);
        showToast('Foto do cofrinho atualizada com sucesso! 📷✨');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar a imagem.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTarget.replace(',', '.')) || 0;
    const monthly = parseFloat(goalMonthly.replace(',', '.')) || 0;
    if (!goalName.trim() || target <= 0) return;

    addPiggyBank({
      name: goalName.trim(),
      emoji: goalEmoji || '🎯',
      imageUrl: goalImageUrl.trim() || undefined,
      purpose: goalPurpose.trim() || 'Conquista planejada do casal',
      currentAmount: 0,
      targetAmount: target,
      monthlyDeposit: monthly,
      totalInvested: 0,
      yieldAccumulated: 0,
      completed: false,
    });

    setIsCreatingGoal(false);
    setGoalName('');
    setGoalTarget('');
    setGoalMonthly('');
    setGoalPurpose('');
    setGoalImageUrl('');
    showToast('Novo objetivo criado com sucesso! 🎯');
  };

  // Calculations for Freedom
  const freedomPatrimonyToday = state.freedomTotalInvested + state.freedomYieldAccumulated;
  const freedomPassiveIncomeMonthly = Math.round((freedomPatrimonyToday * 0.04) / 12);

  // Base monthly contribution to freedom according to couple budget
  const freedomBaseMonthly = isPhase2 ? Math.round(monthlySavingsTarget * 0.42) : Math.round(monthlySavingsTarget * 0.20);
  const effectiveMonthlyFreedom = Math.max(0, freedomBaseMonthly + freedomExtraMonthly);

  // Global Totals Across All Investments
  const globalTotalInvested = useMemo(() => {
    const protInv = state.protectionTotalInvested || state.protectionCurrentAmount * 0.85;
    const goalsInv = state.piggyBanks.reduce(
      (sum, g) => sum + (g.totalInvested || g.currentAmount * 0.85),
      0
    );
    const freeInv = state.freedomTotalInvested;
    return protInv + goalsInv + freeInv;
  }, [state.protectionTotalInvested, state.protectionCurrentAmount, state.piggyBanks, state.freedomTotalInvested]);

  const globalTotalBalance = useMemo(() => {
    const protBal = state.protectionCurrentAmount;
    const goalsBal = state.piggyBanks.reduce((sum, g) => sum + g.currentAmount, 0);
    const freeBal = freedomPatrimonyToday;
    return protBal + goalsBal + freeBal;
  }, [state.protectionCurrentAmount, state.piggyBanks, freedomPatrimonyToday]);

  const globalYieldAccumulated = Math.max(0, globalTotalBalance - globalTotalInvested);
  const globalYieldPercentage = globalTotalInvested > 0 ? (globalYieldAccumulated / globalTotalInvested) * 100 : 0;

  // Functional & Reactive Line Chart Projection Points for Bloco 3 (Liberdade)
  const chartPoints = useMemo(() => {
    const points: {
      year: number;
      label: string;
      total: number;
      invested: number;
      yieldTotal: number;
      passiveMonthly: number;
      milestone?: string;
    }[] = [];

    const monthlyReturn = Math.pow(1 + freedomAnnualRate / 100, 1 / 12) - 1;
    let runningTotal = freedomPatrimonyToday;
    let runningInvested = state.freedomTotalInvested;

    // Track reached milestones so they only trigger once
    const milestonesReached = new Set<string>();

    for (let year = 0; year <= freedomHorizonYears; year++) {
      if (year === 0) {
        const yieldVal = Math.max(0, runningTotal - runningInvested);
        const passM = Math.round((runningTotal * 0.04) / 12);
        points.push({
          year: 0,
          label: 'Hoje',
          total: Math.round(runningTotal),
          invested: Math.round(runningInvested),
          yieldTotal: Math.round(yieldVal),
          passiveMonthly: passM,
        });
      } else {
        for (let m = 0; m < 12; m++) {
          runningTotal = runningTotal * (1 + monthlyReturn) + effectiveMonthlyFreedom;
          runningInvested += effectiveMonthlyFreedom;
        }

        const yieldVal = Math.max(0, runningTotal - runningInvested);
        const passM = Math.round((runningTotal * 0.04) / 12);

        let milestoneStr: string | undefined = undefined;
        if (runningTotal >= 100000 && !milestonesReached.has('100k')) {
          milestonesReached.add('100k');
          milestoneStr = '1º R$ 100k';
        } else if (runningTotal >= 500000 && !milestonesReached.has('500k')) {
          milestonesReached.add('500k');
          milestoneStr = 'Meio Milhão';
        } else if (runningTotal >= 1000000 && !milestonesReached.has('1m')) {
          milestonesReached.add('1m');
          milestoneStr = '🏆 1º Milhão';
        } else if (runningTotal >= 2000000 && !milestonesReached.has('2m')) {
          milestonesReached.add('2m');
          milestoneStr = 'R$ 2 Milhões';
        }

        if (monthlyFixedExpensesAvg > 0 && passM >= monthlyFixedExpensesAvg && !milestonesReached.has('indep')) {
          milestonesReached.add('indep');
          milestoneStr = '🔓 Liberdade Plena';
        }

        points.push({
          year,
          label: `${year}a`,
          total: Math.round(runningTotal),
          invested: Math.round(runningInvested),
          yieldTotal: Math.round(yieldVal),
          passiveMonthly: passM,
          milestone: milestoneStr,
        });
      }
    }
    return points;
  }, [freedomPatrimonyToday, state.freedomTotalInvested, freedomAnnualRate, freedomHorizonYears, effectiveMonthlyFreedom, monthlyFixedExpensesAvg]);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Celebration Message */}
      {celebrationMessage && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 animate-in slide-in-from-top duration-300 flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            {celebrationMessage}
          </div>
          <button
            onClick={() => setCelebrationMessage(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2">
            <span>Meus Investimentos</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal">
              Casal
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Clareza, autonomia e inteligência automática para proteger, realizar e libertar.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('investments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'investments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-4 h-4 text-emerald-500" />
            <span>Meus Investimentos</span>
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4 text-amber-500" />
            <span>Simulador & Ferramentas</span>
          </button>
        </div>
      </div>

      {activeTab === 'investments' ? (
        <>
          {/* ========================================================================= */}
          {/* SELETOR PROEMINENTE DE FASE 1 vs FASE 2 & AS MUDANÇAS DE ESTRATÉGIA */}
          {/* ========================================================================= */}
          <div
            className="rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-5 transition-all duration-300 border-2"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), var(--app-accent-gradient-from), rgba(15, 23, 42, 0.96))',
              borderColor: 'var(--app-accent-border)',
              boxShadow: '0 12px 35px -5px var(--app-accent-glow)',
            }}
          >
            {/* Header Title & Active Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-2xl text-white border flex items-center justify-center text-xl shrink-0 font-bold shadow-sm"
                  style={{
                    backgroundColor: 'var(--app-accent-primary)',
                    borderColor: 'var(--app-accent-border)',
                  }}
                >
                  {isPhase2 ? '🚀' : '🛡️'}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black font-display text-white">
                      Estratégia de Investimento ({viewMode === 'couple' ? 'Casal' : profileLabel})
                    </h3>
                    <span
                      className="text-[11px] font-black px-3 py-0.5 rounded-full border shadow-xs"
                      style={{
                        backgroundColor: 'var(--app-accent-surface)',
                        color: 'var(--app-accent-text)',
                        borderColor: 'var(--app-accent-border)',
                      }}
                    >
                      {isPhase2 ? 'FASE 2 ATIVA — Reserva Completa ✓' : 'FASE 1 ATIVA — Construindo Proteção 🛡️'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Selecione a fase para ver exatamente o que muda na alocação dos aportes de {profileLabel}.
                  </p>
                </div>
              </div>

              {/* Profile Badge Indicator */}
              <div
                className="px-3 py-1 rounded-xl border text-xs font-bold text-white shrink-0 flex items-center gap-1.5 shadow-xs"
                style={{
                  backgroundColor: 'var(--app-accent-surface)',
                  borderColor: 'var(--app-accent-border)',
                  color: 'var(--app-accent-text)',
                }}
              >
                <span>{viewMode === 'couple' ? '👥 Visão do Casal' : `👤 Visão de ${profileLabel}`}</span>
              </div>
            </div>

            {/* Interactive Toggle Buttons for Phase 1 and Phase 2 (Right at the start) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Button Phase 1 */}
              <button
                type="button"
                onClick={() => {
                  setProtectionComplete(false);
                  showToast('Fase 1 ativada! Foco total em completar a Reserva de Proteção primeiro. 🛡️');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-2 ${
                  !isPhase2
                    ? 'bg-emerald-950/90 border-emerald-400 ring-4 ring-emerald-500/50 shadow-xl scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <span className="font-extrabold text-sm sm:text-base text-white font-display">FASE 1 — Reserva Incompleta</span>
                  </div>
                  {!isPhase2 ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500 text-white uppercase tracking-wider shadow-xs flex items-center gap-1">
                      ✓ FASE ATIVA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                      Clique p/ Ativar
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 leading-snug font-medium">
                  Primeiro garantimos a segurança contra imprevistos de até {formatCurrency(autoCalculatedProtectionTarget)}.
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
                  <span>
                    Aportes: {state.piggyBanks.filter(g => !g.completed).length === 0 ? '100% Proteção (Acelerador Ativo) · 0% Objetivos · 0% Liberdade' : '80% Proteção (inclui Acelerador) · 20% Objetivos · 0% Liberdade'}
                  </span>
                </div>
              </button>

              {/* Button Phase 2 */}
              <button
                type="button"
                onClick={() => {
                  setProtectionComplete(true);
                  showToast('Fase 2 ativada! Reserva completa. Acelerando Objetivos e Liberdade Financeira! 🚀');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-2 ${
                  isPhase2
                    ? 'bg-sky-950/90 border-sky-400 ring-4 ring-sky-500/50 shadow-xl scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚀</span>
                    <span className="font-extrabold text-sm sm:text-base text-white font-display">FASE 2 — Reserva Completa</span>
                  </div>
                  {isPhase2 ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-sky-500 text-white uppercase tracking-wider shadow-xs flex items-center gap-1">
                      ✓ FASE ATIVA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                      Clique p/ Ativar
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 leading-snug font-medium">
                  Reserva preenchida! 100% dos novos aportes aceleram sonhos e constroem renda passiva.
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-[11px] font-extrabold text-sky-300">
                  <span>Aportes: 0% Proteção · 58% Objetivos · 42% Liberdade</span>
                </div>
              </button>
            </div>

            {/* As Mudanças de Estratégia entre Fase 1 e Fase 2 */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>O que muda nos aportes mensais de R$ {monthlySavingsTarget.toLocaleString('pt-BR')}?</span>
                </span>
                <span className="text-[11px] text-slate-300 font-bold hidden sm:inline">Inteligência Automática</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-semibold">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span>🛡️ Bloco 1 — Proteção</span>
                    <span>{isPhase2 ? '0%' : '77%'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-normal leading-tight">
                    {isPhase2 ? 'Reserva cheia. R$ 0 necessários este mês.' : `Recebe R$ ${Math.round(monthlySavingsTarget * 0.77).toLocaleString('pt-BR')}/mês até completar a meta.`}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-1">
                  <div className="flex items-center justify-between text-sky-300 font-bold">
                    <span>🎯 Bloco 2 — Objetivos</span>
                    <span>{isPhase2 ? '58%' : '23%'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-normal leading-tight">
                    {isPhase2 ? `Sobe para R$ ${Math.round(monthlySavingsTarget * 0.58).toLocaleString('pt-BR')}/mês para realizar conquistas.` : `Recebe R$ ${Math.round(monthlySavingsTarget * 0.23).toLocaleString('pt-BR')}/mês enquanto protege.`}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>🔓 Bloco 3 — Liberdade</span>
                    <span>{isPhase2 ? '42%' : '0%'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-normal leading-tight">
                    {isPhase2 ? `Desbloqueado! R$ ${Math.round(monthlySavingsTarget * 0.42).toLocaleString('pt-BR')}/mês direto na independência.` : 'Bloqueado até concluir a proteção em Fase 1.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Investment Sector Donut Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Distribuição do Patrimônio e Investimentos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visão proporcional entre Reserva de Proteção, Cofrinhos de Metas e Liberdade Financeira
                </p>
              </div>
            </div>

            <div className="flex justify-center py-2">
              <DonutChart
                data={[
                  {
                    label: '🛡️ Reserva de Proteção',
                    value: state.protectionCurrentAmount,
                    color: '#8b5cf6',
                  },
                  {
                    label: '🎯 Cofrinhos & Metas',
                    value: state.piggyBanks.reduce((sum, g) => sum + g.currentAmount, 0),
                    color: '#f59e0b',
                  },
                  {
                    label: '🔓 Liberdade Financeira',
                    value: freedomPatrimonyToday,
                    color: '#10b981',
                  },
                ]}
                size={240}
                thickness={42}
                centerTitle="Patrimônio Total"
                centerSubtitle="Acumulado"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* GUIA DIDÁTICO DE APORTES MANUAIS & CONFIRMAÇÃO VISUAL                     */}
          {/* ========================================================================= */}
          {(() => {
            const currentGuide = getMonthlyDepositGuide(state.currentMonth);
            const isCompletedThisMonth = currentGuide.status === 'completed' || !!state.completedMonthDeposits?.[state.currentMonth];
            const completedRecord = state.completedMonthDeposits?.[state.currentMonth];
            const totalToDeposit = completedRecord?.totalDeposited ?? currentGuide.totalPlanned;

            const ceiling = currentGuide.suggestedCeiling ?? investmentCeiling.suggestedCeiling;
            const isOverCeiling = totalToDeposit > ceiling;
            const overDiff = Math.max(0, totalToDeposit - ceiling);

            if (isCompletedThisMonth) {
              return (
                <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-emerald-400 dark:border-emerald-600 shadow-md space-y-3 transition-all animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl shadow-sm shrink-0 animate-bounce">
                        🏆
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Selo de Conclusão Mensal
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                            {formatMonthYear(state.currentMonth)}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display mt-0.5">
                          Os investimentos do mês de {formatMonthYear(state.currentMonth)} já foram feitos com sucesso!
                        </h3>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          O futuro de vocês agradece. Total guardado: <strong>{formatCurrency(totalToDeposit)}</strong> nos bancos e corretoras.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsGuideModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
                      >
                        Ver Guia & Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-4 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-black shrink-0">
                      🏦
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                          Guia Didático de Aportes Manuais
                        </h3>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          {formatMonthYear(state.currentMonth)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Teto sugerido: {formatCurrency(ceiling)}
                        </span>
                        {isOverCeiling && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            +{formatCurrency(overDiff)} consciente ✨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                        O guia de aportes do mês ficou em <strong>{formatCurrency(totalToDeposit)}</strong>. Confirmamos essa distribuição?
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
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Já fiz os aportes do mês</span>
                    </button>
                  </div>
                </div>

                {/* Didactic cards showing exactly what to transfer in external bank apps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Bloco 1 Proteção */}
                  {currentGuide.items.filter(it => it.block === 'protection').map(it => (
                    <div key={it.id} className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" />
                          Bloco 1 Proteção
                        </span>
                        <strong className="text-emerald-900 dark:text-emerald-200 text-sm font-black tabular-nums font-display">
                          {formatCurrency(it.totalAmount)}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                        <span>Fixo (10%): {formatCurrency(it.baseAmount)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Sobra: +{formatCurrency(it.surplusAmount)}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-tight">
                        {it.instruction}
                      </p>
                    </div>
                  ))}

                  {/* Bloco 2 Objetivos */}
                  {currentGuide.items.filter(it => it.block === 'goals').map(it => (
                    <div key={it.id} className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-sky-800 dark:text-sky-300 flex items-center gap-1 truncate">
                          <Target className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{it.title}</span>
                        </span>
                        <strong className="text-sky-900 dark:text-sky-200 text-sm font-black tabular-nums font-display shrink-0 ml-1">
                          {formatCurrency(it.totalAmount)}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                        <span>Fixo (10%): {formatCurrency(it.baseAmount)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Sobra: +{formatCurrency(it.surplusAmount)}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-tight">
                        {it.instruction}
                      </p>
                    </div>
                  ))}

                  {/* Bloco 3 Liberdade */}
                  {currentGuide.items.filter(it => it.block === 'freedom').map(it => (
                    <div key={it.id} className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Unlock className="w-3.5 h-3.5" />
                          Bloco 3 Liberdade
                        </span>
                        <strong className="text-amber-900 dark:text-amber-200 text-sm font-black tabular-nums font-display">
                          {formatCurrency(it.totalAmount)}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                        <span>Fixo (10%): {formatCurrency(it.baseAmount)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Sobra: +{formatCurrency(it.surplusAmount)}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-tight">
                        {it.instruction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* BANCO & RENDIMENTOS OVERVIEW CARD (Painel Manual de Investimentos & Rentabilidade) */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                  🏦
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                      Painel de Investimentos & Rentabilidade
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                      Consolidador Inteligente
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Como os aportes são realizados em bancos externos, aqui vocês consolidam o valor aportado vs saldo valorizado.
                  </p>
                </div>
              </div>

              {/* Quick Actions to update any block */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setProtInvestedInput(
                      (state.protectionTotalInvested || state.protectionCurrentAmount * 0.85).toString()
                    );
                    setProtBankTotalInput(state.protectionCurrentAmount.toString());
                    setIsProtectionBankModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Atualizar Proteção</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFreeInvestedInput(state.freedomTotalInvested.toString());
                    setFreeBankTotalInput(freedomPatrimonyToday.toString());
                    setIsFreedomBankModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span>Atualizar Liberdade</span>
                </button>
              </div>
            </div>

            {/* 4 Cards: Valor Aportado, Valor Total Valorizado, Lucro em Reais, Porcentagem de Rendimento Total */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
                  1. Valor Aportado (Bolso)
                </span>
                <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-display my-1 block">
                  {formatCurrency(globalTotalInvested)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total enviado do orçamento do casal
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-bold uppercase tracking-wider block">
                  2. Valor Total Valorizado
                </span>
                <span className="text-lg sm:text-2xl font-black text-indigo-950 dark:text-indigo-200 tabular-nums font-display my-1 block">
                  {formatCurrency(globalTotalBalance)}
                </span>
                <span className="text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
                  Saldo atualizado com rendimentos
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider block">
                  3. Lucro em Reais (Juros)
                </span>
                <span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-display my-1 block">
                  +{formatCurrency(globalYieldAccumulated)}
                </span>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                  Diferença exata: Valorizado - Aportado
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider block">
                  4. Rentabilidade Total (%)
                </span>
                <span className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums font-display my-1 block">
                  +{globalYieldPercentage.toFixed(1).replace('.', ',')}%
                </span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  Ganho percentual acumulado
                </span>
              </div>
            </div>

            {/* Savings explanation badge */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                💡 <strong>Rendimento Acumulado:</strong> O dinheiro investido rendeu <strong>+{formatCurrency(globalYieldAccumulated)}</strong> (+{globalYieldPercentage.toFixed(1).replace('.', ',')}%), economizando aportes do casal e acelerando suas metas!
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 1 — PROTEÇÃO (Reserva de Emergência) */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-6 relative overflow-hidden transition-colors">
            {/* Top Header Block 1 */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                    🛡️
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                    Bloco 1 — Proteção
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                    Reserva de Emergência
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  O dinheiro que protege o casal contra imprevistos sem precisar mexer nos sonhos.
                </p>
              </div>

              {/* Actions Header Protection */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setProtInvestedInput(
                      (state.protectionTotalInvested || state.protectionCurrentAmount * 0.85).toString()
                    );
                    setProtBankTotalInput(state.protectionCurrentAmount.toString());
                    setIsProtectionBankModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                  title="Atualizar o quanto foi investido do bolso vs o saldo atual no banco"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Editar Rendimento do Banco</span>
                </button>

                <button
                  onClick={handleToggleProtectionComplete}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shadow-xs ${
                    state.isProtectionComplete
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 shadow-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700'
                  }`}
                >
                  <Check className={`w-4 h-4 ${state.isProtectionComplete ? 'text-white' : 'text-slate-400'}`} />
                  <span>{state.isProtectionComplete ? 'Reserva Completa ✓' : 'Marcar Reserva Completa'}</span>
                </button>
              </div>
            </div>

            {/* Achievement banner if complete */}
            {state.isProtectionComplete && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Vocês estão protegidos. A partir de agora, esse dinheiro só sai em emergência real.
                </span>
              </div>
            )}

            {/* 3 Numbers Side-by-Side (Piso Blindado de 3 Meses vs Excesso Liberado vs Total Banco) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1">
                  <span>🛡️</span>
                  <span>Piso Blindado (3 Meses)</span>
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 tabular-nums font-display my-1 block">
                  {formatCurrency(emergencyReserveFloorAmount)}
                </span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                  {state.protectionCurrentAmount >= emergencyReserveFloorAmount ? 'Blindado e Seguro ✓' : 'Em construção'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70">
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider block flex items-center gap-1">
                  <span>🌟</span>
                  <span>Excesso Alavancável</span>
                </span>
                <span className="text-2xl sm:text-3xl font-black text-teal-900 dark:text-teal-100 tabular-nums font-display my-1 block">
                  {formatCurrency(emergencyReserveExcessAmount)}
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold">
                  {emergencyReserveExcessAmount > 0
                    ? 'Liberado p/ Objetivos ou À Vista'
                    : 'Disponível após os 3 meses de piso'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <span>🏦</span>
                  <span>Total Hoje no Banco</span>
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums font-display my-1 block">
                  {formatCurrency(state.protectionCurrentAmount)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {monthlyFixedExpensesAvg > 0 ? (state.protectionCurrentAmount / monthlyFixedExpensesAvg).toFixed(1) : '0.0'} de 10 meses (Meta: {formatCurrency(autoCalculatedProtectionTarget)})
                </span>
              </div>
            </div>

            {/* DUAL-SEGMENT PROGRESS BAR: PISO BLINDADO (3 MESES) + EXCESSO ALAVANCÁVEL (ATÉ 10 MESES) */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex flex-wrap items-center justify-between text-xs font-bold gap-2">
                <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Segmentação da Reserva: Piso Sagrado (3m) & Excesso Liberado (10m)</span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black tabular-nums">
                  {Math.min(100, Math.round((state.protectionCurrentAmount / Math.max(1, autoCalculatedProtectionTarget)) * 100))}% da Meta de 10 Meses
                </span>
              </div>

              {/* Visual Split Gauge Bar */}
              <div className="flex items-center gap-1.5 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-full p-0.5 overflow-hidden">
                {/* Segment 1: Piso 3 Meses (30% of total width) */}
                <div className="w-[30%] h-full bg-slate-300 dark:bg-slate-600 rounded-l-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (state.protectionCurrentAmount / Math.max(1, emergencyReserveFloorAmount)) * 100)}%`,
                    }}
                  />
                </div>

                {/* Segment 2: Excesso até 10 Meses (70% of total width) */}
                <div className="w-[70%] h-full bg-slate-300 dark:bg-slate-600 rounded-r-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.min(
                        100,
                        (Math.max(0, state.protectionCurrentAmount - emergencyReserveFloorAmount) /
                          Math.max(1, autoCalculatedProtectionTarget - emergencyReserveFloorAmount)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Legend beneath the split bar */}
              <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>Piso Blindado (3 meses = {formatCurrency(emergencyReserveFloorAmount)}): <strong>Intocável contra compras</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                  <span>Excesso Alavancável (até 10 meses): <strong>Liberado para Objetivos</strong></span>
                </div>
              </div>
            </div>

            {/* Action Buttons Block 1 */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setIsProtectionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Guardar na Reserva</span>
              </button>

              <button
                onClick={() => setIsReallocateModalOpen(true)}
                disabled={emergencyReserveExcessAmount <= 0}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all ${
                  emergencyReserveExcessAmount > 0
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                }`}
                title={
                  emergencyReserveExcessAmount > 0
                    ? 'Transferir saldo excedente da reserva para caixinhas de objetivos mantendo o piso de 3 meses blindado'
                    : 'O excesso de reserva é liberado após o casal acumular os primeiros 3 meses de despesas básicas'
                }
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  Realocar Excesso da Reserva {emergencyReserveExcessAmount > 0 ? `(${formatCurrency(emergencyReserveExcessAmount)})` : ''}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedIntentSource('reserve_excess');
                  setSelectedIntentGoalId(undefined);
                  setIsIntentModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111318] hover:bg-black text-white dark:bg-white dark:text-[#111318] text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                title="Declarar compra prévia para sair do excesso da reserva sem consumir o orçamento do mês"
              >
                <Target className="w-4 h-4 text-[#A6D8FF]" />
                <span>Gasto Estratégico do Excesso</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO ESPECIAL: INTENÇÕES DE GASTO ESTRATÉGICO DO CASAL (BENTO CLAY)     */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-[#A6D8FF] dark:border-sky-800 shadow-md space-y-5 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-9 h-9 rounded-xl bg-[#A6D8FF] text-[#111318] flex items-center justify-center text-lg font-black">
                    🎯
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                    Intenções de Gasto Estratégico
                  </h3>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#D8C7FF] text-[#111318]">
                    Alocação Proativa
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Planejem compras de mobília, viagens ou equipamentos antecipadamente. Ao escolher a Reserva ou Caixinha, a margem de Moradia/Lazer fica 100% livre para a rotina diária.
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedIntentSource('reserve_excess');
                  setSelectedIntentGoalId(undefined);
                  setIsIntentModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] hover:bg-black text-white dark:bg-white dark:text-[#111318] text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Intenção</span>
              </button>
            </div>

            {strategicIntents.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-[#FAF7F2] dark:bg-slate-950/40 border border-dashed border-stone-300 dark:border-stone-700 space-y-2">
                <span className="text-3xl block">📋</span>
                <h4 className="font-extrabold text-sm text-[#111318] dark:text-white">
                  Nenhuma intenção prévia cadastrada
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Vão comprar algo grande este mês? Registrem aqui antes da compra para garantir que o Open Finance (Pluggy) reconcilie automaticamente e blinde a margem da rotina da casa.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {strategicIntents.map(intent => {
                  const cat = CATEGORIES_BASE[intent.category];
                  const sourceLabel =
                    intent.targetSource === 'reserve_excess'
                      ? 'Excesso da Reserva'
                      : intent.targetSource === 'piggy_bank'
                      ? (intent.targetGoalName || 'Caixinha de Sonhos')
                      : 'Orçamento do Mês';

                  return (
                    <div
                      key={intent.id}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-900 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#A6D8FF]/40 text-sky-950 dark:text-sky-200 border border-[#A6D8FF]">
                            {sourceLabel}
                          </span>
                          {intent.status === 'pending' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                              Pendente
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Blindado ✓
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{cat?.emoji || '🎯'}</span>
                            <h4 className="font-extrabold text-sm text-[#111318] dark:text-white truncate">
                              {intent.title}
                            </h4>
                          </div>
                          <span className="text-base font-black text-[#111318] dark:text-white block font-display tabular-nums mt-1">
                            {formatCurrency(intent.estimatedAmount)}
                          </span>
                        </div>

                        {intent.notes && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">
                            {intent.notes}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span>
                          {intent.assignedTo === 'couple' ? '👥 Casal' : '👤 Pessoal'} · {intent.paymentMethod.toUpperCase()}
                        </span>
                        {intent.status === 'pending' && (
                          <button
                            onClick={() => deleteStrategicIntent(intent.id)}
                            className="text-stone-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Remover intenção"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 2 — MEUS OBJETIVOS (Cofrinhos de Conquistas) */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-sky-500/40 dark:border-sky-500/30 shadow-md space-y-6 transition-colors">
            {/* Top Header Block 2 */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-lg font-bold">
                    🎯
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                    Bloco 2 — Meus Objetivos & Cofrinhos
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold">
                    Conquistas do Casal
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Personalize com fotos, ajuste metas com base no mercado e acompanhe rendimentos reais.
                </p>
              </div>

              <button
                onClick={() => setIsCreatingGoal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Objetivo</span>
              </button>
            </div>

            {/* List of Goal Cards */}
            {state.piggyBanks.length === 0 ? (
              <div className="p-8 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-2xl mx-auto">
                  🎯
                </div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Nenhum cofrinho criado ainda
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Crie objetivos para viagens, compra de carro, casa ou casamento. Você pode fazer upload de foto própria e recalibrar a meta sempre que o mercado mudar.
                </p>
                <button
                  onClick={() => setIsCreatingGoal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeiro Cofrinho</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {state.piggyBanks.map(bank => {
                  const pct = Math.min(100, Math.round((bank.currentAmount / Math.max(1, bank.targetAmount)) * 100));
                  const totalInvested = bank.totalInvested !== undefined ? bank.totalInvested : Math.round(bank.currentAmount * 0.88);
                  const yieldAccum =
                    bank.yieldAccumulated !== undefined
                      ? bank.yieldAccumulated
                      : Math.max(0, bank.currentAmount - totalInvested);
                  const goalYieldPct = totalInvested > 0 ? (yieldAccum / totalInvested) * 100 : 0;
                  const remainingAmount = Math.max(0, bank.targetAmount - bank.currentAmount);

                  // Compound interest calculation taking into account monthly deposit and expected yield rate
                  const effectiveAnnualRate = state.profile.expectedYieldAnnual || 6.5;
                  const monthlyRate = Math.pow(1 + effectiveAnnualRate / 100, 1 / 12) - 1;
                  let projectedMonths = 0;
                  if (bank.monthlyDeposit > 0 && remainingAmount > 0) {
                    let simBal = bank.currentAmount;
                    while (simBal < bank.targetAmount && projectedMonths < 600) {
                      simBal = simBal * (1 + monthlyRate) + bank.monthlyDeposit;
                      projectedMonths++;
                    }
                  }
                  const monthsLeft = projectedMonths > 0 ? projectedMonths : (bank.monthlyDeposit > 0 ? Math.ceil(remainingAmount / bank.monthlyDeposit) : 0);

                  const isNearMeta = pct >= 80;

                  return (
                    <div
                      key={bank.id}
                      className={`clay-card transition-all overflow-hidden flex flex-col justify-between ${
                        bank.completed
                          ? 'bento-card-sage opacity-90'
                          : 'bento-card-pink'
                      }`}
                    >
                      {/* Photo Header (If photo present) OR Gradient Header */}
                      {bank.imageUrl ? (
                        <div className="relative h-40 sm:h-44 w-full overflow-hidden group">
                          <img
                            src={bank.imageUrl}
                            alt={bank.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* Dark gradient overlay for text legibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

                          {/* Top floating badges */}
                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                            <span className="w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-xl flex items-center justify-center shadow-xs">
                              {bank.emoji}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {bank.completed ? (
                                <span className="text-[10px] bg-emerald-500 text-white font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Concluído
                                </span>
                              ) : (
                                <span className="text-[10px] bg-black/60 backdrop-blur-md text-white font-extrabold px-2.5 py-1 rounded-full border border-white/20">
                                  {pct}% Concluído
                                </span>
                              )}

                              <button
                                onClick={() => setPhotoTargetGoal(bank)}
                                className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer"
                                title="Trocar Foto"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom info on photo */}
                          <div className="absolute bottom-3 left-3 right-3 text-white">
                            <h4 className="font-extrabold text-base sm:text-lg font-display truncate drop-shadow-sm">
                              {bank.name}
                            </h4>
                            <p className="text-xs text-slate-200 line-clamp-1 opacity-90 drop-shadow-sm">
                              {bank.purpose || 'Conquista planejada'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 pb-3 border-b border-pink-200/60 dark:border-pink-900/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <ClaymorphicIcon
                                type={
                                  bank.name.toLowerCase().includes('viagem') || bank.emoji === '✈️'
                                    ? 'travel'
                                    : bank.name.toLowerCase().includes('tv') || bank.emoji === '📺'
                                    ? 'tv'
                                    : bank.name.toLowerCase().includes('carro') || bank.emoji === '🚗'
                                    ? 'car'
                                    : bank.name.toLowerCase().includes('sofá') || bank.name.toLowerCase().includes('móvel')
                                    ? 'furniture'
                                    : bank.name.toLowerCase().includes('casa') || bank.emoji === '🏠'
                                    ? 'housing'
                                    : 'sparkle'
                                }
                                tone="pink"
                                size={44}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-[#111318] dark:text-white text-base font-display truncate">
                                    {bank.name}
                                  </h4>
                                  {bank.completed && (
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full shrink-0">
                                      Concluído ✓
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 font-medium">
                                  {bank.purpose || 'Conquista planejada do casal'}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setPhotoTargetGoal(bank)}
                              className="text-[11px] font-bold text-pink-700 dark:text-pink-300 bg-white dark:bg-slate-800 hover:bg-pink-50 px-2.5 py-1.5 rounded-xl border border-pink-300 dark:border-pink-800 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                              title="Adicionar foto do objetivo"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>+ Foto</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Card Body */}
                      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                        {/* Three Numbers Side-by-Side (Aportes vs Rendimento vs Total Hoje) */}
                        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Aportes (Bolso)
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatCurrency(totalInvested)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Rendimento
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              +{formatCurrency(yieldAccum)}
                            </span>
                            {goalYieldPct > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold block">
                                (+{goalYieldPct.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Total no Banco
                            </span>
                            <span className="text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400 tabular-nums">
                              {formatCurrency(bank.currentAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Market Target Info */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 dark:text-slate-300">
                              Meta de Mercado: <strong>{formatCurrency(bank.targetAmount)}</strong>
                            </span>
                            <span className="text-sky-600 dark:text-sky-400 tabular-nums font-extrabold">{pct}%</span>
                          </div>

                          <div className="h-3.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 transition-all duration-700 shadow-xs"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                            <span>Aporte: <strong>{formatCurrency(bank.monthlyDeposit)}/mês</strong></span>
                            <span title={`Estimativa com rentabilidade anual de ${effectiveAnnualRate}% a.a.`}>
                              Prazo c/ Rendimento: <strong>{monthsLeft > 0 ? formatHumanDuration(monthsLeft) : 'Meta atingida! 🏆'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Travel Buffer (Amortecedor de Viagem) */}
                        {(bank.name.toLowerCase().includes('viagem') ||
                          bank.name.toLowerCase().includes('férias') ||
                          bank.name.toLowerCase().includes('ferias') ||
                          bank.name.toLowerCase().includes('praia') ||
                          bank.emoji === '✈️' ||
                          bank.emoji === '🏖️' ||
                          bank.emoji === '🌴') && (
                          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-950 dark:text-sky-200 text-xs font-medium space-y-1">
                            <div className="flex items-center justify-between font-bold text-sky-900 dark:text-sky-300">
                              <span className="flex items-center gap-1.5">
                                <span>🛡️</span>
                                <span>Amortecedor de Viagem Ativo</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 uppercase font-black tracking-wider">
                                Sobras Protegem
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">
                              As sobras mensais de Alimentação e Lazer acumulam neste cofrinho para blindar passeios e surpresas das férias sem mexer na Reserva de Emergência.
                            </p>
                          </div>
                        )}

                        {/* Special Yield Savings Highlight if near target (>= 80%) */}
                        {isNearMeta && yieldAccum > 0 && !bank.completed && (
                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-medium space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Conquista Acelerada por Rendimentos</span>
                            </div>
                            <p className="text-[11px] leading-relaxed">
                              Vocês economizaram <strong>{formatCurrency(yieldAccum)}</strong> graças aos juros e rendimentos compostos! 🚀
                            </p>
                          </div>
                        )}

                        {/* PIX vs 100% CDI comparator trigger */}
                        <button
                          type="button"
                          onClick={() => setComparingPixGoal(bank)}
                          className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-700/60 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Calculator className="w-3.5 h-3.5 text-amber-600" />
                          <span>Comparar PIX c/ desconto vs Parcelar (100% CDI)</span>
                        </button>

                        {/* Card Action Buttons (Aportar, Editar Meta/Mercado, Editar Banco, Concluir, Excluir) */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedGoalId(bank.id)}
                              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              + Aportar
                            </button>

                            <button
                              onClick={() => handleOpenEditGoal(bank)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Editar nome, meta de mercado, foto e aporte planejado"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                              <span>Editar</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditingGoalBankId(bank.id);
                                setGoalInvestedInput(totalInvested.toString());
                                setGoalBankTotalInput(bank.currentAmount.toString());
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Atualizar o quanto foi investido do bolso vs saldo no banco"
                            >
                              <Building className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Banco</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleGoalComplete(bank)}
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                bank.completed
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 border-slate-200 dark:border-slate-700'
                              }`}
                              title={bank.completed ? 'Reabrir Objetivo' : 'Marcar Objetivo Concluído'}
                            >
                              <Check className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDeletingGoalId(bank.id)}
                              className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                              title="Excluir Cofrinho"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BLOCO 3 — LIBERDADE (Longo Prazo, Nunca Mexido) & GRÁFICO FUNCIONAL */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-amber-500/40 dark:border-amber-500/30 shadow-md space-y-6 transition-colors">
            {/* Top Header Block 3 */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg font-bold">
                    🔓
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                    Bloco 3 — Liberdade Financeira
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                    Investimento de Longo Prazo
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-semibold">
                  Esse dinheiro nunca é gasto. Ele constrói a renda perpétua e independência do casal.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setFreeInvestedInput(state.freedomTotalInvested.toString());
                    setFreeBankTotalInput(freedomPatrimonyToday.toString());
                    setIsFreedomBankModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  title="Atualizar o quanto investiu do bolso e o saldo do banco"
                >
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span>Editar Rendimento do Banco</span>
                </button>

                <button
                  onClick={() => setIsFreedomModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Aportar na Liberdade</span>
                </button>
              </div>
            </div>

            {/* Warning Rule Card */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-semibold flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                🔒 Regra de Ouro: Esse dinheiro nunca é gasto. Ele constrói a liberdade financeira perpétua do casal.
              </span>
            </div>

            {/* Three Numbers Side-by-Side (Investido vs Rendimento vs Total Banco) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. Quanto Vocês Investiram (Bolso)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums font-display my-1 block">
                  {formatCurrency(state.freedomTotalInvested)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Aportes acumulados sem resgates
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  2. Quanto Está Rendendo (Juros)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-display my-1 block">
                  +{formatCurrency(state.freedomYieldAccumulated)}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Efeito dos juros compostos
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  3. Total Hoje (Patrimônio no Banco)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums font-display my-1 block">
                  {formatCurrency(freedomPatrimonyToday)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Soma de aportes + rendimentos
                </span>
              </div>
            </div>

            {/* Passive Income Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                  Renda Passiva Estimada (Regra dos 4% a.a.)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums my-1 font-display">
                  {formatCurrency(freedomPassiveIncomeMonthly)} <span className="text-xs text-slate-500 font-normal">/ mês para sempre</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Renda passiva gerada sem diminuir o patrimônio principal acumulado.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Aporte Mensal Atual</span>
                <strong className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCurrency(effectiveMonthlyFreedom)}/mês
                </strong>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* GRÁFICO INTERATIVO & FUNCIONAL DE LIBERDADE FINANCEIRA */}
            {/* ========================================================================= */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-display">
                    Simulador & Curva de Liberdade Financeira
                  </h4>
                </div>

                {/* Horizon Selector (5, 10, 15, 20, 30 Anos) */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[5, 10, 15, 20, 30].map(yrs => (
                    <button
                      key={yrs}
                      onClick={() => setFreedomHorizonYears(yrs)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        freedomHorizonYears === yrs
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {yrs}a
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate & Extra Deposit Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                {/* Rate Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Taxa Real a.a. (Acima da Inflação):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: '5.0%', val: 5.0, name: 'IPCA+' },
                      { label: '6.5%', val: 6.5, name: 'Juntô' },
                      { label: '8.5%', val: 8.5, name: 'Ações' },
                    ].map(r => (
                      <button
                        key={r.val}
                        onClick={() => {
                          setFreedomAnnualRate(r.val);
                          setIsCustomRate(false);
                        }}
                        className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          freedomAnnualRate === r.val && !isCustomRate
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                        title={`${r.name}: ${r.val}% ao ano acima da inflação`}
                      >
                        {r.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="20"
                        value={freedomAnnualRate}
                        onChange={e => {
                          setFreedomAnnualRate(Number(e.target.value) || 6.5);
                          setIsCustomRate(true);
                        }}
                        className="w-14 px-1.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold text-[11px]"
                      />
                      <span className="text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Extra Monthly Simulator */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Simular Aporte Extra Mensal:
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[0, 200, 500, 1000].map(extra => (
                      <button
                        key={extra}
                        onClick={() => setFreedomExtraMonthly(extra)}
                        className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          freedomExtraMonthly === extra
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {extra === 0 ? '+R$ 0' : `+${extra}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Legend Indicator */}
                <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-center space-y-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Patrimônio Total (com Juros)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-1 bg-slate-400 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400">
                      Dinheiro do Bolso (Sem Juros)
                    </span>
                  </div>
                </div>
              </div>

              {/* SVG Curve Chart */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 relative">
                {/* Active Tooltip Banner if hovered */}
                {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                  <div className="mb-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-black text-[10px]">
                        Ano {chartPoints[hoveredPointIndex].year} ({chartPoints[hoveredPointIndex].label})
                      </span>
                      {chartPoints[hoveredPointIndex].milestone && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-extrabold text-[10px] animate-pulse">
                          {chartPoints[hoveredPointIndex].milestone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-bold">
                      <span className="text-amber-700 dark:text-amber-300">
                        Patrimônio: <strong>{formatCurrency(chartPoints[hoveredPointIndex].total)}</strong>
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Juros Ganhos: <strong>+{formatCurrency(chartPoints[hoveredPointIndex].yieldTotal)}</strong>
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        Renda Passiva: <strong>{formatCurrency(chartPoints[hoveredPointIndex].passiveMonthly)}/mês</strong>
                      </span>
                    </div>
                  </div>
                )}

                <svg viewBox="0 0 600 220" className="w-full h-56 sm:h-64 overflow-visible">
                  <defs>
                    <linearGradient id="freedomAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="pocketAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748B" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#64748B" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="20" y1="40" x2="580" y2="40" stroke="#94A3B8" strokeOpacity="0.15" strokeDasharray="4 4" />
                  <line x1="20" y1="90" x2="580" y2="90" stroke="#94A3B8" strokeOpacity="0.15" strokeDasharray="4 4" />
                  <line x1="20" y1="140" x2="580" y2="140" stroke="#94A3B8" strokeOpacity="0.15" strokeDasharray="4 4" />
                  <line x1="20" y1="180" x2="580" y2="180" stroke="#94A3B8" strokeOpacity="0.3" />

                  {(() => {
                    const maxVal = Math.max(1000, chartPoints[chartPoints.length - 1]?.total || 10000);
                    const minVal = 0;
                    const range = Math.max(1, maxVal - minVal);

                    const coords = chartPoints.map((pt, idx) => {
                      const x = (idx / (chartPoints.length - 1)) * 540 + 30;
                      const yTotal = 180 - (pt.total / range) * 150;
                      const yInvested = 180 - (pt.invested / range) * 150;
                      return { x, yTotal, yInvested, pt, idx };
                    });

                    const dPathTotal =
                      'M ' +
                      coords.map(c => `${c.x},${c.yTotal}`).join(' L ') +
                      ` L 570,180 L 30,180 Z`;

                    const linePathTotal = 'M ' + coords.map(c => `${c.x},${c.yTotal}`).join(' L ');
                    const linePathInvested = 'M ' + coords.map(c => `${c.x},${c.yInvested}`).join(' L ');

                    return (
                      <>
                        {/* Area Fill */}
                        <path d={dPathTotal} fill="url(#freedomAreaGrad)" />

                        {/* Pocket Curve (Dashed) */}
                        <path
                          d={linePathInvested}
                          fill="none"
                          stroke="#64748B"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          strokeOpacity="0.6"
                        />

                        {/* Total Compounded Curve (Solid Amber) */}
                        <path
                          d={linePathTotal}
                          fill="none"
                          stroke="#D97706"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive Data Points */}
                        {coords.map(c => {
                          const isHovered = hoveredPointIndex === c.idx;
                          const hasMilestone = Boolean(c.pt.milestone);

                          return (
                            <g
                              key={c.idx}
                              className="cursor-pointer transition-transform"
                              onMouseEnter={() => setHoveredPointIndex(c.idx)}
                              onClick={() => setHoveredPointIndex(c.idx)}
                            >
                              {/* Glowing pulse on hover or milestone */}
                              {(isHovered || hasMilestone) && (
                                <circle
                                  cx={c.x}
                                  cy={c.yTotal}
                                  r={isHovered ? "9" : "7"}
                                  fill={hasMilestone ? "#10B981" : "#D97706"}
                                  opacity="0.3"
                                  className="animate-pulse"
                                />
                              )}

                              <circle
                                cx={c.x}
                                cy={c.yTotal}
                                r={isHovered ? "6" : hasMilestone ? "5" : "3.5"}
                                fill={hasMilestone ? "#10B981" : isHovered ? "#B45309" : "#F59E0B"}
                                stroke="#FFF"
                                strokeWidth="2"
                              />

                              {/* Milestone Flag Badge */}
                              {hasMilestone && (
                                <g transform={`translate(${c.x}, ${c.yTotal - 16})`}>
                                  <rect
                                    x="-35"
                                    y="-12"
                                    width="70"
                                    height="16"
                                    rx="8"
                                    fill="#10B981"
                                    className="shadow-xs"
                                  />
                                  <text
                                    x="0"
                                    y="0"
                                    fontSize="8"
                                    fill="#FFFFFF"
                                    textAnchor="middle"
                                    fontWeight="bold"
                                  >
                                    {c.pt.milestone}
                                  </text>
                                </g>
                              )}

                              {/* X Axis Label */}
                              {(c.idx % Math.ceil(chartPoints.length / 6) === 0 || c.idx === chartPoints.length - 1) && (
                                <text
                                  x={c.x}
                                  y="200"
                                  fontSize="10"
                                  fill={isHovered ? "#D97706" : "#94A3B8"}
                                  textAnchor="middle"
                                  fontWeight={isHovered ? "800" : "600"}
                                >
                                  {c.pt.label}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* 4 Summary Highlight KPI Cards */}
              {(() => {
                const finalPoint = chartPoints[chartPoints.length - 1];
                const finalTotal = finalPoint ? finalPoint.total : 0;
                const finalInvested = finalPoint ? finalPoint.invested : 0;
                const finalYield = finalPoint ? finalPoint.yieldTotal : 0;
                const finalPassive = finalPoint ? finalPoint.passiveMonthly : 0;
                const multiplier = finalInvested > 0 ? (finalTotal / finalInvested).toFixed(1) : '1.0';

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase block">
                        Patrimônio em {freedomHorizonYears} Anos
                      </span>
                      <strong className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(finalTotal)}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase block">
                        Juros Compostos Ganhos
                      </span>
                      <strong className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{formatCurrency(finalYield)}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                      <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-bold uppercase block">
                        Renda Passiva Mensal
                      </span>
                      <strong className="text-base sm:text-lg font-black text-indigo-900 dark:text-indigo-200 tabular-nums">
                        {formatCurrency(finalPassive)}/mês
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                      <span className="text-[10px] text-purple-800 dark:text-purple-300 font-bold uppercase block">
                        Multiplicador do Bolso
                      </span>
                      <strong className="text-base sm:text-lg font-black text-purple-900 dark:text-purple-200 tabular-nums">
                        {multiplier}x o investido
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      ) : (
        /* ========================================================================= */
        /* TAB: SIMULADOR & FERRAMENTAS */
        /* ========================================================================= */
        <div className="space-y-8">
          {/* Tool 1: Financing Simulator */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                🚗🏠
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  1. Simulador de Financiamento (Carro ou Casa)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calcule parcelas, juros totais e descubra o custo de oportunidade de dar a entrada.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor Total do Bem (R$)
                </label>
                <input
                  type="number"
                  value={finTotalValue}
                  onChange={e => setFinTotalValue(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Entrada Pretendida (R$)
                </label>
                <input
                  type="number"
                  value={finDownPayment}
                  onChange={e => setFinDownPayment(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Número de Parcelas (meses)
                </label>
                <input
                  type="number"
                  value={finMonths}
                  onChange={e => setFinMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Taxa de Juros Anual (% a.a.)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={finAnnualRate}
                  onChange={e => setFinAnnualRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </div>

            {/* Results Output */}
            {(() => {
              const financedAmount = Math.max(0, finTotalValue - finDownPayment);
              const monthlyRate = Math.pow(1 + finAnnualRate / 100, 1 / 12) - 1;
              const installment =
                monthlyRate > 0
                  ? (financedAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -finMonths))
                  : financedAmount / finMonths;

              const totalPaid = installment * finMonths + finDownPayment;
              const totalInterest = Math.max(0, totalPaid - finTotalValue);
              const oppCost = finDownPayment * Math.pow(1 + 0.10, finMonths / 12);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Parcela Estimada
                    </span>
                    <span className="text-base font-black text-indigo-900 dark:text-indigo-200 tabular-nums">
                      {formatCurrency(installment)} / mês
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Total Pago em Juros
                    </span>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCurrency(totalInterest)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Entrada Se Investida
                    </span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(oppCost)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tool 2: Cash vs. Installments (PIX vs 100% CDI) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
                💵💳
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  2. Comparador PIX com Desconto vs. Parcelado (100% do CDI)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Descubra se vale mais a pena pagar no PIX à vista com desconto ou parcelar sem juros mantendo o dinheiro rendendo no CDB a 100% do CDI.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor com Desconto no PIX (R$)
                </label>
                <input
                  type="number"
                  value={compCashPrice}
                  onChange={e => setCompCashPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor Parcelado Total (R$)
                </label>
                <input
                  type="number"
                  value={compInstTotal}
                  onChange={e => setCompInstTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Número de Parcelas
                </label>
                <input
                  type="number"
                  value={compMonths}
                  onChange={e => setCompMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Rendimento 100% CDI Líquido (% a.m.)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={compMonthlyYield}
                  onChange={e => setCompMonthlyYield(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </div>

            {/* Verdict Output */}
            {(() => {
              const discountVal = Math.max(0, compInstTotal - compCashPrice);
              const discountPct = ((discountVal / compInstTotal) * 100).toFixed(1);

              let remainingCap = compCashPrice;
              const instVal = compInstTotal / compMonths;
              let interestEarned = 0;

              for (let m = 0; m < compMonths; m++) {
                const yieldM = remainingCap * (compMonthlyYield / 100);
                interestEarned += yieldM;
                remainingCap = remainingCap + yieldM - instVal;
              }

              const isCashBetter = discountVal > interestEarned;

              return (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Veredito Inteligente:</span>
                    <span className="text-sm font-black">
                      {isCashBetter ? 'Pagar À VISTA é melhor!' : 'PARCELAR e manter aplicado é melhor!'}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Comprando à vista vocês economizam <strong>{formatCurrency(discountVal)} ({discountPct}%)</strong>.
                    Se parcelarem, o rendimento acumulado no período seria de <strong>{formatCurrency(interestEarned)}</strong>.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Tool 3: Goal Anticipation Calculator */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl font-bold">
                ⚡
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  3. Calculadora de Antecipação de Metas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Veja quanto tempo economiza aumentando um pouco o aporte mensal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Meta Total do Objetivo (R$)
                </label>
                <input
                  type="number"
                  value={antTarget}
                  onChange={e => setAntTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal Atual (R$)
                </label>
                <input
                  type="number"
                  value={antCurrentMonthly}
                  onChange={e => setAntCurrentMonthly(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Adicional Pretendido (+R$)
                </label>
                <input
                  type="number"
                  value={antExtraMonthly}
                  onChange={e => setAntExtraMonthly(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </div>

            {(() => {
              const monthsNormal = antCurrentMonthly > 0 ? Math.ceil(antTarget / antCurrentMonthly) : 0;
              const newMonthly = antCurrentMonthly + antExtraMonthly;
              const monthsAccelerated = newMonthly > 0 ? Math.ceil(antTarget / newMonthly) : 0;
              const savedMonths = Math.max(0, monthsNormal - monthsAccelerated);

              return (
                <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/60 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sky-900 dark:text-sky-300">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                    <span>Ganho de Tempo:</span>
                    <span className="text-sm font-black">
                      Vocês conquistam a meta {savedMonths} mês(es) mais cedo! 🚀
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    No ritmo atual levaria {formatHumanDuration(monthsNormal)}. Aumentando R$ {antExtraMonthly}/mês, a conquista vem em {formatHumanDuration(monthsAccelerated)}.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Tool 4: Passive Income Simulator */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold">
                🏖️
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  4. Simulador de Renda Passiva Futura
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calcule o patrimônio acumulado necessário para viver de renda (Regra dos 4% a.a.).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Renda Passiva Desejada (R$/mês)
                </label>
                <input
                  type="number"
                  value={passDesiredIncome}
                  onChange={e => setPassDesiredIncome(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal do Casal (R$)
                </label>
                <input
                  type="number"
                  value={passCurrentMonthly}
                  onChange={e => setPassCurrentMonthly(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Rendimento Real Acima da Inflação (% a.a.)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={passAnnualYield}
                  onChange={e => setPassAnnualYield(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </div>

            {(() => {
              const requiredPatrimony = passDesiredIncome * 300;
              const monthlyRate = Math.pow(1 + passAnnualYield / 100, 1 / 12) - 1;
              let current = freedomPatrimonyToday;
              let mCount = 0;

              while (current < requiredPatrimony && mCount < 600) {
                current = current * (1 + monthlyRate) + passCurrentMonthly;
                mCount++;
              }

              const yearsNeeded = (mCount / 12).toFixed(1);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Patrimônio Necessário (Regra 4%)
                    </span>
                    <span className="text-xl font-black text-amber-900 dark:text-amber-200 tabular-nums">
                      {formatCurrency(requiredPatrimony)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Tempo Estimado para Liberdade
                    </span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {mCount >= 600 ? '+50 anos' : `${yearsNeeded} anos (${mCount} meses)`}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR RENDIMENTO DO BANCO (PROTEÇÃO) */}
      {/* ========================================================================= */}
      {isProtectionBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🛡️ Saldo & Rendimento do Banco (Proteção)</span>
              </h3>
              <button
                onClick={() => setIsProtectionBankModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProtectionBankBalance} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  1. Quanto vocês colocaram do bolso de fato? (Aportes)
                </label>
                <input
                  type="text"
                  placeholder="78000"
                  value={protInvestedInput}
                  onChange={e => setProtInvestedInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  2. Quanto está valendo hoje no banco com o rendimento? (Saldo Total)
                </label>
                <input
                  type="text"
                  placeholder="88000"
                  value={protBankTotalInput}
                  onChange={e => setProtBankTotalInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              {/* Dynamic Output Calculation Preview */}
              {(() => {
                const inv = parseFloat(protInvestedInput.replace(',', '.')) || 0;
                const tot = parseFloat(protBankTotalInput.replace(',', '.')) || 0;
                const rend = Math.max(0, tot - inv);

                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                      Cálculo Automático de Juros Ganho
                    </span>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>Rendimento do Banco:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        +{formatCurrency(rend)}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-snug">
                      💡 Vocês economizaram <strong>{formatCurrency(rend)}</strong> de ter que tirar do bolso graças aos juros do banco!
                    </p>
                  </div>
                );
              })()}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProtectionBankModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
                >
                  Salvar no App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR RENDIMENTO DO BANCO (LIBERDADE) */}
      {/* ========================================================================= */}
      {isFreedomBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🔓 Saldo & Rendimento do Banco (Liberdade)</span>
              </h3>
              <button
                onClick={() => setIsFreedomBankModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFreedomBankBalance} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  1. Quanto vocês investiram do bolso de fato? (Aportes Totais)
                </label>
                <input
                  type="text"
                  placeholder="220000"
                  value={freeInvestedInput}
                  onChange={e => setFreeInvestedInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  2. Patrimônio Total Atual na Corretora / Banco? (Com Rendimentos)
                </label>
                <input
                  type="text"
                  placeholder="405000"
                  value={freeBankTotalInput}
                  onChange={e => setFreeBankTotalInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              {/* Dynamic Output Calculation Preview */}
              {(() => {
                const inv = parseFloat(freeInvestedInput.replace(',', '.')) || 0;
                const tot = parseFloat(freeBankTotalInput.replace(',', '.')) || 0;
                const rend = Math.max(0, tot - inv);
                const passInc = Math.round((tot * 0.04) / 12);

                return (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">
                      Juros Compostos da Liberdade
                    </span>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>Rendimento do Banco:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        +{formatCurrency(rend)}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-950 dark:text-amber-200 leading-snug">
                      📈 Renda passiva perpétua gerada: <strong>{formatCurrency(passInc)}/mês</strong>!
                    </p>
                  </div>
                );
              })()}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFreedomBankModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm"
                >
                  Salvar no App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR RENDIMENTO DO BANCO (OBJETIVO ESPECÍFICO) */}
      {/* ========================================================================= */}
      {editingGoalBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🎯 Saldo & Rendimento do Objetivo</span>
              </h3>
              <button
                onClick={() => setEditingGoalBankId(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoalBankBalance} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  1. Quanto vocês colocaram do bolso até hoje neste objetivo?
                </label>
                <input
                  type="text"
                  placeholder="25000"
                  value={goalInvestedInput}
                  onChange={e => setGoalInvestedInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  2. Quanto está valendo no banco hoje? (Com Rendimento)
                </label>
                <input
                  type="text"
                  placeholder="28500"
                  value={goalBankTotalInput}
                  onChange={e => setGoalBankTotalInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                  required
                />
              </div>

              {/* Dynamic Output Calculation Preview */}
              {(() => {
                const inv = parseFloat(goalInvestedInput.replace(',', '.')) || 0;
                const tot = parseFloat(goalBankTotalInput.replace(',', '.')) || 0;
                const rend = Math.max(0, tot - inv);

                return (
                  <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-sky-800 dark:text-sky-300 block">
                      Rendimento Ganho Sem Esforço
                    </span>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>Rendimento do Banco:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        +{formatCurrency(rend)}
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-950 dark:text-sky-200 leading-snug">
                      💡 Vocês economizaram <strong>{formatCurrency(rend)}</strong> que entraram direto na meta sem sair da renda do casal!
                    </p>
                  </div>
                );
              })()}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGoalBankId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow-sm"
                >
                  Salvar no App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO OBJETIVO */}
      {/* ========================================================================= */}
      {isCreatingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                Criar Novo Objetivo
              </h3>
              <button
                onClick={() => setIsCreatingGoal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome do Objetivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Viagem para Paris, Carro Novo, etc."
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={goalEmoji}
                    onChange={e => setGoalEmoji(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Meta Total (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="30000"
                    value={goalTarget}
                    onChange={e => setGoalTarget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Aporte Mensal Planejado (R$)
                </label>
                <input
                  type="text"
                  placeholder="1000"
                  value={goalMonthly}
                  onChange={e => setGoalMonthly(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Propósito / Descrição Curta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Férias em casal sem parcelar no cartão"
                  value={goalPurpose}
                  onChange={e => setGoalPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingGoal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow-sm"
                >
                  Criar Objetivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APORTE NA RESERVA DE PROTEÇÃO */}
      {/* ========================================================================= */}
      {isProtectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🛡️ Guardar na Proteção</span>
              </h3>
              <button
                onClick={() => setIsProtectionModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositProtection} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor a Guardar (R$)
                </label>
                <input
                  type="text"
                  placeholder="2500"
                  value={protectionDepositAmount}
                  onChange={e => setProtectionDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProtectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APORTE NO BLOCO LIBERDADE */}
      {/* ========================================================================= */}
      {isFreedomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🔓 Aportar no Bloco Liberdade</span>
              </h3>
              <button
                onClick={() => setIsFreedomModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositFreedom} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor a Investir (R$)
                </label>
                <input
                  type="text"
                  placeholder="3000"
                  value={freedomDepositAmount}
                  onChange={e => setFreedomDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFreedomModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APORTE EM OBJETIVO ESPECÍFICO */}
      {/* ========================================================================= */}
      {selectedGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <span>🎯 Aportar no Objetivo</span>
              </h3>
              <button
                onClick={() => setSelectedGoalId(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositGoal} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor a Guardar (R$)
                </label>
                <input
                  type="text"
                  placeholder="1000"
                  value={goalDepositAmount}
                  onChange={e => setGoalDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGoalId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow-sm"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FIXED FOOTER MESSAGE (Frase Fixa do Rodapé) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-slate-200 dark:bg-slate-900 dark:text-slate-200 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-md text-center text-xs sm:text-sm font-medium leading-relaxed">
        <p className="max-w-3xl mx-auto italic">
          "Vocês têm três tipos de dinheiro guardado: o que protege, o que realiza e o que liberta. O primeiro para quando enche. O segundo se usa quando atinge a meta. O terceiro nunca se mexe."
        </p>
      </div>

      {/* Modal do Guia Didático de Aportes & Ajuste de Valores */}
      <MonthlyDepositGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Modal de Realocação do Excesso da Reserva */}
      <ReallocateReserveExcessModal
        isOpen={isReallocateModalOpen}
        onClose={() => setIsReallocateModalOpen(false)}
      />

      {/* Modal Comparador PIX c/ Desconto vs 100% CDI */}
      <PixDiscountComparatorModal
        isOpen={!!comparingPixGoal}
        onClose={() => setComparingPixGoal(null)}
        goal={comparingPixGoal}
      />

      {/* Modal de Intenção de Gasto Estratégico (Alocação Proativa de Recursos) */}
      <StrategicSpendingIntentModal
        isOpen={isIntentModalOpen}
        onClose={() => setIsIntentModalOpen(false)}
        defaultSource={selectedIntentSource}
        defaultGoalId={selectedIntentGoalId}
      />
    </div>
  );
};
