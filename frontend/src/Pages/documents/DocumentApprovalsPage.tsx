import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, ChevronLeft, Clock, Loader2, 
  ShieldAlert, XCircle, Fingerprint, Terminal, 
  AlertTriangle, Cpu
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { documentService } from '../../services/document.service';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import type { DocumentItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const DOCUMENT_SYNC_EVENT = 'document-status-updated';
const DOCUMENT_POLLING_MS = 5000;

const meteorStyles = `
  @keyframes list-meteor-fx {
    0% { transform: translate(500px, -500px) rotate(225deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(225deg); opacity: 0; }
  }
  .list-meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to bottom, rgba(6, 182, 212, 0.75), transparent);
    animation: list-meteor-fx linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

type MeteorSpec = { id: number; top: string; right: string; animationDuration: string };

const DocumentApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await documentService.listPending();
      setItems(res.data?.items ?? []);
    } catch {
      if (!silent) {
        toast.error(t('documents:approvals.toasts.fetchFailed'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${Math.random() * -10}%`,
          right: `${Math.random() * 80}%`,
          animationDuration: `${Math.random() * 2 + 2}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, DOCUMENT_POLLING_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DOCUMENT_SYNC_EVENT) load({ silent: true });
    };
    const onLocalSync = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const onFocus = () => load({ silent: true });
    window.addEventListener('storage', onStorage);
    window.addEventListener(DOCUMENT_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DOCUMENT_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load({ silent: true }), 400);
    };

    const socket = realtimeService.connect(user.id);
    const unsubPending = realtimeService.onDocumentPendingSubmitted(scheduleLoad);
    const unsubUpdated = realtimeService.onDocumentStatusUpdated(scheduleLoad);

    const onSocketConnect = () => {
      load({ silent: true });
    };
    socket.on('connect', onSocketConnect);
    socket.on('connect_error', () => {});

    return () => {
      clearTimeout(debounceTimer);
      unsubPending();
      unsubUpdated();
      socket.off('connect', onSocketConnect);
    };
  }, [user?.id, load]);

  const notifyDocumentChanged = () => {
    try {
      localStorage.setItem(DOCUMENT_SYNC_EVENT, String(Date.now()));
      window.dispatchEvent(new CustomEvent(DOCUMENT_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  };

  const total = useMemo(() => items.length, [items]);

  const approve = async (id: string) => {
    setActionLoading(id);
    try {
      await documentService.approve(id, noteById[id]?.trim() || undefined);
      notifyDocumentChanged();
      toast.success(t('documents:approvals.toasts.approved'));
      load();
    } catch (err: unknown) {
      const raw =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('documents:approvals.toasts.approveFailed'),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: string) => {
    const note = noteById[id]?.trim();
    if (!note) {
      toast.error(t('documents:approvals.toasts.rejectNoteRequired'));
      return;
    }
    setActionLoading(id);
    try {
      await documentService.reject(id, note);
      notifyDocumentChanged();
      toast.success(t('documents:approvals.toasts.rejected'));
      load();
    } catch (err: unknown) {
      const raw =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('documents:approvals.toasts.rejectFailed'),
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 pb-32 font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      <style>{meteorStyles}</style>
      {/* Background HUD + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:60px_60px] opacity-20" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-cyan-500/10 blur-[120px]" />
        {meteors.map((m) => (
          <div
            key={m.id}
            className="list-meteor"
            style={{
              top: m.top,
              right: m.right,
              animationDuration: m.animationDuration,
            }}
          />
        ))}
      </div>

      {/* Sticky: dưới header app + điều hướng workspace */}
      <div className="sticky top-5 z-30 border-b border-cyan-500/20 bg-[#0b0e14]/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 group"
            >
              <ChevronLeft size={18} className="text-slate-400 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-all" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 relative overflow-hidden">
                <ShieldAlert size={24} className="relative z-10" />
                <div className="absolute inset-0 bg-cyan-500/20 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-[950] uppercase italic text-white tracking-wide">
                  {t('documents:approvals.titlePrefix')} <span className="text-transparent stroke-white stroke-1" style={{ WebkitTextStroke: '1px white' }}>{t('documents:approvals.titleHighlight')}</span>
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Fingerprint size={12} className="text-emerald-400" />
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">{t('documents:approvals.subtitle')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t border-white/5 md:border-none pt-4 md:pt-0">
            <div className="text-right flex items-center gap-4">
              <div className="flex flex-col items-end">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle size={10} className="text-cyan-500" /> {t('documents:approvals.queueLabel')}
                </p>
                <p className="text-3xl font-[950] text-white tabular-nums leading-none mt-1">
                  {loading ? '--' : total.toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Progress bar effect at the bottom of header */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center py-32">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-cyan-500 opacity-20" />
              <Loader2 className="w-16 h-16 animate-spin text-cyan-400 absolute top-0 left-0 [animation-delay:-0.5s]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500 mt-8 animate-pulse">{t('documents:approvals.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 rounded-[40px] border border-dashed border-white/10 bg-white/[0.02] text-center backdrop-blur-sm">
            <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <p className="text-emerald-400 text-xl font-black uppercase tracking-widest mb-2">{t('documents:approvals.emptyTitle')}</p>
            <p className="text-slate-500 text-sm italic">{t('documents:approvals.emptySubtitle')}</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {items.map((it) => (
              <li key={it.id} className="group relative rounded-[32px] border border-white/10 bg-[#0f172a]/80 backdrop-blur-xl p-8 hover:border-cyan-500/30 transition-all duration-500 shadow-xl overflow-hidden">
                {/* Warning glow for pending items */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] group-hover:bg-cyan-500/10 transition-colors pointer-events-none" />
                
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-10">
                  
                  {/* Info Section */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">
                        <Clock size={10} className="animate-pulse" /> {t('documents:approvals.pendingChip')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Terminal size={12} /> {t('documents:approvals.idLabel', { id: it.id.slice(0, 8).toUpperCase() })}
                      </span>
                    </div>

                    <Link
                      to={ROUTER.USER.DOCUMENTS_DETAIL.replace(':id', it.id)}
                      className="inline-block text-2xl md:text-3xl font-[900] text-white uppercase italic tracking-tight hover:text-amber-400 transition-colors mb-3"
                    >
                      {it.title}
                    </Link>
                    
                    <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6 line-clamp-2 max-w-3xl">
                      {it.description || t('documents:approvals.noDescription')}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <Cpu size={14} className="text-slate-600" />
                        {t('documents:approvals.senderLabel')}: <span className="text-slate-300">{it.creator?.full_name || it.created_by}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-700" />
                      <div>
                        {t('documents:approvals.versionLabel')}: <span className="text-emerald-400 font-mono text-xs">v{it.version_number ?? 1}.0</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="w-full xl:w-[400px] shrink-0 space-y-4">
                    <div className="relative group/input">
                      <textarea
                        placeholder={t('documents:approvals.notePlaceholder')}
                        value={noteById[it.id] ?? ''}
                        onChange={(e) => setNoteById((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        rows={3}
                        className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all resize-none shadow-inner font-mono"
                      />
                      <div className="absolute top-2 right-2 p-1">
                         <Terminal size={14} className="text-slate-700" />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        disabled={actionLoading === it.id}
                        onClick={() => approve(it.id)}
                        className="flex-1 relative overflow-hidden group/btn inline-flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-[#020617] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {actionLoading === it.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        {t('documents:approvals.actions.approve')}
                      </button>
                      
                      <button
                        type="button"
                        disabled={actionLoading === it.id}
                        onClick={() => reject(it.id)}
                        className="flex-1 relative overflow-hidden group/btn inline-flex items-center justify-center gap-2 py-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {actionLoading === it.id ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                        {t('documents:approvals.actions.reject')}
                      </button>
                    </div>
                  </div>

                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DocumentApprovalsPage;