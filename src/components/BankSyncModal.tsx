import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Building2,
  RefreshCw,
  Tag,
  CreditCard,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import {
  parseStatement,
  detectInternalTransferPairs,
  findReconciliationCandidates,
} from '../utils/statementImport';
import { formatCurrency } from '../utils/formatters';
import { detectRecurringSubscriptions } from '../utils/categorizationEngine';
import type { BankImportedTransaction, CategoryKey, PaidBy, ExpenseItem } from '../types/finance';

interface BankSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_BANKS = [
  'Nubank',
  'Itaú Personalité',
  'Banco do Brasil',
  'Bradesco',
  'Santander',
  'Banco Inter',
  'BTG Pactual',
  'C6 Bank',
  'XP Investimentos',
];

export const BankSyncModal: React.FC<BankSyncModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    importStatement,
    reviewBankTransaction,
    updatePushSettings,
    triggerCelebration,
    verifiableCashSummary,
    setCashBalanceAnchor,
    linkCanonicalAccount,
    reconcileBankTransactionWithOperation,
    confirmInternalTransferPair,
  } = useFinance();

  const [account, setAccount] = useState<string>('Nubank');
  const [owner, setOwner] = useState<PaidBy>('both');
  const [preview, setPreview] = useState<BankImportedTransaction[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, CategoryKey>>({});
  const [anchorBalanceInputs, setAnchorBalanceInputs] = useState<Record<string, string>>({});
  const [anchorCutoffInputs, setAnchorCutoffInputs] = useState<Record<string, string>>({});
  const [selectedReconcileOps, setSelectedReconcileOps] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus(isOpen, onClose);

  const knownIds = useMemo(
    () => new Set((state.bankImportedTransactions || []).map(t => t.id)),
    [state.bankImportedTransactions]
  );

  const pendingTransactions = useMemo(
    () => (state.bankImportedTransactions || []).filter(t => t.status === 'pending'),
    [state.bankImportedTransactions]
  );

  // Subscriptions detected from current pending or newly parsed transactions
  const potentialSubscriptions = useMemo(() => {
    const candidateExpenses: ExpenseItem[] = [
      ...state.expenses,
      ...preview
        .filter(t => t.direction === 'debit')
        .map(t => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          category: (categoriesMap[t.id] || t.category || 'lazer') as CategoryKey,
          date: t.date,
          paidBy: t.owner,
        })),
    ];
    return detectRecurringSubscriptions(candidateExpenses);
  }, [state.expenses, preview, categoriesMap]);

  const internalTransferPairs = useMemo(
    () => detectInternalTransferPairs(state.bankImportedTransactions || [], state.linkedAccounts || []),
    [state.bankImportedTransactions, state.linkedAccounts]
  );

  const checkingAccountsForAnchor = useMemo(
    () =>
      verifiableCashSummary.accounts
        .filter(
          a =>
            (a.accountType === 'corrente' || a.accountType === 'poupanca') &&
            a.status !== 'excluded_credit' &&
            a.status !== 'excluded_locked'
        )
        .map(a => ({
          id: a.sourceAccountIds[0] || a.canonicalAccountId,
          canonicalAccountId: a.canonicalAccountId,
          bankName: a.bankName,
          accountType: a.accountType,
          balance: a.effectiveLiquidCents !== null ? a.effectiveLiquidCents / 100 : 0,
          verificationStatus: a.status === 'known' ? 'verified' : 'unverified',
        })),
    [verifiableCashSummary.accounts]
  );

  if (!isOpen) return null;

  const handleFileProcess = async (file?: File) => {
    setError('');
    setImportSuccessMsg('');
    if (!file) return;

    if (file.size > 8_000_000) {
      setError('O arquivo excede o limite de 8 MB.');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const report = await parseStatement(
        text,
        account.trim() || 'Conta Bancária',
        owner,
        state.keywordRules
      );

      if (report.acceptedCount === 0) {
        throw new Error('Nenhum lançamento válido encontrado no arquivo.');
      }

      // Initialize category overrides from auto-categorization
      const initialCatMap: Record<string, CategoryKey> = {};
      report.accepted.forEach(t => {
        if (t.category) {
          initialCatMap[t.id] = t.category;
        }
      });
      setCategoriesMap(prev => ({ ...prev, ...initialCatMap }));
      setPreview(report.accepted);

      if (report.rejectedCount > 0) {
        setImportSuccessMsg(
          `${report.acceptedCount} lançamentos válidos lidos. (${report.rejectedCount} linhas ignoradas/inválidas, ex: saldos ou erros de formato).`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar arquivo. Verifique o formato OFX ou CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportPreview = () => {
    if (preview.length === 0) return;

    // Apply any customized categories to the items
    const enriched = preview.map(t => ({
      ...t,
      category: categoriesMap[t.id] || t.category || 'lazer',
    }));

    importStatement(enriched);
    const newItemsCount = enriched.filter(t => !knownIds.has(t.id)).length;
    setImportSuccessMsg(
      `${newItemsCount} novos lançamentos importados com sucesso! Revise e confirme abaixo.`
    );
    setPreview([]);
    triggerCelebration();
  };

  const handleQuickApproveAllPending = () => {
    pendingTransactions.forEach(t => {
      const cat = categoriesMap[t.id] || t.category || (t.direction === 'credit' ? 'moradia' : 'lazer');
      reviewBankTransaction(t.id, t.direction === 'credit' ? 'income' : 'expense', cat);
    });
    triggerCelebration();
  };

  const p1Name = state.profile.partner1Name || 'Pessoa 1';
  const p2Name = state.profile.partner2Name || 'Pessoa 2';

  const previewCredits = preview.filter(t => t.direction === 'credit');
  const previewDebits = preview.filter(t => t.direction === 'debit');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-import-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xl font-black shrink-0 shadow-xs">
              📄
            </span>
            <div>
              <h2 id="statement-import-title" className="text-base sm:text-lg font-black font-display text-slate-900 dark:text-white">
                Importar Extratos Bancários (OFX e CSV)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lançamentos com categorização automática inteligente e detecção de assinaturas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Account & Owner Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Identificação da Conta &amp; Titular
              </label>
              <span className="text-[10px] text-slate-400">
                Usado para evitar duplicatas em reimportações
              </span>
            </div>

            {/* Quick Bank Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_BANKS.slice(0, 5).map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setAccount(b);
                    setPreview([]);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    account === b
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Nome da Conta / Cartão
                </label>
                <input
                  type="text"
                  value={account}
                  onChange={e => {
                    setAccount(e.target.value);
                    setPreview([]);
                  }}
                  placeholder="Ex: Nubank Ultravioleta, Itaú..."
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Titular do Lançamento
                </label>
                <select
                  value={owner}
                  onChange={e => {
                    setOwner(e.target.value as PaidBy);
                    setPreview([]);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="both">💑 Conta Conjunta / Casal</option>
                  <option value="partner1">👩 {p1Name} (Individual)</option>
                  <option value="partner2">👨 {p2Name} (Individual)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFileProcess(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 sm:p-8 rounded-3xl border-2 border-dashed text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.csv,text/csv,text/plain"
              className="hidden"
              onChange={e => void handleFileProcess(e.target.files?.[0])}
            />

            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Arraste seu extrato OFX ou CSV aqui
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Compatível com Nubank, Itaú, Bradesco, Santander, Inter, BTG, BB, C6 e qualquer banco brasileiro.
            </p>

            <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
              <FileText className="w-3.5 h-3.5" />
              <span>Selecionar arquivo no dispositivo</span>
            </div>
          </div>

          {/* Feedback messages */}
          {isProcessing && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Processando e categorizando extrato...</span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Detected Subscriptions Banner */}
          {potentialSubscriptions.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-200 dark:border-purple-800/80 space-y-2">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-extrabold text-xs">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Assinaturas Recorrentes Identificadas no Extrato</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Detectamos cobranças mensais repetidas. Elas já ficam pré-categorizadas em Lazer e Assinaturas:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {potentialSubscriptions.slice(0, 4).map(sub => (
                  <span
                    key={sub.id}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 flex items-center gap-1.5"
                  >
                    <span>{sub.merchant}</span>
                    <span className="text-slate-400">•</span>
                    <span>{formatCurrency(sub.amount)}/mês</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW OF PARSED STATEMENT */}
          {preview.length > 0 && (
            <section className="space-y-3 pt-2 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Prévia do Arquivo: {preview.length} lançamentos encontrados
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {previewDebits.length} gastos, {previewCredits.length} entradas •{' '}
                    {preview.filter(t => knownIds.has(t.id)).length} já importados anteriormente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleImportPreview}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Confirmar &amp; Adicionar Novos</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                {preview.map(t => {
                  const isAlready = knownIds.has(t.id);
                  const isCredit = t.direction === 'credit';
                  return (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        isAlready
                          ? 'opacity-50 bg-slate-100 dark:bg-slate-800/40 border-slate-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{t.date}</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {t.description}
                          </span>
                          {t.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                              {CATEGORIES_BASE[t.category]?.name || t.category}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-black tabular-nums ${
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isCredit ? '+' : '-'} {formatCurrency(t.amount)}
                        </span>
                        {isAlready && (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            (já existe)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 26B: VERIFICAÇÃO DE SALDO E DUPLICIDADES DE CONTA */}
          {(verifiableCashSummary.duplicateAccountAlerts.length > 0 || checkingAccountsForAnchor.length > 0) && (
            <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Verificação de Caixa &amp; Contas Canônicas
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {verifiableCashSummary.status === 'unknown'
                    ? 'Caixa livre não verificável'
                    : verifiableCashSummary.status === 'partial'
                    ? `Parcial: ${formatCurrency(verifiableCashSummary.knownAccountsCashCents / 100)}`
                    : `Verificado: ${formatCurrency(verifiableCashSummary.verifiedLiquidCashR$ ?? 0)}`}
                </span>
              </div>

              {verifiableCashSummary.duplicateAccountAlerts.map((dup, idx) => (
                <div
                  key={`${dup.bankName}-${idx}`}
                  className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-amber-900 dark:text-amber-200">
                      Possível duplicidade: {dup.bankName}
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300">{dup.reason}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const canonical = `canon-${dup.accountIds[0]}`;
                      dup.accountIds.forEach(id => linkCanonicalAccount(id, canonical));
                      setImportSuccessMsg(`Contas espelhadas de ${dup.bankName} vinculadas sob ID canônico.`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Vincular conta canônica
                  </button>
                </div>
              ))}

              {checkingAccountsForAnchor.map(acc => {
                const defaultBal = anchorBalanceInputs[acc.id] ?? String(acc.balance ?? 0);
                const defaultCutoff = anchorCutoffInputs[acc.id] ?? new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={acc.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {acc.bankName} ({acc.accountType})
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Status: {acc.verificationStatus === 'unverified' ? 'Desconhecido' : 'Verificado'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Saldo confirmado de ${acc.bankName}`}
                        value={defaultBal}
                        onChange={e => setAnchorBalanceInputs({ ...anchorBalanceInputs, [acc.id]: e.target.value })}
                        className="w-28 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs tabular-nums"
                      />
                      <input
                        type="date"
                        aria-label={`Data de corte de ${acc.bankName}`}
                        value={defaultCutoff}
                        onChange={e => setAnchorCutoffInputs({ ...anchorCutoffInputs, [acc.id]: e.target.value })}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseFloat(defaultBal.replace(',', '.'));
                          if (!Number.isFinite(parsed)) return;
                          setCashBalanceAnchor({
                            accountId: acc.canonicalAccountId || acc.id,
                            status: 'known',
                            confirmedBalanceR$: parsed,
                            cutoffDate: defaultCutoff,
                          });
                          setImportSuccessMsg(`Saldo de ${acc.bankName} confirmado em ${formatCurrency(parsed)}.`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Confirmar saldo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCashBalanceAnchor({
                            accountId: acc.canonicalAccountId || acc.id,
                            status: 'unknown',
                            cutoffDate: defaultCutoff,
                          });
                          setImportSuccessMsg(`Saldo de ${acc.bankName} marcado como desconhecido.`);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                      >
                        Marcar desconhecido
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* 26B: PARES CANDIDATOS DE TRANSFERÊNCIA INTERNA */}
          {internalTransferPairs.length > 0 && (
            <section className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Transferências Internas Detectadas ({internalTransferPairs.length})
              </h3>
              {internalTransferPairs.map(pair => (
                <div
                  key={`${pair.debitTx.id}-${pair.creditTx.id}`}
                  className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {pair.debitTx.description} ↔ {pair.creditTx.description} ({formatCurrency(pair.amountCents / 100)})
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">{pair.reason}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      confirmInternalTransferPair(pair.debitTx.id, pair.creditTx.id);
                      setImportSuccessMsg('Par de transferência interna confirmado (impacto zero em gastos/renda).');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Confirmar Transferência Interna
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* PENDING TRANSACTIONS AWAITING REVIEW */}
          {pendingTransactions.length > 0 && (
            <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Lançamentos Pendentes de Revisão</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-black">
                      {pendingTransactions.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confira as categorias sugeridas e confirme para incorporar ao extrato oficial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleQuickApproveAllPending}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Aprovar Todos ({pendingTransactions.length})
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {pendingTransactions.map(t => {
                  const isCredit = t.direction === 'credit';
                  const activeCat = categoriesMap[t.id] || t.category || (isCredit ? 'moradia' : 'lazer');
                  const reconciliationMatch = isCredit
                    ? findReconciliationCandidates(t, state.financialOperations || [], state.linkedAccounts || [])
                    : { candidates: [], ambiguous: false };
                  const chosenOpId =
                    selectedReconcileOps[t.id] || reconciliationMatch.candidates[0]?.operation.id || '';

                  return (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{t.description}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {t.date} • {t.accountId} • Titular:{' '}
                            {t.owner === 'partner1'
                              ? p1Name
                              : t.owner === 'partner2'
                              ? p2Name
                              : 'Casal'}
                          </span>
                        </div>

                        <span
                          className={`text-sm font-black tabular-nums ${
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isCredit ? '+' : '-'} {formatCurrency(t.amount)}
                        </span>
                      </div>

                      {isCredit && reconciliationMatch.candidates.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1.5 text-xs">
                          <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2">
                            <span>Resgate compatível encontrado para conciliação</span>
                            {reconciliationMatch.ambiguous && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                                Múltiplos candidatos — escolha explicitamente
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Selecionar resgate para conciliar ${t.description}`}
                              value={chosenOpId}
                              onChange={e =>
                                setSelectedReconcileOps({ ...selectedReconcileOps, [t.id]: e.target.value })
                              }
                              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 text-xs font-bold"
                            >
                              {reconciliationMatch.candidates.map(cand => (
                                <option key={cand.operation.id} value={cand.operation.id}>
                                  {cand.operation.sourceRef?.name || cand.operation.id} ({cand.reason})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (!chosenOpId) return;
                                try {
                                  setError('');
                                  reconcileBankTransactionWithOperation(t.id, chosenOpId);
                                  setImportSuccessMsg('Crédito conciliado com o resgate sem gerar renda fictícia.');
                                } catch (err: any) {
                                  setError(err?.message || 'Não foi possível conciliar este crédito com o resgate.');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                            >
                              Conciliar com resgate
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        {!isCredit && (
                          <div className="flex-1 min-w-[140px]">
                            <select
                              aria-label={`Categoria para ${t.description}`}
                              value={activeCat}
                              onChange={e =>
                                setCategoriesMap({
                                  ...categoriesMap,
                                  [t.id]: e.target.value as CategoryKey,
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200"
                            >
                              {Object.entries(CATEGORIES_BASE).map(([k, cat]) => (
                                <option key={k} value={k}>
                                  {cat.emoji} {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() =>
                              reviewBankTransaction(
                                t.id,
                                isCredit ? 'income' : 'expense',
                                activeCat
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{isCredit ? 'Confirmar Receita' : 'Confirmar Gasto'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => reviewBankTransaction(t.id, 'internal_transfer')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                            title="Desconsiderar do orçamento (transferência interna entre contas do casal)"
                          >
                            Transferência
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Statement Daily Push Reminder Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label htmlFor="reminder-check" className="text-xs font-extrabold text-slate-900 dark:text-white cursor-pointer block">
                Lembretes diários de conferência de extratos
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lembrete ao almoço (13h) e fechamento do dia (18h) para não acumular lançamentos.
              </p>
            </div>
            <input
              id="reminder-check"
              type="checkbox"
              checked={!!state.pushSettings?.statementReminderEnabled}
              onChange={e => updatePushSettings({ statementReminderEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Importação 100% offline e privada no dispositivo</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
