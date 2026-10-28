import { describe, expect, it } from 'vitest';
import { applyShiftAllocation, undoShiftAllocations, migrateLegacyShiftAllocations } from '../shiftReconciliation';
import type { IncomeItem, MedicalShift } from '../../types/finance';
const shift = (id: string, amount: number): MedicalShift => ({ id, partner: 'partner1', title: 'Plantão', hospitalName: 'Hospital informado', sector: 'outro', contractType: 'pj_privado', dateWorked: '2025-01-01', durationHours: 12, grossAmount: amount, estimatedPayDate: '2025-01-31', status: 'pending' });
const income = (id: string, amount: number): IncomeItem => ({ id, amount, description: 'Depósito', date: '2025-01-31', recipient: 'partner1', type: 'extra' });
describe('shift allocations', () => {
  it('caps legacy links to the actual deposit and preserves missing deposits as missing', () => {
    const shifts = [{ ...shift('a', 1000), linkedIncomeId: 'deposit' }, { ...shift('b', 1000), linkedIncomeId: 'deposit' }, { ...shift('missing', 500), linkedIncomeId: 'not-found' }];
    const migrated = migrateLegacyShiftAllocations(shifts, [income('deposit', 1500)], []);
    expect(migrated).toEqual([{ id: 'deposit', allocations: { a: 100000, b: 50000 } }]);
    expect(migrateLegacyShiftAllocations(shifts, [income('deposit', 1500)], migrated)).toEqual(migrated);
  });
  it('allocates one deposit to two shifts without creating another income', () => {
    const shifts = [shift('a', 1000), shift('b', 1000)];
    const incomes = [income('deposit', 2000)];
    const first = applyShiftAllocation(shifts, incomes, [], 'a', 'deposit');
    const second = applyShiftAllocation(first.shifts, incomes, first.ledgers, 'b', 'deposit');
    expect(second.ledgers[0].allocations).toEqual({ a: 100000, b: 100000 });
    expect(second.shifts.every(s => s.status === 'received')).toBe(true);
    expect(incomes).toHaveLength(1);
  });
  it('keeps partial balance and accepts another deposit', () => {
    const incomes = [income('first', 700), income('second', 500)];
    const first = applyShiftAllocation([shift('a', 1200)], incomes, [], 'a', 'first');
    expect(first.shifts[0].status).toBe('pending');
    const second = applyShiftAllocation(first.shifts, incomes, first.ledgers, 'a', 'second');
    expect(second.shifts[0].status).toBe('received');
  });
  it('is idempotent and reversal preserves deposits', () => {
    const incomes = [income('deposit', 1000)];
    const first = applyShiftAllocation([shift('a', 1000)], incomes, [], 'a', 'deposit');
    const repeated = applyShiftAllocation(first.shifts, incomes, first.ledgers, 'a', 'deposit');
    expect(repeated).toEqual(first);
    const undone = undoShiftAllocations(first.shifts, first.ledgers, 'a');
    expect(undone.ledgers[0].allocations).toEqual({});
    expect(incomes).toHaveLength(1);
  });
  it('rejects over-allocation and the wrong partner', () => {
    expect(() => applyShiftAllocation([shift('a', 1000)], [income('deposit', 500)], [], 'a', 'deposit', 501)).toThrow();
    expect(() => applyShiftAllocation([shift('a', 1000)], [{ ...income('deposit', 1000), recipient: 'partner2' }], [], 'a', 'deposit')).toThrow();
  });
});
