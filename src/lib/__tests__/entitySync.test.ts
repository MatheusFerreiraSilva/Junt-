import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
    runTransaction: vi.fn(async (_db, callback) => {
      const fakeTx = {
        get: vi.fn(async () => ({ exists: () => false, data: () => null })),
        set: vi.fn(),
      };
      return callback(fakeTx);
    }),
  };
});

import {
  doc as firestoreDoc,
  runTransaction as firestoreRunTransaction,
} from 'firebase/firestore';
import {
  entityChanges,
  rebaseEntities,
  conflictAwareBaseline,
  reconcileConcurrentEntity,
  ENTITY_FIELDS,
  saveEntities,
  commitFinancialCommandTransaction,
  type EntityState,
} from '../entitySync';
import {
  runFinancialCommand,
  reconcileWithdrawalWithStatementCommand,
} from '../../utils/financialCommands';
import type { AppState } from '../../types/finance';

describe('entity synchronization', () => {
  it('retains the old baseline when both partners edit the same record', () => {
    const base = [{ id: 'shared', amount: 10 }];
    const local = [{ id: 'shared', amount: 20 }];
    const remote = [{ id: 'shared', amount: 30 }];
    expect(conflictAwareBaseline(base, local, remote)).toEqual(base);
    expect(rebaseEntities(base, local, remote)).toEqual(local);
    // saveEntities sees remote30 != baseline10 and local20, so it rejects or reconciles.
    expect(entityChanges(conflictAwareBaseline(base, local, remote), local)[0].before).toEqual(base[0]);
  });

  it('adopts unchanged remote records while preserving a conflicting new ID baseline', () => {
    const local = [{ id: 'same-new-id', amount: 20 }];
    const remote = [{ id: 'same-new-id', amount: 30 }, { id: 'partner', amount: 5 }];
    expect(conflictAwareBaseline([], local, remote)).toEqual([{ id: 'partner', amount: 5 }]);
  });

  it('keeps both partners independent additions', () => {
    const base = [{ id: 'old', amount: 10 }];
    const local = [...base, { id: 'mine', amount: 20 }];
    const remote = [...base, { id: 'partner', amount: 30 }];
    expect(rebaseEntities(base, local, remote).map(e => e.id).sort()).toEqual(['mine', 'old', 'partner']);
  });

  it('preserves an explicit local deletion without deleting a remote addition', () => {
    expect(rebaseEntities([{ id: 'old' }], [], [{ id: 'old' }, { id: 'new' }])).toEqual([{ id: 'new' }]);
  });

  it('does not re-save an unchanged record or duplicate a provider import', () => {
    const records = [{ id: 'pluggy:account:transaction', amount: 12.34 }];
    expect(entityChanges(records, JSON.parse(JSON.stringify(records)))).toEqual([]);
  });

  it('records updates and deletion as distinct operations', () => {
    expect(entityChanges([{ id: 'a', amount: 5 }, { id: 'b', amount: 10 }], [{ id: 'a', amount: 8 }])).toEqual([
      { id: 'a', before: { id: 'a', amount: 5 }, after: { id: 'a', amount: 8 } },
      { id: 'b', before: { id: 'b', amount: 10 }, after: undefined },
    ]);
  });

  it('preserves relational order in ENTITY_FIELDS: parent entities precede children', () => {
    const installmentIdx = ENTITY_FIELDS.indexOf('installments');
    const expenseIdx = ENTITY_FIELDS.indexOf('expenses');
    const shiftIdx = ENTITY_FIELDS.indexOf('medicalShifts');
    const allocationIdx = ENTITY_FIELDS.indexOf('shiftIncomeAllocations');
    const piggyIdx = ENTITY_FIELDS.indexOf('piggyBanks');
    const goalIdx = ENTITY_FIELDS.indexOf('coupleGoals');

    expect(ENTITY_FIELDS).toContain('monthlyBudgetPlans');
    expect(installmentIdx).toBeLessThan(expenseIdx);
    expect(shiftIdx).toBeLessThan(allocationIdx);
    expect(piggyIdx).toBeLessThan(expenseIdx);
    expect(goalIdx).toBeLessThan(expenseIdx);
  });

  describe('concurrency protection on financial mutations', () => {
    it('reconciles concurrent contributions to the same piggy bank additively (R$ 100 + R$ 200 = R$ 300)', () => {
      const before = {
        id: 'piggy-reserve',
        name: 'Reserva de Emergência',
        targetAmount: 1000,
        currentAmount: 0,
        totalInvested: 0,
        completed: false,
      };

      // Partner 1 deposits R$ 100 concurrently
      const remote = {
        ...before,
        currentAmount: 100,
        totalInvested: 100,
        completed: false,
      };

      // Partner 2 deposits R$ 200 concurrently
      const after = {
        ...before,
        currentAmount: 200,
        totalInvested: 200,
        completed: false,
      };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.currentAmount).toBe(300);
      expect(reconciled?.totalInvested).toBe(300);
      expect(reconciled?.completed).toBe(false);
    });

    it('unifies concurrent history contributions without losing entries or duplicating IDs', () => {
      const before = {
        id: 'goal-viagem',
        currentAmount: 500,
        targetAmount: 2000,
        history: [{ id: 'h-1', amount: 500, contributor: 'partner1' }],
      };

      // Partner 1 adds deposit h-2
      const remote = {
        ...before,
        currentAmount: 800,
        history: [
          { id: 'h-2', amount: 300, contributor: 'partner1' },
          { id: 'h-1', amount: 500, contributor: 'partner1' },
        ],
      };

      // Partner 2 adds deposit h-3
      const after = {
        ...before,
        currentAmount: 1100,
        history: [
          { id: 'h-3', amount: 600, contributor: 'partner2' },
          { id: 'h-1', amount: 500, contributor: 'partner1' },
        ],
      };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.currentAmount).toBe(1400); // 500 + 300 (remote delta) + 600 (local delta)
      const histIds = (reconciled?.history as any[]).map(item => item.id);
      expect(histIds).toContain('h-1');
      expect(histIds).toContain('h-2');
      expect(histIds).toContain('h-3');
      expect(new Set(histIds).size).toBe(3);
    });

    it('automatically re-evaluates completed flag when reconciled amount reaches target', () => {
      const before = {
        id: 'meta-casamento',
        targetAmount: 1000,
        currentAmount: 700,
        completed: false,
      };
      // Remote adds 150 (current: 850)
      const remote = { ...before, currentAmount: 850 };
      // Local adds 200 (current: 900)
      const after = { ...before, currentAmount: 900 };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled?.currentAmount).toBe(1050);
      expect(reconciled?.completed).toBe(true);
    });

    it('rejects unresolvable semantic conflict when non-numeric fields differ', () => {
      const before = { id: 'item-1', name: 'Original', currentAmount: 100 };
      const remote = { id: 'item-1', name: 'Renomeado por Bob', currentAmount: 100 };
      const after = { id: 'item-1', name: 'Renomeado por Alice', currentAmount: 100 };

      const reconciled = reconcileConcurrentEntity(before, remote, after);
      expect(reconciled).toBeNull();
    });
  });

  describe('multi-chunk batching (>400 items)', () => {
    it('splits large entity payloads into chunks of <= 400 and notifies progress', async () => {
      const totalItems = 850;
      const fakeExpenses = Array.from({ length: totalItems }, (_, i) => ({
        id: `exp-${i}`,
        amount: 10 + i,
        description: `Item ${i}`,
        date: '2026-10-15',
      }));

      const baseline: EntityState = { expenses: [] };
      const current: EntityState = { expenses: fakeExpenses };

      const fakeDb = {} as any;
      const progressSnapshots: any[] = [];

      const result = await saveEntities(fakeDb, 'couple-123', baseline, current, {
        isActive: () => true,
        onChunkSaved: (p) => {
          progressSnapshots.push({ ...p });
        },
      });

      expect(result.completed).toBe(true);
      expect(result.savedCount).toBe(850);
      expect(result.totalCount).toBe(850);

      // Chunks: 400, 400, 50 -> total 3 chunks
      expect(progressSnapshots.length).toBe(3);
      expect(progressSnapshots[0].savedCount).toBe(400);
      expect(progressSnapshots[0].completed).toBe(false);
      expect(progressSnapshots[1].savedCount).toBe(800);
      expect(progressSnapshots[1].completed).toBe(false);
      expect(progressSnapshots[2].savedCount).toBe(850);
      expect(progressSnapshots[2].completed).toBe(true);
    });
  });

  describe('29A concurrency & transaction atomicity (R29-06, R29-07)', () => {
    it('R29-06: rejects two competing withdrawals of R$ 500 even when both hit final balance 0', async () => {
      const baseGoal = {
        id: 'goal-500',
        name: 'Viagem',
        currentAmount: 500,
        availableCents: 50000,
        accumulatedCents: 50000,
        revision: 1,
      };
      const sessionAResult = { ...baseGoal, currentAmount: 0, availableCents: 0, revision: 2 };
      const sessionBResult = { ...baseGoal, currentAmount: 0, availableCents: 0, revision: 2 };

      // reconcileConcurrentEntity must return null instead of approving a competing debit
      expect(reconcileConcurrentEntity(baseGoal, sessionAResult, sessionBResult)).toBeNull();

      // saveEntities runTransaction rejects competing session B when remote doc already spent R$ 500
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async () => ({
            exists: () => true,
            data: () => ({ field: 'piggyBanks', record: sessionAResult, deleted: false }),
          })),
          set: vi.fn(),
        };
        return callback(fakeTx as any);
      });

      await expect(
        saveEntities(
          {} as any,
          'couple-29a',
          { piggyBanks: [baseGoal] },
          { piggyBanks: [sessionBResult] },
          { isActive: () => true }
        )
      ).rejects.toThrow(/alterado pelo seu par/i);
    });

    it('R29-06 & R29-07: commitFinancialCommandTransaction blocks stale competing withdrawal, leaves preState untouched on tx error, and replays idempotently after lost ACK', async () => {
      const baseState: AppState = {
        profile: {
          partner1Name: 'Ana',
          partner2Name: 'Bruno',
          city: 'SP',
          partner1Income: 10000,
          partner2Income: 10000,
          emergencyReserveMonthsTarget: 6,
          expectedYieldAnnual: 6.5,
          streakMonths: 1,
          themeMode: 'light',
          accentTheme: 'emerald',
        },
        categoryPercentages: {
          moradia: 30,
          transporte: 10,
          comida: 25,
          lazer: 15,
          protecao: 10,
          profissional: 10,
        },
        currentMonth: '2026-11',
        expenses: [],
        incomes: [],
        installments: [],
        piggyBanks: [
          {
            id: 'goal-tx',
            name: 'Notebook',
            emoji: '💻',
            purpose: 'Trabalho',
            currentAmount: 500,
            targetAmount: 1000,
            monthlyDeposit: 100,
            availableCents: 50000,
            accumulatedCents: 50000,
            revision: 1,
          },
        ],
        coupleGoals: [
          {
            id: 'goal-tx',
            title: 'Notebook',
            category: 'outro',
            emoji: '💻',
            targetAmount: 1000,
            currentAmount: 500,
            availableCents: 50000,
            accumulatedCents: 50000,
            partner1Contribution: 250,
            partner2Contribution: 250,
            monthlyPlannedDeposit: 100,
            isCompleted: false,
            history: [],
            createdAt: '2026-10-01',
            revision: 1,
          },
        ],
        linkedAccounts: [],
        alertRules: [],
        notifications: [],
        protectionCurrentAmount: 10000,
        protectionTotalInvested: 10000,
        protectionYieldAccumulated: 0,
        isProtectionComplete: true,
        freedomTotalInvested: 0,
        freedomYieldAccumulated: 0,
        financialOperations: [],
      };

      const cmdRes = runFinancialCommand(baseState, {
        id: 'op-tx-withdraw-500',
        type: 'GOAL_WITHDRAWAL',
        amountCents: 50000,
        authorizedBy: 'uid-ana',
        authoredByUid: 'uid-ana',
        scope: 'couple',
        sourceRef: { type: 'piggy_bank', id: 'goal-tx' },
        targetRef: { type: 'external', id: 'manual-resgate' },
        competence: '2026-11',
        date: '2026-11-12',
        state: 'occurred_manual',
      });
      expect(cmdRes.status).toBe('success');

      // Case A: Remote goal already spent by Session 1 -> Session 2 must fail with conflict/insufficient balance
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async (ref: { path: string }) => {
            if (ref.path.includes('financialOperations')) {
              return { exists: () => false, data: () => null };
            }
            return {
              exists: () => true,
              data: () => ({
                deleted: false,
                record: {
                  ...baseState.piggyBanks[0],
                  currentAmount: 0,
                  availableCents: 0,
                  revision: 2,
                },
              }),
            };
          }),
          set: vi.fn(),
        };
        return callback(fakeTx as any);
      });

      const competingOutcome = await commitFinancialCommandTransaction(
        {} as any,
        'couple-29a',
        cmdRes,
        baseState
      );
      expect(competingOutcome.status).toBe('conflict');
      expect(competingOutcome.writtenEntities).toEqual([]);
      expect(competingOutcome.committedState).toBe(baseState);

      // Case B: Mid-flight failure -> rolls back cleanly with zero writtenEntities
      vi.mocked(firestoreRunTransaction).mockRejectedValueOnce(new Error('network unavailable mid-commit'));
      const failedOutcome = await commitFinancialCommandTransaction(
        {} as any,
        'couple-29a',
        cmdRes,
        baseState
      );
      expect(failedOutcome.status).toBe('failure');
      expect(failedOutcome.writtenEntities).toEqual([]);
      expect(failedOutcome.committedState).toBe(baseState);

      // Case C: Lost ACK retry -> op already exists remotely with same fingerprint -> idempotent replay without double debit
      const setSpy = vi.fn();
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async (ref: { path: string }) => {
            if (ref.path.includes('financialOperations') && ref.path.includes('op-tx-withdraw-500')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: cmdRes.operation,
                }),
              };
            }
            return { exists: () => true, data: () => ({ deleted: false, record: cmdRes.state.piggyBanks[0] }) };
          }),
          set: setSpy,
        };
        return callback(fakeTx as any);
      });

      const replayOutcome = await commitFinancialCommandTransaction(
        {} as any,
        'couple-29a',
        cmdRes,
        baseState
      );
      expect(replayOutcome.status).toBe('success');
      expect(replayOutcome.idempotentReplay).toBe(true);
      expect(setSpy).not.toHaveBeenCalled();
      expect(firestoreDoc).toHaveBeenCalled();
    });
  });

  describe('09 patrimonial & monthly guide transaction concurrency', () => {
    it('blocks concurrent monthly guide execution and item execution when remote session already confirmed', async () => {
      const baseState: AppState = {
        profile: {
          partner1Name: 'Ana',
          partner2Name: 'Bruno',
          city: 'SP',
          partner1Income: 10000,
          partner2Income: 10000,
          emergencyReserveMonthsTarget: 6,
          expectedYieldAnnual: 6.5,
          streakMonths: 1,
          themeMode: 'light',
          accentTheme: 'emerald',
        },
        categoryPercentages: {
          moradia: 30,
          transporte: 10,
          comida: 25,
          lazer: 15,
          protecao: 10,
          profissional: 10,
        },
        currentMonth: '2026-11',
        expenses: [],
        incomes: [],
        installments: [],
        piggyBanks: [],
        coupleGoals: [],
        linkedAccounts: [],
        alertRules: [],
        notifications: [],
        protectionCurrentAmount: 10000,
        protectionTotalInvested: 10000,
        protectionYieldAccumulated: 0,
        isProtectionComplete: false,
        freedomTotalInvested: 0,
        freedomYieldAccumulated: 0,
        financialOperations: [],
        monthlyDepositGuides: {
          '2026-11': {
            monthKey: '2026-11',
            totalPlanned: 1000,
            status: 'approved',
            approvedAt: '2026-11-01T10:00:00.000Z',
            items: [
              {
                id: 'item-prot-1',
                block: 'protection',
                title: 'Reserva de Proteção',
                instruction: 'Aporte mensal na reserva',
                destinationLabel: 'Reserva de Proteção',
                baseAmount: 1000,
                surplusAmount: 0,
                totalAmount: 1000,
              },
            ],
          },
        },
        completedMonthDeposits: {},
      };

      const cmdRes = runFinancialCommand(baseState, {
        id: 'op-guide-full-2026-11',
        type: 'GOAL_DEPOSIT',
        amountCents: 100000,
        authorizedBy: 'uid-ana',
        authoredByUid: 'uid-ana',
        scope: 'couple',
        sourceRef: { type: 'external', id: 'monthly-guide' },
        targetRef: { type: 'protection', id: 'protection_reserve' },
        competence: '2026-11',
        date: '2026-11-12',
        state: 'occurred_manual',
      });

      const cmdWithGuide: typeof cmdRes = {
        ...cmdRes,
        state: {
          ...cmdRes.state,
          completedMonthDeposits: {
            '2026-11': {
              monthKey: '2026-11',
              completedAt: '2026-11-12T10:00:00.000Z',
              totalDeposited: 1000,
              operationId: 'op-guide-full-2026-11',
              items: [
                {
                  id: 'item-prot-1',
                  block: 'protection',
                  title: 'Reserva de Proteção',
                  instruction: 'Aporte mensal na reserva',
                  destinationLabel: 'Reserva de Proteção',
                  baseAmount: 1000,
                  surplusAmount: 0,
                  totalAmount: 1000,
                  executedAt: '2026-11-12T10:00:00.000Z',
                  executedOperationId: 'op-guide-full-2026-11',
                  executedAmount: 1000,
                },
              ],
            },
          },
        },
        touchedEntities: {
          ...(cmdRes.touchedEntities || {}),
          protectionUpdated: true,
          guideUpdated: true,
          guideMonthKey: '2026-11',
        },
      };

      // Simulate remote session already committed a different operationId for 2026-11 guide
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async (ref: { path: string }) => {
            if (ref.path.includes('couples/couple-09')) {
              return {
                exists: () => true,
                data: () => ({
                  protectionCurrentAmount: 11000,
                  completedMonthDeposits: {
                    '2026-11': {
                      monthKey: '2026-11',
                      completedAt: '2026-11-12T09:59:00.000Z',
                      totalDeposited: 1000,
                      operationId: 'op-guide-other-session',
                      items: [],
                    },
                  },
                }),
              };
            }
            return { exists: () => false, data: () => null };
          }),
          set: vi.fn(),
        };
        return callback(fakeTx as any);
      });

      const conflictOutcome = await commitFinancialCommandTransaction(
        {} as any,
        'couple-09',
        cmdWithGuide,
        baseState
      );
      expect(conflictOutcome.status).toBe('conflict');
      expect(conflictOutcome.writtenEntities).toEqual([]);
      expect(conflictOutcome.committedState).toBe(baseState);
    });

    it('persists negative VALUATION_ADJUSTMENT yield (-50) on couple freedom block atomically', async () => {
      const baseState: AppState = {
        profile: {
          partner1Name: 'Ana',
          partner2Name: 'Bruno',
          city: 'SP',
          partner1Income: 10000,
          partner2Income: 10000,
          emergencyReserveMonthsTarget: 6,
          expectedYieldAnnual: 6.5,
          streakMonths: 1,
          themeMode: 'light',
          accentTheme: 'emerald',
        },
        categoryPercentages: {
          moradia: 30,
          transporte: 10,
          comida: 25,
          lazer: 15,
          protecao: 10,
          profissional: 10,
        },
        currentMonth: '2026-11',
        expenses: [],
        incomes: [],
        installments: [],
        piggyBanks: [],
        coupleGoals: [],
        linkedAccounts: [],
        alertRules: [],
        notifications: [],
        protectionCurrentAmount: 10000,
        protectionTotalInvested: 10000,
        protectionYieldAccumulated: 0,
        isProtectionComplete: true,
        freedomTotalInvested: 1000,
        freedomYieldAccumulated: 100,
        financialOperations: [],
      };

      const cmdRes = runFinancialCommand(baseState, {
        id: 'op-val-neg-50',
        type: 'VALUATION_ADJUSTMENT',
        amountCents: 5000,
        amountR$: 50,
        signedDeltaCents: -5000,
        valuationDirection: 'loss',
        authorizedBy: 'uid-ana',
        authoredByUid: 'uid-ana',
        scope: 'couple',
        sourceRef: { type: 'external', id: 'market-valuation', name: 'Marcação' },
        targetRef: { type: 'freedom', id: 'freedom_block' },
        competence: '2026-11',
        date: '2026-11-12',
        state: 'occurred_manual',
      });

      expect(cmdRes.status).toBe('success');
      expect(cmdRes.state.freedomYieldAccumulated).toBe(50);

      const txSet = vi.fn();
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async (ref: { path: string }) => {
            if (ref.path.includes('couples/couple-09')) {
              return {
                exists: () => true,
                data: () => ({
                  freedomTotalInvested: 1000,
                  freedomYieldAccumulated: 100,
                }),
              };
            }
            return { exists: () => false, data: () => null };
          }),
          set: txSet,
        };
        return callback(fakeTx as any);
      });

      const outcome = await commitFinancialCommandTransaction(
        {} as any,
        'couple-09',
        cmdRes,
        baseState
      );
      expect(outcome.status).toBe('success');
      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'couples/couple-09' }),
        expect.objectContaining({
          freedomTotalInvested: 1000,
          freedomYieldAccumulated: 50,
        }),
        { merge: true }
      );
    });
  });

  describe('26B withdrawal settlement & reconciliation transaction guards', () => {
    it('commits in-place settlement and blocks double reconciliation when bankImportedTransaction was already reconciled remotely', async () => {
      const baseState: AppState = {
        profile: {
          partner1Name: 'Ana',
          partner2Name: 'Bruno',
          city: 'SP',
          partner1Income: 10000,
          partner2Income: 10000,
          emergencyReserveMonthsTarget: 6,
          expectedYieldAnnual: 6.5,
          streakMonths: 1,
          themeMode: 'light',
          accentTheme: 'emerald',
        },
        categoryPercentages: {
          moradia: 30,
          transporte: 10,
          comida: 25,
          lazer: 15,
          protecao: 10,
          profissional: 10,
        },
        currentMonth: '2026-11',
        expenses: [],
        incomes: [],
        installments: [],
        piggyBanks: [
          {
            id: 'goal-26b',
            name: 'Reserva',
            emoji: '🏦',
            purpose: 'Reserva',
            currentAmount: 1000,
            targetAmount: 5000,
            monthlyDeposit: 500,
            availableCents: 100000,
            committedCents: 50000,
            revision: 2,
          },
        ],
        coupleGoals: [
          {
            id: 'goal-26b',
            title: 'Reserva',
            category: 'reserva',
            emoji: '🏦',
            targetAmount: 5000,
            currentAmount: 1000,
            availableCents: 100000,
            committedCents: 50000,
            partner1Contribution: 500,
            partner2Contribution: 500,
            monthlyPlannedDeposit: 500,
            isCompleted: false,
            history: [],
            createdAt: '2026-10-01',
            revision: 2,
          },
        ],
        linkedAccounts: [
          {
            id: 'acc-26b',
            canonicalAccountId: 'canon-26b',
            bankName: 'Itaú',
            accountType: 'corrente',
            accountNumber: '123',
            holder: 'both',
            balance: 1000,
            lastSynced: '2026-11-10',
            status: 'connected',
            colorHex: '#ec7000',
            logo: 'I',
            verificationStatus: 'verified',
          },
        ],
        bankImportedTransactions: [
          {
            id: 'tx-26b-cred',
            itemId: 'item-26b',
            accountId: 'acc-26b',
            bankName: 'Itaú',
            owner: 'both',
            date: '2026-11-15',
            description: 'RESGATE CDB',
            amount: 500,
            direction: 'credit',
            status: 'pending',
          },
        ],
        alertRules: [],
        notifications: [],
        protectionCurrentAmount: 10000,
        protectionTotalInvested: 10000,
        protectionYieldAccumulated: 0,
        isProtectionComplete: true,
        freedomTotalInvested: 0,
        freedomYieldAccumulated: 0,
        financialOperations: [
          {
            id: 'op-pend-26b',
            type: 'GOAL_WITHDRAWAL',
            amountCents: 50000,
            grossAmountCents: 50000,
            netAmountCents: 50000,
            authorizedBy: 'uid-ana',
            authoredByUid: 'uid-ana',
            scope: 'couple',
            sourceRef: { type: 'piggy_bank', id: 'goal-26b' },
            targetRef: { type: 'account', id: 'canon-26b' },
            destinationAccountId: 'canon-26b',
            withdrawalChannel: 'asset_redemption',
            settlementStatus: 'pending_settlement',
            competence: '2026-11',
            date: '2026-11-14',
            state: 'pending_settlement',
            revision: 1,
          },
        ],
      };

      const cmdRes = reconcileWithdrawalWithStatementCommand(baseState, {
        bankTransactionId: 'tx-26b-cred',
        operationId: 'op-pend-26b',
        reconciledByUid: 'uid-ana',
      });
      expect(cmdRes.status).toBe('success');

      // Remote already reconciled tx-26b-cred with another operation -> must conflict cleanly
      vi.mocked(firestoreRunTransaction).mockImplementationOnce(async (_db, callback) => {
        const fakeTx = {
          get: vi.fn(async (ref: { path: string }) => {
            if (ref.path.includes('piggyBanks')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: baseState.piggyBanks[0],
                }),
              };
            }
            if (ref.path.includes('coupleGoals')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: baseState.coupleGoals[0],
                }),
              };
            }
            if (ref.path.includes('linkedAccounts')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: baseState.linkedAccounts![0],
                }),
              };
            }
            if (ref.path.includes('bankImportedTransactions')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: {
                    ...baseState.bankImportedTransactions![0],
                    status: 'reconciled',
                    reconciledOperationId: 'op-other-partner',
                  },
                }),
              };
            }
            if (ref.path.includes('financialOperations')) {
              return {
                exists: () => true,
                data: () => ({
                  deleted: false,
                  record: baseState.financialOperations![0],
                }),
              };
            }
            return { exists: () => false, data: () => null };
          }),
          set: vi.fn(),
        };
        return callback(fakeTx as any);
      });

      const conflictRes = await commitFinancialCommandTransaction(
        {} as any,
        'couple-26b',
        {
          ...cmdRes,
          touchedEntities: {
            ...cmdRes.touchedEntities,
            bankImportedTransactions: ['tx-26b-cred'],
          },
        },
        baseState
      );
      expect(conflictRes.status).toBe('conflict');
      expect(conflictRes.writtenEntities).toEqual([]);
    });
  });
});

