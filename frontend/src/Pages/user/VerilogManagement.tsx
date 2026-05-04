import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Cpu, Loader2, Pencil, Plus, RefreshCw, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { verilogService } from '../../services/verilog.service';
import type {
  CreateVerilogProblemRequest,
  CreateVerilogTestCaseRequest,
  VerilogLevel,
  VerilogProblem,
  VerilogProblemDetail,
  VerilogTestCase,
} from '../../types';

type VerilogProblemWithOwner = VerilogProblem & { owner?: { id: string; full_name: string } };

const LEVEL_COLORS: Record<VerilogLevel, string> = {
  easy: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  hard: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const inputDark =
  'w-full px-5 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10';
const labelDark = 'block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2';
const selectDark = `${inputDark} appearance-none cursor-pointer`;
const textareaDark = `${inputDark} resize-y`;
const monoAreaDark = `${inputDark} resize-y font-mono text-xs`;

const emptyProblemForm: CreateVerilogProblemRequest = {
  name: '',
  description: '',
  description_input: '',
  description_output: '',
  level: 'easy',
  tags: [],
  template_code: '',
  testbench: '',
  testbench_type: 'auto_generated',
  deadline: undefined,
  is_published: true,
};

const emptyTestCase: CreateVerilogTestCaseRequest = {
  name: '',
  type: 'SIM',
  grade: 10,
  input: '',
  expected_output: '',
  testbench_code: '',
  time_limit: 60,
  mem_limit: 128,
  order_index: 0,
};

const VerilogManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<VerilogProblem | null>(null);

  if (view === 'create') return <ProblemForm onBack={() => setView('list')} />;
  if (view === 'edit' && editing) {
    return (
      <ProblemForm
        problem={editing}
        onBack={() => {
          setEditing(null);
          setView('list');
        }}
      />
    );
  }

  return (
    <ProblemList
      title={t('verilog:management.title')}
      subtitle={t('verilog:management.subtitle')}
      onCreateNew={() => setView('create')}
      onEdit={(p) => {
        setEditing(p);
        setView('edit');
      }}
      onOpenProblem={(id) => navigate(`/verilog/${id}`)}
    />
  );
};

const ProblemList: React.FC<{
  title: string;
  subtitle: string;
  onCreateNew: () => void;
  onEdit: (p: VerilogProblem) => void;
  onOpenProblem: (id: string) => void;
}> = ({ title, subtitle, onCreateNew, onEdit, onOpenProblem }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<VerilogProblemWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      const res = await verilogService.listProblems(params);
      setItems(res.problems as unknown as VerilogProblemWithOwner[]);
      setTotalPages(res.pagination.totalPages);
    } catch {
      toast.error(t('verilog:management.toasts.fetchProblemsFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    try {
      await verilogService.deleteProblem(id);
      toast.success(t('verilog:management.toasts.deletedProblem'));
      setDeleteConfirm(null);
      void load();
    } catch {
      toast.error(t('verilog:management.toasts.deleteFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/4 -right-24 w-[460px] h-[460px] bg-indigo-500/10 rounded-full blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16 relative z-10">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-black text-[10px] uppercase tracking-[0.35em] mb-4">
              <Cpu size={14} aria-hidden />
              {t('verilog:management.kicker')}
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <BookOpen size={22} strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white">{title}</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium max-w-2xl border-l-2 border-cyan-500/30 pl-4 mt-3">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 shrink-0 px-6 py-3.5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-white hover:text-slate-900 transition-all duration-300 active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={2.5} /> {t('verilog:management.actions.createProblem')}
          </button>
        </header>

        <div className="bg-white/[0.03] backdrop-blur-xl rounded-[40px] border border-white/10 p-6 md:p-8 shadow-2xl">
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('verilog:management.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-medium">{t('verilog:management.empty')}</div>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-slate-500 uppercase tracking-widest font-black border-b border-white/10">
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">{t('verilog:management.table.title')}</th>
                    <th className="px-4 py-4 text-center">{t('verilog:management.table.level')}</th>
                    <th className="px-4 py-4 text-center">{t('verilog:management.table.score')}</th>
                    <th className="px-4 py-4 text-center">{t('verilog:management.table.submitted')}</th>
                    <th className="px-4 py-4">{t('verilog:management.table.owner')}</th>
                    <th className="px-4 py-4 text-center">{t('verilog:management.table.visibility')}</th>
                    <th className="px-4 py-4 text-center">{t('verilog:management.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-4 text-center font-mono text-slate-300">{p.logic_id}</td>
                      <td className="px-4 py-4 font-semibold text-slate-100 max-w-[260px] truncate">
                        <button type="button" onClick={() => onOpenProblem(p.id)} className="hover:text-cyan-400 transition-colors text-left w-full truncate">
                          {p.name}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold ${LEVEL_COLORS[p.level]}`}>
                          {t(`verilog:levels.${p.level}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-white">{p.total_grade ?? 0}</td>
                      <td className="px-4 py-4 text-center text-slate-500">{p.submitted_users ?? 0}</td>
                      <td className="px-4 py-4 text-slate-400">{p.owner?.full_name || t('verilog:management.unknown')}</td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.is_published
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-slate-700/40 text-slate-300 border border-slate-500/30'
                          }`}
                        >
                          {p.is_published ? t('verilog:management.visibility.public') : t('verilog:management.visibility.hidden')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(p)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 transition border border-transparent hover:border-cyan-500/20"
                          >
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === p.id ? (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => onDelete(p.id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-[9px] font-bold">
                                {t('verilog:management.actions.delete')}
                              </button>
                              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-white/10 text-slate-200 rounded-lg text-[9px] font-bold hover:bg-white/20">
                                {t('common:actions.cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(p.id)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition border border-transparent hover:border-rose-500/20"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-8 text-[11px] font-bold text-slate-500">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" /> {t('verilog:submissions.pagination.prev')}
              </button>
              <span className="text-slate-400 tabular-nums">{t('verilog:dashboard.pagination.page', { page, totalPages })}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              >
                {t('verilog:submissions.pagination.next')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProblemForm: React.FC<{ problem?: VerilogProblem; onBack: () => void }> = ({ problem, onBack }) => {
  const { t } = useTranslation();
  const isEdit = !!problem;
  const [form, setForm] = useState<CreateVerilogProblemRequest>(emptyProblemForm);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'testcases'>('basic');
  const [testcases, setTestcases] = useState<VerilogTestCase[]>([]);
  const [tcLoading, setTcLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingTestbenchFile, setPendingTestbenchFile] = useState<File | null>(null);
  const [syncingSubtests, setSyncingSubtests] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => form.tags || [], [form.tags]);

  const loadTestcases = useCallback(async () => {
    if (!problem?.id) return;
    setTcLoading(true);
    try {
      const res = await verilogService.listTestCases(problem.id);
      if (res.success) setTestcases(res.data as unknown as VerilogTestCase[]);
    } finally {
      setTcLoading(false);
    }
  }, [problem?.id]);

  useEffect(() => {
    if (!problem) return;
    setForm({
      name: problem.name,
      description: problem.description || '',
      description_input: problem.description_input || '',
      description_output: problem.description_output || '',
      level: problem.level,
      tags: problem.tags || [],
      template_code: problem.template_code || '',
      testbench: '',
      testbench_type: problem.testbench_type || 'auto_generated',
      deadline: problem.deadline ? problem.deadline.slice(0, 10) : undefined,
      is_published: problem.is_published,
    });
    void loadTestcases();
  }, [problem, loadTestcases]);

  useEffect(() => {
    if (!problem?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await verilogService.getProblem(problem.id);
        if (cancelled) return;
        const d = full as VerilogProblemDetail;
        setForm((prev) => ({
          ...prev,
          testbench: d.testbench ?? prev.testbench,
          testbench_type: (d.testbench_type as 'auto_generated' | 'custom_uploaded') || prev.testbench_type,
        }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [problem?.id]);

  const handleSyncSubtestsFromTb = async () => {
    if (!problem?.id) return;
    if (form.testbench_type !== 'custom_uploaded') {
      toast.error(t('verilog:management.toasts.syncSubtestsWrongType'));
      return;
    }
    setSyncingSubtests(true);
    try {
      await verilogService.updateProblem(problem.id, {
        testbench: form.testbench,
        testbench_type: 'custom_uploaded',
      });
      const out = await verilogService.syncSubtestsFromTestbench(problem.id);
      toast.success(out.message || t('verilog:management.toasts.syncSubtestsOk'));
      await loadTestcases();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('verilog:management.toasts.syncSubtestsFailed'));
    } finally {
      setSyncingSubtests(false);
    }
  };

  const addTag = () => {
    const v = tagInput.trim();
    if (!v || tags.includes(v)) return;
    setForm({ ...form, tags: [...tags, v] });
    setTagInput('');
  };

  const removeTag = (tag: string) => setForm({ ...form, tags: tags.filter((x) => x !== tag) });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('verilog:management.toasts.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (isEdit && problem) {
        await verilogService.updateProblem(problem.id, form);
        toast.success(t('verilog:management.toasts.updatedProblem'));
      } else {
        const created = await verilogService.createProblem(form);
        // If user selected a testbench file during "create", we only read it into textarea.
        // After we have the created problem id, we can upload it so backend persists it to src/testbenches/.
        if (created?.success && pendingTestbenchFile) {
          try {
            setUploading(true);
            await verilogService.uploadTestbench((created.data as unknown as VerilogProblem).id, pendingTestbenchFile);
            toast.success(t('verilog:management.toasts.uploadedTestbench', { name: pendingTestbenchFile.name }));
          } catch {
            toast.error(t('verilog:management.toasts.uploadFailed'));
          } finally {
            setUploading(false);
            setPendingTestbenchFile(null);
          }
        }
        toast.success(t('verilog:management.toasts.createdProblem'));
      }
      onBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('verilog:management.toasts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadTestbench = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isEdit || !problem) {
      setPendingTestbenchFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm({ ...form, testbench: (ev.target?.result as string) || '', testbench_type: 'custom_uploaded' });
        toast.success(t('verilog:management.toasts.readFile', { name: file.name }));
      };
      reader.readAsText(file);
      return;
    }

    setUploading(true);
    try {
      await verilogService.uploadTestbench(problem.id, file);
      toast.success(t('verilog:management.toasts.uploadedTestbench', { name: file.name }));
      setForm({ ...form, testbench_type: 'custom_uploaded' });
    } catch {
      toast.error(t('verilog:management.toasts.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canEditTests = isEdit && !!problem;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 -right-24 w-[480px] h-[480px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-12 relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors shrink-0"
            >
              <ArrowLeft size={16} /> {t('documents:back')}
            </button>
            <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white truncate">
              {isEdit ? t('verilog:management.form.editTitle') : t('verilog:management.form.createTitle')}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 shrink-0 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-white hover:text-slate-900 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('verilog:management.actions.save')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-white/5 border border-white/10 mb-8 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'basic'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            {t('verilog:management.tabs.info')}
          </button>
          {canEditTests && (
            <button
              type="button"
              onClick={() => setActiveTab('testcases')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'testcases'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {t('verilog:management.tabs.tests', { count: testcases.length })}
            </button>
          )}
        </div>

        {activeTab === 'basic' ? (
          <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-10 space-y-6 shadow-2xl">
            <div>
              <label className={labelDark}>{t('verilog:management.form.fields.name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputDark}
              />
            </div>

            <div>
              <label className={labelDark}>{t('verilog:management.form.fields.description')}</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
                className={textareaDark}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.inputDesc')}</label>
                <textarea
                  value={form.description_input || ''}
                  onChange={(e) => setForm({ ...form, description_input: e.target.value })}
                  rows={3}
                  className={monoAreaDark}
                />
              </div>
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.outputDesc')}</label>
                <textarea
                  value={form.description_output || ''}
                  onChange={(e) => setForm({ ...form, description_output: e.target.value })}
                  rows={3}
                  className={monoAreaDark}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.level')}</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value as VerilogLevel })}
                  className={selectDark}
                >
                  <option value="easy" className="bg-[#020617]">{t('verilog:levels.easy')}</option>
                  <option value="medium" className="bg-[#020617]">{t('verilog:levels.medium')}</option>
                  <option value="hard" className="bg-[#020617]">{t('verilog:levels.hard')}</option>
                </select>
              </div>
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.testbenchType')}</label>
                <select
                  value={form.testbench_type}
                  onChange={(e) => setForm({ ...form, testbench_type: e.target.value as 'auto_generated' | 'custom_uploaded' })}
                  className={selectDark}
                >
                  <option value="auto_generated" className="bg-[#020617]">{t('verilog:management.form.testbenchTypes.auto')}</option>
                  <option value="custom_uploaded" className="bg-[#020617]">{t('verilog:management.form.testbenchTypes.custom')}</option>
                </select>
              </div>
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.deadline')}</label>
                <input
                  type="date"
                  value={form.deadline || ''}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value || undefined })}
                  className={inputDark}
                />
              </div>
            </div>

            <div>
              <label className={labelDark}>{t('verilog:management.form.fields.tags')}</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-slate-200"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-slate-500 hover:text-rose-400 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder={t('verilog:management.form.tagPlaceholder')}
                  className={`${inputDark} flex-1`}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-colors"
                >
                  {t('verilog:management.actions.add')}
                </button>
              </div>
            </div>

            <div>
              <label className={labelDark}>{t('verilog:management.form.fields.templateCode')}</label>
              <textarea
                value={form.template_code || ''}
                onChange={(e) => setForm({ ...form, template_code: e.target.value })}
                rows={8}
                className={monoAreaDark}
              />
            </div>

            {form.testbench_type === 'custom_uploaded' && (
              <div>
                <label className={labelDark}>{t('verilog:management.form.fields.testbenchCode')}</label>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <input ref={fileInputRef} type="file" accept=".v,.sv,.vh,.svh,.txt" onChange={handleUploadTestbench} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? t('verilog:management.form.uploading') : t('verilog:management.form.uploadTestbench')}
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium">{t('verilog:management.form.orPaste')}</span>
                  {canEditTests && (
                    <button
                      type="button"
                      onClick={() => void handleSyncSubtestsFromTb()}
                      disabled={syncingSubtests || uploading}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-200 hover:bg-indigo-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none ml-auto"
                      title={t('verilog:management.form.syncSubtestsHint')}
                    >
                      {syncingSubtests ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {t('verilog:management.form.syncSubtests')}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">{t('verilog:management.form.syncSubtestsHint')}</p>
                <textarea
                  value={form.testbench || ''}
                  onChange={(e) => setForm({ ...form, testbench: e.target.value })}
                  rows={8}
                  className={monoAreaDark}
                  placeholder={t('verilog:management.form.testbenchPlaceholder')}
                />
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/30"
              />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{t('verilog:management.form.fields.published')}</span>
            </label>
          </div>
        ) : (
          <TestCaseManager
            problemId={problem!.id}
            testcases={testcases}
            loading={tcLoading}
            onReload={loadTestcases}
            showSyncFromTestbench={canEditTests && form.testbench_type === 'custom_uploaded'}
            onSyncFromTestbench={() => void handleSyncSubtestsFromTb()}
            syncingSubtests={syncingSubtests}
          />
        )}
      </div>
    </div>
  );
};

const TestCaseManager: React.FC<{
  problemId: string;
  testcases: VerilogTestCase[];
  loading: boolean;
  onReload: () => void;
  showSyncFromTestbench?: boolean;
  onSyncFromTestbench?: () => void;
  syncingSubtests?: boolean;
}> = ({ problemId, testcases, loading, onReload, showSyncFromTestbench, onSyncFromTestbench, syncingSubtests }) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingTc, setEditingTc] = useState<VerilogTestCase | null>(null);
  const [form, setForm] = useState<CreateVerilogTestCaseRequest>(emptyTestCase);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreate = () => {
    setEditingTc(null);
    setForm({ ...emptyTestCase, order_index: testcases.length });
    setShowForm(true);
  };

  const openEdit = (tc: VerilogTestCase) => {
    setEditingTc(tc);
    setForm({
      name: tc.name,
      type: tc.type,
      grade: tc.grade,
      input: tc.input || '',
      expected_output: tc.expected_output || '',
      testbench_code: tc.testbench_code || '',
      time_limit: tc.time_limit,
      mem_limit: tc.mem_limit,
      order_index: tc.order_index,
    });
    setShowForm(true);
  };

  const handleSaveTc = async () => {
    setSaving(true);
    try {
      if (editingTc) {
        await verilogService.updateTestCase(problemId, editingTc.id, form);
        toast.success(t('verilog:management.toasts.updatedTestcase'));
      } else {
        await verilogService.createTestCase(problemId, form);
        toast.success(t('verilog:management.toasts.createdTestcase'));
      }
      setShowForm(false);
      onReload();
    } catch {
      toast.error(t('verilog:management.toasts.testcaseSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTc = async (tcId: string) => {
    try {
      await verilogService.deleteTestCase(problemId, tcId);
      toast.success(t('verilog:management.toasts.deletedTestcase'));
      setDeleteConfirm(null);
      onReload();
    } catch {
      toast.error(t('verilog:management.toasts.deleteFailed'));
    }
  };

  return (
    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('verilog:management.tests.title')}</h2>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-colors w-fit"
        >
          <Plus size={14} /> {t('verilog:management.tests.add')}
        </button>
      </div>

      {showSyncFromTestbench && onSyncFromTestbench && (
        <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-4 text-sm text-slate-200">
          <p className="text-[11px] font-semibold text-indigo-200 mb-2">{t('verilog:management.tests.syncBannerTitle')}</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{t('verilog:management.tests.syncBannerBody')}</p>
          <button
            type="button"
            onClick={onSyncFromTestbench}
            disabled={syncingSubtests}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-400/50 bg-indigo-600/30 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500/40 transition-colors disabled:opacity-50"
          >
            {syncingSubtests ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t('verilog:management.form.syncSubtests')}
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-black/30 border border-white/10 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">
              {editingTc ? t('verilog:management.tests.edit') : t('verilog:management.tests.create')} {t('verilog:management.tests.testcase')}
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.name')}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputDark} />
            </div>
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.points')}</label>
              <input
                type="number"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: parseInt(e.target.value) || 0 })}
                className={inputDark}
              />
            </div>
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.order')}</label>
              <input
                type="number"
                value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
                className={inputDark}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.input')}</label>
              <textarea value={form.input || ''} onChange={(e) => setForm({ ...form, input: e.target.value })} rows={2} className={monoAreaDark} />
            </div>
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.expected')}</label>
              <textarea value={form.expected_output || ''} onChange={(e) => setForm({ ...form, expected_output: e.target.value })} rows={2} className={monoAreaDark} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.type')}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'SIM' | 'SYNTHSIM' })} className={selectDark}>
                <option value="SIM" className="bg-[#020617]">SIM</option>
                <option value="SYNTHSIM" className="bg-[#020617]">SYNTHSIM</option>
              </select>
            </div>
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.timeLimit')}</label>
              <input
                type="number"
                value={form.time_limit}
                onChange={(e) => setForm({ ...form, time_limit: parseInt(e.target.value) || 60 })}
                className={inputDark}
              />
            </div>
            <div>
              <label className={labelDark}>{t('verilog:management.tests.fields.memLimit')}</label>
              <input
                type="number"
                value={form.mem_limit}
                onChange={(e) => setForm({ ...form, mem_limit: parseInt(e.target.value) || 128 })}
                className={inputDark}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/20">
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveTc}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} {t('verilog:management.actions.save')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : testcases.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm font-medium">{t('verilog:management.tests.empty')}</div>
      ) : (
        <div className="space-y-3">
          {testcases.map((tc, i) => (
            <div
              key={tc.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded-lg border border-white/10">#{i + 1}</span>
                  <span className="text-sm font-semibold text-white">{tc.name || t('verilog:management.tests.testN', { n: i + 1 })}</span>
                  <span className="text-[10px] bg-slate-100/10 text-cyan-300 px-2 py-0.5 rounded-lg border border-white/10">{tc.type}</span>
                  <span className="text-[10px] font-bold text-indigo-300">{t('verilog:problemDetail.points', { points: tc.grade })}</span>
                  {tc.subtest_key ? (
                    <span className="text-[10px] bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-lg border border-amber-500/25 font-mono">
                      sub:{tc.subtest_key}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-mono">
                  {tc.input && <span>{t('verilog:management.tests.inputPrefix', { input: tc.input })}</span>}
                  {tc.expected_output && <span>{t('verilog:management.tests.expectedPrefix', { expected: tc.expected_output })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => openEdit(tc)} className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 transition border border-transparent hover:border-cyan-500/20">
                  <Pencil size={14} />
                </button>
                {deleteConfirm === tc.id ? (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleDeleteTc(tc.id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-[9px] font-bold">
                      {t('verilog:management.actions.delete')}
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-white/10 text-slate-200 rounded-lg text-[9px] font-bold hover:bg-white/20">
                      {t('common:actions.cancel')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeleteConfirm(tc.id)} className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition border border-transparent hover:border-rose-500/20">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VerilogManagement;
