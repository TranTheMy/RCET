import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, Loader2, Bot } from 'lucide-react';
import { aiService, type ChatMessage } from '../services/ai.service';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { ROUTER } from '../routes/router';

/** Trang chủ + các trang ấn phẩm / thông tin công khai đã chọn (các route khác không hiện). */
export function allowsGuestInfoChatbotPath(pathname: string): boolean {
  if (pathname === ROUTER.USER.HOME) return true;
  if (pathname === ROUTER.USER.INFORMATION || pathname === ROUTER.USER.INFORMATION_PORTAL) return true;
  if (pathname === ROUTER.USER.RESEARCH) return true;
  const m = pathname.match(/^\/publication\/research\/([^/]+)$/);
  if (m) {
    const seg = m[1];
    if (['submit', 'mine', 'approvals'].includes(seg)) return false;
    return true;
  }
  return false;
}

function extractGuestReply(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.message === 'string' && d.message.trim()) return d.message;
  return null;
}

/**
 * Chatbot thông tin VKsLab cho khách (góc phải dưới). Gọi POST /api/ai-guest/chat — không cần đăng nhập.
 */
const GuestInfoChatbot: React.FC = () => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendWithText = useCallback(async (text: string, history: ChatMessage[]) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const payload = await aiService.chatGuest(trimmed, history);
      const reply = extractGuestReply(payload);
      if (reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('common:aiAssistant.chat.errors.genericCannotProcess') },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('common:aiAssistant.chat.errors.connection') },
      ]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const sendMessage = async () => {
    await sendWithText(input, messages);
  };

  const sendQuick = async (q: string) => {
    if (loading) return;
    await sendWithText(q, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!allowsGuestInfoChatbotPath(pathname)) return null;
  if (isAuthenticated) return null;

  const quickRaw = t('common:guestInfoChat.quick', { returnObjects: true });
  const quickList = Array.isArray(quickRaw) ? quickRaw : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
          open
            ? 'bg-slate-800 text-white'
            : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:brightness-110 hover:shadow-2xl'
        }`}
        aria-label={open ? t('common:guestInfoChat.ariaClose') : t('common:guestInfoChat.ariaToggle')}
      >
        {open ? <X size={22} strokeWidth={2.5} /> : <Bot size={22} strokeWidth={2.5} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[200] w-[min(100vw-2rem,400px)] max-h-[min(70vh,560px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
          <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] px-5 py-4 shrink-0">
            <h2 className="text-white text-sm font-black uppercase tracking-widest">
              {t('common:guestInfoChat.header.title')}
            </h2>
            <p className="text-cyan-200/80 text-[9px] font-bold uppercase tracking-wider mt-0.5">
              {t('common:guestInfoChat.header.subtitle')}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[360px] bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={24} className="text-cyan-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">{t('common:guestInfoChat.welcomeTitle')}</p>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-[260px] mx-auto">
                  {t('common:guestInfoChat.welcomeHint')}
                </p>
                <div className="mt-4 space-y-1.5">
                  {quickList.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendQuick(q)}
                      className="block w-full text-left px-3 py-2 bg-white rounded-lg text-[10px] text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[11px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-md'
                      : 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-md'
                  }`}
                >
                  {msg.content.split('\n').map((line, j) => (
                    <React.Fragment key={j}>
                      {line}
                      {j < msg.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 p-3 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('common:guestInfoChat.inputPlaceholder')}
                className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-xs outline-none border border-slate-100 focus:border-cyan-500/40 focus:bg-white transition-all"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuestInfoChatbot;
