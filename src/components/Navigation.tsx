import React, { useState } from 'react';
import {
  Home,
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
  | 'projections';

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

  const p1Short = state.profile.partner1Name?.trim().split(' ')[0] || 'Você';
  const p2Short = state.profile.partner2Name?.trim().split(' ')[0] || 'Par';

  const navItems: { id: ScreenId; label: string; icon: React.ReactNode; warning?: boolean; badge?: string }[] = [
    { id: 'home', label: 'Início', icon: <Home className="w-4 h-4 shrink-0" /> },
    {
      id: 'calendar',
      label: 'Calendário',
      icon: <Calendar className="w-4 h-4 shrink-0" />,
      badge: 'Geral',
    },
    {
      id: 'categories',
      label: 'Gastos',
      icon: <PieChart className="w-4 h-4 shrink-0" />,
      warning: blownCategories.length > 0,
    },
    { id: 'transactions', label: 'Histórico', icon: <ListFilter className="w-4 h-4 shrink-0" /> },
    {
      id: 'installments',
      label: 'Parcelas',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
      warning: isInstallmentCommitmentHigh,
    },
    { id: 'goals', label: 'Investimentos', icon: <Target className="w-4 h-4 shrink-0" /> },
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
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 shrink-0 border-r-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md z-40 transition-colors">
        {/* Top Ambient Profile Glow Line */}
        <div
          className="h-1.5 w-full shrink-0 transition-all duration-500 shadow-xs"
          style={{
            background: 'linear-gradient(90deg, var(--app-accent-gradient-from), var(--app-accent-primary), var(--app-accent-gradient-to))',
          }}
        />

        {/* Sidebar Header: Logo & Couple Identity */}
        <div className="p-4 xl:p-5 border-b-2 border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
          <button
            onClick={() => onSelectScreen('home')}
            className="flex items-center gap-2 text-left focus:outline-none w-full group cursor-pointer"
          >
            <JuntoLogo size={32} variant="horizontal" className="group-hover:scale-[1.02] transition-transform" />
          </button>

          {/* Couple Badge */}
          <div className="flex items-center justify-between gap-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-2xs">
            <span className="text-slate-900 dark:text-slate-100 truncate max-w-[85px] font-extrabold">
              {state.profile.partner1Name}
            </span>
            <span className="text-rose-500 font-black shrink-0">❤</span>
            <span className="text-slate-900 dark:text-slate-100 truncate max-w-[85px] font-extrabold">
              {state.profile.partner2Name === 'Aguardando Par...' ? 'Convide o Par' : state.profile.partner2Name}
            </span>
            {state.profile.city && (
              <span className="text-[11px] text-slate-600 dark:text-slate-400 shrink-0 ml-1 font-semibold">
                📍 {state.profile.city.split('-')[0].trim()}
              </span>
            )}
          </div>

          {/* View Mode Segmented Switcher (Casal vs Pessoa 1 vs Pessoa 2) */}
          <div className="grid grid-cols-3 items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-inner h-9">
            <button
              onClick={() => setViewMode('couple')}
              className={`h-full flex items-center justify-center gap-1 rounded-lg text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'couple'
                  ? 'text-white shadow-md'
                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
              style={
                viewMode === 'couple'
                  ? {
                      backgroundColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].hex,
                      boxShadow: `0 2px 8px ${ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].hex}50`,
                    }
                  : {}
              }
              title="Visão Integrada do Casal"
            >
              <span>👥</span>
              <span className="truncate">Casal</span>
            </button>

            <button
              onClick={() => setViewMode('partner1')}
              className={`h-full flex items-center justify-center gap-1 rounded-lg text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'partner1'
                  ? 'text-white shadow-md'
                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
              style={
                viewMode === 'partner1'
                  ? {
                      backgroundColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].hex,
                      boxShadow: `0 2px 8px ${ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].hex}50`,
                    }
                  : {}
              }
              title={`Ver apenas ${state.profile.partner1Name}`}
            >
              <span>👩</span>
              <span className="truncate">{p1Short}</span>
            </button>

            <button
              onClick={() => setViewMode('partner2')}
              className={`h-full flex items-center justify-center gap-1 rounded-lg text-xs font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                viewMode === 'partner2'
                  ? 'text-white shadow-md'
                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
              style={
                viewMode === 'partner2'
                  ? {
                      backgroundColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].hex,
                      boxShadow: `0 2px 8px ${ACCENT_THEMES[state.profile.partner2Theme || 'rose'].hex}50`,
                    }
                  : {}
              }
              title={`Ver apenas ${state.profile.partner2Name}`}
            >
              <span>👨</span>
              <span className="truncate">{p2Short}</span>
            </button>
          </div>

          {/* Modo Faculdade Pill Switcher */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAppMode(state.appMode === 'faculdade' ? 'casal' : 'faculdade')}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-extrabold border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                state.appMode === 'faculdade'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span>🎓</span>
              <span>{state.appMode === 'faculdade' ? 'Modo Faculdade Ativo' : 'Ativar Modo Faculdade'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 xl:px-4 py-3 space-y-1">
          <div className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider px-2 pb-1.5">
            Navegação Principal
          </div>

          {navItems.map(item => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectScreen(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent-surface text-accent-themed border-2 border-accent-themed shadow-xs'
                    : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
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
            <div className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider px-2 pb-1.5">
              Ações Rápidas
            </div>
            
            {/* Primary Action Button: Gastei */}
            <button
              onClick={onOpenExpenseModal}
              className="w-full btn-primary-accent flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer mt-1"
            >
              <span>➕</span>
              <span>NOVO GASTO</span>
            </button>

            {/* Secondary Action Row: Ganhei & Parcela */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={onOpenIncomeModal}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-950 dark:text-emerald-200 border-2 border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer shadow-2xs"
              >
                <Coins className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>+ Ganhei</span>
              </button>

              <button
                onClick={onOpenInstallmentModal}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-950 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 transition-colors cursor-pointer shadow-2xs"
              >
                <CreditCard className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>+ Parcela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer & Utilities */}
        <div className="p-3 xl:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/70 space-y-2 shrink-0">
          {/* Cloud Nuvem Sincronizada / Entrar */}
          <button
            onClick={onOpenAuthModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isCloudSynced
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cloud className={`w-4 h-4 ${isCloudSynced ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
              <span className="truncate">{isCloudSynced ? 'Nuvem Ativa' : 'Entrar / Sincronizar'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{isCloudSynced ? '☁️' : '🔒'}</span>
          </button>

          {/* AI Assistants & Open Finance Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onOpenChat}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
              title="Falar com Dr. Finanças"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Dr. Finanças</span>
            </button>

            <button
              onClick={onOpenBankSyncModal}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-300 text-[11px] font-bold border border-purple-200/80 dark:border-purple-800 transition-colors cursor-pointer"
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
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              title="Refazer IA Onboarding"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Onboarding</span>
            </button>

            <div className="flex items-center gap-1">
              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className="relative w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Central de Alertas"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleThemeMode}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={state.profile.themeMode === 'dark' ? 'Mudar para fundo claro' : 'Mudar para fundo escuro'}
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
      {/* MOBILE TOP HEADER NAVIGATION BAR (Visible only on < lg)                   */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        {/* Top Ambient Profile Glow Line */}
        <div
          className="h-1 w-full transition-all duration-500 shrink-0 shadow-xs"
          style={{
            background: 'linear-gradient(90deg, var(--app-accent-gradient-from), var(--app-accent-primary), var(--app-accent-gradient-to))',
          }}
        />

        <div className="px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Brand Logo & Couple Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => onSelectScreen('home')}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              <JuntoLogo size={28} variant="horizontal" />
            </button>
          </div>

          {/* Quick Actions on Mobile Header */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cloud Nuvem Sincronizada / Entrar */}
            <button
              onClick={onOpenAuthModal}
              className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                isCloudSynced
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Conta do Casal e Sincronização em Nuvem"
            >
              <Cloud className={`w-4 h-4 ${isCloudSynced ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
              title="Central de Alertas"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleThemeMode}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
            >
              {state.profile.themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* GASTEI Button */}
            <button
              onClick={onOpenExpenseModal}
              className="btn-primary-accent flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span>➕</span>
              <span>GASTEI</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-bar: Casal vs Pessoa 1 vs Pessoa 2 */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/80 py-1.5 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="grid grid-cols-3 items-center p-0.5 bg-slate-200/80 dark:bg-slate-850 rounded-xl border border-slate-300/60 dark:border-slate-700 shadow-inner w-full max-w-xs h-8">
              <button
                onClick={() => setViewMode('couple')}
                className={`h-full flex items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                  viewMode === 'couple'
                    ? 'text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                style={
                  viewMode === 'couple'
                    ? {
                        backgroundColor: ACCENT_THEMES[state.profile.coupleTheme || 'emerald'].hex,
                      }
                    : {}
                }
              >
                <span>👥</span>
                <span>Casal</span>
              </button>

              <button
                onClick={() => setViewMode('partner1')}
                className={`h-full flex items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                  viewMode === 'partner1'
                    ? 'text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                style={
                  viewMode === 'partner1'
                    ? {
                        backgroundColor: ACCENT_THEMES[state.profile.partner1Theme || 'sapphire'].hex,
                      }
                    : {}
                }
              >
                <span>👩</span>
                <span className="truncate">{p1Short}</span>
              </button>

              <button
                onClick={() => setViewMode('partner2')}
                className={`h-full flex items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-all text-center select-none active:scale-95 cursor-pointer ${
                  viewMode === 'partner2'
                    ? 'text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                style={
                  viewMode === 'partner2'
                    ? {
                        backgroundColor: ACCENT_THEMES[state.profile.partner2Theme || 'rose'].hex,
                      }
                    : {}
                }
              >
                <span>👨</span>
                <span className="truncate">{p2Short}</span>
              </button>
            </div>

            <button
              onClick={() => setAppMode(state.appMode === 'faculdade' ? 'casal' : 'faculdade')}
              className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all shrink-0 cursor-pointer ${
                state.appMode === 'faculdade'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>🎓 {state.appMode === 'faculdade' ? 'Faculdade' : 'Facul'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE FLOATING ROUNDED TAB BAR WITH SMOOTH ANIMATED TAB SWITCHING        */}
      {/* ========================================================================= */}
      {(() => {
        const isMoreActive =
          currentScreen === 'goals' ||
          currentScreen === 'trends' ||
          currentScreen === 'projections' ||
          currentScreen === 'settings';

        const activeTabIndex =
          currentScreen === 'home'
            ? 0
            : currentScreen === 'calendar'
            ? 1
            : currentScreen === 'categories'
            ? 2
            : currentScreen === 'transactions'
            ? 3
            : currentScreen === 'installments'
            ? 4
            : isMoreActive
            ? 5
            : 0;

        return (
          <nav
            aria-label="Navegação inferior mobile"
            className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-6 sm:max-w-md sm:mx-auto z-40 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-800/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.2)] dark:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.65)] p-1.5 transition-all"
          >
            <div className="relative grid grid-cols-6 items-center h-14">
              {/* Sliding Active Pill Indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700/80 shadow-xs transition-all duration-300 ease-out pointer-events-none"
                style={{
                  left: `${(activeTabIndex * 100) / 6}%`,
                  width: `${100 / 6}%`,
                }}
              >
                <div
                  className="absolute bottom-1 inset-x-3 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--app-accent-primary)' }}
                />
              </div>

              {/* 1. Início */}
              <button
                onClick={() => onSelectScreen('home')}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  currentScreen === 'home'
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={currentScreen === 'home' ? { color: 'var(--app-accent-text)' } : {}}
              >
                <Home className="w-4 h-4 stroke-[2.5]" />
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Início</span>
              </button>

              {/* 2. Calendário */}
              <button
                onClick={() => onSelectScreen('calendar')}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  currentScreen === 'calendar'
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={currentScreen === 'calendar' ? { color: 'var(--app-accent-text)' } : {}}
              >
                <Calendar className="w-4 h-4 stroke-[2.5]" />
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Agenda</span>
              </button>

              {/* 3. Gastos */}
              <button
                onClick={() => onSelectScreen('categories')}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  currentScreen === 'categories'
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={currentScreen === 'categories' ? { color: 'var(--app-accent-text)' } : {}}
              >
                <div className="relative">
                  <PieChart className="w-4 h-4 stroke-[2.5]" />
                  {blownCategories.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Gastos</span>
              </button>

              {/* 4. Histórico */}
              <button
                onClick={() => onSelectScreen('transactions')}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  currentScreen === 'transactions'
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={currentScreen === 'transactions' ? { color: 'var(--app-accent-text)' } : {}}
              >
                <ListFilter className="w-4 h-4 stroke-[2.5]" />
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Extrato</span>
              </button>

              {/* 5. Parcelas */}
              <button
                onClick={() => onSelectScreen('installments')}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  currentScreen === 'installments'
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={currentScreen === 'installments' ? { color: 'var(--app-accent-text)' } : {}}
              >
                <div className="relative">
                  <CreditCard className="w-4 h-4 stroke-[2.5]" />
                  {isInstallmentCommitmentHigh && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Parcelas</span>
              </button>

              {/* 6. Mais Drawer */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`relative z-10 flex flex-col items-center justify-center py-1 transition-all duration-200 select-none min-h-[44px] cursor-pointer ${
                  isMoreActive
                    ? 'scale-105 font-black'
                    : 'text-slate-600 dark:text-slate-400 font-bold hover:text-slate-950 dark:hover:text-white'
                }`}
                style={isMoreActive ? { color: 'var(--app-accent-text)' } : {}}
              >
                <Menu className="w-4 h-4 stroke-[2.5]" />
                <span className="text-[11px] tracking-tight mt-0.5 truncate">Mais</span>
              </button>
            </div>
          </nav>
        );
      })()}

      {/* ========================================================================= */}
      {/* MOBILE "MAIS" DRAWER BOTTOM SHEET                                         */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-black text-slate-900 dark:text-white text-sm">
                Recursos Adicionais do Casal
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleMobileNav('goals')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Investimentos</span>
                <span className="text-[10px] text-slate-400">Metas & 3 Blocos</span>
              </button>

              <button
                onClick={() => handleMobileNav('trends')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Tendências</span>
                <span className="text-[10px] text-slate-400">Análise histórica</span>
              </button>

              <button
                onClick={() => handleMobileNav('projections')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Projeções</span>
                <span className="text-[10px] text-slate-400">Futuro 5 a 30 anos</span>
              </button>

              <button
                onClick={() => handleMobileNav('settings')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-1.5"
              >
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Ajustes</span>
                <span className="text-[10px] text-slate-400">Cores, perfis & temas</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenIncomeModal();
                }}
                className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center text-center gap-1.5"
              >
                <Coins className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">Nova Receita</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Lançar ganho</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenInstallmentModal();
                }}
                className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col items-center text-center gap-1.5"
              >
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-xs text-amber-900 dark:text-amber-200">Nova Parcela</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400">Compra parcelada</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenBankSyncModal();
                }}
                className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col items-center text-center gap-1.5"
              >
                <span className="text-xl">🏦</span>
                <span className="font-bold text-xs text-purple-900 dark:text-purple-200">Open Finance</span>
                <span className="text-[10px] text-purple-700 dark:text-purple-400">Sincronizar bancos</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenChat();
                }}
                className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col items-center text-center gap-1.5"
              >
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-xs">Dr. Finanças</span>
                <span className="text-[10px] text-slate-300">Assistente IA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
