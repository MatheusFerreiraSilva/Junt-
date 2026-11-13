import { collection, doc, getDocs, onSnapshot, runTransaction, type Firestore } from 'firebase/firestore';
import type {
  AppState,
  FinancialCommandResult,
  FinancialOperationRecord,
} from '../types/finance';
import {
  computeOperationFingerprint,
  readOperationAmountCents,
} from '../utils/financialCommands';

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

const BALANCE_DEBIT_KEYS = ['currentAmount', 'availableCents', 'accumulatedCents'] as const;
const USAGE_INCREASE_KEYS = ['utilizedCents', 'committedCents'] as const;

function hasCompetingDebit(
  before: SyncEntity | undefined,
  remote: SyncEntity | undefined,
  after: SyncEntity | undefined
): boolean {
  if (!before || !remote || !after) return false;
  const remoteOp = typeof remote.lastOperationId === 'string' ? remote.lastOperationId : '';
  const afterOp = typeof after.lastOperationId === 'string' ? after.lastOperationId : '';
  // Mesma operação exata já confirmada não é débito concorrente distinto
  if (remoteOp && afterOp && remoteOp === afterOp) return false;

  for (const key of BALANCE_DEBIT_KEYS) {
    const bVal = typeof before[key] === 'number' ? (before[key] as number) : undefined;
    const rVal = typeof remote[key] === 'number' ? (remote[key] as number) : undefined;
    const aVal = typeof after[key] === 'number' ? (after[key] as number) : undefined;
    if (bVal !== undefined && rVal !== undefined && aVal !== undefined) {
      if (rVal < bVal && aVal < bVal) {
        return true;
      }
    }
  }

  for (const key of USAGE_INCREASE_KEYS) {
    const bVal = typeof before[key] === 'number' ? (before[key] as number) : undefined;
    const rVal = typeof remote[key] === 'number' ? (remote[key] as number) : undefined;
    const aVal = typeof after[key] === 'number' ? (after[key] as number) : undefined;
    if (bVal !== undefined && rVal !== undefined && aVal !== undefined) {
      if (rVal > bVal && aVal > bVal) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Reconcilia mutações financeiras concorrentes entre parceiros.
 * Se dois parceiros aportaram concorrentemente na mesma caixinha ou meta (ex.: R$ 100 e R$ 200),
 * preserva os dois aportes via soma de deltas e união de histórico sem duplicação de IDs.
 * Bloqueia débitos/saques concorrentes ou saldos resultantes negativos retornando null.
 */
export function reconcileConcurrentEntity(
  before: SyncEntity | undefined,
  remote: SyncEntity | undefined,
  after: SyncEntity | undefined
): SyncEntity | null {
  if (!before || !remote || !after) return null;
  if (remote.id !== after.id || before.id !== after.id) return null;

  // R29-06: Duas sessões debitando concorrentemente a mesma meta nunca podem mesclar cegamente
  if (hasCompetingDebit(before, remote, after)) {
    return null;
  }

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
      const mergedVal = key.endsWith('Cents')
        ? Math.round(numRemote + deltaLocal)
        : Math.round((numRemote + deltaLocal) * 100) / 100;
      reconciled[key] = mergedVal;
    } else if (key === 'revision') {
      const rRev = typeof vRemote === 'number' ? vRemote : 0;
      const aRev = typeof vAfter === 'number' ? vAfter : 0;
      reconciled.revision = Math.max(rRev, aRev) + 1;
    } else if (key === 'lastOperationId') {
      reconciled.lastOperationId = vAfter || vRemote;
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

  // Proíbe saldo negativo após reconciliação concorrente
  for (const key of BALANCE_DEBIT_KEYS) {
    const val = reconciled[key];
    if (typeof val === 'number' && val < 0) {
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

        const remoteChanged = !same(remote, change.before);
        const sameAfter = same(remote, change.after);
        if (remoteChanged && (!sameAfter || hasCompetingDebit(change.before, remote, change.after))) {
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

export interface CommitFinancialCommandOptions {
  isActive?: () => boolean;
  reserveFloorR$?: number;
}

export interface CommitFinancialCommandOutcome {
  status: 'success' | 'conflict' | 'failure';
  reasonCode: FinancialCommandResult['reasonCode'] | 'TX_FAILED';
  message: string;
  committedState: AppState;
  idempotentReplay?: boolean;
  writtenEntities: Array<{ field: EntityField; id: string; after: SyncEntity | null }>;
  protectionUpdated?: boolean;
}

interface TouchedTargetDescriptor {
  field: EntityField;
  id: string;
  ref: ReturnType<typeof doc>;
  preRecord?: SyncEntity;
  postRecord: SyncEntity | null;
}

/**
 * Confirma atomicamente despesa + operação financeira + saldos de meta/cofrinho/espelho + reserva
 * em uma transação Firestore pequena (apenas os documentos tocados pelo comando).
 * Garante pré-condições remotas em centavos, revisão otimista e recuperação idempotente após queda/retry.
 */
export async function commitFinancialCommandTransaction(
  db: Firestore,
  coupleId: string,
  result: FinancialCommandResult,
  preState: AppState,
  options?: CommitFinancialCommandOptions
): Promise<CommitFinancialCommandOutcome> {
  if (result.status !== 'success') {
    return {
      status: result.status,
      reasonCode: result.reasonCode,
      message: result.message,
      committedState: preState,
      writtenEntities: [],
    };
  }

  const touched = result.touchedEntities;
  if (result.idempotentReplay && !touched) {
    return {
      status: 'success',
      reasonCode: 'IDEMPOTENT_REPLAY',
      message: result.message,
      committedState: result.state,
      idempotentReplay: true,
      writtenEntities: [],
    };
  }

  const findRecord = (list: unknown[] | undefined, id: string): SyncEntity | undefined =>
    (list as SyncEntity[] | undefined)?.find((item) => item?.id === id);

  const descriptors: TouchedTargetDescriptor[] = [];
  const pushField = (field: EntityField, ids?: string[]) => {
    if (!ids?.length) return;
    for (const id of ids) {
      if (!id) continue;
      if (descriptors.some((d) => d.field === field && d.id === id)) continue;
      const preRecord = findRecord(preState[field as keyof AppState] as unknown[] | undefined, id);
      const postRecord = findRecord(result.state[field as keyof AppState] as unknown[] | undefined, id) || null;
      descriptors.push({
        field,
        id,
        ref: entityRef(db, coupleId, field, id),
        preRecord,
        postRecord,
      });
    }
  };

  pushField('financialOperations', touched?.financialOperations);
  pushField('piggyBanks', touched?.piggyBanks);
  pushField('coupleGoals', touched?.coupleGoals);
  pushField('expenses', touched?.expenses);
  pushField('strategicIntents', touched?.strategicIntents);
  pushField('dreamSimulations', touched?.dreamSimulations);
  pushField('coupleWishlist', touched?.coupleWishlist);
  pushField('coupleFixedBills', touched?.coupleFixedBills);

  if (!descriptors.length && !touched?.protectionUpdated) {
    return {
      status: 'success',
      reasonCode: result.reasonCode,
      message: result.message,
      committedState: result.state,
      writtenEntities: [],
    };
  }

  const isActive = options?.isActive || (() => true);
  const coupleRef = touched?.protectionUpdated ? doc(db, 'couples', coupleId) : null;

  let txReplay = false;
  const writtenEntities: Array<{ field: EntityField; id: string; after: SyncEntity | null }> = [];
  let confirmedState = result.state;

  try {
    await runTransaction(db, async (tx) => {
      if (!isActive()) {
        throw new Error('Sessão encerrada ou alterada antes da confirmação da transação.');
      }

      const entitySnaps = await Promise.all(descriptors.map((d) => tx.get(d.ref)));
      const coupleSnap = coupleRef ? await tx.get(coupleRef) : null;

      if (!isActive()) {
        throw new Error('Sessão alterada durante a leitura transacional.');
      }

      const opTargets = descriptors.filter((d) => d.field === 'financialOperations');
      let replayedOpsCount = 0;

      for (let i = 0; i < descriptors.length; i++) {
        const desc = descriptors[i];
        const snap = entitySnaps[i];
        const snapData = snap.exists() ? snap.data() : null;
        const remoteRecord = snapData && !snapData.deleted ? (snapData.record as SyncEntity | undefined) : undefined;

        if (desc.field === 'financialOperations' && desc.postRecord) {
          const postOp = desc.postRecord as unknown as FinancialOperationRecord;
          if (remoteRecord) {
            const remoteOp = remoteRecord as unknown as FinancialOperationRecord;
            if (postOp.state !== 'reverted' && postOp.state !== 'estornado') {
              const postFp =
                postOp.commandFingerprint || computeOperationFingerprint(postOp, readOperationAmountCents(postOp));
              const remoteFp =
                remoteOp.commandFingerprint || computeOperationFingerprint(remoteOp, readOperationAmountCents(remoteOp));
              if (postFp === remoteFp) {
                replayedOpsCount++;
              } else {
                throw new Error(
                  `Conflito de replay na nuvem: operação "${desc.id}" já foi confirmada com intenção diferente.`
                );
              }
            } else if (remoteOp.state === 'reverted' || remoteOp.state === 'estornado') {
              if (remoteOp.revertedBy && remoteOp.revertedBy === postOp.revertedBy) {
                replayedOpsCount++;
              } else {
                throw new Error(`Conflito: operação "${desc.id}" já foi estornada anteriormente.`);
              }
            }
          }
        }
      }

      if (opTargets.length > 0 && replayedOpsCount === opTargets.length) {
        // Todos os comandos operacionais deste lote já estão confirmados na nuvem (recuperação pós-falha de resposta).
        txReplay = true;
        return;
      }

      // Verificar pré-condições remotas para metas, cofrinhos e intenções
      for (let i = 0; i < descriptors.length; i++) {
        const desc = descriptors[i];
        const snap = entitySnaps[i];
        const snapData = snap.exists() ? snap.data() : null;
        const remoteRecord = snapData && !snapData.deleted ? (snapData.record as SyncEntity | undefined) : undefined;

        if (desc.field === 'piggyBanks' || desc.field === 'coupleGoals') {
          if (desc.preRecord && (!snap.exists() || snapData?.deleted)) {
            throw new Error(`Meta "${desc.id}" não existe mais na nuvem.`);
          }
          if (remoteRecord) {
            if (remoteRecord.archived || remoteRecord.isDeleted) {
              throw new Error(`Meta "${desc.id}" está arquivada para novo uso.`);
            }
            if (desc.preRecord && desc.postRecord) {
              const preRev = typeof desc.preRecord.revision === 'number' ? desc.preRecord.revision : 0;
              const remoteRev = typeof remoteRecord.revision === 'number' ? remoteRecord.revision : 0;

              const preAvailCents =
                typeof desc.preRecord.availableCents === 'number'
                  ? desc.preRecord.availableCents
                  : Math.round(((desc.preRecord.currentAmount as number) || 0) * 100);
              const postAvailCents =
                typeof desc.postRecord.availableCents === 'number'
                  ? desc.postRecord.availableCents
                  : Math.round(((desc.postRecord.currentAmount as number) || 0) * 100);
              const remoteAvailCents =
                typeof remoteRecord.availableCents === 'number'
                  ? remoteRecord.availableCents
                  : Math.round(((remoteRecord.currentAmount as number) || 0) * 100);

              const deltaAvailCents = postAvailCents - preAvailCents;
              if (deltaAvailCents < 0 && remoteAvailCents + deltaAvailCents < 0) {
                throw new Error(
                  `Saldo insuficiente na nuvem para meta "${desc.id}" (R$ ${(remoteAvailCents / 100).toFixed(2)}). Operação concorrente bloqueada.`
                );
              }
              if (remoteRev !== preRev) {
                throw new Error(
                  `Conflito concorrente na meta "${desc.id}" (revisão esperada ${preRev}, atual ${remoteRev}). Recarregue antes de tentar novamente.`
                );
              }
            }
          }
        } else if (desc.field === 'strategicIntents' && remoteRecord && desc.postRecord) {
          const remoteMatched = remoteRecord.matchedExpenseId as string | undefined;
          const postMatched = desc.postRecord.matchedExpenseId as string | undefined;
          if (
            (remoteRecord.status === 'matched' || remoteRecord.status === 'executed') &&
            remoteMatched &&
            postMatched &&
            remoteMatched !== postMatched
          ) {
            throw new Error(`Conflito: intenção "${desc.id}" já reconciliada em outra sessão.`);
          }
        }
      }

      if (coupleRef && coupleSnap && coupleSnap.exists()) {
        const cData = coupleSnap.data() || {};
        const remoteProtCents = Math.round(((cData.protectionCurrentAmount as number) ?? (preState.protectionCurrentAmount || 0)) * 100);
        const preProtCents = Math.round((preState.protectionCurrentAmount || 0) * 100);
        const postProtCents = Math.round((result.state.protectionCurrentAmount || 0) * 100);
        const deltaProtCents = postProtCents - preProtCents;
        const floorCents = Math.round((options?.reserveFloorR$ ?? 0) * 100);
        const remoteExcessCents = Math.max(0, remoteProtCents - floorCents);
        if (deltaProtCents < 0 && remoteExcessCents + deltaProtCents < 0) {
          throw new Error(
            `Excesso da reserva insuficiente na nuvem (R$ ${(remoteExcessCents / 100).toFixed(2)}). Operação concorrente bloqueada.`
          );
        }
      }

      const confirmedAt = new Date().toISOString();

      for (const desc of descriptors) {
        let payloadRecord = desc.postRecord ? JSON.parse(JSON.stringify(desc.postRecord)) : null;
        if (payloadRecord && desc.field === 'financialOperations') {
          payloadRecord = { ...payloadRecord, confirmedAt: payloadRecord.confirmedAt || confirmedAt };
        }
        tx.set(desc.ref, {
          field: desc.field,
          record: payloadRecord,
          deleted: !payloadRecord,
          schemaVersion: 1,
        });
        writtenEntities.push({ field: desc.field, id: desc.id, after: payloadRecord });
      }

      if (coupleRef) {
        const patch = {
          protectionCurrentAmount: result.state.protectionCurrentAmount,
          protectionTotalInvested: result.state.protectionTotalInvested,
          isProtectionComplete: result.state.isProtectionComplete,
          updatedAt: confirmedAt,
        };
        if (typeof (tx as any).update === 'function') {
          (tx as any).update(coupleRef, patch);
        } else {
          tx.set(coupleRef, patch, { merge: true });
        }
      }

      if (result.state.financialOperations?.length) {
        confirmedState = {
          ...result.state,
          financialOperations: result.state.financialOperations.map((op) =>
            touched?.financialOperations?.includes(op.id) && !op.confirmedAt ? { ...op, confirmedAt } : op
          ),
        };
      }
    });
  } catch (err: any) {
    const msg = err?.message || 'Falha na transação financeira.';
    const isConflict = /Conflito|replay|estornada|concorrente/i.test(msg);
    return {
      status: isConflict ? 'conflict' : 'failure',
      reasonCode: isConflict ? 'CONFLICT_REVISION' : 'TX_FAILED',
      message: msg,
      committedState: preState,
      writtenEntities: [],
    };
  }

  return {
    status: 'success',
    reasonCode: txReplay ? 'IDEMPOTENT_REPLAY' : result.reasonCode,
    message: txReplay ? 'Operação já confirmada anteriormente na nuvem (replay idempotente).' : result.message,
    committedState: confirmedState,
    idempotentReplay: txReplay,
    writtenEntities,
    protectionUpdated: Boolean(touched?.protectionUpdated),
  };
}

