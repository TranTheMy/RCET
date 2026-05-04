import React from 'react';
import { Globe, Beaker, ChevronLeft, Sparkles, Terminal, Activity, Database, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RegisterForm from '../../components/auth/register-form';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30 selection:text-cyan-400 overflow-hidden relative">
      
      {/* BACKGROUND TECH ELEMENTS */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:30px_30px] opacity-10" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse delay-700" />

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

      {/* MAIN CONTAINER: THU NHỎ VÀ ĐỐI XỨNG (flex-row-reverse) */}
      <div className="w-full max-w-[1050px] bg-[#0F172A]/80 backdrop-blur-xl rounded-[32px] shadow-[0_0_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col lg:flex-row-reverse min-h-[600px] lg:min-h-[720px] border border-white/5 relative z-10">
        
        {/* CỘT PHẢI: REGISTER FORM TERMINAL */}
        <div className="w-full lg:w-[42%] p-8 lg:p-12 flex flex-col justify-center relative bg-[#0F172A]">
          <div className="relative z-10 w-full max-w-sm mx-auto lg:mx-0">
            <RegisterForm />
          </div>

          {/* System Status Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em]">Yêu cầu tài khoản: Đang chờ</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <ShieldAlert size={9} className="text-slate-600" />
                   <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em]">Mã hóa: AES-256</span>
                </div>
             </div>
          </div>
        </div>

        {/* CỘT TRÁI: RESEARCH BANNER (DARK TECH) */}
        <div className="hidden lg:flex w-[58%] bg-[#020617] relative flex-col justify-between p-12 overflow-hidden group border-r border-white/5">
          
          {/* Ambient Glow */}
          <div className="absolute -bottom-10 -left-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px]" />
          
          {/* Top Info Bar */}
          <div className="relative z-10 flex justify-between items-center">
            <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-cyan-400 shadow-xl group-hover:border-cyan-500/40 transition-all">
              <Beaker size={24} />
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
              <Activity size={12} className="text-indigo-400 animate-pulse" />
              <span className="text-white font-black text-[8px] uppercase tracking-widest text-indigo-200">Mạng học thuật: Hoạt động</span>
            </div>
          </div>

          {/* Center Content */}
          <div className="relative z-10 mt-auto mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-md mb-4">
               <Sparkles size={10} className="text-cyan-400" />
               <span className="text-[8px] font-black text-cyan-300 uppercase tracking-widest">Tham gia ngay</span>
            </div>
            
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-[1] mb-6">
              Bắt đầu <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500">
                hành trình nghiên cứu.
              </span>
            </h2>
            
            <div className="grid grid-cols-2 gap-6 max-w-sm">
               <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Database size={12} className="text-cyan-500" />
                    <p className="text-cyan-400 font-black text-[9px] uppercase tracking-widest">Kho dữ liệu chung</p>
                  </div>
                  <p className="text-slate-500 text-[10px] leading-relaxed">Truy cập hàng ngàn tài liệu và dataset nghiên cứu Robotics chuyên sâu.</p>
               </div>
               <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Globe size={12} className="text-indigo-500" />
                    <p className="text-indigo-400 font-black text-[9px] uppercase tracking-widest">Kết nối chuyên gia</p>
                  </div>
                  <p className="text-slate-500 text-[10px] leading-relaxed">Kết nối trực tiếp với mạng lưới chuyên gia và các Lab liên kết toàn cầu.</p>
               </div>
            </div>
          </div>

          {/* Footer Card: Redirect to Login */}
          <div className="relative z-10 bg-white/[0.02] border border-white/10 backdrop-blur-xl p-6 rounded-[24px] flex items-center justify-between group/panel">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                   <Database size={18} className="text-indigo-400" />
                </div>
                <div>
                  <span className="block text-white font-black text-[10px] uppercase tracking-widest leading-none">Đã có ID hệ thống?</span>
                  <span className="block text-slate-500 text-[9px] mt-1 font-medium italic">Quay lại cổng đăng nhập bảo mật.</span>
                </div>
              </div>
              <Link 
                to="/login" 
                className="relative px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-[#020617] transition-all shadow-lg overflow-hidden group/btn"
              >
                <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                Đăng nhập
              </Link>
          </div>
        </div>
      </div>

      {/* FOOTER SYSTEM INFO */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-30">
         <div className="flex items-center gap-1.5">
            <Terminal size={10} className="text-slate-500" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Triển khai: v2026.03</span>
         </div>
         <div className="w-1 h-1 rounded-full bg-slate-700" />
         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">VKsLab Intelligence Hub</span>
      </div>
    </div>
  );
};

export default RegisterPage;