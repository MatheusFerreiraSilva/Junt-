import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  formatMonthYear,
  getPreviousMonth,
  getNextMonth,
  getMonthProgress,
} from '../utils/formatters';

export const MonthSelector: React.FC = () => {
  const { state, setCurrentMonth } = useFinance();
  const progress = getMonthProgress(state.currentMonth);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 px-4 py-3 sm:py-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 shadow-sm transition-colors">
      {/* Month Navigator Controls - Spacious and distinct */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-2">
        <button
          onClick={() => setCurrentMonth(getPreviousMonth(state.currentMonth))}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors border-2 border-slate-300 dark:border-slate-700 cursor-pointer"
          title="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 shadow-2xs">
          <Calendar className="w-4 h-4 text-accent-primary shrink-0 stroke-[2.5]" />
          <span className="font-black text-slate-950 dark:text-white text-sm sm:text-base tracking-tight whitespace-nowrap font-display">
            {formatMonthYear(state.currentMonth)}
          </span>
        </div>

        <button
          onClick={() => setCurrentMonth(getNextMonth(state.currentMonth))}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors border-2 border-slate-300 dark:border-slate-700 cursor-pointer"
          title="Próximo mês"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Month Progress & Rhythm Indicator */}
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 text-xs text-slate-700 dark:text-slate-300 font-bold pt-1 sm:pt-0 border-t-2 sm:border-t-0 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Ritmo:</span>
          <span className="font-black text-slate-950 dark:text-white">{progress.percentPassed}%</span>
        </div>

        <div className="w-24 sm:w-32 h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-600 shrink-0">
          <div
            className="h-full bg-accent-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.percentPassed}%` }}
          />
        </div>

        <span className="font-black text-accent-themed whitespace-nowrap text-xs">
          {progress.daysRemaining === 0 ? 'Mês encerrado' : `Faltam ${progress.daysRemaining} dias`}
        </span>
      </div>
    </div>
  );
};
