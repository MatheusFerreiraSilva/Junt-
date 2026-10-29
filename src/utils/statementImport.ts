import type { BankImportedTransaction, CategoryKeywordRule, PaidBy } from '../types/finance';
import { categorizeTransaction, DEFAULT_KEYWORD_RULES } from './categorizationEngine';

export interface ImportRejectedItem {
  line: number;
  reason: string;
  rawContent?: string;
}

export interface StatementImportReport {
  accepted: BankImportedTransaction[];
  rejected: ImportRejectedItem[];
  totalRowsRead: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
}

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
 * Unescapes XML/SGML entities in OFX strings
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Checks if raw file text is in OFX format
 */
export function isOfxContent(text: string): boolean {
  const upper = text.slice(0, 1000).toUpperCase();
  return (
    upper.includes('OFXHEADER') ||
    upper.includes('<OFX>') ||
    upper.includes('<STMTTRN>') ||
    upper.includes('<BANKTRANLIST>')
  );
}

/**
 * Parses an OFX (Open Financial Exchange 1.x SGML or 2.x XML) statement into standardized transactions and report
 */
export async function parseOfxStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<StatementImportReport> {
  let rawBlocks: string[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|<\/OFX>))/gi;
  for (const match of text.matchAll(trnRegex)) {
    if (match[1]) rawBlocks.push(match[1]);
  }

  // Fallback for SGML without closing tags
  if (rawBlocks.length === 0 && text.toUpperCase().includes('<STMTTRN>')) {
    const parts = text.split(/<STMTTRN>/i).slice(1);
    rawBlocks = parts.map(p => {
      const end = p.search(/<STMTTRN>|<\/BANKTRANLIST>|<\/OFX>/i);
      return end > 0 ? p.substring(0, end) : p;
    });
  }

  if (rawBlocks.length === 0) {
    throw new Error(
      'Nenhuma transação encontrada no arquivo OFX. Verifique se o extrato contém o bloco <STMTTRN>.'
    );
  }

  const getTagValue = (block: string, tag: string): string => {
    const re = new RegExp(`<${tag}>([^<\\r\\n]+)(?:<\\/${tag}>)?`, 'i');
    const m = block.match(re);
    return m ? unescapeXml(m[1]) : '';
  };

  const accountClean = normalize(account);
  const accepted: BankImportedTransaction[] = [];
  const rejected: ImportRejectedItem[] = [];
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (let i = 0; i < rawBlocks.length; i++) {
    const lineNum = i + 1;
    const block = rawBlocks[i];
    const trnType = getTagValue(block, 'TRNTYPE').toUpperCase();
    const rawDate = getTagValue(block, 'DTPOSTED');
    const rawAmt = getTagValue(block, 'TRNAMT').replace(',', '.');
    const memo = getTagValue(block, 'MEMO');
    const name = getTagValue(block, 'NAME');
    const fitId = getTagValue(block, 'FITID');

    // Civil Date Validation
    const dateMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) {
      rejected.push({
        line: lineNum,
        reason: `Data inválida ou ausente em DTPOSTED: "${rawDate}"`,
        rawContent: memo || name,
      });
      continue;
    }

    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const dateObj = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(dateObj.valueOf()) || dateObj.toISOString().slice(0, 10) !== date) {
      rejected.push({
        line: lineNum,
        reason: `Data civil inválida no calendário: "${date}"`,
        rawContent: memo || name,
      });
      continue;
    }

    const numAmt = parseFloat(rawAmt);
    if (!Number.isFinite(numAmt) || numAmt === 0) {
      rejected.push({
        line: lineNum,
        reason: 'Valor monetário nulo ou numérico inválido',
        rawContent: memo || name,
      });
      continue;
    }

    const description = memo || name || 'Lançamento bancário';

    // Credit vs Debit determination
    const isCreditType = ['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV'].includes(trnType);
    const isDebitType = ['DEBIT', 'PAYMENT', 'FEE', 'CHECK', 'SRVCHG', 'POS', 'ATM'].includes(trnType);
    let isCredit = isCreditType || numAmt > 0;
    if (isDebitType && numAmt < 0) isCredit = false;

    const absAmount = Math.round(Math.abs(numAmt) * 100) / 100;
    const catResult = categorizeTransaction(description, customRules);

    // Stable ID generation based on FITID or account+date+description+amount
    let id = '';
    if (fitId) {
      // Deterministic FITID ID without duplicate increment
      id = `ofx:${accountClean}:${normalize(fitId)}`;
    } else {
      const baseKey = `${accountClean}|${date}|${normalize(description)}|${Math.round(numAmt * 100)}`;
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(baseKey)
      );
      id = 'ofx:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }

    if (seenIds.has(id)) {
      duplicateCount++;
      rejected.push({
        line: lineNum,
        reason: `Lançamento duplicado no mesmo arquivo (FITID: ${fitId || id})`,
        rawContent: description,
      });
      continue;
    }

    seenIds.add(id);

    accepted.push({
      id,
      itemId: 'manual',
      accountId: account.trim(),
      bankName: account.trim(),
      amount: absAmount,
      date,
      description,
      direction: isCredit ? 'credit' : 'debit',
      owner,
      status: 'pending',
      category: catResult.category,
      subcategory: catResult.subcategory,
      matchedRule: catResult.matchedKeyword,
      fitid: fitId || undefined,
    });
  }

  return {
    accepted,
    rejected,
    totalRowsRead: rawBlocks.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    duplicateCount,
  };
}

/**
 * Parses Brazilian CSV statements (Nubank, Itaú, Bradesco, Santander, Inter, BTG, BB, etc.)
 */
export async function parseCsvStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<StatementImportReport> {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const data = parseCsvRows(text.replace(/^\uFEFF/, ''), delim);
  const rawHeader = data.shift() || [];
  const header = rawHeader.map(normalize);

  const findExact = (...names: string[]) =>
    header.findIndex(h => names.some(n => h === normalize(n)));

  const findIncludes = (...names: string[]) =>
    header.findIndex(h => names.some(n => h.includes(normalize(n))));

  // Find date, description and value columns
  const di = findIncludes('data', 'date', 'data lancamento', 'data transacao', 'dt');
  const de = findIncludes('descricao', 'description', 'historico', 'titulo', 'lancamento', 'memo', 'detalhes', 'estabelecimento');

  // EXCLUDE 'saldo' from transaction value column search!
  let am = findExact('valor', 'amount', 'value', 'quantia', 'valor (r$)', 'valor do lancamento');
  if (am < 0) {
    am = findIncludes('valor', 'amount', 'value', 'quantia', 'lancamento');
  }

  // Check if header contains explicit "saldo" column
  const saldoIndex = findIncludes('saldo', 'saldo acumulado', 'saldo disponível');

  if (di < 0 || de < 0 || am < 0) {
    throw new Error(
      'CSV precisa conter colunas claras de Data, Descrição (ou Histórico) e Valor do Lançamento. Verifique o cabeçalho.'
    );
  }

  if (data.length > 5000) {
    throw new Error('O arquivo excede o limite de 5.000 lançamentos por importação.');
  }

  const accountClean = normalize(account);
  const accepted: BankImportedTransaction[] = [];
  const rejected: ImportRejectedItem[] = [];
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (let index = 0; index < data.length; index++) {
    const lineNum = index + 2; // +2 considering header line
    const row = data[index];
    const rawDate = (row[di] || '').trim();

    if (!rawDate) {
      rejected.push({
        line: lineNum,
        reason: 'Linha vazia ou sem data',
      });
      continue;
    }

    // Civil Date Validation
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawDate);
    const date = br ? `${br[3]}-${br[2]}-${br[1]}` : rawDate.slice(0, 10);
    const dateObj = new Date(date + 'T00:00:00Z');

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(dateObj.valueOf()) ||
      dateObj.toISOString().slice(0, 10) !== date
    ) {
      rejected.push({
        line: lineNum,
        reason: `Data civil inválida: "${rawDate}"`,
        rawContent: row.join(' | '),
      });
      continue;
    }

    let val = (row[am] || '').trim().replace(/R\$|\s/g, '');
    if (val.includes(',')) {
      val = val.replace(/\./g, '').replace(',', '.');
    }

    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) {
      rejected.push({
        line: lineNum,
        reason: `Valor numérico inválido: "${row[am]}"`,
        rawContent: row.join(' | '),
      });
      continue;
    }

    const signed = Number(val);
    const description = (row[de] || '').trim();

    if (!description) {
      rejected.push({
        line: lineNum,
        reason: 'Descrição do lançamento em branco',
      });
      continue;
    }

    if (!Number.isSafeInteger(Math.round(signed * 100)) || signed === 0) {
      rejected.push({
        line: lineNum,
        reason: 'Valor monetário zero ou fora dos limites numéricos',
        rawContent: description,
      });
      continue;
    }

    // Check optional FITID column if present in CSV
    const fitidColIndex = findIncludes('fitid', 'id_transacao', 'id transacao', 'identificador');
    const csvFitId = fitidColIndex >= 0 ? (row[fitidColIndex] || '').trim() : '';

    const isCredit = signed > 0;
    const absAmount = Math.round(Math.abs(signed) * 100) / 100;
    const catResult = categorizeTransaction(description, customRules);

    let id = '';
    if (csvFitId) {
      id = `csv:${accountClean}:${normalize(csvFitId)}`;
    } else {
      const baseKey = `${accountClean}|${date}|${normalize(description)}|${Math.round(signed * 100)}`;
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(baseKey)
      );
      id = 'csv:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }

    if (seenIds.has(id)) {
      duplicateCount++;
      rejected.push({
        line: lineNum,
        reason: `Lançamento idêntico duplicado no arquivo: ${description}`,
        rawContent: row.join(' | '),
      });
      continue;
    }

    seenIds.add(id);

    accepted.push({
      id,
      itemId: 'manual',
      accountId: account.trim(),
      bankName: account.trim(),
      amount: absAmount,
      date,
      description,
      direction: isCredit ? 'credit' : 'debit',
      owner,
      status: 'pending',
      category: catResult.category,
      subcategory: catResult.subcategory,
      matchedRule: catResult.matchedKeyword,
      fitid: csvFitId || undefined,
    });
  }

  return {
    accepted,
    rejected,
    totalRowsRead: data.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    duplicateCount,
  };
}

/**
 * Universal Statement Parser: Automatically routes to OFX or CSV parser
 */
export async function parseStatement(
  text: string,
  account: string,
  owner: PaidBy,
  customRules: CategoryKeywordRule[] = DEFAULT_KEYWORD_RULES
): Promise<StatementImportReport> {
  if (!account.trim()) {
    throw new Error('Informe uma identificação para a conta (ex: Nubank, Itaú Personalité, etc.).');
  }

  if (isOfxContent(text)) {
    return parseOfxStatement(text, account, owner, customRules);
  }

  return parseCsvStatement(text, account, owner, customRules);
}
