import type { AccentTheme } from '../types/finance';

export interface AccountPreferences {
  themeMode: 'light' | 'dark';
  accentTheme: AccentTheme;
  coupleTheme: AccentTheme;
  partner1Theme: AccentTheme;
  partner2Theme: AccentTheme;
}
export const DEFAULT_PREFERENCES: AccountPreferences = {
  themeMode: 'light', accentTheme: 'emerald', coupleTheme: 'emerald', partner1Theme: 'sapphire', partner2Theme: 'rose',
};
export type PreferencePatch = Partial<AccountPreferences>;
export type AppearanceSyncStatus = 'local' | 'loading' | 'not-saved' | 'saving' | 'saved' | 'error';
export interface PreferenceRecord { ownerUid: string; version: 1; revision: number; preferences: AccountPreferences }
export interface PreferenceStore {
  subscribe: (uid: string, receive: (value: unknown, confirmed: boolean) => void, fail: (error: unknown) => void) => () => void;
  patch: (uid: string, patch: PreferencePatch) => Promise<PreferenceRecord>;
}
const colors = ['emerald', 'sapphire', 'violet', 'rose', 'amber', 'slate'];
export function isAccountPreferences(value: unknown): value is AccountPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).length === 5 && (data.themeMode === 'light' || data.themeMode === 'dark')
    && ['accentTheme', 'coupleTheme', 'partner1Theme', 'partner2Theme'].every(key => typeof data[key] === 'string' && colors.includes(data[key] as string));
}
export function preferenceRecord(value: unknown, uid: string): PreferenceRecord | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as PreferenceRecord;
  return data.ownerUid === uid && data.version === 1 && Number.isSafeInteger(data.revision) && data.revision > 0
    && data.revision < Number.MAX_SAFE_INTEGER && isAccountPreferences(data.preferences) ? data : null;
}
/** One owner-bound session. Only explicit appearance changes write; financial cache hydration never does. */
export function createPreferenceSync(uid: string, store: PreferenceStore, apply: (value: AccountPreferences) => void, status: (value: AppearanceSyncStatus) => void, initialPreferences: AccountPreferences = DEFAULT_PREFERENCES) {
  const scopedInitial = isAccountPreferences(initialPreferences) ? { ...initialPreferences } : { ...DEFAULT_PREFERENCES };
  let active = true; let ready = false; let busy = false;
  let confirmed: PreferenceRecord | null = null;
  let pending: PreferencePatch = {};
  let stop: (() => void) | undefined;
  const current = () => ({ ...(confirmed?.preferences || scopedInitial), ...pending });
  const render = () => { if (active) apply(current()); };
  const flush = async () => {
    if (!active || !ready || busy || !Object.keys(pending).length) return;
    // An explicit first change saves the five visible, UID-scoped fields together.
    // No write occurs merely because this device has a cached appearance.
    const sending = confirmed ? { ...pending } : { ...current() }; busy = true; status('saving');
    let succeeded = false;
    try {
      const result = await store.patch(uid, sending);
      if (!active) return;
      const saved = preferenceRecord(result, uid);
      if (!saved) throw new Error('Invalid account preference acknowledgement');
      if (!confirmed || saved.revision >= confirmed.revision) confirmed = saved;
      for (const key of Object.keys(sending) as (keyof AccountPreferences)[]) {
        if (pending[key] === sending[key]) delete pending[key];
      }
      succeeded = true; render(); status(Object.keys(pending).length ? 'saving' : 'saved');
    } catch {
      if (active) status('error');
    } finally {
      busy = false;
      if (succeeded && active) void flush();
    }
  };
  const connect = () => {
    stop?.(); ready = false; status('loading');
    stop = store.subscribe(uid, (value, serverConfirmed) => {
      if (!active || !serverConfirmed) return;
      const record = value == null ? null : preferenceRecord(value, uid);
      if (value != null && !record) { ready = false; status('error'); return; }
      if (record && confirmed && record.revision < confirmed.revision) return;
      confirmed = record; ready = true; render();
      if (Object.keys(pending).length) { if (!busy) void flush(); }
      else if (!busy) status(confirmed ? 'saved' : 'not-saved');
    }, () => { if (active) { ready = false; status('error'); } });
  };
  connect();
  return {
    change: (change: PreferencePatch | ((value: AccountPreferences) => PreferencePatch)) => {
      if (!active) return;
      const patch = typeof change === 'function' ? change(current()) : change;
      if (!isAccountPreferences({ ...current(), ...patch })) throw new Error('Preferências visuais inválidas.');
      pending = { ...pending, ...patch }; render();
      if (ready) void flush();
    },
    saveCurrent: () => { if (!active) return; pending = { ...current() }; render(); if (ready) void flush(); },
    retry: () => { if (!active) return; if (!ready) connect(); else void flush(); },
    dispose: () => { active = false; stop?.(); },
  };
}
