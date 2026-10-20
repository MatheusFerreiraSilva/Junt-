import { CategoryKey, LifeTierInfo, LifeTierKey, IncomeSourceClassification, IncomeItem } from '../types/finance';

/**
 * MOTOR DINÂMICO DE FAIXAS DE RENDA E IDENTIDADE VISUAL AMBIENTAL (JUNTÔ)
 *
 * Ponto central de inflexão: R$ 35.000,00 líquidos/mês.
 * Abaixo de R$ 35k: prioriza Conforto, Proteção e Qualidade de Vida (anti-burnout médico).
 * Acima de R$ 35k: aceleração exponencial de Investimentos e Construção de Patrimônio.
 */

export const LIFE_TIERS: Record<LifeTierKey, LifeTierInfo> = {
  decolagem: {
    key: 'decolagem',
    name: 'Fase Decolagem',
    shortName: 'Decolagem',
    emblem: '🚀',
    minIncome: 0,
    maxIncome: 18000,
    message: 'Base firme e descanso garantido. A jornada de vocês está apenas começando.',
    tagline: 'Residência Médica & Início de Carreira',
    colors: {
      primary: '#c2410c', // Cobre vibrante
      secondary: '#334155', // Azul Grafite
      lightBg: '#fff7ed',
      darkBg: 'rgba(51, 65, 85, 0.35)',
      border: '#fdba74',
      glow: 'rgba(194, 65, 12, 0.22)',
      text: '#9a3412',
      gradientFrom: '#1e293b',
      gradientTo: '#7c2d12',
    },
    percentages: {
      moradia: 30,
      transporte: 10,
      comida: 18,
      lazer: 10,
      protecao: 12,
      profissional: 10,
      investimentos: 10,
    },
    floors: {
      moradiaPct: 25,
      transportePct: 8,
      comidaPct: 15,
      protecaoR$: 600,
      investimentosMinPct: 10,
    },
    inflectionNote: 'Abaixo do ponto de inflexão (R$ 35k): foco em descanso, moradia digna, transporte seguro e proteção para evitar o burnout de residência.',
  },

  tracao: {
    key: 'tracao',
    name: 'Fase Tração',
    shortName: 'Tração',
    emblem: '⚡',
    minIncome: 18000.01,
    maxIncome: 35000,
    message: 'Conforto em evolução e rotina protegida. Vocês estão ganhando tração.',
    tagline: 'Plantões & Consolidação Médica',
    colors: {
      primary: '#059669', // Verde Esmeralda
      secondary: '#10b981', // Menta
      lightBg: '#ecfdf5',
      darkBg: 'rgba(5, 150, 105, 0.25)',
      border: '#a7f3d0',
      glow: 'rgba(5, 150, 105, 0.25)',
      text: '#065f46',
      gradientFrom: '#064e3b',
      gradientTo: '#059669',
    },
    percentages: {
      moradia: 30,
      transporte: 10,
      comida: 15,
      lazer: 12,
      protecao: 10,
      profissional: 8,
      investimentos: 15,
    },
    floors: {
      investimentosMinPct: 15,
    },
    reserveDistributionPct: 77,
    inflectionNote: 'Abaixo de R$ 35k: rotina protegida e consolidação. Caso a Reserva de Emergência esteja incompleta, 77% dos investimentos são canalizados para ela.',
  },

  voo_alto: {
    key: 'voo_alto',
    name: 'Fase Voo Alto',
    shortName: 'Voo Alto',
    emblem: '🦅',
    minIncome: 35000.01,
    maxIncome: 60000,
    message: 'Qualidade de vida no topo e patrimônio acelerado. Vocês estão em voo alto.',
    tagline: 'Especialistas Estabelecidos',
    colors: {
      primary: '#6366f1', // Violeta Safira
      secondary: '#a855f7', // Neon Purple
      lightBg: '#f5f3ff',
      darkBg: 'rgba(99, 102, 241, 0.28)',
      border: '#c4b5fd',
      glow: 'rgba(99, 102, 241, 0.25)',
      text: '#4338ca',
      gradientFrom: '#312e81',
      gradientTo: '#6366f1',
    },
    percentages: {
      moradia: 22,
      transporte: 10,
      comida: 11,
      lazer: 15,
      protecao: 7,
      profissional: 5,
      investimentos: 30,
    },
    floors: {
      investimentosMinPct: 30,
    },
    inflectionNote: 'Ponto de inflexão superado (> R$ 35k)! Aceleração exponencial de patrimônio com 30% em investimentos de alta rentabilidade.',
  },

  orbita: {
    key: 'orbita',
    name: 'Fase Órbita',
    shortName: 'Órbita',
    emblem: '🪐',
    minIncome: 60000.01,
    maxIncome: Infinity,
    message: 'Liberdade financeira e legado em construção. O futuro está sob controle.',
    tagline: 'Médicos Renomados & Clínicas Próprias',
    colors: {
      primary: '#d97706', // Dourado Âmbar
      secondary: '#0f172a', // Preto Titanium
      lightBg: '#fffbeb',
      darkBg: 'rgba(217, 119, 6, 0.30)',
      border: '#fde68a',
      glow: 'rgba(217, 119, 6, 0.30)',
      text: '#92400e',
      gradientFrom: '#0f172a',
      gradientTo: '#78350f',
    },
    percentages: {
      moradia: 17,
      transporte: 10,
      comida: 8,
      lazer: 12,
      protecao: 4,
      profissional: 4,
      investimentos: 45,
    },
    floors: {
      investimentosMinPct: 45,
    },
    inflectionNote: 'Topo da carreira médica: geração massiva de renda passiva (45% em investimentos e patrimônio de longo prazo).',
  },
};

/**
 * MOTOR DINÂMICO DE FAIXAS DE RENDA
 * Analisa automaticamente a Renda Líquida Mensal Combinada do casal:
 * - Média dos últimos 3 meses ou mês atual (com base em transações reais)
 * - Fallback transparente para a renda declarada no perfil se ainda não houver lançamentos
 * Enquadra o casal instantaneamente em uma das quatro faixas sem configurações manuais.
 */
export function calculateDynamicCombinedNetIncome(
  baseProfileIncome: number,
  incomes: IncomeItem[],
  currentMonth: string
): {
  effectiveMonthlyIncome: number;
  basis: 'current_month' | 'three_months_avg' | 'profile_base';
  currentMonthTotal: number;
  threeMonthsAverage: number;
  threeMonthsHistory: { month: string; amount: number }[];
} {
  const months: string[] = [];
  const parts = currentMonth.split('-');
  const y = parseInt(parts[0], 10) || new Date().getFullYear();
  const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);

  for (let i = 2; i >= 0; i--) {
    let targetM = m - i;
    let targetY = y;
    while (targetM <= 0) {
      targetM += 12;
      targetY -= 1;
    }
    const str = `${targetY}-${String(targetM).padStart(2, '0')}`;
    months.push(str);
  }

  const history = months.map(monthKey => {
    const monthIncomes = (incomes || []).filter(inc => inc.date && inc.date.startsWith(monthKey));
    const total = monthIncomes.reduce((sum, item) => sum + (item.amount || 0), 0);
    return { month: monthKey, amount: total };
  });

  const curMonthItem = history.find(h => h.month === currentMonth);
  const currentMonthTotal = curMonthItem ? curMonthItem.amount : 0;

  const monthsWithData = history.filter(h => h.amount > 0);
  const total3Months = history.reduce((sum, h) => sum + h.amount, 0);
  const threeMonthsAverage = monthsWithData.length > 0 ? total3Months / monthsWithData.length : 0;

  // 1. Se o mês atual tiver renda consolidada maior ou igual à média dos últimos 3 meses
  if (currentMonthTotal > 0 && currentMonthTotal >= threeMonthsAverage) {
    return {
      effectiveMonthlyIncome: currentMonthTotal,
      basis: 'current_month',
      currentMonthTotal,
      threeMonthsAverage,
      threeMonthsHistory: history,
    };
  }

  // 2. Se houver média histórica dos últimos 3 meses consolidada
  if (threeMonthsAverage > 0) {
    return {
      effectiveMonthlyIncome: threeMonthsAverage,
      basis: 'three_months_avg',
      currentMonthTotal,
      threeMonthsAverage,
      threeMonthsHistory: history,
    };
  }

  // 3. Fallback para a Renda Declarada no Perfil do Casal
  return {
    effectiveMonthlyIncome: Math.max(0, baseProfileIncome),
    basis: 'profile_base',
    currentMonthTotal,
    threeMonthsAverage,
    threeMonthsHistory: history,
  };
}

/**
 * Enquadra a renda líquida combinada na faixa correspondente
 */
export function getLifeTier(income: number): LifeTierInfo {
  const safeIncome = Math.max(0, income);
  if (safeIncome <= 18000) {
    return LIFE_TIERS.decolagem;
  }
  if (safeIncome <= 35000) {
    return LIFE_TIERS.tracao;
  }
  if (safeIncome <= 60000) {
    return LIFE_TIERS.voo_alto;
  }
  return LIFE_TIERS.orbita;
}

/**
 * Calcula o progresso rumo à próxima faixa
 */
export function calculateTierProgress(income: number, tier: LifeTierInfo) {
  const safeIncome = Math.max(0, income);
  
  if (tier.key === 'orbita') {
    return {
      currentIncome: safeIncome,
      percentage: 100,
      amountToNext: 0,
      nextTierName: 'Topo da Carreira',
      isMaxTier: true,
    };
  }

  const range = tier.maxIncome - tier.minIncome;
  const progressInTier = Math.max(0, safeIncome - tier.minIncome);
  const percentage = Math.min(100, Math.round((progressInTier / range) * 100));
  const amountToNext = Math.max(0, tier.maxIncome - safeIncome + 0.01);

  let nextTierName = 'Fase Tração';
  if (tier.key === 'tracao') nextTierName = 'Fase Voo Alto';
  if (tier.key === 'voo_alto') nextTierName = 'Fase Órbita';

  return {
    currentIncome: safeIncome,
    percentage,
    amountToNext,
    nextTierName,
    isMaxTier: false,
  };
}

/**
 * Calcula a Renda Líquida Estimada a partir do Faturamento Bruto de PJ
 */
export function calculateNetLiquidFromGross(
  grossAmount: number,
  taxRatePercent: number = 6,
  monthlyAccountingCost: number = 0
): { grossAmount: number; taxAmount: number; accountingDeduction: number; netLiquid: number; effectiveRate: number } {
  const safeGross = Math.max(0, grossAmount);
  const safeRate = Math.max(0, Math.min(40, taxRatePercent));
  const taxAmount = (safeGross * safeRate) / 100;
  const netLiquid = Math.max(0, safeGross - taxAmount - monthlyAccountingCost);
  const effectiveRate = safeGross > 0 ? ((safeGross - netLiquid) / safeGross) * 100 : safeRate;

  return {
    grossAmount: safeGross,
    taxAmount,
    accountingDeduction: monthlyAccountingCost,
    netLiquid,
    effectiveRate: Math.round(effectiveRate * 10) / 10,
  };
}

/**
 * REGRA 50 POR 50: Bonificações e Plantões Extras
 * Quando a renda recebida no mês excede a renda base do casal, o excedente é dividido:
 * - 50% para Investimentos e Objetivos
 * - 50% liberado no Lazer e Conforto do casal no próprio mês
 */
export function calculateBonusShift50_50(
  currentMonthActualNetIncome: number,
  baselineMonthlyIncome: number
): {
  excessAmount: number;
  toInvestments: number;
  toLeisure: number;
  hasBonus: boolean;
} {
  const safeActual = Math.max(0, currentMonthActualNetIncome);
  const safeBase = Math.max(0, baselineMonthlyIncome);
  const excessAmount = Math.max(0, safeActual - safeBase);
  const hasBonus = excessAmount > 50; // Threshold mínimo de R$ 50 para considerar plantão extra

  const half = +(excessAmount / 2).toFixed(2);

  return {
    excessAmount,
    toInvestments: half,
    toLeisure: half,
    hasBonus,
  };
}

/**
 * Identifica se uma transferência capturada pelo Meu Pluggy é interna entre as contas do próprio casal
 */
export function isInternalTransfer(
  sourceName: string,
  sourceTaxNumber?: string,
  partner1Cpf?: string,
  partner2Cpf?: string,
  partner1Cnpj?: string,
  partner2Cnpj?: string,
  partner1Name?: string,
  partner2Name?: string
): boolean {
  const clean = (val?: string) => (val || '').replace(/\D/g, '').trim();

  const srcClean = clean(sourceTaxNumber);
  const p1CpfClean = clean(partner1Cpf);
  const p2CpfClean = clean(partner2Cpf);
  const p1CnpjClean = clean(partner1Cnpj);
  const p2CnpjClean = clean(partner2Cnpj);

  // Verificação por CPF ou CNPJ idêntico
  if (srcClean) {
    if (p1CpfClean && srcClean === p1CpfClean) return true;
    if (p2CpfClean && srcClean === p2CpfClean) return true;
    if (p1CnpjClean && srcClean === p1CnpjClean) return true;
    if (p2CnpjClean && srcClean === p2CnpjClean) return true;
  }

  // Verificação textual por nome dos parceiros ou termos típicos
  const lowerName = (sourceName || '').toLowerCase();
  const lowerP1 = (partner1Name || '').toLowerCase().trim();
  const lowerP2 = (partner2Name || '').toLowerCase().trim();

  if (lowerP1 && lowerP1.length > 2 && lowerName.includes(lowerP1)) return true;
  if (lowerP2 && lowerP2.length > 2 && lowerName.includes(lowerP2)) return true;
  if (lowerName.includes('mesma titularidade') || lowerName.includes('transf. entre contas')) return true;

  return false;
}

/**
 * Regras pré-definidas para fontes médicas conhecidas no Brasil
 */
export const DEFAULT_MEDICAL_SOURCE_RULES: {
  sourcePattern: string;
  sourceName: string;
  classification: IncomeSourceClassification;
  defaultTaxRate?: number;
  reason: string;
}[] = [
  {
    sourcePattern: 'UNIMED',
    sourceName: 'Cooperativa Médica Unimed',
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Repasse de produção médica PJ (Simples Nacional ~6%)',
  },
  {
    sourcePattern: 'EINSTEIN',
    sourceName: 'Hospital Israelita Albert Einstein',
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Honorários de plantão e sobreaviso hospitalar PJ',
  },
  {
    sourcePattern: 'SIRIO',
    sourceName: 'Hospital Sírio-Libanês',
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Honorários de plantão hospitalar PJ',
  },
  {
    sourcePattern: 'PREFEITURA',
    sourceName: 'Secretaria Municipal de Saúde / Prefeitura',
    classification: 'pf_net',
    reason: 'Rendimento de concurso / contrato CLT público (imposto já retido na fonte)',
  },
  {
    sourcePattern: 'RESIDENCIA',
    sourceName: 'Bolsa de Residência Médica (MEC / SUS)',
    classification: 'pf_net',
    reason: 'Bolsa de residência médica isenta de IRPF',
  },
  {
    sourcePattern: 'REDE D OR',
    sourceName: "Rede D'Or São Luiz",
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Honorários médicos de emergência / UTI PJ',
  },
  {
    sourcePattern: 'AMIL',
    sourceName: 'Amil Assistência Médica',
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Repasse de consultas e procedimentos ambulatoriais PJ',
  },
  {
    sourcePattern: 'BRADESCO SAUDE',
    sourceName: 'Bradesco Saúde',
    classification: 'pj_gross',
    defaultTaxRate: 6,
    reason: 'Reembolso e produção médica credenciada PJ',
  },
];
