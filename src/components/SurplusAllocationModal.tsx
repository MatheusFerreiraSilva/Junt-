import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Target,
  Unlock,
  CheckCircle2,
  X,
  History,
  Info,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { CategoryKey } from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface SurplusAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGoalsTab?: () => void;
  onOpenGuideModal?: () => void;
}

export const SurplusAllocationModal: React.FC<SurplusAllocationModalProps> = ({
  isOpen,
  onClose,
  onOpenGoalsTab,
  onOpenGuideModal,
}) => {
  const {
    state,
    categoriesSpending,
    allocateCategorySurplus,
    dismissMonthSurplusNotification,
    surplusTransfers,
  } = useFinance();

  // Categories with positive remaining balance (sobra)
  const positiveSurplusCategories = (Object.keys(CATEGORIES_BASE) as CategoryKey[])
    .map(key => ({
      key,
      name: CATEGORIES_BASE[key].name,
      emoji: CATEGORIES_BASE[key].emoji,
      budget: categoriesSpending[key]?.budget || 0,
      spent: categoriesSpending[key]?.spent || 0,
      remaining: Math.max(0, categoriesSpending[key]?.remaining || 0),
    }))
    .filter(c => c.remaining > 0);

  // Per-category allocation states: { [key]: { selected: boolean; amount: string; destinationType: 'protection' | 'goal' | 'freedom'; goalId?: string } }
  const [allocationConfigs, setAllocationConfigs] = useState<
    Record<
      CategoryKey,
      {
        selected: boolean;
        amount: string;
        destinationType: 'protection' | 'goal' | 'freedom';
        goalId?: string;
      }
    >
  >(() => {
    const initial: any = {};
    (Object.keys(CATEGORIES_BASE) as CategoryKey[]).forEach(k => {
      const rem = Math.max(0, categoriesSpending[k]?.remaining || 0);
      initial[k] = {
        selected: false,
        amount: rem > 0 ? rem.toString() : '',
        destinationType: state.isProtectionComplete ? 'goal' : 'protection',
        goalId: state.piggyBanks[0]?.id || '',
      };
    });
    return initial;
  });

  const [activeTab, setActiveTab] = useState<'allocate' | 'history'>('allocate');
  const [confirmedTransfersCount, setConfirmedTransfersCount] = useState<number>(0);

  if (!isOpen) return null;

  const handleToggleCategory = (catKey: CategoryKey) => {
    setAllocationConfigs(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        selected: !prev[catKey]?.selected,
        amount: prev[catKey]?.amount || Math.max(0, categoriesSpending[catKey]?.remaining || 0).toString(),
      },
    }));
  };

  const handleAmountChange = (catKey: CategoryKey, val: string) => {
    setAllocationConfigs(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        amount: val,
      },
    }));
  };

  const handleSetMax = (catKey: CategoryKey, maxVal: number) => {
    setAllocationConfigs(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        amount: maxVal.toString(),
      },
    }));
  };

  const handleDestTypeChange = (catKey: CategoryKey, destType: 'protection' | 'goal' | 'freedom') => {
    setAllocationConfigs(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        destinationType: destType,
        goalId: destType === 'goal' ? prev[catKey]?.goalId || state.piggyBanks[0]?.id : undefined,
      },
    }));
  };

  const handleGoalSelect = (catKey: CategoryKey, goalId: string) => {
    setAllocationConfigs(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        goalId,
      },
    }));
  };

  const handleExecuteSelectedAllocations = () => {
    let executed = 0;
    positiveSurplusCategories.forEach(cat => {
      const cfg = allocationConfigs[cat.key];
      if (cfg?.selected) {
        const val = parseFloat(cfg.amount.replace(',', '.')) || 0;
        if (val > 0) {
          const clampedVal = Math.min(val, cat.remaining);
          let targetGoalName = '';
          if (cfg.destinationType === 'goal') {
            const g = state.piggyBanks.find(p => p.id === cfg.goalId);
            targetGoalName = g ? `${g.emoji} ${g.name}` : 'Cofrinho de Objetivos';
          }

          allocateCategorySurplus(
            cat.key,
            clampedVal,
            cfg.destinationType,
            cfg.goalId,
            targetGoalName,
            `Direcionamento de sobra de ${cat.name} para cofrinho no fechamento do mês.`
          );
          executed++;
        }
      }
    });

    setConfirmedTransfersCount(executed);
    dismissMonthSurplusNotification(state.currentMonth);
    if (executed > 0) {
      setTimeout(() => {
        onClose();
        if (onOpenGuideModal) {
          onOpenGuideModal();
        }
      }, 1200);
    } else {
      onClose();
    }
  };

  const handleDismissNotification = () => {
    dismissMonthSurplusNotification(state.currentMonth);
    onClose();
  };

  const selectedTotalToTransfer = positiveSurplusCategories.reduce((sum, cat) => {
    const cfg = allocationConfigs[cat.key];
    if (cfg?.selected) {
      const val = parseFloat(cfg.amount.replace(',', '.')) || 0;
      return sum + Math.min(val, cat.remaining);
    }
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shrink-0 shadow-sm">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg sm:text-xl text-slate-950 dark:text-white font-display">
                  Direcionamento de Sobras do Mês
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                  Fechamento
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                Escolha categoria por categoria o que vocês querem guardar nos cofrinhos e o que preferem manter para planos futuros.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs: Direcionamento vs Histórico de Rotas */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-200 dark:border-slate-800 gap-4 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('allocate')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'allocate'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guardar Sobras nos Cofrinhos</span>
            {positiveSurplusCategories.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300">
                {positiveSurplusCategories.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Rotas de Origem & Destino ({surplusTransfers.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'allocate' ? (
            <>
              {confirmedTransfersCount > 0 ? (
                <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-400 text-center space-y-3 animate-in zoom-in-95">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h4 className="text-lg font-black text-emerald-950 dark:text-emerald-100">
                    Alocações Realizadas com Sucesso! 🎉
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-md mx-auto">
                    As sobras selecionadas foram direcionadas aos cofrinhos de destino com rastreabilidade total de origem e destino gravada no histórico.
                  </p>
                </div>
              ) : positiveSurplusCategories.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl mx-auto">
                    ⚖️
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Sem Sobras Residuais Registradas Neste Mês
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Todas as categorias consumiram seus limites ou fecharam exatamente no teto estipulado. Continue acompanhando os lançamentos!
                  </p>
                </div>
              ) : (
                <>
                  {/* Context Rule Banner */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                      <Info className="w-4 h-4 text-emerald-600" />
                      <span>Regra de Sobras do Juntô</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      Vocês têm total autonomia: <strong>selecione apenas as categorias que desejam transferir</strong>. Categorias não marcadas têm seu saldo <strong>100% mantido e intocado</strong> (ideal para cursos futuros, consultas médicas ou despesas planejadas).
                    </p>
                  </div>

                  {/* Positive Categories List */}
                  <div className="space-y-3">
                    {positiveSurplusCategories.map(cat => {
                      const cfg = allocationConfigs[cat.key];
                      const isSelected = cfg?.selected;
                      const customVal = parseFloat(cfg?.amount?.replace(',', '.') || '0') || 0;
                      const hasPartial = customVal > 0 && customVal < cat.remaining;

                      return (
                        <div
                          key={cat.key}
                          className={`p-4 rounded-2xl border-2 transition-all ${
                            isSelected
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleCategory(cat.key)}
                                className="w-5 h-5 rounded-md text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-lg">{cat.emoji}</span>
                                  <span className="font-black text-sm text-slate-950 dark:text-white">
                                    {cat.name}
                                  </span>
                                  {cat.key === 'moradia' && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                      <Shield className="w-3 h-3 text-emerald-600" />
                                      Blindada (Contas Fixas Essenciais)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Gasto: {formatCurrency(cat.spent)} de {formatCurrency(cat.budget)}
                                  {cat.key === 'moradia' && ' · Reserva operacional para contas fixas do lar'}
                                </div>
                              </div>
                            </label>

                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Sobra Residual
                              </span>
                              <strong className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                +{formatCurrency(cat.remaining)}
                              </strong>
                            </div>
                          </div>

                          {/* Expanded Configuration Controls when selected */}
                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 space-y-3 animate-in fade-in duration-200">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {/* Amount input */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      Valor a Retirar (R$):
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleSetMax(cat.key, cat.remaining)}
                                      className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      Toda a Sobra ({formatCurrency(cat.remaining)})
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={cfg?.amount}
                                    onChange={e => handleAmountChange(cat.key, e.target.value)}
                                    placeholder={cat.remaining.toString()}
                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white text-sm"
                                  />
                                  {hasPartial && (
                                    <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                                      Permanece em {cat.name}: <strong>{formatCurrency(cat.remaining - customVal)}</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Destination Selector */}
                                <div>
                                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Destino da Sobra:
                                  </span>
                                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button
                                      type="button"
                                      onClick={() => handleDestTypeChange(cat.key, 'protection')}
                                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer truncate ${
                                        cfg?.destinationType === 'protection'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                      }`}
                                    >
                                      🛡️ Proteção
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDestTypeChange(cat.key, 'goal')}
                                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer truncate ${
                                        cfg?.destinationType === 'goal'
                                          ? 'bg-sky-600 text-white shadow-xs'
                                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                      }`}
                                    >
                                      🎯 Cofrinho
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDestTypeChange(cat.key, 'freedom')}
                                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer truncate ${
                                        cfg?.destinationType === 'freedom'
                                          ? 'bg-amber-600 text-white shadow-xs'
                                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                      }`}
                                    >
                                      🔓 Liberdade
                                    </button>
                                  </div>

                                  {/* If Goal, select which piggy bank */}
                                  {cfg?.destinationType === 'goal' && (
                                    <div className="mt-2">
                                      {state.piggyBanks.length > 0 ? (
                                        <select
                                          value={cfg.goalId}
                                          onChange={e => handleGoalSelect(cat.key, e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white"
                                        >
                                          {state.piggyBanks.map(g => (
                                            <option key={g.id} value={g.id}>
                                              {g.emoji} {g.name} ({formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)})
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-[10px] text-amber-600 font-bold block mt-1">
                                          Nenhum cofrinho ativo. O valor irá para Proteção ou crie um na aba Meus Investimentos.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Tab History: Rastreabilidade de Origem e Destino */
            <div className="space-y-3">
              {surplusTransfers.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <History className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Nenhuma transferência de sobra realizada ainda
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quando vocês transferirem sobras de categorias no fechamento do mês, todo o trajeto detalhado ficará gravado aqui para auditoria do casal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {surplusTransfers.map(tr => {
                    const sourceCat = CATEGORIES_BASE[tr.sourceCategory];
                    return (
                      <div
                        key={tr.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-sm shrink-0">
                            {sourceCat?.emoji || '💰'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap font-black text-slate-900 dark:text-white">
                              <span>{sourceCat?.name || tr.sourceCategory}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {tr.targetGoalName}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              Data: {tr.date} · Mês de referência: {tr.monthKey}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <strong className="text-sm font-black text-slate-900 dark:text-white tabular-nums block">
                            {formatCurrency(tr.amount)}
                          </strong>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            Rastreado ✓
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {selectedTotalToTransfer > 0 ? (
              <span>
                Total selecionado para transferir: <strong>{formatCurrency(selectedTotalToTransfer)}</strong>
              </span>
            ) : (
              <span>Nenhuma categoria marcada para transferência.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismissNotification}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Agora Não
            </button>

            {positiveSurplusCategories.length > 0 && (
              <button
                onClick={handleExecuteSelectedAllocations}
                disabled={selectedTotalToTransfer <= 0}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  selectedTotalToTransfer > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                    : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                }`}
              >
                <span>Confirmar e Guardar nos Cofrinhos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
