import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { authenticatedApi } from '../lib/authenticatedApi';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { formatCurrency } from '../utils/formatters';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface GeminiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiChatDrawer: React.FC<GeminiChatDrawerProps> = ({ isOpen, onClose }) => {
  const {
    state,
    totalIncome,
    totalSpentThisMonth,
    remainingToSpendThisMonth,
    isOverBudget,
    installmentCommitmentPercentage,
    totalSavedInPiggyBanks,
    highestBlownCategory,
  } = useFinance();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Oi! Posso ajudar a entender o mês e pensar nos próximos planos. Vou usar apenas os dados registrados no Juntô. As respostas são sugestões: nenhuma conversa altera seu dinheiro ou seus lançamentos.',
      timestamp: 'Agora',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const quickPrompts = [
    'Quanto precisamos guardar para as provas de residência?',
    'Vale a pena quitar parcelas agora?',
    'Como podemos guardar mais para viagens e descanso?',
    'Como planejar uma mudança sem comprometer a reserva?',
  ];

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const data = await authenticatedApi<{ reply: string }>('/api/gemini/chat', {
          messages: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          context: {
            partner1Name: state.profile.partner1Name,
            partner1Specialty: state.profile.partner1Specialty,
            partner2Name: state.profile.partner2Name,
            partner2Specialty: state.profile.partner2Specialty,
            city: state.profile.city,
            partner1CareerStage: state.profile.partner1Career?.stage || 'não informada',
            partner2CareerStage: state.profile.partner2Career?.stage || 'não informada',
            totalIncomeFormatted: formatCurrency(totalIncome),
            totalSpentFormatted: formatCurrency(totalSpentThisMonth),
            remainingFormatted: formatCurrency(remainingToSpendThisMonth),
            isOver: isOverBudget,
            highestBlownName: highestBlownCategory?.name || 'Nenhuma',
            installmentCommitmentPct: installmentCommitmentPercentage,
            savedTotalFormatted: formatCurrency(totalSavedInPiggyBanks),
          },
        }, AbortSignal.timeout(30000));

      const botMessage: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'model',
        text: data.reply || 'Sem resposta no momento.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: unknown) {
      setMessages(prev => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          role: 'model',
          text: `Desculpe, tive uma oscilação momentânea: ${err instanceof Error ? err.message : 'Não foi possível obter uma resposta'}. Continuem firmes nas metas do casal!`,
          timestamp: 'Agora',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Assistente Juntô" tabIndex={-1} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Drawer Window - Use h-[100dvh] on mobile to pin header to the top and prevent keyboard scrolling issues */}
      <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-2xl border-none sm:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[100dvh] sm:h-[88vh] sm:m-4 transition-all">
        {/* Fixed Header Bar with High-Visibility Close Button */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center text-xl font-bold shadow-xs shrink-0">
              ✨
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                  Assistente Juntô
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                  Planejamento
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Assistente inteligente do casal
              </p>
            </div>
          </div>

          {/* Actions: Model Switcher & Prominent Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">


            {/* Desktop & Mobile Top Close Button (Prominent touch target, never disappears) */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-2xs"
              aria-label="Fechar conselheiro"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Messages Thread (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <span className="w-8 h-8 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-2xs">
                  ✨
                </span>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed space-y-1.5 shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[9px] text-right mt-1 font-semibold ${
                    msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center text-xs text-slate-500 dark:text-slate-400 p-2">
              <span className="w-8 h-8 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center text-sm shrink-0 animate-pulse">
                ✨
              </span>
              <span className="animate-pulse font-medium">Assistente Juntô está analisando os dados do casal...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <p className="px-5 py-2 text-[10px] leading-relaxed text-slate-500 border-t border-slate-100 dark:border-slate-800">Ao enviar, sua mensagem e um resumo financeiro são processados pelo Gemini, serviço externo de IA. Evite dados de pacientes e informações clínicas.</p>
        {/* Quick prompt suggestions */}
        <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-950/70 border-t border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar flex items-center gap-2">
          {quickPrompts.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold whitespace-nowrap hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors shrink-0 shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0 pb-safe">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte ao Assistente Juntô..."
            className="flex-1 px-4 py-2.5 sm:py-3 text-xs sm:text-sm rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-all shadow-xs active:scale-95"
            aria-label="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
