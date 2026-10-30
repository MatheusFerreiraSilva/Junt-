import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; getIdToken: () => Promise<string> } },
}));
vi.mock('../firebase', () => ({ auth: fake.auth }));
import { ApiError, authenticatedApi } from '../authenticatedApi';
beforeEach(() => {
  vi.unstubAllGlobals();
  fake.auth.currentUser = { uid: 'a', getIdToken: async () => 'token' };
});
describe('authenticatedApi error metadata and session integrity', () => {
  it('preserves currentAvatar metadata and the existing error message on conflict', async () => {
    const details = { error: 'Versão alterada.', currentAvatar: { revision: 2 } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => details })
    );
    await expect(authenticatedApi('/api/avatars/save')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      details,
      message: 'Versão alterada.',
    });
  });
  it('does not expose an old-session conflict after the account changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        fake.auth.currentUser = { uid: 'b', getIdToken: async () => 'token-b' };
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: 'Private response', currentAvatar: { revision: 2 } }),
        };
      })
    );
    await expect(authenticatedApi('/api/avatars/save')).rejects.toThrow('A sessão mudou.');
  });
  it('retains successful response behavior and rejects before fetch without a session', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', request);
    await expect(authenticatedApi('/api/example', { value: 1 })).resolves.toEqual({
      success: true,
    });
    fake.auth.currentUser = null;
    await expect(authenticatedApi('/api/example')).rejects.toThrow('Faça login');
    expect(request).toHaveBeenCalledOnce();
    expect(new ApiError(500, {}).message).toMatch(/concluir/);
  });
});
