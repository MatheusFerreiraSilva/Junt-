import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
            config: { version: 1, skin: 'honey' },
          }),
          setDoc(doc(db, 'avatars/avatar-bob'), {
            ownerUid: 'avatar-bob',
            revision: 1,
            config: { version: 1, skin: 'cocoa' },
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

    it('denies avatar listing and every direct client mutation including own writes', async () => {
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
});
