import type { BankImportedTransaction, CategoryKeywordRule, PaidBy } from '../types/finance';
import { categorizeTransaction, DEFAULT_KEYWORD_RULES } from './categorizationEngine';

// Delimited CSV parser supporting quoted separators and embedded line breaks.
function parseCsvRows(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && ch === delimiter) {
      row.push(value);
      value = '';
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      if (row.some(v => v.trim())) result.push(row);
      row = [];
      value = '';
    } else {
      value += ch;
    }
  }
  if (quoted) throw new Error('Arquivo CSV contém aspas não fechadas.');
  row.push(value);
  if (row.some(v => v.trim())) result.push(row);
  return result;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/**
 * Checks if raw file text is in OFX format
 */
export function isOfxContent(text: string): boolean {
  const upper = text.slice(0, 1000).toUpperCase();
  return upper.includes('OFXHEADER') || upper.includes('<OFX>') || upper.includes('<STMTTRN>') || upper.includes('<BANKTRANLIST>');
}

/**
 * Parses an OFX (Open Financial Exchange 1.x SGML or 2.x XML) statement into standardized transactions
 */
export async function parseOfxStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<BankImportedTransaction[]> {
  let rawBlocks: string[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  for (const match of text.matchAll(trnRegex)) {
    if (match[1]) rawBlocks.push(match[1]);
  }

  // Fallback for SGML without closing </STMTTRN> tags
  if (rawBlocks.length === 0 && text.toUpperCase().includes('<STMTTRN>')) {
    const parts = text.split(/<STMTTRN>/i).slice(1);
    rawBlocks = parts.map(p => {
      const end = p.search(/<STMTTRN>|<\/BANKTRANLIST>|<\/OFX>/i);
      return end > 0 ? p.substring(0, end) : p;
    });
  }

  if (rawBlocks.length === 0) {
    throw new Error('Nenhuma transação encontrada no arquivo OFX. Verifique se o extrato contém o bloco <STMTTRN>.');
  }

  const getTagValue = (block: string, tag: string): string => {
    // Matches <TAG>value or <TAG>value</TAG>
    const re = new RegExp(`<${tag}>([^<\\r\\n]+)(?:<\\/${tag}>)?`, 'i');
    const m = block.match(re);
    return m ? m[1].trim() : '';
  };

  const counts = new Map<string, number>();
  const results: BankImportedTransaction[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const trnType = getTagValue(block, 'TRNTYPE').toUpperCase();
    const rawDate = getTagValue(block, 'DTPOSTED'); // e.g. 20261015120000[-3:BRT] or 20261015
    const rawAmt = getTagValue(block, 'TRNAMT').replace(',', '.');
    const memo = getTagValue(block, 'MEMO');
    const name = getTagValue(block, 'NAME');
    const fitId = getTagValue(block, 'FITID');

    // Extract YYYY-MM-DD from YYYYMMDD...
    const dateMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    const numAmt = parseFloat(rawAmt);
    if (!Number.isFinite(numAmt) || numAmt === 0) continue;

    const description = memo || name || 'Lançamento bancário';
    const isCredit = trnType === 'CREDIT' || numAmt > 0;
    const absAmount = Math.round(Math.abs(numAmt) * 100) / 100;

    // Categorize automatically
    const catResult = categorizeTransaction(description, customRules);

    // Cryptographic deterministic ID based on fitId or content
    const baseKey = fitId
      ? `ofx:${normalize(account)}|${fitId}`
      : `${normalize(account)}|${date}|${normalize(description)}|${Math.round(numAmt * 100)}`;

    const occurrence = counts.get(baseKey) || 0;
    counts.set(baseKey, occurrence + 1);

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(baseKey + '|' + occurrence)
    );
    const id =
      'ofx:' +
      Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');

    results.push({
      id,
      itemId: 'manual',
      accountId: account.trim(),
      amount: absAmount,
      date,
      description,
      direction: isCredit ? 'credit' : 'debit',
      owner,
      status: 'pending',
      category: catResult.category,
      subcategory: catResult.subcategory,
      matchedRule: catResult.matchedKeyword,
    });
  }

  return results;
}

/**
 * Parses Brazilian CSV statements (Nubank, Itaú, Bradesco, Santander, Inter, BTG, BB, etc.)
 */
export async function parseCsvStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<BankImportedTransaction[]> {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const data = parseCsvRows(text.replace(/^\uFEFF/, ''), delim);
  const rawHeader = data.shift() || [];
  const header = rawHeader.map(normalize);

  const find = (...names: string[]) =>
    header.findIndex(h => names.some(n => h.includes(normalize(n))));

  const di = find('data', 'date', 'data lancamento', 'data transacao', 'dt');
  const de = find('descricao', 'description', 'historico', 'titulo', 'lancamento', 'memo', 'detalhes', 'estabelecimento');
  const am = find('valor', 'amount', 'value', 'quantia', 'saldo');

  if (di < 0 || de < 0 || am < 0) {
    throw new Error(
      'CSV precisa conter colunas de Data, Descrição (ou Histórico) e Valor. Verifique o cabeçalho do arquivo.'
    );
  }

  if (data.length > 5000) {
    throw new Error('O arquivo excede o limite de 5.000 lançamentos por importação.');
  }

  const counts = new Map<string, number>();
  const result: BankImportedTransaction[] = [];

  for (const [index, row] of data.entries()) {
    const raw = (row[di] || '').trim();
    if (!raw) continue;

    // Detect DD/MM/YYYY or YYYY-MM-DD
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    const date = br ? `${br[3]}-${br[2]}-${br[1]}` : raw.slice(0, 10);
    const dateObj = new Date(date + 'T00:00:00Z');

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(dateObj.valueOf()) ||
      dateObj.toISOString().slice(0, 10) !== date
    ) {
      throw new Error(`Data inválida na linha ${index + 2}: "${raw}"`);
    }

    let val = (row[am] || '').trim().replace(/R\$|\s/g, '');
    if (val.includes(',')) {
      val = val.replace(/\./g, '').replace(',', '.');
    }

    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) {
      throw new Error(`Valor numérico inválido na linha ${index + 2}: "${row[am]}"`);
    }

    const signed = Number(val);
    const description = (row[de] || '').trim();

    if (!description || !Number.isSafeInteger(Math.round(signed * 100)) || signed === 0) {
      continue;
    }

    const isCredit = signed > 0;
    const absAmount = Math.round(Math.abs(signed) * 100) / 100;

    const catResult = categorizeTransaction(description, customRules);

    const key = [normalize(account), date, normalize(description), Math.round(signed * 100)].join('|');
    const occurrence = counts.get(key) || 0;
    counts.set(key, occurrence + 1);

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(key + '|' + occurrence)
    );
    const id =
      'csv:' +
      Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');

    result.push({
      id,
      itemId: 'manual',
      accountId: account.trim(),
      amount: absAmount,
      date,
      description,
      direction: isCredit ? 'credit' : 'debit',
      owner,
      status: 'pending',
      category: catResult.category,
      subcategory: catResult.subcategory,
      matchedRule: catResult.matchedKeyword,
    });
  }

  return result;
}

/**
 * Universal Statement Parser: Automatically routes to OFX or CSV parser
 */
export async function parseStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<BankImportedTransaction[]> {
  if (!account.trim()) {
    throw new Error('Informe uma identificação para a conta (ex: Nubank, Itaú Personalité, etc.).');
  }

  if (isOfxContent(text)) {
    return parseOfxStatement(text, account, owner, customRules);
  }

  return parseCsvStatement(text, account, owner, customRules);
}
