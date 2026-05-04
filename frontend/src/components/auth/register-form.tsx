import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Loader2, Fingerprint, Database, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../hooks/useAuth';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import {
  authFieldErrorMessageClassNames,
  authInputClassNames,
  authPasswordInputClassNames,
  parseApiFormError,
} from '../../utils/formFieldErrors';
import { translateApiMessage, translateFieldErrors } from '../../utils/apiErrorI18n';
import { isValidEmailFormat, validatePasswordPolicy } from '../../utils/clientValidation';

type RegisterFieldKey = 'fullName' | 'email' | 'password' | 'confirmPassword';

const RegisterForm: React.FC = () => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterFieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const clearField = (key: RegisterFieldKey) => {
    setFieldErrors((f) => ({ ...f, [key]: undefined }));
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const required: Partial<Record<RegisterFieldKey, string>> = {};
    if (!fullName.trim()) required.fullName = t('auth:register.errors.fullNameRequired');
    if (!email.trim()) required.email = t('auth:register.errors.emailRequired');
    if (!password) required.password = t('auth:register.errors.passwordRequired');
    if (!confirmPassword) required.confirmPassword = t('auth:register.errors.confirmPasswordRequired');
    if (Object.keys(required).length > 0) {
      setFieldErrors(required);
      return;
    }

    if (!isValidEmailFormat(email)) {
      setFieldErrors({ email: t('auth:register.errors.emailInvalid') });
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: t('auth:register.errors.passwordMismatch') });
      return;
    }
    const policy = validatePasswordPolicy(password);
    if (!policy.ok) {
      setFieldErrors({
        password:
          policy.reason === 'minLength'
            ? t('auth:register.errors.minLength')
            : t('auth:register.errors.complexity'),
      });
      return;
    }

    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password });
      toast.success(t('auth:register.success'));
      navigate('/pending-approval');
    } catch (err: unknown) {
      const { message, fieldErrors: apiFields } = parseApiFormError(err);
      const apiFieldsTr = translateFieldErrors(t, apiFields);
      const msg =
        translateApiMessage(t, message || '') || t('auth:register.errors.requestDenied');
      const fe: Partial<Record<RegisterFieldKey, string>> = {};

      if (apiFieldsTr.full_name) fe.fullName = apiFieldsTr.full_name;
      if (apiFieldsTr.email) fe.email = apiFieldsTr.email;
      if (apiFieldsTr.password) fe.password = apiFieldsTr.password;

      if (
        !fe.email &&
        !fe.fullName &&
        !fe.password &&
        /email already registered/i.test(message || '')
      ) {
        fe.email = translateApiMessage(t, message || '');
      }
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
      } else {
        setFormError(msg);
      }
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = authService.getGoogleAuthUrl();
  };

  const iconClass = (hasErr: boolean) =>
    hasErr ? 'text-rose-400/85' : 'text-slate-500 group-focus-within:text-cyan-400';

  return (
    <div className="w-full text-left">
      {/* Header Module */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Database size={14} className="text-cyan-500" />
          <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.3em]">{t('auth:register.header.kicker')}</span>
        </div>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
          {t('auth:register.header.title1')} <span className="text-cyan-400">{t('auth:register.header.title2')}</span>
        </h1>
        <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
          {t('auth:register.header.subtitle')}
        </p>
      </div>

      <form className="space-y-5 text-left" onSubmit={handleSubmit}>
        {formError ? (
          <p
            className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2.5 text-left text-[10px] font-medium leading-snug tracking-normal text-rose-200/90"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        {/* Full Name — khối relative chỉ bọc input + icon (không gồm dòng lỗi) */}
        <div>
          <div className="relative group">
            <div
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${iconClass(Boolean(fieldErrors.fullName))}`}
            >
              <User size={18} strokeWidth={2} />
            </div>
            <input
              type="text"
              placeholder={t('auth:register.fullNamePlaceholder')}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearField('fullName');
              }}
              aria-invalid={Boolean(fieldErrors.fullName)}
              className={authInputClassNames(Boolean(fieldErrors.fullName))}
            />
          </div>
          {fieldErrors.fullName ? (
            <p className={authFieldErrorMessageClassNames()} role="alert">
              {fieldErrors.fullName}
            </p>
          ) : null}
        </div>

        {/* Email Field */}
        <div>
          <div className="relative group">
            <div
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${iconClass(Boolean(fieldErrors.email))}`}
            >
              <Mail size={18} strokeWidth={2} />
            </div>
            <input
              type="email"
              placeholder={t('auth:register.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearField('email');
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              className={authInputClassNames(Boolean(fieldErrors.email))}
            />
          </div>
          {fieldErrors.email ? (
            <p className={authFieldErrorMessageClassNames()} role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        {/* Password Field */}
        <div>
          <div className="relative group">
            <div
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${iconClass(Boolean(fieldErrors.password))}`}
            >
              <Lock size={18} strokeWidth={2} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth:register.passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearField('password');
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              className={authPasswordInputClassNames(Boolean(fieldErrors.password))}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-500 transition-colors hover:text-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? t('auth:register.hidePassword') : t('auth:register.showPassword')}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className={authFieldErrorMessageClassNames()} role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {/* Confirm Password Field */}
        <div>
          <div className="relative group">
            <div
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${iconClass(Boolean(fieldErrors.confirmPassword))}`}
            >
              <ShieldCheck size={18} strokeWidth={2} />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t('auth:register.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearField('confirmPassword');
              }}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              className={authPasswordInputClassNames(Boolean(fieldErrors.confirmPassword))}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-500 transition-colors hover:text-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-pressed={showConfirmPassword}
              aria-label={showConfirmPassword ? t('auth:register.hideConfirmPassword') : t('auth:register.showConfirmPassword')}
            >
              {showConfirmPassword ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
            </button>
          </div>
          {fieldErrors.confirmPassword ? (
            <p className={authFieldErrorMessageClassNames()} role="alert">
              {fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="relative w-full py-4 bg-cyan-500 text-[#020617] rounded-xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-lg shadow-cyan-500/10 group mt-6 disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Fingerprint size={16} />
              {t('auth:register.submit')}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center py-5">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="px-4 text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">{t('auth:register.quickGateway')}</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Google Signup */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          className="flex items-center justify-center w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <FcGoogle className="mr-3 text-lg" /> {t('auth:register.googleLink')}
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-10 text-center">
        <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
          {t('auth:register.haveAccount')}{' '}
          <Link
            to="/login"
            className="text-cyan-500 hover:text-white transition-colors underline underline-offset-4 decoration-cyan-500/30 font-black"
          >
            {t('auth:register.loginNow')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
