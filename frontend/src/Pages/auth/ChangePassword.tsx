import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ChangePasswordPanel from '../../components/auth/ChangePasswordPanel';

/** Trang độc lập — có thể truy cập trực tiếp; route /change-password cũng redirect về /user-profile#doi-mat-khau */
const ChangePassword: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <Link
        to="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 transition-all group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        {t('common:nav.home')}
      </Link>

      <div className="w-full max-w-lg relative">
        <div className="absolute -top-2 -left-2 w-10 h-10 border-t-2 border-l-2 border-cyan-500/30 rounded-tl-2xl" />
        <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-2 border-r-2 border-cyan-500/30 rounded-br-2xl" />

        <div className="bg-[#0F172A]/80 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-[200%] -top-full animate-[scan_4s_linear_infinite] pointer-events-none" />

          <div className="flex flex-col items-center mb-8 text-center relative z-10">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mb-6">
              <KeyRound className="text-cyan-400" size={28} />
            </div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">{t('auth:changePassword.pageTitle')}</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              {t('auth:changePassword.pageSubtitle')}
            </p>
          </div>

          <div className="relative z-10">
            <ChangePasswordPanel embedded={false} />
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      ` }} />
    </div>
  );
};

export default ChangePassword;
