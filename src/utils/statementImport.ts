import type { BankImportedTransaction, PaidBy } from '../types/finance';

// Delimited CSV parser supporting quoted separators and embedded line breaks.
function rows(text: string, delimiter: string): string[][] {
  const result: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && ch === delimiter) { row.push(value); value = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) { if (ch === '\r' && text[i+1] === '\n') i++; row.push(value); if (row.some(v => v.trim())) result.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (quoted) throw new Error('Arquivo CSV contém aspas não fechadas.');
  row.push(value); if (row.some(v => v.trim())) result.push(row); return result;
}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export async function parseStatement(text: string, account: string, owner: PaidBy): Promise<BankImportedTransaction[]> {
  if (!account.trim()) throw new Error('Informe uma identificação estável para a conta.');
  const first = text.split(/\r?\n/, 1)[0]; const delim = first.includes(';') ? ';' : ',';
  const data = rows(text.replace(/^\uFEFF/, ''), delim); const header = (data.shift() || []).map(normalize);
  const find = (...names: string[]) => header.findIndex(h => names.includes(h));
  const di = find('data', 'date'), de = find('descricao', 'description', 'historico', 'titulo'), am = find('valor', 'amount', 'value');
  if (di < 0 || de < 0 || am < 0) throw new Error('CSV precisa ter colunas data, descrição e valor. Valores negativos são gastos e positivos são entradas.');
  if (data.length > 5000) throw new Error('O arquivo excede 5.000 lançamentos.');
  const counts = new Map<string, number>(); const result: BankImportedTransaction[] = [];
  for (const [index, row] of data.entries()) {
    const raw = (row[di] || '').trim(); const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw); const date = br ? br[3]+'-'+br[2]+'-'+br[1] : raw;
    const dateObj = new Date(date + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateObj.valueOf()) || dateObj.toISOString().slice(0,10) !== date) throw new Error('Data inválida na linha '+(index+2)+'.');
    let val = (row[am] || '').trim().replace(/R\$|\s/g, ''); if (val.includes(',')) val = val.replace(/\./g,'').replace(',','.');
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) throw new Error('Valor inválido na linha '+(index+2)+'.');
    const signed = Number(val), description = (row[de] || '').trim(); if (!description || !Number.isSafeInteger(Math.round(signed*100)) || signed === 0) throw new Error('Descrição ou valor inválido na linha '+(index+2)+'.');
    const key = [normalize(account),date,normalize(description),Math.round(signed*100)].join('|'); const occurrence = counts.get(key) || 0; counts.set(key, occurrence + 1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key+'|'+occurrence)); const id = 'csv:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    result.push({id,itemId:'manual',accountId:account.trim(),amount:Math.abs(signed),date,description,direction:signed > 0 ? 'credit':'debit',owner,status:'pending'});
  }
  return result;
}
