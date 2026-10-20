import React, { useState } from 'react';
import { X, Cloud, Users, Key, Mail, Lock, User, Check, Sparkles, LogOut, Copy, RefreshCw, Smartphone, Laptop } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAIOnboardingModal?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenAIOnboardingModal }) => {
  const {
    currentUser,
    userProfile,
    coupleAccount,
    isCloudSynced,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    joinCoupleWithInviteCode,
    signOutUser,
  } = useFinance();

  const [mode, setMode] = useState<'login' | 'signup' | 'join'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login com o Google.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!email || !password || !displayName) {
          setErrorMsg('Por favor, preencha e-mail, senha e seu nome.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, displayName, displayName, 'Aguardando Par...');
      } else if (mode === 'login') {
        if (!email || !password) {
          setErrorMsg('Por favor, digite seu e-mail e senha.');
          setLoading(false);
          return;
        }
        await signInWithEmail(email, password);
      } else if (mode === 'join') {
        if (!inviteCodeInput) {
          setErrorMsg('Digite o Código do Casal de 6 dígitos.');
          setLoading(false);
          return;
        }
        await joinCoupleWithInviteCode(inviteCodeInput.trim().toUpperCase());
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (coupleAccount?.inviteCode) {
      navigator.clipboard.writeText(coupleAccount.inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold shadow-2xs">
              ☁️
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-display">
                Conta do Casal & Sincronização em Nuvem
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acesse o mesmo aplicativo e dados no PC, celular e no celular do seu amor!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {currentUser ? (
            /* SIGNED IN VIEW */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm">Sincronizado na Nuvem Firebase ✅</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Conectado como <strong>{currentUser.email}</strong> ({userProfile?.displayName || 'Usuário'}).
                  Qualquer lançamento feito neste aparelho aparece instantaneamente nos outros aparelhos conectados do casal!
                </p>
              </div>

              {/* Couple Invite Code Box */}
              {coupleAccount && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                        Código do Casal (Para Conectar Outro Celular)
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-display tracking-widest block my-0.5">
                        {coupleAccount.inviteCode}
                      </span>
                    </div>

                    <button
                      onClick={handleCopyInviteCode}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-bold transition-all"
                    >
                      {copiedInvite ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedInvite ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                    💡 Instale o app no celular do seu par ou entre no computador, crie a conta dele(a) e digite este código de 6 dígitos para sincronizarem em tempo real.
                  </p>
                </div>
              )}

              {/* Device Icons Display */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-around text-xs text-slate-600 dark:text-slate-300 font-bold">
                <div className="flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-emerald-500" />
                  <span>Computador</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Seu Celular</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Celular do Par</span>
                </div>
              </div>

              {/* AI Setup Action */}
              {onOpenAIOnboardingModal && (
                <button
                  type="button"
                  onClick={onOpenAIOnboardingModal}
                  className="w-full btn-primary-accent flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Calibrar Divisões do Casal com IA</span>
                </button>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={signOutUser}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          ) : (
            /* NOT SIGNED IN VIEW — FORM */
            <form onSubmit={handleAuth} className="space-y-4">
              {/* Mode Selector Tabs */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Criar Conta Casal
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Já Tenho Conta
                </button>
                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    mode === 'join'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Conectar Código
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Seu Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Matheus"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                    required
                  />
                </div>
              )}

              {mode !== 'join' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {mode === 'join' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Digite o Código de 6 Dígitos do Casal
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Ex: AB12CD"
                    value={inviteCodeInput}
                    onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border text-center font-black text-xl tracking-widest font-display text-emerald-600 dark:text-emerald-400 uppercase"
                    required
                  />
                  <p className="text-[11px] text-slate-400 text-center">
                    Peça o código de 6 dígitos que aparece na tela do celular do seu par.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary-accent py-3 rounded-2xl text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                <span>
                  {mode === 'signup'
                    ? 'Criar Conta & Sincronizar Nuvem'
                    : mode === 'login'
                    ? 'Entrar e Carregar Dados'
                    : 'Conectar Celular com o Código'}
                </span>
              </button>

              {mode !== 'join' && (
                <>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">ou</span>
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-extrabold text-xs shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M23.49 12.275c0-.825-.075-1.62-.21-2.385H12v4.515h6.45c-.277 1.485-1.11 2.745-2.355 3.585v2.985h3.81c2.228-2.055 3.585-5.085 3.585-8.7z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.955-1.08 7.935-2.91l-3.81-2.985c-1.058.705-2.415 1.125-4.125 1.125-3.18 0-5.865-2.145-6.825-5.025H1.23v3.09C3.21 21.09 7.32 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.175 14.205c-.24-.72-.375-1.485-.375-2.205s.135-1.485.375-2.205V6.705H1.23C.435 8.355 0 10.155 0 12s.435 3.645 1.23 5.295l3.945-3.09z"
                      />
                      <path
                        fill="#4285F4"
                        d="M12 4.75c1.77 0 3.345.61 4.59 1.8l3.435-3.435C17.94 1.185 15.225 0 12 0 7.32 0 3.21 2.91 1.23 6.705l3.945 3.09c.96-2.88 3.645-5.04 6.825-5.04z"
                      />
                    </svg>
                    <span>Entrar rápido com o Google</span>
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
