/**
 * Human-friendly formatters adhering to the couple's financial app rules
 * No financial jargon, clean Portuguese, warm and easy to read.
 */

export function formatCurrency(value: number, showCents: boolean = false): string {
  const num = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)} mil`;
  }
  return formatCurrency(value, false);
}

export function formatHumanDuration(months: number): string {
  if (!isFinite(months) || months <= 0) return 'Meta alcançada 🎉';
  const totalMonths = Math.ceil(months);

  if (totalMonths < 12) {
    return `${totalMonths} ${totalMonths === 1 ? 'mês' : 'meses'}`;
  }

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${
    remainingMonths === 1 ? 'mês' : 'meses'
  }`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function formatMonthYear(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[month] || ''} de ${year}`;
}

export function formatShortMonthYear(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const shortYear = year.toString().slice(-2);
  return `${MONTH_SHORT_NAMES[month]}/${shortYear}`;
}

export function getNextMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function getPreviousMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function addMonths(yearMonth: string, count: number): string {
  let curr = yearMonth;
  for (let i = 0; i < count; i++) {
    curr = getNextMonth(curr);
  }
  return curr;
}

export function getMonthProgress(yearMonth: string): {
  daysPassed: number;
  totalDays: number;
  daysRemaining: number;
  percentPassed: number;
} {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // Total days in this month
  const totalDays = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  let daysPassed = 0;
  if (isCurrentMonth) {
    daysPassed = today.getDate();
  } else if (
    today.getFullYear() > year ||
    (today.getFullYear() === year && today.getMonth() + 1 > month)
  ) {
    daysPassed = totalDays; // past month
  } else {
    daysPassed = 0; // future month
  }

  const daysRemaining = Math.max(0, totalDays - daysPassed);
  const percentPassed = Math.min(100, Math.round((daysPassed / totalDays) * 100));

  return { daysPassed, totalDays, daysRemaining, percentPassed };
}
