import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Eye, EyeOff, LoaderCircle, Stethoscope, Target, Wallet, Leaf } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { JuntoLogo } from '../components/JuntoLogo';
import couplePhoto from '../assets/images/couple_planning_finances_1791083523726.jpg';

export const LandingScreen: React.FC = () => {
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, signInAsGuest } = useFinance();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runAuth = async (action: () => Promise<unknown>) => {
    setError(''); setLoading(true);
    try { await action(); }
    catch (cause: unknown) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
      setError(code.includes('invalid-credential') ? 'E-mail ou senha não conferem. Confira os dados e tente de novo.' : code.includes('email-already-in-use') ? 'Este e-mail já tem uma conta. Use a opção Entrar.' : code.includes('popup-closed') ? 'A janela do Google foi fechada. Você pode tentar novamente.' : 'Não foi possível acessar agora. Confira sua conexão e tente novamente.');
    } finally { setLoading(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void runAuth(() => mode === 'signup'
      ? signUpWithEmail(email.trim(), password, displayName.trim(), displayName.trim(), 'Aguardando Par...')
      : signInWithEmail(email.trim(), password));
  };
  const changeMode = () => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); };

  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <JuntoLogo size="sm" variant="horizontal" />
        <span className="welcome-tagline">A vida acontece. O plano é de vocês.</span>
        <button className="welcome-text-button" onClick={changeMode} disabled={loading}>
          {mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'} <ArrowUpRight size={16} />
        </button>
      </header>
      <main className="welcome-main">
        <section className="welcome-story" aria-labelledby="welcome-heading">
          <div className="welcome-eyebrow"><span /> FINANÇAS PARA A VIDA A DOIS</div>
          <h1 id="welcome-heading">Cuidar do agora.<br /><span>Construir o depois.</span></h1>
          <p className="welcome-intro">Entre as aulas, a rotina e os planos de vocês, o dinheiro também merece um lugar tranquilo.</p>
          <div className="welcome-photo">
            <img src={couplePhoto} alt="Casal conversando sobre seus planos em casa" fetchPriority="high" />
            <div className="welcome-photo-note"><Leaf size={18} /><span>Um passo de cada vez.<br /><strong>Na direção de vocês.</strong></span></div>
          </div>
          <div className="welcome-features">
            <div><Wallet size={19} /><strong>O mês, com clareza</strong><p>Entradas, gastos e escolhas em um só lugar.</p></div>
            <div><Target size={19} /><strong>Planos que se encontram</strong><p>Metas individuais e sonhos compartilhados.</p></div>
            <div><Stethoscope size={19} /><strong>Cada etapa da medicina</strong><p>Da faculdade à residência, no ritmo de cada um.</p></div>
          </div>
        </section>
        <section className="welcome-access" aria-labelledby="access-heading">
          <div className="welcome-access-card">
            <div className="welcome-access-symbol" aria-hidden="true">j.</div>
            <p className="welcome-eyebrow">SEU ESPAÇO JUNTÔ</p>
            <h2 id="access-heading">{mode === 'login' ? 'Que bom ter você aqui.' : 'Vamos começar?'}</h2>
            <p className="welcome-access-description">{mode === 'login' ? 'Entre para continuar cuidando dos seus planos.' : 'Comece com seu perfil. Depois, convide seu par.'}</p>
            <form onSubmit={submit} className="welcome-form" aria-busy={loading}>
              {mode === 'signup' && <div><label htmlFor="welcome-name">Como você quer ser chamado?</label><input id="welcome-name" name="name" autoComplete="given-name" value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={80} placeholder="Seu nome" disabled={loading} /></div>}
              <div><label htmlFor="welcome-email">E-mail</label><input id="welcome-email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@exemplo.com" disabled={loading} aria-describedby={error ? 'welcome-error' : undefined} /></div>
              <div><label htmlFor="welcome-password">Senha</label><div className="welcome-password"><input id="welcome-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={e => setPassword(e.target.value)} required placeholder={mode === 'signup' ? 'Pelo menos 6 caracteres' : 'Sua senha'} disabled={loading} aria-describedby={error ? 'welcome-error' : undefined} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
              {error && <p id="welcome-error" role="alert" className="welcome-error">{error}</p>}
              <button className="welcome-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle size={18} className="animate-spin" /> Aguarde um instante</> : <>{mode === 'login' ? 'Entrar no meu espaço' : 'Criar minha conta'}<ArrowRight size={18} /></>}</button>
            </form>
            <div className="welcome-divider"><span /> ou <span /></div>
            <button className="welcome-google" disabled={loading} onClick={() => void runAuth(signInWithGoogle)}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.1h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.3 2.6C7.1 7.7 9.4 5.9 12 5.9Z"/></svg> Continuar com o Google</button>
            <p className="welcome-mode">{mode === 'login' ? 'Ainda não tem conta?' : 'Já faz parte?'} <button onClick={changeMode} disabled={loading}>{mode === 'login' ? 'Começar por aqui' : 'Entrar'}</button></p>
          </div>
          <button className="welcome-preview" disabled={loading} onClick={() => void runAuth(async () => signInAsGuest())}>Conhecer o aplicativo <ArrowUpRight size={15} /></button>
          <p className="welcome-preview-note">Acesso local para explorar. Conexões bancárias exigem login.</p>
        </section>
      </main>
      <footer className="welcome-footer"><span>JUNTÔ · Um plano com espaço para dois.</span><span>Feito para acompanhar a vida real.</span></footer>
    </div>
  );
};
