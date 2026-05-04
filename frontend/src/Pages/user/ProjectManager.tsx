import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Users, ArrowUpRight,
  Cpu, ChevronDown, Filter, Plus, Binary, UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../services/project.service';
import { useAuthStore } from '../../store/authStore';
import type { Project, ProjectTag } from '../../types';
import toast from 'react-hot-toast';

// --- STYLES: SAO RƠI CHUẨN HƯỚNG ---
const meteorStyles = `
  @keyframes meteor-effect {
    0% { transform: translate(500px, -500px) rotate(225deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(225deg); opacity: 0; }
  }
  .meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to bottom, rgba(6, 182, 212, 0.8), transparent);
    animation: meteor-effect linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

const STATUS_THEME: Record<string, { color: string; bg: string; border: string }> = {
  planning: { color: 'text-cyan-400', bg: 'bg-cyan-500/5', border: 'border-cyan-500/20' },
  active: { color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
  paused: { color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  done: { color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20' },
  archived: { color: 'text-slate-500', bg: 'bg-slate-500/5', border: 'border-slate-500/20' },
};

const TAG_LIST: ProjectTag[] = ['AI/ML', 'FPGA', 'Robotics', 'Embedded', 'DSP', 'IoT', 'Other'];
const STATUS_FILTER_KEYS = ['all', 'active', 'planning', 'done'] as const;

/** Cơ chế SELF_JOIN: còn slot — khớp ProjectDetail (planning + chưa đủ required_members). */
function isSelfJoinRegistrationOpen(project: Project): boolean {
  if (project.participation_mode !== 'SELF_JOIN' || project.status !== 'planning') return false;
  const req = project.required_members;
  const cnt = project.member_count;
  if (req != null && req > 0 && cnt != null && cnt >= req) return false;
  return true;
}

// --- COMPONENT: PROJECT CARD ---
const ProjectCard: React.FC<{
  project: Project;
  onClick: () => void;
  showJoinedBadge: boolean;
  showPendingInviteBadge?: boolean;
}> = ({ project, onClick, showJoinedBadge, showPendingInviteBadge }) => {
  const { t } = useTranslation();
  const theme = STATUS_THEME[project.status] || STATUS_THEME.archived;
  const progress = project.task_progress 
    ? Math.round((project.task_progress.done / project.task_progress.total) * 100) || 0 
    : 0;
  const registrationOpen = isSelfJoinRegistrationOpen(project);

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -8 }}
      onClick={onClick}
      className="group relative bg-[#0B0F1A]/80 backdrop-blur-2xl rounded-[32px] border border-white/5 p-7 cursor-pointer overflow-hidden transition-all duration-500 hover:border-cyan-500/30 shadow-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5">
          <Binary size={10} className="text-cyan-500" />
          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest">{project.code}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-w-[58%]">
          {registrationOpen && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.12em] border bg-violet-500/15 text-violet-200 border-violet-400/35 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
              title={t('projects:manager.registrationOpen')}
            >
              <UserPlus size={10} className="shrink-0 text-violet-300" />
              {t('projects:manager.registrationOpen')}
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.15em] border shrink-0 ${theme.bg} ${theme.color} ${theme.border}`}>
            {t(`projects:manager.status.${project.status}`)}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-8 relative z-10">
        <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors tracking-tight">{project.name}</h3>
        <span className="inline-block text-[8px] font-black px-2.5 py-1 bg-cyan-500/10 text-cyan-500 rounded-lg border border-cyan-500/20 uppercase tracking-[0.1em]">
          {project.tag || 'R&D'}
        </span>
      </div>

      <div className="space-y-3 mb-8 relative z-10">
        <div className="flex justify-between items-end">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">TIẾN ĐỘ</span>
          <span className="text-xs font-mono font-bold text-cyan-500">{progress}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-blue-600 to-cyan-400" />
        </div>
      </div>

      {/* FOOTER ĐÃ CÂN ĐỐI */}
      <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-500">
            {project.leader?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">CHỦ NHIỆM</p>
            <p className="text-[11px] text-slate-200 font-bold truncate max-w-[80px]">{project.leader?.full_name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-1">
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">TEAM</span>
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Users size={12} className="text-cyan-500" /> {project.member_count || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showJoinedBadge && (
              <span className="px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Đã tham gia</span>
            )}
            {showPendingInviteBadge && (
              <span className="px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/25">Chờ xác nhận</span>
            )}
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-cyan-500/10 transition-colors">
              <ArrowUpRight size={16} className="text-slate-600 group-hover:text-cyan-400" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- MAIN PAGE ---
const ProjectManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [domainOpen, setDomainOpen] = useState(false);
  const [meteors, setMeteors] = useState<number[]>([]);
  const domainRef = useRef<HTMLDivElement>(null);

  const canCreateProject = useMemo(
    () => ['truong_lab', 'vien_truong'].includes(user?.system_role || ''),
    [user?.system_role],
  );

  useEffect(() => {
    const interval = setInterval(() => setMeteors(p => [...p.slice(-6), Date.now()]), 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (domainRef.current && !domainRef.current.contains(e.target as Node)) setDomainOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.list();
      setProjects(res.projects || []);
    } catch { toast.error("Lỗi kết nối"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchProjects(); }, []);

  const filtered = useMemo(() => 
    projects.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchTag = filterTag === 'all' || p.tag === filterTag;
      return matchSearch && matchStatus && matchTag;
    }), [projects, searchTerm, filterStatus, filterTag]
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pb-24 relative overflow-hidden">
      <style>{meteorStyles}</style>

      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {meteors.map(id => (
          <div key={id} className="meteor" style={{ top: `${Math.random() * 50}%`, right: `${Math.random() * 60}%`, animationDuration: `${Math.random() * 2 + 1.5}s` }} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-20 relative z-10">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 mb-20">
          <div>
            <div className="flex items-center gap-3 text-cyan-500 font-black text-[10px] uppercase tracking-[0.5em] mb-4">
              <Cpu size={14} /> SYSTEM REGISTRY
            </div>
            <h1 className="text-6xl md:text-7xl font-black italic text-white uppercase leading-none">
              PROJECT<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">.MATRIX</span>
            </h1>
          </div>
          {canCreateProject && (
            <button
              type="button"
              onClick={() => navigate('/projects/new')}
              className="px-10 py-5 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-cyan-500 hover:text-white transition-all shadow-2xl flex items-center gap-3"
            >
              <Plus size={20} /> TẠO DỰ ÁN
            </button>
          )}
        </header>

        {/* FILTER BAR: z-index above project grid so domain dropdown is not covered by cards */}
        <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-4 mb-12 bg-[#0F1219]/60 backdrop-blur-2xl p-2 rounded-[32px] border border-white/5">
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="TÌM KIẾM DỰ ÁN..."
              className="w-full bg-transparent py-5 pl-16 pr-6 text-[10px] font-black text-white outline-none placeholder:text-slate-600 uppercase tracking-widest"
            />
          </div>
          
          <div className="lg:col-span-4 flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
            {STATUS_FILTER_KEYS.map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 relative" ref={domainRef}>
            <button onClick={() => setDomainOpen(!domainOpen)} className="w-full flex items-center justify-between gap-3 bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white hover:border-cyan-500/30 transition-all">
              <span className="flex items-center gap-2"><Filter size={12} className="text-cyan-500" /> {filterTag === 'all' ? 'TẤT CẢ LĨNH VỰC' : filterTag}</span>
              <ChevronDown size={14} className={`transition-transform ${domainOpen ? 'rotate-180 text-cyan-400' : ''}`} />
            </button>
            <AnimatePresence>
              {domainOpen && (
                <motion.ul initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-[110%] w-full py-3 rounded-2xl border border-white/10 bg-[#0F1219] z-50 shadow-2xl">
                  {['all', ...TAG_LIST].map((t) => (
                    <li key={t}>
                      <button onClick={() => { setFilterTag(t); setDomainOpen(false); }} className={`w-full text-left px-6 py-3 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 ${filterTag === t ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {t === 'all' ? 'TẤT CẢ LĨNH VỰC' : t}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* PROJECT GRID — lower stacking than filter row so dropdown paints on top */}
        {loading ? (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <div key={i} className="h-[400px] bg-white/[0.02] rounded-[32px] animate-pulse" />)}
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)}
                showJoinedBadge={Boolean(user?.system_role === 'member' && p.is_joined)}
                showPendingInviteBadge={Boolean(user?.system_role === 'member' && p.pending_commitment_invite)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProjectManagerPage;