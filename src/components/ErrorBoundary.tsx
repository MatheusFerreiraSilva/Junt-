import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches unexpected render errors so a single broken screen never leaves the
 * whole PWA as a blank page. In production the error is logged to the console;
 * wire this to Sentry/GlitchTip later if desired.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[JUNTÔ] Unhandled render error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-[#F8F7F4] dark:bg-[#111317] flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-8 shadow-xl dark:border-rose-900/40 dark:bg-slate-900">
          <span className="text-4xl" aria-hidden="true">
            🌱
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50">
            Algo saiu do combinado
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Tivemos um imprevisto ao carregar esta parte do JUNTÔ. Seus dados
            continuam salvos — tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            Recarregar o app
          </button>
          {this.state.error?.message ? (
            <p className="mt-4 break-words text-xs text-slate-400 dark:text-slate-500">
              Detalhe técnico: {this.state.error.message}
            </p>
          ) : null}
        </section>
      </main>
    );
  }
}
