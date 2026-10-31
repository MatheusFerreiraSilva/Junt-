import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEFAULT_PREFERENCES, preferenceRecord, type PreferenceStore } from './accountPreferences';

export const firebasePreferenceStore: PreferenceStore = {
  subscribe: (uid, receive, fail) => onSnapshot(doc(db, 'accountPreferences', uid), { includeMetadataChanges: true }, snap => {
    receive(snap.data(), !snap.metadata.fromCache && !snap.metadata.hasPendingWrites);
  }, fail),
  patch: async (uid, patch) => {
    const assertSession = () => {
      if (auth.currentUser?.uid !== uid || auth.currentUser.isAnonymous) throw new Error('A sessão mudou.');
    };
    assertSession();
    return runTransaction(db, async tx => {
      const ref = doc(db, 'accountPreferences', uid);
      const snap = await tx.get(ref); assertSession();
      const previous = snap.exists() ? preferenceRecord(snap.data(), uid) : null;
      if (snap.exists() && !previous) throw new Error('Preferências da conta inválidas.');
      if (previous && previous.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Não foi possível confirmar a revisão das preferências.');
      const next = {
        ownerUid: uid, version: 1 as const, revision: (previous?.revision || 0) + 1,
        preferences: { ...(previous?.preferences || DEFAULT_PREFERENCES), ...patch },
      };
      tx.set(ref, next); return next;
    }).then(result => { assertSession(); return result; });
  },
};
