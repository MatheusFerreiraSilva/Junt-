import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../context/FinanceContext';
import { MonthTrendRecord, CategoryKey } from '../types/finance';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';
import { DonutChart } from '../components/DonutChart';

export const TrendsScreen: React.FC = () => {
  const {
    state,
    historicalTrends,
    totalIncome,
    totalSpentThisMonth,
    currentAccent,
    partner1ShareSpent,
    partner2ShareSpent,
    jointExpensesTotal,
    partner1SoleExpensesTotal,
    partner2SoleExpensesTotal,
    categoriesSpending,
  } = useFinance();
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const p1SharePct = totalSpentThisMonth > 0 ? Math.round((partner1ShareSpent / totalSpentThisMonth) * 100) : 50;
  const p2SharePct = 100 - p1SharePct;
  const jointPct = totalSpentThisMonth > 0 ? Math.round((jointExpensesTotal / totalSpentThisMonth) * 100) : 0;

  // Find max value for scaling charts
  const maxMonthlyTotal = Math.max(...historicalTrends.map((t: MonthTrendRecord) => t.total), totalIncome * 1.1);

  // Category specific calculations if filtered
  const categoryStats = (catKey: CategoryKey) => {
    const values = historicalTrends.map((t: MonthTrendRecord) => t.spending[catKey]);
    const average = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    const diffPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
    const maxVal = Math.max(...values);
    return { average, current, previous, diffPct, maxVal };
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
            Tendências de Gastos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Acompanhe o padrão de consumo de {state.profile.partner1Name} & {state.profile.partner2Name} ao longo dos últimos 6 meses.
          </p>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              chartType === 'bar'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Barras
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              chartType === 'line'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Trajetória
          </button>
        </div>
      </div>

      {/* Category selector pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          ✨ Todas as 5 Áreas
        </button>

        {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
          const cat = CATEGORIES_BASE[key];
          const isSelected = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-accent-primary text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Chart Area */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
              {selectedCategory === 'all'
                ? 'Comportamento Mensal Consolidado'
                : `Padrão de Gastos em ${CATEGORIES_BASE[selectedCategory].name}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Histórico de Maio a Outubro de 2026
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-3 h-0.5 bg-slate-400 inline-block border-t border-dashed" />
              Teto do Orçamento ({formatCurrency(totalIncome)})
            </span>
          </div>
        </div>

        {/* Interactive Visual Graph */}
        {chartType === 'bar' ? (
          /* Stacked / Grouped Bars with Clean Modern Styling */
          <div className="relative pt-8 pb-4">
            {/* Budget limit reference dashed line */}
            {selectedCategory === 'all' && (
              <div
                className="absolute left-0 right-0 border-b-2 border-dashed border-accent-primary/60 pointer-events-none z-10"
                style={{
                  bottom: `${Math.min(92, Math.max(10, Math.round((totalIncome / maxMonthlyTotal) * 100 * 0.72)))}%`,
                }}
              >
                <span className="absolute right-0 -top-5 text-[10px] font-bold text-accent-themed bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-accent-border shadow-2xs">
                  Teto do Orçamento: {formatCurrency(totalIncome)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-72 pt-4 px-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              {historicalTrends.map((record: MonthTrendRecord) => {
                const totalVal =
                  selectedCategory === 'all'
                    ? record.total
                    : record.spending[selectedCategory];

                const maxRef =
                  selectedCategory === 'all'
                    ? maxMonthlyTotal
                    : Math.max(...historicalTrends.map((t: MonthTrendRecord) => t.spending[selectedCategory])) * 1.25;

                const heightPct = Math.min(100, Math.max(14, Math.round((totalVal / maxRef) * 100)));

                return (
                  <div
                    key={record.monthKey}
                    className="flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Hover Detailed Tooltip Card */}
                    <div className="absolute -top-24 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 bg-slate-900 text-white dark:bg-white dark:text-slate-900 p-2.5 rounded-2xl shadow-xl text-[10px] whitespace-nowrap min-w-[130px] border border-slate-800 dark:border-slate-200">
                      <div className="font-extrabold border-b border-white/20 dark:border-slate-200 pb-1 mb-1">
                        {record.label}: {formatCurrency(totalVal)}
                      </div>
                      <div className="space-y-0.5">
                        <div>🏠 Moradia: {formatCurrency(record.spending.moradia)}</div>
                        <div>🥗 Comida: {formatCurrency(record.spending.comida)}</div>
                        <div>🎉 Lazer: {formatCurrency(record.spending.lazer)}</div>
                        <div>🛡️ Proteção: {formatCurrency(record.spending.protecao)}</div>
                        <div>📚 Profissional: {formatCurrency(record.spending.profissional)}</div>
                      </div>
                    </div>

                    {/* Always visible compact value pill */}
                    <div className="text-[10px] sm:text-xs font-black text-slate-800 dark:text-slate-200 tabular-nums mb-1.5 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                      {formatCompactCurrency(totalVal)}
                    </div>

                    {/* Bar Column */}
                    <div
                      className="w-full max-w-[56px] rounded-t-2xl transition-all duration-500 overflow-hidden flex flex-col justify-end shadow-xs group-hover:ring-2 ring-accent-primary/50"
                      style={{ height: `${heightPct}%` }}
                    >
                      {selectedCategory === 'all' ? (
                        /* Stacked segments of 5 categories */
                        <div className="w-full h-full rounded-t-2xl overflow-hidden flex flex-col justify-end">
                          <div
                            style={{ height: `${(record.spending.moradia / record.total) * 100}%` }}
                            className="bg-teal-600 dark:bg-teal-500 transition-all hover:brightness-110"
                            title={`Moradia: ${formatCurrency(record.spending.moradia)}`}
                          />
                          <div
                            style={{ height: `${(record.spending.comida / record.total) * 100}%` }}
                            className="bg-sky-500 dark:bg-sky-400 transition-all hover:brightness-110"
                            title={`Comida: ${formatCurrency(record.spending.comida)}`}
                          />
                          <div
                            style={{ height: `${(record.spending.lazer / record.total) * 100}%` }}
                            className="bg-purple-500 dark:bg-purple-400 transition-all hover:brightness-110"
                            title={`Lazer: ${formatCurrency(record.spending.lazer)}`}
                          />
                          <div
                            style={{ height: `${(record.spending.protecao / record.total) * 100}%` }}
                            className="bg-rose-500 dark:bg-rose-400 transition-all hover:brightness-110"
                            title={`Proteção: ${formatCurrency(record.spending.protecao)}`}
                          />
                          <div
                            style={{ height: `${(record.spending.profissional / record.total) * 100}%` }}
                            className="bg-amber-500 dark:bg-amber-400 transition-all hover:brightness-110"
                            title={`Profissional: ${formatCurrency(record.spending.profissional)}`}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-full h-full rounded-t-2xl transition-all hover:brightness-110"
                          style={{ backgroundColor: CATEGORIES_BASE[selectedCategory].colorHex }}
                        />
                      )}
                    </div>

                    <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300 font-display">
                      {record.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* SVG Line / Trajectory Graph */
          <div className="py-4">
            <svg viewBox="0 0 500 200" className="w-full h-56 overflow-visible">
              <defs>
                <linearGradient id="gradientLine" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={
                      selectedCategory === 'all'
                        ? currentAccent.hex
                        : CATEGORIES_BASE[selectedCategory].colorHex
                    }
                    stopOpacity="0.35"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      selectedCategory === 'all'
                        ? currentAccent.hex
                        : CATEGORIES_BASE[selectedCategory].colorHex
                    }
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#94A3B8" strokeOpacity="0.25" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#94A3B8" strokeOpacity="0.25" strokeDasharray="3 3" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#94A3B8" strokeOpacity="0.25" strokeDasharray="3 3" />

              {/* Calculate points */}
              {(() => {
                const values = historicalTrends.map((t: MonthTrendRecord) =>
                  selectedCategory === 'all' ? t.total : t.spending[selectedCategory]
                );
                const maxVal = Math.max(...values) * 1.15;
                const minVal = Math.min(...values) * 0.85;

                const points = values.map((val: number, idx: number) => {
                  const x = (idx / (values.length - 1)) * 460 + 20;
                  const y = 180 - ((val - minVal) / (maxVal - minVal)) * 140;
                  return { x, y, val };
                });

                const pathD = points.reduce(
                  (acc: string, pt: { x: number; y: number; val: number }, i: number) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`),
                  ''
                );

                const areaD = `${pathD} L ${points[points.length - 1].x},190 L ${points[0].x},190 Z`;

                return (
                  <>
                    <path d={areaD} fill="url(#gradientLine)" />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        selectedCategory === 'all'
                          ? currentAccent.hex
                          : CATEGORIES_BASE[selectedCategory].colorHex
                      }
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((pt: { x: number; y: number; val: number }, i: number) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="5"
                          fill="currentColor"
                          className="text-white dark:text-slate-900"
                          stroke={
                            selectedCategory === 'all'
                              ? currentAccent.hex
                              : CATEGORIES_BASE[selectedCategory].colorHex
                          }
                          strokeWidth="3"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          fontSize="10"
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-slate-600 dark:text-slate-300 font-bold"
                        >
                          {formatCompactCurrency(pt.val)}
                        </text>
                        <text
                          x={pt.x}
                          y="198"
                          fontSize="10"
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-slate-400 dark:text-slate-500 font-medium"
                        >
                          {historicalTrends[i].label}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Legend */}
        {selectedCategory === 'all' ? (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => (
              <div key={key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORIES_BASE[key].colorHex }}
                />
                <span>{CATEGORIES_BASE[key].name}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Stats for selected category */
          (() => {
            const stats = categoryStats(selectedCategory);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-400 block">Média mensal (6 meses)</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-base tabular-nums">
                    {formatCurrency(stats.average)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-400 block">Pico mais alto</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-base tabular-nums">
                    {formatCurrency(stats.maxVal)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-400 block">Variação vs Mês Passado</span>
                  <span
                    className={`font-extrabold text-base tabular-nums flex items-center gap-1 ${
                      stats.diffPct > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {stats.diffPct > 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(stats.diffPct)}%
                  </span>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Couple Spending Division Trends (Conjunto vs Individual vs Proporcional) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-accent-surface text-accent-primary flex items-center justify-center font-bold text-base">
            ⚖️
          </span>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
              Divisão de Gastos: Conjunto vs Individual
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição e proporções entre {state.profile.partner1Name} e {state.profile.partner2Name}
            </p>
          </div>
        </div>

        {/* Visual Share Distribution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-accent-primary flex items-center gap-1">
              <span>👤</span> {state.profile.partner1Name}: {formatCurrency(partner1ShareSpent)} ({p1SharePct}%)
            </span>
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
              {state.profile.partner2Name}: {formatCurrency(partner2ShareSpent)} ({p2SharePct}%) <span>👤</span>
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex p-0.5 border border-slate-200/60 dark:border-slate-700">
            <div
              className="h-full bg-accent-primary rounded-l-full transition-all duration-700"
              style={{ width: `${p1SharePct}%` }}
            />
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 rounded-r-full transition-all duration-700"
              style={{ width: `${p2SharePct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60">
            <span className="text-xs font-semibold text-purple-900 dark:text-purple-300 block">
              🤝 Gastos em Conjunto
            </span>
            <span className="text-lg font-extrabold text-purple-950 dark:text-purple-200 tabular-nums block mt-0.5">
              {formatCurrency(jointExpensesTotal)}
            </span>
            <span className="text-[11px] text-purple-800/80 dark:text-purple-400 mt-1 block">
              Divididos 50/50 ou conforme porcentagem
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent-surface border border-accent-themed">
            <span className="text-xs font-semibold text-accent-themed block">
              Só {state.profile.partner1Name} (100%)
            </span>
            <span className="text-lg font-extrabold text-accent-themed tabular-nums block mt-0.5">
              {formatCurrency(partner1SoleExpensesTotal)}
            </span>
            <span className="text-[11px] text-accent-themed opacity-80 mt-1 block">
              Despesas exclusivamente individuais
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-300 block">
              Só {state.profile.partner2Name} (100%)
            </span>
            <span className="text-lg font-extrabold text-blue-950 dark:text-blue-200 tabular-nums block mt-0.5">
              {formatCurrency(partner2SoleExpensesTotal)}
            </span>
            <span className="text-[11px] text-blue-800/80 dark:text-blue-400 mt-1 block">
              Despesas exclusivamente individuais
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Category Spending Donut Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
            Distribuição de Gastos por Categoria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visão proporcional dos gastos do mês atual entre as 5 áreas da vida
          </p>
        </div>

        <div className="flex justify-center py-2">
          <DonutChart
            data={(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => ({
              label: CATEGORIES_BASE[key].name,
              value: categoriesSpending[key]?.spent || 0,
              color: CATEGORIES_BASE[key].colorHex,
            }))}
            size={240}
            thickness={42}
            centerTitle="Total Gasto"
            centerSubtitle="Este Mês"
          />
        </div>
      </div>

      {/* Medical Insights and Intelligence Card */}
      <div className="bg-accent-surface border border-accent-themed rounded-3xl p-5 sm:p-6 space-y-3 text-xs text-accent-themed">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-primary" />
          <h4 className="font-bold uppercase tracking-wider text-accent-themed">
            Insights do Casal Médico
          </h4>
        </div>
        <p className="leading-relaxed">
          • <strong>Estabilidade em Moradia:</strong> Os custos residenciais no Jardins mantiveram-se previsíveis (média de R$ 5.300/mês).
        </p>
        <p className="leading-relaxed">
          • <strong>Sazonalidade em Julho:</strong> Observou-se um pico em Lazer e Profissional decorrente de viagens e congressos médicos de inverno.
        </p>
        <p className="leading-relaxed">
          • <strong>Margem de Poupança:</strong> O casal manteve uma taxa de economia acima de 25% em 5 dos 6 meses analisados.
        </p>
      </div>
    </div>
  );
};
