import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  Trash2,
  Sliders,
  CheckCheck,
  TrendingUp,
  BarChart2,
  Send,
  ShieldAlert,
  Award,
  Calendar,
  Smartphone,
  CheckCircle2,
  Eye,
  Clock,
  Zap,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import {
  getNotificationLogs,
  getNotificationMetrics,
  markNotificationOpened,
  detectPlatform,
  getIOSInstallationStatus,
  getBrasiliaTime,
  triggerWeeklyPulseNotification,
  triggerUrgencyNotification,
  triggerConquestNotification,
  buildWeeklyPulseData,
  NotificationLogRecord,
  NotificationMetrics,
} from '../utils/notificationEngine';
import { WeeklyPulseModal } from './modals/WeeklyPulseModal';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDepositModal?: (bankId?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onOpenDepositModal,
}) => {
  const {
    state,
    totalIncome,
    installmentLimitPercentage,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    updateAlertRule,
    depositToProtection,
    depositToFreedom,
    depositToGoal,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'notifications' | 'pulse' | 'metrics' | 'rules'>('notifications');
  const [logs, setLogs] = useState<NotificationLogRecord[]>([]);
  const [metrics, setMetrics] = useState<NotificationMetrics>(getNotificationMetrics());
  const [isPulseModalOpen, setIsPulseModalOpen] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const iosStatus = getIOSInstallationStatus();
  const platform = detectPlatform();
  const brTime = getBrasiliaTime();

  useEffect(() => {
    if (isOpen) {
      setLogs(getNotificationLogs());
      setMetrics(getNotificationMetrics());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const weeklyPulse = buildWeeklyPulseData(state, totalIncome);

  const handleTestWeeklyPulse = async () => {
    const res = await triggerWeeklyPulseNotification(state, totalIncome, true);
    setTestFeedback(res.message);
    setLogs(getNotificationLogs());
    setMetrics(getNotificationMetrics());
    setTimeout(() => setTestFeedback(null), 4000);
  };

  const handleTestUrgency = async () => {
    const res = await triggerUrgencyNotification('category_blown', {
      categoryName: 'Lazer',
      overAmount: 180,
    }, true);
    setTestFeedback(res.message);
    setLogs(getNotificationLogs());
    setMetrics(getNotificationMetrics());
    setTimeout(() => setTestFeedback(null), 4000);
  };

  const handleTestConquest = async () => {
    const res = await triggerConquestNotification('reserve_completed', {}, true);
    setTestFeedback(res.message);
    setLogs(getNotificationLogs());
    setMetrics(getNotificationMetrics());
    setTimeout(() => setTestFeedback(null), 4000);
  };

  const handleExecutePulseAction = (action: any) => {
    if (action.actionKey === 'deposit_protection') {
      depositToProtection(action.suggestedAmount || 200);
    } else if (action.actionKey === 'deposit_freedom') {
      depositToFreedom(action.suggestedAmount || 60);
    } else if (action.actionKey === 'deposit_goal' && action.targetId) {
      depositToGoal(action.targetId, action.suggestedAmount || 300);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center sm:items-start justify-center sm:justify-end p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
        {/* Click outside to close */}
        <div className="absolute inset-0" onClick={onClose} />

        <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] sm:mt-14">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
                🔔
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate font-display">
                    Sistema de Notificações Juntô
                  </h3>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                    Brasília (GMT-3)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  O Pulso Semanal, Urgências & Conquistas com Anti-Spam
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline text-[11px]">Lidas</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {testFeedback && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{testFeedback}</span>
            </div>
          )}

          {/* iOS Standalone Warning Banner if in iOS Safari browser */}
          {iosStatus.isIOS && !iosStatus.isStandalone && (
            <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <Smartphone className="w-4 h-4" />
                <span>Instalação no iPhone Necessária</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                No iPhone, a Apple só libera o recebimento de notificações se o app estiver instalado na Tela de Início. Toque em <strong>Compartilhar ⎋</strong> no Safari e selecione <strong>"Adicionar à Tela de Início"</strong>.
              </p>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="grid grid-cols-4 px-3 pt-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-center">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`pb-2 text-[11px] font-bold border-b-2 transition-colors ${
                activeTab === 'notifications'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Avisos ({state.notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('pulse')}
              className={`pb-2 text-[11px] font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'pulse'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span>🕊️</span>
              <span>O Pulso</span>
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`pb-2 text-[11px] font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'metrics'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span>📊</span>
              <span>Auditoria</span>
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-2 text-[11px] font-bold border-b-2 transition-colors ${
                activeTab === 'rules'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Disparos
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {/* ========================================================================= */}
            {/* TAB 1: NOTIFICAÇÕES GERAIS */}
            {/* ========================================================================= */}
            {activeTab === 'notifications' && (
              state.notifications.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <span className="text-3xl block">✨</span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nenhuma notificação pendente
                  </p>
                  <p className="text-[11px] text-slate-400">
                    As notificações do ritual semanal, conquistas e alertas aparecerão aqui.
                  </p>
                </div>
              ) : (
                state.notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationRead(notif.id)}
                    className={`p-3.5 rounded-2xl border transition-all text-xs cursor-pointer relative group ${
                      notif.isRead
                        ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0 mt-0.5">
                          {notif.type === 'alert' ? '⚠️' : notif.type === 'success' ? '🎉' : '🕊️'}
                        </span>
                        <div>
                          <div className="font-bold">{notif.title}</div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {notif.timestamp}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-md transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* ========================================================================= */}
            {/* TAB 2: O PULSO SEMANAL (PREVIEW DOS 5 BLOCOS) */}
            {/* ========================================================================= */}
            {activeTab === 'pulse' && (
              <div className="space-y-4">
                <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white space-y-3 border border-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <span>🕊️</span>
                      <span>O Pulso de Domingo — 19h30</span>
                    </span>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                      Ritual Semanal
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Todo domingo às 19h30 (Horário de Brasília), o Juntô envia o resumo da semana em 3 linhas na tela de bloqueio. Ao tocar, abre a experiência completa em 5 blocos.
                  </p>

                  <button
                    onClick={() => setIsPulseModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Abrir Tela Cheia do Pulso da Semana (5 Blocos)</span>
                    <Zap className="w-4 h-4" />
                  </button>
                </div>

                {/* Lock Screen Preview Card */}
                <div className="p-4 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Como aparece na Tela de Bloqueio do Celular:
                  </span>

                  <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-bold text-slate-200">
                        <span>JUNTÔ</span>
                        <span>·</span>
                        <span>agora</span>
                      </span>
                      <span>Domingo 19:30</span>
                    </div>
                    <div className="font-bold text-xs text-white">
                      {weeklyPulse.title}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-semibold tabular-nums">
                      Entrou {formatCurrency(weeklyPulse.incomeThisWeek)} · Saiu {formatCurrency(weeklyPulse.spentThisWeek)} · Restam {formatCurrency(weeklyPulse.remainingThisMonth)}
                    </div>
                    <div className="text-[10px] text-slate-300 leading-snug">
                      {weeklyPulse.observationTitle}. Toque para abrir os 5 blocos da semana.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: MÉTRICAS & AUDITORIA */}
            {/* ========================================================================= */}
            {activeTab === 'metrics' && (
              <div className="space-y-4">
                {/* 4 Numbers Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Enviadas</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                      {metrics.totalSent}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block">Abertas</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {metrics.totalOpened}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="text-[10px] text-amber-800 dark:text-amber-300 uppercase font-bold block">Taxa Abertura</span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                      {metrics.openRatePct}%
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Ignoradas</span>
                    <span className="text-xl font-black text-slate-500 tabular-nums">
                      {metrics.totalIgnored}
                    </span>
                  </div>
                </div>

                {/* Audit Checklist */}
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                    Checklist de Verificação Técnica:
                  </span>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">1. Dispositivo Detectado:</span>
                      <strong className="text-slate-900 dark:text-white capitalize">{platform}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">2. Fuso Horário Configurado:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">América/São Paulo (GMT-3) ✓</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">3. Sistema Anti-Spam:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">Máx 1/dia + Repouso 22h-08h ✓</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">4. Hierarquia de Prioridades:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">Urgência &gt; Conquista &gt; Pulso ✓</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">5. Modo Faculdade Adaptado:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">Ativo (Bolsa & Semestres) ✓</strong>
                    </div>
                  </div>
                </div>

                {/* Recent Delivery Log List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Histórico Recente de Disparos:
                  </span>

                  {logs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Nenhum disparo registrado ainda.
                    </div>
                  ) : (
                    logs.slice(0, 5).map(log => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {log.title}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.sentAt).toLocaleString('pt-BR')} · {log.priority}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            log.status === 'opened'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {log.status === 'opened' ? 'Aberta ✓' : 'Enviada'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: DISPAROS & REGRAS */}
            {/* ========================================================================= */}
            {activeTab === 'rules' && (
              <div className="space-y-4">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Teste o recebimento das 3 notificações premium no seu celular:
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={handleTestWeeklyPulse}
                    className="w-full p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs block">
                        🕊️ Testar: Notificação Semanal "O Pulso"
                      </span>
                      <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        Dispara a mensagem do ritual de domingo (19h30) com seus números reais
                      </span>
                    </div>
                    <Send className="w-4 h-4 text-indigo-600 shrink-0" />
                  </button>

                  <button
                    onClick={handleTestUrgency}
                    className="w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-rose-900 dark:text-rose-200 text-xs block">
                        ⚠️ Testar: Notificação de Urgência
                      </span>
                      <span className="text-[11px] text-rose-700 dark:text-rose-300">
                        Dispara aviso calmo sobre limite de categoria atingido
                      </span>
                    </div>
                    <Send className="w-4 h-4 text-rose-600 shrink-0" />
                  </button>

                  <button
                    onClick={handleTestConquest}
                    className="w-full p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs block">
                        🎉 Testar: Notificação de Conquista
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Dispara mensagem celebratória de reserva completa ou meta atingida
                      </span>
                    </div>
                    <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>
                </div>

                {/* Configurable Alert Triggers */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Gatilhos Automáticos Ativos:
                  </span>

                  {state.alertRules.map(rule => {
                    const isParcelRule = rule.type === 'parcel_limit' || rule.id === 'rule-3';
                    const ruleTitle = isParcelRule
                      ? `Avisar se parcelas passarem de ${installmentLimitPercentage}% da renda`
                      : rule.title;

                    return (
                      <div
                        key={rule.id}
                        className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">
                          {ruleTitle}
                        </span>

                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={e => updateAlertRule({ ...rule, title: ruleTitle, enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Weekly Pulse Modal */}
      <WeeklyPulseModal
        isOpen={isPulseModalOpen}
        onClose={() => setIsPulseModalOpen(false)}
        pulseData={weeklyPulse}
        onExecuteAction={handleExecutePulseAction}
      />
    </>
  );
};
