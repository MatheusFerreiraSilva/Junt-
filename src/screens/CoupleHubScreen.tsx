import React, { useState, useMemo } from 'react';
import {
  Users,
  Target,
  Gift,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  DollarSign,
  Heart,
  Trash2,
  Check,
  X,
  CreditCard,
  Zap,
  PieChart,
  BookmarkCheck,
  Palmtree,
  Plane,
  Edit3,
  Archive,
  RefreshCw,
  Calendar,
  AlertCircle,
  HelpCircle,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  CoupleGoal,
  CoupleWishlistItem,
  FixedBillAlert,
  DreamSimulation,
  CategoryKey,
  PaidBy,
  SavingsPiggyBank,
} from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { FixedBillsPanelModal } from '../components/modals/FixedBillsPanelModal';

type SubTab = 'goals' | 'vacation' | 'wishlist' | 'dreams' | 'bills' | 'profile';

export const CoupleHubScreen: React.FC = () => {
  const [isFixedPanelOpen, setIsFixedPanelOpen] = useState(false);
  const {
    state,
    addPiggyBank,
    updatePiggyBank,
    archivePiggyBank,
    deletePiggyBank,
    depositToPiggyBank,
    payFixedBill,
    unpayFixedBill,
    addFixedBill,
    updateFixedBill,
    deleteFixedBill,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    convertWishlistToGoal,
    addDreamSimulation,
    updateDreamSimulation,
    deleteDreamSimulation,
    convertDreamToGoal,
    setGoalCoupleAgreement,
    monthlyFixedExpensesAvg,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SubTab>('goals');
  const [showArchivedGoals, setShowArchivedGoals] = useState(false);

  // Modal States
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CoupleGoal | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [contributionType, setContributionType] = useState<'deposit' | 'withdrawal'>('deposit');

  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<CoupleWishlistItem | null>(null);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedBillAlert | null>(null);

  const [isPayingBillModalOpen, setIsPayingBillModalOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<{ bill: FixedBillAlert; monthKey: string } | null>(null);

  const [isDreamModalOpen, setIsDreamModalOpen] = useState(false);
  const [editingDream, setEditingDream] = useState<DreamSimulation | null>(null);

  // Form States
  const [goalForm, setGoalForm] = useState({
    title: '',
    category: 'viagem' as CoupleGoal['category'],
    emoji: '✈️',
    targetAmount: '',
    monthlyPlannedDeposit: '',
    deadlineDate: '',
  });

  const [contributionForm, setContributionForm] = useState({
    amount: '',
    contributor: 'both' as 'partner1' | 'partner2' | 'both',
    note: '',
  });

  const [wishlistForm, setWishlistForm] = useState({
    title: '',
    category: 'lazer' as CategoryKey,
    emoji: '🎁',
    estimatedPrice: '',
    priority: 'media' as 'alta' | 'media' | 'baixa',
    requestedBy: 'both' as 'partner1' | 'partner2' | 'both',
    linkUrl: '',
    notes: '',
  });

  const [billForm, setBillForm] = useState({
    title: '',
    category: 'moradia' as CategoryKey,
    amount: '',
    dueDay: '10',
    assignedPayer: 'both' as PaidBy,
    autoPay: false,
    active: true,
  });

  const [payBillForm, setPayBillForm] = useState({
    actualAmount: '',
    actualDate: '',
    paidBy: 'both' as PaidBy,
    paymentMethod: 'pix' as 'pix' | 'debit' | 'credit' | 'cash',
  });

  const [dreamForm, setDreamForm] = useState({
    title: '',
    emoji: '🏠',
    totalCost: '',
    downPayment: '',
    monthlySavings: '1500',
    expectedAnnualYieldPct: '8.5',
  });

  // Partner Names
  const p1Name = state.profile.partner1Name || 'Pessoa 1';
  const p2Name =
    state.profile.partner2Name === 'Aguardando Par...'
      ? 'Pessoa 2'
      : state.profile.partner2Name || 'Pessoa 2';

  // =========================================================================
  // UNIFIED GOALS SELECTOR (1 Meta = 1 Identidade em Investimentos e Hub)
  // =========================================================================
  const allGoals: CoupleGoal[] = useMemo(() => {
    const piggyBanksList = state.piggyBanks || [];
    const coupleGoalsList = state.coupleGoals || [];
    const unifiedMap = new Map<string, CoupleGoal>();

    // First populate from coupleGoals
    coupleGoalsList.forEach((cg) => {
      if (!cg.isDeleted) {
        unifiedMap.set(cg.id, cg);
      }
    });

    // Merge or insert from piggyBanks
    piggyBanksList.forEach((pb) => {
      if (pb.isDeleted) return;
      const existing = unifiedMap.get(pb.id);
      if (existing) {
        unifiedMap.set(pb.id, {
          ...existing,
          title: pb.name || existing.title,
          emoji: pb.emoji || existing.emoji,
          targetAmount: pb.targetAmount ?? existing.targetAmount,
          currentAmount: pb.currentAmount,
          monthlyPlannedDeposit: pb.monthlyDeposit ?? existing.monthlyPlannedDeposit,
          isCompleted: pb.completed || pb.currentAmount >= pb.targetAmount,
          archived: pb.archived ?? existing.archived ?? false,
        });
      } else {
        unifiedMap.set(pb.id, {
          id: pb.id,
          title: pb.name,
          category: 'reserva',
          emoji: pb.emoji || '🎯',
          targetAmount: pb.targetAmount,
          currentAmount: pb.currentAmount,
          partner1Contribution: pb.currentAmount / 2,
          partner2Contribution: pb.currentAmount / 2,
          monthlyPlannedDeposit: pb.monthlyDeposit || 0,
          isCompleted: pb.completed || pb.currentAmount >= pb.targetAmount,
          history: [],
          createdAt: new Date().toISOString().split('T')[0],
          archived: pb.archived ?? false,
        });
      }
    });

    return Array.from(unifiedMap.values());
  }, [state.piggyBanks, state.coupleGoals]);

  const activeGoals = useMemo(
    () => allGoals.filter((g) => !g.archived),
    [allGoals]
  );
  const archivedGoals = useMemo(
    () => allGoals.filter((g) => g.archived),
    [allGoals]
  );

  const displayedGoals = showArchivedGoals ? archivedGoals : activeGoals;

  // Vacation / Travel Filter
  const vacationGoals = useMemo(() => {
    return allGoals.filter(
      (g) =>
        (!g.archived || showArchivedGoals) &&
        (g.category === 'viagem' ||
          g.title.toLowerCase().includes('férias') ||
          g.title.toLowerCase().includes('ferias') ||
          g.title.toLowerCase().includes('viagem'))
    );
  }, [allGoals, showArchivedGoals]);

  // Wishlist, Bills & Dreams lists
  const wishlist: CoupleWishlistItem[] = useMemo(
    () => (state.coupleWishlist || []).filter((w) => !w.isDeleted),
    [state.coupleWishlist]
  );

  const fixedBills: FixedBillAlert[] = useMemo(
    () => (state.coupleFixedBills || []).filter((b) => !b.isDeleted),
    [state.coupleFixedBills]
  );

  const dreams: DreamSimulation[] = useMemo(
    () => (state.dreamSimulations || []).filter((d) => !d.isDeleted),
    [state.dreamSimulations]
  );

  // Expense Comparison for active month
  const expenseComparison = useMemo(() => {
    let p1Total = 0;
    let p2Total = 0;
    let sharedTotal = 0;

    const currentMonthExpenses = state.expenses.filter((e) =>
      e.date.startsWith(state.currentMonth)
    );

    currentMonthExpenses.forEach((e) => {
      if (e.paidBy === 'partner1') p1Total += e.amount;
      else if (e.paidBy === 'partner2') p2Total += e.amount;
      else sharedTotal += e.amount;
    });

    const grandTotal = p1Total + p2Total + sharedTotal;

    return {
      p1Total,
      p2Total,
      sharedTotal,
      grandTotal,
      p1Pct: grandTotal > 0 ? Math.round((p1Total / grandTotal) * 100) : 33,
      p2Pct: grandTotal > 0 ? Math.round((p2Total / grandTotal) * 100) : 33,
      sharedPct: grandTotal > 0 ? Math.round((sharedTotal / grandTotal) * 100) : 34,
    };
  }, [state.expenses, state.currentMonth]);

  // =========================================================================
  // GOAL HANDLERS
  // =========================================================================
  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setGoalForm({
      title: '',
      category: 'viagem',
      emoji: '✈️',
      targetAmount: '',
      monthlyPlannedDeposit: '',
      deadlineDate: '',
    });
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: CoupleGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      category: goal.category,
      emoji: goal.emoji || '🎯',
      targetAmount: goal.targetAmount.toString(),
      monthlyPlannedDeposit: (goal.monthlyPlannedDeposit || 0).toString(),
      deadlineDate: goal.deadlineDate || '',
    });
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim() || !goalForm.targetAmount) return;

    const targetVal = parseFloat(goalForm.targetAmount.replace(',', '.')) || 0;
    const monthlyVal = parseFloat(goalForm.monthlyPlannedDeposit.replace(',', '.')) || 0;

    if (editingGoal) {
      updatePiggyBank(editingGoal.id, {
        title: goalForm.title.trim(),
        name: goalForm.title.trim(),
        category: goalForm.category,
        emoji: goalForm.emoji || '🎯',
        targetAmount: targetVal,
        monthlyDeposit: monthlyVal,
        monthlyPlannedDeposit: monthlyVal,
        deadlineDate: goalForm.deadlineDate || undefined,
      });
    } else {
      addPiggyBank({
        name: goalForm.title.trim(),
        emoji: goalForm.emoji || '🎯',
        purpose: `Meta do Casal: ${goalForm.category}`,
        targetAmount: targetVal,
        monthlyDeposit: monthlyVal,
        currentAmount: 0,
        completed: false,
        archived: false,
      });
    }

    setIsGoalModalOpen(false);
    setEditingGoal(null);
  };

  const handleArchiveGoalToggle = (goal: CoupleGoal) => {
    archivePiggyBank(goal.id, !goal.archived);
  };

  const handleDeleteGoalAttempt = (goal: CoupleGoal) => {
    if (goal.currentAmount > 0) {
      if (
        window.confirm(
          `A meta "${goal.title}" possui R$ ${goal.currentAmount.toLocaleString('pt-BR')} guardados. Deseja arquivá-la para preservar o patrimônio do casal?`
        )
      ) {
        archivePiggyBank(goal.id, true);
      }
    } else {
      if (window.confirm(`Tem certeza que deseja excluir o rascunho da meta "${goal.title}"?`)) {
        deletePiggyBank(goal.id, true);
      }
    }
  };

  const handleSaveContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !contributionForm.amount) return;

    const numVal = parseFloat(contributionForm.amount.replace(',', '.'));
    if (!numVal || numVal <= 0) return;

    const actualDelta = contributionType === 'deposit' ? numVal : -numVal;
    depositToPiggyBank(selectedGoalId, actualDelta, contributionForm.contributor, contributionForm.note);

    setIsContributionModalOpen(false);
    setSelectedGoalId(null);
    setContributionForm({ amount: '', contributor: 'both', note: '' });
  };

  // =========================================================================
  // WISHLIST HANDLERS
  // =========================================================================
  const handleOpenCreateWishlist = () => {
    setEditingWishlist(null);
    setWishlistForm({
      title: '',
      category: 'lazer',
      emoji: '🎁',
      estimatedPrice: '',
      priority: 'media',
      requestedBy: 'both',
      linkUrl: '',
      notes: '',
    });
    setIsWishlistModalOpen(true);
  };

  const handleOpenEditWishlist = (item: CoupleWishlistItem) => {
    setEditingWishlist(item);
    setWishlistForm({
      title: item.title,
      category: item.category,
      emoji: item.emoji || '🎁',
      estimatedPrice: item.estimatedPrice.toString(),
      priority: item.priority,
      requestedBy: item.requestedBy,
      linkUrl: item.linkUrl || '',
      notes: item.notes || '',
    });
    setIsWishlistModalOpen(true);
  };

  const handleSaveWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistForm.title.trim() || !wishlistForm.estimatedPrice) return;

    const price = parseFloat(wishlistForm.estimatedPrice.replace(',', '.')) || 0;

    if (editingWishlist) {
      updateWishlistItem(editingWishlist.id, {
        title: wishlistForm.title.trim(),
        category: wishlistForm.category,
        emoji: wishlistForm.emoji || '🎁',
        estimatedPrice: price,
        priority: wishlistForm.priority,
        requestedBy: wishlistForm.requestedBy,
        linkUrl: wishlistForm.linkUrl || undefined,
        notes: wishlistForm.notes || undefined,
      });
    } else {
      addWishlistItem({
        title: wishlistForm.title.trim(),
        category: wishlistForm.category,
        emoji: wishlistForm.emoji || '🎁',
        estimatedPrice: price,
        priority: wishlistForm.priority,
        requestedBy: wishlistForm.requestedBy,
        linkUrl: wishlistForm.linkUrl || undefined,
        notes: wishlistForm.notes || undefined,
      });
    }

    setIsWishlistModalOpen(false);
    setEditingWishlist(null);
  };

  const handleDeleteWishlist = (id: string) => {
    deleteWishlistItem(id);
  };

  const handleConvertWishToGoal = (item: CoupleWishlistItem) => {
    convertWishlistToGoal(item.id);
    setActiveTab('goals');
  };

  // =========================================================================
  // FIXED BILL HANDLERS
  // =========================================================================
  const handleOpenCreateBill = () => {
    setEditingBill(null);
    setBillForm({
      title: '',
      category: 'moradia',
      amount: '',
      dueDay: '10',
      assignedPayer: 'both',
      autoPay: false,
      active: true,
    });
    setIsBillModalOpen(true);
  };

  const handleOpenEditBill = (bill: FixedBillAlert) => {
    setEditingBill(bill);
    setBillForm({
      title: bill.title,
      category: bill.category,
      amount: bill.amount.toString(),
      dueDay: bill.dueDay.toString(),
      assignedPayer: bill.assignedPayer,
      autoPay: bill.autoPay,
      active: bill.active ?? true,
    });
    setIsBillModalOpen(true);
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.title.trim() || !billForm.amount) return;

    const amt = parseFloat(billForm.amount.replace(',', '.')) || 0;
    const dueDayNum = Math.min(Math.max(1, parseInt(billForm.dueDay, 10) || 10), 31);

    if (editingBill) {
      updateFixedBill(editingBill.id, {
        title: billForm.title.trim(),
        category: billForm.category,
        amount: amt,
        dueDay: dueDayNum,
        assignedPayer: billForm.assignedPayer,
        autoPay: billForm.autoPay,
        active: billForm.active,
      });
    } else {
      addFixedBill({
        title: billForm.title.trim(),
        category: billForm.category,
        amount: amt,
        dueDay: dueDayNum,
        assignedPayer: billForm.assignedPayer,
        autoPay: billForm.autoPay,
        status: 'pending',
        isRecurring: true,
        active: billForm.active,
      });
    }

    setIsBillModalOpen(false);
    setEditingBill(null);
  };

  const handleOpenPayBillModal = (bill: FixedBillAlert) => {
    const currentMonth = state.currentMonth;
    const safeDay = Math.min(Math.max(1, bill.dueDay), 28);
    const defaultDate = `${currentMonth}-${String(safeDay).padStart(2, '0')}`;

    setPayingBill({ bill, monthKey: currentMonth });
    setPayBillForm({
      actualAmount: bill.amount.toString(),
      actualDate: defaultDate,
      paidBy: bill.assignedPayer === 'both' ? 'both' : bill.assignedPayer,
      paymentMethod: bill.autoPay ? 'debit' : 'pix',
    });
    setIsPayingBillModalOpen(true);
  };

  const handleConfirmPayBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    const actualVal = parseFloat(payBillForm.actualAmount.replace(',', '.')) || payingBill.bill.amount;

    payFixedBill(payingBill.bill.id, payingBill.monthKey, {
      actualAmount: actualVal,
      actualDate: payBillForm.actualDate,
      paymentMethod: payBillForm.paymentMethod,
      paidBy: payBillForm.paidBy,
    });

    setIsPayingBillModalOpen(false);
    setPayingBill(null);
  };

  const handleUnpayBill = (bill: FixedBillAlert) => {
    unpayFixedBill(bill.id, state.currentMonth);
  };

  const handleDeleteBill = (id: string) => {
    deleteFixedBill(id);
  };

  // =========================================================================
  // DREAM SIMULATION HANDLERS
  // =========================================================================
  const handleOpenCreateDream = () => {
    setEditingDream(null);
    setDreamForm({
      title: '',
      emoji: '🏠',
      totalCost: '',
      downPayment: '',
      monthlySavings: '1500',
      expectedAnnualYieldPct: '8.5',
    });
    setIsDreamModalOpen(true);
  };

  const handleOpenEditDream = (dream: DreamSimulation) => {
    setEditingDream(dream);
    setDreamForm({
      title: dream.title,
      emoji: dream.emoji || '🏠',
      totalCost: dream.totalCost.toString(),
      downPayment: (dream.downPayment || 0).toString(),
      monthlySavings: dream.monthlySavings.toString(),
      expectedAnnualYieldPct: (dream.expectedAnnualYieldPct || 8.5).toString(),
    });
    setIsDreamModalOpen(true);
  };

  const handleSaveDream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dreamForm.title.trim() || !dreamForm.totalCost) return;

    const totalCost = parseFloat(dreamForm.totalCost.replace(',', '.')) || 0;
    const downPayment = parseFloat(dreamForm.downPayment.replace(',', '.')) || 0;
    const monthlySavings = parseFloat(dreamForm.monthlySavings.replace(',', '.')) || 1000;
    const annualYield = parseFloat(dreamForm.expectedAnnualYieldPct.replace(',', '.')) || 8.5;

    const netToSave = Math.max(0, totalCost - downPayment);
    const months = monthlySavings > 0 ? Math.ceil(netToSave / monthlySavings) : 60;

    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
    const completionYearMonth = targetDate.toISOString().slice(0, 7);

    if (editingDream) {
      updateDreamSimulation(editingDream.id, {
        title: dreamForm.title.trim(),
        emoji: dreamForm.emoji || '🚀',
        totalCost,
        downPayment,
        monthlySavings,
        expectedAnnualYieldPct: annualYield,
        monthsToAchieve: months,
        estimatedCompletionDate: completionYearMonth,
      });
    } else {
      addDreamSimulation({
        title: dreamForm.title.trim(),
        emoji: dreamForm.emoji || '🚀',
        totalCost,
        downPayment,
        monthlySavings,
        expectedAnnualYieldPct: annualYield,
        inflationAnnualPct: 4.0,
        monthsToAchieve: months,
        estimatedCompletionDate: completionYearMonth,
        partner1SharePct: 50,
        partner2SharePct: 50,
      });
    }

    setIsDreamModalOpen(false);
    setEditingDream(null);
  };

  const handleDeleteDream = (id: string) => {
    deleteDreamSimulation(id);
  };

  const handleConvertDreamToGoal = (dream: DreamSimulation) => {
    convertDreamToGoal(dream.id);
    setActiveTab('goals');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-6 animate-in fade-in pb-24">
      {/* ========================================================================= */}
      {/* TOP HUB BANNER & HERO CARD                                                */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111318] via-[#1E232A] to-[#2B1B2D] text-white p-6 sm:p-8 border border-slate-700 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 animate-pulse" />
              <span>Hub do Casal — Gestão Integrada</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-display tracking-tight text-white">
              Sincronia Financeira: <span className="text-rose-400">{p1Name}</span> &amp;{' '}
              <span className="text-amber-300">{p2Name}</span>
            </h1>

            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Um espaço único para alinhar metas, sincronizar contas fixas, registrar desejos e simular os próximos passos do casal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 shrink-0">
            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Metas Ativas do Casal
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {activeGoals.length} Metas
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Acumulado nas Caixinhas
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-300">
                R$ {activeGoals.reduce((s, g) => s + g.currentAmount, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARRA HORIZONTAL / DOCK DE NAVEGAÇÃO ENTRE AS MICRO-ABAS DO HUB           */}
      {/* ========================================================================= */}
      <nav
        aria-label="Microabas do Hub do Casal"
        className="w-full bg-white/90 dark:bg-slate-900/90 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs backdrop-blur-md sticky top-2 z-20"
      >
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-1.5">
          {/* 1. Cofres & Metas */}
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'goals'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Cofres &amp; Metas</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeTab === 'goals'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {activeGoals.length}
            </span>
          </button>

          {/* 2. Reserva de Férias */}
          <button
            type="button"
            onClick={() => setActiveTab('vacation')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'vacation'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Palmtree className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="truncate">Férias &amp; Viagens</span>
          </button>

          {/* 3. Wishlist do Casal */}
          <button
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'wishlist'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">Lista de Desejos</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeTab === 'wishlist'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {wishlist.length}
            </span>
          </button>

          {/* 4. Sonhos & Projetos */}
          <button
            type="button"
            onClick={() => setActiveTab('dreams')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'dreams'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="truncate">Sonhos</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeTab === 'dreams'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {dreams.length}
            </span>
          </button>

          {/* 5. Contas Fixas */}
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'bills'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Contas Fixas</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeTab === 'bills'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {fixedBills.length}
            </span>
          </button>

          {/* 6. Perfil & Comparativos */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#111318] text-white shadow-md dark:bg-white dark:text-[#111318]'
                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Perfil do Casal</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: COFRES & METAS DO CASAL                                            */}
      {/* ========================================================================= */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Objetivos &amp; Caixinhas Conjuntas</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Sincronia Total
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Caixinhas de objetivos vinculadas em tempo real com a tela de Investimentos
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowArchivedGoals(!showArchivedGoals)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                  showArchivedGoals
                    ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200'
                    : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{showArchivedGoals ? 'Ver Ativas' : `Ver Arquivadas (${archivedGoals.length})`}</span>
              </button>

              <button
                onClick={handleOpenCreateGoal}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Criar Meta</span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {displayedGoals.length === 0 ? (
            <div className="py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <Target className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                {showArchivedGoals ? 'Nenhuma meta arquivada encontrada.' : 'Nenhuma meta ativa cadastrada ainda.'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Crie um objetivo conjunto (viagem, reforma, veículo ou reserva) para guardar juntos com transparência.
              </p>
              {!showArchivedGoals && (
                <button
                  onClick={handleOpenCreateGoal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-black shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Cadastrar Primeira Meta</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedGoals.map((goal) => {
                const progressPct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                const p1Contrib = goal.partner1Contribution || 0;
                const p2Contrib = goal.partner2Contribution || 0;
                const hasKnownContrib = p1Contrib > 0 || p2Contrib > 0;
                const p1Pct = hasKnownContrib && goal.currentAmount > 0 ? Math.round((p1Contrib / goal.currentAmount) * 100) : 50;

                return (
                  <div
                    key={goal.id}
                    className={`clay-card p-5 bg-white dark:bg-slate-900 border rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-all relative ${
                      goal.archived
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20 opacity-90'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl shrink-0">
                          {goal.emoji || '🎯'}
                        </span>
                        <div>
                          <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                            {goal.title}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Meta: R$ {goal.targetAmount.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditGoal(goal)}
                          title="Editar Meta"
                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveGoalToggle(goal)}
                          title={goal.archived ? 'Reativar Meta' : 'Arquivar Meta'}
                          className="p-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                        >
                          {goal.archived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteGoalAttempt(goal)}
                          title="Excluir Meta"
                          className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                          R$ {goal.currentAmount.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">{progressPct}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Partner Contributions Breakdown */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        <span>Divisão de Aportes:</span>
                        <span className="text-slate-500 font-mono">
                          {hasKnownContrib ? `${p1Pct}% ${p1Name} · ${100 - p1Pct}% ${p2Name}` : 'Não informada'}
                        </span>
                      </div>

                      {hasKnownContrib && (
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[10px]">{p1Name}</span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              R$ {p1Contrib.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block text-[10px]">{p2Name}</span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              R$ {p2Contrib.toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setContributionType('deposit');
                          setIsContributionModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-xs font-black transition-all cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>+ Guardar</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setContributionType('withdrawal');
                          setIsContributionModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-xs font-black transition-all cursor-pointer"
                      >
                        <ArrowDownLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>- Usar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESERVA DE FÉRIAS & VIAGENS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'vacation' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Reserva de Férias &amp; Viagens do Casal</span>
                <span className="text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Recesso &amp; Descanso
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Planejem recessos e viagens sem desestabilizar os tetos mensais de consumo
              </p>
            </div>

            <button
              onClick={() => {
                setEditingGoal(null);
                setGoalForm({
                  title: 'Férias dos Sonhos 🏖️',
                  category: 'viagem',
                  emoji: '✈️',
                  targetAmount: '8000',
                  monthlyPlannedDeposit: '1000',
                  deadlineDate: '',
                });
                setIsGoalModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Nova Meta de Férias</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vacationGoals.length === 0 ? (
              <div className="col-span-full py-10 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center bg-sky-50/20 dark:bg-sky-950/20">
                <Palmtree className="w-10 h-10 text-sky-500 mx-auto mb-2 opacity-80" />
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Nenhuma viagem ou férias cadastrada.
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Definam um destino a dois e comecem a guardar juntos!
                </p>
              </div>
            ) : (
              vacationGoals.map((goal) => {
                const progressPct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

                return (
                  <div
                    key={goal.id}
                    className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center text-2xl shrink-0">
                          {goal.emoji || '✈️'}
                        </span>
                        <div>
                          <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                            {goal.title}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Meta: R$ {goal.targetAmount.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditGoal(goal)}
                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGoalAttempt(goal)}
                          className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-sky-600 dark:text-sky-400 font-mono">
                          R$ {goal.currentAmount.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">{progressPct}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setContributionType('deposit');
                          setIsContributionModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1 py-2 px-3 rounded-2xl bg-sky-500/20 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700 text-xs font-black cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+ Guardar</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setContributionType('withdrawal');
                          setIsContributionModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1 py-2 px-3 rounded-2xl bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-xs font-black cursor-pointer"
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>- Usar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LISTA DE DESEJOS DO CASAL                                         */}
      {/* ========================================================================= */}
      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Lista de Desejos do Casal</span>
                <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Wishlist &amp; Intenções
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Registrem itens desejados para converter em metas ou comprar no momento certo
              </p>
            </div>

            <button
              onClick={handleOpenCreateWishlist}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Adicionar Desejo</span>
            </button>
          </div>

          {wishlist.length === 0 ? (
            <div className="py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center bg-rose-50/20 dark:bg-rose-950/20 space-y-3">
              <Gift className="w-12 h-12 text-rose-400 mx-auto" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                Lista de desejos vazia.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Adicionem compras desejadas (eletrônicos, móveis, viagens) para planejar com maturidade.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {wishlist.map((item) => (
                <div
                  key={item.id}
                  className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3 shadow-sm relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-2xl shrink-0">
                        {item.emoji || '🎁'}
                      </span>
                      <div>
                        <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                          {item.title}
                        </h4>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          R$ {item.estimatedPrice.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditWishlist(item)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWishlist(item.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      {item.notes}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                        item.priority === 'alta'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          : item.priority === 'media'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Prioridade {item.priority}
                    </span>

                    {item.status === 'convertido_meta' ? (
                      <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Convertido em Meta
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConvertWishToGoal(item)}
                        className="flex items-center gap-1 text-xs font-black text-rose-600 hover:text-rose-800 dark:text-rose-400 cursor-pointer hover:underline"
                      >
                        <span>Converter em Meta →</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SONHOS & PROJETOS DO CASAL                                         */}
      {/* ========================================================================= */}
      {activeTab === 'dreams' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Sonhos &amp; Projetos Futuros</span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Simulação &amp; Planejamento
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Simulem grandes conquistas (casa própria, veículo, consultório) antes de comprometer caixa real
              </p>
            </div>

            <button
              onClick={handleOpenCreateDream}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Simular Novo Sonho</span>
            </button>
          </div>

          {dreams.length === 0 ? (
            <div className="py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center bg-purple-50/20 dark:bg-purple-950/20 space-y-3">
              <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                Nenhuma simulação de sonho ativa.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Criem um cenário de médio/longo prazo para estimar prazo e aporte mensal necessário.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {dreams.map((dream) => (
                <div
                  key={dream.id}
                  className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-2xl shrink-0">
                        {dream.emoji || '🚀'}
                      </span>
                      <div>
                        <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                          {dream.title}
                        </h4>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Valor Estimado: R$ {dream.totalCost.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditDream(dream)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDream(dream.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Aporte Mensal</span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono">
                        R$ {dream.monthlySavings.toLocaleString('pt-BR')}/mês
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Prazo Estimado</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                        {dream.monthsToAchieve} Meses
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    {dream.convertedGoalId ? (
                      <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Convertido em Meta
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConvertDreamToGoal(dream)}
                        className="flex items-center gap-1 text-xs font-black text-purple-600 hover:text-purple-800 dark:text-purple-400 cursor-pointer hover:underline"
                      >
                        <span>Transformar em Meta do Casal →</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CONTAS FIXAS RECORRENTES                                           */}
      {/* ========================================================================= */}
      {activeTab === 'bills' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Contas Fixas &amp; Obrigações Recorrentes</span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Mês Ativo: {state.currentMonth}
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Baixas e pagamentos criam lançamentos canônicos sincronizados sem duplicidade
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFixedPanelOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-black shadow-md hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
              >
                <span>📌 Painel Fixos do Mês</span>
              </button>
              <button
                onClick={handleOpenCreateBill}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Nova Conta Fixa</span>
              </button>
            </div>
          </div>

          {fixedBills.length === 0 ? (
            <div className="py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center bg-amber-50/20 dark:bg-amber-950/20 space-y-3">
              <CreditCard className="w-12 h-12 text-amber-400 mx-auto" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                Nenhuma conta fixa cadastrada.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cadastrem aluguel, condomínio, luz, internet e planos recorrentes para ter previsão precisa.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fixedBills.map((bill) => {
                const currentMonthHistory = bill.history?.[state.currentMonth];
                const isPaidInCurrentMonth =
                  currentMonthHistory?.status === 'paid' || bill.lastPaidMonth === state.currentMonth;

                return (
                  <div
                    key={bill.id}
                    className={`clay-card p-5 bg-white dark:bg-slate-900 border rounded-3xl space-y-3 shadow-sm relative ${
                      isPaidInCurrentMonth
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : bill.active === false
                        ? 'border-slate-300 dark:border-slate-800 opacity-60'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                            {bill.title}
                          </h4>
                          {bill.autoPay && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-bold">
                              Débito Auto
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mt-0.5">
                          Vencimento: Dia {bill.dueDay}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditBill(bill)}
                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-black text-slate-900 dark:text-white font-mono text-base">
                        R$ {bill.amount.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-slate-500 font-medium">
                        Resp: {bill.assignedPayer === 'partner1' ? p1Name : bill.assignedPayer === 'partner2' ? p2Name : 'Casal'}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      {isPaidInCurrentMonth ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Pago neste mês
                          </span>
                          <button
                            onClick={() => handleUnpayBill(bill)}
                            className="text-[11px] text-slate-500 hover:text-rose-600 font-bold underline cursor-pointer"
                          >
                            Estornar Baixa
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Pendente em {state.currentMonth}
                          </span>
                          <button
                            onClick={() => handleOpenPayBillModal(bill)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
                          >
                            Dar Baixa →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PERFIL DO CASAL & DISTRIBUIÇÃO                                      */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
              Perfil do Casal &amp; Proporção Financeira
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                  Integrante 1 ({p1Name})
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  R$ {(state.profile.partner1Income || 0).toLocaleString('pt-BR')} / mês
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {expenseComparison.grandTotal > 0
                    ? `Gastou R$ ${expenseComparison.p1Total.toLocaleString('pt-BR')} este mês`
                    : 'Renda declarada'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                  Integrante 2 ({p2Name})
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  R$ {(state.profile.partner2Income || 0).toLocaleString('pt-BR')} / mês
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {expenseComparison.grandTotal > 0
                    ? `Gastou R$ ${expenseComparison.p2Total.toLocaleString('pt-BR')} este mês`
                    : 'Renda declarada'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GOAL MODAL (CREATE / EDIT)                                        */}
      {/* ========================================================================= */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                {editingGoal ? 'Editar Meta do Casal' : 'Nova Meta do Casal'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Título da Meta
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder="Ex: Viagem de Férias, Reforma da Casa..."
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={goalForm.emoji}
                    onChange={(e) => setGoalForm({ ...goalForm, emoji: e.target.value })}
                    placeholder="✈️"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="viagem">Viagem</option>
                    <option value="imovel">Imóvel</option>
                    <option value="veiculo">Veículo</option>
                    <option value="reforma">Reforma</option>
                    <option value="reserva">Reserva</option>
                    <option value="liberdade">Liberdade</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                    placeholder="10000"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Aporte Mensal (R$)
                  </label>
                  <input
                    type="text"
                    value={goalForm.monthlyPlannedDeposit}
                    onChange={(e) => setGoalForm({ ...goalForm, monthlyPlannedDeposit: e.target.value })}
                    placeholder="1000"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
                >
                  {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTRIBUTION MODAL (+ GUARDAR / - USAR)                            */}
      {/* ========================================================================= */}
      {isContributionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                {contributionType === 'deposit' ? 'Guardar em Caixinha (+)' : 'Usar Saldo de Caixinha (-)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsContributionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContribution} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  required
                  value={contributionForm.amount}
                  onChange={(e) => setContributionForm({ ...contributionForm, amount: e.target.value })}
                  placeholder="500,00"
                  className="w-full px-3.5 py-2.5 text-sm font-black rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Quem {contributionType === 'deposit' ? 'aportou' : 'utilizou'}?
                </label>
                <select
                  value={contributionForm.contributor}
                  onChange={(e) => setContributionForm({ ...contributionForm, contributor: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="both">Casal (50/50)</option>
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Observação / Nota
                </label>
                <input
                  type="text"
                  value={contributionForm.note}
                  onChange={(e) => setContributionForm({ ...contributionForm, note: e.target.value })}
                  placeholder="Ex: Aporte do plantão extra, parcela da viagem..."
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsContributionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAY FIXED BILL MODAL                                              */}
      {/* ========================================================================= */}
      {isPayingBillModalOpen && payingBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                Dar Baixa em Conta Fixa
              </h3>
              <button
                type="button"
                onClick={() => setIsPayingBillModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 font-medium">
              Confirme os dados do pagamento da conta <strong>{payingBill.bill.title}</strong> para a competência de <strong>{payingBill.monthKey}</strong>.
            </div>

            <form onSubmit={handleConfirmPayBill} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor Efetivo Pago (R$)
                </label>
                <input
                  type="text"
                  required
                  value={payBillForm.actualAmount}
                  onChange={(e) => setPayBillForm({ ...payBillForm, actualAmount: e.target.value })}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 text-sm font-black rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Data do Pagamento
                  </label>
                  <input
                    type="date"
                    required
                    value={payBillForm.actualDate}
                    onChange={(e) => setPayBillForm({ ...payBillForm, actualDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Meio de Pagamento
                  </label>
                  <select
                    value={payBillForm.paymentMethod}
                    onChange={(e) => setPayBillForm({ ...payBillForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="pix">PIX</option>
                    <option value="debit">Débito em Conta</option>
                    <option value="credit">Cartão de Crédito</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Quem Pagou?
                </label>
                <select
                  value={payBillForm.paidBy}
                  onChange={(e) => setPayBillForm({ ...payBillForm, paidBy: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="both">Conta do Casal (50/50)</option>
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayingBillModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAINEL DE FIXOS DO MÊS (PROMPT 28I) */}
      <FixedBillsPanelModal
        isOpen={isFixedPanelOpen}
        onClose={() => setIsFixedPanelOpen(false)}
        initialMonth={state.currentMonth}
      />
    </div>
  );
};
