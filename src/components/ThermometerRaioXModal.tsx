import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Calendar,
  Shield,
  CreditCard,
  Plus,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  Check,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { ThermometerEngineResult, ExceptionalReservation } from '../utils/thermometerEngine';
import { useFinance } from '../context/FinanceContext';

interface ThermometerRaioXModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineResult: ThermometerEngineResult;
  onOpenExpenseModal: () => void;
  onNavigateTransactions: () => void;
}

export const ThermometerRaioXModal: React.FC<ThermometerRaioXModalProps> = ({
  isOpen,
  onClose,
  engineResult,
  onOpenExpenseModal,
  onNavigateTransactions,
}) => {
  const { state, triggerCelebration, recordWeeklyCheckIn } = useFinance();

  // Local interactive simulation state for exceptional weekend reservations
  const [reservations, setReservations] = useState<ExceptionalReservation[]>([]);
  const [newResTitle, setNewResTitle] = useState('');
  const [newResAmount, setNewResAmount] = useState('');
  const [showResForm, setShowResForm] = useState(false);

  // Local state for tight scenario shift delay simulation
  const [simulateShiftDelay, setSimulateShiftDelay] = useState(false);

  // Weekly check-in feedback state
  const [checkedInSuccess, setCheckedInSuccess] = useState(false);

  if (!isOpen) return null;

  const {
    scope,
    monthKey,
    expenseBudget,
    spentSoFar,
    pendingCommitmentsAmount,
    pendingCommitmentsList,
    totalConsumedAmount,
    signedMargin,
    deficitAmount,
    budgetConsumedPercent,
    isOverBudget,
    statusState,
    statusLabel,
    statusDescription,
    partner1Spent,
    partner2Spent,
    hasCashReconciliation,
    reconciledBankBalance,
    protectedFunds,
    availableCash,
    pendingMedicalReceivables,
    confirmedMedicalReceivables,
    daysRemainingInMonth,
    safeDailyLimit,
    baseProjectedClosingSpent,
    baseProjectedClosingMargin,
    ceilingScenarioSpent,
    ceilingScenarioMargin,
    tightProjectedClosingSpent,
    tightProjectedClosingMargin,
    projectionHypotheses,
    coverageStatus,
    coverageMessage,
    lastConferredDate,
    prioritizedActions,
    whatChangedSummary,
  } = engineResult;

  // Add reservation to local simulation
  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newResAmount.replace(',', '.')) || 0;
    if (amt <= 0 || !newResTitle.trim()) return;

    setReservations(prev => [
      ...prev,
      {
        id: `res-${Date.now()}`,
        title: newResTitle.trim(),
        amount: amt,
        date: new Date().toISOString().slice(0, 10),
        confirmed: true,
      },
    ]);

    setNewResTitle('');
    setNewResAmount('');
    setShowResForm(false);
  };

  const handleToggleReservation = (id: string) => {
    setReservations(prev =>
      prev.map(r => (r.id === id ? { ...r, confirmed: !r.confirmed } : r))
    );
  };

  const activeReservationsTotal = reservations
    .filter(r => r.confirmed)
    .reduce((sum, r) => sum + r.amount, 0);

  const netMarginAfterReservations = Math.max(0, signedMargin - activeReservationsTotal);
  const adjustedDailyLimit =
    daysRemainingInMonth > 0 && netMarginAfterReservations > 0
      ? Math.round(netMarginAfterReservations / daysRemainingInMonth)
      : 0;

  const handleWeeklyCheckIn = () => {
    recordWeeklyCheckIn();
    triggerCelebration();
    setCheckedInSuccess(true);
    setTimeout(() => setCheckedInSuccess(false), 4000);
  };

  const scopeLabel =
    scope === 'partner1'
      ? state.profile.partner1Name
      : scope === 'partner2'
      ? state.profile.partner2Name
      : 'Casal Consolidação';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xl font-black">
              🔍
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-950 dark:text-white leading-tight font-display">
                  Raio-X do Orçamento do Mês
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {scopeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Diagnóstico determinístico, 2 leituras e projeções
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* Toast de Conferência Semanal */}
          {checkedInSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Conferência semanal registrada com sucesso! Acompanhamento do casal atualizado.</span>
              </div>
            </div>
          )}

          {/* 1. SEÇÃO PRINCIPAL: DUAS LEITURAS COERENTES (PLANO vs CAIXA) */}
          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              1. As Duas Leituras Financeiras do Mês:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* LEITURA A: PLANO DO MÊS */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    A. Plano do Mês (Determinístico)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200">
                    {budgetConsumedPercent !== null ? `${budgetConsumedPercent}% consumido` : 'Sem Teto'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Margem Livre do Plano:</span>
                  <div className={`text-2xl font-black tabular-nums font-display ${isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-white'}`}>
                    {isOverBudget ? `-${formatCurrency(deficitAmount)}` : formatCurrency(signedMargin)}
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="flex justify-between">
                    <span>Orçamento de Despesas:</span>
                    <strong className="tabular-nums">{formatCurrency(expenseBudget)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Já Gasto:</span>
                    <strong className="tabular-nums">{formatCurrency(spentSoFar)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Compromissos Pendentes:</span>
                    <strong className="tabular-nums">{formatCurrency(pendingCommitmentsAmount)}</strong>
                  </div>
                </div>
              </div>

              {/* LEITURA B: CAIXA INFORMADO */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-400">
                    B. Caixa Informado (Bancos)
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hasCashReconciliation ? 'bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-200' : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200'}`}>
                    {hasCashReconciliation ? 'Reconciliado' : 'Aguardando Conexão'}
                  </span>
                </div>

                {hasCashReconciliation ? (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 block">Saldo Livre em Conta:</span>
                    <div className="text-2xl font-black tabular-nums font-display text-slate-950 dark:text-white">
                      {formatCurrency(availableCash)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 py-1">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Informem ou conectem a conta bancária para visualizar a leitura de caixa. O Plano do Mês ao lado funciona de forma autônoma.
                    </p>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="flex justify-between">
                    <span>Plantões Confirmados:</span>
                    <strong className="tabular-nums text-emerald-600">{formatCurrency(confirmedMedicalReceivables)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Plantões a Receber:</span>
                    <strong className="tabular-nums text-amber-600">{formatCurrency(pendingMedicalReceivables)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. RITMO DIÁRIO SEGURO & SIMULADOR DE GASTOS EXCEPCIONAIS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                  Ritmo Diário Seguro para os Próximos {daysRemainingInMonth} Dias
                </span>
              </div>
              <span className="text-sm font-black text-emerald-950 dark:text-emerald-100 tabular-nums">
                {formatCurrency(adjustedDailyLimit)} / dia
              </span>
            </div>

            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              Gastando até <strong>{formatCurrency(adjustedDailyLimit)}/dia</strong> nos {daysRemainingInMonth} dias restantes do mês, vocês chegam ao final do período mantendo o plano exatamente no azul.
            </p>

            {/* Reserva de Gasto Excepcional no Fim de Semana */}
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span>Reserva para Passeio / Gastos do Fim de Semana:</span>
                {!showResForm && (
                  <button
                    type="button"
                    onClick={() => setShowResForm(true)}
                    className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 underline cursor-pointer hover:text-emerald-950"
                  >
                    + Simular Gasto
                  </button>
                )}
              </div>

              {showResForm && (
                <form onSubmit={handleAddReservation} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Jantar / Viagem"
                      value={newResTitle}
                      onChange={e => setNewResTitle(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Valor R$"
                      value={newResAmount}
                      onChange={e => setNewResAmount(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResForm(false)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg text-[11px] font-black bg-emerald-600 text-white cursor-pointer shadow-xs"
                    >
                      Reservar no Ritmo
                    </button>
                  </div>
                </form>
              )}

              {reservations.length > 0 && (
                <div className="space-y-1.5">
                  {reservations.map(r => (
                    <div key={r.id} className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.confirmed}
                          onChange={() => handleToggleReservation(r.id)}
                          className="rounded text-emerald-600 cursor-pointer"
                        />
                        <span className={r.confirmed ? 'font-bold text-slate-900 dark:text-white' : 'line-through text-slate-400'}>
                          {r.title}
                        </span>
                      </div>
                      <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {formatCurrency(r.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. PROJEÇÃO DE FECHAMENTO DO MÊS COM HIPÓTESES */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                3. Projeção do Fechamento do Mês:
              </span>
              <button
                type="button"
                onClick={() => setSimulateShiftDelay(!simulateShiftDelay)}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-400 underline cursor-pointer"
              >
                {simulateShiftDelay ? 'Voltar ao Cenário Base' : 'Simular Atraso de Plantão'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Ritmo Realizado
                </span>
                <div className="text-base font-black text-slate-950 dark:text-white tabular-nums mt-0.5">
                  {formatCurrency(baseProjectedClosingSpent)}
                </div>
                <span className={`text-[10px] font-bold block mt-0.5 ${baseProjectedClosingMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Margem: {formatCurrency(baseProjectedClosingMargin)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300 block">
                  Cenário Teto Limite
                </span>
                <div className="text-base font-black text-sky-950 dark:text-sky-100 tabular-nums mt-0.5">
                  {formatCurrency(ceilingScenarioSpent ?? expenseBudget)}
                </div>
                <span className="text-[10px] text-sky-700 dark:text-sky-300 font-bold block mt-0.5">
                  Margem: {formatCurrency(ceilingScenarioMargin ?? 0)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                  Aperto Simulado
                </span>
                <div className="text-base font-black text-amber-950 dark:text-amber-100 tabular-nums mt-0.5">
                  {formatCurrency(tightProjectedClosingSpent)}
                </div>
                <span className={`text-[10px] font-bold block mt-0.5 ${tightProjectedClosingMargin >= 0 ? 'text-amber-800 dark:text-amber-300' : 'text-rose-600'}`}>
                  Margem: {formatCurrency(tightProjectedClosingMargin)}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-bold block text-slate-700 dark:text-slate-300">Hipóteses da Projeção:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {projectionHypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4. AS TOP 3 AÇÕES DE DECISÃO RECOMENDADAS */}
          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              4. Ações Prioritárias de Decisão do Casal:
            </span>

            <div className="space-y-2">
              {prioritizedActions.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-0.5">
                    <strong className="text-xs font-black text-slate-950 dark:text-white block">
                      {act.title}
                    </strong>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {act.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (act.actionType === 'review_pending' || act.actionType === 'pay_bill') {
                        onNavigateTransactions();
                      } else {
                        onOpenExpenseModal();
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                  >
                    Acessar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 5. CONFERÊNCIA SEMANAL DO CASAL & O QUE MUDOU */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <strong className="text-slate-900 dark:text-white block font-black">
                O que mudou na última conferência:
              </strong>
              <span className="text-slate-600 dark:text-slate-400 font-medium block mt-0.5">
                {whatChangedSummary.newEntriesCount} lançamento(s) recente(s) totalizando {formatCurrency(whatChangedSummary.newEntriesTotal)}. Última conferência: {lastConferredDate}.
              </span>
            </div>

            <button
              type="button"
              onClick={handleWeeklyCheckIn}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs transition-all active:scale-95"
            >
              Conferir Semana com o Par
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => {
              onClose();
              onOpenExpenseModal();
            }}
            className="btn-primary-accent px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow-xs"
          >
            + Lançar Gasto Agora
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigateTransactions();
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-xs cursor-pointer"
          >
            Ver Extrato Completo
          </button>
        </div>
      </div>
    </div>
  );
};
