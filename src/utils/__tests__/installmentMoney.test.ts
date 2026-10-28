import { describe, it, expect } from 'vitest';
import { installmentCents, installmentInMonth, remainingInstallmentValue } from '../installmentMoney';
import type { InstallmentPurchase } from '../../types/finance';

describe('integer cent installments', () => {
  const item: InstallmentPurchase = { id: 'a', title: 'Livro', category: 'profissional', totalAmount: 100, installmentsCount: 3, installmentAmount: 33.33, paidInstallmentsCount: 1, startMonth: '2026-12', active: true, paidBy: 'both' };
  it('preserves exact total with a remainder', () => {
    expect(installmentCents(100, 3)).toEqual([3334, 3333, 3333]);
    expect(installmentCents(0.01, 3)).toEqual([1, 0, 0]);
    for (let count = 1; count < 100; count++) expect(installmentCents(123.47, count).reduce((a,b) => a+b,0)).toBe(12347);
  });
  it('uses civil months across year boundaries', () => {
    expect(installmentInMonth(item, '2026-11')).toBe(0);
    expect(installmentInMonth(item, '2026-12')).toBe(33.34);
    expect(installmentInMonth(item, '2027-01')).toBe(33.33);
    expect(installmentInMonth(item, '2027-03')).toBe(0);
    expect(remainingInstallmentValue(item)).toBe(66.66);
  });
  it('rejects nonfinite amounts and invalid counts', () => {
    expect(() => installmentCents(NaN, 3)).toThrow();
    expect(() => installmentCents(10, 0)).toThrow();
    expect(() => installmentCents(10, 2.5)).toThrow();
  });
});
