import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
    runTransaction: vi.fn(async (_db, callback) => {
      const fakeTx = {
        get: vi.fn(async () => ({ exists: () => false, data: () => null })),
        set: vi.fn(),
      };
      return callback(fakeTx);
    }),
  };
});

import {
  entityChanges,
  rebaseEntities,
  conflictAwareBaseline,
  reconcileConcurrentEntity,
  ENTITY_FIELDS,
  saveEntities,
  type EntityState,
} from '../entitySync';

describe('entity synchronization', () => {
  it('retains the old baseline when both partners edit the same record', () => {
    const base = [{ id: 'shared', amount: 10 }];
    const local = [{ id: 'shared', amount: 20 }];
    const remote = [{ id: 'shared', amount: 30 }];
    expect(conflictAwareBaseline(base, local, remote)).toEqual(base);
    expect(rebaseEntities(base, local, remote)).toEqual(local);
    // saveEntities sees remote30 != baseline10 and local20, so it rejects or reconciles.
    expect(entityChanges(conflictAwareBaseline(base, local, remote), local)[0].before).toEqual(base[0]);
  });

  it('adopts unchanged remote records while preserving a conflicting new ID baseline', () => {
    const local = [{ id: 'same-new-id', amount: 20 }];
    const remote = [{ id: 'same-new-id', amount: 30 }, { id: 'partner', amount: 5 }];
    expect(conflictAwareBaseline([], local, remote)).toEqual([{ id: 'partner', amount: 5 }]);
  });

  it('keeps both partners independent additions', () => {
    const base = [{ id: 'old', amount: 10 }];
    const local = [...base, { id: 'mine', amount: 20 }];
    const remote = [...base, { id: 'partner', amount: 30 }];
    expect(rebaseEntities(base, local, remote).map(e => e.id).sort()).toEqual(['mine', 'old', 'partner']);
  });

  it('preserves an explicit local deletion without deleting a remote addition', () => {
    expect(rebaseEntities([{ id: 'old' }], [], [{ id: 'old' }, { id: 'new' }])).toEqual([{ id: 'new' }]);
  });

  it('does not re-save an unchanged record or duplicate a provider import', () => {
    const records = [{ id: 'pluggy:account:transaction', amount: 12.34 }];
    expect(entityChanges(records, JSON.parse(JSON.stringify(records)))).toEqual([]);
  });

  it('records updates and deletion as distinct operations', () => {
    expect(entityChanges([{ id: 'a', amount: 5 }, { id: 'b', amount: 10 }], [{ id: 'a', amount: 8 }])).toEqual([
      { id: 'a', before: { id: 'a', amount: 5 }, after: { id: 'a', amount: 8 } },
      { id: 'b', before: { id: 'b', amount: 10 }, after: undefined },
    ]);
  });

  it('preserves relational order in ENTITY_FIELDS: parent entities precede children', () => {
    const installmentIdx = ENTITY_FIELDS.indexOf('installments');
    const expenseIdx = ENTITY_FIELDS.indexOf('expenses');
    const shiftIdx = ENTITY_FIELDS.indexOf('medicalShifts');
    const allocationIdx = ENTITY_FIELDS.indexOf('shiftIncomeAllocations');
    const piggyIdx = ENTITY_FIELDS.indexOf('piggyBanks');
    const goalIdx = ENTITY_FIELDS.indexOf('coupleGoals');

    expect(ENTITY_FIELDS).toContain('monthlyBudgetPlans');
    expect(installmentIdx).toBeLessThan(expenseIdx);
    expect(shiftIdx).toBeLessThan(allocationIdx);
    expect(piggyIdx).toBeLessThan(expenseIdx);
    expect(goalIdx).toBeLessThan(expenseIdx);
  });

  describe('concurrency protection on financial mutations', () => {
    it('reconciles concurrent contributions to the same piggy bank additively (R$ 100 + R$ 200 = R$ 300)', () => {
      const before = {
        id: 'piggy-reserve',
        name: 'Reserva de Emergência',
        targetAmount: 1000,
        currentAmount: 0,
        totalInvested: 0,
        completed: false,
      };

      // Partner 1 deposits R$ 100 concurrently
      const remote = {
        ...before,
        currentAmount: 100,
        totalInvested: 100,
        completed: false,
      };

      // Partner 2 deposits R$ 200 concurrently
      const after = {
        ...before,
        currentAmount: 200,
        totalInvested: 200,
        completed: false,
      };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.currentAmount).toBe(300);
      expect(reconciled?.totalInvested).toBe(300);
      expect(reconciled?.completed).toBe(false);
    });

    it('unifies concurrent history contributions without losing entries or duplicating IDs', () => {
      const before = {
        id: 'goal-viagem',
        currentAmount: 500,
        targetAmount: 2000,
        history: [{ id: 'h-1', amount: 500, contributor: 'partner1' }],
      };

      // Partner 1 adds deposit h-2
      const remote = {
        ...before,
        currentAmount: 800,
        history: [
          { id: 'h-2', amount: 300, contributor: 'partner1' },
          { id: 'h-1', amount: 500, contributor: 'partner1' },
        ],
      };

      // Partner 2 adds deposit h-3
      const after = {
        ...before,
        currentAmount: 1100,
        history: [
          { id: 'h-3', amount: 600, contributor: 'partner2' },
          { id: 'h-1', amount: 500, contributor: 'partner1' },
        ],
      };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.currentAmount).toBe(1400); // 500 + 300 (remote delta) + 600 (local delta)
      const histIds = (reconciled?.history as any[]).map(item => item.id);
      expect(histIds).toContain('h-1');
      expect(histIds).toContain('h-2');
      expect(histIds).toContain('h-3');
      expect(new Set(histIds).size).toBe(3);
    });

    it('automatically re-evaluates completed flag when reconciled amount reaches target', () => {
      const before = {
        id: 'meta-casamento',
        targetAmount: 1000,
        currentAmount: 700,
        completed: false,
      };
      // Remote adds 150 (current: 850)
      const remote = { ...before, currentAmount: 850 };
      // Local adds 200 (current: 900)
      const after = { ...before, currentAmount: 900 };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled?.currentAmount).toBe(1050);
      expect(reconciled?.completed).toBe(true);
    });

    it('rejects unresolvable semantic conflict when non-numeric fields differ', () => {
      const before = { id: 'item-1', name: 'Original', currentAmount: 100 };
      const remote = { id: 'item-1', name: 'Renomeado por Bob', currentAmount: 100 };
      const after = { id: 'item-1', name: 'Renomeado por Alice', currentAmount: 100 };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).toBeNull();
    });
  });

  describe('multi-chunk batching (>400 items)', () => {
    it('splits large entity payloads into chunks of <= 400 and notifies progress', async () => {
      const totalItems = 850;
      const fakeExpenses = Array.from({ length: totalItems }, (_, i) => ({
        id: `exp-${i}`,
        amount: 10 + i,
        description: `Item ${i}`,
        date: '2026-10-15',
      }));

      const baseline: EntityState = { expenses: [] };
      const current: EntityState = { expenses: fakeExpenses };

      const fakeDb = {} as any;
      const progressSnapshots: any[] = [];

      const result = await saveEntities(fakeDb, 'couple-123', baseline, current, {
        isActive: () => true,
        onChunkSaved: (p) => {
          progressSnapshots.push({ ...p });
        },
      });

      expect(result.completed).toBe(true);
      expect(result.savedCount).toBe(850);
      expect(result.totalCount).toBe(850);

      // Chunks: 400, 400, 50 -> total 3 chunks
      expect(progressSnapshots.length).toBe(3);
      expect(progressSnapshots[0].savedCount).toBe(400);
      expect(progressSnapshots[0].completed).toBe(false);
      expect(progressSnapshots[1].savedCount).toBe(800);
      expect(progressSnapshots[1].completed).toBe(false);
      expect(progressSnapshots[2].savedCount).toBe(850);
      expect(progressSnapshots[2].completed).toBe(true);
    });
  });
});
