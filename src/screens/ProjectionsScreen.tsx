import React, { useCallback, useState, useMemo } from 'react';
import {
  TrendingUp,
  Sparkles,
  Info,
  Calendar,
  DollarSign,
  Heart,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';

import { selectAnnualYield, selectTotalProtectedAssets } from '../utils/domainSelectors';

export const ProjectionsScreen: React.FC = () => {
  const { state, totalSavedInPiggyBanks, totalMonthlyPiggyDeposits } = useFinance();

  const [extraMonthlyDeposit, setExtraMonthlyDeposit] = useState<number>(0);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(10); // 5, 10, 20, 30 years

  const totalMonthlySavings = totalMonthlyPiggyDeposits + extraMonthlyDeposit;
  const totalProtectedAssets = useMemo(() => selectTotalProtectedAssets(state, 'casal').totalProtected, [state]);
  const initialCapital = totalProtectedAssets > 0 ? totalProtectedAssets : totalSavedInPiggyBanks;

  const annualYieldPct = selectAnnualYield(state);
  const annualYield = annualYieldPct / 100;
  const monthlyYield = annualYield > -1 ? Math.pow(1 + annualYield, 1 / 12) - 1 : -0.01;

  // Calculate future values for 5, 10, 20, 30 years
  const horizons = useMemo(() => [5, 10, 20, 30], []);

  const calculateFutureValue = useCallback(
    (years: number, monthly: number, currentInitial: number) => {
      const totalMonths = years * 12;
      // Compound interest formula with monthly deposits: FV = PV*(1+r)^n + PMT * [((1+r)^n - 1) / r]
      let total = currentInitial * Math.pow(1 + monthlyYield, totalMonths);
      if (monthlyYield > 0) {
        total += monthly * ((Math.pow(1 + monthlyYield, totalMonths) - 1) / monthlyYield);
      } else {
        total += monthly * totalMonths;
      }
      return Math.round(total);
    },
    [monthlyYield]
  );

  const projections = useMemo(() => {
    return horizons.map(yrs => {
      const fv = calculateFutureValue(yrs, totalMonthlySavings, initialCapital);
      const totalDeposited = initialCapital + totalMonthlySavings * yrs * 12;
      const earnings = Math.max(0, fv - totalDeposited);
      // "Dinheiro que trabalha sozinho" per month safely (using safe ~0.4% per month real withdrawal)
      const passiveIncomeMonth = Math.round(fv * (annualYield / 12));

      return {
        years: yrs,
        futureValue: fv,
        totalDeposited,
        earnings,
        passiveIncomeMonth,
      };
    });
  }, [
    horizons,
    totalMonthlySavings,
    initialCapital,
    annualYield,
    calculateFutureValue,
  ]);

  const activeProj = projections.find(p => p.years === selectedHorizon) || projections[1];

  // SVG Chart data
  const maxFV = projections[projections.length - 1].futureValue || 1;

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              O Futuro do Casal
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              🔮 Só para curiosos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Veja a mágica do dinheiro trabalhando sozinho ao longo dos anos para {state.profile.partner1Name} & {state.profile.partner2Name}.
          </p>
        </div>
      </div>

      {/* Main Vision Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Em {selectedHorizon} anos juntos
          </span>
          <div className="text-3xl sm:text-5xl font-black tabular-nums font-display my-2 text-white">
            {formatCurrency(activeProj.futureValue)}
          </div>
          <div className="text-xs sm:text-sm text-purple-100/90 leading-relaxed mt-1">
            Esse patrimônio gera cerca de{' '}
            <strong className="text-emerald-300 font-extrabold text-base">
              {formatCurrency(activeProj.passiveIncomeMonth)} por mês
            </strong>{' '}
            em <strong>dinheiro que trabalha sozinho</strong>, sem vocês precisarem encostar no principal!
          </div>
        </div>
      </div>

      {/* Horizon Selector (5, 10, 20, 30 anos) */}
      <div className="grid grid-cols-4 gap-2">
        {horizons.map(yrs => {
          const isSelected = selectedHorizon === yrs;
          const p = projections.find(item => item.years === yrs);
          return (
            <button
              key={yrs}
              onClick={() => setSelectedHorizon(yrs)}
              className={`p-3.5 rounded-2xl border-2 text-center transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-50 text-purple-950 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                {yrs} anos
              </div>
              <div className="text-sm sm:text-base font-extrabold tabular-nums mt-0.5">
                {formatCompactCurrency(p?.futureValue || 0)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual Future Growth Chart */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base font-display">
            A Curva de Crescimento do Casal
          </h3>
          <span className="text-xs text-slate-500">
            Considerando rendimento acima da inflação ({state.profile.expectedYieldAnnual}% ao ano)
          </span>
        </div>

        {/* Bar comparison visual */}
        <div className="grid grid-cols-4 gap-3 pt-6 pb-2 items-end h-56">
          {projections.map(item => {
            const heightPct = Math.max(12, Math.round((item.futureValue / maxFV) * 100));
            const isSelected = item.years === selectedHorizon;

            return (
              <div
                key={item.years}
                onClick={() => setSelectedHorizon(item.years)}
                className="flex flex-col items-center h-full justify-end cursor-pointer group"
              >
                <div className="text-[11px] font-bold text-slate-700 tabular-nums mb-2 text-center">
                  {formatCompactCurrency(item.futureValue)}
                </div>

                <div
                  className={`w-full max-w-[64px] rounded-2xl transition-all duration-500 relative overflow-hidden flex flex-col justify-end p-1 ${
                    isSelected
                      ? 'bg-purple-600 shadow-md shadow-purple-600/30'
                      : 'bg-slate-200 group-hover:bg-slate-300'
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  {/* Subtle inner accent */}
                  <div className="w-full bg-white/20 rounded-xl h-2 mb-1" />
                </div>

                <div className="mt-2 text-xs font-bold text-slate-700">
                  {item.years} anos
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block">Guardado do bolso de vocês:</span>
            <span className="font-extrabold text-slate-900 text-sm tabular-nums">
              {formatCurrency(activeProj.totalDeposited)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Dinheiro gerado sozinho (juros):</span>
            <span className="font-extrabold text-emerald-700 text-sm tabular-nums">
              +{formatCurrency(activeProj.earnings)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Renda mensal livre estimada:</span>
            <span className="font-extrabold text-purple-700 text-sm tabular-nums">
              {formatCurrency(activeProj.passiveIncomeMonth)}/mês
            </span>
          </div>
        </div>
      </div>

      {/* Simulator: "E se guardarmos mais por mês?" */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-base font-display">
            Simulador: E se o casal guardar um pouquinho a mais?
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Hoje vocês guardam <strong>{formatCurrency(totalMonthlyPiggyDeposits)}/mês</strong> nos cofrinhos.
          Arraste para testar o efeito de guardar um extra todo mês:
        </p>

        <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200/70 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-purple-900">
              Aporte extra mensal: +{formatCurrency(extraMonthlyDeposit)}
            </span>
            <span className="text-purple-950 font-bold">
              Total guardado: {formatCurrency(totalMonthlySavings)}/mês
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="3000"
            step="100"
            value={extraMonthlyDeposit}
            onChange={e => setExtraMonthlyDeposit(parseInt(e.target.value, 10))}
            className="w-full accent-purple-600"
          />

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {[0, 200, 500, 1000, 1500].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setExtraMonthlyDeposit(val)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  extraMonthlyDeposit === val
                    ? 'bg-purple-700 text-white'
                    : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                +{formatCurrency(val)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
