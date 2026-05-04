import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Clock, ShieldAlert, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth.service';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    () => token ? 'loading' : 'error'
  );
  const [message, setMessage] = useState(
    () => token ? '' : t('auth:verifyEmail.invalidToken')
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    authService.verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        setStatus('success');
        const okRaw = res.data?.message || res.message;
        setMessage(
          typeof okRaw === 'string' && okRaw.trim()
            ? translateApiMessage(t, okRaw)
            : t('auth:verifyEmail.successDefault'),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setMessage(
          (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
            t('auth:verifyEmail.errorDefault'),
        );
      });

    return () => { cancelled = true; };
  }, [token, t]);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-[40px] border border-white/10 p-10 shadow-3xl text-center relative overflow-hidden group">
          
          {/* Top highlight bar */}
          <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-500 ${
            status === 'loading' ? 'bg-cyan-500' : status === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`} />

          {status === 'loading' && (
            <div className="py-6 animate-in fade-in duration-500">
              <div className="relative w-20 h-20 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
                <Loader2 className="w-20 h-20 text-cyan-400 animate-spin absolute inset-0" strokeWidth={1} />
              </div>
              <h1 className="text-2xl font-[950] text-white tracking-tighter uppercase italic mb-3">
                {t('auth:verifyEmail.loadingTitle1')} <br/> <span className="text-cyan-400">{t('auth:verifyEmail.loadingTitle2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium opacity-70">{t('auth:verifyEmail.loadingHint')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                <CheckCircle2 className="w-10 h-10 text-green-400" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter uppercase italic mb-4">
                {t('auth:verifyEmail.doneTitle1')} <br/> <span className="text-green-400">{t('auth:verifyEmail.doneTitle2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed italic">"{message}"</p>
              
              {/* Next Step Card - UI R&D Style */}
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-[24px] p-5 mb-10 text-left relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <Clock size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">{t('auth:verifyEmail.nextSteps')}</span>
                </div>
                <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                  {t('auth:verifyEmail.pendingApprovalPrefix')} <span className="text-white font-bold italic">{t('auth:verifyEmail.pendingApprovalEmphasis')}</span> {t('auth:verifyEmail.pendingApprovalSuffix')}
                </p>
              </div>

              <Link
                to="/login"
                className="group flex items-center justify-center gap-3 w-full bg-white text-[#020617] py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all shadow-xl"
              >
                {t('auth:verifyEmail.backToLogin')} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                <ShieldAlert className="w-10 h-10 text-red-400" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-[950] text-white tracking-tighter uppercase italic mb-4">
                {t('auth:verifyEmail.errorTitle1')} <br/> <span className="text-red-400">{t('auth:verifyEmail.errorTitle2')}</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mb-10 leading-relaxed">
                {message}
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:border-red-500/30 transition-all"
              >
                {t('common:nav.home')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;