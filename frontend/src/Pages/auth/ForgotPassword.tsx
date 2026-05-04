import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import { isValidEmailFormat } from '../../utils/clientValidation';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('auth:forgotPassword.errors.missingEmail'));
      return;
    }
    if (!isValidEmailFormat(email)) {
      toast.error(t('auth:forgotPassword.errors.emailInvalid'));
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword({ email: email.trim() });
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        translateApiMessage(t, error.response?.data?.message as string | undefined) ||
          t('common:errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* Hiệu ứng ánh sáng nền (Glow Effect) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nút quay lại góc trái */}
      <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors z-10">
        <ArrowLeft size={16} /> {t('auth:login.title')}
      </Link>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/10 p-10 relative overflow-hidden group">
          
          {/* Highlight viền trên */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

          {!success ? (
            <>
              <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                <Mail className="text-cyan-400" size={28} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter text-center mb-2 uppercase italic">
                {t('auth:forgotPassword.title1')} <br/> <span className="text-cyan-400">{t('auth:forgotPassword.title2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium text-center mb-8 opacity-80 leading-relaxed">
                {t('auth:forgotPassword.subtitle')}
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative group/input">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" size={20} />
                  <input
                    type="email"
                    placeholder={t('auth:forgotPassword.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all text-sm font-bold text-white placeholder:text-slate-500"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-cyan-500 text-[#020617] rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : t('auth:forgotPassword.submit')}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter mb-2 uppercase italic">
                {t('auth:forgotPassword.sentTitle1')} <br/> <span className="text-green-400">{t('auth:forgotPassword.sentTitle2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                {t('auth:forgotPassword.sentHintPrefix')} <strong className="text-white bg-white/10 px-2 py-1 rounded-md">{email}</strong> {t('auth:forgotPassword.sentHintSuffix')}
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full gap-2 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] hover:bg-white/10 hover:border-cyan-500/30 transition-all"
              >
                <ArrowLeft size={14} /> {t('auth:forgotPassword.backToLogin')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;