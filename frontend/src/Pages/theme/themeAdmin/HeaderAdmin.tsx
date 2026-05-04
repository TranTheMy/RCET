import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Shield, Cpu, Activity } from "lucide-react";
import { useAuthStore } from "../../../store/authStore";
import { NotificationBell } from "../../../components/NotificationBell";
import { useTranslation } from "react-i18next";

const HeaderAdmin: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-16 md:h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-10 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50 overflow-visible isolate">
      {/* overflow-visible: dropdown thông báo tràn xuống main — không dùng overflow-hidden (sẽ cắt panel) */}
      {/* Hiệu ứng tia sáng — clip trong lớp riêng để header không cần overflow-hidden */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent animate-[pulse_4s_infinite]" />
      </div>

      {/* LEFT SIDE: SYSTEM IDENTIFIER */}
      <div className="relative flex items-center gap-4">
        <div className="hidden sm:flex w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-lg items-center justify-center text-cyan-400">
          <Cpu size={20} className="animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
            VKsLab <span className="text-cyan-500">·</span> Hub <span className="text-cyan-500">·</span> Admin
          </div>
          <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Activity size={10} className="text-emerald-500" /> 
            {t("admin:header.systemOnline")}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: USER PROFILE & ACTIONS — z cao hơn lớp viền trang trí để panel thông báo không bị đè */}
      <div className="flex items-center gap-4 md:gap-8 relative z-[100]">
        <NotificationBell isScrolled />
        {user && (
          <div className="hidden lg:flex flex-col items-end">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white italic">
               <Shield size={12} className="text-cyan-500" />
               {user.full_name}
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              {t("admin:header.access")}: <span className="text-indigo-400">{user.system_role}</span>
            </div>
          </div>
        )}

        {/* Nút Đăng xuất phong cách Cyber */}
        <button
          onClick={handleLogout}
          className="group relative inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:border-red-500/50 hover:text-white transition-all overflow-hidden"
        >
          {/* Hover Background Effect */}
          <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/10 transition-colors" />
          
          <LogOut size={14} className="group-hover:rotate-180 transition-transform duration-500" />
          <span className="relative z-10">{t("common:actions.logout")}</span>
        </button>
      </div>

      {/* Border trang trí — z thấp, không chặn click / không đè dropdown */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-0 w-24 h-[2px] bg-gradient-to-r from-cyan-500 to-transparent opacity-50" />
      <div className="pointer-events-none absolute bottom-0 right-0 z-0 w-24 h-[2px] bg-gradient-to-l from-indigo-500 to-transparent opacity-50" />
    </header>
  );
};

export default HeaderAdmin;