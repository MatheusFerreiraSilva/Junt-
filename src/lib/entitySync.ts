import { collection, doc, getDocs, onSnapshot, runTransaction, type Firestore } from 'firebase/firestore';

export const ENTITY_FIELDS = [
  'installments',
  'piggyBanks',
  'coupleGoals',
  'linkedAccounts',
  'medicalShifts',
  'monthlyBudgetPlans',
  'expenses',
  'incomes',
  'shiftIncomeAllocations',
  'bankImportedTransactions',
  'medicalShiftPresets',
  'hospitalMappingRules',
  'incomeSourceRules',
  'pendingConfirmations',
  'detectedSubscriptions',
  'keywordRules',
  'coupleWishlist',
  'coupleFixedBills',
  'dreamSimulations',
  'strategicIntents',
  'financialOperations',
  'pluggyAccounts',
] as const;

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
// records survive; two edits to the same record are rejected or reconciled by saveEntities.
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

/**
 * Reconcilia mutações financeiras concorrentes entre parceiros.
 * Se dois parceiros aportaram concorrentemente na mesma caixinha ou meta (ex.: R$ 100 e R$ 200),
 * preserva os dois aportes via soma de deltas e união de histórico sem duplicação de IDs.
 * Retorna null se houver conflito semântico irresolvível (ex.: textos distintos ou exclusão).
 */
export function reconcileConcurrentEntity(
  before: SyncEntity | undefined,
  remote: SyncEntity | undefined,
  after: SyncEntity | undefined
): SyncEntity | null {
  if (!before || !remote || !after) return null;
  if (remote.id !== after.id || before.id !== after.id) return null;

  const ADDITIVE_NUMERIC_KEYS = new Set([
    'currentAmount',
    'totalInvested',
    'partner1Contribution',
    'partner2Contribution',
    'yieldAccumulated',
    'accumulatedCents',
    'committedCents',
    'utilizedCents',
    'availableCents',
  ]);

  const reconciled: SyncEntity = { ...remote };
  const allKeys = new Set([...Object.keys(before), ...Object.keys(remote), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (key === 'id') continue;
    const vBefore = before[key];
    const vRemote = remote[key];
    const vAfter = after[key];

    if (same(vAfter, vBefore)) {
      // Local não alterou este campo; prevalece remote
      reconciled[key] = vRemote;
    } else if (same(vRemote, vBefore)) {
      // Remote não alterou este campo; prevalece local
      reconciled[key] = vAfter;
    } else if (same(vRemote, vAfter)) {
      // Ambos alteraram para o mesmo valor
      reconciled[key] = vAfter;
    } else if (ADDITIVE_NUMERIC_KEYS.has(key)) {
      // Campo numérico cumulativo: aplica o delta local sobre o valor remoto
      const numBefore = typeof vBefore === 'number' ? vBefore : 0;
      const numRemote = typeof vRemote === 'number' ? vRemote : 0;
      const numAfter = typeof vAfter === 'number' ? vAfter : 0;
      const deltaLocal = numAfter - numBefore;
      reconciled[key] = Math.round((numRemote + deltaLocal) * 100) / 100;
    } else if (key === 'history' && Array.isArray(vBefore) && Array.isArray(vRemote) && Array.isArray(vAfter)) {
      // Histórico de transações/aportes: união sem duplicação de IDs
      const beforeIds = new Set(vBefore.map((item: any) => item?.id).filter(Boolean));
      const remoteIds = new Set(vRemote.map((item: any) => item?.id).filter(Boolean));
      const newLocalItems = vAfter.filter((item: any) => item?.id && !beforeIds.has(item.id) && !remoteIds.has(item.id));
      reconciled[key] = [...newLocalItems, ...vRemote];
    } else if (key === 'completed' || key === 'isCompleted') {
      // Flag de conclusão será recalculada ao final se houver targetAmount
      continue;
    } else {
      // Conflito não-reconciliável em campos de texto/configuração
      return null;
    }
  }

  // Recalcula flags de completude se houver meta estipulada
  const target = typeof reconciled.targetAmount === 'number' ? reconciled.targetAmount : undefined;
  const current = typeof reconciled.currentAmount === 'number' ? reconciled.currentAmount : undefined;
  if (target !== undefined && current !== undefined && target > 0) {
    if ('completed' in reconciled) reconciled.completed = current >= target;
    if ('isCompleted' in reconciled) reconciled.isCompleted = current >= target;
  }

  return reconciled;
}

const entityRef = (db: Firestore, coupleId: string, field: string, id: string) =>
  doc(db, 'couples', coupleId, 'entities', encodeURIComponent(field + ':' + id));

export async function migrateEntities(
  db: Firestore,
  coupleId: string,
  legacy: EntityState,
  isActive: () => boolean = () => true
) {
  // Cada registro legado é copiado apenas se não existir entidade ou tombstone.
  // Os arrays originais são preservados como backup; migrações repetidas são seguras e idempotentes.
  if (!isActive()) return;
  const existing = await getDocs(collection(db, 'couples', coupleId, 'entities'));
  const ids = new Set(existing.docs.map(entry => entry.id));
  const missing = ENTITY_FIELDS.flatMap(field =>
    (legacy[field] || [])
      .filter(record => record.id && !ids.has(encodeURIComponent(field + ':' + record.id)))
      .map(record => ({ field, record }))
  );
  for (let offset = 0; offset < missing.length; offset += 100) {
    if (!isActive()) return;
    const chunk = missing.slice(offset, offset + 100);
    await runTransaction(db, async tx => {
      const snapshots = await Promise.all(
        chunk.map(({ field, record }) => tx.get(entityRef(db, coupleId, field, record.id)))
      );
      if (!isActive()) throw new Error('A sessão mudou. Migração interrompida.');
      chunk.forEach(({ field, record }, index) => {
        if (!snapshots[index].exists()) {
          tx.set(entityRef(db, coupleId, field, record.id), {
            field,
            record: JSON.parse(JSON.stringify(record)),
            deleted: false,
            schemaVersion: 1,
          });
        }
      });
    });
  }
}

export function subscribeEntities(
  db: Firestore,
  coupleId: string,
  callback: (data: EntityState, confirmed: boolean) => void,
  onError: (error: Error) => void
) {
  return onSnapshot(
    collection(db, 'couples', coupleId, 'entities'),
    { includeMetadataChanges: true },
    snapshot => {
      const state: EntityState = Object.fromEntries(ENTITY_FIELDS.map(field => [field, []]));
      for (const entry of snapshot.docs) {
        const value = entry.data();
        if (ENTITY_FIELDS.includes(value.field) && !value.deleted && value.record?.id) {
          state[value.field as EntityField]!.push(value.record);
        }
      }
      callback(state, !snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache);
    },
    onError
  );
}

export interface SaveChunkProgress {
  savedCount: number;
  totalCount: number;
  completed: boolean;
  confirmedChanges: Array<{ field: EntityField; id: string; after?: SyncEntity | null }>;
}

export interface SaveEntitiesOptions {
  isActive?: () => boolean;
  onChunkSaved?: (progress: SaveChunkProgress) => void;
}

export interface SaveEntitiesResult {
  completed: boolean;
  savedCount: number;
  totalCount: number;
}

export async function saveEntities(
  db: Firestore,
  coupleId: string,
  baseline: EntityState,
  current: EntityState,
  optionsOrIsActive: SaveEntitiesOptions | (() => boolean) = () => true
): Promise<SaveEntitiesResult> {
  const options: SaveEntitiesOptions =
    typeof optionsOrIsActive === 'function' ? { isActive: optionsOrIsActive } : optionsOrIsActive;
  const isActive = options.isActive || (() => true);

  // A ordenação de ENTITY_FIELDS garante que entidades-pai (installments, piggyBanks, coupleGoals, etc.)
  // sejam processadas antes de registros filhos (expenses, shiftIncomeAllocations, etc.)
  const changes = ENTITY_FIELDS.flatMap(field =>
    entityChanges(baseline[field] || [], current[field] || []).map(change => ({ field, ...change }))
  );

  if (!changes.length) {
    return { completed: true, savedCount: 0, totalCount: 0 };
  }

  // Divisão em blocos de até 400 itens para respeitar os limites de transação do Firestore
  const BATCH_SIZE = 400;
  let savedCount = 0;

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const chunk = changes.slice(i, i + BATCH_SIZE);
    if (!isActive()) {
      return { completed: false, savedCount, totalCount: changes.length };
    }

    const chunkWrittenChanges: Array<{ field: EntityField; id: string; after?: SyncEntity | null }> = [];

    await runTransaction(db, async tx => {
      const snapshots = await Promise.all(
        chunk.map(change => tx.get(entityRef(db, coupleId, change.field, change.id)))
      );
      if (!isActive()) throw new Error('A sessão mudou. As alterações pendentes foram interrompidas.');

      chunk.forEach((change, index) => {
        const value = snapshots[index].data();
        const remote = value?.deleted ? undefined : value?.record;

        let recordToWrite = change.after ? JSON.parse(JSON.stringify(change.after)) : null;

        if (!same(remote, change.before) && !same(remote, change.after)) {
          // Tentativa de reconciliação aditiva para aportes financeiros concorrentes
          const reconciled = reconcileConcurrentEntity(change.before, remote, change.after);
          if (reconciled) {
            recordToWrite = JSON.parse(JSON.stringify(reconciled));
          } else {
            throw new Error('Este registro foi alterado pelo seu par. Recarregue para revisar antes de salvar.');
          }
        }

        tx.set(entityRef(db, coupleId, change.field, change.id), {
          field: change.field,
          record: recordToWrite,
          deleted: !recordToWrite,
          schemaVersion: 1,
        });

        chunkWrittenChanges.push({ field: change.field, id: change.id, after: recordToWrite });
      });
    });

    savedCount += chunk.length;
    const isFinished = savedCount >= changes.length;
    options.onChunkSaved?.({
      savedCount,
      totalCount: changes.length,
      completed: isFinished,
      confirmedChanges: chunkWrittenChanges,
    });
  }

  return { completed: true, savedCount, totalCount: changes.length };
}
