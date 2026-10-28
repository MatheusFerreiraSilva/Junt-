import { describe, expect, it } from 'vitest';
import { entityChanges, rebaseEntities, conflictAwareBaseline } from '../entitySync';

describe('entity synchronization', () => {
  it('retains the old baseline when both partners edit the same record', () => {
    const base = [{ id: 'shared', amount: 10 }];
    const local = [{ id: 'shared', amount: 20 }];
    const remote = [{ id: 'shared', amount: 30 }];
    expect(conflictAwareBaseline(base, local, remote)).toEqual(base);
    expect(rebaseEntities(base, local, remote)).toEqual(local);
    // saveEntities sees remote30 != baseline10 and local20, so it rejects.
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
});
