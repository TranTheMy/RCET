import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, Clock, Loader2, Shield, XCircle, 
  Hash, User, ExternalLink, ChevronLeft, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { researchService } from '../../services/research.service';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import type { ResearchItem } from '../../types';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';
import { ROUTER } from '../../routes/router';
import ConfirmDialog from '../../components/ConfirmDialog';

const RESEARCH_SYNC_EVENT = 'research-status-updated';
const RESEARCH_POLLING_MS = 5000;

const ResearchApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [publicById, setPublicById] = useState<Record<string, boolean>>({});
  const [withdrawQueueId, setWithdrawQueueId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await researchService.listPending();
      setItems(res.data.items || []);
    } catch {
      if (!silent) toast.error(t('research:approvals.toasts.fetchFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, RESEARCH_POLLING_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RESEARCH_SYNC_EVENT) load({ silent: true });
    };
    const onLocalSync = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const onFocus = () => load({ silent: true });
    window.addEventListener('storage', onStorage);
    window.addEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
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
    const unsubPending = realtimeService.onResearchPendingSubmitted(scheduleLoad);
    const unsubUpdated = realtimeService.onResearchStatusUpdated(scheduleLoad);

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

  const notifyResearchChanged = () => {
    try {
      localStorage.setItem(RESEARCH_SYNC_EVENT, String(Date.now()));
      window.dispatchEvent(new CustomEvent(RESEARCH_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setPublicById((prev) => {
      const next = { ...prev };
      items.forEach((it) => {
        if (next[it.id] === undefined) next[it.id] = true;
      });
      return next;
    });
  }, [items]);

  const total = useMemo(() => items.length, [items]);

  const approve = async (id: string) => {
    setActionLoading(id);
    try {
      const isPublic = publicById[id] ?? true;
      await researchService.approve(id, isPublic, noteById[id]);
      notifyResearchChanged();
      toast.success(isPublic ? t('research:approvals.toasts.approvedPublic') : t('research:approvals.toasts.approvedInternal'));
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:approvals.toasts.approveFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const executeWithdrawFromQueue = async () => {
    const id = withdrawQueueId;
    if (!id) return;
    setActionLoading(id);
    try {
      await researchService.remove(id);
      setWithdrawQueueId(null);
      notifyResearchChanged();
      toast.success(t('research:approvals.toasts.withdrawn'));
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:approvals.toasts.actionFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: string) => {
    const note = noteById[id]?.trim();
    if (!note) {
      toast.error(t('research:approvals.toasts.rejectReasonRequired'));
      return;
    }
    setActionLoading(id);
    try {
      await researchService.reject(id, note);
      notifyResearchChanged();
      toast.success(t('research:approvals.toasts.rejected'));
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:approvals.toasts.actionFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Dynamic Header */}
      <div className="bg-white border-b border-slate-200/60 sticky top-[72px] lg:top-[70px] z-20 backdrop-blur-md bg-white/80">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-center gap-5">
              {/* Back Button */}
              <button 
                onClick={() => navigate(-1)}
                className="group p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                  <Shield size={24} />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tighter text-slate-900">
                    {t('research:approvals.titlePrefix')} <span className="text-indigo-600">{t('research:approvals.titleHighlight')}</span>
                  </h1>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <Clock size={10} /> {t('research:approvals.queue')}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                      {t('research:approvals.role')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={ROUTER.USER.RESEARCH_WITHDRAWN}
                className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50/50"
              >
                {t('research:approvals.withdrawnLink')}
              </Link>
              <div className="hidden sm:block text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('research:approvals.pending')}</p>
                <div className="flex items-center justify-end gap-2">
                   <div className={`w-2 h-2 rounded-full ${total > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                   <p className="text-2xl font-black text-slate-900 leading-none">{loading ? '--' : total}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-slate-200 shadow-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 relative z-10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-6">{t('research:approvals.loading')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center mx-auto mb-8 rotate-12 group hover:rotate-0 transition-transform duration-500">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('research:approvals.empty.title')}</h2>
            <p className="text-slate-500 mt-3 font-medium text-sm">{t('research:approvals.empty.hint')}</p>
            <button 
              onClick={() => navigate(-1)}
              className="mt-8 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-colors shadow-xl shadow-slate-900/10"
            >
              {t('common:notFound.actions.back')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {items.map((it) => {
              const busy = actionLoading === it.id;
              return (
                <div key={it.id} className="group bg-white border border-slate-200 rounded-[40px] overflow-hidden transition-all duration-500 hover:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.08)] hover:border-indigo-300">
                  <div className="p-8 md:p-10 flex flex-col lg:flex-row gap-10">
                    
                    {/* Content Section */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-4 mb-6">
                        <span className="px-4 py-1.5 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200/50 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {t('research:approvals.badge.pending')}
                        </span>
                        <div className="h-4 w-px bg-slate-200 mx-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Hash size={14} className="text-indigo-500" /> {it.impact_rank}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <User size={14} className="text-indigo-500" /> {it.source_type}
                        </span>
                      </div>
                      
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 leading-tight group-hover:text-indigo-600 transition-colors italic tracking-tight">
                        {it.title}
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                            AU
                          </div>
                          <p className="text-sm text-slate-700 font-black tracking-tight underline decoration-indigo-500/30 underline-offset-4">
                            {it.authors}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-2">
                          <div className="px-5 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 group/doi cursor-pointer hover:bg-indigo-50 transition-colors">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/doi:text-indigo-500">DOI</span>
                            <span className="text-xs font-bold text-slate-800">{it.doi}</span>
                            <ExternalLink size={12} className="text-slate-300 group-hover/doi:text-indigo-500 transition-colors" />
                          </div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1 rounded-lg">
                            {t('research:approvals.submittedAt')}: {it.created_at?.slice(0, 16).replace('T', ' ')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className="lg:w-[400px] flex flex-col gap-5 bg-slate-50/50 p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-inner">
                      <label
                        onClick={() => setPublicById((p) => ({ ...p, [it.id]: !(p[it.id] ?? true) }))}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all"
                      >
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('research:approvals.public.label')}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">
                            {t('research:approvals.public.hint')}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-md border-2 transition-all ${(publicById[it.id] ?? true) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`} />
                      </label>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('research:approvals.note.label')}</label>
                        <textarea
                          rows={3}
                          value={noteById[it.id] || ''}
                          onChange={(e) => setNoteById((p) => ({ ...p, [it.id]: e.target.value }))}
                          placeholder={t('research:approvals.note.placeholder')}
                          className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-400 bg-white text-sm font-bold transition-all resize-none shadow-sm"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => approve(it.id)}
                          disabled={busy}
                          className="flex-[2] h-14 inline-flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 active:scale-95 group"
                        >
                          {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />}
                          {t('research:approvals.actions.approve')}
                        </button>
                        <button
                          onClick={() => reject(it.id)}
                          disabled={busy}
                          className="flex-1 h-14 inline-flex items-center justify-center gap-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-900 text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all disabled:opacity-50 active:scale-95 group"
                        >
                          {busy ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} className="group-hover:rotate-90 transition-transform duration-300" />}
                          {t('research:approvals.actions.reject')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawQueueId(it.id)}
                          disabled={busy}
                          className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                          title={t('research:approvals.actions.withdraw')}
                        >
                          {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          {t('research:approvals.actions.withdraw')}
                        </button>
                      </div>

                      <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-tighter">
                        {t('research:approvals.public.footerHint')}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!withdrawQueueId}
        title={t('research:approvals.confirmWithdraw.title')}
        description={t('research:approvals.confirmWithdraw.description')}
        confirmLabel={t('research:mine.confirmModal.confirm')}
        cancelLabel={t('research:mine.confirmModal.cancel')}
        loading={!!withdrawQueueId && actionLoading === withdrawQueueId}
        onConfirm={() => void executeWithdrawFromQueue()}
        onClose={() => {
          if (actionLoading) return;
          setWithdrawQueueId(null);
        }}
      />
    </div>
  );
};

export default ResearchApprovals;