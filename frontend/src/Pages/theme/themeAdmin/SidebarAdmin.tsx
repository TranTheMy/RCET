import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, ShieldCheck, 
  Cpu, Terminal, ChevronRight, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminSidebarProps {
  collapsed?: boolean;
}

const navItems = [
  { to: '/admin', labelKey: 'admin:nav.dashboard', icon: LayoutDashboard },
  { to: '/admin/users', labelKey: 'admin:nav.usersAndRoles', icon: Users },
  { to: '/admin/security', labelKey: 'admin:nav.auditLog', icon: ShieldCheck },
];

const SidebarAdmin: React.FC<AdminSidebarProps> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  return (
    <aside
      className={`shrink-0 self-stretch min-h-screen bg-[#020617] text-slate-400 border-r border-white/5 flex flex-col ${
        collapsed ? 'w-[80px]' : 'w-72'
      } transition-all duration-500 relative z-40`}
    >
      {/* Cạnh phải phát sáng nhẹ (Edge Glow) */}
      <div className="absolute right-0 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />

      {/* TOP: NAVIGATION CONTROL & BRANDING */}
      <div className="px-4 pt-6 pb-6 border-b border-white/5 space-y-6">
        {/* Logo Hub */}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'}`}>
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] border border-cyan-500/30 flex items-center justify-center text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <Cpu size={20} className="animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#020617]" />
          </div>

          {!collapsed && (
            <div className="leading-tight">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">
                VKsLab <span className="text-cyan-500">LAB</span>
              </p>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                {t('admin:sidebar.adminPanel')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MID: NAVIGATION ITEMS */}
      <nav className="flex-1 px-3 py-8 space-y-2 overflow-y-auto">
        {!collapsed && (
          <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <Terminal size={10} /> {t('admin:sidebar.section')}
          </p>
        )}
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isDashboard = item.to === '/admin';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={isDashboard}
              className={({ isActive }) =>
                `group relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all
                ${isActive 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active Marker */}
                  {isActive && (
                    <div className="absolute left-0 top-1/4 h-1/2 w-[2px] bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
                  )}
                  
                  <Icon size={18} className={`${isActive ? 'text-cyan-400' : 'group-hover:text-slate-300'}`} />
                  
                  {!collapsed && (
                    <span className="flex-1 flex items-center justify-between">
                      {t(item.labelKey)}
                      {isActive && <ChevronRight size={12} className="animate-pulse" />}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* BOTTOM: SYSTEM STATUS */}
      <div className="px-6 py-6 border-t border-white/5 bg-[#010409]/50">
        {!collapsed ? (
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                <Activity size={12} /> {t('admin:sidebar.system.active')}
             </div>
             <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[8px] font-mono text-slate-500 leading-relaxed uppercase">
                  {t('admin:sidebar.system.nodeLabel')}: VKsLab-MAIN-01 <br />
                  {t('admin:sidebar.system.statusLabel')}: {t('admin:sidebar.system.statusOptimized')}
                </p>
             </div>
          </div>
        ) : (
          <div className="flex justify-center">
             <Activity size={16} className="text-emerald-500" />
          </div>
        )}
      </div>
    </aside>
  );
};

export default SidebarAdmin;