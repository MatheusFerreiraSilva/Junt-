import type { InstallmentPurchase } from '../types/finance';

// Keep public BRL fields compatible with legacy records. Distribute the integer
// cent remainder over the first installments; their sum always equals the total.
export function installmentCents(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count < 1 || count > 600) throw new Error('Parcelamento inválido.');
  const cents = Math.round(total * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Valor fora do limite.');
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function installmentValue(item: InstallmentPurchase, index = item.paidInstallmentsCount): number {
  return (installmentCents(item.totalAmount, item.installmentsCount)[index] ?? 0) / 100;
}

export function remainingInstallmentValue(item: InstallmentPurchase, count = item.installmentsCount - item.paidInstallmentsCount): number {
  return installmentCents(item.totalAmount, item.installmentsCount)
    .slice(item.paidInstallmentsCount, item.paidInstallmentsCount + Math.max(0, count))
    .reduce((sum, cents) => sum + cents, 0) / 100;
}

export function installmentInMonth(item: InstallmentPurchase, month: string): number {
  const [sy, sm] = item.startMonth.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  const index = (y - sy) * 12 + m - sm;
  if (!Number.isInteger(index) || index < 0) return 0;
  return installmentValue(item, index);
}
