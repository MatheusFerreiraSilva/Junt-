import React, { useState } from 'react';
import {
  Home,
  Stethoscope,
  Calendar,
  PieChart,
  CreditCard,
  Target,
  Settings,
  TrendingUp,
  BarChart2,
  Bell,
  Sparkles,
  Moon,
  Sun,
  Menu,
  X,
  ListFilter,
  Cloud,
  Plus,
  Coins,
  ChevronRight,
  Users,
} from 'lucide-react';
import { useFinance, ACCENT_THEMES } from '../context/FinanceContext';
import { JuntoLogo } from './JuntoLogo';

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

interface NavigationProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  onOpenExpenseModal: () => void;
  onOpenIncomeModal: () => void;
  onOpenInstallmentModal: () => void;
  onOpenBankSyncModal: () => void;
  onOpenNotifications: () => void;
  onOpenChat: () => void;
  onOpenAuthModal: () => void;
  onOpenAIOnboardingModal: () => void;
  onOpenStrategicIntentModal?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenInstallmentModal,
  onOpenBankSyncModal,
  onOpenNotifications,
  onOpenChat,
  onOpenAuthModal,
  onOpenAIOnboardingModal,
  onOpenStrategicIntentModal,
}) => {
  const {
    state,
    blownCategories,
    isInstallmentCommitmentHigh,
    unreadNotificationsCount,
    toggleThemeMode,
    isCloudSynced,
    viewMode,
    setViewMode,
    setAppMode,
  } = useFinance();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);

  const p1Short = state.profile.partner1Name?.trim().split(' ')[0] || 'Você';
  const p2Short = state.profile.partner2Name?.trim().split(' ')[0] || 'Par';

  const navItems: { id: ScreenId; label: string; icon: React.ReactNode; warning?: boolean; badge?: string }[] = [
    { id: 'home', label: 'Início', icon: <Home className="w-4 h-4 shrink-0" /> },
    {
      id: 'couple_hub',
      label: 'Nosso espaço',
      icon: <Users className="w-4 h-4 shrink-0 text-rose-500" />,

    },
    {
      id: 'calendar',
      label: 'Calendário',
      icon: <Calendar className="w-4 h-4 shrink-0" />,

    },
    {
      id: 'categories',
      label: 'Gastos',
      icon: <PieChart className="w-4 h-4 shrink-0" />,
      warning: blownCategories.length > 0,
    },
    { id: 'transactions', label: 'Extrato', icon: <ListFilter className="w-4 h-4 shrink-0" /> },
    {
      id: 'installments',
      label: 'Parcelas',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
      warning: isInstallmentCommitmentHigh,
    },
    { id: 'goals', label: 'Investimentos', icon: <Target className="w-4 h-4 shrink-0" /> },
    {
      id: 'shifts',
      label: 'Plantões',
      icon: <Stethoscope className="w-4 h-4 shrink-0" />,
    },
    { id: 'trends', label: 'Tendências', icon: <BarChart2 className="w-4 h-4 shrink-0" /> },
    { id: 'projections', label: 'Projeções', icon: <TrendingUp className="w-4 h-4 shrink-0" /> },
    { id: 'settings', label: 'Ajustes', icon: <Settings className="w-4 h-4 shrink-0" /> },
  ];

  const handleMobileNav = (id: ScreenId) => {
    onSelectScreen(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR NAVIGATION (Visible on screens >= lg)                      */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 shrink-0 border-r border-[#E8E2D8] dark:border-slate-800 bg-[#FAF7F2] dark:bg-[#111318] z-40 transition-colors">
        {/* Sidebar Header: Logo & Couple Identity */}
        <div className="p-4 xl:p-5 border-b border-[#E8E2D8] dark:border-slate-800 space-y-3 shrink-0">
          <button
            onClick={() => onSelectScreen('home')}
            className="flex items-center gap-2 text-left focus:outline-none w-full group cursor-pointer"
          >
            <JuntoLogo size={32} variant="horizontal" className="group-hover:scale-[1.02] transition-transform" />
          </button>

          {/* Couple Badge */}
          <div className="flex items-center justify-between gap-1 text-xs font-bold bg-white dark:bg-slate-800 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[#111318] dark:text-slate-100 truncate max-w-[85px] font-extrabold">
              {state.profile.partner1Name}
            </span>
            <span className="text-rose-500 font-black shrink-0">❤</span>
            <span className="text-[#111318] dark:text-slate-100 truncate max-w-[85px] font-extrabold">
              {state.profile.partner2Name === 'Aguardando Par...' ? 'Convide o Par' : state.profile.partner2Name}
            </span>
            {state.profile.city && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 ml-1 font-semibold">
                📍 {state.profile.city.split('-')[0].trim()}
              </span>
            )}
          </div>

          {/* View Mode Segmented Switcher (Casal vs Pessoa 1 vs Pessoa 2) */}
          <div className="grid grid-cols-3 items-center p-1 bg-[#EFE9DF] dark:bg-slate-800 rounded-2xl border border-[#E0D8CB] dark:border-slate-700 shadow-inner h-9">
            <button
              onClick={() => setViewMode('couple')}
              className={`h-full flex items-center justify-center gap-1 rounded-xl text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'couple'
                  ? 'bg-[#111318] text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white'
              }`}
              title="Visão Integrada do Casal"
            >
              <span>👥</span>
              <span className="truncate">Casal</span>
            </button>

            <button
              onClick={() => setViewMode('partner1')}
              className={`h-full flex items-center justify-center gap-1 rounded-xl text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'partner1'
                  ? 'bg-[#111318] text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white'
              }`}
              title={`Ver apenas ${state.profile.partner1Name}`}
            >
              <span>👩</span>
              <span className="truncate">{p1Short}</span>
            </button>

            <button
              onClick={() => setViewMode('partner2')}
              className={`h-full flex items-center justify-center gap-1 rounded-xl text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'partner2'
                  ? 'bg-[#111318] text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white'
              }`}
              title={`Ver apenas ${state.profile.partner2Name}`}
            >
              <span>👨</span>
              <span className="truncate">{p2Short}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 xl:px-4 py-3 space-y-1">
          <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 pb-1.5">
            Menu
          </div>

          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectScreen(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#111318] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-[#111318] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#D8C7FF] text-[#111318]">
                      {item.badge}
                    </span>
                  )}
                  {item.warning && (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Quick Actions Header */}
          <div className="pt-4 pb-1">
            <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 pb-1.5">
              Registro Rápido
            </div>

            {/* Primary Action Button: Gastei */}
            <button
              onClick={onOpenExpenseModal}
              className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-black bg-[#111318] text-white shadow-md active:scale-95 transition-all cursor-pointer mt-1"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar gasto</span>
            </button>

            {/* Secondary Action Row: Ganhei & Parcela */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={onOpenIncomeModal}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-2xl text-xs font-black bg-[#B8E0B0]/40 dark:bg-emerald-950/60 hover:bg-[#B8E0B0]/70 text-[#111318] dark:text-emerald-200 border border-[#B8E0B0] dark:border-emerald-700 transition-colors cursor-pointer"
              >
                <Coins className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>+ Recebi</span>
              </button>

              <button
                onClick={onOpenInstallmentModal}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-2xl text-xs font-black bg-[#FFC875]/40 dark:bg-amber-950/60 hover:bg-[#FFC875]/70 text-[#111318] dark:text-amber-200 border border-[#FFC875] dark:border-amber-700 transition-colors cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>+ Parcelei</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer & Utilities */}
        <div className="p-3 xl:p-4 border-t border-[#E8E2D8] dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-2 shrink-0">
          {/* Cloud Nuvem Sincronizada / Entrar */}
          <button
            onClick={onOpenAuthModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
              isCloudSynced
                ? 'bg-[#B8E0B0]/30 text-emerald-900 dark:text-emerald-300 border-[#B8E0B0]'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cloud className={`w-4 h-4 ${isCloudSynced ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="truncate">{isCloudSynced ? 'Nuvem Conectada' : 'Entrar / Sincronizar'}</span>
            </div>
            <span className="text-[10px]">{isCloudSynced ? '☁️' : '🔒'}</span>
          </button>

          {/* AI Assistants & Open Finance Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onOpenChat}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-[#111318] text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer"
              title="Falar com Dr. Finanças"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Dr. Finanças</span>
            </button>

            <button
              onClick={onOpenBankSyncModal}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-[#D8C7FF]/40 text-[#111318] text-[11px] font-bold border border-[#D8C7FF] transition-colors cursor-pointer"
              title="Open Finance"
            >
              <span>🏦</span>
              <span>Bancos</span>
            </button>
          </div>

          {/* Bottom Utility Icons: Notifications & Theme Mode */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onOpenAIOnboardingModal}
              className="text-[11px] font-bold text-slate-500 hover:text-[#111318] dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Onboarding</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={onOpenNotifications}
                className="relative w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Central de Alertas"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                onClick={toggleThemeMode}
                className="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {state.profile.themeMode === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE TOP HEADER BAR (< lg)                                              */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#FAF7F2]/95 dark:bg-[#111318]/95 backdrop-blur-md border-b border-[#E8E2D8] dark:border-slate-800 transition-colors">
        <div className="px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectScreen('home')}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              <JuntoLogo size={28} variant="horizontal" />
            </button>
          </div>

          {/* Quick Status and Theme */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSelectScreen('shifts')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                currentScreen === 'shifts'
                  ? 'bg-[#111318] text-white border-[#111318] dark:bg-teal-600 dark:border-teal-500'
                  : 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-100'
              }`}
              title="Gestão de Plantões Médicos"
            >
              <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-300" />
              <span className="font-extrabold">Plantões</span>
            </button>

            <button
              onClick={onOpenAuthModal}
              className="p-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Nuvem"
            >
              <Cloud className={`w-4 h-4 ${isCloudSynced ? 'text-emerald-600' : 'text-slate-400'}`} />
            </button>

            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Alertas"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={toggleThemeMode}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {state.profile.themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* FLOATING DARK BOTTOM BAR (Capsule in Charcoal #111318 with Magic Button +)*/}
      {/* ========================================================================= */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-4 sm:max-w-md sm:mx-auto z-40 floating-dark-bar p-1.5 transition-all"
      >
        <div className="grid grid-cols-5 items-center h-14 relative">
          {/* 1. Início */}
          <button
            onClick={() => onSelectScreen('home')}
            className={`flex flex-col items-center justify-center py-1 select-none min-h-[44px] cursor-pointer transition-all ${
              currentScreen === 'home'
                ? 'text-white font-black scale-105'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <Home className="w-4 h-4 stroke-[2.5]" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate">Início</span>
          </button>

          {/* 2. Calendário */}
          <button
            onClick={() => onSelectScreen('calendar')}
            className={`flex flex-col items-center justify-center py-1 select-none min-h-[44px] cursor-pointer transition-all ${
              currentScreen === 'calendar'
                ? 'text-white font-black scale-105'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <Calendar className="w-4 h-4 stroke-[2.5]" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate">Agenda</span>
          </button>

          {/* 3. BOTÃO MÁGICO CENTRAL ELEVADO (+) */}
          <div className="flex items-center justify-center relative -top-3">
            <button
              type="button"
              onClick={() => setIsQuickActionModalOpen(true)}
              className="floating-magic-button w-13 h-13 rounded-full flex items-center justify-center font-black text-2xl shadow-xl active:scale-90 transition-all cursor-pointer ring-4 ring-[#FAF7F2] dark:ring-[#111318]"
              title="Registro Rápido: Gastei, Recebi, Parcelei"
              aria-label="Abrir registro rápido"
            >
              <Plus className="w-6 h-6 stroke-[3.5] text-[#111318]" />
            </button>
          </div>

          {/* 4. Gastos */}
          <button
            onClick={() => onSelectScreen('categories')}
            className={`flex flex-col items-center justify-center py-1 select-none min-h-[44px] cursor-pointer transition-all ${
              currentScreen === 'categories'
                ? 'text-white font-black scale-105'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <div className="relative">
              <PieChart className="w-4 h-4 stroke-[2.5]" />
              {blownCategories.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 truncate">Gastos</span>
          </button>

          {/* 5. Mais */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1 select-none min-h-[44px] cursor-pointer transition-all ${
              currentScreen === 'goals' ||
              currentScreen === 'shifts' ||
              currentScreen === 'trends' ||
              currentScreen === 'projections' ||
              currentScreen === 'installments' ||
              currentScreen === 'transactions' ||
              currentScreen === 'settings'
                ? 'text-white font-black scale-105'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            <Menu className="w-4 h-4 stroke-[2.5]" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate">Mais</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* QUICK ACTION SHEET MODAL: GASTEI / RECEBI / PARCELEI                      */}
      {/* ========================================================================= */}
      {isQuickActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm clay-card p-6 bg-white dark:bg-slate-900 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-black text-[#111318] dark:text-white text-sm font-display">
                O que você quer registrar agora?
              </span>
              <button
                onClick={() => setIsQuickActionModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: GASTEI */}
              <button
                onClick={() => {
                  setIsQuickActionModalOpen(false);
                  onOpenExpenseModal();
                }}
                className="w-full p-4 rounded-2xl bg-[#FFF9ED] dark:bg-amber-950/40 border-2 border-[#FFC875] dark:border-amber-700/60 flex items-center justify-between text-left hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-[#FFC875] text-[#111318] flex items-center justify-center text-xl font-black shrink-0">
                    💸
                  </span>
                  <div>
                    <h4 className="font-black text-sm text-[#111318] dark:text-white">Gastei</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Despesa à vista, mercado ou delivery</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 2: RECEBI */}
              <button
                onClick={() => {
                  setIsQuickActionModalOpen(false);
                  onOpenIncomeModal();
                }}
                className="w-full p-4 rounded-2xl bg-[#F3FAF1] dark:bg-emerald-950/40 border-2 border-[#B8E0B0] dark:border-emerald-700/60 flex items-center justify-between text-left hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-[#B8E0B0] text-[#111318] flex items-center justify-center text-xl font-black shrink-0">
                    💰
                  </span>
                  <div>
                    <h4 className="font-black text-sm text-[#111318] dark:text-white">Recebi</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Bolsa, ajuda familiar, salário ou renda extra</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-700 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 3: PARCELEI */}
              <button
                onClick={() => {
                  setIsQuickActionModalOpen(false);
                  onOpenInstallmentModal();
                }}
                className="w-full p-4 rounded-2xl bg-[#F6F2FF] dark:bg-purple-950/40 border-2 border-[#D8C7FF] dark:border-purple-700/60 flex items-center justify-between text-left hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-[#D8C7FF] text-[#111318] flex items-center justify-center text-xl font-black shrink-0">
                    💳
                  </span>
                  <div>
                    <h4 className="font-black text-sm text-[#111318] dark:text-white">Parcelei</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Compra parcelada no cartão (teto 20%)</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-700 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 4: GASTO ESTRATÉGICO (Alocação Proativa de Reserva/Caixinha) */}
              <button
                onClick={() => {
                  setIsQuickActionModalOpen(false);
                  onOpenStrategicIntentModal?.();
                }}
                className="w-full p-4 rounded-2xl bg-[#F0F8FF] dark:bg-sky-950/40 border-2 border-[#A6D8FF] dark:border-sky-700/60 flex items-center justify-between text-left hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-[#A6D8FF] text-[#111318] flex items-center justify-center text-xl font-black shrink-0">
                    🎯
                  </span>
                  <div>
                    <h4 className="font-black text-sm text-[#111318] dark:text-white">Gasto Estratégico</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Planejar compra prévia da Reserva ou Caixinha (blindado)</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sky-700 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE "MAIS" DRAWER BOTTOM SHEET                                         */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full bg-[#FAF7F2] dark:bg-[#111318] rounded-t-3xl p-5 border-t border-[#E8E2D8] dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-black text-[#111318] dark:text-white text-sm font-display">
                Explore seu Juntô
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleMobileNav('couple_hub')}
                className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-700 flex flex-col items-center text-center gap-1.5 col-span-2 shadow-xs cursor-pointer active:scale-98 transition-transform"
              >
                <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-extrabold text-sm">
                  <Users className="w-5 h-5 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
                  <span>Hub do Casal</span>
                  <span className="text-[10px] bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 px-2 py-0.5 rounded-full font-black uppercase"></span>
                </div>
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                  Metas, prioridades e contas de vocês
                </span>
              </button>

              <button
                onClick={() => handleMobileNav('shifts')}
                className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/70 border-2 border-teal-300 dark:border-teal-700 flex flex-col items-center text-center gap-1.5 col-span-2 shadow-xs cursor-pointer active:scale-98 transition-transform"
              >
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 font-extrabold text-sm">
                  <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-300 stroke-[2.5]" />
                  <span>Plantões Médicos</span>
                  <span className="text-[10px] bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 px-2 py-0.5 rounded-full font-black uppercase">Novo</span>
                </div>
                <span className="text-[11px] text-teal-700 dark:text-teal-300 font-medium">
                  Controle de escalas, previsão de recebimentos &amp; conciliação bancária
                </span>
              </button>

              <button
                onClick={() => handleMobileNav('goals')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <Target className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Investimentos</span>
                <span className="text-[10px] text-slate-500">Metas &amp; 3 Blocos</span>
              </button>

              <button
                onClick={() => handleMobileNav('installments')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Parcelas</span>
                <span className="text-[10px] text-slate-500">Teto inteligente 20%</span>
              </button>

              <button
                onClick={() => handleMobileNav('transactions')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <ListFilter className="w-5 h-5 text-sky-600" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Extrato</span>
                <span className="text-[10px] text-slate-500">Histórico completo</span>
              </button>

              <button
                onClick={() => handleMobileNav('trends')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <BarChart2 className="w-5 h-5 text-purple-600" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Tendências</span>
                <span className="text-[10px] text-slate-500">Análise histórica</span>
              </button>

              <button
                onClick={() => handleMobileNav('projections')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Projeções</span>
                <span className="text-[10px] text-slate-500">Futuro 5 a 30 anos</span>
              </button>

              <button
                onClick={() => handleMobileNav('settings')}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                <span className="font-bold text-xs text-[#111318] dark:text-white">Ajustes</span>
                <span className="text-[10px] text-slate-500">Cores &amp; perfis</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenBankSyncModal();
                }}
                className="p-3.5 rounded-2xl bg-[#D8C7FF]/40 border border-[#D8C7FF] flex flex-col items-center text-center gap-1.5 col-span-2"
              >
                <span className="text-xl">🏦</span>
                <span className="font-bold text-xs text-[#111318] dark:text-white">Open Finance Pluggy</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400">Conecte e revise seus lançamentos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
