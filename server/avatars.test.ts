// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR, AVATAR_OPTIONS } from '../src/avatars/avatarConfig';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Ref = { path: string };
  const rows = new Map<string, Row>();
  let serial = Promise.resolve<unknown>(undefined);
  return {
    rows,
    fail: false,
    db: {
      doc: (path: string): Ref => ({ path }),
      runTransaction: (callback: (tx: object) => Promise<unknown>) => {
        const task = serial.then(async () => {
          const changes: (() => void)[] = [];
          const tx = {
            get: async (ref: Ref) => ({ data: () => structuredClone(rows.get(ref.path)) }),
            update: (ref: Ref, value: Row) => { changes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(value) })); },
          };
          const result = await callback(tx);
          changes.forEach(change => change()); return result;
        });
        serial = task.catch(() => undefined); return task;
      },
    },
  };
});
vi.mock('./security', () => ({
  adminDb: () => { if (fake.fail) throw new Error('offline'); return fake.db; },
  userQuota: (_max: number, _window: number, _global: number, dbFactory: () => unknown) => (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    try { dbFactory(); next(); } catch { res.status(503).json({ error: 'offline' }); }
  },
}));
vi.mock('firebase-admin/app', () => ({ getApp: () => ({ name: 'configured-app' }) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn(() => fake.db) }));
import { registerAvatars } from './avatars';

let server: Server;
let origin = '';
const couplePath = 'couples/couple-1';
beforeEach(async () => {
  fake.rows.clear(); fake.fail = false; vi.mocked(getFirestore).mockClear();
  fake.rows.set(couplePath, {
    id: 'couple-1', partner1Uid: 'alice', partner2Uid: 'bob',
    partner1Income: 1000, categoryPercentages: { moradia: 30 }, avatarProfiles: {},
  });
  for (const uid of ['alice', 'bob']) fake.rows.set('users/' + uid, { uid, coupleId: 'couple-1' });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { res.locals.uid = req.header('X-Test-Uid'); next(); });
  registerAvatars(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const save = (uid: string, overrides: Record<string, unknown> = {}) => fetch(origin + '/api/couples/avatar', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Uid': uid },
  body: JSON.stringify({ coupleId: 'couple-1', config: DEFAULT_AVATAR, expectedRevision: 0, ...overrides }),
});
const profiles = () => fake.rows.get(couplePath)?.avatarProfiles as Record<string, { ownerUid: string; revision: number; config: typeof DEFAULT_AVATAR }>;
const different = () => ({ ...DEFAULT_AVATAR, mouth: AVATAR_OPTIONS.mouth.find(option => option.id !== DEFAULT_AVATAR.mouth)!.id });

describe('authenticated avatar persistence', () => {
  it('derives role from membership, ignores a forged target and preserves finances', async () => {
    const response = await save('alice', { role: 'partner2', ownerUid: 'bob' });
    expect(response.status).toBe(200);
    expect(getFirestore).toHaveBeenCalledWith({ name: 'configured-app' }, firebaseConfig.firestoreDatabaseId);
    expect(await response.json()).toMatchObject({ role: 'partner1', avatar: { ownerUid: 'alice', revision: 1, config: DEFAULT_AVATAR } });
    expect(profiles().partner2).toBeUndefined();
    expect(fake.rows.get(couplePath)?.partner1Income).toBe(1000);
    expect(fake.rows.get(couplePath)?.categoryPercentages).toEqual({ moradia: 30 });
  });
  it('rejects unsupported pieces, embedded markup, missing fields and invalid revisions', async () => {
    for (const overrides of [
      { config: { ...DEFAULT_AVATAR, hair: '<svg onload=alert(1)>' } },
      { config: { ...DEFAULT_AVATAR, html: '<script>' } }, { config: {} }, { config: null },
      { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER },
      { coupleId: '../other' },
    ]) expect((await save('alice', overrides)).status).toBe(400);
    expect(profiles()).toEqual({});
  });
  it('denies outsiders, missing sessions, departed members and stale membership inside transaction', async () => {
    expect((await save('outsider')).status).toBe(403);
    expect((await save('')).status).toBe(403);
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), departedMembers: { alice: true } });
    expect((await save('alice')).status).toBe(403);
    fake.rows.set('users/bob', { coupleId: 'other' });
    expect((await save('bob')).status).toBe(403);
    expect(profiles()).toEqual({});
  });
  it('rejects a stale couple context before writing', async () => {
    expect((await save('alice', { coupleId: 'other-couple' })).status).toBe(403);
    fake.rows.set('users/alice', { coupleId: 'other-couple' });
    expect((await save('alice')).status).toBe(403);
    expect(profiles()).toEqual({});
  });
  it('keeps simultaneous edits to different people and increments only each own revision', async () => {
    const results = await Promise.all([save('alice'), save('bob', { config: different() })]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    expect(profiles().partner1.ownerUid).toBe('alice'); expect(profiles().partner2.ownerUid).toBe('bob');
    expect(profiles().partner1.revision).toBe(1); expect(profiles().partner2.revision).toBe(1);
  });
  it('retries a lost response without duplicating revision, even if JSON key order differs', async () => {
    expect((await save('alice')).status).toBe(200);
    const reversed = Object.fromEntries(Object.entries(DEFAULT_AVATAR).reverse());
    expect((await save('alice', { config: reversed })).status).toBe(200);
    expect(profiles().partner1.revision).toBe(1);
  });
  it('rejects conflicting changes and permits an explicit updated revision', async () => {
    expect((await save('alice')).status).toBe(200);
    expect((await save('alice', { config: different() })).status).toBe(409);
    expect(profiles().partner1.config).toEqual(DEFAULT_AVATAR);
    expect((await save('alice', { config: different(), expectedRevision: 1 })).status).toBe(200);
    expect(profiles().partner1.revision).toBe(2);
    expect((await save('alice', { expectedRevision: 0 })).status).toBe(409);
  });
  it('does not take ownership of an avatar belonging to another identity', async () => {
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: { ownerUid: 'former', revision: 1, config: DEFAULT_AVATAR } } });
    expect((await save('alice', { expectedRevision: 1 })).status).toBe(409);
    expect(profiles().partner1.ownerUid).toBe('former');
  });
  it('returns a recoverable failure without writing when storage is unavailable', async () => {
    fake.fail = true;
    const response = await save('alice');
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
    expect(profiles()).toEqual({});
  });
});
