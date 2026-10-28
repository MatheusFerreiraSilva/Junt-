import React, { useState, useMemo } from 'react';
import {
  Users,
  Target,
  Gift,
  ShieldCheck,
  Flame,
  Sparkles,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  DollarSign,
  Heart,
  Trash2,
  Check,
  X,
  CreditCard,
  Zap,
  PieChart,
  ArrowRight,
  BookmarkCheck,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  CoupleGoal,
  CoupleWishlistItem,
  FixedBillAlert,
  DreamSimulation,
  CoupleFIREMetrics,
  CategoryKey,
  PaidBy,
  ExpenseItem,
  StrategicSpendingIntent,
  SavingsPiggyBank,
} from '../types/finance';

type SubTab = 'goals' | 'wishlist' | 'fire' | 'dreams' | 'bills' | 'profile';

export const CoupleHubScreen: React.FC = () => {
  const {
    state,
    updateCoupleHub,
    addPiggyBank,
    depositToGoal,
    depositToProtection,
    monthlyFixedExpensesAvg,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SubTab>('goals');

  // Modals state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [contributionType, setContributionType] = useState<'deposit' | 'withdrawal'>('deposit');

  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDreamModalOpen, setIsDreamModalOpen] = useState(false);
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const [selectedWishlistForIntent, setSelectedWishlistForIntent] = useState<CoupleWishlistItem | null>(null);

  // Form states
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
  });

  const [dreamForm, setDreamForm] = useState({
    title: '',
    emoji: '🏠',
    totalCost: '',
    downPayment: '',
    monthlySavings: '1500',
    expectedAnnualYieldPct: '8.5',
  });

  const [intentForm, setIntentForm] = useState({
    targetSource: 'piggy_bank' as 'month_budget' | 'piggy_bank' | 'reserve_excess' | 'personal_allowance',
    paymentMethod: 'pix' as 'pix' | 'debit' | 'credit' | 'cash',
    notes: '',
  });

  // Partner names
  const p1Name = state.profile.partner1Name || 'Pessoa 1';
  const p2Name = state.profile.partner2Name === 'Aguardando Par...' ? 'Pessoa 2' : state.profile.partner2Name || 'Pessoa 2';

  // =========================================================================
  // UNIFIED PIGGY BANKS & GOALS (Link entre Investimentos e Hub do Casal)
  // =========================================================================
  const goals: CoupleGoal[] = useMemo(() => {
    const piggyBanksList = state.piggyBanks || [];
    const coupleGoalsList = state.coupleGoals || [];

    // Map each SavingsPiggyBank from Investimentos into a CoupleGoal view
    const unifiedMap = new Map<string, CoupleGoal>();

    // First populate from coupleGoals
    coupleGoalsList.forEach((cg) => {
      unifiedMap.set(cg.id, cg);
    });

    // Merge or insert from piggyBanks
    piggyBanksList.forEach((pb) => {
      const existing = unifiedMap.get(pb.id);
      if (existing) {
        unifiedMap.set(pb.id, {
          ...existing,
          title: pb.name || existing.title,
          emoji: pb.emoji || existing.emoji,
          targetAmount: pb.targetAmount || existing.targetAmount,
          currentAmount: pb.currentAmount,
          monthlyPlannedDeposit: pb.monthlyDeposit || existing.monthlyPlannedDeposit,
          isCompleted: pb.completed || pb.currentAmount >= pb.targetAmount,
        });
      } else {
        // Create CoupleGoal entry for piggy banks created from Investimentos screen
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
        });
      }
    });

    return Array.from(unifiedMap.values());
  }, [state.piggyBanks, state.coupleGoals, p1Name, p2Name]);

  // Wishlist list
  const wishlist: CoupleWishlistItem[] = state.coupleWishlist || [];

  // Fixed Bills
  const fixedBills: FixedBillAlert[] = state.coupleFixedBills || [];

  // Dream Simulations
  const dreams: DreamSimulation[] = state.dreamSimulations || [];

  // =========================================================================
  // LINKED EMERGENCY RESERVE & FIRE METRICS
  // =========================================================================
  const fireMetrics: CoupleFIREMetrics = useMemo(() => {
    // Current total investments directly connected to Block 1 (protectionCurrentAmount), piggyBanks, and freedom
    const piggyTotal = state.piggyBanks.reduce((sum, p) => sum + p.currentAmount, 0);
    const goalsTotal = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const freedomTotal = state.freedomTotalInvested || 0;
    const protectionTotal = state.protectionCurrentAmount || 0; // Block 1 Emergency Reserve

    const currentNetWorth = Math.max(piggyTotal, goalsTotal) + freedomTotal + protectionTotal;

    // Monthly couple expenses average
    const totalExpensesThisMonth = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyCoupleExpenses =
      monthlyFixedExpensesAvg > 0
        ? monthlyFixedExpensesAvg
        : totalExpensesThisMonth > 0
        ? totalExpensesThisMonth
        : 0;

    // Reserve months coverage (Protection Reserve / Monthly Expenses)
    const emergencyReserveMonthsCurrent =
      monthlyCoupleExpenses > 0
        ? Number((protectionTotal / monthlyCoupleExpenses).toFixed(1))
        : 0;
    const emergencyReserveMonthsTarget = state.profile.emergencyReserveMonthsTarget || 6;

    // FIRE Rule of 300x
    const fireTargetNetWorth = monthlyCoupleExpenses * 300;
    const fireProgressPct = Math.min(100, (fireTargetNetWorth > 0 ? Math.round((currentNetWorth / fireTargetNetWorth) * 100) : 0));

    // Monthly investment pace
    const monthlyPlannedGoals = goals.reduce((sum, g) => sum + g.monthlyPlannedDeposit, 0);
    const monthlyInvestmentPace = monthlyPlannedGoals;

    // Years to FIRE
    const annualYield = (state.profile.expectedYieldAnnual || 6.5) / 100;
    const monthlyRate = annualYield / 12;
    let years = 0;

    if (currentNetWorth < fireTargetNetWorth && monthlyInvestmentPace > 0) {
      let simulatedBalance = currentNetWorth;
      let monthCounter = 0;
      while (simulatedBalance < fireTargetNetWorth && monthCounter < 600) {
        simulatedBalance = (simulatedBalance + monthlyInvestmentPace) * (1 + monthlyRate);
        monthCounter++;
      }
      years = Number((monthCounter / 12).toFixed(1));
    }

    return {
      currentNetWorth,
      monthlyCoupleExpenses,
      emergencyReserveMonthsCurrent,
      emergencyReserveMonthsTarget,
      fireTargetNetWorth,
      fireProgressPct,
      estimatedYearsToFIRE: years,
      monthlyInvestmentPace,
    };
  }, [state, goals, monthlyFixedExpensesAvg]);

  // Expense Comparison
  const expenseComparison = useMemo(() => {
    let p1Total = 0;
    let p2Total = 0;
    let sharedTotal = 0;

    state.expenses.forEach((e) => {
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
  }, [state.expenses]);

  // Handle Create Unified Goal
  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title || !goalForm.targetAmount) return;

    const targetVal = parseFloat(goalForm.targetAmount);
    const monthlyVal = parseFloat(goalForm.monthlyPlannedDeposit) || 0;

    // 1. Add to official piggyBanks list in Investimentos screen
    addPiggyBank({
      name: goalForm.title,
      emoji: goalForm.emoji || '🎯',
      purpose: `Meta do Casal: ${goalForm.category}`,
      targetAmount: targetVal,
      monthlyDeposit: monthlyVal,
      currentAmount: 0,
      completed: false,
    });

    // 2. Add to coupleGoals state with Partner Split details
    const newGoal: CoupleGoal = {
      id: `cg-${Date.now()}`,
      title: goalForm.title,
      category: goalForm.category,
      emoji: goalForm.emoji || '🎯',
      targetAmount: targetVal,
      currentAmount: 0,
      partner1Contribution: 0,
      partner2Contribution: 0,
      monthlyPlannedDeposit: monthlyVal,
      deadlineDate: goalForm.deadlineDate,
      isCompleted: false,
      history: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedGoals = [...goals, newGoal];
    updateCoupleHub({ coupleGoals: updatedGoals });
    setIsGoalModalOpen(false);
    setGoalForm({
      title: '',
      category: 'viagem',
      emoji: '✈️',
      targetAmount: '',
      monthlyPlannedDeposit: '',
      deadlineDate: '',
    });
  };

  // Handle Deposit/Withdrawal with Unified Piggy Bank Sync
  const handleContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !contributionForm.amount) return;

    const amount = parseFloat(contributionForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    const goal = goals.find((g) => g.id === selectedGoalId);
    if (!goal) return;

    const isDeposit = contributionType === 'deposit';
    const delta = isDeposit ? amount : -amount;

    // 1. Call depositToGoal in context to update Investimentos piggy bank state
    depositToGoal(selectedGoalId, delta);

    // 2. Update partner split history in coupleGoals
    let p1Add = 0;
    let p2Add = 0;
    const contributor = contributionForm.contributor;
    const contributorName =
      contributor === 'partner1' ? p1Name : contributor === 'partner2' ? p2Name : `${p1Name} & ${p2Name}`;

    if (contributor === 'partner1') p1Add = delta;
    else if (contributor === 'partner2') p2Add = delta;
    else {
      p1Add = delta / 2;
      p2Add = delta / 2;
    }

    const newHistItem = {
      id: `h-${Date.now()}`,
      contributor,
      contributorName,
      amount,
      date: new Date().toISOString().split('T')[0],
      type: contributionType,
      note: contributionForm.note,
    };

    const updatedGoals = goals.map((g) => {
      if (g.id === selectedGoalId) {
        const newCurrent = Math.max(0, g.currentAmount + delta);
        return {
          ...g,
          currentAmount: newCurrent,
          partner1Contribution: Math.max(0, g.partner1Contribution + p1Add),
          partner2Contribution: Math.max(0, g.partner2Contribution + p2Add),
          isCompleted: newCurrent >= g.targetAmount,
          history: [newHistItem, ...g.history],
        };
      }
      return g;
    });

    updateCoupleHub({ coupleGoals: updatedGoals });
    setIsContributionModalOpen(false);
    setSelectedGoalId(null);
    setContributionForm({ amount: '', contributor: 'both', note: '' });
  };

  // Create Wishlist Item
  const handleCreateWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistForm.title || !wishlistForm.estimatedPrice) return;

    const newItem: CoupleWishlistItem = {
      id: `cw-${Date.now()}`,
      title: wishlistForm.title,
      category: wishlistForm.category,
      emoji: wishlistForm.emoji || '🎁',
      estimatedPrice: parseFloat(wishlistForm.estimatedPrice),
      priority: wishlistForm.priority,
      requestedBy: wishlistForm.requestedBy,
      linkUrl: wishlistForm.linkUrl,
      notes: wishlistForm.notes,
      status: 'desejo',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [...wishlist, newItem];
    updateCoupleHub({ coupleWishlist: updated });
    setIsWishlistModalOpen(false);
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
  };

  // Convert Wishlist item to Goal in BOTH Investimentos and Hub do Casal
  const handleConvertWishToGoal = (item: CoupleWishlistItem) => {
    const targetPrice = item.estimatedPrice;

    // 1. Create in piggyBanks for Investimentos
    addPiggyBank({
      name: item.title,
      emoji: item.emoji,
      purpose: `Desejo do Casal convertido: ${item.notes || item.category}`,
      targetAmount: targetPrice,
      monthlyDeposit: Math.round(targetPrice / 6),
      currentAmount: 0,
      completed: false,
    });

    // 2. Create in coupleGoals for Hub do Casal
    const newGoal: CoupleGoal = {
      id: `cg-${Date.now()}`,
      title: item.title,
      category: item.category === 'moradia' ? 'reforma' : item.category === 'transporte' ? 'veiculo' : 'outro',
      emoji: item.emoji,
      targetAmount: targetPrice,
      currentAmount: 0,
      partner1Contribution: 0,
      partner2Contribution: 0,
      monthlyPlannedDeposit: Math.round(targetPrice / 6),
      isCompleted: false,
      history: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedGoals = [...goals, newGoal];
    const updatedWishlist = wishlist.map((w) =>
      w.id === item.id ? { ...w, status: 'convertido_meta' as const, convertedGoalId: newGoal.id } : w
    );

    updateCoupleHub({ coupleGoals: updatedGoals, coupleWishlist: updatedWishlist });
    setActiveTab('goals');
  };

  // Link Wishlist Item to Strategic Spending Intent
  const handleCreateStrategicIntentFromWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWishlistForIntent) return;

    const newIntent: StrategicSpendingIntent = {
      id: `ssi-${Date.now()}`,
      title: selectedWishlistForIntent.title,
      estimatedAmount: selectedWishlistForIntent.estimatedPrice,
      category: selectedWishlistForIntent.category,
      targetSource: intentForm.targetSource,
      assignedTo: 'couple',
      paymentMethod: intentForm.paymentMethod,
      status: 'pending',
      notes: intentForm.notes || `Vinculado da Wishlist (${selectedWishlistForIntent.notes || ''})`,
      createdAt: new Date().toISOString(),
    };

    const updatedIntents = [...(state.strategicIntents || []), newIntent];
    updateCoupleHub({ strategicIntents: updatedIntents });

    setIsIntentModalOpen(false);
    setSelectedWishlistForIntent(null);
  };

  // Delete Wishlist Item
  const handleDeleteWishlistItem = (id: string) => {
    const updated = wishlist.filter((w) => w.id !== id);
    updateCoupleHub({ coupleWishlist: updated });
  };

  // =========================================================================
  // TOGGLE BILL STATUS WITH AUTOMATIC EXPENSE CREATION IN EXTRATO
  // =========================================================================
  const handleToggleBillStatus = (id: string) => {
    const todayStr = new Date().toISOString().split('T')[0];

    const targetBill = fixedBills.find((b) => b.id === id);
    if (!targetBill) return;

    const isNowPaid = targetBill.status !== 'paid';

    const updatedBills = fixedBills.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          status: isNowPaid ? ('paid' as const) : ('pending' as const),
          lastPaidMonth: isNowPaid ? state.currentMonth : b.lastPaidMonth,
        };
      }
      return b;
    });

    let updatedExpenses = [...state.expenses];

    if (isNowPaid) {
      // Create automatic expense in transaction history (Extrato)
      const autoExpense: ExpenseItem = {
        id: `exp-fb-${Date.now()}`,
        description: `[Conta Fixa] ${targetBill.title}`,
        amount: targetBill.amount,
        category: targetBill.category,
        date: todayStr,
        paidBy: targetBill.assignedPayer === 'both' ? 'both' : targetBill.assignedPayer,
        notes: `Pagamento de conta fixa do mês (Vencimento dia ${targetBill.dueDay})`,
        fundingSource: 'month_budget',
        assignedTo: 'couple',
        paymentMethod: targetBill.autoPay ? 'debit' : 'pix',
      };
      updatedExpenses = [autoExpense, ...updatedExpenses];
    } else {
      // Remove or keep expenses
      updatedExpenses = updatedExpenses.filter((e) => !e.description.includes(targetBill.title));
    }

    updateCoupleHub({ coupleFixedBills: updatedBills, expenses: updatedExpenses });
  };

  // Create Bill
  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.title || !billForm.amount) return;

    const newBill: FixedBillAlert = {
      id: `fb-${Date.now()}`,
      title: billForm.title,
      category: billForm.category,
      amount: parseFloat(billForm.amount),
      dueDay: parseInt(billForm.dueDay) || 10,
      assignedPayer: billForm.assignedPayer,
      autoPay: billForm.autoPay,
      status: 'pending',
      isRecurring: true,
    };

    const updated = [...fixedBills, newBill];
    updateCoupleHub({ coupleFixedBills: updated });
    setIsBillModalOpen(false);
    setBillForm({
      title: '',
      category: 'moradia',
      amount: '',
      dueDay: '10',
      assignedPayer: 'both',
      autoPay: false,
    });
  };

  // Create Dream Simulation
  const handleCreateDream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dreamForm.title || !dreamForm.totalCost) return;

    const totalCost = parseFloat(dreamForm.totalCost);
    const downPayment = parseFloat(dreamForm.downPayment) || 0;
    const monthlySavings = parseFloat(dreamForm.monthlySavings) || 1000;
    const annualYield = parseFloat(dreamForm.expectedAnnualYieldPct) || 8.5;

    const remainingToSave = Math.max(0, totalCost - downPayment);
    const monthlyRate = annualYield / 100 / 12;
    let months = 0;
    if (monthlyRate > 0 && monthlySavings > 0) {
      months = Math.ceil(remainingToSave / (monthlySavings * (1 + monthlyRate / 2)));
    } else {
      months = Math.ceil(remainingToSave / monthlySavings);
    }

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + months);
    const completionYearMonth = futureDate.toISOString().substring(0, 7);

    const newDream: DreamSimulation = {
      id: `ds-${Date.now()}`,
      title: dreamForm.title,
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
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [...dreams, newDream];
    updateCoupleHub({ dreamSimulations: updated });
    setIsDreamModalOpen(false);
    setDreamForm({
      title: '',
      emoji: '🏠',
      totalCost: '',
      downPayment: '',
      monthlySavings: '1500',
      expectedAnnualYieldPct: '8.5',
    });
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
              <span>Hub do Casal — Ultimate Finances</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-display tracking-tight text-white">
              Sincronia Financeira: <span className="text-rose-400">{p1Name}</span> &amp;{' '}
              <span className="text-amber-300">{p2Name}</span>
            </h1>

            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Um lugar para cuidar das metas, combinar prioridades e planejar a próxima etapa de vocês.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 shrink-0">
            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Patrimônio do Casal
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                R$ {fireMetrics.currentNetWorth.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Meta FIRE 300x
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-300">
                {fireMetrics.fireProgressPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-NAVIGATION TAB BAR                                                    */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('goals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'goals'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Target className="w-4 h-4 text-emerald-400" />
          <span>Cofrinhos &amp; Metas Unificadas ({goals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'wishlist'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Gift className="w-4 h-4 text-rose-400" />
          <span>Lista de Desejos ({wishlist.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fire')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'fire'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>Reserva &amp; FIRE</span>
        </button>

        <button
          onClick={() => setActiveTab('dreams')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'dreams'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Simulador de Sonhos</span>
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'bills'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Clock className="w-4 h-4 text-sky-400" />
          <span>Alertas de Contas</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#111318] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <PieChart className="w-4 h-4 text-teal-400" />
          <span>Comparativo Ele x Ela</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COFRINHOS & METAS UNIFICADAS                                       */}
      {/* ========================================================================= */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Cofrinhos &amp; Metas Compartilhadas do Casal</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Sincronizado com Investimentos
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Caixinhas sincronizadas em tempo real com a aba Investimentos, detalhando os aportes de cada um ({p1Name} x {p2Name})
              </p>
            </div>

            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nova Meta do Casal</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {!goals.length && <div className="col-span-full py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center"><p className="text-base font-semibold text-slate-800 dark:text-slate-100">O próximo sonho pode começar pequeno.</p><p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">Crie uma meta com o valor e o prazo que fazem sentido para vocês.</p></div>}
            {goals.map((goal) => {
              const progressPct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const p1Pct = goal.currentAmount > 0 ? Math.round((goal.partner1Contribution / goal.currentAmount) * 100) : 50;
              const p2Pct = 100 - p1Pct;

              return (
                <div
                  key={goal.id}
                  className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-2xl shrink-0">
                        {goal.emoji}
                      </span>
                      <div>
                        <h3 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                          {goal.title}
                        </h3>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Meta: R$ {goal.targetAmount.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    {goal.isCompleted && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[10px] font-black uppercase flex items-center gap-1 border border-emerald-300 dark:border-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Concluído
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-300">
                        Acumulado: R$ {goal.currentAmount.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{progressPct}%</span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>Divisão de Aportes</span>
                      <span>{p1Name} ({p1Pct}%) | {p2Name} ({p2Pct}%)</span>
                    </div>

                    <div className="flex h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                      <div className="bg-rose-500 transition-all" style={{ width: `${p1Pct}%` }} title={`${p1Name}: R$ ${goal.partner1Contribution.toLocaleString('pt-BR')}`} />
                      <div className="bg-amber-400 transition-all" style={{ width: `${p2Pct}%` }} title={`${p2Name}: R$ ${goal.partner2Contribution.toLocaleString('pt-BR')}`} />
                    </div>

                    <div className="flex justify-between text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                      <span>{p1Name}: R$ {goal.partner1Contribution.toLocaleString('pt-BR')}</span>
                      <span>{p2Name}: R$ {goal.partner2Contribution.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedGoalId(goal.id);
                        setContributionType('deposit');
                        setIsContributionModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-[#B8E0B0]/40 dark:bg-emerald-950/60 hover:bg-[#B8E0B0]/70 text-[#111318] dark:text-emerald-200 border border-[#B8E0B0] dark:border-emerald-700 text-xs font-black transition-all cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>+ Guardar</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGoalId(goal.id);
                        setContributionType('withdrawal');
                        setIsContributionModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-[#FFC875]/30 dark:bg-amber-950/40 hover:bg-[#FFC875]/60 text-[#111318] dark:text-amber-200 border border-[#FFC875] dark:border-amber-700 text-xs font-black transition-all cursor-pointer"
                    >
                      <ArrowDownLeft className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <span>- Usar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LISTA DE DESEJOS (WISHLIST INTERATIVA & INTENÇÕES ESTRATÉGICAS)   */}
      {/* ========================================================================= */}
      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display">
                Wishlist do Casal — Lista de Desejos Interativa
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Guarde desejos, converta em metas de caixinha ou vincule a uma Intenção Estratégica de Gasto!
              </p>
            </div>

            <button
              onClick={() => setIsWishlistModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Adicionar Desejo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {!wishlist.length && <div className="col-span-full py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center"><p className="text-base font-semibold text-slate-800 dark:text-slate-100">O que vocês querem fazer acontecer?</p><p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">Anotem uma vontade e conversem sobre a prioridade antes da compra.</p></div>}
            {wishlist.map((item) => {
              const requesterLabel =
                item.requestedBy === 'partner1' ? p1Name : item.requestedBy === 'partner2' ? p2Name : 'Casal';

              const isConverted = item.status === 'convertido_meta';

              return (
                <div
                  key={item.id}
                  className={`clay-card p-5 bg-white dark:bg-slate-900 border rounded-3xl space-y-4 shadow-sm relative ${
                    isConverted
                      ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-2xl shrink-0">
                        {item.emoji}
                      </span>
                      <div>
                        <h3 className="font-black text-base text-[#111318] dark:text-white leading-snug">
                          {item.title}
                        </h3>
                        <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                          Preço Est.: R$ {item.estimatedPrice.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteWishlistItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Excluir da wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                      💡 {item.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs font-bold pt-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Pedido por: <strong className="text-slate-800 dark:text-slate-200">{requesterLabel}</strong>
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        item.priority === 'alta'
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                          : item.priority === 'media'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Prioridade {item.priority}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2">
                    {isConverted ? (
                      <div className="w-full py-2.5 px-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Já Transformado em Meta</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConvertWishToGoal(item)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-sm hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                      >
                        <Target className="w-4 h-4 text-amber-400" />
                        <span>Transformar em Meta do Casal</span>
                      </button>
                    )}

                    {/* Action to link to Strategic Intent */}
                    <button
                      onClick={() => {
                        setSelectedWishlistForIntent(item);
                        setIsIntentModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700 text-xs font-extrabold hover:bg-sky-100 transition-all cursor-pointer"
                    >
                      <BookmarkCheck className="w-4 h-4 text-sky-600" />
                      <span>Vincular Intenção Estratégica</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RESERVA & INDEPENDÊNCIA FINANCEIRA (LINKED REAL RESERVES)          */}
      {/* ========================================================================= */}
      {activeTab === 'fire' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
              <span>Reserva de Emergência &amp; Independência Financeira (FIRE)</span>
              <span className="text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 px-2 py-0.5 rounded-full font-black uppercase">
                Conectado ao Bloco 1
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Conectado diretamente ao valor real da Reserva do Bloco 1 (R$ {state.protectionCurrentAmount.toLocaleString('pt-BR')}) e Regra 300x
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Cobertura Real da Reserva */}
            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Reserva Bloco 1 Real</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {state.protectionCurrentAmount.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Cobertura: <strong className="text-emerald-600">{fireMetrics.emergencyReserveMonthsCurrent} Meses</strong> (Meta {fireMetrics.emergencyReserveMonthsTarget}M)
              </p>
            </div>

            {/* Card 2: Gastos Mensais Médios */}
            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Gasto Médio Mensal</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {fireMetrics.monthlyCoupleExpenses.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Custo de vida unificado do casal</p>
            </div>

            {/* Card 3: Meta FIRE (Patrimônio) */}
            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
                <Flame className="w-4 h-4" />
                <span>Patrimônio FIRE</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {fireMetrics.fireTargetNetWorth.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Hipótese ilustrativa: 300 meses do gasto registrado</p>
            </div>

            {/* Card 4: Tempo Estimado */}
            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-xs uppercase tracking-wider">
                <Zap className="w-4 h-4" />
                <span>Tempo para FIRE</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                {fireMetrics.monthlyCoupleExpenses > 0 && fireMetrics.monthlyInvestmentPace > 0 ? fireMetrics.estimatedYearsToFIRE + ' anos' : 'Faltam dados'}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Aportes planejados: R$ {fireMetrics.monthlyInvestmentPace.toLocaleString('pt-BR')}/mês
              </p>
            </div>
          </div>

          {/* Quick Action: Deposit to Protection Reserve */}
          <div className="clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-[#111318] dark:text-white font-display">
                  Aportar na Reserva de Emergência do Casal (Bloco 1)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  O aporte também aparece na reserva em Investimentos após a confirmação.
                </p>
              </div>

              <button
                onClick={() => depositToProtection(1000)}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-black shadow-sm hover:bg-emerald-700 transition-all cursor-pointer shrink-0"
              >
                + Aportar R$ 1.000 na Reserva
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">
                  Progresso Atual: R$ {fireMetrics.currentNetWorth.toLocaleString('pt-BR')} de R${' '}
                  {fireMetrics.fireTargetNetWorth.toLocaleString('pt-BR')}
                </span>
                <span className="text-amber-600 font-black">{fireMetrics.fireProgressPct}%</span>
              </div>

              <div className="w-full h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${fireMetrics.fireProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SIMULADOR DE SONHOS E COMPRAS DE GRANDE PORTE                      */}
      {/* ========================================================================= */}
      {activeTab === 'dreams' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display">
                Simulador de Sonhos &amp; Compras de Grande Porte
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Simule prazos, entradas e aportes mensais para comprar imóvel, carro ou realizar a viagem dos sonhos
              </p>
            </div>

            <button
              onClick={() => setIsDreamModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Simular Novo Sonho</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!dreams.length && <div className="col-span-full py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center"><p className="text-base font-semibold text-slate-800 dark:text-slate-100">Ainda há espaço para novos planos.</p><p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">Simule um objetivo com seus próprios valores, sem alterar o orçamento.</p></div>}
            {dreams.map((dream) => {
              const years = Number((dream.monthsToAchieve / 12).toFixed(1));

              return (
                <div
                  key={dream.id}
                  className="clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-2xl shrink-0">
                      {dream.emoji}
                    </span>
                    <div>
                      <h3 className="font-black text-lg text-[#111318] dark:text-white font-display">
                        {dream.title}
                      </h3>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        Custo Total: R$ {dream.totalCost.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Entrada Inicial</span>
                      <span className="text-sm font-black text-[#111318] dark:text-white">
                        R$ {dream.downPayment.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Aporte Mensal</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        R$ {dream.monthlySavings.toLocaleString('pt-BR')}/mês
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Prazo Estimado</span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                        {dream.monthsToAchieve} meses (~{years} anos)
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Previsão Conclusão</span>
                      <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                        {dream.estimatedCompletionDate}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ALERTAS DE VENCIMENTO DE FATURAS (AUTO-EXPENSE LAUNCH)              */}
      {/* ========================================================================= */}
      {activeTab === 'bills' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#111318] dark:text-white font-display flex items-center gap-2">
                <span>Alertas de Vencimento de Contas Fixas</span>
                <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded-full font-black uppercase">
                  Integração com Extrato
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Marcar uma conta como paga registra automaticamente uma despesa no Extrato e atualiza os gastos do mês!
              </p>
            </div>

            <button
              onClick={() => setIsBillModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Adicionar Conta Fixa</span>
            </button>
          </div>

          <div className="clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {!fixedBills.length && <div className="col-span-full py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center"><p className="text-base font-semibold text-slate-800 dark:text-slate-100">Nenhuma conta fixa registrada.</p><p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">Cadastrem os vencimentos para dividir as responsabilidades do mês.</p></div>}
            {fixedBills.map((bill) => {
                const isPaid = bill.status === 'paid';
                const payerLabel =
                  bill.assignedPayer === 'partner1'
                    ? p1Name
                    : bill.assignedPayer === 'partner2'
                    ? p2Name
                    : 'Casal (50/50)';

                return (
                  <div key={bill.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleBillStatus(bill.id)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                          isPaid
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent hover:border-emerald-500'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div>
                        <h4 className={`font-black text-sm ${isPaid ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#111318] dark:text-white'}`}>
                          {bill.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Vence todo dia {bill.dueDay}</span>
                          <span>•</span>
                          <span>Responsável: <strong className="text-slate-800 dark:text-slate-200">{payerLabel}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="font-black text-sm text-[#111318] dark:text-white block">
                          R$ {bill.amount.toLocaleString('pt-BR')}
                        </span>
                        {bill.autoPay && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                            Débito Automático
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleBillStatus(bill.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          isPaid
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-emerald-500 text-white shadow-xs hover:bg-emerald-600'
                        }`}
                      >
                        {isPaid ? 'Marcar Pendente' : 'Marcar Pago ➔ Lançar no Extrato'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: COMPARATIVO DO PERFIL DE GASTOS ELE X ELA                          */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-black text-[#111318] dark:text-white font-display">
              Comparativo de Perfil de Gastos: {p1Name} x {p2Name}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Transparência total sem julgamentos: entenda para onde vai o dinheiro individual e comum
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-rose-600 dark:text-rose-400">👩 {p1Name}</span>
                <span className="text-xs font-extrabold text-slate-500">{expenseComparison.p1Pct}% dos gastos</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {expenseComparison.p1Total.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Gastos atribuídos individualmente</p>
            </div>

            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-teal-600 dark:text-teal-400">👥 Gastos Comuns do Casal</span>
                <span className="text-xs font-extrabold text-slate-500">{expenseComparison.sharedPct}% dos gastos</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {expenseComparison.sharedTotal.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Contas compartilhadas e moradia</p>
            </div>

            <div className="clay-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-amber-600 dark:text-amber-400">👨 {p2Name}</span>
                <span className="text-xs font-extrabold text-slate-500">{expenseComparison.p2Pct}% dos gastos</span>
              </div>
              <div className="text-2xl font-black text-[#111318] dark:text-white">
                R$ {expenseComparison.p2Total.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Gastos atribuídos individualmente</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VINCULAR INTENÇÃO ESTRATÉGICA DE GASTO DA WISHLIST                 */}
      {/* ========================================================================= */}
      {isIntentModalOpen && selectedWishlistForIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-[#111318] dark:text-white font-display">
                Vincular Intenção Estratégica
              </h3>
              <button
                onClick={() => {
                  setIsIntentModalOpen(false);
                  setSelectedWishlistForIntent(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200">
              <strong>Item:</strong> {selectedWishlistForIntent.emoji} {selectedWishlistForIntent.title} (R${' '}
              {selectedWishlistForIntent.estimatedPrice.toLocaleString('pt-BR')})
            </div>

            <form onSubmit={handleCreateStrategicIntentFromWishlist} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Fonte de Financiamento Alvo
                </label>
                <select
                  value={intentForm.targetSource}
                  onChange={(e) => setIntentForm({ ...intentForm, targetSource: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                >
                  <option value="piggy_bank">Caixinha / Cofrinho de Objetivo</option>
                  <option value="reserve_excess">Excesso da Reserva de Emergência (&gt; 6 meses)</option>
                  <option value="month_budget">Orçamento do Mês (Rotina da Casa)</option>
                  <option value="personal_allowance">Mesada Individual</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Forma de Pagamento Planejada
                </label>
                <select
                  value={intentForm.paymentMethod}
                  onChange={(e) => setIntentForm({ ...intentForm, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                >
                  <option value="pix">Pix (com desconto à vista)</option>
                  <option value="credit">Cartão de Crédito</option>
                  <option value="debit">Débito</option>
                  <option value="cash">Dinheiro</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Notas Adicionais
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aguardar promoção da Black Friday"
                  value={intentForm.notes}
                  onChange={(e) => setIntentForm({ ...intentForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Salvar Intenção Estratégica
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA META COMPARTILHADA                                            */}
      {/* ========================================================================= */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-[#111318] dark:text-white font-display">
                Criar Meta do Casal
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome da Meta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Viagem para o Japão"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={goalForm.emoji}
                    onChange={(e) => setGoalForm({ ...goalForm, emoji: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="25000"
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Aporte Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1500"
                    value={goalForm.monthlyPlannedDeposit}
                    onChange={(e) => setGoalForm({ ...goalForm, monthlyPlannedDeposit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Salvar Meta Unificada
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GUARDAR / USAR DINHEIRO NA META                                    */}
      {/* ========================================================================= */}
      {isContributionModalOpen && selectedGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-[#111318] dark:text-white font-display">
                {contributionType === 'deposit' ? 'Guardar no Cofrinho' : 'Usar Valor do Cofrinho'}
              </h3>
              <button
                onClick={() => setIsContributionModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContribution} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="1000.00"
                  value={contributionForm.amount}
                  onChange={(e) => setContributionForm({ ...contributionForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Quem está guardando / usando?
                </label>
                <select
                  value={contributionForm.contributor}
                  onChange={(e) => setContributionForm({ ...contributionForm, contributor: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                >
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                  <option value="both">Ambos (Casal 50/50)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Nota / Origem (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sobra do plantão médico"
                  value={contributionForm.note}
                  onChange={(e) => setContributionForm({ ...contributionForm, note: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO ITEM DA WISHLIST                                             */}
      {/* ========================================================================= */}
      {isWishlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-[#111318] dark:text-white font-display">
                Adicionar à Wishlist do Casal
              </h3>
              <button
                onClick={() => setIsWishlistModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWishlist} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Item / Desejo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Robô Aspirador Inteligente"
                  value={wishlistForm.title}
                  onChange={(e) => setWishlistForm({ ...wishlistForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Preço Estimado (R$)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="3200"
                    value={wishlistForm.estimatedPrice}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, estimatedPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Prioridade
                  </label>
                  <select
                    value={wishlistForm.priority}
                    onChange={(e) => setWishlistForm({ ...wishlistForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Quem pediu?
                </label>
                <select
                  value={wishlistForm.requestedBy}
                  onChange={(e) => setWishlistForm({ ...wishlistForm, requestedBy: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                >
                  <option value="both">Casal</option>
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Observações / Por que queremos?
                </label>
                <input
                  type="text"
                  placeholder="Ex: Economiza tempo de limpeza pós plantão"
                  value={wishlistForm.notes}
                  onChange={(e) => setWishlistForm({ ...wishlistForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Salvar Desejo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA CONTA FIXA / ALERTA DE VENCIMENTO                             */}
      {/* ========================================================================= */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-[#111318] dark:text-white font-display">
                Cadastrar Conta Fixa do Mês
              </h3>
              <button
                onClick={() => setIsBillModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome da Conta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel do Apê"
                  value={billForm.title}
                  onChange={(e) => setBillForm({ ...billForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="4200"
                    value={billForm.amount}
                    onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Dia de Vencimento
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={billForm.dueDay}
                    onChange={(e) => setBillForm({ ...billForm, dueDay: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Pagador Designado
                </label>
                <select
                  value={billForm.assignedPayer}
                  onChange={(e) => setBillForm({ ...billForm, assignedPayer: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                >
                  <option value="both">Ambos (Casal 50/50)</option>
                  <option value="partner1">{p1Name}</option>
                  <option value="partner2">{p2Name}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoPayCheckbox"
                  checked={billForm.autoPay}
                  onChange={(e) => setBillForm({ ...billForm, autoPay: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="autoPayCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Em Débito Automático
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Salvar Conta Fixa
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO SIMULADOR DE SONHO                                            */}
      {/* ========================================================================= */}
      {isDreamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md clay-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-[#111318] dark:text-white font-display">
                Simular Compra de Grande Porte / Sonho
              </h3>
              <button
                onClick={() => setIsDreamModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDream} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Título do Sonho
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reforma do Apartamento"
                  value={dreamForm.title}
                  onChange={(e) => setDreamForm({ ...dreamForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Custo Total (R$)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="120000"
                    value={dreamForm.totalCost}
                    onChange={(e) => setDreamForm({ ...dreamForm, totalCost: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    Entrada (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="20000"
                    value={dreamForm.downPayment}
                    onChange={(e) => setDreamForm({ ...dreamForm, downPayment: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Aporte Mensal do Casal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="3000"
                  value={dreamForm.monthlySavings}
                  onChange={(e) => setDreamForm({ ...dreamForm, monthlySavings: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#111318] dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#111318] text-white text-xs font-black shadow-md hover:bg-slate-800 transition-all cursor-pointer"
              >
                Simular Sonho
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
