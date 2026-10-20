import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  X,
  Sparkles,
  ChevronLeft,
  Bot,
  User,
  Zap,
  BrainCircuit,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
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
      text: `Oi, ${state.profile.partner1Name} e ${state.profile.partner2Name}! Sou a inteligência do **Junto**, o parceiro e conselheiro de vocês.

Olhei como está o mês do casal em ${state.profile.city || 'nossa cidade'}:
• Entradas juntos: **${formatCurrency(totalIncome)}/mês**
• Quanto ainda podemos gastar sem preocupação: **${formatCurrency(Math.max(0, remainingToSpendThisMonth))}**
• Cartão e parcelas do mês: **${installmentCommitmentPercentage}%** da renda (o ideal é manter abaixo de 15%!)
• Dinheiro guardado nos cofrinhos: **${formatCurrency(totalSavedInPiggyBanks)}**

Estamos juntos para cuidar do descanso, plantões, viagens e futuro de vocês com muita leveza. Do que vocês gostariam de falar hoje?`,
      timestamp: 'Agora',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
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

  if (!isOpen) return null;

  const quickPrompts = [
    'Como equilibrar os plantões e a renda que varia?',
    'Vale a pena quitar parcelas agora?',
    'Como podemos guardar mais para viagens e descanso?',
    'Como fazer o dinheiro dos cofrinhos trabalhar sozinho?',
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
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          model: selectedModel,
          context: {
            partner1Name: state.profile.partner1Name,
            partner1Specialty: state.profile.partner1Specialty,
            partner2Name: state.profile.partner2Name,
            partner2Specialty: state.profile.partner2Specialty,
            city: state.profile.city,
            totalIncomeFormatted: formatCurrency(totalIncome),
            totalSpentFormatted: formatCurrency(totalSpentThisMonth),
            remainingFormatted: formatCurrency(remainingToSpendThisMonth),
            isOver: isOverBudget,
            highestBlownName: highestBlownCategory?.name || 'Nenhuma',
            installmentCommitmentPct: installmentCommitmentPercentage,
            savedTotalFormatted: formatCurrency(totalSavedInPiggyBanks),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro na resposta');
      }

      const botMessage: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'model',
        text: data.reply || 'Sem resposta no momento.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          role: 'model',
          text: `Desculpe, tive uma oscilação momentânea: ${err.message}. Continuem firmes nas metas do casal!`,
          timestamp: 'Agora',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                  Dr. Finanças
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                  Conselheiro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Assistente inteligente do casal
              </p>
            </div>
          </div>

          {/* Actions: Model Switcher & Prominent Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Model Switcher Dropdown (compact on mobile) */}
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value as any)}
              className="text-[10px] sm:text-xs font-bold py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none focus:outline-none max-w-[90px] sm:max-w-none truncate"
              title="Escolher modelo Gemini"
            >
              <option value="gemini-3.5-flash">Flash</option>
              <option value="gemini-3.1-pro-preview">Pro</option>
              <option value="gemini-3.1-flash-lite">Lite</option>
            </select>

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
              <span className="animate-pulse font-medium">Dr. Finanças está analisando os dados do casal...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

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
            placeholder="Pergunte ao Dr. Finanças..."
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
