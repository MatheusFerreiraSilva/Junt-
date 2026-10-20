import { describe, expect, it } from 'vitest';
import type { ExpenseItem } from '../../types/finance';
import {
  categorizeTransaction,
  detectRecurringSubscriptions,
} from '../categorizationEngine';

function expense(
  description: string,
  amount: number,
  date: string
): ExpenseItem {
  return {
    id: `${description}-${date}`,
    description,
    amount,
    date,
    category: 'lazer',
    paidBy: 'both',
  };
}

describe('categorizationEngine', () => {
  it('matches supermarket descriptions and strips accents', () => {
    const result = categorizeTransaction('PÃO DE AÇÚCAR');
    expect(result.category).toBe('comida');
    expect(result.subcategory).toBe('supermercado');
    expect(result.matchedKeyword).toBe('PAO DE ACUCAR');

    const withStoreName = categorizeTransaction('PÃO DE AÇÚCAR SUPERMERCADO');
    expect(withStoreName.category).toBe('comida');
    expect(withStoreName.matchedKeyword).toBe('SUPERMERCADO');
  });

  it('matches transport and pharmacy keywords', () => {
    expect(categorizeTransaction('UBER *TRIP').category).toBe('transporte');
    expect(categorizeTransaction('DROGA RAIA').category).toBe('protecao');
  });

  it('supports custom keyword rules', () => {
    const result = categorizeTransaction('CAFÉ ESPECIAL DO CASAL', [
      { id: 'custom-1', keyword: 'CAFE', category: 'comida', subcategory: 'cafeteria' },
    ]);
    expect(result.category).toBe('comida');
    expect(result.subcategory).toBe('cafeteria');
  });

  it('falls back to lazer/outros when nothing matches', () => {
    const result = categorizeTransaction('LOJA TOTALMENTE DESCONHECIDA');
    expect(result.category).toBe('lazer');
    expect(result.subcategory).toBe('outros');
    expect(result.matchedKeyword).toBeUndefined();
  });

  it('detects recurring subscriptions with identical amounts', () => {
    const subscriptions = detectRecurringSubscriptions([
      expense('NETFLIX.COM', 39.9, '2026-08-10'),
      expense('NETFLIX.COM', 39.9, '2026-09-10'),
      expense('NETFLIX.COM', 39.9, '2026-10-10'),
      expense('SUPERMERCADO', 410.2, '2026-10-02'),
    ]);

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      merchant: 'NETFLIX.COM',
      amount: 39.9,
      category: 'lazer',
      frequency: 'mensal',
      status: 'detected_pending',
      lastDate: '2026-10-10',
    });
  });

  it('does not flag varying amounts as a subscription', () => {
    const subscriptions = detectRecurringSubscriptions([
      expense('PADARIA', 18.5, '2026-09-01'),
      expense('PADARIA', 24.9, '2026-10-01'),
    ]);
    expect(subscriptions).toHaveLength(0);
  });
});
