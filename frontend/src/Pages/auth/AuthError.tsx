import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldX, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AuthError: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || t('auth:error.defaultMessage');

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-red-500 selection:text-white relative overflow-hidden">
      
      {/* Hiệu ứng ánh sáng nền (Glow Effect) - Tông Đỏ/Tím cho trạng thái Lỗi */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-2xl rounded-[40px] shadow-3xl border border-white/10 p-10 text-center relative overflow-hidden group">
          
          {/* Cảnh báo viền đỏ trên cùng */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          {/* Icon Section */}
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 bg-red-500/10 rounded-3xl animate-pulse" />
            <div className="relative w-full h-full bg-red-500/5 border border-red-500/20 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <ShieldX className="text-red-400" size={36} strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-3xl font-[950] text-white tracking-tighter uppercase italic mb-3">
            {t('auth:error.title1')} <br/> <span className="text-red-500">{t('auth:error.title2')}</span>
          </h1>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg mb-8">
            <Terminal size={12} className="text-red-400" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Error Code: AUTH_FAILED</span>
          </div>

          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10 opacity-80 italic">
            "{message}"
          </p>

          <div className="space-y-4">
            <Link
              to="/login"
              className="group flex items-center justify-center gap-3 w-full bg-white text-[#020617] py-5 rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-xl"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
              {t('auth:error.backToLogin')}
            </Link>
            
            <Link
              to="/#contract"
              className="block w-full py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              {t('auth:error.reportIssue')}
            </Link>
          </div>

          {/* Decorative Corner */}
          <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-white/5 rotate-45" />
        </div>
      </div>
    </div>
  );
};

export default AuthError;