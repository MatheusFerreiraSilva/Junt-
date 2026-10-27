import React, { useState } from 'react';
import {
  X,
  Stethoscope,
  Building2,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  MedicalShift,
  MedicalShiftPreset,
  ShiftContractType,
  ShiftSector,
} from '../../types/finance';
import {
  SECTOR_CONFIG,
  CONTRACT_CONFIG,
  calculateEstimatedPayDate,
} from '../../utils/shiftsEngine';

interface MedicalShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftToEdit?: MedicalShift | null;
}

export const MedicalShiftModal: React.FC<MedicalShiftModalProps> = ({
  isOpen,
  onClose,
  shiftToEdit,
}) => {
  const {
    state,
    medicalShiftPresets,
    addMedicalShift,
    updateMedicalShift,
    addShiftPreset,
    deleteShiftPreset,
  } = useFinance();

  const p1Name = state?.profile?.partner1Name || 'Parceiro 1';
  const p2Name =
    !state?.profile?.partner2Name || state.profile.partner2Name === 'Aguardando Par...'
      ? 'Parceiro 2'
      : state.profile.partner2Name;

  const [partner, setPartner] = useState<'partner1' | 'partner2'>(
    shiftToEdit ? shiftToEdit.partner : 'partner1'
  );
  const [title, setTitle] = useState<string>(shiftToEdit?.title || '');
  const [dateWorked, setDateWorked] = useState<string>(
    shiftToEdit ? shiftToEdit.dateWorked : new Date().toISOString().split('T')[0]
  );
  const [durationHours, setDurationHours] = useState<number>(
    shiftToEdit ? shiftToEdit.durationHours : 12
  );
  const [sector, setSector] = useState<ShiftSector>(
    shiftToEdit ? shiftToEdit.sector : 'porta'
  );
  const [hospitalName, setHospitalName] = useState<string>(
    shiftToEdit ? shiftToEdit.hospitalName : ''
  );
  const [contractType, setContractType] = useState<ShiftContractType>(
    shiftToEdit ? shiftToEdit.contractType : 'pj_oss'
  );
  const [grossAmount, setGrossAmount] = useState<string>(
    shiftToEdit ? shiftToEdit.grossAmount.toString() : '1600'
  );
  const [estimatedDelayDays, setEstimatedDelayDays] = useState<number>(
    CONTRACT_CONFIG.pj_oss.typicalDays
  );
  const [customPayDate, setCustomPayDate] = useState<string>(
    shiftToEdit ? shiftToEdit.estimatedPayDate : ''
  );
  const [notes, setNotes] = useState<string>(shiftToEdit?.notes || '');
  const [saveAsPreset, setSaveAsPreset] = useState<boolean>(false);
  const [presetTitle, setPresetTitle] = useState<string>('');
  const [showPresetManager, setShowPresetManager] = useState<boolean>(false);

  if (!isOpen) return null;

  const applyPreset = (preset: MedicalShiftPreset) => {
    setHospitalName(preset.hospitalName);
    setSector(preset.sector);
    setContractType(preset.contractType);
    setDurationHours(preset.defaultDurationHours);
    setGrossAmount(preset.defaultGrossAmount.toString());
    setEstimatedDelayDays(preset.typicalPayDelayDays);
    setTitle(preset.name);
    setCustomPayDate(
      calculateEstimatedPayDate(dateWorked, preset.typicalPayDelayDays)
    );
  };

  const handleContractChange = (newContract: ShiftContractType) => {
    setContractType(newContract);
    const typical = CONTRACT_CONFIG[newContract].typicalDays;
    setEstimatedDelayDays(typical);
    setCustomPayDate(calculateEstimatedPayDate(dateWorked, typical));
  };

  const parsedAmount = parseFloat(grossAmount) || 0;
  const hourlyRate = durationHours > 0 ? parsedAmount / durationHours : 0;
  const calculatedPayDate =
    customPayDate || calculateEstimatedPayDate(dateWorked, estimatedDelayDays);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalName.trim() || parsedAmount <= 0) return;

    const finalTitle =
      title.trim() || `${hospitalName.trim()} (${durationHours}h)`;

    if (shiftToEdit) {
      updateMedicalShift(shiftToEdit.id, {
        partner,
        title: finalTitle,
        dateWorked,
        durationHours,
        sector,
        hospitalName: hospitalName.trim(),
        contractType,
        grossAmount: parsedAmount,
        netAmount: parsedAmount,
        estimatedPayDate: calculatedPayDate,
        notes: notes.trim() || undefined,
      });
    } else {
      addMedicalShift({
        partner,
        title: finalTitle,
        dateWorked,
        durationHours,
        sector,
        hospitalName: hospitalName.trim(),
        contractType,
        grossAmount: parsedAmount,
        netAmount: parsedAmount,
        estimatedPayDate: calculatedPayDate,
        status: 'pending',
        notes: notes.trim() || undefined,
      });

      if (saveAsPreset && (presetTitle.trim() || hospitalName.trim())) {
        addShiftPreset({
          name: presetTitle.trim() || `${hospitalName.trim()} (${durationHours}h)`,
          hospitalName: hospitalName.trim(),
          sector,
          contractType,
          defaultDurationHours: durationHours,
          defaultGrossAmount: parsedAmount,
          typicalPayDelayDays: estimatedDelayDays,
        });
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FAF7F2] dark:bg-[#111318] text-slate-800 dark:text-slate-100 rounded-[28px] max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                {shiftToEdit ? 'Editar Plantão Médico' : 'Cadastrar Plantão Médico'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Previsão de recebimento, métricas de R$/hora e escala do casal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Carousel (only for new shifts) */}
        {!shiftToEdit && (
          <div className="mt-4 pt-1 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Modelos Rápidos (1-Clique)
              </span>
              <button
                type="button"
                onClick={() => setShowPresetManager(!showPresetManager)}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
              >
                {showPresetManager ? 'Ocultar Modelos' : 'Gerenciar Modelos'}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(medicalShiftPresets || []).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="shrink-0 px-3 py-2 rounded-xl text-left bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 hover:border-teal-500 dark:hover:border-teal-400 transition-all text-xs group"
                >
                  <p className="font-semibold text-stone-800 dark:text-stone-200 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    {preset.name}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    R$ {preset.defaultGrossAmount.toLocaleString('pt-BR')} • {preset.defaultDurationHours}h
                  </p>
                </button>
              ))}
            </div>

            {/* Inline Preset Manager */}
            {showPresetManager && (
              <div className="mt-2 p-3 bg-stone-100 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-2">
                <p className="font-medium text-stone-700 dark:text-stone-300">
                  Modelos Salvos:
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {(medicalShiftPresets || []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-1 px-2 bg-white dark:bg-stone-800 rounded-lg"
                    >
                      <span>
                        <strong>{p.name}</strong> — {p.hospitalName} ({p.defaultDurationHours}h)
                      </span>
                      {(medicalShiftPresets || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteShiftPreset(p.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shift Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Partner Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
              Médico(a) Responsável
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPartner('partner1')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  partner === 'partner1'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                <span>👨‍⚕️</span> {p1Name}
              </button>
              <button
                type="button"
                onClick={() => setPartner('partner2')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  partner === 'partner2'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                <span>👩‍⚕️</span> {p2Name}
              </button>
            </div>
          </div>

          {/* Hospital / Unit Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Hospital ou Unidade de Saúde
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="Ex: UPA Marechal Hermes, Hospital Barra D'Or, Samaritano"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Sector & Duration in 2 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sector */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Setor / Atuação Clínica
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as ShiftSector)}
                className="w-full py-2 px-3 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {(Object.keys(SECTOR_CONFIG) as ShiftSector[]).map((secKey) => (
                  <option key={secKey} value={secKey}>
                    {SECTOR_CONFIG[secKey].emoji} {SECTOR_CONFIG[secKey].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Duração do Plantão (Horas)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[6, 12, 24].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setDurationHours(hours)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      durationHours === hours
                        ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 dark:border-stone-200'
                        : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date & Gross Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Data Realizada do Plantão
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="date"
                  required
                  value={dateWorked}
                  onChange={(e) => {
                    setDateWorked(e.target.value);
                    setCustomPayDate(
                      calculateEstimatedPayDate(e.target.value, estimatedDelayDays)
                    );
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Valor Bruto do Plantão (R$)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="1600"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Hourly Rate Preview Pill */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 text-xs">
            <span className="font-medium">Rentabilidade por Hora:</span>
            <span className="font-bold text-sm">
              R$ {hourlyRate.toFixed(2)} / hora
            </span>
          </div>

          {/* Regime de Contratação & Prazo Estimado */}
          <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300">
              <Briefcase className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Regime de Pagamento & Janela Real
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(Object.keys(CONTRACT_CONFIG) as ShiftContractType[]).map((cKey) => (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => handleContractChange(cKey)}
                  className={`p-2 rounded-xl text-left border transition-all text-xs ${
                    contractType === cKey
                      ? 'bg-white dark:bg-stone-800 border-teal-500 dark:border-teal-400 shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-stone-800/50'
                  }`}
                >
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    {CONTRACT_CONFIG[cKey].short}
                  </p>
                  <p className="text-[10px] text-stone-500 line-clamp-1">
                    {CONTRACT_CONFIG[cKey].delayHint}
                  </p>
                </button>
              ))}
            </div>

            {/* Custom Delay Days Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-stone-600 dark:text-stone-400">
                  Estimativa de Dias para Receber:
                </span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  D+{estimatedDelayDays} dias
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={estimatedDelayDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setEstimatedDelayDays(val);
                  setCustomPayDate(calculateEstimatedPayDate(dateWorked, val));
                }}
                className="w-full accent-teal-600"
              />
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                Previsão calculada de entrada na conta:{' '}
                <strong className="text-stone-700 dark:text-stone-200">
                  {new Date(calculatedPayDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                </strong>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Troca com colega, leito extra na UTI, aguardar emissão de NF"
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Option to Save as Preset */}
          {!shiftToEdit && (
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={saveAsPreset}
                  onChange={(e) => setSaveAsPreset(e.target.checked)}
                  className="rounded text-teal-600 accent-teal-600"
                />
                Salvar esta configuração como modelo rápido para plantões futuros
              </label>
              {saveAsPreset && (
                <div className="mt-2 pl-5">
                  <input
                    type="text"
                    value={presetTitle}
                    onChange={(e) => setPresetTitle(e.target.value)}
                    placeholder={`Nome do modelo (Ex: ${hospitalName || 'Meu Plantão'} 12h)`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              {shiftToEdit ? 'Atualizar Plantão' : 'Salvar Plantão na Escala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
