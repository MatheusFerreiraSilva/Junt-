// @vitest-environment node
import express from 'express';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Ref = { path: string; id: string };
  const rows = new Map<string, Row>();
  const ref = (path: string): Ref => ({ path, id: path.split('/').at(-1)! });
  let serial = Promise.resolve<unknown>(undefined);
  const db = {
    doc: ref,
    collection: (name: string) => ({ doc: () => ref(`${name}/new-couple`) }),
    runTransaction: (callback: (tx: object) => Promise<unknown>) => {
      const task = serial.then(async () => {
        const changes: (() => void)[] = [];
        const tx = {
          get: async (target: Ref) => ({ data: () => rows.has(target.path) ? structuredClone(rows.get(target.path)) : undefined }),
          create: (target: Ref, data: Row) => { if (rows.has(target.path)) throw new Error('exists'); changes.push(() => rows.set(target.path, structuredClone(data))); },
          set: (target: Ref, data: Row, options?: { merge?: boolean }) => changes.push(() => rows.set(target.path, { ...(options?.merge ? rows.get(target.path) : {}), ...structuredClone(data) })),
          update: (target: Ref, data: Row) => { if (!rows.has(target.path)) throw new Error('missing'); changes.push(() => rows.set(target.path, { ...rows.get(target.path), ...structuredClone(data) })); },
        };
        const result = await callback(tx); changes.forEach(change => change()); return result;
      });
      serial = task.catch(() => undefined); return task;
    },
  };
  return { rows, db };
});
vi.mock('./security', () => ({ adminDb: () => fake.db, authorizedCouple: async () => 'couple-1', userQuota: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
import { registerCouples } from './couples';

const code = 'abcdefghijklmnopqrstuvwx';
const invitePath = `coupleInvites/${createHash('sha256').update(code).digest('hex')}`;
let server: Server;
let origin = '';
beforeEach(async () => {
  fake.rows.clear();
  fake.rows.set('couples/couple-1', { id: 'couple-1', partner1Uid: 'owner', partner2Uid: '', partner1Name: 'Pessoa 1', partner2Name: 'Pessoa 2' });
  fake.rows.set(invitePath, { coupleId: 'couple-1', createdBy: 'owner', expiresAt: Date.now() + 60_000, used: false });
  const app = express(); app.use(express.json()); app.use((req, res, next) => { res.locals.uid = req.header('X-Test-Uid'); next(); }); registerCouples(app);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port'); origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const join = (uid: string) => fetch(`${origin}/api/couples/join`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Uid': uid }, body: JSON.stringify({ inviteCode: code }) });

describe('transactional couple invitations', () => {
  it('consumes a legitimate invite and returns only the authorized couple and profile', async () => {
    const response = await join('partner'); expect(response.status).toBe(200);
    const result = await response.json(); expect(result.couple.partner2Uid).toBe('partner'); expect(result.profile.coupleId).toBe('couple-1');
    expect(fake.rows.get(invitePath)?.used).toBe(true);
  });
  it('denies an expired invite without creating membership or returning financial data', async () => {
    fake.rows.set(invitePath, { ...fake.rows.get(invitePath), expiresAt: Date.now() - 1 });
    const response = await join('partner'); expect(response.status).toBe(409); expect((await response.json()).couple).toBeUndefined();
    expect(fake.rows.get('users/partner')).toBeUndefined(); expect(fake.rows.get('couples/couple-1')?.partner2Uid).toBe('');
  });
  it('denies reuse by a different user', async () => {
    expect((await join('first')).status).toBe(200); expect((await join('second')).status).toBe(409);
    expect(fake.rows.get('users/second')).toBeUndefined(); expect(fake.rows.get('couples/couple-1')?.partner2Uid).toBe('first');
  });
  it('allows exactly one of two simultaneous joins', async () => {
    const results = await Promise.all([join('first'), join('second')]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(['first', 'second'].filter(uid => fake.rows.get(`users/${uid}`)?.coupleId === 'couple-1')).toHaveLength(1);
  });
  it('denies a third member even with an unused invite', async () => {
    fake.rows.set('couples/couple-1', { ...fake.rows.get('couples/couple-1'), partner2Uid: 'existing-partner' });
    expect((await join('third')).status).toBe(409); expect(fake.rows.get('users/third')).toBeUndefined();
  });
  it('does not transfer someone who already belongs to another couple', async () => {
    fake.rows.set('users/partner', { coupleId: 'other-couple' });
    expect((await join('partner')).status).toBe(409); expect(fake.rows.get('users/partner')?.coupleId).toBe('other-couple');
  });
});
