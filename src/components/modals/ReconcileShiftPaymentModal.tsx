import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  Sparkles,
  Link,
  AlertCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { MedicalShift } from '../../types/finance';
import { findMatchingBankIncomesForShift } from '../../utils/shiftsEngine';
import { formatCurrency } from '../../utils/formatters';

interface ReconcileShiftPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: MedicalShift | null;
}

export const ReconcileShiftPaymentModal: React.FC<ReconcileShiftPaymentModalProps> = ({
  isOpen,
  onClose,
  shift,
}) => {
  const {
    state,
    incomes = [],
    hospitalMappingRules = [],
    reconcileShiftWithIncome,
    markShiftAsReceivedDirectly,
  } = useFinance();

  const p1Name = state?.profile?.partner1Name || 'Parceiro 1';
  const p2Name =
    !state?.profile?.partner2Name || state.profile.partner2Name === 'Aguardando Par...'
      ? 'Parceiro 2'
      : state.profile.partner2Name;

  const [selectedIncomeId, setSelectedIncomeId] = useState<string>('');
  const [actualReceivedDate, setActualReceivedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [rememberPattern, setRememberPattern] = useState<boolean>(true);
  const [mode, setMode] = useState<'open_finance' | 'direct'>('open_finance');

  if (!isOpen || !shift) return null;

  const { exactMatches, probableMatches } = findMatchingBankIncomesForShift(
    shift,
    incomes,
    hospitalMappingRules
  );
  const allMatches = [...exactMatches, ...probableMatches.filter(p => !exactMatches.some(e => e.id === p.id))];

  const handleSelectIncome = (incomeId: string, date: string) => {
    setSelectedIncomeId(incomeId);
    setActualReceivedDate(date);
  };

  const handleConfirm = () => {
    if (mode === 'open_finance' && selectedIncomeId) {
      reconcileShiftWithIncome(shift.id, selectedIncomeId, rememberPattern);
    } else {
      markShiftAsReceivedDirectly(shift.id, actualReceivedDate, true);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FAF7F2] dark:bg-[#111318] text-slate-800 dark:text-slate-100 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 dark:border-stone-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Confirmar Recebimento de Plantão
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Vincule ao extrato Open Finance ou dê baixa manual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shift Details Summary Card */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-semibold uppercase text-teal-600 dark:text-teal-400">
                {shift.partner === 'partner1' ? `👨‍⚕️ ${p1Name}` : `👩‍⚕️ ${p2Name}`}
              </span>
              <h3 className="font-bold text-base text-stone-800 dark:text-stone-100">
                {shift.hospitalName}
              </h3>
              <p className="text-xs text-stone-500">
                {shift.title} • Realizado em {new Date(shift.dateWorked + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-400">Valor Estimado</span>
              <p className="font-extrabold text-base text-stone-900 dark:text-white">
                {formatCurrency(shift.grossAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('open_finance')}
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              mode === 'open_finance'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Extrato Open Finance ({allMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              mode === 'direct'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Baixa Direta / Manual
          </button>
        </div>

        {/* Content based on Mode */}
        {mode === 'open_finance' ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                Entradas Bancárias Sugeridas:
              </span>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                Sincronizadas via Pluggy
              </span>
            </div>

            {allMatches.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1 text-center">
                <AlertCircle className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <p className="font-semibold">Nenhuma entrada bancária compatível encontrada recentemente.</p>
                <p className="text-[11px] opacity-80">
                  Você pode selecionar &ldquo;Baixa Direta / Manual&rdquo; acima para confirmar o recebimento hoje.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allMatches.map((inc) => {
                  const isSelected = selectedIncomeId === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => handleSelectIncome(inc.id, inc.date)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-teal-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">
                            {inc.description || 'Crédito em Conta'}
                          </span>
                          {(inc.description || '').toUpperCase().includes('VIVA') ||
                          (inc.description || '').toUpperCase().includes('RIO') ||
                          (inc.description || '').toUpperCase().includes("D'OR") ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 font-medium flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Recomendado
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-stone-500">
                          Data: {new Date(inc.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {inc.type === 'salary' ? 'Salário/Contrato' : 'Renda Extra'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(inc.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pattern Learning Checkbox */}
            {selectedIncomeId && (
              <div className="p-3 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/30 text-xs space-y-1">
                <label className="flex items-start gap-2 cursor-pointer font-medium text-teal-900 dark:text-teal-200">
                  <input
                    type="checkbox"
                    checked={rememberPattern}
                    onChange={(e) => setRememberPattern(e.target.checked)}
                    className="mt-0.5 rounded text-teal-600 accent-teal-600"
                  />
                  <span>
                    Aprender este padrão bancário para <strong>{shift.hospitalName}</strong>
                  </span>
                </label>
                <p className="text-[11px] text-teal-700 dark:text-teal-400 pl-5">
                  Nas próximas entradas da conta bancária, o JUNTÔ saberá identificar automaticamente que se trata deste hospital!
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Direct manual mode */
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Data do Recebimento Real
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="date"
                  value={actualReceivedDate}
                  onChange={(e) => setActualReceivedDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                />
              </div>
            </div>
            <p className="text-[11px] text-stone-500">
              Ao confirmar a baixa manual, o plantão será marcado como recebido e uma entrada no valor de{' '}
              <strong>{formatCurrency(shift.grossAmount)}</strong> será lançada no seu extrato.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mode === 'open_finance' && allMatches.length > 0 && !selectedIncomeId}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-md ${
              mode === 'open_finance' && allMatches.length > 0 && !selectedIncomeId
                ? 'bg-stone-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {mode === 'open_finance' && selectedIncomeId
              ? 'Vincular e Baixar Plantão'
              : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  );
};
