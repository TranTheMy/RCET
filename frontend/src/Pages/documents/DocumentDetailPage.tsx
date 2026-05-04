import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  Download,
  FileText,
  History,
  Tag,
  ShieldCheck,
  Info,
  ArrowUpRight,
  Cpu,
  Database,
  HardDrive,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { documentService } from '../../services/document.service';
import type { DocumentItem } from '../../types';
import { docCreatedAt, formatTechnicalMeta } from '../../utils/documents';
import { ROUTER } from '../../routes/router';
import { PdfPreviewPanel } from '../../components/preview/PdfPreviewPanel';
import { useAuthStore } from '../../store/authStore';
import ConfirmDialog from '../../components/ConfirmDialog';

const DocumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [openFileUrl, setOpenFileUrl] = useState<string | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  const canWithdrawDocument = useMemo(() => {
    if (!doc || !user) return false;
    const dir = user.system_role === 'vien_truong';
    const owner = doc.created_by === user.id;
    if (!owner && !dir) return false;
    if (['draft', 'pending', 'rejected'].includes(doc.status)) return true;
    return dir;
  }, [doc, user]);

  const showDocWithdrawReason =
    !!user &&
    user.system_role === 'vien_truong' &&
    !!doc &&
    ['published', 'revision', 'archived'].includes(doc.status);

  const openWithdrawDocumentModal = () => {
    setWithdrawReason('');
    setWithdrawOpen(true);
  };

  const executeWithdrawDocument = async () => {
    if (!id || !doc) return;
    const reason = showDocWithdrawReason ? withdrawReason.trim() : '';
    setWithdrawBusy(true);
    try {
      await documentService.remove(id, reason ? { reason } : undefined);
      setWithdrawOpen(false);
      setWithdrawReason('');
      toast.success(t('documents:detail.toasts.withdrawn'));
      navigate(ROUTER.USER.DOCUMENTS);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('documents:detail.toasts.withdrawFailed');
      toast.error(typeof msg === 'string' ? msg : t('documents:detail.toasts.withdrawFailed'));
    } finally {
      setWithdrawBusy(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    documentService
      .getOne(id)
      .then((res) => setDoc(res.data))
      .catch(() => toast.error(t('documents:detail.toasts.fetchFailed')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (!id || loading) return;
    documentService
      .getDownloadUrl(id)
      .then((r) => setOpenFileUrl(r.data?.url?.trim() || null))
      .catch(() => setOpenFileUrl(null));
  }, [id, loading]);

  const loadPreviewBlob = useCallback(() => {
    if (!id) return Promise.reject(new Error(t('documents:detail.errors.missingId')));
    return documentService.getPreviewBlob(id);
  }, [id, t]);

  const onDownload = async () => {
    if (!id) return;
    setDlLoading(true);
    try {
      const res = await documentService.getDownloadUrl(id);
      if (res.data?.url) window.open(res.data.url, '_blank');
      else toast.error(t('documents:detail.toasts.noFileSource'));
    } catch {
      toast.error(t('documents:detail.toasts.downloadFailed'));
    } finally {
      setDlLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-cyan-500/40">{t('documents:detail.loading')}</p>
      </div>
    );
  }

  if (!doc) return null;

  const directPdfUrl =
    (doc.pdf_url?.trim() && /^https?:\/\//i.test(doc.pdf_url) ? doc.pdf_url.trim() : null) ||
    (doc.file_path?.trim() && /^https?:\/\//i.test(doc.file_path) ? doc.file_path.trim() : null) ||
    null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pb-24">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 flex flex-wrap items-center justify-between gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
        >
          <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center group-hover:border-cyan-500/50">
            <ChevronLeft size={14} />
          </div>
          {t('documents:back')}
        </button>
        <button
          type="button"
          onClick={() => navigate(ROUTER.USER.DOCUMENTS)}
          className="text-[10px] font-black uppercase tracking-widest text-cyan-500/80 hover:text-cyan-400 transition-colors"
        >
          {t('documents:detail.publicRepoCta')}
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col xl:flex-row xl:items-stretch gap-8 xl:gap-10">
          {/* Cột xem trước */}
          <div className="xl:flex-1 xl:min-w-0 order-2 xl:order-1">
            <PdfPreviewPanel
              title={t('documents:detail.previewTitle', { title: doc.title })}
              loadPreviewBlob={loadPreviewBlob}
              gateLoading={loading}
              tabOpenUrl={directPdfUrl || openFileUrl}
              onRetryOpenTab={onDownload}
              showToolbarNewTab={false}
            />
            <p className="mt-3 text-[9px] text-slate-600 text-center xl:text-left font-medium uppercase tracking-wider">
              {t('documents:detail.previewHint')}
            </p>
          </div>

          {/* Cột thông tin */}
          <aside className="w-full xl:w-[min(100%,420px)] shrink-0 space-y-6 order-1 xl:order-2">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[1px] w-10 bg-cyan-500/40" />
                  <span className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">{t('documents:detail.kicker')}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl xl:text-[2.75rem] font-[1000] text-white uppercase italic tracking-tighter leading-[1.05] mb-6">
                {doc.title}
              </h1>
              <div className="flex flex-wrap gap-3">
                <div className="px-3 py-2 rounded-xl bg-[#0f172a] border border-white/10 flex items-center gap-2">
                  <Tag size={14} className="text-cyan-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {doc.category?.name || t('documents:detail.uncategorized')}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-[#0f172a] border border-white/10 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    v{doc.version_number}.0 • {t(`documents:status.${doc.status}`, { defaultValue: doc.status })}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative pl-4 border-l-2 border-cyan-500/30">
              <h3 className="text-[10px] font-[1000] uppercase tracking-[0.3em] text-slate-600 mb-3 flex items-center gap-2">
                <Info size={14} /> {t('documents:detail.techSummary')}
              </h3>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-medium italic">
                &ldquo;{doc.description || t('documents:detail.noDescription')}&rdquo;
              </p>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#0f172a]/60 border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[#020617] shadow-lg shrink-0">
                <Cpu size={26} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-600 block mb-1">
                    {t('documents:detail.manufacturerLabel')}
                </span>
                <h4 className="text-lg font-black text-white uppercase tracking-tight italic truncate">
                  {doc.manufacturer || t('documents:detail.internalSystem')}
                </h4>
                {doc.doc_type && (
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{doc.doc_type}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 flex items-center gap-2">
                <Terminal size={14} className="text-emerald-500" /> {t('documents:detail.systemData')}
              </h3>
              <pre className="p-5 rounded-[24px] bg-black border border-white/5 text-[11px] font-mono text-emerald-400/80 leading-relaxed overflow-x-auto max-h-48 shadow-inner">
                {formatTechnicalMeta(doc.technical_metadata)}
              </pre>
            </div>

            <div className="p-6 sm:p-8 rounded-[32px] bg-white text-[#020617] relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 w-28 h-28 bg-[#020617]/5 rounded-bl-[100px] -mr-14 -mt-14 transition-all group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-[#020617] flex items-center justify-center text-white">
                    <FileText size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-[#020617]/10 px-3 py-1 rounded-lg">
                    {t('documents:detail.dataSource')}
                  </span>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-2 truncate pr-8">
                  {doc.title}.{doc.source_type === 'link' ? t('documents:detail.fileExt.url') : t('documents:detail.fileExt.pdf')}
                </h3>
                <p className="text-[10px] font-bold text-[#020617]/50 mb-6 uppercase tracking-tighter">
                  {t(`documents:sourceType.${doc.source_type}`, { defaultValue: doc.source_type })} •{' '}
                  {t(`documents:status.${doc.status}`, { defaultValue: doc.status })}
                </p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={dlLoading}
                    className="w-full h-14 rounded-2xl bg-[#020617] text-white flex items-center justify-center gap-3 text-[11px] font-[1000] uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                  >
                    {dlLoading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    {t('documents:detail.actions.download')}
                  </button>
                  {doc.pdf_url && (
                    <a
                      href={doc.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full h-14 rounded-2xl border-2 border-[#020617]/10 flex items-center justify-center gap-2 text-[#020617] text-[10px] font-[1000] uppercase tracking-widest hover:bg-[#020617]/5 transition-all"
                    >
                      {t('documents:detail.actions.externalLink')} <ArrowUpRight size={16} />
                    </a>
                  )}
                  {canWithdrawDocument && (
                    <button
                      type="button"
                      disabled={withdrawBusy}
                      onClick={openWithdrawDocumentModal}
                      className="w-full h-12 rounded-2xl border border-rose-300/60 bg-rose-500/10 text-rose-200 flex items-center justify-center gap-2 text-[10px] font-[1000] uppercase tracking-widest hover:bg-rose-500/20 transition-all disabled:opacity-50"
                    >
                      {withdrawBusy ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      {t('documents:detail.actions.withdraw')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[32px] bg-[#0f172a]/40 border border-white/5">
              <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">
                <History size={16} /> {t('documents:detail.lifecycle')}
              </h3>
              <div className="space-y-6 relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-white/5" />
                <div className="flex gap-5 relative">
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 z-10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{t('documents:detail.lastUpdated')}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter italic">
                      {new Date(docCreatedAt(doc)).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-5 relative">
                  <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 z-10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('documents:detail.systemRecord')}</p>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter italic">
                      {t('documents:detail.initialCreated')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-5 rounded-[28px] bg-white/5 border border-white/5 flex flex-col gap-2">
                <Database size={16} className="text-slate-600" />
                <span className="text-base font-black text-white italic uppercase">
                  {t(`documents:sourceType.${doc.source_type}`, { defaultValue: doc.source_type })}
                </span>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{t('documents:detail.storage')}</span>
              </div>
              <div className="p-5 rounded-[28px] bg-white/5 border border-white/5 flex flex-col gap-2">
                <HardDrive size={16} className="text-slate-600" />
                <span className="text-base font-black text-white italic">{t('documents:detail.preview')}</span>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{t('documents:detail.inline')}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={withdrawOpen && !!doc}
        title={t('documents:detail.confirmModal.title')}
        description={t('documents:detail.withdrawConfirm')}
        confirmLabel={t('documents:detail.confirmModal.confirm')}
        cancelLabel={t('documents:detail.confirmModal.cancel')}
        loading={withdrawOpen && withdrawBusy}
        reasonField={
          showDocWithdrawReason
            ? {
                label: t('documents:detail.withdrawReasonLabel'),
                placeholder: t('documents:detail.withdrawReasonPlaceholder'),
                value: withdrawReason,
                onChange: setWithdrawReason,
                show: true,
              }
            : undefined
        }
        onConfirm={() => void executeWithdrawDocument()}
        onClose={() => {
          if (withdrawBusy) return;
          setWithdrawOpen(false);
          setWithdrawReason('');
        }}
      />
    </div>
  );
};

export default DocumentDetailPage;
