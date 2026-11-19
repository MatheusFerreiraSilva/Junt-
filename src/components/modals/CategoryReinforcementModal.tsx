import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Info,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { CATEGORIES_BASE, useFinance } from '../../context/FinanceContext';
import { CategoryKey } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';
import type {
  EligibleReinforcementSource,
  ReinforcementDistributionMode,
} from '../../utils/financialCommands';

interface CategoryReinforcementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: CategoryKey;
  initialSourceId?: string;
  initialSourceKind?: 'goal_withdrawal' | 'piggy_bank';
}

const CANONICAL_CATEGORIES: CategoryKey[] = [
  'moradia',
  'transporte',
  'comida',
  'lazer',
  'protecao',
  'profissional',
];

const formatSignedCurrency = (val: number): string => {
  if (val < -0.005) return `-${formatCurrency(Math.abs(val))}`;
  return formatCurrency(Math.abs(val) < 0.005 ? 0 : val);
};

export const CategoryReinforcementModal: React.FC<CategoryReinforcementModalProps> = ({
  isOpen,
  onClose,
  initialCategory,
  initialSourceId,
  initialSourceKind,
}) => {
  const {
    state,
    viewMode,
    eligibleReinforcementSources,
    previewCategoryReinforcementAction,
    reinforceCategoryFromSource,
  } = useFinance();

  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [mode, setMode] = useState<ReinforcementDistributionMode>('single_100');
  const [singleCategory, setSingleCategory] = useState<CategoryKey>(initialCategory || 'lazer');
  const [selectedMultiCategories, setSelectedMultiCategories] = useState<CategoryKey[]>(
    initialCategory ? [initialCategory] : ['moradia', 'lazer']
  );
  const [customPercentages, setCustomPercentages] = useState<Record<CategoryKey, string>>({
    moradia: '50',
    transporte: '0',
    comida: '0',
    lazer: '50',
    protecao: '0',
    profissional: '0',
  });
  const [confirmResidue, setConfirmResidue] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const scope: 'casal' | 'partner1' | 'partner2' =
    viewMode === 'partner1' ? 'partner1' : viewMode === 'partner2' ? 'partner2' : 'casal';

  const makeSourceKey = (s: EligibleReinforcementSource) => `${s.kind}:${s.id}`;

  // Sync defaults whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setConfirmResidue(false);
    if (initialCategory) {
      setSingleCategory(initialCategory);
      setSelectedMultiCategories([initialCategory]);
    }
    const eligible = eligibleReinforcementSources.filter((s) => s.eligible);
    let chosen: EligibleReinforcementSource | undefined;
    if (initialSourceId) {
      chosen = eligible.find(
        (s) =>
          (!initialSourceKind || s.kind === initialSourceKind) &&
          (s.id === initialSourceId || s.sourceOperationId === initialSourceId || s.goalId === initialSourceId)
      );
    }
    if (!chosen) chosen = eligible[0];
    if (chosen) {
      setSelectedSourceKey(makeSourceKey(chosen));
      setAmountInput((chosen.remainingCents / 100).toFixed(2));
    } else {
      setSelectedSourceKey('');
      setAmountInput('');
    }
  }, [isOpen, initialCategory, initialSourceId, initialSourceKind, eligibleReinforcementSources]);

  const selectedSource = useMemo(
    () => eligibleReinforcementSources.find((s) => makeSourceKey(s) === selectedSourceKey),
    [eligibleReinforcementSources, selectedSourceKey]
  );

  const parsedAmountCents = useMemo(() => {
    const normalized = amountInput.replace(',', '.').trim();
    const num = parseFloat(normalized);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [amountInput]);

  const targets = useMemo(() => {
    if (mode === 'single_100') {
      return [{ category: singleCategory, percentage: 100 }];
    }
    if (mode === 'equal_split') {
      return selectedMultiCategories.map((category) => ({ category }));
    }
    return selectedMultiCategories.map((category) => ({
      category,
      percentage: parseFloat((customPercentages[category] || '0').replace(',', '.')) || 0,
    }));
  }, [mode, singleCategory, selectedMultiCategories, customPercentages]);

  const preview = useMemo(() => {
    if (!isOpen || !selectedSource || !selectedSource.eligible || parsedAmountCents <= 0) {
      return null;
    }
    return previewCategoryReinforcementAction({
      sourceKind: selectedSource.kind,
      sourceId: selectedSource.id,
      amountCents: parsedAmountCents,
      competence: state.currentMonth,
      scope,
      mode,
      targets,
    });
  }, [
    isOpen,
    selectedSource,
    parsedAmountCents,
    state.currentMonth,
    scope,
    mode,
    targets,
    previewCategoryReinforcementAction,
  ]);

  if (!isOpen) return null;

  const eligibleList = eligibleReinforcementSources.filter((s) => s.eligible);
  const blockedList = eligibleReinforcementSources.filter((s) => !s.eligible);

  const handleToggleMultiCategory = (cat: CategoryKey) => {
    setConfirmResidue(false);
    setSelectedMultiCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSwitchToEqualSplit = () => {
    setMode('equal_split');
    setConfirmResidue(false);
    setErrorMsg('');
  };

  const handleNormalizeCustomTo100 = () => {
    if (selectedMultiCategories.length === 0) return;
    const count = selectedMultiCategories.length;
    const basePct = Math.floor((10000 / count)) / 100;
    const remainder = Number((100 - basePct * count).toFixed(2));
    const next = { ...customPercentages };
    selectedMultiCategories.forEach((cat, idx) => {
      next[cat] = idx === 0 ? (basePct + remainder).toFixed(2) : basePct.toFixed(2);
    });
    setCustomPercentages(next);
    setConfirmResidue(false);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedSource) {
      setErrorMsg('Selecione uma origem líquida elegível para aplicar o reforço.');
      return;
    }
    if (!selectedSource.eligible) {
      setErrorMsg(selectedSource.blockedReason || 'Esta origem ainda está aguardando liquidação.');
      return;
    }
    if (parsedAmountCents <= 0) {
      setErrorMsg('Informe um valor positivo para reforçar o orçamento.');
      return;
    }
    if (!preview || !preview.ok) {
      setErrorMsg(preview?.error || 'Revise os valores e porcentagens do reforço.');
      return;
    }
    if (preview.requiresResidueConfirmation && !confirmResidue) {
      setErrorMsg(
        `A distribuição soma ${preview.distribution.totalPercentage.toFixed(2)}% com resíduo de ${preview.distribution.residualPercentage.toFixed(2)}%. Ajuste para 100% ou marque a confirmação explícita.`
      );
      return;
    }

    try {
      const res = reinforceCategoryFromSource({
        sourceKind: selectedSource.kind,
        sourceId: selectedSource.id,
        amountCents: parsedAmountCents,
        competence: state.currentMonth,
        scope,
        mode,
        targets,
        confirmUnallocatedRemainder: confirmResidue,
        expectedRevision: selectedSource.revision,
        note: noteInput.trim() || undefined,
      });
      if (res.status !== 'success') {
        setErrorMsg(res.message || 'Não foi possível registrar o reforço temporário.');
        return;
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao executar comando de reforço.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reforço Temporário de Orçamento por Origem"
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-sky-300 dark:border-sky-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-sky-50/70 dark:bg-sky-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white leading-tight">
                Reforçar Orçamento do Mês ({state.currentMonth})
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Amplie temporariamente o teto de categorias mantendo renda, metas base e % intactas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de reforço"
            className="w-9 h-9 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Source Selection */}
          <div className="space-y-2">
            <label htmlFor="reinf-source-select" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Origem Patrimonial Líquida
            </label>

            {eligibleList.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Nenhuma origem elegível com saldo disponível no momento (resgate liquidado ou cofrinho com saldo positivo).
              </div>
            ) : (
              <select
                id="reinf-source-select"
                value={selectedSourceKey}
                onChange={(e) => {
                  const nextKey = e.target.value;
                  setSelectedSourceKey(nextKey);
                  setConfirmResidue(false);
                  setErrorMsg('');
                  const nextSource = eligibleList.find((s) => makeSourceKey(s) === nextKey);
                  if (nextSource) {
                    setAmountInput((nextSource.remainingCents / 100).toFixed(2));
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
              >
                {eligibleList.map((src) => (
                  <option key={makeSourceKey(src)} value={makeSourceKey(src)}>
                    {src.label} — Disponível: {formatCurrency(src.remainingR$)} ({src.subtitle})
                  </option>
                ))}
              </select>
            )}

            {/* Blocked pending-settlement sources listed transparently */}
            {blockedList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {blockedList.map((blk) => (
                  <div
                    key={makeSourceKey(blk)}
                    data-testid="blocked-reinforcement-source"
                    className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex items-center justify-between gap-2 text-[11px] opacity-85"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-black text-slate-800 dark:text-slate-200 truncate">
                          {blk.label} ({formatCurrency(blk.remainingR$)})
                        </div>
                        <div className="text-amber-800 dark:text-amber-300 font-semibold">
                          {blk.blockedReason || 'Aguardando liquidação para poder reforçar categorias.'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-black text-[10px] shrink-0">
                      Aguardando liquidação
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Amount Input */}
          {selectedSource && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reinf-amount-input" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Valor do Reforço (R$)
                </label>
                <input
                  id="reinf-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(selectedSource.remainingCents / 100).toFixed(2)}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-base tabular-nums text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1 block">
                  Máximo líquido elegível: {formatCurrency(selectedSource.remainingR$)}
                </span>
              </div>

              <div>
                <label htmlFor="reinf-note-input" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Observação (Opcional)
                </label>
                <input
                  id="reinf-note-input"
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ex: Reforço para viagem / reforma do mês"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 3. Distribution Mode & Target Categories */}
          <div className="space-y-3">
            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              3. Modo de Distribuição
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('single_100');
                  setConfirmResidue(false);
                }}
                className={`py-2 px-3 rounded-xl font-black border text-xs transition-all cursor-pointer ${
                  mode === 'single_100'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                100% em uma categoria
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('custom_percent');
                  setConfirmResidue(false);
                }}
                className={`py-2 px-3 rounded-xl font-black border text-xs transition-all cursor-pointer ${
                  mode === 'custom_percent'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Porcentagem editável
              </button>
              <button
                type="button"
                onClick={handleSwitchToEqualSplit}
                className={`py-2 px-3 rounded-xl font-black border text-xs transition-all cursor-pointer ${
                  mode === 'equal_split'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Dividir igualmente
              </button>
            </div>

            {mode === 'single_100' ? (
              <div>
                <label htmlFor="reinf-single-category" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Categoria de destino (100%)
                </label>
                <select
                  id="reinf-single-category"
                  value={singleCategory}
                  onChange={(e) => setSingleCategory(e.target.value as CategoryKey)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  {CANONICAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORIES_BASE[cat]?.emoji} {CATEGORIES_BASE[cat]?.name || cat}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CANONICAL_CATEGORIES.map((cat) => {
                  const checked = selectedMultiCategories.includes(cat);
                  const info = CATEGORIES_BASE[cat];
                  return (
                    <div
                      key={cat}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                        checked
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <label className="flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleMultiCategory(cat)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{info?.emoji}</span>
                        <span>{info?.name || cat}</span>
                      </label>

                      {mode === 'custom_percent' && checked && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            aria-label={`Porcentagem para ${info?.name || cat}`}
                            value={customPercentages[cat] || '0'}
                            onChange={(e) => {
                              setConfirmResidue(false);
                              setCustomPercentages((prev) => ({ ...prev, [cat]: e.target.value }));
                            }}
                            className="w-20 px-2 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-right font-black tabular-nums"
                          />
                          <span className="font-bold text-slate-500">%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Residue Guard Warning */}
          {preview?.requiresResidueConfirmation && (
            <div
              data-testid="residue-warning-banner"
              className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 space-y-2.5 text-amber-950 dark:text-amber-100"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black">
                    Soma {preview.distribution.totalPercentage.toFixed(2)}% • Resíduo de{' '}
                    {preview.distribution.residualPercentage.toFixed(2)}% ({formatCurrency(preview.distribution.unallocatedCents / 100)} não alocados)
                  </div>
                  <p className="text-[11px] font-medium mt-0.5">
                    Escolha dividir igualmente em centavos exatos, ajustar para 100% ou confirmar explicitamente o resíduo restante na origem.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSwitchToEqualSplit}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] cursor-pointer"
                >
                  Dividir igualmente (100%)
                </button>
                <button
                  type="button"
                  onClick={handleNormalizeCustomTo100}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-400 text-amber-900 dark:text-amber-200 font-black text-[11px] cursor-pointer"
                >
                  Ajustar soma para 100%
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmResidue}
                  onChange={(e) => {
                    setConfirmResidue(e.target.checked);
                    if (e.target.checked) setErrorMsg('');
                  }}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="font-bold text-[11px]">
                  Confirmar mesmo com resíduo não alocado ({formatCurrency(preview.distribution.unallocatedCents / 100)})
                </span>
              </label>
            </div>
          )}

          {/* 4. Non-Mutating Live Preview */}
          {preview && (
            <div
              data-testid="reinforcement-live-preview"
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border-2 border-sky-200 dark:border-sky-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Prévia do Impacto ({preview.competence})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px]">
                    Renda do mês (inalterada): {formatCurrency(preview.totalIncomeUnchangedR$)}
                  </span>
                  {preview.isSourceReconciled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> Conciliado
                    </span>
                  ) : preview.sourceEvidenceType === 'virtual_earmark' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-black text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> Reserva em cofrinho
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-[10px]">
                      <FileText className="w-3 h-3" /> Manual
                    </span>
                  )}
                </div>
              </div>

              {(preview.verifiableCashStatus === 'unknown' || preview.verifiableCashStatus === 'partial') &&
                preview.verifiableCashNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>{preview.verifiableCashNotice}</span>
                  </div>
                )}

              {preview.ok ? (
                <div className="space-y-2">
                  {preview.categoryPreviews.map((row) => (
                    <div
                      key={row.category}
                      data-testid={`preview-row-${row.category}`}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center"
                    >
                      <div>
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <span>{row.categoryEmoji}</span>
                          <span>{row.categoryName}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          % habitual intacta: {row.basePercentage}%
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block font-bold">Base → Efetivo</span>
                        <span className="font-black tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(row.baseHabitualBudgetR$)} → {formatCurrency(row.newEffectiveBudgetR$)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-sky-700 dark:text-sky-300 block font-bold">Reforço</span>
                        <span className="font-black tabular-nums text-blue-700 dark:text-sky-300">
                          +{formatCurrency(row.newReinforcementR$)} ({row.percentageApplied.toFixed(2)}%)
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block font-bold">Saldo nominal</span>
                        <span
                          className={`font-black tabular-nums ${
                            row.newNominalBalanceR$ < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {formatSignedCurrency(row.currentNominalBalanceR$)} → {formatSignedCurrency(row.newNominalBalanceR$)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-rose-700 dark:text-rose-300 font-bold">
                  {preview.error}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedSource || !preview?.ok}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black shadow-sm cursor-pointer"
            >
              Confirmar Reforço Temporário
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
