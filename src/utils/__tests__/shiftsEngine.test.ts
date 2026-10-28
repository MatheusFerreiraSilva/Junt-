import { describe, it, expect } from 'vitest';
import {
  calculateEstimatedPayDate,
  calculateShiftMetrics,
  calculateHourlyYieldRanking,
  calculateShiftRecommendations,
  projectCashFlowTimeline,
  findMatchingBankIncomesForShift,
  getSampleMedicalShifts,
} from '../shiftsEngine';
import { MedicalShift, IncomeItem, HospitalIncomeMappingRule } from '../../types/finance';

describe('shiftsEngine: Gestão de Plantões Médicos', () => {
  it('deve calcular a data estimada de pagamento somando o delay de dias', () => {
    // 2026-10-10 + 30 dias = 2026-11-09
    const payDate = calculateEstimatedPayDate('2026-10-10', 30);
    expect(payDate).toBe('2026-11-09');
  });

  it('deve calcular métricas mensais de horas trabalhadas, valor bruto, recebidos e pendentes', () => {
    const shifts: MedicalShift[] = [
      {
        id: 's1',
        partner: 'partner1',
        title: 'UTI 12h',
        hospitalName: 'Hospital Copa D\'Or',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-10-05',
        durationHours: 12,
        grossAmount: 1800,
        estimatedPayDate: '2026-11-05',
        status: 'pending',
      },
      {
        id: 's2',
        partner: 'partner2',
        title: 'Porta 12h',
        hospitalName: 'RioSaúde CER',
        sector: 'porta',
        contractType: 'clt',
        dateWorked: '2026-10-12',
        durationHours: 12,
        grossAmount: 1500,
        netAmount: 1400,
        estimatedPayDate: '2026-10-20',
        status: 'received',
      },
    ];

    const metrics = calculateShiftMetrics(shifts, '2026-10');
    expect(metrics.totalHours).toBe(24);
    expect(metrics.totalGross).toBe(3300);
    expect(metrics.totalReceived).toBe(1400);
    expect(metrics.totalPending).toBe(1800);
    expect(metrics.shiftsCount).toBe(2);
    expect(metrics.averageRatePerHour).toBe(Math.round(3300 / 24));
  });

  it('deve calcular o termômetro de rentabilidade R$/hora e ordenar pelo mais rentável', () => {
    const shifts: MedicalShift[] = [
      {
        id: 's1',
        partner: 'partner1',
        title: 'Porta UPA 12h',
        hospitalName: 'UPA Marechal Hermes',
        sector: 'porta',
        contractType: 'pj_oss',
        dateWorked: '2026-10-01',
        durationHours: 12,
        grossAmount: 1440, // 120/h
        estimatedPayDate: '2026-11-30',
        status: 'pending',
      },
      {
        id: 's2',
        partner: 'partner2',
        title: 'UTI Barra D\'Or 12h',
        hospitalName: 'Barra D\'Or',
        sector: 'uti',
        contractType: 'pj_privado',
        dateWorked: '2026-10-02',
        durationHours: 12,
        grossAmount: 2160, // 180/h
        estimatedPayDate: '2026-11-15',
        status: 'pending',
      },
    ];

    const ranking = calculateHourlyYieldRanking(shifts);
    expect(ranking.length).toBe(2);
    expect(ranking[0].hospitalName).toBe('Barra D\'Or');
    expect(ranking[0].ratePerHour).toBe(180);
    expect(ranking[0].badge).toContain('Alta Eficiência');
    expect(ranking[1].hospitalName).toBe('UPA Marechal Hermes');
    expect(ranking[1].ratePerHour).toBe(120);
  });

  it('deve calcular a prescrição de 3 níveis de plantões para meses secos', () => {
    // Cenário:
    // Entrada projetada: R$ 5.000
    // Contas fixas: R$ 8.000 (gap de 3.000)
    // Renda média do casal: R$ 15.000 (gap de 10.000)
    // Meta acelerada (+20%): R$ 18.000 (gap de 13.000)
    // Valor médio por plantão: R$ 1.500
    const rec = calculateShiftRecommendations(
      5000,
      8000,
      15000,
      1500,
      '2026-11',
      'Novembro de 2026'
    );

    expect(rec.isDryMonth).toBe(true);
    // Nível 1: Cobrir contas fixas (3000 / 1500 = 2 plantões)
    expect(rec.shiftsToCoverFixed).toBe(2);
    // Nível 2: Manter estilo (10000 / 1500 = 7 plantões)
    expect(rec.shiftsToMaintainLifestyle).toBe(7);
    // Nível 3: Acelerar (+20% -> 18000 - 5000 = 13000 / 1500 = 9 plantões)
    expect(rec.shiftsToAccelerateGains).toBe(9);
  });

  it('deve projetar o fluxo de caixa para os próximos meses', () => {
    const shifts = getSampleMedicalShifts('2026-10');
    const timeline = projectCashFlowTimeline(shifts, 8000, 16000, '2026-10', 4);
    expect(timeline.length).toBe(4);
    expect(timeline[0].monthKey).toBe('2026-10');
    expect(timeline[0].recommendation).toBeDefined();
  });

  it('deve conciliar plantão com transação bancária Open Finance por valor e regra de hospital', () => {
    const shift: MedicalShift = {
      id: 'shift-1',
      partner: 'partner1',
      title: 'Plantão UPA',
      hospitalName: 'UPA 24h Tijuca / OSS',
      sector: 'porta',
      contractType: 'pj_oss',
      dateWorked: '2026-08-10',
      durationHours: 12,
      grossAmount: 1350,
      estimatedPayDate: '2026-10-10',
      status: 'pending',
    };

    const rules: HospitalIncomeMappingRule[] = [
      {
        id: 'r1',
        hospitalName: 'UPA 24h Tijuca / OSS',
        keywordPattern: 'VIVA RIO',
        createdAt: '2026-10-01',
      },
    ];

    const incomes: IncomeItem[] = [
      {
        id: 'inc-1',
        description: 'TED VIVA RIO REPASSE MEDICO',
        amount: 1350,
        date: '2026-10-09',
        recipient: 'partner1',
        type: 'salario',
      },
      {
        id: 'inc-2',
        description: 'PIX MERCADINHO',
        amount: 80,
        date: '2026-10-10',
        recipient: 'partner1',
        type: 'extra',
      },
    ];

    const result = findMatchingBankIncomesForShift(shift, incomes, rules);
    expect(result.exactMatches.length).toBe(1);
    expect(result.exactMatches[0].id).toBe('inc-1');
  });
});

 describe('plantões sem dados inventados', () => {
 it('não cria renda ou valor médio quando não há registros', () => {
 const [month] = projectCashFlowTimeline([], 0, 0, '2026-10', 1);
 expect(month.fixedExpenses).toBe(0); expect(month.projectedIncome).toBe(0); expect(month.recommendation.averageIncomeTarget).toBe(0); expect(month.recommendation.averageShiftValue).toBe(0);
 });
 it('não conta cancelados nem futuros como trabalho realizado', () => {
 const base = getSampleMedicalShifts('2026-10')[0];
 const shifts: MedicalShift[] = [{...base,id:'cancelled', executionStatus:'cancelled'}, {...base,id:'future',dateWorked:'2099-01-01',estimatedPayDate:'2099-02-01',status:'pending'}];
 expect(calculateShiftMetrics(shifts,'2026-10').totalGross).toBe(0);
 expect(calculateShiftMetrics(shifts,'2099-01').totalHours).toBe(0);
 expect(calculateHourlyYieldRanking(shifts)).toEqual([]);
 });
 it('não concilia depósito do outro parceiro', () => {
 const shift = getSampleMedicalShifts('2026-10')[0];
 const result = findMatchingBankIncomesForShift(shift,[{id:'other',recipient:'partner2',amount:shift.netAmount ?? shift.grossAmount,date:'2026-10-20',description:shift.hospitalName,type:'salario'}]);
 expect(result.exactMatches).toEqual([]); expect(result.probableMatches).toEqual([]);
 });
});
