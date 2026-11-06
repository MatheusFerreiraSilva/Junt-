import { describe, it, expect } from 'vitest';
import {
  installmentCents,
  buildInstallmentSchedule,
  payOccurrence,
  advanceOccurrences,
  reverseOccurrencePayment,
  previewAdvanceImpact,
  getInstallmentCompetence,
  generateOccurrenceId,
} from '../installmentMoney';
import { InstallmentPurchase } from '../../types/finance';

describe('Prompt 08 — Ocorrências, quitação e antecipação de parcelas', () => {
  const basePurchase: InstallmentPurchase = {
    id: 'inst-test-1',
    title: 'Sofá Retrátil',
    totalAmount: 100.01,
    installmentsCount: 3,
    paidInstallmentsCount: 0,
    startMonth: '2026-12',
    dueDay: 10,
    category: 'moradia',
    paidBy: 'both',
    active: true,
    installmentAmount: 33.34,
  };

  it('1. Exact cent allocation: R$ 100,01 in 3 installments closes exactly R$ 100,01 with zero loss', () => {
    const cents = installmentCents(basePurchase);
    expect(cents).toEqual([3334, 3334, 3333]);
    const totalCents = cents.reduce((a, b) => a + b, 0);
    expect(totalCents).toBe(10001);

    const schedule = buildInstallmentSchedule(basePurchase, '2026-12');
    expect(schedule).toHaveLength(3);
    expect(schedule[0].amountR$).toBe(33.34);
    expect(schedule[1].amountR$).toBe(33.34);
    expect(schedule[2].amountR$).toBe(33.33);
    const sumR$ = Math.round(schedule.reduce((acc, s) => acc + s.amountR$, 0) * 100) / 100;
    expect(sumR$).toBe(100.01);
  });

  it('2. Competence isolation: beginning in Dec/2026 has zero obligation in Nov/2026', () => {
    const schedule = buildInstallmentSchedule(basePurchase, '2026-11');
    const novObligation = schedule.filter(s => s.competenceMonth === '2026-11');
    expect(novObligation).toHaveLength(0);

    const months = schedule.map(s => s.competenceMonth);
    expect(months).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('3. Stable occurrence identity: purchaseId:number:competenceMonth', () => {
    const id0 = generateOccurrenceId('inst-123', 1, '2026-12');
    expect(id0).toBe('inst-123:1:2026-12');

    const schedule = buildInstallmentSchedule(basePurchase);
    expect(schedule[0].occurrenceId).toBe('inst-test-1:1:2026-12');
    expect(schedule[1].occurrenceId).toBe('inst-test-1:2:2027-01');
    expect(schedule[2].occurrenceId).toBe('inst-test-1:3:2027-02');
  });

  it('4. Legacy counter migration without inventing dates or losing integrity', () => {
    const legacyItem: InstallmentPurchase = {
      ...basePurchase,
      paidInstallmentsCount: 2, // 2 already paid in legacy
    };
    const schedule = buildInstallmentSchedule(legacyItem, '2027-01');
    expect(schedule[0].status).toBe('pago');
    expect(schedule[1].status).toBe('pago');
    expect(schedule[2].status).toBe('previsto');
  });

  it('5. Double-click / retry idempotency: paying occurrence twice does NOT advance to next installment', () => {
    const firstPay = payOccurrence(basePurchase, 1);
    expect(firstPay.alreadyPaid).toBe(false);
    expect(firstPay.updatedItem.paidInstallmentsCount).toBe(1);
    expect(firstPay.paidOccurrence.installmentNumber).toBe(1);
    expect(firstPay.paidOccurrence.status).toBe('pago');

    // Attempt second payment on same occurrence (e.g. double click or retry after timeout)
    const retryPay = payOccurrence(firstPay.updatedItem, 1);
    expect(retryPay.alreadyPaid).toBe(true);
    expect(retryPay.updatedItem.paidInstallmentsCount).toBe(1); // strictly did NOT jump to 2!
    expect(retryPay.paidOccurrence.status).toBe('pago');

    // Paying by occurrenceId string directly
    const retryByStringId = payOccurrence(firstPay.updatedItem, 'inst-test-1:1:2026-12');
    expect(retryByStringId.alreadyPaid).toBe(true);
    expect(retryByStringId.updatedItem.paidInstallmentsCount).toBe(1);
  });

  it('6. Anticipation with discount and concrete funding tracking', () => {
    const advanceResult = advanceOccurrences(basePurchase, {
      countToAdvance: 2,
      discountCents: 500, // R$ 5,00 discount
      funding: {
        fromProtectionExcess: 40,
        fromGoalId: 'goal-viagem',
        fromGoalAmount: 21.67,
        fromMonthSurplus: 0,
      },
    });

    expect(advanceResult.advancedOccurrences).toHaveLength(2);
    // Last 2 occurrences: #2 (33.34) + #3 (33.33) = 66.67
    expect(advanceResult.totalNominalCents).toBe(6667);
    expect(advanceResult.totalDiscountCents).toBe(500);
    expect(advanceResult.totalEffectivePaidCents).toBe(6167); // R$ 61,67
    expect(advanceResult.updatedItem.paidInstallmentsCount).toBe(2);

    // Verify first advanced occurrence
    const occ1 = advanceResult.advancedOccurrences[0];
    expect(occ1.status).toBe('antecipado');
    expect(occ1.fundingSource?.fromGoalId).toBe('goal-viagem');
    expect(occ1.discountCents).toBeGreaterThan(0);
  });

  it('7. Reversal (estorno): references original operation and reconstructs exact funding source', () => {
    const advanceResult = advanceOccurrences(basePurchase, {
      countToAdvance: 1,
      discountCents: 200, // R$ 2,00 discount
      funding: {
        fromProtectionExcess: 10,
        fromGoalId: 'goal-carro',
        fromGoalAmount: 21.33,
      },
    });

    expect(advanceResult.updatedItem.paidInstallmentsCount).toBe(1);
    const targetAdvancedNumber = advanceResult.advancedOccurrences[0].installmentNumber;

    // Now reverse/estorno this occurrence
    const reversal = reverseOccurrencePayment(advanceResult.updatedItem, targetAdvancedNumber);
    expect(reversal.alreadyReversed).toBe(false);
    expect(reversal.updatedItem.paidInstallmentsCount).toBe(0);
    expect(reversal.reversedOccurrence.status).toBe('estornado');

    // Verify funding return amounts match exactly what was debited
    expect(reversal.returnedToGoal?.goalId).toBe('goal-carro');
    expect(reversal.returnedToGoal?.amountR$).toBe(21.33);
    expect(reversal.returnedToReserveExcessR$).toBe(10);

    // Reversing again is idempotent
    const retryReversal = reverseOccurrencePayment(reversal.updatedItem, targetAdvancedNumber);
    expect(retryReversal.alreadyReversed).toBe(true);
    expect(retryReversal.updatedItem.paidInstallmentsCount).toBe(0);
  });

  it('8. Preview pure function does NOT mutate item state or lock funds', () => {
    const preview = previewAdvanceImpact(basePurchase, 2, 5);
    // Last 2: #2 (33.34) + #3 (33.33) = 66.67
    expect(preview.nominalTotalR$).toBe(66.67);
    expect(preview.discountR$).toBe(5);
    expect(preview.effectiveTotalR$).toBe(61.67);
    expect(preview.newRemainingCount).toBe(1);

    // Item state remains pristine
    expect(basePurchase.paidInstallmentsCount).toBe(0);
  });
});
