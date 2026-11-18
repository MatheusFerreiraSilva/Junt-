import { describe, expect, it } from 'vitest';
import { commitCoupleHeaderPatchTransaction, isAvatarOnlySnapshot, rebaseCoupleHeaderSnapshot, serializeFinancialParametersBackup, parseFinancialParametersBackup } from '../coupleSnapshot';
import type { Firestore } from 'firebase/firestore';

describe('avatar-only couple snapshots', () => {
  const base = { partner1Uid: 'a', partner2Uid: 'b', partner1Income: 1000, categoryPercentages: { moradia: 30 }, avatarProfiles: { partner1: { revision: 1 } } };
  const updated = { ...base, avatarProfiles: { partner1: { revision: 2 } } };

  it('skips only avatar changes, including the first avatar and removal', () => {
    expect(isAvatarOnlySnapshot(base, updated)).toBe(true);
    const { avatarProfiles: _avatar, ...empty } = base;
    expect(isAvatarOnlySnapshot(empty, base)).toBe(true);
    expect(isAvatarOnlySnapshot(base, empty)).toBe(true);
  });
  it('hydrates the initial snapshot and does not mistake an identical event for an avatar update', () => {
    expect(isAvatarOnlySnapshot(null, base)).toBe(false);
    expect(isAvatarOnlySnapshot(base, structuredClone(base))).toBe(false);
  });
  it('does not skip financial values, plans or timestamp changes', () => {
    expect(isAvatarOnlySnapshot(base, { ...updated, partner1Income: 1200 })).toBe(false);
    expect(isAvatarOnlySnapshot(base, { ...updated, categoryPercentages: { moradia: 35 } })).toBe(false);
    expect(isAvatarOnlySnapshot(base, { ...updated, monthlyBudgetPlans: { next: {} } })).toBe(false);
    expect(isAvatarOnlySnapshot({ ...base, updatedAt: new Date(0) }, { ...updated, updatedAt: new Date(1) })).toBe(false);
  });
  it('never skips a membership, departure, name or invite update', () => {
    expect(isAvatarOnlySnapshot(base, { ...updated, partner2Uid: 'c' })).toBe(false);
    expect(isAvatarOnlySnapshot(base, { ...updated, departedMembers: { a: true } })).toBe(false);
    expect(isAvatarOnlySnapshot(base, { ...updated, partner1Name: 'Nome' })).toBe(false);
    expect(isAvatarOnlySnapshot(base, { ...updated, inviteCode: 'new' })).toBe(false);
  });
  it('compares object keys independent of order while retaining array order', () => {
    const before = { ...base, settings: { nested: { a: 1, b: 2 }, values: [1, 2] } };
    const reordered = { ...updated, settings: { values: [1, 2], nested: { b: 2, a: 1 } } };
    expect(isAvatarOnlySnapshot(before, reordered)).toBe(true);
    expect(isAvatarOnlySnapshot(before, { ...reordered, settings: { ...reordered.settings, values: [2, 1] } })).toBe(false);
  });
  it('preserves Firestore value semantics and treats unknown classes conservatively', () => {
    class Stamp { constructor(readonly seconds: number) {} isEqual(other: unknown) { return other instanceof Stamp && other.seconds === this.seconds; } }
    expect(isAvatarOnlySnapshot({ ...base, updatedAt: new Stamp(1) }, { ...updated, updatedAt: new Stamp(1) })).toBe(true);
    expect(isAvatarOnlySnapshot({ ...base, updatedAt: new Stamp(1) }, { ...updated, updatedAt: new Stamp(2) })).toBe(false);
    class Unknown {}
    expect(isAvatarOnlySnapshot({ ...base, extra: new Unknown() }, { ...updated, extra: new Unknown() })).toBe(false);
  });
});

describe('concurrent couple header edits', () => {
  it('rejects a concurrent creation of a field absent from the baseline', async () => {
    const remote = { expectedYieldAnnual: 5 };
    let written = false;
    const outcome = await commitCoupleHeaderPatchTransaction(
      {} as Firestore,
      'couple',
      {},
      { expectedYieldAnnual: 3 },
      {
        authoredByUid: 'user-a',
        runTransactionFn: async (_db, callback) => callback({
          get: async () => ({ exists: () => true, data: () => remote }),
          update: () => { written = true; },
        }),
      },
    );
    expect(outcome.status).toBe('conflict');
    expect(outcome.conflictingFields).toEqual(['expectedYieldAnnual']);
    expect(written).toBe(false);
  });

  it('retains the local and remote values for explicit conflict resolution', () => {
    const result = rebaseCoupleHeaderSnapshot(
      { expectedYieldAnnual: 6, partner1Name: 'A', partner2Name: 'B' },
      { expectedYieldAnnual: 3, partner1Name: 'Local', partner2Name: 'B' },
      { expectedYieldAnnual: 5, partner1Name: 'A', partner2Name: 'Remote' },
    );
    expect(result.conflicts.expectedYieldAnnual).toEqual({ baseline: 6, local: 3, remote: 5 });
    expect(result.merged).toMatchObject({ expectedYieldAnnual: 5, partner1Name: 'Local', partner2Name: 'Remote' });
    expect(result.nextBaseline.expectedYieldAnnual).toBe(5);
  });
});

describe('financial parameter backup', () => {
  it('round-trips explicit zero and absent values without including unrelated profile fields', () => {
    const raw = serializeFinancialParametersBackup({ expectedYieldAnnual: 0, partner1Name: 'private' });
    expect(JSON.parse(raw)).toEqual({ schemaVersion: 1, parameters: { expectedYieldAnnual: 0 } });
    expect(parseFinancialParametersBackup(raw)).toEqual({ expectedYieldAnnual: 0 });
    expect(parseFinancialParametersBackup(serializeFinancialParametersBackup({ emergencyReserveMonthsTarget: 9 })))
      .toEqual({ emergencyReserveMonthsTarget: 9 });
    expect(parseFinancialParametersBackup(serializeFinancialParametersBackup({}))).toEqual({});
  });

  it('rejects malformed, oversized, extra, or invalid financial parameters', () => {
    for (const raw of [
      'invalid', ' '.repeat(4097),
      JSON.stringify({ schemaVersion: 2, parameters: {} }),
      JSON.stringify({ schemaVersion: 1, parameters: { expectedYieldAnnual: '0' } }),
      JSON.stringify({ schemaVersion: 1, parameters: { expectedYieldAnnual: 101 } }),
      JSON.stringify({ schemaVersion: 1, parameters: { emergencyReserveMonthsTarget: 0 } }),
      JSON.stringify({ schemaVersion: 1, parameters: { partner1Name: 'x' } }),
    ]) expect(() => parseFinancialParametersBackup(raw)).toThrow();
    expect(() => serializeFinancialParametersBackup({ expectedYieldAnnual: NaN })).toThrow();
  });
});
