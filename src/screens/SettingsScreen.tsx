import { AvatarSettings, MemberAvatar } from '../avatars/AvatarUI';
import React, { useState, useMemo, useEffect } from 'react';
import { Users, DollarSign, AlertTriangle, CheckCircle2, Sparkles, RefreshCw, Save, Check, X, RotateCcw, Trash2, Palette, Building, Smartphone, Tag, Plus, Bell, Copy, UploadCloud, FileText } from 'lucide-react';
import { useFinance, CATEGORIES_BASE, ACCENT_THEMES } from '../context/FinanceContext';
import { CategoryKey, AccentTheme, LifeTierInfo } from '../types/finance';
import { getLifeTier } from '../utils/incomeTiersEngine';
import { formatCurrency } from '../utils/formatters';
import { BankSyncModal } from '../components/BankSyncModal';
import { MedicalCareerSettings } from '../components/MedicalCareerSettings';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { BudgetRebalanceModal } from '../components/modals/BudgetRebalanceModal';
import {
  getCurrentMonthlyReviewSchedule,
  requestPushNotificationPermission,
  triggerBrowserPushNotification,
} from '../utils/monthlyReviewNotifications';
import {
  requestPushPermission,
  sendTestNotification,
  getBrowserPermissionStatus,
} from '../utils/pushNotificationEngine';

interface ProposedRebalance {
  percentages: Record<string, number>;
  amounts: Record<string, number>;
  oldPercentages: Record<string, number>;
  oldAmounts: Record<string, number>;
}

type SettingsTab = 'avatares' | 'geral' | 'contas' | 'cores' | 'regras' | 'pwa' | 'casal' | 'dados';

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
    updatePluggyAccount,
    addPluggyAccount,
    removePluggyAccount,
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
    pushSettings,
    updatePushSettings,
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
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

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

  const [isAddingAccount, setIsAddingAccount] = useState(false);

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
      setPctMoradia(state.categoryPercentages.moradia ?? 30);
      setPctTransporte(state.categoryPercentages.transporte ?? 10);
      setPctComida(state.categoryPercentages.comida ?? 15);
      setPctLazer(state.categoryPercentages.lazer ?? 15);
      setPctProtecao(state.categoryPercentages.protecao ?? 10);
      setPctProfissional(state.categoryPercentages.profissional ?? 10);
    }
    if (state.categoryFloors) {
      setPisoMoradia(state.categoryFloors.moradia ?? 0);
      setPisoTransporte(state.categoryFloors.transporte ?? 0);
      setPisoComida(state.categoryFloors.comida ?? 0);
      setPisoLazer(state.categoryFloors.lazer ?? 0);
      setPisoProtecao(state.categoryFloors.protecao ?? 0);
      setPisoProfissional(state.categoryFloors.profissional ?? 0);
      setPisoInvestimentosPct(state.categoryFloors.investimentos ?? 0);
    }
    if (state.profile.investmentsPercentage !== undefined) {
      setPctInvestimentos(state.profile.investmentsPercentage);
    }
  }, [state.categoryPercentages, state.categoryFloors, state.profile.investmentsPercentage]);

  // Calculated Values & Life Tier for Bloco 1 & 2
  const currentIncome = totalRendaCalculada > 0 ? totalRendaCalculada : totalIncome;
  const currentPreviewTier: LifeTierInfo = getLifeTier(currentIncome);
  const tierDefaults = currentPreviewTier.percentages;

  const valMoradia = (pctMoradia / 100) * currentIncome;
  const valTransporte = (pctTransporte / 100) * currentIncome;
  const valComida = (pctComida / 100) * currentIncome;
  const valLazer = (pctLazer / 100) * currentIncome;
  const valProtecao = (pctProtecao / 100) * currentIncome;
  const valProfissional = (pctProfissional / 100) * currentIncome;
  const valInvestimentos = (pctInvestimentos / 100) * currentIncome;

  const totalPercentagesSum = pctMoradia + pctTransporte + pctComida + pctLazer + pctProtecao + pctProfissional + pctInvestimentos;

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
      transporte: {
        key: 'transporte' as CategoryKey,
        name: 'Transporte & Mobilidade',
        emoji: '🚗',
        desc: 'Combustível, IPVA, seguro auto, manutenção, Uber/99, pedágios e estacionamentos',
        isCustom: pctTransporte !== tierDefaults.transporte,
        recommended: tierDefaults.transporte,
        current: pctTransporte,
        diff: pctTransporte - tierDefaults.transporte,
        valCalculated: (pctTransporte / 100) * currentIncome,
        floor: pisoTransporte,
        isFloorOk: valTransporte >= pisoTransporte,
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
  }, [pctMoradia, pctTransporte, pctComida, pctLazer, pctProtecao, pctProfissional, pctInvestimentos, tierDefaults, currentIncome, pisoMoradia, pisoTransporte, pisoComida, pisoLazer, pisoProtecao, pisoProfissional, pisoInvestimentosPct, valMoradia, valTransporte, valComida, valLazer, valProtecao, valProfissional]);

  const customizedCategoriesList = useMemo(() => {
    return Object.values(customStatus).filter(c => c.isCustom);
  }, [customStatus]);

  const hasAnyCustomPercentage = customizedCategoriesList.length > 0;

  // Restore Junto Algorithm defaults for current preview tier
  const handleRestoreJuntoDefaults = () => {
    setPctMoradia(tierDefaults.moradia);
    setPctTransporte(tierDefaults.transporte);
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
    setPctTransporte(tierDefaults.transporte);
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
  const isTransporteOk = valTransporte >= pisoTransporte;
  const isComidaOk = valComida >= pisoComida;
  const isLazerOk = valLazer >= pisoLazer;
  const isProtecaoOk = valProtecao >= pisoProtecao;
  const isProfissionalOk = valProfissional >= pisoProfissional;
  const isInvestimentosOk = pctInvestimentos >= pisoInvestimentosPct;

  const allFloorsCovered =
    isMoradiaOk &&
    isTransporteOk &&
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
    const minTransporteAmt = pisoTransporte;
    const minComidaAmt = pisoComida;
    const minProtecaoAmt = pisoProtecao;
    const minProfissionalAmt = pisoProfissional;
    const minInvestimentosAmt = (pisoInvestimentosPct / 100) * currentIncome;

    const minEssentialSum =
      minMoradiaAmt +
      minTransporteAmt +
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
    const targetTransportePct = Math.max(pctTransporte, (minTransporteAmt / currentIncome) * 100);
    const targetComidaPct = Math.max(pctComida, (minComidaAmt / currentIncome) * 100);
    let targetProtecaoPct = Math.max(pctProtecao, (minProtecaoAmt / currentIncome) * 100);
    let targetProfissionalPct = Math.max(pctProfissional, (minProfissionalAmt / currentIncome) * 100);
    let targetInvestimentosPct = Math.max(pctInvestimentos, pisoInvestimentosPct);
    let targetLazerPct = pctLazer;

    const currentSum =
      targetMoradiaPct +
      targetTransportePct +
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
        transporte: round(targetTransportePct),
        comida: round(targetComidaPct),
        lazer: round(targetLazerPct),
        protecao: round(targetProtecaoPct),
        profissional: round(targetProfissionalPct),
        investimentos: round(targetInvestimentosPct),
      },
      amounts: {
        moradia: (targetMoradiaPct / 100) * currentIncome,
        transporte: (targetTransportePct / 100) * currentIncome,
        comida: (targetComidaPct / 100) * currentIncome,
        lazer: (targetLazerPct / 100) * currentIncome,
        protecao: (targetProtecaoPct / 100) * currentIncome,
        profissional: (targetProfissionalPct / 100) * currentIncome,
        investimentos: (targetInvestimentosPct / 100) * currentIncome,
      },
      oldPercentages: {
        moradia: pctMoradia,
        transporte: pctTransporte,
        comida: pctComida,
        lazer: pctLazer,
        protecao: pctProtecao,
        profissional: pctProfissional,
        investimentos: pctInvestimentos,
      },
      oldAmounts: {
        moradia: valMoradia,
        transporte: valTransporte,
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
                Extratos & Notificações
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize cores dos 3 modos, importe extratos bancários (OFX/CSV), configure palavras-chave e lembretes diários.
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
              hidden={activeTab === 'avatares'}
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
          <button type="button" onClick={() => setActiveTab('avatares')} className={'px-3.5 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap min-h-11 ' + (activeTab === 'avatares' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}><Palette className="w-4 h-4" />Nossos avatares</button>
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
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Extratos Bancários (OFX/CSV)</span>
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
      {activeTab === 'avatares' && <AvatarSettings />}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          <MedicalCareerSettings />
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
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-center">
                  <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 block">🏠 Moradia</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.moradia}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.moradia / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-center">
                  <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 block">🚗 Transporte</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{tierDefaults.transporte}%</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-0.5">R$ {formatCurrency((tierDefaults.transporte / 100) * currentIncome)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                  <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block">🍽️ Comida</span>
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
                  onClick={() => setIsRebalanceModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reequilibrar Orçamento com Travas</span>
                </button>
              </div>
            </div>

            <BudgetRebalanceModal
              isOpen={isRebalanceModalOpen}
              onClose={() => setIsRebalanceModalOpen(false)}
            />

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

                  {/* Transporte & Mobilidade */}
                  <tr className={customStatus.transporte.isCustom ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <td className="py-3.5 px-4 font-black">
                      <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                        <span className="text-base">🚗</span>
                        <div>
                          <span className="block font-black text-sm">Transporte & Mobilidade</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block max-w-[200px] truncate">
                            {customStatus.transporte.desc}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-950 dark:text-sky-200 font-black text-xs border border-sky-300 dark:border-sky-700">
                        {tierDefaults.transporte}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pctTransporte}
                          onChange={e => setPctTransporte(Number(e.target.value))}
                          className={`w-16 px-2 py-1.5 rounded-xl border-2 font-black text-sm text-center tabular-nums ${
                            customStatus.transporte.isCustom
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                          }`}
                        />
                        <span className="font-black text-slate-700 dark:text-slate-300">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-950 dark:text-white text-xs">
                      R$ {formatCurrency(valTransporte)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="100"
                          value={pisoTransporte}
                          onChange={e => setPisoTransporte(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {customStatus.transporte.isCustom ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Personalizado ({pctTransporte}% vs {tierDefaults.transporte}% Junto)</span>
                          </div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                            Personalizado manualmente. Alteração realizada fora dos cálculos e recomendações do Junto (por sua conta e risco).
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-black text-[11px] border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Padrão Junto ({tierDefaults.transporte}%)</span>
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
      {/* ABA 2: CENTRAL DE IMPORTAÇÃO DE EXTRATOS BANCÁRIOS (OFX E CSV) */}
      {/* ========================================================================= */}
      {activeTab === 'contas' && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-2xl shrink-0 shadow-xs">
                  📄
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Importação Manual 100% Privada
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white font-display">
                    Central de Extratos Bancários (OFX e CSV)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Importem extratos em formato <strong>OFX ou CSV</strong> diretamente dos seus bancos. O Juntô categoriza automaticamente pelos estabelecimentos, detecta assinaturas recorrentes e mantém todo o controle financeiro do casal no dispositivo sem intermediários externos.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddingAccount(true)}
                className="btn-primary-accent flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>Importar Extrato Agora</span>
              </button>
            </div>

            {/* Quick Metrics of Imported Statements */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total no Histórico
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {(state.bankImportedTransactions || []).length}
                </span>
                <span className="text-[11px] text-slate-500">
                  lançamentos importados
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                  Pendentes de Revisão
                </span>
                <span className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1 block">
                  {(state.bankImportedTransactions || []).filter(t => t.status === 'pending').length}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  aguardando sua confirmação
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Contas Reconhecidas
                </span>
                <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 block">
                  {new Set((state.bankImportedTransactions || []).map(t => t.accountId)).size || 1}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  instituições mapeadas
                </span>
              </div>
            </div>

            {/* Brazilian Bank Export Guide Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-600" />
                <span>Como baixar o extrato no seu banco (OFX ou CSV)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🟣</span> Nubank (Conta ou Cartão)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No app, abra a Conta &gt; Histórico &gt; Pedir extrato &gt; selecione <strong>OFX</strong> ou <strong>CSV</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🟠</span> Itaú &amp; Personalité
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No Internet Banking ou App, acesse Extrato &gt; Salvar em outros formatos &gt; <strong>OFX (Money)</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🟡</span> Banco do Brasil &amp; Bradesco
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No menu Extrato da conta corrente, escolha o período e clique em <strong>Salvar como OFX</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🟢</span> Santander, Inter &amp; BTG Pactual
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Na tela de extrato, use a opção de exportação de dados para arquivo <strong>OFX ou CSV</strong>.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

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
                  <MemberAvatar member="partner1" size={26} /> Modo {partner1Name}
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
                  <MemberAvatar member="partner2" size={26} /> Modo {partner2Name}
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
                  Os extratos bancários importados (OFX e CSV) são mapeados em tempo real por esta tabela de palavras-chave inteligentes e reconhecimento de assinaturas recorrentes.
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

          {/* CENTRAL DE NOTIFICAÇÕES PUSH E ALERTAS ESTRATÉGICOS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-emerald-500/30 shadow-md space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-black shrink-0">
                  🔔
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white font-display">
                      Central de Notificações Push & Alertas Estratégicos
                    </h3>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        getBrowserPermissionStatus() === 'granted'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : getBrowserPermissionStatus() === 'denied'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
                      }`}
                    >
                      {getBrowserPermissionStatus() === 'granted'
                        ? 'Permissão Concedida ✓'
                        : getBrowserPermissionStatus() === 'denied'
                        ? 'Permissão Bloqueada no Navegador 🔴'
                        : 'Permissão Pendente ⚠️'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Receba notificações nativas na tela de bloqueio do seu celular ou computador sem abrir o app.
                  </p>
                </div>
              </div>

              {/* Botões de Ação de Permissão e Teste */}
              <div className="flex items-center gap-2 flex-wrap">
                {getBrowserPermissionStatus() !== 'granted' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const status = await requestPushPermission();
                      updatePushSettings({ permissionStatus: status });
                      if (status === 'granted') {
                        triggerCelebration();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Ativar Notificações Push</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const sent = await sendTestNotification();
                    if (sent) {
                      setPushStatusMsg('Notificação de teste enviada com sucesso! 🔔');
                      triggerCelebration();
                    } else {
                      setPushStatusMsg('Ative a permissão de notificações no navegador primeiro.');
                    }
                    setTimeout(() => setPushStatusMsg(null), 4000);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Testar Notificação de Teste</span>
                </button>
              </div>
            </div>

            {/* STATUS FEEDBACK MSG */}
            {pushStatusMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{pushStatusMsg}</span>
              </div>
            )}

            {/* CONFIGURAÇÃO E TOGGLES GRANULARES */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                Escolham quais notificações o casal deseja receber:
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. LEMBRETE DO ALMOÇO (13:00) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🍽️</span>
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Lembrete Diário no Almoço (13:00)
                      </strong>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSettings.lunchReminderEnabled ?? true}
                        onChange={e => updatePushSettings({ lunchReminderEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Lembrete leve ao meio-dia para anotar cafés, almoços fora e refeições da rotina.
                  </p>
                </div>

                {/* 2. FECHAMENTO DO DIA & PLANTÕES (18:00 - Maior Prioridade) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🩺</span>
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Fechamento do Dia &amp; Plantões (18:00)
                      </strong>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSettings.dailyTriageEnabled}
                        onChange={e => updatePushSettings({ dailyTriageEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Resumo prioritário no fim da tarde para conferir gastos do dia, extratos importados e baixa em plantões médicos.
                  </p>
                </div>

                {/* 3. RESUMO SEMANAL */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Resumo Semanal (Domingos às 18:00)
                      </strong>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSettings.weeklySummaryEnabled}
                        onChange={e => updatePushSettings({ weeklySummaryEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Balanço dos acertos da semana e ritmo orçamentário enviado no horário ideal para o alinhamento do casal.
                  </p>
                </div>

                {/* 3. FECHAMENTO DO MÊS */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Fechamento do Mês (Último dia às 19:00)
                      </strong>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSettings.monthlySummaryEnabled}
                        onChange={e => updatePushSettings({ monthlySummaryEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Lembrete no último dia do mês para destinar sobras orçamentárias e aprovar o Guia de Aportes.
                  </p>
                </div>

                {/* 4. ALERTAS DE TETO DE CATEGORIA */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Alertas de Teto (80% / 100%) e Parcelas
                      </strong>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSettings.categoryAlertsEnabled}
                        onChange={e => updatePushSettings({ categoryAlertsEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Notifica imediatamente quando o casal se aproxima ou atinge o limite mensal de alguma categoria ou parcelas.
                  </p>
                </div>
              </div>
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
                Gere um convite de uso único ou insira o código do seu par para conectar os perfis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Seu Código de Convite */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                Seu convite de uso único:
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 py-3 px-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-500 text-center font-mono font-semibold text-xs break-all text-emerald-600 dark:text-emerald-400">
                  {coupleAccount?.inviteCode || 'Gere um convite abaixo'}
                </div>
                <button
                  disabled={!coupleAccount?.inviteCode}
                  onClick={() => {
                    navigator.clipboard.writeText(coupleAccount?.inviteCode || '');
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2500);
                  }}
                  className="p-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer"
                  title="Copiar código"
                >
                  {copiedInvite ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <button className="btn-outline w-full" onClick={async () => { try { await generateNewInviteCode(); setInviteFeedback('Convite gerado. Compartilhe apenas com seu par.'); } catch (cause) { setInviteFeedback(cause instanceof Error ? cause.message : 'Não foi possível gerar o convite.'); } }}><RefreshCw size={15} />Gerar novo convite</button>
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
                  maxLength={128}
                  value={inputInviteCode}
                  onChange={e => setInputInviteCode(e.target.value)}
                  placeholder="Cole o convite recebido"
                  aria-label="Código de convite do seu par"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-center"
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
      {isAddingAccount && <BankSyncModal isOpen={isAddingAccount} onClose={() => setIsAddingAccount(false)} />}
    </div>
  );
};
