import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, randomAvatar, type AvatarConfig } from './avatarConfig';

export interface AvatarEditorProps {
  initialConfig: AvatarConfig;
  name: string;
  onSave: (config: AvatarConfig) => Promise<void>;
  onCancel: () => void;
  localOnly?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}

type Field = Exclude<keyof AvatarConfig, 'version'>;
type Group = 'appearance' | 'hair' | 'face' | 'outfit' | 'details';
type History = { past: AvatarConfig[]; present: AvatarConfig; future: AvatarConfig[] };

const GROUPS: { id: Group; label: string; fields: Field[] }[] = [
  { id: 'appearance', label: 'Aparência', fields: ['skin'] },
  { id: 'hair', label: 'Cabelo', fields: ['hair', 'hairColor'] },
  { id: 'face', label: 'Rosto', fields: ['eyes', 'eyeColor', 'mouth'] },
  { id: 'outfit', label: 'Roupa', fields: ['outfit', 'outfitColor'] },
  { id: 'details', label: 'Detalhes', fields: ['accessory'] },
];

const LABELS: Record<Field, string> = {
  skin: 'Tom de pele',
  hair: 'Estilo de cabelo',
  hairColor: 'Cor do cabelo',
  eyes: 'Formato dos olhos',
  eyeColor: 'Cor dos olhos',
  mouth: 'Expressão',
  outfit: 'Estilo de roupa',
  outfitColor: 'Cor da roupa',
  accessory: 'Acessórios',
};

const equal = (a: AvatarConfig, b: AvatarConfig) => JSON.stringify(a) === JSON.stringify(b);
const control =
  'min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40';

/** Owns a draft only. Financial state and authenticated persistence stay outside the editor. */
export function AvatarEditor({
  initialConfig,
  name,
  onSave,
  onCancel,
  localOnly = false,
  onDirtyChange,
  onSavingChange,
}: AvatarEditorProps) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: { ...initialConfig },
    future: [],
  }));
  const [group, setGroup] = useState<Group>('appearance');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const draft = history.present;
  const dirty = !equal(draft, initialConfig);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const change = (next: AvatarConfig) => {
    if (saving) return;
    setHistory((current) =>
      equal(current.present, next)
        ? current
        : {
            past: [...current.past, current.present].slice(-30),
            present: next,
            future: [],
          }
    );
    setError('');
    setConfirmDiscard(false);
  };

  const undo = () =>
    setHistory((current) =>
      current.past.length
        ? {
            past: current.past.slice(0, -1),
            present: current.past[current.past.length - 1],
            future: [current.present, ...current.future],
          }
        : current
    );

  const redo = () =>
    setHistory((current) =>
      current.future.length
        ? {
            past: [...current.past, current.present].slice(-30),
            present: current.future[0],
            future: current.future.slice(1),
          }
        : current
    );

  const cancel = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onCancel();
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave({ ...draft });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não conseguimos salvar agora. Suas escolhas continuam aqui para tentar novamente.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const currentGroup = GROUPS.find((item) => item.id === group)!;

  return (
    <section
      aria-label={`Personalizar avatar de ${name}`}
      aria-busy={saving}
      className="overflow-hidden rounded-3xl border border-stone-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-6 dark:border-slate-700">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-300">
            Do seu jeito
          </p>
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Um pouco de {name}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Misture as opções. Todas estão disponíveis para você.
          </p>
        </div>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className={`${control} inline-flex items-center gap-2 text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Voltar
        </button>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex items-center justify-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 lg:flex-col lg:gap-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="relative flex w-28 shrink-0 items-center justify-center rounded-2xl bg-[#eee6da] px-1 lg:w-full lg:max-w-60 lg:rounded-[2rem] lg:px-5 lg:pt-4 dark:bg-[#26342f]">
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 hidden text-emerald-800 lg:right-5 lg:top-5 lg:block dark:text-emerald-300"
            >
              <Sparkles size={19} />
            </span>
            <Avatar
              config={draft}
              variant="body"
              size={216}
              className="w-28 lg:w-[216px]"
              label={`Prévia do avatar de ${name}`}
            />
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center lg:gap-3 lg:px-4 dark:border-slate-700 dark:bg-slate-900">
              <Avatar config={draft} variant="face" size={44} />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Seu rostinho no app
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  A mesma pessoa, em cada cantinho.
                </p>
              </div>
            </div>
            <p className="hidden max-w-60 text-center text-xs leading-relaxed text-slate-600 lg:block dark:text-slate-400">
              {localOnly
                ? 'Modo de demonstração: suas escolhas ficam neste aparelho.'
                : 'O avatar acompanha seu perfil. Você muda o seu; seu par muda o dele.'}
            </p>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          <div
            className="mb-5 grid grid-cols-3 gap-1.5 sm:grid-cols-5"
            role="group"
            aria-label="Grupos de personalização"
          >
            {GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={group === item.id}
                disabled={saving}
                onClick={() => setGroup(item.id)}
                className={`${control} px-2 text-xs ${group === item.id ? 'bg-slate-900 text-white dark:bg-stone-100 dark:text-slate-900' : 'bg-stone-100 text-slate-700 hover:bg-stone-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="min-h-52 space-y-6">
            {currentGroup.fields.map((field) => (
              <fieldset key={field} disabled={saving}>
                <legend className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                  {LABELS[field]}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS[field].map((option) => {
                    const color =
                      'value' in option && typeof option.value === 'string'
                        ? option.value
                        : undefined;
                    const selected = draft[field] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-label={`${LABELS[field]}: ${option.label}`}
                        aria-pressed={selected}
                        title={option.label}
                        onClick={() => change({ ...draft, [field]: option.id })}
                        className={`${control} inline-flex items-center justify-center gap-2 border ${color ? 'min-w-11 px-2' : 'px-3'} ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-700 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-400' : 'border-stone-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-400'}`}
                      >
                        {color && (
                          <span
                            aria-hidden="true"
                            className="h-6 w-6 rounded-full border border-black/20"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        {!color && <span>{option.label}</span>}
                        {selected && <Check size={14} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={undo}
              disabled={saving || !history.past.length}
              className={`${control} inline-flex items-center gap-1 text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Desfazer
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={saving || !history.future.length}
              className={`${control} inline-flex items-center gap-1 text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              Refazer <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => change(randomAvatar())}
              disabled={saving}
              className={`${control} inline-flex items-center gap-2 text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <Shuffle size={16} aria-hidden="true" /> Me surpreenda
            </button>
            <button
              type="button"
              onClick={() => change({ ...DEFAULT_AVATAR })}
              disabled={saving}
              className={`${control} inline-flex items-center gap-2 text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <RotateCcw size={15} aria-hidden="true" /> Recomeçar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-200 p-4 sm:px-6 dark:border-slate-700">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {error}
          </p>
        )}
        {confirmDiscard && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
          >
            <p className="flex-1">Descartar as alterações que ainda não foram salvas?</p>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className={`${control} border border-amber-300 dark:border-amber-700`}
            >
              Continuar editando
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${control} underline underline-offset-4`}
            >
              Descartar e voltar
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-xs text-slate-600 dark:text-slate-400"
            role="status"
            aria-live="polite"
          >
            {saving
              ? 'Salvando suas escolhas…'
              : dirty
                ? 'Prévia com alterações ainda não salvas.'
                : 'A prévia só será aplicada quando você salvar.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className={`${control} border border-stone-300 text-slate-700 dark:border-slate-600 dark:text-slate-200`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={`${control} btn-primary-accent inline-flex items-center gap-2 text-white`}
            >
              <Check size={16} aria-hidden="true" />{' '}
              {saving ? 'Salvando…' : localOnly ? 'Salvar neste aparelho' : 'Salvar meu avatar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
