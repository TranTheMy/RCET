import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Loader2, Plus, X, Layout, Cpu, CheckCircle2, 
  User, Clock, Search, Filter, ChevronDown, AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';
import { realtimeService } from '../../../services/realtime.service';
import type { Task, TaskStatus, TaskPriority, CreateTaskRequest, ProjectMember, MemberWorkloadSummary } from '../../../types';
import toast from 'react-hot-toast';
import { parseApiFormError } from '../../../utils/formFieldErrors';
import { translateApiMessage, translateFieldErrors } from '../../../utils/apiErrorI18n';

/* --- Constants --- */
const STATUS_COLS: { key: TaskStatus; label: string; color: string; bg: string }[] = [
  { key: 'todo', label: 'todo', color: 'text-slate-600', bg: 'bg-slate-50 border border-slate-200' },
  { key: 'in_progress', label: 'in_progress', color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-100' },
  { key: 'review', label: 'review', color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-100' },
  { key: 'done', label: 'done', color: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100' },
];

const PRIORITY_MAP: Record<TaskPriority, { label: string; color: string; border: string }> = {
  low: { label: 'low', color: 'text-slate-500', border: 'border-slate-200 bg-slate-50' },
  medium: { label: 'medium', color: 'text-blue-600', border: 'border-blue-100 bg-blue-50' },
  high: { label: 'high', color: 'text-orange-600', border: 'border-orange-100 bg-orange-50' },
  urgent: { label: 'urgent', color: 'text-red-600', border: 'border-red-100 bg-red-50' },
};

/* --- Main Component --- */
const TasksTab: React.FC<{
  projectId: string;
  canEdit: boolean;
  isStrictMember?: boolean;
  currentUserId?: string;
}> = ({ projectId, canEdit, isStrictMember = false, currentUserId }) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksPayload, membersArray] = await Promise.all([
        projectService.listTasks(projectId),
        projectService.listMembers(projectId),
      ]);
      setTasks(tasksPayload.tasks || []);
      setMembers(Array.isArray(membersArray) ? membersArray : []);
    } catch (error) {
      toast.error(t('projects:tasks.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(projectId);
    const unsubProjectUpdate = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      if (incomingProjectId && incomingProjectId !== projectId) return;
      if (!updateType || !['task_created', 'task_updated', 'member_added', 'member_removed'].includes(updateType)) return;
      loadData();
    });

    return () => {
      unsubProjectUpdate();
      socket.off('connect');
    };
  }, [projectId, loadData]);

  // Logic lọc Task
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMember = 
        selectedMemberId === 'all' || 
        task.assignee_id === selectedMemberId;

      return matchesSearch && matchesMember;
    });
  }, [tasks, searchTerm, selectedMemberId]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      await projectService.updateTask(projectId, task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
      toast.success(t('projects:tasks.toasts.statusChanged', { status: t(`projects:tasks.status.${newStatus}`) }));
    } catch {
      toast.error(t('projects:tasks.toasts.statusSyncFailed'));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('projects:tasks.loading')}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Tab Header & Filter Controls — đồng bộ Reports / Overview / Members */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-600 shadow-sm">
            <Layout size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900">{t('projects:tasks.title')}</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t('projects:tasks.subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group min-w-[200px] md:min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-600 transition-colors" size={14} />
            <input 
              type="text"
              placeholder={t('projects:tasks.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-[10px] font-bold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15"
            />
          </div>

          <div className="relative group min-w-[160px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="appearance-none w-full cursor-pointer rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-10 text-[10px] font-bold uppercase tracking-widest text-slate-800 shadow-sm outline-none transition-all focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/15"
            >
              <option value="all">{t('projects:tasks.allMembers')}</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user?.full_name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={14} />
          </div>

          {canEdit && (
            <button 
              type="button"
              onClick={() => { setEditingTask(null); setShowModal(true); }} 
              className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition-all hover:bg-cyan-600 hover:shadow-cyan-100/80"
            >
              <Plus size={16} /> {t('projects:tasks.createTask')}
            </button>
          )}
        </div>
      </div>

      {/* Kanban — khối card trắng như Reports */}
      <div className="rounded-[40px] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/50 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_COLS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="flex min-h-[480px] flex-col">
              <div className={`mb-4 flex items-center justify-between rounded-2xl p-4 ${col.bg}`}>
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full bg-current ${col.color}`} />
                  <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${col.color}`}>{t(`projects:tasks.status.${col.label}`)}</h4>
                </div>
                <span className="font-mono text-[10px] font-black text-slate-400">{colTasks.length.toString().padStart(2, '0')}</span>
              </div>

              <div className="custom-scrollbar flex max-h-[calc(100vh-320px)] flex-1 flex-col space-y-3 overflow-y-auto pr-1">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onEdit={canEdit ? () => { setEditingTask(task); setShowModal(true); } : undefined}
                    canChangeStatus={
                      !isStrictMember || (currentUserId != null && task.assignee_id === currentUserId)
                    }
                  />
                ))}
                
                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
                      <Cpu size={14} />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {searchTerm || selectedMemberId !== 'all' ? t('projects:tasks.empty.filtered') : t('projects:tasks.empty.blank')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {showModal && (
        <TaskModal
          projectId={projectId}
          task={editingTask}
          members={members}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

/* --- Sub-Component: Task Card --- */
const TaskCard: React.FC<{
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onEdit?: () => void;
  canChangeStatus: boolean;
}> = ({ task, onStatusChange, onEdit, canChangeStatus }) => {
  const { t } = useTranslation();
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const priority = PRIORITY_MAP[task.priority];

  return (
    <div
      onClick={onEdit}
      className={`group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-cyan-200 hover:shadow-md ${onEdit ? 'cursor-pointer' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${priority.border} ${priority.color}`}>
          {t(`projects:tasks.priority.${priority.label}`)}
        </div>
        <select
          value={task.status}
          disabled={!canChangeStatus}
          onChange={(e) => { e.stopPropagation(); onStatusChange(task, e.target.value as TaskStatus); }}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer bg-transparent text-[9px] font-black uppercase tracking-tighter text-slate-500 outline-none transition-colors hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {STATUS_COLS.map((s) => (
            <option key={s.key} value={s.key} className="bg-white text-slate-800">
              {t(`projects:tasks.status.${s.label}`)}
            </option>
          ))}
        </select>
      </div>

      <h5 className="mb-4 line-clamp-2 text-xs font-bold leading-relaxed text-slate-900 transition-colors group-hover:text-cyan-700">
        {task.title}
      </h5>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="-space-x-2 flex">
          {task.assignee ? (
            <div className="group/user relative">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-white bg-gradient-to-br from-cyan-600 to-slate-800 text-[8px] font-black text-white shadow-sm">
                {task.assignee.full_name.charAt(0)}
              </div>
              <span className="absolute -top-8 left-0 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[8px] font-black uppercase text-white opacity-0 shadow-lg transition-opacity group-hover/user:opacity-100">
                {task.assignee.full_name}
              </span>
            </div>
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-400">
              <User size={10} />
            </div>
          )}
        </div>

        {task.due_date && (
          <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            <Clock size={10} />
            <span className="font-mono text-[9px] font-bold">{task.due_date.slice(5, 10).replace('-', '/')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* --- Sub-Component: Task Modal --- */
type TaskModalFieldKey = 'title' | 'description' | 'priority' | 'due_date' | 'assignee_id' | 'status';

const TASK_TITLE_MAX_LEN = 255;

function validateTaskModalForm(
  form: CreateTaskRequest,
  t: (key: string, opts?: Record<string, unknown>) => string,
): Partial<Record<TaskModalFieldKey, string>> {
  const err: Partial<Record<TaskModalFieldKey, string>> = {};
  const title = form.title.trim();
  if (!title) {
    err.title = t('projects:tasks.modal.errors.titleRequired');
  } else if (title.length > TASK_TITLE_MAX_LEN) {
    err.title = t('projects:tasks.modal.errors.titleMaxLength');
  }
  if (form.due_date?.trim()) {
    const d = new Date(`${form.due_date.trim()}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      err.due_date = t('projects:tasks.modal.errors.dueDateInvalid');
    }
  }
  return err;
}

const TaskModal: React.FC<{
  projectId: string;
  task: Task | null;
  members: ProjectMember[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, task, members, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateTaskRequest>({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    assignee_id: task?.assignee_id || '',
    due_date: task?.due_date?.slice(0, 10) || '',
  });
  const [saving, setSaving] = useState(false);
  const [workload, setWorkload] = useState<MemberWorkloadSummary | null>(null);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TaskModalFieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!formError) return;
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [formError]);

  const taskInputClass = (hasError: boolean, extra = '') =>
    [
      'w-full rounded-2xl border bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition-all',
      'placeholder:text-slate-600 placeholder:font-medium',
      extra,
      hasError
        ? 'border-red-400 bg-red-50/50 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/15',
    ].join(' ');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const assigneeId = form.assignee_id;
    if (!assigneeId) {
      setWorkload(null);
      return;
    }
    let active = true;
    setLoadingWorkload(true);
    projectService.getMemberWorkload(projectId, assigneeId)
      .then((data) => {
        if (!active) return;
        setWorkload(data);
      })
      .catch(() => {
        if (!active) return;
        setWorkload(null);
      })
      .finally(() => {
        if (active) setLoadingWorkload(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, form.assignee_id]);

  const clearField = (key: TaskModalFieldKey) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clientErr = validateTaskModalForm(form, t);
    if (Object.keys(clientErr).length > 0) {
      setFieldErrors(clientErr);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = { 
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() ?? '',
        assignee_id: form.assignee_id || undefined, 
        due_date: form.due_date?.trim() || undefined,
      };
      if (task) {
        await projectService.updateTask(projectId, task.id, payload);
      } else {
        await projectService.createTask(projectId, payload);
      }
      onSaved();
      toast.success(t('projects:tasks.modal.toasts.saved'));
    } catch (err: unknown) {
      const { message, fieldErrors: apiFe } = parseApiFormError(err);
      const apiFeTr = translateFieldErrors(t, apiFe);
      const next: Partial<Record<TaskModalFieldKey, string>> = {};
      const pick = (k: TaskModalFieldKey) => {
        const v = apiFeTr[k];
        if (v) next[k] = v;
      };
      pick('title');
      pick('description');
      pick('priority');
      pick('due_date');
      pick('assignee_id');
      pick('status');
      if (Object.keys(next).length > 0) {
        setFieldErrors(next);
        setFormError(null);
      } else if (message) {
        setFormError(translateApiMessage(t, message));
      } else {
        setFormError(t('projects:tasks.modal.toasts.saveFailed'));
      }
    } 
    finally { setSaving(false); }
  };

  return createPortal(
    (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative z-[1] isolate flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-600 shadow-sm">
              <Cpu size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-[13px] font-black uppercase leading-tight tracking-[0.06em] text-slate-900 sm:text-sm">
                {task ? t('projects:tasks.modal.editTitle') : t('projects:tasks.modal.createTitle')}
              </h3>
              <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-slate-400 sm:text-[11px]">
                {t('projects:tasks.modal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label={t('common:actions.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-6 sm:p-8">
          {formError && (
            <div
              ref={errorBannerRef}
              className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              <p className="text-sm font-semibold leading-snug">{formError}</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
              {t('projects:tasks.modal.fields.title')}
              <span className="text-red-600" aria-hidden> *</span>
            </label>
            <input 
              value={form.title} 
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                clearField('title');
              }} 
              className={taskInputClass(!!fieldErrors.title, 'font-bold')}
              placeholder={t('projects:tasks.modal.placeholders.title')}
              maxLength={TASK_TITLE_MAX_LEN}
              autoComplete="off"
              aria-invalid={!!fieldErrors.title}
              aria-required
            />
            {fieldErrors.title && (
              <p className="ml-1 text-xs font-semibold text-red-600">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{t('projects:tasks.modal.fields.description')}</label>
            <textarea 
              value={form.description} 
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
                clearField('description');
              }} 
              rows={3} 
              className={taskInputClass(!!fieldErrors.description, 'min-h-[110px] resize-y font-medium text-slate-700')}
              placeholder={t('projects:tasks.modal.placeholders.description')}
              aria-invalid={!!fieldErrors.description}
            />
            {fieldErrors.description && (
              <p className="ml-1 text-xs font-semibold text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{t('projects:tasks.modal.fields.priority')}</label>
              <select 
                value={form.priority} 
                onChange={(e) => {
                  setForm({ ...form, priority: e.target.value as TaskPriority });
                  clearField('priority');
                }} 
                className={taskInputClass(!!fieldErrors.priority, 'cursor-pointer appearance-none bg-white text-sm font-bold text-slate-900')}
                aria-invalid={!!fieldErrors.priority}
              >
                <option value="low">{t('projects:tasks.priority.low')}</option>
                <option value="medium">{t('projects:tasks.priority.medium')}</option>
                <option value="high">{t('projects:tasks.priority.high')}</option>
                <option value="urgent">{t('projects:tasks.priority.urgent')}</option>
              </select>
              {fieldErrors.priority && (
                <p className="ml-1 text-xs font-semibold text-red-600">{fieldErrors.priority}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{t('projects:tasks.modal.fields.dueDate')}</label>
              <input 
                type="date" 
                value={form.due_date} 
                onChange={(e) => {
                  setForm({ ...form, due_date: e.target.value });
                  clearField('due_date');
                }} 
                className={taskInputClass(!!fieldErrors.due_date, 'text-sm font-bold text-slate-900 [color-scheme:light]')} 
                aria-invalid={!!fieldErrors.due_date}
              />
              {fieldErrors.due_date && (
                <p className="ml-1 text-xs font-semibold text-red-600">{fieldErrors.due_date}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{t('projects:tasks.modal.fields.assignee')}</label>
            <select 
              value={form.assignee_id} 
              onChange={(e) => {
                setForm({ ...form, assignee_id: e.target.value });
                clearField('assignee_id');
              }} 
              className={taskInputClass(!!fieldErrors.assignee_id, 'cursor-pointer appearance-none bg-white text-sm font-bold text-slate-900')}
              aria-invalid={!!fieldErrors.assignee_id}
            >
              <option value="">{t('projects:tasks.modal.unassigned')}</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user?.full_name}</option>)}
            </select>
            {fieldErrors.assignee_id && (
              <p className="ml-1 text-xs font-semibold text-red-600">{fieldErrors.assignee_id}</p>
            )}
          </div>

          {form.assignee_id && (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3">
              {loadingWorkload ? (
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700">
                  <Loader2 size={14} className="animate-spin" /> Loading workload...
                </div>
              ) : workload ? (
                <div className="grid grid-cols-3 gap-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                  <div>
                    Active projects
                    <div className="mt-1 text-sm text-slate-900">{workload.active_projects}</div>
                  </div>
                  <div>
                    Open tasks
                    <div className={`mt-1 text-sm ${workload.exceeds_open_task_limit ? 'text-rose-600' : 'text-slate-900'}`}>
                      {workload.open_tasks}/{workload.limits.max_open_tasks}
                    </div>
                  </div>
                  <div>
                    Overdue
                    <div className={`mt-1 text-sm ${workload.overdue_tasks >= workload.limits.warn_overdue_tasks ? 'text-amber-600' : 'text-slate-900'}`}>
                      {workload.overdue_tasks}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-slate-500">Cannot load assignee workload.</p>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              disabled={saving} 
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-slate-200 transition-all hover:bg-cyan-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {task ? t('projects:tasks.modal.submitUpdate') : t('projects:tasks.modal.submitCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
    ),
    document.body
  );
};

export default TasksTab;