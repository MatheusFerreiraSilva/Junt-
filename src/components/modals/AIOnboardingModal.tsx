import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Home,
  Utensils,
  Target,
  Shield,
  Percent,
  RefreshCw,
  Users,
  DollarSign,
  Heart,
  Laptop,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { authenticatedApi } from '../../lib/authenticatedApi';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { formatCurrency } from '../../utils/formatters';

interface AIOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AIInterpretationResult {
  source: 'ai' | 'heuristic';
  fallbackReason?: string;
  diagnosisSummary: string;
  recommendedPercentages: {
    moradia: number;
    transporte?: number;
    comida: number;
    lazer: number;
    protecao: number;
    profissional: number;
    investimentos: number;
  };
  recommendedFloors: {
    moradia: number;
    transporte?: number;
    comida: number;
    protecao: number;
    profissional: number;
    investimentos: number;
  };
  recommendedEmergencyMonths: number;
  isInitialHomePhase: boolean;
  customPointers: string[];
}

export const AIOnboardingModal: React.FC<AIOnboardingModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    updateProfile,
    updateCategoryPercentages,
    updateCategoryFloors,
    triggerCelebration,
  } = useFinance();

  const [step, setStep] = useState<number>(1);
  const [partner1Name, setPartner1Name] = useState(
    state.profile.partner1Name && state.profile.partner1Name !== 'Dra. Bia' 
      ? state.profile.partner1Name 
      : ''
  );
  const [partner2Name, setPartner2Name] = useState(
    state.profile.partner2Name && state.profile.partner2Name !== 'Dr. Lucas' && state.profile.partner2Name !== 'Aguardando Par...'
      ? state.profile.partner2Name 
      : ''
  );
  const [partner1Income, setPartner1Income] = useState(
    state.profile.partner1Income
      ? state.profile.partner1Income.toString()
      : ''
  );
  const [partner2Income, setPartner2Income] = useState(
    state.profile.partner2Income
      ? state.profile.partner2Income.toString()
      : ''
  );

  const [lifeStage, setLifeStage] = useState('Planejando a vida a dois');
  const [housingSituation, setHousingSituation] = useState('');
  const [estimatedRent, setEstimatedRent] = useState('');
  const [diningStyle, setDiningStyle] = useState('Equilibrado com pedidos de delivery e jantares');
  const [mainGoal, setMainGoal] = useState('Construir reserva rápida e investir sem abrir mão da qualidade de vida');
  const [isInitialHomePhase, setIsInitialHomePhase] = useState(state.profile.isInitialHomePhase || false);
  const [specialNotes, setSpecialNotes] = useState('');

  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AIInterpretationResult | null>(null);

  const [analysisError, setAnalysisError] = useState('');
  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const numP1 = parseFloat(partner1Income.replace(',', '.')) || 0;
  const numP2 = parseFloat(partner2Income.replace(',', '.')) || 0;
  const totalRenda = numP1 + numP2;

  const handleRunAIAnalysis = async () => {
    setAnalysisError('');
    setIsLoadingAI(true);
    setStep(4);

    try {
      const payload = {
        partner1Name,
        partner2Name,
        partner1Income: numP1,
        partner2Income: numP2,
        lifeStage,
        housingSituation,
        estimatedRent: parseFloat(estimatedRent.replace(',', '.')) || 0,
        diningStyle,
        mainGoal,
        isInitialHomePhase,
        specialNotes,
        shareNotesWithAI: false,
      };

      const data = await authenticatedApi<AIInterpretationResult>('/api/gemini/onboarding-interpret', payload, AbortSignal.timeout(30000));
      const categories = ['moradia', 'transporte', 'comida', 'lazer', 'protecao', 'profissional', 'investimentos'] as const;
      const floorKeys = ['moradia', 'comida', 'protecao', 'profissional', 'investimentos'] as const;
      const values = categories.map(key => data.recommendedPercentages?.[key] ?? NaN);
      const floors = floorKeys.map(key => data.recommendedFloors?.[key] ?? NaN);
      if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) > 0.01 || floors.some(value => !Number.isFinite(value) || value < 0) || !Number.isFinite(data.recommendedEmergencyMonths) || data.recommendedEmergencyMonths < 1 || data.recommendedEmergencyMonths > 60 || typeof data.diagnosisSummary !== 'string' || !Array.isArray(data.customPointers) || data.customPointers.some(pointer => typeof pointer !== 'string') || !['ai', 'heuristic'].includes(data.source)) throw new Error('O planejamento recebido é inconsistente. Tente novamente.');
      setAiResult(data);
      setStep(5);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Não foi possível gerar o planejamento. Tente novamente.');
      setStep(3);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleApplyAISettings = () => {
    if (!aiResult) return;

    updateProfile({
      partner1Name,
      partner2Name,
      partner1Income: numP1,
      partner2Income: numP2,
      investmentsPercentage: aiResult.recommendedPercentages.investimentos,
      emergencyReserveMonthsTarget: aiResult.recommendedEmergencyMonths,
      isInitialHomePhase: aiResult.isInitialHomePhase,
    });

    updateCategoryPercentages({
      moradia: aiResult.recommendedPercentages.moradia,
      transporte: aiResult.recommendedPercentages.transporte ?? 0,
      comida: aiResult.recommendedPercentages.comida,
      lazer: aiResult.recommendedPercentages.lazer,
      protecao: aiResult.recommendedPercentages.protecao,
      profissional: aiResult.recommendedPercentages.profissional,
    });

    updateCategoryFloors({
      moradia: aiResult.recommendedFloors.moradia,
      comida: aiResult.recommendedFloors.comida,
      lazer: 0,
      protecao: aiResult.recommendedFloors.protecao,
      profissional: aiResult.recommendedFloors.profissional,
      investimentos: aiResult.recommendedFloors.investimentos,
    });

    triggerCelebration();
    onClose();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Planejar orçamento" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 text-white flex items-center justify-center text-xl shadow-md shrink-0">
              ✨
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                Vamos organizar seu orçamento
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Divisão automática das telas e porcentagens
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* STEP 1: NOMES E RENDAS */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Passo 1 de 3 · Identificação e Rendas
                </span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Quem é o casal e quais são as rendas líquidas?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A IA usará esses valores para calcular os limites individuais e conjuntos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Partner 1 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👩</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pessoa 1
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Nome de Exibição</label>
                    <input
                      type="text"
                      value={partner1Name}
                      onChange={e => setPartner1Name(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Renda Líquida Mensal (R$)</label>
                    <input
                      type="number"
                      step="100"
                      value={partner1Income}
                      onChange={e => setPartner1Income(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Partner 2 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👨</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pessoa 2
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Nome de Exibição</label>
                    <input
                      type="text"
                      value={partner2Name}
                      onChange={e => setPartner2Name(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Renda Líquida Mensal (R$)</label>
                    <input
                      type="number"
                      step="100"
                      value={partner2Income}
                      onChange={e => setPartner2Income(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Total Income Preview */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                    Renda Líquida Conjunta Calculada
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    Soma de {partner1Name} + {partner2Name}
                  </span>
                </div>
                <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-display tabular-nums">
                  {formatCurrency(totalRenda)}
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary-accent flex items-center gap-2 px-6 py-2.5 rounded-2xl text-white font-extrabold text-xs shadow-md"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {analysisError && <p role="alert" className="mx-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-sm">{analysisError}</p>}
          {/* STEP 2: MOMENTO DE VIDA & MORADIA */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Passo 2 de 3 · Momento de Vida & Moradia
                </span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Como é a situação da casa de vocês hoje?
                </h4>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Fase Atual do Casal
                  </label>
                  <select
                    value={lifeStage}
                    onChange={e => setLifeStage(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                  >
                    <option value="Recém-casados montando casa / apartamento">🏠 Recém-casados montando casa / apartamento</option>
                    <option value="Médicos em residência / plantões">🏥 Médicos em residência / plantões</option>
                    <option value="Casal consolidado buscando liberdade financeira">🔓 Casal consolidado buscando liberdade financeira</option>
                    <option value="Planejando casamento ou transição de carreira">💍 Planejando casamento ou transição de carreira</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Situação de Moradia
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Aluguel + Condomínio Jardins"
                      value={housingSituation}
                      onChange={e => setHousingSituation(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Estimativa de Custos de Moradia (R$)
                    </label>
                    <input
                      type="number"
                      value={estimatedRent}
                      onChange={e => setEstimatedRent(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Fase Inicial / Casa Nova Toggle */}
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                      <span>🏠</span>
                      <span>Vocês estão na Fase Inicial / Mobiliando Casa?</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300 mt-0.5">
                      Se ativado, a IA ajusta o teto de parcelas para 20% da renda temporariamente.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isInitialHomePhase}
                      onChange={e => setIsInitialHomePhase(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary-accent flex items-center gap-2 px-6 py-2.5 rounded-2xl text-white font-extrabold text-xs shadow-md"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ESTILO DE VIDA E PRIORIDADES */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Passo 3 de 3 · Estilo de Vida & Prioridades
                </span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Quais são as principais prioridades financeiras?
                </h4>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Alimentação & Rotina
                  </label>
                  <select
                    value={diningStyle}
                    onChange={e => setDiningStyle(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                  >
                    <option value="Equilibrado com pedidos de delivery e jantares fora">🍽️ Equilibrado com pedidos de delivery e jantares fora</option>
                    <option value="Muitos pedidos de iFood e refeições rápidas nos plantões">🛵 Muitos pedidos de iFood e refeições rápidas nos plantões</option>
                    <option value="Cozinhamos quase tudo em casa e fazemos feira">🥗 Cozinhamos quase tudo em casa e fazemos feira</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Objetivo Principal do Momento
                  </label>
                  <select
                    value={mainGoal}
                    onChange={e => setMainGoal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                  >
                    <option value="Construir reserva rápida e investir sem abrir mão da qualidade de vida">🛡️ Construir reserva de emergência rápida (Proteção)</option>
                    <option value="Comprar móveis e eletrodomésticos sem fazer dívidas pesadas">🛋️ Comprar móveis e eletrodomésticos sem dívidas pesadas</option>
                    <option value="Acelerar investimentos para liberdade e patrimônio">🔓 Acelerar investimentos para liberdade e patrimônio</option>
                    <option value="Equilibrar lazer, viagens e descanso da rotina intensa">✈️ Equilibrar lazer, viagens e descanso</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Algum detalhe especial ou meta específica? (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Queremos trocar de carro em 1 ano e fazer um congresso em setembro..."
                    value={specialNotes}
                    onChange={e => setSpecialNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleRunAIAnalysis}
                  className="btn-primary-accent flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-extrabold text-xs shadow-lg active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Gerar planejamento</span>
                </button>
              </div>
            </div>
          )}

          <p className="px-6 py-2 text-[11px] text-slate-500 leading-relaxed">Seu resumo pode ser processado pelo Gemini, serviço externo de IA. Notas livres não são enviadas ao provedor. Não inclua dados clínicos ou de pacientes.</p>
          {/* STEP 4: IA CARREGANDO */}
          {step === 4 && (
            <div className="py-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                  ✨
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  A IA está interpretando o estilo financeiro do casal...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Calculando pisos inegociáveis, porcentagens ideais e calibrando a proteção do casal.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: RESULTADO E DIAGNÓSTICO DA IA */}
          {step === 5 && aiResult && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-300 dark:border-emerald-800/80 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>{aiResult.source === 'ai' ? 'Planejamento com apoio de IA' : 'Planejamento por regras locais'}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {aiResult.diagnosisSummary}
                  {aiResult.source === 'heuristic' && <span className="block mt-2 text-xs font-semibold">Esta proposta usa regras determinísticas. Não houve análise bem-sucedida de IA.</span>}
                </p>
              </div>

              {/* Proposed Percentages & Floors Breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Divisão Recomendada das Porcentagens e Pisos:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Moradia */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      🏠 Moradia
                    </span>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {aiResult.recommendedPercentages.moradia}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Piso: {formatCurrency(aiResult.recommendedFloors.moradia)}
                    </span>
                  </div>

                  {/* Comida */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      🍽️ Comida
                    </span>
                    <div className="text-base font-black text-sky-600 dark:text-sky-400">
                      {aiResult.recommendedPercentages.comida}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Piso: {formatCurrency(aiResult.recommendedFloors.comida)}
                    </span>
                  </div>

                  {/* Lazer */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      🎮 Lazer
                    </span>
                    <div className="text-base font-black text-purple-600 dark:text-purple-400">
                      {aiResult.recommendedPercentages.lazer}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Sem piso (flexível)
                    </span>
                  </div>

                  {/* Proteção */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      🛡️ Proteção
                    </span>
                    <div className="text-base font-black text-rose-600 dark:text-rose-400">
                      {aiResult.recommendedPercentages.protecao}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Piso: {formatCurrency(aiResult.recommendedFloors.protecao)}
                    </span>
                  </div>

                  {/* Profissional */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      📚 Profissional
                    </span>
                    <div className="text-base font-black text-amber-600 dark:text-amber-400">
                      {aiResult.recommendedPercentages.profissional}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Piso: {formatCurrency(aiResult.recommendedFloors.profissional)}
                    </span>
                  </div>

                  {/* Investimentos */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      🔓 Investimentos
                    </span>
                    <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                      {aiResult.recommendedPercentages.investimentos}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Piso: {aiResult.recommendedFloors.investimentos}% da renda
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Pointers */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Pontos para revisar:
                </span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {aiResult.customPointers.map((ptr, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{ptr}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  Ajustar Respostas
                </button>
                <button
                  type="button"
                  onClick={handleApplyAISettings}
                  className="btn-primary-accent flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-extrabold text-xs shadow-lg active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Aplicar este planejamento</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
