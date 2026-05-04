import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft, Terminal, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      {/* Hiệu ứng quét Radar (Background Decorative) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500/5 rounded-full pointer-events-none animate-[ping_5s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-cyan-500/10 rounded-full pointer-events-none" />
      
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10 text-center">
        {/* Số 404 khổng lồ với hiệu ứng Glitch mờ */}
        <div className="relative inline-block mb-8">
          <h1 className="text-[150px] md:text-[220px] font-[950] leading-none tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/5 opacity-20 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/20 rounded-3xl flex items-center justify-center backdrop-blur-xl shadow-[0_0_50px_rgba(34,211,238,0.2)] animate-bounce">
              <FileQuestion className="text-cyan-400" size={48} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Thông tin lỗi */}
        <div className="space-y-4 mb-12">
          <h2 className="text-4xl md:text-5xl font-[950] text-white tracking-tighter uppercase italic">
            {t('common:notFound.titlePrefix')} <br /> <span className="text-cyan-400">{t('common:notFound.titleHighlight')}</span>
          </h2>
          
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
            <Terminal size={14} className="text-cyan-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {t('common:notFound.statusLabel')}: <span className="text-cyan-400">{t('common:notFound.statusValue')}</span>
            </span>
          </div>

          <p className="text-slate-500 text-sm md:text-base font-medium max-w-md mx-auto leading-relaxed">
            {t('common:notFound.description')}
          </p>
        </div>

        {/* Nút điều hướng */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-3"
          >
            <ArrowLeft size={16} /> {t('common:notFound.actions.back')}
          </button>
          
          <Link
            to="/"
            className="w-full sm:w-auto px-10 py-5 bg-cyan-500 text-[#020617] rounded-2xl text-[11px] font-[950] uppercase tracking-[0.2em] hover:bg-white hover:scale-105 transition-all shadow-[0_0_40px_rgba(34,211,238,0.25)] flex items-center justify-center gap-3"
          >
            <Home size={16} /> {t('common:notFound.actions.home')}
          </Link>
        </div>

        {/* Footer trang trí dạng Tech-bar */}
        <div className="mt-20 flex items-center justify-center gap-8 opacity-20">
          <div className="h-[1px] w-20 bg-gradient-to-r from-transparent to-white" />
          <Cpu size={16} className="text-white" />
          <div className="h-[1px] w-20 bg-gradient-to-l from-transparent to-white" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;