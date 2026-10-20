import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navigation, ScreenId } from './components/Navigation';
import { HomeScreen } from './screens/HomeScreen';
import { FinancialCalendarScreen } from './screens/FinancialCalendarScreen';
import { CategoryDetailsScreen } from './screens/CategoryDetailsScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';
import { InstallmentsScreen } from './screens/InstallmentsScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { TrendsScreen } from './screens/TrendsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProjectionsScreen } from './screens/ProjectionsScreen';
import { ExpenseModal } from './components/modals/ExpenseModal';
import { IncomeModal } from './components/modals/IncomeModal';
import { InstallmentModal } from './components/modals/InstallmentModal';
import { DepositPiggyModal } from './components/modals/DepositPiggyModal';
import { BankSyncModal } from './components/BankSyncModal';
import { AuthModal } from './components/modals/AuthModal';
import { AIOnboardingModal } from './components/modals/AIOnboardingModal';
import { NotificationCenter } from './components/NotificationCenter';
import { GeminiChatDrawer } from './components/GeminiChatDrawer';
import { WeeklyPulseModal } from './components/modals/WeeklyPulseModal';
import { LandingScreen } from './screens/LandingScreen';
import { CategoryKey } from './types/finance';
import { buildWeeklyPulseData } from './utils/notificationEngine';

function MainApp() {
  const {
    state,
    currentUser,
    totalIncome,
    depositToProtection,
    depositToFreedom,
    depositToGoal,
  } = useFinance();
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey | undefined>(undefined);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDefaultCat, setExpenseDefaultCat] = useState<CategoryKey | undefined>(undefined);
  const [expenseDefaultDate, setExpenseDefaultDate] = useState<string | undefined>(undefined);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeDefaultDate, setIncomeDefaultDate] = useState<string | undefined>(undefined);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [depositPiggyId, setDepositPiggyId] = useState<string | null>(null);
  const [isBankSyncModalOpen, setIsBankSyncModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAIOnboardingOpen, setIsAIOnboardingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPulseModalOpen, setIsPulseModalOpen] = useState(false);

  // Listen to Service Worker push click events
  React.useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_OPENED') {
        const notifData = event.data.data;
        if (notifData?.type === 'weekly_pulse') {
          setIsPulseModalOpen(true);
        } else {
          setIsNotificationsOpen(true);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, []);

  if (!currentUser) {
    return <LandingScreen />;
  }

  const handleNavigate = (screen: ScreenId, categoryKey?: CategoryKey) => {
    setCurrentScreen(screen);
    if (categoryKey) {
      setSelectedCategoryKey(categoryKey);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenExpenseModal = (categoryKey?: CategoryKey, date?: string) => {
    setExpenseDefaultCat(categoryKey);
    setExpenseDefaultDate(date);
    setIsExpenseModalOpen(true);
  };

  const handleOpenIncomeModal = (date?: string) => {
    setIncomeDefaultDate(date);
    setIsIncomeModalOpen(true);
  };

  const selectedBank = state.piggyBanks.find(b => b.id === depositPiggyId) || null;

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#111317] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row font-sans transition-colors">
      {/* Sidebar on Desktop (lg+) and Top/Bottom Navigation on Mobile (<lg) */}
      <Navigation
        currentScreen={currentScreen}
        onSelectScreen={screen => handleNavigate(screen)}
        onOpenExpenseModal={() => handleOpenExpenseModal()}
        onOpenIncomeModal={() => handleOpenIncomeModal()}
        onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
        onOpenBankSyncModal={() => setIsBankSyncModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAIOnboardingModal={() => setIsAIOnboardingOpen(true)}
      />

      {/* Main Viewport Content Area (adjacent to desktop sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 pb-28 lg:pb-0 overflow-x-hidden relative">
        {/* Dynamic Environmental Aura Glow of the Active Life Tier */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-96 opacity-35 dark:opacity-25 blur-3xl -z-10 transition-all duration-1000"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -20%, var(--app-tier-glow, rgba(16,185,129,0.25)), transparent 75%)',
          }}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12">
          {currentScreen === 'home' && (
            <HomeScreen
              onNavigate={handleNavigate}
              onOpenExpenseModal={handleOpenExpenseModal}
              onOpenIncomeModal={() => handleOpenIncomeModal()}
              onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
              onOpenDepositModal={bankId => setDepositPiggyId(bankId)}
              onOpenAIOnboardingModal={() => setIsAIOnboardingOpen(true)}
              onOpenBankSyncModal={() => setIsBankSyncModalOpen(true)}
              onOpenWeeklyPulse={() => setIsPulseModalOpen(true)}
            />
          )}

          {currentScreen === 'calendar' && (
            <FinancialCalendarScreen
              onOpenExpenseModal={handleOpenExpenseModal}
              onOpenIncomeModal={handleOpenIncomeModal}
              onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
            />
          )}

          {currentScreen === 'categories' && (
            <CategoryDetailsScreen
              initialCategory={selectedCategoryKey}
              onOpenExpenseModal={handleOpenExpenseModal}
            />
          )}

          {currentScreen === 'transactions' && (
            <TransactionHistoryScreen
              onOpenExpenseModal={handleOpenExpenseModal}
            />
          )}

          {currentScreen === 'installments' && (
            <InstallmentsScreen
              onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
            />
          )}

          {currentScreen === 'goals' && (
            <GoalsScreen
              onOpenDepositModal={bankId => setDepositPiggyId(bankId)}
            />
          )}

          {currentScreen === 'trends' && <TrendsScreen />}

          {currentScreen === 'settings' && <SettingsScreen />}

          {currentScreen === 'projections' && <ProjectionsScreen />}
        </main>

        {/* Desktop Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>
            JUNTÔ — Finanças Inteligentes de Casal · O painel de controle simples, visual e acolhedor. 💕
          </p>
        </footer>
      </div>

      {/* Floating Gemini Chat Button on bottom-right for quick access (Mobile only; Desktop has it inside sidebar) */}
      <div className="lg:hidden fixed bottom-20 right-4 z-30">
        <button
          onClick={() => setIsChatOpen(true)}
          className="btn-primary-accent w-12 h-12 rounded-full text-white flex items-center justify-center text-xl shadow-xl active:scale-95 transition-all cursor-pointer"
          title="Falar com Dr. Finanças"
        >
          <span>💬</span>
        </button>
      </div>

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseDefaultDate(undefined);
        }}
        defaultCategory={expenseDefaultCat}
        defaultDate={expenseDefaultDate}
      />

      <IncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setIncomeDefaultDate(undefined);
        }}
        defaultDate={incomeDefaultDate}
      />

      <InstallmentModal
        isOpen={isInstallmentModalOpen}
        onClose={() => setIsInstallmentModalOpen(false)}
      />

      <DepositPiggyModal
        isOpen={!!depositPiggyId}
        onClose={() => setDepositPiggyId(null)}
        bank={selectedBank}
      />

      <BankSyncModal
        isOpen={isBankSyncModalOpen}
        onClose={() => setIsBankSyncModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenAIOnboardingModal={() => {
          setIsAuthModalOpen(false);
          setIsAIOnboardingOpen(true);
        }}
      />

      <AIOnboardingModal
        isOpen={isAIOnboardingOpen}
        onClose={() => setIsAIOnboardingOpen(false)}
      />

      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <WeeklyPulseModal
        isOpen={isPulseModalOpen}
        onClose={() => setIsPulseModalOpen(false)}
        pulseData={buildWeeklyPulseData(state, totalIncome)}
        onExecuteAction={(action) => {
          if (action.actionKey === 'deposit_protection') {
            depositToProtection(action.suggestedAmount || 200);
          } else if (action.actionKey === 'deposit_freedom') {
            depositToFreedom(action.suggestedAmount || 60);
          } else if (action.actionKey === 'deposit_goal' && action.targetId) {
            depositToGoal(action.targetId, action.suggestedAmount || 300);
          }
        }}
      />

      <GeminiChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <MainApp />
    </FinanceProvider>
  );
}
