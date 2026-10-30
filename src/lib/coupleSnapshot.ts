type SnapshotData = Record<string, unknown>;

function equalValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => equalValue(value, b[i]));
  }
  // Firestore values such as Timestamp, GeoPoint and DocumentReference expose isEqual.
  // Unknown class instances are treated conservatively as changed rather than losing metadata.
  if ('isEqual' in a && typeof a.isEqual === 'function') {
    try { return a.isEqual(b) === true; } catch { return false; }
  }
  const plain = (value: object) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!plain(a) || !plain(b)) return false;
  const left = a as SnapshotData; const right = b as SnapshotData;
  const keys = Object.keys(left).sort();
  const otherKeys = Object.keys(right).sort();
  return keys.length === otherKeys.length && keys.every((key, i) => key === otherKeys[i] && equalValue(left[key], right[key]));
}

/** Only avatar metadata changed: do not rehydrate a pending local financial edit. */
export function isAvatarOnlySnapshot(previous: SnapshotData | null, next: SnapshotData): boolean {
  if (!previous || equalValue(previous.avatarProfiles, next.avatarProfiles)) return false;
  const { avatarProfiles: _previousAvatar, ...previousMetadata } = previous;
  const { avatarProfiles: _nextAvatar, ...nextMetadata } = next;
  return equalValue(previousMetadata, nextMetadata);
}
