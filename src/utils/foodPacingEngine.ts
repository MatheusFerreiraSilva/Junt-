import { ExpenseItem, FoodPacingMetrics, FoodPillarType, FoodPillarSummary, FoodWeeklyPacingBlock } from '../types/finance';

/**
 * Classifica um gasto da categoria comida dentro dos 3 pilares funcionais:
 * 1. Estrutural (Abastecimento da casa: grandes compras de mercado, feira livre, açougue, hortifruti, produtos de limpeza)
 * 2. Rotina (Almoços dia a dia por quilo, refeições entre plantões, lanches de hospital, cafeterias, padarias)
 * 3. Conveniência (iFood, Rappi, Zé Delivery, refeições prontas e lojas de conveniência)
 */
export function classifyFoodPillar(
  expenseOrDesc: ExpenseItem | { description?: string; subcategory?: string; foodPillar?: FoodPillarType } | string
): FoodPillarType {
  if (typeof expenseOrDesc === 'string') {
    const desc = expenseOrDesc.toUpperCase();
    if (
      desc.includes('IFOOD') ||
      desc.includes('RAPPI') ||
      desc.includes('ZE DELIVERY') ||
      desc.includes('ZÉ DELIVERY') ||
      desc.includes('DELIVERY') ||
      desc.includes('CONVENIENCIA') ||
      desc.includes('CONVENIÊNCIA') ||
      desc.includes('BURGER') ||
      desc.includes('PIZZA') ||
      desc.includes('SUSHI') ||
      desc.includes('MCDONALD') ||
      desc.includes('HABIB')
    ) {
      return 'conveniencia';
    }
    if (
      desc.includes('ATACADAO') ||
      desc.includes('ATACADÃO') ||
      desc.includes('ASSAI') ||
      desc.includes('ASSAÍ') ||
      desc.includes('SAM\'S') ||
      desc.includes('SAMS CLUB') ||
      desc.includes('SUPERMERCADO') ||
      desc.includes('MERCADO') ||
      desc.includes('PAO DE ACUCAR') ||
      desc.includes('PÃO DE AÇÚCAR') ||
      desc.includes('CARREFOUR') ||
      desc.includes('EXTRA') ||
      desc.includes('HORTIFRUTI') ||
      desc.includes('FEIRA') ||
      desc.includes('ACOUQUE') ||
      desc.includes('AÇOUGUE') ||
      desc.includes('LIMPEZA') ||
      desc.includes('HIGIENE')
    ) {
      return 'estrutural';
    }
    return 'rotina';
  }

  if (expenseOrDesc.foodPillar) {
    return expenseOrDesc.foodPillar;
  }

  const desc = (expenseOrDesc.description || '').toUpperCase();
  const subcat = (expenseOrDesc.subcategory || '').toUpperCase();

  // 1. Conveniência e Delivery
  if (
    desc.includes('IFOOD') ||
    desc.includes('RAPPI') ||
    desc.includes('ZE DELIVERY') ||
    desc.includes('ZÉ DELIVERY') ||
    desc.includes('DELIVERY') ||
    desc.includes('CONVENIENCIA') ||
    desc.includes('CONVENIÊNCIA') ||
    desc.includes('BURGER') ||
    desc.includes('PIZZA') ||
    desc.includes('SUSHI') ||
    desc.includes('MCDONALD') ||
    desc.includes('HABIB') ||
    subcat.includes('DELIVERY') ||
    subcat.includes('FAST-FOOD')
  ) {
    return 'conveniencia';
  }

  // 2. Compras Estruturais (Abastecimento da Casa)
  if (
    desc.includes('ATACADAO') ||
    desc.includes('ATACADÃO') ||
    desc.includes('ASSAI') ||
    desc.includes('ASSAÍ') ||
    desc.includes('SAM\'S') ||
    desc.includes('SAMS CLUB') ||
    desc.includes('SUPERMERCADO') ||
    desc.includes('MERCADO') ||
    desc.includes('PAO DE ACUCAR') ||
    desc.includes('PÃO DE AÇÚCAR') ||
    desc.includes('CARREFOUR') ||
    desc.includes('EXTRA') ||
    desc.includes('HORTIFRUTI') ||
    desc.includes('FEIRA') ||
    desc.includes('ACOUQUE') ||
    desc.includes('AÇOUGUE') ||
    desc.includes('LIMPEZA') ||
    desc.includes('HIGIENE') ||
    subcat.includes('SUPERMERCADO') ||
    subcat.includes('HORTIFRUTI') ||
    subcat.includes('ACOUQUE') ||
    subcat.includes('LIMPEZA')
  ) {
    return 'estrutural';
  }

  // 3. Alimentação de Rotina e Trabalho
  return 'rotina';
}

/**
 * Calcula todas as métricas de Inteligência de Abastecimento e Pacing Semanal da categoria Comida
 */
export function calculateFoodPacingMetrics(
  expenses: ExpenseItem[],
  currentMonthKey: string, // YYYY-MM
  totalFoodBudget: number
): FoodPacingMetrics {
  const currentMonthExpenses = expenses.filter(
    e => e.category === 'comida' && e.date.startsWith(currentMonthKey)
  );

  let structuralSpent = 0;
  let routineSpent = 0;
  let convenienceSpent = 0;

  let structuralCount = 0;
  let routineCount = 0;
  let convenienceCount = 0;

  // Breakdown across 4 weekly blocks:
  // Week 1: days 1..7
  // Week 2: days 8..14
  // Week 3: days 15..21
  // Week 4: days 22..end
  const weeklyOperationalSpent = [0, 0, 0, 0];

  currentMonthExpenses.forEach(exp => {
    const pillar = classifyFoodPillar(exp);
    const day = parseInt(exp.date.split('-')[2] || '1', 10);

    if (pillar === 'estrutural') {
      structuralSpent += exp.amount;
      structuralCount += 1;
    } else {
      // Gastos operacionais de conveniência e rotina entram no pacing semanal
      let wIdx = 0;
      if (day <= 7) wIdx = 0;
      else if (day <= 14) wIdx = 1;
      else if (day <= 21) wIdx = 2;
      else wIdx = 3;

      weeklyOperationalSpent[wIdx] += exp.amount;

      if (pillar === 'rotina') {
        routineSpent += exp.amount;
        routineCount += 1;
      } else {
        convenienceSpent += exp.amount;
        convenienceCount += 1;
      }
    }
  });

  const totalFoodSpent = structuralSpent + routineSpent + convenienceSpent;

  // Reconhecimento do Abastecimento Inicial:
  // Se o gasto estrutural for significativo (ex: >= 20% do orçamento de comida ou >= R$ 400),
  // a IA reconhece como compra estrutural do mês e isola o cálculo para as semanas seguintes
  const hasInitialStockup =
    structuralSpent >= Math.max(300, totalFoodBudget * 0.20) || structuralCount >= 1;

  // Saldo operacional líquido: o que sobra para delivery, lanches de plantão e pequenas reposições
  const operationalBudgetRemaining = Math.max(0, totalFoodBudget - structuralSpent);
  const weeklyQuota = Math.round((operationalBudgetRemaining / 4) * 10) / 10;

  // Determinar semana atual baseada na data de hoje
  const now = new Date();
  const currentDay = now.getDate();
  let currentWeekNumber: 1 | 2 | 3 | 4 = 1;
  if (currentDay <= 7) currentWeekNumber = 1;
  else if (currentDay <= 14) currentWeekNumber = 2;
  else if (currentDay <= 21) currentWeekNumber = 3;
  else currentWeekNumber = 4;

  const weekRanges: { week: 1 | 2 | 3 | 4; label: string; range: string; maxDay: number }[] = [
    { week: 1, label: 'Semana 1', range: 'Dias 1 a 7', maxDay: 7 },
    { week: 2, label: 'Semana 2', range: 'Dias 8 a 14', maxDay: 14 },
    { week: 3, label: 'Semana 3', range: 'Dias 15 a 21', maxDay: 21 },
    { week: 4, label: 'Semana 4', range: 'Dia 22 até o fim', maxDay: 31 },
  ];

  const weeks: FoodWeeklyPacingBlock[] = weekRanges.map((wr, idx) => {
    const spent = weeklyOperationalSpent[idx];
    const remaining = Math.round((weeklyQuota - spent) * 10) / 10;
    const isCurrentWeek = wr.week === currentWeekNumber;

    let status: 'safe' | 'warning' | 'over' | 'future' = 'safe';
    if (wr.week > currentWeekNumber) {
      status = 'future';
    } else if (remaining < 0) {
      status = 'over';
    } else if (weeklyQuota > 0 && spent >= weeklyQuota * 0.85) {
      status = 'warning';
    } else {
      status = 'safe';
    }

    return {
      weekNumber: wr.week,
      label: `${wr.label} (${wr.range})`,
      dayRange: wr.range,
      allocatedBudget: weeklyQuota,
      spent,
      remaining,
      status,
      isCurrentWeek,
    };
  });

  const curWeek = weeks.find(w => w.weekNumber === currentWeekNumber);
  const currentWeekRemaining = curWeek ? curWeek.remaining : 0;

  // Dias restantes na semana corrente para pacing diário
  let daysRemainingInWeek = 1;
  if (currentWeekNumber === 1) daysRemainingInWeek = Math.max(1, 8 - currentDay);
  else if (currentWeekNumber === 2) daysRemainingInWeek = Math.max(1, 15 - currentDay);
  else if (currentWeekNumber === 3) daysRemainingInWeek = Math.max(1, 22 - currentDay);
  else daysRemainingInWeek = Math.max(1, 31 - currentDay);

  const dailySafePacing =
    currentWeekRemaining > 0 ? Math.round((currentWeekRemaining / daysRemainingInWeek) * 10) / 10 : 0;

  const totalSpentSafe = Math.max(1, totalFoodSpent);

  const pillars: Record<FoodPillarType, FoodPillarSummary> = {
    estrutural: {
      pillar: 'estrutural',
      title: 'Compras Estruturais (Casa)',
      emoji: '🛒',
      description: 'Supermercado, atacadão, feira livre, açougue, hortifruti, limpeza e higiene do lar',
      spent: structuralSpent,
      percentageOfFoodSpent: Math.round((structuralSpent / totalSpentSafe) * 100),
      itemCount: structuralCount,
    },
    rotina: {
      pillar: 'rotina',
      title: 'Alimentação de Rotina & Trabalho',
      emoji: '🍲',
      description: 'Almoços por quilo do dia a dia, plantões médicos, lanches de hospital e padarias',
      spent: routineSpent,
      percentageOfFoodSpent: Math.round((routineSpent / totalSpentSafe) * 100),
      itemCount: routineCount,
    },
    conveniencia: {
      pillar: 'conveniencia',
      title: 'Conveniência & Delivery',
      emoji: '🛵',
      description: 'Pedidos por aplicativo (iFood, Rappi, Zé Delivery), refeições prontas e conveniência',
      spent: convenienceSpent,
      percentageOfFoodSpent: Math.round((convenienceSpent / totalSpentSafe) * 100),
      itemCount: convenienceCount,
    },
  };

  return {
    totalFoodBudget,
    totalFoodSpent,
    structuralSpent,
    routineSpent,
    convenienceSpent,
    operationalBudgetRemaining,
    weeklyQuota,
    weeks,
    currentWeekNumber,
    currentWeekRemaining,
    dailySafePacing,
    hasInitialStockup,
    pillars,
  };
}
