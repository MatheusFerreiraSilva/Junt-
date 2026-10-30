import type { Express } from 'express';
import { adminDb, userQuota } from './security';
import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isAvatarConfig, type AvatarConfig } from '../src/avatars/avatarConfig';

export interface SavedAvatar {
  ownerUid: string;
  revision: number;
  config: AvatarConfig;
}
class AvatarFailure extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function sameConfig(a: AvatarConfig, b: AvatarConfig) {
  return Object.keys(a).every(key => a[key as keyof AvatarConfig] === b[key as keyof AvatarConfig]);
}
// Match the named database selected by src/lib/firebase.ts without changing other APIs.
function avatarDb() {
  adminDb(); // Reuse existing Admin initialization/credentials only.
  return getFirestore(getApp(), firebaseConfig.firestoreDatabaseId || '(default)');
}
export function registerAvatars(app: Express) {
  // requireAuth is mounted on /api by server.ts before this registration.
  app.post('/api/couples/avatar', userQuota(30, 60_000, 500, avatarDb), async (req, res) => {
    const { config, expectedRevision, coupleId } = req.body || {};
    if (!isAvatarConfig(config) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || expectedRevision >= Number.MAX_SAFE_INTEGER || typeof coupleId !== 'string' || !/^[\w-]{1,128}$/.test(coupleId)) {
      res.status(400).json({ error: 'Escolha opções válidas para o avatar e tente novamente.' }); return;
    }
    try {
      const uid = res.locals.uid;
      if (typeof uid !== 'string' || !uid) {
        throw new AvatarFailure(403, 'Seu vínculo mudou. Entre novamente para salvar o avatar.');
      }
      const db = avatarDb();
      const result = await db.runTransaction(async tx => {
        const coupleRef = db.doc(`couples/${coupleId}`);
        const [coupleSnap, profileSnap] = await Promise.all([tx.get(coupleRef), tx.get(db.doc(`users/${uid}`))]);
        const couple = coupleSnap.data(); const profile = profileSnap.data();
        // Membership rechecked in the write transaction closes leave/join races.
        if (!couple || profile?.coupleId !== coupleId || couple.departedMembers?.[uid]) {
          throw new AvatarFailure(403, 'Seu vínculo mudou. Entre novamente para salvar o avatar.');
        }
        const role = couple.partner1Uid === uid ? 'partner1' : couple.partner2Uid === uid ? 'partner2' : null;
        if (!role) throw new AvatarFailure(403, 'Você só pode editar o seu próprio avatar.');
        const previous: SavedAvatar | undefined = couple.avatarProfiles?.[role];
        const revision = previous?.revision ?? 0;
        if (!Number.isSafeInteger(revision) || revision < 0 || (previous && previous.ownerUid !== uid)) {
          throw new AvatarFailure(409, 'O perfil mudou. Recarregue o avatar antes de salvar.');
        }
        if (expectedRevision !== revision) {
          if (previous && expectedRevision === revision - 1 && isAvatarConfig(previous.config) && sameConfig(previous.config, config)) {
            return { avatar: previous, role };
          }
          throw new AvatarFailure(409, 'O avatar foi atualizado em outro dispositivo. Recarregue antes de salvar.');
        }
        const avatar: SavedAvatar = { ownerUid: uid, revision: revision + 1, config };
        // A single metadata field: do not overwrite finances or the partner's avatar.
        tx.update(coupleRef, { avatarProfiles: { ...(couple.avatarProfiles || {}), [role]: avatar } });
        return { avatar, role };
      });
      res.json(result);
    } catch (error) {
      const known = error instanceof AvatarFailure;
      res.status(known ? error.status : 503).json({
        error: known ? error.message : 'Não foi possível salvar na nuvem. Seu rascunho foi preservado; tente novamente.',
      });
    }
  });
}
