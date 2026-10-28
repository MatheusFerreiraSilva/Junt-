import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { LifeTierInfo } from '../types/finance';

interface MonthThermometerGaugeProps {
  totalIncome: number;
  totalSpent: number;
  remainingToSpend: number;
  budgetConsumedPercent: number;
  daysRemaining: number;
  safeDailyLimit: number;
  isOverBudget: boolean;
  activeLifeTier: LifeTierInfo;
  streakMonths: number;
  onOpenRaioX: () => void;
}

export const MonthThermometerGauge: React.FC<MonthThermometerGaugeProps> = ({
  totalIncome,
  totalSpent,
  remainingToSpend,
  budgetConsumedPercent,
  daysRemaining,
  safeDailyLimit,
  isOverBudget,
  activeLifeTier,
  streakMonths,
  onOpenRaioX,
}) => {
  // Calculate Financial Health Score (0 - 100) dynamically
  const remainingPercent = Math.max(0, Math.round(100 - budgetConsumedPercent));
  let calculatedScore = 100;
  if (isOverBudget) {
    const overPct = Math.min(60, Math.round(((totalSpent - totalIncome) / (totalIncome || 1)) * 100));
    calculatedScore = Math.max(35, 70 - overPct);
  } else {
    // Healthy pacing adds bonus points; streak adds up to 10 points
    const streakBonus = Math.min(10, streakMonths * 2);
    const pacingDeduction = budgetConsumedPercent > 80 && daysRemaining > 10 ? 15 : 0;
    calculatedScore = Math.min(99, Math.max(65, 85 + streakBonus - pacingDeduction));
  }

  // Segmented Pastel Arcs (5 segments representing month flow)
  // Sage (#B8E0B0), Sky Blue (#A6D8FF), Ochre (#FFC875), Pink (#FFC2E2), Lavender (#D8C7FF)
  const segments = [
    { color: '#B8E0B0', label: 'Início Seguro' },
    { color: '#A6D8FF', label: 'Rotina Estrutural' },
    { color: '#FFC875', label: 'Ritmo Semanal' },
    { color: '#FFC2E2', label: 'Conquistas' },
    { color: '#D8C7FF', label: 'Sobras & Reserva' },
  ];

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
  const gapLength = (gapAngle / 360) * circumference;

  // Active segments filled based on budgetConsumedPercent (0 - 100%)
  const filledRatio = Math.min(1, Math.max(0, budgetConsumedPercent / 100));
  const activeSegmentsCount = Math.ceil(filledRatio * 5);

  return (
    <div
      onClick={onOpenRaioX}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenRaioX(); } }}
      aria-label="Abrir Raio-X do Orçamento do Mês"
      className="clay-card p-6 sm:p-8 cursor-pointer relative overflow-hidden group select-none transition-all duration-300"
    >
      {/* Background Subtle Gradient Glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: isOverBudget ? '#FFC2E2' : '#B8E0B0' }}
      />
      <div
        className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: '#D8C7FF' }}
      />

      {/* Top Header Row of the Card */}
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
              Saúde financeira e ritmo em tempo real
            </span>
          </div>
        </div>

        {/* Clickable Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111318] text-white text-[11px] font-black group-hover:scale-105 transition-all shadow-xs">
          <span>Raio-X</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Main Content: Ring on Left / Metrics on Right on Desktop; Stacked on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        {/* The Segmented Circular Ring */}
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
              {segments.map((seg, idx) => {
                const rotation = idx * (segmentDegrees + gapAngle);
                return (
                  <circle
                    key={`bg-${idx}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                    strokeLinecap="round"
                    opacity={0.25}
                    transform={`rotate(${rotation} ${center} ${center})`}
                  />
                );
              })}

              {/* Active Segments with Tactile Drop Shadow */}
              {segments.map((seg, idx) => {
                const rotation = idx * (segmentDegrees + gapAngle);
                const isActive = idx < activeSegmentsCount;
                if (!isActive) return null;

                return (
                  <circle
                    key={`act-${idx}`}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                    strokeLinecap="round"
                    filter="url(#gaugeShadow)"
                    className="transition-all duration-700 ease-out"
                    transform={`rotate(${rotation} ${center} ${center})`}
                  />
                );
              })}
            </svg>

            {/* Center Content: Score + % Restante + Faixa de Renda */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              {/* Financial Health Score Pill */}
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#111318] text-white text-xs font-black shadow-xs mb-1">
                <span>Nota</span>
                <span className="text-amber-300 font-black tabular-nums">{calculatedScore}</span>
                <span className="text-[10px] text-slate-400">/100</span>
              </div>

              {/* Big Percentage Remaining */}
              <div
                className={`text-3xl sm:text-4xl font-black font-display tracking-tight tabular-nums ${
                  isOverBudget
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#111318] dark:text-white'
                }`}
              >
                {isOverBudget ? 'Estouro' : `${remainingPercent}%`}
              </div>

              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {isOverBudget ? 'Orçamento ultrapassado' : 'restante do orçamento'}
              </div>

              {/* Faixa de Renda Subtitle */}
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {activeLifeTier.emblem} {activeLifeTier.name}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Key Financial Readings & Daily Safe Pacing */}
        <div className="md:col-span-6 space-y-3.5">
          {/* Main Available Currency Display */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              {isOverBudget ? 'Valor Excedido no Mês' : 'Saldo Livre para Gastar'}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black tabular-nums font-display ${
                isOverBudget
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[#111318] dark:text-white'
              }`}
            >
              {isOverBudget
                ? `Passamos ${formatCurrency(Math.abs(remainingToSpend))}`
                : formatCurrency(remainingToSpend)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
              {isOverBudget
                ? 'Vale rever os próximos gastos e ajustar o plano do mês, juntos.'
                : `De um total de ${formatCurrency(totalIncome)} planejado para este mês.`}
            </p>
          </div>

          {/* Daily Safe Limit Bento Strip */}
          {!isOverBudget && safeDailyLimit > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#F0F8EE] dark:bg-emerald-950/30 border border-[#B8E0B0] dark:border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block">
                    Ritmo Diário Seguro
                  </span>
                  <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 tabular-nums font-display">
                    {formatCurrency(safeDailyLimit)} / dia
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-xl border border-[#B8E0B0] dark:border-emerald-700">
                {daysRemaining} dias restantes
              </span>
            </div>
          )}

          {/* Income Tier Progress Row */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span>Faixa de Vida:</span>
              <strong className="text-[#111318] dark:text-white font-black">{activeLifeTier.name}</strong>
            </span>
            <span className="font-black text-slate-800 dark:text-slate-200 tabular-nums">
              {formatCurrency(totalSpent)} / {formatCurrency(totalIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
