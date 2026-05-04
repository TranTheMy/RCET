import React, { useState } from 'react';
import { Lock, ShieldCheck, Fingerprint, KeyRound, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';
import { validatePasswordPolicy } from '../../utils/clientValidation';
import { translateApiMessage } from '../../utils/apiErrorI18n';

interface PasswordFieldProps {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PasswordField: React.FC<PasswordFieldProps> = ({ icon, placeholder, value, onChange }) => (
  <div className="relative group">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors">
      {icon}
    </div>
    <input
      type="password"
      autoComplete={placeholder.includes('hiện tại') ? 'current-password' : 'new-password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full pl-12 pr-4 py-3.5 bg-[#020617]/80 border border-white/10 rounded-xl focus:border-cyan-500/50 focus:bg-[#020617] outline-none transition-all text-sm font-mono text-cyan-100 placeholder:text-slate-600 placeholder:text-[10px] placeholder:uppercase placeholder:tracking-widest"
    />
  </div>
);

type ChangePasswordPanelProps = {
  /** Gắn trong UserProfile — toast + reset, không chiếm full màn hình */
  embedded?: boolean;
};

const ChangePasswordPanel: React.FC<ChangePasswordPanelProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('auth:changePassword.errors.missingFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('auth:changePassword.errors.passwordMismatch'));
      return;
    }
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.ok) {
      toast.error(
        policy.reason === 'minLength'
          ? t('auth:changePassword.errors.minLength')
          : t('auth:changePassword.errors.complexity')
      );
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (embedded) {
        toast.success(t('auth:changePassword.success'));
        resetFields();
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        translateApiMessage(t, error.response?.data?.message as string | undefined) ||
          t('auth:changePassword.errors.failed'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && success) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-emerald-400" size={28} />
        </div>
        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">{t('auth:changePassword.doneTitle')}</h2>
        <p className="text-slate-500 text-xs mb-6">{t('auth:changePassword.doneSubtitle')}</p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            resetFields();
          }}
          className="inline-flex items-center gap-2 py-3 px-6 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          {t('auth:changePassword.changeAnother')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <KeyRound className="text-cyan-400" size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight">{t('auth:changePassword.title')}</h3>
          <p className="text-[10px] text-slate-500 font-medium">
            {t('auth:changePassword.hint')}
          </p>
        </div>
      </div>

      <PasswordField
        icon={<Lock size={18} />}
        placeholder={t('auth:changePassword.currentPasswordPlaceholder')}
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />

      <div className="py-1 flex items-center gap-3 opacity-40">
        <div className="h-px bg-slate-700 flex-1" />
        <Fingerprint size={14} className="text-slate-500" />
        <div className="h-px bg-slate-700 flex-1" />
      </div>

      <PasswordField
        icon={<ShieldCheck size={18} />}
        placeholder={t('auth:changePassword.newPasswordPlaceholder')}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />

      <PasswordField
        icon={<ShieldCheck size={18} />}
        placeholder={t('auth:changePassword.confirmPasswordPlaceholder')}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-cyan-600 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all shadow-[0_0_16px_rgba(6,182,212,0.15)] disabled:opacity-50 mt-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {t('auth:changePassword.submit')}
      </button>
    </form>
  );
};

export default ChangePasswordPanel;
