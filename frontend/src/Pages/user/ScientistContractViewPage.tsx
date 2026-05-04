import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Download, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { scientistApplicationService } from '../../services/scientistApplication.service';
import { useAuthStore } from '../../store/authStore';
import type { ScientistApplicationItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { PdfPreviewPanel } from '../../components/preview/PdfPreviewPanel';
import { useTranslation } from 'react-i18next';

const ScientistContractViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const isDirector = user?.system_role === 'vien_truong';
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [row, setRow] = useState<ScientistApplicationItem | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await scientistApplicationService.getOne(id);
      setRow(res.data ?? null);
    } catch {
      toast.error(t('user:cv.contractView.toasts.fetchFailed'));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || !row) return;
    if (!row.contractFileUrl) {
      toast.error(t('user:cv.contractView.toasts.noContractFile'));
      navigate(ROUTER.USER.CV_APPROVALS, { replace: true });
    }
  }, [loading, row, navigate, t]);

  const contractDownloadName = useMemo(() => {
    if (!row?.contractFileUrl) return 'hop-dong';
    try {
      const path = row.contractFileUrl.split('?')[0];
      const seg = path.split('/').pop();
      if (seg && /\.[a-z0-9]{2,5}$/i.test(seg)) return decodeURIComponent(seg);
    } catch {
      /* ignore */
    }
    return 'hop-dong.docx';
  }, [row?.contractFileUrl]);

  const contractUrl = row?.contractFileUrl?.trim() ?? '';
  const isContractPdf = useMemo(() => contractUrl.toLowerCase().split('?')[0].endsWith('.pdf'), [contractUrl]);

  const loadContractBlob = useCallback(() => {
    return fetch(contractUrl).then((r) => {
      if (!r.ok) throw new Error(t('user:cv.contractView.errors.fileFetchFailed'));
      return r.blob();
    });
  }, [contractUrl, t]);

  const onConfirmContract = async () => {
    if (!id || !row || row.contractConfirmedAt) return;
    setConfirming(true);
    try {
      const res = await scientistApplicationService.confirmContract(id);
      setRow(res.data ?? null);
      toast.success(t('user:cv.contractView.toasts.confirmed'));
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.contractView.toasts.confirmFailed'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-16 pt-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to={ROUTER.USER.CV_APPROVALS}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-colors shrink-0"
              aria-label={t('user:cv.contractView.actions.backAria')}
            >
              <ChevronLeft size={20} className="text-cyan-400" />
            </Link>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <FileText className="text-emerald-400" size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tight truncate">
                  {t('user:cv.contractView.title')}
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">
                  {row?.fullName ?? '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {row?.contractFileUrl ? (
              <a
                href={row.contractFileUrl}
                download={contractDownloadName}
                rel="noopener noreferrer"
                aria-label={t('user:cv.contractView.actions.downloadAria')}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600/90 text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 shrink-0"
              >
                <Download size={16} aria-hidden />
                {t('user:cv.contractView.actions.download')}
              </a>
            ) : null}
            {isDirector && row?.contractFileUrl && !row.contractConfirmedAt ? (
              <button
                type="button"
                disabled={confirming}
                onClick={() => void onConfirmContract()}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 shrink-0"
              >
                {confirming ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
                {t('user:cv.contractView.actions.confirm')}
              </button>
            ) : null}
            {isDirector && row?.contractConfirmedAt ? (
              <span className="inline-flex items-center gap-2 py-2 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[10px] font-black uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-emerald-400" aria-hidden />
                {t('user:cv.contractView.actions.confirmed')}
              </span>
            ) : null}
          </div>
        </div>

        {row?.contractSummary ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/90 mb-1.5">{t('user:cv.contractView.summary')}</p>
            <p className="text-sm text-emerald-100/90 leading-relaxed">{row.contractSummary}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          </div>
        ) : row?.contractFileUrl ? (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('user:cv.contractView.previewHintPrefix')} «{t('user:cv.contractView.actions.download')}».
            </p>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40 shadow-xl min-h-[70vh]">
              <PdfPreviewPanel
                title={t('user:cv.contractView.previewTitle')}
                directPdfUrl={isContractPdf ? contractUrl : undefined}
                loadPreviewBlob={!isContractPdf ? loadContractBlob : undefined}
                tabOpenUrl={contractUrl}
                showToolbar={false}
                className="!shadow-none min-h-[70vh]"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ScientistContractViewPage;
