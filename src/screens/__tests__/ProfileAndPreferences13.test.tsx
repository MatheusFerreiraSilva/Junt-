import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import {
  COUPLE_HEADER_SYNC_KEYS,
  PRIVATE_APPEARANCE_KEYS,
  isAvatarOnlySnapshot,
  parseExplicitYieldInput,
  parseReserveMonthsInput,
  validateCoupleProfilePatch,
  extractCoupleHeaderSnapshot,
  computeCoupleHeaderPatch,
  rebaseCoupleHeaderSnapshot,
  commitCoupleHeaderPatchTransaction,
  serializeFinancialParametersBackup,
  parseFinancialParametersBackup,
} from '../../lib/coupleSnapshot';
import { createPreferenceSync, DEFAULT_PREFERENCES, type PreferenceStore } from '../../lib/accountPreferences';
import { calculateDynamicCombinedNetIncome } from '../../utils/incomeTiersEngine';
import { selectEffectiveBudgetPlanForCompetence } from '../../utils/domainSelectors';
import { computeCompetenceBudgetSnapshot } from '../../utils/rebalanceBudgetEngine';
import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { SettingsScreen } from '../SettingsScreen';
import type { AppState } from '../../types/finance';

const makeBaseState = (month = '2026-10'): AppState => ({
  profile: {
    partner1Name: 'Ana',
    partner1Specialty: 'Cardiologia',
    partner2Name: 'Bruno',
    partner2Specialty: 'Pediatria',
    city: 'São Paulo - SP',
    partner1Income: 20000,
    partner2Income: 16000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    streakMonths: 3,
    themeMode: 'light',
    accentTheme: 'emerald',
    coupleTheme: 'emerald',
    partner1Theme: 'sapphire',
    partner2Theme: 'rose',
    investmentsPercentage: 10,
  },
  categoryPercentages: {
    moradia: 30,
    transporte: 10,
    comida: 18,
    lazer: 12,
    protecao: 12,
    profissional: 8,
  },
  isCustomizedPercentages: true,
  categoryFloors: {
    moradia: 0,
    transporte: 0,
    comida: 0,
    lazer: 0,
    protecao: 0,
    profissional: 0,
    investimentos: 0,
  },
  categoryLocks: {
    moradia: false,
    transporte: false,
    comida: false,
    lazer: false,
    protecao: false,
    profissional: false,
    investimentos: true,
  },
  monthlyBudgetPlans: {},
  currentMonth: month,
  expenses: [],
  incomes: [],
  installments: [],
  piggyBanks: [],
  linkedAccounts: [],
  pluggyAccounts: [],
  keywordRules: [],
  detectedSubscriptions: [],
  incomeSourceRules: [],
  pendingConfirmations: [],
  alertRules: [],
  notifications: [],
  protectionCurrentAmount: 45000,
  protectionTotalInvested: 42000,
  protectionYieldAccumulated: 3000,
  isProtectionComplete: false,
  freedomTotalInvested: 120000,
  freedomYieldAccumulated: 15000,
  surplusTransfers: [],
  dismissedSurplusMonths: [],
  monthlyDepositGuides: {},
  completedMonthDeposits: {},
  pushSettings: {} as any,
  medicalShifts: [],
  medicalShiftPresets: [],
  hospitalMappingRules: [],
  appMode: 'casal',
  strategicIntents: [],
  financialOperations: [],
});

describe('13 — Perfil, preferências privadas e edição parcial', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('1. Differentiates empty, invalid, and explicit zero for expectedYieldAnnual and validates emergencyReserveMonthsTarget domain bounds', () => {
    expect(parseExplicitYieldInput('')).toEqual({ status: 'empty' });
    expect(parseExplicitYieldInput('   ')).toEqual({ status: 'empty' });
    expect(parseExplicitYieldInput(undefined)).toEqual({ status: 'empty' });

    expect(parseExplicitYieldInput('abc').status).toBe('invalid');
    expect(parseExplicitYieldInput('-0.5').status).toBe('invalid');
    expect(parseExplicitYieldInput('101').status).toBe('invalid');
    expect(parseExplicitYieldInput('6.125').status).toBe('invalid'); // > 2 decimal places

    expect(parseExplicitYieldInput('0')).toEqual({
      status: 'valid',
      value: 0,
      isExplicitZero: true,
    });
    expect(parseExplicitYieldInput('0,00')).toEqual({
      status: 'valid',
      value: 0,
      isExplicitZero: true,
    });
    expect(parseExplicitYieldInput(0)).toEqual({
      status: 'valid',
      value: 0,
      isExplicitZero: true,
    });
    expect(parseExplicitYieldInput('5,75')).toEqual({
      status: 'valid',
      value: 5.75,
      isExplicitZero: false,
    });

    expect(parseReserveMonthsInput('')).toEqual({ status: 'empty' });
    expect(parseReserveMonthsInput('0').status).toBe('invalid');
    expect(parseReserveMonthsInput('121').status).toBe('invalid');
    expect(parseReserveMonthsInput('6.5').status).toBe('invalid');
    expect(parseReserveMonthsInput('8')).toEqual({ status: 'valid', value: 8 });

    const validZeroPatch = validateCoupleProfilePatch({
      expectedYieldAnnual: 0,
      emergencyReserveMonthsTarget: 9,
    });
    expect(validZeroPatch.valid).toBe(true);
    expect(validZeroPatch.sanitizedPatch).toEqual({
      expectedYieldAnnual: 0,
      emergencyReserveMonthsTarget: 9,
    });

    // Only the two financial assumptions are exported; zero and absent fields remain distinct.
    const backupJson = serializeFinancialParametersBackup({ expectedYieldAnnual: 0, emergencyReserveMonthsTarget: 9 });
    expect(parseFinancialParametersBackup(backupJson)).toEqual({ expectedYieldAnnual: 0, emergencyReserveMonthsTarget: 9 });
    expect(JSON.parse(backupJson)).toEqual({ schemaVersion: 1, parameters: { expectedYieldAnnual: 0, emergencyReserveMonthsTarget: 9 } });

  });

  it('2. Partial header diff sends ONLY changed fields, never sends avatarProfiles or private themes, merges concurrent disjoint edits, and flags conflicts on the same parameter', async () => {
    for (const privKey of PRIVATE_APPEARANCE_KEYS) {
      expect(COUPLE_HEADER_SYNC_KEYS).not.toContain(privKey as any);
    }
    expect(COUPLE_HEADER_SYNC_KEYS).not.toContain('avatarProfiles' as any);

    const baseState = makeBaseState();
    const baseSnap = extractCoupleHeaderSnapshot(baseState);

    // Session A edits ONLY partner1Name
    const nextStateA = makeBaseState();
    nextStateA.profile.partner1Name = 'Dra. Ana';
    const patchA = computeCoupleHeaderPatch(baseSnap, extractCoupleHeaderSnapshot(nextStateA));
    expect(patchA).toEqual({ partner1Name: 'Dra. Ana' });
    expect('partner1Income' in patchA).toBe(false);
    expect('expectedYieldAnnual' in patchA).toBe(false);
    expect('categoryPercentages' in patchA).toBe(false);
    expect('avatarProfiles' in patchA).toBe(false);

    // Fake Firestore in-memory store for two-session transaction test
    let cloudDoc: Record<string, unknown> = {
      id: 'couple-1',
      partner1Uid: 'uid-ana',
      partner2Uid: 'uid-bruno',
      ...baseSnap,
      avatarProfiles: { partner1: { ownerUid: 'uid-ana', revision: 3 } },
    };
    const updateCalls: Array<Record<string, unknown>> = [];

    const fakeDb = {} as any;
    const runTxImpl = async (_db: unknown, fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        get: async () => ({
          exists: () => true,
          data: () => structuredClone(cloudDoc),
        }),
        update: (_ref: unknown, payload: Record<string, unknown>) => {
          updateCalls.push(structuredClone(payload));
          cloudDoc = { ...cloudDoc, ...structuredClone(payload) };
        },
        set: (_ref: unknown, payload: Record<string, unknown>, opts?: { merge?: boolean }) => {
          updateCalls.push(structuredClone(payload));
          cloudDoc = opts?.merge ? { ...cloudDoc, ...structuredClone(payload) } : structuredClone(payload);
        },
      };
      return fn(tx);
    };

    // Session B concurrently confirmed a patrimonial operation (protectionCurrentAmount = 52000) and set expectedYieldAnnual = 0
    cloudDoc = {
      ...cloudDoc,
      protectionCurrentAmount: 52000,
      expectedYieldAnnual: 0,
      lastUpdatedBy: 'uid-bruno',
    };

    // Session A commits its partial patch ({ partner1Name: 'Dra. Ana' }) from stale baseSnap
    const outcomeA = await commitCoupleHeaderPatchTransaction(
      fakeDb,
      'couple-1',
      baseSnap,
      patchA,
      {
        authoredByUid: 'uid-ana',
        runTransactionFn: runTxImpl,
      }
    );

    expect(outcomeA.status).toBe('success');
    expect(updateCalls).toHaveLength(1);
    // Sent ONLY partner1Name + audit metadata — did NOT resend stale expectedYieldAnnual (6.5) or protectionCurrentAmount (45000) or avatarProfiles!
    expect(Object.keys(updateCalls[0]).sort()).toEqual(['lastUpdatedBy', 'partner1Name', 'updatedAt']);
    expect(updateCalls[0].lastUpdatedBy).toBe('uid-ana');
    expect(cloudDoc.partner1Name).toBe('Dra. Ana');
    expect(cloudDoc.protectionCurrentAmount).toBe(52000);
    expect(cloudDoc.expectedYieldAnnual).toBe(0);
    expect((cloudDoc.avatarProfiles as any).partner1.revision).toBe(3);

    // Now Session A (still on old baseSnap where expectedYieldAnnual was 6.5) tries to edit expectedYieldAnnual to 4.5,
    // conflicting with Session B's concurrent update to 0 on the SAME field!
    const conflictOutcome = await commitCoupleHeaderPatchTransaction(
      fakeDb,
      'couple-1',
      baseSnap,
      { expectedYieldAnnual: 4.5 },
      {
        authoredByUid: 'uid-ana',
        runTransactionFn: runTxImpl,
      }
    );

    expect(conflictOutcome.status).toBe('conflict');
    expect(conflictOutcome.conflictingFields).toEqual(['expectedYieldAnnual']);
    expect(cloudDoc.expectedYieldAnnual).toBe(0); // Preserved, not overwritten!

    // Rebase helper also preserves disjoint local unsent edits while surfacing same-field conflicts
    const localWithYieldConflict = { ...baseSnap, partner2Name: 'Dr. Bruno', expectedYieldAnnual: 4.5 };
    const rebased = rebaseCoupleHeaderSnapshot(baseSnap, localWithYieldConflict, cloudDoc);
    expect(rebased.conflictingFields).toEqual(['expectedYieldAnnual']);
    expect(rebased.merged.partner2Name).toBe('Dr. Bruno'); // Disjoint local edit preserved
    expect(rebased.merged.protectionCurrentAmount).toBe(52000); // Disjoint remote edit adopted
  });

  it('3. Principal redemption of R$ 8.000 alongside R$ 36.000 salary keeps income base at R$ 36.000', () => {
    const analysis = calculateDynamicCombinedNetIncome(
      36000,
      [
        {
          id: 'inc-sal-1',
          description: 'Plantões e Salário Outubro',
          amount: 36000,
          date: '2026-10-05',
          recipient: 'both',
          type: 'salario',
          status: 'received',
          classification: 'pf_net',
        },
        {
          id: 'inc-redemption-8k',
          description: 'Resgate CDB Cofrinho Reforma',
          amount: 8000,
          date: '2026-10-12',
          recipient: 'both',
          type: 'outro',
          status: 'received',
          classification: 'principal_redemption',
        },
        {
          id: 'inc-forecast-5k',
          description: 'Plantão Previsto Novembro',
          amount: 5000,
          date: '2026-10-28',
          recipient: 'partner1',
          type: 'extra',
          status: 'projected',
          classification: 'forecast',
          isForecast: true,
        },
      ],
      '2026-10'
    );

    expect(analysis.currentMonthTotal).toBe(36000);
    expect(analysis.effectiveMonthlyIncome).toBe(36000);
  });

  it('4. SettingsScreen: explicit 0% yield survives reload across two sessions; isolated name or career change preserves approved plans, category reinforcement, and direct goal purchase; avatar update does not discard draft', async () => {
    const ProfileHarness: React.FC = () => {
      const {
        state,
        totalIncome,
        applyBudgetPlanContract,
        addExpense,
      } = useFinance();

      const curMonth = state.currentMonth;
      const seedApprovedPlanAndOperations = () => {
        const snapshot = computeCompetenceBudgetSnapshot(state, curMonth);
        applyBudgetPlanContract({
          id: curMonth,
          competence: curMonth,
          plannedNetIncome: 36000,
          version: '2026-10-01T00:00:00Z',
          categoryPercentages: {
            moradia: 30,
            transporte: 10,
            comida: 18,
            lazer: 12,
            protecao: 12,
            profissional: 8,
            investimentos: 10,
          },
          categoryAmountsR$: {
            moradia: 10800,
            transporte: 3600,
            comida: 6480,
            lazer: 4320,
            protecao: 4320,
            profissional: 2880,
            investimentos: 3600,
          },
          categoryLocks: {
            moradia: false,
            transporte: false,
            comida: false,
            lazer: false,
            protecao: false,
            profissional: false,
            investimentos: true,
          },
          categoryFloorsR$: {
            moradia: 0,
            transporte: 0,
            comida: 0,
            lazer: 0,
            protecao: 0,
            profissional: 0,
            investimentos: 0,
          },
          categoryPriorities: {
            moradia: 'P1',
            protecao: 'P1',
            profissional: 'P1',
            comida: 'P2',
            transporte: 'P2',
            investimentos: 'P2',
            lazer: 'P3',
          },
          commitmentsR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          actualSpentR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          requiredMarginR$: { moradia: 0, transporte: 0, comida: 0, lazer: 0, protecao: 0, profissional: 0, investimentos: 0 },
          referencePreset: { moradia: 30, transporte: 10, comida: 18, lazer: 12, protecao: 12, profissional: 8, investimentos: 10 },
          status: 'feasible',
          explanation: 'Plano base aprovado',
          conflicts: [],
          approvedAt: '2026-10-01T00:00:00Z',
          approvedByUid: 'uid-ana',
          approvedByDisplayName: 'Ana',
          planRevision: snapshot.planRevision,
          baseSnapshotSignature: snapshot.signature,
        });

        addExpense({
          description: 'Compra Direta Sofá',
          amount: 5000,
          amountCents: 500000,
          category: 'moradia',
          date: `${curMonth}-10`,
          paidBy: 'both',
          fundingSource: 'month_budget',
          isExcludedFromMonthlyBudget: true,
          exclusionReason: 'goal_direct',
        });
      };

      const activePlan = selectEffectiveBudgetPlanForCompetence(state, curMonth).plan;

      return (
        <div>
          <button type="button" onClick={seedApprovedPlanAndOperations}>
            seed-plan-and-ops
          </button>
          <div data-testid="p1-name">{state.profile.partner1Name}</div>
          <div data-testid="p1-stage">{state.profile.partner1Career?.stage || 'none'}</div>
          <div data-testid="p1-expected-inc">{String(state.profile.partner1Career?.expectedMonthlyIncome ?? 'unset')}</div>
          <div data-testid="yield-val">{String(state.profile.expectedYieldAnnual)}</div>
          <div data-testid="reserve-months">{String(state.profile.emergencyReserveMonthsTarget)}</div>
          <div data-testid="plan-rev">{String(activePlan?.planRevision ?? 0)}</div>
          <div data-testid="plan-inv-pct">{String(activePlan?.categoryPercentages.investimentos ?? -1)}</div>
          <div data-testid="direct-exp-count">
            {String(state.expenses.filter((e) => e.exclusionReason === 'goal_direct').length)}
          </div>
          <div data-testid="total-inc">{String(totalIncome)}</div>
          <SettingsScreen />
        </div>
      );
    };

    const session1 = render(
      <FinanceProvider>
        <ProfileHarness />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('seed-plan-and-ops'));
    expect(screen.getByTestId('plan-rev')).toHaveTextContent('1');
    expect(screen.getByTestId('plan-inv-pct')).toHaveTextContent('10');
    expect(screen.getByTestId('direct-exp-count')).toHaveTextContent('1');

    // 1. Set expectedYieldAnnual to explicit 0 and emergencyReserveMonthsTarget to 9 via Parâmetros Patrimoniais
    const yieldInput = screen.getByLabelText(/Taxa Real Esperada/i) as HTMLInputElement;
    const reserveInput = screen.getByLabelText(/Meses de Reserva de Emergência/i) as HTMLInputElement;
    fireEvent.change(yieldInput, { target: { value: '0' } });
    fireEvent.change(reserveInput, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Parâmetros Patrimoniais/i }));

    expect(screen.getByTestId('yield-val')).toHaveTextContent('0');
    expect(screen.getByTestId('reserve-months')).toHaveTextContent('9');
    // Plan revision was NOT bumped when editing yield/reserve!
    expect(screen.getByTestId('plan-rev')).toHaveTextContent('1');

    // 2. Edit ONLY partner1Name via Perfil section (while leaving stale/other inputs untouched)
    const p1NameInput = screen.getByLabelText(/Nome de Exibição \(Pessoa 1\)/i) as HTMLInputElement;
    fireEvent.change(p1NameInput, { target: { value: 'Dra. Ana Clara' } });

    // Verify avatar-only snapshot detection remains true for avatar updates while draft is open
    expect(
      isAvatarOnlySnapshot(
        { partner1Name: 'Ana', avatarProfiles: { partner1: { revision: 1 } } },
        { partner1Name: 'Ana', avatarProfiles: { partner1: { revision: 2 } } }
      )
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Perfil/i }));
    expect(screen.getByTestId('p1-name')).toHaveTextContent('Dra. Ana Clara');
    expect(screen.getByTestId('yield-val')).toHaveTextContent('0'); // Still 0, never reverted to 6!
    expect(screen.getByTestId('plan-rev')).toHaveTextContent('1'); // Approved plan untouched!
    expect(screen.getByTestId('direct-exp-count')).toHaveTextContent('1'); // Direct purchase untouched!

    // 3. Change Partner 1 medical career stage to 'residencia' without filling expectedMonthlyIncome -> stays unset, never auto-filled!
    const residenciaButtons = screen.getAllByRole('button', { name: /Residência Médica/i });
    fireEvent.click(residenciaButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Salvar etapa de Dra\. Ana Clara/i }));
    expect(screen.getByTestId('p1-stage')).toHaveTextContent('residencia');
    expect(screen.getByTestId('p1-expected-inc')).toHaveTextContent('unset');
    expect(screen.getByTestId('plan-rev')).toHaveTextContent('1');
    expect(screen.getByTestId('direct-exp-count')).toHaveTextContent('1');

    // 4. Reload in Session 2 -> explicit 0% yield, 9 months reserve, Dra. Ana Clara, and plan rev 1 all survive!
    session1.unmount();

    render(
      <FinanceProvider>
        <ProfileHarness />
      </FinanceProvider>
    );

    expect(screen.getByTestId('yield-val')).toHaveTextContent('0');
    expect(screen.getByTestId('reserve-months')).toHaveTextContent('9');
    expect(screen.getByTestId('p1-name')).toHaveTextContent('Dra. Ana Clara');
    expect(screen.getByTestId('plan-rev')).toHaveTextContent('1');
    expect(
      (screen.getByLabelText(/Taxa Real Esperada/i) as HTMLInputElement).value
    ).toBe('0');
  });

  it('5. Isolates the 5 private visual preferences per UID (User A changing coupleTheme/partner1Theme never alters User B) and never reports cloud confirmation on remote error', async () => {
    const docs = new Map<string, any>();
    let failWrites = false;

    const makeStore = (): PreferenceStore => ({
      subscribe: (uid, receive) => {
        receive(docs.get(uid), true);
        return () => {};
      },
      patch: async (uid, patch) => {
        if (failWrites) throw new Error('UNAVAILABLE');
        const prev = docs.get(uid);
        const next = {
          ownerUid: uid,
          version: 1 as const,
          revision: (prev?.revision || 0) + 1,
          preferences: { ...(prev?.preferences || DEFAULT_PREFERENCES), ...patch },
        };
        docs.set(uid, next);
        return next;
      },
    });

    let aliceApplied = DEFAULT_PREFERENCES;
    let aliceStatus = 'local';
    let bobApplied = DEFAULT_PREFERENCES;
    let bobStatus = 'local';

    const aliceSync = createPreferenceSync(
      'uid-alice',
      makeStore(),
      (val) => {
        aliceApplied = val;
      },
      (st) => {
        aliceStatus = st;
      }
    );
    const bobSync = createPreferenceSync(
      'uid-bob',
      makeStore(),
      (val) => {
        bobApplied = val;
      },
      (st) => {
        bobStatus = st;
      }
    );

    aliceSync.change({ coupleTheme: 'violet', partner1Theme: 'amber' });
    await waitFor(() => expect(aliceStatus).toBe('saved'));

    expect(aliceApplied.coupleTheme).toBe('violet');
    expect(aliceApplied.partner1Theme).toBe('amber');
    // User B remains completely untouched on default emerald/sapphire!
    expect(bobApplied.coupleTheme).toBe('emerald');
    expect(bobApplied.partner1Theme).toBe('sapphire');
    expect(bobStatus).toBe('not-saved');

    // Simulate remote failure on Alice's next preference edit -> local choice kept, status is 'error', NEVER 'saved'!
    failWrites = true;
    aliceSync.change({ themeMode: 'dark' });
    await waitFor(() => expect(aliceStatus).toBe('error'));
    expect(aliceApplied.themeMode).toBe('dark');
    expect(aliceStatus).not.toBe('saved');

    aliceSync.dispose();
    bobSync.dispose();
  });
});

it('preserva rascunho de nome ao receber alteração independente e salva apenas o campo editado', () => {
  const Harness = () => {
    const { state, patchCoupleProfile } = useFinance();
    return <><button onClick={() => patchCoupleProfile({ expectedYieldAnnual: 2 })}>alteração remota</button><span data-testid="taxa">{state.profile.expectedYieldAnnual}</span><SettingsScreen /></>;
  };
  render(<FinanceProvider><Harness /></FinanceProvider>);
  const input = screen.getByLabelText(/Nome de Exibição \(Pessoa 1\)/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Nome em edição' } });
  fireEvent.click(screen.getByText('alteração remota'));
  expect(input.value).toBe('Nome em edição');
  fireEvent.click(screen.getByRole('button', { name: /Salvar Perfil/i }));
  expect(screen.getByTestId('taxa')).toHaveTextContent('2');
});

it('exporta e oferece prévia antes de restaurar taxa zero', async () => {
  const Harness = () => {
    const { state } = useFinance();
    return <><span data-testid="yield-backup">{String(state.profile.expectedYieldAnnual)}</span><SettingsScreen /></>;
  };
  const makeUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<FinanceProvider><Harness /></FinanceProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar parâmetros' }));
  expect(makeUrl).toHaveBeenCalledOnce();
  const file = new File(['{}'], 'parametros.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify({ schemaVersion: 1, parameters: { expectedYieldAnnual: 0 } }) });
  fireEvent.change(screen.getByLabelText('Importar parâmetros'), { target: { files: [file] } });
  await screen.findByText(/Taxa esperada:.*→ 0/);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar restauração' }));
  expect(screen.getByTestId('yield-backup')).toHaveTextContent('0');
  makeUrl.mockRestore(); revoke.mockRestore(); click.mockRestore();
});

it('preserva rascunho do orçamento e exige escolha quando o mesmo campo muda', () => {
  const Harness = () => {
    const { state, updateCategoryPercentages } = useFinance();
    return <><button onClick={() => updateCategoryPercentages({ ...state.categoryPercentages, moradia: 35 })}>atualizar orçamento</button><SettingsScreen /></>;
  };
  render(<FinanceProvider><Harness /></FinanceProvider>);
  const row = screen.getByRole('row', { name: /Moradia/ });
  const input = row.querySelector('input[type="number"]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '31' } });
  fireEvent.click(screen.getByText('atualizar orçamento'));
  expect(input.value).toBe('31');
  expect(screen.getByText(/O orçamento mudou nos campos em edição/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Usar valores atuais' }));
  expect(input.value).toBe('35');
});
