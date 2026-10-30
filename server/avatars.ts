import type { Express, Response } from 'express';
import { adminDb, userQuota } from './security';
import { getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isAvatarConfig, type AvatarConfig } from '../src/avatars/avatarConfig';

export interface SavedAvatar {
  ownerUid: string;
  revision: number;
  config: AvatarConfig;
}
class AvatarFailure extends Error {
  constructor(public status: number, message: string, public currentAvatar: SavedAvatar | null = null) { super(message); }
}
function sameConfig(a: AvatarConfig, b: AvatarConfig) {
  return Object.keys(a).every(key => a[key as keyof AvatarConfig] === b[key as keyof AvatarConfig]);
}
function personalRecord(value: unknown, uid: string): SavedAvatar | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<SavedAvatar>;
  return data.ownerUid === uid && Number.isSafeInteger(data.revision) && data.revision! > 0 && isAvatarConfig(data.config)
    ? { ownerUid: uid, revision: data.revision!, config: data.config } : null;
}
// Reuse credentials, but match the same named database as the existing frontend.
function avatarDb() {
  adminDb();
  return getFirestore(getApp(), firebaseConfig.firestoreDatabaseId || '(default)');
}
function authenticatedPerson(res: Response): string {
  const uid = res.locals.uid;
  if (typeof uid !== 'string' || !uid || res.locals.authProvider === 'anonymous') {
    throw new AvatarFailure(403, 'Entre em uma conta pessoal para salvar seu avatar na nuvem.');
  }
  return uid;
}
async function legacyMembership(tx: Transaction, db: Firestore, uid: string, expectedCoupleId?: string) {
  const profile = (await tx.get(db.doc(`users/${uid}`))).data();
  const coupleId: unknown = profile?.coupleId;
  if (typeof coupleId !== 'string' || !/^[\w-]{1,128}$/.test(coupleId)
    || (expectedCoupleId !== undefined && coupleId !== expectedCoupleId)) return null;
  const couple = (await tx.get(db.doc(`couples/${coupleId}`))).data();
  if (!couple || couple.departedMembers?.[uid]) return null;
  const role = couple.partner1Uid === uid ? 'partner1' : couple.partner2Uid === uid ? 'partner2' : null;
  return role ? { role, avatar: personalRecord(couple.avatarProfiles?.[role], uid) } : null;
}
function failure(res: Response, error: unknown) {
  const known = error instanceof AvatarFailure;
  res.status(known ? error.status : 503).json({
    error: known ? error.message : 'Não foi possível salvar na nuvem. Seu rascunho foi preservado; tente novamente.',
    ...(known && error.status === 409 ? { currentAvatar: error.currentAvatar } : {}),
  });
}
export function registerAvatars(app: Express) {
  // requireAuth already validates the token before any /api route is invoked.
  app.post(['/api/avatars/save', '/api/couples/avatar'], userQuota(30, 60_000, 500, avatarDb), async (req, res) => {
    try {
      const uid = authenticatedPerson(res);
      const { config, expectedRevision, coupleId } = req.body || {};
      const legacyAdapter = req.path === '/api/couples/avatar';
      if (!isAvatarConfig(config) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || expectedRevision >= Number.MAX_SAFE_INTEGER
        || (legacyAdapter && (typeof coupleId !== 'string' || !/^[\w-]{1,128}$/.test(coupleId)))) {
        throw new AvatarFailure(400, 'Escolha opções válidas para o avatar e tente novamente.');
      }
      const db = avatarDb();
      const result = await db.runTransaction(async tx => {
        const ref = db.doc(`avatars/${uid}`);
        const snapshot = await tx.get(ref);
        const raw = snapshot.data();
        const current = personalRecord(raw, uid);
        if (raw !== undefined && !current) {
          throw new AvatarFailure(409, 'Não foi possível confirmar o avatar desta conta. Atualize seu perfil antes de salvar.');
        }
        // Keep the old endpoint usable, but never write avatar data into financial documents.
        const legacy = legacyAdapter ? await legacyMembership(tx, db, uid, coupleId) : null;
        if (legacyAdapter && !legacy) throw new AvatarFailure(403, 'Seu vínculo mudou. Abra o perfil da sua conta para salvar.');
        const previous = current || legacy?.avatar || null;
        const revision = previous?.revision ?? 0;
        if (expectedRevision !== revision) {
          if (previous && expectedRevision === revision - 1 && sameConfig(previous.config, config)) {
            if (!current) tx.set(ref, previous);
            return { avatar: previous, ...(legacy ? { role: legacy.role } : {}) };
          }
          throw new AvatarFailure(409, 'O avatar foi atualizado em outro dispositivo. Revise a versão atual antes de salvar.', previous);
        }
        const avatar: SavedAvatar = { ownerUid: uid, revision: revision + 1, config };
        tx.set(ref, avatar);
        return { avatar, ...(legacy ? { role: legacy.role } : {}) };
      });
      res.json(result);
    } catch (error) { failure(res, error); }
  });

  app.post('/api/avatars/migrate', userQuota(30, 60_000, 500, avatarDb), async (_req, res) => {
    try {
      const uid = authenticatedPerson(res);
      const db = avatarDb();
      const avatar = await db.runTransaction(async tx => {
        const ref = db.doc(`avatars/${uid}`);
        const raw = (await tx.get(ref)).data();
        if (raw !== undefined) {
          const current = personalRecord(raw, uid);
          if (!current) throw new AvatarFailure(409, 'Não foi possível confirmar o avatar desta conta.');
          return current;
        }
        const legacy = await legacyMembership(tx, db, uid);
        if (!legacy?.avatar) return null;
        // Creation only after the absent read: a concurrent personal save retries the transaction.
        tx.create(ref, legacy.avatar);
        return legacy.avatar;
      });
      res.json({ avatar });
    } catch (error) { failure(res, error); }
  });
}
