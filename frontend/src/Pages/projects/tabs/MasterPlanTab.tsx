import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2, Plus, PlusCircle, X, CheckCircle2, Flag,
  Calendar, Link as LinkIcon,
  AlertCircle, Activity, Sparkles, Terminal, CheckSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';
import { realtimeService } from '../../../services/realtime.service';
import type { Milestone, Task } from '../../../types';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { parseApiFormError } from '../../../utils/formFieldErrors';
import { translateApiMessage, translateFieldErrors } from '../../../utils/apiErrorI18n';
import ChecklistModal from './ChecklistModal';
import CreateChecklistModal from './CreateChecklistModal';

const STATUS_GLOW: Record<string, string> = {
  green: 'bg-emerald-500 ring-4 ring-emerald-500/20 border-white',
  yellow: 'bg-amber-500 ring-4 ring-amber-500/20 border-white',
  red: 'bg-rose-500 ring-4 ring-rose-500/20 border-white',
  gray: 'bg-slate-300 border-white',
};

const MasterPlanTab: React.FC<{ projectId: string; canEdit: boolean }> = ({ projectId, canEdit }) => {
  const { t } = useTranslation();
  const [milestones, setMilestones] = useState<(Milestone & { color?: string })[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<{ milestoneId: string; checklist: any } | null>(null);
  const [showCreateChecklist, setShowCreateChecklist] = useState<{ milestoneId: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [msPayload, tasksPayload] = await Promise.all([
        projectService.listMilestones(projectId),
        projectService.listTasks(projectId),
      ]);

      // Load checklists for each milestone
      const milestonesWithChecklists = await Promise.all(
        (msPayload.milestones || []).map(async (ms) => {
          try {
            const checklistsPayload = await projectService.listChecklists(projectId, ms.id);
            return { ...ms, checklists: checklistsPayload.checklists || [] };
          } catch {
            return { ...ms, checklists: [] };
          }
        })
      );

      setMilestones(milestonesWithChecklists);
      setProgress(msPayload.progress || { done: 0, total: 0 });
      setTasks(tasksPayload.tasks || []);
    } catch { /* Silent */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(projectId);
    const unsubProjectUpdate = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      if (incomingProjectId && incomingProjectId !== projectId) return;
      if (
        !updateType ||
        ![
          'milestone_created',
          'milestone_updated',
          'task_created',
          'task_updated',
          'member_removed',
          'project_activated',
        ].includes(updateType) &&
          !updateType.startsWith('checklist_')
      ) {
        return;
      }
      loadData();
    });

    return () => {
      unsubProjectUpdate();
      socket.off('connect');
    };
  }, [projectId, loadData]);

  const handleToggleDone = async (milestone: Milestone & { color?: string }) => {
    try {
      const updated = await projectService.updateMilestone(projectId, milestone.id, { done: !milestone.done });
      toast.success(milestone.done ? t('projects:masterplan.toasts.reopened') : t('projects:masterplan.toasts.completed'));
      if (updated.warning) toast(updated.warning, { icon: '⚠️' });
      loadData();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('projects:masterplan.toasts.updateFailed');
      toast.error(msg);
    }
  };

  const handleLinkedTaskDone = async (task: Task) => {
    if (task.status === 'done' || updatingTaskId === task.id) return;
    setUpdatingTaskId(task.id);
    try {
      await projectService.updateTask(projectId, task.id, { status: 'done' });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)));
      setMilestones((prev) =>
        prev.map((ms) => ({
          ...ms,
          linkedTasks: ms.linkedTasks?.map((lt) =>
            lt.id === task.id ? { ...lt, status: 'done' } : lt
          ),
        }))
      );
      toast.success(t('projects:masterplan.toasts.taskMarkedDone'));
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('projects:masterplan.toasts.taskUpdateFailed');
      toast.error(msg);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleOpenChecklist = (milestoneId: string, checklist: any) => {
    setSelectedChecklist({ milestoneId, checklist });
  };

  const handleCloseChecklist = () => {
    setSelectedChecklist(null);
  };

  const handleChecklistSaved = () => {
    loadData();
  };

  const handleOpenCreateChecklist = (milestoneId: string) => {
    setShowCreateChecklist({ milestoneId });
  };

  const handleCloseCreateChecklist = () => {
    setShowCreateChecklist(null);
  };

  const handleChecklistCreated = () => {
    loadData();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">{t('projects:masterplan.loading')}</p>
    </div>
  );

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl shadow-slate-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-slate-900">
          <Activity size={120} />
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
                <Flag size={12} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {t('projects:masterplan.title')}
              </h3>
            </div>
            <p className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">
              {t('projects:masterplan.statusLabel')}: <span className="text-cyan-600 italic">{progressPct === 100 ? t('projects:masterplan.status.done') : t('projects:masterplan.status.inProgress')}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-slate-900 tabular-nums">{progress.done}</span>
            <span className="text-slate-300 font-bold mx-2 text-xl">/</span>
            <span className="text-sm font-bold text-slate-400">{progress.total}</span>
          </div>
        </div>

        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1.5, ease: 'circOut' }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-600 to-indigo-500 rounded-full shadow-[0_0_15px_rgba(8,145,178,0.3)]"
          />
        </div>
        <div className="flex justify-between mt-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
          <span className="flex items-center gap-1.5"><Terminal size={10} /> {t('projects:masterplan.deploymentProgress')}</span>
          <span className="text-cyan-600">{t('projects:masterplan.progressDone', { percent: progressPct })}</span>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-600 hover:shadow-xl hover:shadow-cyan-100 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" /> {t('projects:masterplan.createNew')}
          </button>
        </div>
      )}

      {milestones.length > 0 ? (
        <div className="relative pl-8">
          <div className="absolute left-[39px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-500/20 via-slate-100 to-transparent" />

          <div className="space-y-8">
            {milestones.map((ms) => {
              const isPast = new Date(ms.due_date) < new Date() && !ms.done;
              return (
                <div key={ms.id} className="relative group">
                  <div className={`absolute -left-[5px] top-6 w-3.5 h-3.5 rounded-full border-[3px] z-10 transition-all group-hover:scale-125 ${
                    ms.done ? STATUS_GLOW.green : isPast ? STATUS_GLOW.red : STATUS_GLOW.gray
                  }`} />

                  <div className={`bg-white border border-slate-100 rounded-[32px] p-7 transition-all hover:border-cyan-200 hover:shadow-lg hover:shadow-slate-200/30 ${ms.done ? 'bg-slate-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className={`text-sm font-black tracking-tight uppercase ${ms.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {ms.title}
                          </h4>
                          {ms.done && <CheckCircle2 size={18} className="text-emerald-500" />}
                          {isPast && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-500 text-[8px] font-black uppercase tracking-tighter animate-pulse">
                              <AlertCircle size={10} /> {t('projects:masterplan.overdue')}
                            </div>
                          )}
                        </div>

                        {ms.description && (
                          <p className="text-[12px] text-slate-500 mb-5 font-medium leading-relaxed italic">
                            {ms.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                          <span className="flex items-center gap-1.5 bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl border border-slate-100">
                            <Calendar size={12} className="text-cyan-600" />
                            {ms.due_date?.slice(0, 10)}
                          </span>
                          {ms.linkedTasks && ms.linkedTasks.length > 0 && (
                            <span className="flex items-center gap-1.5 text-indigo-500 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100">
                              <LinkIcon size={12} />
                              {t('projects:masterplan.linkedTasksCount', { count: ms.linkedTasks.length })}
                            </span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <button
                          onClick={() => handleToggleDone(ms)}
                          className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                            ms.done
                              ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              : 'bg-slate-900 text-white hover:bg-cyan-600 shadow-md hover:shadow-cyan-100'
                          }`}
                        >
                          {ms.done ? t('projects:masterplan.reopen') : t('projects:masterplan.finish')}
                        </button>
                      )}
                    </div>

                    {ms.linkedTasks && ms.linkedTasks.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ms.linkedTasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl group/task hover:border-cyan-200 hover:bg-white transition-all shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={task.status === 'done'}
                                  disabled={task.status === 'done' || updatingTaskId === task.id}
                                  onChange={() => handleLinkedTaskDone(task as Task)}
                                  className="w-4 h-4 rounded border-slate-300 text-cyan-600 accent-cyan-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                />
                                <span className={`text-[11px] font-bold truncate ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {task.title}
                                </span>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                task.status === 'done' ? 'bg-emerald-50 text-emerald-600' :
                                task.status === 'in_progress' ? 'bg-cyan-50 text-cyan-600' :
                                'bg-slate-100 text-slate-400'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ms.checklists && ms.checklists.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                              <CheckSquare size={12} />
                            </div>
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {t('projects:masterplan.checklist.title')}
                            </h5>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenCreateChecklist(ms.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              <Plus size={12} />
                              {t('projects:masterplan.checklist.add')}
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {ms.checklists.map((checklist) => (
                            <div
                              key={checklist.id}
                              className="bg-amber-50/30 border border-amber-100 rounded-xl p-4 cursor-pointer hover:bg-amber-50/50 hover:border-amber-200 transition-all"
                              onClick={() => handleOpenChecklist(ms.id, checklist)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h6 className="text-sm font-bold text-slate-900 mb-1">{checklist.title}</h6>
                                  <div className="flex items-center gap-2">
                                    {checklist.is_completed && (
                                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600">
                                        {t('projects:masterplan.checklist.completedBadge')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {checklist.items.slice(0, 3).map((item: any) => (
                                  <div key={item.id} className="flex items-center gap-2 text-[11px]">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                      item.status === 'pass' ? 'bg-emerald-500' :
                                      item.status === 'fail' ? 'bg-rose-500' :
                                      item.status === 'na' ? 'bg-slate-400' :
                                      'bg-slate-300'
                                    }`} />
                                    <span className={`flex-1 truncate ${item.status === 'pass' ? 'text-emerald-700' : item.status === 'fail' ? 'text-rose-700' : 'text-slate-600'}`}>
                                      {item.title}
                                    </span>
                                  </div>
                                ))}
                                {checklist.items.length > 3 && (
                                  <p className="text-[9px] text-slate-400 font-medium">
                                    {t('projects:masterplan.checklist.moreItems', { count: checklist.items.length - 3 })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!ms.checklists || ms.checklists.length === 0) && (
                      <div className="mt-6 pt-6 border-t border-slate-50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                              <CheckSquare size={12} />
                            </div>
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {t('projects:masterplan.checklist.title')}
                            </h5>
                          </div>
                        </div>
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                            <CheckSquare size={24} className="text-amber-400" />
                          </div>
                          <p className="text-sm text-slate-600 mb-4">{t('projects:masterplan.checklist.empty')}</p>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenCreateChecklist(ms.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              <Plus size={16} />
                              {t('projects:masterplan.checklist.createFirst')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-[48px] p-24 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
            <Flag size={32} className="text-slate-200" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 italic">{t('projects:masterplan.empty')}</p>
        </div>
      )}

      {showModal && (
        <MilestoneModal
          projectId={projectId}
          tasks={tasks}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}

      {selectedChecklist && (
        <ChecklistModal
          projectId={projectId}
          milestoneId={selectedChecklist.milestoneId}
          checklist={selectedChecklist.checklist}
          canEdit={canEdit}
          onClose={handleCloseChecklist}
          onSaved={handleChecklistSaved}
        />
      )}

      {showCreateChecklist && (
        <CreateChecklistModal
          projectId={projectId}
          milestoneId={showCreateChecklist.milestoneId}
          onClose={handleCloseCreateChecklist}
          onCreated={handleChecklistCreated}
        />
      )}
    </div>
  );
};

type MilestoneModalFieldKey = 'title' | 'description' | 'due_date' | 'linked_tasks';

const milestoneInputClass = (hasError: boolean, extra = '') =>
  [
    'w-full px-4 py-3 rounded-xl outline-none text-sm transition-all',
    extra,
    hasError
      ? 'bg-rose-50 border border-rose-300 ring-1 ring-rose-100 text-slate-900 focus:border-rose-400'
      : 'bg-slate-50 border border-slate-100 text-slate-900 focus:border-cyan-500 focus:bg-white',
  ]
    .filter(Boolean)
    .join(' ');

const MilestoneModal: React.FC<{ projectId: string; tasks: Task[]; onClose: () => void; onSaved: () => void }> = ({ projectId, tasks, onClose, onSaved }) => {
  const { t } = useTranslation();
  const linkableTasks = tasks.filter((task) => task.status !== 'done');
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', linked_task_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<MilestoneModalFieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clearField = (key: MilestoneModalFieldKey) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const toggleTask = (taskId: string) => {
    setForm((f) => ({
      ...f,
      linked_task_ids: f.linked_task_ids?.includes(taskId)
        ? f.linked_task_ids.filter((id) => id !== taskId)
        : [...(f.linked_task_ids || []), taskId],
    }));
    clearField('linked_tasks');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const req: Partial<Record<MilestoneModalFieldKey, string>> = {};
    if (!form.title.trim()) req.title = t('projects:masterplan.modal.errors.titleRequired');
    if (!form.due_date) req.due_date = t('projects:masterplan.modal.errors.dueDateRequired');
    if (Object.keys(req).length > 0) {
      setFieldErrors(req);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await projectService.createMilestone(projectId, {
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date,
        linked_tasks: form.linked_task_ids.length ? form.linked_task_ids : undefined,
      });
      toast.success(t('projects:masterplan.modal.toasts.created'));
      onSaved();
    } catch (err: unknown) {
      const { message, fieldErrors: apiFe } = parseApiFormError(err);
      const apiFeTr = translateFieldErrors(t, apiFe);
      const next: Partial<Record<MilestoneModalFieldKey, string>> = {};
      const pick = (k: MilestoneModalFieldKey) => {
        const v = apiFeTr[k];
        if (v) next[k] = v;
      };
      pick('title');
      pick('description');
      pick('due_date');
      const lt = apiFeTr.linked_tasks;
      if (lt) next.linked_tasks = lt;
      if (Object.keys(next).length > 0) {
        setFieldErrors(next);
        setFormError(null);
      } else if (message) {
        setFormError(translateApiMessage(t, message));
      } else {
        const fb = t('projects:masterplan.modal.toasts.createFailed');
        setFormError(fb);
        toast.error(fb);
      }
    } finally { setSaving(false); }
  };

  return createPortal(
    (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-[221] isolate w-full max-w-lg overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl max-h-[86vh] flex flex-col"
      >
        <div className="p-6 sm:p-7 pb-3">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-600" /> {t('projects:masterplan.modal.title')}
              </h3>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-[0.08em]">{t('projects:masterplan.modal.subtitle')}</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 sm:px-7 pb-6 space-y-4 overflow-y-auto custom-scrollbar">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div className="group">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 mb-2 block ml-1 group-focus-within:text-cyan-600 transition-colors">{t('projects:masterplan.modal.fields.title')}</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => {
                  setForm((f) => ({ ...f, title: e.target.value }));
                  clearField('title');
                }}
                className={milestoneInputClass(!!fieldErrors.title, 'font-bold placeholder:text-slate-300')}
                placeholder={t('projects:masterplan.modal.placeholders.title')}
                aria-invalid={!!fieldErrors.title}
              />
              {fieldErrors.title && (
                <p className="text-xs font-semibold text-rose-600 mt-1 ml-1">{fieldErrors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 mb-2 block ml-1">{t('projects:masterplan.modal.fields.dueDate')}</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, due_date: e.target.value }));
                    clearField('due_date');
                  }}
                  className={milestoneInputClass(!!fieldErrors.due_date, 'font-mono')}
                  aria-invalid={!!fieldErrors.due_date}
                />
                {fieldErrors.due_date && (
                  <p className="text-xs font-semibold text-rose-600 mt-1 ml-1">{fieldErrors.due_date}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 mb-2 block ml-1 italic opacity-60">{t('projects:masterplan.modal.autoCode')}</label>
                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-300 select-none italic">
                  GEN-MS-AUTO
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 mb-2 block ml-1">{t('projects:masterplan.modal.fields.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => {
                  setForm((f) => ({ ...f, description: e.target.value }));
                  clearField('description');
                }}
                rows={2}
                className={milestoneInputClass(!!fieldErrors.description, 'min-h-[90px] font-medium resize-y placeholder:text-slate-300')}
                placeholder={t('projects:masterplan.modal.placeholders.description')}
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description && (
                <p className="text-xs font-semibold text-rose-600 ml-1">{fieldErrors.description}</p>
              )}
            </div>
          </div>

          {linkableTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 mb-3 block ml-1">{t('projects:masterplan.modal.linkTasks')}</label>
              <div
                className={`grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar rounded-xl p-1 ${
                  fieldErrors.linked_tasks ? 'bg-rose-50 border border-rose-200' : 'bg-white'
                }`}
              >
                {linkableTasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-white hover:border-cyan-200 transition-all group">
                    <input
                      type="checkbox"
                      checked={form.linked_task_ids?.includes(task.id) || false}
                      onChange={() => toggleTask(task.id)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 accent-cyan-600 transition-all shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors leading-snug line-clamp-1">
                        {task.title}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                        {t('projects:tasks.status.' + task.status)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {fieldErrors.linked_tasks && (
                <p className="text-xs font-semibold text-rose-600 mt-2 ml-1">{fieldErrors.linked_tasks}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100 bg-white sticky bottom-0">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-[0.08em] hover:bg-slate-100 transition-all">{t('common:actions.cancel')}</button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[1.5] py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.08em] hover:bg-cyan-600 hover:shadow-xl hover:shadow-cyan-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : (
                <>
                  <PlusCircle size={18} /> {t('projects:masterplan.modal.submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
    ),
    document.body
  );
};

export default MasterPlanTab;
