export type CategoryKey = 'moradia' | 'comida' | 'lazer' | 'protecao' | 'profissional' | 'transporte';

export type PaidBy = 'partner1' | 'partner2' | 'both' | 'custom';

export type AccentTheme = 'emerald' | 'sapphire' | 'violet' | 'rose' | 'amber' | 'slate';

export type ScreenId =
  | 'home'
  | 'calendar'
  | 'categories'
  | 'transactions'
  | 'installments'
  | 'goals'
  | 'trends'
  | 'settings'
  | 'projections'
  | 'shifts'
  | 'couple_hub';

export interface CategoryInfo {
  key: CategoryKey | string;
  name: string;
  emoji: string;
  description: string;
  percentage?: number; // e.g. 40% of income
  budget?: number; // calculated in R$
  colorHex: string;
  bgLight: string;
  borderHex: string;
  isLegacy?: boolean;
}

export interface ExpenseItem {
  foodPillar?: FoodPillarType;
  id: string;
  description: string;
  amount: number;
  category: CategoryKey;
  subcategory?: string; // e.g. "delivery", "eletrodomesticos", "supermercado", "restaurante", "aluguel", etc.
  date: string; // YYYY-MM-DD
  paidBy: PaidBy;
  splitPartner1Pct?: number; // percentage paid by partner 1 (0 to 100)
  splitPartner2Pct?: number; // percentage paid by partner 2 (0 to 100)
  bankName?: string;
  installmentId?: string;
  installmentIndex?: number;
  installmentTotal?: number;
  notes?: string;
  // Triagem Omnipresente & Alocação Proativa de Fonte
  fundingSource?: FundingSourceType;
  fundingGoalId?: string;
  fundingGoalName?: string;
  strategicIntentId?: string;
  isExcludedFromMonthlyBudget?: boolean;
  triageDone?: boolean;
  reconciledWithIntent?: boolean;
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  assignedTo?: 'couple' | 'partner1' | 'partner2';
  linkedBillId?: string;
  billCompetenceMonth?: string; // YYYY-MM
}

export type FundingSourceType =
  | 'month_budget'        // Orçamento do Mês (rotina diária da casa)
  | 'piggy_bank'          // Caixinha / Cofrinho de Objetivo
  | 'reserve_excess'      // Excesso da Reserva de Emergência (> piso de 3 meses)
  | 'personal_allowance'; // Mesada Individual

export interface StrategicSpendingIntent {
  id: string;
  title: string;
  estimatedAmount: number;
  category: CategoryKey;
  targetSource: FundingSourceType;
  targetGoalId?: string;
  targetGoalName?: string;
  targetPartner?: 'partner1' | 'partner2';
  assignedTo: 'couple' | 'partner1' | 'partner2';
  paymentMethod: 'pix' | 'debit' | 'credit' | 'cash';
  status: 'pending' | 'matched' | 'executed';
  matchedExpenseId?: string;
  notes?: string;
  createdAt: string;
}

export interface IncomeItem {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  recipient: PaidBy;
  type: 'salario' | 'bonus' | 'extra' | 'restituicao' | 'outro';
}

export interface InstallmentPurchase {
  id: string;
  title: string;
  category: CategoryKey;
  type?: 'card_consumption' | 'financing'; // Financiamento Estrutural (PF) vs Parcelas de Consumo (Cartão)
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  startMonth: string; // YYYY-MM
  paidInstallmentsCount: number;
  active: boolean;
  paidBy: PaidBy;
  splitPartner1Pct?: number;
  splitPartner2Pct?: number;
  completedNotified?: boolean;
  bankName?: string; // e.g. "Nubank Ultravioleta", "Itaú Personalité", "BTG Pactual"
  dueDay?: number; // Day of the month of the card invoice (e.g., 5, 10, 15, 20)
  store?: string; // e.g. "Tok&Stok", "Fast Shop", "Apple Store"
  notes?: string;
}

export interface AdvanceInstallmentFundingSource {
  fromProtectionExcess?: number;
  fromGoalId?: string;
  fromGoalAmount?: number;
  fromMonthSurplus?: number;
  fromCategorySurplus?: {
    category: CategoryKey;
    amount: number;
  };
}

export interface AdvanceInstallmentPayload {
  installmentId: string;
  installmentsToAdvance: number;
  totalAdvanceAmount: number;
  funding: AdvanceInstallmentFundingSource;
  note?: string;
}

export interface CoupleAgreement {
  type: 'equal_50_50' | 'proportional' | 'custom';
  partner1SharePct: number;
  partner2SharePct: number;
  notes?: string;
}

export interface SavingsPiggyBank {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string; // Custom uploaded image / photo by user
  purpose: string;
  currentAmount: number;
  targetAmount: number;
  monthlyDeposit: number;
  targetMonths?: number;
  totalInvested?: number;
  yieldAccumulated?: number;
  completed?: boolean;
  isFireEligible?: boolean;
  coupleAgreement?: CoupleAgreement;
}

export interface FiscalProfile {
  crmNumber?: string;
  crmState?: string; // e.g. "SP", "RJ", "MG"
  workType?: 'cpf' | 'cnpj' | 'misto';
  cpfTaxNumber?: string;
  cnpjNumber?: string;
  cnpjCompanyName?: string;
  cnpjTaxRate?: number; // e.g. 6 (for 6%)
  accountingMonthlyCost?: number; // e.g. 350
}

export type IncomeSourceClassification = 'pf_net' | 'pj_gross' | 'internal_transfer' | 'reimbursement';

export interface IncomeSourceRule {
  id: string;
  sourceName: string; // e.g. "Hospital Israelita Albert Einstein", "Unimed"
  sourceTaxNumber?: string; // CNPJ / CPF
  classification: IncomeSourceClassification;
  customTaxRate?: number;
  partner?: 'partner1' | 'partner2' | 'both';
  createdAt: string;
}

export interface PendingIncomeConfirmation {
  id: string;
  amount: number;
  sourceName: string;
  sourceTaxNumber?: string;
  date: string;
  bankAccountId?: string;
  recipient: 'partner1' | 'partner2' | 'both';
  suggestedClassification?: IncomeSourceClassification;
}

export type LifeTierKey = 'decolagem' | 'tracao' | 'voo_alto' | 'orbita';

export interface LifeTierInfo {
  key: LifeTierKey;
  name: string;
  shortName: string;
  emblem: string;
  minIncome: number;
  maxIncome: number;
  message: string;
  tagline: string;
  colors: {
    primary: string;
    secondary: string;
    lightBg: string;
    darkBg: string;
    border: string;
    glow: string;
    text: string;
    gradientFrom: string;
    gradientTo: string;
  };
  percentages: Record<CategoryKey, number> & { investimentos: number };
  floors: {
    moradiaPct?: number;
    transportePct?: number;
    comidaPct?: number;
    protecaoR$?: number;
    investimentosMinPct?: number;
  };
  reserveDistributionPct?: number; // e.g. 77% in Tração
  inflectionNote: string;
}

export type MedicalCareerStage = 'graduacao' | 'internato' | 'preparacao_residencia' | 'residencia' | 'atuacao';
export interface MedicalCareerProfile {
  stage: MedicalCareerStage;
  graduationDate?: string;
  residencyStartDate?: string;
  expectedMonthlyIncome?: number;
  transitionMonthlyExpense?: number;
}

export interface CoupleProfile {
  partner1Career?: MedicalCareerProfile;
  partner2Career?: MedicalCareerProfile;
  partner1Name: string;
  partner1Specialty?: string; // e.g. "Dermatologia" or "Clínico Geral"
  partner2Name: string;
  partner2Specialty?: string; // e.g. "Cardiologia" or "Clínico Geral"
  city: string; // e.g. "São Paulo - SP"
  partner1Income: number;
  partner2Income: number;
  partner1Fiscal?: FiscalProfile;
  partner2Fiscal?: FiscalProfile;
  emergencyReserveMonthsTarget: number;
  expectedYieldAnnual: number; // percentage above inflation, e.g. 6.5
  streakMonths: number;
  themeMode: 'light' | 'dark';
  accentTheme: AccentTheme;
  coupleTheme?: AccentTheme; // Theme color for Couple View
  partner1Theme?: AccentTheme; // Theme color for Partner 1 View
  partner2Theme?: AccentTheme; // Theme color for Partner 2 View
  isInitialHomePhase?: boolean; // If true, 20% limit for initial home setup instead of standard 10%
  investmentsPercentage?: number; // default 20%
}

export interface PluggyBankConnection {
  id: string;
  itemId: string;
  accountId: string;
  name: string; // e.g. "Nubank Ultravioleta", "Itaú Personalité"
  bankName: string; // "Nubank", "Itaú", "BTG Pactual", "Inter", "Bradesco", "Santander"
  accountType: 'corrente' | 'cartao' | 'poupanca' | 'investimento';
  type: 'individual' | 'conjunta';
  owner: 'partner1' | 'partner2' | 'both';
  taxNumber: string; // CPF (e.g. "123.456.789-00")
  balance: number;
  lastSynced: string;
  consentExpiresAt: string; // 12-month Open Finance regulatory expiration
  status: 'connected' | 'syncing' | 'needs_reauth' | 'error';
  appOwner: 'partner1' | 'partner2'; // which Pluggy application provided the data
}


export interface CategoryKeywordRule {
  id: string;
  keyword: string; // uppercase keyword, e.g. "UBER", "NETFLIX", "IFOOD"
  category: CategoryKey;
  subcategory?: string;
}

export interface DetectedSubscription {
  id: string;
  merchant: string;
  amount: number;
  category: CategoryKey;
  frequency: 'mensal';
  lastDate: string;
  dueDay?: number;
  payer?: PaidBy;
  status: 'active' | 'detected_pending' | 'dismissed';
  accountId?: string;
  notes?: string;
}

export interface LinkedBankAccount {
  id: string;
  bankName: string;
  accountType: 'corrente' | 'cartao' | 'investimento';
  accountNumber: string;
  holder: PaidBy;
  balance: number;
  lastSynced: string;
  status: 'connected' | 'syncing' | 'error';
  colorHex: string;
  logo: string;
}

export interface SpendingAlertRule {
  id: string;
  title: string;
  type: 'amount_threshold' | 'category_limit' | 'parcel_limit';
  thresholdAmount?: number;
  categoryKey?: CategoryKey;
  enabled: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'alert' | 'success' | 'info';
  isRead: boolean;
  category?: CategoryKey;
  amount?: number;
}

export interface SurplusTransferRecord {
  id: string;
  sourceCategory: CategoryKey | 'all_surplus';
  targetType: 'protection' | 'goal' | 'freedom' | 'category' | 'shift_offset' | 'leisure';
  targetGoalId?: string;
  targetGoalName: string;
  amount: number;
  date: string;
  monthKey: string;
  note?: string;
}

export interface MonthlyDepositItem {
  id: string;
  block: 'protection' | 'goals' | 'freedom';
  title: string;
  instruction: string;
  destinationLabel: string;
  baseAmount: number;
  surplusAmount: number;
  totalAmount: number;
  targetGoalId?: string;
  targetGoalEmoji?: string;
}

export interface MonthlyDepositGuide {
  monthKey: string;
  items: MonthlyDepositItem[];
  totalPlanned: number;
  status: 'pending_approval' | 'approved' | 'completed';
  approvedAt?: string;
  completedAt?: string;
  suggestedCeiling?: number;
  programmedBase?: number;
  eligibleSurplus?: number;
  shieldedEssential?: number;
  focusStrategy?: '100_percent_reserve' | 'split_freedom';
  redirectedBlock2Surplus?: number;
}

export interface MonthDepositCompletionRecord {
  monthKey: string;
  completedAt: string;
  totalDeposited: number;
  items: MonthlyDepositItem[];
}

export interface MonthTrendRecord {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Mai", "Jun"
  spending: Record<CategoryKey, number>;
  total: number;
  budget: number;
}

export type AppMode = 'casal' | 'faculdade';

export type CollegeCategoryKey =
  | 'casa_transporte'
  | 'alimentacao_rua'
  | 'lazer_social'
  | 'faculdade'
  | 'investimentos';

export interface CollegeCategoryInfo {
  key: CollegeCategoryKey;
  name: string;
  emoji: string;
  description: string;
  percentage: number; // e.g. 25%
  budget: number; // e.g. R$ 150
  floorR$: number; // Minimum floor in R$
  colorHex: string;
  bgLight: string;
  borderHex: string;
}

export interface CollegeModeData {
  active: boolean;
  courseName: string; // e.g. "Medicina", "Engenharia", "Direito"
  currentSemester: number; // e.g. 5
  totalSemesters: number; // e.g. 12
  monthlyStipend: number; // e.g. 600
  totalInvestedInCollege: number; // R$ invested so far
  studentName?: string;
  migrationCompleted?: boolean;
}

export interface BankImportedTransaction {
  id: string;
  itemId: string;
  accountId: string;
  amount: number;
  date: string;
  description: string;
  direction: 'credit' | 'debit';
  owner: PaidBy;
  status: 'pending' | 'expense' | 'income' | 'internal_transfer';
  category?: CategoryKey;
  subcategory?: string;
  matchedRule?: string;
}

export interface AppState {
  bankImportedTransactions?: BankImportedTransaction[];
  shiftIncomeAllocations?: ShiftIncomeAllocation[];
  profile: CoupleProfile;
  appMode?: AppMode;
  collegeModeData?: CollegeModeData;
  categoryPercentages: Record<CategoryKey, number>;
  categoryFloors?: Record<string, number>; // Minimum floor values in R$ (or % for investimentos)
  isCustomizedPercentages?: boolean;
  lastAcknowledgedTierKey?: LifeTierKey;
  lastWeeklyCheckInAt?: string; // YYYY-MM-DD
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  installments: InstallmentPurchase[];
  piggyBanks: SavingsPiggyBank[];
  currentMonth: string; // YYYY-MM (e.g. "2026-10")
  linkedAccounts: LinkedBankAccount[];
  alertRules: SpendingAlertRule[];
  notifications: AppNotification[];
  // Open Finance & Meu Pluggy
  pluggyAccounts?: PluggyBankConnection[];
  keywordRules?: CategoryKeywordRule[];
  detectedSubscriptions?: DetectedSubscription[];
  incomeSourceRules?: IncomeSourceRule[];
  pendingConfirmations?: PendingIncomeConfirmation[];
  // Block 1 — Proteção
  protectionCurrentAmount: number;
  protectionTotalInvested: number;
  protectionYieldAccumulated: number;
  isProtectionComplete: boolean;
  // Block 3 — Liberdade
  freedomTotalInvested: number;
  freedomYieldAccumulated: number;
  surplusTransfers?: SurplusTransferRecord[];
  dismissedSurplusMonths?: string[];
  monthlyDepositGuides?: Record<string, MonthlyDepositGuide>;
  completedMonthDeposits?: Record<string, MonthDepositCompletionRecord>;
  appliedAIInsights?: Record<string, 'use_reward' | 'send_to_goal' | 'keep_buffer'>;
  temporaryBudgetAdjustments?: Record<string, { category: CategoryKey; amount: number; expiresAt: string }>;
  // Intenções de Gasto Estratégico (Alocação Proativa de Reserva/Caixinhas)
  strategicIntents?: StrategicSpendingIntent[];
  // Notificações Push & Alertas Estratégicos
  pushSettings?: PushNotificationSettings;
  // Gestão de Plantões Médicos & Escalas
  medicalShifts?: MedicalShift[];
  medicalShiftPresets?: MedicalShiftPreset[];
  hospitalMappingRules?: HospitalIncomeMappingRule[];
  // Hub do Casal
  coupleGoals?: CoupleGoal[];
  coupleWishlist?: CoupleWishlistItem[];
  coupleFixedBills?: FixedBillAlert[];
  dreamSimulations?: DreamSimulation[];
}

export type ShiftSector =
  | 'porta'
  | 'vermelha'
  | 'uti'
  | 'enfermaria'
  | 'sobreaviso'
  | 'evento'
  | 'outro';

export type ShiftContractType =
  | 'clt'
  | 'pj_privado'
  | 'pj_oss'
  | 'evento'
  | 'outro';

export type ShiftPaymentStatus = 'pending' | 'overdue' | 'received';

export interface ShiftIncomeAllocation {
  id: string; // one ledger per real deposit, prevents concurrent over-allocation
  allocations: Record<string, number>; // shift ID -> amount, in integer cents
}

export interface MedicalShift {
  executionStatus?: 'scheduled' | 'performed' | 'cancelled' | 'replaced';
  id: string;
  partner: 'partner1' | 'partner2';
  title: string;
  hospitalName: string;
  sector: ShiftSector;
  contractType: ShiftContractType;
  dateWorked: string; // YYYY-MM-DD
  durationHours: number; // 6, 12, 24, etc.
  grossAmount: number;
  netAmount?: number;
  estimatedPayDate: string; // YYYY-MM-DD
  actualPayDate?: string;
  status: ShiftPaymentStatus;
  notes?: string;
  linkedIncomeId?: string; // Vínculo com a transação bancária real do Open Finance
  linkedIncomeDescription?: string;
}

export interface MedicalShiftPreset {
  id: string;
  name: string;
  hospitalName: string;
  sector: ShiftSector;
  contractType: ShiftContractType;
  defaultDurationHours: number;
  defaultGrossAmount: number;
  typicalPayDelayDays: number;
}

export interface HospitalIncomeMappingRule {
  id: string;
  hospitalName: string;
  keywordPattern: string; // ex: "VIVA RIO", "D'OR", "RIOSAUDE"
  typicalAmount?: number;
  partner?: 'partner1' | 'partner2' | 'both';
  createdAt: string;
}

export interface ShiftPacingRecommendation {
  monthKey: string;
  monthLabel: string;
  projectedAmount: number;
  fixedExpensesAmount: number;
  averageIncomeTarget: number;
  averageShiftValue: number;
  isDryMonth: boolean; // se projectedAmount < fixedExpensesAmount
  shiftsToCoverFixed: number; // Nível 1: Pagar Contas
  shiftsToMaintainLifestyle: number; // Nível 2: Manter Estilo
  shiftsToAccelerateGains: number; // Nível 3: Acelerar +20%
}

export interface PushNotificationSettings {
  enabled: boolean;
  permissionStatus: 'default' | 'granted' | 'denied';
  statementReminderEnabled?: boolean;
  lastStatementReminderAt?: string;
  dailyTriageEnabled: boolean; // 18:00
  lunchReminderEnabled?: boolean; // 13:00 almoço
  lastLunchReminderAt?: string;
  weeklySummaryEnabled: boolean; // Domingos 18:00
  monthlySummaryEnabled: boolean; // Último dia do mês 19:00
  categoryAlertsEnabled: boolean; // Tetos de 80% e 100%
  goalCelebrationsEnabled: boolean; // Metas atingidas
  testNotificationSentAt?: string;
  lastDailyTriageNotifiedAt?: string;
  lastWeeklySummaryNotifiedAt?: string;
  lastMonthlySummaryNotifiedAt?: string;
  notifiedCategoryThresholds?: Record<string, '80' | '100'>;
}

export interface UserAuthProfile {
  uid: string;
  email: string;
  displayName: string;
  coupleId: string;
  partnerRole: 'partner1' | 'partner2';
}

export interface CoupleAccountData {
  id: string;
  inviteCode: string;
  partner1Name: string;
  partner2Name: string;
  partner1Income: number;
  partner2Income: number;
  createdAt: string;
}

// ==========================================
// MOTOR DE INSIGHTS PREDITIVOS & INTELIGÊNCIA DE ABASTECIMENTO (COMIDA)
// ==========================================
export type FoodPillarType = 'estrutural' | 'rotina' | 'conveniencia';

export interface FoodPillarSummary {
  pillar: FoodPillarType;
  title: string;
  emoji: string;
  description: string;
  spent: number;
  percentageOfFoodSpent: number;
  itemCount: number;
}

export interface FoodWeeklyPacingBlock {
  weekNumber: 1 | 2 | 3 | 4;
  label: string; // e.g. "Semana 1 (Dias 1 a 7)"
  dayRange: string; // "1-7", "8-14", "15-21", "22-fim"
  allocatedBudget: number; // quota per week from saldo operacional líquido
  spent: number;
  remaining: number;
  status: 'safe' | 'warning' | 'over' | 'future';
  isCurrentWeek: boolean;
}

export interface FoodPacingMetrics {
  totalFoodBudget: number;
  totalFoodSpent: number;
  structuralSpent: number; // Abastecimento da casa (grandes compras de mercado/açougue/limpeza)
  routineSpent: number; // Alimentação de rotina e trabalho (almoços dia a dia, plantões, hospital)
  convenienceSpent: number; // Delivery e conveniência (iFood, Rappi, lanches)
  operationalBudgetRemaining: number; // Orçamento líquido após deduzir abastecimento estrutural
  weeklyQuota: number; // Quota operacional por semana (saldo operacional / 4)
  weeks: FoodWeeklyPacingBlock[];
  currentWeekNumber: 1 | 2 | 3 | 4;
  currentWeekRemaining: number;
  dailySafePacing: number;
  hasInitialStockup: boolean; // Reconheceu o abastecimento inicial
  pillars: Record<FoodPillarType, FoodPillarSummary>;
}

export type AISuggestionCategory = 'comida_delivery' | 'lazer' | 'moradia' | 'transporte' | 'profissional' | 'geral';

export interface AISuggestionOption {
  label: string;
  description: string;
  amount?: number;
}

export interface AIPredictiveInsight {
  id: string;
  type: 'fatigue_pattern' | 'reward_proposal' | 'efficiency_proposal';
  category: AISuggestionCategory;
  title: string;
  message: string;
  badgeText: string;
  emoji: string;
  surplusAmount?: number;
  sourceCategory?: CategoryKey;
  suggestedActionName?: string;
  targetGoalId?: string;
  targetGoalName?: string;
  options: {
    useReward?: {
      label: string;
      description: string;
      appliedAmount: number;
      targetCategory: CategoryKey;
    };
    sendToGoal?: {
      label: string;
      description: string;
      amount: number;
      defaultGoalId?: string;
      defaultGoalName?: string;
    };
    keepBuffer?: {
      label: string;
      description: string;
      amount: number;
    };
  };
  createdAt: string;
  status: 'active' | 'applied' | 'dismissed';
  appliedOption?: 'use_reward' | 'send_to_goal' | 'keep_buffer';
}

// ==========================================
// HUB DO CASAL - METAS, WISHLIST, SONHOS & INDEPENDÊNCIA
// ==========================================

export interface CoupleGoalContribution {
  id: string;
  contributor: 'partner1' | 'partner2' | 'both';
  contributorName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'deposit' | 'withdrawal';
  note?: string;
}

export interface CoupleGoal {
  id: string;
  title: string;
  category: 'viagem' | 'imovel' | 'veiculo' | 'reforma' | 'reserva' | 'liberdade' | 'outro';
  emoji: string;
  imageUrl?: string;
  targetAmount: number;
  currentAmount: number;
  partner1Contribution: number;
  partner2Contribution: number;
  deadlineDate?: string; // YYYY-MM
  monthlyPlannedDeposit: number;
  isCompleted: boolean;
  history: CoupleGoalContribution[];
  createdAt: string;
  coupleAgreement?: CoupleAgreement;
}

export interface CoupleWishlistItem {
  id: string;
  title: string;
  category: CategoryKey;
  emoji: string;
  estimatedPrice: number;
  priority: 'alta' | 'media' | 'baixa';
  requestedBy: 'partner1' | 'partner2' | 'both';
  linkUrl?: string;
  imageUrl?: string;
  notes?: string;
  status: 'desejo' | 'convertido_meta' | 'comprado';
  convertedGoalId?: string;
  createdAt: string;
}

export interface FixedBillAlert {
  id: string;
  title: string;
  category: CategoryKey;
  amount: number;
  dueDay: number; // Day of month (1-31)
  assignedPayer: PaidBy;
  bankAccountOrCard?: string;
  autoPay: boolean;
  status: 'pending' | 'paid' | 'overdue';
  lastPaidMonth?: string; // YYYY-MM
  isRecurring: boolean;
}

export interface DreamSimulation {
  id: string;
  title: string;
  emoji: string;
  totalCost: number;
  downPayment: number;
  monthlySavings: number;
  expectedAnnualYieldPct: number; // e.g. 8.5%
  inflationAnnualPct: number; // e.g. 4.0%
  monthsToAchieve: number;
  estimatedCompletionDate: string; // YYYY-MM
  partner1SharePct: number; // e.g. 50
  partner2SharePct: number; // e.g. 50
  createdAt: string;
}

export interface CoupleFIREMetrics {
  currentNetWorth: number; // Total investido em Caixinhas + Liberdade + Reserva
  monthlyCoupleExpenses: number; // Média de gastos do casal
  emergencyReserveMonthsCurrent: number; // Quantos meses a reserva atual cobre
  emergencyReserveMonthsTarget: number; // Meta de meses (ex: 6 meses)
  fireTargetNetWorth: number; // Patrimônio necessário para Independência (Regra dos 25x gastos anuais ou 300x mensal)
  fireProgressPct: number;
  estimatedYearsToFIRE: number;
  monthlyInvestmentPace: number; // Aporte mensal atual do casal
}

