import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, X, Send, Loader2, Bell, AlertTriangle, Lightbulb, Info, ChevronDown, Bot, Power, PowerOff, GraduationCap, Cpu } from 'lucide-react';
import { aiService, type ChatMessage, type AINotification, type SmartNotificationsResponse, type AiChatSuggestions } from '../services/ai.service';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { ROUTER } from '../routes/router';

/* ================================================================ */
/*  NOTIFICATION ICON MAPPING                                        */
/* ================================================================ */
const NOTIF_ICON: Record<string, React.ReactNode> = {
  alert: <AlertTriangle size={14} className="text-red-500 shrink-0" />,
  warning: <Bell size={14} className="text-amber-500 shrink-0" />,
  suggestion: <Lightbulb size={14} className="text-blue-500 shrink-0" />,
  info: <Info size={14} className="text-slate-400 shrink-0" />,
};

const NOTIF_BG: Record<string, string> = {
  alert: 'bg-red-50 border-red-100',
  warning: 'bg-amber-50 border-amber-100',
  suggestion: 'bg-blue-50 border-blue-100',
  info: 'bg-slate-50 border-slate-100',
};

/* ================================================================ */
/*  MAIN COMPONENT                                                   */
/* ================================================================ */
const AIAssistant: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'notifications'>('chat');
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('ai-assistant-enabled') !== '0';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ai-assistant-enabled', enabled ? '1' : '0');
  }, [enabled]);

  if (!isAuthenticated) return null;
  /** Role `user`: tài khoản cơ bản — không hiển thị trợ lý AI */
  if (user?.system_role === 'user') return null;

  return (
    <>
      {!enabled && (
        <button
          onClick={() => setEnabled(true)}
          className="fixed bottom-6 right-6 z-[200] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0f172a] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300 shadow-xl transition-all hover:bg-[#111a33]"
          aria-label={t('common:aiAssistant.actions.enableAria')}
        >
          <Power className="h-3.5 w-3.5" />
          {t('common:aiAssistant.actions.enable')}
        </button>
      )}

      {/* Floating button */}
      {enabled && (
        <button
          onClick={() => setOpen(!open)}
          className={`fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
            open
              ? 'bg-slate-800 text-white rotate-0'
              : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:brightness-110 hover:shadow-2xl'
          }`}
          aria-label="AI Assistant"
        >
          {open ? <X size={22} strokeWidth={2.5} /> : <Bot size={22} strokeWidth={2.5} />}
        </button>
      )}

      {/* Chat panel */}
      {enabled && open && (
        <div className="fixed bottom-24 right-6 z-[200] w-[400px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-white text-sm font-black uppercase tracking-widest">{t('common:aiAssistant.header.title')}</h2>
              <p className="text-cyan-200/80 text-[9px] font-bold uppercase tracking-wider mt-0.5">{t('common:aiAssistant.header.subtitle')}</p>
            </div>
            <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setTab('chat')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                  tab === 'chat' ? 'bg-cyan-500 text-[#0F172A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('common:aiAssistant.tabs.chat')}
              </button>
              <button
                onClick={() => setTab('notifications')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                  tab === 'notifications' ? 'bg-cyan-500 text-[#0F172A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('common:aiAssistant.tabs.notifications')}
              </button>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setEnabled(false);
              }}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-rose-200 transition-colors hover:bg-rose-500/20"
              title={t('common:aiAssistant.actions.disableTitle')}
            >
              <PowerOff size={10} />
              {t('common:aiAssistant.actions.disable')}
            </button>
          </div>

          {/* Body */}
          {tab === 'chat' ? <ChatTab /> : <NotificationsTab />}
        </div>
      )}
    </>
  );
};

/** Gợi ý tài liệu CHIP / giáo trình từ API */
const AssistantLibrarySuggestions: React.FC<{ suggestions: AiChatSuggestions }> = ({ suggestions }) => {
  const { chipDocuments, researchCurriculums } = suggestions;
  if (
    (!chipDocuments || chipDocuments.length === 0) &&
    (!researchCurriculums || researchCurriculums.length === 0)
  ) {
    return null;
  }
  return (
    <div className="max-w-[95%] pl-1 space-y-2">
      {chipDocuments && chipDocuments.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-2.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1.5">
            <Cpu size={12} /> Tài liệu kỹ thuật / CHIP (kho sách)
          </p>
          <ul className="space-y-1">
            {chipDocuments.map((d) => (
              <li key={d.id}>
                <Link
                  to={ROUTER.USER.DOCUMENTS_DETAIL.replace(':id', d.id)}
                  className="text-[10px] font-semibold text-amber-900 hover:underline leading-snug block"
                >
                  {d.title}
                  {d.category_name ? (
                    <span className="font-normal text-amber-700/90"> — {d.category_name}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {researchCurriculums && researchCurriculums.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-2.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5 mb-1.5">
            <GraduationCap size={12} /> Giáo trình / Research (curriculum)
          </p>
          <ul className="space-y-1">
            {researchCurriculums.map((c) => (
              <li key={c.id}>
                <Link
                  to={ROUTER.USER.CURRICULUM_DETAIL.replace(':id', c.id)}
                  className="text-[10px] font-semibold text-indigo-900 hover:underline leading-snug block"
                >
                  {c.title}
                  {c.category_name ? (
                    <span className="font-normal text-indigo-700/90"> — {c.category_name}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ================================================================ */
/*  CHAT TAB                                                         */
/* ================================================================ */
const ChatTab: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.map(({ role, content }) => ({ role, content }));
      const res = await aiService.chat(text, historyPayload);
      const payload = res.data;
      if (res.success && payload?.reply) {
        const { reply, suggestions } = payload;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          suggestions,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: t('common:aiAssistant.chat.errors.genericCannotProcess') }]);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { status?: number } })?.response?.status === 503
        ? t('common:aiAssistant.chat.errors.serviceUnavailable')
        : t('common:aiAssistant.chat.errors.connection');
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const sendQuickMessage = async (text: string) => {
    if (loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const historyPayload = messages.map(({ role, content }) => ({ role, content }));
      const res = await aiService.chat(text, historyPayload);
      const payload = res.data;
      if (res.success && payload?.reply) {
        const { reply, suggestions } = payload;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          suggestions,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: t('common:aiAssistant.chat.errors.genericCannotProcess') }]);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { status?: number } })?.response?.status === 503
        ? t('common:aiAssistant.chat.errors.serviceUnavailable')
        : t('common:aiAssistant.chat.errors.connection');
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[420px] bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={24} className="text-cyan-500" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">{t('common:aiAssistant.chat.welcomeTitle')}</p>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-[250px] mx-auto">
              {t('common:aiAssistant.chat.welcomeHint')}
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                t('common:aiAssistant.chat.quick.0'),
                t('common:aiAssistant.chat.quick.1'),
                t('common:aiAssistant.chat.quick.2'),
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuickMessage(q)}
                  className="block w-full text-left px-3 py-2 bg-white rounded-lg text-[10px] text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[11px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-md'
                  : 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-md'
              }`}
            >
              {msg.content.split('\n').map((line: string, j: number) => (
                <React.Fragment key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
            {msg.role === 'assistant' && msg.suggestions && (
              <AssistantLibrarySuggestions suggestions={msg.suggestions} />
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('common:aiAssistant.chat.inputPlaceholder')}
            className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-xs outline-none border border-slate-100 focus:border-cyan-500/40 focus:bg-white transition-all"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-9 h-9 bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </>
  );
};

/* ================================================================ */
/*  NOTIFICATIONS TAB                                                */
/* ================================================================ */
const NotificationsTab: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<SmartNotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiService.getSmartNotifications();
      if (res.success) setData(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px] text-slate-400 text-xs">
        {t('common:aiAssistant.notifications.loadFailed')}
      </div>
    );
  }

  const allItems: AINotification[] = [...data.notifications, ...data.suggestions];

  return (
    <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[470px]">
      {/* Summary cards */}
      <button
        onClick={() => setShowSummary(!showSummary)}
        className="w-full px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
      >
        {t('common:aiAssistant.notifications.summary.title')}
        <ChevronDown size={12} className={`transition-transform ${showSummary ? 'rotate-180' : ''}`} />
      </button>

      {showSummary && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-100">
          <SummaryCard label={t('common:aiAssistant.notifications.summary.pendingTasks')} value={data.summary.pending_tasks} color={data.summary.pending_tasks > 0 ? 'text-amber-600' : 'text-green-600'} />
          <SummaryCard label={t('common:aiAssistant.notifications.summary.overdueTasks')} value={data.summary.overdue_tasks} color={data.summary.overdue_tasks > 0 ? 'text-red-600' : 'text-green-600'} />
          <SummaryCard label={t('common:aiAssistant.notifications.summary.todayTasks')} value={data.summary.today_tasks} color={data.summary.today_tasks > 0 ? 'text-blue-600' : 'text-slate-400'} />
          <SummaryCard label={t('common:aiAssistant.notifications.summary.activeProjects')} value={data.summary.active_projects} color="text-slate-700" />
          <SummaryCard label={t('common:aiAssistant.notifications.summary.overdueProjects')} value={data.summary.overdue_projects} color={data.summary.overdue_projects > 0 ? 'text-red-600' : 'text-green-600'} />
          <SummaryCard label={t('common:aiAssistant.notifications.summary.reportRate')} value={data.summary.report_rate !== null ? `${data.summary.report_rate}%` : t('common:aiAssistant.dashNa')} color={data.summary.report_rate !== null && data.summary.report_rate < 70 ? 'text-red-600' : 'text-green-600'} />
        </div>
      )}

      {/* Notification items */}
      <div className="p-3 space-y-2">
        {allItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            {t('common:aiAssistant.notifications.empty')}
          </div>
        ) : (
          allItems.map((item, i) => (
            <div key={i} className={`flex gap-2.5 p-3 rounded-xl border transition-colors ${NOTIF_BG[item.type] || NOTIF_BG.info}`}>
              <div className="mt-0.5">{NOTIF_ICON[item.type] || NOTIF_ICON.info}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-700 mb-0.5">{item.title}</p>
                <p className="text-[10px] text-slate-600 leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Refresh */}
      <div className="p-3 pt-0">
        <button
          onClick={load}
          className="w-full text-center py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-600 transition-colors"
        >
          {t('common:aiAssistant.notifications.refresh')}
        </button>
      </div>
    </div>
  );
};

/* ================================================================ */
/*  SUMMARY CARD                                                     */
/* ================================================================ */
const SummaryCard: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
    <p className={`text-lg font-black ${color}`}>{value}</p>
    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
  </div>
);

export default AIAssistant;
