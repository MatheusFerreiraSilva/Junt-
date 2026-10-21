import {
  CategoryKey,
  ExpenseItem,
  SavingsPiggyBank,
  FoodPacingMetrics,
  AIPredictiveInsight,
} from '../types/finance';
import { formatCurrency } from './formatters';

interface GenerateInsightsInput {
  categoriesSpending: Record<CategoryKey, { spent: number; budget: number; remaining: number; percentageUsed: number; isOver: boolean }>;
  foodPacing: FoodPacingMetrics;
  expenses: ExpenseItem[];
  currentMonthKey: string;
  piggyBanks: SavingsPiggyBank[];
  partner1Name: string;
  partner2Name: string;
  appliedInsights?: Record<string, string>;
}

/**
 * Motor de Insights Preditivos, Leitura Empática de Cansaço e Sugestões Contextuais da IA do Junto.
 * Analisa saldos residuais (sobras), ritmo de delivery vs. plantões e propõe ações com 3 opções de 1 toque.
 */
export function generateAIPredictiveInsights({
  categoriesSpending,
  foodPacing,
  expenses,
  currentMonthKey,
  piggyBanks,
  partner1Name,
  partner2Name,
  appliedInsights = {},
}: GenerateInsightsInput): AIPredictiveInsight[] {
  const insights: AIPredictiveInsight[] = [];

  // Encontrar objetivo prioritário ativo para direcionamento padrão (ex: Viagem, Casa, etc.)
  const safePiggyBanks = Array.isArray(piggyBanks) ? piggyBanks : [];
  const activeGoals = safePiggyBanks.filter(g => !g.completed);
  const preferredGoal =
    activeGoals.find(g => g.name.toLowerCase().includes('viagem')) ||
    activeGoals.find(g => g.name.toLowerCase().includes('casa') || g.name.toLowerCase().includes('mobília')) ||
    activeGoals[0] ||
    null;

  const goalNameDisplay = preferredGoal ? preferredGoal.name : 'Cofrinho de Objetivos';
  const goalIdDisplay = preferredGoal ? preferredGoal.id : undefined;

  // =========================================================================
  // 1. LEITURA EMPÁTICA DE PADRÕES DE CANSAÇO & DELIVERY EM SEMANA DE PLANTÃO
  // =========================================================================
  // Avalia se os pedidos de delivery aumentaram significativamente nos últimos 7 dias
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentExpenses = expenses.filter(
    e => e.date.startsWith(currentMonthKey) && new Date(e.date) >= sevenDaysAgo
  );

  const recentDeliverySpent = recentExpenses
    .filter(e => {
      if (e.category !== 'comida') return false;
      const d = (e.description || '').toUpperCase();
      return (
        e.foodPillar === 'conveniencia' ||
        d.includes('IFOOD') ||
        d.includes('RAPPI') ||
        d.includes('DELIVERY') ||
        d.includes('ZE DELIVERY')
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // Se o delivery recente ultrapassou 35% do gasto total de comida ou R$ 380 em 7 dias
  const fatigueDetected =
    recentDeliverySpent >= Math.max(300, foodPacing.totalFoodBudget * 0.15) &&
    foodPacing.convenienceSpent >= foodPacing.routineSpent;

  const fatigueInsightId = `fatigue-${currentMonthKey}-${now.getDate() <= 15 ? 'quinzena1' : 'quinzena2'}`;

  if (fatigueDetected && !appliedInsights[fatigueInsightId]) {
    insights.push({
      id: fatigueInsightId,
      type: 'fatigue_pattern',
      category: 'comida_delivery',
      emoji: '🩺',
      badgeText: 'Acolhimento da Rotina Médica',
      title: 'Semana de Plantões Puxada? A gente acolhe com carinho!',
      message: `Notamos que vocês pediram mais delivery nos últimos dias (${formatCurrency(recentDeliverySpent)}). Sabemos como a rotina de hospital e plantões é exaustiva e esse suporte faz parte da paz de vocês! Para a próxima ida ao mercado, que tal incluirmos opções de refeições práticas congeladas ou petiscos prontos para quando chegarem cansados?`,
      options: {
        useReward: {
          label: '✨ Ajustar Pacing de Delivery',
          description: 'Acomodar mais flexibilidade em delivery nesta semana sem neura.',
          appliedAmount: Math.round(recentDeliverySpent * 0.3),
          targetCategory: 'comida',
        },
        sendToGoal: {
          label: `🎯 Proteger meta no ${goalNameDisplay}`,
          description: 'Direcionar R$ 100 de economia das compras de mercado para a meta.',
          amount: 100,
          defaultGoalId: goalIdDisplay,
          defaultGoalName: goalNameDisplay,
        },
        keepBuffer: {
          label: '🛡️ Manter amortecedor na conta',
          description: 'Manter a reserva na conta para suporte à rotina intensa.',
          amount: recentDeliverySpent,
        },
      },
      createdAt: now.toISOString(),
      status: 'active',
    });
  }

  // =========================================================================
  // 2. PROPOSIÇÃO ATIVA DE RECOMPENSAS EM COMIDA & LAZER (CELEBRAÇÃO DE SOBRA)
  // =========================================================================
  // Verifica se o casal manteve a rotina equilibrada e tem sobra no pacing semanal de comida
  const curWeek = foodPacing.weeks.find(w => w.isCurrentWeek);
  const weekSurplus = curWeek ? curWeek.remaining : 0;
  const foodTotalSurplus = categoriesSpending.comida.remaining;

  // Sobra expressiva na semana (>= R$ 120) ou sobra no mês
  if (weekSurplus >= 120 || foodTotalSurplus >= 200) {
    const surplusValue = Math.round(weekSurplus >= 120 ? weekSurplus : foodTotalSurplus * 0.5);
    const rewardInsightId = `reward-food-${currentMonthKey}-w${foodPacing.currentWeekNumber}`;

    if (!appliedInsights[rewardInsightId]) {
      insights.push({
        id: rewardInsightId,
        type: 'reward_proposal',
        category: 'comida_delivery',
        emoji: '🍷',
        badgeText: 'Vitória do Casal!',
        title: `Vocês economizaram ${formatCurrency(surplusValue)} em Comida & Conveniência!`,
        message: `Que sincronia linda, ${partner1Name} & ${partner2Name}! Vocês gerenciaram o pacing semanal com muita maestria e sobrou ${formatCurrency(surplusValue)}. Que tal usarem esse valor para um jantar romântico especial no fim de semana ou preferem acelerar o ${goalNameDisplay}?`,
        surplusAmount: surplusValue,
        sourceCategory: 'comida',
        options: {
          useReward: {
            label: '✨ Gostei, vamos jantar fora!',
            description: `Aumenta o limite de Lazer em ${formatCurrency(surplusValue)} para um momento a dois.`,
            appliedAmount: surplusValue,
            targetCategory: 'lazer',
          },
          sendToGoal: {
            label: `🎯 Mandar para o ${goalNameDisplay}`,
            description: `Transfere os ${formatCurrency(surplusValue)} direto para realizar o sonho de vocês.`,
            amount: surplusValue,
            defaultGoalId: goalIdDisplay,
            defaultGoalName: goalNameDisplay,
          },
          keepBuffer: {
            label: '🛡️ Manter guardado na conta',
            description: 'Deixa o saldo na conta corrente como amortecedor de caixa para o mês.',
            amount: surplusValue,
          },
        },
        createdAt: now.toISOString(),
        status: 'active',
      });
    }
  }

  // Sobra na categoria Lazer
  const lazerSurplus = categoriesSpending.lazer.remaining;
  if (lazerSurplus >= 250) {
    const lazerInsightId = `reward-lazer-${currentMonthKey}`;
    const roundedLazer = Math.round(lazerSurplus * 0.6);

    if (!appliedInsights[lazerInsightId]) {
      insights.push({
        id: lazerInsightId,
        type: 'reward_proposal',
        category: 'lazer',
        emoji: '✈️',
        badgeText: 'Sobra em Lazer & Passeios',
        title: `Sobra de ${formatCurrency(roundedLazer)} em Lazer este mês!`,
        message: `Vocês foram super conscientes nos passeios! Esse saldo positivo é mérito do casal. Desejam celebrar com uma experiência gastronômica ou turbinar o ${goalNameDisplay}?`,
        surplusAmount: roundedLazer,
        sourceCategory: 'lazer',
        options: {
          useReward: {
            label: '✨ Gostei, vamos comemorar!',
            description: `Aproveitar ${formatCurrency(roundedLazer)} para um passeio especial sem culpa.`,
            appliedAmount: roundedLazer,
            targetCategory: 'lazer',
          },
          sendToGoal: {
            label: `🎯 Mandar para o ${goalNameDisplay}`,
            description: `Acelerar o ${goalNameDisplay} com ${formatCurrency(roundedLazer)}.`,
            amount: roundedLazer,
            defaultGoalId: goalIdDisplay,
            defaultGoalName: goalNameDisplay,
          },
          keepBuffer: {
            label: '🛡️ Manter guardado na conta',
            description: 'Preservar o valor na conta como colchão de tranquilidade.',
            amount: roundedLazer,
          },
        },
        createdAt: now.toISOString(),
        status: 'active',
      });
    }
  }

  // =========================================================================
  // 3. PROPOSIÇÃO DE EFICIÊNCIA EM OUTRAS CATEGORIAS (MORADIA, TRANSPORTE, PROFISSIONAL)
  // =========================================================================
  const moradiaSurplus = categoriesSpending.moradia.remaining;
  const transporteSurplus = categoriesSpending.transporte.remaining;
  const profissionalSurplus = categoriesSpending.profissional.remaining;

  // Sobra em Moradia (contas fixas negociadas)
  if (moradiaSurplus >= 300) {
    const moradiaInsightId = `eff-moradia-${currentMonthKey}`;
    if (!appliedInsights[moradiaInsightId]) {
      insights.push({
        id: moradiaInsightId,
        type: 'efficiency_proposal',
        category: 'moradia',
        emoji: '🛋️',
        badgeText: 'Eficiência da Casa',
        title: `Moradia com sobra de ${formatCurrency(moradiaSurplus)}!`,
        message: `As contas da casa ficaram abaixo do teto previsto. Que tal aproveitarmos essa economia estrutural para mobília da casa nova, reforçar os cofrinhos ou antecipar parcelas de tecnologia com desconto?`,
        surplusAmount: moradiaSurplus,
        sourceCategory: 'moradia',
        options: {
          useReward: {
            label: '✨ Mobília ou Conforto da Casa',
            description: `Usar ${formatCurrency(moradiaSurplus)} para melhorias no cantinho de vocês.`,
            appliedAmount: moradiaSurplus,
            targetCategory: 'moradia',
          },
          sendToGoal: {
            label: `🎯 Guardar no ${goalNameDisplay}`,
            description: `Direcionar ${formatCurrency(moradiaSurplus)} para as conquistas do casal.`,
            amount: moradiaSurplus,
            defaultGoalId: goalIdDisplay,
            defaultGoalName: goalNameDisplay,
          },
          keepBuffer: {
            label: '🛡️ Manter amortecedor na conta',
            description: 'Deixar na conta para imprevistos domésticos ou manutenção.',
            amount: moradiaSurplus,
          },
        },
        createdAt: now.toISOString(),
        status: 'active',
      });
    }
  }

  // Sobra em Transporte ou Profissional
  if (transporteSurplus >= 200 || profissionalSurplus >= 250) {
    const sourceCat: CategoryKey = transporteSurplus >= profissionalSurplus ? 'transporte' : 'profissional';
    const amountVal = Math.round(sourceCat === 'transporte' ? transporteSurplus : profissionalSurplus);
    const catName = sourceCat === 'transporte' ? 'Transporte & Mobilidade' : 'Desenvolvimento Profissional';
    const effOtherId = `eff-${sourceCat}-${currentMonthKey}`;

    if (!appliedInsights[effOtherId]) {
      insights.push({
        id: effOtherId,
        type: 'efficiency_proposal',
        category: sourceCat,
        emoji: sourceCat === 'transporte' ? '🚗' : '📚',
        badgeText: `Economia em ${catName}`,
        title: `Sobrou ${formatCurrency(amountVal)} em ${catName}!`,
        message: `Vocês economizaram em ${catName} neste ciclo. Podemos redirecionar esse saldo para acelerar objetivos ou abater parcelas futuras com desconto garantido.`,
        surplusAmount: amountVal,
        sourceCategory: sourceCat,
        options: {
          useReward: {
            label: '✨ Direcionar para Lazer / Recompensa',
            description: `Ajustar o limite de momentos especiais do casal com ${formatCurrency(amountVal)}.`,
            appliedAmount: amountVal,
            targetCategory: 'lazer',
          },
          sendToGoal: {
            label: `🎯 Aportar no ${goalNameDisplay}`,
            description: `Adicionar ${formatCurrency(amountVal)} ao cofrinho prioritário.`,
            amount: amountVal,
            defaultGoalId: goalIdDisplay,
            defaultGoalName: goalNameDisplay,
          },
          keepBuffer: {
            label: '🛡️ Manter guardado na conta',
            description: 'Manter o dinheiro líquido na conta corrente para segurança.',
            amount: amountVal,
          },
        },
        createdAt: now.toISOString(),
        status: 'active',
      });
    }
  }

  return insights;
}
