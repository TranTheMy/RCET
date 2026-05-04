import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowLeft, Mail, ShieldAlert, Zap, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

const PendingApproval: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Back to Home Button */}
      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 transition-all z-10 group">
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> {t('common:nav.home')}
      </Link>

      <div className="w-full max-w-xl relative z-10">
        <div className="bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-2xl rounded-[48px] border border-white/10 p-10 md:p-14 shadow-3xl relative overflow-hidden group">
          
          {/* Status Indicator Bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />

          {/* Animated Clock Icon Section */}
          <div className="relative w-24 h-24 mx-auto mb-10">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-[32px] animate-ping opacity-20" />
            <div className="relative w-full h-full bg-cyan-500/10 border border-cyan-500/30 rounded-[32px] flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <Clock className="text-cyan-400 animate-[spin_8s_linear_infinite]" size={40} strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-4xl font-[950] text-white tracking-tighter text-center mb-4 uppercase italic">
            {t('auth:pendingApproval.title1')} <br/> <span className="text-cyan-400">{t('auth:pendingApproval.title2')}</span>
          </h1>
          
          <p className="text-slate-400 text-sm font-medium leading-relaxed text-center mb-10 max-w-sm mx-auto opacity-80">
            {t('auth:pendingApproval.subtitle')}
          </p>

          {/* User Info Card */}
          {user && (
            <div className="bg-white/[0.03] border border-white/10 rounded-[28px] p-6 mb-10 flex items-center gap-5 group/info hover:bg-white/[0.05] transition-all">
              <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center shrink-0">
                <Mail className="text-cyan-400" size={20} />
              </div>
              <div className="text-left">
                <p className="text-[9px] text-cyan-500 font-black uppercase tracking-[0.2em] mb-1">{t('auth:pendingApproval.identityConfig')}</p>
                <p className="text-sm font-bold text-white tracking-tight">{user.email}</p>
              </div>
            </div>
          )}

          {/* Steps Section - R&D Style */}
          <div className="space-y-4 mb-12">
            {[
              { id: "01", label: t('auth:pendingApproval.steps.1.label'), desc: t('auth:pendingApproval.steps.1.desc'), icon: <Zap size={14}/>, color: "text-blue-400" },
              { id: "02", label: t('auth:pendingApproval.steps.2.label'), desc: t('auth:pendingApproval.steps.2.desc'), icon: <ShieldAlert size={14}/>, color: "text-cyan-400" },
              { id: "03", label: t('auth:pendingApproval.steps.3.label'), desc: t('auth:pendingApproval.steps.3.desc'), icon: <Globe size={14}/>, color: "text-green-400" },
            ].map((step) => (
              <div key={step.id} className="flex items-start gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                <div className={`text-[10px] font-black ${step.color} mt-1`}>{step.id}</div>
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`p-1 rounded-md bg-white/5 ${step.color}`}>{step.icon}</span>
                    <h4 className="text-[11px] font-[950] text-white tracking-widest">{step.label}</h4>
                  </div>
                  <p className="text-[12px] text-slate-500 font-medium">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="flex-1 py-4 px-8 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:border-cyan-500/30 transition-all text-center"
            >
              {t('common:nav.home')}
            </Link>
            <button
              onClick={logout}
              className="flex-1 py-4 px-8 bg-cyan-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(34,211,238,0.2)]"
            >
              {t('common:actions.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;