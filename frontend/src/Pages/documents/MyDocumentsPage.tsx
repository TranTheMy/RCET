import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  FileText,
  Loader2,
  Send,
  RefreshCw,
  GitBranch,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { realtimeService } from '../../services/realtime.service';
import { documentService } from '../../services/document.service';
import type { DocumentItem, DocumentStatus } from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';
import { docCreatedAt } from '../../utils/documents';

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

const STATUS_UI: Record<DocumentStatus, { labelKey: string; color: string; bg: string; icon: LucideIcon }> = {
  draft: { labelKey: 'documents:mine.status.draft', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Inbox },
  pending: { labelKey: 'documents:mine.status.pending', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  published: { labelKey: 'documents:mine.status.published', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  rejected: { labelKey: 'documents:mine.status.rejected', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: XCircle },
  revision: { labelKey: 'documents:mine.status.revision', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: RefreshCw },
  archived: { labelKey: 'documents:mine.status.archived', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText },
};

const MyDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState<DocumentStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await documentService.listMine();
      setItems(res.data?.items ?? []);
    } catch {
      if (!silent) {
        toast.error(t('documents:mine.toasts.fetchFailed'));
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
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, DOCUMENT_POLLING_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === DOCUMENT_SYNC_EVENT) load({ silent: true });
    };
    const onLocalSync = () => load({ silent: true });
    const onVisibilitySync = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    window.addEventListener('storage', onStorageSync);
    window.addEventListener(DOCUMENT_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibilitySync);
    return () => {
      window.removeEventListener('storage', onStorageSync);
      window.removeEventListener(DOCUMENT_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibilitySync);
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
    const unsubUpdated = realtimeService.onDocumentStatusUpdated(scheduleLoad);
    const unsubPending = realtimeService.onDocumentPendingSubmitted(scheduleLoad);

    const onSocketConnect = () => {
      load({ silent: true });
    };
    socket.on('connect', onSocketConnect);
    socket.on('connect_error', () => undefined);

    return () => {
      clearTimeout(debounceTimer);
      unsubUpdated();
      unsubPending();
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

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((x) => x.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((it) => {
      c[it.status] = (c[it.status] || 0) + 1;
    });
    return c;
  }, [items]);

  const onSubmitForReview = async (id: string) => {
    setBusyId(id);
    try {
      await documentService.submit(id);
      notifyDocumentChanged();
      toast.success(
        user?.system_role === 'vien_truong'
          ? t('documents:mine.toasts.autoApproved')
          : t('documents:mine.toasts.submitted')
      );
      load({ silent: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('documents:mine.toasts.submitFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const onNewVersion = async (id: string) => {
    setBusyId(id);
    try {
      const res = await documentService.createVersion(id);
      const newId = res.data?.id;
      toast.success(t('documents:mine.toasts.newVersionCreated'));
      if (newId) navigate(ROUTER.USER.DOCUMENTS_EDIT.replace(':id', newId));
      else load({ silent: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('documents:mine.toasts.newVersionFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const tabs: Array<{ key: DocumentStatus | 'all'; labelKey: string }> = [
    { key: 'all', labelKey: 'documents:mine.tabs.all' },
    { key: 'draft', labelKey: 'documents:mine.tabs.draft' },
    { key: 'pending', labelKey: 'documents:mine.tabs.pending' },
    { key: 'published', labelKey: 'documents:mine.tabs.published' },
    { key: 'rejected', labelKey: 'documents:mine.tabs.rejected' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 pb-20 relative overflow-x-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* HUD Background + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:50px_50px] opacity-5" />
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

      {/* Sticky gọn: một hàng tiêu đề + tab cuộn ngang trên mobile */}
      <div className="sticky top-5 z-30 border-b border-white/[0.06] bg-[#0b0e14]/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400"
              aria-label={t('documents:back')}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <span className="sr-only">{t('documents:mine.kicker')}</span>
              <h1 className="text-xl font-[1000] uppercase italic leading-tight tracking-tight text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.28)] sm:text-2xl md:text-3xl">
                {t('documents:mine.titlePrefix')}{' '}
                <span className="text-cyan-300">{t('documents:mine.titleHighlight')}</span>
              </h1>
            </div>
          </div>

          <div className="mt-2.5 -mx-1 px-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            <div className="flex w-max min-w-full gap-1.5 rounded-full border border-white/[0.07] bg-[#12161f]/95 p-1 sm:inline-flex sm:w-full sm:flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`shrink-0 rounded-full px-3 py-2 sm:flex-1 sm:min-w-0 text-[9px] sm:text-[10px] font-black uppercase tracking-wide transition-all ${
                    filter === tab.key
                      ? 'bg-cyan-400 text-[#020617] shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                  }`}
                >
                  <span>{t(tab.labelKey)}</span>
                  <span
                    className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[8px] sm:text-[9px] ${
                      filter === tab.key ? 'bg-black/15 text-[#020617]' : 'bg-white/5 text-slate-600'
                    }`}
                  >
                    {counts[tab.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/50">{t('documents:mine.loading')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-[#0f172a]/40 rounded-[40px] border border-dashed border-white/5">
            <Inbox className="w-16 h-16 mx-auto text-slate-800 mb-6" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">{t('documents:mine.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((d) => {
              const ui = STATUS_UI[d.status] || STATUS_UI.draft;
              const StatusIcon = ui.icon;

              return (
                <div
                  key={d.id}
                  className="group p-6 rounded-[32px] bg-[#0f172a]/60 border border-white/5 hover:border-white/10 transition-all hover:bg-[#0f172a] shadow-xl"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border border-white/5 ${ui.bg}`}>
                          <StatusIcon size={12} className={ui.color} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${ui.color}`}>
                            {t(ui.labelKey)}
                          </span>
                        </div>
                        {d.version_number != null && (
                          <span className="text-[10px] font-mono text-slate-600 font-bold px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                            {t('documents:mine.version', { version: d.version_number })}
                          </span>
                        )}
                      </div>

                      <Link 
                        to={ROUTER.USER.DOCUMENTS_DETAIL.replace(':id', d.id)} 
                        className="text-xl font-black text-white uppercase italic tracking-tight hover:text-cyan-400 transition-colors block truncate"
                      >
                        {d.title}
                      </Link>

                      <div className="flex items-center gap-4 mt-3">
                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold uppercase tracking-tighter">
                          <Clock size={12} /> {t('documents:mine.sync', { time: docCreatedAt(d).slice(0, 16).replace('T', ' | ') })}
                        </p>
                        {d.category?.name && (
                          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                            {d.category.name}
                          </p>
                        )}
                      </div>

                      {d.status === 'rejected' && d.review_note && (
                        <div className="mt-4 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex gap-3 items-start">
                          <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-rose-200/70 font-medium leading-relaxed italic">
                            {t('documents:mine.reviewNote', { note: d.review_note })}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={ROUTER.USER.DOCUMENTS_DETAIL.replace(':id', d.id)}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <ExternalLink size={14} /> {t('documents:mine.actions.view')}
                      </Link>

                      {d.status === 'draft' && (
                        <>
                          <Link
                            to={ROUTER.USER.DOCUMENTS_EDIT.replace(':id', d.id)}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                          >
                            <Edit3 size={14} /> {t('documents:mine.actions.edit')}
                          </Link>
                          <button
                            disabled={busyId === d.id}
                            onClick={() => onSubmitForReview(d.id)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all disabled:opacity-50"
                          >
                            {busyId === d.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                            {t('documents:mine.actions.submit')}
                          </button>
                        </>
                      )}

                      {d.status === 'rejected' && (
                        <>
                          <Link
                            to={ROUTER.USER.DOCUMENTS_EDIT.replace(':id', d.id)}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                          >
                            <Edit3 size={14} /> {t('documents:mine.actions.fixAndResubmit')}
                          </Link>
                          <button
                            disabled={busyId === d.id}
                            onClick={() => onNewVersion(d.id)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-200 text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                          >
                            {busyId === d.id ? <Loader2 className="animate-spin" size={14} /> : <GitBranch size={14} />}
                            {t('documents:mine.actions.newVersion')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDocumentsPage;