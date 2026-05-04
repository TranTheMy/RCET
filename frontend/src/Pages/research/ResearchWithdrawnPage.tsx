import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, RotateCcw, Shield, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { researchService } from '../../services/research.service';
import type { ResearchItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const RESEARCH_SYNC_EVENT = 'research-status-updated';

const ResearchWithdrawnPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await researchService.listWithdrawn();
      setItems(res.data?.items || []);
    } catch {
      toast.error(t('research:withdrawn.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = () => {
    try {
      localStorage.setItem(RESEARCH_SYNC_EVENT, String(Date.now()));
      window.dispatchEvent(new CustomEvent(RESEARCH_SYNC_EVENT));
    } catch {
      /* ignore */
    }
  };

  const onRestore = async (id: string) => {
    setBusyId(id);
    try {
      await researchService.restore(id);
      notify();
      toast.success(t('research:withdrawn.toasts.restored'));
      await load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('research:withdrawn.toasts.restoreFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-slate-200/60 sticky top-[72px] lg:top-[70px] z-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                <Archive size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tighter text-slate-900">
                  {t('research:withdrawn.title')}
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                  <Shield size={12} className="text-indigo-500" />
                  {t('research:withdrawn.subtitle')}
                </p>
              </div>
            </div>
          </div>
          <Link
            to={ROUTER.USER.RESEARCH_APPROVALS}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
          >
            {t('research:withdrawn.backToApprovals')}
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-200">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400 mt-4">
              {t('research:withdrawn.loading')}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[40px] border border-slate-200">
            <p className="text-slate-600 font-bold">{t('research:withdrawn.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((it) => {
              const busy = busyId === it.id;
              return (
                <li
                  key={it.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {it.status} · {it.deleted_at?.slice(0, 16)?.replace('T', ' ')}
                    </p>
                    <h2 className="text-lg font-black text-slate-900 truncate">{it.title}</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 truncate">{it.authors}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRestore(it.id)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    {t('research:withdrawn.restore')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ResearchWithdrawnPage;
