import React, { useState, useMemo } from 'react';
import { X, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { SavingsPiggyBank } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';
import { CategoryReinforcementModal } from './CategoryReinforcementModal';

interface DepositPiggyModalProps {
  isOpen: boolean;
  onClose: () => void;
  bank: SavingsPiggyBank | null;
}

export const DepositPiggyModal: React.FC<DepositPiggyModalProps> = ({ isOpen, onClose, bank }) => {
  const { state, depositToPiggyBank, withdrawFromPiggyBank, previewWithdrawal } = useFinance();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [netAmountInput, setNetAmountInput] = useState<string>('');
  const [withdrawalChannel, setWithdrawalChannel] = useState<'asset_redemption' | 'virtual_reallocation'>('asset_redemption');
  const [executionMode, setExecutionMode] = useState<'pending_settlement' | 'occurred_manual'>('occurred_manual');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [overrideDivergence, setOverrideDivergence] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [needsCompletedConfirmation, setNeedsCompletedConfirmation] = useState(false);
  const [confirmedCompleted, setConfirmedCompleted] = useState(false);
  const [isReinforceOpen, setIsReinforceOpen] = useState(false);

  const checkingAccounts = useMemo(
    () => (state.linkedAccounts || []).filter(a => a.accountType === 'corrente' || a.accountType === 'poupanca'),
    [state.linkedAccounts]
  );

  const grossVal = parseFloat(amount.replace(',', '.')) || 0;
  const parsedNet = netAmountInput.trim() ? parseFloat(netAmountInput.replace(',', '.')) : grossVal;
  const netVal = Number.isFinite(parsedNet) && parsedNet > 0 ? parsedNet : grossVal;

  const withdrawalPreview = useMemo(() => {
    if (!bank || mode !== 'withdraw' || grossVal <= 0) return null;
    return previewWithdrawal({
      goalId: bank.id,
      sourceType: 'piggy_bank',
      grossAmountR$: grossVal,
      netAmountR$: netVal,
      withdrawalChannel,
      executionMode,
      destinationAccountId: destinationAccountId || undefined,
      overrideInsufficientPlanning: overrideDivergence,
    });
  }, [
    bank,
    mode,
    grossVal,
    netVal,
    withdrawalChannel,
    executionMode,
    destinationAccountId,
    overrideDivergence,
    previewWithdrawal,
  ]);

  if (!isOpen || !bank) return null;

  const quickVals = [100, 200, 500, 1000, 1500];

  const handleClose = () => {
    setErrorMsg('');
    setNeedsCompletedConfirmation(false);
    setConfirmedCompleted(false);
    setNetAmountInput('');
    setOverrideDivergence(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      setErrorMsg('Informe um valor maior que zero.');
      return;
    }

    try {
      setErrorMsg('');
      if (mode === 'deposit') {
        depositToPiggyBank(bank.id, val, 'both', undefined, {
          completedGoalContributionConfirmed: confirmedCompleted,
        });
      } else {
        const finalNet = netAmountInput.trim() ? parseFloat(netAmountInput.replace(',', '.')) : val;
        if (!Number.isFinite(finalNet) || finalNet <= 0) {
          setErrorMsg('Informe um valor líquido válido maior que zero.');
          return;
        }
        withdrawFromPiggyBank(bank.id, val, {
          withdrawalChannel,
          executionMode,
          grossAmountR$: val,
          netAmountR$: finalNet,
          destinationAccountId: destinationAccountId || undefined,
          overrideInsufficientPlanning: overrideDivergence,
        });
      }
      setAmount('');
      setNetAmountInput('');
      setOverrideDivergence(false);
      setNeedsCompletedConfirmation(false);
      setConfirmedCompleted(false);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível concluir a movimentação no cofrinho.';
      setErrorMsg(msg);
      if (msg.includes('concluída') || msg.includes('CONFIRMATION_REQUIRED')) {
        setNeedsCompletedConfirmation(true);
      }
    }
  };

  const diffR$ = withdrawalPreview ? withdrawalPreview.differenceToReviewCents / 100 : Math.max(0, grossVal - netVal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{bank.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">{bank.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Guardado até agora: {formatCurrency(bank.currentAmount)}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <p
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200"
            >
              {errorMsg}
            </p>
          )}

          {needsCompletedConfirmation && mode === 'deposit' && (
            <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={confirmedCompleted}
                onChange={e => setConfirmedCompleted(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Confirmar aporte extra nesta meta já concluída e integralmente utilizada
              </span>
            </label>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode('deposit');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'deposit'
                  ? 'bg-accent-surface text-accent-themed border border-accent-themed shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              🌱 Guardar Dinheiro
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('withdraw');
                setErrorMsg('');
                setNeedsCompletedConfirmation(false);
                setConfirmedCompleted(false);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'withdraw'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              💸 Retirar do Cofrinho
            </button>
          </div>

          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {mode === 'deposit' ? 'Quanto vocês querem guardar agora?' : 'Valor bruto a retirar (R$)'}
            </label>
            <div className="relative max-w-xs mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 dark:text-slate-500">R$</span>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="0,00"
                className="w-full pl-14 pr-4 py-3.5 text-2xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:outline-none focus:border-accent-primary focus:bg-white dark:focus:bg-slate-800/90 transition-all tabular-nums"
              />
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {quickVals.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setAmount(val.toString());
                  if (errorMsg) setErrorMsg('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-surface hover:text-accent-themed text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>

          {mode === 'withdraw' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Canal do Resgate
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWithdrawalChannel('asset_redemption')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      withdrawalChannel === 'asset_redemption'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Resgate real de ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawalChannel('virtual_reallocation')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      withdrawalChannel === 'virtual_reallocation'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Realocação virtual (mesma conta)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Estágio da Liquidação
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExecutionMode('pending_settlement')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      executionMode === 'pending_settlement'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Solicitar / Planejar (em liquidação)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionMode('occurred_manual')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      executionMode === 'occurred_manual'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Registrar que ocorreu no banco
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="piggy-net-amount" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Valor líquido recebido (R$)
                  </label>
                  <input
                    id="piggy-net-amount"
                    type="number"
                    step="0.01"
                    value={netAmountInput}
                    onChange={e => setNetAmountInput(e.target.value)}
                    placeholder={amount || 'Mesmo do bruto'}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  />
                </div>

                {withdrawalChannel === 'asset_redemption' && checkingAccounts.length > 0 && (
                  <div>
                    <label htmlFor="piggy-dest-account" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Conta corrente destino
                    </label>
                    <select
                      id="piggy-dest-account"
                      value={destinationAccountId}
                      onChange={e => setDestinationAccountId(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="">Selecionar conta destino</option>
                      {checkingAccounts.map(acc => (
                        <option key={acc.id} value={acc.canonicalAccountId || acc.id}>
                          {acc.bankName} ({acc.accountType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {diffR$ > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                  Diferença a revisar: <strong>{formatCurrency(diffR$)}</strong> (sem inventar IR/IOF/taxa)
                </div>
              )}

              {grossVal > bank.currentAmount && (
                <label className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={overrideDivergence}
                    onChange={e => setOverrideDivergence(e.target.checked)}
                    className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-bold text-rose-900 dark:text-rose-200">
                    Registrar divergência ocorrida no banco (saldo planejado {formatCurrency(bank.currentAmount)} insuficiente)
                  </span>
                </label>
              )}

              {withdrawalPreview && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    <span>Prévia da Operação</span>
                    <span className="text-emerald-700 dark:text-emerald-300">Renda nova gerada: R$ 0,00</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Bruto: {formatCurrency(withdrawalPreview.grossAmountCents / 100)}</span>
                    <span>Líquido: {formatCurrency(withdrawalPreview.netAmountCents / 100)}</span>
                    <span>Livre p/ caixa: {formatCurrency(withdrawalPreview.freeCashNetCents / 100)}</span>
                  </div>
                  {withdrawalPreview.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
            {mode === 'deposit' ? (
              <>
                Meta do cofrinho: <strong>{formatCurrency(bank.targetAmount)}</strong>. Falta{' '}
                <strong className="text-accent-themed font-bold">
                  {formatCurrency(
                    Math.max(
                      0,
                      bank.targetAmount - (bank.currentAmount + (parseFloat(amount.replace(',', '.')) || 0))
                    )
                  )}
                </strong>
                .
              </>
            ) : grossVal > bank.currentAmount ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                Valor acima do saldo disponível ({formatCurrency(bank.currentAmount)}).
              </span>
            ) : (
              <>
                Saldo restante ficará em:{' '}
                <strong className="text-slate-900 dark:text-white font-bold">
                  {formatCurrency(bank.currentAmount - grossVal)}
                </strong>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2">
              {bank.currentAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsReinforceOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/70 dark:hover:bg-sky-900 text-blue-800 dark:text-sky-200 border border-blue-300 dark:border-sky-700 font-black text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reforçar Categoria</span>
                </button>
              )}
              <button
                type="submit"
                disabled={!amount || grossVal <= 0}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                  mode === 'deposit'
                    ? 'btn-primary-accent shadow-black/10'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <Check className="w-4 h-4" />
                {mode === 'deposit'
                  ? 'Guardar no Cofrinho'
                  : executionMode === 'pending_settlement'
                  ? 'Solicitar / Planejar Resgate'
                  : 'Confirmar Retirada'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <CategoryReinforcementModal
        isOpen={isReinforceOpen}
        onClose={() => {
          setIsReinforceOpen(false);
          onClose();
        }}
        initialSourceId={bank.id}
        initialSourceKind="piggy_bank"
      />
    </div>
  );
};
