import React from 'react';
import { ChevronRight, AlertCircle, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { LifeTierInfo } from '../types/finance';
import { ThermometerEngineResult } from '../utils/thermometerEngine';

interface MonthThermometerGaugeProps {
  engineResult: ThermometerEngineResult;
  activeLifeTier: LifeTierInfo;
  onOpenRaioX: () => void;
}

export const MonthThermometerGauge: React.FC<MonthThermometerGaugeProps> = ({
  engineResult,
  activeLifeTier,
  onOpenRaioX,
}) => {
  const {
    expenseBudget,
    totalConsumedAmount,
    signedMargin,
    deficitAmount,
    budgetConsumedPercent,
    isOverBudget,
    ringSegments,
    overflowPercent,
    overflowAmount,
    statusState,
    statusLabel,
    statusDescription,
    daysRemainingInMonth,
    safeDailyLimit,
  } = engineResult;

  // SVG circular arcs math
  const size = 260;
  const strokeWidth = 18;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Total circumference divided among 5 segments with gaps
  const gapAngle = 7; // degrees per gap
  const totalGaps = 5 * gapAngle;
  const availableDegrees = 360 - totalGaps;
  const segmentDegrees = availableDegrees / 5;
  const segmentLength = (segmentDegrees / 360) * circumference;

  // Status badge styling
  const statusBadgeConfig = {
    dentro_do_plano: {
      bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    },
    atencao: {
      bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
    },
    ajuste_necessario: {
      bg: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
    },
    dados_insuficientes: {
      bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      icon: <HelpCircle className="w-3.5 h-3.5 text-slate-500" />,
    },
  }[statusState];

  return (
    <div
      onClick={onOpenRaioX}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenRaioX(); } }}
      aria-label="Abrir Raio-X do Orçamento do Mês"
      className="clay-card p-6 sm:p-8 cursor-pointer relative overflow-hidden group select-none transition-all duration-300"
    >
      {/* Background Glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: isOverBudget ? '#FFC2E2' : '#B8E0B0' }}
      />
      <div
        className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: '#D8C7FF' }}
      />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-2xl bg-[#111318] text-white flex items-center justify-center text-sm font-black shadow-xs">
            ✨
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#111318] dark:text-white">
              Termômetro do Mês
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Plano de gastos determinístico em tempo real
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111318] text-white text-[11px] font-black group-hover:scale-105 transition-all shadow-xs">
          <span>Raio-X</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        {/* Segmented Ring */}
        <div className="md:col-span-6 flex justify-center items-center">
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90 origin-center"
            >
              <defs>
                <filter id="gaugeShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.1" />
                </filter>
              </defs>

              {/* Background Inactive Arcs */}
              {ringSegments.map((seg) => {
                const rotation = seg.index * (segmentDegrees + gapAngle);
                return (
                  <circle
                    key={`bg-${seg.index}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                    strokeLinecap="round"
                    opacity={0.2}
                    transform={`rotate(${rotation} ${center} ${center})`}
                  />
                );
              })}

              {/* Active Fractional Arcs */}
              {ringSegments.map((seg) => {
                if (seg.fillFraction <= 0) return null;
                const rotation = seg.index * (segmentDegrees + gapAngle);
                const activeLength = segmentLength * seg.fillFraction;

                return (
                  <circle
                    key={`act-${seg.index}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${activeLength} ${circumference - activeLength}`}
                    strokeLinecap="round"
                    filter="url(#gaugeShadow)"
                    className="transition-all duration-700 ease-out"
                    transform={`rotate(${rotation} ${center} ${center})`}
                  />
                );
              })}
            </svg>

            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              {/* Explainable Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-xs mb-1 ${statusBadgeConfig.bg}`}>
                {statusBadgeConfig.icon}
                <span>{statusLabel}</span>
              </div>

              {/* Big Percentage / Remaining / Overflow */}
              <div
                className={`text-3xl sm:text-4xl font-black font-display tracking-tight tabular-nums ${
                  isOverBudget
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#111318] dark:text-white'
                }`}
              >
                {expenseBudget <= 0
                  ? 'Sem Orçamento'
                  : isOverBudget
                  ? `+${overflowPercent}%`
                  : `${100 - (budgetConsumedPercent || 0)}%`}
              </div>

              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {expenseBudget <= 0
                  ? 'Cadastrem a renda para ativar'
                  : isOverBudget
                  ? `Excesso de ${formatCurrency(overflowAmount)}`
                  : 'margem do plano restante'}
              </div>

              {/* Faixa de Renda Subtitle */}
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {activeLifeTier.emblem} {activeLifeTier.name}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Metrics */}
        <div className="md:col-span-6 space-y-3.5">
          {/* Main Available Currency Display */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {isOverBudget ? 'Excesso em Relação ao Plano' : 'Margem Livre para o Mês'}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black tabular-nums font-display ${
                isOverBudget
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[#111318] dark:text-white'
              }`}
            >
              {isOverBudget
                ? `Excedido ${formatCurrency(deficitAmount)}`
                : formatCurrency(signedMargin)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium leading-relaxed">
              {isOverBudget
                ? 'Plano do mês ultrapassado. Vale rever os próximos passeios ou compromissos ajustáveis.'
                : `Orçamento de despesas: ${formatCurrency(expenseBudget)} (aportes já blindados).`}
            </p>
          </div>

          {/* Daily Safe Limit Bento Strip */}
          {!isOverBudget && safeDailyLimit > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#F0F8EE] dark:bg-emerald-950/30 border border-[#B8E0B0] dark:border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block">
                    Ritmo Diário Sugerido
                  </span>
                  <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 tabular-nums font-display">
                    {formatCurrency(safeDailyLimit)} / dia
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-xl border border-[#B8E0B0] dark:border-emerald-700">
                {daysRemainingInMonth} dia(s) restante(s)
              </span>
            </div>
          )}

          {/* Consumed / Expense Budget Breakdown Row */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span>Consumo do Plano:</span>
            </span>
            <span className="font-black text-slate-800 dark:text-slate-200 tabular-nums">
              {formatCurrency(totalConsumedAmount)} / {formatCurrency(expenseBudget)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
