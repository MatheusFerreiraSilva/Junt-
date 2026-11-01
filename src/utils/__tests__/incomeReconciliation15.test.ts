import { describe, expect, it } from 'vitest';
import { applyShiftAllocation, undoShiftAllocations } from '../shiftReconciliation';
import {
  selectEligibleNetIncomeReceived,
  selectGrossBankInflows,
} from '../domainSelectors';
import type { AppState, IncomeItem, MedicalShift, ShiftIncomeAllocation } from '../../types/finance';

const createBaseState = (): AppState => ({
  profile: {
    partner1Name: 'Ana',
    partner2Name: 'Carlos',
    partner1Income: 18000,
    partner2Income: 18000,
    emergencyReserveMonthsTarget: 6,
    expectedYieldAnnual: 6.5,
    city: 'São Paulo - SP',
    streakMonths: 3,
    themeMode: 'light',
    accentTheme: 'emerald',
  },
  expenses: [],
  incomes: [],
  medicalShifts: [],
  shiftIncomeAllocations: [],
  categoryPercentages: {
    moradia: 30,
    comida: 25,
    lazer: 15,
    protecao: 10,
    profissional: 10,
    transporte: 10,
  },
  piggyBanks: [],
  installments: [],
  linkedAccounts: [],
  alertRules: [],
  currentMonth: '2025-02',
  protectionCurrentAmount: 0,
  protectionTotalInvested: 0,
  protectionYieldAccumulated: 0,
  isProtectionComplete: false,
  freedomTotalInvested: 0,
  freedomYieldAccumulated: 0,
  detectedSubscriptions: [],
  monthlyBudgetPlans: {},
  notifications: [],
});

describe('Step 15: Recebimentos com identidade e conciliação consistentes', () => {
  it('partially allocates R$ 700 to an R$ 1.200 shift, leaving R$ 500 pending', () => {
    const shift: MedicalShift = {
      id: 'shift-1',
      partner: 'partner1',
      title: 'Plantão UTI',
      hospitalName: 'Hospital Central',
      sector: 'uti',
      contractType: 'pj_privado',
      dateWorked: '2025-02-01',
      durationHours: 12,
      grossAmount: 1200,
      netAmount: 1200,
      estimatedPayDate: '2025-02-28',
      status: 'pending',
    };

    const canonicalIncomeId = 'inc-20250210-abc12';
    const income: IncomeItem = {
      id: canonicalIncomeId,
      description: 'Depósito Parcial Plantão Hospital Central',
      amount: 700,
      date: '2025-02-10',
      recipient: 'partner1',
      type: 'extra',
      classification: 'pj_gross',
      linkedShiftId: shift.id,
    };

    const ledgers: ShiftIncomeAllocation[] = [];
    const result = applyShiftAllocation([shift], [income], ledgers, shift.id, canonicalIncomeId, 700);

    expect(result.shifts[0].status).toBe('pending');
    expect(result.shifts[0].linkedIncomeId).toBe(canonicalIncomeId);
    expect(result.ledgers[0].id).toBe(canonicalIncomeId);
    expect(result.ledgers[0].allocations[shift.id]).toBe(70000); // 700 in cents

    // Calculate remaining balance
    const allocatedCents = result.ledgers.reduce(
      (sum, l) => sum + (l.allocations[shift.id] || 0),
      0
    );
    const totalCents = Math.round((shift.netAmount ?? shift.grossAmount) * 100);
    const remainingCents = totalCents - allocatedCents;
    expect(remainingCents).toBe(50000); // R$ 500 remaining
  });

  it('completes the shift with a second deposit of R$ 500 from another canonical income', () => {
    const shift: MedicalShift = {
      id: 'shift-1',
      partner: 'partner1',
      title: 'Plantão UTI',
      hospitalName: 'Hospital Central',
      sector: 'uti',
      contractType: 'pj_privado',
      dateWorked: '2025-02-01',
      durationHours: 12,
      grossAmount: 1200,
      netAmount: 1200,
      estimatedPayDate: '2025-02-28',
      status: 'pending',
    };

    const income1: IncomeItem = {
      id: 'inc-1',
      description: 'Depósito 1',
      amount: 700,
      date: '2025-02-10',
      recipient: 'partner1',
      type: 'extra',
      classification: 'pj_gross',
    };

    const income2: IncomeItem = {
      id: 'inc-2',
      description: 'Depósito 2',
      amount: 500,
      date: '2025-02-15',
      recipient: 'partner1',
      type: 'extra',
      classification: 'pj_gross',
    };

    const first = applyShiftAllocation([shift], [income1, income2], [], shift.id, 'inc-1', 700);
    expect(first.shifts[0].status).toBe('pending');

    const second = applyShiftAllocation(first.shifts, [income1, income2], first.ledgers, shift.id, 'inc-2', 500);
    expect(second.shifts[0].status).toBe('received');
    expect(second.shifts[0].actualPayDate).toBe('2025-02-15');

    const totalAllocatedCents = second.ledgers.reduce(
      (sum, l) => sum + (l.allocations[shift.id] || 0),
      0
    );
    expect(totalAllocatedCents).toBe(120000);
  });

  it('correctly handles zero netAmount (netAmount: 0) without falling back to grossAmount via ||', () => {
    const zeroNetShift: MedicalShift = {
      id: 'shift-zero',
      partner: 'partner1',
      title: 'Plantão Voluntário/Sem Remuneração Líquida',
      hospitalName: 'Hospital Escola',
      sector: 'enfermaria',
      contractType: 'outro',
      dateWorked: '2025-02-01',
      durationHours: 12,
      grossAmount: 1500,
      netAmount: 0, // Explicit 0
      estimatedPayDate: '2025-02-28',
      status: 'pending',
    };

    const income: IncomeItem = {
      id: 'inc-test',
      description: 'Depósito Teste',
      amount: 500,
      date: '2025-02-10',
      recipient: 'partner1',
      type: 'extra',
    };

    // When netAmount is 0, outstanding is 0, so allocating any amount > 0 must throw error
    expect(() =>
      applyShiftAllocation([zeroNetShift], [income], [], zeroNetShift.id, income.id, 100)
    ).toThrow();
  });

  it('preserves exact income types and excludes restituicao (reimbursement) from eligible net income', () => {
    const state = createBaseState();
    state.incomes = [
      {
        id: 'inc-sal',
        description: 'Salário Hospital A',
        amount: 15000,
        date: '2025-03-05',
        recipient: 'partner1',
        type: 'salario',
        classification: 'pf_net',
      },
      {
        id: 'inc-bonus',
        description: 'Bônus Anual',
        amount: 5000,
        date: '2025-03-10',
        recipient: 'partner1',
        type: 'bonus',
        classification: 'pf_net',
      },
      {
        id: 'inc-extra',
        description: 'Plantão Extra',
        amount: 2000,
        date: '2025-03-15',
        recipient: 'partner2',
        type: 'extra',
        classification: 'pj_gross',
      },
      {
        id: 'inc-rest',
        description: 'Restituição IRPF',
        amount: 3000,
        date: '2025-03-20',
        recipient: 'partner1',
        type: 'restituicao',
        classification: 'reimbursement',
      },
      {
        id: 'inc-outro',
        description: 'Outra Entrada Eventual',
        amount: 1000,
        date: '2025-03-22',
        recipient: 'partner2',
        type: 'outro',
      },
    ];

    // Eligible net income received should include salario (15000) + bonus (5000) + extra (2000) + outro (1000) = 23000
    // Restituicao (reimbursement 3000) must be excluded from eligible operational income
    const eligibleReceived = selectEligibleNetIncomeReceived(state, 'casal', '2025-03');
    expect(eligibleReceived).toBe(23000);

    // Gross bank inflows includes all inflows (including restituicao 3000) = 26000
    const grossInflows = selectGrossBankInflows(state, 'casal', '2025-03');
    expect(grossInflows).toBe(26000);
  });

  it('excludes forecast incomes (isForecast: true or projected) from eligible net income received and gross inflows', () => {
    const state = createBaseState();
    state.incomes = [
      {
        id: 'inc-real',
        description: 'Salário Realizado',
        amount: 12000,
        date: '2025-03-05',
        recipient: 'partner1',
        type: 'salario',
      },
      {
        id: 'inc-forecast-1',
        description: 'Previsão de Plantão Futuro',
        amount: 4000,
        expectedAmount: 4000,
        expectedDate: '2025-03-28',
        date: '2025-03-28',
        recipient: 'partner1',
        type: 'extra',
        isForecast: true,
      },
      {
        id: 'inc-forecast-2',
        description: 'Plantão Projetado',
        amount: 3500,
        date: '2025-03-30',
        recipient: 'partner2',
        type: 'extra',
        status: 'projected',
      },
    ];

    const eligibleReceived = selectEligibleNetIncomeReceived(state, 'casal', '2025-03');
    expect(eligibleReceived).toBe(12000);

    const grossInflows = selectGrossBankInflows(state, 'casal', '2025-03');
    expect(grossInflows).toBe(12000);
  });

  it('reversal/estorno of allocations restores shift to pending without deleting the deposit', () => {
    const shift: MedicalShift = {
      id: 'shift-rev',
      partner: 'partner1',
      title: 'Plantão Cardio',
      hospitalName: 'Hospital Santa Cruz',
      sector: 'uti',
      contractType: 'pj_privado',
      dateWorked: '2025-02-01',
      durationHours: 12,
      grossAmount: 1000,
      netAmount: 1000,
      estimatedPayDate: '2025-02-28',
      status: 'pending',
    };

    const income: IncomeItem = {
      id: 'inc-rev',
      description: 'Depósito Plantão',
      amount: 1000,
      date: '2025-02-15',
      recipient: 'partner1',
      type: 'extra',
    };

    const allocated = applyShiftAllocation([shift], [income], [], shift.id, income.id, 1000);
    expect(allocated.shifts[0].status).toBe('received');
    expect(allocated.ledgers[0].allocations[shift.id]).toBe(100000);

    const undone = undoShiftAllocations(allocated.shifts, allocated.ledgers, shift.id);
    expect(undone.shifts[0].status).toBe('pending');
    expect(undone.shifts[0].linkedIncomeId).toBeUndefined();
    expect(undone.shifts[0].actualPayDate).toBeUndefined();
    expect(undone.ledgers[0].allocations[shift.id]).toBeUndefined();
  });
});
