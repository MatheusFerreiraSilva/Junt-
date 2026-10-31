import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from './avatarConfig';
const fake = vi.hoisted(() => ({ row: undefined as unknown, pending: undefined as unknown, fail: false, documents: new Map<string, unknown>() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, uid: string) => collection + '/' + uid,
  runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    if (fake.fail) throw new Error('offline');
    const result = await callback({ get: async (ref: string) => ({ data: () => ref.startsWith('avatars/') ? fake.row : fake.documents.get(ref) }), set: (_ref: unknown, value: unknown) => { fake.pending = value; } });
    if (fake.pending) fake.row = fake.pending;
    return result;
  },
}));
import { saveAvatarToCloud, migrateAvatarToCloud, CloudAvatarConflictError } from './avatarStore';
beforeEach(() => { fake.row = undefined; fake.pending = undefined; fake.fail = false; fake.documents.clear(); });
describe('transactional avatar confirmation', () => {
  it('confirms a new owner record and recovers it through another call', async () => {
    const saved = await saveAvatarToCloud('alice', DEFAULT_AVATAR, 0, () => true);
    expect(saved).toEqual({ ownerUid: 'alice', revision: 1, config: DEFAULT_AVATAR });
    expect(fake.row).toEqual(saved);
    expect(await saveAvatarToCloud('alice', DEFAULT_AVATAR, 0, () => true)).toEqual(saved);
  });
  it('preserves a newer cloud recipe when another device has edited it', async () => {
    fake.row = { ownerUid: 'alice', revision: 3, config: { ...DEFAULT_AVATAR, hair: 'bald' } };
    await expect(saveAvatarToCloud('alice', DEFAULT_AVATAR, 1, () => true)).rejects.toBeInstanceOf(CloudAvatarConflictError);
    expect(fake.pending).toBeUndefined();
  });
  it('does not write when the active identity changes during the transaction', async () => {
    let checks = 0;
    await expect(saveAvatarToCloud('alice', DEFAULT_AVATAR, 0, () => ++checks < 2)).rejects.toThrow('sessão');
    expect(fake.row).toBeUndefined();
  });
  it('rejects offline operations without claiming a saved record', async () => {
    fake.fail = true;
    await expect(saveAvatarToCloud('alice', DEFAULT_AVATAR, 0, () => true)).rejects.toThrow('offline');
    expect(fake.pending).toBeUndefined();
  });
  it('preserves known pre-gender choices and advances their real revision', async () => {
    const { gender: _gender, ...old } = { ...DEFAULT_AVATAR, hair: 'long' };
    fake.row = { ownerUid: 'alice', revision: 4, config: old };
    expect((await saveAvatarToCloud('alice', DEFAULT_AVATAR, 4, () => true)).revision).toBe(5);
  });
});

it('migrates the verified own legacy avatar without a backend and keeps an existing account avatar', async () => {
  const { gender: _gender, ...old } = { ...DEFAULT_AVATAR, hair: 'long' };
  fake.documents.set('users/alice', { coupleId: 'pair' });
  fake.documents.set('couples/pair', { partner1Uid: 'alice', partner2Uid: 'bob', avatarProfiles: { partner1: { ownerUid: 'alice', revision: 5, config: old } } });
  const saved = await migrateAvatarToCloud('alice', 'pair', () => true);
  expect(saved?.config.hair).toBe('long'); expect(saved?.revision).toBe(1);
  fake.row = { ownerUid: 'alice', revision: 3, config: DEFAULT_AVATAR };
  expect((await migrateAvatarToCloud('alice', 'pair', () => true))?.revision).toBe(3);
});
it('never migrates a legacy recipe belonging to another UID or an inactive membership', async () => {
  fake.documents.set('users/alice', { coupleId: 'pair' });
  fake.documents.set('couples/pair', { partner1Uid: 'alice', partner2Uid: 'bob', avatarProfiles: { partner1: { ownerUid: 'bob', revision: 5, config: DEFAULT_AVATAR } } });
  expect(await migrateAvatarToCloud('alice', 'pair', () => true)).toBeNull();
  expect(fake.row).toBeUndefined();
});
