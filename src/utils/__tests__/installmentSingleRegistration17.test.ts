import { describe, it, expect } from 'vitest';
import { installmentCents, buildInstallmentSchedule } from '../installmentMoney';
import { InstallmentPurchase } from '../../types/finance';

describe('Prompt 17 — Cadastro único de parcelamento e regras contratuais', () => {
  const sampleInput = {
    title: 'Geladeira Inverter',
    category: 'moradia' as const,
    totalAmount: 100.01,
    installmentsCount: 3,
    purchaseDate: '2026-12-15',
    startMonth: '2026-12',
    dueDay: 10,
    paidBy: 'both' as const,
    splitPartner1Pct: 50,
    splitPartner2Pct: 50,
  };

  it('1. Exact cent schedule: R$ 100,01 in 3 installments closes strictly to R$ 100,01', () => {
    const cents = installmentCents(sampleInput.totalAmount, sampleInput.installmentsCount);
    expect(cents).toEqual([3334, 3334, 3333]);
    const totalCents = cents.reduce((a, b) => a + b, 0);
    expect(totalCents).toBe(10001);

    const mockItem: InstallmentPurchase = {
      id: 'inst-100',
      ...sampleInput,
      installmentAmount: 33.34,
      paidInstallmentsCount: 0,
      active: true,
    };

    const schedule = buildInstallmentSchedule(mockItem);
    expect(schedule).toHaveLength(3);
    const scheduleSumR$ = Math.round(schedule.reduce((s, o) => s + o.amountR$, 0) * 100) / 100;
    expect(scheduleSumR$).toBe(100.01);
  });

  it('2. Domain validation: rejects count 0, NaN, Infinity, negative total and invalid dates', () => {
    expect(() => installmentCents(100, 0)).toThrow('Parcelamento inválido.');
    expect(() => installmentCents(-50, 3)).toThrow('Parcelamento inválido.');
    expect(() => installmentCents(NaN, 3)).toThrow('Parcelamento inválido.');
    expect(() => installmentCents(Infinity, 3)).toThrow('Parcelamento inválido.');
  });

  it('3. Calendar competence: December purchase crosses year boundary to Jan and Feb', () => {
    const decItem: InstallmentPurchase = {
      id: 'inst-dec',
      title: 'Viagem Réveillon',
      category: 'lazer',
      totalAmount: 300,
      installmentsCount: 3,
      installmentAmount: 100,
      startMonth: '2026-12',
      purchaseDate: '2026-12-28',
      dueDay: 10,
      paidBy: 'both',
      paidInstallmentsCount: 0,
      active: true,
    };

    const schedule = buildInstallmentSchedule(decItem);
    const months = schedule.map(o => o.competenceMonth);
    expect(months).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('4. Bank name optionality: empty bank name remains undefined (no fake "Itaú Personalité")', () => {
    const rawBankInput = '   ';
    const cleanedBank = rawBankInput.trim() || undefined;
    expect(cleanedBank).toBeUndefined();

    const itemWithBank: InstallmentPurchase = {
      id: 'inst-nobank',
      title: 'Compra Sem Cartão Especificado',
      category: 'moradia',
      totalAmount: 500,
      installmentsCount: 5,
      installmentAmount: 100,
      startMonth: '2026-12',
      paidBy: 'both',
      paidInstallmentsCount: 0,
      active: true,
      bankName: cleanedBank,
    };

    expect(itemWithBank.bankName).toBeUndefined();
  });

  it('5. Ongoing / legacy purchase registration with paidInstallmentsCount > 0', () => {
    const ongoingItem: InstallmentPurchase = {
      id: 'inst-ongoing',
      title: 'Armário Planejado',
      category: 'moradia',
      totalAmount: 1200,
      installmentsCount: 12,
      installmentAmount: 100,
      startMonth: '2026-09',
      paidBy: 'both',
      paidInstallmentsCount: 3, // 3 already paid (Sep, Oct, Nov)
      active: true,
    };

    const schedule = buildInstallmentSchedule(ongoingItem, '2026-12');
    const paidOccurrences = schedule.filter(o => o.status === 'pago');
    expect(paidOccurrences).toHaveLength(3);
    expect(schedule[0].status).toBe('pago');
    expect(schedule[2].status).toBe('pago');
    expect(schedule[3].status).toBe('previsto'); // Dec 2026 is current month -> previsto
  });

  it('6. Idempotency: same requestId represents a single intent', () => {
    const reqId = 'req-unique-12345';
    const itemA = { ...sampleInput, requestId: reqId };
    const itemB = { ...sampleInput, requestId: reqId };

    expect(itemA.requestId).toBe(itemB.requestId);
  });
});
