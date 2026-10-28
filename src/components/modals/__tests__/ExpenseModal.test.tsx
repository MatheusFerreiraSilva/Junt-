import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseModal } from '../ExpenseModal';

const actions = vi.hoisted(() => ({ addExpense: vi.fn(), addInstallment: vi.fn(), triggerCelebration: vi.fn() }));
vi.mock('../../../context/FinanceContext', () => ({
  CATEGORIES_BASE: { comida: { key: 'comida', name: 'Alimentação', emoji: '🍽️', colorHex: '#123456' } },
  useFinance: () => ({ state: { profile: { partner1Name: 'Ana', partner2Name: 'Bia', partner1Income: 1000, partner2Income: 1000 }, piggyBanks: [], currentMonth: '2026-10' }, emergencyReserveExcessAmount: 0, ...actions }),
}));

function reachPayment() {
  fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '100.01' } });
  for (let index = 0; index < 4; index++) fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
}

describe('expense registration', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });
  it('records an ordinary expense exactly once without an installment', () => {
    render(<ExpenseModal isOpen onClose={() => {}} defaultDate="2026-10-27" />);
    reachPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir Gasto' }));
    expect(actions.addExpense).toHaveBeenCalledOnce();
    expect(actions.addExpense).toHaveBeenCalledWith(expect.objectContaining({ amount: 100.01, date: '2026-10-27', category: 'comida' }));
    expect(actions.addInstallment).not.toHaveBeenCalled();
  });
  it('records a purchase as installments without charging its full value again', () => {
    render(<ExpenseModal isOpen onClose={() => {}} />);
    reachPayment();
    fireEvent.click(screen.getByText('Sim, parcelado'));
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir Gasto' }));
    expect(actions.addInstallment).toHaveBeenCalledOnce();
    expect(actions.addInstallment).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 100.01, installmentsCount: 3 }));
    expect(actions.addExpense).not.toHaveBeenCalled();
  });
});
