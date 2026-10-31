import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from './accountPreferences';
const fake = vi.hoisted(() => ({ uid: 'alice', anonymous: false, data: undefined as unknown, written: undefined as unknown, switchDuringRead: false }));
vi.mock('./firebase', () => ({ db: {}, auth: { get currentUser() { return { uid: fake.uid, isAnonymous: fake.anonymous }; } } }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, uid: string) => collection + '/' + uid,
  onSnapshot: vi.fn(),
  runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({
    get: async () => { if (fake.switchDuringRead) fake.uid = 'bob'; return { exists: () => fake.data !== undefined, data: () => fake.data }; },
    set: (ref: string, value: unknown) => { fake.written = { ref, value }; },
  }),
}));
import { firebasePreferenceStore } from './firebasePreferences';
beforeEach(() => { fake.uid = 'alice'; fake.anonymous = false; fake.data = undefined; fake.written = undefined; fake.switchDuringRead = false; });
describe('account preference transactions', () => {
  it('creates only the authenticated owner appearance with the initial revision', async () => {
    const result = await firebasePreferenceStore.patch('alice', { themeMode: 'dark' });
    expect(fake.written).toEqual({ ref: 'accountPreferences/alice', value: { ownerUid: 'alice', version: 1, revision: 1, preferences: { ...DEFAULT_PREFERENCES, themeMode: 'dark' } } });
    expect(result.revision).toBe(1);
  });
  it('merges only the changed fields into the latest transaction version', async () => {
    fake.data = { ownerUid: 'alice', version: 1, revision: 4, preferences: { ...DEFAULT_PREFERENCES, partner2Theme: 'amber' } };
    const result = await firebasePreferenceStore.patch('alice', { accentTheme: 'violet' });
    expect(result).toMatchObject({ revision: 5, preferences: { accentTheme: 'violet', partner2Theme: 'amber' } });
  });
  it('rejects other identities, anonymous accounts, malformed data and session switches before writing', async () => {
    await expect(firebasePreferenceStore.patch('bob', { themeMode: 'dark' })).rejects.toThrow();
    fake.anonymous = true; await expect(firebasePreferenceStore.patch('alice', { themeMode: 'dark' })).rejects.toThrow();
    fake.anonymous = false; fake.data = { ownerUid: 'bob' }; await expect(firebasePreferenceStore.patch('alice', { themeMode: 'dark' })).rejects.toThrow();
    fake.data = undefined; fake.switchDuringRead = true; await expect(firebasePreferenceStore.patch('alice', { themeMode: 'dark' })).rejects.toThrow();
    expect(fake.written).toBeUndefined();
  });
});
