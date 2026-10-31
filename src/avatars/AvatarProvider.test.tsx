import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR, type AvatarConfig } from './avatarConfig';
const fake = vi.hoisted(() => ({
  finance: {
    currentUser: null as null | { uid: string; isAnonymous: boolean },
    coupleAccount: null as null | { id: string },
    userProfile: null as null | { partnerRole: string },
  },
  listeners: [] as {
    path: string;
    next: (snap: { data: () => unknown }) => void;
    error: () => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }[],
  api: vi.fn(),
  save: vi.fn(),
  migrate: vi.fn(),
}));
vi.mock('../context/FinanceContext', () => ({ useFinance: () => fake.finance }));
vi.mock('../lib/firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('../lib/authenticatedApi', async (original) => ({
  ...(await original<typeof import('../lib/authenticatedApi')>()),
  authenticatedApi: fake.api,
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  onSnapshot: (path: string, next: (snap: { data: () => unknown }) => void, error: () => void) => {
    const unsubscribe = vi.fn();
    fake.listeners.push({ path, next, error, unsubscribe });
    return unsubscribe;
  },
}));
import { ApiError } from '../lib/authenticatedApi';
import {
  AvatarProvider,
  AvatarConflictError,
  DEMO_AVATAR_KEY,
  readDemoAvatars,
  useAvatars,
} from './AvatarProvider';
let failure: unknown;
const avatar = (uid: string, hair: AvatarConfig['hair'] = DEFAULT_AVATAR.hair, revision = 1) => ({
  ownerUid: uid,
  revision,
  config: { ...DEFAULT_AVATAR, hair },
});
const latest = (path: string) => fake.listeners.filter((item) => item.path === path).at(-1)!;
const emit = (path: string, data: unknown) => act(() => latest(path).next({ data: () => data }));
const login = (uid = 'a', coupleId?: string, role = 'partner1') => {
  fake.finance = {
    currentUser: { uid, isAnonymous: false },
    coupleAccount: coupleId ? { id: coupleId } : null,
    userProfile: { partnerRole: role },
  };
};
function Harness() {
  const value = useAvatars();
  return (
    <div>
      <span data-testid="one">{value.records.partner1?.config.hair || 'empty'}</span>
      <span data-testid="two">{value.records.partner2?.config.hair || 'empty'}</span>
      <span data-testid="role">{value.editableRole || 'none'}</span>
      <span data-testid="error">{value.error}</span>
      <span data-testid="ready">{String(value.ready)}</span>
      <button onClick={value.retryMigration}>Retry migration</button>
      {(['partner1', 'partner2'] as const).map((role) => (
        <button
          key={role}
          onClick={() =>
            void value
              .save(
                role,
                { ...DEFAULT_AVATAR, hair: role === 'partner1' ? 'bald' : 'long' },
                value.records[role]?.revision || 0
              )
              .catch((error) => {
                failure = error;
              })
          }
        >
          Save {role}
        </button>
      ))}
    </div>
  );
}
const app = () => (
  <AvatarProvider>
    <Harness />
  </AvatarProvider>
);
beforeEach(() => {
  fake.finance = { currentUser: null, coupleAccount: null, userProfile: null };
  fake.listeners = [];
  fake.save.mockReset();
  fake.migrate.mockReset().mockResolvedValue({ avatar: null });
  fake.api.mockReset();
  fake.api.mockImplementation((path, body) =>
    path.endsWith('/migrate') ? fake.migrate() : fake.save(path, body)
  );
  localStorage.clear();
  failure = undefined;
});
describe('account avatar ownership, sessions and persistence', () => {
  it('keeps demo avatars separate and restores valid local recipes only', () => {
    expect(readDemoAvatars('{bad')).toEqual({});
    expect(readDemoAvatars(JSON.stringify({ version: 9, partner1: DEFAULT_AVATAR }))).toEqual({});
    const view = render(app());
    fireEvent.click(screen.getByText('Save partner1'));
    fireEvent.click(screen.getByText('Save partner2'));
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    expect(screen.getByTestId('two')).toHaveTextContent('long');
    expect(fake.api).not.toHaveBeenCalled();
    view.unmount();
    render(app());
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    expect(screen.getByTestId('two')).toHaveTextContent('long');
  });
  it('loads and saves a personal avatar without any couple', async () => {
    login();
    render(app());
    emit('avatars/a', avatar('a'));
    expect(screen.getByTestId('role')).toHaveTextContent('partner1');
    fake.save.mockResolvedValueOnce({ avatar: avatar('a', 'bald', 2) });
    fireEvent.click(screen.getByText('Save partner1'));
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('bald'));
    expect(fake.save.mock.calls[0]).toEqual([
      '/api/avatars/save',
      { config: { ...DEFAULT_AVATAR, hair: 'bald' }, expectedRevision: 1 },
    ]);
    expect(fake.listeners.map((item) => item.path)).toEqual(['avatars/a']);
  });
  it('does not assign demo avatars to an account automatically', () => {
    localStorage.setItem(
      DEMO_AVATAR_KEY,
      JSON.stringify({ version: 1, partner1: avatar('demo', 'bald').config })
    );
    const view = render(app());
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    login();
    view.rerender(app());
    emit('avatars/a', undefined);
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
    expect(fake.save).not.toHaveBeenCalled();
  });
  it('subscribes to the partner only after verified membership and removes them immediately on revocation', () => {
    login('b', 'pair', 'partner2');
    render(app());
    emit('avatars/b', avatar('b', 'long'));
    expect(fake.listeners.some((item) => item.path === 'avatars/a')).toBe(false);
    emit('couples/pair', { partner1Uid: 'a', partner2Uid: 'b', departedMembers: {} });
    emit('avatars/a', avatar('a', 'bald'));
    expect(screen.getByTestId('two')).toHaveTextContent('long');
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    const old = latest('avatars/a');
    emit('couples/pair', { partner1Uid: 'a', partner2Uid: 'b', departedMembers: { a: true } });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
    act(() => old.next({ data: () => avatar('a', 'crop', 2) }));
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
    expect(screen.getByTestId('two')).toHaveTextContent('long');
  });
  it('retains the same personal avatar after leaving and clears callbacks from the prior session', () => {
    login('b', 'pair', 'partner2');
    const view = render(app());
    emit('avatars/b', avatar('b', 'long'));
    emit('couples/pair', { partner1Uid: 'a', partner2Uid: 'b' });
    const previous = latest('avatars/b');
    login('b');
    view.rerender(app());
    emit('avatars/b', avatar('b', 'long'));
    expect(previous.unsubscribe).toHaveBeenCalled();
    expect(screen.getByTestId('one')).toHaveTextContent('long');
    expect(screen.getByTestId('two')).toHaveTextContent('empty');
    login('c');
    view.rerender(app());
    emit('avatars/c', undefined);
    act(() => previous.next({ data: () => avatar('b', 'bald', 99) }));
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
  });
  it('allows editing a partner when integrated as a couple', async () => {
    login('b', 'pair', 'partner2');
    render(app());
    emit('avatars/b', avatar('b'));
    emit('couples/pair', { partner1Uid: 'a', partner2Uid: 'b' });
    emit('avatars/a', avatar('a'));
    fake.save.mockResolvedValueOnce({ avatar: avatar('a', 'bald', 2) });
    fireEvent.click(screen.getByText('Save partner1'));
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('bald'));
    expect(fake.save).toHaveBeenCalledWith(
      '/api/avatars/save',
      expect.objectContaining({ targetUid: 'a' })
    );
  });
  it('preserves the saved record on failure and returns current conflict metadata', async () => {
    login();
    render(app());
    emit('avatars/a', avatar('a'));
    fake.save.mockRejectedValueOnce(new Error('Falha de rede'));
    fireEvent.click(screen.getByText('Save partner1'));
    await waitFor(() => expect(failure).toHaveProperty('message', 'Falha de rede'));
    expect(screen.getByTestId('one')).toHaveTextContent(DEFAULT_AVATAR.hair);
    fake.save.mockRejectedValueOnce(
      new ApiError(409, { error: 'Versão alterada', currentAvatar: avatar('a', 'long', 3) })
    );
    fireEvent.click(screen.getByText('Save partner1'));
    await waitFor(() => expect(failure).toBeInstanceOf(AvatarConflictError));
    expect((failure as AvatarConflictError).currentAvatar?.revision).toBe(3);
    expect(screen.getByTestId('one')).toHaveTextContent('long');
  });
  it('does not downgrade a newer snapshot to a delayed HTTP or legacy migration response', async () => {
    login();
    render(app());
    emit('avatars/a', avatar('a'));
    let resolve: (value: unknown) => void = () => {};
    fake.save.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    fireEvent.click(screen.getByText('Save partner1'));
    emit('avatars/a', avatar('a', 'long', 4));
    await act(async () => resolve({ avatar: avatar('a', 'bald', 2) }));
    expect(screen.getByTestId('one')).toHaveTextContent('long');
  });
  it('keeps account editing available after subscription error so retry does not discard a draft', async () => {
    login();
    render(app());
    act(() => latest('avatars/a').error());
    expect(screen.getByTestId('error')).toHaveTextContent('finanças continuam disponíveis');
    expect(screen.getByTestId('role')).toHaveTextContent('partner1');
    fake.save.mockResolvedValueOnce({ avatar: avatar('a', 'bald', 1) });
    fireEvent.click(screen.getByText('Save partner1'));
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('bald'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });
});

it('blocks default editing while a valid own legacy avatar is migrating and offers recovery after failure', async () => {
  login('a', 'pair');
  render(app());
  emit('avatars/a', undefined);
  fake.migrate.mockRejectedValueOnce(new Error('Network unavailable'));
  emit('couples/pair', {
    partner1Uid: 'a',
    partner2Uid: 'b',
    avatarProfiles: { partner1: avatar('a', 'long') },
  });
  expect(screen.getByTestId('ready')).toHaveTextContent('false');
  await waitFor(() =>
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Não foi possível recuperar seu avatar anterior'
    )
  );
  expect(screen.getByTestId('one')).toHaveTextContent('empty');
  fake.migrate.mockResolvedValueOnce({ avatar: avatar('a', 'long') });
  fireEvent.click(screen.getByText('Retry migration'));
  await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('long'));
  expect(screen.getByTestId('ready')).toHaveTextContent('true');
  expect(fake.save).not.toHaveBeenCalled();
});
it('does not migrate a legacy recipe over an existing personal avatar', () => {
  login('a', 'pair');
  render(app());
  emit('avatars/a', avatar('a', 'bald', 4));
  emit('couples/pair', {
    partner1Uid: 'a',
    partner2Uid: 'b',
    avatarProfiles: { partner1: avatar('a', 'long') },
  });
  expect(screen.getByTestId('one')).toHaveTextContent('bald');
  expect(fake.migrate).not.toHaveBeenCalled();
});
