import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { parseStatement } from '../statementImport';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
describe('importação de extratos CSV', () => {
 it('identifica repetições por conta e preserva linhas idênticas', async () => {
  const csv = 'data;descrição;valor\n28/10/2026;Mercado;-10,50\n28/10/2026;Mercado;-10,50\n';
  const a = await parseStatement(csv, 'Conta conjunta', 'both');
  const b = await parseStatement(csv, 'Conta conjunta', 'both');
  const c = await parseStatement(csv, 'Conta pessoal', 'partner1');
  expect(a.map(x=>x.id)).toEqual(b.map(x=>x.id)); expect(a[0].id).not.toBe(a[1].id); expect(a[0].id).not.toBe(c[0].id); expect(a[0].amount).toBe(10.5); expect(a[0].direction).toBe('debit');
 });
 it('rejeita data e valor inválidos', async () => {
  await expect(parseStatement('data;descricao;valor\n31/02/2026;teste;10', 'conta', 'both')).rejects.toThrow();
  await expect(parseStatement('data;descricao;valor\n01/02/2026;teste;abc', 'conta', 'both')).rejects.toThrow();
 });
});
