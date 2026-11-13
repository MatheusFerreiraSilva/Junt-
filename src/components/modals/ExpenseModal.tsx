import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  User,
  Shield,
  Scissors,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Store,
  Tag,
  DollarSign,
  Percent,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import {
  ExpenseItem,
  CategoryKey,
  PaidBy,
  FoodPillarType,
  FundingSourceType,
  TransactionSplit,
  SplitLineType,
  ExpenseNature,
  ExpensePriority,
  PolicyMacroGroup,
} from '../../types/finance';
import {
  validateTransactionSplits,
  apportionSplitsByPercentage,
  apportionDiscountOrFreight,
  roundMoney,
} from '../../utils/domainSelectors';
import { formatCurrency } from '../../utils/formatters';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CategoryKey;
  defaultDate?: string;
  expenseToEdit?: ExpenseItem | null;
  defaultDivided?: boolean;
}

export interface SplitDraftItem {
  id: string;
  label: string;
  category: CategoryKey;
  subcategory?: string;
  amount: string; // R$ string
  percentage: number; // %
  nature: ExpenseNature;
  priority: ExpensePriority;
  policyMacroGroup: PolicyMacroGroup;
  lineType: SplitLineType;
  targetDate?: string;
  isPostponable?: boolean;
}

const createDefaultSplit = (
  cat: CategoryKey = 'comida',
  label: string = '',
  amountStr: string = ''
): SplitDraftItem => ({
  id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label,
  category: cat,
  amount: amountStr,
  percentage: 50,
  nature: 'variavel',
  priority: 'essencial',
  policyMacroGroup: 'variaveis',
  lineType: 'item',
});

const QUICK_SUGGESTIONS: Array<{
  label: string;
  category: CategoryKey;
  nature: ExpenseNature;
  priority: ExpensePriority;
}> = [
  { label: 'Higiene', category: 'protecao', nature: 'variavel', priority: 'essencial' },
  { label: 'Saúde', category: 'protecao', nature: 'variavel', priority: 'essencial' },
  { label: 'Limpeza', category: 'moradia', nature: 'variavel', priority: 'essencial' },
  { label: 'Utensílios', category: 'moradia', nature: 'eventual', priority: 'importante' },
  { label: 'Alimentação', category: 'comida', nature: 'variavel', priority: 'essencial' },
  { label: 'Hortifruti', category: 'comida', nature: 'variavel', priority: 'essencial' },
  { label: 'Carnes & Açougue', category: 'comida', nature: 'variavel', priority: 'essencial' },
  { label: 'Lazer & Petiscos', category: 'lazer', nature: 'eventual', priority: 'dispensavel' },
  { label: 'Farmácia & Remédios', category: 'protecao', nature: 'variavel', priority: 'essencial' },
  { label: 'Uso Profissional', category: 'profissional', nature: 'variavel', priority: 'essencial' },
  { label: 'Frete', category: 'comida', nature: 'variavel', priority: 'essencial' },
  { label: 'Desconto', category: 'comida', nature: 'variavel', priority: 'essencial' },
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  defaultCategory,
  defaultDate,
  expenseToEdit,
  defaultDivided = false,
}) => {
  const {
    state,
    currentUser,
    emergencyReserveExcessAmount,
    categoriesSpending,
    addExpense,
    editExpense,
    addInstallment,
    triggerCelebration,
  } = useFinance();

  const [step, setStep] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<CategoryKey>(defaultCategory || 'comida');
  const [description, setDescription] = useState<string>('');
  const [store, setStore] = useState<string>('');
  const [foodPillar, setFoodPillar] = useState<FoodPillarType>('estrutural');
  const [paidBy, setPaidBy] = useState<PaidBy>('both');
  const [assignedTo, setAssignedTo] = useState<'couple' | 'partner1' | 'partner2'>('couple');
  const [splitPartner1Pct, setSplitPartner1Pct] = useState<number>(50);
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [fundingSource, setFundingSource] = useState<FundingSourceType>('month_budget');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'debit' | 'credit' | 'cash'>('pix');
  const activePiggyBanks = useMemo(
    () =>
      state.piggyBanks.filter(
        (g) => (!g.archived && !g.isDeleted) || g.id === expenseToEdit?.fundingGoalId
      ),
    [state.piggyBanks, expenseToEdit?.fundingGoalId]
  );

  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    () => state.piggyBanks.find((g) => !g.archived && !g.isDeleted)?.id || ''
  );
  const [successCelebration, setSuccessCelebration] = useState(false);
  const [validationError, setValidationError] = useState('');

  // 28B: Compra única com divisão por finalidade
  const [isDivided, setIsDivided] = useState<boolean>(Boolean(defaultDivided));
  const [splitMode, setSplitMode] = useState<'amount' | 'percentage'>('amount');
  const [splits, setSplits] = useState<SplitDraftItem[]>([
    createDefaultSplit('comida', 'Alimentação'),
    createDefaultSplit('moradia', 'Limpeza & Casa'),
  ]);

  const userDraftKey = `expense_modal_draft_${currentUser?.uid || 'guest'}`;

  // Hydration effect for expenseToEdit or user private draft
  useEffect(() => {
    if (!isOpen) return;

    if (expenseToEdit) {
      setAmount(expenseToEdit.amount.toString());
      setCategory(expenseToEdit.category || defaultCategory || 'comida');
      setDescription(expenseToEdit.description || '');
      setStore(expenseToEdit.store || '');
      setFoodPillar(expenseToEdit.foodPillar || 'estrutural');
      setPaidBy(expenseToEdit.paidBy || 'both');
      setAssignedTo(expenseToEdit.assignedTo === 'casal' ? 'couple' : (expenseToEdit.assignedTo || 'couple'));
      setSplitPartner1Pct(expenseToEdit.splitPartner1Pct ?? 50);
      setFundingSource(expenseToEdit.fundingSource || 'month_budget');
      const firstActiveGoalId =
        state.piggyBanks.find((g) => (!g.archived && !g.isDeleted) || g.id === expenseToEdit.fundingGoalId)?.id || '';
      setSelectedGoalId(expenseToEdit.fundingGoalId || firstActiveGoalId);
      setPaymentMethod(expenseToEdit.paymentMethod || 'pix');
      setIsInstallment(false);
      setValidationError('');

      if (expenseToEdit.splits && expenseToEdit.splits.length > 0) {
        setIsDivided(true);
        setSplits(
          expenseToEdit.splits.map((s) => ({
            id: s.id,
            label: s.label || s.notes || s.subcategory || '',
            category: s.category,
            subcategory: s.subcategory,
            amount: s.amountCents ? (s.amountCents / 100).toFixed(2) : (s.amount || 0).toString(),
            percentage: s.percentage || Math.round(((s.amount || 0) / expenseToEdit.amount) * 100) || 50,
            nature: s.nature || 'variavel',
            priority: s.priority || 'essencial',
            policyMacroGroup: s.policyMacroGroup || 'variaveis',
            lineType: s.lineType || 'item',
            targetDate: s.targetDate,
            isPostponable: s.isPostponable,
          }))
        );
      } else {
        setIsDivided(false);
      }
    } else {
      const savedDraft = localStorage.getItem(userDraftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.amount) setAmount(parsed.amount);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.store) setStore(parsed.store);
          if (parsed.category) setCategory(parsed.category);
          if (parsed.paidBy) setPaidBy(parsed.paidBy);
          if (parsed.assignedTo) setAssignedTo(parsed.assignedTo);
          if (parsed.fundingSource) setFundingSource(parsed.fundingSource);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          if (typeof parsed.isDivided === 'boolean') setIsDivided(parsed.isDivided);
          if (Array.isArray(parsed.splits) && parsed.splits.length > 0) {
            setSplits(parsed.splits);
          }
        } catch (_) {
          // Ignore corrupted draft
        }
      }
      if (defaultDivided) {
        setIsDivided(true);
      }
    }
  }, [isOpen, expenseToEdit, defaultCategory, state.piggyBanks, userDraftKey, defaultDivided]);

  // Debounced saver for private user draft
  useEffect(() => {
    if (!isOpen || expenseToEdit) return;
    if (amount || description || store || (isDivided && splits.length > 0)) {
      const draft = {
        amount,
        description,
        store,
        category,
        paidBy,
        assignedTo,
        fundingSource,
        paymentMethod,
        isDivided,
        splits,
      };
      localStorage.setItem(userDraftKey, JSON.stringify(draft));
    }
  }, [
    isOpen,
    expenseToEdit,
    amount,
    description,
    store,
    category,
    paidBy,
    assignedTo,
    fundingSource,
    paymentMethod,
    isDivided,
    splits,
    userDraftKey,
  ]);

  const dialogRef = useDialogFocus(isOpen, onClose);

  const totalIncome = state.profile.partner1Income + state.profile.partner2Income;
  const partner1IncomePct = totalIncome > 0 ? Math.round((state.profile.partner1Income / totalIncome) * 100) : 50;
  const currentParsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const totalCents = Math.round(currentParsedAmount * 100);

  // Reconciliation calculations for splits
  const splitReconciliation = useMemo(() => {
    let allocatedCents = 0;
    splits.forEach((s) => {
      const val = parseFloat(s.amount.replace(',', '.')) || 0;
      const c = Math.round(val * 100);
      if (s.lineType === 'discount') {
        allocatedCents -= c;
      } else {
        allocatedCents += c;
      }
    });

    const discrepancyCents = totalCents - allocatedCents;
    const isExact = totalCents > 0 && discrepancyCents === 0;

    return {
      allocatedCents,
      allocatedAmount: allocatedCents / 100,
      discrepancyCents,
      remainingAmount: discrepancyCents / 100,
      isExact,
    };
  }, [splits, totalCents]);

  // Category impact calculation for preview
  const categoryImpactPreview = useMemo(() => {
    const map: Record<CategoryKey, number> = {
      moradia: 0,
      transporte: 0,
      comida: 0,
      lazer: 0,
      protecao: 0,
      profissional: 0,
    };

    if (isDivided) {
      splits.forEach((s) => {
        const val = parseFloat(s.amount.replace(',', '.')) || 0;
        if (s.lineType === 'discount') {
          map[s.category] = Math.max(0, map[s.category] - val);
        } else {
          map[s.category] = (map[s.category] || 0) + val;
        }
      });
    } else {
      map[category] = currentParsedAmount;
    }

    const rows = (Object.keys(map) as CategoryKey[])
      .filter((k) => map[k] > 0)
      .map((catKey) => {
        const allocatedAmount = roundMoney(map[catKey]);
        const budget = categoriesSpending?.[catKey]?.budget || 0;
        const currentSpent = categoriesSpending?.[catKey]?.spent || 0;
        const newTotalSpent = roundMoney(currentSpent + allocatedAmount);
        const remainingAfter = roundMoney(budget - newTotalSpent);
        const isOverCeiling = newTotalSpent > budget && budget > 0;
        const overAmount = isOverCeiling ? roundMoney(newTotalSpent - budget) : 0;

        return {
          catKey,
          allocatedAmount,
          budget,
          currentSpent,
          newTotalSpent,
          remainingAfter,
          isOverCeiling,
          overAmount,
        };
      });

    const hasAnyOverCeiling = rows.some((r) => r.isOverCeiling);

    return {
      rows,
      hasAnyOverCeiling,
    };
  }, [isDivided, splits, category, currentParsedAmount, categoriesSpending]);

  if (!isOpen) return null;

  const quickAmounts = [15, 30, 50, 100, 200, 500];

  const quickDescriptions: Record<CategoryKey, string[]> = {
    moradia: ['Conta de Luz', 'Internet', 'Condomínio', 'Gás', 'Mercado Casa', 'Reparo'],
    transporte: ['Combustível / Posto', 'Uber / 99', 'IPVA & Licenciamento', 'Seguro Auto', 'Sem Parar / Pedágio', 'Oficina / Revisão', 'Estacionamento'],
    comida: [
      'Grande Mercado (Abastecimento)',
      'Hortifruti & Feira',
      'Açougue & Carnes',
      'Almoço Dia a Dia / Quilo',
      'Refeição de Plantão',
      'Delivery / iFood',
      'Cafeteria & Padaria',
    ],
    lazer: ['Cinema & Pipoca', 'Passeio', 'Streaming', 'Jogos', 'Roupas', 'Viagem'],
    protecao: ['Farmácia', 'Consulta Médica', 'Plano de Saúde', 'Seguro de Vida', 'Dentista'],
    profissional: ['Livro Técnico', 'Curso / Workshop', 'Software / Ferramenta', 'Equipamento'],
  };

  const handleQuickAddAmount = (add: number) => {
    const current = parseFloat(amount.replace(',', '.')) || 0;
    setAmount((current + add).toString());
  };

  const handleSelectQuickTag = (tag: string) => {
    setDescription(tag);
    if (category === 'comida') {
      const u = tag.toUpperCase();
      if (u.includes('MERCADO') || u.includes('FEIRA') || u.includes('AÇOUGUE') || u.includes('ABASTECIMENTO')) {
        setFoodPillar('estrutural');
      } else if (u.includes('DELIVERY') || u.includes('IFOOD')) {
        setFoodPillar('conveniencia');
      } else {
        setFoodPillar('rotina');
      }
    }
  };

  // Split management helpers
  const handleAddSplit = () => {
    setSplits((prev) => [...prev, createDefaultSplit('comida', '')]);
  };

  const handleRemoveSplit = (id: string) => {
    if (splits.length <= 1) return;
    setSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSplit = (id: string, patch: Partial<SplitDraftItem>) => {
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...patch };
        if (patch.nature) {
          updated.policyMacroGroup = patch.nature === 'fixa' ? 'fixos' : 'variaveis';
        }
        return updated;
      })
    );
  };

  const handleApplySplitPercentage = () => {
    if (currentParsedAmount <= 0) return;
    const apportioned = apportionSplitsByPercentage(currentParsedAmount, splits);
    setSplits(
      apportioned.map((item) => ({
        ...item,
        amount: (item.amountCents / 100).toFixed(2),
      }))
    );
    setSplitMode('amount');
  };

  const handleDivideEqually = () => {
    if (splits.length === 0 || currentParsedAmount <= 0) return;
    const equalPct = Math.round(100 / splits.length);
    const updated = splits.map((s) => ({ ...s, percentage: equalPct }));
    const apportioned = apportionSplitsByPercentage(currentParsedAmount, updated);
    setSplits(
      apportioned.map((item) => ({
        ...item,
        amount: (item.amountCents / 100).toFixed(2),
      }))
    );
    setSplitMode('amount');
  };

  const handleAdjustRemainderToLast = () => {
    if (splits.length === 0 || splitReconciliation.discrepancyCents === 0) return;
    setSplits((prev) => {
      const last = prev[prev.length - 1];
      const curCents = Math.round((parseFloat(last.amount.replace(',', '.')) || 0) * 100);
      const nextCents = curCents + splitReconciliation.discrepancyCents;
      if (nextCents < 0) return prev;
      return [
        ...prev.slice(0, prev.length - 1),
        { ...last, amount: (nextCents / 100).toFixed(2) },
      ];
    });
  };

  const handleApplyQuickSuggestionToSplit = (
    splitId: string,
    sugg: (typeof QUICK_SUGGESTIONS)[number]
  ) => {
    handleUpdateSplit(splitId, {
      label: sugg.label,
      category: sugg.category,
      nature: sugg.nature,
      priority: sugg.priority,
      policyMacroGroup: sugg.nature === 'fixa' ? 'fixos' : 'variaveis',
      lineType: sugg.label === 'Frete' ? 'freight' : sugg.label === 'Desconto' ? 'discount' : 'item',
    });
  };

  const handleNext = () => {
    if (step === 1) {
      const val = parseFloat(amount.replace(',', '.'));
      if (!Number.isFinite(val) || val <= 0 || val > 10000000) {
        setValidationError('Informe um valor entre R$ 0,01 e R$ 10.000.000.');
        return;
      }
      setValidationError('');
      setStep(2);
    } else if (step === 2) {
      if (isDivided) {
        if (!splitReconciliation.isExact) {
          setValidationError(
            `A soma das partes difere do total em R$ ${Math.abs(splitReconciliation.remainingAmount).toFixed(2)}. Ajuste antes de avançar.`
          );
          return;
        }
      }
      setValidationError('');
      setStep(3);
    } else if (step === 3) {
      if (!isDivided && !description.trim()) {
        setDescription(CATEGORIES_BASE[category].name);
      }
      setValidationError('');
      setStep(4);
    } else if (step === 4) {
      setValidationError('');
      setStep(5);
    } else if (step === 5) {
      if (isInstallment && !isDivided) {
        setStep(6);
      } else {
        handleSave();
      }
    } else if (step === 6) {
      handleSave();
    }
  };

  const handleSave = () => {
    const numAmount = Math.round(Number(amount.replace(',', '.')) * 100) / 100;
    if (
      !Number.isFinite(numAmount) ||
      numAmount <= 0 ||
      !Number.isFinite(splitPartner1Pct) ||
      splitPartner1Pct < 0 ||
      splitPartner1Pct > 100 ||
      (isInstallment && (!Number.isInteger(installmentsCount) || installmentsCount < 2 || installmentsCount > 120))
    ) {
      setValidationError('Confira o valor, a divisão e a quantidade de parcelas.');
      return;
    }

    const finalDesc = description.trim() || store.trim() || CATEGORIES_BASE[category].name;
    const today =
      defaultDate ||
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(new Date(today + 'T12:00:00').getTime())) {
      setValidationError('Informe uma data válida.');
      return;
    }

    const p1Pct =
      paidBy === 'partner1'
        ? 100
        : paidBy === 'partner2'
        ? 0
        : paidBy === 'both'
        ? 50
        : splitPartner1Pct;
    const p2Pct = 100 - p1Pct;

    let validatedSplits: TransactionSplit[] | undefined = undefined;
    if (isDivided) {
      const draftSplits: TransactionSplit[] = splits.map((s, idx) => {
        const lineVal = parseFloat(s.amount.replace(',', '.')) || 0;
        const lineCents = Math.round(lineVal * 100);
        return {
          id: s.id || `split-${idx}`,
          amount: lineCents / 100,
          amountCents: lineCents,
          category: s.category,
          subcategory: s.subcategory || s.label,
          label: s.label || CATEGORIES_BASE[s.category]?.name,
          nature: s.nature,
          priority: s.priority,
          policyMacroGroup: s.policyMacroGroup,
          classificationOrigin: 'manual_confirmed',
          fundingSource: 'month_budget',
          lineType: s.lineType,
          targetDate: s.targetDate,
          isPostponable: s.isPostponable,
        };
      });

      const validation = validateTransactionSplits(numAmount, draftSplits);
      if (!validation.isValid) {
        setValidationError(
          validation.error || 'A soma das divisões deve ser exatamente igual ao total da compra.'
        );
        return;
      }
      validatedSplits = draftSplits;
    }

    const shouldBeInstallment =
      !isDivided && (isInstallment || (paymentMethod === 'credit' && installmentsCount > 1));

    try {
      const targetGoal = activePiggyBanks.find((g) => g.id === selectedGoalId);
      const amountCents = Math.round(numAmount * 100);

      if (expenseToEdit) {
        editExpense(expenseToEdit.id, {
          description: finalDesc,
          store: store.trim() || undefined,
          amount: numAmount,
          amountCents,
          category: isDivided && validatedSplits && validatedSplits[0] ? validatedSplits[0].category : category,
          splits: validatedSplits,
          date: today,
          paidBy,
          assignedTo,
          splitPartner1Pct: p1Pct,
          splitPartner2Pct: p2Pct,
          foodPillar: !isDivided && category === 'comida' ? foodPillar : undefined,
          fundingSource: isDivided ? 'month_budget' : fundingSource,
          fundingGoalId: !isDivided && fundingSource === 'piggy_bank' ? (selectedGoalId || undefined) : undefined,
          fundingGoalName: !isDivided && fundingSource === 'piggy_bank' ? targetGoal?.name : undefined,
          paymentMethod,
          isExcludedFromMonthlyBudget: !isDivided && fundingSource !== 'month_budget',
        });
      } else if (shouldBeInstallment) {
        const count = Math.max(2, installmentsCount);
        const installmentVal = +(numAmount / count).toFixed(2);
        addInstallment({
          title: finalDesc,
          category,
          totalAmount: numAmount,
          installmentsCount: count,
          installmentAmount: installmentVal,
          purchaseDate: today,
          startMonth: today ? today.slice(0, 7) : state.currentMonth,
          paidBy,
          splitPartner1Pct: p1Pct,
          splitPartner2Pct: p2Pct,
        });
      } else {
        addExpense({
          description: finalDesc,
          store: store.trim() || undefined,
          amount: numAmount,
          amountCents,
          category: isDivided && validatedSplits && validatedSplits[0] ? validatedSplits[0].category : category,
          splits: validatedSplits,
          date: today,
          paidBy,
          assignedTo,
          splitPartner1Pct: p1Pct,
          splitPartner2Pct: p2Pct,
          foodPillar: !isDivided && category === 'comida' ? foodPillar : undefined,
          fundingSource: isDivided ? 'month_budget' : fundingSource,
          fundingGoalId: !isDivided && fundingSource === 'piggy_bank' ? (selectedGoalId || undefined) : undefined,
          fundingGoalName: !isDivided && fundingSource === 'piggy_bank' ? targetGoal?.name : undefined,
          paymentMethod,
          isExcludedFromMonthlyBudget: !isDivided && fundingSource !== 'month_budget',
        });
      }

      localStorage.removeItem(userDraftKey);
      setSuccessCelebration(true);
      triggerCelebration();

      setTimeout(() => {
        setSuccessCelebration(false);
        setStep(1);
        setAmount('');
        setDescription('');
        setStore('');
        setIsInstallment(false);
        setIsDivided(false);
        setValidationError('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setValidationError(err.message || 'Erro ao salvar despesa.');
    }
  };

  const handleClose = () => {
    localStorage.removeItem(userDraftKey);
    setStep(1);
    setAmount('');
    setDescription('');
    setStore('');
    setIsInstallment(false);
    setIsDivided(false);
    setValidationError('');
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Registrar gasto"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl btn-primary-accent text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
              {expenseToEdit ? '✏️' : isDivided ? '✂️' : '➕'}
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                {expenseToEdit
                  ? isDivided
                    ? 'Editar Compra Dividida'
                    : 'Editar Gasto'
                  : isDivided
                  ? 'Compra com Divisão por Finalidade'
                  : 'Registrar Gasto'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Passo {step} de {isInstallment && !isDivided && step >= 5 ? '6' : '5'}
                {isDivided && ' · Grupos de Destino'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {validationError && (
          <p
            role="alert"
            className="mx-6 mt-4 p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 font-semibold"
          >
            {validationError}
          </p>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col justify-start">
          {successCelebration ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-surface text-accent-primary flex items-center justify-center mb-4 scale-110 transition-transform">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">
                Gasto Registrado!
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-xs">
                {isDivided
                  ? `Compra de ${formatCurrency(currentParsedAmount)} classificada em ${splits.length} grupos com soma exata!`
                  : isInstallment
                  ? `Parcelamento de ${installmentsCount}x de ${formatCurrency(currentParsedAmount / installmentsCount)} adicionado ao orçamento!`
                  : `${formatCurrency(currentParsedAmount)} registrado em ${CATEGORIES_BASE[category].name}.`}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold bg-accent-surface text-accent-themed px-3.5 py-1.5 rounded-full border border-accent-themed">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                Registrado em menos de 10 segundos
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* STEP 1: QUANTO VOCÊS GASTARAM E OPÇÃO DE DIVISÃO               */}
              {/* ============================================================== */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 1
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      Quanto vocês gastaram?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor total da compra confirmado no extrato / cupom fiscal
                    </p>
                  </div>

                  <div className="relative max-w-xs mx-auto w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-4 py-3.5 text-3xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:border-accent-primary focus:outline-none tabular-nums"
                    />
                  </div>

                  {/* 28B: TOGGLE DESTACADO PARA COMPRAS DE MERCADO / MÚLTIPLAS FINALIDADES */}
                  <div className="max-w-md mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => setIsDivided(!isDivided)}
                      className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer shadow-xs ${
                        isDivided
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50 shadow-md ring-2 ring-purple-500/20'
                          : 'border-purple-200 dark:border-purple-900/60 hover:border-purple-400 bg-purple-50/40 dark:bg-purple-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                            isDivided
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          ✂️
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                              Dividir compra por finalidade
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-600 text-white shadow-2xs">
                              Mercado / Lojas
                            </span>
                          </div>
                          <span className="text-[11px] text-purple-800 dark:text-purple-300 block mt-0.5 font-medium truncate">
                            Separa Comida, Limpeza, Farmácia, Lazer em 1 único débito
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isDivided
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isDivided && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  </div>

                  {/* Estabelecimento / Loja opcional */}
                  <div className="max-w-md mx-auto w-full space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-400" />
                      <span>Estabelecimento / Loja (Opcional):</span>
                    </label>
                    <input
                      type="text"
                      value={store}
                      onChange={(e) => setStore(e.target.value)}
                      placeholder="Ex: Pão de Açúcar, Atacadão, Droga Raia, Carrefour..."
                      className="w-full px-3.5 py-2 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-primary focus:outline-none"
                    />
                  </div>

                  {/* Quick incremental buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {quickAmounts.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddAmount(val)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        +{formatCurrency(val)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 2 (DIVIDIDO): GERENCIAMENTO DOS GRUPOS E FECHAMENTO      */}
              {/* ============================================================== */}
              {step === 2 && isDivided && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Passo 2 · Divisão
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 font-display">
                      Classifique as partes da compra
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Total:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatCurrency(currentParsedAmount)}
                      </strong>{' '}
                      ({totalCents} centavos)
                    </p>
                  </div>

                  {/* Mode Selector and Quick Actions */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setSplitMode('amount')}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                          splitMode === 'amount'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        Valores (R$)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode('percentage')}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                          splitMode === 'percentage'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Percent className="w-3 h-3 inline mr-1" />
                        Percentual (%)
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDivideEqually}
                        className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-[11px] hover:bg-purple-100 transition-colors"
                      >
                        ✂️ Dividir Igual (%)
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSplit}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Parte
                      </button>
                    </div>
                  </div>

                  {/* Suggestion tags bar */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sugestões para categorização rápida:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {QUICK_SUGGESTIONS.map((sugg) => (
                        <button
                          key={sugg.label}
                          type="button"
                          onClick={() => {
                            if (splits.length > 0) {
                              handleApplyQuickSuggestionToSplit(splits[splits.length - 1].id, sugg);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 transition-colors"
                        >
                          {sugg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Splits List */}
                  <div className="space-y-2.5 max-h-[36vh] overflow-y-auto pr-1">
                    {splits.map((s, idx) => {
                      const splitVal = parseFloat(s.amount.replace(',', '.')) || 0;
                      return (
                        <div
                          key={s.id}
                          className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                              {idx + 1}
                            </span>

                            {/* Label */}
                            <input
                              type="text"
                              value={s.label}
                              onChange={(e) => handleUpdateSplit(s.id, { label: e.target.value })}
                              placeholder="Ex: Alimentação, Limpeza, Farmácia..."
                              className="flex-1 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                            />

                            {/* Remove button */}
                            {splits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSplit(s.id)}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                                aria-label="Remover parte"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            {/* Category selector */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Categoria
                              </label>
                              <select
                                value={s.category}
                                onChange={(e) =>
                                  handleUpdateSplit(s.id, { category: e.target.value as CategoryKey })
                                }
                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-xs"
                              >
                                {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map((k) => (
                                  <option key={k} value={k}>
                                    {CATEGORIES_BASE[k].emoji} {CATEGORIES_BASE[k].name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Nature selector */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Natureza
                              </label>
                              <select
                                value={s.nature}
                                onChange={(e) =>
                                  handleUpdateSplit(s.id, { nature: e.target.value as ExpenseNature })
                                }
                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-white text-xs"
                              >
                                <option value="variavel">Variável</option>
                                <option value="fixa">Fixa</option>
                                <option value="eventual">Eventual</option>
                              </select>
                            </div>

                            {/* Priority selector */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Prioridade
                              </label>
                              <select
                                value={s.priority}
                                onChange={(e) =>
                                  handleUpdateSplit(s.id, { priority: e.target.value as ExpensePriority })
                                }
                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-white text-xs"
                              >
                                <option value="essencial">Essencial</option>
                                <option value="importante">Importante</option>
                                <option value="dispensavel">Dispensável</option>
                              </select>
                            </div>

                            {/* Amount or Percentage Input */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                {splitMode === 'percentage' ? 'Fatia (%)' : 'Valor (R$)'}
                              </label>
                              {splitMode === 'percentage' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={s.percentage}
                                    onChange={(e) => {
                                      const p = parseFloat(e.target.value) || 0;
                                      handleUpdateSplit(s.id, { percentage: p });
                                    }}
                                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-xs tabular-nums text-right"
                                  />
                                  <span className="text-slate-400 text-xs font-bold">%</span>
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={s.amount}
                                  onChange={(e) => handleUpdateSplit(s.id, { amount: e.target.value })}
                                  placeholder="0,00"
                                  className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-xs tabular-nums text-right"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {splitMode === 'percentage' && (
                    <button
                      type="button"
                      onClick={handleApplySplitPercentage}
                      className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      Converter % em Centavos Exatos (Hare-Niemeyer)
                    </button>
                  )}

                  {/* Fechamento de centavos / Balanço */}
                  <div
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                      splitReconciliation.isExact
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {splitReconciliation.isExact ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-bold block truncate">
                          {splitReconciliation.isExact
                            ? 'Soma das partes confere exatamente com o total'
                            : `Faltam alocar R$ ${Math.abs(splitReconciliation.remainingAmount).toFixed(2)}`}
                        </span>
                        <span className="text-[10px] opacity-80">
                          Alocado: {formatCurrency(splitReconciliation.allocatedAmount)} de{' '}
                          {formatCurrency(currentParsedAmount)}
                        </span>
                      </div>
                    </div>

                    {!splitReconciliation.isExact && splits.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAdjustRemainderToLast}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 shrink-0 transition-colors"
                      >
                        Zerar Diferença
                      </button>
                    )}
                  </div>

                  {/* Prévia de Impacto no Orçamento por Categoria */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Impacto nos Tetos do Mês
                    </span>
                    <div className="space-y-1">
                      {categoryImpactPreview.rows.map((r) => (
                        <div key={r.catKey} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span>{CATEGORIES_BASE[r.catKey].emoji}</span>
                            <span>{CATEGORIES_BASE[r.catKey].name}</span>
                            <span className="font-bold">+{formatCurrency(r.allocatedAmount)}</span>
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              r.isOverCeiling
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {r.isOverCeiling
                              ? `Estouro de ${formatCurrency(r.overAmount)}`
                              : `Resta ${formatCurrency(r.remainingAfter)}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {categoryImpactPreview.hasAnyOverCeiling && (
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px] text-amber-700 dark:text-amber-300">
                        ⚠️ <strong>Aviso de Limite:</strong> Uma ou mais categorias ultrapassarão o teto planejado. O registro reflete a realidade da compra e não será bloqueado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 2 (SIMPLES): EM QUAL DAS 5 ÁREAS DA VIDA?                */}
              {/* ============================================================== */}
              {step === 2 && !isDivided && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 2
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      Em qual área da vida?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatCurrency(currentParsedAmount)}
                      </strong>
                    </p>
                  </div>

                  {/* Atalho destacado para compras de mercado ou mistas */}
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-800 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-xs">
                        ✂️
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-purple-950 dark:text-purple-100 block">
                          Comprou itens de mais de uma área no mesmo cupom?
                        </span>
                        <span className="text-[11px] text-purple-800 dark:text-purple-300 block font-medium truncate">
                          Ex: Mercado com Comida + Limpeza + Farmácia
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDivided(true)}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shrink-0 transition-colors shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      Dividir agora ✂️
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map((key) => {
                      const item = CATEGORIES_BASE[key];
                      const isSelected = category === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCategory(key)}
                          className={`p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                            isSelected
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <span className="text-2xl p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0">
                            {item.emoji}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 3: DESCRIÇÃO E DETALHES (OU TITULARIDADE SE DIVIDIDO)    */}
              {/* ============================================================== */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 3
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      {isDivided ? 'Quem pagou e a quem pertence?' : 'Com o que vocês gastaram?'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {isDivided
                        ? `Compra de ${formatCurrency(currentParsedAmount)} no ${store || 'estabelecimento'}`
                        : `${CATEGORIES_BASE[category].emoji} Área: ${CATEGORIES_BASE[category].name}`}
                    </p>
                  </div>

                  {!isDivided ? (
                    <div className="space-y-4 max-w-sm mx-auto w-full">
                      <input
                        type="text"
                        autoFocus
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Supermercado, Almoço, Curso..."
                        className="w-full px-4 py-3 text-base text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-accent-primary focus:outline-none"
                      />

                      {/* Seletor dos 3 Pilares de Comida & Conveniência */}
                      {category === 'comida' && (
                        <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-sky-950 dark:text-sky-300 block text-center">
                            Pilar da Alimentação do Casal:
                          </span>
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => setFoodPillar('estrutural')}
                              className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                foodPillar === 'estrutural'
                                  ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="block text-base">🛒</span>
                              <span className="text-[10px] block mt-0.5 leading-tight font-black">
                                Abastecimento
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFoodPillar('rotina')}
                              className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                foodPillar === 'rotina'
                                  ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="block text-base">🍲</span>
                              <span className="text-[10px] block mt-0.5 leading-tight font-black">
                                Rotina & Plantão
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFoodPillar('conveniencia')}
                              className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                foodPillar === 'conveniencia'
                                  ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="block text-base">🛵</span>
                              <span className="text-[10px] block mt-0.5 leading-tight font-black">
                                Delivery & Lanche
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2 text-center">
                          Sugestões rápidas
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {quickDescriptions[category].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleSelectQuickTag(tag)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                description === tag
                                  ? 'btn-primary-accent text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Para compra dividida: seleção de pagador e titularidade */
                    <div className="space-y-4 max-w-md mx-auto w-full">
                      {/* Titularidade / Beneficiário (C19) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Titularidade da Compra (C19)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'couple', label: 'Do Casal', emoji: '🤝' },
                            { key: 'partner1', label: `Só ${state.profile.partner1Name}`, emoji: '👤' },
                            { key: 'partner2', label: `Só ${state.profile.partner2Name}`, emoji: '👤' },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setAssignedTo(item.key as any)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                assignedTo === item.key
                                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 font-bold text-purple-950 dark:text-purple-200'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <span className="block text-sm">{item.emoji}</span>
                              <span className="text-[11px] block mt-0.5 truncate">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pagador */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Quem efetuou o pagamento no caixa?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaidBy('both');
                              setSplitPartner1Pct(50);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              paidBy === 'both'
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 font-bold'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              Conta Conjunta / 50-50
                            </span>
                            <span className="text-[10px] text-slate-500">Divisão do casal</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaidBy('partner1')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              paidBy === 'partner1'
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 font-bold'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                              Só {state.profile.partner1Name}
                            </span>
                            <span className="text-[10px] text-slate-500">Cartão / Pix P1</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaidBy('partner2')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              paidBy === 'partner2'
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 font-bold'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                              Só {state.profile.partner2Name}
                            </span>
                            <span className="text-[10px] text-slate-500">Cartão / Pix P2</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaidBy('custom')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              paidBy === 'custom'
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 font-bold'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              Personalizado (%)
                            </span>
                            <span className="text-[10px] text-slate-500">Proporcional</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 4: QUEM PAGOU (SIMPLES) OU FORMA DE PAGAMENTO (DIVIDIDO)  */}
              {/* ============================================================== */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 4
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      {isDivided ? 'Forma de Pagamento' : 'Quem pagou o gasto?'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor total:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatCurrency(currentParsedAmount)}
                      </strong>
                    </p>
                  </div>

                  {!isDivided ? (
                    <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setPaidBy('both');
                          setSplitPartner1Pct(50);
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                          paidBy === 'both'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">🤝</span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            Casal (50/50)
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-800 dark:text-purple-300 font-semibold">
                          {formatCurrency(currentParsedAmount / 2)} para cada
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaidBy('custom')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                          paidBy === 'custom'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">⚖️</span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            Porcentagem (%)
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                          {splitPartner1Pct}% / {100 - splitPartner1Pct}%
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaidBy('partner1')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                          paidBy === 'partner1'
                            ? 'border-accent-primary bg-accent-surface shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-full btn-primary-accent text-white flex items-center justify-center font-bold text-xs">
                            {state.profile.partner1Name[0]}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            Só {state.profile.partner1Name}
                          </span>
                        </div>
                        <p className="text-[11px] text-accent-themed font-semibold">100% individual</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaidBy('partner2')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                          paidBy === 'partner2'
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            {state.profile.partner2Name[0]}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            Só {state.profile.partner2Name}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
                          100% individual
                        </p>
                      </button>
                    </div>
                  ) : (
                    /* Forma de Pagamento e Meio para compra dividida */
                    <div className="max-w-md mx-auto w-full space-y-4">
                      <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                        {[
                          { key: 'pix', label: 'Pix', emoji: '⚡' },
                          { key: 'debit', label: 'Débito', emoji: '💳' },
                          { key: 'credit', label: 'Crédito', emoji: '📦' },
                          { key: 'cash', label: 'Dinheiro', emoji: '💵' },
                        ].map((pm) => (
                          <button
                            key={pm.key}
                            type="button"
                            onClick={() => setPaymentMethod(pm.key as any)}
                            className={`py-3 px-1 rounded-2xl border text-center transition-all cursor-pointer ${
                              paymentMethod === pm.key
                                ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="block text-base">{pm.emoji}</span>
                            <span className="text-[11px] mt-1 block">{pm.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-950 dark:text-purple-200">
                        🛡️ <strong>Lançamento Único:</strong> O débito total de{' '}
                        {formatCurrency(currentParsedAmount)} entra como uma única saída bancária. Cada
                        uma das {splits.length} fatias impactará apenas o teto de sua respectiva categoria.
                      </div>
                    </div>
                  )}

                  {!isDivided && paidBy === 'custom' && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 max-w-md mx-auto w-full">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
                        <span>
                          {state.profile.partner1Name}: {splitPartner1Pct}% (
                          {formatCurrency((currentParsedAmount * splitPartner1Pct) / 100)})
                        </span>
                        <span>
                          {state.profile.partner2Name}: {100 - splitPartner1Pct}% (
                          {formatCurrency((currentParsedAmount * (100 - splitPartner1Pct)) / 100)})
                        </span>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="99"
                        value={splitPartner1Pct}
                        onChange={(e) => setSplitPartner1Pct(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-600"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 5: PARCELADO / FONTE (OU REVISÃO SE DIVIDIDO)             */}
              {/* ============================================================== */}
              {step === 5 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 5
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      {isDivided ? 'Revisão da Compra Dividida' : 'Essa compra foi parcelada?'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {isDivided
                        ? 'Confira o fechamento de centavos e a alocação por categoria antes de salvar'
                        : 'Se foi parcelada, o app já calcula as fatias dos próximos meses'}
                    </p>
                  </div>

                  {!isDivided ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full">
                        <button
                          type="button"
                          onClick={() => setIsInstallment(false)}
                          className={`p-5 rounded-2xl border-2 text-center transition-all ${
                            !isInstallment
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-3xl block mb-2">💵</span>
                          <div className="font-bold text-slate-900 dark:text-white">Não, à vista</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Cobrado apenas neste mês
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsInstallment(true)}
                          className={`p-5 rounded-2xl border-2 text-center transition-all ${
                            isInstallment
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-3xl block mb-2">📦</span>
                          <div className="font-bold text-slate-900 dark:text-white">Sim, parcelado</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Dividido no cartão
                          </div>
                        </button>
                      </div>

                      {/* Seletor de fonte simples */}
                      {!isInstallment && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                          <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                            De onde sai o dinheiro deste gasto?
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setFundingSource('month_budget');
                                setValidationError('');
                              }}
                              className={`p-3 rounded-2xl border text-left ${
                                fundingSource === 'month_budget'
                                  ? 'border-[#111318] dark:border-white bg-[#FFF9ED] dark:bg-amber-950/40 font-bold'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span className="text-sm block">📅 Orçamento do Mês</span>
                              <span className="text-[10px] text-slate-500 block">Rotina normal</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFundingSource('reserve_excess');
                                setValidationError('');
                              }}
                              className={`p-3 rounded-2xl border text-left ${
                                fundingSource === 'reserve_excess'
                                  ? 'border-[#111318] dark:border-white bg-[#F0F8FF] dark:bg-sky-950/40 font-bold'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span className="text-sm block">🛡️ Excesso da Reserva</span>
                              <span className="text-[10px] text-sky-700 dark:text-sky-300 block">
                                {formatCurrency(emergencyReserveExcessAmount)} livres
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFundingSource('piggy_bank');
                                if (!selectedGoalId && activePiggyBanks[0]) {
                                  setSelectedGoalId(activePiggyBanks[0].id);
                                }
                                setValidationError('');
                              }}
                              className={`p-3 rounded-2xl border text-left ${
                                fundingSource === 'piggy_bank'
                                  ? 'border-[#111318] dark:border-white bg-[#FFF0F7] dark:bg-pink-950/40 font-bold'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span className="text-sm block">🎯 Caixinha de Objetivo</span>
                              <span className="text-[10px] text-pink-700 dark:text-pink-300 block">
                                Cofrinho guardado
                              </span>
                            </button>
                          </div>

                          {fundingSource === 'piggy_bank' && (
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                              <label
                                htmlFor="expense-modal-piggy-select"
                                className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block"
                              >
                                Qual caixinha paga esta compra?
                              </label>
                              {activePiggyBanks.length === 0 ? (
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  Nenhuma caixinha ativa cadastrada ainda.
                                </p>
                              ) : (
                                <select
                                  id="expense-modal-piggy-select"
                                  value={selectedGoalId}
                                  onChange={(e) => {
                                    setSelectedGoalId(e.target.value);
                                    if (validationError) setValidationError('');
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                                >
                                  <option value="">Selecione uma caixinha...</option>
                                  {activePiggyBanks.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.emoji} {g.name} (Saldo: {formatCurrency(g.currentAmount)})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Revisão da compra dividida */
                    <div className="max-w-md mx-auto w-full space-y-3 text-xs">
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between font-bold">
                          <span>Total da Compra</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(currentParsedAmount)}
                          </span>
                        </div>
                        {store && (
                          <div className="text-[11px] text-slate-500">
                            Loja / Local: <strong>{store}</strong>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Fatias Classificadas ({splits.length}):
                          </span>
                          {splits.map((s, idx) => (
                            <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span>{CATEGORIES_BASE[s.category]?.emoji}</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {s.label || CATEGORIES_BASE[s.category]?.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {s.nature}
                                </span>
                              </span>
                              <span className="font-black text-slate-900 dark:text-white tabular-nums">
                                {formatCurrency(parseFloat(s.amount.replace(',', '.')) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Pronto para registrar! Um único débito bancário e soma exata em centavos.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 6 (OPCIONAL): PARCELAMENTO EM QUANTAS VEZES               */}
              {/* ============================================================== */}
              {step === 6 && !isDivided && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">
                      Passo 6
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      Em quantas vezes?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor total: {formatCurrency(currentParsedAmount)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-md mx-auto w-full">
                    {[2, 3, 4, 5, 6, 8, 10, 12].map((count) => {
                      const perMonth = currentParsedAmount / count;
                      const isSelected = installmentsCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setInstallmentsCount(count)}
                          className={`p-3 rounded-2xl border-2 text-center transition-all ${
                            isSelected
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="text-base font-extrabold text-slate-900 dark:text-white">
                            {count}x
                          </div>
                          <div className="text-xs text-accent-themed font-semibold tabular-nums mt-0.5">
                            {formatCurrency(perMonth)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!successCelebration && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && (!amount || parseFloat(amount.replace(',', '.')) <= 0)}
              className="btn-primary-accent flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-black/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            >
              {step === (isInstallment && !isDivided ? 6 : 5) ? (
                <>
                  <Check className="w-4 h-4" />
                  {expenseToEdit ? 'Salvar Alterações' : 'Concluir Gasto'}
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
