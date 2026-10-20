import React, { useState } from 'react';
import {
  Sparkles,
  Building,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  HelpCircle,
  Coins,
  Repeat,
  AlertTriangle,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { IncomeSourceClassification, PendingIncomeConfirmation } from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { calculateNetLiquidFromGross } from '../utils/incomeTiersEngine';

interface ActiveIncomeConfirmationModalProps {
  confirmation: PendingIncomeConfirmation;
  onClose: () => void;
}

export const ActiveIncomeConfirmationModal: React.FC<ActiveIncomeConfirmationModalProps> = ({
  confirmation,
  onClose,
}) => {
  const { state, confirmPendingIncome, dismissPendingIncome } = useFinance();

  // Find partner's fiscal profile
  const partnerFiscal =
    confirmation.recipient === 'partner2'
      ? state.profile.partner2Fiscal
      : state.profile.partner1Fiscal;

  const defaultTaxRate = partnerFiscal?.cnpjTaxRate || 6;
  const [customTaxRate, setCustomTaxRate] = useState<number>(defaultTaxRate);
  const [rememberRule, setRememberRule] = useState<boolean>(true);

  const pjCalc = calculateNetLiquidFromGross(confirmation.amount, customTaxRate, 0);

  const handleSelect = (classification: IncomeSourceClassification) => {
    confirmPendingIncome(confirmation.id, classification, customTaxRate);
    onClose();
  };

  const recipientName =
    confirmation.recipient === 'partner1'
      ? state.profile.partner1Name
      : confirmation.recipient === 'partner2'
      ? state.profile.partner2Name
      : 'Conta Conjunta do Casal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Motor de Confirmação Ativa · Meu Pluggy
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Novo Recebimento Detectado
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              dismissPendingIncome(confirmation.id);
              onClose();
            }}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Deposit Highlight Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Fonte Pagadora:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
              {confirmation.sourceName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Valor Creditado:</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(confirmation.amount)}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
            <span>Conta de {recipientName}</span>
            <span>Data: {confirmation.date}</span>
          </div>
        </div>

        {/* Main Question */}
        <div>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            Como devemos classificar este valor no orçamento de vocês?
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            O algoritmo utiliza a classificação para alimentar com precisão as Faixas de Vida Financeira.
          </p>
        </div>

        {/* 3 Action Options */}
        <div className="space-y-2.5">
          {/* Opção A: Salário / Rendimento Líquido PF */}
          <button
            onClick={() => handleSelect('pf_net')}
            className="w-full p-3.5 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/70 text-left transition-all group cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💼</span>
                <span className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                  Opção A: Salário / Rendimento Líquido PF
                </span>
              </div>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                100% no Orçamento
              </span>
            </div>
            <p className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 mt-1 pl-6">
              Dinheiro de residência médica, CLT, bolsa ou distribuição de lucros com imposto já retido. Entra o valor total de {formatCurrency(confirmation.amount)}.
            </p>
          </button>

          {/* Opção B: Faturamento Bruto PJ */}
          <div className="p-3.5 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/20 text-left space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏢</span>
                <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                  Opção B: Faturamento Bruto PJ (Nota Fiscal)
                </span>
              </div>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                Líquido: {formatCurrency(pjCalc.netLiquid)}
              </span>
            </div>
            <p className="text-[10px] text-indigo-800/80 dark:text-indigo-300/80 pl-6">
              Desconta automaticamente a alíquota de imposto do CNPJ (Simples Nacional) para calcular a Renda Líquida Real do casal.
            </p>

            <div className="flex items-center justify-between pt-1 pl-6 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span>Alíquota de Imposto:</span>
                <input
                  type="number"
                  min="0"
                  max="40"
                  step="0.5"
                  value={customTaxRate}
                  onChange={e => setCustomTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-0.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-center"
                />
                <span>%</span>
              </div>

              <button
                onClick={() => handleSelect('pj_gross')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Confirmar como PJ
              </button>
            </div>
          </div>

          {/* Opção C: Transferência Pessoal / Reembolso */}
          <button
            onClick={() => handleSelect('internal_transfer')}
            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-all cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Opção C: Transferência Pessoal / Reembolso
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Não é Nova Renda
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
              Movimentação interna entre contas do casal, devolução de dinheiro ou reembolso. Não altera sua faixa de renda.
            </p>
          </button>
        </div>

        {/* Remember Checkbox */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300 font-semibold">
            <input
              type="checkbox"
              checked={rememberRule}
              onChange={e => setRememberRule(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Memorizar esta fonte e automatizar recebimentos futuros</span>
          </label>

          <button
            onClick={() => {
              dismissPendingIncome(confirmation.id);
              onClose();
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
          >
            Ignorar por enquanto
          </button>
        </div>
      </div>
    </div>
  );
};
