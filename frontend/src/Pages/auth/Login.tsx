import React from 'react';
import { Cpu, ChevronLeft, ShieldCheck, Terminal, Activity, Fingerprint, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginForm from '../../components/auth/login-form';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30 selection:text-cyan-400 overflow-hidden relative">
      
      {/* BACKGROUND TECH ELEMENTS */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:30px_30px] opacity-10" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse delay-700" />

      {/* BACK TO HOME */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-cyan-400 transition-all group z-50"
      >
        <div className="w-7 h-7 rounded-full border border-slate-800 flex items-center justify-center group-hover:border-cyan-500/50 transition-all">
          <ChevronLeft size={12} />
        </div>
        {t('common:nav.home')}
      </Link>

      {/* MAIN CONTAINER: THU NHỎ LẠI TẠI ĐÂY */}
      <div className="w-full max-w-[1050px] bg-[#0F172A]/80 backdrop-blur-xl rounded-[32px] shadow-[0_0_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col lg:flex-row min-h-[600px] lg:min-h-[680px] border border-white/5 relative z-10">
        
        {/* CỘT TRÁI: AUTHENTICATION TERMINAL */}
        <div className="w-full lg:w-[42%] p-8 lg:p-12 flex flex-col justify-center relative bg-[#0F172A]">
          {/* Header Module */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-[1.5px] w-6 bg-cyan-500" />
              <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.3em]">Giao thức xác thực 2.0</span>
            </div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
              Truy cập <span className="text-cyan-400">hệ thống</span>
            </h1>
          </div>

          {/* Form Container: Đảm bảo LoginForm không bị quá rộng */}
          <div className="relative z-10 w-full max-w-sm mx-auto lg:mx-0">
            <div className="mb-6">
               <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest opacity-50 mb-1">Chào mừng trở lại</h3>
               <p className="text-slate-500 text-[11px]">Xác thực định danh thiết bị của bạn.</p>
            </div>
            
            {/* Chú ý: Cần đảm bảo các input trong LoginForm có style phù hợp */}
            <LoginForm />
          </div>

          {/* Status Bar */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em]">Máy chủ chính: Bật</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <Lock size={9} className="text-slate-600" />
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em]">Đã mã hóa</span>
                </div>
             </div>
          </div>
        </div>

        {/* CỘT PHẢI: RESEARCH VISUAL */}
        <div className="hidden lg:flex w-[58%] bg-[#020617] relative flex-col justify-between p-12 overflow-hidden group border-l border-white/5">
          
          <div className="absolute -top-10 -right-10 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px]" />
          
          {/* Top Info Bar */}
          <div className="relative z-10 flex justify-between items-center">
            <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-cyan-400 shadow-xl group-hover:border-cyan-500/40 transition-all">
              <Cpu size={24} />
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
              <Activity size={12} className="text-cyan-400 animate-pulse" />
              <span className="text-white font-black text-[8px] uppercase tracking-widest">Mạng lõi: Trực tuyến</span>
            </div>
          </div>

          {/* Center Content: Sửa kích thước chữ để không bị vỡ */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md mb-4">
               <Fingerprint size={10} className="text-indigo-400" />
               <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Quản lý định danh</span>
            </div>
            
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-[1] mb-6">
              Kiến tạo <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500">
                kiến trúc AI.
              </span>
            </h2>
            
            <div className="grid grid-cols-2 gap-6 max-w-sm">
               <div className="space-y-1.5">
                  <p className="text-cyan-400 font-black text-[9px] uppercase tracking-widest">Cụm nghiên cứu</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed">Truy cập hệ thống quản lý dự án và thiết kế Verilog.</p>
               </div>
               <div className="space-y-1.5">
                  <p className="text-indigo-400 font-black text-[9px] uppercase tracking-widest">Hạ tầng phần cứng</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed">Kết nối tài nguyên Server FPGA và GPU nội bộ.</p>
               </div>
            </div>
          </div>

          {/* Footer Module: Gọn gàng hơn */}
          <div className="relative z-10 bg-white/[0.02] border border-white/10 backdrop-blur-xl p-6 rounded-[24px] flex items-center justify-between group/panel">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                   <ShieldCheck size={18} className="text-cyan-400" />
                </div>
                <div>
                  <span className="block text-white font-black text-[10px] uppercase tracking-widest leading-none">Cần quyền truy cập?</span>
                  <span className="block text-slate-500 text-[9px] mt-1 font-medium italic">Yêu cầu quyền truy cập cấp 2.</span>
                </div>
              </div>
              <Link 
                to="/register" 
                className="px-6 py-2.5 bg-cyan-500 text-[#020617] rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-cyan-500/20"
              >
                Đăng ký
              </Link>
          </div>
        </div>
      </div>

      {/* FOOTER SYSTEM INFO */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-30">
         <div className="flex items-center gap-1.5">
            <Terminal size={10} className="text-slate-500" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Phiên bản: v2026.03</span>
         </div>
         <div className="w-1 h-1 rounded-full bg-slate-700" />
         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">VKsLab Intelligence Hub</span>
      </div>
    </div>
  );
};

export default LoginPage;