const categories = ['moradia', 'comida', 'lazer', 'protecao', 'profissional', 'investimentos'] as const;
type Category = typeof categories[number];
type Budget = { diagnosisSummary: string; recommendedPercentages: Record<Category, number>; recommendedFloors: Record<string, number>; recommendedEmergencyMonths: number; isInitialHomePhase: boolean; customPointers: string[] };

export function buildBudgetFallback(income: number, rent: number, initial: boolean): Budget {
  const housing = Math.max(initial ? 32 : 30, income > 0 ? Math.ceil(rent / income * 10_000) / 100 : 0);
  const remainder = Math.max(0, 90 - housing);
  const weight = initial ? 47 : 50;
  const percentages = { moradia: housing, comida: Math.floor(remainder * 12 / weight * 100) / 100, lazer: Math.floor(remainder * (initial ? 10 : 13) / weight * 100) / 100, protecao: Math.floor(remainder * 15 / weight * 100) / 100, profissional: 0, investimentos: 10 };
  percentages.profissional = Math.round((100 - percentages.moradia - percentages.comida - percentages.lazer - percentages.protecao - percentages.investimentos) * 100) / 100;
  return {
    diagnosisSummary: income > 0 ? 'Este é um ponto de partida calculado por regras locais. Revisem os valores conforme os gastos e a fase de cada pessoa.' : 'Sem renda informada, os percentuais são apenas uma referência. Nenhum valor foi tratado como dinheiro disponível.',
    recommendedPercentages: percentages,
    recommendedFloors: { moradia: rent, comida: 0, protecao: 0, profissional: 0, investimentos: 10 },
    recommendedEmergencyMonths: initial ? 8 : 10,
    isInitialHomePhase: initial,
    customPointers: ['Confirmem despesas essenciais antes de assumir novos compromissos.', ...(rent > income * percentages.moradia / 100 ? ['A moradia informada supera a parcela sugerida. Ajustem os percentuais antes de aplicar o plano.'] : []), 'Recebimentos previstos não compõem o saldo disponível.'],
  };
}

export function validBudget(value: unknown, income: number): value is Budget {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<Budget>;
  if (typeof b.diagnosisSummary !== 'string' || b.diagnosisSummary.length > 2000 || typeof b.isInitialHomePhase !== 'boolean' || !Array.isArray(b.customPointers) || b.customPointers.length > 10 || b.customPointers.some(p => typeof p !== 'string' || p.length > 1000)) return false;
  if (!b.recommendedPercentages || !b.recommendedFloors || typeof b.recommendedEmergencyMonths !== 'number' || !Number.isInteger(b.recommendedEmergencyMonths) || b.recommendedEmergencyMonths < 1 || b.recommendedEmergencyMonths > 36) return false;
  const p = b.recommendedPercentages;
  if (categories.some(key => typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < 0 || p[key] > 100)) return false;
  if (Math.abs(categories.reduce((total, key) => total + p[key], 0) - 100) > 0.000001 || p.investimentos < 10) return false;
  const floors = b.recommendedFloors;
  if (['moradia', 'comida', 'protecao', 'profissional'].some(key => typeof floors[key] !== 'number' || !Number.isFinite(floors[key]) || floors[key] < 0 || floors[key] > income * p[key as Category] / 100 + 0.005)) return false;
  return typeof floors.investimentos === 'number' && Number.isFinite(floors.investimentos) && floors.investimentos >= 10 && floors.investimentos <= p.investimentos;
}
