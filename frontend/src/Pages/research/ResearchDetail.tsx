import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  ArrowUpRight, Calendar, Download, ExternalLink, Loader2, 
  ChevronLeft, Zap, Hash, Bookmark, Share2, Globe, Database, Award, FileText, Tags,
  Trash2, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { researchService } from '../../services/research.service';
import type { ResearchItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';
import { PdfPreviewPanel } from '../../components/preview/PdfPreviewPanel';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';
import ConfirmDialog from '../../components/ConfirmDialog';

const getUploadsBaseUrl = () => {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const resolveUploadHref = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getUploadsBaseUrl();
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const ResearchDetail: React.FC = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const isDirector = user?.system_role === 'vien_truong';
  const isOwner = !!(user?.id && item?.created_by && user.id === item.created_by);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = isAuthenticated
          ? await researchService.getApprovedOne(id)
          : await researchService.getPublicOne(id);
        setItem(res.data);
      } catch (err: unknown) {
        const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        const msg =
          (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('research:detail.toasts.fetchFailed');
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, isAuthenticated, t]);

  const canWithdrawDetail =
    !!item &&
    !item.deleted_at &&
    (isDirector || (isOwner && (item.status === 'pending' || item.status === 'rejected')));

  const canRestoreDetail =
    !!item?.deleted_at && (isDirector || isOwner);

  const openWithdrawModal = () => {
    setWithdrawReason('');
    setWithdrawOpen(true);
  };

  const executeWithdraw = async () => {
    if (!id || !item) return;
    const reason = isDirector && item.status === 'approved' ? withdrawReason.trim() : '';
    setActionBusy(true);
    try {
      await researchService.remove(id, reason ? { reason } : undefined);
      setWithdrawOpen(false);
      setWithdrawReason('');
      toast.success(t('research:detail.toasts.withdrawn'));
      const res = await researchService.getApprovedOne(id);
      setItem(res.data);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('research:mine.toasts.deleteFailed'),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const onRestore = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await researchService.restore(id);
      toast.success(t('research:detail.toasts.restored'));
      const res = await researchService.getApprovedOne(id);
      setItem(res.data);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('research:mine.toasts.deleteFailed'),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const doc = useMemo(() => {
    if (!item) return null;
    const fileHref = resolveUploadHref(item.file_url || item.file_path);
    const linkHref = item.pdf_url || null;
    if (item.source_type === 'upload' && fileHref) return { mode: 'download' as const, href: fileHref };
    if (item.source_type === 'link' && linkHref) return { mode: 'external' as const, href: linkHref };
    return null;
  }, [item]);

  const showUploadPreview =
    !!item && item.source_type === 'upload' && !!(item.file_url || item.file_path);

  const loadPreviewBlob = useCallback(() => {
    if (!id) return Promise.reject(new Error(t('research:detail.errors.missingId')));
    return researchService.getPreviewBlob(id, { publicRoute: !isAuthenticated });
  }, [id, isAuthenticated, t]);

  const openAttachmentTab = useCallback(() => {
    if (doc?.href) window.open(doc.href, '_blank', 'noopener,noreferrer');
  }, [doc?.href]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-900 pb-32 relative overflow-hidden">
      {/* Kỹ thuật Decor: Grid lines mờ ảo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-6 pt-32 relative z-10">
        
        {/* TOP BREADCRUMB - Minimalist Style */}
        <div className="mb-16">
          <Link to={ROUTER.USER.RESEARCH} className="group inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 hover:text-indigo-600 transition-all">
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-indigo-600 group-hover:bg-indigo-50 transition-all">
              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            </div>
            {t('research:detail.actions.back')}
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 animate-pulse">{t('research:detail.loading')}</span>
          </div>
        ) : !item ? (
          <div className="text-center py-32 bg-white rounded-[48px] border-2 border-dashed border-slate-100 shadow-sm">
            <p className="text-slate-900 font-black italic uppercase tracking-tighter text-3xl">{t('research:detail.empty.title')}</p>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-4">{t('research:detail.empty.hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {item.deleted_at && (
              <div className="lg:col-span-12 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-900 text-sm font-bold flex flex-wrap items-center justify-between gap-4">
                <span>{t('research:detail.deletedBanner')}</span>
                {canRestoreDetail && isAuthenticated && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void onRestore()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 disabled:opacity-50"
                  >
                    {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    {t('research:detail.actions.restore')}
                  </button>
                )}
              </div>
            )}
            
            {/* LEFT COLUMN: Deep Content */}
            <div className="lg:col-span-8 space-y-12">
              
              {showUploadPreview && id && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    <FileText size={14} className="text-indigo-500" />
                    {t('research:detail.attachment.title')}
                  </div>
                  <div className="rounded-[32px] border border-slate-200 overflow-hidden shadow-lg shadow-slate-200/40">
                    <PdfPreviewPanel
                      title={t('research:detail.attachment.previewTitle', { title: item.title })}
                      loadPreviewBlob={loadPreviewBlob}
                      gateLoading={loading}
                      tabOpenUrl={doc?.mode === 'download' ? doc.href : null}
                      onRetryOpenTab={doc?.mode === 'download' ? openAttachmentTab : undefined}
                      className="rounded-[32px] border-0 shadow-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider text-center sm:text-left">
                    {t('research:detail.attachment.hint')}
                  </p>
                </section>
              )}

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-md">
                    {item.impact_rank || 'STANDARD'}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-md border border-slate-200">
                    ID: {(item.id as string).slice(-8).toUpperCase()}
                  </span>
                  <span className="ml-auto text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <Globe size={12} /> {t('research:detail.badges.globalNode')}
                  </span>
                </div>

                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-[0.95] uppercase">
                  {item.title}
                </h1>

                {item.tags && item.tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0">
                      <Tags size={14} className="text-indigo-500" aria-hidden />
                      {t('research:detail.tags')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag, i) => (
                        <span
                          key={`${tag}-${i}`}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold tracking-tight"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-8 py-8 border-y border-slate-100">
                  <MetaItem icon={<Zap size={16} className="text-amber-500" />} label={t('research:detail.meta.authors')} value={item.authors} />
                  <MetaItem icon={<Calendar size={16} className="text-indigo-500" />} label={t('research:detail.meta.releaseEpoch')} value={item.published_date ? new Date(item.published_date).toLocaleDateString(dateLocale) : undefined} />
                  <MetaItem icon={<Award size={16} className="text-emerald-500" />} label={t('research:detail.meta.sourceType')} value={item.source_type} />
                </div>
              </div>

              {/* Abstract Module - Glassmorphism touch */}
              <section className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-slate-50 to-white rounded-[40px] -z-10 border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-slate-100" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-600">{t('research:detail.summaryTitle')}</h3>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="text-lg text-slate-700 leading-relaxed font-medium italic px-4">
                   {item.description}
                </div>
              </section>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TechBox icon={<Hash size={16}/>} label={t('research:detail.tech.doi')} value={item.doi} isMono />
                <TechBox icon={<Bookmark size={16}/>} label={t('research:detail.tech.citations')} value={t('research:detail.tech.references', { count: item.total_citations ?? 0 })} />
              </div>
            </div>

            {/* RIGHT COLUMN: Action & Intelligence Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Primary Action Card */}
              <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-10">
                    <Database size={24} className="text-indigo-400" />
                    <Share2 size={18} className="text-slate-500 hover:text-white cursor-pointer transition-colors" />
                  </div>

                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">{t('research:detail.gateway.title')}</h4>
                  <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed">{t('research:detail.gateway.hint')}</p>
                  
                  <div className="space-y-4">
                    {doc ? (
                      <a
                        href={doc.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between w-full p-5 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all group/btn active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-3">
                          {doc.mode === 'download' ? <Download size={18} /> : <ExternalLink size={18} />}
                          {doc.mode === 'download' ? t('research:detail.gateway.fetchPdf') : t('research:detail.gateway.external')}
                        </span>
                        <ArrowUpRight size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                      </a>
                    ) : (
                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] text-slate-500 font-black uppercase tracking-widest text-center italic">
                        {t('research:detail.gateway.unavailable')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Publication Context */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 px-4 mb-4">{t('research:detail.metadata.title')}</p>
                <InfoCard label={t('research:detail.metadata.publisher')} value={item.publisher} />
                <InfoCard label={t('research:detail.metadata.journal')} value={item.journal} />
                <InfoCard label={t('research:detail.metadata.volumeIssue')} value={t('research:detail.metadata.volumeIssueValue', { volume: item.volume, issue: item.issue })} />
                <InfoCard label={t('research:detail.metadata.pagination')} value={item.pages} />
              </div>

              {isAuthenticated && canWithdrawDetail && (
                <div className="rounded-[32px] border border-rose-100 bg-rose-50/50 p-6">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={openWithdrawModal}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 shadow-lg shadow-rose-600/20"
                  >
                    {actionBusy && !withdrawOpen ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {t('research:detail.actions.withdraw')}
                  </button>
                </div>
              )}

              {/* Lab Security Footer */}
              <div className="mx-4 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-3 opacity-40">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-[0.3em]">{t('research:detail.verifiedFooter')}</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={withdrawOpen && !!item}
        title={t('research:mine.confirmModal.title')}
        description={t('research:mine.actions.deleteConfirm')}
        confirmLabel={t('research:mine.confirmModal.confirm')}
        cancelLabel={t('research:mine.confirmModal.cancel')}
        loading={withdrawOpen && actionBusy}
        reasonField={
          item && isDirector && item.status === 'approved'
            ? {
                label: t('research:detail.withdrawReason.label'),
                placeholder: t('research:detail.withdrawReason.placeholder'),
                value: withdrawReason,
                onChange: setWithdrawReason,
                show: true,
              }
            : undefined
        }
        onConfirm={() => void executeWithdraw()}
        onClose={() => {
          if (actionBusy) return;
          setWithdrawOpen(false);
          setWithdrawReason('');
        }}
      />
    </div>
  );
};

/* --- SUB-COMPONENTS --- */

const MetaItem: React.FC<{ icon: React.ReactNode; label: string; value: string | undefined }> = ({ icon, label, value }) => {
  const { t } = useTranslation();
  return (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <span className="text-xs font-bold text-slate-900">{value || t('research:detail.fallback.unspecified')}</span>
  </div>
  );
};

const TechBox: React.FC<{ icon: React.ReactNode; label: string; value: string | undefined; isMono?: boolean }> = ({ icon, label, value, isMono }) => {
  const { t } = useTranslation();
  return (
  <div className="p-6 bg-white border border-slate-100 rounded-[24px] hover:border-indigo-100 transition-colors shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    </div>
    <p className={`text-sm font-bold text-slate-800 break-all ${isMono ? 'font-mono' : ''}`}>{value || t('research:detail.fallback.dataNotFound')}</p>
  </div>
  );
};

const InfoCard: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => {
  const { t } = useTranslation();
  return (
  <div className="p-5 bg-white border border-slate-100 rounded-2xl group hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300">
    <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1 group-hover:text-indigo-600 transition-colors">{label}</div>
    <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{value || t('research:detail.fallback.na')}</div>
  </div>
  );
};

export default ResearchDetail;