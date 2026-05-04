import React, { useState, useEffect } from 'react';
import { 
  Loader2, CheckCircle2, Clock, AlertTriangle, 
  Users, Flag, Activity, Target, 
  Sparkles, Fingerprint
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';

// --- Interface Definitions ---
interface TaskCounts {
  todo?: number;
  in_progress?: number;
  review?: number;
  done?: number;
  [key: string]: number | undefined;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  done: boolean;
}

interface ReportNode {
  week_number: number;
  year: number;
  status: 'submitted' | 'late' | 'missing';
}

interface ProjectData {
  task_counts?: TaskCounts;
  report_chart?: ReportNode[];
  nearest_milestones?: Milestone[];
  members_preview?: {
    total: number;
    members: { id: string; full_name: string; email: string }[];
  };
}

const OverviewTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const overview = await projectService.getOverview(projectId);
        setData(overview as ProjectData);
      } catch { /* Silent */ } 
      finally { setLoading(false); }
    };
    loadOverview();
  }, [projectId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">{t('projects:overview.loading')}</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center py-20 bg-slate-50 rounded-[40px] border border-slate-100">
      <AlertTriangle className="text-slate-300 mb-4" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('projects:overview.noData')}</p>
    </div>
  );

  const taskCounts = data.task_counts || {};
  const totalTasks = (Object.values(taskCounts) as number[]).reduce((s, v) => s + (v || 0), 0);
  const doneCount = taskCounts.done || 0;
  const inProgressCount = (taskCounts.in_progress || 0) + (taskCounts.review || 0);
  const taskProgress = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Top Metrics Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatNode icon={<Target size={20}/>} label={t('projects:overview.stats.totalTasks')} value={totalTasks} sub={t('projects:overview.stats.totalTasksSub')} color="text-indigo-600" bg="bg-indigo-50" />
        <StatNode icon={<Activity size={20}/>} label={t('projects:overview.stats.performance')} value={`${taskProgress}%`} sub={t('projects:overview.stats.performanceSub')} color="text-cyan-600" bg="bg-cyan-50" />
        <StatNode icon={<Clock size={20}/>} label={t('projects:overview.stats.inProgress')} value={inProgressCount} sub={t('projects:overview.stats.inProgressSub')} color="text-amber-500" bg="bg-amber-50" />
        <StatNode icon={<Users size={20}/>} label={t('projects:overview.stats.members')} value={data.members_preview?.total || 0} sub={t('projects:overview.stats.membersSub')} color="text-emerald-500" bg="bg-emerald-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Main Progression Matrix */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]" /> {t('projects:overview.deploymentStatus')}
            </h3>
            <Sparkles size={16} className="text-slate-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Custom Circular Progress */}
            <div className="relative w-52 h-52 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
                <motion.circle 
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: `${taskProgress} 100` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  cx="18" cy="18" r="16" fill="none" stroke="url(#cyanGradient)" strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900 tracking-tighter">{taskProgress}%</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{t('projects:overview.operational')}</span>
              </div>
            </div>

            {/* Linear Breakdown */}
            <div className="space-y-6">
              <LinearProgress label={t('projects:tasks.status.todo')} val={taskCounts.todo || 0} total={totalTasks} color="bg-slate-200" />
              <LinearProgress label={t('projects:tasks.status.in_progress')} val={taskCounts.in_progress || 0} total={totalTasks} color="bg-cyan-500" />
              <LinearProgress label={t('projects:tasks.status.review')} val={taskCounts.review || 0} total={totalTasks} color="bg-indigo-400" />
              <LinearProgress label={t('projects:tasks.status.done')} val={doneCount} total={totalTasks} color="bg-emerald-400" />
            </div>
          </div>
        </div>

        {/* 3. Compliance Log Stream */}
        <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl shadow-slate-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Fingerprint size={80} />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-12 relative z-10">{t('projects:overview.complianceStream')}</h3>
          
          <div className="flex items-end justify-between gap-2 h-36 mb-10 relative z-10">
            {(data.report_chart || []).slice(-7).map((r, i) => (
              <div key={i} className="flex-1 group relative h-full flex items-end">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: r.status === 'submitted' ? '100%' : r.status === 'late' ? '60%' : '20%' }}
                  transition={{ delay: i * 0.1 }}
                  className={`w-full rounded-t-xl transition-all ${
                    r.status === 'submitted' ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 
                    r.status === 'late' ? 'bg-amber-400' : 'bg-rose-500/30'
                  }`}
                />
              </div>
            ))}
          </div>
          
          <div className="space-y-3 pt-6 border-t border-white/10 relative z-10">
             <Legend label={t('projects:overview.legend.onTime')} color="bg-cyan-400" />
             <Legend label={t('projects:overview.legend.late')} color="bg-amber-400" />
             <Legend label={t('projects:overview.legend.missing')} color="bg-rose-500/30" />
          </div>
        </div>
      </div>

      {/* 4. Strategic Milestones & Team Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-lg shadow-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('projects:overview.milestonesTitle')}</h3>
            <Flag size={16} className="text-cyan-600" />
          </div>
          <div className="space-y-4">
            {data.nearest_milestones && data.nearest_milestones.length > 0 ? data.nearest_milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-5 p-5 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-cyan-200 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full ${m.done ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-200'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${m.done ? 'text-slate-300 line-through' : 'text-slate-900'}`}>{m.title}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{m.due_date?.slice(0, 10)}</p>
                </div>
                {m.done && <CheckCircle2 size={16} className="text-emerald-400" />}
              </div>
            )) : <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest py-8 text-center italic">{t('projects:overview.noMilestones')}</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-lg shadow-slate-100">
           <div className="flex justify-between items-center mb-8">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('projects:overview.activeMembersTitle')}</h3>
             <div className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-lg">{t('projects:overview.live')}</div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data.members_preview?.members || []).map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-[24px]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
                    {u.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{u.full_name}</p>
                    <p className="text-[9px] text-slate-400 truncate font-bold uppercase tracking-tighter">{u.email}</p>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components (Light Modern) ---

const StatNode: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  color: string;
  bg: string;
}> = ({ icon, label, value, sub, color, bg }) => (
  <div className="bg-white border border-slate-100 rounded-[32px] p-7 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
    <div className={`w-12 h-12 ${bg} ${color} rounded-2xl mb-6 flex items-center justify-center group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
    <div className="mt-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-[9px] font-bold text-cyan-600/50 uppercase italic tracking-tight">{sub}</p>
    </div>
  </div>
);

const LinearProgress: React.FC<{
  label: string;
  val: number;
  total: number;
  color: string;
}> = ({ label, val, total, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-900">{val}</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: total > 0 ? `${(val/total)*100}%` : '0%' }}
        transition={{ duration: 1, ease: "circOut" }}
        className={`h-full ${color} rounded-full`} 
      />
    </div>
  </div>
);

const Legend: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div className="flex items-center gap-3">
    <div className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
  </div>
);

export default OverviewTab;