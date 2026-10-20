import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Sparkles,
  TrendingUp,
  DollarSign,
  Award,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Plus,
  ArrowRight,
  BookOpen,
  Home,
  Utensils,
  PartyPopper,
  Zap,
  Info,
  Edit3,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';

interface CollegeCategoryDef {
  key: string;
  name: string;
  emoji: string;
  pct: number;
  floorR$: number;
  description: string;
  colorHex: string;
  bgLight: string;
  borderHex: string;
}

export const COLLEGE_CATEGORIES_DEF: CollegeCategoryDef[] = [
  {
    key: 'casa_transporte',
    name: 'Casa e Transporte',
    emoji: '🚌🏠',
    pct: 25,
    floorR$: 120,
    description: 'Ônibus, metrô, uber ocasional, celular e contribuição simbólica em casa.',
    colorHex: '#0D9488',
    bgLight: '#F0FDFA',
    borderHex: '#99F6E4',
  },
  {
    key: 'alimentacao_rua',
    name: 'Alimentação na Rua',
    emoji: '🍱☕',
    pct: 30,
    floorR$: 150,
    description: 'Almoço no RU / faculdade, lanches e cafés entre as aulas.',
    colorHex: '#0284C7',
    bgLight: '#F0F9FF',
    borderHex: '#BAE6FD',
  },
  {
    key: 'lazer_social',
    name: 'Lazer e Social',
    emoji: '🍿🎮',
    pct: 20,
    floorR$: 0,
    description: 'Streaming, cinema, saída com amigos da turma.',
    colorHex: '#8B5CF6',
    bgLight: '#F5F3FF',
    borderHex: '#DDD6FE',
  },
  {
    key: 'faculdade',
    name: 'Faculdade & Estudos',
    emoji: '🩺📚',
    pct: 15,
    floorR$: 50,
    description: 'Livros, materiais, jaleco, cópias, inscrições e cursos.',
    colorHex: '#D97706',
    bgLight: '#FFFBEB',
    borderHex: '#FDE68A',
  },
  {
    key: 'investimentos',
    name: 'Investimentos da Bolsa',
    emoji: '🌱💰',
    pct: 10,
    floorR$: 30,
    description: 'Pouco, mas sagrado. A regra de ouro é nunca deixar em zero.',
    colorHex: '#059669',
    bgLight: '#ECFDF5',
    borderHex: '#A7F3D0',
  },
];

interface CollegeModeViewProps {
  onOpenExpenseModal: () => void;
}

export const CollegeModeView: React.FC<CollegeModeViewProps> = ({ onOpenExpenseModal }) => {
  const {
    state,
    updateCollegeData,
    advanceCollegeSemester,
    depositCollegeInvestment,
    migrateCollegeToProfessional,
    setAppMode,
  } = useFinance();

  const collegeData = state.collegeModeData || {
    active: true,
    courseName: 'Medicina',
    currentSemester: 5,
    totalSemesters: 12,
    monthlyStipend: 600,
    totalInvestedInCollege: 1420,
  };

  const currentSem = collegeData.currentSemester || 1;
  const totalSem = collegeData.totalSemesters || 12;
  const stipend = collegeData.monthlyStipend || 600;
  const totalInvestedSoFar = collegeData.totalInvestedInCollege || 0;

  // Modals state
  const [isEditingJourney, setIsEditingJourney] = useState(false);
  const [editCourse, setEditCourse] = useState(collegeData.courseName);
  const [editCurrentSem, setEditCurrentSem] = useState(currentSem.toString());
  const [editTotalSem, setEditTotalSem] = useState(totalSem.toString());
  const [editStipend, setEditStipend] = useState(stipend.toString());

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState('');

  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [newProIncomeInput, setNewProIncomeInput] = useState('12000');

  // Calculated Journey Metrics
  const remainingSemesters = Math.max(0, totalSem - currentSem);
  const remainingMonths = remainingSemesters * 6;
  const progressPct = Math.min(100, Math.round((currentSem / totalSem) * 100));

  // Monthly investment calculation (10% of stipend or R$ 60 default)
  const monthlyInvestTarget = Math.round(stipend * 0.10);
  
  // Compound interest projection until graduation (0.6% real yield per month)
  const monthlyRate = 0.006;
  const projectedAtGraduation = Math.round(
    totalInvestedSoFar * Math.pow(1 + monthlyRate, remainingMonths) +
      monthlyInvestTarget * ((Math.pow(1 + monthlyRate, remainingMonths) - 1) / monthlyRate)
  );

  // Dynamic Progress Bar Color & Motivational Message
  let progressBarGradient = 'from-emerald-400 to-teal-500';
  let badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  let motivationalMessage = 'Você está começando. Cada passo conta.';

  if (progressPct <= 25) {
    progressBarGradient = 'from-emerald-400 to-teal-500';
    badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    motivationalMessage = 'Até 25%: Você está começando. Cada passo conta.';
  } else if (progressPct <= 50) {
    progressBarGradient = 'from-teal-500 to-emerald-600';
    badgeStyle = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
    motivationalMessage = 'De 26% a 50%: Metade do caminho está chegando. Continue firme.';
  } else if (progressPct <= 75) {
    progressBarGradient = 'from-sky-500 to-blue-600';
    badgeStyle = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
    motivationalMessage = 'De 51% a 75%: Você já passou da metade. O fim está mais perto do que o começo.';
  } else if (progressPct < 100) {
    progressBarGradient = 'from-amber-400 via-yellow-500 to-amber-600';
    badgeStyle = 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    motivationalMessage = 'De 76% a 99%: Reta final. Falta pouco para você se formar.';
  } else {
    progressBarGradient = 'from-emerald-300 via-teal-400 to-emerald-500 animate-pulse';
    badgeStyle = 'bg-emerald-500 text-white shadow-sm';
    motivationalMessage = 'Em 100%: Parabéns! Você se formou. Hora de migrar para o Modo Profissional.';
  }

  // Calculate spent amounts per category from month expenses
  const currentMonth = state.currentMonth;
  const monthExpenses = state.expenses.filter(e => e.date.startsWith(currentMonth));
  const totalMonthSpent = monthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const remainingStipend = Math.max(0, stipend - totalMonthSpent);

  const handleSaveJourney = (e: React.FormEvent) => {
    e.preventDefault();
    const cSem = parseInt(editCurrentSem) || 1;
    const tSem = parseInt(editTotalSem) || 12;
    const stp = parseFloat(editStipend.replace(',', '.')) || 600;

    updateCollegeData({
      courseName: editCourse.trim() || 'Medicina',
      currentSemester: cSem,
      totalSemesters: tSem,
      monthlyStipend: stp,
    });
    setIsEditingJourney(false);
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmountInput.replace(',', '.')) || 0;
    if (amt > 0) {
      depositCollegeInvestment(amt);
      setIsDepositModalOpen(false);
      setDepositAmountInput('');
    }
  };

  const handleMigrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inc = parseFloat(newProIncomeInput.replace(',', '.')) || 12000;
    migrateCollegeToProfessional(inc);
    setIsMigrationModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner & App Mode Switcher */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-lg border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
              🎓 MODO FACULDADE ATIVO
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              · {collegeData.courseName || 'Medicina'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
            Painel do Estudante — Gestão com Bolsa R$ {stipend}
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            Feito especialmente para quem está na faculdade, mora com os pais e quer investir com disciplina desde o primeiro semestre.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAppMode('casal')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Voltar ao Modo Casal / Profissional"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>Alternar p/ Modo Profissional</span>
          </button>

          {progressPct >= 100 && (
            <button
              onClick={() => setIsMigrationModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer animate-bounce"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Migrar para Modo Profissional! 🎉</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CARD "MINHA JORNADA" (CONTADOR DE PERÍODO & PROGRESSO DA FORMATURA) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-6 relative overflow-hidden transition-colors">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-bold shrink-0 shadow-2xs">
              🎓
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                  Minha Jornada — {collegeData.courseName}
                </h3>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${badgeStyle}`}>
                  {progressPct}% Concluído
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Contador de período, tempo até a formatura e projeção patrimonial do estudante.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setEditCourse(collegeData.courseName);
              setEditCurrentSem(currentSem.toString());
              setEditTotalSem(totalSem.toString());
              setEditStipend(stipend.toString());
              setIsEditingJourney(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            title="Editar semestre, total do curso ou bolsa mensal"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ajustar Curso & Bolsa</span>
          </button>
        </div>

        {/* 4 Numbers Side-by-Side (Período Atual vs Total vs Falta em Semestres vs Falta em Meses) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              1. Período Atual
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display tabular-nums">
              {currentSem}º Semestre
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              2. Total do Curso
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display tabular-nums">
              {totalSem} Semestres
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-1">
              3. Quanto Falta
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display tabular-nums">
              {remainingSemesters > 0 ? `${remainingSemesters} Semestres` : 'Formado! 🎓'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-center">
            <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider block mb-1">
              4. Tempo em Meses
            </span>
            <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 font-display tabular-nums">
              {remainingMonths > 0 ? `${remainingMonths} Meses` : 'Formatura! 🚀'}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar with Dynamic Colors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>Progresso no Curso de {collegeData.courseName}:</span>
              <strong>{currentSem} de {totalSem} Semestres ({progressPct}%)</strong>
            </span>
            <button
              onClick={() => advanceCollegeSemester()}
              disabled={progressPct >= 100}
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-extrabold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Concluir +1 Semestre</span>
            </button>
          </div>

          <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200/80 dark:border-slate-700 overflow-hidden relative shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${progressBarGradient} transition-all duration-700 shadow-sm`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Motivational Message Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{motivationalMessage}</span>
          </div>
        </div>

        {/* Investment Goal per Period Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 max-w-xl">
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
              💡 Meta de Investimento da Bolsa por Período
            </span>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
              Se você investir <strong>R$ {monthlyInvestTarget}/mês</strong> (10% da sua bolsa de R$ {stipend}) até se formar ({remainingMonths} meses), terá{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 text-sm sm:text-base font-black tabular-nums">
                {formatCurrency(projectedAtGraduation)}
              </strong>{' '}
              acumulado no dia da sua formatura!
            </p>
          </div>

          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Guardar Investimento</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TERMÔMETRO DO MÊS (VOCÊ AINDA PODE GASTAR R$ X) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xl font-bold">
              🌡️
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                Termômetro da Bolsa — {state.currentMonth}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento em tempo real do limite da bolsa e gastos do mês.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenExpenseModal}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lançar Gasto com Bolsa</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Bolsa Mensal Total
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display tabular-nums block my-1">
              {formatCurrency(stipend)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Recebimento fixo do estudante
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Já Gastou este Mês
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-display tabular-nums block my-1">
              {formatCurrency(totalMonthSpent)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Total de despesas registradas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider block">
              Ainda Pode Gastar
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display tabular-nums block my-1">
              {formatCurrency(remainingStipend)}
            </span>
            <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              {remainingStipend > 0 ? 'Dentro do limite da bolsa ✓' : 'Atenção ao orçamento!'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CARDS DAS 5 CATEGORIAS DO MODO FACULDADE */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
              As 5 Categorias do Modo Faculdade (Divisão para Bolsa de R$ {stipend})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proporções equilibradas com pisos mínimos para garantir que nada essencial falte.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLLEGE_CATEGORIES_DEF.map(cat => {
            const allocatedBudget = Math.round((stipend * cat.pct) / 100);
            
            // Calculate spent in this category
            const spent = monthExpenses
              .filter(e => {
                if (cat.key === 'casa_transporte') return e.category === 'moradia';
                if (cat.key === 'alimentacao_rua') return e.category === 'comida';
                if (cat.key === 'lazer_social') return e.category === 'lazer';
                if (cat.key === 'faculdade') return e.category === 'profissional';
                if (cat.key === 'investimentos') return e.category === 'protecao';
                return false;
              })
              .reduce((a, b) => a + b.amount, 0);

            const remaining = Math.max(0, allocatedBudget - spent);
            const catPct = Math.min(100, Math.round((spent / Math.max(1, allocatedBudget)) * 100));

            return (
              <div
                key={cat.key}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xl font-bold">
                        {cat.emoji}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white font-display">
                          {cat.name}
                        </h4>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {cat.pct}% da bolsa ({formatCurrency(allocatedBudget)})
                        </span>
                      </div>
                    </div>

                    {cat.floorR$ > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        Piso: {formatCurrency(cat.floorR$)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">
                      Gasto: {formatCurrency(spent)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Resta: <strong>{formatCurrency(remaining)}</strong>
                    </span>
                  </div>

                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${catPct}%`,
                        backgroundColor: cat.colorHex,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {catPct}% utilizado
                    </span>
                    <button
                      onClick={onOpenExpenseModal}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <span>+ Registar Gasto</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CARD DE INVESTIMENTOS ACUMULADOS & 5. META DE FORMATURA */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 4: Investimentos Acumulados */}
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-3xl p-6 text-white border border-emerald-500/30 shadow-md space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-lg font-bold">
                🌱
              </span>
              <h4 className="font-extrabold text-base sm:text-lg font-display text-white">
                Investimentos Acumulados na Faculdade
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              O patrimônio que você construiu enquanto estava na faculdade. Cada real investido agora é a base da sua vida como profissional.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
              Total Investido até Hoje
            </span>
            <span className="text-3xl sm:text-4xl font-black tabular-nums font-display text-white">
              {formatCurrency(totalInvestedSoFar)}
            </span>
          </div>

          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Guardar Investimento da Bolsa</span>
          </button>
        </div>

        {/* Card 5: Meta de Formatura */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg font-bold">
                🏆
              </span>
              <h4 className="font-extrabold text-base sm:text-lg font-display text-slate-900 dark:text-white">
                Meta Patrimonial de Formatura
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Com aportes constantes de R$ {monthlyInvestTarget}/mês e juros compostos da renda fixa:
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 tracking-wider block">
              Patrimônio Estimado na Formatura ({remainingMonths} meses)
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-200 font-display tabular-nums block">
              {formatCurrency(projectedAtGraduation)}
            </span>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              Se continuar investindo R$ {monthlyInvestTarget}/mês, você se formará com este saldo garantido!
            </p>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
            "Cada R$ 60 investido agora vale mais do que R$ 600 investidos daqui a 10 anos, porque o tempo é o maior aliado do estudante."
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AS TRÊS REGRAS DO MODO FACULDADE */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold">
            📜
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
            As Três Regras de Ouro do Modo Faculdade
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
            <strong className="text-slate-900 dark:text-white font-extrabold text-xs block">
              1. Investimento Mínimo
            </strong>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              O investimento mínimo é R$ 30, não 10%. Se o mês apertar, R$ 30 já valem. O importante é nunca deixar em zero.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
            <strong className="text-slate-900 dark:text-white font-extrabold text-xs block">
              2. Proteção de Imprevistos
            </strong>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Se a bolsa atrasar, o app protege primeiro Casa e Alimentação. Lazer e Faculdade esperam.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
            <strong className="text-slate-900 dark:text-white font-extrabold text-xs block">
              3. Transição de Formatura
            </strong>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Ao se formar (100%), o app permite a transição para o Modo Profissional em 1 clique, mantendo todo o histórico intacto.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: AJUSTAR JORNADA E CURSO */}
      {/* ========================================================================= */}
      {isEditingJourney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white font-display">
                Ajustar Minha Jornada Universitária
              </h3>
              <button
                onClick={() => setIsEditingJourney(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJourney} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Curso
                </label>
                <input
                  type="text"
                  value={editCourse}
                  onChange={e => setEditCourse(e.target.value)}
                  placeholder="Ex: Medicina, Engenharia, Direito"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Semestre Atual
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editCurrentSem}
                    onChange={e => setEditCurrentSem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Total de Semestres
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editTotalSem}
                    onChange={e => setEditTotalSem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Bolsa Mensal (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  value={editStipend}
                  onChange={e => setEditStipend(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingJourney(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
                >
                  Salvar Jornada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APORTAR DA BOLSA */}
      {/* ========================================================================= */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white font-display">
              🌱 Guardar Investimento da Bolsa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digite o valor economizado da bolsa para somar ao seu patrimônio de estudante.
            </p>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor a guardar (R$)
                </label>
                <input
                  type="text"
                  placeholder="60,00"
                  value={depositAmountInput}
                  onChange={e => setDepositAmountInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TRANSIÇÃO DE FORMATURA E MODO PROFISSIONAL */}
      {/* ========================================================================= */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-7 shadow-2xl border-2 border-emerald-500 space-y-5 text-slate-800 dark:text-slate-100">
            <div className="text-center space-y-2">
              <span className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-md">
                🎓🎉
              </span>
              <h3 className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white font-display">
                Parabéns! Você se formou!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Sua jornada acadêmica terminou com sucesso! Os{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                  {formatCurrency(totalInvestedSoFar)}
                </strong>{' '}
                que você investiu durante a faculdade são a base sólida do seu novo patrimônio.
              </p>
            </div>

            <form onSubmit={handleMigrationSubmit} className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Quanto você vai ganhar por mês agora como profissional? (R$)
                </label>
                <input
                  type="text"
                  value={newProIncomeInput}
                  onChange={e => setNewProIncomeInput(e.target.value)}
                  placeholder="12000"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-lg font-black text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  O app ativará as 6 categorias profissionais (Moradia, Comida, Lazer, Proteção, Profissional e Investimentos) e adaptará as regras automaticamente.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMigrationModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Ainda não
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ativar Modo Profissional Agora!</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
