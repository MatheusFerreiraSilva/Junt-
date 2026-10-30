import { AvatarProvider } from './avatars/AvatarProvider';
import { AvatarEditorOutlet } from './avatars/AvatarUI';
import { lazy, Suspense, useEffect, useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navigation, ScreenId } from './components/Navigation';
import { LandingScreen } from './screens/LandingScreen';
import { CategoryKey } from './types/finance';
import { buildWeeklyPulseData } from './utils/notificationEngine';

// Route-level code splitting: each screen becomes its own chunk and is only
// downloaded when the user navigates to it. Home stays eager because it is the
// default tab and the most common first paint after login.
import { HomeScreen } from './screens/HomeScreen';

const FinancialCalendarScreen = lazy(() =>
  import('./screens/FinancialCalendarScreen').then((m) => ({
    default: m.FinancialCalendarScreen,
  }))
);
const CategoryDetailsScreen = lazy(() =>
  import('./screens/CategoryDetailsScreen').then((m) => ({
    default: m.CategoryDetailsScreen,
  }))
);
const TransactionHistoryScreen = lazy(() =>
  import('./screens/TransactionHistoryScreen').then((m) => ({
    default: m.TransactionHistoryScreen,
  }))
);
const InstallmentsScreen = lazy(() =>
  import('./screens/InstallmentsScreen').then((m) => ({
    default: m.InstallmentsScreen,
  }))
);
const GoalsScreen = lazy(() =>
  import('./screens/GoalsScreen').then((m) => ({ default: m.GoalsScreen }))
);
const TrendsScreen = lazy(() =>
  import('./screens/TrendsScreen').then((m) => ({ default: m.TrendsScreen }))
);
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const MedicalShiftsScreen = lazy(() =>
  import('./screens/MedicalShiftsScreen').then((m) => ({
    default: m.MedicalShiftsScreen,
  }))
);
const ProjectionsScreen = lazy(() =>
  import('./screens/ProjectionsScreen').then((m) => ({
    default: m.ProjectionsScreen,
  }))
);
const CoupleHubScreen = lazy(() =>
  import('./screens/CoupleHubScreen').then((m) => ({
    default: m.CoupleHubScreen,
  }))
);

// Modals are also split: most users open only a couple of them per session.
const ExpenseModal = lazy(() =>
  import('./components/modals/ExpenseModal').then((m) => ({
    default: m.ExpenseModal,
  }))
);
const IncomeModal = lazy(() =>
  import('./components/modals/IncomeModal').then((m) => ({
    default: m.IncomeModal,
  }))
);
const InstallmentModal = lazy(() =>
  import('./components/modals/InstallmentModal').then((m) => ({
    default: m.InstallmentModal,
  }))
);
const DepositPiggyModal = lazy(() =>
  import('./components/modals/DepositPiggyModal').then((m) => ({
    default: m.DepositPiggyModal,
  }))
);
const BankSyncModal = lazy(() =>
  import('./components/BankSyncModal').then((m) => ({
    default: m.BankSyncModal,
  }))
);
const AuthModal = lazy(() =>
  import('./components/modals/AuthModal').then((m) => ({
    default: m.AuthModal,
  }))
);
const AIOnboardingModal = lazy(() =>
  import('./components/modals/AIOnboardingModal').then((m) => ({
    default: m.AIOnboardingModal,
  }))
);
const NotificationCenter = lazy(() =>
  import('./components/NotificationCenter').then((m) => ({
    default: m.NotificationCenter,
  }))
);
const GeminiChatDrawer = lazy(() =>
  import('./components/GeminiChatDrawer').then((m) => ({
    default: m.GeminiChatDrawer,
  }))
);
const WeeklyPulseModal = lazy(() =>
  import('./components/modals/WeeklyPulseModal').then((m) => ({
    default: m.WeeklyPulseModal,
  }))
);
const StrategicSpendingIntentModal = lazy(() =>
  import('./components/modals/StrategicSpendingIntentModal').then((m) => ({
    default: m.StrategicSpendingIntentModal,
  }))
);

function ScreenFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

// Títulos por tela: melhora a orientação no PWA, no histórico e em leitores de tela
const SCREEN_TITLES: Record<ScreenId, string> = {
  home: 'Início',
  couple_hub: 'Hub do Casal',
  calendar: 'Calendário',
  categories: 'Categorias',
  transactions: 'Transações',
  installments: 'Parcelamentos',
  goals: 'Objetivos',
  trends: 'Tendências',
  projections: 'Projeções',
  settings: 'Ajustes',
  shifts: 'Gestão de Plantões',
};

const APP_TITLE = 'JUNTÔ — Finanças Inteligentes de Casal';

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
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<
    CategoryKey | undefined
  >(undefined);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDefaultCat, setExpenseDefaultCat] = useState<
    CategoryKey | undefined
  >(undefined);
  const [expenseDefaultDate, setExpenseDefaultDate] = useState<
    string | undefined
  >(undefined);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeDefaultDate, setIncomeDefaultDate] = useState<
    string | undefined
  >(undefined);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [depositPiggyId, setDepositPiggyId] = useState<string | null>(null);
  const [isBankSyncModalOpen, setIsBankSyncModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAIOnboardingOpen, setIsAIOnboardingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasChatLoaded, setHasChatLoaded] = useState(false);
  const [isPulseModalOpen, setIsPulseModalOpen] = useState(false);
  const [isStrategicIntentModalOpen, setIsStrategicIntentModalOpen] = useState(false);

  const openChat = () => {
    setHasChatLoaded(true);
    setIsChatOpen(true);
  };

  // Listen to Service Worker push click events
  useEffect(() => {
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
      navigator.serviceWorker.addEventListener(
        'message',
        handleServiceWorkerMessage
      );
      return () => {
        navigator.serviceWorker.removeEventListener(
          'message',
          handleServiceWorkerMessage
        );
      };
    }
  }, []);

  // Ao trocar de tela: título correto, topo da página e foco no conteúdo.
  // Isso evita a sensação de "tela travada" no mobile e orienta leitores de tela.
  useEffect(() => {
    document.title = `${SCREEN_TITLES[currentScreen]} · ${APP_TITLE}`;

    // Troca de tela deve ser instantânea (a rolagem suave atrapalha no mobile)
    window.scrollTo({ top: 0, behavior: 'auto' });

    const main = document.getElementById('conteudo-principal');
    if (main && document.activeElement !== main) {
      main.focus({ preventScroll: true });
    }
  }, [currentScreen]);

  if (!currentUser) {
    return <LandingScreen />;
  }

  const handleNavigate = (screen: ScreenId, categoryKey?: CategoryKey) => {
    setCurrentScreen(screen);
    if (categoryKey) {
      setSelectedCategoryKey(categoryKey);
    }
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

  const selectedBank =
    state.piggyBanks.find((b) => b.id === depositPiggyId) || null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0E1015] text-[#111318] dark:text-[#F8FAFC] flex flex-col lg:flex-row font-sans transition-colors">
      {/* Atalho de teclado: pula a navegação e vai direto ao conteúdo */}
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg dark:focus:bg-slate-800 dark:focus:text-white"
      >
        Ir para o conteúdo principal
      </a>

      {/* Sidebar on Desktop (lg+) and Top/Bottom Navigation on Mobile (<lg) */}
      <Navigation
        currentScreen={currentScreen}
        onSelectScreen={(screen) => handleNavigate(screen)}
        onOpenExpenseModal={() => handleOpenExpenseModal()}
        onOpenIncomeModal={() => handleOpenIncomeModal()}
        onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
        onOpenBankSyncModal={() => setIsBankSyncModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenChat={openChat}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAIOnboardingModal={() => setIsAIOnboardingOpen(true)}
        onOpenStrategicIntentModal={() => setIsStrategicIntentModalOpen(true)}
      />

      {/* Main Viewport Content Area (adjacent to desktop sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 pb-28 lg:pb-0 overflow-x-hidden relative">
        {/* Dynamic Environmental Aura Glow of the Active Life Tier */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-96 opacity-35 dark:opacity-25 blur-3xl -z-10 transition-all duration-1000"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -20%, var(--app-tier-glow, rgba(16,185,129,0.25)), transparent 75%)',
          }}
        />
        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 focus:outline-none"
        >
          <Suspense fallback={<ScreenFallback />}>
            {currentScreen === 'home' && (
              <HomeScreen
                onNavigate={handleNavigate}
                onOpenExpenseModal={handleOpenExpenseModal}
                onOpenIncomeModal={() => handleOpenIncomeModal()}
                onOpenInstallmentModal={() => setIsInstallmentModalOpen(true)}
                onOpenDepositModal={(bankId) => setDepositPiggyId(bankId)}
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
                onOpenDepositModal={(bankId) => setDepositPiggyId(bankId)}
              />
            )}

            {currentScreen === 'trends' && <TrendsScreen />}

            {currentScreen === 'settings' && <SettingsScreen />}

            {currentScreen === 'projections' && <ProjectionsScreen />}
            {currentScreen === 'shifts' && <MedicalShiftsScreen />}
            {currentScreen === 'couple_hub' && <CoupleHubScreen />}
          </Suspense>
        </main>

        {/* Desktop Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>
            JUNTÔ — Finanças Inteligentes de Casal · O painel de controle
            simples, visual e acolhedor. 💕
          </p>
        </footer>
      </div>

      {/* Floating Gemini Chat Button on bottom-right for quick access (Mobile only; Desktop has it inside sidebar) */}
      <div className="lg:hidden fixed bottom-20 right-4 z-30">
        <button
          type="button"
          onClick={openChat}
          className="btn-primary-accent w-12 h-12 rounded-full text-white flex items-center justify-center text-xl shadow-xl active:scale-95 transition-all cursor-pointer"
          title="Falar com Dr. Finanças"
          aria-label="Abrir conversa com o Dr. Finanças"
        >
          <span aria-hidden="true">💬</span>
        </button>
      </div>

      {/* Modals — mounted only while open to keep the initial bundle lean */}
      {isExpenseModalOpen && (
        <Suspense fallback={null}>
          <ExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => {
              setIsExpenseModalOpen(false);
              setExpenseDefaultDate(undefined);
            }}
            defaultCategory={expenseDefaultCat}
            defaultDate={expenseDefaultDate}
          />
        </Suspense>
      )}

      {isIncomeModalOpen && (
        <Suspense fallback={null}>
          <IncomeModal
            isOpen={isIncomeModalOpen}
            onClose={() => {
              setIsIncomeModalOpen(false);
              setIncomeDefaultDate(undefined);
            }}
            defaultDate={incomeDefaultDate}
          />
        </Suspense>
      )}

      {isInstallmentModalOpen && (
        <Suspense fallback={null}>
          <InstallmentModal
            isOpen={isInstallmentModalOpen}
            onClose={() => setIsInstallmentModalOpen(false)}
          />
        </Suspense>
      )}

      {depositPiggyId && (
        <Suspense fallback={null}>
          <DepositPiggyModal
            isOpen={!!depositPiggyId}
            onClose={() => setDepositPiggyId(null)}
            bank={selectedBank}
          />
        </Suspense>
      )}

      {isBankSyncModalOpen && (
        <Suspense fallback={null}>
          <BankSyncModal
            isOpen={isBankSyncModalOpen}
            onClose={() => setIsBankSyncModalOpen(false)}
          />
        </Suspense>
      )}

      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onOpenAIOnboardingModal={() => {
              setIsAuthModalOpen(false);
              setIsAIOnboardingOpen(true);
            }}
          />
        </Suspense>
      )}

      {isAIOnboardingOpen && (
        <Suspense fallback={null}>
          <AIOnboardingModal
            isOpen={isAIOnboardingOpen}
            onClose={() => setIsAIOnboardingOpen(false)}
          />
        </Suspense>
      )}

      {isNotificationsOpen && (
        <Suspense fallback={null}>
          <NotificationCenter
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
          />
        </Suspense>
      )}

      {isPulseModalOpen && (
        <Suspense fallback={null}>
          <WeeklyPulseModal
            isOpen={isPulseModalOpen}
            onClose={() => setIsPulseModalOpen(false)}
            pulseData={buildWeeklyPulseData(state, totalIncome)}
            onExecuteAction={(action) => {
              if (action.actionKey === 'deposit_protection') {
                depositToProtection(action.suggestedAmount || 200);
              } else if (action.actionKey === 'deposit_freedom') {
                depositToFreedom(action.suggestedAmount || 60);
              } else if (
                action.actionKey === 'deposit_goal' &&
                action.targetId
              ) {
                depositToGoal(action.targetId, action.suggestedAmount || 300);
              }
            }}
          />
        </Suspense>
      )}

      {hasChatLoaded && (
        <Suspense fallback={null}>
          <GeminiChatDrawer
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </Suspense>
      )}

      {isStrategicIntentModalOpen && (
        <Suspense fallback={null}>
          <StrategicSpendingIntentModal
            isOpen={isStrategicIntentModalOpen}
            onClose={() => setIsStrategicIntentModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AvatarProvider>
        <MainApp />
        <AvatarEditorOutlet />
      </AvatarProvider>
    </FinanceProvider>
  );
}
