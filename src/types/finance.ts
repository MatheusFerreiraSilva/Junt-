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
  | 'projections';

export interface CategoryInfo {
  key: CategoryKey;
  name: string;
  emoji: string;
  description: string;
  percentage: number; // e.g. 40% of income
  budget: number; // calculated in R$
  colorHex: string;
  bgLight: string;
  borderHex: string;
}

export interface ExpenseItem {
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
  tags?: string[];
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

export interface CoupleProfile {
  partner1Name: string;
  partner1Specialty: string; // e.g. "Dermatologia" or "Clínico Geral"
  partner2Name: string;
  partner2Specialty: string; // e.g. "Cardiologia" or "Clínico Geral"
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

export interface PluggyCredentials {
  partner1ClientId?: string;
  partner1ClientSecret?: string;
  partner1Cpf?: string;
  partner2ClientId?: string;
  partner2ClientSecret?: string;
  partner2Cpf?: string;
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
  sourceCategory: CategoryKey;
  targetType: 'protection' | 'goal' | 'freedom';
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

export interface AppState {
  profile: CoupleProfile;
  appMode?: AppMode;
  collegeModeData?: CollegeModeData;
  categoryPercentages: Record<CategoryKey, number>;
  categoryFloors?: Record<string, number>; // Minimum floor values in R$ (or % for investimentos)
  isCustomizedPercentages?: boolean;
  lastAcknowledgedTierKey?: LifeTierKey;
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
  pluggyCredentials?: PluggyCredentials;
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

