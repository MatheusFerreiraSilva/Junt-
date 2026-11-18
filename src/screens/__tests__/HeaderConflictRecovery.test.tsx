import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  user: { uid: 'test-user', isAnonymous: false, displayName: 'Ana' },
  listener: undefined as undefined | ((snap: unknown) => void),
  result: { status: 'success', message: 'ok', writtenKeys: ['partner1Name'] },
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ auth: { currentUser: fake.user }, db: {} }));
vi.mock('firebase/auth', async original => ({ ...await original<typeof import('firebase/auth')>(), onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => { cb(fake.user); return () => {}; } }));
vi.mock('firebase/firestore', async original => ({ ...await original<typeof import('firebase/firestore')>(),
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  getDoc: async () => ({ exists: () => true, data: () => ({ uid: 'test-user', coupleId: 'couple', partnerRole: 'partner1' }) }),
  onSnapshot: (_ref: unknown, _options: unknown, callback: (snap: unknown) => void) => { fake.listener = callback; return () => {}; },
}));
vi.mock('../../lib/entitySync', async original => ({ ...await original<typeof import('../../lib/entitySync')>(),
  migrateEntities: async () => {}, subscribeEntities: (_db: unknown, _id: string, cb: (data: object, confirmed: boolean) => void) => { cb({}, true); return () => {}; }, saveEntities: async () => ({ completed: true, savedCount: 0, totalCount: 0 }),
}));
vi.mock('../../lib/coupleSnapshot', async original => ({ ...await original<typeof import('../../lib/coupleSnapshot')>(), commitCoupleHeaderPatchTransaction: vi.fn(async () => fake.result) }));
vi.mock('../../lib/firebasePreferences', () => ({ firebasePreferenceStore: { subscribe: () => () => {}, save: async () => {} } }));
import { FinanceProvider, useFinance } from '../../context/FinanceContext';

function Harness() {
  const { state, patchCoupleProfile, headerConflicts, resolveHeaderConflict } = useFinance();
  return <>
    <span data-testid="name">{state.profile.partner1Name}</span>
    <span data-testid="conflict">{headerConflicts.partner1Name ? 'pending' : 'none'}</span>
    <span data-testid="draft">{String(headerConflicts.partner1Name?.local ?? '')}</span>
    <button onClick={() => patchCoupleProfile({ partner1Name: 'Local' })}>edit</button>
    <button onClick={() => void resolveHeaderConflict('partner1Name', 'local')}>local</button>
    <button onClick={() => void resolveHeaderConflict('partner1Name', 'remote')}>remote</button>
  </>;
}
function emit(name: string) {
  act(() => fake.listener?.({ exists: () => true, data: () => ({ id: 'couple', partner1Uid: 'test-user', partner1Name: name, partner2Name: 'Bruno' }), metadata: { hasPendingWrites: false, fromCache: false } }));
}
async function conflict() {
  render(<FinanceProvider><Harness /></FinanceProvider>);
  await waitFor(() => expect(fake.listener).toBeDefined());
  emit('Original');
  await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Original'));
  fireEvent.click(screen.getByText('edit'));
  emit('Remoto');
  await waitFor(() => expect(screen.getByTestId('conflict')).toHaveTextContent('pending'));
}
afterEach(() => { cleanup(); localStorage.clear(); fake.listener = undefined; fake.result = { status: 'success', message: 'ok', writtenKeys: ['partner1Name'] }; });
describe('resolução de conflitos do cabeçalho', () => {
  it('preserva o rascunho até a confirmação e mantém conflito após falha transacional', async () => {
    await conflict();
    expect(screen.getByTestId('draft')).toHaveTextContent('Local');
    fake.result = { status: 'failure', message: 'falhou', writtenKeys: [] };
    fireEvent.click(screen.getByText('local'));
    await waitFor(() => expect(screen.getByTestId('conflict')).toHaveTextContent('pending'));
    expect(screen.getByTestId('draft')).toHaveTextContent('Local');
    fake.result = { status: 'success', message: 'ok', writtenKeys: ['partner1Name'] };
    fireEvent.click(screen.getByText('local'));
    await waitFor(() => expect(screen.getByTestId('conflict')).toHaveTextContent('none'));
    expect(screen.getByTestId('name')).toHaveTextContent('Local');
  });
  it('descarta o rascunho após a escolha explícita do valor remoto', async () => {
    await conflict();
    fireEvent.click(screen.getByText('remote'));
    await waitFor(() => expect(screen.getByTestId('conflict')).toHaveTextContent('none'));
    expect(screen.getByTestId('name')).toHaveTextContent('Remoto');
  });
});
