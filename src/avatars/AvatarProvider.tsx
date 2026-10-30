import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFinance } from '../context/FinanceContext';
import { db } from '../lib/firebase';
import { authenticatedApi } from '../lib/authenticatedApi';
import { isAvatarConfig, normalizeAvatar, type AvatarConfig } from './avatarConfig';

export type AvatarRole = 'partner1' | 'partner2';
export interface AvatarRecord {
  ownerUid: string;
  revision: number;
  config: AvatarConfig;
}
type Records = Partial<Record<AvatarRole, AvatarRecord>>;
interface AvatarContextValue {
  records: Records;
  localOnly: boolean;
  ready: boolean;
  error: string;
  editableRole: AvatarRole | null;
  editorRole: AvatarRole | null;
  openEditor: (role: AvatarRole) => void;
  closeEditor: () => void;
  save: (role: AvatarRole, config: AvatarConfig, expectedRevision: number) => Promise<void>;
}
const AvatarContext = createContext<AvatarContextValue | null>(null);
export const DEMO_AVATAR_KEY = 'junto-demo-avatars-v1';

export function readDemoAvatars(value: string | null): Records {
  try {
    const data = JSON.parse(value || '{}');
    if (data.version !== 1) return {};
    return Object.fromEntries(
      (['partner1', 'partner2'] as const).flatMap((role) =>
        isAvatarConfig(data[role])
          ? [[role, { ownerUid: role, revision: 0, config: normalizeAvatar(data[role]) }]]
          : []
      )
    );
  } catch {
    return {};
  }
}

function AvatarSession({
  children,
  uid,
  coupleId,
  localOnly,
}: {
  children: ReactNode;
  uid: string;
  coupleId: string;
  localOnly: boolean;
}) {
  const [records, setRecords] = useState<Records>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [editableRole, setEditableRole] = useState<AvatarRole | null>(null);
  const [editorRole, setEditorRole] = useState<AvatarRole | null>(null);
  const alive = useRef(true);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  useEffect(() => {
    alive.current = true;
    if (localOnly) {
      try {
        setRecords(readDemoAvatars(localStorage.getItem(DEMO_AVATAR_KEY)));
      } catch {
        setError(
          'O armazenamento deste aparelho não está disponível. Você ainda pode experimentar o editor.'
        );
      }
      setReady(true);
      return () => {
        alive.current = false;
      };
    }
    if (!coupleId) {
      setReady(true);
      return () => {
        alive.current = false;
      };
    }
    const unsubscribe = onSnapshot(
      doc(db, 'couples', coupleId),
      (snap) => {
        if (!alive.current) return;
        const data = snap.data();
        const role =
          data?.partner1Uid === uid ? 'partner1' : data?.partner2Uid === uid ? 'partner2' : null;
        if (!role || data?.departedMembers?.[uid]) {
          setRecords({});
          setEditableRole(null);
          setError('Seu vínculo precisa ser confirmado para personalizar o avatar.');
          setReady(true);
          return;
        }
        const next: Records = {};
        for (const member of ['partner1', 'partner2'] as const) {
          const record = data?.avatarProfiles?.[member];
          if (
            record &&
            record.ownerUid === data?.[member + 'Uid'] &&
            Number.isInteger(record.revision) &&
            record.revision > 0 &&
            isAvatarConfig(record.config)
          ) {
            next[member] = {
              ownerUid: record.ownerUid,
              revision: record.revision,
              config: normalizeAvatar(record.config),
            };
          }
        }
        setRecords(next);
        setEditableRole(role);
        setReady(true);
        setError('');
      },
      () => {
        if (!alive.current) return;
        setError(
          'Não foi possível carregar os avatares da nuvem. Suas finanças continuam disponíveis.'
        );
        setEditableRole(null);
        setRecords({});
        setReady(true);
      }
    );
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, [coupleId, uid, localOnly]);

  const value: AvatarContextValue = {
    records,
    ready,
    error,
    localOnly,
    editableRole,
    editorRole,
    openEditor: (role) => setEditorRole(role),
    closeEditor: () => setEditorRole(null),
    save: async (role, config, expectedRevision) => {
      if (!isAvatarConfig(config)) throw new Error('Escolha opções válidas para o avatar.');
      if (localOnly) {
        const next = {
          ...recordsRef.current,
          [role]: { ownerUid: role, revision: expectedRevision + 1, config },
        };
        const stored = {
          version: 1,
          partner1: next.partner1?.config,
          partner2: next.partner2?.config,
        };
        try {
          localStorage.setItem(DEMO_AVATAR_KEY, JSON.stringify(stored));
        } catch {
          throw new Error('Não foi possível salvar neste aparelho. Seu rascunho foi preservado.');
        }
        if (alive.current) {
          recordsRef.current = next;
          setRecords(next);
        }
        return;
      }
      if (!ready || role !== editableRole || !coupleId)
        throw new Error('Entre na conta vinculada a esta pessoa para salvar seu avatar.');
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20000);
      try {
        const result = await authenticatedApi<{ avatar: AvatarRecord; role: AvatarRole }>(
          '/api/couples/avatar',
          { config, expectedRevision, coupleId },
          controller.signal
        );
        if (!alive.current) throw new Error('A sessão mudou. Abra seu perfil novamente.');
        if (
          result.role !== role ||
          result.avatar?.ownerUid !== uid ||
          !Number.isSafeInteger(result.avatar?.revision) || result.avatar.revision < 1 ||
          !isAvatarConfig(result.avatar.config)
        ) {
          throw new Error('Não foi possível confirmar o perfil salvo.');
        }
        setRecords((prev) => (prev[role]?.revision || 0) > result.avatar.revision ? prev : ({ ...prev, [role]: result.avatar }));
      } catch (e) {
        if (controller.signal.aborted)
          throw new Error(
            'A confirmação demorou. Confira se o avatar chegou e tente novamente; seu rascunho foi preservado.'
          );
        throw e;
      } finally {
        window.clearTimeout(timer);
      }
    },
  };
  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { currentUser, coupleAccount } = useFinance();
  const localOnly = !currentUser || currentUser.isAnonymous;
  const uid = currentUser?.uid || 'demo';
  const coupleId = coupleAccount?.id || '';
  return (
    <AvatarSession
      key={uid + ':' + coupleId + ':' + localOnly}
      uid={uid}
      coupleId={coupleId}
      localOnly={localOnly}
    >
      {children}
    </AvatarSession>
  );
}
export function useAvatars() {
  const value = useContext(AvatarContext);
  if (!value) throw new Error('AvatarProvider ausente.');
  return value;
}
