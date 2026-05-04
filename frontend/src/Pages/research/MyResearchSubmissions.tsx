import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Clock, FileText, Loader2, XCircle, Plus, 
  Search, Layers, Calendar, ChevronRight, ChevronLeft,
  ArrowUpRight, Info, Trash2, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { researchService } from '../../services/research.service';
import type { ResearchItem, ResearchStatus } from '../../types';
import { ROUTER } from '../../routes/router';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';
import ConfirmDialog from '../../components/ConfirmDialog';

const RESEARCH_SYNC_EVENT = 'research-status-updated';
const RESEARCH_POLLING_MS = 5000;

const STATUS_META: Record<
  ResearchStatus | 'withdrawn',
  { labelKey: string; cls: string; icon: React.ReactNode }
> = {
  pending: { labelKey: 'research:mine.status.pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-200/50', icon: <Clock size={12} /> },
  approved: { labelKey: 'research:mine.status.approved', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50', icon: <CheckCircle2 size={12} /> },
  rejected: { labelKey: 'research:mine.status.rejected', cls: 'bg-rose-500/10 text-rose-600 border-rose-200/50', icon: <XCircle size={12} /> },
  withdrawn: { labelKey: 'research:mine.status.withdrawn', cls: 'bg-slate-500/10 text-slate-600 border-slate-200/50', icon: <Trash2 size={12} /> },
};

const MyResearchSubmissions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [filter, setFilter] = useState<ResearchStatus | 'all' | 'deleted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [withdrawModalItem, setWithdrawModalItem] = useState<ResearchItem | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const isVienTruong = user?.system_role === 'vien_truong';

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res =
        filter === 'deleted'
          ? await researchService.listMine({ include_deleted: true })
          : await researchService.listMine();
      setItems(res.data.items || []);
    } catch {
      if (!silent) toast.error(t('research:mine.toasts.fetchFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const notifyResearchChanged = () => {
    try {
      localStorage.setItem(RESEARCH_SYNC_EVENT, String(Date.now()));
      window.dispatchEvent(new CustomEvent(RESEARCH_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  };

  const canWithdraw = (it: ResearchItem) => {
    if (it.deleted_at) return false;
    if (isVienTruong) return true;
    return it.status === 'pending' || it.status === 'rejected';
  };

  const openWithdrawModal = (it: ResearchItem) => {
    setWithdrawReason('');
    setWithdrawModalItem(it);
  };

  const executeWithdraw = async () => {
    const it = withdrawModalItem;
    if (!it) return;
    const reason =
      isVienTruong && it.status === 'approved' ? withdrawReason.trim() : '';
    setActionLoading(it.id);
    try {
      await researchService.remove(it.id, reason ? { reason } : undefined);
      setWithdrawModalItem(null);
      setWithdrawReason('');
      notifyResearchChanged();
      toast.success(t('research:mine.toasts.deleted'));
      await loadData();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:mine.toasts.deleteFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const onRestore = async (it: ResearchItem) => {
    setActionLoading(it.id);
    try {
      await researchService.restore(it.id);
      notifyResearchChanged();
      toast.success(t('research:mine.toasts.restored'));
      setFilter('all');
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:mine.toasts.deleteFailed');
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData({ silent: true });
      }
    }, RESEARCH_POLLING_MS);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  useEffect(() => {
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === RESEARCH_SYNC_EVENT) loadData({ silent: true });
    };
    const onLocalSync = () => loadData({ silent: true });
    const onVisibilitySync = () => {
      if (document.visibilityState === 'visible') loadData({ silent: true });
    };
    window.addEventListener('storage', onStorageSync);
    window.addEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibilitySync);
    return () => {
      window.removeEventListener('storage', onStorageSync);
      window.removeEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibilitySync);
    };
  }, [loadData]);

  useEffect(() => {
    if (!user?.id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadData({ silent: true }), 400);
    };

    const socket = realtimeService.connect(user.id);
    const unsubUpdated = realtimeService.onResearchStatusUpdated(scheduleLoad);
    const unsubPending = realtimeService.onResearchPendingSubmitted(scheduleLoad);

    const onSocketConnect = () => {
      loadData({ silent: true });
    };
    socket.on('connect', onSocketConnect);
    socket.on('connect_error', () => {});

    return () => {
      clearTimeout(debounceTimer);
      unsubUpdated();
      unsubPending();
      socket.off('connect', onSocketConnect);
    };
  }, [user?.id, loadData]);

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = x.title.toLowerCase().includes(q);
      if (filter === 'deleted') return matchesSearch;
      const matchesFilter = filter === 'all' || x.status === filter;
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      deleted: 0,
    };
    if (filter === 'deleted') {
      c.deleted = items.length;
      return c;
    }
    c.all = items.length;
    items.forEach((it) => {
      c[it.status] = (c[it.status] || 0) + 1;
    });
    return c;
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-30 backdrop-blur-md bg-white/80">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Return Button */}
              <button 
                onClick={() => navigate(-1)}
                className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm group"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">{t('research:mine.kicker')}</span>
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                  {t('research:mine.titlePrefix')} <span className="text-indigo-600">{t('research:mine.titleHighlight')}</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                onClick={() => void loadData()}
                className="p-3.5 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                title={t('research:mine.actions.refresh')}
              >
                <Layers size={18} />
              </button>
              <Link
                to={ROUTER.USER.RESEARCH_SUBMIT}
                className="group flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                {t('research:mine.actions.submit')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        
        {/* Statistics & Filter Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          <div className="lg:col-span-8 flex p-1.5 bg-slate-200/40 rounded-[24px] border border-slate-200/60 overflow-x-auto no-scrollbar backdrop-blur-sm">
            {(['all', 'pending', 'approved', 'rejected', 'deleted'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 flex items-center justify-center gap-3 px-6 py-3.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  filter === key 
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t(`research:mine.tabs.${key}`)}
                <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] ${filter === key ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-4 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('research:mine.searchPlaceholder')}
              className="w-full pl-14 pr-6 h-[68px] bg-white border border-slate-200 rounded-[24px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50" />
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-6 relative z-10" />
            <span className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] relative z-10">{t('research:mine.loading')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-[30px] flex items-center justify-center mx-auto mb-6 rotate-12">
              <FileText className="text-slate-300" size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">{t('research:mine.empty.title')}</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">{t('research:mine.empty.hint')}</p>
            <Link to={ROUTER.USER.RESEARCH_SUBMIT} className="mt-8 inline-flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:gap-4 transition-all">
              {t('research:mine.empty.cta')} <ArrowUpRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filtered.map((it) => {
              const meta = it.deleted_at ? STATUS_META.withdrawn : STATUS_META[it.status];
              return (
                <div 
                  key={it.id} 
                  className="group relative bg-white border border-slate-200 rounded-[35px] p-8 transition-all duration-500 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] hover:border-indigo-200 hover:-translate-y-1"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${meta.cls}`}>
                          {meta.icon} {t(meta.labelKey)}
                        </span>
                        <div className="h-4 w-px bg-slate-200 mx-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Info size={12} className="text-indigo-400" /> ID: NODE-{(it.id as string).slice(-6).toUpperCase()}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase">
                          {it.impact_rank}
                        </span>
                      </div>
                      
                      <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-4 leading-tight group-hover:text-indigo-600 transition-colors tracking-tight">
                        {it.title}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[9px] font-bold">
                            {it.authors.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-slate-600 tracking-tight italic">{it.authors}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Calendar size={14} className="text-indigo-400" />
                          {it.created_at ? new Date(it.created_at).toLocaleDateString(dateLocale) : t('research:mine.dash')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:block text-right border-r border-slate-100 pr-6 mr-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('research:mine.source.label')}</div>
                        <div className="text-xs font-black text-slate-800 uppercase tracking-wider">{it.source_type}</div>
                      </div>
                      
                      <div className="flex gap-2">
                        {filter === 'deleted' ? (
                          <button
                            type="button"
                            disabled={actionLoading === it.id}
                            onClick={() => void onRestore(it)}
                            className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-50"
                            title={t('research:mine.actions.restore')}
                          >
                            {actionLoading === it.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <RotateCcw size={18} />
                            )}
                          </button>
                        ) : (
                          <>
                            {canWithdraw(it) && (
                              <button
                                type="button"
                                disabled={actionLoading === it.id}
                                onClick={() => openWithdrawModal(it)}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all disabled:opacity-50"
                                title={t('research:mine.actions.delete')}
                              >
                                {actionLoading === it.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                            )}
                            <Link
                              to={`${ROUTER.USER.RESEARCH}/${it.id}`}
                              className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10"
                            >
                              <ChevronRight size={20} />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rejection Note Enhancement */}
                  {it.status === 'rejected' && it.review_note && (
                    <div className="mt-8 p-6 bg-rose-50/50 rounded-[24px] border border-rose-100/50 relative overflow-hidden group/note">
                      <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                      <div className="flex gap-3">
                        <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1.5">{t('research:mine.rejection.title')}</div>
                          <p className="text-sm text-rose-900 leading-relaxed font-bold italic">"{it.review_note}"</p>
                          <Link to={ROUTER.USER.RESEARCH_SUBMIT} className="inline-block mt-3 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:underline">
                            {t('research:mine.rejection.resubmit')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!withdrawModalItem}
        title={t('research:mine.confirmModal.title')}
        description={t('research:mine.actions.deleteConfirm')}
        confirmLabel={t('research:mine.confirmModal.confirm')}
        cancelLabel={t('research:mine.confirmModal.cancel')}
        loading={!!withdrawModalItem && actionLoading === withdrawModalItem.id}
        reasonField={
          withdrawModalItem && isVienTruong && withdrawModalItem.status === 'approved'
            ? {
                label: t('research:mine.withdrawReason.label'),
                placeholder: t('research:mine.withdrawReason.placeholder'),
                value: withdrawReason,
                onChange: setWithdrawReason,
                show: true,
              }
            : undefined
        }
        onConfirm={() => void executeWithdraw()}
        onClose={() => {
          if (actionLoading) return;
          setWithdrawModalItem(null);
          setWithdrawReason('');
        }}
      />

      {/* Background Decor */}
      <div className="fixed bottom-0 right-0 p-10 pointer-events-none opacity-20 -z-10">
        <Layers size={300} className="text-slate-200 rotate-12" />
      </div>
    </div>
  );
};

export default MyResearchSubmissions;