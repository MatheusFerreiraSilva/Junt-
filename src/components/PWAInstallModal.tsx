import React from 'react';
import { X, Smartphone, Download, Share, PlusSquare, Check, Sparkles, Bell } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold shadow-2xs">
              📲
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-display">
                Instalar no Celular (PWA)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Notificações na tela de bloqueio e acesso com 1 toque
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Benefits Callout */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-extrabold text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Por que instalar como aplicativo?</span>
            </div>
            <ul className="space-y-1.5 text-emerald-800 dark:text-emerald-300/90 text-[11px] leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span><strong>Notificações como WhatsApp:</strong> Lembretes da revisão mensal na primeira segunda-feira do mês às 20h.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span><strong>Acesso direto:</strong> Ícone bonito do casal na tela inicial sem barras de navegador.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span><strong>Offline & Rápido:</strong> Carregamento instantâneo mesmo sem internet.</span>
              </li>
            </ul>
          </div>

          {/* Android / Desktop Chrome 1-Click Install Flow */}
          {isInstallable && (
            <div className="space-y-3">
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Seu navegador é compatível com a instalação direta em 1 toque:
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full btn-primary-accent flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-extrabold text-sm shadow-md active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Aplicativo Agora</span>
              </button>
            </div>
          )}

          {/* iOS Safari Guided Steps */}
          {isIOS && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                <Smartphone className="w-4 h-4 text-sky-500" />
                <span>Como instalar no iPhone / iPad (iOS):</span>
              </div>
              <ol className="space-y-2 text-slate-600 dark:text-slate-300 text-xs">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    1
                  </span>
                  <span>
                    Abra este link no <strong>Safari</strong> e toque no botão <strong>Compartilhar</strong> (<Share className="inline w-3.5 h-3.5 mx-0.5 text-sky-500" /> na barra inferior).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    2
                  </span>
                  <span>
                    Role para baixo e toque em <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="inline w-3.5 h-3.5 mx-0.5 text-emerald-500" />).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    3
                  </span>
                  <span>
                    Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! O app aparecerá junto com seus outros aplicativos.
                  </span>
                </li>
              </ol>
            </div>
          )}

          {/* Already installed feedback */}
          {isInstalled && (
            <div className="p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold">
                O aplicativo já está instalado e funcionando no modo PWA standalone!
              </span>
            </div>
          )}

          {/* Android Manual instructions fallback */}
          {!isInstallable && !isIOS && !isInstalled && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                No Chrome / Edge (Android e PC):
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Toque nos <strong>3 pontinhos (Menu)</strong> do navegador e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
