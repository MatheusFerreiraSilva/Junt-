import { vi } from 'vitest';
vi.mock('../src/lib/firebase', () => ({ db: null }));
import { saveAvatarToCloud, migrateAvatarToCloud } from '../src/avatars/avatarStore';
import { DEFAULT_AVATAR } from '../src/avatars/avatarConfig';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { type Firestore, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// The emulator exposes compat clients; the modular SDK unwraps these instances.
const sdk = (client: unknown) => client as Firestore;
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('Firestore couple isolation (emulator only)', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-junto-rules', firestore: { rules: await readFile('firestore.rules', 'utf8') } });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'couples/a'), { id: 'a', partner1Uid: 'alice', partner2Uid: 'bob', departedMembers: {}, partner1Name: 'A' });
      await setDoc(doc(db, 'couples/b'), { id: 'b', partner1Uid: 'mallory', partner2Uid: null, departedMembers: {} });
      await setDoc(doc(db, 'users/mallory'), { uid: 'mallory', coupleId: 'b', partnerRole: 'partner1' });
      await setDoc(doc(db, 'users/alice'), { uid: 'alice', coupleId: 'a', partnerRole: 'partner1' });
      await setDoc(doc(db, 'coupleInvites/secret'), { coupleId: 'a' });
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  it('preserves custom splits already supported by expenses, installments and income', async () => {
    const db = env.authenticatedContext('alice').firestore();
    for (const field of ['expenses', 'installments', 'incomes']) {
      await assertSucceeds(setDoc(doc(db, 'couples/a/entities/custom-' + field), {
        field, record: { id: 'custom-' + field, amount: 100, paidBy: 'custom', recipient: 'custom', splitPartner1Pct: 35, splitPartner2Pct: 65 },
        deleted: false, schemaVersion: 1,
      }));
    }
    await assertFails(setDoc(doc(db, 'couples/a/entities/invalid-payer'), {
      field: 'expenses', record: { id: 'invalid', amount: 100, paidBy: 'unknown-person' }, deleted: false, schemaVersion: 1,
    }));
  });
  it('denies unauthenticated and unrelated couple reads', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'couples/a')));
    await assertFails(getDoc(doc(env.authenticatedContext('mallory').firestore(), 'couples/a')));
  });
  it('rejects self-granted profile membership and arbitrary member updates', async () => {
    const attacker = env.authenticatedContext('mallory').firestore();
    await assertFails(updateDoc(doc(attacker, 'users/mallory'), { coupleId: 'a', partnerRole: 'partner2' }));
    await assertFails(updateDoc(doc(env.authenticatedContext('alice').firestore(), 'couples/a'), { partner2Uid: 'mallory' }));
  });
  it('does not expose or let the browser consume invite records', async () => {
    const attacker = env.authenticatedContext('mallory').firestore();
    await assertFails(getDoc(doc(attacker, 'coupleInvites/secret')));
    await assertFails(setDoc(doc(attacker, 'coupleInvites/new'), { coupleId: 'a' }));
  });
  it('allows legitimate members independent records and denies outsiders', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const bob = env.authenticatedContext('bob').firestore();
    await Promise.all([
      assertSucceeds(setDoc(doc(alice, 'couples/a/entities/expense-alice'), { field: 'expenses', record: { id: 'alice-expense', amount: 10 }, deleted: false, schemaVersion: 1 })),
      assertSucceeds(setDoc(doc(bob, 'couples/a/entities/expense-bob'), { field: 'expenses', record: { id: 'bob-expense', amount: 20 }, deleted: false, schemaVersion: 1 })),
    ]);
    expect((await getDoc(doc(alice, 'couples/a/entities/expense-bob'))).exists()).toBe(true);
    await assertFails(getDoc(doc(env.authenticatedContext('mallory').firestore(), 'couples/a/entities/expense-alice')));
  });
  it('revokes departed members without reopening a free partner slot', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'couples/a'), { 'departedMembers.bob': true });
    });
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'couples/a')));
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'couples/a/entities/expense-alice')));
    await assertFails(updateDoc(doc(env.authenticatedContext('alice').firestore(), 'couples/a'), { departedMembers: {} }));
  });
  it('rejects unknown entity fields, secret payloads, invalid money and hard deletion', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const ref = doc(alice, 'couples/a/entities/validation');
    await assertFails(setDoc(ref, { field: 'roles', record: { id: 'x' }, deleted: false, schemaVersion: 1 }));
    await assertFails(setDoc(ref, { field: 'expenses', record: { id: 'x', amount: -10 }, deleted: false, schemaVersion: 1 }));
    await assertFails(setDoc(ref, { field: 'expenses', record: { id: 'x', amount: 10, clientSecret: 'not-a-real-secret' }, deleted: false, schemaVersion: 1 }));
    await assertSucceeds(setDoc(ref, { field: 'expenses', record: { id: 'x', amount: 10 }, deleted: false, schemaVersion: 1 }));
    await assertFails(updateDoc(ref, { field: 'incomes' }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(setDoc(ref, { field: 'expenses', record: null, deleted: true, schemaVersion: 1 }));
  });

  describe('account avatars', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await Promise.all([
          setDoc(doc(db, 'users/avatar-alice'), {
            uid: 'avatar-alice',
            coupleId: 'avatar-couple',
            partnerRole: 'partner1',
          }),
          setDoc(doc(db, 'users/avatar-bob'), {
            uid: 'avatar-bob',
            coupleId: 'avatar-couple',
            partnerRole: 'partner2',
          }),
          setDoc(doc(db, 'users/avatar-mallory'), {
            uid: 'avatar-mallory',
            coupleId: 'avatar-other',
            partnerRole: 'partner1',
          }),
          setDoc(doc(db, 'couples/avatar-couple'), {
            partner1Uid: 'avatar-alice',
            partner2Uid: 'avatar-bob',
            departedMembers: {},
          }),
          setDoc(doc(db, 'couples/avatar-other'), {
            partner1Uid: 'avatar-mallory',
            partner2Uid: '',
            departedMembers: {},
          }),
          setDoc(doc(db, 'avatars/avatar-alice'), {
            ownerUid: 'avatar-alice',
            revision: 1,
            config: DEFAULT_AVATAR,
          }),
          setDoc(doc(db, 'avatars/avatar-bob'), {
            ownerUid: 'avatar-bob',
            revision: 1,
            config: { ...DEFAULT_AVATAR, skin: 'cocoa' },
          }),
        ]);
      });
    });

    it('lets an authenticated owner get the avatar even without a couple', async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'users/avatar-alice'), {
          coupleId: '',
          partnerRole: '',
        });
      });
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('avatar-alice').firestore(), 'avatars/avatar-alice'))
      );
    });

    it('lets both active partners get each other account avatars', async () => {
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('avatar-alice').firestore(), 'avatars/avatar-bob'))
      );
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('avatar-bob').firestore(), 'avatars/avatar-alice'))
      );
    });

    it('denies outsiders, unauthenticated readers and anonymous owners', async () => {
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-mallory').firestore(), 'avatars/avatar-alice'))
      );
      await assertFails(
        getDoc(doc(env.unauthenticatedContext().firestore(), 'avatars/avatar-alice'))
      );
      const anonymous = env
        .authenticatedContext('avatar-alice', { firebase: { sign_in_provider: 'anonymous' } })
        .firestore();
      await assertFails(getDoc(doc(anonymous, 'avatars/avatar-alice')));
    });

    it('denies listing, invalid mutations, deletion and forged ownership', async () => {
      const db = env.authenticatedContext('avatar-alice').firestore();
      await assertFails(getDocs(collection(db, 'avatars')));
      await assertFails(
        setDoc(doc(db, 'avatars/avatar-alice'), {
          ownerUid: 'avatar-alice',
          revision: 2,
          config: {},
        })
      );
      await assertFails(updateDoc(doc(db, 'avatars/avatar-bob'), { revision: 99 }));
      await assertFails(deleteDoc(doc(db, 'avatars/avatar-alice')));
      await assertFails(setDoc(doc(db, 'avatars/new-avatar'), { ownerUid: 'avatar-alice' }));
    });

    it('allows owner and active partner updates with strict recipes and advancing revisions', async () => {
      const alice = env.authenticatedContext('avatar-alice').firestore();
      const bob = env.authenticatedContext('avatar-bob').firestore();
      await assertSucceeds(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 2, config: DEFAULT_AVATAR }));
      await assertSucceeds(setDoc(doc(bob, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 3, config: { ...DEFAULT_AVATAR, hair: 'fade' } }));
      await assertFails(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 3, config: DEFAULT_AVATAR }));
      await assertFails(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 8, config: DEFAULT_AVATAR }));
      await assertFails(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-bob', revision: 4, config: DEFAULT_AVATAR }));
      await assertFails(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 4, config: { ...DEFAULT_AVATAR, hair: '<svg>' } }));
      await assertFails(setDoc(doc(alice, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 4, config: DEFAULT_AVATAR, accessToken: 'forbidden' }));
    });
    it('confirms transactional save, another device read, partner edit and safe lost-response retry', async () => {
      const desktop = env.authenticatedContext('avatar-alice', { device: 'desktop' }).firestore();
      const mobile = env.authenticatedContext('avatar-alice', { device: 'mobile' }).firestore();
      const partnerDevice = env.authenticatedContext('avatar-bob', { device: 'partner' }).firestore();
      const customized = { ...DEFAULT_AVATAR, hair: 'fade' as const, outfit: 'labcoat' as const };
      expect((await saveAvatarToCloud('avatar-alice', customized, 1, () => true, sdk(desktop))).revision).toBe(2);
      expect((await getDoc(doc(mobile, 'avatars/avatar-alice'))).data()?.config).toEqual(customized);
      expect((await saveAvatarToCloud('avatar-alice', customized, 1, () => true, sdk(desktop))).revision).toBe(2);
      const partnerEdit = { ...customized, hair: 'bald' as const };
      expect((await saveAvatarToCloud('avatar-alice', partnerEdit, 2, () => true, sdk(partnerDevice))).ownerUid).toBe('avatar-alice');
      expect((await getDoc(doc(mobile, 'avatars/avatar-alice'))).data()?.config).toEqual(partnerEdit);
      await expect(saveAvatarToCloud('avatar-alice', DEFAULT_AVATAR, 1, () => true, sdk(desktop))).rejects.toThrow('mudou');
      expect((await getDoc(doc(desktop, 'avatars/avatar-alice'))).data()?.revision).toBe(3);
    });
    it('recovers the exact own legacy choices through the SDK without overwriting an existing personal avatar', async () => {
      const { gender: _gender, ...oldRecipe } = { ...DEFAULT_AVATAR, hair: 'long' as const };
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await deleteDoc(doc(db, 'avatars/avatar-alice'));
        await updateDoc(doc(db, 'couples/avatar-couple'), { avatarProfiles: { partner1: { ownerUid: 'avatar-alice', revision: 5, config: oldRecipe } } });
      });
      const client = env.authenticatedContext('avatar-alice').firestore();
      const migrated = await migrateAvatarToCloud('avatar-alice', 'avatar-couple', () => true, sdk(client));
      expect(migrated?.config.hair).toBe('long'); expect(migrated?.revision).toBe(1);
      await saveAvatarToCloud('avatar-alice', DEFAULT_AVATAR, 1, () => true, sdk(client));
      expect((await migrateAvatarToCloud('avatar-alice', 'avatar-couple', () => true, sdk(client)))?.config).toEqual(DEFAULT_AVATAR);
      expect((await getDoc(doc(client, 'couples/avatar-couple'))).data()?.avatarProfiles.partner1.revision).toBe(5);
    });
    it('allows first partner save into the partner account before any avatar exists', async () => {
      await env.withSecurityRulesDisabled(async context => { await deleteDoc(doc(context.firestore(), 'avatars/avatar-bob')); });
      const db = env.authenticatedContext('avatar-alice').firestore();
      await assertSucceeds(setDoc(doc(db, 'avatars/avatar-bob'), { ownerUid: 'avatar-bob', revision: 1, config: DEFAULT_AVATAR }));
    });
    it('revokes partner writes after departure while preserving personal ownership', async () => {
      await env.withSecurityRulesDisabled(async context => { await updateDoc(doc(context.firestore(), 'couples/avatar-couple'), { 'departedMembers.avatar-bob': true }); });
      const db = env.authenticatedContext('avatar-alice').firestore();
      await assertFails(setDoc(doc(db, 'avatars/avatar-bob'), { ownerUid: 'avatar-bob', revision: 2, config: DEFAULT_AVATAR }));
      await assertSucceeds(setDoc(doc(db, 'avatars/avatar-alice'), { ownerUid: 'avatar-alice', revision: 2, config: DEFAULT_AVATAR }));
    });
    it('does not trust a forged users profile when the couple does not contain the reader', async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'users/avatar-mallory'), {
          coupleId: 'avatar-couple',
          partnerRole: 'partner1',
        });
      });
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-mallory').firestore(), 'avatars/avatar-bob'))
      );
    });

    it('revokes reading in both directions when either member departs but keeps own read', async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'couples/avatar-couple'), {
          'departedMembers.avatar-bob': true,
        });
      });
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-bob').firestore(), 'avatars/avatar-alice'))
      );
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-alice').firestore(), 'avatars/avatar-bob'))
      );
      await assertSucceeds(
        getDoc(doc(env.authenticatedContext('avatar-bob').firestore(), 'avatars/avatar-bob'))
      );
    });

    it('ignores historical couple membership when the reader current profile changed', async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'couples/avatar-new'), {
          partner1Uid: 'avatar-alice',
          partner2Uid: 'avatar-charlie',
          departedMembers: {},
        });
        await updateDoc(doc(db, 'users/avatar-alice'), { coupleId: 'avatar-new' });
      });
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-alice').firestore(), 'avatars/avatar-bob'))
      );
      await assertFails(
        getDoc(doc(env.authenticatedContext('avatar-bob').firestore(), 'avatars/avatar-alice'))
      );
    });
  });
  describe('private appearance preferences', () => {
    const record = { ownerUid: 'preferences-alice', version: 1, revision: 1, preferences: { themeMode: 'dark', accentTheme: 'emerald', coupleTheme: 'emerald', partner1Theme: 'sapphire', partner2Theme: 'rose' } };
    beforeEach(async () => { await env.withSecurityRulesDisabled(async context => { await deleteDoc(doc(context.firestore(), 'accountPreferences/preferences-alice')); }); });
    it('allows only the account owner to save and read preferences with monotonic revisions', async () => {
      const owner = env.authenticatedContext('preferences-alice').firestore();
      const ref = doc(owner, 'accountPreferences/preferences-alice');
      await assertSucceeds(setDoc(ref, record));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(setDoc(ref, { ...record, revision: 2 }));
      await assertFails(setDoc(ref, { ...record, revision: 1 }));
      await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'accountPreferences/preferences-alice')));
      await assertFails(getDocs(collection(owner, 'accountPreferences')));
      await assertFails(deleteDoc(ref));
    });
    it('rejects foreign owners, unrecognized values and financial or identity fields', async () => {
      const ref = doc(env.authenticatedContext('preferences-alice').firestore(), 'accountPreferences/preferences-alice');
      await assertFails(setDoc(ref, { ...record, ownerUid: 'other' }));
      await assertFails(setDoc(ref, { ...record, preferences: { ...record.preferences, accentTheme: 'injected' } }));
      await assertFails(setDoc(ref, { ...record, coupleId: 'forged' }));
      await assertFails(setDoc(ref, { ...record, preferences: { ...record.preferences, partner1Income: 1000 } }));
      await assertFails(setDoc(ref, { ...record, revision: 4 }));
      await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'accountPreferences/preferences-alice'), record));
      await assertFails(setDoc(doc(env.authenticatedContext('preferences-alice', { firebase: { sign_in_provider: 'anonymous' } }).firestore(), 'accountPreferences/preferences-alice'), record));
    });
  });
});
