import { useState } from 'react';
import { GraduationCap, Check, Save } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { MedicalCareerProfile, MedicalCareerStage } from '../types/finance';

const stages: { key: MedicalCareerStage; label: string }[] = [
  { key: 'graduacao', label: 'Graduação' }, { key: 'internato', label: 'Internato' },
  { key: 'preparacao_residencia', label: 'Preparação para residência' },
  { key: 'residencia', label: 'Residência' }, { key: 'atuacao', label: 'Atuação médica' },
];

function CareerCard({ partner }: { partner: 'partner1' | 'partner2' }) {
  const { state, updateProfile } = useFinance();
  const field = partner === 'partner1' ? 'partner1Career' : 'partner2Career';
  const [career, setCareer] = useState<MedicalCareerProfile>(state.profile[field] || { stage: 'graduacao' });
  const [saved, setSaved] = useState(false);
  const name = partner === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name;
  const update = (values: Partial<MedicalCareerProfile>) => { setCareer(old => { const next = { ...old, ...values }; if (next.expectedMonthlyIncome === undefined) delete next.expectedMonthlyIncome; return next; }); setSaved(false); };
  const professional = career.stage === 'residencia' || career.stage === 'atuacao';
  const prefix = 'career-' + partner;
  return <form onSubmit={event => { event.preventDefault(); updateProfile({ [field]: career }); setSaved(true); }} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
    <h3 className="text-sm font-bold">{!name || name === 'Aguardando Par...' ? 'Pessoa 2' : name}</h3>
    <div><label htmlFor={prefix + '-stage'} className="block text-xs font-semibold mb-2">Etapa atual</label><select id={prefix + '-stage'} value={career.stage} onChange={event => update({ stage: event.target.value as MedicalCareerStage })} className="w-full min-h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent">{stages.map(stage => <option value={stage.key} key={stage.key}>{stage.label}</option>)}</select></div>
    <div><label htmlFor={prefix + '-graduation'} className="block text-xs font-semibold mb-2">Previsão de formatura <span className="font-normal text-slate-500">(opcional)</span></label><input id={prefix + '-graduation'} type="date" value={career.graduationDate || ''} onChange={event => update({ graduationDate: event.target.value })} className="w-full min-h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent" /></div>
    <div><label htmlFor={prefix + '-residency'} className="block text-xs font-semibold mb-2">Início previsto da residência <span className="font-normal text-slate-500">(opcional)</span></label><input id={prefix + '-residency'} type="date" value={career.residencyStartDate || ''} onChange={event => update({ residencyStartDate: event.target.value })} className="w-full min-h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent" /></div>
    <div><label htmlFor={prefix + '-income'} className="block text-xs font-semibold mb-2">{professional ? 'Renda mensal prevista na próxima etapa' : 'Bolsa ou ajuda prevista na próxima etapa'} <span className="font-normal text-slate-500">(R$)</span></label><input id={prefix + '-income'} type="number" min="0" max="10000000" step="0.01" placeholder="Ainda não sei" value={career.expectedMonthlyIncome ?? ''} onChange={event => update({ expectedMonthlyIncome: event.target.value === '' ? undefined : Number(event.target.value) })} className="w-full min-h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent" /></div>
    <p className="text-[11px] text-slate-500 leading-relaxed">Valores previstos servem ao planejamento. Eles não são adicionados à renda recebida ou ao saldo disponível. Mudar de etapa preserva seu histórico.</p>
    <button type="submit" className="btn-outline w-full">{saved ? <Check size={15} /> : <Save size={15} />}{saved ? 'Etapa salva' : 'Salvar etapa'}</button>
    {saved && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">Perfil atualizado neste dispositivo.</p>}
  </form>;
}

export function MedicalCareerSettings() {
  return <section className="surface-card p-6 sm:p-7 space-y-5"><div className="flex gap-3 items-start"><GraduationCap size={26} className="text-emerald-700 shrink-0" /><div><h2 className="text-lg font-bold">A medicina no tempo de cada um</h2><p className="text-sm text-slate-500 mt-2 leading-relaxed">Vocês podem estar em etapas diferentes. Registrem os próximos marcos para organizar os planos sem antecipar dinheiro que ainda não chegou.</p></div></div><div className="grid sm:grid-cols-2 gap-4"><CareerCard partner="partner1" /><CareerCard partner="partner2" /></div></section>;
}
