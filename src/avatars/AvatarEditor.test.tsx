import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarEditor } from './AvatarEditor';
import { DEFAULT_AVATAR } from './avatarConfig';

vi.mock('./Avatar', () => ({
  Avatar: ({ config, label }: { config: { skin: string }; label?: string }) => (
    <span aria-label={label} data-testid={label ? 'body-preview' : 'face-preview'}>
      {config.skin}
    </span>
  ),
}));

afterEach(cleanup);

describe('AvatarEditor draft lifecycle', () => {
  it('changes both previews without saving, supports undo/redo, and confirms discard', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
      <AvatarEditor initialConfig={DEFAULT_AVATAR} name="Ana" onSave={onSave} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tom de pele: Café' }));
    expect(screen.getByTestId('body-preview')).toHaveTextContent('espresso');
    expect(screen.getByTestId('face-preview')).toHaveTextContent('espresso');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByTestId('body-preview')).toHaveTextContent(DEFAULT_AVATAR.skin);
    fireEvent.click(screen.getByRole('button', { name: 'Refazer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(
      screen.queryByText('Descartar as alterações que ainda não foram salvas?')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar e voltar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('preserves choices after rejected save and permits retry', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('A versão mudou. Recarregue o perfil.'))
      .mockResolvedValueOnce(undefined);
    render(
      <AvatarEditor
        initialConfig={DEFAULT_AVATAR}
        name="Mateus"
        onSave={onSave}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tom de pele: Café' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A versão mudou.');
    expect(screen.getByTestId('body-preview')).toHaveTextContent('espresso');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith({ ...DEFAULT_AVATAR, skin: 'espresso' });
  });

  it('locks all editing controls and submits once while save is pending', async () => {
    let complete: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
    );
    render(
      <AvatarEditor
        initialConfig={DEFAULT_AVATAR}
        name="Bia"
        onSave={onSave}
        onCancel={() => {}}
        localOnly
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar neste aparelho' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Me surpreenda' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
    expect(onSave).toHaveBeenCalledOnce();
    complete();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Salvar neste aparelho' })).toBeEnabled()
    );
  });

  it('reports dirty/saving state to its shell without modifying supplied config', async () => {
    const input = { ...DEFAULT_AVATAR };
    const dirty = vi.fn();
    const saving = vi.fn();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <AvatarEditor
        initialConfig={input}
        name="Alex"
        onSave={save}
        onCancel={() => {}}
        onDirtyChange={dirty}
        onSavingChange={saving}
      />
    );
    expect(dirty).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Tom de pele: Café' }));
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(input).toEqual(DEFAULT_AVATAR);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meu avatar' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    await waitFor(() => expect(saving).toHaveBeenLastCalledWith(false));
    expect(saving).toHaveBeenCalledWith(true);
  });
});
