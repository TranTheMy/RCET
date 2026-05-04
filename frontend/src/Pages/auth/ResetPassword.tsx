import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import { validatePasswordPolicy } from '../../utils/clientValidation';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error(t('auth:resetPassword.errors.invalidLink'));
      return;
    }
    if (!password || !confirmPassword) {
      toast.error(t('auth:resetPassword.errors.missingFields'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('auth:resetPassword.errors.passwordMismatch'));
      return;
    }
    const policy = validatePasswordPolicy(password);
    if (!policy.ok) {
      toast.error(
        policy.reason === 'minLength'
          ? t('auth:resetPassword.errors.minLength')
          : t('auth:resetPassword.errors.complexity')
      );
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        translateApiMessage(t, error.response?.data?.message as string | undefined) ||
          t('auth:resetPassword.errors.resetFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  // Trạng thái Token không hợp lệ
  if (!token) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10 text-center bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-xl rounded-[40px] border border-white/10 p-10 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <AlertTriangle className="text-red-400" size={28} />
          </div>
          <h1 className="text-3xl font-[950] text-white tracking-tighter uppercase italic mb-4">
            {t('auth:resetPassword.invalid.title1')} <br/> <span className="text-red-400">{t('auth:resetPassword.invalid.title2')}</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">{t('auth:resetPassword.invalid.subtitle')}</p>
          <Link to="/forgot-password" className="inline-flex items-center justify-center w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] hover:bg-white/10 hover:border-cyan-500/30 transition-all">
            {t('auth:resetPassword.invalid.requestNew')}
          </Link>
        </div>
      </div>
    );
  }

  // Trạng thái Form chính
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* Hiệu ứng ánh sáng nền (Glow Effect) */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nút quay lại */}
      <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors z-10">
        <ArrowLeft size={16} /> {t('common:actions.cancel', { defaultValue: 'Hủy bỏ' })}
      </Link>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/10 p-10 relative overflow-hidden group">
          
          {/* Highlight viền trên */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

          {!success ? (
            <>
              <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                <Lock className="text-cyan-400" size={28} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter text-center mb-2 uppercase italic">
                {t('auth:resetPassword.form.title1')} <br/> <span className="text-cyan-400">{t('auth:resetPassword.form.title2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium text-center mb-8 opacity-80 leading-relaxed">
                {t('auth:resetPassword.form.subtitle')}
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative group/input">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder={t('auth:resetPassword.form.newPasswordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all text-sm font-bold text-white placeholder:text-slate-500"
                  />
                </div>
                
                <div className="relative group/input">
                  <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder={t('auth:resetPassword.form.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all text-sm font-bold text-white placeholder:text-slate-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-2 bg-cyan-500 text-[#020617] rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : t('auth:resetPassword.form.submit')}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter mb-2 uppercase italic">
                {t('auth:resetPassword.success.title1')} <br/> <span className="text-green-400">{t('auth:resetPassword.success.title2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                {t('auth:resetPassword.success.subtitle')}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-4 bg-cyan-500 text-[#020617] rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_30px_rgba(34,211,238,0.2)]"
              >
                {t('auth:resetPassword.success.backToLogin')} <ArrowLeft size={14} className="rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;