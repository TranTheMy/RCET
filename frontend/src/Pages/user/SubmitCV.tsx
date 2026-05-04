import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  User,
  Mail,
  Phone,
  X,
  Loader2,
  Cpu,
  Fingerprint,
  Database,
  FlaskConical,
  Microscope,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scientistApplicationService } from '../../services/scientistApplication.service';
import { authService } from '../../services/auth.service';
import type { ScientistApplicationItem } from '../../types';
import { useTranslation } from 'react-i18next';

const CV_POSITION = 'member' as const;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

const STATUS_SUBMITTED_LABEL: Record<string, string> = {
  pending_lab_review: 'pending_lab_review',
  lab_rejected: 'lab_rejected',
  pending_director_review: 'pending_director_review',
  director_rejected: 'director_rejected',
  approved: 'approved',
};

const RDSubmitCVPage: React.FC = () => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedApplication, setSavedApplication] = useState<ScientistApplicationItem | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: CV_POSITION,
    message: '',
  });
  /** null = chưa kiểm tra; true/false sau API check-phone */
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

  /** Lấy profile mới nhất từ BE (GET /auth/me) để điền form */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authService.getMe();
        const u = res.data;
        if (cancelled || !u) return;
        setFormData((prev) => ({
          ...prev,
          fullName: (u.full_name ?? '').trim() || prev.fullName,
          email: (u.email ?? '').trim() || prev.email,
          phone: digitsOnly((u.phone_number ?? '').trim()) || prev.phone,
          position: CV_POSITION,
        }));
      } catch {
        if (!cancelled) {
          toast.error(t('user:cv.submit.toasts.profileFetchFailed'));
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const phoneDigits = formData.phone;
    if (!phoneDigits) {
      setPhoneAvailable(null);
      return undefined;
    }
    if (phoneDigits.length < 8) {
      setPhoneAvailable(null);
      return undefined;
    }
    if (phoneDigits.length > 15) {
      setPhoneAvailable(false);
      return undefined;
    }
    const tmr = window.setTimeout(() => {
      scientistApplicationService
        .checkPhoneAvailable(phoneDigits)
        .then((ok) => setPhoneAvailable(ok))
        .catch(() => setPhoneAvailable(null));
    }, 450);
    return () => window.clearTimeout(tmr);
  }, [formData.phone]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error(t('user:cv.submit.toasts.fileTypeInvalid'));
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error(t('user:cv.submit.toasts.fileTooLarge'));
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = formData.fullName.trim();
    const email = formData.email.trim();
    const phoneDigits = digitsOnly(formData.phone);
    if (!fullName) {
      toast.error(t('user:cv.submit.toasts.fullNameRequired'));
      return;
    }
    if (!email) {
      toast.error(t('user:cv.submit.toasts.emailRequired'));
      return;
    }
    if (phoneDigits && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
      toast.error(t('user:cv.submit.toasts.phoneInvalidLength'));
      return;
    }
    if (phoneDigits && phoneAvailable === false) {
      toast.error(t('user:cv.submit.toasts.phoneTaken'));
      return;
    }
    if (!file) {
      toast.error(t('user:cv.submit.toasts.cvRequired'));
      return;
    }
    if (phoneDigits.length >= 8) {
      try {
        const ok = await scientistApplicationService.checkPhoneAvailable(phoneDigits);
        if (!ok) {
          toast.error(t('user:cv.submit.toasts.phoneTaken'));
          return;
        }
      } catch {
        toast.error(t('user:cv.submit.toasts.submitFailed'));
        return;
      }
    }
    setIsSubmitting(true);
    try {
      /** POST /api/scientist-applications — BE lưu bảng ScientistApplications, status mặc định pending_lab_review (chờ duyệt) */
      const resp = await scientistApplicationService.submit({
        fullName,
        email,
        position: CV_POSITION,
        phone: phoneDigits || undefined,
        coverLetter: formData.message.trim() || undefined,
        file,
      });
      const row = resp.data;
      setSavedApplication(row ?? null);
      setIsSuccess(true);
      toast.success(t('user:cv.submit.toasts.submitted'));
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string } } };
      const status = ax.response?.status;
      const msg = ax.response?.data?.message;
      if (status === 429) {
        toast.error(msg || t('user:cv.submit.toasts.cooldown'));
      } else {
        toast.error(msg || t('user:cv.submit.toasts.submitFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVars: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } },
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#010204] flex items-center justify-center font-mono p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#22d3ee05_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee05_1px,transparent_1px)] bg-[size:40px_40px]" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-lg w-full p-10 bg-[#0a0f18] border border-cyan-500/30 relative shadow-[0_0_50px_rgba(34,211,238,0.05)]"
        >
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

          <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/50 flex items-center justify-center mx-auto mb-6 relative">
            <div className="absolute inset-0 animate-ping opacity-20 bg-cyan-500" />
            <Fingerprint size={40} className="text-cyan-400" />
          </div>

          <h2 className="text-2xl font-black text-center text-white uppercase tracking-widest mb-2">{t('user:cv.submit.success.title')}</h2>
          <p className="text-xs text-center text-cyan-500 font-bold uppercase tracking-[0.3em] mb-4">{t('user:cv.submit.success.subtitle')}</p>
          {savedApplication?.status ? (
            <p className="text-[10px] text-center text-emerald-400/90 font-bold uppercase tracking-widest mb-6">
              {t('user:cv.submit.success.statusLabel')}: {t(`user:cv.status.${STATUS_SUBMITTED_LABEL[savedApplication.status] ?? savedApplication.status}`)}
              <span className="block text-slate-500 font-mono normal-case tracking-normal mt-1 text-[9px]">
                {t('user:cv.submit.success.recordLine', { id: savedApplication.id })}
              </span>
            </p>
          ) : (
            <p className="text-xs text-center text-slate-500 mb-8">{t('user:cv.submit.success.saved')}</p>
          )}

          <div className="p-4 bg-black/50 border border-white/5 font-mono text-xs text-slate-400 mb-8 leading-relaxed">
            {t('user:cv.submit.success.hint')}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setSavedApplication(null);
              setFile(null);
              setFormData({
                fullName: '',
                email: '',
                phone: '',
                position: CV_POSITION,
                message: '',
              });
              setPhoneAvailable(null);
              setProfileLoading(true);
              void authService
                .getMe()
                .then((res) => {
                  const u = res.data;
                  if (!u) return;
                  setFormData((prev) => ({
                    ...prev,
                    fullName: (u.full_name ?? '').trim() || prev.fullName,
                    email: (u.email ?? '').trim() || prev.email,
                    phone: digitsOnly((u.phone_number ?? '').trim()) || prev.phone,
                    position: CV_POSITION,
                  }));
                })
                .catch(() => {})
                .finally(() => setProfileLoading(false));
            }}
            className="w-full py-4 bg-white/5 border border-white/10 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-400 transition-all"
          >
            {t('user:cv.submit.success.submitAnother')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010204] text-slate-300 font-mono py-20 px-6 relative selection:bg-cyan-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-cyan-900/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute top-10 left-10 text-[150px] font-black text-white/[0.02] tracking-tighter uppercase rotate-90 origin-top-left whitespace-nowrap pointer-events-none">
          R&D HUB
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        <div className="mb-12 border-b border-white/10 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 bg-cyan-500/10 mb-4"
            >
              <Activity size={12} className="text-cyan-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-cyan-400">{t('user:cv.submit.kicker')}</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-[1000] text-white uppercase tracking-tighter flex items-center gap-4"
            >
              {t('user:cv.submit.title')} <FlaskConical className="text-cyan-500 w-10 h-10" />
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('user:cv.submit.purposeLabel')}</p>
            <p className="text-sm font-bold text-white uppercase tracking-widest">{t('user:cv.submit.purposeValue')}</p>
          </motion.div>
        </div>

        {/* Trái: tải CV — Phải: form liên hệ */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <motion.div variants={containerVars} initial="hidden" animate="show" className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            <motion.div
              variants={itemVars}
              className="p-8 bg-[#0a0f18]/80 border border-white/5 flex-1 flex flex-col relative overflow-hidden group"
            >
              {isDragging && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_15px_cyan] animate-[scan_2s_ease-in-out_infinite]" />
              )}

              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-6 flex items-center gap-3">
                <Database size={14} /> {t('user:cv.submit.cvFileLabel')}
              </h3>

              <div
                className={`flex-1 relative border border-dashed flex flex-col items-center justify-center p-6 transition-all duration-300 ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-white/10 hover:border-cyan-500/50 bg-black/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                />

                <AnimatePresence mode="wait">
                  {!file ? (
                    <motion.div
                      key="upload-prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center cursor-pointer w-full"
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="w-16 h-16 bg-[#010204] border border-white/10 flex items-center justify-center mx-auto mb-6 group-hover:border-cyan-500/30 transition-colors">
                        <UploadCloud size={24} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <p className="text-xs text-white font-black uppercase tracking-widest mb-2">{t('user:cv.submit.dropzone.title')}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{t('user:cv.submit.dropzone.hint')}</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="file-selected"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full text-center"
                    >
                      <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                        <FileText size={24} className="text-emerald-400" />
                      </div>
                      <p className="text-xs text-white font-black uppercase tracking-widest truncate w-full px-4 mb-2">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest mb-6">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setFile(null);
                        }}
                        className="px-4 py-2 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-rose-500/10 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <X size={12} /> {t('user:cv.submit.actions.removeFile')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.div variants={itemVars}>
              <button
                type="submit"
                disabled={isSubmitting || profileLoading}
                className="w-full relative h-16 bg-cyan-500 text-[#010204] flex items-center justify-center gap-3 text-xs font-[1000] uppercase tracking-[0.3em] hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500 ease-in-out" />

                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> {t('user:cv.submit.actions.submitting')}
                  </>
                ) : (
                  <>
                    <Cpu size={16} /> {t('user:cv.submit.actions.submit')}
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>

          <motion.div variants={containerVars} initial="hidden" animate="show" className="lg:col-span-7 space-y-6 order-1 lg:order-2">
            <div className="p-8 bg-[#0a0f18]/80 border border-white/5 relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-500" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-500" />

              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-2 flex items-center gap-3">
                <span className="w-2 h-2 bg-cyan-500" /> {t('user:cv.submit.contact.title')}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2">
                {profileLoading ? t('user:cv.submit.contact.syncing') : t('user:cv.submit.contact.synced')}
              </p>
              <p className="text-[8px] text-slate-600 font-mono uppercase tracking-wider mb-8 border-l-2 border-cyan-500/40 pl-3">
                {t('user:cv.submit.contact.cooldownHint')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <motion.div variants={itemVars} className="space-y-2 group">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t('user:cv.submit.fields.fullName')}</label>
                  <div className="relative">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors"
                      size={16}
                    />
                    <input
                      required
                      type="text"
                      placeholder={t('user:cv.submit.placeholders.fullName')}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      disabled={profileLoading}
                      className="w-full bg-black/50 border border-white/10 rounded-none pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all disabled:opacity-50"
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVars} className="space-y-2 group">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t('user:cv.submit.fields.email')}</label>
                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors"
                      size={16}
                    />
                    <input
                      required
                      type="email"
                      placeholder={t('user:cv.submit.placeholders.email')}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={profileLoading}
                      className="w-full bg-black/50 border border-white/10 rounded-none pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all disabled:opacity-50"
                    />
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <motion.div variants={itemVars} className="space-y-2 group">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t('user:cv.submit.fields.phone')}</label>
                  <div className="relative">
                    <Phone
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors"
                      size={16}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="tel"
                      placeholder={t('user:cv.submit.placeholders.phone')}
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: digitsOnly(e.target.value).slice(0, 15) })
                      }
                      disabled={profileLoading}
                      className={`w-full bg-black/50 border rounded-none pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:bg-cyan-500/5 transition-all disabled:opacity-50 ${
                        phoneAvailable === false
                          ? 'border-rose-500/60 focus:border-rose-500/50'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                  </div>
                  {phoneAvailable === false && (
                    <p className="text-[9px] text-rose-400 font-bold uppercase tracking-tight mt-1">
                      {t('user:cv.submit.toasts.phoneTaken')}
                    </p>
                  )}
                </motion.div>

                <motion.div variants={itemVars} className="space-y-2 group">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    {t('user:cv.submit.fields.position')}
                  </label>
                  <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">
                    {t('user:cv.submit.fields.positionMemberOnly')}
                  </p>
                  <div className="relative">
                    <Microscope
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors z-10 pointer-events-none"
                      size={16}
                    />
                    <select
                      value={formData.position}
                      onChange={() => setFormData((prev) => ({ ...prev, position: CV_POSITION }))}
                      disabled={profileLoading}
                      className="w-full bg-black/50 border border-white/10 rounded-none pl-12 pr-4 py-3.5 text-sm text-cyan-300 focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                    >
                      <option value={CV_POSITION}>{t('user:cv.submit.options.member')}</option>
                    </select>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={itemVars} className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t('user:cv.submit.fields.message')}</label>
                <textarea
                  placeholder={t('user:cv.submit.placeholders.message')}
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  disabled={profileLoading}
                  className="w-full bg-black/50 border border-white/10 rounded-none p-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all resize-none font-mono disabled:opacity-50"
                />
              </motion.div>
            </div>
          </motion.div>
        </form>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default RDSubmitCVPage;
