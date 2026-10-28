import type { IncomeItem, MedicalShift, ShiftIncomeAllocation } from '../types/finance';
const cents = (value: number) => Math.round(value * 100);
export function applyShiftAllocation(shifts: MedicalShift[], incomes: IncomeItem[], ledgers: ShiftIncomeAllocation[], shiftId: string, incomeId: string, amount?: number) {
  const shift = shifts.find(s => s.id === shiftId);
  const income = incomes.find(i => i.id === incomeId);
  if (!shift || !income || income.recipient !== shift.partner) throw new Error('Selecione um recebimento do parceiro deste plantão.');
  if (shift.executionStatus && shift.executionStatus !== 'performed') throw new Error('Somente um plantão realizado pode ser conciliado.');
  if (shift.dateWorked > income.date || shift.dateWorked > [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')].join('-')) throw new Error('O plantão precisa ter sido realizado antes do recebimento.');
  const next = ledgers.map(l => ({ ...l, allocations: { ...l.allocations } }));
  let ledger = next.find(l => l.id === incomeId);
  if (!ledger) { ledger = { id: incomeId, allocations: {} }; next.push(ledger); }
  if (ledger.allocations[shiftId] !== undefined) return { shifts, ledgers }; // repeat is idempotent
  const allocatedIncome = Object.values(ledger.allocations).reduce((sum, value) => sum + value, 0);
  const receivedShift = next.reduce((sum, entry) => sum + (entry.allocations[shiftId] || 0), 0);
  const outstanding = Math.max(0, cents(shift.netAmount ?? shift.grossAmount) - receivedShift);
  const available = Math.max(0, cents(income.amount) - allocatedIncome);
  const allocation = amount === undefined ? Math.min(outstanding, available) : cents(amount);
  if (!Number.isFinite(allocation) || allocation <= 0 || allocation > available || allocation > outstanding) throw new Error('O valor excede o saldo do recebimento ou o pendente do plantão.');
  ledger.allocations[shiftId] = allocation;
  return { ledgers: next, shifts: shifts.map(item => {
    if (item.id !== shiftId) return item;
    const received = receivedShift + allocation;
    return { ...item, status: received >= cents(item.netAmount ?? item.grossAmount) ? 'received' as const : 'pending' as const, actualPayDate: income.date, linkedIncomeId: incomeId, linkedIncomeDescription: income.description };
  }) };
}
export function undoShiftAllocations(shifts: MedicalShift[], ledgers: ShiftIncomeAllocation[], shiftId: string) {
  return {
    ledgers: ledgers.map(ledger => { const allocations = { ...ledger.allocations }; delete allocations[shiftId]; return { ...ledger, allocations }; }),
    shifts: shifts.map(shift => shift.id === shiftId ? { ...shift, status: 'pending' as const, actualPayDate: undefined, linkedIncomeId: undefined, linkedIncomeDescription: undefined } : shift),
  };
}

// Preserve old links as capped allocations. Never manufacture a missing deposit.
export function migrateLegacyShiftAllocations(shifts: MedicalShift[], incomes: IncomeItem[], ledgers: ShiftIncomeAllocation[]) {
  const next = ledgers.map(ledger => ({ ...ledger, allocations: { ...ledger.allocations } }));
  for (const shift of shifts) {
    if (!shift.linkedIncomeId || next.some(ledger => ledger.allocations[shift.id] !== undefined)) continue;
    const income = incomes.find(item => item.id === shift.linkedIncomeId);
    if (!income || income.recipient !== shift.partner) continue;
    let ledger = next.find(item => item.id === income.id);
    if (!ledger) { ledger = { id: income.id, allocations: {} }; next.push(ledger); }
    const available = Math.max(0, cents(income.amount) - Object.values(ledger.allocations).reduce((sum, value) => sum + value, 0));
    const expected = cents(Math.min(shift.netAmount ?? shift.grossAmount, shift.grossAmount));
    const allocated = Math.min(available, expected);
    if (allocated > 0) ledger.allocations[shift.id] = allocated;
  }
  return next;
}
