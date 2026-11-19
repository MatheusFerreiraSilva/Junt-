import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { AppState } from '../../types/finance';
import { selectVerifiableCashSummary, selectLiquidOperationalCash } from '../domainSelectors';
import {
  previewGoalWithdrawal,
  executeWithdrawalCommand,
  reconcileWithdrawalWithStatementCommand,
  confirmInternalTransferPairCommand,
  reverseFinancialCommand,
  runFinancialCommand,
} from '../financialCommands';
import { detectInternalTransferPairs, findReconciliationCandidates } from '../statementImport';
import { FinanceProvider, useFinance } from '../../context/FinanceContext';
import { AvatarProvider } from '../../avatars/AvatarProvider';
import { DepositPiggyModal } from '../../components/modals/DepositPiggyModal';
import { BankSyncModal } from '../../components/BankSyncModal';
import { HomeScreen } from '../../screens/HomeScreen';

function makeBaseState(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: {
      partner1Name: 'Ana',
      partner2Name: 'Bruno',
      city: 'São Paulo',
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
        id: 'goal-cdb',
        name: 'Reserva CDB',
        emoji: '🏦',
        purpose: 'Reserva',
        currentAmount: 10000,
        targetAmount: 20000,
        monthlyDeposit: 1000,
        availableCents: 1000000,
        accumulatedCents: 1000000,
        revision: 1,
      },
    ],
    coupleGoals: [
      {
        id: 'goal-cdb',
        title: 'Reserva CDB',
        category: 'reserva',
        emoji: '🏦',
        targetAmount: 20000,
        currentAmount: 10000,
        availableCents: 1000000,
        accumulatedCents: 1000000,
        partner1Contribution: 5000,
        partner2Contribution: 5000,
        monthlyPlannedDeposit: 1000,
        isCompleted: false,
        history: [],
        createdAt: '2026-10-01',
        revision: 1,
      },
    ],
    linkedAccounts: [],
    pluggyAccounts: [],
    cashBalanceAnchors: [],
    bankImportedTransactions: [],
    alertRules: [],
    notifications: [],
    protectionCurrentAmount: 20000,
    protectionTotalInvested: 20000,
    protectionYieldAccumulated: 0,
    isProtectionComplete: true,
    freedomTotalInvested: 0,
    freedomYieldAccumulated: 0,
    financialOperations: [],
    ...overrides,
  };
}

describe('Stage 26B — Verifiable Cash, Redemptions & Reconciliation', () => {
  it('distinguishes explicit zero cash (known) from unknown and partial accounts', () => {
    const unknownState = makeBaseState({
      linkedAccounts: [],
      pluggyAccounts: [],
    });
    const sUnknown = selectVerifiableCashSummary(unknownState, 'casal', '2026-11-15');
    expect(sUnknown.status).toBe('unknown');
    expect(sUnknown.isReliableGlobalCash).toBe(false);
    expect(sUnknown.verifiedLiquidCashCents).toBeNull();
    expect(sUnknown.verifiedLiquidCashR$).toBeNull();

    const zeroKnownState = makeBaseState({
      linkedAccounts: [
        {
          id: 'acc-nubank',
          canonicalAccountId: 'canon-nubank',
          bankName: 'Nubank',
          accountType: 'corrente',
          accountNumber: '1234-5',
          holder: 'both',
          balance: 0,
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#820ad1',
          logo: 'N',
          verificationStatus: 'verified',
        },
      ],
      cashBalanceAnchors: [
        {
          id: 'anchor-nubank',
          accountId: 'acc-nubank',
          canonicalAccountId: 'canon-nubank',
          date: '2026-11-15',
          balanceCents: 0,
          balanceStatus: 'known',
          scope: 'casal',
          origin: 'manual_confirmed',
          coverageType: 'cutoff_inclusive',
          includedUntilDate: '2026-11-15',
          confirmedAt: '2026-11-15T10:00:00Z',
          confirmedByUid: 'uid-1',
        },
      ],
    });
    const sZero = selectVerifiableCashSummary(zeroKnownState, 'casal', '2026-11-15');
    expect(sZero.status).toBe('known');
    expect(sZero.isReliableGlobalCash).toBe(true);
    expect(sZero.verifiedLiquidCashCents).toBe(0);
    expect(sZero.verifiedLiquidCashR$).toBe(0);

    const partialState = makeBaseState({
      linkedAccounts: [
        ...zeroKnownState.linkedAccounts,
        {
          id: 'acc-itau',
          canonicalAccountId: 'canon-itau',
          bankName: 'Itaú',
          accountType: 'corrente',
          accountNumber: '9999-1',
          holder: 'partner1',
          balance: 2500,
          lastSynced: '2026-11-10',
          status: 'error',
          colorHex: '#ec7000',
          logo: 'I',
          verificationStatus: 'unverified',
        },
      ],
      cashBalanceAnchors: zeroKnownState.cashBalanceAnchors,
    });
    const sPartial = selectVerifiableCashSummary(partialState, 'casal', '2026-11-15');
    expect(sPartial.status).toBe('partial');
    expect(sPartial.isReliableGlobalCash).toBe(false);
    expect(sPartial.verifiedLiquidCashCents).toBeNull();
    expect(sPartial.knownAccountsCashCents).toBe(0);
  });

  it('excludes cartao, investimento, locked lockupUntil assets, and goal-linked accounts from free cash', () => {
    const state = makeBaseState({
      piggyBanks: [
        {
          id: 'goal-linked',
          name: 'CDB Vinculado',
          emoji: '🏦',
          purpose: 'Meta',
          currentAmount: 5000,
          targetAmount: 10000,
          monthlyDeposit: 500,
          linkedBankAccountId: 'acc-cdb-linked',
        },
      ],
      linkedAccounts: [
        {
          id: 'acc-checking',
          canonicalAccountId: 'canon-checking',
          bankName: 'Banco Inter',
          accountType: 'corrente',
          accountNumber: '111-1',
          holder: 'both',
          balance: 1500,
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#ff7a00',
          logo: 'B',
          verificationStatus: 'verified',
        },
        {
          id: 'acc-card',
          bankName: 'Nubank Ultravioleta',
          accountType: 'cartao',
          accountNumber: '4444',
          holder: 'both',
          balance: 9000,
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#820ad1',
          logo: 'N',
        },
        {
          id: 'acc-locked',
          bankName: 'BTG CDB',
          accountType: 'poupanca',
          accountNumber: '5555',
          holder: 'both',
          balance: 12000,
          lockupUntil: '2027-01-15',
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#111',
          logo: 'B',
        },
        {
          id: 'acc-cdb-linked',
          bankName: 'XP CDB Meta',
          accountType: 'poupanca',
          accountNumber: '6666',
          holder: 'both',
          balance: 5000,
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#000',
          logo: 'X',
        },
      ],
    });

    const summary = selectVerifiableCashSummary(state, 'casal', '2026-11-15');
    expect(summary.status).toBe('known');
    expect(summary.verifiedLiquidCashCents).toBe(150000);
    expect(summary.lockedAssetCents).toBe(1200000);
    expect(selectLiquidOperationalCash(state, 'casal')).toBe(1500);
  });

  it('deduplicates canonical accounts, flags unlinked duplicates, and honors CashBalanceAnchor without double-applying included ops', () => {
    const dupState = makeBaseState({
      linkedAccounts: [
        {
          id: 'linked-1',
          bankName: 'Nubank',
          accountType: 'corrente',
          accountNumber: '0001-2',
          holder: 'partner1',
          balance: 3000,
          lastSynced: '2026-11-15',
          status: 'connected',
          colorHex: '#820ad1',
          logo: 'N',
        },
      ],
      pluggyAccounts: [
        {
          id: 'pluggy-1',
          itemId: 'item-1',
          accountId: '0001-2',
          name: 'Nubank Conta',
          bankName: 'Nubank',
          accountType: 'corrente',
          type: 'individual',
          owner: 'partner1',
          taxNumber: '123',
          balance: 3000,
          lastSynced: '2026-11-15',
          consentExpiresAt: '2027-11-15',
          status: 'connected',
          appOwner: 'partner1',
        },
      ],
    });

    const dupSummary = selectVerifiableCashSummary(dupState, 'casal', '2026-11-15');
    expect(dupSummary.duplicateAccountAlerts).toHaveLength(1);
    expect(dupSummary.status).toBe('unknown');

    // Once canonicalAccountId is linked + anchor absorbs op-1 until 2026-11-15, only post-anchor op-2 is added
    const anchoredState = makeBaseState({
      linkedAccounts: [{ ...dupState.linkedAccounts![0], canonicalAccountId: 'canon-nb' }],
      pluggyAccounts: [{ ...dupState.pluggyAccounts![0], canonicalAccountId: 'canon-nb' }],
      cashBalanceAnchors: [
        {
          id: 'anchor-nb',
          accountId: 'linked-1',
          canonicalAccountId: 'canon-nb',
          date: '2026-11-15',
          balanceCents: 300000,
          balanceStatus: 'known',
          scope: 'casal',
          origin: 'statement_closing',
          coverageType: 'cutoff_inclusive',
          includedUntilDate: '2026-11-15',
          includedOperationIds: ['op-before'],
          confirmedAt: '2026-11-15T18:00:00Z',
          confirmedByUid: 'uid-1',
        },
      ],
      financialOperations: [
        {
          id: 'op-before',
          type: 'GOAL_WITHDRAWAL',
          amountCents: 100000,
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-cdb' },
          targetRef: { type: 'account', id: 'canon-nb' },
          destinationAccountId: 'canon-nb',
          withdrawalChannel: 'asset_redemption',
          netAmountCents: 100000,
          competence: '2026-11',
          date: '2026-11-14',
          state: 'occurred_manual',
        },
        {
          id: 'op-after',
          type: 'GOAL_WITHDRAWAL',
          amountCents: 50000,
          authorizedBy: 'uid-1',
          scope: 'couple',
          sourceRef: { type: 'piggy_bank', id: 'goal-cdb' },
          targetRef: { type: 'account', id: 'canon-nb' },
          destinationAccountId: 'canon-nb',
          withdrawalChannel: 'asset_redemption',
          netAmountCents: 50000,
          competence: '2026-11',
          date: '2026-11-16',
          state: 'occurred_manual',
        },
      ],
    });

    const anchoredSummary = selectVerifiableCashSummary(anchoredState, 'casal', '2026-11-16');
    expect(anchoredSummary.duplicateAccountAlerts).toHaveLength(0);
    expect(anchoredSummary.status).toBe('known');
    expect(anchoredSummary.verifiedLiquidCashCents).toBe(350000);
  });

  it('handles pending_settlement non-disbursing lifecycle, gross 8000 / net 7800 spread without fake taxes, and exact partitions', () => {
    const base = makeBaseState({
      linkedAccounts: [
        {
          id: 'acc-checking',
          canonicalAccountId: 'canon-checking',
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
    });

    const badPartitions = previewGoalWithdrawal(base, {
      goalId: 'goal-cdb',
      grossAmountR$: 8000,
      netAmountR$: 7800,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'occurred_manual',
      destinationAccountId: 'canon-checking',
      partitions: [
        { id: 'p1', targetType: 'cash_free', amountCents: 500000 },
        { id: 'p2', targetType: 'other_goal', amountCents: 200000 },
      ],
    });
    expect(badPartitions.ok).toBe(false);
    expect(badPartitions.reasonCode).toBe('DIVERGENT_AMOUNTS');

    const goodPreview = previewGoalWithdrawal(base, {
      goalId: 'goal-cdb',
      grossAmountR$: 8000,
      netAmountR$: 7800,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'pending_settlement',
      destinationAccountId: 'canon-checking',
      partitions: [
        { id: 'p1', targetType: 'cash_free', amountCents: 500000 },
        { id: 'p2', targetType: 'other_goal', targetId: 'goal-cdb', amountCents: 280000 },
      ],
    });
    expect(goodPreview.ok).toBe(true);
    expect(goodPreview.differenceToReviewCents).toBe(20000);
    expect(goodPreview.incomeImpactCents).toBe(0);
    expect(goodPreview.freeCashNetCents).toBe(500000);
    expect(goodPreview.earmarkedNetCents).toBe(280000);

    // Stage 1: pending_settlement must not increase checking balance or create IncomeItem
    const pendingRes = executeWithdrawalCommand(base, {
      operationId: 'op-w-8000',
      goalId: 'goal-cdb',
      grossAmountR$: 8000,
      netAmountR$: 7800,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'pending_settlement',
      destinationAccountId: 'canon-checking',
      partitions: goodPreview.partitions,
      date: '2026-11-12',
      authoredByUid: 'uid-ana',
    });
    expect(pendingRes.status).toBe('success');
    expect(pendingRes.state.incomes).toHaveLength(0);
    expect(pendingRes.state.linkedAccounts![0].balance).toBe(1000);
    expect(pendingRes.state.piggyBanks[0].committedCents).toBe(800000);
    expect(pendingRes.operation?.taxCents).toBeUndefined();
    expect(pendingRes.operation?.feeCents).toBeUndefined();

    const pendingCash = selectVerifiableCashSummary(pendingRes.state, 'casal', '2026-11-12');
    expect(pendingCash.inTransitRedemptionCents).toBe(780000);
    expect(pendingCash.verifiedLiquidCashCents).toBe(100000);

    // Stage 2: settle in-place into occurred_manual (same op id)
    const settledRes = executeWithdrawalCommand(pendingRes.state, {
      operationId: 'op-w-8000',
      goalId: 'goal-cdb',
      grossAmountR$: 8000,
      netAmountR$: 7800,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'occurred_manual',
      destinationAccountId: 'canon-checking',
      partitions: goodPreview.partitions,
      date: '2026-11-14',
      authoredByUid: 'uid-ana',
    });
    expect(settledRes.status).toBe('success');
    expect(settledRes.state.financialOperations).toHaveLength(1);
    expect(settledRes.state.linkedAccounts![0].balance).toBe(8800); // 1000 + 7800 net payout
    expect(settledRes.state.piggyBanks[0].currentAmount).toBe(2000); // 10000 - 8000 gross
    expect(settledRes.state.piggyBanks[0].liberatedReservedCents).toBe(280000);
    const settledSummary = selectVerifiableCashSummary(settledRes.state, 'casal', '2026-11-14');
    expect(settledSummary.knownAccountsCashCents).toBe(880000);
    expect(settledSummary.liberatedPurposeCents).toBe(280000);
    expect(settledRes.state.incomes).toHaveLength(0);
    expect(settledRes.operation?.differenceToReviewCents).toBe(20000);
    expect(settledRes.operation?.taxCents).toBeUndefined();
    expect(settledRes.operation?.feeCents).toBeUndefined();
  });

  it('records planning divergence when overrideInsufficientPlanning=true without negative clamp or fake IncomeItem', () => {
    const base = makeBaseState({
      piggyBanks: [
        {
          id: 'goal-small',
          name: 'Viagem Curta',
          emoji: '✈️',
          purpose: 'Viagem',
          currentAmount: 300,
          targetAmount: 1000,
          monthlyDeposit: 100,
          availableCents: 30000,
          revision: 1,
        },
      ],
      coupleGoals: [
        {
          id: 'goal-small',
          title: 'Viagem Curta',
          category: 'viagem',
          emoji: '✈️',
          targetAmount: 1000,
          currentAmount: 300,
          availableCents: 30000,
          partner1Contribution: 150,
          partner2Contribution: 150,
          monthlyPlannedDeposit: 100,
          isCompleted: false,
          history: [],
          createdAt: '2026-10-01',
          revision: 1,
        },
      ],
    });

    const blocked = executeWithdrawalCommand(base, {
      goalId: 'goal-small',
      grossAmountR$: 500,
      withdrawalChannel: 'virtual_reallocation',
      executionMode: 'occurred_manual',
    });
    expect(blocked.status).toBe('failure');
    expect(blocked.reasonCode).toBe('INSUFFICIENT_FUNDS');

    const overridden = executeWithdrawalCommand(base, {
      operationId: 'op-div-500',
      goalId: 'goal-small',
      grossAmountR$: 500,
      withdrawalChannel: 'virtual_reallocation',
      executionMode: 'occurred_manual',
      overrideInsufficientPlanning: true,
    });
    expect(overridden.status).toBe('success');
    expect(overridden.state.piggyBanks[0].currentAmount).toBe(0);
    expect(overridden.state.piggyBanks[0].uncoveredDivergenceCents).toBe(20000);
    expect(overridden.operation?.planningDivergenceCents).toBe(20000);
    expect(overridden.state.incomes).toHaveLength(0);
  });

  it('pairs internal transfers explicitly and reconciles withdrawal credits without duplicating withdrawal or generating income', () => {
    const base = makeBaseState({
      linkedAccounts: [
        {
          id: 'acc-a',
          canonicalAccountId: 'canon-a',
          bankName: 'Nubank',
          accountType: 'corrente',
          accountNumber: '111',
          holder: 'partner1',
          balance: 2000,
          lastSynced: '2026-11-10',
          status: 'connected',
          colorHex: '#820ad1',
          logo: 'N',
          verificationStatus: 'verified',
        },
        {
          id: 'acc-b',
          canonicalAccountId: 'canon-b',
          bankName: 'Itaú',
          accountType: 'corrente',
          accountNumber: '222',
          holder: 'partner2',
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
          id: 'tx-deb',
          itemId: 'item-test',
          fitid: 'fit-deb',
          accountId: 'acc-a',
          bankName: 'Nubank',
          owner: 'partner1',
          date: '2026-11-11',
          description: 'PIX ENVIADO BRUNO',
          amount: 1200,
          direction: 'debit',
          status: 'pending',
        },
        {
          id: 'tx-cred',
          itemId: 'item-test',
          fitid: 'fit-cred',
          accountId: 'acc-b',
          bankName: 'Itaú',
          owner: 'partner2',
          date: '2026-11-12',
          description: 'PIX RECEBIDO ANA',
          amount: 1200,
          direction: 'credit',
          status: 'pending',
        },
        {
          id: 'tx-resgate',
          itemId: 'item-test',
          fitid: 'fit-resg',
          accountId: 'acc-b',
          bankName: 'Itaú',
          owner: 'both',
          date: '2026-11-15',
          description: 'RESGATE FUNDO BTG',
          amount: 7800,
          direction: 'credit',
          status: 'pending',
        },
      ],
    });

    const pairs = detectInternalTransferPairs(base.bankImportedTransactions!, base.linkedAccounts!);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].amountCents).toBe(120000);

    const pairRes = confirmInternalTransferPairCommand(base, {
      debitTxId: 'tx-deb',
      creditTxId: 'tx-cred',
      authorizedBy: 'uid-ana',
    });
    expect(pairRes.status).toBe('success');
    expect(pairRes.state.expenses).toHaveLength(0);
    expect(pairRes.state.incomes).toHaveLength(0);
    expect(pairRes.state.bankImportedTransactions?.filter(t => t.status === 'internal_transfer')).toHaveLength(2);

    const wRes = executeWithdrawalCommand(pairRes.state, {
      operationId: 'op-pend-8000',
      goalId: 'goal-cdb',
      grossAmountR$: 8000,
      netAmountR$: 8000,
      withdrawalChannel: 'asset_redemption',
      executionMode: 'pending_settlement',
      destinationAccountId: 'canon-b',
      date: '2026-11-13',
      authoredByUid: 'uid-ana',
    });
    expect(wRes.status).toBe('success');

    const match = findReconciliationCandidates(
      wRes.state.bankImportedTransactions!.find(t => t.id === 'tx-resgate')!,
      wRes.state.financialOperations || [],
      wRes.state.linkedAccounts || []
    );
    expect(match.candidates).toHaveLength(1);
    expect(match.ambiguous).toBe(false);
    expect(match.candidates[0].withinGrossSpread).toBe(true);
    expect(match.candidates[0].differenceCents).toBe(20000);

    const recRes = reconcileWithdrawalWithStatementCommand(wRes.state, {
      bankTransactionId: 'tx-resgate',
      operationId: 'op-pend-8000',
      reconciledByUid: 'uid-ana',
    });
    expect(recRes.status).toBe('success');
    expect(recRes.state.incomes).toHaveLength(0);
    expect(recRes.state.financialOperations?.filter(o => o.type === 'GOAL_WITHDRAWAL')).toHaveLength(1);
    expect(recRes.operation?.state).toBe('reconciled');
    expect(recRes.operation?.differenceToReviewCents).toBe(20000);
    expect(recRes.operation?.bankTransactionId).toBe('tx-resgate');
    expect(recRes.state.linkedAccounts!.find(a => a.id === 'acc-b')!.balance).toBe(8800);
  });

  it('blocks reversal when downstream consumption already used liberated funds and allows clean reversal when unused', () => {
    const base = makeBaseState({
      linkedAccounts: [
        {
          id: 'acc-1',
          canonicalAccountId: 'canon-1',
          bankName: 'Nubank',
          accountType: 'corrente',
          accountNumber: '123',
          holder: 'both',
          balance: 1000,
          lastSynced: '2026-11-10',
          status: 'connected',
          colorHex: '#820ad1',
          logo: 'N',
          verificationStatus: 'verified',
        },
      ],
    });

    const wRes = executeWithdrawalCommand(base, {
      operationId: 'op-w-lib',
      goalId: 'goal-cdb',
      grossAmountR$: 2000,
      netAmountR$: 2000,
      withdrawalChannel: 'virtual_reallocation',
      executionMode: 'occurred_manual',
      partitions: [{ id: 'p-goal', targetType: 'other_goal', targetId: 'goal-cdb', amountCents: 200000 }],
      date: '2026-11-12',
      authoredByUid: 'uid-ana',
    });
    expect(wRes.status).toBe('success');
    expect(wRes.state.piggyBanks[0].liberatedReservedCents).toBe(200000);

    // Clean reversal when liberated balance is still untouched
    const cleanRev = reverseFinancialCommand(wRes.state, 'op-w-lib', {
      authoredByUid: 'uid-ana',
      reason: 'Cancelado',
    });
    expect(cleanRev.status).toBe('success');
    expect(cleanRev.state.piggyBanks[0].currentAmount).toBe(10000);
    expect(cleanRev.state.piggyBanks[0].liberatedReservedCents).toBe(0);

    // Downstream expense consumes part of goal liberated funds -> reversal must block
    const withDownstream = runFinancialCommand(wRes.state, {
      id: 'op-exp-use-lib',
      type: 'EXPENSE_RECORD',
      amountCents: 50000,
      authorizedBy: 'uid-ana',
      scope: 'couple',
      sourceRef: { type: 'piggy_bank', id: 'goal-cdb' },
      targetRef: { type: 'expense', id: 'exp-1' },
      competence: '2026-11',
      date: '2026-11-13',
      state: 'occurred_manual',
    });
    expect(withDownstream.status).toBe('success');
    expect(withDownstream.state.piggyBanks[0].liberatedReservedCents).toBe(150000);

    const blockedRev = reverseFinancialCommand(withDownstream.state, 'op-w-lib', {
      authoredByUid: 'uid-ana',
      reason: 'Tentativa indevida',
    });
    expect(blockedRev.status).toBe('failure');
    expect(blockedRev.reasonCode).toBe('REVERSAL_DEPENDENCY_ERROR');
  });
});

const UIHarness: React.FC<{ mode: 'home' | 'deposit' | 'banksync' }> = ({ mode }) => {
  const {
    state,
    addPiggyBank,
    depositToPiggyBank,
    setCashBalanceAnchor,
    importStatement,
    addPluggyAccount,
  } = useFinance();
  const [modalOpen, setModalOpen] = React.useState(true);

  const seedGoal = () => {
    addPiggyBank({
      name: 'Reserva Casa',
      emoji: '🏠',
      purpose: 'Reserva',
      targetAmount: 10000,
      currentAmount: 0,
      monthlyDeposit: 500,
    });
  };

  const depositSeedGoal = () => {
    const g = state.piggyBanks[0];
    if (g) depositToPiggyBank(g.id, 1000);
  };

  const seedZeroChecking = () => {
    addPluggyAccount({
      itemId: 'item-zero',
      accountId: 'acc-zero',
      canonicalAccountId: 'canon-zero',
      name: 'Nubank Zero',
      bankName: 'Nubank Zero',
      accountType: 'corrente',
      type: 'conjunta',
      owner: 'both',
      taxNumber: '123',
      balance: 0,
      lastSynced: '2026-11-15',
      consentExpiresAt: '2027-11-15',
      status: 'connected',
      appOwner: 'partner1',
      verificationStatus: 'verified',
    });
    setCashBalanceAnchor({
      accountId: 'canon-zero',
      status: 'known',
      confirmedBalanceR$: 0,
      cutoffDate: '2026-11-15',
    });
  };

  const seedDuplicateAndPairs = () => {
    addPluggyAccount({
      itemId: 'item-a',
      accountId: 'acc-a',
      name: 'Nubank',
      bankName: 'Nubank',
      accountType: 'corrente',
      type: 'individual',
      owner: 'partner1',
      taxNumber: '123',
      balance: 1000,
      lastSynced: '2026-11-15',
      consentExpiresAt: '2027-11-15',
      status: 'connected',
      appOwner: 'partner1',
      verificationStatus: 'verified',
    });
    addPluggyAccount({
      itemId: 'item-b',
      accountId: 'acc-b',
      canonicalAccountId: 'canon-b',
      name: 'Itaú',
      bankName: 'Itaú',
      accountType: 'corrente',
      type: 'individual',
      owner: 'partner2',
      taxNumber: '456',
      balance: 500,
      lastSynced: '2026-11-15',
      consentExpiresAt: '2027-11-15',
      status: 'connected',
      appOwner: 'partner2',
      verificationStatus: 'verified',
    });
    importStatement([
      {
        id: 'ui-tx-deb',
        itemId: 'item-test',
        accountId: 'acc-a',
        bankName: 'Nubank',
        owner: 'partner1',
        date: '2026-11-14',
        description: 'PIX INTERNO SAIDA',
        amount: 400,
        direction: 'debit',
        status: 'pending',
      },
      {
        id: 'ui-tx-cred',
        itemId: 'item-test',
        accountId: 'acc-b',
        bankName: 'Itaú',
        owner: 'partner2',
        date: '2026-11-14',
        description: 'PIX INTERNO ENTRADA',
        amount: 400,
        direction: 'credit',
        status: 'pending',
      },
    ]);
  };

  return (
    <div>
      <button type="button" onClick={seedGoal}>seed-goal</button>
      <button type="button" onClick={depositSeedGoal}>deposit-1000</button>
      <button type="button" onClick={seedZeroChecking}>seed-zero-cash</button>
      <button type="button" onClick={seedDuplicateAndPairs}>seed-pairs</button>
      <div data-testid="ops-count">{(state.financialOperations || []).length}</div>
      <div data-testid="tx-statuses">
        {(state.bankImportedTransactions || []).map(t => `${t.id}:${t.status}`).join(',')}
      </div>
      {mode === 'home' && (
        <HomeScreen
          onNavigate={() => {}}
          onOpenExpenseModal={() => {}}
          onOpenIncomeModal={() => {}}
          onOpenInstallmentModal={() => {}}
          onOpenDepositModal={() => {}}
        />
      )}
      {mode === 'deposit' && (
        <DepositPiggyModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          bank={state.piggyBanks[0] || null}
        />
      )}
      {mode === 'banksync' && (
        <BankSyncModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
};

describe('Stage 26B — UI Consumers (HomeScreen, DepositPiggyModal, BankSyncModal)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('HomeScreen separates unverified cash from explicit R$ 0,00 confirmed cash', () => {
    render(
      <FinanceProvider>
        <AvatarProvider>
          <UIHarness mode="home" />
        </AvatarProvider>
      </FinanceProvider>
    );

    expect(screen.getByText(/Caixa livre não verificável/i)).toBeTruthy();

    fireEvent.click(screen.getByText('seed-zero-cash'));
    expect(screen.getByText(/Caixa livre verificável: R\$\s*0,00/i)).toBeTruthy();
  });

  it('DepositPiggyModal renders 26B preview (Renda nova gerada: R$ 0,00, Diferença a revisar) and records pending withdrawal', () => {
    render(
      <FinanceProvider>
        <UIHarness mode="deposit" />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('seed-goal'));
    fireEvent.click(screen.getByText('deposit-1000'));
    fireEvent.click(screen.getByText(/Retirar do Cofrinho/i));

    const grossInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(grossInput, { target: { value: '800' } });

    const netInput = screen.getByLabelText(/Valor líquido recebido/i);
    fireEvent.change(netInput, { target: { value: '750' } });

    expect(screen.getByText(/Diferença a revisar:/i)).toBeTruthy();
    expect(screen.getByText(/Renda nova gerada: R\$ 0,00/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/Solicitar \/ Planejar \(em liquidação\)/i));
    fireEvent.click(screen.getByText(/Solicitar \/ Planejar Resgate/i));

    expect(Number(screen.getByTestId('ops-count').textContent)).toBeGreaterThanOrEqual(2);
  });

  it('BankSyncModal renders internal transfer pair confirmation and cash balance anchor controls', () => {
    render(
      <FinanceProvider>
        <UIHarness mode="banksync" />
      </FinanceProvider>
    );

    fireEvent.click(screen.getByText('seed-pairs'));
    expect(screen.getByText(/Transferências Internas Detectadas/i)).toBeTruthy();
    expect(screen.getByText(/Verificação de Caixa & Contas Canônicas/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Transferência Interna/i }));
    expect(screen.getByTestId('tx-statuses').textContent).toContain('ui-tx-deb:internal_transfer');
    expect(screen.getByTestId('tx-statuses').textContent).toContain('ui-tx-cred:internal_transfer');
  });
});
