const categories = ['moradia', 'comida', 'lazer', 'protecao', 'profissional', 'investimentos'] as const;
type Category = typeof categories[number];
type Budget = { diagnosisSummary: string; recommendedPercentages: Record<Category, number>; recommendedFloors: Record<string, number>; recommendedEmergencyMonths: number; isInitialHomePhase: boolean; customPointers: string[] };

export function buildBudgetFallback(income: number, rent: number, initial: boolean): Budget {
  const safeIncome = Math.max(0, income);
  const housing = Math.max(initial ? 32 : 30, safeIncome > 0 ? Math.ceil((rent / safeIncome) * 10000) / 100 : 0);
  const cappedHousing = Math.min(60, housing);
  const investments = 10;
  const remainingForOthers = Math.max(0, 100 - cappedHousing - investments);

  const comida = Math.round((remainingForOthers * 0.35) * 100) / 100;
  const lazer = Math.round((remainingForOthers * (initial ? 0.20 : 0.25)) * 100) / 100;
  const protecao = Math.round((remainingForOthers * 0.25) * 100) / 100;
  const profissional = Math.max(0, Math.round((100 - cappedHousing - comida - lazer - protecao - investments) * 100) / 100);

  const percentages: Record<Category, number> = {
    moradia: cappedHousing,
    comida,
    lazer,
    protecao,
    profissional,
    investimentos: investments,
  };

  return {
    diagnosisSummary: safeIncome > 0 ? 'Este é um ponto de partida calculado por regras locais. Revisem os valores conforme os gastos e a fase de cada pessoa.' : 'Sem renda informada, os percentuais são apenas uma referência. Nenhum valor foi tratado como dinheiro disponível.',
    recommendedPercentages: percentages,
    recommendedFloors: { moradia: rent, comida: 0, protecao: 0, profissional: 0, investimentos: 10 },
    recommendedEmergencyMonths: initial ? 8 : 10,
    isInitialHomePhase: initial,
    customPointers: ['Confirmem despesas essenciais antes de assumir novos compromissos.', ...(rent > safeIncome * percentages.moradia / 100 ? ['A moradia informada supera a parcela sugerida. Ajustem os percentuais antes de aplicar o plano.'] : []), 'Recebimentos previstos não compõem o saldo disponível.'],
  };
}

export function validBudget(value: unknown, income: number): value is Budget {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<Budget>;
  if (typeof b.diagnosisSummary !== 'string' || b.diagnosisSummary.length > 2000 || typeof b.isInitialHomePhase !== 'boolean' || !Array.isArray(b.customPointers) || b.customPointers.length > 10 || b.customPointers.some(p => typeof p !== 'string' || p.length > 1000)) return false;
  if (!b.recommendedPercentages || !b.recommendedFloors || typeof b.recommendedEmergencyMonths !== 'number' || !Number.isInteger(b.recommendedEmergencyMonths) || b.recommendedEmergencyMonths < 1 || b.recommendedEmergencyMonths > 36) return false;
  const p = b.recommendedPercentages;
  if (categories.some(key => typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < 0 || p[key] > 100)) return false;
  if (Math.abs(categories.reduce((total, key) => total + p[key], 0) - 100) > 0.0001 || p.investimentos < 10) return false;
  const floors = b.recommendedFloors;
  if (['moradia', 'comida', 'protecao', 'profissional'].some(key => typeof floors[key] !== 'number' || !Number.isFinite(floors[key]) || floors[key] < 0 || floors[key] > income * p[key as Category] / 100 + 0.005)) return false;
  return typeof floors.investimentos === 'number' && Number.isFinite(floors.investimentos) && floors.investimentos >= 10 && floors.investimentos <= p.investimentos;
}
