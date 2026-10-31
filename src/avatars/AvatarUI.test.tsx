import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR, type AvatarConfig } from './avatarConfig';
const fake = vi.hoisted(() => ({
  mode: 'couple' as 'couple' | 'partner1' | 'partner2',
  editableRole: 'partner1' as 'partner1' | 'partner2',
  demoRecords: {} as Partial<
    Record<'partner1' | 'partner2', { ownerUid: string; revision: number; config: AvatarConfig }>
  >,
  records: {} as Partial<
    Record<'partner1' | 'partner2', { ownerUid: string; revision: number; config: AvatarConfig }>
  >,
  editorRole: null as null | 'partner1' | 'partner2',
  open: vi.fn(),
  close: vi.fn(),
  save: vi.fn(),
  Conflict: class extends Error {
    constructor(public currentAvatar: unknown) {
      super('Seu avatar mudou em outro dispositivo.');
    }
  },
}));
vi.mock('../context/FinanceContext', () => ({
  useFinance: () => ({
    viewMode: fake.mode,
    state: { profile: { partner1Name: 'Pessoa A', partner2Name: 'Pessoa B' } },
  }),
}));
vi.mock('./AvatarProvider', () => ({
  AvatarConflictError: fake.Conflict,
  useAvatars: () => ({
    records: fake.records,
    demoRecords: fake.demoRecords,
    localOnly: false,
    ready: true,
    error: '',
    editableRole: fake.editableRole,
    canEditRole: (role: string) => role === fake.editableRole,
    openEditor: fake.open,
    closeEditor: fake.close,
    save: fake.save,
    editorRole: fake.editorRole,
    editorInitialConfig: null,
  }),
}));
import { AvatarHero, AvatarSettings, AvatarEditorOutlet } from './AvatarUI';
beforeEach(() => {
  fake.mode = 'couple';
  fake.editableRole = 'partner1';
  fake.records = {};
  fake.demoRecords = {};
  fake.editorRole = null;
  fake.open.mockClear();
  fake.close.mockClear();
  fake.save.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('avatar identity in the dashboard', () => {
  it('shows two bodies in couple mode and opens the authenticated person, not always person one', () => {
    fake.editableRole = 'partner2';
    const { container } = render(<AvatarHero />);
    expect(container.querySelectorAll('svg.junto-avatar-art')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar meu avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner2');
  });
  it('shows only the selected person and labels the partner as read-only', () => {
    fake.mode = 'partner2';
    const { container } = render(<AvatarHero />);
    expect(container.querySelectorAll('svg.junto-avatar-art')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ver avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner2');
  });
  it('keeps own account personalization available without requiring a couple', () => {
    fake.mode = 'partner1';
    render(<AvatarHero />);
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar meu avatar' }));
    expect(fake.open).toHaveBeenCalledWith('partner1');
  });
});
describe('explicit demo adoption and conflict recovery', () => {
  it('previews a demo candidate only after confirmation, always for the authenticated person', () => {
    fake.editableRole = 'partner2';
    fake.demoRecords = {
      partner1: {
        ownerUid: 'partner1',
        revision: 0,
        config: { ...DEFAULT_AVATAR, skin: 'espresso' },
      },
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AvatarSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar opção 1 como minha' }));
    expect(fake.open).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar opção 1 como minha' }));
    expect(fake.open).toHaveBeenCalledWith('partner2', fake.demoRecords.partner1!.config);
    expect(fake.save).not.toHaveBeenCalled();
  });
  it('preserves a conflicting draft and retries against the current revision only after explicit authorization', async () => {
    fake.editorRole = 'partner1';
    fake.records = { partner1: { ownerUid: 'a', revision: 1, config: DEFAULT_AVATAR } };
    fake.save
      .mockRejectedValueOnce(
        new fake.Conflict({
          ownerUid: 'a',
          revision: 3,
          config: { ...DEFAULT_AVATAR, hair: 'long' },
        })
      )
      .mockResolvedValueOnce(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AvatarEditorOutlet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tom de pele: Café' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    expect(
      await screen.findByRole('region', { name: 'Resolver conflito do avatar' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar meu rascunho' }));
    expect(screen.getByRole('region', { name: 'Resolver conflito do avatar' })).toBeInTheDocument();
    expect(fake.save).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar meu rascunho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    await waitFor(() => expect(fake.save).toHaveBeenCalledTimes(2));
    expect(fake.save).toHaveBeenLastCalledWith(
      'partner1',
      { ...DEFAULT_AVATAR, skin: 'espresso' },
      3
    );
    expect(fake.close).toHaveBeenCalledOnce();
  });
  it('loads the saved version on request rather than silently overwriting the local draft', async () => {
    fake.editorRole = 'partner1';
    fake.records = { partner1: { ownerUid: 'a', revision: 1, config: DEFAULT_AVATAR } };
    fake.save.mockRejectedValueOnce(
      new fake.Conflict({
        ownerUid: 'a',
        revision: 4,
        config: { ...DEFAULT_AVATAR, hair: 'long', skin: 'espresso' },
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AvatarEditorOutlet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tom de pele: Porcelana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Carregar versão salva' }));
    expect(await screen.findByRole('button', { name: 'Tom de pele: Café' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
    expect(fake.save).toHaveBeenCalledTimes(1);
  });
});
