import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatCompactCurrency,
  formatCurrency,
  formatHumanDuration,
  formatMonthYear,
  getNextMonth,
  getPreviousMonth,
} from '../formatters';

describe('formatters', () => {
  it('formats BRL values with Brazilian separators', () => {
    expect(formatCurrency(1234.56, true)).toMatch(/R\$\s?1\.234,56/);
    expect(formatCurrency(0, true)).toMatch(/R\$\s?0,00/);
    expect(formatCurrency(Number.NaN, true)).toMatch(/R\$\s?0,00/);
  });

  it('formats compact values for large amounts', () => {
    expect(formatCompactCurrency(1_500_000)).toBe('R$ 1,5 mi');
    expect(formatCompactCurrency(3_200)).toBe('R$ 3 mil');
    expect(formatCompactCurrency(250)).toMatch(/R\$\s?250/);
  });

  it('formats human durations in Portuguese', () => {
    expect(formatHumanDuration(0)).toBe('Meta alcançada 🎉');
    expect(formatHumanDuration(Infinity)).toBe('Defina um aporte para calcular o prazo');
    expect(formatHumanDuration(NaN)).toBe('Defina um aporte para calcular o prazo');
    expect(formatHumanDuration(1)).toBe('1 mês');
    expect(formatHumanDuration(14)).toBe('1 ano e 2 meses');
    expect(formatHumanDuration(24)).toBe('2 anos');
  });

  it('formats month labels', () => {
    expect(formatMonthYear('2026-10')).toBe('Outubro de 2026');
  });

  it('moves between months across year boundaries', () => {
    expect(getNextMonth('2026-12')).toBe('2027-01');
    expect(getPreviousMonth('2026-01')).toBe('2025-12');
    expect(addMonths('2026-01', 13)).toBe('2027-02');
  });
});
