import { describe, it, expect } from 'vitest';
import { buildUnifiedLedger, normalizeSearchTerm } from '../unifiedLedger';
import { AppState, ExpenseItem, IncomeItem, SurplusTransferRecord, MedicalShift } from '../../types/finance';

describe('Unified Ledger and Statement Traceability', () => {
  it('Acceptance Criterion 1: Receita 1000 and Gasto 200 result in Net Flow +800 (both inflows and outflows in unified statement)', () => {
    const state: Partial<AppState> = {
      profile: {
        partner1Name: 'Henrique',
        partner2Name: 'Beatriz',
        partner1Income: 5000,
        partner2Income: 5000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6,
        streakMonths: 0,
        themeMode: 'light',
        accentTheme: 'emerald',
      },
      expenses: [
        {
          id: 'exp-1',
          description: 'Supermercado Mensal',
          amount: 200,
          category: 'comida',
          date: '2026-10-15',
          paidBy: 'both',
        },
      ],
      incomes: [
        {
          id: 'inc-1',
          description: 'Salário Mensal Hospital',
          amount: 1000,
          date: '2026-10-01',
          recipient: 'partner1',
          type: 'salario',
        },
      ],
      surplusTransfers: [],
      medicalShifts: [],
    };

    const ledger = buildUnifiedLedger(state as AppState);

    expect(ledger.length).toBe(2);

    const inflows = ledger.filter(i => i.direction === 'inflow');
    const outflows = ledger.filter(i => i.direction === 'outflow');

    expect(inflows.length).toBe(1);
    expect(outflows.length).toBe(1);

    const totalInflow = inflows.reduce((s, i) => s + i.amount, 0);
    const totalOutflow = outflows.reduce((s, i) => s + i.amount, 0);
    const netFlow = totalInflow - totalOutflow;

    expect(totalInflow).toBe(1000);
    expect(totalOutflow).toBe(200);
    expect(netFlow).toBe(800); // Net Flow +800, NOT statement showing only 200!
  });

  it('Acceptance Criterion 2: Transferencia 500 between accounts shows internal transfer with 0 impact on net flow', () => {
    const state: Partial<AppState> = {
      profile: {
        partner1Name: 'Henrique',
        partner2Name: 'Beatriz',
        partner1Income: 5000,
        partner2Income: 5000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6,
        streakMonths: 0,
        themeMode: 'light',
        accentTheme: 'emerald',
      },
      expenses: [],
      incomes: [
        {
          id: 'inc-1',
          description: 'Salário',
          amount: 5000,
          date: '2026-10-01',
          recipient: 'both',
          type: 'salario',
        },
      ],
      surplusTransfers: [
        {
          id: 'tr-1',
          sourceCategory: 'moradia',
          targetType: 'category',
          targetGoalName: 'Comida & Conveniência',
          amount: 500,
          date: '2026-10-10',
          monthKey: '2026-10',
          note: 'Vaso comunicante: Nivelamento de Moradia para Comida',
        },
      ],
      medicalShifts: [],
    };

    const ledger = buildUnifiedLedger(state as AppState);

    expect(ledger.length).toBe(2);

    const transfers = ledger.filter(i => i.direction === 'internal');
    expect(transfers.length).toBe(1);
    expect(transfers[0].amount).toBe(500);

    // Consolidated income & expense totals are unaffected by internal transfers:
    const inflows = ledger.filter(i => i.direction === 'inflow').reduce((s, i) => s + i.amount, 0);
    const outflows = ledger.filter(i => i.direction === 'outflow').reduce((s, i) => s + i.amount, 0);

    expect(inflows).toBe(5000);
    expect(outflows).toBe(0);
  });

  it('normalizeSearchTerm parses Brazilian comma decimal formatted numbers (e.g. 800,00 or 1.250,50)', () => {
    const search1 = normalizeSearchTerm('800,00');
    expect(search1.numVal).toBe(800.0);

    const search2 = normalizeSearchTerm('1.250,50');
    expect(search2.numVal).toBe(1250.5);

    const search3 = normalizeSearchTerm('Uber Eats');
    expect(search3.text).toBe('uber eats');
    expect(search3.numVal).toBeUndefined();
  });

  it('preserves FITID and import source details for audit inspection', () => {
    const state: Partial<AppState> = {
      profile: {
        partner1Name: 'Henrique',
        partner2Name: 'Beatriz',
        partner1Income: 5000,
        partner2Income: 5000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6,
        streakMonths: 0,
        themeMode: 'light',
        accentTheme: 'emerald',
      },
      expenses: [
        {
          id: 'exp-pluggy-99',
          description: 'Restaurante Outback',
          amount: 180.5,
          category: 'comida',
          date: '2026-10-20',
          paidBy: 'both',
          bankName: 'Nubank Ultravioleta',
        },
      ],
      incomes: [],
      surplusTransfers: [],
      medicalShifts: [],
    };

    const ledger = buildUnifiedLedger(state as AppState);
    const importedItem = ledger[0];

    expect(importedItem.origin).toBe('pluggy_import');
    expect(importedItem.fitid).toBe('fitid-exp-exp-pluggy-99');
    expect(importedItem.auditDetails.sourceDescription).toContain('Nubank Ultravioleta');
  });
});
