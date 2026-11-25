import React, { useState, useMemo } from 'react';
import {
  Users,
  Target,
  Gift,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Heart,
  Trash2,
  X,
  CreditCard,
  Palmtree,
  Edit3,
  Archive,
  RefreshCw,
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
} from '../types/finance';
import { FixedBillsPanelModal } from '../components/modals/FixedBillsPanelModal';
import { selectCanonicalFixedBillsRegistry } from '../utils/occurrenceProjection';
import { selectFixedBillOccurrences } from '../utils/fixedBillEngine';

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
    withdrawFromPiggyBank,
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
    previewWithdrawal,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SubTab>('goals');
  const [showArchivedGoals, setShowArchivedGoals] = useState(false);

  // Modal States
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CoupleGoal | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [contributionType, setContributionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [contributionError, setContributionError] = useState<string>('');
  const [needsCompletedConfirmation, setNeedsCompletedConfirmation] = useState(false);
  const [confirmedCompletedContribution, setConfirmedCompletedContribution] = useState(false);
  const [withdrawalChannel, setWithdrawalChannel] = useState<'asset_redemption' | 'virtual_reallocation'>('asset_redemption');
  const [withdrawalStage, setWithdrawalStage] = useState<'pending_settlement' | 'occurred_manual'>('occurred_manual');
  const [withdrawalNetAmount, setWithdrawalNetAmount] = useState('');
  const [withdrawalDestAccountId, setWithdrawalDestAccountId] = useState('');
  const [withdrawalOverrideDivergence, setWithdrawalOverrideDivergence] = useState(false);
  const [pendingDeleteGoal, setPendingDeleteGoal] = useState<CoupleGoal | null>(null);
  const [hubError, setHubError] = useState<string>('');

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
    isFireEligible: false,
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
          isFireEligible: pb.isFireEligible ?? existing.isFireEligible ?? false,
          totalInvested: pb.totalInvested ?? existing.totalInvested,
          yieldAccumulated: pb.yieldAccumulated ?? existing.yieldAccumulated,
          coupleAgreement: pb.coupleAgreement ?? existing.coupleAgreement,
        });
      } else {
        const agreedP1 = pb.coupleAgreement
          ? Math.round((pb.currentAmount * (pb.coupleAgreement.partner1SharePct || 0))) / 100
          : 0;
        const agreedP2 = pb.coupleAgreement
          ? Math.round((pb.currentAmount * (pb.coupleAgreement.partner2SharePct || 0))) / 100
          : 0;
        unifiedMap.set(pb.id, {
          id: pb.id,
          title: pb.name,
          category: 'reserva',
          emoji: pb.emoji || '🎯',
          targetAmount: pb.targetAmount,
          currentAmount: pb.currentAmount,
          partner1Contribution: agreedP1,
          partner2Contribution: agreedP2,
          monthlyPlannedDeposit: pb.monthlyDeposit || 0,
          isCompleted: pb.completed || pb.currentAmount >= pb.targetAmount,
          history: [],
          createdAt: new Date().toISOString().split('T')[0],
          archived: pb.archived ?? false,
          isFireEligible: Boolean(pb.isFireEligible),
          totalInvested: pb.totalInvested,
          yieldAccumulated: pb.yieldAccumulated,
          coupleAgreement: pb.coupleAgreement,
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

  const { bills: fixedBills, conflicts: fixedBillRegistryConflicts } = useMemo(
    () =>
      selectCanonicalFixedBillsRegistry({
        coupleFixedBills: state.coupleFixedBills,
        fixedBillAlerts: state.fixedBillAlerts,
      }),
    [state.coupleFixedBills, state.fixedBillAlerts]
  );

  const currentMonthBillOccurrencesById = useMemo(() => {
    const occs = selectFixedBillOccurrences(state, state.currentMonth, 'casal');
    const map = new Map<string, typeof occs[number]>();
    occs.forEach((o) => {
      if (!o.isDirectExpense) {
        map.set(o.billId, o);
      }
    });
    return map;
  }, [state]);

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
      isFireEligible: false,
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
      isFireEligible: Boolean(goal.isFireEligible),
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
        isFireEligible: goalForm.isFireEligible,
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
        isFireEligible: goalForm.isFireEligible,
      });
    }

    setIsGoalModalOpen(false);
    setEditingGoal(null);
  };

  const handleArchiveGoalToggle = (goal: CoupleGoal) => {
    archivePiggyBank(goal.id, !goal.archived);
  };

  const handleDeleteGoalAttempt = (goal: CoupleGoal) => {
    setPendingDeleteGoal(goal);
  };

  const handleConfirmPendingDeleteGoal = () => {
    if (!pendingDeleteGoal) return;
    if (pendingDeleteGoal.currentAmount > 0) {
      archivePiggyBank(pendingDeleteGoal.id, true);
    } else {
      deletePiggyBank(pendingDeleteGoal.id, true);
    }
    setPendingDeleteGoal(null);
  };

  const handleSaveContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !contributionForm.amount) return;

    const numVal = parseFloat(contributionForm.amount.replace(',', '.'));
    if (!Number.isFinite(numVal) || numVal <= 0) {
      setContributionError('Informe um valor válido maior que zero.');
      return;
    }

    try {
      setContributionError('');
      if (contributionType === 'deposit') {
        depositToPiggyBank(selectedGoalId, numVal, contributionForm.contributor, contributionForm.note, {
          completedGoalContributionConfirmed: confirmedCompletedContribution,
        });
      } else {
        const finalNet = withdrawalNetAmount.trim()
          ? parseFloat(withdrawalNetAmount.replace(',', '.'))
          : numVal;
        if (!Number.isFinite(finalNet) || finalNet <= 0) {
          setContributionError('Informe um valor líquido válido maior que zero.');
          return;
        }
        withdrawFromPiggyBank(selectedGoalId, numVal, {
          withdrawalChannel,
          executionMode: withdrawalStage,
          grossAmountR$: numVal,
          netAmountR$: finalNet,
          destinationAccountId: withdrawalDestAccountId || undefined,
          overrideInsufficientPlanning: withdrawalOverrideDivergence,
          note: contributionForm.note || undefined,
        });
      }

      setIsContributionModalOpen(false);
      setSelectedGoalId(null);
      setNeedsCompletedConfirmation(false);
      setConfirmedCompletedContribution(false);
      setWithdrawalNetAmount('');
      setWithdrawalOverrideDivergence(false);
      setContributionForm({ amount: '', contributor: 'both', note: '' });
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível concluir a movimentação na caixinha.';
      if (err?.code === 'CONFIRMATION_REQUIRED' || /CONFIRMATION_REQUIRED|conclu[ií]d/i.test(msg)) {
        setNeedsCompletedConfirmation(true);
      }
      setContributionError(msg);
    }
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
    try {
      setHubError('');
      convertWishlistToGoal(item.id);
      setActiveTab('goals');
    } catch (err: any) {
      setHubError(err?.message || 'Não foi possível converter este desejo em objetivo.');
    }
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
    try {
      setHubError('');
      convertDreamToGoal(dream.id);
      setActiveTab('goals');
    } catch (err: any) {
      setHubError(err?.message || 'Não foi possível converter este sonho em meta.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-6 animate-in fade-in pb-24">
      {hubError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3"
        >
          <span>{hubError}</span>
          <button
            type="button"
            onClick={() => setHubError('')}
            className="text-rose-600 dark:text-rose-300 font-bold"
          >
            Fechar
          </button>
        </div>
      )}
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
                const progressPct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                const p1Contrib = goal.partner1Contribution || 0;
                const p2Contrib = goal.partner2Contribution || 0;
                const contribTotal = p1Contrib + p2Contrib;
                const hasKnownContrib = contribTotal > 0;
                const p1Pct = hasKnownContrib
                  ? Math.round((p1Contrib / contribTotal) * 100)
                  : goal.coupleAgreement?.partner1SharePct ?? null;
                const recentOps = (state.financialOperations || [])
                  .filter((op) => op.targetRef?.id === goal.id || op.sourceRef?.id === goal.id)
                  .slice(0, 2);

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                              {goal.title}
                            </h4>
                            {goal.isFireEligible === true && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black uppercase">
                                FIRE
                              </span>
                            )}
                          </div>
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
                          {p1Pct !== null ? `${p1Pct}% ${p1Name} · ${100 - p1Pct}% ${p2Name}` : 'Não informada'}
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

                    {recentOps.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {recentOps.map((op) => (
                          <span
                            key={op.id}
                            title={`Operação rastreável ${op.id}`}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              op.state === 'reverted' || op.state === 'estornado'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 line-through border-slate-300 dark:border-slate-700'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {op.id}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedGoalId(goal.id);
                          setContributionType('deposit');
                          setContributionError('');
                          setNeedsCompletedConfirmation(false);
                          setConfirmedCompletedContribution(false);
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
                          setContributionError('');
                          setNeedsCompletedConfirmation(false);
                          setConfirmedCompletedContribution(false);
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
                  isFireEligible: false,
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
            <div className="space-y-4">
              {fixedBillRegistryConflicts.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200">
                  {fixedBillRegistryConflicts.map((c) => (
                    <div key={c.billId}>⚠️ {c.reason}</div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {fixedBills.map((bill) => {
                  const occ = currentMonthBillOccurrencesById.get(bill.id);
                  const isPaidInCurrentMonth = occ ? occ.status === 'paid' : false;
                  const displayAmount = occ ? occ.amountEffective : bill.amount;

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
                            Vencimento: Dia {occ ? occ.dueDate.slice(8, 10) : bill.dueDay}
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
                          R$ {displayAmount.toLocaleString('pt-BR')}
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
                        ) : bill.active === false ? (
                          <span className="text-xs font-bold text-slate-400">
                            Recorrência encerrada para {state.currentMonth}
                          </span>
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

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={goalForm.isFireEligible}
                  onChange={(e) => setGoalForm({ ...goalForm, isFireEligible: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Elegível ao patrimônio FIRE (Independência Financeira)</span>
              </label>

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
      {isContributionModalOpen && (() => {
        const targetGoal = state.piggyBanks.find(p => p.id === selectedGoalId);
        const grossVal = parseFloat(contributionForm.amount.replace(',', '.')) || 0;
        const parsedNet = withdrawalNetAmount.trim()
          ? parseFloat(withdrawalNetAmount.replace(',', '.'))
          : grossVal;
        const netVal = Number.isFinite(parsedNet) && parsedNet > 0 ? parsedNet : grossVal;
        const checkingAccounts = (state.linkedAccounts || []).filter(
          a => a.accountType === 'corrente' || a.accountType === 'poupanca'
        );
        const withdrawalPreview =
          contributionType === 'withdrawal' && selectedGoalId && grossVal > 0
            ? previewWithdrawal({
                goalId: selectedGoalId,
                sourceType: 'piggy_bank',
                grossAmountR$: grossVal,
                netAmountR$: netVal,
                withdrawalChannel,
                executionMode: withdrawalStage,
                destinationAccountId: withdrawalDestAccountId || undefined,
                overrideInsufficientPlanning: withdrawalOverrideDivergence,
              })
            : null;
        const diffR$ = withdrawalPreview
          ? withdrawalPreview.differenceToReviewCents / 100
          : Math.max(0, grossVal - netVal);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                  {contributionType === 'deposit' ? 'Guardar em Caixinha (+)' : 'Usar Saldo de Caixinha (-)'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsContributionModalOpen(false);
                    setContributionError('');
                    setWithdrawalNetAmount('');
                    setWithdrawalOverrideDivergence(false);
                    setNeedsCompletedConfirmation(false);
                    setConfirmedCompletedContribution(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveContribution} className="space-y-3.5">
                {contributionError && (
                  <p
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200"
                  >
                    {contributionError}
                  </p>
                )}

                {needsCompletedConfirmation && contributionType === 'deposit' && (
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedCompletedContribution}
                      onChange={(e) => setConfirmedCompletedContribution(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Confirmo que desejo aportar manualmente nesta meta já concluída e utilizada.</span>
                  </label>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    {contributionType === 'withdrawal' ? 'Valor Bruto (R$)' : 'Valor (R$)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={contributionForm.amount}
                    onChange={(e) => {
                      setContributionForm({ ...contributionForm, amount: e.target.value });
                      if (contributionError) setContributionError('');
                    }}
                    placeholder="500,00"
                    className="w-full px-3.5 py-2.5 text-sm font-black rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {contributionType === 'withdrawal' && (
                  <div className="space-y-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWithdrawalChannel('asset_redemption')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                          withdrawalChannel === 'asset_redemption'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Resgate real de ativo
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawalChannel('virtual_reallocation')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                          withdrawalChannel === 'virtual_reallocation'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Realocação virtual (mesma conta)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWithdrawalStage('pending_settlement')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                          withdrawalStage === 'pending_settlement'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Solicitar / Planejar (em liquidação)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawalStage('occurred_manual')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                          withdrawalStage === 'occurred_manual'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Registrar que ocorreu no banco
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Valor líquido recebido (R$)
                        </label>
                        <input
                          type="text"
                          value={withdrawalNetAmount}
                          onChange={(e) => setWithdrawalNetAmount(e.target.value)}
                          placeholder={contributionForm.amount || 'Mesmo do bruto'}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                        />
                      </div>

                      {withdrawalChannel === 'asset_redemption' && checkingAccounts.length > 0 && (
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                            Conta corrente destino
                          </label>
                          <select
                            value={withdrawalDestAccountId}
                            onChange={(e) => setWithdrawalDestAccountId(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                          >
                            <option value="">Selecionar conta</option>
                            {checkingAccounts.map((acc) => (
                              <option key={acc.id} value={acc.canonicalAccountId || acc.id}>
                                {acc.bankName} ({acc.accountType})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {diffR$ > 0 && (
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                        Diferença a revisar: <strong>R$ {diffR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}

                    {targetGoal && grossVal > targetGoal.currentAmount && (
                      <label className="flex items-start gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={withdrawalOverrideDivergence}
                          onChange={(e) => setWithdrawalOverrideDivergence(e.target.checked)}
                          className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="font-bold text-rose-900 dark:text-rose-200">
                          Registrar divergência ocorrida no banco (saldo planejado insuficiente)
                        </span>
                      </label>
                    )}

                    {withdrawalPreview && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold">
                          <span>Prévia da Operação</span>
                          <span className="text-emerald-700 dark:text-emerald-300">Renda nova gerada: R$ 0,00</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2">
                          <span>Bruto: R$ {(withdrawalPreview.grossAmountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span>Líquido: R$ {(withdrawalPreview.netAmountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                    onClick={() => {
                      setIsContributionModalOpen(false);
                      setContributionError('');
                      setWithdrawalNetAmount('');
                      setWithdrawalOverrideDivergence(false);
                      setNeedsCompletedConfirmation(false);
                      setConfirmedCompletedContribution(false);
                    }}
                    className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
                  >
                    {contributionType === 'withdrawal' && withdrawalStage === 'pending_settlement'
                      ? 'Solicitar / Planejar'
                      : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {pendingDeleteGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white font-display">
              {pendingDeleteGoal.currentAmount > 0 ? 'Arquivar meta com saldo?' : 'Excluir rascunho de meta?'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {pendingDeleteGoal.currentAmount > 0
                ? `A meta "${pendingDeleteGoal.title}" possui R$ ${pendingDeleteGoal.currentAmount.toLocaleString('pt-BR')} guardados. Deseja arquivá-la para preservar o patrimônio do casal?`
                : `Tem certeza que deseja excluir o rascunho da meta "${pendingDeleteGoal.title}"?`}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteGoal(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingDeleteGoal}
                className={`flex-1 py-2.5 rounded-2xl text-white text-xs font-black shadow-md cursor-pointer ${
                  pendingDeleteGoal.currentAmount > 0
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {pendingDeleteGoal.currentAmount > 0 ? 'Arquivar Meta' : 'Excluir Rascunho'}
              </button>
            </div>
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

      {/* ========================================================================= */}
      {/* MODAL: WISHLIST MODAL (CRIAR / EDITAR DESEJO)                             */}
      {/* ========================================================================= */}
      {isWishlistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                {editingWishlist ? 'Editar Desejo' : 'Novo Desejo do Casal'}
              </h3>
              <button
                type="button"
                onClick={() => setIsWishlistModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWishlist} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  O que desejam conquistar?
                </label>
                <input
                  type="text"
                  required
                  value={wishlistForm.title}
                  onChange={(e) => setWishlistForm({ ...wishlistForm, title: e.target.value })}
                  placeholder="Ex: Cafeteira, Notebook, Sofá novo..."
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
                    value={wishlistForm.emoji}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, emoji: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={wishlistForm.estimatedPrice}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, estimatedPrice: e.target.value })}
                    placeholder="1500"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={wishlistForm.category}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, category: e.target.value as CategoryKey })}
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="lazer">Lazer</option>
                    <option value="moradia">Moradia</option>
                    <option value="transporte">Transporte</option>
                    <option value="comida">Comida</option>
                    <option value="protecao">Proteção</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Prioridade
                  </label>
                  <select
                    value={wishlistForm.priority}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, priority: e.target.value as 'alta' | 'media' | 'baixa' })}
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Quem sugeriu?
                </label>
                <select
                  value={wishlistForm.requestedBy}
                  onChange={(e) => setWishlistForm({ ...wishlistForm, requestedBy: e.target.value as 'partner1' | 'partner2' | 'both' })}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="both">Casal (Ambos)</option>
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWishlistModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {editingWishlist ? 'Salvar Desejo' : 'Adicionar Desejo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FIXED BILL MODAL (CRIAR / EDITAR CONTA FIXA)                       */}
      {/* ========================================================================= */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                {editingBill ? 'Editar Conta Fixa' : 'Nova Conta Fixa do Casal'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBillModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Nome da Conta Fixa
                </label>
                <input
                  type="text"
                  required
                  value={billForm.title}
                  onChange={(e) => setBillForm({ ...billForm, title: e.target.value })}
                  placeholder="Ex: Aluguel, Condomínio, Internet..."
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Valor Previsto (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={billForm.amount}
                    onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={billForm.dueDay}
                    onChange={(e) => setBillForm({ ...billForm, dueDay: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={billForm.category}
                    onChange={(e) => setBillForm({ ...billForm, category: e.target.value as CategoryKey })}
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="moradia">Moradia</option>
                    <option value="transporte">Transporte</option>
                    <option value="comida">Comida</option>
                    <option value="lazer">Lazer</option>
                    <option value="protecao">Proteção</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Responsável
                  </label>
                  <select
                    value={billForm.assignedPayer}
                    onChange={(e) => setBillForm({ ...billForm, assignedPayer: e.target.value as PaidBy })}
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="both">Casal (50/50)</option>
                    <option value="partner1">{p1Name}</option>
                    <option value="partner2">{p2Name}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={billForm.autoPay}
                  onChange={(e) => setBillForm({ ...billForm, autoPay: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Débito automático ativo</span>
              </label>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {editingBill ? 'Salvar Conta' : 'Criar Conta Fixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DREAM SIMULATION MODAL (CRIAR / EDITAR SONHO)                      */}
      {/* ========================================================================= */}
      {isDreamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-display">
                {editingDream ? 'Editar Simulação de Sonho' : 'Novo Sonho de Longo Prazo'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDreamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDream} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Nome do Sonho
                </label>
                <input
                  type="text"
                  required
                  value={dreamForm.title}
                  onChange={(e) => setDreamForm({ ...dreamForm, title: e.target.value })}
                  placeholder="Ex: Apartamento próprio, Ano sabático..."
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
                    value={dreamForm.emoji}
                    onChange={(e) => setDreamForm({ ...dreamForm, emoji: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Custo Total (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={dreamForm.totalCost}
                    onChange={(e) => setDreamForm({ ...dreamForm, totalCost: e.target.value })}
                    placeholder="450000"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Entrada Inicial (R$)
                  </label>
                  <input
                    type="text"
                    value={dreamForm.downPayment}
                    onChange={(e) => setDreamForm({ ...dreamForm, downPayment: e.target.value })}
                    placeholder="50000"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Aporte Mensal (R$)
                  </label>
                  <input
                    type="text"
                    value={dreamForm.monthlySavings}
                    onChange={(e) => setDreamForm({ ...dreamForm, monthlySavings: e.target.value })}
                    placeholder="2500"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDreamModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {editingDream ? 'Salvar Sonho' : 'Simular Sonho'}
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
