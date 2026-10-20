import { CategoryKey, CategoryKeywordRule, ExpenseItem, DetectedSubscription } from '../types/finance';

export const DEFAULT_KEYWORD_RULES: CategoryKeywordRule[] = [
  // Moradia & Transporte & Fixos
  { id: 'rule-uber', keyword: 'UBER', category: 'moradia', subcategory: 'transporte' },
  { id: 'rule-99', keyword: '99', category: 'moradia', subcategory: 'transporte' },
  { id: 'rule-enel', keyword: 'ENEL', category: 'moradia', subcategory: 'energia' },
  { id: 'rule-luz', keyword: 'LUZ', category: 'moradia', subcategory: 'energia' },
  { id: 'rule-condo', keyword: 'CONDOMINIO', category: 'moradia', subcategory: 'condominio' },
  { id: 'rule-aluguel', keyword: 'ALUGUEL', category: 'moradia', subcategory: 'aluguel' },
  { id: 'rule-claro', keyword: 'CLARO', category: 'moradia', subcategory: 'internet' },
  { id: 'rule-vivo', keyword: 'VIVO', category: 'moradia', subcategory: 'internet' },
  { id: 'rule-semparar', keyword: 'SEM PARAR', category: 'moradia', subcategory: 'transporte' },
  { id: 'rule-posto', keyword: 'POSTO', category: 'moradia', subcategory: 'combustivel' },

  // Comida & Alimentação
  { id: 'rule-ifood', keyword: 'IFOOD', category: 'comida', subcategory: 'delivery' },
  { id: 'rule-rappi', keyword: 'RAPPI', category: 'comida', subcategory: 'delivery' },
  { id: 'rule-restaurante', keyword: 'RESTAURANTE', category: 'comida', subcategory: 'restaurante' },
  { id: 'rule-lanche', keyword: 'LANCHONETE', category: 'comida', subcategory: 'lanches' },
  { id: 'rule-sushi', keyword: 'SUSHI', category: 'comida', subcategory: 'restaurante' },
  { id: 'rule-fasano', keyword: 'FASANO', category: 'comida', subcategory: 'restaurante' },
  { id: 'rule-mercado', keyword: 'MERCADO', category: 'comida', subcategory: 'supermercado' },
  { id: 'rule-supermercado', keyword: 'SUPERMERCADO', category: 'comida', subcategory: 'supermercado' },
  { id: 'rule-paoacucar', keyword: 'PAO DE ACUCAR', category: 'comida', subcategory: 'supermercado' },
  { id: 'rule-carrefour', keyword: 'CARREFOUR', category: 'comida', subcategory: 'supermercado' },
  { id: 'rule-feira', keyword: 'FEIRA', category: 'comida', subcategory: 'hortifruti' },
  { id: 'rule-padaria', keyword: 'PADARIA', category: 'comida', subcategory: 'padaria' },
  { id: 'rule-cafe', keyword: 'CAFE', category: 'comida', subcategory: 'cafeteria' },

  // Lazer & Assinaturas
  { id: 'rule-netflix', keyword: 'NETFLIX', category: 'lazer', subcategory: 'assinaturas' },
  { id: 'rule-spotify', keyword: 'SPOTIFY', category: 'lazer', subcategory: 'assinaturas' },
  { id: 'rule-disney', keyword: 'DISNEY', category: 'lazer', subcategory: 'assinaturas' },
  { id: 'rule-hbo', keyword: 'HBO', category: 'lazer', subcategory: 'assinaturas' },
  { id: 'rule-prime', keyword: 'AMAZON PRIME', category: 'lazer', subcategory: 'assinaturas' },
  { id: 'rule-cinema', keyword: 'CINEMA', category: 'lazer', subcategory: 'cinema' },
  { id: 'rule-ingresse', keyword: 'INGRESSE', category: 'lazer', subcategory: 'eventos' },
  { id: 'rule-sympla', keyword: 'SYMPLA', category: 'lazer', subcategory: 'eventos' },
  { id: 'rule-steam', keyword: 'STEAM', category: 'lazer', subcategory: 'jogos' },
  { id: 'rule-playstation', keyword: 'PLAYSTATION', category: 'lazer', subcategory: 'jogos' },

  // Proteção & Saúde
  { id: 'rule-raia', keyword: 'DROGA RAIA', category: 'protecao', subcategory: 'farmacia' },
  { id: 'rule-drogasil', keyword: 'DROGASIL', category: 'protecao', subcategory: 'farmacia' },
  { id: 'rule-farmacia', keyword: 'FARMACIA', category: 'protecao', subcategory: 'farmacia' },
  { id: 'rule-unimed', keyword: 'UNIMED', category: 'protecao', subcategory: 'plano_saude' },
  { id: 'rule-sulamerica', keyword: 'SULAMERICA', category: 'protecao', subcategory: 'seguro' },
  { id: 'rule-porto', keyword: 'PORTO SEGURO', category: 'protecao', subcategory: 'seguro' },
  { id: 'rule-hospital', keyword: 'HOSPITAL', category: 'protecao', subcategory: 'saude' },
  { id: 'rule-laboratorio', keyword: 'LABORATORIO', category: 'protecao', subcategory: 'exames' },
  { id: 'rule-fleury', keyword: 'FLEURY', category: 'protecao', subcategory: 'exames' },

  // Profissional & Estudos
  { id: 'rule-crm', keyword: 'CRM', category: 'profissional', subcategory: 'conselho' },
  { id: 'rule-rqe', keyword: 'RQE', category: 'profissional', subcategory: 'especialidade' },
  { id: 'rule-uptodate', keyword: 'UPTODATE', category: 'profissional', subcategory: 'software' },
  { id: 'rule-congresso', keyword: 'CONGRESSO', category: 'profissional', subcategory: 'congressos' },
  { id: 'rule-curso', keyword: 'CURSO', category: 'profissional', subcategory: 'educacao' },
  { id: 'rule-livraria', keyword: 'LIVRARIA', category: 'profissional', subcategory: 'livros' },
  { id: 'rule-amazon-books', keyword: 'AMAZON.COM.BR', category: 'profissional', subcategory: 'livros' },
  { id: 'rule-cremesp', keyword: 'CREMESP', category: 'profissional', subcategory: 'conselho' },
];

/**
 * Auto-categorizes a raw bank description using keyword matching
 */
export function categorizeTransaction(
  description: string,
  customRules: CategoryKeywordRule[] = []
): { category: CategoryKey; subcategory?: string; matchedKeyword?: string } {
  const normalized = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const allRules = [...customRules, ...DEFAULT_KEYWORD_RULES];

  for (const rule of allRules) {
    const normKeyword = rule.keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normKeyword)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        matchedKeyword: rule.keyword,
      };
    }
  }

  // Fallback defaults
  if (normalized.includes('MERC') || normalized.includes('IFOOD') || normalized.includes('BURGER')) {
    return { category: 'comida', subcategory: 'alimentacao' };
  }
  if (normalized.includes('NETFLIX') || normalized.includes('SPOTIFY') || normalized.includes('PRIME')) {
    return { category: 'lazer', subcategory: 'assinaturas' };
  }

  return { category: 'moradia' };
}

/**
 * Intelligent Recurring Subscription Detection Engine
 * Scans transactions for repeated amounts with identical or similar merchants
 */
export function detectRecurringSubscriptions(
  expenses: ExpenseItem[],
  existingSubscriptions: DetectedSubscription[] = []
): DetectedSubscription[] {
  const groups: Record<string, ExpenseItem[]> = {};

  expenses.forEach(exp => {
    // Clean merchant name
    const cleanMerchant = exp.description
      .replace(/\s*\*\s*/g, ' ')
      .replace(/\d{2}\/\d{2}/g, '')
      .trim()
      .toUpperCase();

    const key = `${cleanMerchant}_${exp.amount.toFixed(2)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(exp);
  });

  const newlyDetected: DetectedSubscription[] = [];

  Object.entries(groups).forEach(([key, list]) => {
    // If appears 2 or more times across different dates
    if (list.length >= 2) {
      const first = list[0];
      const merchant = first.description.trim();
      const amount = first.amount;

      // Check if already registered
      const isAlreadySub = existingSubscriptions.some(
        s => s.merchant.toLowerCase() === merchant.toLowerCase() && Math.abs(s.amount - amount) < 0.05
      );

      if (!isAlreadySub) {
        newlyDetected.push({
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          merchant,
          amount,
          category: first.category,
          frequency: 'mensal',
          lastDate: list[list.length - 1].date,
          status: 'detected_pending',
        });
      }
    }
  });

  return newlyDetected;
}
