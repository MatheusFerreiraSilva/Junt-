import { AppState, PushNotificationSettings, CategoryKey } from '../types/finance';

export const DEFAULT_PUSH_SETTINGS: PushNotificationSettings = {
  enabled: true,
  permissionStatus: 'default',
  lunchReminderEnabled: true,
  dailyTriageEnabled: true,
  weeklySummaryEnabled: true,
  monthlySummaryEnabled: true,
  categoryAlertsEnabled: true,
  goalCelebrationsEnabled: true,
};

/**
 * Gets the current Web Notification API permission status
 */
export function getBrowserPermissionStatus(): 'granted' | 'denied' | 'default' {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission as 'granted' | 'denied' | 'default';
  }
  return 'default';
}

/**
 * Checks if Push Notifications are supported by the browser / PWA
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Requests native browser Push Notification permission
 */
export async function requestPushPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!isPushSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as 'granted' | 'denied' | 'default';
  } catch (err) {
    console.warn('Notification permission error:', err);
    return 'denied';
  }
}

/**
 * Sends a native PWA local Push Notification using Service Worker or Notification API
 */
export async function sendLocalPushNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const defaultOptions: NotificationOptions & { vibrate?: number[] } = {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    ...('vibrate' in navigator ? { vibrate: [200, 100, 200] } : {}),
    requireInteraction: false,
    ...options,
  };

  try {
    // Attempt Service Worker registration notification first
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        await registration.showNotification(title, defaultOptions);
        return true;
      }
    }

    // Fallback to direct Notification constructor
    new Notification(title, defaultOptions);
    return true;
  } catch (err) {
    console.warn('Could not display local push notification:', err);
    return false;
  }
}

/**
 * Dispatches an instant test notification
 */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestPushPermission();
  if (perm !== 'granted') {
    return false;
  }

  return sendLocalPushNotification('🏦 JUNTÔ — Notificações Ativas!', {
    body: 'Notificação local ativada. Os lembretes são verificados enquanto o aplicativo está aberto.',
    tag: 'junto-test-push',
  });
}

/**
 * Checks scheduled notification rules and triggers push & in-app alerts if criteria are met
 */
export function checkAndTriggerScheduledPushNotifications(
  state: AppState,
  updatePushSettings: (updates: Partial<PushNotificationSettings>) => void,
  addNotification: (notif: { title: string; message: string; type: 'alert' | 'success' | 'info' }) => void
): void {
  const settings = state.pushSettings || DEFAULT_PUSH_SETTINGS;
  if (!settings.enabled) return;

  const currentPermission = getBrowserPermissionStatus();
  if (settings.permissionStatus !== currentPermission) {
    updatePushSettings({ permissionStatus: currentPermission });
  }

  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const now = new Date();
  const hour = now.getHours();
  const currentMonthKey = state.currentMonth || todayStr.slice(0, 7);

  if (settings.statementReminderEnabled && settings.lastStatementReminderAt !== todayStr) {
    addNotification({ title: 'Hora de conferir o extrato', message: 'Exporte o extrato do seu banco e importe no Juntô para revisar novos lançamentos.', type: 'info' });
    if (currentPermission === 'granted') void sendLocalPushNotification('Juntô — conferir extrato', { body: 'Exporte seu extrato e revise novos lançamentos no aplicativo.', tag: 'statement-reminder' });
    updatePushSettings({ lastStatementReminderAt: todayStr });
  }

  // 1. LEMBRETE DO ALMOÇO (~12:30 - 13:30)
  if (settings.lunchReminderEnabled && hour >= 12 && hour < 15 && settings.lastLunchReminderAt !== todayStr) {
    const notifTitle = '🍽️ JUNTÔ — Lembrete de Almoço do Casal';
    const notifBody = 'Fizeram refeição fora ou pediram algo? Registrem o almoço e café de hoje para manter a rotina em dia!';

    addNotification({
      title: 'Lembrete do Almoço 🍽️',
      message: notifBody,
      type: 'info',
    });

    if (currentPermission === 'granted') {
      void sendLocalPushNotification(notifTitle, {
        body: notifBody,
        tag: 'lunch-reminder',
      });
    }

    updatePushSettings({ lastLunchReminderAt: todayStr });
  }

  // 2. TRIAGEM E FECHAMENTO DO DIA (A partir das 18:00 - Maior Prioridade)
  if (settings.dailyTriageEnabled && hour >= 18 && settings.lastDailyTriageNotifiedAt !== todayStr) {
    const pendingExpenses = state.expenses.filter(
      e => e.triageDone === false || e.isExcludedFromMonthlyBudget === undefined
    ).length;
    const pendingShifts = (state.medicalShifts || []).filter(
      s => s.status === 'pending'
    ).length;
    const pendingBankTransactions = (state.bankImportedTransactions || []).filter(
      t => t.status === 'pending'
    ).length;

    const totalAttention = pendingExpenses + pendingShifts + pendingBankTransactions;

    const notifTitle = '🩺 JUNTÔ — Balanço do Dia & Plantões (18h)';
    const notifBody = totalAttention > 0
      ? `Final de tarde: vocês têm ${totalAttention} item(ns) para conferir entre gastos, extratos e plantões do casal!`
      : 'Fim do dia: hora rápida de conferir se houve gastos ou plantões novos hoje para manter o orçamento equilibrado!';

    addNotification({
      title: 'Fechamento do Dia (18h) 📋',
      message: notifBody,
      type: 'info',
    });

    if (currentPermission === 'granted') {
      void sendLocalPushNotification(notifTitle, {
        body: notifBody,
        tag: 'daily-triage',
      });
    }

    updatePushSettings({ lastDailyTriageNotifiedAt: todayStr });
  }

  // 3. RESUMO SEMANAL (Domingos a partir das 18:00)
  const isSunday = now.getDay() === 0;
  const currentWeekNumber = Math.ceil(now.getDate() / 7);
  const weekKey = `${currentMonthKey}-W${currentWeekNumber}`;

  if (
    settings.weeklySummaryEnabled &&
    isSunday &&
    hour >= 18 &&
    settings.lastWeeklySummaryNotifiedAt !== weekKey
  ) {
    const notifTitle = '📊 JUNTÔ — Resumo Semanal do Casal';
    const notifBody = 'Domingo é dia de alinhamento! Confiram o balanço da semana e o ritmo do orçamento do casal.';

    addNotification({
      title: 'Resumo Semanal Disponível 📊',
      message: notifBody,
      type: 'info',
    });

    if (currentPermission === 'granted') {
      sendLocalPushNotification(notifTitle, {
        body: notifBody,
        tag: 'weekly-summary',
      });
    }

    updatePushSettings({ lastWeeklySummaryNotifiedAt: weekKey });
  }

  // 3. FECHAMENTO DO MÊS (Último dia do mês a partir das 19:00)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isLastDayOfMonth = now.getDate() === lastDayOfMonth;

  if (
    settings.monthlySummaryEnabled &&
    isLastDayOfMonth &&
    hour >= 19 &&
    settings.lastMonthlySummaryNotifiedAt !== currentMonthKey
  ) {
    const notifTitle = '🏆 JUNTÔ — Fechamento do Mês';
    const notifBody = 'Último dia do mês! Hora de revisar as sobras orçamentárias e aprovar o Guia de Aportes a dois.';

    addNotification({
      title: 'Fechamento do Mês Pronto 🏆',
      message: notifBody,
      type: 'success',
    });

    if (currentPermission === 'granted') {
      sendLocalPushNotification(notifTitle, {
        body: notifBody,
        tag: 'monthly-summary',
      });
    }

    updatePushSettings({ lastMonthlySummaryNotifiedAt: currentMonthKey });
  }
}
