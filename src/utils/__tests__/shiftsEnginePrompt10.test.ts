import { describe, it, expect } from 'vitest';
import {
  calculateShiftMetrics,
  calculateShiftRecommendations,
  getShiftBalance,
  getShiftExpectedAmount,
  getShiftTimeWindow,
  checkShiftOverlap,
  findMatchingBankIncomesForShift,
} from '../shiftsEngine';
import {
  applyShiftAllocation,
  undoShiftAllocations,
} from '../shiftReconciliation';
import { MedicalShift, IncomeItem, ShiftIncomeAllocation } from '../../types/finance';

describe('Prompt 10: Plantões, saldos e disponibilidade', () => {
  describe('Single Source of Truth for Shift Balances & Allocations', () => {
    it('1 depósito de R$ 2.000 paga 2 plantões de R$ 1.000 cada sem duplicar entradas', () => {
      const shifts: MedicalShift[] = [
        {
          id: 'shift-a',
          partner: 'partner1',
          title: 'Plantão UTI A',
          hospitalName: 'Hospital Copa D\'Or',
          sector: 'uti',
          contractType: 'pj_privado',
          dateWorked: '2026-10-01',
          durationHours: 12,
          grossAmount: 1000,
          estimatedPayDate: '2026-10-15',
          status: 'pending',
          executionStatus: 'performed',
        },
        {
          id: 'shift-b',
          partner: 'partner1',
          title: 'Plantão UTI B',
          hospitalName: 'Hospital Copa D\'Or',
          sector: 'uti',
          contractType: 'pj_privado',
          dateWorked: '2026-10-02',
          durationHours: 12,
          grossAmount: 1000,
          estimatedPayDate: '2026-10-15',
          status: 'pending',
          executionStatus: 'performed',
        },
      ];

      const incomes: IncomeItem[] = [
        {
          id: 'dep-1',
          description: 'REPASSE D\'OR PLANTÕES OUTUBRO',
          amount: 2000,
          date: '2026-10-20',
          recipient: 'partner1',
          type: 'salario',
        },
      ];

      let ledgers: ShiftIncomeAllocation[] = [];

      // Allocates 1000 to shift-a
      const step1 = applyShiftAllocation(shifts, incomes, ledgers, 'shift-a', 'dep-1', 1000);
      ledgers = step1.ledgers;

      // Allocates 1000 to shift-b from same deposit
      const step2 = applyShiftAllocation(step1.shifts, incomes, ledgers, 'shift-b', 'dep-1', 1000);
      ledgers = step2.ledgers;

      expect(ledgers[0].allocations['shift-a']).toBe(100000); // 1000 * 100
      expect(ledgers[0].allocations['shift-b']).toBe(100000);

      const balanceA = getShiftBalance(step2.shifts[0], ledgers);
      const balanceB = getShiftBalance(step2.shifts[1], ledgers);

      expect(balanceA.receivedAmount).toBe(1000);
      expect(balanceA.pendingAmount).toBe(0);
      expect(balanceA.isFullyPaid).toBe(true);

      expect(balanceB.receivedAmount).toBe(1000);
      expect(balanceB.pendingAmount).toBe(0);
      expect(balanceB.isFullyPaid).toBe(true);

      // Verify calculateShiftMetrics sums both allocations correctly
      const metrics = calculateShiftMetrics(step2.shifts, '2026-10', 'partner1', ledgers);
      expect(metrics.totalReceived).toBe(2000);
      expect(metrics.totalPending).toBe(0);
      expect(metrics.receivedCount).toBe(2);
      expect(metrics.pendingCount).toBe(0);
    });

    it('plantão de R$ 1.200 com R$ 700 recebidos deixa exatamente R$ 500 pendentes', () => {
      const shift: MedicalShift = {
        id: 'shift-part',
        partner: 'partner1',
        title: 'Plantão Emergência',
        hospitalName: 'UPA Tijuca',
        sector: 'porta',
        contractType: 'pj_oss',
        dateWorked: '2026-10-05',
        durationHours: 12,
        grossAmount: 1200,
        estimatedPayDate: '2026-11-20',
        status: 'pending',
        executionStatus: 'performed',
      };

      const incomes: IncomeItem[] = [
        {
          id: 'inc-part',
          description: 'ADIANTAMENTO PARCIAL UPA',
          amount: 700,
          date: '2026-10-15',
          recipient: 'partner1',
          type: 'salario',
        },
      ];

      const res = applyShiftAllocation([shift], incomes, [], 'shift-part', 'inc-part', 700);
      const balance = getShiftBalance(res.shifts[0], res.ledgers);

      expect(balance.expectedAmount).toBe(1200);
      expect(balance.receivedAmount).toBe(700);
      expect(balance.pendingAmount).toBe(500);
      expect(balance.isFullyPaid).toBe(false);
      expect(balance.isPartiallyPaid).toBe(true);

      const metrics = calculateShiftMetrics(res.shifts, '2026-10', 'partner1', res.ledgers);
      expect(metrics.totalReceived).toBe(700);
      expect(metrics.totalPending).toBe(500);
      expect(metrics.pendingCount).toBe(1);
      expect(metrics.receivedCount).toBe(0);
    });

    it('preserva netAmount explicitamente zero sem cair em fallback para grossAmount', () => {
      const zeroShift: MedicalShift = {
        id: 'shift-zero',
        partner: 'partner2',
        title: 'Plantão Voluntário / Treinamento',
        hospitalName: 'Hospital Universitário',
        sector: 'enfermaria',
        contractType: 'outro',
        dateWorked: '2026-10-10',
        durationHours: 12,
        grossAmount: 1500,
        netAmount: 0, // explicitamente 0
        estimatedPayDate: '2026-10-25',
        status: 'pending',
        executionStatus: 'performed',
      };

      expect(getShiftExpectedAmount(zeroShift)).toBe(0);

      const balance = getShiftBalance(zeroShift, []);
      expect(balance.expectedAmount).toBe(0);
      expect(balance.pendingAmount).toBe(0);
      expect(balance.isFullyPaid).toBe(true);
    });

    it('plantões cancelados ou substituídos não contam como trabalho realizado nem receita a receber', () => {
      const shifts: MedicalShift[] = [
        {
          id: 's-cancelled',
          partner: 'partner1',
          title: 'Plantão Cancelado',
          hospitalName: 'UPA 24h',
          sector: 'porta',
          contractType: 'pj_oss',
          dateWorked: '2026-10-05',
          durationHours: 12,
          grossAmount: 1400,
          estimatedPayDate: '2026-11-20',
          status: 'pending',
          executionStatus: 'cancelled',
        },
        {
          id: 's-replaced',
          partner: 'partner1',
          title: 'Plantão Passado para Colega',
          hospitalName: 'Hospital Quinta D\'Or',
          sector: 'uti',
          contractType: 'pj_privado',
          dateWorked: '2026-10-06',
          durationHours: 12,
          grossAmount: 1900,
          estimatedPayDate: '2026-11-20',
          status: 'pending',
          executionStatus: 'replaced',
        },
      ];

      const metrics = calculateShiftMetrics(shifts, '2026-10');
      expect(metrics.totalHours).toBe(0);
      expect(metrics.totalGross).toBe(0);
      expect(metrics.totalPending).toBe(0);
      expect(metrics.shiftsCount).toBe(0);
    });
  });

  describe('Pacing Recommendations & Career Stages', () => {
    it('estudante em graduação ou internato não recebe sugestão de plantões extras', () => {
      const recStudent = calculateShiftRecommendations(
        3000,
        10000,
        15000,
        1500,
        '2026-11',
        'Novembro 2026',
        {
          partnerFilter: 'partner1',
          partner1Career: { stage: 'graduacao' },
        }
      );

      expect(recStudent.shiftsToCoverFixed).toBe(0);
      expect(recStudent.shiftsToMaintainLifestyle).toBe(0);
      expect(recStudent.shiftsToAccelerateGains).toBe(0);

      const recIntern = calculateShiftRecommendations(
        3000,
        10000,
        15000,
        1500,
        '2026-11',
        'Novembro 2026',
        {
          partnerFilter: 'partner2',
          partner2Career: { stage: 'internato' },
        }
      );

      expect(recIntern.shiftsToCoverFixed).toBe(0);
      expect(recIntern.shiftsToMaintainLifestyle).toBe(0);
      expect(recIntern.shiftsToAccelerateGains).toBe(0);
    });

    it('residente não recebe recomendação de plantões extras por padrão', () => {
      const recResidencyDefault = calculateShiftRecommendations(
        4000,
        10000,
        16000,
        1500,
        '2026-11',
        'Novembro 2026',
        {
          partnerFilter: 'partner1',
          partner1Career: { stage: 'residencia' },
          allowResidencyExtraShifts: false,
        }
      );

      expect(recResidencyDefault.shiftsToCoverFixed).toBe(0);
      expect(recResidencyDefault.shiftsToMaintainLifestyle).toBe(0);

      // Quando explicitamente autorizado
      const recResidencyConfirmed = calculateShiftRecommendations(
        4000,
        10000,
        16000,
        1500,
        '2026-11',
        'Novembro 2026',
        {
          partnerFilter: 'partner1',
          partner1Career: { stage: 'residencia' },
          allowResidencyExtraShifts: true,
        }
      );

      expect(recResidencyConfirmed.shiftsToCoverFixed).toBe(4); // (10000 - 4000) / 1500 = 4
    });
  });

  describe('Schedule Planning & Overlap Detection', () => {
    it('detecta plantão que vira a noite (22:00 às 07:00 do dia seguinte)', () => {
      const nightShift: MedicalShift = {
        id: 'night-1',
        partner: 'partner1',
        title: 'Plantão Noturno',
        hospitalName: 'Hospital Copa D\'Or',
        sector: 'vermelha',
        contractType: 'pj_privado',
        dateWorked: '2026-11-10',
        startTime: '22:00',
        endTime: '07:00',
        durationHours: 9,
        grossAmount: 1800,
        estimatedPayDate: '2026-12-10',
        status: 'pending',
      };

      const window = getShiftTimeWindow(nightShift);
      expect(window).not.toBeNull();
      expect(window!.crossesMidnight).toBe(true);
      expect(window!.start.getUTCDate()).toBe(10);
      expect(window!.end.getUTCDate()).toBe(11);
    });

    it('detecta sobreposição de horário para o mesmo parceiro', () => {
      const shiftA: MedicalShift = {
        id: 'sa',
        partner: 'partner1',
        title: 'Plantão Manhã',
        hospitalName: 'Hospital A',
        sector: 'porta',
        contractType: 'clt',
        dateWorked: '2026-11-10',
        startTime: '07:00',
        endTime: '19:00',
        durationHours: 12,
        grossAmount: 1500,
        estimatedPayDate: '2026-11-30',
        status: 'pending',
      };

      const shiftB: MedicalShift = {
        id: 'sb',
        partner: 'partner1',
        title: 'Plantão Tarde Conflitante',
        hospitalName: 'Hospital B',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-11-10',
        startTime: '13:00',
        endTime: '21:00',
        durationHours: 8,
        grossAmount: 1200,
        estimatedPayDate: '2026-11-30',
        status: 'pending',
      };

      const overlap = checkShiftOverlap(shiftA, shiftB, false);
      expect(overlap.overlaps).toBe(true);
      expect(overlap.reason).toContain('Conflito de horário');
    });

    it('não acusa conflito quando os plantões são de parceiros diferentes', () => {
      const shiftP1: MedicalShift = {
        id: 'sp1',
        partner: 'partner1',
        title: 'Plantão P1',
        hospitalName: 'Hospital A',
        sector: 'porta',
        contractType: 'clt',
        dateWorked: '2026-11-10',
        startTime: '07:00',
        endTime: '19:00',
        durationHours: 12,
        grossAmount: 1500,
        estimatedPayDate: '2026-11-30',
        status: 'pending',
      };

      const shiftP2: MedicalShift = {
        id: 'sp2',
        partner: 'partner2', // parceiro 2
        title: 'Plantão P2',
        hospitalName: 'Hospital B',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-11-10',
        startTime: '07:00',
        endTime: '19:00',
        durationHours: 12,
        grossAmount: 1800,
        estimatedPayDate: '2026-11-30',
        status: 'pending',
      };

      const overlap = checkShiftOverlap(shiftP1, shiftP2);
      expect(overlap.overlaps).toBe(false);
    });
  });

  describe('Invariants: Resgates não são renda de plantão', () => {
    it('resgate de investimento/caixinha é rejeitado na conciliação e na busca de recebimentos', () => {
      const shift: MedicalShift = {
        id: 'shift-med',
        partner: 'partner1',
        title: 'Plantão UTI',
        hospitalName: 'Hospital Copa D\'Or',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-10-01',
        durationHours: 12,
        grossAmount: 8000,
        estimatedPayDate: '2026-10-15',
        status: 'pending',
        executionStatus: 'performed',
      };

      const rescueIncome: IncomeItem = {
        id: 'inc-rescue',
        description: 'RESGATE FUNDO DI / CAIXINHA RESERVA',
        amount: 8000,
        date: '2026-10-05',
        recipient: 'partner1',
        type: 'restituicao',
        classification: 'resgate_principal',
      };

      // In findMatchingBankIncomesForShift
      const matches = findMatchingBankIncomesForShift(shift, [rescueIncome]);
      expect(matches.exactMatches).toEqual([]);
      expect(matches.probableMatches).toEqual([]);

      // In applyShiftAllocation
      expect(() => {
        applyShiftAllocation([shift], [rescueIncome], [], 'shift-med', 'inc-rescue');
      }).toThrow('Resgates de caixinhas ou investimentos não podem ser conciliados');
    });

    it('desfazer vínculo (undoShiftAllocations) reabre saldo pendente sem apagar depósito ou plantão', () => {
      const shift: MedicalShift = {
        id: 'shift-undo',
        partner: 'partner1',
        title: 'Plantão Emergência',
        hospitalName: 'UPA Tijuca',
        sector: 'porta',
        contractType: 'pj_oss',
        dateWorked: '2026-10-05',
        durationHours: 12,
        grossAmount: 1400,
        estimatedPayDate: '2026-11-20',
        status: 'received',
        executionStatus: 'performed',
      };

      const ledgers: ShiftIncomeAllocation[] = [
        {
          id: 'inc-100',
          allocations: { 'shift-undo': 140000 },
        },
      ];

      const undone = undoShiftAllocations([shift], ledgers, 'shift-undo');
      expect(undone.ledgers[0].allocations['shift-undo']).toBeUndefined();
      expect(undone.shifts[0].status).toBe('pending');
      expect(undone.shifts[0].pendingAmount).toBe(1400);
      expect(undone.shifts[0].reconciledAmount).toBe(0);
    });
  });
});
