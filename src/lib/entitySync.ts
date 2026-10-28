import { collection, doc, getDocs, onSnapshot, runTransaction, type Firestore } from 'firebase/firestore';

export const ENTITY_FIELDS = ['expenses', 'incomes', 'installments', 'piggyBanks', 'strategicIntents', 'medicalShifts', 'shiftIncomeAllocations', 'bankImportedTransactions', 'medicalShiftPresets', 'hospitalMappingRules', 'incomeSourceRules', 'pendingConfirmations', 'linkedAccounts', 'detectedSubscriptions', 'keywordRules', 'coupleGoals', 'coupleWishlist', 'coupleFixedBills', 'dreamSimulations', 'pluggyAccounts'] as const;
export type EntityField = typeof ENTITY_FIELDS[number];
export type SyncEntity = { id: string; [key: string]: unknown };
export type EntityState = Partial<Record<EntityField, SyncEntity[]>>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function entityChanges(before: SyncEntity[], after: SyncEntity[]) {
  const old = new Map(before.map(item => [item.id, item]));
  const next = new Map(after.map(item => [item.id, item]));
  return [...new Set([...old.keys(), ...next.keys()])].filter(id => !same(old.get(id), next.get(id))).map(id => ({ id, before: old.get(id), after: next.get(id) }));
}

// Reapply this device's unsent edits over incoming entities. Other devices' new
// records survive; two edits to the same record are rejected by saveEntities.
export function rebaseEntities(base: SyncEntity[], local: SyncEntity[], remote: SyncEntity[]) {
  const next = new Map(remote.map(item => [item.id, item]));
  for (const change of entityChanges(base, local)) {
    if (change.after) next.set(change.id, change.after); else next.delete(change.id);
  }
  return [...next.values()];
}
export function conflictAwareBaseline(base: SyncEntity[], local: SyncEntity[], remote: SyncEntity[]) {
  const baseline = new Map(remote.map(item => [item.id, item]));
  const previous = new Map(base.map(item => [item.id, item]));
  const incoming = new Map(remote.map(item => [item.id, item]));
  for (const change of entityChanges(base, local)) {
    if (!same(incoming.get(change.id), change.before) && !same(incoming.get(change.id), change.after)) {
      const old = previous.get(change.id);
      if (old) baseline.set(change.id, old); else baseline.delete(change.id);
    }
  }
  return [...baseline.values()];
}
const entityRef = (db: Firestore, coupleId: string, field: string, id: string) => doc(db, 'couples', coupleId, 'entities', encodeURIComponent(field + ':' + id));
export async function migrateEntities(db: Firestore, coupleId: string, legacy: EntityState, isActive: () => boolean = () => true) {
  // Each old record is copied only if no entity or deletion tombstone exists.
  // The original arrays are retained as a backup; repeated migrations are safe.
  if (!isActive()) return;
  const existing = await getDocs(collection(db, 'couples', coupleId, 'entities'));
  const ids = new Set(existing.docs.map(entry => entry.id));
  const missing = ENTITY_FIELDS.flatMap(field => (legacy[field] || []).filter(record => record.id && !ids.has(encodeURIComponent(field + ':' + record.id))).map(record => ({ field, record })));
  for (let offset = 0; offset < missing.length; offset += 100) {
    if (!isActive()) return;
    const chunk = missing.slice(offset, offset + 100);
    await runTransaction(db, async tx => {
      const snapshots = await Promise.all(chunk.map(({ field, record }) => tx.get(entityRef(db, coupleId, field, record.id))));
      if (!isActive()) throw new Error('A sessão mudou. Migração interrompida.');
      chunk.forEach(({ field, record }, index) => {
        if (!snapshots[index].exists()) tx.set(entityRef(db, coupleId, field, record.id), { field, record: JSON.parse(JSON.stringify(record)), deleted: false, schemaVersion: 1 });
      });
    });
  }
}
export function subscribeEntities(db: Firestore, coupleId: string, callback: (data: EntityState, confirmed: boolean) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(db, 'couples', coupleId, 'entities'), { includeMetadataChanges: true }, snapshot => {
    const state: EntityState = Object.fromEntries(ENTITY_FIELDS.map(field => [field, []]));
    for (const entry of snapshot.docs) {
      const value = entry.data();
      if (ENTITY_FIELDS.includes(value.field) && !value.deleted && value.record?.id) state[value.field as EntityField]!.push(value.record);
    }
    callback(state, !snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache);
  }, onError);
}
export async function saveEntities(db: Firestore, coupleId: string, baseline: EntityState, current: EntityState, isActive: () => boolean = () => true) {
  const changes = ENTITY_FIELDS.flatMap(field => entityChanges(baseline[field] || [], current[field] || []).map(change => ({ field, ...change })));
  if (!changes.length) return;
  // A transaction validates the baseline so conflicting edits never silently
  // overwrite a partner's version. Independent records can be saved together.
  if (changes.length > 450) throw new Error('Há mais de 450 alterações pendentes. Exporte um backup e sincronize em lotes menores.');
  {
    const chunk = changes;
    if (!isActive()) return;
    await runTransaction(db, async tx => {
      const snapshots = await Promise.all(chunk.map(change => tx.get(entityRef(db, coupleId, change.field, change.id))));
      if (!isActive()) throw new Error('A sessão mudou. As alterações pendentes foram interrompidas.');
      chunk.forEach((change, index) => {
        const value = snapshots[index].data();
        const remote = value?.deleted ? undefined : value?.record;
        if (!same(remote, change.before) && !same(remote, change.after)) throw new Error('Este registro foi alterado pelo seu par. Recarregue para revisar antes de salvar.');
        tx.set(entityRef(db, coupleId, change.field, change.id), { field: change.field, record: change.after ? JSON.parse(JSON.stringify(change.after)) : null, deleted: !change.after, schemaVersion: 1 });
      });
    });
  }
}
