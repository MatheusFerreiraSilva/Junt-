import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from './avatarConfig';

const fake = vi.hoisted(() => ({
  finance: {
    currentUser: null as null | { uid: string; isAnonymous: boolean },
    coupleAccount: null as null | { id: string },
  },
  listeners: [] as {
    next: (snap: { data: () => Record<string, unknown> }) => void;
    error: () => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }[],
  api: vi.fn(),
}));
vi.mock('../context/FinanceContext', () => ({ useFinance: () => fake.finance }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/authenticatedApi', () => ({ authenticatedApi: fake.api }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  onSnapshot: (
    _ref: unknown,
    next: (snap: { data: () => Record<string, unknown> }) => void,
    error: () => void
  ) => {
    const unsubscribe = vi.fn();
    fake.listeners.push({ next, error, unsubscribe });
    return unsubscribe;
  },
}));
import { AvatarProvider, DEMO_AVATAR_KEY, readDemoAvatars, useAvatars } from './AvatarProvider';

function Harness() {
  const avatars = useAvatars();
  return (
    <div>
      <span data-testid="one">{avatars.records.partner1?.config.hair || 'empty'}</span>
      <span data-testid="two">{avatars.records.partner2?.config.hair || 'empty'}</span>
      <span data-testid="role">{avatars.editableRole || 'none'}</span>
      <span data-testid="error">{avatars.error}</span>
      <button
        onClick={() =>
          void avatars
            .save(
              'partner1',
              { ...DEFAULT_AVATAR, hair: 'bald' },
              avatars.records.partner1?.revision || 0
            )
            .catch((e) => {
              failure = e.message;
            })
        }
      >
        Save one
      </button>
      <button
        onClick={() =>
          void avatars
            .save(
              'partner2',
              { ...DEFAULT_AVATAR, hair: 'long' },
              avatars.records.partner2?.revision || 0
            )
            .catch((e) => {
              failure = e.message;
            })
        }
      >
        Save two
      </button>
    </div>
  );
}
let failure = '';
const avatar = (ownerUid: string, hair = DEFAULT_AVATAR.hair, revision = 1) => ({
  ownerUid,
  revision,
  config: { ...DEFAULT_AVATAR, hair },
});
const remote = (data: Record<string, unknown>, index = fake.listeners.length - 1) =>
  act(() => {
    fake.listeners[index].next({ data: () => data });
  });
beforeEach(() => {
  fake.finance = { currentUser: null, coupleAccount: null };
  fake.listeners = [];
  fake.api.mockReset();
  localStorage.clear();
  failure = '';
});

describe('avatar session isolation and persistence', () => {
  it('keeps two demo choices separate and restores only valid local recipes', async () => {
    expect(readDemoAvatars('{broken')).toEqual({});
    expect(readDemoAvatars(JSON.stringify({ version: 3, partner1: DEFAULT_AVATAR }))).toEqual({});
    const view = render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    fireEvent.click(screen.getByText('Save one'));
    fireEvent.click(screen.getByText('Save two'));
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    expect(screen.getByTestId('two')).toHaveTextContent('long');
    expect(fake.api).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(DEMO_AVATAR_KEY)!).version).toBe(1);
    view.unmount();
    render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    expect(screen.getByTestId('two')).toHaveTextContent('long');
  });

  it('never copies a demo avatar into an authenticated couple and ignores old-session callbacks', () => {
    localStorage.setItem(
      DEMO_AVATAR_KEY,
      JSON.stringify({ version: 1, partner1: { ...DEFAULT_AVATAR, hair: 'bald' } })
    );
    const view = render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    expect(screen.getByTestId('one')).toHaveTextContent('bald');
    fake.finance = {
      currentUser: { uid: 'a', isAnonymous: false },
      coupleAccount: { id: 'couple-a' },
    };
    view.rerender(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
    remote({ partner1Uid: 'a', partner2Uid: 'b', avatarProfiles: { partner1: avatar('a') } });
    expect(screen.getByTestId('role')).toHaveTextContent('partner1');
    fake.finance = {
      currentUser: { uid: 'c', isAnonymous: false },
      coupleAccount: { id: 'couple-c' },
    };
    view.rerender(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    expect(fake.listeners[0].unsubscribe).toHaveBeenCalled();
    remote({ partner1Uid: 'a', avatarProfiles: { partner1: avatar('a') } }, 0);
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
  });

  it('uses UID membership, rejects mismatched recipes and refuses editing the partner', async () => {
    fake.finance = { currentUser: { uid: 'b', isAnonymous: false }, coupleAccount: { id: 'pair' } };
    render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    remote({
      partner1Uid: 'a',
      partner2Uid: 'b',
      avatarProfiles: { partner1: avatar('wrong'), partner2: avatar('b') },
    });
    expect(screen.getByTestId('one')).toHaveTextContent('empty');
    expect(screen.getByTestId('role')).toHaveTextContent('partner2');
    fireEvent.click(screen.getByText('Save one'));
    await waitFor(() => expect(failure).toMatch(/conta vinculada/));
    expect(fake.api).not.toHaveBeenCalled();
  });

  it('sends only avatar data and revision; a failed write preserves the saved recipe', async () => {
    fake.finance = { currentUser: { uid: 'a', isAnonymous: false }, coupleAccount: { id: 'pair' } };
    render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    remote({
      partner1Uid: 'a',
      partner2Uid: 'b',
      partner1Income: 9000,
      avatarProfiles: { partner1: avatar('a'), partner2: avatar('b') },
    });
    fake.api.mockRejectedValueOnce(new Error('Conflito de revisão'));
    fireEvent.click(screen.getByText('Save one'));
    await waitFor(() => expect(failure).toBe('Conflito de revisão'));
    expect(screen.getByTestId('one')).toHaveTextContent(DEFAULT_AVATAR.hair);
    expect(fake.api.mock.calls[0][1]).toEqual({
      config: { ...DEFAULT_AVATAR, hair: 'bald' },
      expectedRevision: 1,
      coupleId: 'pair',
    });
    fake.api.mockResolvedValueOnce({
      role: 'partner1',
      avatar: { ownerUid: 'a', revision: 2, config: { ...DEFAULT_AVATAR, hair: 'bald' } },
    });
    fireEvent.click(screen.getByText('Save one'));
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('bald'));
    expect(screen.getByTestId('two')).toHaveTextContent(DEFAULT_AVATAR.hair);
  });

  it('a denied avatar subscription does not crash the financial app or enable saving', () => {
    fake.finance = { currentUser: { uid: 'a', isAnonymous: false }, coupleAccount: { id: 'pair' } };
    render(
      <AvatarProvider>
        <Harness />
      </AvatarProvider>
    );
    act(() => fake.listeners[0].error());
    expect(screen.getByTestId('error')).toHaveTextContent('finanças continuam disponíveis');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });
  it('never replaces a newer remote revision with a delayed HTTP response', async () => {
    fake.finance = { currentUser: { uid: 'a', isAnonymous: false }, coupleAccount: { id: 'pair' } };
    render(<AvatarProvider><Harness /></AvatarProvider>);
    remote({ partner1Uid: 'a', partner2Uid: 'b', avatarProfiles: { partner1: avatar('a') } });
    let resolveSave: (value: unknown) => void = () => {};
    fake.api.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
    fireEvent.click(screen.getByText('Save one'));
    remote({ partner1Uid: 'a', partner2Uid: 'b', avatarProfiles: { partner1: { ownerUid: 'a', revision: 3, config: { ...DEFAULT_AVATAR, hair: 'long' } } } });
    await act(async () => { resolveSave({ role: 'partner1', avatar: { ownerUid: 'a', revision: 2, config: { ...DEFAULT_AVATAR, hair: 'bald' } } }); });
    expect(screen.getByTestId('one')).toHaveTextContent('long');
  });

});
