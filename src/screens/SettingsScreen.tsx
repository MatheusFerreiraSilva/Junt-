import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  DollarSign,
  PieChart,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Award,
  Sparkles,
  RefreshCw,
  Sliders,
  TrendingUp,
  Save,
  Check,
  X,
  ChevronDown,
  RotateCcw,
  Trash2,
  Info,
  Lock,
  Sun,
  Moon,
  Palette,
  CreditCard,
  Building,
  Key,
  Calendar,
  Smartphone,
  Tag,
  Plus,
  Bell,
  Search,
  ExternalLink,
  ShieldAlert,
  Clock,
  HelpCircle,
  Copy,
  Link2,
  Eye,
  EyeOff,
  UserCheck,
  CheckSquare,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE, ACCENT_THEMES } from '../context/FinanceContext';
import {
  CategoryKey,
  AccentTheme,
  PluggyBankConnection,
  CategoryKeywordRule,
  LifeTierInfo,
  LifeTierKey,
} from '../types/finance';
import { getLifeTier, LIFE_TIERS } from '../utils/incomeTiersEngine';
import { formatCurrency } from '../utils/formatters';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  getCurrentMonthlyReviewSchedule,
  requestPushNotificationPermission,
  triggerBrowserPushNotification,
} from '../utils/monthlyReviewNotifications';

interface ProposedRebalance {
  percentages: Record<string, number>;
  amounts: Record<string, number>;
  oldPercentages: Record<string, number>;
  oldAmounts: Record<string, number>;
}

type SettingsTab = 'geral' | 'contas' | 'cores' | 'regras' | 'pwa' | 'casal' | 'dados';

interface BankBrand {
  id: string;
  name: string;
  logo: string;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  defaultCpf: string;
}

const BANK_BRANDS: BankBrand[] = [
  { id: 'nubank', name: 'Nubank', logo: '🟣', colorHex: '#8A05BE', bgClass: 'bg-purple-500/10 dark:bg-purple-950/30', borderClass: 'border-purple-300 dark:border-purple-800/80', textClass: 'text-purple-700 dark:text-purple-300', defaultCpf: '123.456.789-00' },
  { id: 'itau', name: 'Itaú Personalité', logo: '🟠', colorHex: '#EC7000', bgClass: 'bg-amber-500/10 dark:bg-amber-950/30', borderClass: 'border-amber-300 dark:border-amber-800/80', textClass: 'text-amber-700 dark:text-amber-300', defaultCpf: '987.654.321-99' },
  { id: 'btg', name: 'BTG Pactual', logo: '🔵', colorHex: '#002C5B', bgClass: 'bg-blue-500/10 dark:bg-blue-950/30', borderClass: 'border-blue-300 dark:border-blue-800/80', textClass: 'text-blue-700 dark:text-blue-300', defaultCpf: '123.456.789-00' },
  { id: 'bradesco', name: 'Bradesco Prime', logo: '🔴', colorHex: '#CC092F', bgClass: 'bg-rose-500/10 dark:bg-rose-950/30', borderClass: 'border-rose-300 dark:border-rose-800/80', textClass: 'text-rose-700 dark:text-rose-300', defaultCpf: '987.654.321-99' },
  { id: 'santander', name: 'Santander Select', logo: '🟥', colorHex: '#EC0000', bgClass: 'bg-red-500/10 dark:bg-red-950/30', borderClass: 'border-red-300 dark:border-red-800/80', textClass: 'text-red-700 dark:text-red-300', defaultCpf: '123.456.789-00' },
  { id: 'inter', name: 'Banco Inter', logo: '🍊', colorHex: '#FF7A00', bgClass: 'bg-orange-500/10 dark:bg-orange-950/30', borderClass: 'border-orange-300 dark:border-orange-800/80', textClass: 'text-orange-700 dark:text-orange-300', defaultCpf: '987.654.321-99' },
  { id: 'bb', name: 'Banco do Brasil', logo: '🟡', colorHex: '#FCFC30', bgClass: 'bg-yellow-500/10 dark:bg-yellow-950/30', borderClass: 'border-yellow-300 dark:border-yellow-800/80', textClass: 'text-yellow-700 dark:text-yellow-300', defaultCpf: '123.456.789-00' },
  { id: 'xp', name: 'XP Investimentos', logo: '🖤', colorHex: '#000000', bgClass: 'bg-slate-500/10 dark:bg-slate-900/30', borderClass: 'border-slate-300 dark:border-slate-800', textClass: 'text-slate-700 dark:text-slate-300', defaultCpf: '987.654.321-99' },
];

export const SettingsScreen: React.FC = () => {
  const {
    state,
    totalIncome,
    updateProfile,
    updateCategoryPercentages,
    updateCategoryFloors,
    toggleProtectionComplete,
    resetToSampleData,
    toggleThemeMode,
    setAccentTheme,
    setModeTheme,
    clearAllData,
    clearExpenses,
    clearInstallments,
    clearPiggyBanks,
    clearIncomes,
    triggerCelebration,
    autoCalculatedProtectionTarget,
    monthlyFixedExpensesAvg,
    installmentCommitmentPercentage,
    installmentLimitPercentage,
    activeModeThemeKey,
    // Faixas & Porcentagens Personalizadas
    activeLifeTier,
    restoreTierDefaultPercentages,
    applyNewTierDefaults,
    keepCustomPercentagesOnTierChange,
    pendingTierChangePrompt,
    isCustomizedPercentages: isCustomInContext,
    // Pluggy & Accounts
    pluggyAccounts,
    pluggyCredentials,
    updatePluggyAccount,
    addPluggyAccount,
    removePluggyAccount,
    updatePluggyCredentials,
    syncPluggyData,
    isSyncingBanks,
    // Keyword Rules & Subscriptions
    keywordRules,
    updateKeywordRules,
    addKeywordRule,
    removeKeywordRule,
    autoCategorizeDescription,
    detectedSubscriptions,
    dismissSubscription,
    confirmSubscriptionAsExpense,
    // Couple fusion & Auth
    currentUser,
    userProfile,
    coupleAccount,
    generateNewInviteCode,
    joinCoupleWithInviteCode,
    unlinkCouple,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SettingsTab>('geral');

  // ==========================================
  // BLOCO 1: RENDA STATE
  // ==========================================
  const [partner1Income, setPartner1Income] = useState(
    state.profile.partner1Income.toString()
  );
  const [partner2Income, setPartner2Income] = useState(
    state.profile.partner2Income.toString()
  );
  const [partner1Name, setPartner1Name] = useState(state.profile.partner1Name);
  const [partner2Name, setPartner2Name] = useState(state.profile.partner2Name);

  const numP1 = parseFloat(partner1Income.replace(',', '.')) || 0;
  const numP2 = parseFloat(partner2Income.replace(',', '.')) || 0;
  const totalRendaCalculada = numP1 + numP2;

  // ==========================================
  // BLOCO 2: PORCENTAGENS E PISOS MÍNIMOS STATE
  // ==========================================
  const [pctMoradia, setPctMoradia] = useState<number>(state.categoryPercentages.moradia ?? 30);
  const [pctTransporte, setPctTransporte] = useState<number>(state.categoryPercentages.transporte ?? 10);
  const [pctComida, setPctComida] = useState<number>(state.categoryPercentages.comida ?? 15);
  const [pctLazer, setPctLazer] = useState<number>(state.categoryPercentages.lazer ?? 15);
  const [pctProtecao, setPctProtecao] = useState<number>(state.categoryPercentages.protecao ?? 10);
  const [pctProfissional, setPctProfissional] = useState<number>(state.categoryPercentages.profissional ?? 10);
  const [pctInvestimentos, setPctInvestimentos] = useState<number>(state.profile.investmentsPercentage ?? 10);

  // Pisos Mínimos (R$ ou % para investimentos)
  const defaultFloors = state.categoryFloors || {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: 0,
  };

  const [pisoMoradia, setPisoMoradia] = useState<number>(defaultFloors.moradia ?? 0);
  const [pisoTransporte, setPisoTransporte] = useState<number>(defaultFloors.transporte ?? 0);
  const [pisoComida, setPisoComida] = useState<number>(defaultFloors.comida ?? 0);
  const [pisoLazer, setPisoLazer] = useState<number>(defaultFloors.lazer ?? 0);
  const [pisoProtecao, setPisoProtecao] = useState<number>(defaultFloors.protecao ?? 0);
  const [pisoProfissional, setPisoProfissional] = useState<number>(defaultFloors.profissional ?? 0);
  const [pisoInvestimentosPct, setPisoInvestimentosPct] = useState<number>(defaultFloors.investimentos ?? 0);

  // Reajuste Automático Modal / State
  const [rebalanceProposal, setProposedRebalance] = useState<ProposedRebalance | null>(null);
  const [rebalanceMessage, setRebalanceMessage] = useState<string | null>(null);

  // Investimentos Settings
  const [reserveMonths, setReserveMonths] = useState<number>(
    state.profile.emergencyReserveMonthsTarget || 10
  );
  const [expectedYield, setExpectedYield] = useState<string>(
    (state.profile.expectedYieldAnnual || 6.0).toString()
  );

  // Clear / Reset All Data State
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);
  const [clearErrorMsg, setClearErrorMsg] = useState<string | null>(null);

  const handleConfirmClearData = async () => {
    setIsClearingData(true);
    setClearErrorMsg(null);
    try {
      await clearAllData();
      setShowClearDataModal(false);
      setClearSuccessMsg('Todo o conteúdo atual da conta foi apagado com sucesso! Suas porcentagens iniciais e categorizações foram preservadas.');
      setTimeout(() => setClearSuccessMsg(null), 6000);
    } catch (e: any) {
      // Erro inline (com ação de fechar) em vez de alert nativo, que bloqueia a interface
      setClearErrorMsg(e?.message || 'Não conseguimos apagar o conteúdo agora. Tente novamente.');
    } finally {
      setIsClearingData(false);
    }
  };

  // Secondary Tools
  const [showDataTools, setShowDataTools] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Meu Pluggy & Open Finance Credentials State
  const [p1PluggyClientId, setP1PluggyClientId] = useState(pluggyCredentials.partner1ClientId || '');
  const [p1PluggySecret, setP1PluggySecret] = useState(pluggyCredentials.partner1ClientSecret || '');
  const [p1PluggyCpf, setP1PluggyCpf] = useState(pluggyCredentials.partner1Cpf || '');

  const [p2PluggyClientId, setP2PluggyClientId] = useState(pluggyCredentials.partner2ClientId || '');
  const [p2PluggySecret, setP2PluggySecret] = useState(pluggyCredentials.partner2ClientSecret || '');
  const [p2PluggyCpf, setP2PluggyCpf] = useState(pluggyCredentials.partner2Cpf || '');

  // ==========================================
  // MEU PLUGGY HIGH-FIDELITY WIDGET STATE
  // ==========================================
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [pluggyStep, setPluggyStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedBank, setSelectedBank] = useState<BankBrand | null>(null);
  const [pluggyCpf, setPluggyCpf] = useState('');
  const [pluggyPassword, setPluggyPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pluggyAgencia, setPluggyAgencia] = useState('');
  const [pluggyAccountNum, setPluggyAccountNum] = useState('');
  const [consentCheck, setConsentCheck] = useState(true);
  const [consentMonthsCheck, setConsentCheckMonths] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  // Discovered Accounts Simulation
  const [discoveredAccounts, setDiscoveredAccounts] = useState<{
    id: string;
    name: string;
    type: 'corrente' | 'cartao' | 'investimento';
    balance: number;
    owner: 'partner1' | 'partner2' | 'both';
    accountType: 'individual' | 'conjunta';
  }[]>([]);

  // Keyword Rule State
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeyCategory, setNewKeyCategory] = useState<CategoryKey>('comida');
  const [newKeySubcat, setNewKeySubcat] = useState('');
  const [testDescription, setTestDescription] = useState('');

  // Invite Code State
  const [inputInviteCode, setInputInviteCode] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Push notification state
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);
  const reviewSchedule = useMemo(() => getCurrentMonthlyReviewSchedule(), []);

  // Synchronization with Context changes
  useEffect(() => {
    if (state.categoryPercentages) {
      setPctMoradia(state.categoryPercentages.moradia ?? 35);
      setPctComida(state.categoryPercentages.comida ?? 15);
      setPctLazer(state.categoryPercentages.lazer ?? 15);
      setPctProtecao(state.categoryPercentages.protecao ?? 10);
      setPctProfissional(state.categoryPercentages.profissional ?? 10);
    }
    if (state.profile.investmentsPercentage !== undefined) {
      setPctInvestimentos(state.profile.investmentsPercentage);
    }
  }, [state.categoryPercentages, state.profile.investmentsPercentage]);

  // Calculated Values & Life Tier for Bloco 1 & 2
  const currentIncome = totalRendaCalculada > 0 ? totalRendaCalculada : totalIncome;
  const currentPreviewTier: LifeTierInfo = getLifeTier(currentIncome);
  const tierDefaults = currentPreviewTier.percentages;

  const valMoradia = (pctMoradia / 100) * currentIncome;
  const valComida = (pctComida / 100) * currentIncome;
  const valLazer = (pctLazer / 100) * currentIncome;
  const valProtecao = (pctProtecao / 100) * currentIncome;
  const valProfissional = (pctProfissional / 100) * currentIncome;
  const valInvestimentos = (pctInvestimentos / 100) * currentIncome;

  const totalPercentagesSum = pctMoradia + pctComida + pctLazer + pctProtecao + pctProfissional + pctInvestimentos;

  // Customization checks for each category against current tier algorithm defaults
  const customStatus = useMemo(() => {
    return {
      moradia: {
        key: 'moradia' as CategoryKey,
        name: 'Moradia',
        emoji: '🏠',
        desc: 'Aluguel, condomínio, luz, água, gás, internet e manutenção',
        isCustom: pctMoradia !== tierDefaults.moradia,
        recommended: tierDefaults.moradia,
        current: pctMoradia,
        diff: pctMoradia - tierDefaults.moradia,
        valCalculated: (pctMoradia / 100) * currentIncome,
        floor: pisoMoradia,
        isFloorOk: valMoradia >= pisoMoradia,
      },
      comida: {
        key: 'comida' as CategoryKey,
        name: 'Comida',
        emoji: '🍽️',
        desc: 'Supermercado, feira, açougue, delivery e restaurantes do dia a dia',
        isCustom: pctComida !== tierDefaults.comida,
        recommended: tierDefaults.comida,
        current: pctComida,
        diff: pctComida - tierDefaults.comida,
        valCalculated: (pctComida / 100) * currentIncome,
        floor: pisoComida,
        isFloorOk: valComida >= pisoComida,
      },
      lazer: {
        key: 'lazer' as CategoryKey,
        name: 'Lazer',
        emoji: '🎮',
        desc: 'Viagens, cinema, saídas especiais, compras pessoais e hobbies',
        isCustom: pctLazer !== tierDefaults.lazer,
        recommended: tierDefaults.lazer,
        current: pctLazer,
        diff: pctLazer - tierDefaults.lazer,
        valCalculated: (pctLazer / 100) * currentIncome,
        floor: pisoLazer,
        isFloorOk: valLazer >= pisoLazer,
      },
      protecao: {
        key: 'protecao' as CategoryKey,
        name: 'Proteção',
        emoji: '🛡️',
        desc: 'Seguro de vida/invalidez, plano de saúde, farmácia e imprevistos',
        isCustom: pctProtecao !== tierDefaults.protecao,
        recommended: tierDefaults.protecao,
        current: pctProtecao,
        diff: pctProtecao - tierDefaults.protecao,
        valCalculated: (pctProtecao / 100) * currentIncome,
        floor: pisoProtecao,
        isFloorOk: valProtecao >= pisoProtecao,
      },
      profissional: {
        key: 'profissional' as CategoryKey,
        name: 'Profissional',
        emoji: '📚',
        desc: 'Cursos, congressos, anuidade CRM, equipamentos médicos e consultório',
        isCustom: pctProfissional !== tierDefaults.profissional,
        recommended: tierDefaults.profissional,
        current: pctProfissional,
        diff: pctProfissional - tierDefaults.profissional,
        valCalculated: (pctProfissional / 100) * currentIncome,
        floor: pisoProfissional,
        isFloorOk: valProfissional >= pisoProfissional,
      },
      investimentos: {
        key: 'investimentos' as const,
        name: 'Investimentos (Futuro)',
        emoji: '🌱',
        desc: 'Construção de patrimônio, reserva de emergência e independência financeira',
        isCustom: pctInvestimentos !== tierDefaults.investimentos,
        recommended: tierDefaults.investimentos,
        current: pctInvestimentos,
        diff: pctInvestimentos - tierDefaults.investimentos,
        valCalculated: (pctInvestimentos / 100) * currentIncome,
        floor: pisoInvestimentosPct,
        isFloorOk: pctInvestimentos >= pisoInvestimentosPct,
      },
    };
  }, [pctMoradia, pctComida, pctLazer, pctProtecao, pctProfissional, pctInvestimentos, tierDefaults, currentIncome, pisoMoradia, pisoComida, pisoLazer, pisoProtecao, pisoProfissional, pisoInvestimentosPct, valMoradia, valComida, valLazer, valProtecao, valProfissional]);

  const customizedCategoriesList = useMemo(() => {
    return Object.values(customStatus).filter(c => c.isCustom);
  }, [customStatus]);

  const hasAnyCustomPercentage = customizedCategoriesList.length > 0;

  // Restore Junto Algorithm defaults for current preview tier
  const handleRestoreJuntoDefaults = () => {
    setPctMoradia(tierDefaults.moradia);
    setPctComida(tierDefaults.comida);
    setPctLazer(tierDefaults.lazer);
    setPctProtecao(tierDefaults.protecao);
    setPctProfissional(tierDefaults.profissional);
    setPctInvestimentos(tierDefaults.investimentos);

    restoreTierDefaultPercentages(currentPreviewTier.key);
    setSaveSuccessMsg(true);
    triggerCelebration();
    setTimeout(() => setSaveSuccessMsg(false), 4000);
  };

  const handleApplyTierChangeDefaults = () => {
    setPctMoradia(tierDefaults.moradia);
    setPctComida(tierDefaults.comida);
    setPctLazer(tierDefaults.lazer);
    setPctProtecao(tierDefaults.protecao);
    setPctProfissional(tierDefaults.profissional);
    setPctInvestimentos(tierDefaults.investimentos);

    applyNewTierDefaults();
    setSaveSuccessMsg(true);
    triggerCelebration();
    setTimeout(() => setSaveSuccessMsg(false), 4000);
  };

  const handleKeepCustomTierPercentages = () => {
    keepCustomPercentagesOnTierChange();
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 4000);
  };

  const isMoradiaOk = valMoradia >= pisoMoradia;
  const isComidaOk = valComida >= pisoComida;
  const isLazerOk = valLazer >= pisoLazer;
  const isProtecaoOk = valProtecao >= pisoProtecao;
  const isProfissionalOk = valProfissional >= pisoProfissional;
  const isInvestimentosOk = pctInvestimentos >= pisoInvestimentosPct;

  const allFloorsCovered =
    isMoradiaOk &&
    isComidaOk &&
    isLazerOk &&
    isProtecaoOk &&
    isProfissionalOk &&
    isInvestimentosOk;

  const handleSaveBasicProfile = () => {
    updateProfile({
      partner1Name,
      partner2Name,
      partner1Income: numP1,
      partner2Income: numP2,
      emergencyReserveMonthsTarget: reserveMonths,
      expectedYieldAnnual: parseFloat(expectedYield.replace(',', '.')) || 6.0,
      investmentsPercentage: pctInvestimentos,
    });

    updateCategoryPercentages({
      moradia: pctMoradia,
      transporte: pctTransporte,
      comida: pctComida,
      lazer: pctLazer,
      protecao: pctProtecao,
      profissional: pctProfissional,
    });

    updateCategoryFloors({
      moradia: pisoMoradia,
      transporte: pisoTransporte,
      comida: pisoComida,
      lazer: pisoLazer,
      protecao: pisoProtecao,
      profissional: pisoProfissional,
      investimentos: pisoInvestimentosPct,
    });

    updatePluggyCredentials({
      partner1ClientId: p1PluggyClientId,
      partner1ClientSecret: p1PluggySecret,
      partner1Cpf: p1PluggyCpf,
      partner2ClientId: p2PluggyClientId,
      partner2ClientSecret: p2PluggySecret,
      partner2Cpf: p2PluggyCpf,
    });

    setSaveSuccessMsg(true);
    triggerCelebration();
    setTimeout(() => setSaveSuccessMsg(false), 4000);
  };

  const handleTriggerRebalance = () => {
    setRebalanceMessage(null);

    if (allFloorsCovered) {
      setRebalanceMessage('Tudo certo. As porcentagens atuais já cobrem os mínimos.');
      return;
    }

    if (currentIncome <= 0) {
      setRebalanceMessage('Sua renda está zerada. Insira os valores de renda primeiro.');
      return;
    }

    const minMoradiaAmt = pisoMoradia;
    const minComidaAmt = pisoComida;
    const minProtecaoAmt = pisoProtecao;
    const minProfissionalAmt = pisoProfissional;
    const minInvestimentosAmt = (pisoInvestimentosPct / 100) * currentIncome;

    const minEssentialSum =
      minMoradiaAmt +
      minComidaAmt +
      minProtecaoAmt +
      minProfissionalAmt +
      minInvestimentosAmt;

    if (currentIncome < minEssentialSum) {
      setRebalanceMessage(
        'Sua renda atual não cobre os pisos mínimos inegociáveis. Reveja os pisos ou aumente a renda.'
      );
      return;
    }

    const targetMoradiaPct = Math.max(pctMoradia, (minMoradiaAmt / currentIncome) * 100);
    const targetComidaPct = Math.max(pctComida, (minComidaAmt / currentIncome) * 100);
    let targetProtecaoPct = Math.max(pctProtecao, (minProtecaoAmt / currentIncome) * 100);
    let targetProfissionalPct = Math.max(pctProfissional, (minProfissionalAmt / currentIncome) * 100);
    let targetInvestimentosPct = Math.max(pctInvestimentos, pisoInvestimentosPct);
    let targetLazerPct = pctLazer;

    const currentSum =
      targetMoradiaPct +
      targetComidaPct +
      targetProtecaoPct +
      targetProfissionalPct +
      targetInvestimentosPct +
      targetLazerPct;

    let excess = currentSum - 100;

    if (excess > 0) {
      const lazerCut = Math.min(targetLazerPct, excess);
      targetLazerPct -= lazerCut;
      excess -= lazerCut;
    }

    if (excess > 0) {
      const minProfPct = (minProfissionalAmt / currentIncome) * 100;
      const profSlack = Math.max(0, targetProfissionalPct - minProfPct);
      const profCut = Math.min(profSlack, excess);
      targetProfissionalPct -= profCut;
      excess -= profCut;
    }

    if (excess > 0) {
      const minProtPct = (minProtecaoAmt / currentIncome) * 100;
      const protSlack = Math.max(0, targetProtecaoPct - minProtPct);
      const protCut = Math.min(protSlack, excess);
      targetProtecaoPct -= protCut;
      excess -= protCut;
    }

    if (excess > 0) {
      const invSlack = Math.max(0, targetInvestimentosPct - pisoInvestimentosPct);
      const invCut = Math.min(invSlack, excess);
      targetInvestimentosPct -= invCut;
      excess -= invCut;
    }

    const round = (n: number) => Math.round(n * 10) / 10;

    const proposed: ProposedRebalance = {
      percentages: {
        moradia: round(targetMoradiaPct),
        comida: round(targetComidaPct),
        lazer: round(targetLazerPct),
        protecao: round(targetProtecaoPct),
        profissional: round(targetProfissionalPct),
        investimentos: round(targetInvestimentosPct),
      },
      amounts: {
        moradia: (targetMoradiaPct / 100) * currentIncome,
        comida: (targetComidaPct / 100) * currentIncome,
        lazer: (targetLazerPct / 100) * currentIncome,
        protecao: (targetProtecaoPct / 100) * currentIncome,
        profissional: (targetProfissionalPct / 100) * currentIncome,
        investimentos: (targetInvestimentosPct / 100) * currentIncome,
      },
      oldPercentages: {
        moradia: pctMoradia,
        comida: pctComida,
        lazer: pctLazer,
        protecao: pctProtecao,
        profissional: pctProfissional,
        investimentos: pctInvestimentos,
      },
      oldAmounts: {
        moradia: valMoradia,
        comida: valComida,
        lazer: valLazer,
        protecao: valProtecao,
        profissional: valProfissional,
        investimentos: valInvestimentos,
      },
    };

    setProposedRebalance(proposed);
  };

  const handleApplyRebalance = () => {
    if (!rebalanceProposal) return;

    setPctMoradia(rebalanceProposal.percentages.moradia);
    if (rebalanceProposal.percentages.transporte !== undefined) {
      setPctTransporte(rebalanceProposal.percentages.transporte);
    }
    setPctComida(rebalanceProposal.percentages.comida);
    setPctLazer(rebalanceProposal.percentages.lazer);
    setPctProtecao(rebalanceProposal.percentages.protecao);
    setPctProfissional(rebalanceProposal.percentages.profissional);
    setPctInvestimentos(rebalanceProposal.percentages.investimentos);

    updateCategoryPercentages({
      moradia: rebalanceProposal.percentages.moradia,
      transporte: rebalanceProposal.percentages.transporte || pctTransporte,
      comida: rebalanceProposal.percentages.comida,
      lazer: rebalanceProposal.percentages.lazer,
      protecao: rebalanceProposal.percentages.protecao,
      profissional: rebalanceProposal.percentages.profissional,
    });

    updateProfile({
      investmentsPercentage: rebalanceProposal.percentages.investimentos,
    });

    setProposedRebalance(null);
    setSaveSuccessMsg(true);
    triggerCelebration();
    setTimeout(() => setSaveSuccessMsg(false), 4000);
  };

  // ==========================================
  // PLUGGY CONNECT MULTI-STEP FLOW LOGIC
  // ==========================================
  const handleSelectBank = (bank: BankBrand) => {
    setSelectedBank(bank);
    setPluggyCpf(bank.defaultCpf);
    setPluggyAgencia('3412');
    setPluggyAccountNum('98234-1');
    setPluggyStep(2);
  };

  const handleAuthorizePluggy = () => {
    if (!pluggyCpf.trim() || !pluggyPassword.trim()) return;
    setPluggyStep(3);
    setSyncProgress(0);
  };

  // Sincronização Progress Simulation
  useEffect(() => {
    if (pluggyStep !== 3) return;

    const statuses = [
      'Estabelecendo conexão segura com servidor Meu Pluggy...',
      'Autenticando via chaves eletrônicas reguladas...',
      'Processando consentimento Open Finance do Banco Central...',
      'Mapeando contas de depósitos e faturas de cartões...',
      'Importando extratos e faturas dos últimos 90 dias...',
      'Executando categorização automática do Nosso Financeiro...',
    ];

    const interval = setInterval(() => {
      setSyncProgress(prev => {
        const next = prev + 15;
        if (next >= 100) {
          clearInterval(interval);
          // Generate simulated accounts found at selected bank
          const bName = selectedBank?.name || 'Banco';
          const holds = pluggyCpf === '123.456.789-00' ? 'partner1' : 'partner2';
          setDiscoveredAccounts([
            {
              id: `disc-1`,
              name: `${bName} Conta Corrente`,
              type: 'corrente',
              balance: selectedBank?.id === 'itau' ? 12800 : selectedBank?.id === 'bb' ? 8400 : 4500,
              owner: holds as 'partner1' | 'partner2',
              accountType: 'individual',
            },
            {
              id: `disc-2`,
              name: `${bName} Cartão de Crédito`,
              type: 'cartao',
              balance: selectedBank?.id === 'nubank' ? 1250 : 2100,
              owner: holds as 'partner1' | 'partner2',
              accountType: 'individual',
            }
          ]);
          setPluggyStep(4);
          return 100;
        }
        const index = Math.min(statuses.length - 1, Math.floor((next / 100) * statuses.length));
        setSyncStatus(statuses[index]);
        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [pluggyStep, selectedBank, pluggyCpf]);

  const handleConfirmDiscoveredAccounts = () => {
    discoveredAccounts.forEach(disc => {
      addPluggyAccount({
        itemId: `item-plug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: `acc-${Math.floor(Math.random() * 9000) + 1000}`,
        name: disc.name,
        bankName: selectedBank?.name || 'Banco',
        accountType: disc.type,
        type: disc.accountType,
        owner: disc.owner,
        taxNumber: pluggyCpf,
        balance: disc.balance,
        lastSynced: 'Agora mesmo',
        consentExpiresAt: '2027-10-01',
        status: 'connected',
        appOwner: disc.owner === 'partner2' ? 'partner2' : 'partner1',
      });
    });

    setIsAddingAccount(false);
    setPluggyStep(1);
    setSelectedBank(null);
    setPluggyPassword('');
    triggerCelebration();
  };

  const handleUpdateDiscoveredOwner = (id: string, owner: 'partner1' | 'partner2' | 'both') => {
    setDiscoveredAccounts(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          owner,
          accountType: owner === 'both' ? 'conjunta' : 'individual',
        };
      }
      return a;
    }));
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    addKeywordRule({
      keyword: newKeyword.trim().toUpperCase(),
      category: newKeyCategory,
      subcategory: newKeySubcat.trim() || undefined,
    });
    setNewKeyword('');
    setNewKeySubcat('');
    triggerCelebration();
  };

  const handleTestPush = async () => {
    const perm = await requestPushNotificationPermission();
    if (perm === 'granted') {
      const sent = triggerBrowserPushNotification(
        'Revisão Mensal do Casal 👫',
        reviewSchedule.primaryMessage
      );
      if (sent) {
        setPushStatusMsg('Notificação de teste enviada para seu dispositivo!');
      } else {
        setPushStatusMsg('Notificação ativada no navegador.');
      }
    } else if (perm === 'denied') {
      setPushStatusMsg('Permissão bloqueada no navegador. Habilite nas configurações do site.');
    } else {
      setPushStatusMsg('Permissão solicitada ao navegador.');
    }
    setTimeout(() => setPushStatusMsg(null), 4000);
  };

  const testMatch = useMemo(() => {
    if (!testDescription.trim()) return null;
    return autoCategorizeDescription(testDescription);
  }, [testDescription, autoCategorizeDescription]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Navigation Tabs */}
      <div className="space-y-4 border-b border-slate-200/90 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2">
              <span>Configurações & Conexões</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                Open Finance & PWA
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize cores dos 3 modos, gerencie contas bancárias via Meu Pluggy, palavras-chave e notificações PWA.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={() => setShowClearDataModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
              title="Apagar todo o conteúdo atual da conta preservando porcentagens e categorizações"
            >
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Zerar Conta</span>
            </button>
            <button
              onClick={handleSaveBasicProfile}
              className="btn-primary-accent flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Tudo</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'geral'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Geral & Renda</span>
          </button>

          <button
            onClick={() => setActiveTab('contas')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'contas'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Minhas Contas (Meu Pluggy)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('cores')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'cores'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Cores dos 3 Modos</span>
          </button>

          <button
            onClick={() => setActiveTab('regras')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'regras'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Categorização & Assinaturas</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Notificações & PWA</span>
          </button>

          <button
            onClick={() => setActiveTab('casal')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'casal'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fusão & Convite de Casal</span>
          </button>

          <button
            onClick={() => setActiveTab('dados')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'dados'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Zerar Conta / Limpar Dados</span>
          </button>
        </div>
      </div>

      {clearSuccessMsg && (
        <div className="p-4 rounded-2xl bg-rose-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <Check className="w-5 h-5 stroke-[3]" />
          <span>{clearSuccessMsg}</span>
        </div>
      )}

      {clearErrorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 text-xs sm:text-sm font-bold flex items-start gap-2 shadow-sm animate-in fade-in"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{clearErrorMsg}</span>
          <button
            type="button"
            onClick={() => setClearErrorMsg(null)}
            aria-label="Fechar aviso de erro"
            className="shrink-0 rounded-full p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Configurações e conexões salvas com sucesso!</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: GERAL & RENDA (BLOCOS 1, 2, 3, 5) */}
      {/* ========================================================================= */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          {/* BLOCO 1 — RENDA */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xl font-bold">
                  💵
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                    Bloco 1 — Renda Mensal Líquida do Casal
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Ao inserir ou atualizar a renda, o Junto enquadra o casal automaticamente na faixa correspondente.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBasicProfile}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Renda & Ajustes</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                  Renda Líquida ({partner1Name})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-500 text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    step="100"
                    value={partner1Income}
                    onChange={e => setPartner1Income(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-sm font-black text-slate-950 dark:text-white tabular-nums focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                  Renda Líquida ({partner2Name})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-500 text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    step="100"
                    value={partner2Income}
                    onChange={e => setPartner2Income(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-sm font-black text-slate-950 dark:text-white tabular-nums focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border-2 border-emerald-500/40 flex flex-col justify-center">
                <span className="text-[11px] uppercase tracking-wider font-black text-emerald-950 dark:text-emerald-300">
                  Renda Líquida Mensal Combinada
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white font-display mt-0.5">
                  R$ {formatCurrency(currentIncome)}
                </span>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">
                  Classificação instantânea na {currentPreviewTier.name}
                </span>
              </div>
            </div>
          </div>

          {/* CARD DA FAIXA DE RENDA CORRESPONDENTE (VISUALIZAÇÃO DE FAIXA E PORCENTAGENS) */}
          <div
            className="relative rounded-3xl p-6 sm:p-7 border-2 shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 space-y-5"
            style={{
              borderColor: currentPreviewTier.colors.border,
              boxShadow: `0 8px 30px ${currentPreviewTier.colors.glow}`,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border-2 shrink-0"
                  style={{
                    backgroundColor: currentPreviewTier.colors.lightBg,
                    borderColor: currentPreviewTier.colors.border,
                  }}
                >
                  <span>{currentPreviewTier.emblem}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white font-display">
                      {currentPreviewTier.name}
                    </h3>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-black border"
                      style={{
                        backgroundColor: currentPreviewTier.colors.lightBg,
                        color: currentPreviewTier.colors.primary,
                        borderColor: currentPreviewTier.colors.border,
                      }}
                    >
                      {currentPreviewTier.minIncome === 0
                        ? `Até R$ ${formatCurrency(currentPreviewTier.maxIncome)}`
                        : currentPreviewTier.maxIncome === Infinity
                        ? `Acima de R$ ${formatCurrency(currentPreviewTier.minIncome)}`
                        : `R$ ${formatCurrency(currentPreviewTier.minIncome)} a R$ ${formatCurrency(currentPreviewTier.maxIncome)}`}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {currentPreviewTier.tagline}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {hasAnyCustomPercentage ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-black shadow-xs animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Personalizado Manualmente</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 text-xs font-black shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Padrões Originais do Junto Ativos</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mensagem e Ponto de Inflexão da Faixa */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <p className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{currentPreviewTier.message}</span>
              </p>
              <p className="font-bold text-slate-600 dark:text-slate-400">
                <span className="font-black text-slate-800 dark:text-slate-200">Algoritmo Junto:</span> {currentPreviewTier.inflectionNote}
              </p>
            </div>

            {/* Resumo Rápido das Porcentagens Recomendadas da Faixa */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Porcentagens Padrão Calculadas para a {currentPreviewTier.name}:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-center">
                  <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 block">🏠 Moradia</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.moradia}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.moradia / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-center">
                  <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 block">🍽️ Comida</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.comida}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.comida / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-center">
                  <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 block">🎮 Lazer</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.lazer}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.lazer / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                  <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">🛡️ Proteção</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.protecao}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.protecao / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">📚 Profissional</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.profissional}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.profissional / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">🌱 Investimentos</span>
                  <span className="text-sm font-black text-emerald-950 dark:text-emerald-300">{tierDefaults.investimentos}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.investimentos / 100) * currentIncome)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RECONEXÃO COM MUDANÇA DE FAIXA (TIER CHANGE RECONNECTION BANNER) */}
          {((pendingTierChangePrompt) || (state.lastAcknowledgedTierKey && state.lastAcknowledgedTierKey !== currentPreviewTier.key)) && hasAnyCustomPercentage && (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-indigo-500/20 border-2 border-amber-400 dark:border-amber-600 shadow-xl space-y-4 animate-in fade-in">
              <div className="flex items-start gap-3.5">
                <span className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shrink-0 shadow-md">
                  🎉
                </span>
                <div className="space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                    Mudança de Faixa de Renda Detectada: Vocês atingiram a {currentPreviewTier.name}!
                  </h4>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                    Com a renda atual de <span className="font-black text-slate-950 dark:text-white">R$ {formatCurrency(currentIncome)}</span>, vocês alcançaram uma nova faixa de vida. Notamos que vocês possuem porcentagens personalizadas anteriormente. Desejam manter as porcentagens customizadas manualmente ou preferem aplicar as novas porcentagens padrão calculadas para a nova faixa atingida?
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleKeepCustomTierPercentages}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black border-2 border-slate-300 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                >
                  Manter Minhas Porcentagens Personalizadas
                </button>
                <button
                  type="button"
                  onClick={handleApplyTierChangeDefaults}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Aplicar Novos Padrões da {currentPreviewTier.name}</span>
                </button>
              </div>
            </div>
          )}

          {/* ALERTA GERAL DE RISCO & BOTÃO RESTAURAR PADRÕES */}
          {hasAnyCustomPercentage && (
            <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 shadow-md flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                  ⚠️
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100">
                    Atenção: Porcentagens Personalizadas Fora dos Cálculos do Junto ({customizedCategoriesList.length} {customizedCategoriesList.length === 1 ? 'categoria alterada' : 'categorias alteradas'})
                  </h4>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300 mt-0.5">
                    Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRestoreJuntoDefaults}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar Padrões do Junto ({currentPreviewTier.shortName})</span>
              </button>
            </div>
          )}

          {/* BLOCO 2 — TABELA DE CATEGORIAS, PORCENTAGENS E PISOS MÍNIMOS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-slate-300 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xl font-bold">
                  📊
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                    Bloco 2 — Tabela de Categorias & Porcentagens Recomendadas
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    O casal tem liberdade para personalizar, com indicação visual de qualquer alteração fora dos cálculos.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasAnyCustomPercentage && (
                  <button
                    type="button"
                    onClick={handleRestoreJuntoDefaults}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 text-xs font-black transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrões</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTriggerRebalance}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 text-xs font-black transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reajustar Pisos</span>
                </button>
              </div>
            </div>

            {rebalanceMessage && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs font-black flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rebalanceMessage}</span>
              </div>
            )}

            {/* Rebalance Modal Preview */}
            {rebalanceProposal && (
              <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-black text-sm">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span>Proposta de Rebalanceamento Inteligente</span>
                  </div>
                  <button
                    onClick={() => setProposedRebalance(null)}
                    className="p-1 rounded-lg text-amber-600 hover:bg-amber-200/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-amber-950 dark:text-amber-300 font-bold">
                  Os cortes necessários foram distribuídos preservando os pisos mínimos inegociáveis de Moradia e Comida:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {Object.entries(rebalanceProposal.percentages).map(([key, newPct]) => {
                    const oldPct = rebalanceProposal.oldPercentages[key];
                    const diff = newPct - oldPct;
                    return (
                      <div
                        key={key}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-800 text-center"
                      >
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 capitalize block">
                          {key}
                        </span>
                        <div className="text-sm font-black text-slate-950 dark:text-white mt-1">
                          {newPct}%
                        </div>
                        <span
                          className={`text-[10px] font-black ${
                            diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : 'Sem alteração'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setProposedRebalance(null)}
                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleApplyRebalance}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md cursor-pointer"
                  >
                    Confirmar e Aplicar Novo Equilíbrio
                  </button>
                </div>
              </div>
            )}

            {/* TABELA DE CATEGORIAS COM PORCENTAGENS, RECOMENDAÇÃO JUNTO E ALERTA DE RISCO */}
            <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left min-w-[760px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-3 text-center">Padrão Junto (%)</th>
                    <th className="py-3.5 px-3 text-center">Sua Porcentagem (%)</th>
                    <th className="py-3.5 px-3">Valor Calculado</th>
                    <th className="py-3.5 px-3">Piso Mínimo</th>
                    <th className="py-3.5 px-4">Status & Alerta de Personalização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {/* Moradia */}
                  <tr className={customStatus.moradia.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">🏠</span>
                        <div>
                          <span className="block font-black text-sm">Moradia</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.moradia.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-950 dark:text-teal-200 font-black text-xs border border-teal-300 dark:border-teal-700">
                        {tierDefaults.moradia}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctMoradia}
                          onChange={e => setPctMoradia(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.moradia.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valMoradia)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="100"
                          value={pisoMoradia}
                          onChange={e => setPisoMoradia(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.moradia.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctMoradia}% vs {tierDefaults.moradia}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.moradia}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Comida */}
                  <tr className={customStatus.comida.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">🍽️</span>
                        <div>
                          <span className="block font-black text-sm">Comida</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.comida.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-950 dark:text-sky-200 font-black text-xs border border-sky-300 dark:border-sky-700">
                        {tierDefaults.comida}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctComida}
                          onChange={e => setPctComida(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.comida.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valComida)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="100"
                          value={pisoComida}
                          onChange={e => setPisoComida(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.comida.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctComida}% vs {tierDefaults.comida}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.comida}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Lazer */}
                  <tr className={customStatus.lazer.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">🎮</span>
                        <div>
                          <span className="block font-black text-sm">Lazer</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.lazer.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-200 font-black text-xs border border-purple-300 dark:border-purple-700">
                        {tierDefaults.lazer}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctLazer}
                          onChange={e => setPctLazer(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.lazer.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valLazer)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                        Flexível
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.lazer.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctLazer}% vs {tierDefaults.lazer}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.lazer}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Proteção */}
                  <tr className={customStatus.protecao.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">🛡️</span>
                        <div>
                          <span className="block font-black text-sm">Proteção</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.protecao.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-950 dark:text-rose-200 font-black text-xs border border-rose-300 dark:border-rose-700">
                        {tierDefaults.protecao}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctProtecao}
                          onChange={e => setPctProtecao(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.protecao.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valProtecao)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="100"
                          value={pisoProtecao}
                          onChange={e => setPisoProtecao(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.protecao.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctProtecao}% vs {tierDefaults.protecao}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.protecao}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Profissional */}
                  <tr className={customStatus.profissional.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">📚</span>
                        <div>
                          <span className="block font-black text-sm">Profissional</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.profissional.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 font-black text-xs border border-amber-300 dark:border-amber-700">
                        {tierDefaults.profissional}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctProfissional}
                          onChange={e => setPctProfissional(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.profissional.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valProfissional)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="100"
                          value={pisoProfissional}
                          onChange={e => setPisoProfissional(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.profissional.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctProfissional}% vs {tierDefaults.profissional}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.profissional}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Investimentos */}
                  <tr className={customStatus.investimentos.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'bg-emerald-50/40 dark:bg-emerald-950/20'}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-300">
                        <span className="text-base">🌱</span>
                        <div>
                          <span className="block font-black text-sm">Investimentos (Futuro)</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.investimentos.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-xs border border-emerald-300 dark:border-emerald-700">
                        {tierDefaults.investimentos}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctInvestimentos}
                          onChange={e => setPctInvestimentos(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.investimentos.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-300'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-emerald-900 dark:text-emerald-300 text-xs">
                      R$ {formatCurrency(valInvestimentos)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                        Piso {pisoInvestimentosPct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.investimentos.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctInvestimentos}% vs {tierDefaults.investimentos}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.investimentos}%)</span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Percentage Sum & Validation Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                    totalPercentagesSum === 100
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {totalPercentagesSum === 100 ? '100%' : `${totalPercentagesSum}%`}
                </div>
                <div>
                  <span className="text-xs font-black text-slate-950 dark:text-white block">
                    Soma Total das Porcentagens: {totalPercentagesSum}%
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {totalPercentagesSum === 100
                      ? '✓ 100% da renda líquida distribuída perfeitamente.'
                      : totalPercentagesSum > 100
                      ? `⚠️ A soma excede 100% em ${totalPercentagesSum - 100}%. Reajuste para fechar em 100%.`
                      : `⚠️ Há ${100 - totalPercentagesSum}% da renda sem alocação.`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {hasAnyCustomPercentage && (
                  <button
                    type="button"
                    onClick={handleRestoreJuntoDefaults}
                    className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 text-xs font-black border-2 border-amber-300 dark:border-amber-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restaurar Padrões do Junto</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveBasicProfile}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Configurações</span>
                </button>
              </div>
            </div>
          </div>

          {/* BLOCO 6 — ZONA DE LIMPEZA & APAGAR TODO O CONTEÚDO ATUAL */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
                  🗑️
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Apagar Todo o Conteúdo Atual da Conta (Zerar)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Apaga todos os gastos, receitas, parcelas, bancos e detecções, mantendo intactas as porcentagens iniciais, fases da jornada e categorizações automáticas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowClearDataModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Apagar Todo Conteúdo Atual</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: MINHAS CONTAS (MEU PLUGGY & OPEN FINANCE) */}
      {/* ========================================================================= */}
      {activeTab === 'contas' && (
        <div className="space-y-6">
          {/* Header Info Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3.5 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                🏛️
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    Conexão Bancária via Meu Pluggy (Open Finance)
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold uppercase shrink-0">
                    Regulado Banco Central
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  O app puxa os dados das duas aplicações do Meu Pluggy de cada parceiro e organiza tudo no mesmo dashboard. O consentimento do Open Finance expira a cada 12 meses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={syncPluggyData}
                disabled={isSyncingBanks}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBanks ? 'animate-spin' : ''}`} />
                <span>{isSyncingBanks ? 'Sincronizando...' : 'Sincronizar Pluggy'}</span>
              </button>

              <button
                onClick={() => {
                  setPluggyStep(1);
                  setIsAddingAccount(true);
                }}
                className="btn-primary-accent flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Conta</span>
              </button>
            </div>
          </div>

          {/* TABELA DE CONTAS COM LAYOUT RESPONSIVO (Desktop Table vs Mobile Cards) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                  Tabela "Minhas Contas" Conectadas
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O app pré-preenche o campo Dono via CPF. Ajuste para "Nós dois" para contas conjuntas.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 shrink-0">
                {pluggyAccounts.length} conta(s) ativas
              </span>
            </div>

            {/* Desktop View Table: Shown on screen >= sm */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <table className="w-full text-xs text-left min-w-[720px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5 rounded-l-xl">1. Nome da Conta</th>
                    <th className="py-3 px-3.5">2. Banco & CPF</th>
                    <th className="py-3 px-3.5">3. Tipo</th>
                    <th className="py-3 px-3.5">4. Dono (Mapeamento)</th>
                    <th className="py-3 px-3.5">Validade Open Finance</th>
                    <th className="py-3 px-3.5 rounded-r-xl text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {pluggyAccounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      {/* 1. Nome da Conta */}
                      <td className="py-3.5 px-3.5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span>{acc.name}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              ID: {acc.accountId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Banco & CPF */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {acc.bankName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          CPF: {acc.taxNumber}
                        </span>
                      </td>

                      {/* 3. Tipo */}
                      <td className="py-3.5 px-3.5">
                        <select
                          value={acc.type}
                          onChange={e => updatePluggyAccount(acc.id, { type: e.target.value as 'individual' | 'conjunta' })}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 font-bold text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value="individual">Individual</option>
                          <option value="conjunta">Conjunta (Open Finance)</option>
                        </select>
                      </td>

                      {/* 4. Dono */}
                      <td className="py-3.5 px-3.5">
                        <select
                          value={acc.owner}
                          onChange={e => updatePluggyAccount(acc.id, { owner: e.target.value as 'partner1' | 'partner2' | 'both' })}
                          className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs ${
                            acc.owner === 'both'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                              : acc.owner === 'partner1'
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 text-blue-800 dark:text-blue-300'
                              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          <option value="partner1">Você ({partner1Name})</option>
                          <option value="partner2">Ela/Ele ({partner2Name})</option>
                          <option value="both">Nós dois (Conta Conjunta)</option>
                        </select>
                      </td>

                      {/* Validade Open Finance */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                            {acc.consentExpiresAt}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                            Válido 12m
                          </span>
                        </div>
                      </td>

                      {/* Saldo */}
                      <td className="py-3.5 px-3.5 text-right font-extrabold text-slate-900 dark:text-white tabular-nums">
                        R$ {formatCurrency(acc.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card Grid: Shown on screen < sm to avoid any table overflow */}
            <div className="block sm:hidden space-y-3.5">
              {pluggyAccounts.map(acc => (
                <div
                  key={`mob-acc-${acc.id}`}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💳</span>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{acc.name}</span>
                        <span className="text-[10px] text-slate-400">ID: {acc.accountId}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 dark:text-white block">
                        R$ {formatCurrency(acc.balance)}
                      </span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end font-bold">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                      </span>
                    </div>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Banco & CPF</span>
                      <strong className="text-slate-800 dark:text-slate-200">{acc.bankName}</strong>
                      <span className="text-[10px] text-slate-400 block font-mono">{acc.taxNumber}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Validade Open Finance</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold font-mono">{acc.consentExpiresAt}</span>
                      <span className="text-[9px] font-bold block text-emerald-600">Consentimento 12 meses</span>
                    </div>
                  </div>

                  {/* Edit Type & Owner directly */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-850">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Tipo de Conta</label>
                      <select
                        value={acc.type}
                        onChange={e => updatePluggyAccount(acc.id, { type: e.target.value as 'individual' | 'conjunta' })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-[11px] text-slate-800 dark:text-slate-200"
                      >
                        <option value="individual">Individual</option>
                        <option value="conjunta">Conjunta</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Dono / Titular</label>
                      <select
                        value={acc.owner}
                        onChange={e => updatePluggyAccount(acc.id, { owner: e.target.value as 'partner1' | 'partner2' | 'both' })}
                        className={`w-full px-2 py-1.5 rounded-lg border font-bold text-[11px] ${
                          acc.owner === 'both'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                            : acc.owner === 'partner1'
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 text-blue-800 dark:text-blue-300'
                            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        <option value="partner1">Você ({partner1Name})</option>
                        <option value="partner2">Ela/Ele ({partner2Name})</option>
                        <option value="both">Nós dois (Conjunta)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AS DUAS APLICAÇÕES SEPARADAS DO MEU PLUGGY */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold">
                🔑
              </span>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Configuração de Credenciais: 2 Aplicações Separadas Meu Pluggy
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O plano gratuito do Meu Pluggy é de 1 CPF por aplicação. Registre as credenciais de ambos para que o app consolide tudo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Aplicação Parceiro 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <span className="font-bold text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <span>👩</span> Aplicação 1 ({partner1Name})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">meu.pluggy.ai</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Client ID</label>
                    <input
                      type="text"
                      value={p1PluggyClientId}
                      onChange={e => setP1PluggyClientId(e.target.value)}
                      placeholder="pluggy_cli_..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Client Secret</label>
                    <input
                      type="password"
                      value={p1PluggySecret}
                      onChange={e => setP1PluggySecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">CPF do Titular (taxNumber)</label>
                    <input
                      type="text"
                      value={p1PluggyCpf}
                      onChange={e => setP1PluggyCpf(e.target.value)}
                      placeholder="123.456.789-00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Aplicação Parceiro 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <span className="font-bold text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <span>👨</span> Aplicação 2 ({partner2Name})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">meu.pluggy.ai</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Client ID</label>
                    <input
                      type="text"
                      value={p2PluggyClientId}
                      onChange={e => setP2PluggyClientId(e.target.value)}
                      placeholder="pluggy_cli_..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Client Secret</label>
                    <input
                      type="password"
                      value={p2PluggySecret}
                      onChange={e => setP2PluggySecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">CPF do Titular (taxNumber)</label>
                    <input
                      type="text"
                      value={p2PluggyCpf}
                      onChange={e => setP2PluggyCpf(e.target.value)}
                      placeholder="987.654.321-99"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: CORES DOS 3 MODOS */}
      {/* ========================================================================= */}
      {activeTab === 'cores' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold shadow-xs">
              🎨
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                Cores Principais Personalizadas para Cada Modo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada um dos 3 modos possui sua cor principal distinta. Ao alternar entre Casal, {partner1Name} ou {partner2Name}, as bordas, botões, números e destaques do app assumem integralmente a cor do perfil ativo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Modo Casal */}
            <div
              className="p-5 rounded-3xl border-2 space-y-3.5 transition-all shadow-xs"
              style={{
                borderColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].borderHex,
                backgroundColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].lightHex,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-black text-sm flex items-center gap-1.5"
                  style={{ color: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].textHex }}
                >
                  <span>👥</span> Modo Casal
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].hex }}
                >
                  Ativo no Casal
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Cor exibida na visão compartilhada e consolidação de todo o casal.
              </p>

              {/* Live Mini Preview */}
              <div
                className="p-2.5 rounded-xl border flex items-center justify-between bg-white dark:bg-slate-900 shadow-2xs"
                style={{ borderColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].borderHex }}
              >
                <span
                  className="text-xs font-black"
                  style={{ color: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].textHex }}
                >
                  Prévia: R$ 12.450
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].hex }}
                >
                  Botão
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(Object.keys(ACCENT_THEMES) as AccentTheme[]).map(key => {
                  const isSelected = (state.profile.coupleTheme || 'emerald') === key;
                  return (
                    <button
                      key={`couple-${key}`}
                      onClick={() => setModeTheme('couple', key)}
                      className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-white shadow-xs bg-white dark:bg-slate-900 ring-2 ring-slate-900/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT_THEMES[key].hex }} />
                      <span className="truncate">{ACCENT_THEMES[key].label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modo Usuário 1 */}
            <div
              className="p-5 rounded-3xl border-2 space-y-3.5 transition-all shadow-xs"
              style={{
                borderColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].borderHex,
                backgroundColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].lightHex,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-black text-sm flex items-center gap-1.5"
                  style={{ color: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].textHex }}
                >
                  <span>👩</span> Modo {partner1Name}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].hex }}
                >
                  Perfil 1
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Cor individual exibida quando {partner1Name} visualiza apenas suas contas e gastos.
              </p>

              {/* Live Mini Preview */}
              <div
                className="p-2.5 rounded-xl border flex items-center justify-between bg-white dark:bg-slate-900 shadow-2xs"
                style={{ borderColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].borderHex }}
              >
                <span
                  className="text-xs font-black"
                  style={{ color: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].textHex }}
                >
                  Prévia: R$ 6.200
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].hex }}
                >
                  Botão
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(Object.keys(ACCENT_THEMES) as AccentTheme[]).map(key => {
                  const isSelected = (state.profile.partner1Theme || 'sapphire') === key;
                  return (
                    <button
                      key={`p1-${key}`}
                      onClick={() => setModeTheme('partner1', key)}
                      className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-white shadow-xs bg-white dark:bg-slate-900 ring-2 ring-slate-900/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT_THEMES[key].hex }} />
                      <span className="truncate">{ACCENT_THEMES[key].label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modo Usuário 2 */}
            <div
              className="p-5 rounded-3xl border-2 space-y-3.5 transition-all shadow-xs"
              style={{
                borderColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].borderHex,
                backgroundColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].lightHex,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-black text-sm flex items-center gap-1.5"
                  style={{ color: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].textHex }}
                >
                  <span>👨</span> Modo {partner2Name}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].hex }}
                >
                  Perfil 2
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Cor individual exibida quando {partner2Name} visualiza apenas suas contas e gastos.
              </p>

              {/* Live Mini Preview */}
              <div
                className="p-2.5 rounded-xl border flex items-center justify-between bg-white dark:bg-slate-900 shadow-2xs"
                style={{ borderColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].borderHex }}
              >
                <span
                  className="text-xs font-black"
                  style={{ color: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].textHex }}
                >
                  Prévia: R$ 8.900
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].hex }}
                >
                  Botão
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(Object.keys(ACCENT_THEMES) as AccentTheme[]).map(key => {
                  const isSelected = (state.profile.partner2Theme || 'rose') === key;
                  return (
                    <button
                      key={`p2-${key}`}
                      onClick={() => setModeTheme('partner2', key)}
                      className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-white shadow-xs bg-white dark:bg-slate-900 ring-2 ring-slate-900/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT_THEMES[key].hex }} />
                      <span className="truncate">{ACCENT_THEMES[key].label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: CATEGORIZAÇÃO & ASSINATURAS */}
      {/* ========================================================================= */}
      {activeTab === 'regras' && (
        <div className="space-y-6">
          {/* Tabela de Palavras-Chave */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg font-bold">
                🏷️
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  Tabela de Palavras-Chave para Categorização Automática
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Como o Meu Pluggy entrega dados brutos, esta tabela mapeia automaticamente estabelecimentos (ex: UBER, NETFLIX, IFOOD) para suas categorias.
                </p>
              </div>
            </div>

            {/* Live Tester Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Testador em Tempo Real de Estabelecimento:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testDescription}
                  onChange={e => setTestDescription(e.target.value)}
                  placeholder="Ex: UBER *TRIP SP ou IFOOD *RESTAURANTE..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              {testMatch && testDescription && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
                  <span>
                    Resultado: Categoria <strong className="uppercase">{testMatch.category}</strong> ({testMatch.subcategory || 'geral'})
                  </span>
                  {testMatch.matchedKeyword && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-900">
                      Regra: {testMatch.matchedKeyword}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Add New Keyword Form */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] font-bold text-slate-500 block">Palavra-chave</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  placeholder="Ex: GYMPASS"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs uppercase font-bold"
                />
              </div>
              <div className="w-36">
                <label className="text-[11px] font-bold text-slate-500 block">Categoria</label>
                <select
                  value={newKeyCategory}
                  onChange={e => setNewKeyCategory(e.target.value as CategoryKey)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold capitalize"
                >
                  {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(k => (
                    <option key={k} value={k}>{CATEGORIES_BASE[k].name}</option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="text-[11px] font-bold text-slate-500 block">Subcategoria (opcional)</label>
                <input
                  type="text"
                  value={newKeySubcat}
                  onChange={e => setNewKeySubcat(e.target.value)}
                  placeholder="Ex: academia"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <button
                onClick={handleAddKeyword}
                className="btn-primary-accent px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + Adicionar Regra
              </button>
            </div>

            {/* Keyword List Badges */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-500 block">
                Regras Ativas ({keywordRules.length})
              </span>
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                {keywordRules.map(rule => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {rule.keyword}
                    </span>
                    <span className="text-[10px] text-slate-400">→</span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 capitalize">
                      {rule.category}
                    </span>
                    <button
                      onClick={() => removeKeywordRule(rule.id)}
                      className="ml-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detector de Assinaturas Recorrentes */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-purple-400 flex items-center justify-center text-lg font-bold">
                🔄
              </span>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Assinaturas e Cobranças Recorrentes Detectadas
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O app compara transações mensais repetidas no mesmo valor para evitar assinaturas esquecidas.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {detectedSubscriptions.map(sub => (
                <div
                  key={sub.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💳</span>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white block">
                        {sub.merchant}
                      </span>
                      <span className="text-xs text-slate-500">
                        R$ {sub.amount.toFixed(2)} / mês · Categoria {sub.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sub.status === 'active' ? (
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                        ✓ Confirmada
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => confirmSubscriptionAsExpense(sub.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer"
                        >
                          Confirmar Assinatura
                        </button>
                        <button
                          onClick={() => dismissSubscription(sub.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                        >
                          Ignorar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: NOTIFICAÇÕES & PWA */}
      {/* ========================================================================= */}
      {activeTab === 'pwa' && (
        <div className="space-y-6">
          {/* Banner PWA */}
          <PWAInstallButton variant="banner" />

          {/* Regras das Notificações de Revisão Mensal */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                🔔
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  Notificações de Revisão Mensal no Celular
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chegam na tela de bloqueio do celular como as do WhatsApp.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <span className="font-extrabold text-emerald-900 dark:text-emerald-300 block">
                  1ª Segunda-Feira às 20h
                </span>
                <p className="italic">
                  "{reviewSchedule.primaryMessage}"
                </p>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block pt-1 font-bold">
                  Disparo principal do mês
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1.5">
                <span className="font-extrabold text-amber-900 dark:text-amber-300 block">
                  Após 48 Horas sem abrir
                </span>
                <p className="italic">
                  "{reviewSchedule.secondaryMessage}"
                </p>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 block pt-1 font-bold">
                  Relembrete suave
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-extrabold text-slate-900 dark:text-white block font-display">
                  Após 7 Dias
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Para de insistir até o próximo mês. Notificação que insiste vira ruído.
                </p>
                <span className="text-[10px] text-slate-400 block pt-1 font-bold">
                  Regra de respeito à rotina
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestPush}
                className="btn-primary-accent flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Testar Notificação de Revisão no Meu Dispositivo</span>
              </button>

              {pushStatusMsg && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  {pushStatusMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 6: FUSÃO & CONVITE DO CASAL */}
      {/* ========================================================================= */}
      {activeTab === 'casal' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg font-bold">
              👫
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                Fusão de Contas & Espaço Compartilhado "Casal"
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gere um convite de 6 dígitos para seu parceiro ou insira o código dele para conectar os perfis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Seu Código de Convite */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                Seu Código de Convite do Casal:
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 py-3 px-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-500 text-center font-mono font-black text-xl tracking-widest text-emerald-600 dark:text-emerald-400">
                  {coupleAccount?.inviteCode || 'CASAL6'}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(coupleAccount?.inviteCode || 'CASAL6');
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2500);
                  }}
                  className="p-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer"
                  title="Copiar código"
                >
                  {copiedInvite ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Envie este código para seu par inserir no aplicativo dele e fazer a fusão.
              </p>
            </div>

            {/* Inserir Código do Parceiro */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                Conectar com Código do Parceiro:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={inputInviteCode}
                  onChange={e => setInputInviteCode(e.target.value.toUpperCase())}
                  placeholder="EX: 7X89Q2"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm uppercase text-center"
                />
                <button
                  onClick={async () => {
                    try {
                      await joinCoupleWithInviteCode(inputInviteCode);
                      setInviteFeedback('Casal conectado com sucesso! 🎉');
                      triggerCelebration();
                    } catch (e: any) {
                      setInviteFeedback(e?.message || 'Erro ao conectar código.');
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Conectar
                </button>
              </div>
              {inviteFeedback && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {inviteFeedback}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 7: GERENCIAR DADOS & ZERAR CONTA */}
      {/* ========================================================================= */}
      {activeTab === 'dados' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-rose-200 dark:border-rose-900/60 shadow-md space-y-6">
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl shrink-0 shadow-xs">
                🗑️
              </span>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider">
                  Gerenciamento de Dados • Folha Limpa
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display mt-1">
                  Apagar Todo o Conteúdo Atual da Conta (Zerar Dados)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Use esta opção para recomeçar o seu JUNTÔ do zero. Todos os lançamentos manuais, contas conectadas e detecções serão removidos, sem apagar suas porcentagens e categorizações.
                </p>
              </div>
            </div>

            {/* Comparison Grid: What is cleared vs What is preserved */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* O que é apagado */}
              <div className="p-5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-extrabold text-xs uppercase tracking-wider">
                  <span>❌</span>
                  <span>O que será APAGADO da conta:</span>
                </div>
                <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Todos os gastos e despesas</strong> lançados no histórico.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Todas as receitas e rendas</strong> informadas (voltam para R$ 0).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Todas as conexões bancárias</strong> (Open Finance / Meu Pluggy e credenciais).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Compras parceladas ativas</strong> e cofrinhos de metas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Detecções de clústers e cobranças</strong> automáticas pendentes.</span>
                  </li>
                </ul>
              </div>

              {/* O que é PRESERVADO */}
              <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs uppercase tracking-wider">
                  <span>🛡️</span>
                  <span>O que será PRESERVADO intacto:</span>
                </div>
                <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Porcentagens iniciais de orçamento</strong> (30% Moradia, 12% Comida, 13% Lazer, 15% Proteção, 10% Profissional, 20% Investimentos).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Fases e metas de vida</strong> (meses de reserva e ritmo financeiro).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Regras de categorização automática</strong> (identificação inteligente por palavras-chave).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Seu cadastro individual</strong> (e-mail, nome e vínculo do casal).</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Trigger Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                  Pronto para recomeçar com a conta zerada?
                </h5>
                <p className="text-[11px] text-slate-400">
                  Uma confirmação de segurança será solicitada antes de apagar qualquer dado.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowClearDataModal(true)}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Apagar Todo o Conteúdo da Conta Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: APAGAR TODO O CONTEÚDO ATUAL DA CONTA */}
      {/* ========================================================================= */}
      {showClearDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !isClearingData && setShowClearDataModal(false)} />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/60 overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <span className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                ⚠️
              </span>
              <div>
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  Apagar Todo o Conteúdo Atual da Conta?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Esta ação é irreversível. Todos os gastos, receitas, bancos conectados e detecções serão removidos.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">
                <Check className="w-3.5 h-3.5" />
                <span>O que permanece intacto:</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
                Suas <strong>porcentagens iniciais de orçamento</strong>, <strong>fases da jornada</strong> e <strong>regras de categorização automática</strong> serão todas preservadas!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isClearingData}
                onClick={() => setShowClearDataModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isClearingData}
                onClick={handleConfirmClearData}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-rose-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isClearingData ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Apagando Dados...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Apagar Todo o Conteúdo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIGH-FIDELITY MEU PLUGGY CONNECT WIDGET SIMULATOR MODAL */}
      {/* ========================================================================= */}
      {isAddingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsAddingAccount(false)} />

          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                  🔌
                </span>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Meu Pluggy Connect Flow
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Sincronização Segura Open Finance · Passo {pluggyStep} de 4
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddingAccount(false);
                  setPluggyStep(1);
                  setSelectedBank(null);
                }}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* STEP 1: SELECT BANK */}
            {pluggyStep === 1 && (
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                    Selecione a Instituição Financeira do Casal:
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Conecte contas individuais ou conjuntas de qualquer banco regulado pelo Banco Central.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {BANK_BRANDS.map(bank => (
                    <button
                      key={bank.id}
                      onClick={() => handleSelectBank(bank)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 hover:scale-[1.02] hover:shadow-md transition-all cursor-pointer ${bank.bgClass} ${bank.borderClass}`}
                    >
                      <span className="text-2xl shrink-0">{bank.logo}</span>
                      <div>
                        <span className={`font-bold text-xs block ${bank.textClass}`}>
                          {bank.name}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-normal">
                          Open Finance Ativo
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Apenas Modo Leitura:</strong> A API do Meu Pluggy é 100% segura e regulada pelo BC. O aplicativo nunca terá acesso para realizar transações, saques ou pagamentos.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2: CREDENTIALS & CONSENT */}
            {pluggyStep === 2 && selectedBank && (
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                  <span className="text-3xl">{selectedBank.logo}</span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Conectar {selectedBank.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      meu.pluggy.ai via {selectedBank.id}.api.openbanking.com.br
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Agência (4 dígitos)
                      </label>
                      <input
                        type="text"
                        value={pluggyAgencia}
                        onChange={e => setPluggyAgencia(e.target.value)}
                        placeholder="3412"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Conta (com dígito)
                      </label>
                      <input
                        type="text"
                        value={pluggyAccountNum}
                        onChange={e => setPluggyAccountNum(e.target.value)}
                        placeholder="98234-1"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      CPF do Titular da Conta / Cartão
                    </label>
                    <input
                      type="text"
                      value={pluggyCpf}
                      onChange={e => setPluggyCpf(e.target.value)}
                      placeholder="123.456.789-00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Senha Eletrônica / PIN (Simulado)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={pluggyPassword}
                        onChange={e => setPluggyPassword(e.target.value)}
                        placeholder="Sua senha eletrônica de internet banking"
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Consents boxes */}
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={consentCheck}
                        onChange={e => setConsentCheck(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <span>
                        Autorizo o compartilhamento de saldos, limites e extratos da minha conta para fins de consolidação das finanças do casal.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={consentMonthsCheck}
                        onChange={e => setConsentCheckMonths(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <span>
                        Autorizo a validade regulatória deste compartilhamento por **12 meses** conforme normas do BC.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Flow buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setPluggyStep(1);
                      setSelectedBank(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleAuthorizePluggy}
                    disabled={!pluggyCpf.trim() || !pluggyPassword.trim() || !consentCheck || !consentMonthsCheck}
                    className="btn-primary-accent px-5 py-2 rounded-xl text-white font-extrabold text-xs shadow-md disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Autorizar Open Finance
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SYNC PROGRESS BAR ANIMATION */}
            {pluggyStep === 3 && (
              <div className="p-8 text-center space-y-5">
                <div className="relative w-16 h-16 mx-auto">
                  <RefreshCw className="w-16 h-16 text-emerald-600 dark:text-emerald-400 animate-spin stroke-[2]" />
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                    🔑
                  </span>
                </div>

                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Conexão Segura em Andamento...
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium min-h-[32px] px-2 animate-pulse leading-snug">
                    {syncStatus}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>

                <div className="text-[10px] text-slate-400 font-mono tracking-wider">
                  Open Finance API (V3.1) · {syncProgress}% concluído
                </div>
              </div>
            )}

            {/* STEP 4: CONFIRM DISCOVERED ACCOUNTS AND DEFINE ROLES */}
            {pluggyStep === 4 && (
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5">
                  <span className="text-xl">🎉</span>
                  <div className="text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                      Conexão Estabelecida!
                    </span>
                    Encontramos as seguintes contas sob o CPF <strong className="font-mono">{pluggyCpf}</strong>:
                  </div>
                </div>

                <div className="space-y-3">
                  {discoveredAccounts.map(disc => (
                    <div
                      key={disc.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white min-w-0">
                          <span className="shrink-0">{disc.type === 'cartao' ? '💳' : '🏦'}</span>
                          <span className="truncate">{disc.name}</span>
                        </div>
                        <strong className="text-slate-900 dark:text-white font-extrabold tabular-nums shrink-0">
                          R$ {formatCurrency(disc.balance)}
                        </strong>
                      </div>

                      {/* Map owner & accountType */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Tipo de Conta
                          </label>
                          <select
                            value={disc.accountType}
                            onChange={e => {
                              const val = e.target.value as 'individual' | 'conjunta';
                              setDiscoveredAccounts(prev => prev.map(a => a.id === disc.id ? { ...a, accountType: val } : a));
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                          >
                            <option value="individual">Individual</option>
                            <option value="conjunta">Conjunta (Mapeamento)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Dono / Titular
                          </label>
                          <select
                            value={disc.owner}
                            onChange={e => handleUpdateDiscoveredOwner(disc.id, e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold capitalize"
                          >
                            <option value="partner1">Você ({partner1Name})</option>
                            <option value="partner2">Ela/Ele ({partner2Name})</option>
                            <option value="both">Ambos (Casal)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                  *Nota: Você poderá ajustar estes mapeamentos a qualquer momento na aba Ajustes.*
                </div>

                {/* Finalize connection */}
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleConfirmDiscoveredAccounts}
                    className="btn-primary-accent w-full py-3 rounded-xl text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Concluir Conexão Open Finance</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
