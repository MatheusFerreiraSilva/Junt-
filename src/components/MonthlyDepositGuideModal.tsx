import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Shield,
  Target,
  Unlock,
  Edit3,
  X,
  ExternalLink,
  Check,
  Building,
  RotateCcw,
  Info,
  Copy,
  SlidersHorizontal,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { MonthlyDepositItem } from '../types/finance';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

interface MonthlyDepositGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMonth?: string;
  initialTab?: 'summary' | 'customize';
}

export const MonthlyDepositGuideModal: React.FC<MonthlyDepositGuideModalProps> = ({
  isOpen,
  onClose,
  targetMonth,
  initialTab = 'summary',
}) => {
  const {
    state,
    investmentCeiling,
    getMonthlyDepositGuide,
    updateDepositGuideStrategy,
    approveMonthlyDepositGuide,
    executeMonthlyDeposit,
    resetMonthlyDeposit,
  } = useFinance();

  const monthKey = targetMonth || state.currentMonth;
  const guide = useMemo(
    () => getMonthlyDepositGuide(monthKey),
    [getMonthlyDepositGuide, monthKey]
  );
  const completionRecord = state.completedMonthDeposits?.[monthKey];
  const isCompleted = guide.status === 'completed' || !!completionRecord;

  // Tabs: 'summary' (Resumo Didático) vs 'customize' (Direcionar Sobras & Fixo)
  const [activeTab, setActiveTab] = useState<'summary' | 'customize'>(initialTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFixedEditor, setShowFixedEditor] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Ceiling calculations
  const ceiling = guide.suggestedCeiling ?? investmentCeiling.suggestedCeiling;
  const programmedBase = guide.programmedBase ?? investmentCeiling.programmedBase;
  const eligibleSurplus = guide.eligibleSurplus ?? investmentCeiling.eligibleSurplus;
  const shieldedEssential = guide.shieldedEssential ?? investmentCeiling.shieldedFixedEssential;

  // Local editing states for surplus and base amounts
  const [surplusInputs, setSurplusInputs] = useState<Record<string, string>>({});
  const [baseInputs, setBaseInputs] = useState<Record<string, string>>({});

  // Sync inputs whenever modal opens or month changes
  useEffect(() => {
    if (isOpen) {
      const g = getMonthlyDepositGuide(monthKey);
      const initSurplus: Record<string, string> = {};
      const initBase: Record<string, string> = {};
      g.items.forEach(it => {
        initSurplus[it.id] = it.surplusAmount.toString();
        initBase[it.id] = it.baseAmount.toString();
      });
      setSurplusInputs(initSurplus);
      setBaseInputs(initBase);
      setActiveTab(initialTab);
      setShowResetConfirm(false);
    }
  }, [isOpen, monthKey, initialTab, getMonthlyDepositGuide]);

  if (!isOpen) return null;

  // Dynamic calculations for customization
  const totalAllocatedSurplus = guide.items.reduce((sum, it) => {
    const raw = surplusInputs[it.id] !== undefined ? surplusInputs[it.id] : it.surplusAmount.toString();
    const val = parseFloat(raw.replace(',', '.')) || 0;
    return sum + Math.max(0, val);
  }, 0);

  const totalAllocatedBase = guide.items.reduce((sum, it) => {
    const raw = baseInputs[it.id] !== undefined ? baseInputs[it.id] : it.baseAmount.toString();
    const val = parseFloat(raw.replace(',', '.')) || 0;
    return sum + Math.max(0, val);
  }, 0);

  const surplusRemaining = eligibleSurplus - totalAllocatedSurplus;
  const grandTotalCalculated = totalAllocatedBase + totalAllocatedSurplus;

  const isOverCeiling = grandTotalCalculated > ceiling;
  const overCeilingDiff = Math.max(0, grandTotalCalculated - ceiling);

  // Quick Action Shortcuts for Surplus
  const handleDistributeSurplusEquallyToGoals = () => {
    const goalItems = guide.items.filter(it => it.block === 'goals');
    if (goalItems.length === 0) return;

    const perGoal = Math.round(eligibleSurplus / goalItems.length);
    const updated: Record<string, string> = { ...surplusInputs };
    guide.items.forEach(it => {
      if (it.block === 'goals') {
        updated[it.id] = perGoal.toString();
      } else {
        updated[it.id] = '0';
      }
    });
    setSurplusInputs(updated);
  };

  const handleSendAllSurplusToFreedom = () => {
    const updated: Record<string, string> = { ...surplusInputs };
    guide.items.forEach(it => {
      if (it.block === 'freedom') {
        updated[it.id] = eligibleSurplus.toString();
      } else {
        updated[it.id] = '0';
      }
    });
    setSurplusInputs(updated);
  };

  const handleSendAllSurplusToProtection = () => {
    const updated: Record<string, string> = { ...surplusInputs };
    guide.items.forEach(it => {
      if (it.block === 'protection') {
        updated[it.id] = eligibleSurplus.toString();
      } else {
        updated[it.id] = '0';
      }
    });
    setSurplusInputs(updated);
  };

  const handleResetSurplusToZero = () => {
    const updated: Record<string, string> = { ...surplusInputs };
    guide.items.forEach(it => {
      updated[it.id] = '0';
    });
    setSurplusInputs(updated);
  };

  // Save changes from customization and navigate to summary view
  const handleSaveCustomAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedItems: MonthlyDepositItem[] = guide.items.map(it => {
      const parsedSurplus = parseFloat((surplusInputs[it.id] ?? it.surplusAmount.toString()).replace(',', '.')) || 0;
      const parsedBase = parseFloat((baseInputs[it.id] ?? it.baseAmount.toString()).replace(',', '.')) || 0;
      const clampedSurplus = Math.max(0, parsedSurplus);
      const clampedBase = Math.max(0, parsedBase);
      const newTotal = clampedBase + clampedSurplus;

      return {
        ...it,
        baseAmount: clampedBase,
        surplusAmount: clampedSurplus,
        totalAmount: newTotal,
        instruction: it.instruction.replace(/R\$\s*[\d.,]+/, `R$ ${newTotal.toLocaleString('pt-BR')}`),
      };
    });

    approveMonthlyDepositGuide(monthKey, updatedItems);
    setActiveTab('summary');
  };

  const handleApproveGuide = () => {
    approveMonthlyDepositGuide(monthKey);
  };

  const handleConfirmDone = () => {
    executeMonthlyDeposit(monthKey);
  };

  const handleCopyAmount = (id: string, amount: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(amount.toString());
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shrink-0 shadow-sm">
              🏦
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-lg sm:text-xl text-slate-950 dark:text-white font-display">
                  Guia Didático de Aportes do Mês
                </h3>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                  {formatMonthYear(monthKey)}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                Os 10% fixos combinados + o direcionamento personalizável das sobras do mês.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs (quando não concluído) */}
        {!isCompleted && (
          <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-slate-50/70 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`pb-2.5 text-xs font-black transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'summary'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Resumo Didático Final</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customize')}
              className={`pb-2.5 text-xs font-black transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'customize'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Direcionar Sobras & Fixo</span>
              {surplusRemaining > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* ========================================================= */}
          {/* CASO JÁ CONCLUÍDO: SELO VISUAL DE CONCLUSÃO               */}
          {/* ========================================================= */}
          {isCompleted ? (
            <div className="space-y-4">
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border-2 border-emerald-400 dark:border-emerald-600 shadow-sm text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl shadow-md animate-bounce">
                  🏆
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Selo de Conclusão Mensal
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white font-display">
                    Os investimentos do mês de {formatMonthYear(monthKey)} já foram feitos com sucesso!
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 font-medium mt-1">
                    O futuro de vocês agradece. O total de <strong>{formatCurrency(completionRecord?.totalDeposited || guide.totalPlanned)}</strong> foi enviado e seus saldos já foram atualizados.
                  </p>
                </div>
              </div>

              {/* Detalhamento do que foi realizado com rótulos Fixo + Sobra */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Resumo das Transferências Confirmadas:
                </span>
                <div className="space-y-2">
                  {(completionRecord?.items || guide.items).map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-bold shrink-0">
                          {item.block === 'protection' ? '🛡️' : item.block === 'freedom' ? '🔓' : item.targetGoalEmoji || '🎯'}
                        </span>
                        <div className="min-w-0">
                          <strong className="text-xs font-black text-slate-900 dark:text-white block truncate">
                            {item.title}
                          </strong>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Fixo: {formatCurrency(item.baseAmount)}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Sobra: +{formatCurrency(item.surplusAmount)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                            Destino: {item.destinationLabel}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block font-display">
                          {formatCurrency(item.totalAmount)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">
                          Realizado ✓
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {showResetConfirm ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700/60 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h5 className="text-xs font-black text-amber-950 dark:text-amber-200">
                        Reabrir e revisar os aportes deste mês?
                      </h5>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        Os saldos que haviam sido adicionados serão estornados com total segurança para vocês fazerem novos ajustes sem duplicar valores.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetMonthlyDeposit(monthKey);
                        setShowResetConfirm(false);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Sim, estornar e reabrir</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reabrir Guia / Desfazer Confirmação</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs cursor-pointer shadow-sm"
                  >
                    Fechar Guia
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'customize' ? (
            /* ========================================================= */
            /* ABA 2: DIRECIONAR SOBRAS DE MANEIRA PERSONALIZÁVEL        */
            /* ========================================================= */
            <form onSubmit={handleSaveCustomAllocation} className="space-y-4">
              {/* Visor de Sobras em Tempo Real */}
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Painel de Direcionamento das Sobras
                    </span>
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    Contas fixas essenciais blindadas 🛡️
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sobras Disponíveis
                    </span>
                    <strong className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(eligibleSurplus)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sobras Direcionadas
                    </span>
                    <strong className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(totalAllocatedSurplus)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Saldo Restante
                    </span>
                    <strong
                      className={`text-base font-black tabular-nums ${
                        surplusRemaining === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : surplusRemaining > 0
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatCurrency(surplusRemaining)}
                    </strong>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>
                    {surplusRemaining === 0
                      ? '✨ 100% das sobras foram direcionadas com sucesso!'
                      : surplusRemaining > 0
                      ? `Vocês ainda têm ${formatCurrency(surplusRemaining)} de sobra livre para direcionar.`
                      : `Aporte consciente: ${formatCurrency(Math.abs(surplusRemaining))} além das sobras calculadas.`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowFixedEditor(!showFixedEditor)}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    {showFixedEditor ? 'Ocultar ajuste do fixo' : 'Ajustar também o valor fixo'}
                  </button>
                </div>

                {/* Atalhos Rápidos */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Atalhos:
                  </span>
                  <button
                    type="button"
                    onClick={handleDistributeSurplusEquallyToGoals}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                  >
                    Dividir sobras nos cofrinhos
                  </button>
                  <button
                    type="button"
                    onClick={handleSendAllSurplusToFreedom}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                  >
                    Tudo para Longo Prazo
                  </button>
                  <button
                    type="button"
                    onClick={handleSendAllSurplusToProtection}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                  >
                    Tudo para Proteção
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSurplusToZero}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-500 cursor-pointer transition-colors"
                  >
                    Zerar sobras
                  </button>
                </div>
              </div>

              {/* Lista dos Destinos para Alocação */}
              <div className="space-y-3">
                {guide.items.map(item => {
                  const currentSurplusVal = surplusInputs[item.id] ?? item.surplusAmount.toString();
                  const currentBaseVal = baseInputs[item.id] ?? item.baseAmount.toString();
                  const parsedSurplus = parseFloat(currentSurplusVal.replace(',', '.')) || 0;
                  const parsedBase = parseFloat(currentBaseVal.replace(',', '.')) || 0;
                  const targetTotal = parsedBase + parsedSurplus;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm">
                            {item.block === 'protection' ? '🛡️' : item.block === 'freedom' ? '🔓' : item.targetGoalEmoji || '🎯'}
                          </span>
                          <div>
                            <strong className="text-xs font-black text-slate-900 dark:text-white block">
                              {item.title}
                            </strong>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {item.destinationLabel}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Total Calculado
                          </span>
                          <strong className="text-base font-black text-slate-900 dark:text-white tabular-nums font-display">
                            {formatCurrency(targetTotal)}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                        {/* Linha do Fixo */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-600 dark:text-slate-400">
                              Parte Fixa (10%):
                            </span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">
                              {formatCurrency(parsedBase)}
                            </span>
                          </div>
                          {showFixedEditor && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs text-slate-400 font-bold">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={currentBaseVal}
                                onChange={e =>
                                  setBaseInputs(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-600 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          )}
                        </div>

                        {/* Campo de Direcionamento da Sobra */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              Sobra Adicional a Jogar:
                            </span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              +{formatCurrency(parsedSurplus)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-emerald-600 font-bold">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={currentSurplusVal}
                              onChange={e =>
                                setSurplusInputs(prev => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="0,00"
                              className="w-full px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botão de Salvar Alterações */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Voltar ao Resumo
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Salvar e Ver Resumo Didático</span>
                </button>
              </div>
            </form>
          ) : (
            /* ========================================================= */
            /* ABA 1: RESUMO DIDÁTICO FINAL & GUIA DE TRANSFERÊNCIA      */
            /* ========================================================= */
            <div className="space-y-4">
              {/* Card Resumo Consolidado */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Total Consolidado a Guardar no Mês
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums font-display">
                      {formatCurrency(guide.totalPlanned)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('customize')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black border border-slate-300 dark:border-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Personalizar Sobras & Fixo</span>
                  </button>
                </div>

                {/* Decomposição da Origem: Fixo vs Sobras */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Parte Fixa (10% da Renda)
                      </span>
                      <strong className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(guide.items.reduce((s, it) => s + it.baseAmount, 0))}
                      </strong>
                    </div>
                    <span className="text-base">📌</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Sobras Direcionadas
                      </span>
                      <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{formatCurrency(guide.items.reduce((s, it) => s + it.surplusAmount, 0))}
                      </strong>
                    </div>
                    <span className="text-base">✨</span>
                  </div>
                </div>
              </div>

              {/* FASE 1: Seletor de Estratégia & Banner do Acelerador de Reserva */}
              {!state.isProtectionComplete && (
                <div className="p-4 rounded-3xl bg-emerald-500/10 dark:bg-emerald-950/40 border-2 border-emerald-400/80 dark:border-emerald-600/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Fase 1 Ativa — Foco na Reserva de Emergência</span>
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                      Estratégia do Casal
                    </span>
                  </div>

                  {/* Se sem cofrinhos ativos, permite escolher entre Aceleração 100% ou Dividir */}
                  {state.piggyBanks.filter(g => !g.completed).length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                        Como vocês não possuem cofrinhos ativos no momento, para onde preferem direcionar a verba de investimentos do mês?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => updateDepositGuideStrategy(monthKey, '100_percent_reserve')}
                          className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            (guide.focusStrategy || '100_percent_reserve') === '100_percent_reserve'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black">🛡️ (Recomendado) 100% Reserva</span>
                            {(guide.focusStrategy || '100_percent_reserve') === '100_percent_reserve' && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <span className="text-[10px] opacity-90 block mt-1 font-normal">
                            Acelera a conquista da imunidade financeira o mais rápido possível.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateDepositGuideStrategy(monthKey, 'split_freedom')}
                          className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            guide.focusStrategy === 'split_freedom'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black">⚖️ Dividir 50% / 50%</span>
                            {guide.focusStrategy === 'split_freedom' && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <span className="text-[10px] opacity-90 block mt-1 font-normal">
                            50% Reserva de Emergência e 50% Liberdade Financeira.
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : guide.redirectedBlock2Surplus && guide.redirectedBlock2Surplus > 0 ? (
                    <div className="p-3 rounded-2xl bg-emerald-100/80 dark:bg-emerald-900/60 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Acelerador de Reserva Ativo:</strong> +{formatCurrency(guide.redirectedBlock2Surplus)} da verba não consumida dos cofrinhos foram redirecionados para fechar a Reserva de Emergência mais rápido!
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Aviso Amigável caso tenha ultrapassado o teto */}
              {isOverCeiling && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300/80 dark:border-amber-700/60 text-xs space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Aporte consciente acima do teto planejado (+{formatCurrency(overCeilingDiff)})</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Vocês definiram <strong>{formatCurrency(guide.totalPlanned)}</strong> para este mês, o que é <strong>{formatCurrency(overCeilingDiff)}</strong> acima da soma combinada de investimentos e sobras. Que iniciativa maravilhosa para acelerar o futuro a dois! Só dêem aquela conferida para garantir que as contas e compromissos dos próximos dias estão cobertos. Se estiverem seguros, podem aprovar e aportar com tranquilidade! 🚀
                  </p>
                </div>
              )}

              {/* Pergunta de Confirmação */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2.5">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  O guia de aportes do mês ficou em <strong>{formatCurrency(guide.totalPlanned)}</strong>. Confirmamos essa distribuição?
                </span>
              </div>

              {/* CARDS DIDÁTICOS POR SETOR: PROTEÇÃO, CAIXINHAS, LONGO PRAZO */}
              <div className="space-y-3">
                {guide.items.map(item => {
                  const blockBadgeColor =
                    item.block === 'protection'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : item.block === 'freedom'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';

                  const blockIcon =
                    item.block === 'protection' ? (
                      <Shield className="w-4 h-4 text-emerald-600" />
                    ) : item.block === 'freedom' ? (
                      <Unlock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Target className="w-4 h-4 text-sky-600" />
                    );

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 shadow-sm space-y-3 transition-all hover:border-slate-300"
                    >
                      {/* Top Header do Setor */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-700/80">
                            {blockIcon}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${blockBadgeColor}`}>
                                {item.title}
                              </span>
                            </div>
                            <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">
                              {item.destinationLabel}
                            </span>
                          </div>
                        </div>

                        {/* O TOTAL FINAL EM DESTAQUE COM BOTÃO COPIAR */}
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Total a Transferir
                            </span>
                            <span className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tabular-nums font-display block">
                              {formatCurrency(item.totalAmount)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyAmount(item.id, item.totalAmount)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0"
                            title="Copiar valor"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* DECOMPOSIÇÃO DIDÁTICA: DE ONDE VEIO ESSE VALOR */}
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                          <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                            <span className="text-slate-400 font-normal">Fixo (10%):</span>
                            <strong className="tabular-nums">{formatCurrency(item.baseAmount)}</strong>
                          </span>

                          <span className="text-slate-300 dark:text-slate-600">+</span>

                          <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                            <span className="text-emerald-500 font-normal">Sobra do Mês:</span>
                            <strong className="tabular-nums">+{formatCurrency(item.surplusAmount)}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.instruction}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explicação de Execução Manual */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                  <span>Como realizar os aportes:</span>
                </span>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Abram agora os aplicativos dos seus bancos ou corretoras externas (Nubank, Itaú, BTG, Inter, etc.) e realizem os Pix ou transferências para as caixinhas e cofrinhos indicados acima.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isCompleted && (
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              {activeTab === 'summary' && guide.status === 'pending_approval' && (
                <button
                  type="button"
                  onClick={handleApproveGuide}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-black transition-colors cursor-pointer"
                >
                  Aprovar Guia de Aportes
                </button>
              )}

              {activeTab === 'summary' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('customize')}
                  className="px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Personalizar Sobras</span>
                </button>
              )}
            </div>

            {/* O BOTÃO PRINCIPAL DE CONCLUSÃO SOLICITADO */}
            <button
              type="button"
              onClick={handleConfirmDone}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Já fiz os aportes do mês</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
