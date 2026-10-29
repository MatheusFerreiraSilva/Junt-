import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { parseStatement } from '../statementImport';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

describe('importação de extratos CSV e OFX com relatório e deduplicação', () => {
  it('geradora de relatório de aceitos e rejeitados e gera IDs estáveis', async () => {
    const csv = 'data;descrição;valor\n28/10/2026;Mercado;-10,50\n28/10/2026;Restaurante;-25,00\n';
    const reportA = await parseStatement(csv, 'Conta conjunta', 'both');
    const reportB = await parseStatement(csv, 'Conta conjunta', 'both');
    const reportC = await parseStatement(csv, 'Conta pessoal', 'partner1');

    expect(reportA.accepted.map(x => x.id)).toEqual(reportB.accepted.map(x => x.id));
    expect(reportA.accepted[0].id).not.toBe(reportC.accepted[0].id);
    expect(reportA.accepted[0].amount).toBe(10.5);
    expect(reportA.accepted[0].direction).toBe('debit');
    expect(reportA.acceptedCount).toBe(2);
  });

  it('registra linhas com data ou valor inválidos no relatório de rejeitados sem travar toda a importação', async () => {
    const csvWithErrors = 'data;descricao;valor\n31/02/2026;teste data invalida;10\n15/10/2026;supermercado;-150,00\n01/02/2026;teste valor invalido;abc\n';
    const report = await parseStatement(csvWithErrors, 'conta', 'both');

    expect(report.acceptedCount).toBe(1);
    expect(report.accepted[0].description).toBe('supermercado');
    expect(report.rejectedCount).toBe(2);
    expect(report.rejected[0].reason).toContain('Data civil inválida');
    expect(report.rejected[1].reason).toContain('Valor numérico inválido');
  });

  it('ignora coluna "saldo" e não transforma saldo acumulado em movimentação financeira', async () => {
    const csvWithSaldo = 'data;historico;valor;saldo\n15/10/2026;Pagamento recebido;500,00;10500,00\n';
    const report = await parseStatement(csvWithSaldo, 'Banco Itaú', 'both');

    expect(report.acceptedCount).toBe(1);
    expect(report.accepted[0].amount).toBe(500.0); // 500,00 da coluna valor, e NÃO 10.500,00 do saldo!
  });

  it('deduplica exatamente por FITID no formato OFX', async () => {
    const ofx = `
<OFX>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261015120000
<TRNAMT>1000.00
<FITID>202610150001
<MEMO>Transferencia Recebida
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261016120000
<TRNAMT>-200.00
<FITID>202610160002
<MEMO>Compra Farmacia
</STMTTRN>
</OFX>`;

    const report = await parseStatement(ofx, 'Nubank', 'both');
    expect(report.acceptedCount).toBe(2);
    expect(report.accepted[0].fitid).toBe('202610150001');
    expect(report.accepted[0].amount).toBe(1000);
    expect(report.accepted[0].direction).toBe('credit');

    expect(report.accepted[1].fitid).toBe('202610160002');
    expect(report.accepted[1].amount).toBe(200);
    expect(report.accepted[1].direction).toBe('debit');
  });
});
