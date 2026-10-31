import { describe, expect, it, vi } from 'vitest';
import { createPreferenceSync, DEFAULT_PREFERENCES, type PreferenceRecord, type PreferenceStore } from './accountPreferences';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function harness(initialPreferences = DEFAULT_PREFERENCES) {
  let next: (value: unknown, confirmed: boolean) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const change = vi.fn(); const status = vi.fn(); const stop = vi.fn();
  const save = vi.fn<PreferenceStore['patch']>();
  const store: PreferenceStore = { subscribe: (_uid, receive, error) => { next = receive; fail = error; return stop; }, patch: save };
  const sync = createPreferenceSync('alice', store, change, status, initialPreferences);
  const record = (revision = 1, values = {}): PreferenceRecord => ({ ownerUid: 'alice', version: 1, revision, preferences: { ...DEFAULT_PREFERENCES, ...values } });
  return { sync, change, status, save, stop, receive: (value: unknown, confirmed = true) => next(value, confirmed), fail: (e: unknown) => fail(e), record };
}
describe('account appearance preferences', () => {
  it('keeps trusted UID-scoped appearance without automatically creating a cloud document', () => {
    const initial = { ...DEFAULT_PREFERENCES, themeMode: 'dark' as const, coupleTheme: 'amber' as const };
    const h = harness(initial);
    expect(h.change).not.toHaveBeenCalled();
    h.receive(undefined);
    expect(h.change).toHaveBeenLastCalledWith(initial);
    expect(h.status).toHaveBeenLastCalledWith('not-saved');
    expect(h.save).not.toHaveBeenCalled();
  });
  it('explicitly saves all five current fields and preserves untouched scoped colors on the first edit', async () => {
    const initial = { ...DEFAULT_PREFERENCES, coupleTheme: 'amber' as const, partner2Theme: 'violet' as const };
    const h = harness(initial); h.receive(undefined);
    h.save.mockResolvedValue(h.record(1, initial));
    h.sync.saveCurrent(); await tick();
    expect(h.save).toHaveBeenCalledWith('alice', initial);
    const next = harness(initial); next.receive(undefined);
    next.save.mockResolvedValue(next.record(1, { ...initial, themeMode: 'dark' }));
    next.sync.change({ themeMode: 'dark' }); await tick();
    expect(next.save).toHaveBeenCalledWith('alice', { ...initial, themeMode: 'dark' });
    expect(next.change).toHaveBeenLastCalledWith(expect.objectContaining({ coupleTheme: 'amber', partner2Theme: 'violet' }));
  });
  it('a saved cloud document replaces scoped cached appearance without echoing it back', () => {
    const h = harness({ ...DEFAULT_PREFERENCES, coupleTheme: 'amber' });
    h.receive(h.record(5, { coupleTheme: 'slate' }));
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ coupleTheme: 'slate' }));
    expect(h.save).not.toHaveBeenCalled();
  });
  it('loads remote appearance without automatically writing device defaults', () => {
    const h = harness();
    h.receive(h.record(3, { themeMode: 'dark', coupleTheme: 'violet' }));
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ themeMode: 'dark', coupleTheme: 'violet' }));
    expect(h.save).not.toHaveBeenCalled(); expect(h.status).toHaveBeenLastCalledWith('saved');
  });
  it('does not call a cached snapshot saved in the cloud', () => {
    const h = harness(); h.receive(h.record(), false);
    expect(h.status).not.toHaveBeenLastCalledWith('saved'); expect(h.save).not.toHaveBeenCalled();
  });
  it('preserves changes made during loading and sends only changed appearance fields', async () => {
    const h = harness(); h.sync.change({ accentTheme: 'rose' });
    expect(h.save).not.toHaveBeenCalled();
    h.save.mockResolvedValue(h.record(2, { themeMode: 'dark', accentTheme: 'rose' }));
    h.receive(h.record(1, { themeMode: 'dark' })); await tick();
    expect(h.save).toHaveBeenCalledWith('alice', { accentTheme: 'rose' });
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ themeMode: 'dark', accentTheme: 'rose' }));
  });
  it('keeps unsaved changes after failure and only confirms after acknowledgement', async () => {
    const h = harness(); h.receive(h.record());
    let resolve!: (r: PreferenceRecord) => void;
    h.save.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    h.sync.change({ themeMode: 'dark' });
    expect(h.status).toHaveBeenLastCalledWith('saving');
    resolve(h.record(2, { themeMode: 'dark' })); await tick();
    expect(h.status).toHaveBeenLastCalledWith('saved');
    h.save.mockRejectedValueOnce(new Error('offline'));
    h.sync.change({ partner1Theme: 'amber' }); await tick();
    expect(h.status).toHaveBeenLastCalledWith('error');
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ partner1Theme: 'amber' }));
    h.save.mockResolvedValueOnce(h.record(3, { themeMode: 'dark', partner1Theme: 'amber' }));
    h.sync.retry(); await tick(); expect(h.status).toHaveBeenLastCalledWith('saved');
  });
  it('applies other-device changes and keeps edits made while an earlier save is pending', async () => {
    const h = harness(); h.receive(h.record()); let resolve!: (r: PreferenceRecord) => void;
    h.save.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    h.sync.change({ accentTheme: 'violet' }); h.sync.change({ accentTheme: 'amber' });
    h.receive(h.record(2, { partner2Theme: 'sapphire' }));
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ accentTheme: 'amber', partner2Theme: 'sapphire' }));
    h.save.mockResolvedValueOnce(h.record(4, { accentTheme: 'amber', partner2Theme: 'sapphire' }));
    resolve(h.record(3, { accentTheme: 'violet', partner2Theme: 'sapphire' })); await tick(); await tick();
    expect(h.save).toHaveBeenLastCalledWith('alice', { accentTheme: 'amber' });
    expect(h.change).toHaveBeenLastCalledWith(expect.objectContaining({ accentTheme: 'amber' }));
  });
  it('uses defaults for an absent document and blocks invalid or foreign-owner records', () => {
    const h = harness(); h.receive(undefined); expect(h.change).toHaveBeenLastCalledWith(DEFAULT_PREFERENCES); expect(h.save).not.toHaveBeenCalled();
    h.receive({ ...h.record(), ownerUid: 'bob' }); expect(h.status).toHaveBeenLastCalledWith('error');
    h.sync.change({ themeMode: 'dark' }); expect(h.save).not.toHaveBeenCalled();
  });
  it('rejects unknown fields instead of copying financial or membership data', () => {
    const h = harness(); h.receive(h.record());
    expect(() => h.sync.change({ partner1Income: 9000 } as never)).toThrow('Preferências visuais inválidas.');
    expect(h.save).not.toHaveBeenCalled();
  });
  it('disposes the old session so neither snapshots nor delayed responses affect another account', async () => {
    const h = harness(); h.receive(h.record()); let resolve!: (r: PreferenceRecord) => void;
    h.save.mockImplementationOnce(() => new Promise(r => { resolve = r; })); h.sync.change({ themeMode: 'dark' });
    h.sync.dispose(); h.change.mockClear(); h.status.mockClear();
    h.receive(h.record(4)); resolve(h.record(2)); await tick(); h.sync.change({ accentTheme: 'rose' });
    expect(h.stop).toHaveBeenCalledOnce(); expect(h.change).not.toHaveBeenCalled(); expect(h.status).not.toHaveBeenCalled(); expect(h.save).toHaveBeenCalledTimes(1);
  });
});
