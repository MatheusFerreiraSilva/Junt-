// Monthly Review Notifications Engine
// Regra: Primeira segunda-feira do mês às 20h.
// Reenvio: Se não abrir em 48h -> "A revisão de [mês] está esperando."
// Se não abrir em 7 dias -> para de insistir até o próximo mês.

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export interface MonthlyReviewNotificationSchedule {
  monthKey: string; // "2026-10"
  monthName: string; // "Outubro"
  firstMondayDate: string; // ISO string for 1st Monday at 20:00
  secondaryDate: string; // 48h after first monday
  cutoffDate: string; // 7 days after first monday
  primaryMessage: string;
  secondaryMessage: string;
  isFirstMondayToday: boolean;
  status: 'scheduled' | 'sent_primary' | 'sent_secondary' | 'opened' | 'expired';
}

/**
 * Calculates the first Monday of a given year and month (1-indexed month: 1=Jan, 10=Oct)
 */
export function getFirstMondayOfMonth(year: number, month: number): Date {
  const date = new Date(year, month - 1, 1, 20, 0, 0); // 20:00
  while (date.getDay() !== 1) {
    // 1 is Monday
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export function getCurrentMonthlyReviewSchedule(dateRef = new Date()): MonthlyReviewNotificationSchedule {
  const year = dateRef.getFullYear();
  const month = dateRef.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthName = MONTH_NAMES[month - 1];

  const firstMonday = getFirstMondayOfMonth(year, month);
  const secondary = new Date(firstMonday.getTime() + 48 * 60 * 60 * 1000);
  const cutoff = new Date(firstMonday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const isTodayFirstMonday =
    dateRef.getDate() === firstMonday.getDate() &&
    dateRef.getMonth() === firstMonday.getMonth() &&
    dateRef.getFullYear() === firstMonday.getFullYear();

  return {
    monthKey,
    monthName,
    firstMondayDate: firstMonday.toISOString(),
    secondaryDate: secondary.toISOString(),
    cutoffDate: cutoff.toISOString(),
    primaryMessage: `Revisão de ${monthName} pronta. 5 minutos para ver juntos?`,
    secondaryMessage: `A revisão de ${monthName} está esperando.`,
    isFirstMondayToday: isTodayFirstMonday,
    status: 'scheduled',
  };
}

export async function requestPushNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'unsupported';
  }
}

export function triggerBrowserPushNotification(
  title: string,
  body: string,
  icon = '/favicon.svg'
): boolean {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge: icon,
      tag: 'casal-monthly-review',
      requireInteraction: false,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (e) {
    console.warn('Native notification failed, fall back to in-app toast', e);
    return false;
  }
}
