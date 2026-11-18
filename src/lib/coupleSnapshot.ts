import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import type {
  AppState,
  CoupleProfile,
  MedicalCareerProfile,
  MedicalCareerStage,
} from '../types/finance';

type SnapshotData = Record<string, unknown>;

export const PRIVATE_APPEARANCE_KEYS = [
  'themeMode',
  'accentTheme',
  'coupleTheme',
  'partner1Theme',
  'partner2Theme',
] as const;

export const COUPLE_HEADER_SYNC_KEYS = [
  'categoryPercentages',
  'categoryFloors',
  'categoryLocks',
  'partner1Career',
  'partner2Career',
  'partner1Income',
  'partner2Income',
  'partner1Name',
  'partner2Name',
  'partner1Specialty',
  'partner2Specialty',
  'city',
  'emergencyReserveMonthsTarget',
  'expectedYieldAnnual',
  'streakMonths',
  'isInitialHomePhase',
  'investmentsPercentage',
  'protectionCurrentAmount',
  'protectionTotalInvested',
  'protectionYieldAccumulated',
  'isProtectionComplete',
  'freedomTotalInvested',
  'freedomYieldAccumulated',
  'monthlyDepositGuides',
  'completedMonthDeposits',
  'surplusTransfers',
  'dismissedSurplusMonths',
] as const;

export type CoupleHeaderSyncKey = (typeof COUPLE_HEADER_SYNC_KEYS)[number];
export type CoupleHeaderSnapshot = Partial<Record<CoupleHeaderSyncKey, unknown>>;

const VALID_CAREER_STAGES = new Set<MedicalCareerStage>([
  'graduacao',
  'internato',
  'preparacao_residencia',
  'residencia',
  'atuacao',
]);

const FIELD_LABELS: Record<string, string> = {
  partner1Name: 'Nome de Exibição (Pessoa 1)',
  partner2Name: 'Nome de Exibição (Pessoa 2)',
  partner1Specialty: 'Especialidade (Pessoa 1)',
  partner2Specialty: 'Especialidade (Pessoa 2)',
  city: 'Cidade / Região',
  partner1Income: 'Renda Líquida Declarada (Pessoa 1)',
  partner2Income: 'Renda Líquida Declarada (Pessoa 2)',
  partner1Career: 'Jornada Médica (Pessoa 1)',
  partner2Career: 'Jornada Médica (Pessoa 2)',
  emergencyReserveMonthsTarget: 'Meses de Reserva de Emergência',
  expectedYieldAnnual: 'Taxa Real Esperada (% a.a.)',
  investmentsPercentage: 'Percentual de Investimentos',
  categoryPercentages: 'Percentuais de Categorias',
  categoryFloors: 'Pisos Mínimos',
  categoryLocks: 'Travas de Orçamento',
};

export function equalValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalValue(value, b[i]))
    );
  }
  // Firestore values such as Timestamp, GeoPoint and DocumentReference expose isEqual.
  // Unknown class instances are treated conservatively as changed rather than losing metadata.
  if ('isEqual' in a && typeof a.isEqual === 'function') {
    try {
      return a.isEqual(b) === true;
    } catch {
      return false;
    }
  }
  const plain = (value: object) =>
    Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!plain(a) || !plain(b)) return false;
  const left = a as SnapshotData;
  const right = b as SnapshotData;
  const keys = Object.keys(left).sort();
  const otherKeys = Object.keys(right).sort();
  return (
    keys.length === otherKeys.length &&
    keys.every((key, i) => key === otherKeys[i] && equalValue(left[key], right[key]))
  );
}

/** Only avatar metadata changed: do not rehydrate a pending local financial edit. */
export function isAvatarOnlySnapshot(previous: SnapshotData | null, next: SnapshotData): boolean {
  if (!previous || equalValue(previous.avatarProfiles, next.avatarProfiles)) return false;
  const { avatarProfiles: _previousAvatar, ...previousMetadata } = previous;
  const { avatarProfiles: _nextAvatar, ...nextMetadata } = next;
  return equalValue(previousMetadata, nextMetadata);
}

function hasAtMostDecimals(rawStr: string, maxDecimals: number): boolean {
  const normalized = rawStr.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return false;
  const dotIdx = normalized.indexOf('.');
  if (dotIdx === -1) return true;
  return normalized.length - dotIdx - 1 <= maxDecimals;
}

function numberHasAtMostDecimals(val: number, maxDecimals: number): boolean {
  if (!Number.isFinite(val)) return false;
  const factor = Math.pow(10, maxDecimals);
  return Math.abs(Math.round(val * factor) - val * factor) < 1e-6;
}

export type ExplicitYieldParseResult =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; value: number; isExplicitZero: boolean };

/**
 * Parses expectedYieldAnnual (% real p.a.) differentiating empty, invalid, and explicit zero.
 * Never substitutes 0 with 6 or 6.5.
 */
export function parseExplicitYieldInput(
  raw: string | number | null | undefined
): ExplicitYieldParseResult {
  if (raw === undefined || raw === null) {
    return { status: 'empty' };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { status: 'invalid', message: 'A taxa real esperada deve ser um número finito.' };
    }
    if (raw < 0 || raw > 100) {
      return {
        status: 'invalid',
        message: 'A taxa real esperada deve estar entre 0% e 100% ao ano.',
      };
    }
    if (!numberHasAtMostDecimals(raw, 2)) {
      return {
        status: 'invalid',
        message: 'A taxa real esperada permite no máximo 2 casas decimais.',
      };
    }
    const cleanVal = Object.is(raw, -0) ? 0 : Math.round(raw * 100) / 100;
    return {
      status: 'valid',
      value: cleanVal,
      isExplicitZero: cleanVal === 0,
    };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { status: 'empty' };
  }
  if (!hasAtMostDecimals(trimmed, 2)) {
    const normalizedCheck = trimmed.replace(',', '.');
    if (/^-?\d+\.\d{3,}$/.test(normalizedCheck)) {
      return {
        status: 'invalid',
        message: 'A taxa real esperada permite no máximo 2 casas decimais.',
      };
    }
    return {
      status: 'invalid',
      message: 'Informe uma taxa numérica válida entre 0% e 100% ao ano.',
    };
  }
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return {
      status: 'invalid',
      message: 'A taxa real esperada deve estar entre 0% e 100% ao ano.',
    };
  }
  const cleanVal = Object.is(parsed, -0) ? 0 : Math.round(parsed * 100) / 100;
  return {
    status: 'valid',
    value: cleanVal,
    isExplicitZero: cleanVal === 0,
  };
}

export type ReserveMonthsParseResult =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; value: number };

/**
 * Parses emergencyReserveMonthsTarget (integer months in [1, 120]).
 */
export function parseReserveMonthsInput(
  raw: string | number | null | undefined
): ReserveMonthsParseResult {
  if (raw === undefined || raw === null) {
    return { status: 'empty' };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 1 || raw > 120) {
      return {
        status: 'invalid',
        message: 'A meta de reserva deve ser um número inteiro entre 1 e 120 meses.',
      };
    }
    return { status: 'valid', value: raw };
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { status: 'empty' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      status: 'invalid',
      message: 'A meta de reserva deve ser um número inteiro entre 1 e 120 meses.',
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 120) {
    return {
      status: 'invalid',
      message: 'A meta de reserva deve estar entre 1 e 120 meses.',
    };
  }
  return { status: 'valid', value: parsed };
}

export type DeclaredIncomeParseResult =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; value: number; isExplicitZero: boolean };

export function parseDeclaredIncomeInput(
  raw: string | number | null | undefined
): DeclaredIncomeParseResult {
  if (raw === undefined || raw === null) {
    return { status: 'empty' };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0 || raw > 90071992547409 || !numberHasAtMostDecimals(raw, 2)) {
      return {
        status: 'invalid',
        message: 'Informe uma renda líquida válida (>= 0, com até 2 casas decimais).',
      };
    }
    const clean = Object.is(raw, -0) ? 0 : Math.round(raw * 100) / 100;
    return { status: 'valid', value: clean, isExplicitZero: clean === 0 };
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { status: 'empty' };
  }
  if (!hasAtMostDecimals(trimmed, 2)) {
    return {
      status: 'invalid',
      message: 'Informe uma renda líquida válida (>= 0, com até 2 casas decimais).',
    };
  }
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 90071992547409) {
    return {
      status: 'invalid',
      message: 'A renda líquida deve ser maior ou igual a R$ 0,00.',
    };
  }
  const clean = Object.is(parsed, -0) ? 0 : Math.round(parsed * 100) / 100;
  return { status: 'valid', value: clean, isExplicitZero: clean === 0 };
}

function sanitizeCareerProfile(
  career: MedicalCareerProfile | undefined
): { valid: boolean; sanitized?: MedicalCareerProfile; error?: string } {
  if (!career) return { valid: true, sanitized: undefined };
  if (!VALID_CAREER_STAGES.has(career.stage)) {
    return { valid: false, error: 'Etapa de carreira médica inválida.' };
  }
  const next: MedicalCareerProfile = { stage: career.stage };
  if (career.graduationDate !== undefined && career.graduationDate !== '') {
    next.graduationDate = String(career.graduationDate).slice(0, 10);
  }
  if (career.residencyStartDate !== undefined && career.residencyStartDate !== '') {
    next.residencyStartDate = String(career.residencyStartDate).slice(0, 10);
  }
  // Never auto-fill bolsa, auxílio or specialist salary: unknown stays undefined; explicit 0 stays 0!
  if (career.expectedMonthlyIncome !== undefined && career.expectedMonthlyIncome !== null) {
    const incCheck = parseDeclaredIncomeInput(career.expectedMonthlyIncome);
    if (incCheck.status !== 'valid' || incCheck.value > 10_000_000) {
      return {
        valid: false,
        error: 'A previsão de renda/bolsa futura deve ser um valor finito entre R$ 0 e R$ 10.000.000.',
      };
    }
    next.expectedMonthlyIncome = incCheck.value;
  }
  if (career.transitionMonthlyExpense !== undefined && career.transitionMonthlyExpense !== null) {
    const expCheck = parseDeclaredIncomeInput(career.transitionMonthlyExpense);
    if (expCheck.status !== 'valid' || expCheck.value > 10_000_000) {
      return {
        valid: false,
        error: 'O gasto mensal de transição deve ser um valor finito válido.',
      };
    }
    next.transitionMonthlyExpense = expCheck.value;
  }
  return { valid: true, sanitized: next };
}

export interface ProfilePatchValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedPatch: Partial<CoupleProfile>;
}

/**
 * Validates a partial CoupleProfile patch at the domain boundary and strips private visual keys.
 */
export function validateCoupleProfilePatch(
  rawPatch: Partial<CoupleProfile> & Record<string, unknown>
): ProfilePatchValidationResult {
  const errors: string[] = [];
  const sanitized: Partial<CoupleProfile> = {};

  const checkText = (
    key: 'partner1Name' | 'partner2Name' | 'partner1Specialty' | 'partner2Specialty' | 'city',
    allowEmpty: boolean
  ) => {
    if (!(key in rawPatch) || rawPatch[key] === undefined) return;
    const val = rawPatch[key];
    if (typeof val !== 'string') {
      errors.push(`${FIELD_LABELS[key] || key} inválido.`);
      return;
    }
    const trimmed = val.trim();
    if (!allowEmpty && trimmed.length === 0) {
      errors.push(`${FIELD_LABELS[key] || key} não pode ficar vazio.`);
      return;
    }
    if (trimmed.length > 80) {
      errors.push(`${FIELD_LABELS[key] || key} deve ter no máximo 80 caracteres.`);
      return;
    }
    sanitized[key] = trimmed;
  };

  checkText('partner1Name', false);
  checkText('partner2Name', false);
  checkText('partner1Specialty', true);
  checkText('partner2Specialty', true);
  checkText('city', true);

  for (const incKey of ['partner1Income', 'partner2Income'] as const) {
    if (incKey in rawPatch && rawPatch[incKey] !== undefined) {
      const parsed = parseDeclaredIncomeInput(rawPatch[incKey] as number);
      if (parsed.status !== 'valid') {
        errors.push(
          parsed.status === 'invalid'
            ? `${FIELD_LABELS[incKey]}: ${parsed.message}`
            : `${FIELD_LABELS[incKey]} não informado.`
        );
      } else {
        sanitized[incKey] = parsed.value;
      }
    }
  }

  if ('emergencyReserveMonthsTarget' in rawPatch && rawPatch.emergencyReserveMonthsTarget !== undefined) {
    const parsed = parseReserveMonthsInput(rawPatch.emergencyReserveMonthsTarget);
    if (parsed.status !== 'valid') {
      errors.push(
        parsed.status === 'invalid'
          ? parsed.message
          : 'Informe a quantidade de meses da reserva de emergência.'
      );
    } else {
      sanitized.emergencyReserveMonthsTarget = parsed.value;
    }
  }

  if ('expectedYieldAnnual' in rawPatch && rawPatch.expectedYieldAnnual !== undefined) {
    const parsed = parseExplicitYieldInput(rawPatch.expectedYieldAnnual);
    if (parsed.status !== 'valid') {
      errors.push(
        parsed.status === 'invalid'
          ? parsed.message
          : 'Informe a taxa real esperada (use 0 para rendimento zero).'
      );
    } else {
      sanitized.expectedYieldAnnual = parsed.value;
    }
  }

  if ('investmentsPercentage' in rawPatch && rawPatch.investmentsPercentage !== undefined) {
    const v = rawPatch.investmentsPercentage;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
      errors.push('O percentual de investimentos deve estar entre 0% e 100%.');
    } else {
      sanitized.investmentsPercentage = Math.round(v * 100) / 100;
    }
  }

  if ('streakMonths' in rawPatch && rawPatch.streakMonths !== undefined) {
    const v = rawPatch.streakMonths;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      errors.push('Meses consecutivos inválidos.');
    } else {
      sanitized.streakMonths = Math.floor(v);
    }
  }

  if ('isInitialHomePhase' in rawPatch && rawPatch.isInitialHomePhase !== undefined) {
    sanitized.isInitialHomePhase = Boolean(rawPatch.isInitialHomePhase);
  }

  for (const careerKey of ['partner1Career', 'partner2Career'] as const) {
    if (careerKey in rawPatch && rawPatch[careerKey] !== undefined) {
      const check = sanitizeCareerProfile(rawPatch[careerKey]);
      if (!check.valid) {
        errors.push(check.error || `${FIELD_LABELS[careerKey]} inválida.`);
      } else {
        sanitized[careerKey] = check.sanitized;
      }
    }
  }

  if ('partner1Fiscal' in rawPatch && rawPatch.partner1Fiscal !== undefined) {
    sanitized.partner1Fiscal = rawPatch.partner1Fiscal;
  }
  if ('partner2Fiscal' in rawPatch && rawPatch.partner2Fiscal !== undefined) {
    sanitized.partner2Fiscal = rawPatch.partner2Fiscal;
  }

  // Strictly ignore PRIVATE_APPEARANCE_KEYS, avatarProfiles, pluggyCredentials if passed accidentally
  return {
    valid: errors.length === 0,
    errors,
    sanitizedPatch: sanitized,
  };
}

/**
 * Extracts the canonical shared couple header snapshot from AppState.
 * Never includes private appearance keys, avatarProfiles, or credentials.
 */
export function extractCoupleHeaderSnapshot(state: AppState): CoupleHeaderSnapshot {
  const snap: CoupleHeaderSnapshot = {
    categoryPercentages: state.categoryPercentages,
    categoryFloors: state.categoryFloors || {},
    categoryLocks: state.categoryLocks || {},
    partner1Career: state.profile.partner1Career ?? null,
    partner2Career: state.profile.partner2Career ?? null,
    partner1Income: state.profile.partner1Income,
    partner2Income: state.profile.partner2Income,
    partner1Name: state.profile.partner1Name,
    partner2Name: state.profile.partner2Name,
    partner1Specialty: state.profile.partner1Specialty ?? '',
    partner2Specialty: state.profile.partner2Specialty ?? '',
    city: state.profile.city ?? 'Brasil',
    streakMonths: state.profile.streakMonths ?? 0,
    isInitialHomePhase: Boolean(state.profile.isInitialHomePhase),
    protectionCurrentAmount: state.protectionCurrentAmount,
    protectionTotalInvested: state.protectionTotalInvested,
    protectionYieldAccumulated: state.protectionYieldAccumulated ?? 0,
    isProtectionComplete: state.isProtectionComplete,
    freedomTotalInvested: state.freedomTotalInvested,
    freedomYieldAccumulated: state.freedomYieldAccumulated ?? 0,
    monthlyDepositGuides: state.monthlyDepositGuides || {},
    completedMonthDeposits: state.completedMonthDeposits || {},
    surplusTransfers: state.surplusTransfers || [],
    dismissedSurplusMonths: state.dismissedSurplusMonths || [],
  };

  if (
    state.profile.emergencyReserveMonthsTarget !== undefined &&
    state.profile.emergencyReserveMonthsTarget !== null
  ) {
    snap.emergencyReserveMonthsTarget = state.profile.emergencyReserveMonthsTarget;
  }
  if (
    state.profile.expectedYieldAnnual !== undefined &&
    state.profile.expectedYieldAnnual !== null
  ) {
    // Explicit 0 stays 0!
    snap.expectedYieldAnnual = state.profile.expectedYieldAnnual;
  }
  if (
    state.profile.investmentsPercentage !== undefined &&
    state.profile.investmentsPercentage !== null
  ) {
    snap.investmentsPercentage = state.profile.investmentsPercentage;
  }

  return snap;
}

export function extractCoupleHeaderFromRemoteDoc(cData: Record<string, unknown>): CoupleHeaderSnapshot {
  const snap: CoupleHeaderSnapshot = {};
  for (const key of COUPLE_HEADER_SYNC_KEYS) {
    if (key in cData && cData[key] !== undefined) {
      snap[key] = cData[key];
    }
  }
  return snap;
}

export function sanitizeCoupleHeaderPatch(rawPatch: Record<string, unknown>): CoupleHeaderSnapshot {
  const allowed = new Set<string>(COUPLE_HEADER_SYNC_KEYS);
  const clean: CoupleHeaderSnapshot = {};
  for (const [key, value] of Object.entries(rawPatch)) {
    if (!allowed.has(key) || value === undefined) continue;
    clean[key as CoupleHeaderSyncKey] = value;
  }
  return clean;
}

/**
 * Computes the minimal partial patch of changed header fields between baseline and target.
 * Untouched fields are omitted completely so stale values are never re-applied.
 */
export function computeCoupleHeaderPatch(
  baseline: CoupleHeaderSnapshot | null,
  target: CoupleHeaderSnapshot
): CoupleHeaderSnapshot {
  if (!baseline) {
    return sanitizeCoupleHeaderPatch(target as Record<string, unknown>);
  }
  const diff: CoupleHeaderSnapshot = {};
  for (const key of COUPLE_HEADER_SYNC_KEYS) {
    if (!(key in target) || target[key] === undefined) continue;
    const baseVal = baseline[key];
    const nextVal = target[key];
    if (!equalValue(baseVal, nextVal)) {
      diff[key] = nextVal;
    }
  }
  return diff;
}

export interface RebaseCoupleHeaderResult {
  merged: CoupleHeaderSnapshot;
  nextBaseline: CoupleHeaderSnapshot;
  conflictingFields: CoupleHeaderSyncKey[];
  conflicts: Partial<Record<CoupleHeaderSyncKey, { baseline: unknown; local: unknown; remote: unknown }>>;
}

/**
 * Rebases unsent local header changes over an incoming remote couple snapshot:
 * - Untouched local fields adopt remote values.
 * - Independent local edits survive when remote hasn't modified that same field.
 * - Concurrent edits to the exact same field are reported in conflictingFields without silently overwriting.
 */
export function rebaseCoupleHeaderSnapshot(
  baseline: CoupleHeaderSnapshot | null,
  local: CoupleHeaderSnapshot,
  remoteDoc: Record<string, unknown>
): RebaseCoupleHeaderResult {
  const remote = extractCoupleHeaderFromRemoteDoc(remoteDoc);
  if (!baseline) {
    return {
      merged: { ...local, ...remote },
      nextBaseline: { ...remote },
      conflictingFields: [],
      conflicts: {},
    };
  }

  const merged: CoupleHeaderSnapshot = { ...local };
  const nextBaseline: CoupleHeaderSnapshot = { ...baseline, ...remote };
  const conflictingFields: CoupleHeaderSyncKey[] = [];
  const conflicts: RebaseCoupleHeaderResult['conflicts'] = {};

  for (const key of COUPLE_HEADER_SYNC_KEYS) {
    const baseVal = baseline[key];
    const localVal = local[key];
    const remoteHasKey = key in remote;
    const remoteVal = remoteHasKey ? remote[key] : baseVal;

    const localChanged = !equalValue(localVal, baseVal);
    const remoteChanged = remoteHasKey && !equalValue(remoteVal, baseVal);

    if (!localChanged) {
      if (remoteHasKey) {
        merged[key] = remoteVal;
      }
    } else if (!remoteChanged) {
      // Local edited this field while remote left it untouched -> keep local draft!
      merged[key] = localVal;
    } else if (equalValue(localVal, remoteVal)) {
      merged[key] = remoteVal;
    } else {
      // Both edited the exact same field to different values!
      conflictingFields.push(key);
      conflicts[key] = { baseline: baseVal, local: localVal, remote: remoteVal };
      // Keep remote value as authoritative baseline and adopt remote so UI shows conflict for explicit review
      merged[key] = remoteVal;
    }
  }

  return { merged, nextBaseline, conflictingFields, conflicts };
}

export function formatHeaderFieldList(fields: readonly string[]): string {
  return fields.map((f) => FIELD_LABELS[f] || f).join(', ');
}

export interface CommitCoupleHeaderPatchOptions {
  authoredByUid: string;
  isActive?: () => boolean;
  runTransactionFn?: (
    db: Firestore,
    updateFunction: (transaction: any) => Promise<unknown>
  ) => Promise<unknown>;
}

export interface CommitCoupleHeaderPatchOutcome {
  status: 'success' | 'conflict' | 'failure';
  writtenKeys: CoupleHeaderSyncKey[];
  conflictingFields?: CoupleHeaderSyncKey[];
  remoteSnapshot?: CoupleHeaderSnapshot;
  idempotentReplay?: boolean;
  message: string;
}

/**
 * Commits a partial couple header patch inside a Firestore transaction:
 * - Verifies expected baseline values ONLY for the keys being patched.
 * - Independent concurrent updates by the partner on other keys survive untouched.
 * - Concurrent conflicting updates on any patched key abort and return status = 'conflict'.
 * - Never writes avatarProfiles, credentials, or private appearance keys.
 */
export async function commitCoupleHeaderPatchTransaction(
  db: Firestore,
  coupleId: string,
  baselineHeader: CoupleHeaderSnapshot | null,
  rawPatch: CoupleHeaderSnapshot,
  options: CommitCoupleHeaderPatchOptions
): Promise<CommitCoupleHeaderPatchOutcome> {
  const cleanPatch = sanitizeCoupleHeaderPatch(rawPatch as Record<string, unknown>);
  const patchKeys = Object.keys(cleanPatch) as CoupleHeaderSyncKey[];

  if (patchKeys.length === 0) {
    return {
      status: 'success',
      writtenKeys: [],
      idempotentReplay: true,
      message: 'Nenhuma alteração pendente para enviar.',
    };
  }

  if (!options.authoredByUid || options.authoredByUid === 'guest-default-user') {
    return {
      status: 'failure',
      writtenKeys: [],
      message: 'Sessão não autenticada para confirmar alterações na nuvem.',
    };
  }

  const isActive = options.isActive || (() => true);
  const runTx = options.runTransactionFn || (runTransaction as CommitCoupleHeaderPatchOptions['runTransactionFn'])!;

  let conflictFieldsFound: CoupleHeaderSyncKey[] = [];
  let remoteSnapOut: CoupleHeaderSnapshot | undefined;
  let wasReplay = false;

  try {
    const coupleRef = options.runTransactionFn
      ? { path: `couples/${coupleId}` }
      : doc(db, 'couples', coupleId);
    await runTx(db, async (tx: any) => {
      if (!isActive()) {
        throw new Error('Sessão alterada antes de confirmar as alterações.');
      }
      const snap = await tx.get(coupleRef);
      if (!isActive()) {
        throw new Error('Sessão alterada durante a leitura na nuvem.');
      }
      if (!snap.exists()) {
        throw new Error('O espaço compartilhado do casal não foi encontrado na nuvem.');
      }

      const remoteData = (snap.data() || {}) as Record<string, unknown>;
      remoteSnapOut = extractCoupleHeaderFromRemoteDoc(remoteData);

      if (baselineHeader) {
        const conflicts: CoupleHeaderSyncKey[] = [];
        let allAlreadyEqual = true;

        for (const key of patchKeys) {
          const expectedBase = baselineHeader[key];
          const remoteHas = key in remoteData && remoteData[key] !== undefined;
          const remoteVal = remoteHas ? remoteData[key] : undefined;
          const desiredVal = cleanPatch[key];

          if (!equalValue(remoteVal, desiredVal)) {
            allAlreadyEqual = false;
            if (!equalValue(remoteVal, expectedBase)) {
              conflicts.push(key);
            }
          }
        }

        if (conflicts.length > 0) {
          conflictFieldsFound = conflicts;
          throw new Error(
            `Conflito de edição concorrente em: ${formatHeaderFieldList(conflicts)}. Seu par alterou este parâmetro; revise o valor atual antes de salvar.`
          );
        }

        if (allAlreadyEqual) {
          wasReplay = true;
          return;
        }
      }

      const payload: Record<string, unknown> = {
        ...cleanPatch,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: options.authoredByUid,
      };

      if (typeof tx.update === 'function') {
        tx.update(coupleRef, payload);
      } else {
        tx.set(coupleRef, payload, { merge: true });
      }
    });
  } catch (err: any) {
    if (conflictFieldsFound.length > 0) {
      return {
        status: 'conflict',
        writtenKeys: [],
        conflictingFields: conflictFieldsFound,
        remoteSnapshot: remoteSnapOut,
        message: err?.message || 'Conflito concorrente detectado.',
      };
    }
    return {
      status: 'failure',
      writtenKeys: [],
      remoteSnapshot: remoteSnapOut,
      message:
        err?.message ||
        'Não foi possível confirmar na nuvem. Suas alterações continuam salvas neste dispositivo.',
    };
  }

  return {
    status: 'success',
    writtenKeys: wasReplay ? [] : patchKeys,
    remoteSnapshot: remoteSnapOut,
    idempotentReplay: wasReplay,
    message: wasReplay
      ? 'Alterações já estavam confirmadas na nuvem.'
      : 'Alterações confirmadas na nuvem com sucesso.',
  };
}

export type FinancialParametersBackup = Partial<Pick<CoupleProfile, 'expectedYieldAnnual' | 'emergencyReserveMonthsTarget'>>;

const FINANCIAL_BACKUP_KEYS = ['expectedYieldAnnual', 'emergencyReserveMonthsTarget'] as const;
const MAX_FINANCIAL_BACKUP_LENGTH = 4096;

function validateFinancialBackupParameters(value: unknown): FinancialParametersBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Parâmetros do arquivo inválidos.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !FINANCIAL_BACKUP_KEYS.some(allowed => allowed === key))) {
    throw new Error('O arquivo contém campos não suportados.');
  }
  const result: FinancialParametersBackup = {};
  for (const key of FINANCIAL_BACKUP_KEYS) {
    if (!(key in record)) continue;
    if (typeof record[key] !== 'number') throw new Error('O arquivo contém um parâmetro inválido.');
    const parsed = key === 'expectedYieldAnnual' ? parseExplicitYieldInput(record[key]) : parseReserveMonthsInput(record[key]);
    if (parsed.status !== 'valid') throw new Error('O arquivo contém um parâmetro inválido.');
    result[key] = parsed.value;
  }
  return result;
}

/** Export only the two financial assumptions, keeping missing fields absent. */
export function serializeFinancialParametersBackup(profile: Partial<CoupleProfile>): string {
  const parameters: Record<string, unknown> = {};
  for (const key of FINANCIAL_BACKUP_KEYS) {
    if (profile[key] !== undefined) parameters[key] = profile[key];
  }
  return JSON.stringify({ schemaVersion: 1, parameters: validateFinancialBackupParameters(parameters) });
}

/** Parse the limited, versioned format before displaying a preview and applying a patch. */
export function parseFinancialParametersBackup(rawJson: string): FinancialParametersBackup {
  if (typeof rawJson !== 'string' || rawJson.length > MAX_FINANCIAL_BACKUP_LENGTH) throw new Error('Arquivo inválido ou muito grande.');
  let parsed: unknown;
  try { parsed = JSON.parse(rawJson); } catch { throw new Error('Arquivo JSON inválido.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Arquivo inválido.');
  const envelope = parsed as Record<string, unknown>;
  if (Object.keys(envelope).some(key => key !== 'schemaVersion' && key !== 'parameters') || envelope.schemaVersion !== 1 || !('parameters' in envelope)) {
    throw new Error('Versão ou formato de arquivo não suportado.');
  }
  return validateFinancialBackupParameters(envelope.parameters);
}
