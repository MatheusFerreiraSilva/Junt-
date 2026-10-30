import { describe, expect, it } from 'vitest';
import { isAvatarOnlySnapshot } from '../coupleSnapshot';

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
