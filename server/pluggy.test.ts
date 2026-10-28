// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./security', () => ({ authorizedCouple: vi.fn(async () => 'couple-1'), userQuota: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
import { registerPluggy } from './pluggy';

const clientFetch = globalThis.fetch;
let server: Server | undefined;
async function endpoint(path: string, body = {}) {
  const app = express(); app.use(express.json()); app.use((_req, res, next) => { res.locals.uid = 'user-1'; next(); }); registerPluggy(app);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  return clientFetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); });
describe('Open Finance server contracts', () => {
  it('reports missing configuration without returning a fake bank or token', async () => {
    vi.stubEnv('PLUGGY_CLIENT_ID', ''); vi.stubEnv('PLUGGY_CLIENT_SECRET', '');
    const response = await endpoint('/api/pluggy/auth');
    expect(await response.json()).toMatchObject({ configured: false, simulated: false, integrationStatus: 'not_configured' });
  });
  it('does not produce bank transactions while unconfigured', async () => {
    vi.stubEnv('PLUGGY_CLIENT_ID', ''); vi.stubEnv('PLUGGY_CLIENT_SECRET', '');
    const response = await endpoint('/api/bank-sync/fetch', { itemId: 'item-1' });
    expect(response.status).toBe(503); const data = await response.json(); expect(data.simulated).toBe(false); expect(data.transactions).toBeUndefined();
  });
  it('denies another users provider item', async () => {
    vi.stubEnv('PLUGGY_CLIENT_ID', 'test'); vi.stubEnv('PLUGGY_CLIENT_SECRET', 'test');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/auth') ? { apiKey: 'server-secret' } : { id: 'item-2', clientUserId: 'other-user' }), { status: 200 })));
    const response = await endpoint('/api/pluggy/accounts', { itemId: 'item-2' });
    expect(response.status).toBe(403); expect(JSON.stringify(await response.json())).not.toContain('server-secret');
  });
  it('follows v2 cursors and produces identical stable transaction IDs on repeated fetches', async () => {
    vi.stubEnv('PLUGGY_CLIENT_ID', 'test'); vi.stubEnv('PLUGGY_CLIENT_SECRET', 'test');
    const provider = vi.fn(async (url: string) => {
      let data: unknown;
      if (url.endsWith('/auth')) data = { apiKey: 'secret' };
      else if (url.includes('/items/')) data = { id: 'item-1', clientUserId: 'user-1' };
      else if (url.includes('/accounts?')) data = { results: [{ id: 'acc-1', name: 'Banco', type: 'BANK' }] };
      else data = { results: [{ id: 'tx-1', accountId: 'acc-1', amount: -10.25, type: 'DEBIT', currencyCode: 'BRL', status: 'POSTED', date: '2026-10-27T00:00:00Z', description: 'Compra' }], next: null };
      return new Response(JSON.stringify(data), { status: 200 });
    }); vi.stubGlobal('fetch', provider);
    const first = await (await endpoint('/api/bank-sync/fetch', { itemId: 'item-1' })).json();
    await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined;
    const second = await (await endpoint('/api/bank-sync/fetch', { itemId: 'item-1' })).json();
    expect(first.transactions[0]).toMatchObject({ id: 'pluggy:acc-1:tx-1', amount: 10.25, type: 'DEBIT', direction: 'expense' });
    expect(first.transactions).toEqual(second.transactions);
    expect(provider.mock.calls.some(([url]) => url.includes('/v2/transactions?accountId=acc-1'))).toBe(true);
  });
  it.each([{ date: '2026-02-30T00:00:00Z', amount: -10 }, { date: '2026-10-27', amount: Number.MAX_SAFE_INTEGER }])('rejects invalid provider money or civil dates: %j', async transaction => {
    vi.stubEnv('PLUGGY_CLIENT_ID', 'test'); vi.stubEnv('PLUGGY_CLIENT_SECRET', 'test');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const data = url.endsWith('/auth') ? { apiKey: 'secret' }
        : url.includes('/items/') ? { id: 'item-1', clientUserId: 'user-1' }
        : url.includes('/accounts?') ? { results: [{ id: 'acc-1', type: 'BANK' }] }
        : { results: [{ id: 'tx-1', type: 'DEBIT', currencyCode: 'BRL', status: 'POSTED', ...transaction }], next: null };
      return new Response(JSON.stringify(data), { status: 200 });
    }));
    const response = await endpoint('/api/bank-sync/fetch', { itemId: 'item-1' });
    expect(response.status).toBe(502); expect((await response.json()).transactions).toBeUndefined();
  });
});
