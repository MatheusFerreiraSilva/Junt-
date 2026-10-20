// Juntô Notification Engine & Telemetry
// Timezone: Horário de Brasília (America/Sao_Paulo / UTC-3)
// Priority: 1. Urgência (P1) > 2. Conquista (P2) > 3. Semanal "O Pulso" (P3)
// Anti-Spam: Max 1 notification/day, night guard (22h-08h), silence on unread

import { AppState, CategoryKey } from '../types/finance';
import { formatCurrency } from './formatters';

export type NotificationType = 'weekly_pulse' | 'urgency' | 'conquest' | 'alert' | 'info';
export type NotificationPriority = 'P1_URGENT' | 'P2_CONQUEST' | 'P3_WEEKLY' | 'P4_INFO';

export interface NotificationActionItem {
  label: string;
  actionKey: 'deposit_protection' | 'deposit_goal' | 'deposit_freedom' | 'review_subscription' | 'view_installments' | 'renew_open_finance';
  targetId?: string;
  suggestedAmount?: number;
}

export interface WeeklyPulseData {
  title: string;
  subtitle: string;
  dateKey: string; // YYYY-MM-DD
  // Bloco 1 - A semana em 3 números
  incomeThisWeek: number;
  spentThisWeek: number;
  remainingThisMonth: number;
  // Bloco 2 - A observação da semana
  observationTitle: string;
  observationText: string;
  observationMetric?: string;
  // Bloco 3 - A ação da semana (uma só)
  actionTitle: string;
  actionText: string;
  actionItem: NotificationActionItem;
  // Bloco 4 - A semana que vem (preparação)
  upcomingEvents: Array<{
    id: string;
    title: string;
    dueDate: string;
    amount?: number;
    type: 'bill' | 'installment' | 'subscription' | 'date';
  }>;
  // Bloco 5 - O toque humano
  humanTouchMessage: string;
  humanTouchMood: 'good' | 'tight' | 'conquest' | 'steady';
}

export interface NotificationLogRecord {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  sentAt: string; // ISO string in Brasília time
  openedAt?: string;
  status: 'sent' | 'opened' | 'ignored' | 'scheduled';
  platform: 'android' | 'ios' | 'desktop' | 'standalone_ios' | 'unknown';
  dataPayload?: any;
}

export interface NotificationMetrics {
  totalSent: number;
  totalOpened: number;
  totalIgnored: number;
  openRatePct: number;
  lastSentDate?: string;
  unreadCountStreak: number;
}

const STORAGE_LOGS_KEY = 'junto_notification_logs_v1';
const STORAGE_SCHEDULE_KEY = 'junto_notification_schedule_v1';

/**
 * Gets the current date & time in Horário de Brasília (UTC-3)
 */
export function getBrasiliaTime(dateRef = new Date()): Date {
  const utc = dateRef.getTime() + dateRef.getTimezoneOffset() * 60000;
  // Brasília is UTC-3 (3 hours behind UTC)
  return new Date(utc - 3 * 60 * 60 * 1000);
}

/**
 * Detects device & standalone PWA platform
 */
export function detectPlatform(): NotificationLogRecord['platform'] {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  if (isIOS) {
    return isStandalone ? 'standalone_ios' : 'ios';
  }
  if (isAndroid) {
    return 'android';
  }
  return 'desktop';
}

/**
 * Checks whether iOS requires Home Screen install for notifications
 */
export function getIOSInstallationStatus(): {
  isIOS: boolean;
  isStandalone: boolean;
  notificationsAllowed: boolean;
  message: string;
} {
  const platform = detectPlatform();
  const isIOS = platform === 'ios' || platform === 'standalone_ios';
  const isStandalone = platform === 'standalone_ios';

  if (!isIOS) {
    return {
      isIOS: false,
      isStandalone: true,
      notificationsAllowed: 'Notification' in window,
      message: 'Dispositivo compatível com notificações diretas.',
    };
  }

  if (isStandalone) {
    return {
      isIOS: true,
      isStandalone: true,
      notificationsAllowed: 'Notification' in window,
      message: 'Juntô instalado na Tela de Início do iPhone com suporte total a Notificações Push.',
    };
  }

  return {
    isIOS: true,
    isStandalone: false,
    notificationsAllowed: false,
    message: 'No iPhone, o iOS exige que o app seja adicionado à Tela de Início (PWA) para receber notificações.',
  };
}

/**
 * Loads notification logs and metrics from local storage
 */
export function getNotificationLogs(): NotificationLogRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotificationLogs(logs: NotificationLogRecord[]) {
  try {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('Failed to save notification logs', e);
  }
}

export function getNotificationMetrics(): NotificationMetrics {
  const logs = getNotificationLogs();
  const sent = logs.filter(l => l.status === 'sent' || l.status === 'opened' || l.status === 'ignored').length;
  const opened = logs.filter(l => l.status === 'opened').length;
  const ignored = logs.filter(l => l.status === 'ignored').length;

  const sorted = [...logs].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  const lastSentDate = sorted.length > 0 ? sorted[0].sentAt.split('T')[0] : undefined;

  // Streak of consecutive unread notifications to trigger silence back-off
  let unreadStreak = 0;
  for (const log of sorted) {
    if (log.status === 'opened') break;
    unreadStreak++;
  }

  return {
    totalSent: sent,
    totalOpened: opened,
    totalIgnored: ignored,
    openRatePct: sent > 0 ? Math.round((opened / sent) * 100) : 100,
    lastSentDate,
    unreadCountStreak: unreadStreak,
  };
}

/**
 * Marks a notification as opened and updates analytics
 */
export function markNotificationOpened(id: string) {
  const logs = getNotificationLogs();
  const index = logs.findIndex(l => l.id === id);
  if (index !== -1) {
    logs[index].status = 'opened';
    logs[index].openedAt = getBrasiliaTime().toISOString();
    saveNotificationLogs(logs);
  }
}

/**
 * Anti-spam rule checker:
 * 1. Max 1 notification per day (Brasília time)
 * 2. Night guard (22:00 to 07:59 held unless forced)
 * 3. Silence rule (if user ignored 3 consecutive notifications, skip unless P1 urgent)
 */
export function canSendNotification(priority: NotificationPriority, force = false): {
  allowed: boolean;
  reason?: string;
} {
  if (force) return { allowed: true };

  const brTime = getBrasiliaTime();
  const todayStr = brTime.toISOString().split('T')[0];
  const currentHour = brTime.getHours();
  const metrics = getNotificationMetrics();

  // 1. Night guard: Between 22:00 and 07:59, hold for 08:00 AM
  if (currentHour >= 22 || currentHour < 8) {
    return {
      allowed: false,
      reason: 'Horário de repouso (22h às 08h). Notificação agendada para as 08h de Brasília.',
    };
  }

  // 2. Max 1 notification per day
  if (metrics.lastSentDate === todayStr && priority !== 'P1_URGENT') {
    return {
      allowed: false,
      reason: 'Limite diário atingido (máximo de 1 notificação por dia para evitar spam).',
    };
  }

  // 3. Silence rule: If user ignored 3+ consecutive notifications, only P1 Urgencies break silence
  if (metrics.unreadCountStreak >= 3 && priority !== 'P1_URGENT') {
    return {
      allowed: false,
      reason: 'Regra de Silêncio ativa: o app não insiste quando notificações anteriores não foram abertas.',
    };
  }

  return { allowed: true };
}

/**
 * Builds smart, contextual Weekly Pulse data from real user finances
 */
export function buildWeeklyPulseData(state: AppState, totalIncome: number): WeeklyPulseData {
  const isCollege = state.appMode === 'faculdade';
  const college = state.collegeModeData;
  const brTime = getBrasiliaTime();
  const dateKey = brTime.toISOString().split('T')[0];

  // 7 days window (Week)
  const sevenDaysAgo = new Date(brTime.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const weekExpenses = state.expenses.filter(e => e.date >= sevenDaysAgoStr && e.date <= dateKey);
  const weekIncomes = state.incomes.filter(i => i.date >= sevenDaysAgoStr && i.date <= dateKey);

  const spentThisWeek = weekExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const incomeThisWeek = weekIncomes.reduce((acc, curr) => acc + curr.amount, 0);

  // Month total and remaining
  const currentMonth = state.currentMonth || dateKey.substring(0, 7);
  const monthExpenses = state.expenses.filter(e => e.date.startsWith(currentMonth));
  const totalMonthSpent = monthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  const effectiveIncome = isCollege ? (college?.monthlyStipend || 600) : totalIncome;
  const remainingThisMonth = Math.max(0, effectiveIncome - totalMonthSpent);

  // Analyze week category patterns for Bloco 2
  const categoryWeekMap: Record<CategoryKey, number> = {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
  };
  weekExpenses.forEach(e => {
    categoryWeekMap[e.category] = (categoryWeekMap[e.category] || 0) + e.amount;
  });

  let observationTitle = 'Gasto equilibrado na semana';
  let observationText = 'Vocês mantiveram a consistência nos gastos essenciais sem surpresas.';
  let observationMetric = 'Ritmo ideal';

  if (isCollege) {
    observationTitle = 'Bolsa da Faculdade bem administrada';
    observationText = `Vocês estão no ${college?.currentSemester || 5}º semestre. Faltam ${(college?.totalSemesters || 12) - (college?.currentSemester || 5)} semestres para a formatura.`;
    observationMetric = `${college?.currentSemester || 5}º Semestre`;
  } else if (categoryWeekMap.comida > spentThisWeek * 0.45 && categoryWeekMap.comida > 400) {
    observationTitle = 'Comida puxou os gastos da semana';
    observationText = `Comida representou ${Math.round((categoryWeekMap.comida / Math.max(1, spentThisWeek)) * 100)}% dos gastos desta semana (${formatCurrency(categoryWeekMap.comida)}). Que tal cozinhar juntos nos próximos dias?`;
    observationMetric = '+45% Comida';
  } else if (categoryWeekMap.lazer > spentThisWeek * 0.35 && categoryWeekMap.lazer > 300) {
    observationTitle = 'Lazer teve destaque no fim de semana';
    observationText = `Lazer somou ${formatCurrency(categoryWeekMap.lazer)} esta semana. Ainda estão dentro da meta, mas vale atenção para os próximos dias.`;
    observationMetric = 'Atenção ao Lazer';
  } else if (state.protectionCurrentAmount > 0) {
    observationTitle = 'Reserva de Proteção avançando';
    observationText = `A proteção do casal conta com ${formatCurrency(state.protectionCurrentAmount)}. Esse dinheiro garante tranquilidade contra qualquer imprevisto.`;
    observationMetric = 'Proteção Ativa';
  }

  // Choose exactly ONE Action for Bloco 3
  let actionTitle = 'Fortalecer a Reserva de Proteção';
  let actionText = 'Que tal transferir R$ 200 para a reserva agora e garantir mais tranquilidade?';
  let actionItem: NotificationActionItem = {
    label: 'Transferir R$ 200',
    actionKey: 'deposit_protection',
    suggestedAmount: 200,
  };

  const isMonthDepositsDone = !!state.completedMonthDeposits?.[state.currentMonth];

  if (isMonthDepositsDone) {
    if (state.detectedSubscriptions && state.detectedSubscriptions.length > 0) {
      const sub = state.detectedSubscriptions[0];
      actionTitle = `Revisar Assinatura de ${sub.merchant}`;
      actionText = `${sub.merchant} cobra ${formatCurrency(sub.amount)} todo mês. Quer revisar se ainda vale a pena manter?`;
      actionItem = {
        label: 'Revisar Assinatura',
        actionKey: 'review_subscription',
        targetId: sub.id,
      };
    } else {
      actionTitle = 'Investimentos do Mês Concluídos 🏆';
      actionText = 'Vocês já realizaram todos os aportes planejados para este mês com sucesso! Podem descansar sem preocupações.';
      actionItem = {
        label: 'Ver Investimentos',
        actionKey: 'deposit_freedom',
      };
    }
  } else if (isCollege) {
    actionTitle = 'Guardar Investimento da Bolsa';
    actionText = 'O hábito de investir R$ 60 por mês garante o seu patrimônio na formatura.';
    actionItem = {
      label: 'Guardar R$ 60',
      actionKey: 'deposit_freedom',
      suggestedAmount: 60,
    };
  } else if (state.isProtectionComplete && state.piggyBanks.length > 0) {
    const primaryGoal = state.piggyBanks.find(p => !p.completed) || state.piggyBanks[0];
    actionTitle = `Acelerar "${primaryGoal.name}"`;
    actionText = `O objetivo "${primaryGoal.name}" está com ${formatCurrency(primaryGoal.currentAmount)}. Um aporte de R$ 300 adianta a conquista!`;
    actionItem = {
      label: `Aportar R$ 300 em ${primaryGoal.name}`,
      actionKey: 'deposit_goal',
      targetId: primaryGoal.id,
      suggestedAmount: 300,
    };
  } else if (state.detectedSubscriptions && state.detectedSubscriptions.length > 0) {
    const sub = state.detectedSubscriptions[0];
    actionTitle = `Revisar Assinatura de ${sub.merchant}`;
    actionText = `${sub.merchant} cobra ${formatCurrency(sub.amount)} todo mês. Quer revisar se ainda vale a pena manter?`;
    actionItem = {
      label: 'Revisar Assinatura',
      actionKey: 'review_subscription',
      targetId: sub.id,
    };
  }

  // Upcoming preparations for Bloco 4 (bills, installments, scheduled items)
  const upcomingEvents: WeeklyPulseData['upcomingEvents'] = [];

  state.installments
    .filter(inst => inst.active && inst.paidInstallmentsCount < inst.installmentsCount)
    .slice(0, 3)
    .forEach(inst => {
      upcomingEvents.push({
        id: inst.id,
        title: `Parcela: ${inst.title} (${inst.paidInstallmentsCount + 1}/${inst.installmentsCount})`,
        dueDate: 'Próximos 7 dias',
        amount: inst.installmentAmount,
        type: 'installment',
      });
    });

  if (state.detectedSubscriptions && state.detectedSubscriptions.length > 0) {
    state.detectedSubscriptions.slice(0, 2).forEach(sub => {
      upcomingEvents.push({
        id: sub.id,
        title: `Assinatura: ${sub.merchant}`,
        dueDate: `Recorrente mensal`,
        amount: sub.amount,
        type: 'subscription',
      });
    });
  }

  if (upcomingEvents.length === 0) {
    upcomingEvents.push({
      id: 'default-bill-1',
      title: 'Contas essenciais da semana (Luz, Internet, Mercado)',
      dueDate: 'Durante a semana',
      amount: isCollege ? 150 : 850,
      type: 'bill',
    });
  }

  // Bloco 5 - O toque humano
  let humanTouchMood: WeeklyPulseData['humanTouchMood'] = 'good';
  let humanTouchMessage = 'Semana leve. Vocês estão no ritmo certo.';

  if (remainingThisMonth <= effectiveIncome * 0.15) {
    humanTouchMood = 'tight';
    humanTouchMessage = 'Semana apertada, mas vocês seguraram com maturidade. Isso é o que constrói tranquilidade.';
  } else if (state.isProtectionComplete || (state.piggyBanks.some(p => p.completed))) {
    humanTouchMood = 'conquest';
    humanTouchMessage = 'Semana de conquista. O esforço e o alinhamento de vocês estão dando frutos reais.';
  } else {
    humanTouchMood = 'steady';
    humanTouchMessage = 'Semana comum. E é exatamente a consistência das semanas comuns que constrói patrimônio.';
  }

  return {
    title: isCollege ? '🎓 O Pulso da Semana — Estudante' : '✨ O Pulso da Semana — Juntô',
    subtitle: 'O ritual de domingo do casal para começar a semana com leveza e controle.',
    dateKey,
    incomeThisWeek,
    spentThisWeek,
    remainingThisMonth,
    observationTitle,
    observationText,
    observationMetric,
    actionTitle,
    actionText,
    actionItem,
    upcomingEvents,
    humanTouchMessage,
    humanTouchMood,
  };
}

/**
 * Fires a native push notification using ServiceWorker or fallback Notification API,
 * records telemetry, and applies priority and anti-spam filters.
 */
export async function sendJuntoNotification(
  payload: {
    title: string;
    body: string;
    type: NotificationType;
    priority: NotificationPriority;
    dataPayload?: any;
    force?: boolean;
  }
): Promise<{ success: boolean; message: string; logId?: string }> {
  const { title, body, type, priority, dataPayload, force = false } = payload;

  const check = canSendNotification(priority, force);
  if (!check.allowed) {
    return { success: false, message: check.reason || 'Notificação adiada pelo sistema anti-spam.' };
  }

  const platform = detectPlatform();
  const brTime = getBrasiliaTime();
  const logId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const logRecord: NotificationLogRecord = {
    id: logId,
    title,
    body,
    type,
    priority,
    sentAt: brTime.toISOString(),
    status: 'sent',
    platform,
    dataPayload,
  };

  // Try Native Service Worker Push (Required for iOS Standalone & Android Background)
  let sentNatively = false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          vibrate: [100, 50, 100],
          tag: `junto-${type}`,
          data: {
            logId,
            type,
            dataPayload,
            url: '/',
          },
        } as any);
        sentNatively = true;
      }
    } catch (e) {
      console.warn('Service worker notification failed, falling back', e);
    }
  }

  // Fallback to standard Window Notification if SW was not ready
  if (!sentNatively && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: `junto-${type}`,
      });
      notif.onclick = () => {
        window.focus();
        markNotificationOpened(logId);
        notif.close();
      };
      sentNatively = true;
    } catch (e) {
      console.warn('Window Notification failed', e);
    }
  }

  // Save log entry to history
  const logs = getNotificationLogs();
  logs.unshift(logRecord);
  saveNotificationLogs(logs.slice(0, 100)); // Keep last 100 logs

  return {
    success: true,
    message: sentNatively
      ? 'Notificação enviada com sucesso no celular!'
      : 'Notificação registrada no painel do Juntô.',
    logId,
  };
}

/**
 * Triggers the 3 premium notification types
 */

// 1. O Pulso da Semana (Domingo às 19h30)
export async function triggerWeeklyPulseNotification(state: AppState, totalIncome: number, force = false) {
  const pulse = buildWeeklyPulseData(state, totalIncome);
  const title = `O Pulso da Semana 🕊️`;
  const body = `Entrou ${formatCurrency(pulse.incomeThisWeek)} · Saiu ${formatCurrency(pulse.spentThisWeek)} · Restam ${formatCurrency(pulse.remainingThisMonth)}. Toque para ver o plano da semana.`;

  return sendJuntoNotification({
    title,
    body,
    type: 'weekly_pulse',
    priority: 'P3_WEEKLY',
    dataPayload: pulse,
    force,
  });
}

// 2. Notificação de Urgência (Calm, informative, non-alarmist)
export async function triggerUrgencyNotification(
  reason: 'category_blown' | 'installment_limit' | 'open_finance_expiring' | 'reserve_low',
  details: {
    categoryName?: string;
    overAmount?: number;
    daysRemaining?: number;
    reserveMonths?: number;
  },
  force = true
) {
  let title = 'Aviso do Juntô 🛡️';
  let body = 'Um ponto importante precisa da atenção de vocês.';

  if (reason === 'category_blown') {
    title = `Atenção em ${details.categoryName || 'Gastos'}`;
    body = `${details.categoryName || 'A categoria'} passou ${formatCurrency(details.overAmount || 0)} do combinado. Vamos recalibrar juntos?`;
  } else if (reason === 'installment_limit') {
    title = 'Teto de parcelas atingido';
    body = 'Vocês chegaram no limite planejado de parcelas. Novas compras parceladas serão pausadas para proteger a renda.';
  } else if (reason === 'open_finance_expiring') {
    title = 'Conexão bancária vencendo';
    body = `Sua conexão bancária vence em ${details.daysRemaining || 7} dias. Renove para continuar vendo os gastos atualizados.`;
  } else if (reason === 'reserve_low') {
    title = 'Reserva abaixo do mínimo';
    body = `A reserva caiu para ${details.reserveMonths || 2} meses de despesas. Vale a pena reforçar a proteção nos próximos aportes.`;
  }

  return sendJuntoNotification({
    title,
    body,
    type: 'urgency',
    priority: 'P1_URGENT',
    dataPayload: { reason, details },
    force,
  });
}

// 3. Notificação de Conquista (Celebratory, emotional, concise)
export async function triggerConquestNotification(
  type: 'reserve_completed' | 'goal_completed' | 'month_on_budget' | 'investment_record' | 'college_semester',
  details: {
    goalName?: string;
    semesterNumber?: number;
    investedAmount?: number;
  },
  force = true
) {
  let title = 'Parabéns casal! 🎉';
  let body = 'Vocês alcançaram um marco importante nas finanças.';

  if (type === 'reserve_completed') {
    title = '🛡️ Reserva Completa!';
    body = 'Vocês estão protegidos contra imprevistos. Agora o foco é acelerar sonhos e liberdade!';
  } else if (type === 'goal_completed') {
    title = `🎯 Objetivo "${details.goalName || 'Conquista'}" Concluído!`;
    body = `Mais um sonho realizado sem dívidas nem financiamentos. Que orgulho!`;
  } else if (type === 'month_on_budget') {
    title = '🏆 Mês dentro do orçamento!';
    body = 'Vocês fecharam o mês exatamente dentro do combinado. Disciplina impecável!';
  } else if (type === 'investment_record') {
    title = '🚀 Recorde de Investimento!';
    body = `Vocês investiram ${formatCurrency(details.investedAmount || 0)} este mês. O maior valor já registrado!`;
  } else if (type === 'college_semester') {
    title = `🎓 ${details.semesterNumber || 5}º Semestre Concluído!`;
    body = 'Você avançou mais um degrau e está mais perto do seu diploma. Continue firme!';
  }

  return sendJuntoNotification({
    title,
    body,
    type: 'conquest',
    priority: 'P2_CONQUEST',
    dataPayload: { type, details },
    force,
  });
}
