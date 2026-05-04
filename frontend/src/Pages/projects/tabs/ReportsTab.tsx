import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Loader2, Plus, X, FileText, Shield, MessageSquare,
  Send, Fingerprint, LayoutGrid, List, FileUp, Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';
import { weeklyReportCommentService } from '../../../services/weeklyReportComment.service';
import { useAuthStore } from '../../../store/authStore';
import type { WeeklyReport, CreateReportRequest, ComplianceMatrixRow, WeeklyReportComment, Task } from '../../../types';
import toast from 'react-hot-toast';
import { parseApiFormError } from '../../../utils/formFieldErrors';
import { translateApiMessage, translateFieldErrors } from '../../../utils/apiErrorI18n';
import { PdfPreviewPanel } from '../../../components/preview/PdfPreviewPanel';
import { realtimeService } from '../../../services/realtime.service';

// --- Cấu hình màu sắc trạng thái (Light Mode) ---
const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  late: 'bg-amber-50 text-amber-600 border-amber-100',
  missing: 'bg-rose-50 text-rose-600 border-rose-100',
};

const ReportsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [compliance, setCompliance] = useState<ComplianceMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByReport, setCommentsByReport] = useState<Record<string, WeeklyReportComment[]>>({});
  const [commentsLoadingId, setCommentsLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [reportsPayload, complianceRows] = await Promise.all([
        projectService.listReports(projectId),
        projectService.getCompliance(projectId, { weeks: 12 }),
      ]);
      setReports(reportsPayload.reports || []);
      setCompliance(Array.isArray(complianceRows) ? complianceRows : []);
    } catch {
      toast.error(t('projects:reports.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(projectId);
    const unsubProjectUpdate = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      const weeklyReportId = (payload as { data?: { weeklyReportId?: string } })?.data?.weeklyReportId;
      if (incomingProjectId && incomingProjectId !== projectId) return;
      if (updateType === 'report_created') {
        loadData();
        return;
      }
      if (!updateType || !['report_comment_created', 'report_comment_updated', 'report_comment_deleted'].includes(updateType)) return;
      if (!expandedId || !weeklyReportId || weeklyReportId !== expandedId) return;
      void refreshCommentsFor(expandedId);
    });
    return () => {
      unsubProjectUpdate();
      socket.off('connect');
    };
  }, [projectId, expandedId, loadData]);

  // Handle Comments logic (Giữ nguyên logic của bạn)
  useEffect(() => {
    if (!expandedId) return;
    let cancelled = false;
    setCommentsLoadingId(expandedId);
    (async () => {
      try {
        const rows = await weeklyReportCommentService.list(expandedId);
        if (cancelled) return;
        setCommentsByReport((m) => ({ ...m, [expandedId]: Array.isArray(rows) ? rows : [] }));
      } catch {
        if (!cancelled) toast.error(t('projects:reports.toasts.cannotLoadComments'));
      } finally {
        if (!cancelled) setCommentsLoadingId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [expandedId, t]);

  const refreshCommentsFor = async (id: string) => {
    const rows = await weeklyReportCommentService.list(id);
    setCommentsByReport((m) => ({ ...m, [id]: Array.isArray(rows) ? rows : [] }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('projects:reports.loading')}</p>
    </div>
  );

  const complianceColumns = buildComplianceWeekColumns(compliance);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100">
            <Shield size={22} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900">{t('projects:reports.title')}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">{t('projects:reports.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={14} /> {t('projects:reports.view.list')}
            </button>
            <button 
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'matrix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={14} /> {t('projects:reports.view.matrix')}
            </button>
          </div>
          
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 transition-all shadow-lg shadow-slate-200"
          >
            <Plus size={16} /> {t('projects:reports.submit')}
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-xl shadow-slate-200/40"
        >
          {reports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-8 py-6">{t('projects:reports.table.weekYear')}</th>
                    <th className="px-8 py-6">{t('projects:reports.table.user')}</th>
                    <th className="px-8 py-6">{t('projects:reports.table.status')}</th>
                    <th className="px-8 py-6">{t('projects:reports.table.task')}</th>
                    <th className="px-8 py-6 text-right">{t('projects:reports.table.schedule')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reports.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr 
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className={`group cursor-pointer transition-all hover:bg-slate-50/80 ${expandedId === r.id ? 'bg-cyan-50/30' : ''}`}
                      >
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-cyan-500" />
                             <span className="font-mono font-bold text-slate-900">W{r.week_number} <span className="text-slate-300 mx-1">/</span> {r.year}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-[11px] font-black shadow-sm">
                              {r.user?.full_name?.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{r.user?.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase border ${STATUS_STYLE[r.status]}`}>
                            {r.status === 'submitted' ? t('projects:reports.status.submitted') : r.status === 'late' ? t('projects:reports.status.late') : t('projects:reports.status.missing')}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase border border-indigo-100 bg-indigo-50 text-indigo-700">
                            {(r.selected_tasks || []).length} {t('projects:reports.taskLabel')}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-slate-900">{r.submitted_at?.slice(0, 10) || t('projects:reports.notSubmitted')}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">{t('projects:reports.dueDate', { date: r.due_date?.slice(0, 10) })}</span>
                           </div>
                        </td>
                      </tr>
                      <AnimatePresence>
                        {expandedId === r.id && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-slate-50/50"
                              >
                                <div className="px-12 py-8 space-y-8">
                                   <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                      <div className="lg:col-span-3 space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-600 flex items-center gap-2">
                                          <FileText size={12} /> {t('projects:reports.filePreview')}
                                        </h4>
                                        {r.file_url || r.link_url ? (
                                          <div className="bg-[#0b1220] rounded-[24px] border border-slate-800 shadow-sm overflow-hidden">
                                            <PdfPreviewPanel
                                              title={`weekly-report-${r.id}`}
                                              loadPreviewBlob={() => projectService.getReportPreviewBlob(projectId, r.id)}
                                              tabOpenUrl={r.file_url || r.link_url || null}
                                              showToolbar={false}
                                              className="min-h-[520px]"
                                            />
                                          </div>
                                        ) : (
                                          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm text-sm text-slate-500">
                                            {t('projects:reports.noFile')}
                                          </div>
                                        )}
                                        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
                                          <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
                                            {t('projects:reports.selectedTasks')}
                                          </h5>
                                          {(r.selected_tasks || []).length > 0 ? (
                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                              {(r.selected_tasks || []).map((task) => (
                                                <div key={task.id} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-900 text-xs font-bold border border-indigo-100">
                                                  {task.title}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs italic text-slate-400">{t('projects:reports.noTaskSelected')}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="lg:col-span-2">
                                         <WeeklyReportCommentsPanel 
                                            weeklyReportId={r.id}
                                            comments={commentsByReport[r.id] ?? []}
                                            loading={commentsLoadingId === r.id}
                                            currentUserId={user?.id}
                                            onRefresh={() => refreshCommentsFor(r.id)}
                                         />
                                      </div>
                                   </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200 mb-4">
                 <FileText size={40} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 italic">{t('projects:reports.empty')}</p>
            </div>
          )}
        </motion.div>
      ) : (
        /* Matrix View */
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-100 rounded-[40px] p-10 shadow-xl shadow-slate-200/40 overflow-x-auto"
        >
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">{t('projects:reports.complianceMatrix')}</h3>
            <Fingerprint size={20} className="text-slate-200" />
          </div>
          
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-4 pr-8 text-[10px] font-black uppercase text-slate-400 border-b border-slate-50">{t('projects:reports.matrix.member')}</th>
                {complianceColumns.map((col) => (
                  <th key={col.key} className="p-4 text-center border-b border-slate-50">
                    <div className="text-[9px] font-mono font-bold text-slate-400 rotate-[-45deg] whitespace-nowrap">
                      {col.year}·W{col.week_number}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compliance.map((row) => (
                <tr key={row.user.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 pr-8 border-b border-slate-50 whitespace-nowrap">
                    <span className="text-sm font-black text-slate-700">{row.user.full_name}</span>
                  </td>
                  {complianceColumns.map((col) => {
                    const st = complianceCellStatus(row, col.week_number, col.year);
                    return (
                      <td key={col.key} className="p-4 text-center border-b border-slate-50">
                        <motion.div 
                          whileHover={{ scale: 1.2 }}
                          className={`w-6 h-6 mx-auto rounded-lg shadow-sm border-2 border-white ${
                            st === 'submitted' ? 'bg-emerald-400 shadow-emerald-100' : 
                            st === 'late' ? 'bg-amber-400 shadow-amber-100' : 'bg-rose-400 shadow-rose-100 opacity-30'
                          }`}
                          title={`${col.year} W${col.week_number}: ${st || t('projects:reports.status.missing')}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-8 mt-12 pt-8 border-t border-slate-50">
             <LegendItem label={t('projects:reports.legend.onTime')} color="bg-emerald-400" />
             <LegendItem label={t('projects:reports.legend.late')} color="bg-amber-400" />
             <LegendItem label={t('projects:reports.legend.missing')} color="bg-rose-400/30" />
          </div>
        </motion.div>
      )}

      {showModal && <ReportModal projectId={projectId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadData(); }} />}
    </div>
  );
};

// --- Sub-components (Light Modern Styling) ---

const LegendItem: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-md ${color}`} />
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
  </div>
);

type ReportModalFieldKey = 'week_number' | 'year' | 'link_url' | 'task_ids' | 'file' | 'content' | 'source_type';

const reportModalFieldClass = (hasError: boolean, base = '') =>
  [
    base,
    'w-full rounded-[24px] px-6 py-4 outline-none transition-all',
    hasError
      ? 'bg-rose-50/80 border border-rose-300 ring-2 ring-rose-100'
      : 'bg-slate-50 border-none focus:ring-2 ring-cyan-100',
  ]
    .filter(Boolean)
    .join(' ');

const ReportModal: React.FC<{ projectId: string; onClose: () => void; onSaved: () => void }> = ({ projectId, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const now = new Date();
  const [form, setForm] = useState<CreateReportRequest>({
    week_number: getISOWeek(now),
    year: now.getFullYear(),
    content: '',
    source_type: 'upload',
    link_url: '',
    task_ids: [],
  });
  const [file, setFile] = useState<File | null>(null);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [loadingDoneTasks, setLoadingDoneTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReportModalFieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clearField = (key: ReportModalFieldKey) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const mapReportMessageToFields = (msg: string): Partial<Record<ReportModalFieldKey, string>> => {
    const m = msg.toLowerCase();
    if (/link|url|uri/.test(m) && /invalid|must be|định dạng/.test(m)) return { link_url: msg };
    if (/week|tuần|w\d|already submitted|đã nộp|trùng/.test(m)) return {}; // form-level / duplicate
    if (/task|hoàn thành|completed/.test(m) && /chọn|select|least|ít nhất|chỉ được chọn/.test(m)) return { task_ids: msg };
    if (/cloudinary|upload|file|tệp/.test(m)) return { file: msg };
    return {};
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user?.id) return;
      setLoadingDoneTasks(true);
      try {
        const payload = await projectService.listTasks(projectId, { assignee_id: user.id, status: 'done' });
        if (!active) return;
        setDoneTasks(payload.tasks || []);
      } catch {
        if (active) setDoneTasks([]);
      } finally {
        if (active) setLoadingDoneTasks(false);
      }
    };
    run();
    return () => { active = false; };
  }, [projectId, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next: Partial<Record<ReportModalFieldKey, string>> = {};
    if (form.source_type === 'upload' && !file) {
      next.file = t('projects:reports.modal.errors.fileRequired');
    }
    if (form.source_type === 'link' && !form.link_url?.trim()) {
      next.link_url = t('projects:reports.modal.errors.linkRequired');
    }
    if (!form.task_ids || form.task_ids.length === 0) {
      next.task_ids = t('projects:reports.modal.errors.taskRequired');
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await projectService.createReport(projectId, {
        ...form,
        file: form.source_type === 'upload' ? file || undefined : undefined,
      });
      toast.success(t('projects:reports.modal.toasts.saved'));
      onSaved();
    } catch (err: unknown) {
      const { message, fieldErrors: apiFe } = parseApiFormError(err);
      const apiFeTr = translateFieldErrors(t, apiFe);
      const merged: Partial<Record<ReportModalFieldKey, string>> = {};
      const take = (k: ReportModalFieldKey) => {
        const v = apiFeTr[k];
        if (v) merged[k] = v;
      };
      take('week_number');
      take('year');
      take('link_url');
      take('task_ids');
      take('content');
      take('source_type');

      const msg =
        (message ? translateApiMessage(t, message) : '') ||
        t('projects:reports.modal.toasts.saveFailed');
      if (Object.keys(merged).length > 0) {
        setFieldErrors(merged);
        setFormError(null);
      } else {
        const inferred = message ? mapReportMessageToFields(message) : {};
        if (Object.keys(inferred).length > 0) {
          const trInferred: Partial<Record<ReportModalFieldKey, string>> = {};
          for (const [k, v] of Object.entries(inferred)) {
            if (v) trInferred[k as ReportModalFieldKey] = translateApiMessage(t, v);
          }
          setFieldErrors(trInferred);
          setFormError(null);
        } else if (message) {
          setFormError(msg);
        } else {
          setFormError(t('projects:reports.modal.toasts.saveFailed'));
          toast.error(t('projects:reports.modal.toasts.saveFailed'));
        }
      }
    } finally { setSaving(false); }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-6"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-[1] isolate max-h-[90vh] flex flex-col bg-white border border-slate-100 rounded-[48px] w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-10 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{t('projects:reports.modal.title')}</h3>
            <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest mt-1 italic">{t('projects:reports.modal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
          {formError && (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-semibold text-rose-800">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.week')}</label>
              <input
                type="number"
                value={form.week_number}
                onChange={(e) => {
                  setForm((f) => ({ ...f, week_number: parseInt(e.target.value, 10) }));
                  clearField('week_number');
                }}
                className={reportModalFieldClass(!!fieldErrors.week_number, 'text-sm font-mono font-bold text-slate-900')}
                aria-invalid={!!fieldErrors.week_number}
              />
              {fieldErrors.week_number && (
                <p className="text-xs font-semibold text-rose-600 ml-2">{fieldErrors.week_number}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.year')}</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => {
                  setForm((f) => ({ ...f, year: parseInt(e.target.value, 10) }));
                  clearField('year');
                }}
                className={reportModalFieldClass(!!fieldErrors.year, 'text-sm font-mono font-bold text-slate-900')}
                aria-invalid={!!fieldErrors.year}
              />
              {fieldErrors.year && (
                <p className="text-xs font-semibold text-rose-600 ml-2">{fieldErrors.year}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.source')}</label>
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, source_type: 'upload' }));
                  clearField('file');
                  clearField('link_url');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                  form.source_type === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
                }`}
              >
                <FileUp size={14} /> {t('projects:reports.modal.source.upload')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, source_type: 'link' }));
                  clearField('file');
                  clearField('link_url');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                  form.source_type === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
                }`}
              >
                <LinkIcon size={14} /> {t('projects:reports.modal.source.link')}
              </button>
            </div>
          </div>
          {form.source_type === 'upload' ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.file')}</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  clearField('file');
                }}
                className={reportModalFieldClass(!!fieldErrors.file, 'text-sm font-bold text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5')}
                aria-invalid={!!fieldErrors.file}
              />
              {fieldErrors.file && (
                <p className="text-xs font-semibold text-rose-600 ml-2">{fieldErrors.file}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.link')}</label>
              <input
                type="url"
                value={form.link_url || ''}
                onChange={(e) => {
                  setForm((f) => ({ ...f, link_url: e.target.value }));
                  clearField('link_url');
                }}
                className={reportModalFieldClass(!!fieldErrors.link_url, 'text-sm text-slate-700')}
                placeholder={t('projects:reports.modal.placeholders.link')}
                aria-invalid={!!fieldErrors.link_url}
              />
              {fieldErrors.link_url && (
                <p className="text-xs font-semibold text-rose-600 ml-2">{fieldErrors.link_url}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{t('projects:reports.modal.fields.tasks')}</label>
            <div
              className={`max-h-52 overflow-auto rounded-[24px] p-4 space-y-2 custom-scrollbar ${
                fieldErrors.task_ids
                  ? 'bg-rose-50/80 border-2 border-rose-300 ring-2 ring-rose-100'
                  : 'bg-slate-50 border border-slate-100'
              }`}
            >
              {loadingDoneTasks ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : doneTasks.length > 0 ? (
                doneTasks.map((task) => {
                  const checked = (form.task_ids || []).includes(task.id);
                  return (
                    <label key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((prev) => {
                            const current = prev.task_ids || [];
                            return {
                              ...prev,
                              task_ids: e.target.checked
                                ? [...current, task.id]
                                : current.filter((id) => id !== task.id),
                            };
                          });
                          clearField('task_ids');
                        }}
                        className="accent-cyan-600"
                      />
                      <span className="text-sm font-semibold text-slate-700">{task.title}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-xs italic text-slate-400">{t('projects:reports.modal.noDoneTasks')}</p>
              )}
            </div>
            {fieldErrors.task_ids && (
              <p className="text-xs font-semibold text-rose-600 ml-2">{fieldErrors.task_ids}</p>
            )}
          </div>
          <div className="flex gap-4 pt-4">
             <button type="button" onClick={onClose} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">{t('common:actions.cancel')}</button>
             <button type="submit" disabled={saving} className="flex-[2] py-4 bg-slate-900 text-white rounded-[24px] text-[11px] font-black uppercase tracking-widest hover:bg-cyan-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3">
               {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t('projects:reports.modal.submit')}
             </button>
          </div>
        </form>
      </motion.div>
    </div>
    ),
    document.body
  );
};

function WeeklyReportCommentsPanel({
  weeklyReportId,
  comments,
  loading,
  currentUserId,
  onRefresh,
}: {
  weeklyReportId: string;
  comments: WeeklyReportComment[];
  loading: boolean;
  currentUserId: string | undefined;
  onRefresh: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await weeklyReportCommentService.create(weeklyReportId, draft);
      setDraft('');
      await onRefresh();
      toast.success(t('projects:reports.comments.toasts.saved'));
    } catch { toast.error(t('projects:reports.comments.toasts.sendFailed')); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm flex flex-col h-[500px]">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
          <MessageSquare size={16} />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('projects:reports.comments.title')}</h4>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-6 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-cyan-500" /></div>
        ) : comments.length === 0 ? (
          <p className="text-center text-[10px] text-slate-300 font-bold uppercase italic py-10">{t('projects:reports.comments.empty')}</p>
        ) : comments.map((c) => (
          <div key={c.id} className={`flex flex-col ${c.user_id === currentUserId ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] px-5 py-4 rounded-3xl text-sm ${
              c.user_id === currentUserId ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-600 rounded-tl-none border border-slate-100'
            }`}>
              {c.content}
            </div>
            <div className="mt-2 flex items-center gap-2 px-1">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{c.user?.full_name}</span>
               <span className="text-[8px] text-slate-300 font-bold tracking-tighter italic">{c.created_at?.slice(11, 16)}</span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="relative pt-4 border-t border-slate-50">
        <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('projects:reports.comments.placeholder')}
          className="w-full bg-slate-50 border-none rounded-[24px] px-5 py-4 pr-16 text-sm text-slate-700 placeholder:text-slate-300 focus:ring-2 ring-indigo-100 outline-none resize-none" rows={2} />
        <button type="submit" disabled={saving || !draft.trim()} className="absolute right-3 bottom-6 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-cyan-600 transition-all disabled:opacity-30">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

// --- Logic Helpers (Giữ nguyên từ code gốc của bạn) ---

function buildComplianceWeekColumns(rows: ComplianceMatrixRow[]) {
  const map = new Map<string, { week_number: number; year: number }>();
  for (const row of rows) {
    for (const w of row.weeks) {
      const key = `${w.year}-${w.week_number}`;
      if (!map.has(key)) map.set(key, { week_number: w.week_number, year: w.year });
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[1].year - b[1].year || a[1].week_number - b[1].week_number)
    .map(([key, v]) => ({ key, week_number: v.week_number, year: v.year }));
}

function complianceCellStatus(row: ComplianceMatrixRow, week: number, year: number) {
  return row.weeks.find((w) => w.week_number === week && w.year === year)?.status ?? null;
}

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export default ReportsTab;