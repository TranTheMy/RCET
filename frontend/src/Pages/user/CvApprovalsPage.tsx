import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, generatePath } from 'react-router-dom';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Microscope,
  ClipboardList,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scientistApplicationService } from '../../services/scientistApplication.service';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import type { ScientistApplicationItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { useTranslation } from 'react-i18next';

const statusLabel: Record<string, string> = {
  pending_lab_review: 'pending_lab_review',
  lab_rejected: 'lab_rejected',
  pending_director_review: 'pending_director_review',
  director_rejected: 'director_rejected',
  approved: 'approved',
};

const CvApprovalsPage: React.FC = () => {
  const { user, isAuthenticated, initialized } = useAuthStore();
  const { t } = useTranslation();
  const role = user?.system_role;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScientistApplicationItem[]>([]);
  const [actionId, setActionId] = useState<number | null>(null);
  const [noteById, setNoteById] = useState<Record<number, string>>({});

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!initialized || !isAuthenticated || !localStorage.getItem('access_token')) {
      if (!silent) setLoading(false);
      setItems([]);
      return;
    }
    if (role !== 'truong_lab' && role !== 'vien_truong') {
      if (!silent) setLoading(false);
      setItems([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await scientistApplicationService.listForReview();
      setItems(res.data?.items ?? []);
    } catch {
      if (!silent) toast.error(t('user:cv.approvals.toasts.fetchFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [initialized, isAuthenticated, role, t]);

  useEffect(() => {
    if (!initialized) return;
    load();
  }, [initialized, load]);

  useEffect(() => {
    if (!user?.id) return;
    if (role !== 'truong_lab' && role !== 'vien_truong') return;

    const socket = realtimeService.connect(user.id);
    const unsub = realtimeService.onScientistApplicationListChanged(() => {
      load({ silent: true });
    });
    socket.on('connect_error', () => {});

    return () => {
      unsub();
    };
  }, [user?.id, role, load]);

  const title = useMemo(() => {
    if (role === 'truong_lab') return t('user:cv.approvals.titles.labHead');
    if (role === 'vien_truong') return t('user:cv.approvals.titles.director');
    return t('user:cv.approvals.titles.default');
  }, [role, t]);

  const labApprove = async (id: number) => {
    setActionId(id);
    try {
      await scientistApplicationService.labReview(id, { action: 'APPROVE' });
      toast.success(t('user:cv.approvals.toasts.labApproved'));
      load();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.approvals.toasts.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  const labReject = async (id: number) => {
    const note = noteById[id]?.trim();
    if (!note) {
      toast.error(t('user:cv.approvals.toasts.rejectReasonRequired'));
      return;
    }
    setActionId(id);
    try {
      await scientistApplicationService.labReview(id, { action: 'REJECT', comment: note });
      toast.success(t('user:cv.approvals.toasts.rejected'));
      load();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.approvals.toasts.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  const directorApprove = async (id: number) => {
    setActionId(id);
    try {
      await scientistApplicationService.directorReview(id, { action: 'APPROVE' });
      toast.success(t('user:cv.approvals.toasts.directorApproved'));
      load();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.approvals.toasts.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  const directorReject = async (id: number) => {
    const note = noteById[id]?.trim();
    if (!note) {
      toast.error(t('user:cv.approvals.toasts.rejectReasonRequired'));
      return;
    }
    setActionId(id);
    try {
      await scientistApplicationService.directorReview(id, { action: 'REJECT', comment: note });
      toast.success(t('user:cv.approvals.toasts.rejected'));
      load();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.approvals.toasts.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-24 pt-8 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link
            to={ROUTER.USER.HOME}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-colors"
            aria-label={t('user:cv.approvals.actions.homeAria')}
          >
            <ChevronLeft size={20} className="text-cyan-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <ClipboardList className="text-cyan-400" size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{title}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                {t('user:cv.approvals.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-slate-500 py-16 text-sm">{t('user:cv.approvals.empty')}</p>
        ) : (
          <ul className="space-y-6">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={generatePath(ROUTER.USER.CV_DETAIL, { id: String(row.id) })}
                      className="block rounded-xl -m-2 p-2 text-left hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500">
                        {t(`user:cv.status.${statusLabel[row.status] ?? row.status}`)}
                      </span>
                      <h2 className="text-lg font-bold text-white mt-1 truncate">{row.fullName}</h2>
                      <p className="text-sm text-slate-400 mt-1">{row.email}</p>
                      {row.phone ? <p className="text-sm text-slate-400">{row.phone}</p> : null}
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <Microscope size={14} className="text-cyan-500/60 shrink-0" />
                        {row.position}
                      </p>
                      {row.coverLetter ? (
                        <p className="text-xs text-slate-500 mt-3 line-clamp-3">{row.coverLetter}</p>
                      ) : null}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70 mt-3">{t('user:cv.approvals.actions.viewDetail')}</p>
                      {row.labComment ? (
                        <p className="text-xs text-amber-200/80 mt-3 border-l-2 border-amber-500/50 pl-3">
                          {t('user:cv.approvals.labels.lab')}: {row.labComment}
                        </p>
                      ) : null}
                      {row.directorComment ? (
                        <p className="text-xs text-rose-200/80 mt-2 border-l-2 border-rose-500/50 pl-3">
                          {t('user:cv.approvals.labels.director')}: {row.directorComment}
                        </p>
                      ) : null}
                    </Link>
                    {row.contractSummary || row.contractFileUrl ? (
                      <div className="mt-2 pl-0 text-xs text-emerald-300/90 space-y-1">
                        {row.contractSummary ? <p>Hợp đồng: {row.contractSummary}</p> : null}
                        {row.contractFileUrl && role !== 'vien_truong' ? (
                          <a
                            href={row.contractFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                          >
                            <FileText size={14} />
                            {t('user:cv.approvals.actions.contractFile')}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 shrink-0 w-full md:w-64">
                    {role === 'truong_lab' && row.status === 'pending_lab_review' ? (
                      <>
                        <textarea
                          placeholder={t('user:cv.approvals.notePlaceholder')}
                          value={noteById[row.id] ?? ''}
                          onChange={(e) => setNoteById((m) => ({ ...m, [row.id]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 min-h-[72px]"
                        />
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => labApprove(row.id)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {actionId === row.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                          {t('user:cv.approvals.actions.approve')}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => labReject(row.id)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 disabled:opacity-50"
                        >
                          <XCircle size={16} /> {t('user:cv.approvals.actions.reject')}
                        </button>
                      </>
                    ) : null}

                    {role === 'vien_truong' && row.status === 'pending_director_review' ? (
                      <>
                        <textarea
                          placeholder={t('user:cv.approvals.notePlaceholder')}
                          value={noteById[row.id] ?? ''}
                          onChange={(e) => setNoteById((m) => ({ ...m, [row.id]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 min-h-[72px]"
                        />
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => directorApprove(row.id)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {actionId === row.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                          {t('user:cv.approvals.actions.approveDirector')}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => directorReject(row.id)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 disabled:opacity-50"
                        >
                          <XCircle size={16} /> {t('user:cv.approvals.actions.reject')}
                        </button>
                      </>
                    ) : null}

                    {role === 'vien_truong' &&
                    row.status === 'approved' &&
                    !row.contractCreatedAt ? (
                      <Link
                        to={generatePath(ROUTER.USER.CV_CONTRACT, { id: String(row.id) })}
                        className="flex items-center justify-center py-3 rounded-xl bg-cyan-600 text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 text-center"
                      >
                        {t('user:cv.approvals.actions.createContract')}
                      </Link>
                    ) : null}

                    {role === 'vien_truong' && row.contractFileUrl ? (
                      <Link
                        to={generatePath(ROUTER.USER.CV_CONTRACT_VIEW, { id: String(row.id) })}
                        className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-emerald-500/45 bg-emerald-500/15 text-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/25 hover:border-emerald-400/55 transition-colors text-center"
                      >
                        <FileText size={16} className="text-emerald-300 shrink-0" />
                        {t('user:cv.approvals.actions.viewContract')}
                      </Link>
                    ) : null}
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

export default CvApprovalsPage;
