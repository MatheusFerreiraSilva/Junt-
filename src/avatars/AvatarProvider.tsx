import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFinance } from '../context/FinanceContext';
import { db } from '../lib/firebase';
import { ApiError, authenticatedApi } from '../lib/authenticatedApi';
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
  demoRecords: Records;
  localOnly: boolean;
  ready: boolean;
  error: string;
  migrationError: string;
  migrationPending: boolean;
  retryMigration: () => void;
  editableRole: AvatarRole | null;
  editorRole: AvatarRole | null;
  editorInitialConfig: AvatarConfig | null;
  openEditor: (role: AvatarRole, initialConfig?: AvatarConfig) => void;
  closeEditor: () => void;
  save: (role: AvatarRole, config: AvatarConfig, expectedRevision: number) => Promise<void>;
}
const AvatarContext = createContext<AvatarContextValue | null>(null);
export const DEMO_AVATAR_KEY = 'junto-demo-avatars-v1';

export class AvatarConflictError extends Error {
  constructor(public readonly currentAvatar: AvatarRecord | null) {
    super(
      'Seu avatar mudou em outro dispositivo. Você pode carregar a versão salva ou manter seu rascunho e autorizar uma nova tentativa.'
    );
    this.name = 'AvatarConflictError';
  }
}
function avatarRecord(input: unknown, uid: string): AvatarRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as AvatarRecord;
  return value.ownerUid === uid &&
    Number.isSafeInteger(value.revision) &&
    value.revision > 0 &&
    isAvatarConfig(value.config)
    ? { ownerUid: uid, revision: value.revision, config: normalizeAvatar(value.config) }
    : null;
}
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
function loadDemo(): Records {
  try {
    return readDemoAvatars(localStorage.getItem(DEMO_AVATAR_KEY));
  } catch {
    return {};
  }
}

function AvatarSession({
  children,
  uid,
  coupleId,
  localOnly,
  initialRole,
}: {
  children: ReactNode;
  uid: string;
  coupleId: string;
  localOnly: boolean;
  initialRole: AvatarRole;
}) {
  const [demoRecords, setDemoRecords] = useState<Records>(loadDemo);
  const demoRef = useRef(demoRecords);
  demoRef.current = demoRecords;
  const [own, setOwn] = useState<AvatarRecord | null>(null);
  const ownRef = useRef<AvatarRecord | null>(null);
  const retryMigrationRef = useRef<(() => void) | undefined>(undefined);
  const [migrationPending, setMigrationPending] = useState(false);
  const [migrationError, setMigrationError] = useState('');
  const [partner, setPartner] = useState<{ role: AvatarRole; record: AvatarRecord } | null>(null);
  const [ownRole, setOwnRole] = useState<AvatarRole>(initialRole);
  const [ownReady, setOwnReady] = useState(localOnly);
  const [coupleReady, setCoupleReady] = useState(!coupleId);
  const [ownError, setOwnError] = useState('');
  const [coupleError, setCoupleError] = useState('');
  const [editorRole, setEditorRole] = useState<AvatarRole | null>(null);
  const [editorInitialConfig, setEditorInitialConfig] = useState<AvatarConfig | null>(null);
  const alive = useRef(true);
  const roleRef = useRef(ownRole);
  roleRef.current = ownRole;

  const acceptOwn = useCallback((record: AvatarRecord | null) => {
    setOwn((previous) => {
      const next = (previous?.revision || 0) > (record?.revision || 0) ? previous : record;
      ownRef.current = next;
      return next;
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    if (localOnly) {
      setOwnReady(true);
      setCoupleReady(true);
      return () => {
        alive.current = false;
      };
    }
    let partnerUid = '';
    let partnerGeneration = 0;
    let stopPartner: (() => void) | undefined;
    let migrated = false;
    let migrationBusy = false;
    const migrateOwnLegacy = async () => {
      if (migrationBusy || !alive.current) return;
      migrationBusy = true;
      setMigrationPending(true);
      setMigrationError('');
      try {
        const result = await authenticatedApi<{ avatar: AvatarRecord | null }>(
          '/api/avatars/migrate'
        );
        if (!alive.current) return;
        const migratedRecord = avatarRecord(result.avatar, uid);
        if (migratedRecord) acceptOwn(migratedRecord);
        else if (!ownRef.current) throw new Error('Legacy avatar not confirmed');
        setMigrationError('');
      } catch {
        if (alive.current && !ownRef.current)
          setMigrationError(
            'Não foi possível recuperar seu avatar anterior. Ele não foi apagado. Tente recuperar novamente antes de editar.'
          );
      } finally {
        migrationBusy = false;
        if (alive.current) setMigrationPending(false);
      }
    };

    const clearPartner = () => {
      partnerUid = '';
      partnerGeneration++;
      stopPartner?.();
      stopPartner = undefined;
      setPartner(null);
    };
    const stopOwn = onSnapshot(
      doc(db, 'avatars', uid),
      (snap) => {
        if (!alive.current) return;
        const record = avatarRecord(snap.data(), uid);
        acceptOwn(record);
        if (record) {
          setMigrationError('');
          setMigrationPending(false);
        }
        setOwnReady(true);
        setOwnError('');
      },
      () => {
        if (!alive.current) return;
        setOwnError(
          'Não foi possível carregar seu avatar da conta. Suas finanças continuam disponíveis; tente abrir o perfil novamente.'
        );
        setOwnReady(true);
      }
    );
    const stopCouple = coupleId
      ? onSnapshot(
          doc(db, 'couples', coupleId),
          (snap) => {
            if (!alive.current) return;
            const data = snap.data();
            const role =
              data?.partner1Uid === uid
                ? 'partner1'
                : data?.partner2Uid === uid
                  ? 'partner2'
                  : null;
            setCoupleReady(true);
            if (!role || data?.departedMembers?.[uid]) {
              clearPartner();
              setOwnRole('partner1');
              setCoupleError(
                'O vínculo do casal não está ativo. Seu avatar pessoal continua na sua conta.'
              );
              return;
            }
            setOwnRole(role);
            setCoupleError('');
            const legacy = avatarRecord(data?.avatarProfiles?.[role], uid);
            if (!migrated && legacy && !ownRef.current) {
              migrated = true;
              retryMigrationRef.current = () => {
                void migrateOwnLegacy();
              };
              void migrateOwnLegacy();
            }
            const otherRole = role === 'partner1' ? 'partner2' : 'partner1';
            const nextUid = data?.[otherRole + 'Uid'];
            const validOther =
              typeof nextUid === 'string' &&
              nextUid !== uid &&
              nextUid.length > 0 &&
              !data?.departedMembers?.[nextUid];
            if (!validOther) {
              clearPartner();
              return;
            }
            if (nextUid === partnerUid) return;
            clearPartner();
            partnerUid = nextUid;
            const generation = partnerGeneration;
            stopPartner = onSnapshot(
              doc(db, 'avatars', nextUid),
              (otherSnap) => {
                if (!alive.current || generation !== partnerGeneration || partnerUid !== nextUid)
                  return;
                const record = avatarRecord(otherSnap.data(), nextUid);
                setPartner(record ? { role: otherRole, record } : null);
              },
              () => {
                if (!alive.current || generation !== partnerGeneration) return;
                setPartner(null);
                setCoupleError(
                  'Não foi possível carregar o avatar do seu par. Seu avatar e suas finanças continuam disponíveis.'
                );
              }
            );
          },
          () => {
            if (!alive.current) return;
            clearPartner();
            setOwnRole('partner1');
            setCoupleReady(true);
            setCoupleError(
              'Não foi possível confirmar o vínculo do casal. Seu avatar pessoal continua disponível.'
            );
          }
        )
      : undefined;
    return () => {
      alive.current = false;
      retryMigrationRef.current = undefined;
      stopOwn();
      stopCouple?.();
      partnerGeneration++;
      stopPartner?.();
    };
  }, [coupleId, uid, localOnly, acceptOwn]);

  const records: Records = localOnly
    ? demoRecords
    : {
        ...(partner ? { [partner.role]: partner.record } : {}),
        ...(own ? { [ownRole]: own } : {}),
      };
  const ready = localOnly || (ownReady && coupleReady && !migrationPending && !migrationError);
  const editableRole = !localOnly && ownReady ? ownRole : null;
  const value: AvatarContextValue = {
    records,
    demoRecords,
    migrationPending,
    migrationError,
    retryMigration: () => retryMigrationRef.current?.(),
    localOnly,
    ready,
    editableRole,
    error: migrationError || ownError || coupleError,
    editorRole,
    editorInitialConfig,
    openEditor: (role, initialConfig) => {
      if (!ready) return;
      setEditorInitialConfig(
        initialConfig && (localOnly || role === editableRole)
          ? normalizeAvatar(initialConfig)
          : null
      );
      setEditorRole(role);
    },
    closeEditor: () => {
      setEditorRole(null);
      setEditorInitialConfig(null);
    },
    save: async (role, config, expectedRevision) => {
      if (!isAvatarConfig(config)) throw new Error('Escolha opções válidas para o avatar.');
      if (localOnly) {
        const next = {
          ...demoRef.current,
          [role]: { ownerUid: role, revision: expectedRevision + 1, config },
        };
        try {
          localStorage.setItem(
            DEMO_AVATAR_KEY,
            JSON.stringify({
              version: 1,
              partner1: next.partner1?.config,
              partner2: next.partner2?.config,
            })
          );
        } catch {
          throw new Error('Não foi possível salvar neste aparelho. Seu rascunho foi preservado.');
        }
        if (alive.current) {
          demoRef.current = next;
          setDemoRecords(next);
        }
        return;
      }
      if (!ready || role !== roleRef.current)
        throw new Error('Entre na própria conta para salvar seu avatar.');
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20000);
      try {
        const result = await authenticatedApi<{ avatar: AvatarRecord }>(
          '/api/avatars/save',
          { config, expectedRevision },
          controller.signal
        );
        if (!alive.current) throw new Error('A sessão mudou. Abra seu perfil novamente.');
        const record = avatarRecord(result.avatar, uid);
        if (!record) throw new Error('Não foi possível confirmar o avatar salvo.');
        acceptOwn(record);
        setOwnError('');
      } catch (cause) {
        if (!alive.current) throw new Error('A sessão mudou. Abra seu perfil novamente.');
        if (
          cause instanceof ApiError &&
          cause.status === 409 &&
          cause.details &&
          typeof cause.details === 'object' &&
          'currentAvatar' in cause.details
        ) {
          const current = avatarRecord(cause.details.currentAvatar, uid);
          if (current) acceptOwn(current);
          throw new AvatarConflictError(current);
        }
        if (controller.signal.aborted)
          throw new Error(
            'A confirmação demorou. Confira seu avatar e tente novamente; seu rascunho foi preservado.'
          );
        throw cause;
      } finally {
        window.clearTimeout(timer);
      }
    },
  };
  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { currentUser, coupleAccount, userProfile } = useFinance();
  const localOnly = !currentUser || currentUser.isAnonymous;
  const uid = currentUser?.uid || 'demo';
  const coupleId = coupleAccount?.id || '';
  const role: AvatarRole =
    coupleId && userProfile?.partnerRole === 'partner2' ? 'partner2' : 'partner1';
  return (
    <AvatarSession
      key={uid + ':' + coupleId + ':' + localOnly}
      uid={uid}
      coupleId={coupleId}
      initialRole={role}
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
