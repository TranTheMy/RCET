import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  ChevronLeft, 
  Clock, 
  Loader2, 
  ShieldCheck, 
  XCircle, 
  GanttChartSquare,
  User,
  MessageSquareQuote,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { curriculumService } from '../../services/curriculum.service';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import type { CurriculumItem } from '../../types';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const CURRICULUM_SYNC_EVENT = 'curriculum-status-updated';
const CURRICULUM_POLLING_MS = 5000;

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

const CurriculumApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await curriculumService.listPending();
      setItems(res.data?.items ?? []);
    } catch {
      if (!silent) {
        toast.error(t('curriculum:approvals.toasts.fetchFailed'));
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
    }, CURRICULUM_POLLING_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CURRICULUM_SYNC_EVENT) load({ silent: true });
    };
    const onLocalSync = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const onFocus = () => load({ silent: true });
    window.addEventListener('storage', onStorage);
    window.addEventListener(CURRICULUM_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CURRICULUM_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = realtimeService.connect(user.id);
    const unsubPending = realtimeService.onCurriculumPendingSubmitted(() => {
      load({ silent: true });
    });
    const unsubUpdated = realtimeService.onCurriculumStatusUpdated(() => {
      load({ silent: true });
    });

    const onSocketConnect = () => {
      load({ silent: true });
    };
    socket.on('connect', onSocketConnect);
    socket.on('connect_error', () => {});

    return () => {
      unsubPending();
      unsubUpdated();
      socket.off('connect', onSocketConnect);
    };
  }, [user?.id, load]);

  const total = useMemo(() => items.length, [items]);

  const notifyCurriculumChanged = () => {
    localStorage.setItem(CURRICULUM_SYNC_EVENT, String(Date.now()));
    window.dispatchEvent(new CustomEvent(CURRICULUM_SYNC_EVENT));
  };

  const onApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await curriculumService.approve(id, noteById[id]?.trim() || undefined);
      notifyCurriculumChanged();
      toast.success(t('curriculum:approvals.toasts.approved'));
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('curriculum:approvals.toasts.approveFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const onReject = async (id: string) => {
    const note = noteById[id]?.trim();
    if (!note) {
      toast.error(t('curriculum:approvals.toasts.rejectReasonRequired'));
      return;
    }
    setActionLoading(id);
    try {
      await curriculumService.reject(id, note);
      notifyCurriculumChanged();
      toast.success(t('curriculum:approvals.toasts.rejected'));
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('curriculum:approvals.toasts.rejectFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 pb-20 relative overflow-x-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* Background Decor + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
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

      <header className="sticky top-4 z-40 border-b border-white/[0.06] bg-[#0b0e14]/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400 group"
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-cyan-400 flex items-center justify-center text-[#020617] shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <ShieldCheck size={26} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-[1000] uppercase italic tracking-tighter text-white">
                  {t('curriculum:approvals.titlePrefix')} <span className="text-cyan-500">{t('curriculum:approvals.titleHighlight')}</span>
                </h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t('curriculum:approvals.subtitle')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/5 p-2 px-6 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('curriculum:approvals.pendingTask')}</p>
                <p className="text-2xl font-black text-cyan-400 leading-none mt-1">{loading ? '...' : total}</p>
              </div>
              <Zap size={24} className={total > 0 ? "text-amber-500 animate-pulse" : "text-slate-700"} />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/50">{t('curriculum:approvals.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-[#0f172a]/40 rounded-[40px] border border-dashed border-white/5">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-white font-black uppercase italic tracking-widest text-lg">{t('curriculum:approvals.empty.title')}</h3>
            <p className="text-slate-500 mt-2 text-sm">{t('curriculum:approvals.empty.hint')}</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {items.map((it) => (
              <div key={it.id} className="group relative bg-[#0f172a]/60 rounded-[32px] border border-white/5 p-8 hover:bg-[#0f172a] transition-all shadow-2xl overflow-hidden">
                <Link
                  to={`/publication/curriculum/${it.id}`}
                  className="absolute inset-0 z-0 rounded-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
                  aria-label={t('curriculum:approvals.card.ariaOpen', { title: it.title })}
                />
                {/* Status Watermark */}
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-all pointer-events-none">
                  <GanttChartSquare size={120} />
                </div>

                <div className="relative z-10 flex flex-col xl:flex-row justify-between gap-10 pointer-events-none">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Clock size={12} className="text-amber-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">{t('curriculum:approvals.card.awaitingDecision')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">REV: v{it.version_number ?? 1}.0</span>
                    </div>

                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight group-hover:text-cyan-400 transition-colors mb-3 line-clamp-2 leading-tight">
                      {it.title}
                    </h2>
                    
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-6 max-w-3xl">
                      {it.description || t('curriculum:approvals.card.noAbstract')}
                    </p>

                    <div className="flex items-center gap-6 border-t border-white/5 pt-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <User size={14} className="text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none">{t('curriculum:approvals.card.submittedBy')}</p>
                          <p className="text-xs font-bold text-slate-300 mt-1">{it.creator?.full_name || it.created_by}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Panel — tương tác riêng, không kích hoạt link thẻ */}
                  <div className="w-full xl:w-[400px] shrink-0 pointer-events-auto">
                    <div className="bg-black/20 rounded-[24px] p-6 border border-white/5 space-y-4">
                      <div className="relative">
                        <div className="absolute top-3 left-3 text-slate-600">
                          <MessageSquareQuote size={16} />
                        </div>
                        <textarea
                          placeholder={t('curriculum:approvals.card.notePlaceholder')}
                          value={noteById[it.id] ?? ''}
                          onChange={(e) => setNoteById((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          rows={4}
                          className="w-full bg-[#020617] border border-white/10 rounded-2xl px-10 py-3 text-sm text-white placeholder:text-slate-700 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all resize-none font-medium"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          disabled={actionLoading === it.id}
                          onClick={() => onApprove(it.id)}
                          className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[#020617] text-[10px] font-[1000] uppercase tracking-widest hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50"
                        >
                          {actionLoading === it.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} strokeWidth={3} />}
                          {t('curriculum:approvals.actions.approve')}
                        </button>
                        <button
                          disabled={actionLoading === it.id}
                          onClick={() => onReject(it.id)}
                          className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-[1000] uppercase tracking-widest hover:bg-rose-500/20 transition-all disabled:opacity-50"
                        >
                          <XCircle size={16} strokeWidth={3} />
                          {t('curriculum:approvals.actions.reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CurriculumApprovalsPage;