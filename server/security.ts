import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

export function adminDb() {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT });
  return getFirestore(getApp(), firebaseConfig.firestoreDatabaseId || '(default)');
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) { res.status(401).json({ error: 'Entre na sua conta para continuar.' }); return; }
  try {
    adminDb();
    const identity = await getAuth().verifyIdToken(bearer, true);
    res.locals.uid = identity.uid;
    res.locals.authProvider = identity.firebase?.sign_in_provider || '';
    res.locals.email = identity.email || "";
    next();
  } catch { res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' }); }
}

export async function authorizedCouple(uid: string): Promise<string | null> {
  const db = adminDb();
  const profile = await db.doc(`users/${uid}`).get();
  const coupleId: unknown = profile.data()?.coupleId;
  if (typeof coupleId !== 'string' || !/^[\w-]{1,128}$/.test(coupleId)) return null;
  const couple = await db.doc(`couples/${coupleId}`).get();
  const data = couple.data();
  return data && !data.departedMembers?.[uid] && (data.partner1Uid === uid || data.partner2Uid === uid) ? coupleId : null;
}

// Shared Firestore quotas work across instances; never fall back to an IP-only quota.
export function userQuota(max: number, windowMs: number, globalMax = 500, dbFactory: typeof adminDb = adminDb) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const route = req.path.replace(/[^a-z0-9]/gi, '_');
    const uid = String(res.locals.uid);
    try {
      const db = dbFactory();
      const refs = [db.doc(`apiQuotas/${route}_${window}_${uid}`), db.doc(`apiQuotas/${route}_${window}_global`)];
      const allowed = await db.runTransaction(async tx => {
        const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
        if (snapshots.some((snap, i) => (snap.data()?.count || 0) >= (i ? globalMax : max))) return false;
        refs.forEach((ref, i) => tx.set(ref, { count: (snapshots[i].data()?.count || 0) + 1, expiresAt: new Date((window + 2) * windowMs) }));
        return true;
      });
      if (res.writableEnded) return;
      if (!allowed) {
        const retryAfter = Math.ceil(((window + 1) * windowMs - now) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({ error: 'Limite de uso atingido. Tente novamente em instantes.', retryAfter }); return;
      }
      next();
    } catch { if (!res.headersSent) res.status(503).json({ error: 'Não foi possível verificar o limite de uso. Tente novamente.' }); }
  };
}
