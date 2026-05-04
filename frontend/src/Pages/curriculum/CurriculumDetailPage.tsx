import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  ChevronLeft, Loader2, Download, FileText,
  History, User, Tag, ShieldCheck, Box,
  Info, ArrowUpRight, Cpu, Clock, Network, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { curriculumService } from '../../services/curriculum.service';
import type { CurriculumItem } from '../../types';
import { curriculumApprovedAt, curriculumCreatedAt } from '../../utils/curriculum';
import { PdfPreviewPanel } from '../../components/preview/PdfPreviewPanel';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ROUTER } from '../../routes/router';
import ConfirmDialog from '../../components/ConfirmDialog';

const curriculumAsideContainerVars: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const curriculumAsideItemVars: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100 },
  },
};

const CurriculumDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CurriculumItem | null>(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [openFileUrl, setOpenFileUrl] = useState<string | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  const canWithdrawCurriculum = useMemo(() => {
    if (!data || !user) return false;
    const dir = user.system_role === 'vien_truong';
    const owner = data.created_by === user.id;
    if (!owner && !dir) return false;
    if (['draft', 'pending', 'rejected'].includes(data.status)) return true;
    return dir;
  }, [data, user]);

  const showCurriculumWithdrawReason =
    !!user &&
    user.system_role === 'vien_truong' &&
    !!data &&
    ['approved', 'revision', 'archived'].includes(data.status);

  const openWithdrawCurriculumModal = () => {
    setWithdrawReason('');
    setWithdrawOpen(true);
  };

  const executeWithdrawCurriculum = async () => {
    if (!id || !data) return;
    const reason = showCurriculumWithdrawReason ? withdrawReason.trim() : '';
    setWithdrawBusy(true);
    try {
      await curriculumService.remove(id, reason ? { reason } : undefined);
      setWithdrawOpen(false);
      setWithdrawReason('');
      toast.success(t('curriculum:detail.toasts.withdrawn'));
      navigate(ROUTER.USER.CURRICULUM);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('curriculum:detail.toasts.withdrawFailed');
      toast.error(typeof msg === 'string' ? msg : t('curriculum:detail.toasts.withdrawFailed'));
    } finally {
      setWithdrawBusy(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    curriculumService
      .getOne(id)
      .then((res) => setData(res.data))
      .catch(() => toast.error(t('curriculum:detail.toasts.fetchFailed')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (!id || loading) return;
    curriculumService
      .getDownloadUrl(id)
      .then((r) => setOpenFileUrl(r.data?.url?.trim() || null))
      .catch(() => setOpenFileUrl(null));
  }, [id, loading]);

  const loadPreviewBlob = useCallback(() => {
    if (!id) return Promise.reject(new Error(t('curriculum:detail.errors.missingId')));
    return curriculumService.getPreviewBlob(id);
  }, [id, t]);

  const onDownload = async () => {
    if (!id) return;
    setDlLoading(true);
    try {
      const res = await curriculumService.getDownloadUrl(id);
      if (res.data?.url) window.open(res.data.url, '_blank');
      else toast.error(t('curriculum:detail.toasts.noFileSource'));
    } catch {
      toast.error(t('curriculum:detail.toasts.downloadFailed'));
    } finally {
      setDlLoading(false);
    }
  };

  // Hoạt ảnh Loading cực chất
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020408] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,#020408_100%)] opacity-50" />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Loader2 className="w-12 h-12 text-cyan-500 mb-6" />
        </motion.div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-500 animate-pulse relative z-10">
          {t('curriculum:detail.loading')}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const directPdfUrl =
    (data.pdf_url?.trim() && /^https?:\/\//i.test(data.pdf_url) ? data.pdf_url.trim() : null) ||
    (data.file_path?.trim() && /^https?:\/\//i.test(data.file_path) ? data.file_path.trim() : null) ||
    null;

  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="min-h-screen bg-[#020408] text-slate-300 font-mono pb-24 selection:bg-cyan-500/30">
      
      {/* Background FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#0f172a_0%,#020408_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 max-w-[1700px] mx-auto px-6 lg:px-10 pt-10">
        
        {/* Header & Back Button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 group-hover:text-cyan-400 transition-all">
              <ChevronLeft size={18} />
            </div>
            <span>{t('curriculum:detail.back')}</span>
          </button>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          
          {/* LEFT COLUMN: PDF Preview (Chiếm 8/12 cột) */}
          <motion.main 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="lg:col-span-8 order-2 lg:order-1 flex flex-col h-[600px] lg:h-[800px]"
          >
            <div className="flex-1 bg-[#0d1117]/80 backdrop-blur-2xl border border-white/5 rounded-[32px] overflow-hidden shadow-2xl relative group">
              {/* Scanline Effect cho khung PDF */}
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[size:100%_4px] pointer-events-none z-10" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <PdfPreviewPanel
                title={t('curriculum:detail.previewTitle', { title: data.title })}
                loadPreviewBlob={loadPreviewBlob}
                gateLoading={loading}
                tabOpenUrl={directPdfUrl || openFileUrl}
                onRetryOpenTab={onDownload}
              />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
               <Info size={14} className="text-cyan-500" />
               {t('curriculum:detail.previewHint')}
            </div>
          </motion.main>

          {/* RIGHT COLUMN: Information & Actions (Chiếm 4/12 cột) */}
          <motion.aside
            variants={curriculumAsideContainerVars}
            initial="hidden"
            animate="show"
            className="lg:col-span-4 order-1 lg:order-2 space-y-8"
          >
            
            {/* Title & Meta Block */}
            <motion.div variants={curriculumAsideItemVars}>
              <div className="flex items-center gap-3 mb-6">
                <Network size={16} className="text-cyan-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500">{t('curriculum:detail.nodeProfile')}</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-black text-white uppercase italic tracking-tighter leading-[1.1] mb-6 line-clamp-3">
                {data.title}
              </h1>
              
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2">
                  <Tag size={14} className="text-cyan-400 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                    {data.category?.name || t('curriculum:detail.uncategorized')}
                  </span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    v{data.version_number}.0 • {t(`curriculum:status.${data.status}`, { defaultValue: data.status })}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Author Block */}
            <motion.div variants={curriculumAsideItemVars} className="flex items-center gap-5 p-5 rounded-[24px] bg-[#0d1117]/60 border border-white/5 backdrop-blur-md">
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-slate-800 to-black p-[1px] shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                 <div className="w-full h-full rounded-[19px] bg-[#0d1117] flex items-center justify-center">
                    <User size={24} className="text-slate-400" />
                 </div>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-1">{t('curriculum:detail.leadInvestigator')}</span>
                <h4 className="text-lg font-black text-white uppercase tracking-tight italic">
                  {data.authors || t('curriculum:detail.classifiedIdentity')}
                </h4>
              </div>
            </motion.div>

            {/* Download Action Card (Thiết kế lại chuẩn xịn) */}
            <motion.div variants={curriculumAsideItemVars} className="relative p-1 rounded-[32px] bg-gradient-to-b from-cyan-500/30 to-transparent group">
               <div className="absolute inset-0 bg-cyan-500/10 blur-[30px] opacity-0 group-hover:opacity-100 transition-all duration-700 rounded-[32px]" />
               <div className="relative p-6 bg-[#010204]/90 backdrop-blur-2xl rounded-[30px] border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                         <FileText size={18} />
                       </div>
                       <div>
                         <h3 className="text-xs font-black uppercase tracking-widest text-white truncate max-w-[150px]">{data.title}.pdf</h3>
                         <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('curriculum:detail.formatPdf')}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={onDownload}
                      disabled={dlLoading}
                      className="w-full h-14 rounded-2xl bg-white text-black flex items-center justify-center gap-3 text-[11px] font-[1000] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 transition-all"
                    >
                      {dlLoading ? <Loader2 className="animate-spin text-black" size={18} /> : <Download size={18} />}
                      {t('curriculum:detail.actions.download')}
                    </motion.button>
                    
                    {data.pdf_url && (
                      <a
                        href={data.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full h-12 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                      >
                        {t('curriculum:detail.actions.externalSource')} <ArrowUpRight size={14} />
                      </a>
                    )}
                    {canWithdrawCurriculum && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={withdrawBusy}
                        onClick={openWithdrawCurriculumModal}
                        className="w-full h-12 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {withdrawBusy ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                        {t('curriculum:detail.actions.withdraw')}
                      </motion.button>
                    )}
                  </div>
               </div>
            </motion.div>

            {/* Abstract Section */}
            <motion.div variants={curriculumAsideItemVars} className="relative pl-5 border-l-2 border-cyan-500/30">
              <h3 className="text-[10px] font-[1000] uppercase tracking-[0.3em] text-cyan-500 mb-3 flex items-center gap-2">
                {t('curriculum:detail.abstractTitle')}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-sans italic opacity-80">
                &ldquo;{data.description || t('curriculum:detail.noDescription')}&rdquo;
              </p>
            </motion.div>

            {/* History / Timeline */}
            <motion.div variants={curriculumAsideItemVars} className="p-8 rounded-[32px] bg-slate-900/40 border border-white/5 backdrop-blur-sm">
              <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">
                <History size={16} /> {t('curriculum:detail.trailTitle')}
              </h3>
              <div className="space-y-8 relative">
                <div className="absolute left-3.5 top-2 bottom-2 w-[1px] bg-white/10" />
                
                <div className="flex gap-6 relative group">
                  <div className="w-7 h-7 rounded-full bg-[#0d1117] border-2 border-cyan-500 flex items-center justify-center shrink-0 z-10">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan] animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1 group-hover:text-cyan-400 transition-colors">{t('curriculum:detail.trail.approved')}</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-tighter flex items-center gap-1">
                      <Clock size={10} /> {new Date(curriculumApprovedAt(data)).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-6 relative group">
                  <div className="w-7 h-7 rounded-full bg-[#0d1117] border-2 border-slate-700 flex items-center justify-center shrink-0 z-10">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-white transition-colors">{t('curriculum:detail.trail.initialized')}</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-tighter flex items-center gap-1">
                      <Clock size={10} /> {new Date(curriculumCreatedAt(data)).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Footer Metadata */}
            <motion.div variants={curriculumAsideItemVars} className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-[24px] bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors cursor-default">
                <Box size={18} className="text-slate-500" />
                <span className="text-sm font-black text-white uppercase tracking-widest">PDF/A</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('curriculum:detail.meta.standardFormat')}</span>
              </div>
              <div className="p-5 rounded-[24px] bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors cursor-default">
                <Cpu size={18} className="text-slate-500" />
                <span className="text-sm font-black text-white uppercase tracking-widest">ACL_01</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('curriculum:detail.meta.viewDownload')}</span>
              </div>
            </motion.div>

          </motion.aside>

        </div>
      </div>

      <ConfirmDialog
        open={withdrawOpen && !!data}
        title={t('curriculum:detail.confirmModal.title')}
        description={t('curriculum:detail.withdrawConfirm')}
        confirmLabel={t('curriculum:detail.confirmModal.confirm')}
        cancelLabel={t('curriculum:detail.confirmModal.cancel')}
        loading={withdrawOpen && withdrawBusy}
        reasonField={
          showCurriculumWithdrawReason
            ? {
                label: t('curriculum:detail.withdrawReasonLabel'),
                placeholder: t('curriculum:detail.withdrawReasonPlaceholder'),
                value: withdrawReason,
                onChange: setWithdrawReason,
                show: true,
              }
            : undefined
        }
        onConfirm={() => void executeWithdrawCurriculum()}
        onClose={() => {
          if (withdrawBusy) return;
          setWithdrawOpen(false);
          setWithdrawReason('');
        }}
      />
    </div>
  );
};

export default CurriculumDetailPage;