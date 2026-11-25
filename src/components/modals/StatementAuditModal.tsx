import React from 'react';
import {
  X,
  Building,
  ShieldCheck,
  Trash2,
  Edit3,
  Layers,
} from 'lucide-react';
import { StatementItem } from '../../utils/unifiedLedger';
import { formatCurrency } from '../../utils/formatters';

interface StatementAuditModalProps {
  item: StatementItem | null;
  onClose: () => void;
  onEdit?: (item: StatementItem) => void;
  onDelete?: (item: StatementItem) => void;
}

export const StatementAuditModal: React.FC<StatementAuditModalProps> = ({
  item,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!item) return null;

  const isInflow = item.direction === 'inflow';
  const isTransfer = item.direction === 'internal';
  const isNegativeAdjustment = item.type === 'valuation_adjustment' && item.amount < 0;
  const formattedSignedAmount = isNegativeAdjustment
    ? `-${formatCurrency(Math.abs(item.amount))}`
    : `${isInflow ? '+ ' : isTransfer ? '' : '- '}${formatCurrency(item.amount)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xl ${
                isInflow
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : isNegativeAdjustment
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : isTransfer
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {item.categoryEmoji}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Rastreabilidade e Origem
                </span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg font-display">
                Por que este registro está aqui?
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount & Title Hero Card */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            isInflow
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
              : isNegativeAdjustment
              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
              : isTransfer
              ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              {item.title}
            </span>
            <div
              className={`text-xl sm:text-2xl font-black tabular-nums font-display ${
                isInflow
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : isNegativeAdjustment
                  ? 'text-rose-700 dark:text-rose-300'
                  : isTransfer
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {formattedSignedAmount}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {item.status === 'pending' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Em liquidação
              </span>
            )}
            {item.status === 'reconciled' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                Conciliado
              </span>
            )}
            {item.status === 'reverted' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                Estornado
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                isInflow
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                  : isTransfer
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {isInflow ? 'Entrada' : isTransfer ? 'Transferência Interna' : 'Saída'}
            </span>
          </div>
        </div>

        {/* Audit Details Details Grid */}
        <div className="space-y-3 text-xs">
          {/* 1. Fonte e Origem da Informação */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-accent-primary" />
              Fonte do Lançamento
            </div>
            <div className="font-bold text-slate-900 dark:text-white">
              {item.auditDetails.sourceDescription}
            </div>
            {item.bankName && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Instituição: <span className="font-semibold">{item.bankName}</span>
              </div>
            )}
          </div>

          {/* 2. FITID / ID de Importação (Se Houver) */}
          {item.fitid && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Identificador Único Bancário (FITID)
              </div>
              <div className="font-mono text-xs font-bold text-amber-900 dark:text-amber-200 break-all">
                {item.fitid}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Preservado para impedir duplicatas ao reimportar extratos bancários. Editar a categoria não apaga este ID.
              </div>
            </div>
          )}

          {/* 3. Evento / Vínculo Relacionado */}
          {item.auditDetails.linkedEvent && (
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent-primary" />
                Evento ou Contrato Vinculado
              </div>
              <div className="font-bold text-slate-900 dark:text-white">
                {item.auditDetails.linkedEvent}
              </div>
            </div>
          )}

          {/* 4. Datas e Competência Orçamentária */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Data Civil</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs tabular-nums">
                {item.date.split('-').reverse().join('/')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Competência Orçamentária</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs tabular-nums">
                {item.competenceMonth}
              </span>
            </div>
          </div>

          {/* 5. Categoria e Titularidade */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Categoria</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1">
                <span>{item.categoryEmoji}</span>
                <span>{item.categoryName}</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Titular / Quem Pagou</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                {item.paidByName}
              </span>
            </div>
          </div>

          {(item.operationId ||
            item.costBasisR$ !== undefined ||
            item.realizedGainR$ !== undefined ||
            item.grossAmountR$ !== undefined ||
            item.netAmountR$ !== undefined ||
            item.differenceToReviewR$ !== undefined ||
            item.planningDivergenceR$ !== undefined ||
            item.bankTransactionId ||
            item.withdrawalChannel) && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
              <div className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                Auditoria Patrimonial (Custo Base, Bruto/Líquido &amp; Conciliação)
              </div>
              {item.operationId && (
                <div className="font-mono text-xs font-bold text-indigo-950 dark:text-indigo-200 break-all">
                  operationId: {item.operationId}
                </div>
              )}
              {item.withdrawalChannel && (
                <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                  Canal: {item.withdrawalChannel === 'virtual_reallocation' ? 'Realocação Virtual' : 'Resgate Real'}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {item.grossAmountR$ !== undefined && (
                  <span>Bruto: {formatCurrency(item.grossAmountR$)}</span>
                )}
                {item.netAmountR$ !== undefined && (
                  <span>Líquido: {formatCurrency(item.netAmountR$)}</span>
                )}
                {item.differenceToReviewR$ !== undefined && item.differenceToReviewR$ > 0 && (
                  <span className="text-amber-800 dark:text-amber-300 font-bold">
                    Diferença a revisar: {formatCurrency(item.differenceToReviewR$)}
                  </span>
                )}
                {item.costBasisR$ !== undefined && (
                  <span>Custo base movimentado: {formatCurrency(item.costBasisR$)}</span>
                )}
                {item.realizedGainR$ !== undefined && (
                  <span>
                    Resultado realizado:{' '}
                    {item.realizedGainR$ < 0
                      ? `-${formatCurrency(Math.abs(item.realizedGainR$))}`
                      : `+${formatCurrency(item.realizedGainR$)}`}
                  </span>
                )}
              </div>
              {item.planningDivergenceR$ !== undefined && item.planningDivergenceR$ > 0 && (
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-800 dark:text-rose-200">
                  Divergência de planejamento registrada: {formatCurrency(item.planningDivergenceR$)}
                </div>
              )}
              {item.bankTransactionId && (
                <div className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300 break-all">
                  Extrato bancário vinculado: {item.bankTransactionId}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 gap-2">
          <div className="text-[11px] text-slate-400 font-mono truncate">
            ID: {item.operationId || item.entityId}
          </div>

          <div className="flex items-center gap-2">
            {onDelete && item.status !== 'reverted' && (
              <button
                type="button"
                onClick={() => {
                  onDelete(item);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Estornar / Excluir</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(item);
                  onClose();
                }}
                className="btn-primary-accent px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Categoria</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
