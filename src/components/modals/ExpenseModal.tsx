import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Sparkles, Users, User, Percent } from 'lucide-react';
import { useFinance, CATEGORIES_BASE } from '../../context/FinanceContext';
import { CategoryKey, PaidBy, FoodPillarType } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CategoryKey;
  defaultDate?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  defaultCategory,
  defaultDate,
}) => {
  const { state, addExpense, addInstallment, triggerCelebration } = useFinance();
  const [step, setStep] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<CategoryKey>(defaultCategory || 'comida');
  const [description, setDescription] = useState<string>('');
  const [foodPillar, setFoodPillar] = useState<FoodPillarType>('estrutural');
  const [paidBy, setPaidBy] = useState<PaidBy>('both');
  const [splitPartner1Pct, setSplitPartner1Pct] = useState<number>(50);
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [successCelebration, setSuccessCelebration] = useState(false);

  if (!isOpen) return null;

  const totalIncome = state.profile.partner1Income + state.profile.partner2Income;
  const partner1IncomePct = totalIncome > 0 ? Math.round((state.profile.partner1Income / totalIncome) * 100) : 50;

  const quickAmounts = [15, 30, 50, 100, 200, 500];

  const quickDescriptions: Record<CategoryKey, string[]> = {
    moradia: ['Conta de Luz', 'Internet', 'Condomínio', 'Gás', 'Mercado Casa', 'Reparo'],
    transporte: ['Combustível / Posto', 'Uber / 99', 'IPVA & Licenciamento', 'Seguro Auto', 'Sem Parar / Pedágio', 'Oficina / Revisão', 'Estacionamento'],
    comida: [
      'Grande Mercado (Abastecimento)',
      'Hortifruti & Feira',
      'Açougue & Carnes',
      'Almoço Dia a Dia / Quilo',
      'Refeição de Plantão',
      'Delivery / iFood',
      'Cafeteria & Padaria',
    ],
    lazer: ['Cinema & Pipoca', 'Passeio', 'Streaming', 'Jogos', 'Roupas', 'Viagem'],
    protecao: ['Farmácia', 'Consulta Médica', 'Plano de Saúde', 'Seguro de Vida', 'Dentista'],
    profissional: ['Livro Técnico', 'Curso / Workshop', 'Software / Ferramenta', 'Equipamento'],
  };

  const handleQuickAddAmount = (add: number) => {
    const current = parseFloat(amount.replace(',', '.')) || 0;
    setAmount((current + add).toString());
  };

  const handleSelectQuickTag = (tag: string) => {
    setDescription(tag);
    if (category === 'comida') {
      const u = tag.toUpperCase();
      if (u.includes('MERCADO') || u.includes('FEIRA') || u.includes('AÇOUGUE') || u.includes('ABASTECIMENTO')) {
        setFoodPillar('estrutural');
      } else if (u.includes('DELIVERY') || u.includes('IFOOD')) {
        setFoodPillar('conveniencia');
      } else {
        setFoodPillar('rotina');
      }
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const val = parseFloat(amount.replace(',', '.'));
      if (!val || val <= 0) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!description.trim()) {
        setDescription(CATEGORIES_BASE[category].name);
      }
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      if (isInstallment) {
        setStep(6);
      } else {
        handleSave();
      }
    } else if (step === 6) {
      handleSave();
    }
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    const finalDesc = description.trim() || CATEGORIES_BASE[category].name;
    const today = defaultDate || new Date().toISOString().split('T')[0];

    const p1Pct =
      paidBy === 'partner1'
        ? 100
        : paidBy === 'partner2'
        ? 0
        : paidBy === 'both'
        ? 50
        : splitPartner1Pct;
    const p2Pct = 100 - p1Pct;

    if (isInstallment) {
      const installmentVal = +(numAmount / installmentsCount).toFixed(2);
      addInstallment({
        title: finalDesc,
        category,
        totalAmount: numAmount,
        installmentsCount,
        installmentAmount: installmentVal,
        startMonth: state.currentMonth,
        paidBy,
        splitPartner1Pct: p1Pct,
        splitPartner2Pct: p2Pct,
      });
    } else {
      addExpense({
        description: finalDesc,
        amount: numAmount,
        category,
        date: today,
        paidBy,
        splitPartner1Pct: p1Pct,
        splitPartner2Pct: p2Pct,
        foodPillar: category === 'comida' ? foodPillar : undefined,
      });
    }

    setSuccessCelebration(true);
    triggerCelebration();

    setTimeout(() => {
      setSuccessCelebration(false);
      setStep(1);
      setAmount('');
      setDescription('');
      setIsInstallment(false);
      setInstallmentsCount(3);
      onClose();
    }, 1200);
  };

  const handleClose = () => {
    setStep(1);
    setAmount('');
    setDescription('');
    setIsInstallment(false);
    onClose();
  };

  const currentParsedAmount = parseFloat(amount.replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl btn-primary-accent text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
              ➕
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                Registrar Gasto
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Passo {step} de {isInstallment && step >= 5 ? '6' : '5'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-center">
          {successCelebration ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-surface text-accent-primary flex items-center justify-center mb-4 scale-110 transition-transform">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">Gasto Anotado!</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-xs">
                {isInstallment
                  ? `Parcelamento de ${installmentsCount}x de ${formatCurrency(currentParsedAmount / installmentsCount)} adicionado ao orçamento!`
                  : `${formatCurrency(currentParsedAmount)} registrado em ${CATEGORIES_BASE[category].name}.`}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold bg-accent-surface text-accent-themed px-3.5 py-1.5 rounded-full border border-accent-themed">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                Registrado em menos de 10 segundos
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Quanto vocês gastaram? */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 1</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Quanto vocês gastaram?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Digite o valor do gasto ou toque nos atalhos</p>
                  </div>

                  <div className="relative max-w-xs mx-auto">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-4 py-3.5 text-3xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:border-accent-primary focus:outline-none tabular-nums"
                    />
                  </div>

                  {/* Quick incremental buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {quickAmounts.map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddAmount(val)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        +{formatCurrency(val)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: Em qual das 5 áreas da vida? */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 2</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Em qual área da vida?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor: <strong className="text-slate-900 dark:text-white">{formatCurrency(currentParsedAmount)}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(CATEGORIES_BASE) as CategoryKey[]).map(key => {
                      const item = CATEGORIES_BASE[key];
                      const isSelected = category === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCategory(key)}
                          className={`p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                            isSelected
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <span className="text-2xl p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0">
                            {item.emoji}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: Qual foi o gasto? */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 3</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Com o que vocês gastaram?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {CATEGORIES_BASE[category].emoji} Área: {CATEGORIES_BASE[category].name}
                    </p>
                  </div>

                  <div className="space-y-4 max-w-sm mx-auto w-full">
                    <input
                      type="text"
                      autoFocus
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={`Ex: Supermercado, Almoço, Curso...`}
                      className="w-full px-4 py-3 text-base text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-accent-primary focus:outline-none"
                    />

                    {/* Seletor dos 3 Pilares de Comida & Conveniência */}
                    {category === 'comida' && (
                      <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-sky-950 dark:text-sky-300 block text-center">
                          Pilar da Alimentação do Casal:
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setFoodPillar('estrutural')}
                            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              foodPillar === 'estrutural'
                                ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-base">🛒</span>
                            <span className="text-[10px] block mt-0.5 leading-tight font-black">Abastecimento</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFoodPillar('rotina')}
                            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              foodPillar === 'rotina'
                                ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-base">🍲</span>
                            <span className="text-[10px] block mt-0.5 leading-tight font-black">Rotina & Plantão</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFoodPillar('conveniencia')}
                            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              foodPillar === 'conveniencia'
                                ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-base">🛵</span>
                            <span className="text-[10px] block mt-0.5 leading-tight font-black">Delivery & Lanche</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2 text-center">
                        Sugestões rápidas
                      </span>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {quickDescriptions[category].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleSelectQuickTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                              description === tag
                                ? 'btn-primary-accent text-white'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Quem pagou e como foi a divisão? */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 4</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Quem pagou o gasto?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor total: <strong className="text-slate-900 dark:text-white">{formatCurrency(currentParsedAmount)}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto w-full">
                    {/* Option 1: Em Conjunto (50/50) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPaidBy('both');
                        setSplitPartner1Pct(50);
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'both'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🤝</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Casal (50/50)</span>
                      </div>
                      <p className="text-[11px] text-purple-800 dark:text-purple-300 font-semibold">
                        {formatCurrency(currentParsedAmount / 2)} para cada
                      </p>
                    </button>

                    {/* Option 2: Divisão por Porcentagem */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('custom')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'custom'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">⚖️</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Porcentagem (%)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                        {splitPartner1Pct}% / {100 - splitPartner1Pct}%
                      </p>
                    </button>

                    {/* Option 3: Só Dra. Bia */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('partner1')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'partner1'
                          ? 'border-accent-primary bg-accent-surface shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full btn-primary-accent text-white flex items-center justify-center font-bold text-xs">
                          {state.profile.partner1Name[0]}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          Só {state.profile.partner1Name}
                        </span>
                      </div>
                      <p className="text-[11px] text-accent-themed font-semibold">100% individual</p>
                    </button>

                    {/* Option 4: Só Dr. Lucas */}
                    <button
                      type="button"
                      onClick={() => setPaidBy('partner2')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paidBy === 'partner2'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          {state.profile.partner2Name[0]}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          Só {state.profile.partner2Name}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">100% individual</p>
                    </button>
                  </div>

                  {/* Custom percentage slider if custom is selected */}
                  {paidBy === 'custom' && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 max-w-md mx-auto w-full">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
                        <span>{state.profile.partner1Name}: {splitPartner1Pct}% ({formatCurrency((currentParsedAmount * splitPartner1Pct) / 100)})</span>
                        <span>{state.profile.partner2Name}: {100 - splitPartner1Pct}% ({formatCurrency((currentParsedAmount * (100 - splitPartner1Pct)) / 100)})</span>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="99"
                        value={splitPartner1Pct}
                        onChange={e => setSplitPartner1Pct(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-600"
                      />

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(50)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 50 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          50/50
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(partner1IncomePct)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === partner1IncomePct ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          Rendas ({partner1IncomePct}% / {100 - partner1IncomePct}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(60)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 60 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          60 / 40
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitPartner1Pct(70)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            splitPartner1Pct === 70 ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          70 / 30
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Foi parcelado? */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 5</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Essa compra foi parcelada?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Se foi parcelada, o app já calcula as fatias dos próximos meses
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => setIsInstallment(false)}
                      className={`p-5 rounded-2xl border-2 text-center transition-all ${
                        !isInstallment
                          ? 'border-accent-primary bg-accent-surface shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-3xl block mb-2">💵</span>
                      <div className="font-bold text-slate-900 dark:text-white">Não, à vista</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cobrado apenas neste mês</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInstallment(true)}
                      className={`p-5 rounded-2xl border-2 text-center transition-all ${
                        isInstallment
                          ? 'border-accent-primary bg-accent-surface shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-3xl block mb-2">📦</span>
                      <div className="font-bold text-slate-900 dark:text-white">Sim, parcelado</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dividido no cartão</div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6 (Optional): Quantas vezes? */}
              {step === 6 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent-primary uppercase tracking-wider">Passo 6</span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">Em quantas vezes?</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Valor total: {formatCurrency(currentParsedAmount)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-w-md mx-auto w-full">
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(count => {
                      const perMonth = currentParsedAmount / count;
                      const isSelected = installmentsCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setInstallmentsCount(count)}
                          className={`p-3 rounded-2xl border-2 text-center transition-all ${
                            isSelected
                              ? 'border-accent-primary bg-accent-surface shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="text-base font-extrabold text-slate-900 dark:text-white">{count}x</div>
                          <div className="text-xs text-accent-themed font-semibold tabular-nums mt-0.5">
                            {formatCurrency(perMonth)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center text-xs text-slate-600 dark:text-slate-300">
                    O app vai comprometer{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {formatCurrency(currentParsedAmount / installmentsCount)}
                    </strong>{' '}
                    por mês na categoria <strong>{CATEGORIES_BASE[category].name}</strong>.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!successCelebration && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && (!amount || parseFloat(amount.replace(',', '.')) <= 0)}
              className="btn-primary-accent flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-black/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {step === (isInstallment ? 6 : 5) ? (
                <>
                  <Check className="w-4 h-4" />
                  Concluir Gasto
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
