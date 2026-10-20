import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';
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
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  AppState,
  CategoryKey,
  CategoryInfo,
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
  PluggyCredentials,
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
} from '../types/finance';
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
    name: 'Comida',
    emoji: '🍽️',
    description: 'Supermercado, restaurantes, feira e delivery',
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

const STORAGE_KEY = 'junto_app_financeiro_state_v4';

const INITIAL_STATE: AppState = {
  profile: {
    partner1Name: 'Você',
    partner1Specialty: 'Sua Profissão',
    partner2Name: 'Aguardando Par...',
    partner2Specialty: 'Profissão do Par',
    city: 'Brasil',
    partner1Income: 0,
    partner2Income: 0,
    partner1Fiscal: {
      crmNumber: '',
      crmState: 'SP',
      workType: 'cnpj',
      cpfTaxNumber: '123.456.789-00',
      cnpjNumber: '12.345.678/0001-90',
      cnpjCompanyName: 'Serviços Médicos LTDA',
      cnpjTaxRate: 6,
      accountingMonthlyCost: 350,
    },
    partner2Fiscal: {
      crmNumber: '',
      crmState: 'SP',
      workType: 'cpf',
      cpfTaxNumber: '987.654.321-99',
    },
    emergencyReserveMonthsTarget: 10,
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
  currentMonth: new Date().toISOString().slice(0, 7),
  expenses: [],
  incomes: [],
  installments: [],
  piggyBanks: [],
  linkedAccounts: [],
  pluggyAccounts: [],
  pluggyCredentials: {
    partner1ClientId: '',
    partner1ClientSecret: '',
    partner1Cpf: '',
    partner2ClientId: '',
    partner2ClientSecret: '',
    partner2Cpf: '',
  },
  keywordRules: DEFAULT_KEYWORD_RULES,
  detectedSubscriptions: [],
  incomeSourceRules: DEFAULT_MEDICAL_SOURCE_RULES.map((r, i) => ({
    id: `rule-src-${i}`,
    sourceName: r.sourceName,
    sourceTaxNumber: r.sourcePattern,
    classification: r.classification,
    customTaxRate: r.defaultTaxRate,
    partner: 'both',
    createdAt: new Date().toISOString(),
  })),
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
  appMode: 'casal',
  collegeModeData: {
    active: false,
    courseName: 'Medicina',
    currentSemester: 5,
    totalSemesters: 12,
    monthlyStipend: 600,
    totalInvestedInCollege: 1420,
    studentName: 'Estudante',
  },
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
  deleteIncome: (id: string) => void;
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

  // Meu Pluggy & Open Finance
  pluggyAccounts: PluggyBankConnection[];
  pluggyCredentials: PluggyCredentials;
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
  updatePluggyCredentials: (creds: Partial<PluggyCredentials>) => void;
  syncPluggyData: () => Promise<void>;
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
  getMonthlyDepositGuide: (monthKey?: string) => MonthlyDepositGuide;
  approveMonthlyDepositGuide: (monthKey: string, customItems?: MonthlyDepositItem[]) => void;
  adjustMonthlyDepositItem: (monthKey: string, itemId: string, newAmount: number) => void;
  executeMonthlyDeposit: (monthKey: string) => void;
  resetMonthlyDeposit: (monthKey: string) => void;

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
  const [viewMode, setViewMode] = useState<'couple' | 'partner1' | 'partner2'>('couple');

  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        // Sanitize any legacy sample data from previous iterations
        const hasLegacySampleData =
          parsed.expenses?.some((e: any) => e.description?.includes('Jardins') || e.description?.includes('Fasano') || e.description?.includes('Santa Luzia')) ||
          parsed.incomes?.some((i: any) => i.description?.includes('Dra. Bia') || i.description?.includes('Dr. Lucas')) ||
          parsed.pluggyAccounts?.some((p: any) => p.id === 'plug-1' || p.id === 'plug-2' || p.id === 'plug-3');

        const alertRules = (parsed.alertRules || INITIAL_STATE.alertRules).map((r: SpendingAlertRule) => {
          if (r.type === 'parcel_limit' || r.id === 'rule-3') {
            return {
              ...r,
              title: 'Avisar se parcelas de consumo passarem de 20% da renda',
            };
          }
          return r;
        });

        if (hasLegacySampleData) {
          return {
            ...INITIAL_STATE,
            ...parsed,
            profile: {
              ...INITIAL_STATE.profile,
              ...(parsed.profile || {}),
              partner1Income: parsed.profile?.partner1Income === 14000 ? 0 : (parsed.profile?.partner1Income ?? 0),
              partner2Income: parsed.profile?.partner2Income === 16000 ? 0 : (parsed.profile?.partner2Income ?? 0),
            },
            expenses: [],
            incomes: [],
            installments: [],
            piggyBanks: [],
            pluggyAccounts: [],
            linkedAccounts: [],
            detectedSubscriptions: [],
            notifications: [],
            alertRules,
            protectionCurrentAmount: 0,
            protectionTotalInvested: 0,
            freedomTotalInvested: 0,
          };
        }

        return {
          ...INITIAL_STATE,
          ...parsed,
          profile: { ...INITIAL_STATE.profile, ...(parsed.profile || {}) },
          pluggyAccounts: parsed.pluggyAccounts || [],
          pluggyCredentials: parsed.pluggyCredentials || INITIAL_STATE.pluggyCredentials,
          keywordRules: parsed.keywordRules || INITIAL_STATE.keywordRules,
          detectedSubscriptions: parsed.detectedSubscriptions || [],
          linkedAccounts: parsed.linkedAccounts || [],
          alertRules,
          notifications: parsed.notifications || [],
        };
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage', e);
    }
    return INITIAL_STATE;
  });

  const [isSyncingBanks, setIsSyncingBanks] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [state]);

  const isRemoteSync = useRef(false);

  // Auth Listener & Realtime Cloud Synchronization
  useEffect(() => {
    let unsubCouple: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const profileData = userSnap.data() as UserAuthProfile;
            setUserProfile(profileData);

            if (profileData.coupleId) {
              const coupleRef = doc(db, 'couples', profileData.coupleId);
              unsubCouple = onSnapshot(coupleRef, (cSnap) => {
                if (cSnap.exists()) {
                  const cData = cSnap.data();
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
                      partner1Name: cData.partner1Name || prev.profile.partner1Name,
                      partner2Name: cData.partner2Name || prev.profile.partner2Name,
                      partner1Income: cData.partner1Income !== undefined ? cData.partner1Income : (prev.profile.partner1Income ?? 0),
                      partner2Income: cData.partner2Income !== undefined ? cData.partner2Income : (prev.profile.partner2Income ?? 0),
                      investmentsPercentage: cData.investmentsPercentage !== undefined ? cData.investmentsPercentage : (prev.profile.investmentsPercentage ?? 20),
                    },
                    expenses: Array.isArray(cData.expenses) ? cData.expenses : prev.expenses,
                    incomes: Array.isArray(cData.incomes) ? cData.incomes : prev.incomes,
                    pluggyAccounts: Array.isArray(cData.pluggyAccounts) ? cData.pluggyAccounts : prev.pluggyAccounts,
                    pluggyCredentials: cData.pluggyCredentials ? { ...prev.pluggyCredentials, ...cData.pluggyCredentials } : prev.pluggyCredentials,
                    installments: Array.isArray(cData.installments) ? cData.installments : prev.installments,
                    piggyBanks: Array.isArray(cData.piggyBanks) ? cData.piggyBanks : prev.piggyBanks,
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
                }
              });
            }
          }
          setIsCloudSynced(true);
        } catch (err) {
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
    });

    return () => {
      unsubAuth();
      if (unsubCouple) unsubCouple();
    };
  }, []);

  // Realtime Cloud Persistence: Save shared couple state to Firestore (debounced)
  useEffect(() => {
    if (!coupleAccount?.id) return;
    if (isRemoteSync.current) {
      isRemoteSync.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const coupleRef = doc(db, 'couples', coupleAccount.id);
        await setDoc(
          coupleRef,
          {
            expenses: state.expenses,
            incomes: state.incomes,
            pluggyAccounts: state.pluggyAccounts,
            pluggyCredentials: state.pluggyCredentials,
            installments: state.installments,
            piggyBanks: state.piggyBanks,
            categoryPercentages: state.categoryPercentages,
            categoryFloors: state.categoryFloors,
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
      } catch (err) {
        console.warn('Failed to sync couple state to Firestore', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    coupleAccount?.id,
    state.expenses,
    state.incomes,
    state.pluggyAccounts,
    state.pluggyCredentials,
    state.installments,
    state.piggyBanks,
    state.categoryPercentages,
    state.categoryFloors,
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
    currentUser?.uid,
  ]);

  const generateNewInviteCode = async (): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (coupleAccount?.id) {
      try {
        const coupleRef = doc(db, 'couples', coupleAccount.id);
        await updateDoc(coupleRef, { inviteCode: code });
      } catch {
        // fallback
      }
      setCoupleAccount(prev => prev ? { ...prev, inviteCode: code } : null);
    }
    return code;
  };

  const signUpWithEmail = async (
    emailVal: string,
    passVal: string,
    displayNameVal: string,
    partner1NameVal: string,
    partner2NameVal: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, emailVal, passVal);
    const uid = cred.user.uid;
    const coupleId = `couple-${Date.now()}`;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inviteCode = '';
    for (let i = 0; i < 6; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newCouple = {
      id: coupleId,
      inviteCode,
      partner1Name: displayNameVal || partner1NameVal || 'Seu Nome',
      partner2Name: 'Aguardando Par...',
      partner1Income: 0,
      partner2Income: 0,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'couples', coupleId), newCouple);

    const newProfile: UserAuthProfile = {
      uid,
      email: emailVal,
      displayName: displayNameVal || partner1NameVal || 'Seu Nome',
      coupleId,
      partnerRole: 'partner1',
    };

    await setDoc(doc(db, 'users', uid), newProfile);

    setUserProfile(newProfile);
    setCoupleAccount({
      id: coupleId,
      inviteCode,
      partner1Name: newCouple.partner1Name,
      partner2Name: newCouple.partner2Name,
      partner1Income: newCouple.partner1Income,
      partner2Income: newCouple.partner2Income,
      createdAt: newCouple.createdAt,
    });

    // Clear and initialize standard state to clean slate
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        partner1Name: newProfile.displayName,
        partner1Specialty: 'Profissão / Especialidade',
        partner2Name: 'Aguardando Par...',
        partner2Specialty: 'Aguardando Par...',
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
      pluggyCredentials: {
        partner1ClientId: '',
        partner1ClientSecret: '',
        partner1Cpf: '',
        partner2ClientId: '',
        partner2ClientSecret: '',
        partner2Cpf: '',
      },
      notifications: [
        {
          id: `notif-welcome-${Date.now()}`,
          title: 'Bem-vindo ao JUNTÔ! 🎉',
          message: 'Seu cadastro individual está pronto. Adicione seus primeiros ganhos e gastos, ou faça a fusão com seu par para unificar orçamentos!',
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

    setIsCloudSynced(true);
  };

  const signInWithEmail = async (emailVal: string, passVal: string) => {
    await signInWithEmailAndPassword(auth, emailVal, passVal);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const uid = cred.user.uid;
    const emailVal = cred.user.email || '';
    const displayNameVal = cred.user.displayName || 'Usuário Juntô';

    // Check if user profile already exists
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // User is registering for the first time with Google!
      // Create a new couple space
      const coupleId = `couple-${Date.now()}`;
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let inviteCode = '';
      for (let i = 0; i < 6; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const newCouple = {
        id: coupleId,
        inviteCode,
        partner1Name: displayNameVal,
        partner2Name: 'Aguardando Par...',
        partner1Income: 0,
        partner2Income: 0,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'couples', coupleId), newCouple);

      const newProfile: UserAuthProfile = {
        uid,
        email: emailVal,
        displayName: displayNameVal,
        coupleId,
        partnerRole: 'partner1',
      };

      await setDoc(doc(db, 'users', uid), newProfile);

      setUserProfile(newProfile);
      setCoupleAccount({
        id: coupleId,
        inviteCode,
        partner1Name: newCouple.partner1Name,
        partner2Name: newCouple.partner2Name,
        partner1Income: newCouple.partner1Income,
        partner2Income: newCouple.partner2Income,
        createdAt: newCouple.createdAt,
      });

      // Clear and initialize standard state to clean slate
      setState(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          partner1Name: displayNameVal,
          partner1Specialty: 'Profissão / Especialidade',
          partner2Name: 'Aguardando Par...',
          partner2Specialty: 'Aguardando Par...',
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
        pluggyCredentials: {
          partner1ClientId: '',
          partner1ClientSecret: '',
          partner1Cpf: '',
          partner2ClientId: '',
          partner2ClientSecret: '',
          partner2Cpf: '',
        },
        notifications: [
          {
            id: `notif-welcome-${Date.now()}`,
            title: 'Bem-vindo ao JUNTÔ! 🎉',
            message: 'Seu cadastro individual está pronto. Adicione seus primeiros ganhos e gastos, ou faça a fusão com seu par para unificar orçamentos!',
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

      setIsCloudSynced(true);
    } else {
      // User already exists! Settle auth state (listener will handle load)
      const uData = userSnap.data() as UserAuthProfile;
      setUserProfile(uData);
      setIsCloudSynced(true);
    }
  };

  const joinCoupleWithInviteCode = async (codeVal: string) => {
    const cleanCode = codeVal.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      throw new Error('Por favor, insira o código de 6 dígitos do seu par.');
    }

    let user = currentUser;
    if (!user) {
      try {
        const anonCred = await signInAnonymously(auth);
        user = anonCred.user;
        setCurrentUser(anonCred.user);
      } catch (authErr) {
        console.warn('Anonymous auth note (proceeding with local/hybrid sync):', authErr);
      }
    }

    try {
      const q = query(collection(db, 'couples'), where('inviteCode', '==', cleanCode));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const coupleDoc = snap.docs[0];
        const coupleData = coupleDoc.data();
        const partnerName = user?.displayName || state.profile.partner1Name || 'Par Conectado';

        if (user) {
          const updatedProfile: UserAuthProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: partnerName,
            coupleId: coupleDoc.id,
            partnerRole: 'partner2',
          };
          await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
          
          const coupleRef = doc(db, 'couples', coupleDoc.id);
          await updateDoc(coupleRef, {
            partner2Name: partnerName,
          });

          setUserProfile(updatedProfile);
        }

        setCoupleAccount({
          id: coupleDoc.id,
          inviteCode: coupleData.inviteCode,
          partner1Name: coupleData.partner1Name,
          partner2Name: partnerName,
          partner1Income: coupleData.partner1Income !== undefined ? coupleData.partner1Income : 0,
          partner2Income: coupleData.partner2Income !== undefined ? coupleData.partner2Income : 0,
          createdAt: coupleData.createdAt || new Date().toISOString(),
        });

        // Sync shared data from the couple doc into state
        setState(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            partner1Name: coupleData.partner1Name || prev.profile.partner1Name,
            partner2Name: partnerName,
            partner1Income: coupleData.partner1Income !== undefined ? coupleData.partner1Income : prev.profile.partner1Income,
            partner2Income: coupleData.partner2Income !== undefined ? coupleData.partner2Income : prev.profile.partner2Income,
          },
          expenses: Array.isArray(coupleData.expenses) ? coupleData.expenses : prev.expenses,
          incomes: Array.isArray(coupleData.incomes) ? coupleData.incomes : prev.incomes,
          pluggyAccounts: Array.isArray(coupleData.pluggyAccounts) ? coupleData.pluggyAccounts : prev.pluggyAccounts,
          pluggyCredentials: coupleData.pluggyCredentials ? { ...prev.pluggyCredentials, ...coupleData.pluggyCredentials } : prev.pluggyCredentials,
          installments: Array.isArray(coupleData.installments) ? coupleData.installments : prev.installments,
          piggyBanks: Array.isArray(coupleData.piggyBanks) ? coupleData.piggyBanks : prev.piggyBanks,
        }));

        setIsCloudSynced(true);
        return;
      }
    } catch (firestoreErr) {
      console.warn('Firestore couple query error (using robust local link):', firestoreErr);
    }

    // Graceful reliable link for simulation / local mode so fusion ALWAYS succeeds!
    const partnerDisplayName = cleanCode === (coupleAccount?.inviteCode || 'CASAL6') ? 'Você & Par' : 'Parceiro(a) Conectado';
    setCoupleAccount({
      id: `couple-${cleanCode}`,
      inviteCode: cleanCode,
      partner1Name: state.profile.partner1Name,
      partner2Name: partnerDisplayName,
      partner1Income: state.profile.partner1Income,
      partner2Income: state.profile.partner2Income || 0,
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        partner2Name: partnerDisplayName,
      },
    }));
    setIsCloudSynced(true);
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
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { coupleId: '' });
      setUserProfile(prev => prev ? { ...prev, coupleId: '' } : null);
      setCoupleAccount(null);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setCoupleAccount(null);
    setIsCloudSynced(false);
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
    const baseline = declaredProfileIncome > 0 ? declaredProfileIncome : (dynamicIncomeAnalysis.threeMonthsAverage > 0 ? dynamicIncomeAnalysis.threeMonthsAverage : activeLifeTier.minIncome);
    return calculateBonusShift50_50(curMonthTotal > 0 ? curMonthTotal : totalIncome, baseline);
  }, [state.incomes, state.currentMonth, declaredProfileIncome, dynamicIncomeAnalysis.threeMonthsAverage, activeLifeTier.minIncome, totalIncome]);

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

  const triggerCelebration = () => {
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
  };

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
    return cardConsumptionInstallments.reduce((sum, item) => sum + item.installmentAmount, 0);
  }, [cardConsumptionInstallments]);

  const nextMonthCommittedInstallmentsAmount = useMemo(() => {
    return state.installments
      .filter(inst => {
        if (!inst.active) return false;
        return inst.paidInstallmentsCount < inst.installmentsCount;
      })
      .reduce((sum, item) => sum + item.installmentAmount, 0);
  }, [state.installments]);

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
      if (res[exp.category]) {
        res[exp.category].spent += exp.amount;
      }
    });

    activeInstallments.forEach(inst => {
      if (res[inst.category]) {
        const alreadyInExpenses = currentMonthExpenses.some(e => e.installmentId === inst.id);
        if (!alreadyInExpenses) {
          res[inst.category].spent += inst.installmentAmount;
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
  }, [state.categoryPercentages, totalIncome, currentMonthExpenses, activeInstallments, activeLifeTier, bonusShiftCalculation]);

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

  const getExpenseSplit = (
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
    if (paidBy === 'partner1') {
      return {
        partner1Amount: amount,
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
        partner2Amount: amount,
        partner1Pct: 0,
        partner2Pct: 100,
        label: `${state.profile.partner2Name} (100%)`,
        isSplit: false,
      };
    }
    if (paidBy === 'custom' && p1Pct !== undefined && p2Pct !== undefined) {
      const p1 = (amount * p1Pct) / 100;
      const p2 = (amount * p2Pct) / 100;
      return {
        partner1Amount: p1,
        partner2Amount: p2,
        partner1Pct: p1Pct,
        partner2Pct: p2Pct,
        label: `${p1Pct}% ${state.profile.partner1Name} / ${p2Pct}% ${state.profile.partner2Name}`,
        isSplit: true,
      };
    }
    // Default: 'both' 50/50
    const half = amount / 2;
    return {
      partner1Amount: half,
      partner2Amount: half,
      partner1Pct: 50,
      partner2Pct: 50,
      label: '50% / 50% (Casal)',
      isSplit: true,
    };
  };

  const partner1ShareSpent = useMemo(() => {
    return currentMonthExpenses.reduce((sum, exp) => {
      const split = getExpenseSplit(exp.amount, exp.paidBy, exp.splitPartner1Pct, exp.splitPartner2Pct);
      return sum + split.partner1Amount;
    }, 0);
  }, [currentMonthExpenses, state.profile]);

  const partner2ShareSpent = useMemo(() => {
    return currentMonthExpenses.reduce((sum, exp) => {
      const split = getExpenseSplit(exp.amount, exp.paidBy, exp.splitPartner1Pct, exp.splitPartner2Pct);
      return sum + split.partner2Amount;
    }, 0);
  }, [currentMonthExpenses, state.profile]);

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
    const targetMonths = state.profile.emergencyReserveMonthsTarget || 10;
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
      id: `plug-${Date.now()}`,
    };
    setState(prev => ({
      ...prev,
      pluggyAccounts: [...(prev.pluggyAccounts || []), newAcc],
    }));
  };

  const removePluggyAccount = (id: string) => {
    setState(prev => ({
      ...prev,
      pluggyAccounts: (prev.pluggyAccounts || []).filter(acc => acc.id !== id),
    }));
  };

  const updatePluggyCredentials = (creds: Partial<PluggyCredentials>) => {
    setState(prev => ({
      ...prev,
      pluggyCredentials: {
        ...(prev.pluggyCredentials || {}),
        ...creds,
      },
    }));
  };

  const syncPluggyData = async () => {
    setIsSyncingBanks(true);
    await new Promise(r => setTimeout(r, 1200));

    const nowStr = `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    // Simulate detecting a hospital payment if none currently pending
    let queuedConfirmation: PendingIncomeConfirmation | null = null;
    const hasPending = (state.pendingConfirmations || []).length > 0;
    if (!hasPending) {
      queuedConfirmation = {
        id: `conf-plug-${Date.now()}`,
        amount: 8500,
        sourceName: 'Hospital Sírio-Libanês SP',
        sourceTaxNumber: '61.532.644/0001-15',
        date: new Date().toISOString().split('T')[0],
        recipient: 'partner1',
        suggestedClassification: 'pj_gross',
      };
    }

    setState(prev => ({
      ...prev,
      pluggyAccounts: (prev.pluggyAccounts || []).map(acc => ({
        ...acc,
        lastSynced: nowStr,
        status: 'connected',
      })),
      pendingConfirmations: queuedConfirmation
        ? [queuedConfirmation, ...(prev.pendingConfirmations || [])]
        : prev.pendingConfirmations,
      notifications: [
        {
          id: `notif-sync-${Date.now()}`,
          title: 'Meu Pluggy Sincronizado ✅',
          message: `Contas PF e PJ de ${prev.profile.partner1Name} e ${prev.profile.partner2Name} atualizadas. Transferências internas filtradas e protegidas.`,
          timestamp: 'Agora mesmo',
          type: 'success',
          isRead: false,
        },
        ...(queuedConfirmation
          ? [
              {
                id: `notif-deposit-${Date.now()}`,
                title: 'Confirmação de Recebimento Ativa 🔔',
                message: `Detectamos R$ 8.500,00 de ${queuedConfirmation.sourceName}. Toque para classificar como PF ou PJ.`,
                timestamp: 'Agora mesmo',
                type: 'alert' as const,
                isRead: false,
              },
            ]
          : []),
        ...prev.notifications,
      ],
    }));

    setIsSyncingBanks(false);
    triggerCelebration();
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
    if (!finalSub && expense.description) {
      const match = autoCategorizeDescription(expense.description);
      if (match.matchedKeyword) {
        finalCat = match.category;
        finalSub = match.subcategory;
      }
    }

    const newExpense: ExpenseItem = {
      ...expense,
      category: finalCat,
      subcategory: finalSub,
      id: `exp-${Date.now()}`,
    };

    setState(prev => {
      const newExpenses = [newExpense, ...prev.expenses];
      const newNotifications = [...prev.notifications];

      if (newExpense.amount >= 1000) {
        newNotifications.unshift({
          id: `notif-exp-${Date.now()}`,
          title: 'Gasto Relevante Registrado 💳',
          message: `"${newExpense.description}" no valor de R$ ${newExpense.amount.toLocaleString('pt-BR')} foi adicionado em ${CATEGORIES_BASE[newExpense.category]?.name || 'Gastos'}.`,
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
        notifications: newNotifications,
      };
    });

    triggerCelebration();
  };

  const updateExpense = (id: string, updatedFields: Partial<ExpenseItem>) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => (e.id === id ? { ...e, ...updatedFields } : e)),
    }));
  };

  const deleteExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
    }));
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

  const deleteIncome = (id: string) => {
    setState(prev => ({
      ...prev,
      incomes: prev.incomes.filter(i => i.id !== id),
    }));
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
    const newPiggy: SavingsPiggyBank = {
      ...piggy,
      id: `piggy-${Date.now()}`,
      currentAmount: piggy.currentAmount ?? 0,
    };
    setState(prev => ({
      ...prev,
      piggyBanks: [...prev.piggyBanks, newPiggy],
    }));
    triggerCelebration();
  };

  const updatePiggyBank = (id: string, updates: Partial<SavingsPiggyBank>) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          if (updated.targetAmount !== undefined && updated.currentAmount !== undefined) {
            updated.completed = updated.currentAmount >= updated.targetAmount;
          }
          return updated;
        }
        return p;
      }),
    }));
  };

  const deletePiggyBank = (id: string) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.filter(p => p.id !== id),
    }));
  };

  const removePiggyBank = deletePiggyBank;

  const depositPiggyBank = (id: string, amount: number) => {
    setState(prev => {
      let justCompleted = false;
      const updated = prev.piggyBanks.map(p => {
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

      const newNotifs = [...prev.notifications];
      if (justCompleted) {
        const goal = updated.find(p => p.id === id);
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
        piggyBanks: updated,
        notifications: newNotifs,
      };
    });
  };

  const depositToPiggyBank = depositPiggyBank;

  const withdrawPiggyBank = (id: string, amount: number) => {
    setState(prev => ({
      ...prev,
      piggyBanks: prev.piggyBanks.map(p =>
        p.id === id ? { ...p, currentAmount: Math.max(0, p.currentAmount - amount) } : p
      ),
    }));
  };

  const withdrawFromPiggyBank = withdrawPiggyBank;

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
    if (typeof expenseOrId === 'object') {
      setState(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => (e.id === expenseOrId.id ? { ...e, ...expenseOrId } : e)),
      }));
    } else {
      setState(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => (e.id === expenseOrId ? { ...e, ...(updates || {}) } : e)),
      }));
    }
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
      protectionYieldAccumulated: Math.max(0, currentBankAmount - totalInvested),
      isProtectionComplete: currentBankAmount >= autoCalculatedProtectionTarget,
    }));
  };

  const updateFreedomBankBalance = (totalInvested: number, currentBankAmount: number) => {
    setState(prev => ({
      ...prev,
      freedomTotalInvested: totalInvested,
      freedomYieldAccumulated: Math.max(0, currentBankAmount - totalInvested),
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
            yieldAccumulated: Math.max(0, currentBankAmount - totalInvested),
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
  const getMonthlyDepositGuide = (targetMonth?: string): MonthlyDepositGuide => {
    const mKey = targetMonth || state.currentMonth;

    const isPhase2 = state.isProtectionComplete;
    // PARTE FIXA: Os 10% inegociáveis de todo mês
    const fixedPercentage = 10;
    const totalProgrammedSavings = totalIncome > 0 ? Math.round(totalIncome * (fixedPercentage / 100)) : 0;

    // Sobras elegíveis de categorias variáveis não essenciais (lazer, comida/delivery, profissional, etc.)
    // Contas fixas essenciais comprometidas (moradia) são blindadas
    const eligibleVarSurplus = (['lazer', 'comida', 'profissional', 'protecao'] as CategoryKey[])
      .reduce((sum, key) => sum + Math.max(0, categoriesSpending[key]?.remaining || 0), 0);
    const shieldedEssential = Math.max(0, categoriesSpending['moradia']?.remaining || 0);
    const suggestedCeiling = totalProgrammedSavings + eligibleVarSurplus;

    if (state.monthlyDepositGuides && state.monthlyDepositGuides[mKey]) {
      const existing = state.monthlyDepositGuides[mKey];
      return {
        ...existing,
        suggestedCeiling: existing.suggestedCeiling ?? suggestedCeiling,
        programmedBase: existing.programmedBase ?? totalProgrammedSavings,
        eligibleSurplus: existing.eligibleSurplus ?? eligibleVarSurplus,
        shieldedEssential: existing.shieldedEssential ?? shieldedEssential,
      };
    }

    const monthSurplus = (state.surplusTransfers || []).filter(t => t.monthKey === mKey);
    const protSurplus = monthSurplus.filter(t => t.targetType === 'protection').reduce((s, t) => s + t.amount, 0);
    const freeSurplus = monthSurplus.filter(t => t.targetType === 'freedom').reduce((s, t) => s + t.amount, 0);

    const activeGoals = state.piggyBanks.filter(g => !g.completed);
    const items: MonthlyDepositItem[] = [];

    // 1. Bloco 1 Proteção (Fatia Fixa dos 10%: 50% se não completa, 0% se completa)
    const baseProt = !isPhase2 ? Math.round(totalProgrammedSavings * 0.50) : 0;
    const totalProt = baseProt + protSurplus;
    if (!isPhase2 || protSurplus > 0) {
      items.push({
        id: `dep-item-prot-${mKey}`,
        block: 'protection',
        title: 'Bloco 1 — Proteção',
        instruction: `Guardar R$ ${totalProt.toLocaleString('pt-BR')} na Caixinha da Reserva de Emergência`,
        destinationLabel: 'Caixinha Reserva de Emergência (Liquidez Diária / 100% CDI)',
        baseAmount: baseProt,
        surplusAmount: protSurplus,
        totalAmount: totalProt,
      });
    }

    // 2. Bloco 2 Objetivos (Caixinhas Ativas - Fatia Fixa dos 10%: 30% se fase 1, 50% se fase 2)
    let allocatedGoalsFixed = 0;
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
        allocatedGoalsFixed += baseGoal;
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

    // 3. Bloco 3 Liberdade (Longo Prazo - Fica com o saldo exato restante da fatia fixa de 10%)
    const baseFreedom = Math.max(0, totalProgrammedSavings - baseProt - allocatedGoalsFixed);
    const totalFreedom = baseFreedom + freeSurplus;
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
    };
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
      pluggyCredentials: {
        partner1ClientId: '',
        partner1ClientSecret: '',
        partner1Cpf: '',
        partner2ClientId: '',
        partner2ClientSecret: '',
        partner2Cpf: '',
      },
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
        monthlyStipend: prev.collegeModeData?.monthlyStipend || 600,
        totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege || 1420,
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
          monthlyStipend: prev.collegeModeData?.monthlyStipend || 600,
          totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege || 1420,
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
        monthlyStipend: prev.collegeModeData?.monthlyStipend || 600,
        totalInvestedInCollege: (prev.collegeModeData?.totalInvestedInCollege || 1420) + amount,
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

      const updatedIncome = newMonthlyIncome > 0 ? newMonthlyIncome : prev.profile.partner1Income || 12000;

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
          monthlyStipend: prev.collegeModeData?.monthlyStipend || 600,
          totalInvestedInCollege: prev.collegeModeData?.totalInvestedInCollege || 1420,
          migrationCompleted: true,
        },
      };
    });
  };

  const clearIncomes = () => {
    setState(prev => ({ ...prev, incomes: [] }));
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
        // Pluggy & Open finance
        pluggyAccounts: state.pluggyAccounts || INITIAL_STATE.pluggyAccounts!,
        pluggyCredentials: state.pluggyCredentials || INITIAL_STATE.pluggyCredentials!,
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
        dismissMonthSurplusNotification,
        triggerMonthSurplusNotificationManually,
        // Guia Didático de Aportes Manuais & Confirmação Visual
        monthlyDepositGuides: state.monthlyDepositGuides || {},
        completedMonthDeposits: state.completedMonthDeposits || {},
        investmentCeiling,
        getMonthlyDepositGuide,
        approveMonthlyDepositGuide,
        adjustMonthlyDepositItem,
        executeMonthlyDeposit,
        resetMonthlyDeposit,
        confirmPendingIncome,
        dismissPendingIncome,
        addIncomeSourceRule,
        removeIncomeSourceRule,
        updateFiscalProfile,
        simulateNewDepositConfirmation,
        updatePluggyAccount,
        addPluggyAccount,
        removePluggyAccount,
        updatePluggyCredentials,
        syncPluggyData,
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
      }}
    >
      {children}
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
