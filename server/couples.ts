import { randomBytes, createHash } from 'node:crypto';
import type { Express } from 'express';
import { adminDb, authorizedCouple, userQuota } from './security';

const clean = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const invitation = () => randomBytes(18).toString('base64url');

export function registerCouples(app: Express) {
  app.post('/api/couples', userQuota(5, 60_000), async (req, res) => {
    try {
      const db = adminDb(); const uid = String(res.locals.uid);
      const profileRef = db.doc(`users/${uid}`); const coupleRef = db.collection('couples').doc();
      const code = invitation(); const createdAt = new Date().toISOString();
      const couple = { id: coupleRef.id, partner1Name: clean(req.body?.partner1Name, 'Pessoa 1'), partner2Name: clean(req.body?.partner2Name, 'Pessoa 2'), partner1Income: 0, partner2Income: 0, partner1Uid: uid, partner2Uid: '', inviteCode: code, createdAt, schemaVersion: 2 };
      const profile = await db.runTransaction(async tx => {
        const old = await tx.get(profileRef);
        if (old.data()?.coupleId) throw new Error('ALREADY_MEMBER');
        const result = { ...(old.data() || {}), uid, email: res.locals.email || '', displayName: clean(req.body?.displayName, couple.partner1Name), partnerRole: 'partner1', coupleId: coupleRef.id, createdAt: old.data()?.createdAt || createdAt };
        tx.create(coupleRef, couple); tx.set(profileRef, result);
        tx.create(db.doc(`coupleInvites/${hash(code)}`), { coupleId: coupleRef.id, createdBy: uid, expiresAt: Date.now() + 48 * 60 * 60 * 1000, used: false });
        return result;
      });
      res.status(201).json({ couple, profile });
    } catch { res.status(409).json({ error: 'Não foi possível criar o casal. Verifique seu vínculo atual.' }); }
  });
  app.post('/api/couples/join', userQuota(5, 60_000, 100), async (req, res) => {
    const code = req.body?.inviteCode;
    if (typeof code !== 'string' || !/^[\w-]{24}$/.test(code)) return void res.status(400).json({ error: 'Convite inválido ou expirado.' });
    try {
      const db = adminDb(); const uid = String(res.locals.uid);
      const result = await db.runTransaction(async tx => {
        const inviteRef = db.doc(`coupleInvites/${hash(code)}`); const profileRef = db.doc(`users/${uid}`);
        const [inviteSnap, profileSnap] = await Promise.all([tx.get(inviteRef), tx.get(profileRef)]);
        const invite = inviteSnap.data(); const previous = profileSnap.data();
        if (!invite || invite.used || invite.revoked || invite.expiresAt < Date.now() || previous?.coupleId) throw new Error('INVALID');
        const coupleRef = db.doc(`couples/${invite.coupleId}`); const snapshot = await tx.get(coupleRef); const data = snapshot.data();
        if (!data || data.partner2Uid || data.partner1Uid === uid || data.partner1Uid !== invite.createdBy) throw new Error('INVALID');
        const couple = { ...data, id: coupleRef.id, partner2Uid: uid, inviteCode: '' };
        const profile = { ...(previous || {}), uid, email: res.locals.email || '', displayName: clean(req.body?.displayName, data.partner2Name || 'Pessoa 2'), partnerRole: 'partner2', coupleId: coupleRef.id, createdAt: previous?.createdAt || new Date().toISOString() };
        tx.update(coupleRef, { partner2Uid: uid, inviteCode: '' }); tx.set(profileRef, profile); tx.update(inviteRef, { used: true, usedBy: uid });
        return { couple, profile };
      });
      res.json(result);
    } catch { res.status(409).json({ error: 'Convite inválido, expirado ou já utilizado. Confira seu vínculo atual.' }); }
  });
  app.post('/api/couples/invite', userQuota(5, 60_000), async (_req, res) => {
    try {
      const uid = String(res.locals.uid); const coupleId = await authorizedCouple(uid);
      if (!coupleId) return void res.status(403).json({ error: 'Vínculo não autorizado.' });
      const db = adminDb(); const code = invitation();
      await db.runTransaction(async tx => {
        const ref = db.doc(`couples/${coupleId}`); const snap = await tx.get(ref); const couple = snap.data();
        if (!couple || couple.partner1Uid !== uid || couple.partner2Uid) throw new Error('INVALID');
        if (couple.inviteCode) tx.set(db.doc(`coupleInvites/${hash(couple.inviteCode)}`), { revoked: true }, { merge: true });
        tx.create(db.doc(`coupleInvites/${hash(code)}`), { coupleId, createdBy: uid, expiresAt: Date.now() + 48 * 60 * 60 * 1000, used: false });
        tx.update(ref, { inviteCode: code });
      });
      res.json({ inviteCode: code });
    } catch { res.status(409).json({ error: 'Não foi possível gerar o convite.' }); }
  });
  app.post('/api/couples/leave', userQuota(5, 60_000), async (_req, res) => {
    try {
      const uid = String(res.locals.uid); const coupleId = await authorizedCouple(uid);
      if (!coupleId) return void res.status(403).json({ error: 'Vínculo não autorizado.' });
      const db = adminDb();
      await db.runTransaction(async tx => {
        const ref = db.doc(`couples/${coupleId}`); const snap = await tx.get(ref); const couple = snap.data();
        if (!couple || (couple.partner1Uid !== uid && couple.partner2Uid !== uid)) throw new Error('INVALID');
        // Keep historical identity: a departed member cannot be replaced by a third user.
        tx.update(ref, { departedMembers: { ...(couple.departedMembers || {}), [uid]: true } });
        tx.update(db.doc(`users/${uid}`), { coupleId: '', partnerRole: '' });
        if (couple.inviteCode) tx.set(db.doc(`coupleInvites/${hash(couple.inviteCode)}`), { revoked: true }, { merge: true });
      });
      res.json({ success: true });
    } catch { res.status(409).json({ error: 'Não foi possível sair do casal.' }); }
  });
}
