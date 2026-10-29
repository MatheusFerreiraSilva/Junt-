import { installmentInMonth } from '../utils/installmentMoney';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { applyShiftAllocation, undoShiftAllocations, migrateLegacyShiftAllocations } from '../utils/shiftReconciliation';
import { authenticatedApi } from '../lib/authenticatedApi';
import { ENTITY_FIELDS, migrateEntities, subscribeEntities, saveEntities, rebaseEntities, conflictAwareBaseline, type EntityState } from '../lib/entitySync';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  AppState,
  BankImportedTransaction,
  CategoryKey,
  CategoryInfo,
  DestinationKey,
  BudgetPlanContract,
  ExpenseItem,
  IncomeItem,
  InstallmentPurchase,
  SavingsPiggyBank,
  CoupleProfile,
  PaidBy,
  LinkedBankAccount,
  SpendingAlertRule,
  AppNotification,
  MonthTrendRecord,
  AccentTheme,
  UserAuthProfile,
  CoupleAccountData,
  PluggyBankConnection,
  CategoryKeywordRule,
  DetectedSubscription,
  FiscalProfile,
  IncomeSourceClassification,
  IncomeSourceRule,
  PendingIncomeConfirmation,
  LifeTierInfo,
  LifeTierKey,
  SurplusTransferRecord,
  MonthlyDepositItem,
  MonthlyDepositGuide,
  MonthDepositCompletionRecord,
  AdvanceInstallmentPayload,
  FoodPacingMetrics,
  AIPredictiveInsight,
  FoodPillarType,
  FundingSourceType,
  StrategicSpendingIntent,
  PushNotificationSettings,
  MedicalShift,
  MedicalShiftPreset,
  HospitalIncomeMappingRule,
} from '../types/finance';
import {
  DEFAULT_PUSH_SETTINGS,
  checkAndTriggerScheduledPushNotifications,
} from '../utils/pushNotificationEngine';
import {
  DEFAULT_SHIFT_PRESETS,
  DEFAULT_HOSPITAL_MAPPING_RULES,
  getSampleMedicalShifts,
} from '../utils/shiftsEngine';
import {
  LIFE_TIERS,
  getLifeTier,
  calculateTierProgress,
  calculateNetLiquidFromGross,
  calculateBonusShift50_50,
  calculateDynamicCombinedNetIncome,
  isInternalTransfer,
  DEFAULT_MEDICAL_SOURCE_RULES,
} from '../utils/incomeTiersEngine';
import { getNextMonth, addMonths, formatCurrency, formatMonthYear } from '../utils/formatters';
import {
  DEFAULT_KEYWORD_RULES,
  categorizeTransaction,
  detectRecurringSubscriptions,
} from '../utils/categorizationEngine';
import {
  getCurrentMonthlyReviewSchedule,
  triggerBrowserPushNotification,
  requestPushNotificationPermission,
} from '../utils/monthlyReviewNotifications';
import {
  detectDuplicateExpenses,
  calculateCoupleSettlement,
  calculatePredictiveBurnRates,
  DuplicateGroup,
  CoupleSettlementSummary,
  PredictiveBurnAlert,
} from '../utils/coupleReconciliation';
import { calculateFoodPacingMetrics } from '../utils/foodPacingEngine';
import { generateAIPredictiveInsights } from '../utils/aiPredictiveInsightsEngine';

export const CATEGORIES_BASE: Record<CategoryKey, { name: string; emoji: string; description: string; colorHex: string; bgLight: string; borderHex: string }> = {
  moradia: {
    name: 'Moradia',
    emoji: '🏠',
    description: 'Aluguel, condomínio, luz, água, internet e casa',
    colorHex: '#0D9488', // Teal
    bgLight: '#F0FDFA',
    borderHex: '#99F6E4',
  },
  comida: {
    name: 'Comida & Conveniência',
    emoji: '🍽️',
    description: 'Compras estruturais de mercado, alimentação de rotina/plantão e delivery',
    colorHex: '#0284C7', // Sky blue
    bgLight: '#F0F9FF',
    borderHex: '#BAE6FD',
  },
  lazer: {
    name: 'Lazer',
    emoji: '🎮',
    description: 'Cinema, viagens, saídas, videogame e passeios',
    colorHex: '#8B5CF6', // Purple/Violet
    bgLight: '#F5F3FF',
    borderHex: '#DDD6FE',
  },
  protecao: {
    name: 'Proteção',
    emoji: '🛡️',
    description: 'Seguros, saúde, farmácia e imprevistos',
    colorHex: '#E11D48', // Rose
    bgLight: '#FFF1F2',
    borderHex: '#FECDD3',
  },
  profissional: {
    name: 'Profissional',
    emoji: '📚',
    description: 'Cursos, congressos, CRM, plantões e equipamentos',
    colorHex: '#D97706', // Amber
    bgLight: '#FFFBEB',
    borderHex: '#FDE68A',
  },
  transporte: {
    name: 'Transporte & Mobilidade',
    emoji: '🚗',
    description: 'Combustível, IPVA, licenciamento, seguro auto, manutenção, Uber/99, pedágios e estacionamentos',
    colorHex: '#0284C7', // Sky Blue / Ciano
    bgLight: '#F0F9FF',
    borderHex: '#BAE6FD',
  },
};

export const getCategoryInfo = (catKey: string | undefined): CategoryInfo => {
  if (catKey && (catKey in CATEGORIES_BASE)) {
    return {
      key: catKey as CategoryKey,
      ...CATEGORIES_BASE[catKey as CategoryKey],
      isLegacy: false,
    };
  }
  return {
    key: catKey || 'outros',
    name: catKey ? `${catKey.charAt(0).toUpperCase() + catKey.slice(1)} (Revisar)` : 'Outros / A Categorizar',
    emoji: '🏷️',
    description: 'Categoria não mapeada no padrão canônico — recomendada revisão ou reclassificação.',
    colorHex: '#64748B',
    bgLight: '#F8FAFC',
    borderHex: '#CBD5E1',
    isLegacy: true,
  };
};

export const ACCENT_THEMES: Record<
  AccentTheme,
  {
    label: string;
    hex: string;
    hoverHex: string;
    lightHex: string;
    textHex: string;
    borderHex: string;
    darkSurface: string;
    darkText: string;
    darkBorder: string;
    gradientFrom: string;
    gradientTo: string;
  }
> = {
  emerald: {
    label: 'Esmeralda Médico',
    hex: '#059669',
    hoverHex: '#047857',
    lightHex: '#ecfdf5',
    textHex: '#047857',
    borderHex: '#a7f3d0',
    darkSurface: 'rgba(5, 150, 105, 0.16)',
    darkText: '#34d399',
    darkBorder: 'rgba(52, 211, 153, 0.35)',
    gradientFrom: '#065f46',
    gradientTo: '#115e59',
  },
  sapphire: {
    label: 'Azul Safira',
    hex: '#0284c7',
    hoverHex: '#0369a1',
    lightHex: '#f0f9ff',
    textHex: '#0369a1',
    borderHex: '#bae6fd',
    darkSurface: 'rgba(2, 132, 199, 0.16)',
    darkText: '#38bdf8',
    darkBorder: 'rgba(56, 189, 248, 0.35)',
    gradientFrom: '#075985',
    gradientTo: '#1e40af',
  },
  violet: {
    label: 'Roxo Ametista',
    hex: '#9333ea',
    hoverHex: '#7e22ce',
    lightHex: '#faf5ff',
    textHex: '#7e22ce',
    borderHex: '#e9d5ff',
    darkSurface: 'rgba(147, 51, 234, 0.16)',
    darkText: '#c084fc',
    darkBorder: 'rgba(192, 132, 252, 0.35)',
    gradientFrom: '#6b21a8',
    gradientTo: '#4c1d95',
  },
  rose: {
    label: 'Rosa Rubi',
    hex: '#e11d48',
    hoverHex: '#be123c',
    lightHex: '#fff1f2',
    textHex: '#be123c',
    borderHex: '#fecdd3',
    darkSurface: 'rgba(225, 29, 72, 0.16)',
    darkText: '#fb7185',
    darkBorder: 'rgba(251, 113, 133, 0.35)',
    gradientFrom: '#9f1239',
    gradientTo: '#881337',
  },
  amber: {
    label: 'Âmbar Ouro',
    hex: '#d97706',
    hoverHex: '#b45309',
    lightHex: '#fffbeb',
    textHex: '#b45309',
    borderHex: '#fde68a',
    darkSurface: 'rgba(217, 119, 6, 0.16)',
    darkText: '#fbbf24',
    darkBorder: 'rgba(251, 191, 36, 0.35)',
    gradientFrom: '#92400e',
    gradientTo: '#78350f',
  },
  slate: {
    label: 'Grafite Elegante',
    hex: '#475569',
    hoverHex: '#334155',
    lightHex: '#f1f5f9',
    textHex: '#1e293b',
    borderHex: '#cbd5e1',
    darkSurface: 'rgba(71, 85, 105, 0.22)',
    darkText: '#94a3b8',
    darkBorder: 'rgba(148, 163, 184, 0.35)',
    gradientFrom: '#334155',
    gradientTo: '#0f172a',
  },
};

const STORAGE_KEY = 'junto_app_financeiro_state_v5';
const cacheKey = (uid?: string) => STORAGE_KEY + ':' + (uid || 'local');
type CoupleSession = { couple: CoupleAccountData; profile: UserAuthProfile };

const INITIAL_STATE: AppState = {
  profile: {
    partner1Name: 'Você',
    partner1Specialty: '',
    partner2Name: 'Aguardando Par...',
    partner2Specialty: '',
    city: 'Brasil',
    partner1Income: 0,
    partner2Income: 0,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 0,
    themeMode: 'light',
    accentTheme: 'emerald',
    coupleTheme: 'emerald',
    partner1Theme: 'sapphire',
    partner2Theme: 'rose',
    investmentsPercentage: 20,
  },
  categoryPercentages: {
    moradia: 30,
    transporte: 10,
    comida: 15,
    lazer: 15,
    protecao: 10,
    profissional: 10,
  },
  isCustomizedPercentages: false,
  lastAcknowledgedTierKey: 'tracao',
  categoryFloors: {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: 0,
  },
  categoryLocks: {
    moradia: false,
    transporte: false,
    comida: false,
    lazer: false,
    protecao: false,
    profissional: false,
    investimentos: false,
  },
  monthlyBudgetPlans: {},
  currentMonth: new Date().toISOString().slice(0, 7),
  expenses: [],
  incomes: [],
  installments: [],
  piggyBanks: [],
  linkedAccounts: [],
  pluggyAccounts: [],
  keywordRules: DEFAULT_KEYWORD_RULES,
  detectedSubscriptions: [],
  incomeSourceRules: [],
  pendingConfirmations: [],
  alertRules: [
    { id: 'rule-1', title: 'Avisar quando categoria atingir 80% do teto', type: 'category_limit', enabled: true },
    { id: 'rule-2', title: 'Avisar compras individuais acima de R$ 1.000', type: 'amount_threshold', thresholdAmount: 1000, enabled: true },
    { id: 'rule-3', title: 'Avisar se parcelas de consumo passarem de 20% da renda', type: 'parcel_limit', enabled: true },
  ],
  notifications: [],
  protectionCurrentAmount: 0,
  protectionTotalInvested: 0,
  protectionYieldAccumulated: 0,
  isProtectionComplete: false,
  freedomTotalInvested: 0,
  freedomYieldAccumulated: 0,
  surplusTransfers: [],
  dismissedSurplusMonths: [],
  monthlyDepositGuides: {},
  completedMonthDeposits: {},
  pushSettings: DEFAULT_PUSH_SETTINGS,
  medicalShifts: [],
  medicalShiftPresets: DEFAULT_SHIFT_PRESETS,
  hospitalMappingRules: [],
  appMode: 'casal',
  collegeModeData: {
    active: false,
    courseName: 'Medicina',
    currentSemester: 1,
    totalSemesters: 12,
    monthlyStipend: 0,
    totalInvestedInCollege: 0,
    studentName: 'Estudante',
  },
  strategicIntents: [],
};

export interface FinanceContextType {
  state: AppState;
  categories: Record<CategoryKey, CategoryInfo>;
  categoriesSpending: Record<CategoryKey, { spent: number; budget: number; remaining: number; percentageUsed: number; isOver: boolean }>;
  totalIncome: number;
  totalSpent: number;
  totalSpentThisMonth: number;
  remainingToSpendThisMonth: number;
  isOverBudget: boolean;
  totalBudget: number;
  freeFlowingAmount: number;
  totalSavedInPiggyBanks: number;
  totalMonthlyPiggyDeposits: number;
  blownCategories: CategoryKey[];
  highestBlownCategory: { key: CategoryKey; name: string; overAmount: number } | null;
  unreadNotificationsCount: number;
  activeInstallments: InstallmentPurchase[];
  totalActiveInstallmentsAmountMonth: number;
  nextMonthCommittedInstallmentsAmount: number;
  installmentCommitmentPercentage: number;
  installmentLimitPercentage: number;
  isInstallmentCommitmentHigh: boolean;
  toggleInitialHomePhase: () => void;
  justFinishedInstallment: InstallmentPurchase | null;
  historicalTrends: MonthTrendRecord[];
  
  // Actions
  addExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  updateExpense: (id: string, expense: Partial<ExpenseItem>) => void;
  editExpense: (expenseOrId: string | ExpenseItem, expense?: Partial<ExpenseItem>) => void;
  deleteExpense: (id: string) => void;
  addIncome: (income: Omit<IncomeItem, 'id'>) => void;
  deleteIncome: (id: string, forceUnlink?: boolean) => void;
  addInstallment: (installment: Omit<InstallmentPurchase, 'id' | 'paidInstallmentsCount' | 'active'>) => void;
  recordInstallmentPayment: (id: string) => void;
  markInstallmentPaidStep: (id: string) => void;
  deleteInstallment: (id: string) => void;
  dismissCompletedInstallmentNotification: (id: string) => void;
  addPiggyBank: (piggy: Omit<SavingsPiggyBank, 'id'>) => void;
  updatePiggyBank: (id: string, updates: Partial<SavingsPiggyBank>) => void;
  deletePiggyBank: (id: string) => void;
  removePiggyBank: (id: string) => void;
  depositPiggyBank: (id: string, amount: number) => void;
  depositToPiggyBank: (id: string, amount: number) => void;
  withdrawPiggyBank: (id: string, amount: number) => void;
  withdrawFromPiggyBank: (id: string, amount: number) => void;
  setCurrentMonth: (month: string) => void;
  syncBankAccounts: () => Promise<void>;
  triggerBankSync: () => Promise<void>;
  isSyncingBanks: boolean;
  markNotificationAsRead: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  updateAlertRule: (ruleOrId: string | SpendingAlertRule, updates?: Partial<SpendingAlertRule>) => void;
  clearAllNotifications: () => void;

  // Meus Investimentos 3-Block System
  autoCalculatedProtectionTarget: number;
  monthlyFixedExpensesAvg: number;
  toggleProtectionComplete: () => void;
  setProtectionComplete: (complete: boolean) => void;
  depositToProtection: (amount: number) => void;
  withdrawFromProtection: (amount: number) => void;
  toggleGoalComplete: (id: string) => void;
  depositToGoal: (id: string, amount: number) => void;
  withdrawFromGoal: (id: string, amount: number) => void;
  depositToFreedom: (amount: number) => void;
  withdrawFromFreedom: (amount: number) => void;
  updateProtectionBankBalance: (totalInvested: number, currentBankAmount: number) => void;
  updateFreedomBankBalance: (totalInvested: number, currentBankAmount: number) => void;
  updateGoalBankBalance: (id: string, totalInvested: number, currentBankAmount: number) => void;

  // Modo Faculdade Actions
  setAppMode: (mode: 'casal' | 'faculdade') => void;
  updateCollegeData: (data: Partial<import('../types/finance').CollegeModeData>) => void;
  advanceCollegeSemester: () => void;
  depositCollegeInvestment: (amount: number) => void;
  migrateCollegeToProfessional: (newMonthlyIncome: number) => void;
  
  updateProfile: (profile: Partial<CoupleProfile>) => void;
  updateCategoryPercentages: (percentages: Record<CategoryKey, number>) => void;
  updateCategoryFloors: (floors: Record<string, number>) => void;
  categoryLocks: Record<DestinationKey, boolean>;
  monthlyBudgetPlans: Record<string, BudgetPlanContract>;
  updateCategoryLocks: (locks: Partial<Record<DestinationKey, boolean>>) => void;
  applyBudgetPlanContract: (plan: BudgetPlanContract) => void;
  toggleThemeMode: () => void;
  setAccentTheme: (theme: AccentTheme) => void;
  setModeTheme: (mode: 'couple' | 'partner1' | 'partner2', theme: AccentTheme) => void;
  resetToSampleData: () => void;
  clearAllData: () => Promise<void> | void;
  clearExpenses: () => void;
  clearInstallments: () => void;
  clearPiggyBanks: () => void;
  clearIncomes: () => void;
  triggerCelebration: () => void;
  
  // Partner Split & Individual/Joint Spending
  partner1ShareSpent: number;
  partner2ShareSpent: number;
  jointExpensesTotal: number;
  partner1SoleExpensesTotal: number;
  partner2SoleExpensesTotal: number;
  monthlySpendingTotals: {
    totalEconomicSpent: number;
    budgetConsumedSpent: number;
    cashOutflowSpent: number;
  };
  getExpenseSplit: (
    amount: number,
    paidBy: PaidBy,
    p1Pct?: number,
    p2Pct?: number
  ) => {
    partner1Amount: number;
    partner2Amount: number;
    partner1Pct: number;
    partner2Pct: number;
    label: string;
    isSplit: boolean;
  };

  currentAccent: (typeof ACCENT_THEMES)[AccentTheme];
  activeModeThemeKey: AccentTheme;
  isDarkMode: boolean;

  // View Mode: Couple (Joint) vs Partner 1 Only vs Partner 2 Only
  viewMode: 'couple' | 'partner1' | 'partner2';
  setViewMode: (mode: 'couple' | 'partner1' | 'partner2') => void;
  displayedIncome: number;
  displayedExpenses: ExpenseItem[];
  displayedTotalSpent: number;
  displayedRemaining: number;

  updateCoupleHub: (updates: Pick<Partial<AppState>, 'coupleGoals' | 'coupleWishlist' | 'coupleFixedBills' | 'dreamSimulations' | 'strategicIntents' | 'expenses' | 'piggyBanks'>) => void;
  payFixedBill: (billId: string, monthKey?: string) => void;
  unpayFixedBill: (billId: string, monthKey?: string) => void;
  convertWishlistToGoal: (wishlistId: string) => void;
  setGoalCoupleAgreement: (goalId: string, agreement: import('../types/finance').CoupleAgreement) => void;
  recordWeeklyCheckIn: (date?: string) => void;

  // Meu Pluggy & Open Finance
  pluggyAccounts: PluggyBankConnection[];
  keywordRules: CategoryKeywordRule[];
  detectedSubscriptions: DetectedSubscription[];
  incomeSourceRules: IncomeSourceRule[];
  pendingConfirmations: PendingIncomeConfirmation[];
  activeLifeTier: LifeTierInfo;
  tierProgress: ReturnType<typeof calculateTierProgress>;
  bonusShiftCalculation: ReturnType<typeof calculateBonusShift50_50>;
  dynamicIncomeAnalysis: ReturnType<typeof calculateDynamicCombinedNetIncome>;
  declaredProfileIncome: number;
  confirmPendingIncome: (confirmationId: string, classification: IncomeSourceClassification, customTaxRate?: number, rememberRule?: boolean) => void;
  dismissPendingIncome: (confirmationId: string) => void;
  addIncomeSourceRule: (rule: Omit<IncomeSourceRule, 'id' | 'createdAt'>) => void;
  removeIncomeSourceRule: (id: string) => void;
  updateFiscalProfile: (partner: 'partner1' | 'partner2', fiscal: Partial<FiscalProfile>) => void;
  simulateNewDepositConfirmation: (amount?: number, sourceName?: string) => void;
  updatePluggyAccount: (id: string, updates: Partial<PluggyBankConnection>) => void;
  addPluggyAccount: (account: Omit<PluggyBankConnection, 'id'>) => void;
  removePluggyAccount: (id: string) => void;
  syncPluggyData: () => Promise<void>;
  importStatement: (items: BankImportedTransaction[]) => void;
  reviewBankTransaction: (id: string, classification: 'expense' | 'income' | 'internal_transfer', category?: CategoryKey) => void;
  updateKeywordRules: (rules: CategoryKeywordRule[]) => void;
  addKeywordRule: (rule: Omit<CategoryKeywordRule, 'id'>) => void;
  removeKeywordRule: (id: string) => void;
  autoCategorizeDescription: (description: string) => { category: CategoryKey; subcategory?: string; matchedKeyword?: string };
  dismissSubscription: (id: string) => void;
  confirmSubscriptionAsExpense: (id: string) => void;
  addSubscription: (sub: Omit<DetectedSubscription, 'id'>) => void;
  removeSubscription: (id: string) => void;

  // Faixas de Renda & Personalização Manual de Porcentagens
  isCustomizedPercentages: boolean;
  customizedCategoriesMap: Record<string, { recommendedPct: number; currentPct: number; isCustom: boolean }>;
  restoreTierDefaultPercentages: (tierKey?: LifeTierKey) => void;
  applyNewTierDefaults: () => void;
  keepCustomPercentagesOnTierChange: () => void;
  pendingTierChangePrompt: { oldTierKey: LifeTierKey; oldTier: LifeTierInfo; newTier: LifeTierInfo } | null;
  dismissTierChangePrompt: () => void;

  // Direcionamento Seletivo de Sobras Orçamentárias
  surplusTransfers: SurplusTransferRecord[];
  allocateCategorySurplus: (
    sourceCategory: CategoryKey,
    amount: number,
    targetType: 'protection' | 'goal' | 'freedom',
    targetGoalId?: string,
    targetGoalName?: string,
    note?: string
  ) => void;
  reallocateCategoryBudget: (fromCategory: CategoryKey, toCategory: CategoryKey, amount: number, note?: string) => void;
  coverExpenseDeficitWithShift: (shiftId: string, categoryKey: CategoryKey, amount: number) => void;
  distributeSurplusPercentages: (
    allocations: {
      targetType: 'goal' | 'protection' | 'freedom' | 'leisure';
      targetGoalId?: string;
      targetGoalName?: string;
      percentage: number;
      amount: number;
    }[],
    sourceCategory?: CategoryKey
  ) => void;
  dismissMonthSurplusNotification: (monthKey: string) => void;
  triggerMonthSurplusNotificationManually: () => void;

  // Guia Didático de Aportes Manuais & Confirmação Visual
  monthlyDepositGuides: Record<string, MonthlyDepositGuide>;
  completedMonthDeposits: Record<string, MonthDepositCompletionRecord>;
  investmentCeiling: {
    programmedBase: number;
    eligibleSurplus: number;
    suggestedCeiling: number;
    shieldedFixedEssential: number;
    investmentsPercentage: number;
  };
  getMonthlyDepositGuide: (monthKey?: string, customStrategy?: '100_percent_reserve' | 'split_freedom') => MonthlyDepositGuide;
  updateDepositGuideStrategy: (monthKey: string, strategy: '100_percent_reserve' | 'split_freedom') => void;
  approveMonthlyDepositGuide: (monthKey: string, customItems?: MonthlyDepositItem[]) => void;
  adjustMonthlyDepositItem: (monthKey: string, itemId: string, newAmount: number) => void;
  executeMonthlyDeposit: (monthKey: string) => void;
  resetMonthlyDeposit: (monthKey: string) => void;

  // Notificações Push & Alertas Estratégicos
  pushSettings: PushNotificationSettings;
  updatePushSettings: (updates: Partial<PushNotificationSettings>) => void;

  // Gestão de Plantões Médicos & Escalas
  medicalShifts: MedicalShift[];
  medicalShiftPresets: MedicalShiftPreset[];
  hospitalMappingRules: HospitalIncomeMappingRule[];
  addMedicalShift: (shift: Omit<MedicalShift, 'id'>) => void;
  updateMedicalShift: (id: string, updates: Partial<MedicalShift>) => void;
  deleteMedicalShift: (id: string) => void;
  reconcileShiftWithIncome: (shiftId: string, incomeId: string, rememberHospitalRule?: boolean, amount?: number) => void;
  undoShiftReconciliation: (shiftId: string) => void;
  markShiftAsReceivedDirectly: (shiftId: string, actualDate?: string, createIncomeRecord?: boolean) => void;
  addShiftPreset: (preset: Omit<MedicalShiftPreset, 'id'>) => void;
  deleteShiftPreset: (id: string) => void;
  addHospitalMappingRule: (rule: Omit<HospitalIncomeMappingRule, 'id' | 'createdAt'>) => void;
  removeHospitalMappingRule: (id: string) => void;

  // Auth & Cloud Sync & Couple Fusion
  currentUser: User | null;
  userProfile: UserAuthProfile | null;
  coupleAccount: CoupleAccountData | null;
  isCloudSynced: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string, partner1Name: string, partner2Name: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  joinCoupleWithInviteCode: (inviteCode: string) => Promise<void>;
  generateNewInviteCode: () => Promise<string>;
  unlinkCouple: () => Promise<void>;
  signOutUser: () => Promise<void>;

  // Intelligent Couple Audit & Reconciliation
  detectedDuplicates: DuplicateGroup[];
  resolveDuplicateMerge: (primaryId: string, duplicateIdsToDelete: string[]) => void;
  coupleSettlement: CoupleSettlementSummary;
  settlementSplitMode: 'fifty_fifty' | 'proportional';
  setSettlementSplitMode: (mode: 'fifty_fifty' | 'proportional') => void;
  recordSettlementCompleted: () => void;
  predictiveBurnAlerts: PredictiveBurnAlert[];

  // Gestão da Reserva de Emergência & Adiantamento de Parcelas
  emergencyReserveFloorAmount: number;
  emergencyReserveExcessAmount: number;
  reallocateReserveExcess: (amount: number, targetType: 'goal' | 'freedom', targetGoalId?: string, targetGoalName?: string) => void;
  advanceInstallmentPayment: (payload: import('../types/finance').AdvanceInstallmentPayload) => void;

  // Intenções de Gasto Estratégico & Triagem Omnipresente (Alocação Proativa de Fonte)
  strategicIntents: StrategicSpendingIntent[];
  addStrategicIntent: (intent: Omit<StrategicSpendingIntent, 'id' | 'createdAt' | 'status'>) => void;
  updateStrategicIntent: (id: string, updates: Partial<StrategicSpendingIntent>) => void;
  deleteStrategicIntent: (id: string) => void;
  reconcileExpenseWithIntent: (expenseId: string, intentId: string) => void;
  updateExpenseTriage: (
    expenseId: string,
    triageData: {
      assignedTo?: 'couple' | 'partner1' | 'partner2';
      paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
      fundingSource?: FundingSourceType;
      fundingGoalId?: string;
      fundingGoalName?: string;
      isExcludedFromMonthlyBudget?: boolean;
    }
  ) => void;

  // Motor de Insights Preditivos & Inteligência de Abastecimento (Comida)
  foodPacingMetrics: FoodPacingMetrics;
  aiPredictiveInsights: AIPredictiveInsight[];
  applyAISuggestionAction: (
    insightId: string,
    actionType: 'use_reward' | 'send_to_goal' | 'keep_buffer',
    targetGoalId?: string
  ) => void;
  dismissAISuggestion: (insightId: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return auth.currentUser || ({
      uid: 'guest-default-user',
      displayName: 'Você',
      email: 'voce@junto.app',
      isAnonymous: true,
    } as any);
  });
  const [userProfile, setUserProfile] = useState<UserAuthProfile | null>(null);
  const [coupleAccount, setCoupleAccount] = useState<CoupleAccountData | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isHydratingCloud, setIsHydratingCloud] = useState(Boolean(auth.currentUser));
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'couple' | 'partner1' | 'partner2'>('couple');

  const [state, setState] = useState<AppState>(INITIAL_STATE);
  useEffect(() => {
    // Remove exposed credentials while preserving the old financial backup.
    // That unscoped backup is never automatically assigned to a signed-in UID.
    try {
      const oldKey = 'junto_app_financeiro_state_v4';
      const saved = localStorage.getItem(oldKey);
      if (saved) {
        const legacy = JSON.parse(saved);
        if (Object.prototype.hasOwnProperty.call(legacy, 'pluggyCredentials')) {
          delete legacy.pluggyCredentials;
          localStorage.setItem(oldKey, JSON.stringify(legacy));
        }
      }
    } catch { console.warn('Não foi possível remover as credenciais do cache legado.'); }
  }, []);
  const sessionUid = useRef<string | null>(null);
  const [cacheOwner, setCacheOwner] = useState<string | null>(null);
  const [cacheCoupleId, setCacheCoupleId] = useState<string | null>(null);
  const sessionGeneration = useRef(0);
  const entityBaseline = useRef<EntityState>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const entityReady = useRef(false);
  const entityListener = useRef<(() => void) | null>(null);
  const coupleListener = useRef<(() => void) | null>(null);
  const loadCache = (uid?: string, coupleId?: string): AppState => {
    try {
      const saved = localStorage.getItem(cacheKey(uid));
      if (saved) {
        const envelope = JSON.parse(saved);
        if (envelope.version !== 1 || envelope.coupleId !== (coupleId || null)) return { ...INITIAL_STATE };
        entityBaseline.current = envelope.baseline || {};
        const parsed = envelope.state;
        if (!parsed || typeof parsed !== 'object') return { ...INITIAL_STATE };
        delete parsed.pluggyCredentials;
        return { ...INITIAL_STATE, ...parsed, profile: { ...INITIAL_STATE.profile, ...parsed.profile } };
      }
    } catch { console.warn('Não foi possível recuperar o cache desta conta.'); }
    return { ...INITIAL_STATE };
  };

  const [isSyncingBanks, setIsSyncingBanks] = useState(false);

  useEffect(() => {
    try {
      if (cacheOwner !== sessionUid.current) return;
      localStorage.setItem(cacheKey(cacheOwner || undefined), JSON.stringify({ version: 1, coupleId: cacheCoupleId, state, baseline: entityBaseline.current }));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [state, cacheOwner, cacheCoupleId]);

  const isRemoteSync = useRef(false);


  // Auth Listener & Realtime Cloud Synchronization
  useEffect(() => {
    let disposed = false;

    const handleAuth = async (user: User | null) => {
      const generation = ++sessionGeneration.current;
      coupleListener.current?.();
      coupleListener.current = null;
      entityListener.current?.();
      entityListener.current = null;
      entityReady.current = false;
      entityBaseline.current = {};
      sessionUid.current = user?.uid || null;
      setCacheOwner(null);
      setUserProfile(null);
      setCoupleAccount(null);
      setIsCloudSynced(false);
      setCloudLoadError(null);
      setIsHydratingCloud(Boolean(user));
      setCacheCoupleId(null);
      setState(user ? { ...INITIAL_STATE } : loadCache());
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          if (disposed || generation !== sessionGeneration.current) return;
          if (userSnap.exists()) {
            const profileData = userSnap.data() as UserAuthProfile;
            setUserProfile(profileData);
            setState(loadCache(user.uid, profileData.coupleId));
            setCacheCoupleId(profileData.coupleId || null);
            setCacheOwner(user.uid);

            if (profileData.coupleId) {
              const coupleRef = doc(db, 'couples', profileData.coupleId);
              coupleListener.current = onSnapshot(coupleRef, (cSnap) => {
                if (disposed || generation !== sessionGeneration.current) return;
                if (cSnap.exists()) {
                  const cData = cSnap.data();

                  // Membership is assigned by the authenticated backend only.
                  if ((cData.partner1Uid !== user.uid && cData.partner2Uid !== user.uid) || cData.departedMembers?.[user.uid]) { setCloudLoadError('O vínculo desta conta precisa ser validado pelo responsável do sistema.'); return; }
                  if (!entityListener.current) {
                    const legacy = Object.fromEntries(ENTITY_FIELDS.map(field => [field, Array.isArray(cData[field]) ? cData[field] : []])) as EntityState;
                    // Mark listener creation immediately to avoid duplicate migrations.
                    entityListener.current = () => {};
                    void migrateEntities(db, profileData.coupleId, legacy, () => !disposed && generation === sessionGeneration.current && auth.currentUser?.uid === user.uid).then(() => {
                      if (disposed || generation !== sessionGeneration.current) return;
                      entityListener.current = subscribeEntities(db, profileData.coupleId, (remote, confirmed) => {
                        if (generation !== sessionGeneration.current) return;
                        const previous = entityBaseline.current;
                        entityBaseline.current = Object.fromEntries(ENTITY_FIELDS.map(field => [field,
                          conflictAwareBaseline(previous[field] || [], (stateRef.current[field] || []) as unknown as import('../lib/entitySync').SyncEntity[], remote[field] || [])
                        ])) as EntityState;
                        entityReady.current = true;
                        setState(prev => ({ ...prev, ...Object.fromEntries(ENTITY_FIELDS.map(field => [field,
                          rebaseEntities(previous[field] || [], prev[field] as unknown as import('../lib/entitySync').SyncEntity[] || [], remote[field] || [])
                        ])) }));
                        setIsHydratingCloud(false);
                        setIsCloudSynced(confirmed);
                      }, () => { setIsCloudSynced(false); setCloudLoadError('Não foi possível acessar os registros. Verifique sua conexão e as permissões da conta.'); });
                    }).catch(() => { entityListener.current = null; setIsCloudSynced(false); setCloudLoadError('Não foi possível carregar os registros. Seu cache foi preservado. Verifique a conexão e tente novamente.'); });
                  }

                  setCoupleAccount({
                    id: cData.id || profileData.coupleId,
                    inviteCode: cData.inviteCode,
                    partner1Name: cData.partner1Name,
                    partner2Name: cData.partner2Name,
                    partner1Income: cData.partner1Income !== undefined ? cData.partner1Income : 0,
                    partner2Income: cData.partner2Income !== undefined ? cData.partner2Income : 0,
                    createdAt: cData.createdAt || new Date().toISOString(),
                  });

                  // Flag that state update originated remotely so we don't bounce it back
                  isRemoteSync.current = true;

                  setState(prev => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      partner1Career: cData.partner1Career || prev.profile.partner1Career,
                      partner2Career: cData.partner2Career || prev.profile.partner2Career,
                      partner1Name: cData.partner1Name || prev.profile.partner1Name,
                      partner2Name: cData.partner2Name || prev.profile.partner2Name,
                      partner1Income: cData.partner1Income !== undefined ? cData.partner1Income : (prev.profile.partner1Income ?? 0),
                      partner2Income: cData.partner2Income !== undefined ? cData.partner2Income : (prev.profile.partner2Income ?? 0),
                      investmentsPercentage: cData.investmentsPercentage !== undefined ? cData.investmentsPercentage : (prev.profile.investmentsPercentage ?? 20),
                    },
                    categoryPercentages: cData.categoryPercentages || prev.categoryPercentages,
                    categoryFloors: cData.categoryFloors || prev.categoryFloors,
                    protectionCurrentAmount: cData.protectionCurrentAmount !== undefined ? cData.protectionCurrentAmount : prev.protectionCurrentAmount,
                    protectionTotalInvested: cData.protectionTotalInvested !== undefined ? cData.protectionTotalInvested : prev.protectionTotalInvested,
                    isProtectionComplete: cData.isProtectionComplete !== undefined ? cData.isProtectionComplete : prev.isProtectionComplete,
                    freedomTotalInvested: cData.freedomTotalInvested !== undefined ? cData.freedomTotalInvested : prev.freedomTotalInvested,
                    monthlyDepositGuides: cData.monthlyDepositGuides || prev.monthlyDepositGuides,
                    completedMonthDeposits: cData.completedMonthDeposits || prev.completedMonthDeposits,
                    surplusTransfers: Array.isArray(cData.surplusTransfers) ? cData.surplusTransfers : prev.surplusTransfers,
                    dismissedSurplusMonths: Array.isArray(cData.dismissedSurplusMonths) ? cData.dismissedSurplusMonths : prev.dismissedSurplusMonths,
                  }));
                } else { setCloudLoadError('O espaço financeiro desta conta não foi encontrado.'); }
              }, () => { setIsCloudSynced(false); setCloudLoadError('Não foi possível abrir este casal. Verifique a conexão e o vínculo da sua conta.'); });
            } else { setIsHydratingCloud(false); }
          } else { setIsHydratingCloud(false); }
        } catch (err) {
          setCloudLoadError('Não foi possível carregar sua conta. Verifique a conexão.');
          console.warn('Firestore initial sync note:', err);
        }
      } else {
        setUserProfile(null);
        setCoupleAccount(null);
        setIsCloudSynced(false);
        setCurrentUser(prev => prev || ({
          uid: 'guest-default-user',
          displayName: 'Você',
          email: 'voce@junto.app',
          isAnonymous: true,
        } as any));
      }
    };
    const unsubAuth = onAuthStateChanged(auth, handleAuth);
    const membershipChanged = () => { void handleAuth(auth.currentUser); };
    window.addEventListener('junto-membership-changed', membershipChanged);

    const genRef = sessionGeneration;
    return () => {
      unsubAuth();
      window.removeEventListener('junto-membership-changed', membershipChanged);
      disposed = true;
      ++genRef.current;
      coupleListener.current?.();
      coupleListener.current = null;
      entityListener.current?.();
      entityListener.current = null;
    };
  }, []);

  // Independent entity writes must never be skipped by a metadata snapshot.
  useEffect(() => {
    if (!coupleAccount?.id || !currentUser || !entityReady.current) return;
    const generation = sessionGeneration.current;
    const baseline = entityBaseline.current;
    const current = Object.fromEntries(ENTITY_FIELDS.map(field => [field, state[field] || []])) as unknown as EntityState;
    const timer = setTimeout(async () => {
      if (generation !== sessionGeneration.current || auth.currentUser?.uid !== currentUser.uid) return;
      try {
        setIsCloudSynced(false);
        await saveEntities(db, coupleAccount.id, baseline, current, () => generation === sessionGeneration.current && auth.currentUser?.uid === currentUser.uid);
        if (generation === sessionGeneration.current) setIsCloudSynced(true);
      } catch (error) {
        if (generation === sessionGeneration.current) setIsCloudSynced(false);
        console.warn('Não foi possível salvar os registros. Alterações locais preservadas.', error);
      }
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleAccount?.id, currentUser?.uid, state.expenses, state.incomes, state.installments, state.piggyBanks, state.strategicIntents, state.medicalShifts, state.shiftIncomeAllocations, state.bankImportedTransactions, state.medicalShiftPresets, state.hospitalMappingRules, state.incomeSourceRules, state.pendingConfirmations, state.linkedAccounts, state.detectedSubscriptions, state.keywordRules, state.coupleGoals, state.coupleWishlist, state.coupleFixedBills, state.dreamSimulations, state.pluggyAccounts]);

  // Realtime Cloud Persistence: Save shared couple state to Firestore (debounced)
  useEffect(() => {
    if (!coupleAccount?.id || !currentUser || currentUser.uid !== sessionUid.current || !entityReady.current) return;
    if (isRemoteSync.current) {
      isRemoteSync.current = false;
      return;
    }

    const generation = sessionGeneration.current;
    const timer = setTimeout(async () => {
      if (generation !== sessionGeneration.current || auth.currentUser?.uid !== currentUser.uid) return;
      setIsCloudSynced(false);
      try {
        const coupleRef = doc(db, 'couples', coupleAccount.id);
        await setDoc(
          coupleRef,
          {
            categoryPercentages: state.categoryPercentages,
            categoryFloors: state.categoryFloors,
            partner1Career: state.profile.partner1Career || null,
            partner2Career: state.profile.partner2Career || null,
            partner1Income: state.profile.partner1Income,
            partner2Income: state.profile.partner2Income,
            partner1Name: state.profile.partner1Name,
            partner2Name: state.profile.partner2Name,
            investmentsPercentage: state.profile.investmentsPercentage ?? 20,
            protectionCurrentAmount: state.protectionCurrentAmount,
            protectionTotalInvested: state.protectionTotalInvested,
            isProtectionComplete: state.isProtectionComplete,
            freedomTotalInvested: state.freedomTotalInvested,
            monthlyDepositGuides: state.monthlyDepositGuides || {},
            completedMonthDeposits: state.completedMonthDeposits || {},
            surplusTransfers: state.surplusTransfers || [],
            dismissedSurplusMonths: state.dismissedSurplusMonths || [],
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser?.uid || 'user',
          },
          { merge: true }
        );
        if (generation === sessionGeneration.current) setIsCloudSynced(true);
      } catch (err) {
        setIsCloudSynced(false);
        console.warn('Failed to sync couple state to Firestore', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coupleAccount?.id,
    state.expenses,
    state.incomes,
    state.pluggyAccounts,
    state.installments,
    state.piggyBanks,
    state.categoryPercentages,
    state.categoryFloors,
    state.profile.partner1Career,
    state.profile.partner2Career,
    state.profile.partner1Income,
    state.profile.partner2Income,
    state.profile.partner1Name,
    state.profile.partner2Name,
    state.profile.investmentsPercentage,
    state.protectionCurrentAmount,
    state.protectionTotalInvested,
    state.isProtectionComplete,
    state.freedomTotalInvested,
    state.monthlyDepositGuides,
    state.completedMonthDeposits,
    state.surplusTransfers,
    state.dismissedSurplusMonths,
    state.strategicIntents,
    state.medicalShifts,
    state.coupleGoals,
    state.coupleWishlist,
    state.coupleFixedBills,
    state.dreamSimulations,
    currentUser?.uid,
  ]);

  const installCoupleSession = (result: CoupleSession) => {
    coupleListener.current?.();
    setCacheOwner(null);
    setState({ ...INITIAL_STATE, profile: { ...INITIAL_STATE.profile, partner1Name: result.couple.partner1Name, partner2Name: result.couple.partner2Name } });
    setUserProfile(result.profile);
    setCoupleAccount(result.couple);
    // Reattach the listener without logging out or sharing another account's cache.
    window.dispatchEvent(new Event('junto-membership-changed'));
  };

  const generateNewInviteCode = async (): Promise<string> => {
    const result = await authenticatedApi<{ inviteCode: string }>('/api/couples/invite', { coupleId: coupleAccount?.id });
    setCoupleAccount(prev => prev ? { ...prev, inviteCode: result.inviteCode } : null);
    return result.inviteCode;
  };

  const signUpWithEmail = async (emailVal: string, passVal: string, displayNameVal: string, partner1NameVal: string, partner2NameVal: string) => {
    await createUserWithEmailAndPassword(auth, emailVal, passVal);
    installCoupleSession(await authenticatedApi<CoupleSession>('/api/couples', { displayName: displayNameVal || partner1NameVal, partner1Name: partner1NameVal, partner2Name: partner2NameVal }));
  };

  const signInWithEmail = async (emailVal: string, passVal: string) => {
    const cred = await signInWithEmailAndPassword(auth, emailVal, passVal);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists() || !snap.data().coupleId) installCoupleSession(await authenticatedApi<CoupleSession>('/api/couples', { displayName: cred.user.displayName || 'Você' }));
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists() || !snap.data().coupleId) {
      installCoupleSession(await authenticatedApi<CoupleSession>('/api/couples', { displayName: cred.user.displayName || 'Você' }));
    }
  };

  const joinCoupleWithInviteCode = async (codeVal: string) => {
    if (!auth.currentUser) throw new Error('Faça login para aceitar o convite.');
    installCoupleSession(await authenticatedApi<CoupleSession>('/api/couples/join', { inviteCode: codeVal.trim() }));
  };

  const signInAsGuest = async () => {
    try {
      await signInAnonymously(auth);
      triggerCelebration();
    } catch (e) {
      console.warn('Anonymous sign-in fallback', e);
      setCurrentUser({
        uid: `guest-${Date.now()}`,
        email: 'visitante@junto.app',
        displayName: 'Você',
      } as any);
      triggerCelebration();
    }
  };

  const unlinkCouple = async () => {
    await authenticatedApi('/api/couples/leave', { coupleId: coupleAccount?.id });
    ++sessionGeneration.current;
    coupleListener.current?.();
    coupleListener.current = null;
    entityListener.current?.();
    entityListener.current = null;
    entityReady.current = false;
    entityBaseline.current = {};
    entityListener.current?.();
    entityListener.current = null;
    entityReady.current = false;
    setUserProfile(prev => prev ? { ...prev, coupleId: '' } : null);
    setCoupleAccount(null);
    setState({ ...INITIAL_STATE });
    setIsCloudSynced(false);
  };

  const signOutUser = async () => {
    ++sessionGeneration.current;
    sessionUid.current = null;
    coupleListener.current?.();
    coupleListener.current = null;
    entityListener.current?.();
    entityListener.current = null;
    entityReady.current = false;
    entityBaseline.current = {};
    setCacheOwner(null);
    setState({ ...INITIAL_STATE });
    setCurrentUser(null);
    setUserProfile(null);
    setCoupleAccount(null);
    setIsCloudSynced(false);
    await signOut(auth);
  };

  // Apply dark mode class to document
  useEffect(() => {
    if (state.profile.themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-slate-950', 'text-slate-100');
      document.body.classList.remove('bg-[#F8FAF9]', 'text-slate-800');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-slate-950', 'text-slate-100');
      document.body.classList.add('bg-[#F8FAF9]', 'text-slate-800');
    }
  }, [state.profile.themeMode]);

  // ==========================================
  // DYNAMIC 3-MODE PRIMARY COLOR RESOLUTION
  // ==========================================
  const activeModeThemeKey: AccentTheme = useMemo(() => {
    if (viewMode === 'partner1') {
      return state.profile.partner1Theme || 'sapphire';
    }
    if (viewMode === 'partner2') {
      return state.profile.partner2Theme || 'rose';
    }
    return state.profile.coupleTheme || state.profile.accentTheme || 'emerald';
  }, [
    viewMode,
    state.profile.partner1Theme,
    state.profile.partner2Theme,
    state.profile.coupleTheme,
    state.profile.accentTheme,
  ]);

  const currentAccent = ACCENT_THEMES[activeModeThemeKey] || ACCENT_THEMES.emerald;

  const declaredProfileIncome = useMemo(() => {
    return (state.profile.partner1Income || 0) + (state.profile.partner2Income || 0);
  }, [state.profile.partner1Income, state.profile.partner2Income]);

  const dynamicIncomeAnalysis = useMemo(() => {
    return calculateDynamicCombinedNetIncome(declaredProfileIncome, state.incomes, state.currentMonth);
  }, [declaredProfileIncome, state.incomes, state.currentMonth]);

  const totalIncome = useMemo(() => {
    return dynamicIncomeAnalysis.effectiveMonthlyIncome;
  }, [dynamicIncomeAnalysis]);

  const activeLifeTier = useMemo(() => {
    return getLifeTier(totalIncome);
  }, [totalIncome]);

  const tierProgress = useMemo(() => {
    return calculateTierProgress(totalIncome, activeLifeTier);
  }, [totalIncome, activeLifeTier]);

  const bonusShiftCalculation = useMemo(() => {
    const curMonthIncomes = state.incomes.filter(i => i.date && i.date.startsWith(state.currentMonth));
    const curMonthTotal = curMonthIncomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
    const baseline = declaredProfileIncome > 0 ? declaredProfileIncome : (dynamicIncomeAnalysis.threeMonthsAverage > 0 ? dynamicIncomeAnalysis.threeMonthsAverage : 0);
    return calculateBonusShift50_50(curMonthTotal > 0 ? curMonthTotal : totalIncome, baseline);
  }, [state.incomes, state.currentMonth, declaredProfileIncome, dynamicIncomeAnalysis.threeMonthsAverage, totalIncome]);

  // Apply Accent Theme & Mode CSS Variables to document root dynamically
  useEffect(() => {
    const isDark = state.profile.themeMode === 'dark';
    const theme = currentAccent;
    const tier = activeLifeTier;

    // User customized profile themes
    document.documentElement.style.setProperty('--app-accent-primary', theme.hex);
    document.documentElement.style.setProperty('--app-accent-hover', theme.hoverHex);
    document.documentElement.style.setProperty('--app-accent-light', theme.lightHex);
    document.documentElement.style.setProperty('--app-accent-text', isDark ? theme.darkText : theme.textHex);
    document.documentElement.style.setProperty('--app-accent-border', isDark ? theme.darkBorder : theme.borderHex);
    document.documentElement.style.setProperty('--app-accent-surface', isDark ? theme.darkSurface : theme.lightHex);
    document.documentElement.style.setProperty('--app-accent-gradient-from', theme.gradientFrom);
    document.documentElement.style.setProperty('--app-accent-gradient-to', theme.gradientTo);
    document.documentElement.style.setProperty('--app-accent-glow', `${theme.hex}40`);
    document.documentElement.style.setProperty('--app-accent-subtle', `${theme.hex}14`);

    // Dynamic Life Tier Aura variables
    document.documentElement.style.setProperty('--app-tier-primary', tier.colors.primary);
    document.documentElement.style.setProperty('--app-tier-secondary', tier.colors.secondary);
    document.documentElement.style.setProperty('--app-tier-glow', tier.colors.glow);
    document.documentElement.style.setProperty('--app-tier-border', tier.colors.border);
    document.documentElement.style.setProperty('--app-tier-surface', isDark ? tier.colors.darkBg : tier.colors.lightBg);
    document.documentElement.style.setProperty('--app-tier-text', tier.colors.text);
    document.documentElement.style.setProperty('--app-tier-gradient-from', tier.colors.gradientFrom);
    document.documentElement.style.setProperty('--app-tier-gradient-to', tier.colors.gradientTo);
  }, [activeModeThemeKey, currentAccent, activeLifeTier, state.profile.themeMode]);

  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
      });
    } catch {
      // safe fallback
    }
  }, []);

  const setCurrentMonth = (month: string) => {
    setState(prev => ({ ...prev, currentMonth: month }));
  };

  const displayedIncome = useMemo(() => {
    if (viewMode === 'partner1') return state.profile.partner1Income;
    if (viewMode === 'partner2') return state.profile.partner2Income;
    return totalIncome;
  }, [viewMode, state.profile.partner1Income, state.profile.partner2Income, totalIncome]);

  const displayedExpenses = useMemo(() => {
    if (viewMode === 'couple') return state.expenses;
    if (viewMode === 'partner1') {
      return state.expenses.filter(e => e.paidBy === 'partner1' || e.paidBy === 'both');
    }
    return state.expenses.filter(e => e.paidBy === 'partner2' || e.paidBy === 'both');
  }, [viewMode, state.expenses]);

  const activeInstallments = useMemo(() => {
    return state.installments.filter(inst => inst.active);
  }, [state.installments]);

  // Financiamentos Estruturais (PF) vs Parcelas de Consumo (Cartão)
  const cardConsumptionInstallments = useMemo(() => {
    return activeInstallments.filter(inst => inst.type !== 'financing');
  }, [activeInstallments]);

  const totalActiveInstallmentsAmountMonth = useMemo(() => {
    return cardConsumptionInstallments.reduce((sum, item) => sum + installmentInMonth(item, state.currentMonth), 0);
  }, [cardConsumptionInstallments, state.currentMonth]);

  const nextMonthCommittedInstallmentsAmount = useMemo(() => {
    return state.installments
      .filter(inst => {
        if (!inst.active) return false;
        return inst.paidInstallmentsCount < inst.installmentsCount;
      })
      .reduce((sum, item) => sum + installmentInMonth(item, getNextMonth(state.currentMonth)), 0);
  }, [state.installments, state.currentMonth]);

  // Teto de comprometimento oficial de até 20% da renda líquida do casal
  const installmentLimitPercentage = 20;
  const installmentCommitmentPercentage = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return Math.round((totalActiveInstallmentsAmountMonth / totalIncome) * 100);
  }, [totalIncome, totalActiveInstallmentsAmountMonth]);

  const isInstallmentCommitmentHigh = installmentCommitmentPercentage > installmentLimitPercentage;

  const toggleInitialHomePhase = () => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        isInitialHomePhase: !prev.profile.isInitialHomePhase,
      },
    }));
  };

  const justFinishedInstallment = useMemo(() => {
    return state.installments.find(i => !i.active && !i.completedNotified) || null;
  }, [state.installments]);

  const currentMonthExpenses = useMemo(() => {
    return state.expenses.filter(exp => exp.date.startsWith(state.currentMonth));
  }, [state.expenses, state.currentMonth]);

  const categoriesSpending = useMemo(() => {
    const res: Record<CategoryKey, { spent: number; budget: number; remaining: number; percentageUsed: number; isOver: boolean }> = {
      moradia: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
      transporte: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
      comida: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
      lazer: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
      protecao: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
      profissional: { spent: 0, budget: 0, remaining: 0, percentageUsed: 0, isOver: false },
    };

    (Object.keys(CATEGORIES_BASE) as CategoryKey[]).forEach(catKey => {
      const pct = (state.categoryPercentages && state.categoryPercentages[catKey] !== undefined)
        ? state.categoryPercentages[catKey]
        : (activeLifeTier.percentages[catKey] || 0);
      let budget = (totalIncome * pct) / 100;
      // REGRA 50 POR 50: 50% do excedente de plantão extra é liberado para Lazer no próprio mês sem culpa
      if (catKey === 'lazer' && bonusShiftCalculation.hasBonus) {
        budget += bonusShiftCalculation.toLeisure;
      }
      res[catKey].budget = budget;
    });

    currentMonthExpenses.forEach(exp => {
      // REGRA DE BLINDAGEM ORÇAMENTÁRIA (Intenção de Gasto Estratégico & Triagem):
      // Gastos financiados pelo Excesso da Reserva, Caixinhas de Objetivo ou Mesada Individual
      // NÃO consomem o orçamento da categoria do mês (Moradia, Lazer, etc. ficam 100% livres para a rotina diária).
      const isExcluded = exp.isExcludedFromMonthlyBudget || (exp.fundingSource && exp.fundingSource !== 'month_budget');
      if (res[exp.category] && !isExcluded) {
        res[exp.category].spent += exp.amount;
      }
    });

    activeInstallments.forEach(inst => {
      if (res[inst.category]) {
        const alreadyInExpenses = currentMonthExpenses.some(e => e.installmentId === inst.id);
        if (!alreadyInExpenses) {
          res[inst.category].spent += installmentInMonth(inst, state.currentMonth);
        }
      }
    });

    (Object.keys(CATEGORIES_BASE) as CategoryKey[]).forEach(catKey => {
      const cat = res[catKey];
      cat.remaining = cat.budget - cat.spent;
      cat.percentageUsed = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0;
      cat.isOver = cat.spent > cat.budget;
    });

    return res;
  }, [state.categoryPercentages, totalIncome, currentMonthExpenses, activeInstallments, activeLifeTier, bonusShiftCalculation, state.currentMonth]);

  const blownCategories = useMemo(() => {
    return (Object.keys(categoriesSpending) as CategoryKey[]).filter(k => categoriesSpending[k].isOver);
  }, [categoriesSpending]);

  const highestBlownCategory = useMemo(() => {
    if (blownCategories.length === 0) return null;
    const key = blownCategories[0];
    return {
      key,
      name: CATEGORIES_BASE[key].name,
      overAmount: categoriesSpending[key].spent - categoriesSpending[key].budget,
    };
  }, [blownCategories, categoriesSpending]);

  const unreadNotificationsCount = useMemo(() => {
    return state.notifications.filter(n => !n.isRead).length;
  }, [state.notifications]);

  // Motor de Inteligência de Abastecimento e Pacing Semanal de Comida
  const foodPacingMetrics = useMemo(() => {
    const foodBudget = categoriesSpending.comida?.budget || 0;
    return calculateFoodPacingMetrics(state.expenses, state.currentMonth, foodBudget);
  }, [state.expenses, state.currentMonth, categoriesSpending.comida?.budget]);

  // Motor de Insights Preditivos e Proposição de Recompensas / Eficiência
  const aiPredictiveInsights = useMemo(() => {
    return generateAIPredictiveInsights({
      categoriesSpending,
      foodPacing: foodPacingMetrics,
      expenses: state.expenses,
      currentMonthKey: state.currentMonth,
      piggyBanks: state.piggyBanks,
      partner1Name: state.profile.partner1Name,
      partner2Name: state.profile.partner2Name,
      appliedInsights: state.appliedAIInsights || {},
    });
  }, [
    categoriesSpending,
    foodPacingMetrics,
    state.expenses,
    state.currentMonth,
    state.piggyBanks,
    state.profile.partner1Name,
    state.profile.partner2Name,
    state.appliedAIInsights,
  ]);

  // ==========================================
  // REFINAMENTO DO TETO MÁXIMO DE APORTE PARA INVESTIMENTOS:
  // Porcentagem de investimentos da faixa + sobras elegíveis de outros blocos (blindando contas fixas essenciais)
  // ==========================================
  const investmentCeiling = useMemo(() => {
    const invPct = state.profile.investmentsPercentage ?? (activeLifeTier.percentages as any)['investimentos'] ?? 10;
    // PARTE FIXA: Se renda total for 0, base programada é 0. Caso contrário, aplica a % combinada.
    const programmedBase = totalIncome > 0 ? Math.round(totalIncome * (invPct / 100)) : 0;

    // Categorias variáveis elegíveis para sobras (Lazer, Alimentação fora/delivery, Profissional, Proteção)
    // MORADIA é categorizada como contas fixas essenciais já comprometidas e fica 100% BLINDADA.
    const eligibleSurplus = (['lazer', 'comida', 'profissional', 'protecao'] as CategoryKey[])
      .reduce((sum, key) => sum + Math.max(0, categoriesSpending[key]?.remaining || 0), 0);

    const shieldedFixedEssential = Math.max(0, categoriesSpending['moradia']?.remaining || 0);
    const suggestedCeiling = programmedBase + eligibleSurplus;

    return {
      programmedBase,
      eligibleSurplus,
      suggestedCeiling,
      shieldedFixedEssential,
      investmentsPercentage: invPct,
    };
  }, [state.profile.investmentsPercentage, activeLifeTier, totalIncome, categoriesSpending]);

  const getExpenseSplit = useCallback((
    amount: number,
    paidBy: PaidBy,
    p1Pct?: number,
    p2Pct?: number
  ): {
    partner1Amount: number;
    partner2Amount: number;
    partner1Pct: number;
    partner2Pct: number;
    label: string;
    isSplit: boolean;
  } => {
    const totalCents = Math.round(amount * 100);

    if (paidBy === 'partner1') {
      return {
        partner1Amount: totalCents / 100,
        partner2Amount: 0,
        partner1Pct: 100,
        partner2Pct: 0,
        label: `${state.profile.partner1Name} (100%)`,
        isSplit: false,
      };
    }
    if (paidBy === 'partner2') {
      return {
        partner1Amount: 0,
        partner2Amount: totalCents / 100,
        partner1Pct: 0,
        partner2Pct: 100,
        label: `${state.profile.partner2Name} (100%)`,
        isSplit: false,
      };
    }
    if (paidBy === 'custom' && p1Pct !== undefined && p2Pct !== undefined) {
      const p1Cents = Math.round((totalCents * p1Pct) / 100);
      const p2Cents = totalCents - p1Cents;
      return {
        partner1Amount: p1Cents / 100,
        partner2Amount: p2Cents / 100,
        partner1Pct: p1Pct,
        partner2Pct: p2Pct,
        label: `${p1Pct}% ${state.profile.partner1Name} / ${p2Pct}% ${state.profile.partner2Name}`,
        isSplit: true,
      };
    }
    // Default: 'both' 50/50
    const p1Cents = Math.round(totalCents / 2);
    const p2Cents = totalCents - p1Cents;
    return {
      partner1Amount: p1Cents / 100,
      partner2Amount: p2Cents / 100,
      partner1Pct: 50,
      partner2Pct: 50,
      label: '50% / 50% (Casal)',
      isSplit: true,
    };
  }, [state.profile.partner1Name, state.profile.partner2Name]);

  const partner1ShareSpent = useMemo(() => {
    return currentMonthExpenses.reduce((sum, exp) => {
      const split = getExpenseSplit(exp.amount, exp.paidBy, exp.splitPartner1Pct, exp.splitPartner2Pct);
      return sum + split.partner1Amount;
    }, 0);
  }, [currentMonthExpenses, getExpenseSplit]);

  const partner2ShareSpent = useMemo(() => {
    return currentMonthExpenses.reduce((sum, exp) => {
      const split = getExpenseSplit(exp.amount, exp.paidBy, exp.splitPartner1Pct, exp.splitPartner2Pct);
      return sum + split.partner2Amount;
    }, 0);
  }, [currentMonthExpenses, getExpenseSplit]);

  const jointExpensesTotal = useMemo(() => {
    return currentMonthExpenses
      .filter(exp => exp.paidBy === 'both' || exp.paidBy === 'custom')
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [currentMonthExpenses]);

  const partner1SoleExpensesTotal = useMemo(() => {
    return currentMonthExpenses
      .filter(exp => exp.paidBy === 'partner1')
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [currentMonthExpenses]);

  const partner2SoleExpensesTotal = useMemo(() => {
    return currentMonthExpenses
      .filter(exp => exp.paidBy === 'partner2')
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [currentMonthExpenses]);

  // Três Totais Canônicos: Econômico Total, Consumo do Orçamento Rotineiro e Saída de Caixa
  const monthlySpendingTotals = useMemo(() => {
    const totalManualExpenses = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalInstallmentsUncounted = activeInstallments.reduce((sum, inst) => {
      const alreadyIn = currentMonthExpenses.some(e => e.installmentId === inst.id);
      return alreadyIn ? sum : sum + installmentInMonth(inst, state.currentMonth);
    }, 0);
    const totalEconomicSpent = totalManualExpenses + totalInstallmentsUncounted;

    const routineManualSpent = currentMonthExpenses
      .filter(e => !e.isExcludedFromMonthlyBudget && (!e.fundingSource || e.fundingSource === 'month_budget'))
      .reduce((sum, e) => sum + e.amount, 0);
    const budgetConsumedSpent = routineManualSpent + totalInstallmentsUncounted;

    const cashOutflowSpent = currentMonthExpenses
      .filter(e => e.paymentMethod === 'pix' || e.paymentMethod === 'debit' || e.paymentMethod === 'cash')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalEconomicSpent,
      budgetConsumedSpent,
      cashOutflowSpent,
    };
  }, [currentMonthExpenses, activeInstallments, state.currentMonth]);

  // Intelligent Couple Audit, Duplication Detection & Reconciliation
  const [settlementSplitMode, setSettlementSplitMode] = useState<'fifty_fifty' | 'proportional'>('fifty_fifty');

  const detectedDuplicates = useMemo(() => {
    return detectDuplicateExpenses(state.expenses);
  }, [state.expenses]);

  const coupleSettlement = useMemo(() => {
    return calculateCoupleSettlement({
      expenses: state.expenses,
      currentMonth: state.currentMonth,
      partner1Name: state.profile.partner1Name,
      partner2Name: state.profile.partner2Name,
      partner1Income: state.profile.partner1Income,
      partner2Income: state.profile.partner2Income,
      splitMode: settlementSplitMode,
    });
  }, [state.expenses, state.currentMonth, state.profile.partner1Name, state.profile.partner2Name, state.profile.partner1Income, state.profile.partner2Income, settlementSplitMode]);

  const predictiveBurnAlerts = useMemo(() => {
    return calculatePredictiveBurnRates({
      categoriesSpending,
      currentMonth: state.currentMonth,
    });
  }, [categoriesSpending, state.currentMonth]);

  const resolveDuplicateMerge = useCallback((primaryId: string, duplicateIdsToDelete: string[]) => {
    setState(prev => {
      const toDelete = new Set(duplicateIdsToDelete);
      const filtered = prev.expenses.filter(e => !toDelete.has(e.id));
      return {
        ...prev,
        expenses: filtered,
      };
    });
    triggerCelebration();
  }, [triggerCelebration]);

  const recordSettlementCompleted = useCallback(() => {
    addNotification({
      title: 'Acerto do Casal Realizado! 🎉',
      message: `O acerto de contas de ${formatMonthYear(state.currentMonth)} foi marcado como quitado entre ${state.profile.partner1Name} e ${state.profile.partner2Name}.`,
      type: 'success',
    });
    triggerCelebration();
  }, [state.currentMonth, state.profile.partner1Name, state.profile.partner2Name, triggerCelebration]);

  const totalSpent = useMemo(() => {
    return Object.values(categoriesSpending).reduce((sum, c) => sum + c.spent, 0);
  }, [categoriesSpending]);

  const totalBudget = useMemo(() => {
    const invPct = state.profile.investmentsPercentage !== undefined
      ? state.profile.investmentsPercentage
      : (activeLifeTier.percentages.investimentos ?? 20);
    return (totalIncome * (100 - invPct)) / 100;
  }, [totalIncome, activeLifeTier, state.profile.investmentsPercentage]);

  const freeFlowingAmount = useMemo(() => {
    return Math.max(0, totalBudget - totalSpent);
  }, [totalBudget, totalSpent]);

  const displayedTotalSpent = useMemo(() => {
    if (viewMode === 'partner1') return partner1ShareSpent;
    if (viewMode === 'partner2') return partner2ShareSpent;
    return totalSpent;
  }, [viewMode, partner1ShareSpent, partner2ShareSpent, totalSpent]);

  const displayedRemaining = useMemo(() => {
    return Math.max(0, displayedIncome - displayedTotalSpent);
  }, [displayedIncome, displayedTotalSpent]);

  const totalSavedInPiggyBanks = useMemo(() => {
    return state.piggyBanks.reduce((sum, p) => sum + p.currentAmount, 0);
  }, [state.piggyBanks]);

  const totalMonthlyPiggyDeposits = useMemo(() => {
    return state.piggyBanks.reduce((sum, p) => sum + p.monthlyDeposit, 0);
  }, [state.piggyBanks]);

  const isOverBudget = totalSpent > totalBudget;

  const isCustomizedPercentages = useMemo(() => {
    if (state.isCustomizedPercentages) return true;
    const tierPcts = activeLifeTier.percentages;
    const pcts = state.categoryPercentages || {};
    const invPct = state.profile.investmentsPercentage !== undefined ? state.profile.investmentsPercentage : tierPcts.investimentos;
    if (invPct !== tierPcts.investimentos) return true;
    for (const key of ['moradia', 'comida', 'lazer', 'protecao', 'profissional'] as CategoryKey[]) {
      if (pcts[key] !== undefined && pcts[key] !== tierPcts[key]) {
        return true;
      }
    }
    return false;
  }, [state.isCustomizedPercentages, state.categoryPercentages, state.profile.investmentsPercentage, activeLifeTier]);

  const customizedCategoriesMap = useMemo(() => {
    const tierPcts = activeLifeTier.percentages;
    const pcts = state.categoryPercentages || {};
    const map: Record<string, { recommendedPct: number; currentPct: number; isCustom: boolean }> = {};

    (['moradia', 'comida', 'lazer', 'protecao', 'profissional'] as CategoryKey[]).forEach(key => {
      const rec = tierPcts[key];
      const cur = pcts[key] !== undefined ? pcts[key] : rec;
      map[key] = {
        recommendedPct: rec,
        currentPct: cur,
        isCustom: cur !== rec,
      };
    });

    const invRec = tierPcts.investimentos;
    const invCur = state.profile.investmentsPercentage !== undefined ? state.profile.investmentsPercentage : invRec;
    map['investimentos'] = {
      recommendedPct: invRec,
      currentPct: invCur,
      isCustom: invCur !== invRec,
    };

    return map;
  }, [activeLifeTier, state.categoryPercentages, state.profile.investmentsPercentage]);

  const pendingTierChangePrompt = useMemo(() => {
    if (!state.lastAcknowledgedTierKey) return null;
    if (state.lastAcknowledgedTierKey !== activeLifeTier.key && isCustomizedPercentages) {
      return {
        oldTierKey: state.lastAcknowledgedTierKey,
        oldTier: LIFE_TIERS[state.lastAcknowledgedTierKey],
        newTier: activeLifeTier,
      };
    }
    return null;
  }, [state.lastAcknowledgedTierKey, activeLifeTier, isCustomizedPercentages]);

  const categories: Record<CategoryKey, CategoryInfo> = useMemo(() => {
    const res = {} as Record<CategoryKey, CategoryInfo>;
    (Object.keys(CATEGORIES_BASE) as CategoryKey[]).forEach(key => {
      const base = CATEGORIES_BASE[key];
      const pct = (state.categoryPercentages && state.categoryPercentages[key] !== undefined)
        ? state.categoryPercentages[key]
        : (activeLifeTier.percentages[key] || 0);
      const budget = (totalIncome * pct) / 100;
      res[key] = {
        key,
        ...base,
        percentage: pct,
        budget,
      };
    });
    return res;
  }, [activeLifeTier, state.categoryPercentages, totalIncome]);

  const monthlyFixedExpensesAvg = useMemo(() => {
    const moradiaPct = (state.categoryPercentages && state.categoryPercentages.moradia !== undefined)
      ? state.categoryPercentages.moradia
      : (activeLifeTier.percentages.moradia || 30);
    const transportePct = (state.categoryPercentages && state.categoryPercentages.transporte !== undefined)
      ? state.categoryPercentages.transporte
      : (activeLifeTier.percentages.transporte || 10);
    const comidaPct = (state.categoryPercentages && state.categoryPercentages.comida !== undefined)
      ? state.categoryPercentages.comida
      : (activeLifeTier.percentages.comida || 15);
    const protecaoPct = (state.categoryPercentages && state.categoryPercentages.protecao !== undefined)
      ? state.categoryPercentages.protecao
      : (activeLifeTier.percentages.protecao || 10);

    const moradiaBudget = (totalIncome * moradiaPct) / 100;
    const transporteBudget = (totalIncome * transportePct) / 100;
    const comidaBudget = (totalIncome * comidaPct) / 100;
    const protecaoBudget = (totalIncome * protecaoPct) / 100;
    return moradiaBudget + transporteBudget + comidaBudget + protecaoBudget;
  }, [totalIncome, activeLifeTier, state.categoryPercentages]);

  const autoCalculatedProtectionTarget = useMemo(() => {
    const targetMonths = state.profile.emergencyReserveMonthsTarget || 6;
    return monthlyFixedExpensesAvg * targetMonths;
  }, [monthlyFixedExpensesAvg, state.profile.emergencyReserveMonthsTarget]);

  // Piso Intocável de Segurança (3 meses de custos fixos essenciais estritamente blindados)
  const emergencyReserveFloorAmount = useMemo(() => {
    return monthlyFixedExpensesAvg * 3;
  }, [monthlyFixedExpensesAvg]);

  // Excesso Alavancável para Objetivos ou Compras Estratégicas à Vista (saldo acima do piso)
  const emergencyReserveExcessAmount = useMemo(() => {
    return Math.max(0, state.protectionCurrentAmount - emergencyReserveFloorAmount);
  }, [state.protectionCurrentAmount, emergencyReserveFloorAmount]);

  // Historical 6 Months Trends
  const historicalTrends: MonthTrendRecord[] = useMemo(() => {
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const labels = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
    return months.map((mKey, idx) => {
      const isCur = mKey === state.currentMonth;
      if (isCur) {
        return {
          monthKey: mKey,
          label: labels[idx],
          spending: {
            moradia: categoriesSpending.moradia.spent,
            transporte: categoriesSpending.transporte.spent,
            comida: categoriesSpending.comida.spent,
            lazer: categoriesSpending.lazer.spent,
            protecao: categoriesSpending.protecao.spent,
            profissional: categoriesSpending.profissional.spent,
          },
          total: totalSpent,
          budget: totalBudget,
        };
      }
      // Sample trend points
      const mult = 0.85 + idx * 0.03;
      return {
        monthKey: mKey,
        label: labels[idx],
        spending: {
          moradia: 5500 * mult,
          transporte: 1600 * mult,
          comida: 3200 * mult,
          lazer: 2400 * mult,
          protecao: 1900 * mult,
          profissional: 1800 * mult,
        },
        total: Math.round(16400 * mult),
        budget: totalBudget,
      };
    });
  }, [state.currentMonth, categoriesSpending, totalSpent, totalBudget]);

  // ==========================================
  // ACTIONS: MEU PLUGGY & KEYWORD CATEGORIZATION
  // ==========================================
  const autoCategorizeDescription = (description: string) => {
    return categorizeTransaction(description, state.keywordRules || DEFAULT_KEYWORD_RULES);
  };

  const updatePluggyAccount = (id: string, updates: Partial<PluggyBankConnection>) => {
    setState(prev => ({
      ...prev,
      pluggyAccounts: (prev.pluggyAccounts || []).map(acc => (acc.id === id ? { ...acc, ...updates } : acc)),
    }));
  };

  const addPluggyAccount = (account: Omit<PluggyBankConnection, 'id'>) => {
    const newAcc: PluggyBankConnection = {
      ...account,
      id: 'pluggy-account:' + account.accountId,
    };
    setState(prev => ({
      ...prev,
      pluggyAccounts: [...(prev.pluggyAccounts || []).filter(a => a.accountId !== account.accountId), newAcc],
    }));
  };

  const removePluggyAccount = (id: string) => {
    setState(prev => ({
      ...prev,
      pluggyAccounts: (prev.pluggyAccounts || []).filter(acc => acc.id !== id),
    }));
  };

  const syncPluggyData = async () => {
    const userId = auth.currentUser?.uid;
    const itemIds = [...new Set((state.pluggyAccounts || []).filter(a => a.appOwner === userProfile?.partnerRole).map(a => a.itemId).filter(Boolean))];
    if (!itemIds.length) throw new Error('Conecte uma instituição antes de sincronizar.');
    setIsSyncingBanks(true);
    try {
      for (const itemId of itemIds) {
        const result = await authenticatedApi<{ source: string; simulated: boolean; transactions: Array<{ id: string; accountId: string; amount: number; date: string; description: string; type: string }> }>('/api/bank-sync/fetch', { itemId });
        if (result.simulated || result.source !== 'pluggy') throw new Error('A sincronização real está indisponível.');
        if (auth.currentUser?.uid !== userId) return;
        setState(prev => {
          const imported: BankImportedTransaction[] = [...(prev.bankImportedTransactions || [])];
          for (const transaction of result.transactions || []) {
            if (!transaction.id || !transaction.accountId || !Number.isFinite(transaction.amount)) continue;
            const id = transaction.id;
            if (imported.some(e => e.id === id) || prev.expenses.some(e => e.id === id) || prev.incomes.some(i => i.id === id)) continue;
            const account = prev.pluggyAccounts.find(a => a.accountId === transaction.accountId);
            const owner: PaidBy = account?.owner || userProfile?.partnerRole || 'both';
            const amount = Math.round(Math.abs(transaction.amount) * 100) / 100;
            const date = transaction.date.slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || amount <= 0) continue;
            imported.push({ id, itemId, accountId: transaction.accountId, amount, date, description: transaction.description || 'Lançamento bancário', direction: transaction.type === 'CREDIT' ? 'credit' : 'debit', owner, status: 'pending' });
          }
          return { ...prev, bankImportedTransactions: imported, pluggyAccounts: prev.pluggyAccounts.map(a => a.itemId === itemId ? { ...a, lastSynced: new Date().toISOString(), status: 'connected' as const } : a) };
        });
      }
    } catch (error) {
      setState(prev => ({ ...prev, pluggyAccounts: prev.pluggyAccounts.map(a => itemIds.includes(a.itemId) ? { ...a, status: 'error' as const } : a) }));
      throw error;
    } finally { setIsSyncingBanks(false); }
  };

  const importStatement = (items: BankImportedTransaction[]) => setState(prev => {
    const existing = new Set((prev.bankImportedTransactions || []).map(item => item.id));
    return { ...prev, bankImportedTransactions: [...(prev.bankImportedTransactions || []), ...items.filter(item => !existing.has(item.id) && !prev.expenses.some(e => e.id === item.id) && !prev.incomes.some(i => i.id === item.id))] };
  });
  const reviewBankTransaction = (id: string, classification: 'expense' | 'income' | 'internal_transfer', category: CategoryKey = 'lazer') => {
    setState(prev => {
      const transaction = prev.bankImportedTransactions?.find(t => t.id === id);
      if (!transaction || transaction.status !== 'pending') return prev;
      const expenses = [...prev.expenses];
      const incomes = [...prev.incomes];
      if (classification === 'income' && transaction.direction !== 'credit') throw new Error('Um débito não pode ser classificado como receita.');
      if (classification === 'expense' && transaction.direction !== 'debit') throw new Error('Um crédito não pode ser classificado como despesa.');
      if (classification === 'income' && !incomes.some(i => i.id === id)) incomes.push({ id, amount: transaction.amount, date: transaction.date, description: transaction.description, recipient: transaction.owner, type: 'outro' });
      if (classification === 'expense' && !expenses.some(e => e.id === id)) expenses.push({ id, amount: transaction.amount, date: transaction.date, description: transaction.description, paidBy: transaction.owner, category, triageDone: true });
      return { ...prev, expenses, incomes, bankImportedTransactions: prev.bankImportedTransactions!.map(t => t.id === id ? { ...t, status: classification } : t) };
    });
  };

  const updateFiscalProfile = (partner: 'partner1' | 'partner2', fiscal: Partial<FiscalProfile>) => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [partner === 'partner1' ? 'partner1Fiscal' : 'partner2Fiscal']: {
          ...(prev.profile[partner === 'partner1' ? 'partner1Fiscal' : 'partner2Fiscal'] || {}),
          ...fiscal,
        },
      },
    }));
  };

  const confirmPendingIncome = (
    confirmationId: string,
    classification: IncomeSourceClassification,
    customTaxRate?: number,
    rememberRule: boolean = true
  ) => {
    const confirmation = (state.pendingConfirmations || []).find(c => c.id === confirmationId);
    if (!confirmation) return;

    let netAmount = confirmation.amount;
    let descriptionNote = '';

    if (classification === 'pj_gross') {
      const taxRate =
        customTaxRate ??
        (confirmation.recipient === 'partner2'
          ? state.profile.partner2Fiscal?.cnpjTaxRate
          : state.profile.partner1Fiscal?.cnpjTaxRate) ??
        6;
      const calc = calculateNetLiquidFromGross(confirmation.amount, taxRate, 0);
      netAmount = calc.netLiquid;
      descriptionNote = `(Bruto: ${formatCurrency(confirmation.amount)} - ${taxRate}% Simples)`;
    }

    // Se for transferência interna ou reembolso, NÃO entra como renda
    if (classification !== 'internal_transfer' && classification !== 'reimbursement') {
      const newIncome: IncomeItem = {
        id: `inc-${Date.now()}`,
        description: `${confirmation.sourceName} ${descriptionNote}`.trim(),
        amount: netAmount,
        date: confirmation.date || new Date().toISOString().split('T')[0],
        recipient: confirmation.recipient,
        type: classification === 'pj_gross' ? 'outro' : 'salario',
      };

      setState(prev => ({
        ...prev,
        incomes: [newIncome, ...prev.incomes],
      }));
    }

    // Memoriza a regra para automatizar fontes futuras
    if (rememberRule) {
      const newRule: IncomeSourceRule = {
        id: `rule-src-${Date.now()}`,
        sourceName: confirmation.sourceName,
        sourceTaxNumber: confirmation.sourceTaxNumber,
        classification,
        customTaxRate,
        partner: confirmation.recipient,
        createdAt: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        incomeSourceRules: [
          newRule,
          ...(prev.incomeSourceRules || []).filter(
            r => r.sourceName.toLowerCase() !== confirmation.sourceName.toLowerCase()
          ),
        ],
      }));
    }

    // Remove a pendência e adiciona notificação
    setState(prev => ({
      ...prev,
      pendingConfirmations: (prev.pendingConfirmations || []).filter(c => c.id !== confirmationId),
      notifications: [
        {
          id: `notif-inc-conf-${Date.now()}`,
          title: classification === 'internal_transfer' ? 'Movimentação Interna Registrada' : 'Renda Líquida Confirmada! 💼',
          message:
            classification === 'internal_transfer'
              ? `O recebimento de ${formatCurrency(confirmation.amount)} foi classificado como movimentação interna entre contas do casal e não alterou a faixa de renda.`
              : `O recebimento de ${formatCurrency(confirmation.amount)} foi classificado e ${formatCurrency(netAmount)} líquidos foram computados na ${activeLifeTier.name}.`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));

    triggerCelebration();
  };

  const dismissPendingIncome = (confirmationId: string) => {
    setState(prev => ({
      ...prev,
      pendingConfirmations: (prev.pendingConfirmations || []).filter(c => c.id !== confirmationId),
    }));
  };

  const addIncomeSourceRule = (rule: Omit<IncomeSourceRule, 'id' | 'createdAt'>) => {
    const newRule: IncomeSourceRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      incomeSourceRules: [newRule, ...(prev.incomeSourceRules || [])],
    }));
  };

  const removeIncomeSourceRule = (id: string) => {
    setState(prev => ({
      ...prev,
      incomeSourceRules: (prev.incomeSourceRules || []).filter(r => r.id !== id),
    }));
  };

  const simulateNewDepositConfirmation = (amount: number = 8500, sourceName: string = 'Hospital Sírio-Libanês') => {
    const newConf: PendingIncomeConfirmation = {
      id: `conf-${Date.now()}`,
      amount,
      sourceName,
      date: new Date().toISOString().split('T')[0],
      recipient: 'partner1',
      suggestedClassification: 'pj_gross',
    };
    setState(prev => ({
      ...prev,
      pendingConfirmations: [newConf, ...(prev.pendingConfirmations || [])],
    }));
  };

  const updateKeywordRules = (rules: CategoryKeywordRule[]) => {
    setState(prev => ({ ...prev, keywordRules: rules }));
  };

  const addKeywordRule = (rule: Omit<CategoryKeywordRule, 'id'>) => {
    const newRule: CategoryKeywordRule = {
      ...rule,
      id: `kw-${Date.now()}`,
    };
    setState(prev => ({
      ...prev,
      keywordRules: [...(prev.keywordRules || DEFAULT_KEYWORD_RULES), newRule],
    }));
  };

  const removeKeywordRule = (id: string) => {
    setState(prev => ({
      ...prev,
      keywordRules: (prev.keywordRules || DEFAULT_KEYWORD_RULES).filter(r => r.id !== id),
    }));
  };

  const dismissSubscription = (id: string) => {
    setState(prev => ({
      ...prev,
      detectedSubscriptions: (prev.detectedSubscriptions || []).map(sub =>
        sub.id === id ? { ...sub, status: 'dismissed' } : sub
      ),
    }));
  };

  const confirmSubscriptionAsExpense = (id: string) => {
    const sub = (state.detectedSubscriptions || []).find(s => s.id === id);
    if (!sub) return;

    const newExp: ExpenseItem = {
      id: `exp-sub-${Date.now()}`,
      description: `${sub.merchant} (Assinatura)`,
      amount: sub.amount,
      category: sub.category,
      date: new Date().toISOString().slice(0, 10),
      paidBy: 'both',
      bankName: 'Meu Pluggy Auto',
    };

    setState(prev => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
      detectedSubscriptions: (prev.detectedSubscriptions || []).map(s =>
        s.id === id ? { ...s, status: 'active' } : s
      ),
      notifications: [
        {
          id: `notif-sub-conf-${Date.now()}`,
          title: 'Assinatura Confirmada!',
          message: `A assinatura ${sub.merchant} de R$ ${sub.amount.toFixed(2)} foi inserida nos gastos do mês.`,
          timestamp: 'Agora',
          type: 'success',
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
    triggerCelebration();
  };

  const addSubscription = (sub: Omit<DetectedSubscription, 'id'>) => {
    const newSub: DetectedSubscription = {
      ...sub,
      id: `sub-${Date.now()}`,
      status: sub.status || 'active',
    };
    setState(prev => ({
      ...prev,
      detectedSubscriptions: [newSub, ...(prev.detectedSubscriptions || [])],
    }));
    triggerCelebration();
  };

  const removeSubscription = (id: string) => {
    setState(prev => ({
      ...prev,
      detectedSubscriptions: (prev.detectedSubscriptions || []).filter(s => s.id !== id),
    }));
  };

  // ==========================================
  // EXPENSES, INCOMES, INSTALLMENTS & PIGGYBANKS
  // ==========================================
  const addExpense = (expense: Omit<ExpenseItem, 'id'>) => {
    let finalCat = expense.category;
    let finalSub = expense.subcategory;
    if (expense.description) {
      const match = autoCategorizeDescription(expense.description);
      if (match.matchedKeyword) {
        // REGRA DE PROTEÇÃO: Nunca sobrescreve uma categoria explicitamente selecionada
        if (!finalCat) {
          finalCat = match.category;
          if (!finalSub) finalSub = match.subcategory;
        } else if (!finalSub && match.category === finalCat) {
          finalSub = match.subcategory;
        }
      }
    }

    const fundingSource: FundingSourceType = expense.fundingSource || 'month_budget';
    const isExcluded = fundingSource !== 'month_budget' || !!expense.isExcludedFromMonthlyBudget;

    const newExpense: ExpenseItem = {
      ...expense,
      category: finalCat,
      subcategory: finalSub,
      fundingSource,
      isExcludedFromMonthlyBudget: isExcluded,
      triageDone: expense.triageDone ?? (fundingSource !== 'month_budget'),
      id: `exp-${Date.now()}`,
    };

    setState(prev => {
      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextPiggyBanks = prev.piggyBanks;
      let nextIntents = prev.strategicIntents || [];

      // 1. Se a fonte for Excesso da Reserva: deduz do saldo da reserva de emergência
      if (fundingSource === 'reserve_excess') {
        nextProtAmount = Math.max(0, nextProtAmount - newExpense.amount);
        nextProtInvested = Math.max(0, nextProtInvested - newExpense.amount);
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      }

      // 2. Se a fonte for Caixinha / Cofrinho de Objetivo: deduz do saldo do cofrinho
      if (fundingSource === 'piggy_bank' && newExpense.fundingGoalId) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === newExpense.fundingGoalId) {
            const nextCur = Math.max(0, g.currentAmount - newExpense.amount);
            return {
              ...g,
              currentAmount: nextCur,
              completed: nextCur >= g.targetAmount,
            };
          }
          return g;
        });
      }

      // 3. Se for vinculada a uma Intenção Estratégica prévia: marca como executada
      if (newExpense.strategicIntentId) {
        nextIntents = nextIntents.map(intent =>
          intent.id === newExpense.strategicIntentId
            ? { ...intent, status: 'executed' as const, matchedExpenseId: newExpense.id }
            : intent
        );
      }

      const newExpenses = [newExpense, ...prev.expenses];
      const newNotifications = [...prev.notifications];
      const catInfo = getCategoryInfo(newExpense.category);

      if (isExcluded) {
        const sourceLabel =
          fundingSource === 'reserve_excess'
            ? 'Excesso da Reserva de Proteção'
            : fundingSource === 'piggy_bank'
            ? (newExpense.fundingGoalName || 'Caixinha de Objetivo')
            : 'Mesada Individual';

        newNotifications.unshift({
          id: `notif-exp-strat-${Date.now()}`,
          title: 'Gasto Estratégico Registrado 🎯',
          message: `"${newExpense.description}" (R$ ${newExpense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) saiu de ${sourceLabel}. A margem da categoria ${catInfo.name} continua 100% protegida para o dia a dia!`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        });
      } else if (newExpense.amount >= 1000) {
        newNotifications.unshift({
          id: `notif-exp-${Date.now()}`,
          title: 'Gasto Relevante Registrado 💳',
          message: `"${newExpense.description}" no valor de R$ ${newExpense.amount.toLocaleString('pt-BR')} foi adicionado em ${catInfo.name}.`,
          timestamp: 'Agora mesmo',
          type: 'info',
          isRead: false,
          category: newExpense.category,
          amount: newExpense.amount,
        });
      }

      return {
        ...prev,
        expenses: newExpenses,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
        strategicIntents: nextIntents,
        notifications: newNotifications,
      };
    });

    triggerCelebration();
  };

  const updateExpense = (id: string, updatedFields: Partial<ExpenseItem>) => {
    editExpense(id, updatedFields);
  };

  const deleteExpense = (id: string) => {
    setState(prev => {
      const target = prev.expenses.find(e => e.id === id);
      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextPiggyBanks = prev.piggyBanks;

      // Reverter dedução se o gasto era de reserva ou caixinha
      if (target?.fundingSource === 'reserve_excess') {
        nextProtAmount += target.amount;
        nextProtInvested += target.amount;
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      } else if (target?.fundingSource === 'piggy_bank' && target.fundingGoalId) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === target.fundingGoalId) {
            const nextCur = g.currentAmount + target.amount;
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      return {
        ...prev,
        expenses: prev.expenses.filter(e => e.id !== id),
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
      };
    });
  };

  // ==========================================
  // TRIAGEM OMNIPRESENTE & INTENÇÕES ESTRATÉGICAS
  // ==========================================
  const addStrategicIntent = (intent: Omit<StrategicSpendingIntent, 'id' | 'createdAt' | 'status'>) => {
    const newIntent: StrategicSpendingIntent = {
      ...intent,
      id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setState(prev => {
      const sourceLabel =
        newIntent.targetSource === 'reserve_excess'
          ? 'Excesso da Reserva de Proteção'
          : newIntent.targetSource === 'piggy_bank'
          ? (newIntent.targetGoalName || 'Caixinha de Objetivo')
          : 'Orçamento do Mês';

      const notif: AppNotification = {
        id: `notif-intent-add-${Date.now()}`,
        title: 'Intenção Estratégica Cadastrada! 🎯✨',
        message: `O gasto planejado "${newIntent.title}" (R$ ${newIntent.estimatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) foi registrado para sair de ${sourceLabel}. Quando a compra passar no extrato, ela será reconciliada automaticamente sem afetar o teto do mês!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        strategicIntents: [newIntent, ...(prev.strategicIntents || [])],
        notifications: [notif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const updateStrategicIntent = (id: string, updates: Partial<StrategicSpendingIntent>) => {
    setState(prev => ({
      ...prev,
      strategicIntents: (prev.strategicIntents || []).map(i => (i.id === id ? { ...i, ...updates } : i)),
    }));
  };

  const deleteStrategicIntent = (id: string) => {
    setState(prev => ({
      ...prev,
      strategicIntents: (prev.strategicIntents || []).filter(i => i.id !== id),
    }));
  };

  const reconcileExpenseWithIntent = (expenseId: string, intentId: string) => {
    setState(prev => {
      const targetExp = prev.expenses.find(e => e.id === expenseId);
      const targetIntent = (prev.strategicIntents || []).find(i => i.id === intentId);
      if (!targetExp || !targetIntent) return prev;

      const fundingSource = targetIntent.targetSource;
      const isExcluded = fundingSource !== 'month_budget';

      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextPiggyBanks = prev.piggyBanks;

      if (fundingSource === 'reserve_excess') {
        nextProtAmount = Math.max(0, nextProtAmount - targetExp.amount);
        nextProtInvested = Math.max(0, nextProtInvested - targetExp.amount);
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      } else if (fundingSource === 'piggy_bank' && targetIntent.targetGoalId) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === targetIntent.targetGoalId) {
            const nextCur = Math.max(0, g.currentAmount - targetExp.amount);
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      const updatedExpenses: ExpenseItem[] = prev.expenses.map(e => {
        if (e.id === expenseId) {
          return {
            ...e,
            category: targetIntent.category,
            fundingSource,
            fundingGoalId: targetIntent.targetGoalId,
            fundingGoalName: targetIntent.targetGoalName,
            strategicIntentId: intentId,
            isExcludedFromMonthlyBudget: isExcluded,
            triageDone: true,
            reconciledWithIntent: true,
          };
        }
        return e;
      });

      const updatedIntents = (prev.strategicIntents || []).map(i => {
        if (i.id === intentId) {
          return { ...i, status: 'matched' as const, matchedExpenseId: expenseId };
        }
        return i;
      });

      const notif: AppNotification = {
        id: `notif-reconciled-${Date.now()}`,
        title: 'Reconciliação Automática Concluída! 🎯✨',
        message: `A compra "${targetExp.description}" (R$ ${targetExp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) foi vinculada à intenção "${targetIntent.title}". A margem da categoria ${CATEGORIES_BASE[targetIntent.category]?.name} permanece 100% protegida.`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        expenses: updatedExpenses,
        strategicIntents: updatedIntents,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
        notifications: [notif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const updateExpenseTriage = (
    expenseId: string,
    triageData: {
      assignedTo?: 'couple' | 'partner1' | 'partner2';
      paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
      fundingSource?: FundingSourceType;
      fundingGoalId?: string;
      fundingGoalName?: string;
      isExcludedFromMonthlyBudget?: boolean;
    }
  ) => {
    setState(prev => {
      const targetExp = prev.expenses.find(e => e.id === expenseId);
      if (!targetExp) return prev;

      const oldSource = targetExp.fundingSource || 'month_budget';
      const newSource = triageData.fundingSource || oldSource;
      const isExcluded = newSource !== 'month_budget';

      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextPiggyBanks = prev.piggyBanks;

      // Reverter impacto anterior se mudou de fonte
      if (oldSource === 'reserve_excess' && newSource !== 'reserve_excess') {
        nextProtAmount += targetExp.amount;
        nextProtInvested += targetExp.amount;
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      } else if (oldSource === 'piggy_bank' && targetExp.fundingGoalId && newSource !== 'piggy_bank') {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === targetExp.fundingGoalId) {
            const nextCur = g.currentAmount + targetExp.amount;
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      // Aplicar novo impacto
      if (newSource === 'reserve_excess' && oldSource !== 'reserve_excess') {
        nextProtAmount = Math.max(0, nextProtAmount - targetExp.amount);
        nextProtInvested = Math.max(0, nextProtInvested - targetExp.amount);
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      } else if (newSource === 'piggy_bank' && triageData.fundingGoalId && oldSource !== 'piggy_bank') {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === triageData.fundingGoalId) {
            const nextCur = Math.max(0, g.currentAmount - targetExp.amount);
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      const updatedExpenses: ExpenseItem[] = prev.expenses.map(e => {
        if (e.id === expenseId) {
          return {
            ...e,
            ...triageData,
            fundingSource: newSource,
            isExcludedFromMonthlyBudget: isExcluded,
            triageDone: true,
            paidBy:
              triageData.assignedTo === 'partner1'
                ? 'partner1'
                : triageData.assignedTo === 'partner2'
                ? 'partner2'
                : 'both',
          };
        }
        return e;
      });

      const sourceLabel =
        newSource === 'reserve_excess'
          ? 'Excesso da Reserva'
          : newSource === 'piggy_bank'
          ? (triageData.fundingGoalName || 'Caixinha de Objetivo')
          : newSource === 'personal_allowance'
          ? 'Mesada Individual'
          : 'Orçamento do Mês';

      const notif: AppNotification = {
        id: `notif-triage-${Date.now()}`,
        title: 'Triagem Concluída! 🏷️⚡',
        message: `A despesa "${targetExp.description}" foi alocada em "${sourceLabel}". O orçamento da categoria foi ajustado automaticamente.`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        expenses: updatedExpenses,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
        notifications: [notif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const addIncome = (income: Omit<IncomeItem, 'id'>) => {
    const newIncome: IncomeItem = {
      ...income,
      id: `inc-${Date.now()}`,
    };
    setState(prev => ({
      ...prev,
      incomes: [newIncome, ...prev.incomes],
    }));
  };

  const deleteIncome = (id: string, forceUnlink = false) => {
    setState(prev => {
      const allocated = (prev.shiftIncomeAllocations || []).find(ledger => ledger.id === id);
      const linkedShifts = (prev.medicalShifts || []).filter(shift => shift.linkedIncomeId === id);

      if (!forceUnlink && ((allocated && Object.keys(allocated.allocations).length > 0) || linkedShifts.length > 0)) {
        return {
          ...prev,
          incomes: prev.incomes,
          notifications: [
            {
              id: 'linked-income:' + id,
              title: 'Recebimento vinculado a plantões',
              message: 'Este recebimento está vinculado a plantões médicos. Clique em Estornar no Extrato para desvincular e reabrir os plantões.',
              timestamp: 'Agora',
              type: 'alert' as const,
              isRead: false,
            },
            ...prev.notifications.filter(n => n.id !== 'linked-income:' + id),
          ],
        };
      }

      // Revert linked medical shifts so they return to unpayout status
      const updatedShifts = (prev.medicalShifts || []).map(shift => {
        if (shift.linkedIncomeId === id) {
          return {
            ...shift,
            status: 'pending' as const,
            linkedIncomeId: undefined,
          };
        }
        return shift;
      });

      const updatedAllocations = (prev.shiftIncomeAllocations || []).filter(l => l.id !== id);

      return {
        ...prev,
        incomes: prev.incomes.filter(i => i.id !== id),
        medicalShifts: updatedShifts,
        shiftIncomeAllocations: updatedAllocations,
        notifications: linkedShifts.length > 0
          ? [
              {
                id: `notif-shift-unlinked-${Date.now()}`,
                title: 'Estorno de Depósito Médico 🩺',
                message: 'O recebimento de plantão foi removido e os plantões vinculados voltaram ao status pendente de recebimento.',
                timestamp: 'Agora mesmo',
                type: 'info' as const,
                isRead: false,
              },
              ...prev.notifications,
            ]
          : prev.notifications,
      };
    });
  };

  const addInstallment = (
    installment: Omit<InstallmentPurchase, 'id' | 'paidInstallmentsCount' | 'active'>
  ) => {
    const newInstallment: InstallmentPurchase = {
      ...installment,
      id: `inst-${Date.now()}`,
      paidInstallmentsCount: 0,
      active: true,
    };
    setState(prev => ({
      ...prev,
      installments: [newInstallment, ...prev.installments],
    }));
  };

  const recordInstallmentPayment = (id: string) => {
    setState(prev => {
      const updated = prev.installments.map(inst => {
        if (inst.id === id) {
          const nextCount = inst.paidInstallmentsCount + 1;
          const isDone = nextCount >= inst.installmentsCount;
          return {
            ...inst,
            paidInstallmentsCount: nextCount,
            active: !isDone,
            completedNotified: isDone ? false : inst.completedNotified,
          };
        }
        return inst;
      });

      const finishedOne = updated.find(i => i.id === id && !i.active);
      const newNotifications = [...prev.notifications];

      if (finishedOne) {
        newNotifications.unshift({
          id: `notif-done-${Date.now()}`,
          title: 'Parcela 100% Quitada! 🎉',
          message: `A compra "${finishedOne.title}" foi totalmente paga. Vocês liberaram +R$ ${finishedOne.installmentAmount.toLocaleString('pt-BR')}/mês!`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        });
        triggerCelebration();
      }

      return {
        ...prev,
        installments: updated,
        notifications: newNotifications,
      };
    });
  };

  const markInstallmentPaidStep = recordInstallmentPayment;

  const deleteInstallment = (id: string) => {
    setState(prev => ({
      ...prev,
      installments: prev.installments.filter(i => i.id !== id),
    }));
  };

  const dismissCompletedInstallmentNotification = (id: string) => {
    setState(prev => ({
      ...prev,
      installments: prev.installments.map(i =>
        i.id === id ? { ...i, completedNotified: true } : i
      ),
    }));
  };

  const addPiggyBank = (piggy: Omit<SavingsPiggyBank, 'id'>) => {
    const id = `piggy-${Date.now()}`;
    const newPiggy: SavingsPiggyBank = {
      ...piggy,
      id,
      currentAmount: piggy.currentAmount ?? 0,
    };
    const newCoupleGoal: import('../types/finance').CoupleGoal = {
      id,
      title: piggy.name,
      category: 'reserva',
      emoji: piggy.emoji || '🎯',
      targetAmount: piggy.targetAmount,
      currentAmount: piggy.currentAmount ?? 0,
      partner1Contribution: (piggy.currentAmount ?? 0) / 2,
      partner2Contribution: (piggy.currentAmount ?? 0) / 2,
      monthlyPlannedDeposit: piggy.monthlyDeposit || 0,
      isCompleted: (piggy.currentAmount ?? 0) >= piggy.targetAmount,
      history: [],
      createdAt: new Date().toISOString().split('T')[0],
      coupleAgreement: piggy.coupleAgreement,
    };
    setState(prev => ({
      ...prev,
      piggyBanks: [...prev.piggyBanks, newPiggy],
      coupleGoals: [...(prev.coupleGoals || []).filter(cg => cg.id !== id), newCoupleGoal],
    }));
    triggerCelebration();
  };

  const updatePiggyBank = (id: string, updates: Partial<SavingsPiggyBank>) => {
    setState(prev => {
      const updatedPiggy = prev.piggyBanks.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          if (updated.targetAmount !== undefined && updated.currentAmount !== undefined) {
            updated.completed = updated.currentAmount >= updated.targetAmount;
          }
          return updated;
        }
        return p;
      });

      const updatedCoupleGoals = (prev.coupleGoals || []).map(cg => {
        if (cg.id === id) {
          const title = updates.name !== undefined ? updates.name : cg.title;
          const emoji = updates.emoji !== undefined ? updates.emoji : cg.emoji;
          const targetAmount = updates.targetAmount !== undefined ? updates.targetAmount : cg.targetAmount;
          const currentAmount = updates.currentAmount !== undefined ? updates.currentAmount : cg.currentAmount;
          const monthlyPlannedDeposit = updates.monthlyDeposit !== undefined ? updates.monthlyDeposit : cg.monthlyPlannedDeposit;
          const coupleAgreement = updates.coupleAgreement !== undefined ? updates.coupleAgreement : cg.coupleAgreement;
          return {
            ...cg,
            title,
            emoji,
            targetAmount,
            currentAmount,
            monthlyPlannedDeposit,
            coupleAgreement,
            isCompleted: currentAmount >= targetAmount,
          };
        }
        return cg;
      });

      return {
        ...prev,
        piggyBanks: updatedPiggy,
        coupleGoals: updatedCoupleGoals,
      };
    });
  };

  const deletePiggyBank = (id: string) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.filter(p => p.id !== id),
      coupleGoals: (prev.coupleGoals || []).filter(cg => cg.id !== id),
    }));
  };

  const removePiggyBank = deletePiggyBank;

  const depositPiggyBank = (id: string, amount: number, contributor?: 'partner1' | 'partner2' | 'both', note?: string) => {
    setState(prev => {
      let justCompleted = false;
      const updatedPiggy = prev.piggyBanks.map(p => {
        if (p.id === id) {
          const nextAmount = p.currentAmount + amount;
          if (nextAmount >= p.targetAmount && p.currentAmount < p.targetAmount) {
            justCompleted = true;
          }
          return {
            ...p,
            currentAmount: nextAmount,
            completed: nextAmount >= p.targetAmount,
          };
        }
        return p;
      });

      const p1Name = prev.profile.partner1Name || 'Pessoa 1';
      const p2Name = prev.profile.partner2Name === 'Aguardando Par...' ? 'Pessoa 2' : prev.profile.partner2Name || 'Pessoa 2';
      const contrib = contributor || 'both';
      const contributorName = contrib === 'partner1' ? p1Name : contrib === 'partner2' ? p2Name : `${p1Name} & ${p2Name}`;

      let p1Add = 0;
      let p2Add = 0;
      if (contrib === 'partner1') p1Add = amount;
      else if (contrib === 'partner2') p2Add = amount;
      else { p1Add = amount / 2; p2Add = amount / 2; }

      const updatedCoupleGoals = (prev.coupleGoals || []).map(cg => {
        if (cg.id === id) {
          const nextCur = Math.max(0, cg.currentAmount + amount);
          const histItem: import('../types/finance').CoupleGoalContribution = {
            id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            contributor: contrib,
            contributorName,
            amount: Math.abs(amount),
            date: new Date().toISOString().split('T')[0],
            type: amount >= 0 ? 'deposit' : 'withdrawal',
            note,
          };
          return {
            ...cg,
            currentAmount: nextCur,
            partner1Contribution: Math.max(0, cg.partner1Contribution + p1Add),
            partner2Contribution: Math.max(0, cg.partner2Contribution + p2Add),
            isCompleted: nextCur >= cg.targetAmount,
            history: [histItem, ...(cg.history || [])],
          };
        }
        return cg;
      });

      const newNotifs = [...prev.notifications];
      if (justCompleted) {
        const goal = updatedPiggy.find(p => p.id === id);
        newNotifs.unshift({
          id: `notif-goal-${Date.now()}`,
          title: 'Meta Alcançada com Sucesso! 🏆',
          message: `Parabéns ao casal! O objetivo "${goal?.name}" atingiu 100% do valor estipulado!`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        });
        triggerCelebration();
      }

      return {
        ...prev,
        piggyBanks: updatedPiggy,
        coupleGoals: updatedCoupleGoals,
        notifications: newNotifs,
      };
    });
  };

  const depositToPiggyBank = depositPiggyBank;

  const withdrawPiggyBank = (id: string, amount: number) => {
    depositPiggyBank(id, -Math.abs(amount));
  };

  const withdrawFromPiggyBank = withdrawPiggyBank;

  const payFixedBill = (billId: string, monthKey?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setState(prev => {
      const mKey = monthKey || prev.currentMonth;
      const targetBill = (prev.coupleFixedBills || []).find(b => b.id === billId);
      if (!targetBill) return prev;

      const autoExpense: ExpenseItem = {
        id: `exp-fb-${billId}-${mKey}`,
        linkedBillId: billId,
        billCompetenceMonth: mKey,
        description: `[Conta Fixa] ${targetBill.title}`,
        amount: targetBill.amount,
        category: targetBill.category,
        date: todayStr,
        paidBy: targetBill.assignedPayer === 'both' ? 'both' : targetBill.assignedPayer,
        notes: `Pagamento de conta fixa do mês de ${mKey} (Vencimento dia ${targetBill.dueDay})`,
        fundingSource: 'month_budget',
        assignedTo: 'couple',
        paymentMethod: targetBill.autoPay ? 'debit' : 'pix',
      };

      const updatedBills = (prev.coupleFixedBills || []).map(b =>
        b.id === billId ? { ...b, status: 'paid' as const, lastPaidMonth: mKey } : b
      );

      // Avoid duplicating if already present
      const existingExp = prev.expenses.some(e => e.linkedBillId === billId && e.billCompetenceMonth === mKey);
      const updatedExpenses = existingExp ? prev.expenses : [autoExpense, ...prev.expenses];

      return {
        ...prev,
        coupleFixedBills: updatedBills,
        expenses: updatedExpenses,
      };
    });
  };

  const unpayFixedBill = (billId: string, monthKey?: string) => {
    setState(prev => {
      const mKey = monthKey || prev.currentMonth;
      const targetBill = (prev.coupleFixedBills || []).find(b => b.id === billId);
      if (!targetBill) return prev;

      const updatedBills = (prev.coupleFixedBills || []).map(b =>
        b.id === billId ? { ...b, status: 'pending' as const } : b
      );

      // Remove strictly expenses linked by linkedBillId and billCompetenceMonth (or description match within competence month)
      const updatedExpenses = prev.expenses.filter(e => {
        if (e.linkedBillId === billId && e.billCompetenceMonth === mKey) return false;
        if (!e.linkedBillId && e.description === `[Conta Fixa] ${targetBill.title}` && e.date.startsWith(mKey)) return false;
        return true;
      });

      return {
        ...prev,
        coupleFixedBills: updatedBills,
        expenses: updatedExpenses,
      };
    });
  };

  const convertWishlistToGoal = (wishlistId: string) => {
    setState(prev => {
      const item = (prev.coupleWishlist || []).find(w => w.id === wishlistId);
      if (!item) return prev;

      const newGoalId = `goal-${Date.now()}`;
      const targetPrice = item.estimatedPrice;

      const newPiggy: SavingsPiggyBank = {
        id: newGoalId,
        name: item.title,
        emoji: item.emoji,
        purpose: `Desejo do Casal convertido: ${item.notes || item.category}`,
        targetAmount: targetPrice,
        monthlyDeposit: Math.round(targetPrice / 6),
        currentAmount: 0,
        completed: false,
      };

      const newCoupleGoal: import('../types/finance').CoupleGoal = {
        id: newGoalId,
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

      const updatedWishlist = (prev.coupleWishlist || []).map(w =>
        w.id === wishlistId ? { ...w, status: 'convertido_meta' as const, convertedGoalId: newGoalId } : w
      );

      return {
        ...prev,
        piggyBanks: [...prev.piggyBanks, newPiggy],
        coupleGoals: [...(prev.coupleGoals || []), newCoupleGoal],
        coupleWishlist: updatedWishlist,
      };
    });
    triggerCelebration();
  };

  const setGoalCoupleAgreement = (goalId: string, agreement: import('../types/finance').CoupleAgreement) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.map(p => p.id === goalId ? { ...p, coupleAgreement: agreement } : p),
      coupleGoals: (prev.coupleGoals || []).map(cg => cg.id === goalId ? { ...cg, coupleAgreement: agreement } : cg),
    }));
  };

  const recordWeeklyCheckIn = (date?: string) => {
    const checkInDate = date || new Date().toISOString().slice(0, 10);
    setState(prev => ({
      ...prev,
      lastWeeklyCheckInAt: checkInDate,
    }));
  };

  const syncBankAccounts = async () => {
    await syncPluggyData();
  };

  const triggerBankSync = syncPluggyData;

  const markNotificationAsRead = (id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  };

  const markNotificationRead = markNotificationAsRead;

  const markAllNotificationsRead = () => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
    }));
  };

  const deleteNotification = (id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    setState(prev => ({
      ...prev,
      notifications: [
        {
          ...notif,
          id: `notif-${Date.now()}`,
          timestamp: 'Agora',
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const updatePushSettings = useCallback((updates: Partial<PushNotificationSettings>) => {
    setState(prev => ({
      ...prev,
      pushSettings: {
        ...(prev.pushSettings || DEFAULT_PUSH_SETTINGS),
        ...updates,
      },
    }));
  }, []);

  useEffect(() => {
    checkAndTriggerScheduledPushNotifications(
      state,
      (updates) => updatePushSettings(updates),
      (notif) => addNotification(notif)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.expenses, state.pendingConfirmations, state.currentMonth]);

  // ==========================================
  // GESTÃO DE PLANTÕES MÉDICOS & ESCALAS
  // ==========================================
  const addMedicalShift = (shift: Omit<MedicalShift, 'id'>) => {
    const newShift: MedicalShift = {
      ...shift,
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setState(prev => ({
      ...prev,
      medicalShifts: [newShift, ...(prev.medicalShifts || [])],
    }));
    triggerCelebration();
  };

  const updateMedicalShift = (id: string, updates: Partial<MedicalShift>) => {
    setState(prev => {
      const shift = prev.medicalShifts?.find(s => s.id === id);
      const linked = prev.shiftIncomeAllocations?.some(ledger => (ledger.allocations[id] || 0) > 0) || Boolean(shift?.linkedIncomeId);
      if (linked && ['partner', 'grossAmount', 'netAmount', 'dateWorked', 'executionStatus', 'status', 'linkedIncomeId'].some(key => Object.prototype.hasOwnProperty.call(updates, key) && JSON.stringify(updates[key as keyof MedicalShift]) !== JSON.stringify(shift?.[key as keyof MedicalShift]))) {
        return { ...prev, notifications: [{ id: 'shift-edit:' + id, title: 'Plantão com recebimento conciliado', message: 'Desfaça a conciliação antes de alterar os dados financeiros ou a execução deste plantão.', timestamp: 'Agora', type: 'alert' as const, isRead: false }, ...prev.notifications.filter(n => n.id !== 'shift-edit:' + id)] };
      }
      return { ...prev, medicalShifts: (prev.medicalShifts || []).map(s => s.id === id ? { ...s, ...updates, id: s.id } : s) };
    });
  };

  const deleteMedicalShift = (id: string) => {
    setState(prev => {
      const shift = prev.medicalShifts?.find(s => s.id === id);
      const linked = prev.shiftIncomeAllocations?.some(ledger => (ledger.allocations[id] || 0) > 0) || Boolean(shift?.linkedIncomeId);
      if (linked) return { ...prev, notifications: [{ id: 'shift-delete:' + id, title: 'Plantão com recebimento conciliado', message: 'Desfaça a conciliação antes de excluir este plantão. O depósito bancário será preservado.', timestamp: 'Agora', type: 'alert' as const, isRead: false }, ...prev.notifications.filter(n => n.id !== 'shift-delete:' + id)] };
      return { ...prev, medicalShifts: (prev.medicalShifts || []).filter(s => s.id !== id) };
    });
  };

  const reconcileShiftWithIncome = (shiftId: string, incomeId: string, rememberHospitalRule?: boolean, amount?: number) => {
    setState(prev => {
      const targetIncome = prev.incomes.find(i => i.id === incomeId);
      const targetShift = (prev.medicalShifts || []).find(s => s.id === shiftId);
      if (!targetShift) return prev;

      if (!targetIncome) return prev;
      const allocation = applyShiftAllocation(prev.medicalShifts || [], prev.incomes, migrateLegacyShiftAllocations(prev.medicalShifts || [], prev.incomes, prev.shiftIncomeAllocations || []), shiftId, incomeId, amount);
      const updatedShifts = allocation.shifts;
      let updatedRules = prev.hospitalMappingRules || DEFAULT_HOSPITAL_MAPPING_RULES;
      if (rememberHospitalRule && targetIncome) {
        const cleanDesc = targetIncome.description.replace(/^(TED|DOC|PIX|TRANSF|CRED)\s+/i, '').trim();
        const keyword = cleanDesc.split(' ').slice(0, 3).join(' ') || targetShift.hospitalName;
        const newRule: HospitalIncomeMappingRule = {
          id: `rule-hosp-${Date.now()}`,
          hospitalName: targetShift.hospitalName,
          keywordPattern: keyword.toUpperCase(),
          partner: targetShift.partner,
          createdAt: new Date().toISOString(),
        };
        updatedRules = [newRule, ...updatedRules];
      }

      const notif: AppNotification = {
        id: `notif-shift-reconciled-${Date.now()}`,
        title: 'Plantão Conciliado com Sucesso! 🩺✓',
        message: `O plantão de R$ ${targetShift.grossAmount.toLocaleString('pt-BR')} no ${targetShift.hospitalName} foi vinculado ao recebimento bancário!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        medicalShifts: updatedShifts,
        shiftIncomeAllocations: allocation.ledgers,
        hospitalMappingRules: updatedRules,
        notifications: [notif, ...prev.notifications],
      };
    });
    triggerCelebration();
  };

  const undoShiftReconciliation = (shiftId: string) => {
    setState(prev => {
      const result = undoShiftAllocations(prev.medicalShifts || [], migrateLegacyShiftAllocations(prev.medicalShifts || [], prev.incomes, prev.shiftIncomeAllocations || []), shiftId);
      return { ...prev, medicalShifts: result.shifts, shiftIncomeAllocations: result.ledgers };
    });
  };

  const markShiftAsReceivedDirectly = (shiftId: string, actualDate?: string, createIncomeRecord?: boolean) => {
    setState(prev => {
      const shift = prev.medicalShifts?.find(s => s.id === shiftId);
      if (!shift || shift.status === 'received' || !createIncomeRecord) return prev;
      const date = actualDate || [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')].join('-');
      const ledgers = migrateLegacyShiftAllocations(prev.medicalShifts || [], prev.incomes, prev.shiftIncomeAllocations || []);
      const receivedCents = ledgers.reduce((sum, entry) => sum + (entry.allocations[shift.id] || 0), 0);
      const remaining = Math.max(0, Math.round((shift.netAmount ?? shift.grossAmount) * 100) - receivedCents) / 100;
      if (remaining <= 0) return prev;
      const income: IncomeItem = { id: 'income-shift:' + shift.id, description: 'Plantão ' + shift.hospitalName, amount: remaining, date, recipient: shift.partner, type: 'extra' };
      const incomes = prev.incomes.some(i => i.id === income.id) ? prev.incomes : [...prev.incomes, income];
      const result = applyShiftAllocation(prev.medicalShifts || [], incomes, ledgers, shiftId, income.id);
      return { ...prev, incomes, medicalShifts: result.shifts, shiftIncomeAllocations: result.ledgers };
    });
  };

  const addShiftPreset = (preset: Omit<MedicalShiftPreset, 'id'>) => {
    const newPreset: MedicalShiftPreset = {
      ...preset,
      id: `preset-${Date.now()}`,
    };
    setState(prev => ({
      ...prev,
      medicalShiftPresets: [newPreset, ...(prev.medicalShiftPresets || DEFAULT_SHIFT_PRESETS)],
    }));
  };

  const deleteShiftPreset = (id: string) => {
    setState(prev => ({
      ...prev,
      medicalShiftPresets: (prev.medicalShiftPresets || DEFAULT_SHIFT_PRESETS).filter(p => p.id !== id),
    }));
  };

  const addHospitalMappingRule = (rule: Omit<HospitalIncomeMappingRule, 'id' | 'createdAt'>) => {
    const newRule: HospitalIncomeMappingRule = {
      ...rule,
      id: `rule-hosp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      hospitalMappingRules: [newRule, ...(prev.hospitalMappingRules || DEFAULT_HOSPITAL_MAPPING_RULES)],
    }));
  };

  const removeHospitalMappingRule = (id: string) => {
    setState(prev => ({
      ...prev,
      hospitalMappingRules: (prev.hospitalMappingRules || DEFAULT_HOSPITAL_MAPPING_RULES).filter(r => r.id !== id),
    }));
  };

  const updateAlertRule = (ruleOrId: string | SpendingAlertRule, updates?: Partial<SpendingAlertRule>) => {
    if (typeof ruleOrId === 'object') {
      setState(prev => ({
        ...prev,
        alertRules: prev.alertRules.map(r => (r.id === ruleOrId.id ? { ...r, ...ruleOrId } : r)),
      }));
    } else {
      setState(prev => ({
        ...prev,
        alertRules: prev.alertRules.map(r => (r.id === ruleOrId ? { ...r, ...(updates || {}) } : r)),
      }));
    }
  };

  const editExpense = (expenseOrId: string | ExpenseItem, updates?: Partial<ExpenseItem>) => {
    const targetId = typeof expenseOrId === 'object' ? expenseOrId.id : expenseOrId;
    const incomingFields = typeof expenseOrId === 'object' ? expenseOrId : (updates || {});

    setState(prev => {
      const oldExp = prev.expenses.find(e => e.id === targetId);
      if (!oldExp) return prev;

      const newExp: ExpenseItem = {
        ...oldExp,
        ...incomingFields,
      };

      // Keep fundingSource and isExcludedFromMonthlyBudget consistent
      const oldSource: FundingSourceType = oldExp.fundingSource || 'month_budget';
      const newSource: FundingSourceType = incomingFields.fundingSource !== undefined
        ? incomingFields.fundingSource
        : (newExp.fundingSource || oldSource);
      newExp.fundingSource = newSource;
      newExp.isExcludedFromMonthlyBudget = newSource !== 'month_budget' || !!newExp.isExcludedFromMonthlyBudget;

      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextPiggyBanks = prev.piggyBanks;

      // 1. Reverter dedução anterior da fonte antiga
      if (oldSource === 'reserve_excess') {
        nextProtAmount += oldExp.amount;
        nextProtInvested += oldExp.amount;
      } else if (oldSource === 'piggy_bank' && oldExp.fundingGoalId) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === oldExp.fundingGoalId) {
            const nextCur = g.currentAmount + oldExp.amount;
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      // 2. Aplicar nova dedução sobre a nova fonte
      if (newSource === 'reserve_excess') {
        nextProtAmount = Math.max(0, nextProtAmount - newExp.amount);
        nextProtInvested = Math.max(0, nextProtInvested - newExp.amount);
      } else if (newSource === 'piggy_bank' && newExp.fundingGoalId) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === newExp.fundingGoalId) {
            const nextCur = Math.max(0, g.currentAmount - newExp.amount);
            return { ...g, currentAmount: nextCur, completed: nextCur >= g.targetAmount };
          }
          return g;
        });
      }

      const nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;

      return {
        ...prev,
        expenses: prev.expenses.map(e => (e.id === targetId ? newExp : e)),
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
      };
    });
  };

  const clearAllNotifications = () => {
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
  };

  // 3-Block System Handlers
  const toggleProtectionComplete = () => {
    setState(prev => {
      const next = !prev.isProtectionComplete;
      if (next) triggerCelebration();
      return {
        ...prev,
        isProtectionComplete: next,
      };
    });
  };

  const setProtectionComplete = (complete: boolean) => {
    setState(prev => {
      if (complete && !prev.isProtectionComplete) triggerCelebration();
      return {
        ...prev,
        isProtectionComplete: complete,
      };
    });
  };

  const depositToProtection = (amount: number) => {
    setState(prev => {
      const newInvested = prev.protectionTotalInvested + amount;
      const newCurrent = prev.protectionCurrentAmount + amount;
      const complete = newCurrent >= autoCalculatedProtectionTarget;
      if (complete && !prev.isProtectionComplete) {
        triggerCelebration();
      }
      return {
        ...prev,
        protectionTotalInvested: newInvested,
        protectionCurrentAmount: newCurrent,
        isProtectionComplete: complete,
      };
    });
  };

  const withdrawFromProtection = (amount: number) => {
    setState(prev => ({
      ...prev,
      protectionCurrentAmount: Math.max(0, prev.protectionCurrentAmount - amount),
      isProtectionComplete: Math.max(0, prev.protectionCurrentAmount - amount) >= autoCalculatedProtectionTarget,
    }));
  };

  const toggleGoalComplete = (id: string) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.map(p => {
        if (p.id === id) {
          const nextVal = !p.completed;
          if (nextVal) triggerCelebration();
          return { ...p, completed: nextVal };
        }
        return p;
      }),
    }));
  };

  const depositToGoal = (id: string, amount: number) => {
    depositPiggyBank(id, amount);
  };

  const withdrawFromGoal = (id: string, amount: number) => {
    withdrawPiggyBank(id, amount);
  };

  const depositToFreedom = (amount: number) => {
    setState(prev => ({
      ...prev,
      freedomTotalInvested: prev.freedomTotalInvested + amount,
    }));
  };

  const withdrawFromFreedom = (amount: number) => {
    setState(prev => ({
      ...prev,
      freedomTotalInvested: Math.max(0, prev.freedomTotalInvested - amount),
    }));
  };

  const updateProtectionBankBalance = (totalInvested: number, currentBankAmount: number) => {
    setState(prev => ({
      ...prev,
      protectionTotalInvested: totalInvested,
      protectionCurrentAmount: currentBankAmount,
      protectionYieldAccumulated: currentBankAmount - totalInvested,
      isProtectionComplete: currentBankAmount >= autoCalculatedProtectionTarget,
    }));
  };

  const updateFreedomBankBalance = (totalInvested: number, currentBankAmount: number) => {
    setState(prev => ({
      ...prev,
      freedomTotalInvested: totalInvested,
      freedomYieldAccumulated: currentBankAmount - totalInvested,
    }));
  };

  const updateGoalBankBalance = (id: string, totalInvested: number, currentBankAmount: number) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.map(p => {
        if (p.id === id) {
          return {
            ...p,
            totalInvested,
            currentAmount: currentBankAmount,
            yieldAccumulated: currentBankAmount - totalInvested,
            completed: currentBankAmount >= p.targetAmount,
          };
        }
        return p;
      }),
    }));
  };

  const restoreTierDefaultPercentages = (tierKey?: LifeTierKey) => {
    const targetTier = LIFE_TIERS[tierKey || activeLifeTier.key];
    setState(prev => ({
      ...prev,
      categoryPercentages: {
        moradia: targetTier.percentages.moradia,
        transporte: targetTier.percentages.transporte,
        comida: targetTier.percentages.comida,
        lazer: targetTier.percentages.lazer,
        protecao: targetTier.percentages.protecao,
        profissional: targetTier.percentages.profissional,
      },
      profile: {
        ...prev.profile,
        investmentsPercentage: targetTier.percentages.investimentos,
      },
      isCustomizedPercentages: false,
      lastAcknowledgedTierKey: targetTier.key,
      notifications: [
        {
          id: `notif-restore-defaults-${Date.now()}`,
          title: 'Padrões do Junto Restaurados! 🔄',
          message: `As porcentagens foram restauradas para as recomendações originais da ${targetTier.name}.`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
    triggerCelebration();
  };

  const applyNewTierDefaults = () => {
    restoreTierDefaultPercentages(activeLifeTier.key);
  };

  const keepCustomPercentagesOnTierChange = () => {
    setState(prev => ({
      ...prev,
      lastAcknowledgedTierKey: activeLifeTier.key,
      isCustomizedPercentages: true,
      notifications: [
        {
          id: `notif-keep-custom-${Date.now()}`,
          title: 'Porcentagens Personalizadas Mantidas 🔒',
          message: `Vocês optaram por manter suas porcentagens personalizadas na ${activeLifeTier.name}.`,
          timestamp: 'Agora mesmo',
          type: 'info',
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  };

  const dismissTierChangePrompt = keepCustomPercentagesOnTierChange;

  // Direcionamento Seletivo de Sobras Orçamentárias
  const allocateCategorySurplus = (
    sourceCategory: CategoryKey,
    amount: number,
    targetType: 'protection' | 'goal' | 'freedom',
    targetGoalId?: string,
    targetGoalName?: string,
    note?: string
  ) => {
    if (amount <= 0) return;

    const sourceCatInfo = CATEGORIES_BASE[sourceCategory];
    const catName = sourceCatInfo?.name || sourceCategory;
    const destName =
      targetType === 'protection'
        ? 'Reserva de Proteção'
        : targetType === 'freedom'
        ? 'Bloco Liberdade'
        : targetGoalName || 'Cofrinho de Objetivo';

    const newTransfer: SurplusTransferRecord = {
      id: `surplus-tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceCategory,
      targetType,
      targetGoalId,
      targetGoalName: destName,
      amount,
      date: new Date().toISOString().split('T')[0],
      monthKey: state.currentMonth,
      note: note || `Sobra de ${catName} direcionada para ${destName}`,
    };

    setState(prev => {
      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextFreedomInvested = prev.freedomTotalInvested;
      let nextPiggyBanks = prev.piggyBanks;

      if (targetType === 'protection') {
        nextProtAmount += amount;
        nextProtInvested += amount;
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      } else if (targetType === 'freedom') {
        nextFreedomInvested += amount;
      } else if (targetType === 'goal' && targetGoalId) {
        nextPiggyBanks = prev.piggyBanks.map(g => {
          if (g.id === targetGoalId) {
            const nextCur = g.currentAmount + amount;
            const nextInv = (g.totalInvested || g.currentAmount * 0.85) + amount;
            return {
              ...g,
              currentAmount: nextCur,
              totalInvested: nextInv,
              completed: nextCur >= g.targetAmount,
            };
          }
          return g;
        });
      }

      // Add expense record representing the transfer from the category budget so the sobra is consumed and traced
      const transferExpense: ExpenseItem = {
        id: `exp-surplus-tr-${Date.now()}`,
        description: `Alocação de Sobra: → ${destName}`,
        amount,
        category: sourceCategory,
        date: new Date().toISOString().split('T')[0],
        paidBy: 'both',
        notes: `Transferência seletiva de sobra da categoria ${catName} para ${destName}.`,
      };

      const newNotif: AppNotification = {
        id: `notif-surplus-${Date.now()}`,
        title: 'Sobra Alocada com Sucesso! 🎯',
        message: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de sobra da categoria ${catName} foram transferidos para "${destName}".`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        expenses: [transferExpense, ...prev.expenses],
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        freedomTotalInvested: nextFreedomInvested,
        piggyBanks: nextPiggyBanks,
        surplusTransfers: [newTransfer, ...(prev.surplusTransfers || [])],
        notifications: [newNotif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const reallocateCategoryBudget = (fromCategory: CategoryKey, toCategory: CategoryKey, amount: number, note?: string) => {
    if (amount <= 0 || fromCategory === toCategory) return;
    const fromName = CATEGORIES_BASE[fromCategory]?.name || fromCategory;
    const toName = CATEGORIES_BASE[toCategory]?.name || toCategory;
    const todayStr = new Date().toISOString().split('T')[0];

    const debitExpense: ExpenseItem = {
      id: `exp-vaso-debit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      description: `Vaso Comunicante: Transferência → ${toName}`,
      amount: amount,
      category: fromCategory,
      date: todayStr,
      paidBy: 'both',
      notes: note || `Transferência de saldo por Vaso Comunicante de ${fromName} para cobrir excesso em ${toName}.`,
    };

    const creditExpense: ExpenseItem = {
      id: `exp-vaso-credit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      description: `Vaso Comunicante: Compensação ← ${fromName}`,
      amount: -amount,
      category: toCategory,
      date: todayStr,
      paidBy: 'both',
      notes: note || `Crédito compensatório de Vaso Comunicante recebido de ${fromName}.`,
    };

    const newTransfer: SurplusTransferRecord = {
      id: `surplus-vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceCategory: fromCategory,
      targetType: 'category',
      targetGoalName: toName,
      amount,
      date: todayStr,
      monthKey: state.currentMonth,
      note: note || `Vaso comunicante: ${fromName} nivelou ${toName} (+R$ ${amount.toFixed(2)})`,
    };

    const newNotif: AppNotification = {
      id: `notif-vc-${Date.now()}`,
      title: 'Vasos Comunicantes Nivelados! ⚖️',
      message: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de sobra em ${fromName} foram transferidos para equilibrar ${toName}. Sem culpa e sem neura!`,
      timestamp: 'Agora mesmo',
      type: 'success',
      isRead: false,
    };

    setState(prev => ({
      ...prev,
      expenses: [debitExpense, creditExpense, ...prev.expenses],
      surplusTransfers: [newTransfer, ...(prev.surplusTransfers || [])],
      notifications: [newNotif, ...prev.notifications],
    }));

    triggerCelebration();
  };

  const coverExpenseDeficitWithShift = (shiftId: string, categoryKey: CategoryKey, amount: number) => {
    if (amount <= 0) return;
    const shift = (state.medicalShifts || []).find(s => s.id === shiftId);
    if (!shift) return;
    const catName = CATEGORIES_BASE[categoryKey]?.name || categoryKey;
    const todayStr = new Date().toISOString().split('T')[0];

    const offsetExpense: ExpenseItem = {
      id: `exp-shift-offset-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      description: `Amortização com Plantão: ${shift.hospitalName}`,
      amount: -amount,
      category: categoryKey,
      date: todayStr,
      paidBy: shift.partner,
      notes: `Amortização de excesso na categoria ${catName} utilizando rendimentos do plantão em ${shift.hospitalName} (${shift.dateWorked}).`,
    };

    const newTransfer: SurplusTransferRecord = {
      id: `surplus-shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceCategory: 'all_surplus',
      targetType: 'shift_offset',
      targetGoalName: `${shift.hospitalName} (${catName})`,
      amount,
      date: todayStr,
      monthKey: state.currentMonth,
      note: `Compensação direta com plantão médico: ${shift.hospitalName}`,
    };

    const newNotif: AppNotification = {
      id: `notif-shift-cover-${Date.now()}`,
      title: 'Excesso Amortizado com Plantão! 🩺✨',
      message: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do excesso em ${catName} foram cobertos pelo plantão de ${shift.hospitalName}!`,
      timestamp: 'Agora mesmo',
      type: 'success',
      isRead: false,
    };

    setState(prev => ({
      ...prev,
      expenses: [offsetExpense, ...prev.expenses],
      medicalShifts: (prev.medicalShifts || []).map(s => {
        if (s.id === shiftId) {
          const currentNotes = s.notes ? `${s.notes} | ` : '';
          return {
            ...s,
            notes: `${currentNotes}Amortizou R$ ${amount.toFixed(2)} em ${catName}`,
          };
        }
        return s;
      }),
      surplusTransfers: [newTransfer, ...(prev.surplusTransfers || [])],
      notifications: [newNotif, ...prev.notifications],
    }));

    triggerCelebration();
  };

  const distributeSurplusPercentages = (
    allocations: {
      targetType: 'goal' | 'protection' | 'freedom' | 'leisure';
      targetGoalId?: string;
      targetGoalName?: string;
      percentage: number;
      amount: number;
    }[],
    sourceCategory?: CategoryKey
  ) => {
    const validAllocations = allocations.filter(a => a.amount > 0);
    if (validAllocations.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const totalAllocated = validAllocations.reduce((sum, a) => sum + a.amount, 0);

    setState(prev => {
      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextFreedomInvested = prev.freedomTotalInvested;
      let nextPiggyBanks = [...prev.piggyBanks];
      const newExpenses = [...prev.expenses];
      const newTransfers = [...(prev.surplusTransfers || [])];

      validAllocations.forEach(alloc => {
        const destLabel = alloc.targetGoalName || (
          alloc.targetType === 'protection' ? 'Reserva de Emergência' :
          alloc.targetType === 'freedom' ? 'Bloco Liberdade' :
          alloc.targetType === 'leisure' ? 'Recompensa Livre do Casal' : 'Cofrinho de Metas'
        );

        if (alloc.targetType === 'protection') {
          nextProtAmount += alloc.amount;
          nextProtInvested += alloc.amount;
          nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
        } else if (alloc.targetType === 'freedom') {
          nextFreedomInvested += alloc.amount;
        } else if (alloc.targetType === 'goal' && alloc.targetGoalId) {
          nextPiggyBanks = nextPiggyBanks.map(g => {
            if (g.id === alloc.targetGoalId) {
              const nextCur = g.currentAmount + alloc.amount;
              const nextInv = (g.totalInvested || g.currentAmount * 0.85) + alloc.amount;
              return {
                ...g,
                currentAmount: nextCur,
                totalInvested: nextInv,
                completed: nextCur >= g.targetAmount,
              };
            }
            return g;
          });
        }

        const catKey = sourceCategory || 'lazer';
        newExpenses.unshift({
          id: `exp-dist-surplus-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          description: `Distribuição de Sobra: → ${destLabel} (${alloc.percentage}%)`,
          amount: alloc.amount,
          category: catKey,
          date: todayStr,
          paidBy: 'both',
          notes: `Alocação percentual de sobra (${alloc.percentage}%) para ${destLabel}.`,
        });

        newTransfers.unshift({
          id: `surplus-dist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sourceCategory: sourceCategory || 'all_surplus',
          targetType: alloc.targetType,
          targetGoalId: alloc.targetGoalId,
          targetGoalName: destLabel,
          amount: alloc.amount,
          date: todayStr,
          monthKey: prev.currentMonth,
          note: `Distribuição percentual (${alloc.percentage}%): ${destLabel}`,
        });
      });

      const newNotif: AppNotification = {
        id: `notif-dist-surplus-${Date.now()}`,
        title: 'Distribuição de Sobras Consolidada! 🎉💎',
        message: `R$ ${totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foram distribuídos com sucesso conforme os percentuais escolhidos pelo casal!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        expenses: newExpenses,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        freedomTotalInvested: nextFreedomInvested,
        piggyBanks: nextPiggyBanks,
        surplusTransfers: newTransfers,
        notifications: [newNotif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const dismissMonthSurplusNotification = (monthKey: string) => {
    setState(prev => ({
      ...prev,
      dismissedSurplusMonths: Array.from(new Set([...(prev.dismissedSurplusMonths || []), monthKey])),
    }));
  };

  const triggerMonthSurplusNotificationManually = () => {
    setState(prev => ({
      ...prev,
      dismissedSurplusMonths: (prev.dismissedSurplusMonths || []).filter(m => m !== prev.currentMonth),
    }));
  };

  // ==========================================
  // GUIA DIDÁTICO DE APORTES MANUAIS & CONFIRMAÇÃO VISUAL
  // ==========================================
  const getMonthlyDepositGuide = useCallback((targetMonth?: string, customStrategy?: '100_percent_reserve' | 'split_freedom'): MonthlyDepositGuide => {
    const mKey = targetMonth || state.currentMonth;

    const isPhase2 = state.isProtectionComplete;
    const invPct = state.profile.investmentsPercentage ?? 10;
    const totalProgrammedSavings = totalIncome > 0 ? Math.round(totalIncome * (invPct / 100)) : 0;

    const eligibleVarSurplus = (['lazer', 'comida', 'profissional', 'protecao'] as CategoryKey[])
      .reduce((sum, key) => sum + Math.max(0, categoriesSpending[key]?.remaining || 0), 0);
    const shieldedEssential = Math.max(0, categoriesSpending['moradia']?.remaining || 0);
    const suggestedCeiling = totalProgrammedSavings + eligibleVarSurplus;

    const existingGuide = state.monthlyDepositGuides && state.monthlyDepositGuides[mKey];
    const activeGoals = state.piggyBanks.filter(g => !g.completed);

    const focusStrategy: '100_percent_reserve' | 'split_freedom' =
      customStrategy ||
      existingGuide?.focusStrategy ||
      '100_percent_reserve';

    if (existingGuide && !customStrategy) {
      return {
        ...existingGuide,
        suggestedCeiling: existingGuide.suggestedCeiling ?? suggestedCeiling,
        programmedBase: existingGuide.programmedBase ?? totalProgrammedSavings,
        eligibleSurplus: existingGuide.eligibleSurplus ?? eligibleVarSurplus,
        shieldedEssential: existingGuide.shieldedEssential ?? shieldedEssential,
        focusStrategy: existingGuide.focusStrategy ?? focusStrategy,
      };
    }

    const monthSurplus = (state.surplusTransfers || []).filter(t => t.monthKey === mKey);
    const protSurplus = monthSurplus.filter(t => t.targetType === 'protection').reduce((s, t) => s + t.amount, 0);
    const freeSurplus = monthSurplus.filter(t => t.targetType === 'freedom').reduce((s, t) => s + t.amount, 0);

    const items: MonthlyDepositItem[] = [];

    let baseProt = 0;
    let baseFreedom = 0;
    let allocatedGoalsFixed = 0;
    let redirectedBlock2Surplus = 0;

    if (!isPhase2) {
      // FASE 1: Construindo Reserva de Emergência
      if (activeGoals.length === 0) {
        // Sem cofrinhos ativos em Fase 1
        if (focusStrategy === '100_percent_reserve') {
          // 100% da verba programada para a Reserva de Emergência para fechar mais rápido
          baseProt = totalProgrammedSavings;
          baseFreedom = 0;
          redirectedBlock2Surplus = Math.round(totalProgrammedSavings * 0.50); // 30% de cofrinhos + 20% de liberdade redirecionados
        } else {
          // Casal optou por dividir 50% Reserva / 50% Liberdade
          baseProt = Math.round(totalProgrammedSavings * 0.50);
          baseFreedom = Math.round(totalProgrammedSavings * 0.50);
          redirectedBlock2Surplus = 0;
        }
      } else {
        // Existem cofrinhos ativos em Fase 1 (Pool de 30%)
        const targetGoalsFixedPool = Math.round(totalProgrammedSavings * 0.30);
        const perGoalFixed = Math.round(targetGoalsFixedPool / activeGoals.length);
        allocatedGoalsFixed = perGoalFixed * activeGoals.length;

        // Sobra/sobra não consumida do Bloco 2 vai 100% para a Reserva
        const unusedBlock2Pool = Math.max(0, targetGoalsFixedPool - allocatedGoalsFixed);
        redirectedBlock2Surplus = unusedBlock2Pool;

        const standardProtBase = Math.round(totalProgrammedSavings * 0.50);
        baseProt = standardProtBase + redirectedBlock2Surplus;
        baseFreedom = Math.max(0, totalProgrammedSavings - baseProt - allocatedGoalsFixed);
      }
    } else {
      // FASE 2: Reserva Completa (100%)
      baseProt = 0;
      if (activeGoals.length > 0) {
        const targetGoalsFixedPool = Math.round(totalProgrammedSavings * 0.50);
        const perGoalFixed = Math.round(targetGoalsFixedPool / activeGoals.length);
        allocatedGoalsFixed = perGoalFixed * activeGoals.length;
        baseFreedom = Math.max(0, totalProgrammedSavings - allocatedGoalsFixed);
      } else {
        allocatedGoalsFixed = 0;
        baseFreedom = totalProgrammedSavings;
      }
    }

    // 1. Item Bloco 1 — Proteção
    const totalProt = baseProt + protSurplus;
    if (!isPhase2 || protSurplus > 0) {
      let instructionStr = `Guardar R$ ${totalProt.toLocaleString('pt-BR')} na Caixinha da Reserva de Emergência`;
      if (!isPhase2 && activeGoals.length === 0 && focusStrategy === '100_percent_reserve') {
        instructionStr += ` (100% focado no Acelerador de Reserva — Fase 1)`;
      } else if (!isPhase2 && redirectedBlock2Surplus > 0) {
        instructionStr += ` (inclui +R$ ${redirectedBlock2Surplus.toLocaleString('pt-BR')} do Acelerador de Cofrinhos)`;
      }

      items.push({
        id: `dep-item-prot-${mKey}`,
        block: 'protection',
        title: 'Bloco 1 — Proteção',
        instruction: instructionStr,
        destinationLabel: 'Caixinha Reserva de Emergência (Liquidez Diária / 100% CDI)',
        baseAmount: baseProt,
        surplusAmount: protSurplus,
        totalAmount: totalProt,
      });
    }

    // 2. Itens Bloco 2 — Objetivos
    if (activeGoals.length > 0) {
      const targetGoalsFixedPool = !isPhase2
        ? Math.round(totalProgrammedSavings * 0.30)
        : Math.round(totalProgrammedSavings * 0.50);
      const perGoalFixed = Math.round(targetGoalsFixedPool / activeGoals.length);

      activeGoals.forEach((goal) => {
        const goalSurplus = monthSurplus
          .filter(t => t.targetType === 'goal' && t.targetGoalId === goal.id)
          .reduce((s, t) => s + t.amount, 0);

        const baseGoal = perGoalFixed;
        const totalGoal = baseGoal + goalSurplus;

        items.push({
          id: `dep-item-goal-${goal.id}-${mKey}`,
          block: 'goals',
          title: `Bloco 2 — ${goal.name}`,
          instruction: `Guardar R$ ${totalGoal.toLocaleString('pt-BR')} no Cofrinho ${goal.name}`,
          destinationLabel: `Cofrinho ${goal.name} (${goal.purpose || 'Objetivo Planejado'})`,
          baseAmount: baseGoal,
          surplusAmount: goalSurplus,
          totalAmount: totalGoal,
          targetGoalId: goal.id,
          targetGoalEmoji: goal.emoji,
        });
      });
    }

    // 3. Item Bloco 3 — Liberdade
    const totalFreedom = baseFreedom + freeSurplus;
    if (baseFreedom > 0 || freeSurplus > 0 || isPhase2 || focusStrategy === 'split_freedom') {
      items.push({
        id: `dep-item-free-${mKey}`,
        block: 'freedom',
        title: 'Bloco 3 — Liberdade Financeira',
        instruction: `Enviar R$ ${totalFreedom.toLocaleString('pt-BR')} para os investimentos de longo prazo`,
        destinationLabel: 'Investimentos de Longo Prazo (Corretora / Renda Perpétua)',
        baseAmount: baseFreedom,
        surplusAmount: freeSurplus,
        totalAmount: totalFreedom,
      });
    }

    const totalPlanned = items.reduce((s, it) => s + it.totalAmount, 0);

    return {
      monthKey: mKey,
      items,
      totalPlanned,
      status: 'pending_approval',
      suggestedCeiling,
      programmedBase: totalProgrammedSavings,
      eligibleSurplus: eligibleVarSurplus,
      shieldedEssential,
      focusStrategy,
      redirectedBlock2Surplus,
    };
  }, [state.currentMonth, state.isProtectionComplete, state.profile.investmentsPercentage, totalIncome, categoriesSpending, state.monthlyDepositGuides, state.surplusTransfers, state.piggyBanks]);

  const updateDepositGuideStrategy = (mKey: string, strategy: '100_percent_reserve' | 'split_freedom') => {
    const updatedGuide = getMonthlyDepositGuide(mKey, strategy);
    setState(prev => ({
      ...prev,
      monthlyDepositGuides: {
        ...(prev.monthlyDepositGuides || {}),
        [mKey]: updatedGuide,
      },
    }));
  };

  const approveMonthlyDepositGuide = (mKey: string, customItems?: MonthlyDepositItem[]) => {
    setState(prev => {
      const currentGuide = prev.monthlyDepositGuides?.[mKey] || getMonthlyDepositGuide(mKey);
      const items = customItems || currentGuide.items;
      const totalPlanned = items.reduce((s, it) => s + it.totalAmount, 0);

      const invPct = prev.profile.investmentsPercentage ?? (activeLifeTier.percentages as any)['investimentos'] ?? 10;
      const totalProgrammedSavings = totalIncome > 0 ? Math.round(totalIncome * (invPct / 100)) : 0;
      const eligibleVarSurplus = (['lazer', 'comida', 'profissional', 'protecao'] as CategoryKey[])
        .reduce((sum, key) => sum + Math.max(0, categoriesSpending[key]?.remaining || 0), 0);
      const shieldedEssential = Math.max(0, categoriesSpending['moradia']?.remaining || 0);

      const updatedGuide: MonthlyDepositGuide = {
        ...currentGuide,
        monthKey: mKey,
        items,
        totalPlanned,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        suggestedCeiling: currentGuide.suggestedCeiling ?? (totalProgrammedSavings + eligibleVarSurplus),
        programmedBase: currentGuide.programmedBase ?? totalProgrammedSavings,
        eligibleSurplus: currentGuide.eligibleSurplus ?? eligibleVarSurplus,
        shieldedEssential: currentGuide.shieldedEssential ?? shieldedEssential,
      };

      return {
        ...prev,
        monthlyDepositGuides: {
          ...(prev.monthlyDepositGuides || {}),
          [mKey]: updatedGuide,
        },
      };
    });
  };

  const adjustMonthlyDepositItem = (mKey: string, itemId: string, newAmount: number) => {
    setState(prev => {
      const currentGuide = prev.monthlyDepositGuides?.[mKey] || getMonthlyDepositGuide(mKey);
      const updatedItems = currentGuide.items.map(it => {
        if (it.id === itemId) {
          const clamped = Math.max(0, newAmount);
          return {
            ...it,
            totalAmount: clamped,
            instruction: it.instruction.replace(/R\$\s*[\d.,]+/, `R$ ${clamped.toLocaleString('pt-BR')}`),
          };
        }
        return it;
      });
      const totalPlanned = updatedItems.reduce((s, it) => s + it.totalAmount, 0);

      return {
        ...prev,
        monthlyDepositGuides: {
          ...(prev.monthlyDepositGuides || {}),
          [mKey]: {
            ...currentGuide,
            items: updatedItems,
            totalPlanned,
          },
        },
      };
    });
  };

  const executeMonthlyDeposit = (mKey: string) => {
    setState(prev => {
      const guide = prev.monthlyDepositGuides?.[mKey] || getMonthlyDepositGuide(mKey);
      const items = guide.items;
      const totalDeposited = items.reduce((s, it) => s + it.totalAmount, 0);

      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextFreedomInvested = prev.freedomTotalInvested;
      let nextPiggyBanks = [...prev.piggyBanks];

      const newSurplusTransfers: SurplusTransferRecord[] = [];

      items.forEach(it => {
        if (it.block === 'protection') {
          nextProtAmount += it.totalAmount;
          nextProtInvested += it.totalAmount;
          if (nextProtAmount >= autoCalculatedProtectionTarget) {
            nextProtComplete = true;
          }
        } else if (it.block === 'freedom') {
          nextFreedomInvested += it.totalAmount;
        } else if (it.block === 'goals' && it.targetGoalId) {
          nextPiggyBanks = nextPiggyBanks.map(g => {
            if (g.id === it.targetGoalId) {
              const nextCur = g.currentAmount + it.totalAmount;
              const nextInv = (g.totalInvested || g.currentAmount * 0.85) + it.totalAmount;
              return {
                ...g,
                currentAmount: nextCur,
                totalInvested: nextInv,
                completed: nextCur >= g.targetAmount,
              };
            }
            return g;
          });
        }

        // Trace and record surplus destinations for audit trail
        if (it.surplusAmount > 0) {
          newSurplusTransfers.push({
            id: `surplus-dep-${mKey}-${it.id}`,
            sourceCategory: 'lazer',
            targetType: it.block === 'protection' ? 'protection' : it.block === 'freedom' ? 'freedom' : 'goal',
            targetGoalId: it.targetGoalId,
            targetGoalName: it.title,
            amount: it.surplusAmount,
            date: new Date().toISOString().split('T')[0],
            monthKey: mKey,
            note: `Aporte de sobra direcionada no Guia Mensal (${it.title})`,
          });
        }
      });

      const completionRecord: MonthDepositCompletionRecord = {
        monthKey: mKey,
        completedAt: new Date().toISOString(),
        totalDeposited,
        items,
      };

      const updatedGuide: MonthlyDepositGuide = {
        ...guide,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      const monthName = formatMonthYear(mKey);
      const successNotif: AppNotification = {
        id: `notif-monthly-dep-${Date.now()}`,
        title: 'Aportes do Mês Confirmados! 🏆✨',
        message: `Os investimentos do mês de ${monthName} já foram feitos com sucesso! R$ ${totalDeposited.toLocaleString('pt-BR')} foram guardados. O futuro de vocês agradece.`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      const updatedSurplusTransfers = [
        ...(prev.surplusTransfers || []).filter(t => !t.id.startsWith(`surplus-dep-${mKey}-`)),
        ...newSurplusTransfers,
      ];

      return {
        ...prev,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        freedomTotalInvested: nextFreedomInvested,
        piggyBanks: nextPiggyBanks,
        surplusTransfers: updatedSurplusTransfers,
        monthlyDepositGuides: {
          ...(prev.monthlyDepositGuides || {}),
          [mKey]: updatedGuide,
        },
        completedMonthDeposits: {
          ...(prev.completedMonthDeposits || {}),
          [mKey]: completionRecord,
        },
        notifications: [successNotif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const resetMonthlyDeposit = (mKey: string) => {
    setState(prev => {
      const existingCompletion = prev.completedMonthDeposits?.[mKey];
      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextFreedomInvested = prev.freedomTotalInvested;
      let nextPiggyBanks = [...prev.piggyBanks];

      // Reverter valores creditados com exatidão matemática
      if (existingCompletion?.items) {
        existingCompletion.items.forEach(it => {
          if (it.block === 'protection') {
            nextProtAmount = Math.max(0, nextProtAmount - it.totalAmount);
            nextProtInvested = Math.max(0, nextProtInvested - it.totalAmount);
            nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
          } else if (it.block === 'freedom') {
            nextFreedomInvested = Math.max(0, nextFreedomInvested - it.totalAmount);
          } else if (it.block === 'goals' && it.targetGoalId) {
            nextPiggyBanks = nextPiggyBanks.map(g => {
              if (g.id === it.targetGoalId) {
                const nextCur = Math.max(0, g.currentAmount - it.totalAmount);
                const nextInv = Math.max(0, (g.totalInvested || g.currentAmount) - it.totalAmount);
                return {
                  ...g,
                  currentAmount: nextCur,
                  totalInvested: nextInv,
                  completed: nextCur >= g.targetAmount,
                };
              }
              return g;
            });
          }
        });
      }

      // Reverter registros de sobras atrelados a este guia do mês
      const nextSurplus = (prev.surplusTransfers || []).filter(
        t => !t.id.startsWith(`surplus-dep-${mKey}-`)
      );

      const nextCompleted = { ...(prev.completedMonthDeposits || {}) };
      delete nextCompleted[mKey];
      const nextGuides = { ...(prev.monthlyDepositGuides || {}) };
      if (nextGuides[mKey]) {
        nextGuides[mKey] = {
          ...nextGuides[mKey],
          status: 'pending_approval',
          completedAt: undefined,
        };
      }
      return {
        ...prev,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        freedomTotalInvested: nextFreedomInvested,
        piggyBanks: nextPiggyBanks,
        surplusTransfers: nextSurplus,
        completedMonthDeposits: nextCompleted,
        monthlyDepositGuides: nextGuides,
      };
    });
  };

  const updateProfile = (profile: Partial<CoupleProfile>) => {
    setState(prev => {
      const newProfile = { ...prev.profile, ...profile };
      const tierPcts = activeLifeTier.percentages;
      let isCustom = prev.isCustomizedPercentages ?? false;
      if (profile.investmentsPercentage !== undefined && profile.investmentsPercentage !== tierPcts.investimentos) {
        isCustom = true;
      }
      return {
        ...prev,
        profile: newProfile,
        isCustomizedPercentages: isCustom,
        lastAcknowledgedTierKey: activeLifeTier.key,
      };
    });
  };

  const updateCategoryPercentages = (percentages: Record<CategoryKey, number>) => {
    setState(prev => {
      const mergedPcts = { ...prev.categoryPercentages, ...percentages };
      const tierPcts = activeLifeTier.percentages;
      let isCustom = false;
      for (const key of ['moradia', 'transporte', 'comida', 'lazer', 'protecao', 'profissional'] as CategoryKey[]) {
        if (mergedPcts[key] !== undefined && mergedPcts[key] !== tierPcts[key]) {
          isCustom = true;
        }
      }
      const invPct = prev.profile.investmentsPercentage ?? tierPcts.investimentos;
      if (invPct !== tierPcts.investimentos) {
        isCustom = true;
      }

      return {
        ...prev,
        categoryPercentages: mergedPcts,
        isCustomizedPercentages: isCustom,
        lastAcknowledgedTierKey: activeLifeTier.key,
      };
    });
  };

  const updateCategoryFloors = (floors: Record<string, number>) => {
    setState(prev => ({
      ...prev,
      categoryFloors: { ...(prev.categoryFloors || {}), ...floors },
    }));
  };

  const updateCategoryLocks = (locks: Partial<Record<DestinationKey, boolean>>) => {
    setState(prev => ({
      ...prev,
      categoryLocks: {
        ...(prev.categoryLocks || {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: false,
        }),
        ...locks,
      },
    }));
  };

  const applyBudgetPlanContract = (plan: BudgetPlanContract) => {
    setState(prev => {
      const nextCategoryPercentages: Record<CategoryKey, number> = {
        moradia: plan.categoryPercentages.moradia ?? prev.categoryPercentages.moradia,
        transporte: plan.categoryPercentages.transporte ?? prev.categoryPercentages.transporte,
        comida: plan.categoryPercentages.comida ?? prev.categoryPercentages.comida,
        lazer: plan.categoryPercentages.lazer ?? prev.categoryPercentages.lazer,
        protecao: plan.categoryPercentages.protecao ?? prev.categoryPercentages.protecao,
        profissional: plan.categoryPercentages.profissional ?? prev.categoryPercentages.profissional,
      };

      const nextInvestmentsPercentage = plan.categoryPercentages.investimentos ?? (prev.profile.investmentsPercentage || 20);

      const nextCategoryLocks = {
        ...(prev.categoryLocks || {
          moradia: false,
          transporte: false,
          comida: false,
          lazer: false,
          protecao: false,
          profissional: false,
          investimentos: false,
        }),
        ...plan.categoryLocks,
      };

      const nextMonthlyPlans = {
        ...(prev.monthlyBudgetPlans || {}),
        [plan.competence]: plan,
      };

      return {
        ...prev,
        categoryPercentages: nextCategoryPercentages,
        categoryLocks: nextCategoryLocks,
        monthlyBudgetPlans: nextMonthlyPlans,
        isCustomizedPercentages: true,
        profile: {
          ...prev.profile,
          investmentsPercentage: nextInvestmentsPercentage,
        },
      };
    });
    triggerCelebration();
  };

  const toggleThemeMode = () => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        themeMode: prev.profile.themeMode === 'light' ? 'dark' : 'light',
      },
    }));
  };

  const setAccentTheme = (theme: AccentTheme) => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        accentTheme: theme,
        coupleTheme: viewMode === 'couple' ? theme : prev.profile.coupleTheme,
        partner1Theme: viewMode === 'partner1' ? theme : prev.profile.partner1Theme,
        partner2Theme: viewMode === 'partner2' ? theme : prev.profile.partner2Theme,
      },
    }));
  };

  const setModeTheme = (mode: 'couple' | 'partner1' | 'partner2', theme: AccentTheme) => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        coupleTheme: mode === 'couple' ? theme : (prev.profile.coupleTheme || 'emerald'),
        partner1Theme: mode === 'partner1' ? theme : (prev.profile.partner1Theme || 'sapphire'),
        partner2Theme: mode === 'partner2' ? theme : (prev.profile.partner2Theme || 'rose'),
      },
    }));
  };

  const resetToSampleData = () => {
    setState(INITIAL_STATE);
  };

  const clearAllData = async () => {
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        partner1Income: 0,
        partner2Income: 0,
        streakMonths: 0,
      },
      categoryPercentages: prev.categoryPercentages || INITIAL_STATE.categoryPercentages,
      categoryFloors: {
        moradia: 0,
        comida: 0,
        lazer: 0,
        protecao: 0,
        profissional: 0,
        investimentos: 0,
      },
      keywordRules: prev.keywordRules || DEFAULT_KEYWORD_RULES,
      expenses: [],
      incomes: [],
      installments: [],
      piggyBanks: [],
      linkedAccounts: [],
      pluggyAccounts: [],
      detectedSubscriptions: [],
      notifications: [
        {
          id: `notif-clean-${Date.now()}`,
          title: 'Conta Zerada com Sucesso 🧼',
          message: 'Todo o conteúdo e dados de bancos foram apagados. Suas porcentagens iniciais, fases da jornada e categorizações automáticas foram preservadas.',
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        }
      ],
      protectionCurrentAmount: 0,
      protectionTotalInvested: 0,
      protectionYieldAccumulated: 0,
      isProtectionComplete: false,
      freedomTotalInvested: 0,
      freedomYieldAccumulated: 0,
    }));

    if (coupleAccount?.id) {
      try {
        await updateDoc(doc(db, 'couples', coupleAccount.id), {
          partner1Income: 0,
          partner2Income: 0,
        });
      } catch (e) {
        console.warn('Could not reset incomes in Firestore couple', e);
      }
    }
  };

  const clearExpenses = () => {
    setState(prev => ({ ...prev, expenses: [] }));
  };

  const clearInstallments = () => {
    setState(prev => ({ ...prev, installments: [] }));
  };

  const clearPiggyBanks = () => {
    setState(prev => ({ ...prev, piggyBanks: [] }));
  };

  const setAppMode = (mode: 'casal' | 'faculdade') => {
    setState(prev => ({ ...prev, appMode: mode }));
  };

  const updateCollegeData = (data: Partial<import('../types/finance').CollegeModeData>) => {
    setState(prev => ({
      ...prev,
      collegeModeData: {
        active: true,
        courseName: prev.collegeModeData?.courseName || 'Medicina',
        currentSemester: prev.collegeModeData?.currentSemester || 5,
        totalSemesters: prev.collegeModeData?.totalSemesters || 12,
        monthlyStipend: prev.collegeModeData?.monthlyStipend ?? 0,
        totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege ?? 0,
        ...prev.collegeModeData,
        ...data,
      },
    }));
  };

  const advanceCollegeSemester = () => {
    setState(prev => {
      const current = prev.collegeModeData?.currentSemester || 1;
      const total = prev.collegeModeData?.totalSemesters || 12;
      const nextSem = Math.min(total, current + 1);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      return {
        ...prev,
        collegeModeData: {
          active: true,
          courseName: prev.collegeModeData?.courseName || 'Medicina',
          currentSemester: nextSem,
          totalSemesters: total,
          monthlyStipend: prev.collegeModeData?.monthlyStipend ?? 0,
          totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege ?? 0,
          ...prev.collegeModeData,
        },
      };
    });
  };

  const depositCollegeInvestment = (amount: number) => {
    setState(prev => ({
      ...prev,
      freedomTotalInvested: prev.freedomTotalInvested + amount,
      collegeModeData: {
        active: true,
        courseName: prev.collegeModeData?.courseName || 'Medicina',
        currentSemester: prev.collegeModeData?.currentSemester || 5,
        totalSemesters: prev.collegeModeData?.totalSemesters || 12,
        monthlyStipend: prev.collegeModeData?.monthlyStipend ?? 0,
        totalInvestedInCollege: (prev.collegeModeData?.totalInvestedInCollege ?? 0) + amount,
        ...prev.collegeModeData,
      },
    }));

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const migrateCollegeToProfessional = (newMonthlyIncome: number) => {
    setState(prev => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });

      const updatedIncome = Number.isFinite(newMonthlyIncome) && newMonthlyIncome >= 0 ? newMonthlyIncome : prev.profile.partner1Income || 0;

      return {
        ...prev,
        appMode: 'casal',
        profile: {
          ...prev.profile,
          partner1Income: updatedIncome,
        },
        collegeModeData: {
          ...prev.collegeModeData,
          active: true,
          courseName: prev.collegeModeData?.courseName || 'Medicina',
          currentSemester: prev.collegeModeData?.totalSemesters || 12,
          totalSemesters: prev.collegeModeData?.totalSemesters || 12,
          monthlyStipend: prev.collegeModeData?.monthlyStipend ?? 0,
          totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege ?? 0,
          migrationCompleted: true,
        },
      };
    });
  };

  const clearIncomes = () => {
    setState(prev => {
      const linkedIds = new Set((prev.shiftIncomeAllocations || []).filter(ledger => Object.keys(ledger.allocations).length > 0).map(ledger => ledger.id));
      for (const shift of prev.medicalShifts || []) if (shift.linkedIncomeId) linkedIds.add(shift.linkedIncomeId);
      return { ...prev, incomes: prev.incomes.filter(income => linkedIds.has(income.id)) };
    });
  };

  const reallocateReserveExcess = (
    amount: number,
    targetType: 'goal' | 'freedom',
    targetGoalId?: string,
    targetGoalName?: string
  ) => {
    if (amount <= 0) return;
    if (amount > emergencyReserveExcessAmount) {
      console.warn('Tentativa de realocar valor maior que o excesso da reserva');
      return;
    }

    setState(prev => {
      const nextProtAmount = Math.max(0, prev.protectionCurrentAmount - amount);
      const nextProtInvested = Math.max(0, prev.protectionTotalInvested - amount);
      const nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;

      let nextPiggyBanks = prev.piggyBanks;
      let nextFreedomInvested = prev.freedomTotalInvested;
      const destLabel = targetType === 'freedom' ? 'Bloco 3 Liberdade' : targetGoalName || 'Objetivo';

      if (targetType === 'goal' && targetGoalId) {
        nextPiggyBanks = prev.piggyBanks.map(g => {
          if (g.id === targetGoalId) {
            const nextCur = g.currentAmount + amount;
            const nextInv = (g.totalInvested || g.currentAmount * 0.85) + amount;
            return {
              ...g,
              currentAmount: nextCur,
              totalInvested: nextInv,
              completed: nextCur >= g.targetAmount,
            };
          }
          return g;
        });
      } else if (targetType === 'freedom') {
        nextFreedomInvested += amount;
      }

      const newTransfer: SurplusTransferRecord = {
        id: `surplus-reserve-${Date.now()}`,
        sourceCategory: 'protecao',
        targetType,
        targetGoalId,
        targetGoalName: destLabel,
        amount,
        date: new Date().toISOString().split('T')[0],
        monthKey: prev.currentMonth,
        note: `Realocação voluntária de excesso da reserva para ${destLabel}`,
      };

      const notif: AppNotification = {
        id: `notif-reserve-realloc-${Date.now()}`,
        title: 'Excesso da Reserva Realocado! 🎯',
        message: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foram transferidos do excesso da reserva para "${destLabel}", mantendo o piso sagrado de 3 meses 100% blindado.`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
        freedomTotalInvested: nextFreedomInvested,
        surplusTransfers: [newTransfer, ...(prev.surplusTransfers || [])],
        notifications: [notif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const advanceInstallmentPayment = (payload: AdvanceInstallmentPayload) => {
    setState(prev => {
      const targetInst = prev.installments.find(i => i.id === payload.installmentId);
      if (!targetInst) return prev;

      const nextPaidCount = Math.min(
        targetInst.installmentsCount,
        targetInst.paidInstallmentsCount + payload.installmentsToAdvance
      );
      const isFinished = nextPaidCount >= targetInst.installmentsCount;

      const updatedInstallments = prev.installments.map(i => {
        if (i.id === payload.installmentId) {
          return {
            ...i,
            paidInstallmentsCount: nextPaidCount,
            active: !isFinished,
            completedNotified: isFinished ? false : i.completedNotified,
          };
        }
        return i;
      });

      let nextProtAmount = prev.protectionCurrentAmount;
      let nextProtInvested = prev.protectionTotalInvested;
      let nextProtComplete = prev.isProtectionComplete;
      let nextPiggyBanks = [...prev.piggyBanks];
      const newExpenses = [...prev.expenses];

      // 1. Debitar do excesso da reserva se selecionado
      if (payload.funding.fromProtectionExcess && payload.funding.fromProtectionExcess > 0) {
        nextProtAmount = Math.max(0, nextProtAmount - payload.funding.fromProtectionExcess);
        nextProtInvested = Math.max(0, nextProtInvested - payload.funding.fromProtectionExcess);
        nextProtComplete = nextProtAmount >= autoCalculatedProtectionTarget;
      }

      // 2. Debitar do cofrinho / objetivo se selecionado
      if (payload.funding.fromGoalId && payload.funding.fromGoalAmount && payload.funding.fromGoalAmount > 0) {
        nextPiggyBanks = nextPiggyBanks.map(g => {
          if (g.id === payload.funding.fromGoalId) {
            const nextCur = Math.max(0, g.currentAmount - (payload.funding.fromGoalAmount || 0));
            return {
              ...g,
              currentAmount: nextCur,
              completed: nextCur >= g.targetAmount,
            };
          }
          return g;
        });
      }

      // 3. Debitar de sobras do mês / categoria lazer se selecionado
      if (payload.funding.fromMonthSurplus && payload.funding.fromMonthSurplus > 0) {
        newExpenses.unshift({
          id: `exp-adv-${Date.now()}`,
          description: `Adiantamento de Parcela: ${targetInst.title}`,
          amount: payload.funding.fromMonthSurplus,
          category: 'lazer',
          date: new Date().toISOString().split('T')[0],
          paidBy: targetInst.paidBy || 'both',
          notes: `Adiantamento de ${payload.installmentsToAdvance}x parcela(s) usando sobra do mês.`,
        });
      }

      if (payload.funding.fromCategorySurplus && payload.funding.fromCategorySurplus.amount > 0) {
        newExpenses.unshift({
          id: `exp-adv-cat-${Date.now()}`,
          description: `Adiantamento de Parcela: ${targetInst.title}`,
          amount: payload.funding.fromCategorySurplus.amount,
          category: payload.funding.fromCategorySurplus.category,
          date: new Date().toISOString().split('T')[0],
          paidBy: targetInst.paidBy || 'both',
          notes: `Adiantamento de ${payload.installmentsToAdvance}x parcela(s) usando saldo de ${payload.funding.fromCategorySurplus.category}.`,
        });
      }

      const notif: AppNotification = {
        id: `notif-adv-${Date.now()}`,
        title: isFinished ? 'Compra 100% Quitada com Sucesso! 🚀' : 'Parcelas Adiantadas! ⚡',
        message: `${payload.installmentsToAdvance}x parcela(s) de "${targetInst.title}" foram adiantadas (R$ ${payload.totalAdvanceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Margem liberada no teto de 20%!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
      };

      return {
        ...prev,
        installments: updatedInstallments,
        protectionCurrentAmount: nextProtAmount,
        protectionTotalInvested: nextProtInvested,
        isProtectionComplete: nextProtComplete,
        piggyBanks: nextPiggyBanks,
        expenses: newExpenses,
        notifications: [notif, ...prev.notifications],
      };
    });

    triggerCelebration();
  };

  const applyAISuggestionAction = (
    insightId: string,
    actionType: 'use_reward' | 'send_to_goal' | 'keep_buffer',
    targetGoalId?: string
  ) => {
    const targetInsight = aiPredictiveInsights.find(i => i.id === insightId);
    if (!targetInsight) return;

    if (actionType === 'use_reward') {
      const rewardConfig = targetInsight.options.useReward;
      const amount = rewardConfig?.appliedAmount || targetInsight.surplusAmount || 150;
      const targetCat = rewardConfig?.targetCategory || 'lazer';

      const celebrationNotif: AppNotification = {
        id: `notif-ai-reward-${Date.now()}`,
        title: '🎉 Momento a Dois Confirmado!',
        message: `Liberamos R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} extras em ${CATEGORIES_BASE[targetCat].name} para vocês curtirem juntos sem nenhuma culpa!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
        amount,
        category: targetCat,
      };

      setState(prev => ({
        ...prev,
        appliedAIInsights: {
          ...(prev.appliedAIInsights || {}),
          [insightId]: 'use_reward',
        },
        notifications: [celebrationNotif, ...prev.notifications],
      }));

      triggerCelebration();
    } else if (actionType === 'send_to_goal') {
      const goalConfig = targetInsight.options.sendToGoal;
      const goalId = targetGoalId || goalConfig?.defaultGoalId || state.piggyBanks[0]?.id;
      const amount = goalConfig?.amount || targetInsight.surplusAmount || 100;

      if (goalId) {
        depositToGoal(goalId, amount);
      }

      const notif: AppNotification = {
        id: `notif-ai-goal-${Date.now()}`,
        title: '🎯 Sobra Enviada para o Cofrinho!',
        message: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foram direcionados com sucesso para acelerar seu objetivo a dois!`,
        timestamp: 'Agora mesmo',
        type: 'success',
        isRead: false,
        amount,
      };

      setState(prev => ({
        ...prev,
        appliedAIInsights: {
          ...(prev.appliedAIInsights || {}),
          [insightId]: 'send_to_goal',
        },
        notifications: [notif, ...prev.notifications],
      }));

      triggerCelebration();
    } else if (actionType === 'keep_buffer') {
      const bufferNotif: AppNotification = {
        id: `notif-ai-buffer-${Date.now()}`,
        title: '🛡️ Amortecedor de Caixa Preservado',
        message: `O valor de R$ ${(targetInsight.surplusAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} permanece guardado na conta corrente como segurança para o mês.`,
        timestamp: 'Agora mesmo',
        type: 'info',
        isRead: false,
      };

      setState(prev => ({
        ...prev,
        appliedAIInsights: {
          ...(prev.appliedAIInsights || {}),
          [insightId]: 'keep_buffer',
        },
        notifications: [bufferNotif, ...prev.notifications],
      }));
    }
  };

  const dismissAISuggestion = (insightId: string) => {
    setState(prev => ({
      ...prev,
      appliedAIInsights: {
        ...(prev.appliedAIInsights || {}),
        [insightId]: 'keep_buffer',
      },
    }));
  };

  return (
    <FinanceContext.Provider
      value={{
        state,
        categories,
        categoriesSpending,
        totalIncome,
        totalSpent,
        totalSpentThisMonth: totalSpent,
        remainingToSpendThisMonth: freeFlowingAmount,
        isOverBudget,
        totalBudget,
        freeFlowingAmount,
        totalSavedInPiggyBanks,
        totalMonthlyPiggyDeposits,
        blownCategories,
        highestBlownCategory,
        unreadNotificationsCount,
        activeInstallments,
        totalActiveInstallmentsAmountMonth,
        nextMonthCommittedInstallmentsAmount,
        installmentCommitmentPercentage,
        installmentLimitPercentage,
        isInstallmentCommitmentHigh,
        toggleInitialHomePhase,
        justFinishedInstallment,
        historicalTrends,
        addExpense,
        updateExpense,
        editExpense,
        deleteExpense,
        addIncome,
        deleteIncome,
        addInstallment,
        recordInstallmentPayment,
        markInstallmentPaidStep,
        deleteInstallment,
        dismissCompletedInstallmentNotification,
        addPiggyBank,
        updatePiggyBank,
        deletePiggyBank,
        removePiggyBank,
        depositPiggyBank,
        depositToPiggyBank,
        withdrawPiggyBank,
        withdrawFromPiggyBank,
        setCurrentMonth,
        syncBankAccounts,
        triggerBankSync,
        isSyncingBanks,
        markNotificationAsRead,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        addNotification,
        updateAlertRule,
        clearAllNotifications,
        autoCalculatedProtectionTarget,
        monthlyFixedExpensesAvg,
        toggleProtectionComplete,
        setProtectionComplete,
        depositToProtection,
        withdrawFromProtection,
        toggleGoalComplete,
        depositToGoal,
        withdrawFromGoal,
        depositToFreedom,
        withdrawFromFreedom,
        updateProtectionBankBalance,
        updateFreedomBankBalance,
        updateGoalBankBalance,
        updateProfile,
        updateCategoryPercentages,
        updateCategoryFloors,
        categoryLocks: state.categoryLocks || INITIAL_STATE.categoryLocks!,
        monthlyBudgetPlans: state.monthlyBudgetPlans || {},
        updateCategoryLocks,
        applyBudgetPlanContract,
        toggleThemeMode,
        setAccentTheme,
        setModeTheme,
        resetToSampleData,
        clearAllData,
        clearExpenses,
        clearInstallments,
        clearPiggyBanks,
        clearIncomes,
        triggerCelebration,
        // Modo Faculdade
        setAppMode,
        updateCollegeData,
        advanceCollegeSemester,
        depositCollegeInvestment,
        migrateCollegeToProfessional,
        partner1ShareSpent,
        partner2ShareSpent,
        jointExpensesTotal,
        partner1SoleExpensesTotal,
        partner2SoleExpensesTotal,
        monthlySpendingTotals,
        getExpenseSplit,
        currentAccent,
        activeModeThemeKey,
        isDarkMode: state.profile.themeMode === 'dark',
        viewMode,
        setViewMode,
        displayedIncome,
        displayedExpenses,
        displayedTotalSpent,
        displayedRemaining,
        updateCoupleHub: (updates) => setState(prev => ({ ...prev, ...updates })),
        payFixedBill,
        unpayFixedBill,
        convertWishlistToGoal,
        setGoalCoupleAgreement,
        recordWeeklyCheckIn,
        // Pluggy & Open finance
        pluggyAccounts: state.pluggyAccounts || INITIAL_STATE.pluggyAccounts!,
        keywordRules: state.keywordRules || DEFAULT_KEYWORD_RULES,
        detectedSubscriptions: state.detectedSubscriptions || INITIAL_STATE.detectedSubscriptions!,
        incomeSourceRules: state.incomeSourceRules || INITIAL_STATE.incomeSourceRules!,
        pendingConfirmations: state.pendingConfirmations || [],
        activeLifeTier,
        tierProgress,
        bonusShiftCalculation,
        dynamicIncomeAnalysis,
        declaredProfileIncome,
        isCustomizedPercentages,
        customizedCategoriesMap,
        restoreTierDefaultPercentages,
        applyNewTierDefaults,
        keepCustomPercentagesOnTierChange,
        pendingTierChangePrompt,
        dismissTierChangePrompt,
        // Direcionamento Seletivo de Sobras Orçamentárias
        surplusTransfers: state.surplusTransfers || [],
        allocateCategorySurplus,
        reallocateCategoryBudget,
        coverExpenseDeficitWithShift,
        distributeSurplusPercentages,
        dismissMonthSurplusNotification,
        triggerMonthSurplusNotificationManually,
        // Guia Didático de Aportes Manuais & Confirmação Visual
        monthlyDepositGuides: state.monthlyDepositGuides || {},
        completedMonthDeposits: state.completedMonthDeposits || {},
        investmentCeiling,
        getMonthlyDepositGuide,
        updateDepositGuideStrategy,
        approveMonthlyDepositGuide,
        adjustMonthlyDepositItem,
        executeMonthlyDeposit,
        resetMonthlyDeposit,
        pushSettings: state.pushSettings || DEFAULT_PUSH_SETTINGS,
        updatePushSettings,
        confirmPendingIncome,
        dismissPendingIncome,
        addIncomeSourceRule,
        removeIncomeSourceRule,
        updateFiscalProfile,
        simulateNewDepositConfirmation,
        updatePluggyAccount,
        addPluggyAccount,
        removePluggyAccount,
        syncPluggyData,
        importStatement,
        reviewBankTransaction,
        updateKeywordRules,
        addKeywordRule,
        removeKeywordRule,
        autoCategorizeDescription,
        dismissSubscription,
        confirmSubscriptionAsExpense,
        addSubscription,
        removeSubscription,
        // Auth & Couple Fusion
        currentUser,
        userProfile,
        coupleAccount,
        isCloudSynced,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInAsGuest,
        joinCoupleWithInviteCode,
        generateNewInviteCode,
        unlinkCouple,
        signOutUser,
        // Intelligent Couple Audit & Reconciliation
        detectedDuplicates,
        resolveDuplicateMerge,
        coupleSettlement,
        settlementSplitMode,
        setSettlementSplitMode,
        recordSettlementCompleted,
        predictiveBurnAlerts,
        // Gestão da Reserva de Emergência & Adiantamento de Parcelas
        emergencyReserveFloorAmount,
        emergencyReserveExcessAmount,
        reallocateReserveExcess,
        advanceInstallmentPayment,
        // Intenções de Gasto Estratégico & Triagem Omnipresente
        strategicIntents: state.strategicIntents || [],
        addStrategicIntent,
        updateStrategicIntent,
        deleteStrategicIntent,
        reconcileExpenseWithIntent,
        updateExpenseTriage,
        // Motor de Insights Preditivos & Inteligência de Abastecimento (Comida)
        foodPacingMetrics,
        aiPredictiveInsights,
        applyAISuggestionAction,
        dismissAISuggestion,
        // Gestão de Plantões Médicos & Previsão de Fluxo de Caixa
        medicalShifts: state.medicalShifts || [],
        medicalShiftPresets: state.medicalShiftPresets || DEFAULT_SHIFT_PRESETS,
        hospitalMappingRules: state.hospitalMappingRules || DEFAULT_HOSPITAL_MAPPING_RULES,
        addMedicalShift,
        updateMedicalShift,
        deleteMedicalShift,
        reconcileShiftWithIncome,
        undoShiftReconciliation,
        markShiftAsReceivedDirectly,
        addShiftPreset,
        deleteShiftPreset,
        addHospitalMappingRule,
        removeHospitalMappingRule,
      }}
    >
      {isHydratingCloud ? <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50"><section className="max-w-md text-center" role="status" aria-live="polite"><h1 className="text-xl font-semibold text-stone-900">{cloudLoadError ? 'Vamos recuperar sua conexão' : 'Abrindo o plano de vocês'}</h1><p className="mt-3 text-stone-600">{cloudLoadError || 'Carregando os registros desta conta com segurança.'}</p>{cloudLoadError && <button className="mt-5 rounded-xl bg-emerald-800 px-5 py-3 text-white" onClick={() => window.dispatchEvent(new Event('junto-membership-changed'))}>Tentar novamente</button>}<button className="mt-5 ml-3 px-4 py-3 text-stone-600" onClick={() => void signOutUser()}>Sair</button></section></main> : children}
    </FinanceContext.Provider>
  );
};

export const useFinance = (): FinanceContextType => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
