import React, { useState } from 'react';
import { Mail, Lock, User, Cloud, Shield, Bell, ArrowRight, CheckCircle2, RefreshCw, Smartphone, Laptop, Sparkles, Building, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { JuntoLogo } from '../components/JuntoLogo';

export const LandingScreen: React.FC = () => {
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInAsGuest,
    triggerCelebration,
  } = useFinance();

  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      triggerCelebration();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!email || !password || !displayName) {
          setErrorMsg('Por favor, preencha todos os campos do cadastro.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, displayName, displayName, 'Aguardando Par...');
        triggerCelebration();
      } else {
        if (!email || !password) {
          setErrorMsg('Por favor, digite seu e-mail e senha para entrar.');
          setLoading(false);
          return;
        }
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login/cadastro. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-emerald-100 selection:text-emerald-950">
      {/* Header Bar (Top Bar Contract: 1 row, 3 zones) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Zone 1: Brand title/logo */}
          <div className="flex items-center gap-3">
            <JuntoLogo size="sm" variant="horizontal" />
          </div>

          {/* Zone 2: Navigation link / Muted tagline */}
          <span className="hidden md:inline text-xs font-bold text-slate-400 dark:text-slate-500">
            A gente está junto, a gente está forte. 💕
          </span>

          {/* Zone 3: CTA actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => signInAsGuest()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>🚀</span>
              <span>Entrar Direto no App</span>
            </button>
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer hidden sm:inline-block"
            >
              {mode === 'login' ? 'Criar Conta' : 'Acessar Conta'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Value Proposition & Hero Image (7 cols) */}
        <section className="lg:col-span-7 space-y-6 sm:space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Controle Financeiro Autônomo e de Casal</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white font-display tracking-tight leading-none text-wrap-balance">
              Suas Finanças Individuais e o Espaço do Casal em um só lugar.
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Crie seu cadastro individual hoje para acompanhar suas receitas, cofrinhos e despesas. Quando estiver pronto, faça a fusão de orçamentos compartilhando um simples código de 6 dígitos!
            </p>
          </div>

          {/* Premium Generated Photo Slot with modern frame */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-850 group aspect-[16/9] max-w-3xl">
            <img
              src="/src/assets/images/couple_planning_finances_1791083523726.jpg"
              alt="Casal analisando o planejamento financeiro com tranquilidade"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-700"
            />
            {/* Soft gradient mesh overlay for high contrast editorial visual */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-5 sm:p-7 text-white">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                Segurança e Privacidade do Casal
              </span>
              <h2 className="font-extrabold text-sm sm:text-lg tracking-tight mt-1">
                Visualização unificada ou individual com um simples toque.
              </h2>
            </div>
          </div>

          {/* Benefits Grid (2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs flex gap-3">
              <span className="text-xl shrink-0">👥</span>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Cadastro Solo com Fusão</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-normal">
                  Crie sua conta sozinho. Depois, mescle seus orçamentos para habilitar a visão consolidada do Casal.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs flex gap-3">
              <span className="text-xl shrink-0">🏦</span>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Meu Pluggy (Open Finance)</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-normal">
                  Sincronização reativa diária automática das contas individuais de cada CPF e da conta conjunta do casal.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Unified Auth Card Panel (5 cols) */}
        <section className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-display">
                {mode === 'signup' ? 'Comece Seu Cadastro Grátis' : 'Acesse Seu Painel Seguro'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'signup' 
                  ? 'Crie seu perfil e planeje suas metas e orçamentos' 
                  : 'Digite seus dados para sincronizar na nuvem'}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Seu Nome Completo</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ex: Matheus Henrique"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-3 h-11 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Seu E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 h-11 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sua Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha secreta"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 h-11 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl btn-primary-accent text-white font-extrabold text-xs shadow-md shadow-black/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4 text-emerald-300" />
                )}
                <span>
                  {mode === 'signup' ? 'Cadastrar e Ativar Painel 🚀' : 'Entrar no Painel Seguro ☁️'}
                </span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800/80"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">ou</span>
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800/80"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-extrabold text-xs shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

              {/* Direct Desktop / Demo Access Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => signInAsGuest()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 border-2 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-black text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-sm"
                >
                  <span>🚀</span>
                  <span>Acessar o Painel Completo no Desktop Agora</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1.5">
                  Nenhum cadastro obrigatório para visualizar e usar todas as telas no Desktop.
                </p>
              </div>
            </form>

            <div className="relative border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
              <button
                onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer"
              >
                {mode === 'signup' 
                  ? 'Já possui uma conta ativa? Acesse aqui' 
                  : 'Não tem login ainda? Cadastre-se em 5 segundos'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-6 text-center text-[11px] text-slate-400 dark:text-slate-500 mt-12 shrink-0">
        <p>
          JUNTÔ — Finanças do Casal · Desenvolvido com amor para a cumplicidade e tranquilidade do casal. 🌟
        </p>
      </footer>
    </div>
  );
};
