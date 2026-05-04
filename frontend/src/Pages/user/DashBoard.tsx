import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Users,
  Terminal,
  Activity,
  Zap,
  Loader2,
  AlertCircle,
  TrendingUp,
  Target,
} from 'lucide-react';
import { memberDashboardService } from '../../services/memberDashboard.service';
import { realtimeService } from '../../services/realtime.service';
import toast from 'react-hot-toast';
import type {
  MemberDashboardData,
  MemberDashboardTaskItem,
} from '../../types';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const priorityConfig: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  urgent: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'urgent' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'high' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'medium' },
  low: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', label: 'low' },
};

type TaskRow = MemberDashboardTaskItem & { isDone: boolean };

function flattenTasks(tasks: MemberDashboardData['tasks'] | undefined): TaskRow[] {
  if (!tasks) return [];
  const out: TaskRow[] = [];
  const push = (arr: MemberDashboardTaskItem[] | undefined, isDone: boolean) => {
    (arr || []).forEach((item) => out.push({ ...item, isDone }));
  };
  push(tasks.in_progress, false);
  push(tasks.todo, false);
  push(tasks.overdue, false);
  push(tasks.done_this_week, true);
  return out;
}

const UserDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [sortBy, setSortBy] = useState<'deadline' | 'priority'>('deadline');
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const fetchDashboard = async (cancelled: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const d = await memberDashboardService.getDashboard();
        if (!cancelled()) {
          setDashboard(d);
          setExpandedProjects(d.projects?.map((p) => p.code) ?? []);
        }
      } catch (err: unknown) {
        const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        const msg =
          (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('user:dashboard.toasts.fetchFailed');
        if (!cancelled()) setError(msg);
      } finally {
        if (!cancelled()) setLoading(false);
      }
  };

  useEffect(() => {
    let cancelled = false;
    fetchDashboard(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [t]);

  const flatTasks = useMemo(() => flattenTasks(dashboard?.tasks), [dashboard?.tasks]);

  const groupedAndSortedTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const sorted = [...flatTasks].sort((a, b) => {
      if (sortBy === 'deadline') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      const pa = priorityWeight[a.priority] ?? 0;
      const pb = priorityWeight[b.priority] ?? 0;
      return pb - pa;
    });

    // Seed from project list so newly joined projects appear
    // even when the member has no tasks in them yet.
    const grouped = (dashboard?.projects || []).reduce((acc, project) => {
      const key = project.code || project.name;
      acc[key] = [];
      return acc;
    }, {} as Record<string, TaskRow[]>);

    sorted.forEach((task) => {
      const key = task.project?.code || task.project?.name || 'Dự án';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [dashboard?.projects, flatTasks, sortBy]);

  const toggleProject = (projectName: string) => {
    setExpandedProjects((prev) =>
      prev.includes(projectName) ? prev.filter((p) => p !== projectName) : [...prev, projectName],
    );
  };

  const handleCompleteTask = async (task: TaskRow) => {
    if (task.isDone || completingTaskId === task.id) return;
    setCompletingTaskId(task.id);
    try {
      await memberDashboardService.completeTask(task.id);
      setDashboard((prev) => {
        if (!prev) return prev;
        const nextTasks = {
          ...prev.tasks,
          in_progress: (prev.tasks?.in_progress || []).filter((t) => t.id !== task.id),
          todo: (prev.tasks?.todo || []).filter((t) => t.id !== task.id),
          overdue: (prev.tasks?.overdue || []).filter((t) => t.id !== task.id),
          done_this_week: [task, ...(prev.tasks?.done_this_week || [])],
        };
        return { ...prev, tasks: nextTasks };
      });
      toast.success(t('user:dashboard.toasts.taskCompleted'));
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('user:dashboard.toasts.updateTaskFailed');
      toast.error(msg);
    } finally {
      setCompletingTaskId(null);
    }
  };

  useEffect(() => {
    const userId = dashboard?.personal?.id;
    if (!userId) return;

    realtimeService.connect(userId);
    const refreshDashboard = () => {
      let cancelled = false;
      fetchDashboard(() => cancelled);
      return () => {
        cancelled = true;
      };
    };

    const unsubTaskCompleted = realtimeService.onMemberDashboardTaskCompleted((payload: unknown) => {
      const taskId = (payload as { taskId?: string })?.taskId;
      if (!taskId) return;

      setDashboard((prev) => {
        if (!prev) return prev;
        const taskFromBuckets =
          prev.tasks?.in_progress?.find((t) => t.id === taskId) ||
          prev.tasks?.todo?.find((t) => t.id === taskId) ||
          prev.tasks?.overdue?.find((t) => t.id === taskId) ||
          prev.tasks?.done_this_week?.find((t) => t.id === taskId);
        if (!taskFromBuckets) return prev;

        const nextTasks = {
          ...prev.tasks,
          in_progress: (prev.tasks?.in_progress || []).filter((t) => t.id !== taskId),
          todo: (prev.tasks?.todo || []).filter((t) => t.id !== taskId),
          overdue: (prev.tasks?.overdue || []).filter((t) => t.id !== taskId),
          done_this_week: [taskFromBuckets, ...(prev.tasks?.done_this_week || []).filter((t) => t.id !== taskId)],
        };
        return { ...prev, tasks: nextTasks };
      });
    });
    const unsubProjectsUpdate = realtimeService.onProjectsUpdate(() => {
      refreshDashboard();
    });

    return () => {
      unsubTaskCompleted();
      unsubProjectsUpdate();
    };
  }, [dashboard?.personal?.id]);

  const formatDue = (d: string | null) => {
    if (!d) return t('user:dashboard.dash');
    return d.slice(0, 10);
  };

  const formatActivityTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(dateLocale);
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{t('user:dashboard.loading')}</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-sm text-slate-300 text-center max-w-md">{error || t('user:dashboard.noData')}</p>
      </div>
    );
  }

  const { personal, metrics, reports, activities, projects } = dashboard;
  const projectKeys = Object.keys(groupedAndSortedTasks);

  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg mb-4">
              <Terminal size={12} className="text-cyan-400" />
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">{t('user:dashboard.kicker')}</span>
            </div>
            <h1 className="text-4xl font-[950] text-white tracking-tighter uppercase italic">
              {t('user:dashboard.titlePrefix')} <span className="text-cyan-400">{t('user:dashboard.titleHighlight')}</span>
            </h1>
            {personal.department && (
              <p className="text-slate-500 text-xs mt-2 font-medium">{personal.department}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm font-medium">
              {t('user:dashboard.greeting', { name: personal.full_name })}
            </p>
            <p className="text-slate-500 text-xs mt-1 truncate max-w-[280px]">{personal.email}</p>
            <p className="text-slate-500 text-xs mt-1 flex items-center justify-end gap-2">
              <Activity size={12} className="text-green-400 animate-pulse" /> {t('user:dashboard.activeProjects', { count: projects.length })}
            </p>
          </div>
        </header>

        {/* Metrics strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{t('user:dashboard.metrics.taskCompletion')}</p>
            <p className="text-2xl font-black text-cyan-400">{metrics.task_completion_rate}%</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{t('user:dashboard.metrics.onTimeReports')}</p>
            <p className="text-2xl font-black text-emerald-400">{metrics.report_submission_rate}%</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{t('user:dashboard.metrics.weekStreak')}</p>
            <p className="text-2xl font-black text-white">{reports.streak}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{t('user:dashboard.metrics.teamRanking')}</p>
            <p className="text-lg font-black text-white flex items-center gap-2">
              <Target size={16} className="text-cyan-400" />
              {metrics.team_ranking.position}/{metrics.team_ranking.total_members}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-[950] text-white tracking-tight uppercase flex items-center gap-3">
                <Zap className="text-cyan-400" size={20} />
                {t('user:dashboard.section.tasks')}
              </h2>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('deadline')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    sortBy === 'deadline'
                      ? 'bg-cyan-500 text-[#020617] shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('user:dashboard.sort.deadline')}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('priority')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    sortBy === 'priority'
                      ? 'bg-cyan-500 text-[#020617] shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('user:dashboard.sort.priority')}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {projectKeys.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-12 text-center text-slate-500 text-sm">
                  {t('user:dashboard.tasks.empty')}
                </div>
              ) : (
                projectKeys.map((project) => {
                  const tasks = groupedAndSortedTasks[project];
                  const isExpanded = expandedProjects.includes(project);
                  return (
                    <div
                      key={project}
                      className="bg-gradient-to-r from-white/[0.03] to-transparent border border-white/5 rounded-[24px] overflow-hidden transition-all hover:border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => toggleProject(project)}
                        className="w-full px-6 py-5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">
                            {dashboard?.projects?.find((p) => p.code === project)?.name || project}
                          </h3>
                          <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-slate-300 font-bold">
                            {tasks.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={18} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={18} className="text-slate-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-4 space-y-2 bg-black/20">
                          {tasks.map((task) => {
                            const pStyle =
                              priorityConfig[task.priority] ||
                              priorityConfig.medium;
                            return (
                              <div
                                key={task.id}
                                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                                  task.isDone
                                    ? 'bg-white/[0.02] border-transparent opacity-50'
                                    : 'bg-white/[0.05] border-white/10 hover:border-cyan-500/30'
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="mt-1 shrink-0">
                                    {task.isDone ? (
                                      <CheckCircle2 size={18} className="text-cyan-500" />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleCompleteTask(task)}
                                        disabled={completingTaskId === task.id}
                                        className="w-[18px] h-[18px] rounded-full border-2 border-slate-500 hover:border-cyan-400 transition-colors disabled:opacity-60"
                                        aria-label={t('user:dashboard.tasks.markDoneAria')}
                                      >
                                        {completingTaskId === task.id && (
                                          <Loader2 size={12} className="text-cyan-400 animate-spin m-auto" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  <div>
                                    <p
                                      className={`text-sm font-bold tracking-tight mb-1 ${
                                        task.isDone ? 'text-slate-500 line-through' : 'text-white'
                                      }`}
                                    >
                                      {task.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-400">
                                      <span className="flex items-center gap-1">
                                        <Clock size={12} /> {formatDue(task.due_date)}
                                      </span>
                                      <span className="text-slate-600">|</span>
                                      <span className="font-mono text-[10px]">{task.project.code}</span>
                                    </div>
                                  </div>
                                </div>

                                {!task.isDone && (
                                  <div
                                    className={`shrink-0 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${pStyle.bg} ${pStyle.border} ${pStyle.color}`}
                                  >
                                    {t(`user:dashboard.priority.${pStyle.label}`)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-[950] text-white tracking-tight uppercase flex items-center gap-3 mb-6">
              <Calendar className="text-cyan-400" size={20} />
              {t('user:dashboard.section.activityReports')}
            </h2>

            <div className="bg-gradient-to-br from-slate-900/80 to-[#020617]/80 backdrop-blur-xl rounded-[32px] border border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                <TrendingUp size={14} />
                {t('user:dashboard.recent')}
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">{t('user:dashboard.noActivity')}</p>
              ) : (
                <ul className="space-y-3">
                  {activities.slice(0, 8).map((a, i) => (
                    <li
                      key={`${a.type}-${i}-${a.timestamp}`}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <p className="text-[10px] text-slate-500 mb-1">{formatActivityTime(a.timestamp)}</p>
                      <p className="text-sm text-white font-medium leading-snug">{a.description}</p>
                      {a.project && (
                        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                          <Users size={10} /> {a.project}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {metrics.achievements.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                  {t('user:dashboard.achievements')}
                </h3>
                <ul className="space-y-2">
                  {metrics.achievements.map((ac) => (
                    <li key={ac} className="text-xs text-cyan-200/90 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-cyan-500 shrink-0 mt-0.5" />
                      {ac}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reports.next_due && (
              <div className="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-[10px] font-black uppercase text-cyan-400 mb-1">{t('user:dashboard.nextDue')}</p>
                <p className="text-sm text-white font-mono">
                  {formatActivityTime(reports.next_due)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
