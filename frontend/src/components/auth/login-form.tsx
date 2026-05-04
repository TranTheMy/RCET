import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { Mail, Lock, ArrowRight, Loader2, Fingerprint, Eye, EyeOff } from 'lucide-react';
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
import { isValidEmailFormat } from '../../utils/clientValidation';

const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const clearErrors = () => {
    setFieldErrors({});
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) {
      next.email = t('auth:login.errors.emailRequired');
    } else if (!isValidEmailFormat(email)) {
      next.email = t('auth:login.errors.emailInvalid');
    }
    if (!password) {
      next.password = t('auth:login.errors.passwordRequired');
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    try {
      await login(email.trim(), password);
      const user = useAuthStore.getState().user;
      if (user?.status === 'pending') {
        navigate('/pending-approval');
      } else {
        toast.success(t('auth:login.success'));
        if (user?.system_role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } catch (err: unknown) {
      const { message, fieldErrors: apiFields } = parseApiFormError(err);
      const apiFieldsTr = translateFieldErrors(t, apiFields);
      const msg =
        message != null && message !== ''
          ? translateApiMessage(t, message)
          : t('auth:login.errors.accessDenied');
      if (apiFieldsTr.email) setFieldErrors((f) => ({ ...f, email: apiFieldsTr.email }));
      if (apiFieldsTr.password) setFieldErrors((f) => ({ ...f, password: apiFieldsTr.password }));

      const hasApiField = Boolean(apiFields.email || apiFields.password);
      const raw = message || '';
      if (!hasApiField) {
        if (/invalid email or password/i.test(raw)) {
          setFieldErrors({ email: msg, password: msg });
        } else if (/please verify your email before logging in/i.test(raw)) {
          setFieldErrors({ email: msg });
        } else if (/your account has been rejected|your account has been locked/i.test(raw)) {
          setFormError(msg);
        } else {
          setFormError(msg);
        }
      }
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authService.getGoogleAuthUrl();
  };

  return (
    <div className="w-full text-left">
      <form className="space-y-5 text-left" onSubmit={handleSubmit}>
        {formError ? (
          <p
            className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2.5 text-left text-[10px] font-medium leading-snug tracking-normal text-rose-200/90"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        {/* Email Field — icon + input trong một khối relative riêng để top-1/2 không tính cả dòng lỗi */}
        <div>
          <div className="relative group">
            <div
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${
                fieldErrors.email ? 'text-rose-400/85' : 'text-slate-500 group-focus-within:text-cyan-400'
              }`}
            >
              <Mail size={18} strokeWidth={2} />
            </div>
            <input
              type="email"
              placeholder={t('auth:login.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((f) => ({ ...f, email: undefined }));
                setFormError(null);
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
              className={`pointer-events-none absolute left-4 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center transition-colors ${
                fieldErrors.password ? 'text-rose-400/85' : 'text-slate-500 group-focus-within:text-cyan-400'
              }`}
            >
              <Lock size={18} strokeWidth={2} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth:login.passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, password: undefined }));
                setFormError(null);
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
              className={authPasswordInputClassNames(Boolean(fieldErrors.password))}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-500 transition-colors hover:text-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
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

        {/* Forgot Password Link - ĐÃ FIX LỖI SIZE TẠI ĐÂY */}
        <div className="flex justify-end pt-1">
          <Link 
            to="/forgot-password" 
            className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 transition-colors"
          >
            {t('auth:login.forgotPassword')}
          </Link>
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
              {t('auth:login.submit')}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center py-6">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="px-4 text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">{t('auth:login.externalNode')}</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Google Login */}
        <button 
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
        >
          <FcGoogle className="mr-3 text-lg" /> {t('auth:login.googleLink')}
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-12 text-center">
        <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
          {t('auth:login.noClearance')}{' '}
          <Link 
            to="/register" 
            className="text-cyan-500 hover:text-white transition-colors underline underline-offset-4 decoration-cyan-500/30"
          >
            {t('auth:login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;