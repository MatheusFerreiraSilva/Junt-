import { CategoryKey, CategoryKeywordRule, DetectedSubscription, ExpenseItem } from '../types/finance';

export const DEFAULT_KEYWORD_RULES: CategoryKeywordRule[] = [
  // Transporte & Mobilidade (Nova Categoria Oficial)
  { id: 'kw-1', keyword: 'UBER', category: 'transporte', subcategory: 'app de transporte' },
  { id: 'kw-2', keyword: '99', category: 'transporte', subcategory: 'app de transporte' },
  { id: 'kw-t1', keyword: 'POSTO', category: 'transporte', subcategory: 'combustivel' },
  { id: 'kw-t2', keyword: 'GASOLINA', category: 'transporte', subcategory: 'combustivel' },
  { id: 'kw-t3', keyword: 'IPVA', category: 'transporte', subcategory: 'impostos veiculares' },
  { id: 'kw-t4', keyword: 'LICENCIAMENTO', category: 'transporte', subcategory: 'impostos veiculares' },
  { id: 'kw-t5', keyword: 'SEM PARAR', category: 'transporte', subcategory: 'pedagio & tag' },
  { id: 'kw-t6', keyword: 'VELOE', category: 'transporte', subcategory: 'pedagio & tag' },
  { id: 'kw-t7', keyword: 'CONECTCAR', category: 'transporte', subcategory: 'pedagio & tag' },
  { id: 'kw-t8', keyword: 'ESTACIONAMENTO', category: 'transporte', subcategory: 'estacionamento' },
  { id: 'kw-t9', keyword: 'OFICINA', category: 'transporte', subcategory: 'manutencao auto' },
  { id: 'kw-t10', keyword: 'MECANICA', category: 'transporte', subcategory: 'manutencao auto' },
  { id: 'kw-t11', keyword: 'PNEU', category: 'transporte', subcategory: 'manutencao auto' },

  // Lazer & Assinaturas
  { id: 'kw-3', keyword: 'NETFLIX', category: 'lazer', subcategory: 'streaming' },
  { id: 'kw-4', keyword: 'SPOTIFY', category: 'lazer', subcategory: 'musica' },
  { id: 'kw-5', keyword: 'DISNEY', category: 'lazer', subcategory: 'streaming' },
  { id: 'kw-6', keyword: 'AMAZON PRIME', category: 'lazer', subcategory: 'assinatura' },
  { id: 'kw-7', keyword: 'HBO', category: 'lazer', subcategory: 'streaming' },
  { id: 'kw-8', keyword: 'CINEMA', category: 'lazer', subcategory: 'entretenimento' },
  { id: 'kw-9', keyword: 'INGRESSO', category: 'lazer', subcategory: 'entretenimento' },
  { id: 'kw-10', keyword: 'AIRBNB', category: 'lazer', subcategory: 'viagem' },
  { id: 'kw-11', keyword: 'AZUL', category: 'lazer', subcategory: 'passagens' },
  { id: 'kw-12', keyword: 'LATAM', category: 'lazer', subcategory: 'passagens' },
  { id: 'kw-13', keyword: 'GOL', category: 'lazer', subcategory: 'passagens' },

  // Comida & Alimentação
  { id: 'kw-14', keyword: 'IFOOD', category: 'comida', subcategory: 'delivery' },
  { id: 'kw-15', keyword: 'RESTAURANTE', category: 'comida', subcategory: 'restaurante' },
  { id: 'kw-16', keyword: 'LANCHONETE', category: 'comida', subcategory: 'lanche' },
  { id: 'kw-17', keyword: 'PADARIA', category: 'comida', subcategory: 'padaria' },
  { id: 'kw-18', keyword: 'SUPERMERCADO', category: 'comida', subcategory: 'supermercado' },
  { id: 'kw-19', keyword: 'PAO DE ACUCAR', category: 'comida', subcategory: 'supermercado' },
  { id: 'kw-20', keyword: 'CARREFOUR', category: 'comida', subcategory: 'supermercado' },
  { id: 'kw-21', keyword: 'MERCADO', category: 'comida', subcategory: 'supermercado' },
  { id: 'kw-22', keyword: 'FEIRA', category: 'comida', subcategory: 'hortifruti' },
  { id: 'kw-23', keyword: 'STARBUCKS', category: 'comida', subcategory: 'cafeteria' },
  { id: 'kw-24', keyword: 'MCDONALD', category: 'comida', subcategory: 'fast-food' },

  // Moradia & Contas Fixas
  { id: 'kw-25', keyword: 'ALUGUEL', category: 'moradia', subcategory: 'aluguel' },
  { id: 'kw-26', keyword: 'CONDOMINIO', category: 'moradia', subcategory: 'condominio' },
  { id: 'kw-27', keyword: 'ENEL', category: 'moradia', subcategory: 'energia' },
  { id: 'kw-28', keyword: 'LUZ', category: 'moradia', subcategory: 'energia' },
  { id: 'kw-29', keyword: 'SABESP', category: 'moradia', subcategory: 'agua' },
  { id: 'kw-30', keyword: 'CLARO', category: 'moradia', subcategory: 'internet' },
  { id: 'kw-31', keyword: 'VIVO', category: 'moradia', subcategory: 'internet' },
  { id: 'kw-32', keyword: 'LEROY', category: 'moradia', subcategory: 'manutencao' },
  { id: 'kw-33', keyword: 'TOK&STOK', category: 'moradia', subcategory: 'moveis' },

  // Proteção & Saúde
  { id: 'kw-34', keyword: 'DROGASIL', category: 'protecao', subcategory: 'farmacia' },
  { id: 'kw-35', keyword: 'DROGA RAIA', category: 'protecao', subcategory: 'farmacia' },
  { id: 'kw-36', keyword: 'FARMACIA', category: 'protecao', subcategory: 'medicamentos' },
  { id: 'kw-37', keyword: 'UNIMED', category: 'protecao', subcategory: 'plano de saude' },
  { id: 'kw-38', keyword: 'BRADESCO SAUDE', category: 'protecao', subcategory: 'plano de saude' },
  { id: 'kw-39', keyword: 'SULAMERICA', category: 'protecao', subcategory: 'seguro' },
  { id: 'kw-40', keyword: 'PORTO SEGURO', category: 'protecao', subcategory: 'seguro' },
  { id: 'kw-41', keyword: 'CONSULTA', category: 'protecao', subcategory: 'medico' },
  { id: 'kw-42', keyword: 'LABORATORIO', category: 'protecao', subcategory: 'exames' },

  // Profissional & Formação
  { id: 'kw-43', keyword: 'CRM', category: 'profissional', subcategory: 'anuidade' },
  { id: 'kw-44', keyword: 'CONGRESSO', category: 'profissional', subcategory: 'evento' },
  { id: 'kw-45', keyword: 'CURSO', category: 'profissional', subcategory: 'educacao' },
  { id: 'kw-46', keyword: 'UPTODATE', category: 'profissional', subcategory: 'software medico' },
  { id: 'kw-47', keyword: 'MEDGRUPO', category: 'profissional', subcategory: 'estudo' },
  { id: 'kw-48', keyword: 'LIVRARIA', category: 'profissional', subcategory: 'livros' },
  { id: 'kw-49', keyword: 'EQUIPAMENTO', category: 'profissional', subcategory: 'instrumental' },
];

/**
 * Automatically infers category and subcategory from description using custom rules
 */
export function categorizeTransaction(
  description: string,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): { category: CategoryKey; subcategory?: string; matchedKeyword?: string } {
  const normalized = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const rule of customRules) {
    const normKeyword = rule.keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normKeyword)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        matchedKeyword: rule.keyword,
      };
    }
  }

  // Default fallback
  return {
    category: 'lazer',
    subcategory: 'outros',
  };
}

/**
 * Subscription Detection Algorithm
 * Detects recurring monthly transactions with equal amounts
 */
export function detectRecurringSubscriptions(
  expenses: ExpenseItem[]
): DetectedSubscription[] {
  const merchantMap: Record<string, { amounts: number[]; dates: string[]; category: CategoryKey }> = {};

  expenses.forEach(exp => {
    const cleanMerchant = exp.description.trim().toUpperCase();
    if (!merchantMap[cleanMerchant]) {
      merchantMap[cleanMerchant] = { amounts: [], dates: [], category: exp.category };
    }
    merchantMap[cleanMerchant].amounts.push(exp.amount);
    merchantMap[cleanMerchant].dates.push(exp.date);
  });

  const detected: DetectedSubscription[] = [];

  Object.entries(merchantMap).forEach(([merchant, data]) => {
    // If merchant appears at least 2 times with identical amount
    if (data.amounts.length >= 2) {
      const firstAmount = data.amounts[0];
      const allSame = data.amounts.every(a => Math.abs(a - firstAmount) < 0.05);
      if (allSame && firstAmount > 0) {
        detected.push({
          id: `sub-${merchant.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          merchant,
          amount: firstAmount,
          category: data.category,
          frequency: 'mensal',
          lastDate: data.dates.sort().reverse()[0],
          status: 'detected_pending',
        });
      }
    }
  });

  return detected;
}
