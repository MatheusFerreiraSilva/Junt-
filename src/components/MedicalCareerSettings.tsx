import { useState } from 'react';
import {
  GraduationCap,
  Check,
  Save,
  Stethoscope,
  Sparkles,
  Calendar,
  Briefcase,
  Award,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { MedicalCareerProfile, MedicalCareerStage } from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface StageMeta {
  key: MedicalCareerStage;
  step: number;
  label: string;
  badge: string;
  emoji: string;
  desc: string;
  typicalDuration: string;
}

const STAGES: StageMeta[] = [
  {
    key: 'graduacao',
    step: 1,
    label: 'Graduação Médica',
    badge: 'Ciclo Básico & Clínico',
    emoji: '📚',
    desc: 'Foco na formação básica, anatomia, semiologia e primeiros contatos ambulatoriais.',
    typicalDuration: 'Anos 1 a 4',
  },
  {
    key: 'internato',
    step: 2,
    label: 'Internato',
    badge: 'Vivência Hospitalar',
    emoji: '🏥',
    desc: 'Estágio curricular obrigatório em prontos-socorros, enfermarias e centros cirúrgicos.',
    typicalDuration: 'Anos 5 e 6',
  },
  {
    key: 'preparacao_residencia',
    step: 3,
    label: 'Preparação Residência',
    badge: 'Ano de Provas',
    emoji: '🎯',
    desc: 'Cursos preparatórios (Medcurso/Medgrupo), simulados e plantões de suporte financeiro.',
    typicalDuration: '1 a 2 anos',
  },
  {
    key: 'residencia',
    step: 4,
    label: 'Residência Médica',
    badge: 'R1 a R4 em Especialização',
    emoji: '🩺',
    desc: 'Bolsa MEC + plantões extras. Aprendizado intensivo na especialidade médica escolhida.',
    typicalDuration: '2 a 5 anos',
  },
  {
    key: 'atuacao',
    step: 5,
    label: 'Atuação Médica Plena',
    badge: 'Staff & Especialista',
    emoji: '✨',
    desc: 'Consultório próprio, procedimentos, corpo clínico de hospitais de ponta e autonomia total.',
    typicalDuration: 'Carreira',
  },
];

function PartnerCareerCard({ partner }: { partner: 'partner1' | 'partner2' }) {
  const { state, updateProfile, triggerCelebration } = useFinance();
  const isP1 = partner === 'partner1';
  const field = isP1 ? 'partner1Career' : 'partner2Career';
  const rawName = isP1 ? state.profile.partner1Name : state.profile.partner2Name;
  const displayName = !rawName || rawName === 'Aguardando Par...' ? (isP1 ? 'Pessoa 1' : 'Pessoa 2') : rawName;
  const specialty = isP1 ? state.profile.partner1Specialty : state.profile.partner2Specialty;

  const [career, setCareer] = useState<MedicalCareerProfile>(
    state.profile[field] || { stage: 'graduacao' }
  );
  const [saved, setSaved] = useState(false);

  const currentStageIndex = STAGES.findIndex(s => s.key === career.stage);
  const activeStage = STAGES[currentStageIndex] || STAGES[0];
  const progressPct = ((currentStageIndex + 1) / STAGES.length) * 100;

  const update = (values: Partial<MedicalCareerProfile>) => {
    setCareer(old => {
      const next = { ...old, ...values };
      if (next.expectedMonthlyIncome === undefined) delete next.expectedMonthlyIncome;
      return next;
    });
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ [field]: career });
    setSaved(true);
    triggerCelebration();
    setTimeout(() => setSaved(false), 3000);
  };

  const prefix = `career-${partner}`;
  const isProfessional = career.stage === 'residencia' || career.stage === 'atuacao';

  return (
    <form
      onSubmit={handleSave}
      className="relative rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 backdrop-blur-sm p-5 sm:p-6 shadow-sm space-y-5 transition-all"
    >
      {/* Partner Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-xs ${
              isP1
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
            }`}
          >
            {displayName.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                {displayName}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {specialty || 'Medicina'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
              <span>Etapa atual:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {activeStage.emoji} {activeStage.label}
              </span>
            </p>
          </div>
        </div>

        <span
          className={`text-[11px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider ${
            isP1
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800'
          }`}
        >
          {activeStage.badge}
        </span>
      </div>

      {/* Progress Bar through the 5 medical stages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>Jornada Médica</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
            Passo {currentStageIndex + 1} de {STAGES.length} • {Math.round(progressPct)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Visual Roadmap Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
          Selecionar Etapa Atual
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STAGES.map((s, idx) => {
            const isSelected = s.key === career.stage;
            const isPassed = idx < currentStageIndex;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => update({ stage: s.key })}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 ring-2 ring-emerald-500/20 shadow-xs'
                    : isPassed
                    ? 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 opacity-75'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <span className="text-xl shrink-0 mt-0.5">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {s.label}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 line-clamp-1">
                    {s.typicalDuration}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inputs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label
            htmlFor={`${prefix}-graduation`}
            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
          >
            Previsão de formatura <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <div className="relative">
            <input
              id={`${prefix}-graduation`}
              type="date"
              value={career.graduationDate || ''}
              onChange={e => update({ graduationDate: e.target.value })}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-residency`}
            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
          >
            Início da residência <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input
            id={`${prefix}-residency`}
            type="date"
            value={career.residencyStartDate || ''}
            onChange={e => update({ residencyStartDate: e.target.value })}
            className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${prefix}-income`}
          className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
        >
          {isProfessional
            ? 'Renda mensal prevista na próxima etapa (R$)'
            : 'Bolsa ou ajuda prevista na próxima etapa (R$)'}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
            R$
          </span>
          <input
            id={`${prefix}-income`}
            type="number"
            min="0"
            max="10000000"
            step="100"
            placeholder="Ex: 4.500,00"
            value={career.expectedMonthlyIncome ?? ''}
            onChange={e =>
              update({
                expectedMonthlyIncome: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="w-full pl-9 pr-3 py-2.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 tabular-nums"
          />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          Valores previstos alimentam o simulador e o Hub do Casal sem inflar a renda antes da hora.
        </p>
      </div>

      <button
        type="submit"
        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
            <span>Etapa salva com sucesso!</span>
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            <span>Salvar etapa de {displayName}</span>
          </>
        )}
      </button>
    </form>
  );
}

export function MedicalCareerSettings() {
  return (
    <section className="bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent rounded-3xl border border-emerald-200/60 dark:border-emerald-900/40 p-6 sm:p-7 space-y-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-2xl shrink-0 shadow-xs">
          🩺
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Planejamento de Vida & Carreira Médica
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white font-display tracking-tight">
            A medicina no tempo de cada um
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Cada um de vocês tem seu próprio ritmo profissional: formatura, internato, provas do R1, plantões e consultório. Organizem seus marcos sem antecipar dinheiro que ainda não caiu na conta, mantendo o casal sincronizado e seguro.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <PartnerCareerCard partner="partner1" />
        <PartnerCareerCard partner="partner2" />
      </div>
    </section>
  );
}
