import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  mode: 'couple' as 'couple' | 'partner1' | 'partner2',
  editableRole: 'partner1' as 'partner1' | 'partner2',
  open: vi.fn(),
}));
vi.mock('../context/FinanceContext', () => ({
  useFinance: () => ({ viewMode: fake.mode, state: { profile: { partner1Name: 'Pessoa A', partner2Name: 'Pessoa B' } } }),
}));
vi.mock('./AvatarProvider', () => ({
  useAvatars: () => ({ records: {}, localOnly: false, editableRole: fake.editableRole, openEditor: fake.open }),
}));
import { AvatarHero } from './AvatarUI';
beforeEach(() => { fake.mode = 'couple'; fake.editableRole = 'partner1'; fake.open.mockClear(); });
describe('avatar identity in the dashboard', () => {
  it('shows two bodies in couple mode and opens the authenticated person, not always person one', () => {
    fake.editableRole = 'partner2';
    const { container } = render(<AvatarHero />);
    expect(container.querySelectorAll('svg.junto-avatar-art')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar meu avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner2');
  });
  it('shows only the selected person and labels a partner avatar as read-only', () => {
    fake.mode = 'partner2';
    const { container } = render(<AvatarHero />);
    expect(container.querySelectorAll('svg.junto-avatar-art')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ver avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner2');
  });
  it('keeps personalization available in your own individual view', () => {
    fake.mode = 'partner1';
    render(<AvatarHero />);
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar meu avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner1');
  });
});
