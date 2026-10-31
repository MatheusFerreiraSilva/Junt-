import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAvatarConfig, parseStoredAvatarConfig, type AvatarConfig } from './avatarConfig';
export interface CloudAvatarRecord { ownerUid: string; revision: number; config: AvatarConfig }
export function readCloudAvatar(input: unknown, uid: string): CloudAvatarRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as CloudAvatarRecord;
  const config = parseStoredAvatarConfig(value.config);
  return value.ownerUid === uid && Number.isSafeInteger(value.revision) && value.revision > 0 && config
    ? { ownerUid: uid, revision: value.revision, config } : null;
}
export class CloudAvatarConflictError extends Error {
  constructor(public readonly currentAvatar: CloudAvatarRecord | null) { super('O avatar mudou em outro dispositivo. Revise a versão salva.'); }
}
export async function saveAvatarToCloud(uid: string, config: AvatarConfig, expectedRevision: number, isCurrent: () => boolean, database: Firestore = db): Promise<CloudAvatarRecord> {
  if (!isAvatarConfig(config) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER)
    throw new Error('Escolha uma configuração válida para salvar.');
  const assertSession = () => { if (!isCurrent()) throw new Error('A sessão mudou. Seu rascunho não foi enviado para outra conta.'); };
  assertSession();
  const saved = await runTransaction(database, async tx => {
    const ref = doc(database, 'avatars', uid);
    const raw = (await tx.get(ref)).data();
    assertSession();
    const current = readCloudAvatar(raw, uid);
    if (raw !== undefined && !current) throw new CloudAvatarConflictError(null);
    const revision = current?.revision || 0;
    if (revision !== expectedRevision) {
      const same = current && Object.keys(config).every(key => current.config[key as keyof AvatarConfig] === config[key as keyof AvatarConfig]);
      if (current && revision === expectedRevision + 1 && same) return current;
      throw new CloudAvatarConflictError(current);
    }
    const next = { ownerUid: uid, revision: revision + 1, config };
    tx.set(ref, next);
    return next;
  });
  assertSession();
  return saved;
}

/** Copy only the verified owner's recipe. Starting a personal document starts its own revision. */
export async function migrateAvatarToCloud(uid: string, coupleId: string, isCurrent: () => boolean, database: Firestore = db): Promise<CloudAvatarRecord | null> {
  const assertSession = () => { if (!isCurrent()) throw new Error('A sessão mudou. Migração interrompida.'); };
  assertSession();
  const saved = await runTransaction(database, async tx => {
    const ref = doc(database, 'avatars', uid);
    const raw = (await tx.get(ref)).data(); assertSession();
    if (raw !== undefined) {
      const current = readCloudAvatar(raw, uid);
      if (!current) throw new CloudAvatarConflictError(null);
      return current;
    }
    const profile = (await tx.get(doc(database, 'users', uid))).data();
    if (profile?.coupleId !== coupleId || !coupleId) return null;
    const couple = (await tx.get(doc(database, 'couples', coupleId))).data(); assertSession();
    const role = couple?.partner1Uid === uid ? 'partner1' : couple?.partner2Uid === uid ? 'partner2' : null;
    if (!role || couple?.departedMembers?.[uid]) return null;
    const legacy = readCloudAvatar(couple?.avatarProfiles?.[role], uid);
    if (!legacy) return null;
    const next = { ownerUid: uid, revision: 1, config: legacy.config };
    tx.set(ref, next); return next;
  });
  assertSession(); return saved;
}
