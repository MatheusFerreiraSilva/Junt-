import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
});
