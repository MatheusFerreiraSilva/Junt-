import {
  MedicalShift,
  MedicalShiftPreset,
  HospitalIncomeMappingRule,
  ShiftPacingRecommendation,
  ShiftSector,
  ShiftContractType,
  IncomeItem,
} from '../types/finance';
import { formatMonthYear, getNextMonth } from './formatters';

export function shiftCivilToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isActiveShift(shift: MedicalShift): boolean {
  return shift.executionStatus !== 'cancelled' && shift.executionStatus !== 'replaced';
}

export function isPerformedShift(shift: MedicalShift): boolean {
  return isActiveShift(shift) && shift.executionStatus !== 'scheduled' && shift.dateWorked <= shiftCivilToday();
}

export const SECTOR_CONFIG: Record<
  ShiftSector,
  { label: string; emoji: string; bgClass: string; textClass: string; borderClass: string }
> = {
  porta: {
    label: 'Porta de Emergência (UPA/CER)',
    emoji: '🚪',
    bgClass: 'bg-amber-500/10 dark:bg-amber-950/40',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-800',
  },
  vermelha: {
    label: 'Sala Vermelha / Reanimação',
    emoji: '🚨',
    bgClass: 'bg-rose-500/10 dark:bg-rose-950/40',
    textClass: 'text-rose-800 dark:text-rose-300',
    borderClass: 'border-rose-300 dark:border-rose-800',
  },
  uti: {
    label: 'Terapia Intensiva (UTI)',
    emoji: '🫀',
    bgClass: 'bg-blue-500/10 dark:bg-blue-950/40',
    textClass: 'text-blue-800 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-800',
  },
  enfermaria: {
    label: 'Enfermaria / Pareceres',
    emoji: '📋',
    bgClass: 'bg-purple-500/10 dark:bg-purple-950/40',
    textClass: 'text-purple-800 dark:text-purple-300',
    borderClass: 'border-purple-300 dark:border-purple-800',
  },
  sobreaviso: {
    label: 'Sobreaviso de Especialidade',
    emoji: '📞',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-950/40',
    textClass: 'text-emerald-800 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
  },
  evento: {
    label: 'Cobertura de Eventos & Shows',
    emoji: '🎪',
    bgClass: 'bg-sky-500/10 dark:bg-sky-950/40',
    textClass: 'text-sky-800 dark:text-sky-300',
    borderClass: 'border-sky-300 dark:border-sky-800',
  },
  outro: {
    label: 'Outro Setor',
    emoji: '🩺',
    bgClass: 'bg-slate-500/10 dark:bg-slate-800',
    textClass: 'text-slate-800 dark:text-slate-200',
    borderClass: 'border-slate-300 dark:border-slate-700',
  },
};

export const CONTRACT_CONFIG: Record<
  ShiftContractType,
  { label: string; short: string; delayHint: string; typicalDays: number }
> = {
  clt: {
    label: 'CLT (Concurso / RioSaúde / EBSERH)',
    short: 'CLT (D+5)',
    delayHint: 'Recebe no 5º dia útil do mês seguinte',
    typicalDays: 5,
  },
  pj_privado: {
    label: 'Pessoa Jurídica (Rede Privada D\'Or / Unimed)',
    short: 'PJ Privado (D+30)',
    delayHint: 'Pagamento 30 a 60 dias após fechamento da escala',
    typicalDays: 30,
  },
  pj_oss: {
    label: 'Pessoa Jurídica (UPAs e Hospitais via OSS)',
    short: 'PJ OSS (D+60)',
    delayHint: 'Pagamento 60 a 90+ dias com risco de atrasos públicos',
    typicalDays: 60,
  },
  evento: {
    label: 'Plantão Avulso em Eventos / Shows',
    short: 'Evento (Imediato a 15d)',
    delayHint: 'PIX no término ou em até 15 dias',
    typicalDays: 7,
  },
  outro: {
    label: 'Outro Regime',
    short: 'Outro',
    delayHint: 'Data personalizada',
    typicalDays: 30,
  },
};

export const DEFAULT_SHIFT_PRESETS: MedicalShiftPreset[] = [
  {
    id: 'preset-upa-porta',
    name: 'Porta UPA 12h (OSS D+60)',
    hospitalName: 'UPA 24h Tijuca / OSS',
    sector: 'porta',
    contractType: 'pj_oss',
    defaultDurationHours: 12,
    defaultGrossAmount: 1350,
    typicalPayDelayDays: 60,
  },
  {
    id: 'preset-vermelha-upa',
    name: 'Sala Vermelha 12h (OSS D+60)',
    hospitalName: 'UPA 24h Engenho de Dentro',
    sector: 'vermelha',
    contractType: 'pj_oss',
    defaultDurationHours: 12,
    defaultGrossAmount: 1650,
    typicalPayDelayDays: 60,
  },
  {
    id: 'preset-dor-uti',
    name: 'UTI Geral Copa D\'Or 12h (PJ D+30)',
    hospitalName: 'Hospital Copa D\'Or',
    sector: 'uti',
    contractType: 'pj_privado',
    defaultDurationHours: 12,
    defaultGrossAmount: 1950,
    typicalPayDelayDays: 30,
  },
  {
    id: 'preset-riosaude-clt',
    name: 'RioSaúde CER 12h (CLT D+5)',
    hospitalName: 'RioSaúde - CER Campo Grande',
    sector: 'porta',
    contractType: 'clt',
    defaultDurationHours: 12,
    defaultGrossAmount: 1500,
    typicalPayDelayDays: 5,
  },
  {
    id: 'preset-evento-show',
    name: 'Cobertura de Show / Evento (PIX 7d)',
    hospitalName: 'Eventos & Festivais RJ',
    sector: 'evento',
    contractType: 'evento',
    defaultDurationHours: 12,
    defaultGrossAmount: 1400,
    typicalPayDelayDays: 7,
  },
  {
    id: 'preset-enfermaria-visita',
    name: 'Visita de Enfermaria 6h (PJ D+30)',
    hospitalName: 'Hospital Quinta D\'Or',
    sector: 'enfermaria',
    contractType: 'pj_privado',
    defaultDurationHours: 6,
    defaultGrossAmount: 850,
    typicalPayDelayDays: 30,
  },
];

export const DEFAULT_HOSPITAL_MAPPING_RULES: HospitalIncomeMappingRule[] = [
  {
    id: 'rule-hosp-1',
    hospitalName: 'Hospital Copa D\'Or',
    keywordPattern: 'D\'OR',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'rule-hosp-2',
    hospitalName: 'UPA 24h Tijuca / OSS',
    keywordPattern: 'VIVA RIO',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'rule-hosp-3',
    hospitalName: 'RioSaúde - CER Campo Grande',
    keywordPattern: 'RIOSAUDE',
    createdAt: '2026-10-01T00:00:00Z',
  },
];

/**
 * Calculates estimated pay date given worked date and delay in days
 */
export function calculateEstimatedPayDate(workedDateStr: string, delayDays: number): string {
  const [year, month, day] = workedDateStr.split('-').map(Number);
  const worked = new Date(year, month - 1, day);
  worked.setDate(worked.getDate() + delayDays);

  const y = worked.getFullYear();
  const m = String(worked.getMonth() + 1).padStart(2, '0');
  const d = String(worked.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ShiftMetricsSummary {
  totalHours: number;
  totalGross: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  shiftsCount: number;
  receivedCount: number;
  pendingCount: number;
  overdueCount: number;
  averageRatePerHour: number;
}

/**
 * Computes shift metrics for a given month and partner filter
 */
export function calculateShiftMetrics(
  shifts: MedicalShift[],
  monthKey: string,
  partnerFilter?: 'partner1' | 'partner2' | 'both'
): ShiftMetricsSummary {
  const todayStr = shiftCivilToday();

  const filtered = shifts.filter(s => {
    const isPartner = !partnerFilter || partnerFilter === 'both' || s.partner === partnerFilter;
    const isMonth = s.dateWorked.startsWith(monthKey) || s.estimatedPayDate.startsWith(monthKey);
    return isPartner && isMonth && isActiveShift(s);
  });

  let totalHours = 0;
  let totalGross = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let totalOverdue = 0;
  let receivedCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  filtered.forEach(shift => {
    if (isPerformedShift(shift)) {
      totalHours += shift.durationHours || 0;
      totalGross += shift.grossAmount || 0;
    }

    const isOverdue = shift.status === 'overdue' || (shift.status === 'pending' && shift.estimatedPayDate < todayStr);

    if (shift.status === 'received' && isPerformedShift(shift)) {
      totalReceived += shift.netAmount ?? shift.grossAmount;
      receivedCount++;
    } else if (isOverdue) {
      totalOverdue += shift.grossAmount;
      overdueCount++;
    } else {
      totalPending += shift.grossAmount;
      pendingCount++;
    }
  });

  const averageRatePerHour = totalHours > 0 ? Math.round(totalGross / totalHours) : 0;

  return {
    totalHours,
    totalGross,
    totalReceived,
    totalPending,
    totalOverdue,
    shiftsCount: filtered.length,
    receivedCount,
    pendingCount,
    overdueCount,
    averageRatePerHour,
  };
}

export interface HourlyEfficiencyRank {
  key: string;
  label: string;
  sector: ShiftSector;
  hospitalName: string;
  totalHours: number;
  totalEarned: number;
  ratePerHour: number;
  shiftsCount: number;
  badge: string;
}

/**
 * Computes R$/hora ranking by sector and hospital to answer "qual plantão tá valendo mais a pena"
 */
export function calculateHourlyYieldRanking(shifts: MedicalShift[]): HourlyEfficiencyRank[] {
  const groups: Record<
    string,
    {
      sector: ShiftSector;
      hospitalName: string;
      totalHours: number;
      totalEarned: number;
      shiftsCount: number;
    }
  > = {};

  shifts.filter(isPerformedShift).forEach(s => {
    const key = `${s.hospitalName}-${s.sector}`;
    if (!groups[key]) {
      groups[key] = {
        sector: s.sector,
        hospitalName: s.hospitalName,
        totalHours: 0,
        totalEarned: 0,
        shiftsCount: 0,
      };
    }
    groups[key].totalHours += s.durationHours || 12;
    groups[key].totalEarned += s.grossAmount || 0;
    groups[key].shiftsCount += 1;
  });

  const list: HourlyEfficiencyRank[] = Object.entries(groups).map(([key, data]) => {
    const ratePerHour = data.totalHours > 0 ? Math.round(data.totalEarned / data.totalHours) : 0;
    const sectorConf = SECTOR_CONFIG[data.sector];

    let badge = 'Padrão';
    if (ratePerHour >= 160) badge = '🌟 Alta Eficiência';
    else if (ratePerHour >= 130) badge = '⚡ Boa Rentabilidade';
    else if (ratePerHour < 100) badge = '⚠️ Baixo Retorno/h';

    return {
      key,
      label: `${sectorConf.emoji} ${data.hospitalName}`,
      sector: data.sector,
      hospitalName: data.hospitalName,
      totalHours: data.totalHours,
      totalEarned: data.totalEarned,
      ratePerHour,
      shiftsCount: data.shiftsCount,
      badge,
    };
  });

  // Sort descending by rate per hour
  return list.sort((a, b) => b.ratePerHour - a.ratePerHour);
}

/**
 * Calculates prescriptive recommendations in 3 levels (Pagar Contas Fixas, Manter Estilo, Acelerar Ganhos)
 */
export function calculateShiftRecommendations(
  projectedAmount: number,
  fixedExpensesAmount: number,
  averageIncomeTarget: number,
  averageShiftValue: number,
  monthKey: string,
  monthLabel: string
): ShiftPacingRecommendation {
  const safeShiftValue = Number.isFinite(averageShiftValue) && averageShiftValue > 0 ? averageShiftValue : 0;
  const isDryMonth = projectedAmount < fixedExpensesAmount;

  // Level 1: Linha de Sobrevivência / Blindagem Básica (cobrir contas fixas)
  const gapToFixed = Math.max(0, fixedExpensesAmount - projectedAmount);
  const shiftsToCoverFixed = gapToFixed > 0 && safeShiftValue > 0 ? Math.ceil(gapToFixed / safeShiftValue) : 0;

  // Level 2: Manutenção do Estilo de Vida Médio
  const gapToLifestyle = Math.max(0, averageIncomeTarget - projectedAmount);
  const shiftsToMaintainLifestyle = gapToLifestyle > 0 && safeShiftValue > 0 ? Math.ceil(gapToLifestyle / safeShiftValue) : 0;

  // Level 3: Aceleração Patrimonial (+20% sobre a média)
  const accelerateTarget = Math.round(averageIncomeTarget * 1.2);
  const gapToAccelerate = Math.max(0, accelerateTarget - projectedAmount);
  const shiftsToAccelerateGains = gapToAccelerate > 0 && safeShiftValue > 0 ? Math.ceil(gapToAccelerate / safeShiftValue) : 0;

  return {
    monthKey,
    monthLabel,
    projectedAmount,
    fixedExpensesAmount,
    averageIncomeTarget,
    averageShiftValue: safeShiftValue,
    isDryMonth,
    shiftsToCoverFixed,
    shiftsToMaintainLifestyle,
    shiftsToAccelerateGains,
  };
}

export interface CashFlowMonthProjection {
  monthKey: string;
  monthLabel: string;
  projectedIncome: number;
  alreadyReceived: number;
  fixedExpenses: number;
  coverageRatio: number; // projectedIncome / fixedExpenses (e.g. 1.2 = 120%)
  shifts: MedicalShift[];
  recommendation: ShiftPacingRecommendation;
}

/**
 * Projects monthly cash-flow timeline across upcoming months
 */
export function projectCashFlowTimeline(
  shifts: MedicalShift[],
  fixedExpenses: number,
  averageIncome: number,
  startMonthKey: string,
  monthsAhead: number = 4
): CashFlowMonthProjection[] {
  const timeline: CashFlowMonthProjection[] = [];
  const safeFixed = Number.isFinite(fixedExpenses) ? Math.max(0, fixedExpenses) : 0;
  const safeAvgIncome = Number.isFinite(averageIncome) ? Math.max(0, averageIncome) : 0;

  // Compute overall average 12h shift value from recorded shifts
  const validShifts = shifts.filter(s => isPerformedShift(s) && s.grossAmount > 0);
  const avgShiftValue =
    validShifts.length > 0
      ? Math.round(validShifts.reduce((s, it) => s + it.grossAmount, 0) / validShifts.length)
      : 0;

  let currentKey = startMonthKey;

  for (let i = 0; i < monthsAhead; i++) {
    const monthShifts = shifts.filter(s => isActiveShift(s) && s.estimatedPayDate.startsWith(currentKey));
    const projectedIncome = monthShifts.reduce((s, it) => s + it.grossAmount, 0);
    const alreadyReceived = monthShifts
      .filter(s => s.status === 'received' && isPerformedShift(s))
      .reduce((s, it) => s + (it.netAmount ?? it.grossAmount), 0);

    const coverageRatio = safeFixed > 0 ? projectedIncome / safeFixed : 1;
    const label = formatMonthYear(currentKey);

    const recommendation = calculateShiftRecommendations(
      projectedIncome,
      safeFixed,
      safeAvgIncome,
      avgShiftValue,
      currentKey,
      label
    );

    timeline.push({
      monthKey: currentKey,
      monthLabel: label,
      projectedIncome,
      alreadyReceived,
      fixedExpenses: safeFixed,
      coverageRatio,
      shifts: monthShifts,
      recommendation,
    });

    currentKey = getNextMonth(currentKey);
  }

  return timeline;
}

/**
 * Reconciles Open Finance / bank credits with shift
 */
export function findMatchingBankIncomesForShift(
  shift: MedicalShift,
  incomes: IncomeItem[],
  rules: HospitalIncomeMappingRule[] = []
): { exactMatches: IncomeItem[]; probableMatches: IncomeItem[]; matchingRule?: HospitalIncomeMappingRule } {
  // Find rule matching this hospital
  const matchingRule = rules.find(
    r =>
      r.hospitalName.toLowerCase() === shift.hospitalName.toLowerCase() ||
      shift.hospitalName.toLowerCase().includes(r.hospitalName.toLowerCase())
  );

  const exactMatches: IncomeItem[] = [];
  const probableMatches: IncomeItem[] = [];

  incomes.forEach(inc => {
    if (inc.recipient !== shift.partner) return;
    const amountDiff = Math.abs(inc.amount - (shift.netAmount ?? shift.grossAmount));
    const isAmountClose = amountDiff <= 50; // allow small withholding tax variation

    const descUpper = (inc.description || '').toUpperCase();
    const hasRuleKeyword = matchingRule && descUpper.includes(matchingRule.keywordPattern.toUpperCase());
    const hasHospitalWord = shift.hospitalName
      .toUpperCase()
      .split(' ')
      .filter(w => w.length > 3)
      .some(w => descUpper.includes(w));

    if (isAmountClose && (hasRuleKeyword || hasHospitalWord)) {
      exactMatches.push(inc);
    } else if (isAmountClose || hasRuleKeyword || hasHospitalWord) {
      probableMatches.push(inc);
    }
  });

  return {
    exactMatches,
    probableMatches,
    matchingRule,
  };
}

/**
 * Generates sample seed shifts for realistic initial experience
 */
export function getSampleMedicalShifts(currentMonthKey: string): MedicalShift[] {
  const [year, month] = currentMonthKey.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  return [
    {
      id: 'shift-sample-1',
      partner: 'partner1',
      title: 'Plantão UTI Geral 12h',
      hospitalName: 'Hospital Copa D\'Or',
      sector: 'uti',
      contractType: 'pj_privado',
      dateWorked: `${currentMonthKey}-12`,
      durationHours: 12,
      grossAmount: 1950,
      netAmount: 1833,
      estimatedPayDate: `${getNextMonth(currentMonthKey)}-15`,
      status: 'pending',
      notes: 'Escala mensal diurna na UTI 2.',
    },
    {
      id: 'shift-sample-2',
      partner: 'partner1',
      title: 'Porta de Emergência 12h',
      hospitalName: 'UPA 24h Tijuca / OSS',
      sector: 'porta',
      contractType: 'pj_oss',
      dateWorked: `${prevMonthKey}-18`,
      durationHours: 12,
      grossAmount: 1350,
      estimatedPayDate: `${currentMonthKey}-28`,
      status: 'pending',
      notes: 'Repasse habitual da OSS via PJ.',
    },
    {
      id: 'shift-sample-3',
      partner: 'partner2',
      title: 'RioSaúde CER 12h',
      hospitalName: 'RioSaúde - CER Campo Grande',
      sector: 'porta',
      contractType: 'clt',
      dateWorked: `${prevMonthKey}-25`,
      durationHours: 12,
      grossAmount: 1500,
      netAmount: 1380,
      estimatedPayDate: `${currentMonthKey}-07`,
      actualPayDate: `${currentMonthKey}-07`,
      status: 'received',
      notes: 'Crédito CLT 5º dia útil confirmado.',
    },
    {
      id: 'shift-sample-4',
      partner: 'partner2',
      title: 'Sala Vermelha UPA 12h',
      hospitalName: 'UPA 24h Engenho de Dentro',
      sector: 'vermelha',
      contractType: 'pj_oss',
      dateWorked: `${prevMonthKey}-05`,
      durationHours: 12,
      grossAmount: 1650,
      estimatedPayDate: `${currentMonthKey}-05`,
      status: 'overdue',
      notes: 'Prazo D+60 venceu. Entrar em contato com o faturamento da OSS.',
    },
    {
      id: 'shift-sample-5',
      partner: 'partner1',
      title: 'Visita de Enfermaria 6h',
      hospitalName: 'Hospital Quinta D\'Or',
      sector: 'enfermaria',
      contractType: 'pj_privado',
      dateWorked: `${currentMonthKey}-04`,
      durationHours: 6,
      grossAmount: 850,
      estimatedPayDate: `${getNextMonth(currentMonthKey)}-10`,
      status: 'pending',
      notes: 'Evolução e pareceres matutinos.',
    },
  ];
}
