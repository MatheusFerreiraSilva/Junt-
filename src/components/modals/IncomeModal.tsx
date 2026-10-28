import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Stethoscope,
  Building,
  Clock,
  Calendar,
  DollarSign,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { PaidBy, ShiftSector, MedicalShift } from '../../types/finance';
import { formatCurrency } from '../../utils/formatters';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

type IncomeTypeKey = 'salario' | 'plantao' | 'bonus' | 'extra' | 'restituicao' | 'outro';

export const IncomeModal: React.FC<IncomeModalProps> = ({ isOpen, onClose, defaultDate }) => {
  const {
    state,
    addIncome,
    addMedicalShift,
    reconcileShiftWithIncome,
    triggerCelebration,
  } = useFinance();

  const [step, setStep] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<PaidBy>('partner1');
  const [incomeType, setIncomeType] = useState<IncomeTypeKey>('salario');
  const [description, setDescription] = useState<string>('');
  const [successCelebration, setSuccessCelebration] = useState(false);

  // Medical Shift Integration State
  const [shiftReceiptMode, setShiftReceiptMode] = useState<'pending_shift' | 'new_shift'>('pending_shift');
  const [selectedPendingShiftId, setSelectedPendingShiftId] = useState<string>('');
  const [hospitalName, setHospitalName] = useState<string>('');
  const [shiftHours, setShiftHours] = useState<number>(12);
  const [shiftSector, setShiftSector] = useState<ShiftSector>('porta');
  const [shiftDateWorked, setShiftDateWorked] = useState<string>(() =>
    defaultDate || new Date().toISOString().split('T')[0]
  );

  const dialogRef = useDialogFocus(isOpen, onClose);

  const pendingShifts = useMemo(() => {
    return (state.medicalShifts || []).filter(
      s => s.status === 'pending' || s.status === 'overdue'
    );
  }, [state.medicalShifts]);

  if (!isOpen) return null;

  const quickIncomeTypes: { key: IncomeTypeKey; label: string; emoji: string; desc: string }[] = [
    { key: 'salario', label: 'Salário Mensal', emoji: '💼', desc: 'Renda CLT ou pró-labore fixo' },
    { key: 'plantao', label: 'Plantão Médico', emoji: '🩺', desc: 'Plantão hospitalar ou cobertura' },
    { key: 'bonus', label: 'Bônus / PLR', emoji: '🎁', desc: 'Premiação ou participação nos lucros' },
    { key: 'extra', label: 'Trabalho Extra / Freela', emoji: '⚡', desc: 'Consultoria, parecer ou evento' },
    { key: 'restituicao', label: 'Restituição / Reembolso', emoji: '🏛️', desc: 'Imposto de renda ou convênio' },
    { key: 'outro', label: 'Outro Ganho', emoji: '✨', desc: 'Entrada avulsa ou rendimentos' },
  ];

  const handleSelectPendingShift = (shift: MedicalShift) => {
    setSelectedPendingShiftId(shift.id);
    const val = shift.netAmount || shift.grossAmount;
    setAmount(val.toString());
    setHospitalName(shift.hospitalName);
    setShiftHours(shift.durationHours);
    setShiftDateWorked(shift.dateWorked);
    setDescription(`Plantão ${shift.hospitalName} (${shift.durationHours}h)`);
    if (shift.partner) {
      setRecipient(shift.partner);
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
      handleSave();
    }
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    const partnerName =
      recipient === 'partner1'
        ? state.profile.partner1Name
        : recipient === 'partner2'
        ? state.profile.partner2Name
        : 'Casal';

    const today = defaultDate || new Date().toISOString().split('T')[0];
    const incomeId = `income-${Date.now()}`;

    if (incomeType === 'plantao') {
      const finalHosp = hospitalName.trim() || 'Hospital Geral';
      const finalDesc = description.trim() || `Plantão ${finalHosp} (${shiftHours}h) - ${partnerName}`;

      // 1. Add income record
      addIncome({
        description: finalDesc,
        amount: numAmount,
        date: today,
        recipient,
        type: 'extra',
      });

      // 2. Integrate with shifts
      if (shiftReceiptMode === 'pending_shift' && selectedPendingShiftId) {
        // Reconcile existing pending shift
        reconcileShiftWithIncome(selectedPendingShiftId, incomeId, false, numAmount);
      } else {
        // Register new shift as already received
        addMedicalShift({
          partner: recipient === 'partner2' ? 'partner2' : 'partner1',
          title: `Plantão ${finalHosp}`,
          hospitalName: finalHosp,
          sector: shiftSector,
          contractType: 'pj_privado',
          dateWorked: shiftDateWorked || today,
          durationHours: shiftHours,
          grossAmount: numAmount,
          netAmount: numAmount,
          estimatedPayDate: today,
          actualPayDate: today,
          status: 'received',
          linkedIncomeId: incomeId,
          linkedIncomeDescription: finalDesc,
        });
      }
    } else {
      const typeObj = quickIncomeTypes.find(t => t.key === incomeType);
      const finalDesc = description.trim() || `${typeObj?.label || 'Entrada'} (${partnerName})`;

      addIncome({
        description: finalDesc,
        amount: numAmount,
        date: today,
        recipient,
        type: incomeType === 'salario' ? 'salario' : incomeType === 'bonus' ? 'bonus' : 'extra',
      });
    }

    setSuccessCelebration(true);
    triggerCelebration();

    setTimeout(() => {
      setSuccessCelebration(false);
      handleReset();
      onClose();
    }, 1300);
  };

  const handleReset = () => {
    setStep(1);
    setAmount('');
    setDescription('');
    setHospitalName('');
    setSelectedPendingShiftId('');
    setIncomeType('salario');
    setShiftReceiptMode('pending_shift');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const p1Name = state.profile.partner1Name || 'Pessoa 1';
  const p2Name = state.profile.partner2Name || 'Pessoa 2';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Registrar receita ou plantão"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
              💰
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base font-display truncate">
                {incomeType === 'plantao' ? 'Registrar Recebimento de Plantão' : 'Registrar Entrada'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Passo {step} de 3</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-center">
          {successCelebration ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">
                {incomeType === 'plantao' ? 'Plantão Recebido & Conciliado!' : 'Entrada Registrada!'}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-xs">
                {formatCurrency(parseFloat(amount.replace(',', '.')) || 0)} somados ao orçamento do casal!
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                {incomeType === 'plantao'
                  ? 'Aba de plantões atualizada automaticamente'
                  : 'Mais tranquilidade para o mês do casal'}
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Quanto entrou? */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Passo 1
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      Quanto entrou na conta?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Digite o valor líquido que caiu no extrato
                    </p>
                  </div>

                  <div className="relative max-w-xs mx-auto">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 dark:text-slate-500">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="0,00"
                      className="w-full pl-14 pr-4 py-4 text-3xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-all tabular-nums"
                    />
                  </div>

                  {/* Suggestions for salaries */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {state.profile.partner1Income > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(state.profile.partner1Income.toString());
                          setRecipient('partner1');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Salário {p1Name} ({formatCurrency(state.profile.partner1Income)})
                      </button>
                    )}
                    {state.profile.partner2Income > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(state.profile.partner2Income.toString());
                          setRecipient('partner2');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Salário {p2Name} ({formatCurrency(state.profile.partner2Income)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: De quem foi? */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Passo 2
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      De quem é esse dinheiro?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Quem recebeu essa entrada no extrato?
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => setRecipient('partner1')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        recipient === 'partner1'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-lg mb-2">
                        {p1Name[0]}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-full">
                        {p1Name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecipient('partner2')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        recipient === 'partner2'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-lg mb-2">
                        {p2Name[0]}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-full">
                        {p2Name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecipient('both')}
                      className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        recipient === 'both'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 flex items-center justify-center font-bold text-lg mb-2">
                        💑
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        Ambos / Conjunto
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Qual o motivo & Integração de Plantões */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Passo 3
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                      Qual a origem do recebimento?
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Identifique a fonte para categorizar e conciliar
                    </p>
                  </div>

                  {/* Income Types Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto w-full">
                    {quickIncomeTypes.map(item => {
                      const isSelected = incomeType === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setIncomeType(item.key)}
                          className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/60 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="text-2xl mb-1">{item.emoji}</span>
                          <span className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* PLANTÃO MÉDICO INTEGRATION SUB-PANEL */}
                  {incomeType === 'plantao' && (
                    <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 space-y-3.5 max-w-md mx-auto w-full animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 dark:text-teal-200">
                          <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span>Sincronização com a Aba de Plantões</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-200/60 dark:bg-teal-900 text-teal-900 dark:text-teal-200">
                          Integração Total
                        </span>
                      </div>

                      {/* Mode Segmented Control: Pendente vs Novo */}
                      <div className="grid grid-cols-2 p-1 bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-800 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setShiftReceiptMode('pending_shift')}
                          className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                            shiftReceiptMode === 'pending_shift'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Baixar Plantão Pendente ({pendingShifts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftReceiptMode('new_shift')}
                          className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                            shiftReceiptMode === 'new_shift'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Novo Plantão e Quitar
                        </button>
                      </div>

                      {shiftReceiptMode === 'pending_shift' ? (
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                            Selecione o plantão para dar baixa:
                          </label>
                          {pendingShifts.length > 0 ? (
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                              {pendingShifts.map(shift => {
                                const isSelected = selectedPendingShiftId === shift.id;
                                return (
                                  <button
                                    key={shift.id}
                                    type="button"
                                    onClick={() => handleSelectPendingShift(shift)}
                                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-teal-500 bg-white dark:bg-slate-800 shadow-xs ring-1 ring-teal-500'
                                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 hover:bg-white'
                                    }`}
                                  >
                                    <div>
                                      <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span>{shift.hospitalName}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                          {shift.durationHours}h
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-500">
                                        Trabalhado em {shift.dateWorked}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-teal-700 dark:text-teal-300 block tabular-nums">
                                        {formatCurrency(shift.netAmount || shift.grossAmount)}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[10px] font-black text-teal-600 flex items-center justify-end gap-0.5">
                                          <Check className="w-3 h-3 stroke-[3]" /> Selecionado
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/80 text-center">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Nenhum plantão pendente no momento.
                              </p>
                              <button
                                type="button"
                                onClick={() => setShiftReceiptMode('new_shift')}
                                className="text-xs text-teal-600 font-bold hover:underline mt-1 cursor-pointer"
                              >
                                Cadastrar novo plantão agora
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              Nome do Hospital / Serviço
                            </label>
                            <input
                              type="text"
                              value={hospitalName}
                              onChange={e => setHospitalName(e.target.value)}
                              placeholder="Ex: Hospital Samaritano, UPA Central..."
                              className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-700 text-slate-800 dark:text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                Carga Horária
                              </label>
                              <div className="grid grid-cols-3 gap-1">
                                {[6, 12, 24].map(h => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => setShiftHours(h)}
                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      shiftHours === h
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {h}h
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                Data do Plantão
                              </label>
                              <input
                                type="date"
                                value={shiftDateWorked}
                                onChange={e => setShiftDateWorked(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-700 text-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Description input */}
                  {incomeType !== 'plantao' && (
                    <div className="max-w-md mx-auto w-full pt-1">
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Descrição / Detalhe
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Ex: Salário mensal, Restituição IRPF..."
                        className="w-full px-4 py-2.5 text-xs font-medium text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!successCelebration && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && (!amount || parseFloat(amount.replace(',', '.')) <= 0)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            >
              {step === 3 ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Concluir Entrada</span>
                </>
              ) : (
                <>
                  <span>Avançar</span>
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
