import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { ArrowUpRight, Palette, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from './avatarConfig';
import {
  AvatarConflictError,
  useAvatars,
  type AvatarRole,
  type AvatarRecord,
} from './AvatarProvider';

const AvatarEditor = lazy(() =>
  import('./AvatarEditor').then((m) => ({ default: m.AvatarEditor }))
);

export function MemberAvatar({
  member,
  size = 28,
  body = false,
}: {
  member: AvatarRole;
  size?: number;
  body?: boolean;
}) {
  const { records } = useAvatars();
  const { state } = useFinance();
  const name = member === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name;
  const config = records[member]?.config;
  if (config || body)
    return (
      <Avatar config={config || DEFAULT_AVATAR} variant={body ? 'body' : 'face'} size={size} />
    );
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join('') || '?';
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-stone-100 font-semibold text-stone-700 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.34) }}
    >
      {initials}
    </span>
  );
}

export function CoupleFaces({ size = 25 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center -space-x-1.5" aria-hidden="true">
      <MemberAvatar member="partner1" size={size} />
      <MemberAvatar member="partner2" size={size} />
    </span>
  );
}

export function AvatarHero() {
  const { state, viewMode } = useFinance();
  const { openEditor, editableRole, canEditRole, localOnly } = useAvatars();
  const roles: AvatarRole[] = viewMode === 'couple' ? ['partner1', 'partner2'] : [viewMode];
  const target = viewMode === 'couple' ? editableRole || 'partner1' : viewMode;
  const canPersonalize = localOnly || (canEditRole ? canEditRole(target) : target === editableRole);
  const otherRole: AvatarRole = target === 'partner1' ? 'partner2' : 'partner1';
  const partnerName = state.profile[(otherRole + 'Name') as 'partner1Name' | 'partner2Name'];

  return (
    <section
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border border-stone-200/90 bg-gradient-to-r from-stone-50 via-stone-100/90 to-amber-50/40 p-5 shadow-sm dark:border-slate-850 dark:from-slate-900 dark:via-slate-850 dark:to-emerald-950/20 sm:p-7"
      aria-label="Os rostos do seu Juntô"
    >
      <div className="min-w-0 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-accent-themed">
            {viewMode === 'couple' ? 'Palco do Casal' : 'Identidade Pessoal'}
          </p>
        </div>
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
          {viewMode === 'couple' ? 'Duas histórias. Um plano médico.' : 'Seu espaço, sua presença.'}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-sm hidden sm:block">
          {viewMode === 'couple'
            ? 'Personalizem seus trajes cirúrgicos, jalecos e detalhes da rotina de plantões.'
            : 'Seu avatar individual acompanha todas as suas conquistas financeiras.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openEditor(viewMode === 'couple' ? editableRole || 'partner1' : viewMode)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl text-left text-xs font-semibold text-slate-700 underline decoration-stone-300 underline-offset-4 hover:text-accent-themed focus-visible:outline focus-visible:outline-2 dark:text-slate-300"
          >
            {localOnly
              ? 'Experimentar nossos avatares'
              : canPersonalize
                ? 'Personalizar meu avatar'
                : 'Ver avatar'}{' '}
            <ArrowUpRight size={14} />
          </button>

          {viewMode === 'couple' && (canEditRole ? canEditRole(otherRole) : localOnly) && (
            <button
              type="button"
              onClick={() => openEditor(otherRole)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl text-left text-xs font-semibold text-slate-600 hover:text-accent-themed focus-visible:outline focus-visible:outline-2 dark:text-slate-400"
            >
              Editar {partnerName}
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Studio Stage with Pedestal and Overlap */}
      <div className="relative flex shrink-0 items-end justify-center rounded-2xl bg-gradient-to-b from-stone-200/40 via-stone-200/80 to-stone-300/60 p-2 pt-4 shadow-inner dark:from-slate-800/40 dark:via-slate-800/80 dark:to-slate-900/90 sm:px-4" aria-hidden="true">
        <div className="flex items-end -space-x-5 sm:-space-x-3">
          {roles.map((role) => (
            <div key={role} className="w-[68px] sm:w-[104px] transition-transform duration-300 hover:scale-105">
              <MemberAvatar member={role} body size={104} />
              <span className="sr-only">
                {state.profile[(role + 'Name') as 'partner1Name' | 'partner2Name']}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AvatarSettings() {
  const { state } = useFinance();
  const {
    localOnly,
    editableRole,
    canEditRole,
    ready,
    error,
    openEditor,
    records,
    demoRecords,
    migrationPending,
    migrationError,
    retryMigration,
  } = useAvatars();
  return (
    <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-themed">
          Um toque de vocês
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
          Rostos que contam histórias
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Silhuetas, jalecos, scrubs e acessórios. Cada conta personaliza seu boneco individual e,
          quando vinculados como casal, ambos podem visualizar e editar os dois avatares.
        </p>
      </div>
      {localOnly && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Modo de demonstração: vocês podem experimentar os dois avatares. As escolhas ficam salvas
          neste aparelho como rascunho até que entrem em uma conta.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
      {migrationPending && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          Recuperando seu avatar anterior para sua conta…
        </p>
      )}
      {migrationError && (
        <button
          type="button"
          onClick={retryMigration}
          className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm text-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          Tentar recuperar avatar anterior
        </button>
      )}
      {!localOnly && editableRole && Object.keys(demoRecords).length > 0 && (
        <section
          aria-label="Escolhas da demonstração"
          className="space-y-3 rounded-2xl border border-stone-200 p-4 dark:border-slate-700"
        >
          <h4 className="font-semibold text-slate-900 dark:text-white">
            Gostou de um avatar da demonstração?
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha um para revisar como seu avatar pessoal. Nada será atribuído ao seu par ou salvo
            sem sua confirmação.
          </p>
          <div className="flex flex-wrap gap-4">
            {(['partner1', 'partner2'] as const).map(
              (demoRole, index) =>
                demoRecords[demoRole] && (
                  <div key={demoRole} className="flex flex-col items-center gap-2">
                    <Avatar
                      config={demoRecords[demoRole]!.config}
                      variant="face"
                      size={64}
                      label={`Prévia da demonstração ${index + 1}`}
                    />
                    <button
                      type="button"
                      disabled={!ready}
                      className="min-h-11 rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:text-slate-100"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Revisar este avatar como seu? Ele não será atribuído ao seu par nem salvo até você confirmar no editor.'
                          )
                        )
                          openEditor(editableRole, demoRecords[demoRole]!.config);
                      }}
                    >
                      Revisar opção {index + 1} como minha
                    </button>
                  </div>
                )
            )}
          </div>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(['partner1', 'partner2'] as const).map((role) => {
          const name =
            role === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name;
          const canEdit = localOnly || (canEditRole ? canEditRole(role) : editableRole === role);
          return (
            <div
              key={role}
              className="flex flex-col items-center rounded-3xl border border-stone-200 bg-gradient-to-b from-stone-50 via-white to-stone-100/60 p-5 dark:border-slate-700 dark:from-slate-850 dark:via-slate-900 dark:to-slate-950 shadow-sm"
            >
              <MemberAvatar member={role} body size={164} />
              <h4 className="mt-3 max-w-full break-words text-center text-base font-bold text-slate-900 dark:text-white">
                {name}
              </h4>
              <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
                {records[role]
                  ? localOnly
                    ? 'Salvo neste aparelho'
                    : editableRole === role
                      ? 'Avatar da sua conta'
                      : 'Avatar do casal (editável por ambos)'
                  : 'Uma página em branco para sua imaginação'}
              </p>
              <button
                type="button"
                disabled={!ready}
                onClick={() => openEditor(role)}
                className="btn-primary-accent mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                <Palette size={16} />
                {canEdit ? 'Personalizar' : 'Ver avatar'}
              </button>
            </div>
          );
        })}
      </div>
      {!localOnly && !editableRole && ready && !error && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Seu avatar pertence à sua conta, mesmo sem um casal vinculado. Aguarde o carregamento do
          perfil para personalizar.
        </p>
      )}
    </section>
  );
}

class EditorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="p-6 text-slate-800 dark:text-slate-200">
        <p>Não foi possível abrir o editor. Suas finanças não foram alteradas.</p>
        <button type="button" onClick={this.props.onClose} className="mt-4 min-h-11 underline">
          Voltar ao aplicativo
        </button>
      </div>
    );
  }
}

function EditorDialog({ role }: { role: AvatarRole }) {
  const { state } = useFinance();
  const { records, localOnly, editableRole, canEditRole, save, closeEditor, editorInitialConfig } = useAvatars();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Freeze the editing base: a remote update must cause a conflict, not erase a draft.
  const [base] = useState(() => records[role]);
  const [initialConfig, setInitialConfig] = useState(
    () => editorInitialConfig || base?.config || DEFAULT_AVATAR
  );
  const [revision, setRevision] = useState(base?.revision || 0);
  const [resetKey, setResetKey] = useState(0);
  const [conflict, setConflict] = useState<AvatarRecord | null | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const canEdit = localOnly || (canEditRole ? canEditRole(role) : editableRole === role);
  const close = () => {
    if (saving) return;
    if (!dirty || window.confirm('Descartar as alterações deste avatar?')) closeEditor();
  };
  const focusRef = useDialogFocus(true, close);
  const name = role === 'partner1' ? state.profile.partner1Name : state.profile.partner2Name;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-2 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={focusRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-dialog-title"
        tabIndex={-1}
        className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-3xl bg-stone-50 shadow-2xl dark:bg-slate-950"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-950">
          <h2
            id="avatar-dialog-title"
            className="truncate text-sm font-bold text-slate-900 dark:text-white"
          >
            O avatar de {name}
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={close}
            aria-label="Fechar editor de avatar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 disabled:opacity-50 dark:text-white dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>
        {canEdit && conflict !== undefined && (
          <section
            aria-label="Resolver conflito do avatar"
            className="m-4 space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
          >
            <h3 className="font-bold">Seu avatar mudou em outro dispositivo</h3>
            <p className="text-sm">Seu rascunho continua preservado. Escolha qual versão usar.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-amber-500 px-3 py-2 text-sm"
                onClick={() => {
                  if (
                    dirty &&
                    !window.confirm('Descartar o rascunho e carregar a versão salva da sua conta?')
                  )
                    return;
                  setInitialConfig(conflict?.config || DEFAULT_AVATAR);
                  setRevision(conflict?.revision || 0);
                  setConflict(undefined);
                  setNotice('Versão da conta carregada.');
                  setResetKey((value) => value + 1);
                }}
              >
                Carregar versão salva
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-amber-500 px-3 py-2 text-sm"
                onClick={() => {
                  if (
                    !window.confirm(
                      'Autorizar substituir a versão salva com seu rascunho na próxima tentativa de salvar?'
                    )
                  )
                    return;
                  setRevision(conflict?.revision || 0);
                  setConflict(undefined);
                  setNotice(
                    'Rascunho preservado. Clique em Salvar meu avatar para enviar a versão que você escolheu.'
                  );
                }}
              >
                Autorizar meu rascunho
              </button>
            </div>
          </section>
        )}
        {notice && (
          <p role="status" className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
            {notice}
          </p>
        )}
        {canEdit ? (
          <EditorBoundary onClose={closeEditor}>
            <Suspense
              fallback={
                <p role="status" className="p-8 text-slate-700 dark:text-slate-200">
                  Preparando seu ateliê…
                </p>
              }
            >
              <AvatarEditor
                key={resetKey}
                initialConfig={initialConfig}
                name={name}
                localOnly={localOnly}
                onDirtyChange={setDirty}
                onSavingChange={setSaving}
                onCancel={closeEditor}
                onSave={async (config) => {
                  try {
                    await save(role, config, revision);
                    closeEditor();
                  } catch (cause) {
                    if (cause instanceof AvatarConflictError) setConflict(cause.currentAvatar);
                    throw cause;
                  }
                }}
              />
            </Suspense>
          </EditorBoundary>
        ) : (
          <div className="flex flex-col items-center p-8">
            <MemberAvatar member={role} body size={220} />
            <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-300">
              Para personalizar, entre na conta vinculada a {name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AvatarEditorOutlet() {
  const { editorRole } = useAvatars();
  return editorRole ? <EditorDialog key={editorRole} role={editorRole} /> : null;
}
