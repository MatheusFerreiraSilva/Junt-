// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR, AVATAR_OPTIONS } from '../src/avatars/avatarConfig';
import firebaseConfig from '../firebase-applet-config.json';

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Ref = { path: string };
  const rows = new Map<string, Row>();
  let serial = Promise.resolve<unknown>(undefined);
  return {
    rows, fail: false, beforeTransaction: undefined as (() => void) | undefined,
    db: {
      doc: (path: string): Ref => ({ path }),
      runTransaction: (callback: (tx: object) => Promise<unknown>) => {
        const task = serial.then(async () => {
          fake.beforeTransaction?.();
          const changes: (() => void)[] = [];
          const tx = {
            get: async (ref: Ref) => ({ exists: rows.has(ref.path), data: () => structuredClone(rows.get(ref.path)) }),
            create: (ref: Ref, value: Row) => { if (rows.has(ref.path)) throw new Error('exists'); changes.push(() => rows.set(ref.path, structuredClone(value))); },
            set: (ref: Ref, value: Row) => { changes.push(() => rows.set(ref.path, structuredClone(value))); },
            update: (ref: Ref, value: Row) => { changes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(value) })); },
          };
          const result = await callback(tx); changes.forEach(change => change()); return result;
        });
        serial = task.catch(() => undefined); return task;
      },
    },
  };
});
vi.mock('./security', () => ({
  adminDb: () => { if (fake.fail) throw new Error('offline'); return {}; },
  userQuota: (_max: number, _window: number, _global: number, dbFactory: () => unknown) => (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    try { dbFactory(); next(); } catch { res.status(503).json({ error: 'offline' }); }
  },
}));
vi.mock('firebase-admin/app', () => ({ getApp: () => ({ name: 'configured-app' }) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: (_app: unknown, databaseId: string) => {
    if (databaseId !== firebaseConfig.firestoreDatabaseId) throw new Error('Wrong database');
    return fake.db;
  },
}));
import { registerAvatars } from './avatars';

let server: Server;
let origin = '';
const couplePath = 'couples/couple-1';
const stored = (uid: string) => fake.rows.get('avatars/' + uid);
const different = () => ({ ...DEFAULT_AVATAR, mouth: AVATAR_OPTIONS.mouth.find(option => option.id !== DEFAULT_AVATAR.mouth)!.id });
const record = (uid: string, revision = 1, config = DEFAULT_AVATAR) => ({ ownerUid: uid, revision, config });

beforeEach(async () => {
  fake.rows.clear(); fake.fail = false; fake.beforeTransaction = undefined;
  fake.rows.set(couplePath, {
    id: 'couple-1', partner1Uid: 'alice', partner2Uid: 'bob', partner1Income: 1000,
    categoryPercentages: { moradia: 30 }, avatarProfiles: {},
  });
  for (const uid of ['alice', 'bob']) fake.rows.set('users/' + uid, { uid, coupleId: 'couple-1' });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    res.locals.uid = req.header('X-Test-Uid');
    res.locals.authProvider = req.header('X-Test-Provider') || 'password';
    next();
  });
  registerAvatars(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const post = (path: string, uid: string, body: unknown, provider = 'password') => fetch(origin + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Uid': uid, 'X-Test-Provider': provider },
  body: JSON.stringify(body),
});
const save = (uid: string, overrides: Record<string, unknown> = {}) => post('/api/avatars/save', uid, {
  config: DEFAULT_AVATAR, expectedRevision: 0, ...overrides,
});
const migrate = (uid: string) => post('/api/avatars/migrate', uid, {});

describe('account-owned avatars', () => {
  it('lets an active partner create the other account avatar without changing ownership or finances', async () => {
    const before = structuredClone(fake.rows.get(couplePath));
    const response = await save('alice', { targetUid: 'bob', ownerUid: 'alice' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ avatar: record('bob') });
    expect(stored('bob')).toEqual(record('bob'));
    expect(stored('alice')).toBeUndefined();
    expect(fake.rows.get(couplePath)).toEqual(before);
  });
  it('lets either active partner update an avatar while detecting conflicts on its owner revision', async () => {
    fake.rows.set('avatars/alice', record('alice', 2));
    expect((await save('bob', { targetUid: 'alice', expectedRevision: 2, config: different() })).status).toBe(200);
    expect(stored('alice')).toEqual(record('alice', 3, different()));
    const stale = await save('alice', { expectedRevision: 2 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ currentAvatar: record('alice', 3, different()) });
    expect((await save('bob', { targetUid: 'alice', expectedRevision: 2, config: different() })).status).toBe(200);
    expect(stored('alice')?.revision).toBe(3);
    expect(stored('bob')).toBeUndefined();
  });
  it('requires both profiles and active exact couple identities before editing another account', async () => {
    expect((await save('outsider', { targetUid: 'bob' })).status).toBe(403);
    fake.rows.set('users/outsider', { coupleId: 'couple-1' });
    expect((await save('outsider', { targetUid: 'bob' })).status).toBe(403);
    fake.rows.set('users/bob', { coupleId: 'other' });
    expect((await save('alice', { targetUid: 'bob' })).status).toBe(403);
    fake.rows.set('users/bob', { coupleId: 'couple-1' });
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), departedMembers: { bob: true } });
    expect((await save('alice', { targetUid: 'bob' })).status).toBe(403);
    expect(stored('bob')).toBeUndefined();
  });
  it('rechecks departure and profile changes inside the avatar transaction', async () => {
    fake.beforeTransaction = () => {
      fake.rows.set('users/bob', { coupleId: '' });
    };
    expect((await save('alice', { targetUid: 'bob' })).status).toBe(403);
    expect(stored('bob')).toBeUndefined();
    fake.rows.set('users/bob', { coupleId: 'couple-1' });
    fake.beforeTransaction = () => {
      fake.rows.set(couplePath, { ...fake.rows.get(couplePath), departedMembers: { alice: true } });
    };
    expect((await save('alice', { targetUid: 'bob' })).status).toBe(403);
    expect(stored('bob')).toBeUndefined();
  });
  it('rejects malformed target identities before looking up a document', async () => {
    for (const targetUid of ['', '../bob', 'couple/bob', 'a'.repeat(129), 42, null]) {
      expect((await save('alice', { targetUid })).status).toBe(400);
    }
    expect(stored('bob')).toBeUndefined();
  });
  it('saves for an authenticated account without a couple in the configured database', async () => {
    fake.rows.delete('users/alice');
    const response = await save('alice');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ avatar: record('alice') });
    expect(stored('alice')).toEqual(record('alice'));
    expect(fake.rows.get(couplePath)?.avatarProfiles).toEqual({});
  });
  it('derives ownership exclusively from the token and never overwrites financial or partner records', async () => {
    const before = structuredClone(fake.rows.get(couplePath));
    const response = await save('alice', { ownerUid: 'bob', uid: 'bob', role: 'partner2', coupleId: 'other' });
    expect(response.status).toBe(200);
    expect(stored('alice')).toEqual(record('alice'));
    expect(stored('bob')).toBeUndefined();
    expect(fake.rows.get(couplePath)).toEqual(before);
  });
  it('rejects anonymous and missing identities for save and migration', async () => {
    for (const path of ['/api/avatars/save', '/api/avatars/migrate']) {
      const body = { config: DEFAULT_AVATAR, expectedRevision: 0 };
      expect((await post(path, 'anonymous-user', body, 'anonymous')).status).toBe(403);
      expect((await post(path, '', body)).status).toBe(403);
    }
    expect(stored('anonymous-user')).toBeUndefined();
    expect((await post('/api/avatars/save', 'alice', { targetUid: 'bob', config: DEFAULT_AVATAR, expectedRevision: 0 }, 'anonymous')).status).toBe(403);
    expect(stored('bob')).toBeUndefined();
  });
  it('recognizes a pre-gender personal recipe without resetting any saved choice', async () => {
    const { gender: _gender, ...legacyConfig } = { ...DEFAULT_AVATAR, hair: 'long' as const, outfit: 'tee' as const };
    fake.rows.set('avatars/alice', { ownerUid: 'alice', revision: 4, config: legacyConfig });
    const migration = await migrate('alice');
    expect(migration.status).toBe(200);
    expect(await migration.json()).toEqual({ avatar: record('alice', 4, { ...legacyConfig, gender: DEFAULT_AVATAR.gender }) });
    expect(stored('alice')?.config).toEqual(legacyConfig);
    const response = await save('bob', { targetUid: 'alice', config: different(), expectedRevision: 4 });
    expect(response.status).toBe(200);
    expect(stored('alice')).toEqual(record('alice', 5, different()));
  });
  it('rejects unsupported pieces, markup, incomplete configs and unsafe revisions', async () => {
    for (const overrides of [
      { config: { ...DEFAULT_AVATAR, hair: '<svg onload=alert(1)>' } },
      { config: { ...DEFAULT_AVATAR, html: '<script>' } }, { config: {} }, { config: null },
      { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER },
    ]) expect((await save('alice', overrides)).status).toBe(400);
    expect(stored('alice')).toBeUndefined();
  });
  it('returns the current personal record on revision conflict and preserves it', async () => {
    expect((await save('alice')).status).toBe(200);
    const response = await save('alice', { config: different() });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ currentAvatar: record('alice') });
    expect(stored('alice')).toEqual(record('alice'));
  });
  it('retries a lost response without a duplicate revision despite JSON key order', async () => {
    expect((await save('alice')).status).toBe(200);
    expect((await save('alice', { config: Object.fromEntries(Object.entries(DEFAULT_AVATAR).reverse()) })).status).toBe(200);
    expect(stored('alice')?.revision).toBe(1);
  });
  it('permits an explicit resolved revision and rejects outdated proposals', async () => {
    await save('alice');
    expect((await save('alice', { config: different(), expectedRevision: 1 })).status).toBe(200);
    expect(stored('alice')?.revision).toBe(2);
    expect((await save('alice')).status).toBe(409);
  });
  it('keeps concurrent saves from two accounts independent and same-account conflicts visible', async () => {
    const responses = await Promise.all([save('alice'), save('bob')]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(stored('alice')?.ownerUid).toBe('alice'); expect(stored('bob')?.ownerUid).toBe('bob');
    const contested = await Promise.all([
      save('alice', { config: different(), expectedRevision: 1 }),
      save('alice', { config: DEFAULT_AVATAR, expectedRevision: 1 }),
    ]);
    expect(contested.map(response => response.status).sort()).toEqual([200, 409]);
  });
  it('does not claim a malformed record owned by another UID', async () => {
    fake.rows.set('avatars/alice', record('bob'));
    const response = await save('alice', { expectedRevision: 1 });
    expect(response.status).toBe(409);
    expect((await response.json()).currentAvatar).toBeNull();
    expect(stored('alice')?.ownerUid).toBe('bob');
  });
  it('migrates only the active member own legacy avatar and leaves the couple untouched', async () => {
    const legacy = record('alice', 3);
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: legacy, partner2: record('bob', 4) } });
    const before = structuredClone(fake.rows.get(couplePath));
    const response = await migrate('alice');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ avatar: legacy });
    expect(stored('alice')).toEqual(legacy); expect(stored('bob')).toBeUndefined();
    expect(fake.rows.get(couplePath)).toEqual(before);
  });
  it('never overwrites an existing personal choice during repeated or concurrent migrations', async () => {
    const personal = record('alice', 8, different());
    fake.rows.set('avatars/alice', personal);
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: record('alice', 3) } });
    const responses = await Promise.all([migrate('alice'), migrate('alice')]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(stored('alice')).toEqual(personal);
  });
  it('does not migrate from a stale, departed, foreign or mismatched legacy membership', async () => {
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: record('alice'), partner2: record('bob') }, departedMembers: { alice: true } });
    expect((await migrate('alice')).status).toBe(200);
    expect(stored('alice')).toBeUndefined();
    fake.rows.set('users/outsider', { coupleId: 'couple-1', partnerRole: 'partner1' });
    expect((await migrate('outsider')).status).toBe(200);
    expect(stored('outsider')).toBeUndefined();
    fake.rows.set('users/bob', { coupleId: 'other' });
    expect((await migrate('bob')).status).toBe(200);
    expect(stored('bob')).toBeUndefined();
  });
  it('does not migrate corrupt or wrong-owner legacy recipes', async () => {
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: record('bob') } });
    expect((await migrate('alice')).status).toBe(200);
    expect(stored('alice')).toBeUndefined();
    fake.rows.set(couplePath, { ...fake.rows.get(couplePath), avatarProfiles: { partner1: { ...record('alice'), config: {} } } });
    expect((await migrate('alice')).status).toBe(200);
    expect(stored('alice')).toBeUndefined();
  });
  it('adapts the old route to personal storage while checking its couple context', async () => {
    const response = await post('/api/couples/avatar', 'alice', { coupleId: 'couple-1', config: DEFAULT_AVATAR, expectedRevision: 0 });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ role: 'partner1', avatar: record('alice') });
    expect(stored('alice')).toEqual(record('alice'));
    expect(fake.rows.get(couplePath)?.avatarProfiles).toEqual({});
    expect((await post('/api/couples/avatar', 'alice', { coupleId: 'other', config: DEFAULT_AVATAR, expectedRevision: 1 })).status).toBe(403);
  });
  it('returns a recoverable error without modifying records when storage fails', async () => {
    fake.fail = true;
    expect((await save('alice')).status).toBe(503);
    expect(stored('alice')).toBeUndefined();
  });
});
