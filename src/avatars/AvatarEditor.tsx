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
  { id: 'appearance', label: 'Silhueta & Pele', fields: ['gender', 'skin'] },
  { id: 'hair', label: 'Cabelo', fields: ['hair', 'hairColor'] },
  { id: 'face', label: 'Rosto', fields: ['eyes', 'eyeColor', 'mouth'] },
  { id: 'outfit', label: 'Trajes & Médicos', fields: ['outfit', 'outfitColor'] },
  { id: 'details', label: 'Acessórios', fields: ['accessory'] },
];

const LABELS: Record<Field, string> = {
  gender: 'Silhueta & Gênero',
  skin: 'Tom de pele',
  hair: 'Estilo de cabelo',
  hairColor: 'Cor do cabelo',
  eyes: 'Formato dos olhos',
  eyeColor: 'Cor dos olhos',
  mouth: 'Expressão',
  outfit: 'Traje (Scrub médico, Jaleco, etc.)',
  outfitColor: 'Cor do traje',
  accessory: 'Acessório (Estetoscópio, Fone, Mochila, etc.)',
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
      className="overflow-hidden rounded-3xl border border-stone-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-6 dark:border-slate-700">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-400">
            Ateliê do Juntô
          </p>
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Personalizar {name}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Combine silhuetas, trajes médicos e acessórios para expressar sua presença.
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

      <div className="grid min-w-0 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Studio Stage Showcase */}
        <div className="flex items-center justify-center gap-3 border-b border-stone-200 bg-gradient-to-b from-stone-50 via-stone-100/70 to-stone-200/50 px-4 py-4 lg:flex-col lg:gap-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-6 dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="relative flex w-32 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-b from-[#f5eee3] to-[#e4dacb] p-3 shadow-md lg:w-full lg:max-w-64 lg:rounded-[2.2rem] lg:px-5 lg:pb-3 lg:pt-5 dark:from-[#1b2622] dark:to-[#121a17]">
            <span
              aria-hidden="true"
              className="absolute right-3 top-3 hidden text-emerald-700 lg:block dark:text-emerald-300"
            >
              <Sparkles size={18} />
            </span>
            <Avatar
              config={draft}
              variant="body"
              size={220}
              className="w-32 lg:w-[220px]"
              label={`Prévia do avatar de ${name}`}
            />
          </div>

          <div className="min-w-0 space-y-3 w-full max-w-64">
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-stone-200/80 bg-white/90 px-3 py-2.5 sm:flex-row sm:items-center lg:gap-3 lg:px-4 dark:border-slate-700 dark:bg-slate-900/90 shadow-sm">
              <Avatar config={draft} variant="face" size={42} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Visual em miniatura
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Usado nas notificações e listas
                </p>
              </div>
            </div>
            <p className="hidden max-w-60 text-center text-xs leading-relaxed text-slate-600 lg:block dark:text-slate-400">
              {localOnly
                ? 'Modo de demonstração: seu rascunho fica preservado neste aparelho.'
                : 'Seu avatar acompanha sua conta e brilha no dashboard do casal.'}
            </p>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          <div
            className="mb-5 grid grid-cols-2 gap-1.5 sm:grid-cols-5"
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
                className={`${control} px-2 text-xs truncate ${group === item.id ? 'bg-slate-900 text-white shadow-sm dark:bg-stone-100 dark:text-slate-900' : 'bg-stone-100 text-slate-700 hover:bg-stone-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
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
