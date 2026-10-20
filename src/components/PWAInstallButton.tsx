import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, Check, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone app, do not show install prompt
  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4" />
          <span>App Instalado no Celular (PWA Ativo)</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      await install();
      setIsInstalling(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Browser fallback (e.g. desktop non-prompted or already triggered)
      setShowIOSGuide(true);
    }
  };

  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          title="Instalar aplicativo no celular ou computador"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] sm:text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Instalar App</span>
        </button>

        {showIOSGuide && <IOSInstallModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Instale o App no seu Celular
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold uppercase">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-xl">
                Receba notificações na tela de bloqueio com as revisões mensais do casal na primeira segunda-feira do mês e acerte tudo em 5 minutos.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isInstalling ? 'Instalando...' : 'Instalar Agora'}</span>
          </button>
        </div>

        {showIOSGuide && <IOSInstallModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
      </>
    );
  }

  // Settings variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
      >
        <Smartphone className="w-4 h-4" />
        <span>Instalar App no Dispositivo</span>
      </button>

      {showIOSGuide && <IOSInstallModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void; isIOS: boolean }> = ({ onClose, isIOS }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              📲
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Como instalar no {isIOS ? 'iPhone / iPad' : 'Celular'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instalação rápida em 2 toques
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <p className="pt-0.5">
              Toque no botão <strong className="text-slate-900 dark:text-white">Compartilhar</strong> (ícone de quadrado com seta para cima <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-blue-500" />) na barra inferior do Safari.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <p className="pt-0.5">
              Role a lista para baixo e toque em <strong className="text-slate-900 dark:text-white">"Adicionar à Tela de Início"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-emerald-500" />).
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <p className="pt-0.5">
              Toque em <strong className="text-slate-900 dark:text-white">"Adicionar"</strong> no canto superior direito. Pronto! O app abrirá em tela cheia com notificações de revisão mensal.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all active:scale-95"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
