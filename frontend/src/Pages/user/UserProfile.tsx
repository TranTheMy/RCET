import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Shield,
  Edit2,
  Fingerprint,
  Database,
  CheckCircle2,
  Briefcase,
  Layers,
  FileCheck,
  ChevronRight,
  X,
  Loader2,
  Phone,
  KeyRound,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { researchService } from '../../services/research.service';
import { useAuthStore } from '../../store/authStore';
import type { Project } from '../../types';
import ChangePasswordPanel from '../../components/auth/ChangePasswordPanel';
import { useTranslation } from 'react-i18next';
import { parseApiFormError } from '../../utils/formFieldErrors';
import { translateApiMessage, translateFieldErrors } from '../../utils/apiErrorI18n';

const clearanceForRole = (role: string | null | undefined): string => {
  if (!role) return 'LEVEL 1 (STANDARD)';
  const map: Record<string, string> = {
    admin: 'LEVEL 5 (ROOT)',
    vien_truong: 'LEVEL 4 (EXEC)',
    truong_lab: 'LEVEL 4 (LAB)',
    /** legacy system_role; same clearance as member */
    leader: 'LEVEL 2 (CORE)',
    member: 'LEVEL 2 (CORE)',
    user: 'LEVEL 1 (STANDARD)',
  };
  return map[role] ?? 'LEVEL 1 (STANDARD)';
};

function formatDate(iso: string | undefined, locale: string, dash: string): string {
  if (!iso) return dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const UserProfile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, fetchUser, setUser } = useAuthStore();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    completedProjects: 0,
    activeProjects: 0,
    approvedPapers: 0,
  });

  const [form, setForm] = useState({
    full_name: '',
    student_code: '',
    department: '',
    phone_number: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'phone_number', string>>>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const loadProfile = useCallback(async () => {
    setBootLoading(true);
    try {
      await fetchUser();
    } catch {
      toast.error(t('user:profile.toasts.fetchFailed'));
    } finally {
      setBootLoading(false);
    }
  }, [fetchUser, t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (location.hash !== '#doi-mat-khau') return;
    const t = window.setTimeout(() => {
      document.getElementById('doi-mat-khau')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  useEffect(() => {
    if (!user) return;
    if (user.system_role === 'user') {
      setStatsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const [projPayload, resRes] = await Promise.all([
          projectService.list({ page: 1, limit: 200 }),
          researchService.listMine(),
        ]);
        if (cancelled) return;
        const projects: Project[] = projPayload.projects ?? [];
        const items = resRes.data?.items ?? [];
        const completedProjects = projects.filter((p) => p.status === 'done').length;
        const activeProjects = projects.filter((p) =>
          ['planning', 'active', 'paused'].includes(p.status),
        ).length;
        const approvedPapers = items.filter((r) => r.status === 'approved').length;
        setStats({ completedProjects, activeProjects, approvedPapers });
      } catch {
        if (!cancelled) toast.error(t('user:profile.toasts.statsFailed'));
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, user]);

  const startEdit = () => {
    if (!user) return;
    setForm({
      full_name: user.full_name,
      student_code: user.student_code ?? '',
      department: user.department ?? '',
      phone_number: user.phone_number ?? '',
    });
    setFieldErrors({});
    setIsEditing(true);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone_number') {
      const digits = value.replace(/\D/g, '').slice(0, 15);
      setForm((prev) => ({ ...prev, phone_number: digits }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.phone_number;
        return next;
      });
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/);
    if (!ext) {
      toast.error(t('user:profile.toasts.avatarTypeInvalid'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('user:profile.toasts.avatarTooLarge'));
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await authService.uploadAvatar(file);
      setUser(res.data);
      toast.success(res.message || t('user:profile.toasts.avatarUpdated'));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(translateApiMessage(t, msg) || t('user:profile.toasts.avatarUploadFailed'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const executeSaveProtocol = async () => {
    if (!user) return;
    const full_name = form.full_name.trim();
    if (full_name.length < 2) {
      toast.error(t('user:profile.toasts.nameTooShort'));
      return;
    }
    const phone = form.phone_number.trim();
    if (phone && (phone.length < 8 || phone.length > 15)) {
      const msg = t('user:profile.errors.phoneLength');
      setFieldErrors({ phone_number: msg });
      toast.error(msg);
      return;
    }
    setFieldErrors({});
    setIsSaving(true);
    try {
      const res = await authService.updateProfile({
        full_name,
        student_code: form.student_code.trim(),
        department: form.department.trim(),
        phone_number: phone || null,
      });
      setUser(res.data);
      toast.success(res.message || t('user:profile.toasts.updated'));
      setIsEditing(false);
    } catch (err: unknown) {
      const { message, fieldErrors: fe } = parseApiFormError(err);
      const feTr = translateFieldErrors(t, fe);
      if (feTr.phone_number) {
        setFieldErrors({ phone_number: feTr.phone_number });
      } else {
        toast.error(translateApiMessage(t, message || '') || t('user:profile.toasts.updateFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const displayNodeId = (u: NonNullable<typeof user>) =>
    u.student_code?.trim() ||
    `VKsLab-${u.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  if (bootLoading && !user) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-300 flex items-center justify-center pt-24">
        <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-400 flex items-center justify-center pt-24 font-mono text-sm">
        {t('user:profile.noUser')}
      </div>
    );
  }

  const dash = t('user:profile.dash');
  const roleLabel = user.system_role ? t(`user:profile.roles.${user.system_role}`) : dash;
  const statusLabel = t(`user:profile.status.${user.status}`);
  const nameDisplay = isEditing ? form.full_name : user.full_name;
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans pb-20 pt-24 px-4 md:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:40px_40px] opacity-10" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] font-black text-cyan-400 uppercase tracking-widest w-max mb-4">
              <Shield size={12} /> {t('user:profile.kicker')}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter">
              {t('user:profile.titlePrefix')} <span className="text-cyan-500">{t('user:profile.titleHighlight')}</span>
            </h1>
          </div>

          <div className="flex gap-3">
            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className="px-6 py-2.5 bg-[#0F172A] border border-cyan-500/30 text-cyan-400 text-[11px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)]"
              >
                <Edit2 size={14} /> {t('user:profile.actions.edit')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 hover:text-white transition-all disabled:opacity-50"
                >
                  <X size={14} /> {t('common:actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void executeSaveProtocol()}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-cyan-500 text-black text-[11px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> {t('user:profile.actions.saving')}
                    </>
                  ) : (
                    t('user:profile.actions.save')
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
              <Fingerprint size={120} className="absolute -top-10 -right-10 text-cyan-500/5 rotate-45" />
              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <div className="flex flex-col items-center z-10 w-full">
                <div className="relative w-32 h-32 bg-slate-900 rounded-2xl border border-cyan-500/30 flex items-center justify-center overflow-hidden rotate-45 mb-6">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover -rotate-45 scale-150"
                    />
                  ) : (
                    <span className="-rotate-45 text-5xl">👨‍💻</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all disabled:opacity-50 -mt-2 mb-2"
                >
                  {avatarUploading ? (
                    <Loader2 size={14} className="animate-spin shrink-0" />
                  ) : (
                    <Camera size={14} className="shrink-0" />
                  )}
                  {t('user:profile.actions.updateAvatar')}
                </button>
                <p className="text-[9px] text-slate-500 font-mono mb-4">{t('user:profile.avatarHint')}</p>
              </div>
              <p className="font-mono text-[10px] text-cyan-500 uppercase tracking-widest mb-1">
                {displayNodeId(user)}
              </p>
              <div className="text-[11px] font-black text-white uppercase tracking-widest px-4 py-2 bg-white/5 rounded-lg border border-white/10 italic">
                {nameDisplay}
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-3xl p-6 font-mono">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Database size={12} /> System_Log
              </p>
              <div className="space-y-2 text-[9px] text-slate-400">
                <p className="flex gap-2 text-emerald-500">
                  <CheckCircle2 size={12} /> {t('user:profile.systemLog.accessValid')}
                </p>
                <p className="flex gap-2">
                  <ChevronRight size={12} /> {t('user:profile.systemLog.accountStatus')}: {statusLabel}
                </p>
                <p className="flex gap-2">
                  <ChevronRight size={12} /> {t('user:profile.systemLog.role')}: {roleLabel}
                </p>
                <p className="flex gap-2">
                  <ChevronRight size={12} /> {t('user:profile.systemLog.clearance')}: {clearanceForRole(user.system_role)}
                </p>
                <p className="flex gap-2">
                  <ChevronRight size={12} /> {t('user:profile.systemLog.emailVerified')}: {user.email_verified ? t('user:profile.yes') : t('user:profile.no')}
                </p>
                <p className="flex gap-2">
                  <ChevronRight size={12} /> {t('user:profile.systemLog.joined')}: {formatDate(user.created_at, dateLocale, dash)}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {user.system_role !== 'user' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<Briefcase className="text-emerald-400" />}
                  label={t('user:profile.stats.completedProjects')}
                  value={stats.completedProjects}
                  loading={statsLoading}
                />
                <StatCard
                  icon={<Layers className="text-cyan-400" />}
                  label={t('user:profile.stats.activeProjects')}
                  value={stats.activeProjects}
                  loading={statsLoading}
                  isPulse={!statsLoading}
                />
                <StatCard
                  icon={<FileCheck className="text-amber-400" />}
                  label={t('user:profile.stats.approvedPapers')}
                  value={stats.approvedPapers}
                  loading={statsLoading}
                />
              </div>
            )}

            <div className="bg-[#0F172A]/30 border border-white/5 rounded-3xl p-8 space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 border-b border-white/5 pb-4">
                {t('user:profile.editableInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CyberInput
                  label={t('user:profile.fields.fullName')}
                  name="full_name"
                  value={isEditing ? form.full_name : user.full_name}
                  isEditing={isEditing}
                  onChange={handleInput}
                />
                <CyberInput
                  label={t('user:profile.fields.emailReadOnly')}
                  name="email"
                  value={user.email}
                  isEditing={false}
                  onChange={handleInput}
                  readOnly
                />
                <CyberInput
                  label={t('user:profile.fields.studentCode')}
                  name="student_code"
                  value={isEditing ? form.student_code : user.student_code ?? ''}
                  isEditing={isEditing}
                  onChange={handleInput}
                  placeholder={dash}
                />
                <CyberInput
                  label={t('user:profile.fields.department')}
                  name="department"
                  value={isEditing ? form.department : user.department ?? ''}
                  isEditing={isEditing}
                  onChange={handleInput}
                  placeholder={dash}
                />
                <CyberInput
                  label={t('user:profile.fields.phone')}
                  name="phone_number"
                  value={isEditing ? form.phone_number : user.phone_number ?? ''}
                  isEditing={isEditing}
                  onChange={handleInput}
                  placeholder={isEditing ? t('user:profile.placeholders.phone') : dash}
                  inputType="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  error={isEditing ? fieldErrors.phone_number : undefined}
                />
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] text-slate-500 font-mono space-y-1">
                <p>
                  {t('user:profile.meta.primaryKey')}: <span className="text-slate-400">{user.id}</span>
                </p>
                <p>
                  {t('user:profile.meta.hint', { role: roleLabel })}
                </p>
              </div>
            </div>

            <div
              id="doi-mat-khau"
              className="bg-[#0F172A]/30 border border-white/5 rounded-3xl p-8 scroll-mt-28"
            >
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 border-b border-white/5 pb-4 mb-6 flex items-center gap-2">
                <KeyRound size={14} className="text-cyan-500" />
                {t('user:profile.security')}
              </h3>
              <ChangePasswordPanel embedded />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  loading,
  isPulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  isPulse?: boolean;
}) => (
  <div className="bg-[#0F172A]/60 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 group transition-all">
    <div className="flex items-center justify-between">
      <div className={`p-2 rounded-lg bg-white/5 ${isPulse ? 'animate-pulse' : ''}`}>{icon}</div>
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      {loading ? (
        <div className="h-9 w-16 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-black text-white italic tracking-tighter">
          {value < 10 ? `0${value}` : value}
        </p>
      )}
    </div>
  </div>
);

const CyberInput = ({
  label,
  name,
  value,
  isEditing,
  onChange,
  readOnly,
  placeholder,
  inputType = 'text',
  inputMode,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  value: string;
  isEditing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  readOnly?: boolean;
  placeholder?: string;
  inputType?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  error?: string;
}) => (
  <div className="flex flex-col gap-2">
    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</label>
    {isEditing && !readOnly ? (
      <>
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-mono outline-none transition-all w-full ${
            error
              ? 'border border-rose-500/70 bg-rose-950/20 text-rose-100 focus:border-rose-400'
              : 'bg-[#020617] border border-white/10 text-cyan-300 focus:border-cyan-500'
          }`}
        />
        {error ? <p className="text-[10px] font-medium text-rose-300/95 leading-snug">{error}</p> : null}
      </>
    ) : (
      <div className="text-sm text-white font-bold uppercase tracking-tight min-h-[2.25rem] flex items-center gap-2">
        {name === 'phone_number' && value ? <Phone size={14} className="text-slate-500 shrink-0" /> : null}
        {value || placeholder || '—'}
      </div>
    )}
  </div>
);

export default UserProfile;
