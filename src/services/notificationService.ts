export interface PushNotificationSchedule {
  scheduledDate: string; // ISO string
  title: string;
  body: string;
  type: 'monthly_review' | 'review_reminder' | 'subscription_alert' | 'pluggy_consent';
  payload?: Record<string, any>;
}

/**
 * Calculates the exact date and time for the 1st Monday of a given month at 20:00
 */
export function getFirstMondayOfMonth(year: number, monthIndex0: number): Date {
  // Day 1 of the month
  const date = new Date(year, monthIndex0, 1, 20, 0, 0);
  // getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const day = date.getDay();
  const diff = (1 - day + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Monthly Review Push Notification System
 * - First notification: 1st Monday of the month at 20:00 -> "Revisão de [mês] pronta. 5 minutos para ver juntos?"
 * - 48h Follow-up if not opened -> "A revisão de [mês] está esperando."
 * - Stops after 7 days until next month to avoid noise.
 */
export function checkMonthlyReviewSchedule(lastReviewOpenedAt?: string): {
  shouldNotify: boolean;
  messageTitle?: string;
  messageBody?: string;
  isFirstCall?: boolean;
  isReminder?: boolean;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const currentMonthName = monthNames[month];

  const firstMonday = getFirstMondayOfMonth(year, month);
  const diffMs = now.getTime() - firstMonday.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // If before the 1st Monday 20h
  if (diffHours < 0) {
    return { shouldNotify: false };
  }

  // If already opened for this cycle
  if (lastReviewOpenedAt) {
    const openedDate = new Date(lastReviewOpenedAt);
    if (openedDate >= firstMonday) {
      return { shouldNotify: false };
    }
  }

  // First call (within first 48h of 1st Monday)
  if (diffHours >= 0 && diffHours < 48) {
    return {
      shouldNotify: true,
      isFirstCall: true,
      messageTitle: `📊 Revisão de ${currentMonthName} pronta`,
      messageBody: `Revisão de ${currentMonthName} pronta. 5 minutos para ver juntos?`,
    };
  }

  // 48h to 7 days reminder
  if (diffHours >= 48 && diffHours < 168) {
    return {
      shouldNotify: true,
      isReminder: true,
      messageTitle: `⏳ Lembrete de Revisão`,
      messageBody: `A revisão de ${currentMonthName} está esperando vocês dois.`,
    };
  }

  // After 7 days: Stops insisting to avoid notification fatigue
  return { shouldNotify: false };
}

/**
 * Triggers a real browser Notification or Service Worker Push
 */
export async function sendBrowserPushNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return false;
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }

  if (perm !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      });
      return true;
    } else {
      new Notification(title, {
        icon: '/favicon.svg',
        ...options,
      });
      return true;
    }
  } catch (err) {
    console.warn('Error displaying push notification:', err);
    return false;
  }
}
