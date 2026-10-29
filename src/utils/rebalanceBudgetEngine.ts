import { CategoryKey, DestinationKey } from '../types/finance';

export type PriorityLevel = 'P1' | 'P2' | 'P3';

export const ALL_DESTINATIONS: DestinationKey[] = [
  'moradia',
  'transporte',
  'comida',
  'lazer',
  'protecao',
  'profissional',
  'investimentos',
];

export const DESTINATION_NAMES: Record<DestinationKey, string> = {
  moradia: 'Moradia',
  transporte: 'Transporte',
  comida: 'Comida & Conveniência',
  lazer: 'Lazer',
  protecao: 'Proteção',
  profissional: 'Profissional',
  investimentos: 'Investimentos',
};

export const DEFAULT_PRIORITIES: Record<DestinationKey, PriorityLevel> = {
  moradia: 'P1',
  protecao: 'P1',
  profissional: 'P1',
  comida: 'P2',
  transporte: 'P2',
  investimentos: 'P2',
  lazer: 'P3',
};

export interface RebalanceParams {
  plannedNetIncome: number;
  currentPercentages: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floorsR$?: Record<DestinationKey, number>;
  commitmentsR$?: Record<DestinationKey, number>;
  priorities?: Record<DestinationKey, PriorityLevel>;
  referencePreset?: Record<DestinationKey, number>;
  competence?: string; // YYYY-MM
  applyToFutureMonths?: boolean;
}

export interface RebalanceConflict {
  destination: DestinationKey;
  type:
    | 'lock_below_commitments'
    | 'floor_exceeds_budget'
    | 'sum_locks_exceeds_100'
    | 'total_required_exceeds_income'
    | 'invalid_input';
  message: string;
  requiredR$: number;
  allocatedR$: number;
}

export interface RebalanceResult {
  status: 'feasible' | 'infeasible';
  competence: string;
  plannedNetIncome: number;
  version: string;
  proposedPercentages: Record<DestinationKey, number>;
  proposedAmountsR$: Record<DestinationKey, number>;
  oldPercentages: Record<DestinationKey, number>;
  oldAmountsR$: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floorsR$: Record<DestinationKey, number>;
  commitmentsR$: Record<DestinationKey, number>;
  totalPercentagesSum: number; // exactly 100.00
  totalProposedR$: number; // exactly equal to plannedNetIncome
  totalRequiredR$: number;
  deficitR$: number; // > 0 if infeasible
  conflicts: RebalanceConflict[];
  explanation: string;
  referencePreset: Record<DestinationKey, number>;
  applyToFutureMonths: boolean;
}

const DEFAULT_REFERENCE_PRESET: Record<DestinationKey, number> = {
  moradia: 22,
  transporte: 10,
  comida: 11,
  lazer: 15,
  protecao: 7,
  profissional: 5,
  investimentos: 30,
};

/**
 * Motor determinístico de redistribuição orçamentária do Juntô.
 * Função pura, sem dependências externas ou chamadas assíncronas.
 */
export function rebalanceBudget(params: RebalanceParams): RebalanceResult {
  const competence = params.competence || new Date().toISOString().slice(0, 7);
  const plannedNetIncome = Number(params.plannedNetIncome) || 0;
  const currentPcts = { ...params.currentPercentages };
  const locks = { ...params.locks };
  const floors = { ...(params.floorsR$ || {}) } as Record<DestinationKey, number>;
  const commitments = { ...(params.commitmentsR$ || {}) } as Record<DestinationKey, number>;
  const priorities = { ...DEFAULT_PRIORITIES, ...(params.priorities || {}) };
  const refPreset = { ...DEFAULT_REFERENCE_PRESET, ...(params.referencePreset || {}) };
  const applyToFutureMonths = !!params.applyToFutureMonths;
  const version = new Date().toISOString();

  // Normalize defaults
  ALL_DESTINATIONS.forEach(dest => {
    if (typeof currentPcts[dest] !== 'number' || isNaN(currentPcts[dest])) {
      currentPcts[dest] = refPreset[dest] || 0;
    }
    if (typeof locks[dest] !== 'boolean') {
      locks[dest] = false;
    }
    if (typeof floors[dest] !== 'number' || isNaN(floors[dest])) {
      floors[dest] = 0;
    }
    if (typeof commitments[dest] !== 'number' || isNaN(commitments[dest])) {
      commitments[dest] = 0;
    }
  });

  const oldAmountsR$: Record<DestinationKey, number> = {} as any;
  ALL_DESTINATIONS.forEach(dest => {
    oldAmountsR$[dest] = Number(((plannedNetIncome * (currentPcts[dest] || 0)) / 100).toFixed(2));
  });

  const conflicts: RebalanceConflict[] = [];

  // Validation
  if (plannedNetIncome <= 0 || isNaN(plannedNetIncome) || !isFinite(plannedNetIncome)) {
    conflicts.push({
      destination: 'moradia',
      type: 'invalid_input',
      message: 'Renda líquida planejada é inválida ou menor que zero.',
      requiredR$: 0,
      allocatedR$: 0,
    });

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: 'A renda líquida informada é inválida. Informe um valor maior que zero para recalcular.',
      deficitR$: 0,
      totalRequiredR$: 0,
    });
  }

  // Check invalid percentage values
  let hasInvalidPct = false;
  ALL_DESTINATIONS.forEach(dest => {
    const val = currentPcts[dest];
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val) || val < 0 || val > 100) {
      hasInvalidPct = true;
      conflicts.push({
        destination: dest,
        type: 'invalid_input',
        message: `Porcentagem de ${DESTINATION_NAMES[dest]} (${val}) fora do intervalo válido (0-100%).`,
        requiredR$: 0,
        allocatedR$: 0,
      });
    }
  });

  if (hasInvalidPct) {
    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: 'Existem valores de porcentagem inválidos no formulário. Corrija para continuar.',
      deficitR$: 0,
      totalRequiredR$: 0,
    });
  }

  const incomeCents = Math.round(plannedNetIncome * 100);

  // Calculate hard minimums (maximum of floor or active commitments)
  const hardMinR$: Record<DestinationKey, number> = {} as any;
  const hardMinBp: Record<DestinationKey, number> = {} as any;

  ALL_DESTINATIONS.forEach(dest => {
    const hMin = Math.max(floors[dest] || 0, commitments[dest] || 0);
    hardMinR$[dest] = Number(hMin.toFixed(2));
    const hMinCents = Math.round(hMin * 100);
    hardMinBp[dest] = Math.ceil((hMinCents / incomeCents) * 10000);
  });

  // Calculate locked allocations
  const lockedBp: Record<DestinationKey, number> = {} as any;
  let sumLockedBp = 0;
  let sumLockedR$ = 0;

  ALL_DESTINATIONS.forEach(dest => {
    if (locks[dest]) {
      const bp = Math.round((currentPcts[dest] || 0) * 100);
      lockedBp[dest] = bp;
      sumLockedBp += bp;

      const destR$ = Number(((bp / 10000) * plannedNetIncome).toFixed(2));
      sumLockedR$ += destR$;

      // Check if locked value is below hard minimum
      if (destR$ + 0.01 < hardMinR$[dest]) {
        conflicts.push({
          destination: dest,
          type: 'lock_below_commitments',
          message: `A trava de ${currentPcts[dest]}% (R$ ${destR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) em ${DESTINATION_NAMES[dest]} está abaixo do mínimo obrigatório de R$ ${hardMinR$[dest].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          requiredR$: hardMinR$[dest],
          allocatedR$: destR$,
        });
      }
    }
  });

  // Check sum of locked percentages > 100%
  if (sumLockedBp > 10000) {
    const sumLockedPct = (sumLockedBp / 100).toFixed(2);
    conflicts.push({
      destination: 'investimentos',
      type: 'sum_locks_exceeds_100',
      message: `As travas selecionadas somam ${sumLockedPct}%, ultrapassando o limite máximo de 100% da renda.`,
      requiredR$: sumLockedR$,
      allocatedR$: plannedNetIncome,
    });

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: `As travas somam ${sumLockedPct}%, excedendo 100% da renda. Destrave ao menos uma categoria para liberar margem.`,
      deficitR$: Math.max(0, sumLockedR$ - plannedNetIncome),
      totalRequiredR$: sumLockedR$,
    });
  }

  // Calculate required amount for unlocked destinations
  let sumUnlockedMinR$ = 0;
  let sumUnlockedMinBp = 0;

  ALL_DESTINATIONS.forEach(dest => {
    if (!locks[dest]) {
      sumUnlockedMinR$ += hardMinR$[dest];
      sumUnlockedMinBp += hardMinBp[dest];
    }
  });

  const totalRequiredR$ = Number((sumLockedR$ + sumUnlockedMinR$).toFixed(2));
  const totalRequiredBp = sumLockedBp + sumUnlockedMinBp;

  // Feasibility Check
  if (totalRequiredR$ > plannedNetIncome + 0.01 || totalRequiredBp > 10000 || conflicts.length > 0) {
    const deficit = Math.max(0, totalRequiredR$ - plannedNetIncome);

    conflicts.push({
      destination: 'moradia',
      type: 'total_required_exceeds_income',
      message: `O total necessário (R$ ${totalRequiredR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede a renda em R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      requiredR$: totalRequiredR$,
      allocatedR$: plannedNetIncome,
    });

    return buildInfeasibleResult({
      competence,
      plannedNetIncome,
      version,
      currentPcts,
      oldAmountsR$,
      locks,
      floors,
      commitments,
      refPreset,
      conflicts,
      applyToFutureMonths,
      explanation: `Plano inviável: os compromissos e travas somam R$ ${totalRequiredR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, gerando um déficit de R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Ajuste uma trava ou revise os compromissos.`,
      deficitR$: deficit,
      totalRequiredR$,
    });
  }

  // REDISTRIBUTION OF UNLOCKED MARGIN (10000 - sumLockedBp)
  const remainingBp = 10000 - sumLockedBp;
  const unlockedDests = ALL_DESTINATIONS.filter(dest => !locks[dest]);

  const proposedBp: Record<DestinationKey, number> = {} as any;

  // Locked destinations keep their locked basis points
  ALL_DESTINATIONS.forEach(dest => {
    if (locks[dest]) {
      proposedBp[dest] = lockedBp[dest];
    }
  });

  if (unlockedDests.length > 0) {
    // Determine relative weights among unlocked destinations from refPreset or currentPcts
    let sumUnlockedWeight = 0;
    unlockedDests.forEach(dest => {
      sumUnlockedWeight += refPreset[dest] > 0 ? refPreset[dest] : (currentPcts[dest] || 1);
    });

    if (sumUnlockedWeight <= 0) sumUnlockedWeight = unlockedDests.length;

    // Largest Remainder Method (Hamilton method for exact quota distribution)
    const flooredBp: Record<DestinationKey, number> = {} as any;
    const remainders: { dest: DestinationKey; remainder: number; priority: PriorityLevel }[] = [];
    let sumFloorsBp = 0;

    unlockedDests.forEach(dest => {
      const weight = refPreset[dest] > 0 ? refPreset[dest] : (currentPcts[dest] || 1);
      const exactBp = (remainingBp * weight) / sumUnlockedWeight;
      const floorVal = Math.floor(exactBp);
      const rem = exactBp - floorVal;

      // Must meet hard minimum
      const finalFloor = Math.max(floorVal, hardMinBp[dest]);
      flooredBp[dest] = finalFloor;
      sumFloorsBp += finalFloor;

      remainders.push({
        dest,
        remainder: rem,
        priority: priorities[dest] || 'P2',
      });
    });

    // Distribute remaining basis points to destinations with largest remainders
    let leftoverBp = remainingBp - sumFloorsBp;

    // Sort by largest remainder descending; tie breaker by priority (P1 before P2 before P3)
    remainders.sort((a, b) => {
      if (Math.abs(b.remainder - a.remainder) > 0.0001) {
        return b.remainder - a.remainder;
      }
      const pMap: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3 };
      return pMap[a.priority] - pMap[b.priority];
    });

    unlockedDests.forEach(dest => {
      proposedBp[dest] = flooredBp[dest];
    });

    let rIdx = 0;
    while (leftoverBp > 0 && remainders.length > 0) {
      const target = remainders[rIdx % remainders.length].dest;
      proposedBp[target] += 1;
      leftoverBp -= 1;
      rIdx++;
    }
  }

  // Convert proposed basis points to percentages and exact R$ amounts
  const proposedPcts: Record<DestinationKey, number> = {} as any;
  const proposedAmountsR$: Record<DestinationKey, number> = {} as any;
  let totalCentsAllocated = 0;

  ALL_DESTINATIONS.forEach(dest => {
    const bp = proposedBp[dest];
    proposedPcts[dest] = Number((bp / 100).toFixed(2));

    const cents = Math.round((incomeCents * bp) / 10000);
    proposedAmountsR$[dest] = Number((cents / 100).toFixed(2));
    totalCentsAllocated += cents;
  });

  // Adjust 1 cent discrepancy if incomeCents !== totalCentsAllocated
  const centDiff = incomeCents - totalCentsAllocated;
  if (centDiff !== 0 && unlockedDests.length > 0) {
    const largestUnlocked = [...unlockedDests].sort(
      (a, b) => proposedAmountsR$[b] - proposedAmountsR$[a]
    )[0];
    proposedAmountsR$[largestUnlocked] = Number(
      (proposedAmountsR$[largestUnlocked] + centDiff / 100).toFixed(2)
    );
  }

  // Build Human Explanation
  const lockedSummary = ALL_DESTINATIONS.filter(d => locks[d])
    .map(d => `${DESTINATION_NAMES[d]} (${proposedPcts[d]}%)`)
    .join(', ');

  let explanation = '';
  if (lockedSummary) {
    explanation = `Mantivemos a trava explícita em: ${lockedSummary}. A margem restante foi redistribuída proporcionalmente entre as demais categorias respeitando seus compromissos e prioridades.`;
  } else {
    explanation = `Sugerimos a redistribuição equilibrada em 100,00% da renda planejada. Todas as categorias estão cobertas conforme suas prioridades.`;
  }

  return {
    status: 'feasible',
    competence,
    plannedNetIncome,
    version,
    proposedPercentages: proposedPcts,
    proposedAmountsR$,
    oldPercentages: currentPcts,
    oldAmountsR$,
    locks,
    floorsR$: floors,
    commitmentsR$: commitments,
    totalPercentagesSum: 100.0,
    totalProposedR$: plannedNetIncome,
    totalRequiredR$,
    deficitR$: 0,
    conflicts: [],
    explanation,
    referencePreset: refPreset,
    applyToFutureMonths,
  };
}

function buildInfeasibleResult(data: {
  competence: string;
  plannedNetIncome: number;
  version: string;
  currentPcts: Record<DestinationKey, number>;
  oldAmountsR$: Record<DestinationKey, number>;
  locks: Record<DestinationKey, boolean>;
  floors: Record<DestinationKey, number>;
  commitments: Record<DestinationKey, number>;
  refPreset: Record<DestinationKey, number>;
  conflicts: RebalanceConflict[];
  applyToFutureMonths: boolean;
  explanation: string;
  deficitR$: number;
  totalRequiredR$: number;
}): RebalanceResult {
  const sumPcts = ALL_DESTINATIONS.reduce((s, d) => s + (data.currentPcts[d] || 0), 0);

  return {
    status: 'infeasible',
    competence: data.competence,
    plannedNetIncome: data.plannedNetIncome,
    version: data.version,
    proposedPercentages: data.currentPcts,
    proposedAmountsR$: data.oldAmountsR$,
    oldPercentages: data.currentPcts,
    oldAmountsR$: data.oldAmountsR$,
    locks: data.locks,
    floorsR$: data.floors,
    commitmentsR$: data.commitments,
    totalPercentagesSum: Number(sumPcts.toFixed(2)),
    totalProposedR$: Number(
      ALL_DESTINATIONS.reduce((s, d) => s + (data.oldAmountsR$[d] || 0), 0).toFixed(2)
    ),
    totalRequiredR$: data.totalRequiredR$,
    deficitR$: data.deficitR$,
    conflicts: data.conflicts,
    explanation: data.explanation,
    referencePreset: data.refPreset,
    applyToFutureMonths: data.applyToFutureMonths,
  };
}
