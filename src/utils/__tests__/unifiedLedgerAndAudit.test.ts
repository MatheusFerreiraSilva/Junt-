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
        city: 'São Paulo',
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
        city: 'São Paulo',
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
        city: 'São Paulo',
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

  it('Stage 09: surfaces VALUATION_ADJUSTMENT (-R$ 50), BLOCK_TRANSFER (R$ 200), INITIAL_POSITION, and reverted status with exact operationId without inflating consumption/income', () => {
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
        city: 'São Paulo',
        accentTheme: 'emerald',
      },
      expenses: [],
      incomes: [],
      surplusTransfers: [],
      medicalShifts: [],
      financialOperations: [
        {
          id: 'op-init-1',
          type: 'INITIAL_POSITION',
          amountCents: 100000,
          amountR$: 1000,
          authorizedBy: 'uid-1',
          authoredByUid: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'external', id: 'opening-balance' },
          targetRef: { type: 'piggy_bank', id: 'goal-1', name: 'Viagem' },
          competence: '2026-11',
          date: '2026-11-01',
          state: 'occurred_manual',
          notes: 'Posição inicial sem inflar renda',
        },
        {
          id: 'op-val-neg-50',
          type: 'VALUATION_ADJUSTMENT',
          amountCents: -5000,
          amountR$: -50,
          authorizedBy: 'uid-1',
          authoredByUid: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'external', id: 'market-valuation', name: 'Marcação' },
          targetRef: { type: 'freedom', id: 'freedom_block', name: 'Liberdade' },
          competence: '2026-11',
          date: '2026-11-05',
          state: 'occurred_manual',
          notes: 'Oscilação negativa de mercado',
        },
        {
          id: 'op-transfer-200',
          type: 'BLOCK_TRANSFER',
          amountCents: 20000,
          amountR$: 200,
          authorizedBy: 'uid-1',
          authoredByUid: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'protection', id: 'protection_reserve', name: 'Proteção' },
          targetRef: { type: 'piggy_bank', id: 'goal-1', name: 'Viagem' },
          competence: '2026-11',
          date: '2026-11-06',
          state: 'occurred_manual',
          notes: 'Realocação de bloco',
        },
        {
          id: 'op-deposit-reverted',
          type: 'GOAL_DEPOSIT',
          amountCents: 30000,
          amountR$: 300,
          authorizedBy: 'uid-1',
          authoredByUid: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'external', id: 'manual' },
          targetRef: { type: 'piggy_bank', id: 'goal-1', name: 'Viagem' },
          competence: '2026-11',
          date: '2026-11-07',
          state: 'reverted',
          revertedBy: 'rev-op-deposit-reverted',
          notes: 'Aporte estornado',
        },
      ],
    };

    const ledger = buildUnifiedLedger(state as AppState);
    expect(ledger).toHaveLength(4);

    const valEntry = ledger.find((item) => item.operationId === 'op-val-neg-50');
    expect(valEntry).toBeDefined();
    expect(valEntry?.type).toBe('valuation_adjustment');
    expect(valEntry?.amount).toBe(-50);
    expect(valEntry?.origin).toBe('patrimonial_command');

    const transferEntry = ledger.find((item) => item.operationId === 'op-transfer-200');
    expect(transferEntry).toBeDefined();
    expect(transferEntry?.direction).toBe('internal');
    expect(transferEntry?.amount).toBe(200);

    const initEntry = ledger.find((item) => item.operationId === 'op-init-1');
    expect(initEntry).toBeDefined();
    expect(initEntry?.type).toBe('initial_position');
    expect(initEntry?.direction).toBe('internal');

    const revertedEntry = ledger.find((item) => item.operationId === 'op-deposit-reverted');
    expect(revertedEntry?.status).toBe('reverted');

    // Patrimonial operations never count as consumption outflows or monthly income inflows
    const totalInflow = ledger.filter((i) => i.direction === 'inflow').reduce((s, i) => s + i.amount, 0);
    const totalOutflow = ledger.filter((i) => i.direction === 'outflow').reduce((s, i) => s + i.amount, 0);
    expect(totalInflow).toBe(0);
    expect(totalOutflow).toBe(0);
  });

  it('Stage 26B: surfaces pending_settlement GOAL_WITHDRAWAL as Em liquidação and reconciled spread with differenceToReviewR$ & bankTransactionId', () => {
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
        city: 'São Paulo',
        accentTheme: 'emerald',
      },
      expenses: [],
      incomes: [],
      surplusTransfers: [],
      medicalShifts: [],
      financialOperations: [
        {
          id: 'op-26b-pending',
          type: 'GOAL_WITHDRAWAL',
          amountCents: 800000,
          grossAmountCents: 800000,
          netAmountCents: 800000,
          withdrawalChannel: 'asset_redemption',
          settlementStatus: 'pending_settlement',
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-1', name: 'CDB Liquidez' },
          targetRef: { type: 'account', id: 'acc-1', name: 'Itaú' },
          competence: '2026-11',
          date: '2026-11-12',
          state: 'pending_settlement',
        },
        {
          id: 'op-26b-reconciled',
          type: 'GOAL_WITHDRAWAL',
          amountCents: 800000,
          grossAmountCents: 800000,
          netAmountCents: 780000,
          differenceToReviewCents: 20000,
          withdrawalChannel: 'asset_redemption',
          settlementStatus: 'reconciled',
          bankTransactionId: 'tx-btg-7800',
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-1', name: 'CDB Liquidez' },
          targetRef: { type: 'account', id: 'acc-1', name: 'Itaú' },
          competence: '2026-11',
          date: '2026-11-14',
          state: 'reconciled',
        },
      ],
    };

    const ledger = buildUnifiedLedger(state as AppState);
    expect(ledger).toHaveLength(2);

    const pendingItem = ledger.find((i) => i.operationId === 'op-26b-pending');
    expect(pendingItem?.status).toBe('pending');
    expect(pendingItem?.direction).toBe('internal');
    expect(pendingItem?.title).toContain('[Em liquidação]');

    const recItem = ledger.find((i) => i.operationId === 'op-26b-reconciled');
    expect(recItem?.status).toBe('reconciled');
    expect(recItem?.direction).toBe('internal');
    expect(recItem?.amount).toBe(7800);
    expect(recItem?.grossAmountR$).toBe(8000);
    expect(recItem?.netAmountR$).toBe(7800);
    expect(recItem?.differenceToReviewR$).toBe(200);
    expect(recItem?.bankTransactionId).toBe('tx-btg-7800');
  });

  it('Stage 26C: projects CATEGORY_REINFORCEMENT and CATEGORY_REALLOCATION as traceable internal records without inflating income or outflows', () => {
    const state: Partial<AppState> = {
      profile: {
        partner1Name: 'Henrique',
        partner2Name: 'Beatriz',
        partner1Income: 18000,
        partner2Income: 18000,
        emergencyReserveMonthsTarget: 6,
        expectedYieldAnnual: 6,
        streakMonths: 0,
        themeMode: 'light',
        city: 'São Paulo',
        accentTheme: 'emerald',
      },
      expenses: [],
      incomes: [],
      surplusTransfers: [],
      medicalShifts: [],
      financialOperations: [
        {
          id: 'op-26c-reinf',
          type: 'CATEGORY_REINFORCEMENT',
          amountCents: 800000,
          amountR$: 8000,
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-1', name: 'Reserva CDB' },
          targetRef: { type: 'category', id: 'lazer', name: 'Lazer' },
          sourceOperationId: 'op-w-1',
          competence: '2026-11',
          date: '2026-11-15',
          state: 'reconciled',
          reconciliationRef: 'fitid-reinf-8k',
        },
        {
          id: 'op-26c-realloc',
          type: 'CATEGORY_REALLOCATION',
          amountCents: 50000,
          amountR$: 500,
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'category', id: 'moradia', name: 'Moradia' },
          targetRef: { type: 'category', id: 'lazer', name: 'Lazer' },
          competence: '2026-11',
          date: '2026-11-16',
          state: 'occurred_manual',
        },
      ],
    };

    const ledger = buildUnifiedLedger(state as AppState);
    expect(ledger).toHaveLength(2);

    const reinfItem = ledger.find((i) => i.operationId === 'op-26c-reinf');
    expect(reinfItem?.direction).toBe('internal');
    expect(reinfItem?.status).toBe('reconciled');
    expect(reinfItem?.title).toContain('[Conciliado]');
    expect(reinfItem?.auditDetails.linkedEvent).toContain('op-w-1');

    const reallocItem = ledger.find((i) => i.operationId === 'op-26c-realloc');
    expect(reallocItem?.direction).toBe('internal');
    expect(reallocItem?.title).toContain('Realocação');
    expect(ledger.filter((i) => i.direction === 'inflow')).toHaveLength(0);
    expect(ledger.filter((i) => i.direction === 'outflow')).toHaveLength(0);
  });
});


