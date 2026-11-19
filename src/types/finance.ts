export type CategoryKey =
  | 'moradia'
  | 'comida'
  | 'lazer'
  | 'protecao'
  | 'profissional'
  | 'transporte'
  | 'limpeza'
  | 'farmacia'
  | 'saude'
  | 'casa'
  | 'vestuario'
  | string;

export type PaidBy = 'partner1' | 'partner2' | 'both' | 'custom' | 'casal' | 'couple';

export type DomainScope = 'casal' | 'partner1' | 'partner2';

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

export type ExpenseNature = 'fixa' | 'fixo' | 'variavel' | 'eventual';
export type ExpensePriority = 'essencial' | 'necessario' | 'importante' | 'dispensavel' | 'desejo';
export type PolicyMacroGroup = 'fixos' | 'variaveis' | 'investimentos' | 'pendente';
export type ClassificationOrigin = 'manual_confirmed' | 'authorized_rule' | 'origin_link' | 'auto_suggestion';
export type TemporalScope = 'this_occurrence' | 'future_occurrences' | 'selected_history';

export type SplitLineType = 'item' | 'freight' | 'discount' | 'fee';

export interface TransactionSplit {
  id: string; // unique split ID
  amount: number; // in R$
  amountCents: number; // integer cents (Math.round(amount * 100))
  category: CategoryKey;
  subcategory?: string;
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  policyMacroGroup?: PolicyMacroGroup;
  classificationOrigin?: ClassificationOrigin;
  notes?: string;
  fundingSource?: FundingSourceType;
  fundingGoalId?: string;
  label?: string; // e.g. "Higiene", "Saúde", "Limpeza", "Frete", "Desconto"
  description?: string;
  lineType?: SplitLineType;
  percentage?: number; // e.g. 50
  targetDate?: string; // YYYY-MM-DD or YYYY-MM for planned/postponable
  isPostponable?: boolean;
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal' | string;
}

export interface ExpenseItem {
  foodPillar?: FoodPillarType;
  id: string;
  description: string;
  store?: string; // Nome do estabelecimento comercial (ex: "Supermercado Pão de Açúcar", "Drogaria São Paulo")
  amount: number;
  amountCents?: number;
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
  // 25B: Classificação separada de natureza, prioridade e grupo da política
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  policyMacroGroup?: PolicyMacroGroup;
  classificationOrigin?: ClassificationOrigin;
  classificationReason?: string;
  ruleVersion?: string;
  temporalScope?: TemporalScope;
  needsBasedOverride?: boolean;
  splits?: TransactionSplit[];
  splitParentId?: string;
  isSplitParent?: boolean;
  // Triagem Omnipresente & Alocação Proativa de Fonte
  fundingSource?: FundingSourceType;
  fundingGoalId?: string;
  fundingGoalName?: string;
  strategicIntentId?: string;
  isExcludedFromMonthlyBudget?: boolean;
  exclusionReason?: 'manual' | 'asset_funding' | 'goal_direct';
  triageDone?: boolean;
  reconciledWithIntent?: boolean;
  paymentMethod?: 'pix' | 'debit' | 'credit' | 'cash';
  assignedTo?: 'couple' | 'partner1' | 'partner2' | 'casal';
  linkedBillId?: string;
  billCompetenceMonth?: string; // YYYY-MM
  // 29A: Vínculo canônico com comando/operação e autoria por UID
  operationId?: string;
  authoredByUid?: string;
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

export type IncomeSourceClassification =
  | 'pf_net'
  | 'pj_gross'
  | 'internal_transfer'
  | 'reimbursement'
  | 'refund'
  | 'reembolso'
  | 'loan'
  | 'emprestimo'
  | 'principal_redemption'
  | 'resgate_principal'
  | 'passive_reinvested'
  | 'renda_passiva_reinvestida'
  | 'forecast';

export interface IncomeItem {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  recipient: PaidBy;
  type: 'salario' | 'bonus' | 'extra' | 'restituicao' | 'outro' | 'fixed';
  status?: 'received' | 'pending' | 'projected' | 'internal_transfer';
  classification?: IncomeSourceClassification;
  taxRatePercent?: number;
  monthlyAccountingCost?: number;
  linkedShiftId?: string;
  // 15: Previsão de recebimento e controle de realização
  expectedDate?: string;
  expectedAmount?: number;
  realizedDifference?: number;
  isForecast?: boolean;
}

export type InstallmentOccurrenceStatus =
  | 'previsto'
  | 'pago'
  | 'antecipado'
  | 'vencido'
  | 'estornado';

export interface InstallmentOccurrenceRecord {
  occurrenceId: string; // purchaseId:installmentNumber:competenceMonth e.g. "inst-1:1:2026-12"
  purchaseId: string;
  installmentNumber: number; // 1 to count
  competenceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  amountCents: number; // Centavos inteiros exatos
  amountR$: number; // amountCents / 100
  status: InstallmentOccurrenceStatus;
  paidAt?: string; // ISO date/timestamp
  paymentOperationId?: string; // ID da transação/operação de baixa (idempotência)
  discountCents?: number; // Desconto em centavos concedido na antecipação
  effectivePaidCents?: number; // Valor efetivamente desembolsado
  fundingSource?: AdvanceInstallmentFundingSource;
  notes?: string;
}

export interface InstallmentPurchase {
  id: string;
  title?: string;
  category: CategoryKey;
  type?: 'card_consumption' | 'financing'; // Financiamento Estrutural (PF) vs Parcelas de Consumo (Cartão)
  totalAmount: number;
  installmentsCount?: number;
  installmentAmount?: number;
  startMonth?: string; // YYYY-MM
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
  // 25B & 26A: Natureza, prioridade e obrigações da parcela
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  policyMacroGroup?: PolicyMacroGroup;
  originalPurpose?: string;
  // 08 & 17: Ciclo de vida, ocorrências e cadastro único de parcelamento
  purchaseDate?: string; // Data da compra (YYYY-MM-DD)
  totalCashAmount?: number; // Total à vista se houver juros informados
  requestId?: string; // Idempotência da intenção de criação
  occurrenceRecords?: Record<string, InstallmentOccurrenceRecord>;
  unattributedLegacyCredits?: number;
  description?: string;
  occurrences?: any[];
  installmentValue?: number;
  totalInstallments?: number;
  currentInstallment?: number;
  firstPaymentDate?: string;
  fundingSource?: FundingSourceType;
  fundingGoalId?: string;
  isExcludedFromMonthlyBudget?: boolean;
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
  discountAmount?: number; // Desconto institucional negociado/oferecido
  funding: AdvanceInstallmentFundingSource;
  specificOccurrenceIds?: string[]; // IDs de ocorrências concretas a antecipar
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
  deadlineDate?: string;
  totalInvested?: number;
  yieldAccumulated?: number;
  completed?: boolean;
  isFireEligible?: boolean;
  coupleAgreement?: CoupleAgreement;
  category?: CategoryKey;
  // 27: Controle seguro de ciclo de vida e arquivamento
  archived?: boolean;
  isDeleted?: boolean;
  // 26A: Detalhamento explícito de destino, fatias e vínculo de ativo
  accumulatedCents?: number;
  committedCents?: number;
  utilizedCents?: number;
  availableCents?: number; // accumulated - committed - utilized
  liberatedReservedCents?: number; // 26B: Saldo liberado/resgatado ainda reservado ao propósito antes de gasto/reforço
  uncoveredDivergenceCents?: number; // 26B: Divergência registrada quando ocorrência bancária superou planejamento
  linkedBankAccountId?: string; // Vínculo de custódia real para evitar dupla contagem de patrimônio
  // 29A: Revisão monotônica e última operação confirmada
  revision?: number;
  lastOperationId?: string;
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
  // 26B: Identidade canônica de conta/ativo, carência e status de verificação
  canonicalAccountId?: string;
  mirroredFromAccountId?: string;
  lockupUntil?: string; // YYYY-MM-DD (CDB/ativo em carência ou bloqueio)
  settlementDate?: string; // YYYY-MM-DD (liquidação D+N)
  verificationStatus?: 'verified' | 'unverified' | 'ambiguous_duplicate';
}


export interface CategoryKeywordRule {
  id: string;
  keyword: string; // uppercase keyword, e.g. "UBER", "NETFLIX", "IFOOD"
  category: CategoryKey;
  subcategory?: string;
  // 25B: Regras explícitas de natureza, prioridade e versão da regra
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  policyMacroGroup?: PolicyMacroGroup;
  ruleVersion?: string;
  isAuthorizedRule?: boolean;
  temporalScope?: TemporalScope;
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
  accountType: 'corrente' | 'cartao' | 'investimento' | 'poupanca';
  accountNumber: string;
  holder: PaidBy;
  balance: number;
  lastSynced: string;
  status: 'connected' | 'syncing' | 'error';
  colorHex: string;
  logo: string;
  // 26B: Deduplicação canônica, carência e verificação explícita
  canonicalAccountId?: string;
  mirroredFromAccountId?: string;
  lockupUntil?: string; // YYYY-MM-DD
  settlementDate?: string; // YYYY-MM-DD
  verificationStatus?: 'verified' | 'unverified' | 'ambiguous_duplicate';
  revision?: number;
  lastOperationId?: string;
}

export interface CashBalanceAnchor {
  id: string;
  accountId: string;
  canonicalAccountId?: string;
  accountType?: 'corrente' | 'poupanca' | 'investimento' | 'cartao';
  date: string; // YYYY-MM-DD
  balanceCents: number;
  balanceStatus: 'known' | 'unknown';
  scope: DomainScope | string;
  origin: 'manual_confirmed' | 'statement_closing';
  coverageType: 'cutoff_inclusive' | 'operations_list';
  includedUntilDate?: string; // YYYY-MM-DD
  includedOperationIds?: string[];
  confirmedAt: string;
  confirmedByUid: string;
  notes?: string;
  revision?: number;
}

export interface CashAccountVerificationItem {
  canonicalAccountId: string;
  sourceAccountIds: string[];
  bankName: string;
  accountType: 'corrente' | 'poupanca' | 'investimento' | 'cartao';
  holder: PaidBy;
  status: 'known' | 'unknown' | 'excluded_credit' | 'excluded_locked' | 'ambiguous_duplicate';
  includedInLiquidCash: boolean;
  baseBalanceCents: number | null;
  postAnchorDeltaCents: number;
  effectiveLiquidCents: number | null;
  inTransitCents: number;
  lockedCents: number;
  anchorId?: string;
  anchorDate?: string;
  exclusionReason?: string;
}

export interface VerifiableCashSummary {
  scope: DomainScope;
  status: 'known' | 'partial' | 'unknown';
  isReliableGlobalCash: boolean;
  verifiedLiquidCashCents: number | null;
  verifiedLiquidCashR$: number | null;
  knownAccountsCashCents: number;
  inTransitRedemptionCents: number;
  lockedAssetCents: number;
  liberatedPurposeCents: number;
  unverifiedReasons: string[];
  duplicateAccountAlerts: Array<{
    accountIds: string[];
    bankName: string;
    owner: PaidBy;
    reason: string;
  }>;
  accounts: CashAccountVerificationItem[];
  referenceDate: string;
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
  executedAt?: string;
  executedOperationId?: string;
  executedAmount?: number;
  executedByUid?: string;
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
  revision?: number;
  lastOperationId?: string;
}

export interface MonthDepositCompletionRecord {
  monthKey: string;
  completedAt: string;
  totalDeposited: number;
  items: MonthlyDepositItem[];
  operationId?: string;
  executedByUid?: string;
  plannedAmount?: number;
  extraAmount?: number;
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
  bankName?: string;
  amount: number;
  date: string;
  description: string;
  direction: 'credit' | 'debit';
  owner: PaidBy;
  status: 'pending' | 'expense' | 'income' | 'internal_transfer' | 'reconciled';
  category?: CategoryKey;
  subcategory?: string;
  matchedRule?: string;
  fitid?: string;
  // 25B: Classificação e divisões (splits)
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  policyMacroGroup?: PolicyMacroGroup;
  classificationOrigin?: ClassificationOrigin;
  classificationReason?: string;
  ruleVersion?: string;
  splits?: TransactionSplit[];
  // 26B: Conciliação explícita com operação patrimonial e pareamento interno
  canonicalAccountId?: string;
  reconciledOperationId?: string;
  pairedTransferTransactionId?: string;
  reconciliationCandidateIds?: string[];
  statementBalanceCents?: number;
  statementBalanceDate?: string;
}

export type DestinationKey = CategoryKey | 'investimentos';

export type FinanceSyncStatus =
  | 'local'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'partial'
  | 'error'
  | 'conflict';

export type MacroGroupKey = 'fixos' | 'variaveis' | 'investimentos';

export interface MacroGroupAllocation {
  percentage: number;
  amountR$: number;
}

export interface BudgetPlanPolicyMeta {
  policyId: string; // e.g. 'policy-60-30-10' or 'custom-user-policy'
  policyName: string; // e.g. 'Política Flexível 60/30/10'
  policyVersion: string; // e.g. '1.0'
  validFrom: string; // YYYY-MM
  validTo?: string; // YYYY-MM
  authoredByUid?: string;
  incomeSourceMode: 'planned_net' | 'economic_realized' | 'hybrid';
  // 25B: Modo estrito (proporções) vs modo alternativo por necessidades
  policyMode?: 'strict_proportions' | 'needs_based';
  policyExplanation?: string;
}

export interface CategoryMatrixEntryCents {
  fixedCents: number;
  variableCents: number;
  unclassifiedCents?: number;
  totalCents: number;
}

export type CeilingState = 'explicit_positive' | 'explicit_zero' | 'absent';

export interface FixedBillRegistryConflict {
  billId: string;
  reason: string;
}

export interface PartnerScopedPlanCeiling {
  plannedNetIncome: number;
  fixedCeilingR$?: number;
  variableCeilingR$?: number;
  investTargetR$?: number;
  categoryAmountsR$?: Partial<Record<DestinationKey, number>>;
}

export interface BudgetPlanContract {
  id?: string;
  competence: string; // YYYY-MM
  plannedNetIncome: number;
  version: string;
  schemaVersion?: string; // '2.0'
  planRevision?: number; // Incremental revision counter per competence (1, 2, 3...)
  policyMeta?: BudgetPlanPolicyMeta;
  macroGroups?: Record<MacroGroupKey, MacroGroupAllocation>;
  categoryGroupMapping?: Record<CategoryKey, 'fixos' | 'variaveis'>;
  categoryPercentages: Record<DestinationKey, number>;
  categoryAmountsR$: Record<DestinationKey, number>;
  // 28C: Matriz Categoria x Fixos/Variáveis em centavos inteiros e margem não atribuída
  categoryMatrixCents?: Record<CategoryKey, CategoryMatrixEntryCents>;
  additionalDestinationsCents?: Record<string, { label: string; amountCents: number }>;
  unassignedVariableMarginCents?: number;
  unassignedVariableMarginR$?: number;
  categoryLocks: Record<DestinationKey, boolean>;
  categoryFloorsR$: Record<DestinationKey, number>;
  categoryPriorities: Record<DestinationKey, 'P1' | 'P2' | 'P3'>;
  commitmentsR$: Record<DestinationKey, number>;
  actualSpentR$: Record<DestinationKey, number>;
  requiredMarginR$: Record<DestinationKey, number>;
  referencePreset: Record<DestinationKey, number>;
  status: 'feasible' | 'infeasible';
  explanation: string;
  conflicts: string[];
  approvedAt?: string;
  approvedBy?: string;
  approvedByUid?: string;
  approvedByDisplayName?: string;
  baseSnapshotSignature?: string;
  applyToFutureMonths?: boolean;
  appliedFutureMonths?: string[];
  skippedApprovedMonths?: string[];
  partnerCeilings?: Partial<Record<'partner1' | 'partner2', PartnerScopedPlanCeiling>>;
}

// 28C & 29B: Tipos para as Duas Visões Reconciliadas do Orçamento (Categorias vs Estrutura)
export interface ReinforcementProvenanceRef {
  operationId: string;
  sourceType: NonNullable<FinancialOperationRecord['sourceRef']>['type'];
  sourceId: string;
  sourceName: string;
  sourceOperationId?: string;
  competence: string;
  category: CategoryKey;
  amountCents: number;
  amountR$: number;
  date: string;
  state: FinancialOperationState;
  isReconciled: boolean;
  evidenceType: 'bank_reconciled' | 'manual_declared' | 'virtual_earmark' | 'legacy_adjustment';
  notes?: string;
  reconciliationRef?: string;
  bankTransactionId?: string;
}

export interface CategoryReinforcementSummary {
  competence: string;
  scope: DomainScope;
  reinforcementCents: Record<CategoryKey, number>;
  reallocInCents: Record<CategoryKey, number>;
  reallocOutCents: Record<CategoryKey, number>;
  netReallocCents: Record<CategoryKey, number>;
  sourcesByCategory: Record<CategoryKey, ReinforcementProvenanceRef[]>;
  allSources: ReinforcementProvenanceRef[];
  totalReinforcementCents: number;
  totalNetReallocCents: number;
}

export interface ReconciledStructureBlock {
  key: 'fixos' | 'variaveis';
  title: string;
  plannedBudget: number; // R$ (base habitual aprovada pela política)
  basePlannedBudget?: number; // R$ (meta habitual explícita)
  reinforcementAmount?: number; // R$ (soma de reforços temporários ativos no bloco)
  reallocationNetAmount?: number; // R$ (realocações recebidas - enviadas no bloco)
  effectiveBudget?: number; // R$ (base + reforços + realocações líquidas)
  realizedLiquid: number; // R$ (fatias pagas)
  pendingCommitments: number; // R$ (obrigações/parcelas pendentes)
  projectedTotal: number; // realized + pending
  signedMargin: number; // effectiveBudget - projectedTotal
  unallocatedVariableMargin?: number; // R$ (apenas em variáveis)
  isOverCeiling: boolean;
  overAmount: number; // R$
  percentageUsed: number;
  hasExplicitCeiling?: boolean;
  ceilingState?: CeilingState;
  denominatorLabel?: string;
}

export interface ReconciledInvestmentBlock {
  targetAmount: number; // R$ (ex: 10% da renda elegível alocada)
  actualDeposited: number; // R$ (aportes realizados no mês)
  remainingTarget: number; // R$ (diferença pendente de aporte)
  isGoalMet: boolean;
  percentageMet: number;
}

export interface ReconciledCategoryRow {
  key: CategoryKey;
  name: string;
  emoji: string;
  plannedBudget: number; // R$ (envelope efetivo = base + reforços + realocações líquidas)
  basePlannedBudget?: number; // R$ (meta habitual intocada)
  basePercentage?: number; // % habitual da categoria
  reinforcementAmount?: number; // R$ (reforços temporários confirmados nesta competência)
  reallocationNetAmount?: number; // R$ (realocações recebidas - enviadas nesta competência)
  effectiveBudget?: number; // R$ (= plannedBudget quando há reforço/realocação)
  hasTemporaryReinforcement?: boolean;
  reinforcementSources?: ReinforcementProvenanceRef[];
  verifiableCashStatus?: 'known' | 'partial' | 'unknown';
  fixedSpent: number; // R$ (fatias de natureza fixa)
  variableSpent: number; // R$ (fatias de natureza variável)
  unclassifiedSpent?: number; // R$ (fatias sem natureza confiável — pendente de classificação)
  realizedLiquid: number; // R$ (fixedSpent + variableSpent + unclassifiedSpent)
  pendingCommitments: number; // R$ (obrigações pendentes da categoria)
  projectedTotal: number; // R$ (realized + pending)
  signedMargin: number; // R$ (effectiveBudget - projectedTotal)
  isOverCeiling: boolean;
  overAmount: number; // R$
  percentageUsed: number;
  hasExplicitCeiling?: boolean;
  ceilingState?: CeilingState;
}

export interface ReconciledBudgetMatrixResult {
  competence: string;
  scope: DomainScope;
  plannedNetIncome: number; // R$ (base alocada no plano)
  receivedEligibleNetIncome: number; // R$ (renda alocada recebida no caixa)
  policyRatios: { fixedPct: number; varPct: number; investPct: number };
  hasExplicitCeiling?: boolean;
  ceilingState?: CeilingState;
  verifiableCashStatus?: 'known' | 'partial' | 'unknown';
  
  // Visão por Estrutura (Fixos vs Variáveis vs Aportes)
  structureBlocks: {
    fixos: ReconciledStructureBlock;
    variaveis: ReconciledStructureBlock;
    investimentos: ReconciledInvestmentBlock;
  };

  // Visão por Categorias
  categories: ReconciledCategoryRow[];

  // Totais Reconciliados Globais
  totalBasePlannedBudget?: number; // R$ (meta habitual total de Fixos + Variáveis)
  totalReinforcementAmount?: number; // R$ (total de reforços temporários na competência)
  totalEffectiveBudget?: number; // R$ (orçamento efetivo unificado na competência)
  totalPlannedBudget: number; // R$
  totalRealizedLiquid: number; // R$
  totalPendingCommitments: number; // R$
  totalProjectedConsumption: number; // R$
  totalSignedMargin: number; // R$

  // 26C: Provas e origens de reforço na competência
  reinforcementsByCategory?: Record<CategoryKey, number>;
  allReinforcementSources?: ReinforcementProvenanceRef[];

  // 29B: Parcela sem natureza confiável (pendente de classificação, preservada no total sem inventar variável)
  unclassifiedSpent?: number; // R$
  unclassifiedCents?: number;
  pendingClassificationCount?: number;
  pendingClassificationSliceIds?: string[];
  registryConflicts?: FixedBillRegistryConflict[];
  
  // Consumo Extraordinário de Caixinha/Reserva (Path B - C43)
  goalDirectConsumption: number; // R$
  
  // Saída Efetiva de Caixa (Pix / Débito / Dinheiro à vista)
  cashOutflowSpent: number; // R$

  // Matriz em centavos para o contrato v2.0
  categoryMatrixCents: Record<CategoryKey, CategoryMatrixEntryCents>;
  unassignedVariableMarginCents: number;
}

export interface AppState {
  bankImportedTransactions?: BankImportedTransaction[];
  shiftIncomeAllocations?: ShiftIncomeAllocation[];
  profile: CoupleProfile;
  appMode?: AppMode;
  collegeModeData?: CollegeModeData;
  categoryPercentages: Record<CategoryKey, number>;
  categoryFloors?: Record<string, number>; // Minimum floor values in R$ (or % for investimentos)
  categoryLocks?: Record<string, boolean>; // Locks for categories + investimentos
  monthlyBudgetPlans?: Record<string, BudgetPlanContract>;
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
  fixedBillAlerts?: FixedBillAlert[];
  dreamSimulations?: DreamSimulation[];
  // 26A: Registro durável de operações financeiras (comandos atômicos com idempotência e conciliação)
  financialOperations?: FinancialOperationRecord[];
  // 26B: Âncoras manuais de saldo em conta para caixa verificável sem dupla contagem
  cashBalanceAnchors?: CashBalanceAnchor[];
}

export type FinancialOperationType =
  | 'CATEGORY_REINFORCEMENT' // Reforço temporário de envelope da categoria
  | 'CATEGORY_REALLOCATION'  // Realocação entre categorias na mesma competência (vasos comunicantes)
  | 'GOAL_DIRECT_PURCHASE'   // Compra direta financiada por caixinha/meta (fora do teto da categoria)
  | 'GOAL_DEPOSIT'           // Aporte na caixinha/meta ou bloco
  | 'GOAL_WITHDRAWAL'        // Resgate da caixinha/meta ou bloco
  | 'GOAL_TRANSFER'          // Transferência entre metas (Meta A -> Meta B)
  | 'BLOCK_TRANSFER'         // Transferência entre blocos/ativos (Proteção / Objetivos / Liberdade)
  | 'INITIAL_POSITION'       // Posição inicial / saldo de abertura sem inflar renda ou aporte do mês
  | 'VALUATION_ADJUSTMENT'   // Ajuste de avaliação / rendimento (inclusive negativo) sem fluxo de caixa
  | 'MONTHLY_GUIDE_ITEM'     // Execução individual de item da guia de aporte mensal
  | 'MONTHLY_GUIDE_EXECUTION'// Execução da guia de aporte mensal (itens pendentes)
  | 'EXPENSE_RECORD'         // Registro de despesa
  | 'INCOME_RECORD';         // Registro de receita

export type FinancialOperationState =
  | 'planned'
  | 'pending_settlement'
  | 'processing'
  | 'occurred_manual'
  | 'reconciled'
  | 'reverted'
  | 'effective'
  | 'efetivado'
  | 'pendente'
  | 'estornado'
  | 'realizado';

export type FinancialCommandStatus = 'success' | 'conflict' | 'failure';

export type FinancialCommandReasonCode =
  | 'EXECUTED'
  | 'IDEMPOTENT_REPLAY'
  | 'CONFLICT_PAYLOAD_MISMATCH'
  | 'CONFLICT_REVISION'
  | 'CONFLICT_ALREADY_REVERTED'
  | 'CONFLICT_ALREADY_MATCHED'
  | 'INVALID_AMOUNT'
  | 'DIVERGENT_AMOUNTS'
  | 'INVALID_REFS'
  | 'INVALID_SCOPE'
  | 'INVALID_AUTH'
  | 'INVALID_DATE'
  | 'INVALID_RECONCILIATION'
  | 'GOAL_NOT_FOUND'
  | 'GOAL_ARCHIVED'
  | 'INSUFFICIENT_FUNDS'
  | 'OPERATION_NOT_FOUND'
  | 'REVERSAL_DEPENDENCY_ERROR'
  | 'CONFIRMATION_REQUIRED'
  | 'EXPENSE_NOT_FOUND'
  | 'INTENT_NOT_FOUND';

export interface FinancialOperationRecord {
  id: string; // operationId estável
  type: FinancialOperationType;
  amountCents: number; // Centavos inteiros preservados (unidade autoritativa, > 0)
  amountR$?: number; // Valor equivalente derivado em Reais (apenas apresentação/compatibilidade)
  authorizedBy: string; // uid ou role 'partner1' | 'partner2' | 'both'
  authoredByUid?: string; // UID autenticado de autoria
  sourceRef?: {
    type: 'account' | 'piggy_bank' | 'income' | 'reserve' | 'external' | 'protection' | 'freedom' | 'guide' | 'category';
    id: string;
    name?: string;
  };
  targetRef?: {
    type: 'account' | 'category' | 'piggy_bank' | 'expense' | 'external' | 'protection' | 'reserve' | 'freedom' | 'guide';
    id: string;
    name?: string;
  };
  competence?: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  occurredAt?: string; // Data/hora real da ocorrência
  confirmedAt?: string; // Timestamp da confirmação do comando
  revision?: number;
  expectedRevision?: number;
  state: FinancialOperationState;
  reconciliationRef?: string;
  reversalOf?: string;
  revertedBy?: string;
  reversedAt?: string;
  expenseId?: string;
  intentId?: string;
  commandFingerprint?: string;
  fundingSlice?: {
    path: 'budget_reinforcement' | 'direct_goal_purchase';
    allocatedCents: number;
  };
  valuationDirection?: 'gain' | 'loss';
  signedDeltaCents?: number;
  costBasisCents?: number;
  realizedGainCents?: number;
  postCostBasisCents?: number;
  postValuationCents?: number;
  guideMonthKey?: string;
  guideItemId?: string;
  isExtraAporte?: boolean;
  surplusTransferId?: string;
  completedGoalContributionConfirmed?: boolean;
  // 26B: Canais de resgate/liberação, liquidação bruto x líquido, partições e divergência real
  withdrawalChannel?: 'virtual_reallocation' | 'asset_redemption';
  settlementStatus?: 'planned' | 'pending_settlement' | 'occurred_manual' | 'reconciled' | 'divergent';
  settlementDate?: string;
  destinationAccountId?: string;
  grossAmountCents?: number;
  netAmountCents?: number;
  differenceToReviewCents?: number;
  principalCents?: number;
  interestCents?: number;
  taxCents?: number;
  feeCents?: number;
  partitions?: Array<{
    id: string;
    targetType: 'category_reinforcement' | 'direct_purchase' | 'cash_free' | 'other_goal';
    targetId?: string;
    targetLabel?: string;
    amountCents: number;
    consumedCents?: number;
  }>;
  sourceOperationId?: string;
  bankTransactionId?: string;
  overrideInsufficientPlanning?: boolean;
  planningDivergenceCents?: number;
  reconciledAt?: string;
  reconciledByUid?: string;
  createdAt?: string;
  notes?: string;
  currency?: string;
  scope?: DomainScope | string;
}

export type WithdrawalPurposePartition = NonNullable<FinancialOperationRecord['partitions']>[number];

export interface FinancialCommandTouchedEntities {
  financialOperations?: string[];
  piggyBanks?: string[];
  coupleGoals?: string[];
  linkedAccounts?: string[];
  bankImportedTransactions?: string[];
  cashBalanceAnchors?: string[];
  expenses?: string[];
  strategicIntents?: string[];
  dreamSimulations?: string[];
  coupleWishlist?: string[];
  coupleFixedBills?: string[];
  protectionUpdated?: boolean;
  freedomUpdated?: boolean;
  guideUpdated?: boolean;
  surplusTransfersUpdated?: boolean;
  guideMonthKey?: string;
}

export interface FinancialCommandResult {
  status: FinancialCommandStatus;
  reasonCode: FinancialCommandReasonCode;
  message: string;
  state: AppState;
  operation?: FinancialOperationRecord;
  operations?: FinancialOperationRecord[];
  expense?: ExpenseItem;
  idempotentReplay?: boolean;
  touchedEntities?: FinancialCommandTouchedEntities;
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
  // Agenda planning (10)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  commuteMinutes?: number; // Deslocamento estimado em minutos
  timePrecision?: 'exact' | 'date_only'; // Precisão temporal
  // Balanços e conciliação
  reconciledAmount?: number;
  pendingAmount?: number;
  overallocatedAmount?: number;
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

export type AISuggestionCategory = 'comida_delivery' | 'lazer' | 'moradia' | 'transporte' | 'profissional' | 'geral' | CategoryKey | string;

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
  isFireEligible?: boolean;
  totalInvested?: number;
  yieldAccumulated?: number;
  // 27: Controle seguro de arquivamento e tombstones
  archived?: boolean;
  isDeleted?: boolean;
  // 26A: Detalhamento explícito de fatias e custódia patrimonial
  accumulatedCents?: number;
  committedCents?: number;
  utilizedCents?: number;
  availableCents?: number; // accumulated - committed - utilized
  liberatedReservedCents?: number; // 26B: Saldo liberado/resgatado ainda reservado ao propósito
  uncoveredDivergenceCents?: number;
  linkedBankAccountId?: string; // Vínculo de conta/CDB para evitar contagem duplicada
  revision?: number;
  lastOperationId?: string;
}

export type PiggyBankUpdatePayload = Partial<Omit<SavingsPiggyBank, 'category'>> &
  Partial<Omit<CoupleGoal, 'category'>> & {
    category?: CategoryKey | CoupleGoal['category'];
    title?: string;
    name?: string;
    monthlyPlannedDeposit?: number;
  };

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
  isDeleted?: boolean;
}

export interface FixedBillAlertOccurrenceRecord {
  status: 'paid' | 'pending' | 'overdue';
  paidAt?: string;
  paidAmount?: number;
  paidBy?: PaidBy;
  paymentMethod?: string;
  linkedExpenseId?: string;
}

export interface FixedBillAlert {
  id: string;
  title: string;
  category: CategoryKey;
  amount: number;
  amountCents?: number;
  dueDay: number; // Day of month (1-31)
  assignedPayer: PaidBy;
  bankAccountOrCard?: string;
  autoPay: boolean;
  status: 'pending' | 'paid' | 'overdue';
  lastPaidMonth?: string; // YYYY-MM
  isRecurring: boolean;
  active?: boolean; // true = ativo; false = desativado/pausado
  history?: Record<string, FixedBillAlertOccurrenceRecord>; // Competência (YYYY-MM) -> registro
  isDeleted?: boolean;
  dueDate?: string;
  assignedTo?: PaidBy;
  splitPartner1Pct?: number;
  splitPartner2Pct?: number;
  nature?: ExpenseNature;
  priority?: ExpensePriority;
  validFrom?: string; // YYYY-MM ou YYYY-MM-DD
  validTo?: string; // YYYY-MM ou YYYY-MM-DD
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
  convertedGoalId?: string;
  isDeleted?: boolean;
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

