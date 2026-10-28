import type { Express, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { authorizedCouple, userQuota } from './security';

type Data = Record<string, unknown>;
let cachedKey = '';
let keyExpires = 0;
const configured = () => Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
const operation = new AsyncLocalStorage<AbortSignal>();

async function provider(endpoint: string, init: RequestInit = {}, authenticate = true): Promise<Data> {
  operation.getStore()?.throwIfAborted();
  if (!configured()) throw new Error('NOT_CONFIGURED');
  if (authenticate && (!cachedKey || keyExpires < Date.now())) {
    const auth = await provider('/auth', { method: 'POST', body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }) }, false);
    if (typeof auth.apiKey !== 'string') throw new Error('INVALID_PROVIDER');
    cachedKey = auth.apiKey; keyExpires = Date.now() + 60 * 60 * 1000;
  }
  const requestSignal = AbortSignal.timeout(20_000);
  const signal = operation.getStore() ? AbortSignal.any([requestSignal, operation.getStore()!]) : requestSignal;
  const response = await fetch(`https://api.pluggy.ai${endpoint}`, { ...init, signal, headers: { 'Content-Type': 'application/json', ...(authenticate ? { 'X-API-KEY': cachedKey } : {}), ...init.headers } });
  if (!response.ok) { if (response.status === 401) keyExpires = 0; throw new Error('PROVIDER_UNAVAILABLE'); }
  return await response.json() as Data;
}

function failure(res: Response, error: unknown) {
  if (res.headersSent) return;
  const missing = error instanceof Error && error.message === 'NOT_CONFIGURED';
  res.status(missing ? 503 : 502).json({ error: missing ? 'Open Finance aguarda configuração no servidor.' : 'Open Finance indisponível. Nenhuma movimentação foi importada.', source: 'pluggy', simulated: false, integrationStatus: missing ? 'not_configured' : 'unavailable' });
}

async function ownedItem(itemId: unknown, uid: string): Promise<Data | null> {
  if (typeof itemId !== 'string' || !/^[\w-]{1,128}$/.test(itemId)) return null;
  const item = await provider(`/items/${encodeURIComponent(itemId)}`);
  if (item.connector && typeof item.connector === 'object' && 'isSandbox' in item.connector && item.connector.isSandbox === true) throw new Error('SANDBOX_NOT_ALLOWED');
  // clientUserId is set only by our server's scoped Connect Token.
  return item.clientUserId === uid ? item : null;
}

async function accounts(itemId: string): Promise<Data[]> {
  const results: Data[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = await provider(`/accounts?itemId=${encodeURIComponent(itemId)}&page=${page}&pageSize=500`);
    if (!Array.isArray(data.results)) throw new Error('INVALID_PROVIDER');
    results.push(...data.results as Data[]);
    if (results.length > 50) throw new Error('IMPORT_TOO_LARGE');
    totalPages = typeof data.totalPages === 'number' ? data.totalPages : 1;
    if (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > 100) throw new Error('INVALID_PROVIDER');
    page++;
  } while (page <= totalPages);
  return results;
}

export function registerPluggy(app: Express) {
  app.use(['/api/pluggy', '/api/bank-sync'], (_req, res, next) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      if (!res.headersSent) res.status(504).json({ error: 'A consulta bancária demorou demais. Tente novamente.', source: 'pluggy', simulated: false, integrationStatus: 'unavailable' });
    }, 60_000);
    timeout.unref();
    res.once('finish', () => clearTimeout(timeout));
    res.once('close', () => { clearTimeout(timeout); controller.abort(); });
    operation.run(controller.signal, next);
  });
  app.post('/api/pluggy/auth', (_req, res) => res.json({ configured: configured(), source: 'pluggy', simulated: false, integrationStatus: configured() ? 'ready' : 'not_configured' }));
  app.post('/api/pluggy/connect-token', userQuota(10, 60_000), async (req, res) => {
    try {
      const uid = String(res.locals.uid);
      if (!await authorizedCouple(uid)) return void res.status(403).json({ error: 'Você precisa de um vínculo de casal autorizado.' });
      if (req.body?.itemId && !await ownedItem(req.body.itemId, uid)) return void res.status(403).json({ error: 'Conexão não autorizada.' });
      const data = await provider('/connect_token', { method: 'POST', body: JSON.stringify({ ...(req.body?.itemId ? { itemId: req.body.itemId } : {}), options: { clientUserId: uid, avoidDuplicates: true } }) });
      if (typeof data.accessToken !== 'string') throw new Error('INVALID_PROVIDER');
      res.json({ accessToken: data.accessToken, source: 'pluggy', simulated: false });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/pluggy/items', userQuota(20, 60_000), async (req, res) => {
    try {
      const uid = String(res.locals.uid);
      if (!await authorizedCouple(uid)) return void res.status(403).json({ error: 'Vínculo de casal não autorizado.' });
      const item = await ownedItem(req.body?.itemId, uid);
      if (!item) return void res.status(403).json({ error: 'Conexão não autorizada.' });
      res.json({ item: { id: item.id, status: item.status, connector: item.connector }, source: 'pluggy', simulated: false });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/pluggy/accounts', userQuota(20, 60_000), async (req, res) => {
    try {
      const uid = String(res.locals.uid);
      if (!await authorizedCouple(uid) || !await ownedItem(req.body?.itemId, uid)) return void res.status(403).json({ error: 'Conexão não autorizada.' });
      const results = await accounts(req.body.itemId);
      res.json({ results, source: 'pluggy', simulated: false, integrationStatus: 'connected' });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/bank-sync/fetch', userQuota(10, 60_000), async (req, res) => {
    try {
      const uid = String(res.locals.uid);
      if (!await authorizedCouple(uid) || !await ownedItem(req.body?.itemId, uid)) return void res.status(403).json({ error: 'Conexão não autorizada.' });
      const bankAccounts = await accounts(req.body.itemId);
      const transactions: Data[] = [];
      for (const account of bankAccounts) {
        if (typeof account.id !== 'string') throw new Error('INVALID_PROVIDER');
        let next: string | null = `?accountId=${encodeURIComponent(account.id)}`;
        let pageCount = 0;
        do {
          const feed = await provider(`/v2/transactions${next}`);
          if (!Array.isArray(feed.results)) throw new Error('INVALID_PROVIDER');
          if (++pageCount > 100) throw new Error('IMPORT_TOO_LARGE');
          next = typeof feed.next === 'string' ? feed.next : null;
          if (next && (!next.startsWith('?') || new URLSearchParams(next).get('accountId') !== account.id)) throw new Error('INVALID_PROVIDER');
          for (const tx of feed.results as Data[]) {
            if (typeof tx.id !== 'string' || typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || typeof tx.date !== 'string') throw new Error('INVALID_PROVIDER');
            if (tx.status !== 'POSTED') continue;
            if (tx.currencyCode !== 'BRL' || (tx.type !== 'CREDIT' && tx.type !== 'DEBIT')) throw new Error('UNSUPPORTED_TRANSACTION');
            const date = tx.date.slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('INVALID_PROVIDER_DATE');
            const cents = Math.round(Math.abs(tx.amount) * 100);
            if (!Number.isSafeInteger(cents)) throw new Error('INVALID_PROVIDER_AMOUNT');
            if (cents === 0) continue;
            if (transactions.length >= 25_000) throw new Error('IMPORT_TOO_LARGE');
            transactions.push({ id: `pluggy:${account.id}:${tx.id}`, providerTransactionId: tx.id, accountId: account.id, description: typeof tx.description === 'string' ? tx.description : '', amount: cents / 100, providerCategory: typeof tx.category === 'string' ? tx.category : null, operationType: typeof tx.operationType === 'string' ? tx.operationType : null, type: tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT', direction: tx.type === 'CREDIT' ? 'income' : 'expense', bankName: account.name, accountType: account.type === 'CREDIT' ? 'cartao' : 'corrente', category: 'outros', date, paidBy: 'both', confidence: 0, categoryReason: 'Revise a categoria antes de importar.', source: 'pluggy', simulated: false });
          }
          } while (next);
      }
      res.json({ success: true, source: 'pluggy', simulated: false, syncedAt: new Date().toISOString(), transactions });
    } catch (error) { failure(res, error); }
  });
}
