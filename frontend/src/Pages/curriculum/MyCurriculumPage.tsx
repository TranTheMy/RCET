import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  FileText, 
  Loader2, 
  Plus, 
  Send, 
  GitBranch, 
  AlertCircle,
  Clock,
  ExternalLink,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { curriculumService } from '../../services/curriculum.service';
import { realtimeService } from '../../services/realtime.service';
import type { CurriculumItem, CurriculumStatus } from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';
import { curriculumCreatedAt, dedupeMineCurriculumItems, extractCurriculumFromEnvelope } from '../../utils/curriculum';
import { useTranslation } from 'react-i18next';

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

const STATUS_STYLE: Record<CurriculumStatus, { color: string; bg: string }> = {
  draft: { color: 'text-slate-400', bg: 'bg-slate-500/10' },
  pending: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
  approved: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  rejected: { color: 'text-rose-500', bg: 'bg-rose-500/10' },
  revision: { color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  archived: { color: 'text-slate-600', bg: 'bg-slate-600/10' },
};

const MyCurriculumPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const canCreate = user?.system_role === 'truong_lab' || user?.system_role === 'vien_truong';

  const [loading, setLoading] = useState(true);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [filter, setFilter] = useState<CurriculumStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await curriculumService.listMine();
      setItems(res.data?.items ?? []);
    } catch {
      if (!silent) {
        toast.error(t('curriculum:mine.toasts.fetchFailed'));
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
    }, CURRICULUM_POLLING_MS);

    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === CURRICULUM_SYNC_EVENT) {
        load({ silent: true });
      }
    };

    const onLocalSync = () => {
      load({ silent: true });
    };

    const onVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    };

    window.addEventListener('storage', onStorageSync);
    window.addEventListener(CURRICULUM_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibilitySync);

    return () => {
      window.removeEventListener('storage', onStorageSync);
      window.removeEventListener(CURRICULUM_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibilitySync);
    };
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const socket = realtimeService.connect(user.id);
    const unsubscribe = realtimeService.onCurriculumStatusUpdated(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load({ silent: true }), 400);
    });

    socket.on('connect_error', () => {
      // keep polling fallback; no toast spam for transient socket errors
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [user?.id, load]);

  /** Một nhóm phiên bản: khi đang chờ duyệt vẫn thấy bản approved trước đó; sau duyệt / dữ liệu trùng chỉ hiển thị một bản approved mới nhất. */
  const displayItems = useMemo(() => dedupeMineCurriculumItems(items), [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return displayItems;
    return displayItems.filter((x) => x.status === filter);
  }, [displayItems, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: displayItems.length };
    displayItems.forEach((it) => {
      c[it.status] = (c[it.status] || 0) + 1;
    });
    return c;
  }, [displayItems]);

  const submit = async (id: string) => {
    setBusyId(id);
    try {
      await curriculumService.submit(id);
      toast.success(
        user?.system_role === 'vien_truong'
          ? t('curriculum:mine.toasts.publishedReplaceApproved')
          : t('curriculum:mine.toasts.submittedForReview'),
      );
      try {
        localStorage.setItem(CURRICULUM_SYNC_EVENT, String(Date.now()));
        window.dispatchEvent(new CustomEvent(CURRICULUM_SYNC_EVENT));
      } catch {
        /* ignore */
      }
      load({ silent: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('curriculum:mine.toasts.submitFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const newVersion = async (id: string) => {
    setBusyId(id);
    try {
      const res = await curriculumService.createVersion(id);
      const created = extractCurriculumFromEnvelope(res);
      const newId = created?.id;
      toast.success(
        user?.system_role === 'vien_truong'
          ? t('curriculum:mine.toasts.newDraftToReplacePublished')
          : t('curriculum:mine.toasts.versionInitializedDraft'),
      );
      if (newId) {
        /** replace: tránh stack [mine → edit → mine] khiến nút Back / Library lệch lịch sử */
        navigate(`/publication/curriculum/${newId}/edit`, { replace: true });
      }
      else load({ silent: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('curriculum:mine.toasts.createVersionFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const tabs: Array<{ key: CurriculumStatus | 'all'; labelKey: string }> = [
    { key: 'all', labelKey: 'curriculum:mine.tabs.all' },
    { key: 'draft', labelKey: 'curriculum:mine.tabs.draft' },
    { key: 'pending', labelKey: 'curriculum:mine.tabs.pending' },
    { key: 'approved', labelKey: 'curriculum:mine.tabs.approved' },
    { key: 'rejected', labelKey: 'curriculum:mine.tabs.rejected' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 pb-24 relative overflow-x-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* Background Decor + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
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

      {/* Hero Header */}
      <div className="sticky top-1 z-30 border-b border-white/[0.06] bg-[#0b0e14]/95 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-8 left-1/2 h-28 w-[min(100%,480px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_72%)]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTER.USER.CURRICULUM)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400"
                title={t('curriculum:mine.actions.backToLibrary')}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <span className="sr-only">{t('curriculum:mine.kicker')}</span>
                <h1 className="text-xl font-[1000] uppercase italic leading-tight tracking-tight text-cyan-400 drop-shadow-[0_0_24px_rgba(34,211,238,0.28)] sm:text-2xl md:text-3xl">
                  {t('curriculum:mine.titlePrefix')}{' '}
                  <span className="text-cyan-300">{t('curriculum:mine.titleHighlight')}</span>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
              <Link
                to={ROUTER.USER.CURRICULUM}
                replace
                className="rounded-lg border border-cyan-500/45 bg-[#12161f]/90 px-4 py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:border-cyan-400 hover:bg-cyan-500/10"
              >
                {t('curriculum:mine.actions.libraryView')}
              </Link>
              {canCreate && (
                <Link
                  to={ROUTER.USER.CURRICULUM_CREATE}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-4 py-2.5 text-[9px] sm:text-[10px] font-[1000] uppercase tracking-widest text-[#020617] shadow-[0_0_24px_rgba(34,211,238,0.4)] transition-all hover:bg-cyan-300"
                >
                  <Plus size={16} strokeWidth={3} /> {t('curriculum:mine.actions.newAsset')}
                </Link>
              )}
            </div>
          </div>

          <div className="mt-2.5 -mx-1 px-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <div className="flex w-max min-w-full gap-1.5 rounded-full border border-white/[0.07] bg-[#12161f]/90 p-1 sm:inline-flex sm:w-full sm:flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`shrink-0 rounded-full px-3 py-2 sm:flex-1 sm:min-w-0 text-[9px] sm:text-[10px] font-[1000] uppercase tracking-wide transition-all ${
                    filter === tab.key
                      ? 'bg-cyan-400 text-[#020617] shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {t(tab.labelKey)}
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] ${
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
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">{t('curriculum:mine.loading')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-[#0f172a]/20 rounded-[48px] border border-white/5 border-dashed">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-slate-700" />
            </div>
            <p className="text-slate-500 font-[1000] uppercase tracking-widest text-sm italic">{t('curriculum:mine.empty')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((d) => {
              const statusStyle = STATUS_STYLE[d.status] || STATUS_STYLE.draft;
              return (
                <div key={d.id} className="group relative bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-6 lg:p-8 hover:border-white/10 transition-all overflow-hidden">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`text-[9px] font-[1000] uppercase tracking-widest px-3 py-1 rounded-full border border-white/5 ${statusStyle.bg} ${statusStyle.color}`}>
                          {t(`curriculum:status.${d.status}`)}
                        </span>
                        {d.version_number != null && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 font-bold bg-white/5 px-2 py-1 rounded-lg">
                            <GitBranch size={10} /> {t('curriculum:mine.version', { version: d.version_number })}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                          <Clock size={10} /> {new Date(curriculumCreatedAt(d)).toLocaleString(dateLocale)}
                        </span>
                      </div>
                      
                      <h2 className="text-xl font-[1000] text-white uppercase tracking-tight group-hover:text-cyan-400 transition-colors truncate mb-2">
                        {d.title}
                      </h2>
                      
                      {d.status === 'rejected' && d.review_note && (
                        <div className="mt-4 flex items-start gap-3 bg-rose-500/5 rounded-2xl p-4 border border-rose-500/10">
                          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-rose-200/70 leading-relaxed italic">
                            <span className="font-black uppercase text-[9px] block mb-1 text-rose-500">{t('curriculum:mine.reviewerNote')}</span>
                            {d.review_note}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Link 
                        to={`/publication/curriculum/${d.id}`} 
                        className="p-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        title={t('curriculum:mine.actions.openDetails')}
                      >
                        <ExternalLink size={20} />
                      </Link>

                      {d.status === 'draft' && (
                        <>
                          <Link 
                            to={`/publication/curriculum/${d.id}/edit`} 
                            className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-[#020617] text-[10px] font-[1000] uppercase tracking-widest hover:bg-cyan-50 transition-all"
                          >
                            <Edit3 size={16} strokeWidth={3} /> {t('curriculum:mine.actions.edit')}
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === d.id}
                            onClick={() => submit(d.id)}
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-cyan-500 text-[#020617] text-[10px] font-[1000] uppercase tracking-widest hover:bg-cyan-400 disabled:opacity-50 transition-all"
                          >
                            {busyId === d.id ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} strokeWidth={3} />}
                            {t('curriculum:mine.actions.submit')}
                          </button>
                        </>
                      )}

                      {d.status === 'rejected' && (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => submit(d.id)}
                          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-cyan-500 text-[#020617] text-[10px] font-[1000] uppercase tracking-widest hover:bg-cyan-400 disabled:opacity-50 transition-all"
                        >
                          {busyId === d.id ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} strokeWidth={3} />}
                          {t('curriculum:mine.actions.resubmit')}
                        </button>
                      )}

                      {d.status === 'approved' && (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => newVersion(d.id)}
                          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 border border-cyan-500/30 text-cyan-400 text-[10px] font-[1000] uppercase tracking-widest hover:bg-cyan-500/10 disabled:opacity-50 transition-all"
                        >
                          {busyId === d.id ? <Loader2 className="animate-spin" size={16} /> : <GitBranch size={16} strokeWidth={3} />}
                          {t('curriculum:mine.actions.updateVersion')}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Line Decor */}
                  <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCurriculumPage;