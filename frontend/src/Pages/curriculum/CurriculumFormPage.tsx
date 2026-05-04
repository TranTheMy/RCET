import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  Loader2, 
  Save, 
  FilePlus2, 
  Info, 
  Layers, 
  Link as LinkIcon, 
  Upload,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { curriculumService } from '../../services/curriculum.service';
import { categoryService } from '../../services/category.service';
import type { Category } from '../../types';
import { ROUTER } from '../../routes/router';
import { canEditCurriculumInForm, extractCurriculumFromEnvelope } from '../../utils/curriculum';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const meteorStyles = `
  @keyframes list-meteor-fx {
    0% { transform: translate(500px, -500px) rotate(-45deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(-45deg); opacity: 0; }
  }
  .list-meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to top, rgba(6, 182, 212, 0.85), transparent);
    animation: list-meteor-fx linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

type MeteorSpec = { id: number; top: string; right: string; animationDuration: string };

const CurriculumFormPage: React.FC = () => {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(editId);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authors, setAuthors] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingFilePath, setExistingFilePath] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };
  const inputClass = (field: string, base: string) =>
    `${base} ${fieldErrors[field] ? 'border-red-500/80 focus:border-red-400 focus:ring-red-500/20' : ''}`.trim();
  const scrollToFirstFieldError = (errors: Record<string, string>) => {
    const order = ['title', 'authors', 'category_id', 'description', 'file', 'pdf_url'];
    const first = order.find((f) => Boolean(errors[f])) || Object.keys(errors)[0];
    if (!first) return;
    const el = document.querySelector<HTMLElement>(`[data-error-field="${first}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus?.({ preventScroll: true });
  };

  useEffect(() => {
    categoryService.list().then((res) => setCategories(res.data?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${Math.random() * -10}%`,
          right: `${Math.random() * 80}%`,
          animationDuration: `${Math.random() * 2 + 2}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!editId) return;
    try {
      setLoading(true);
      const res = await curriculumService.getOne(editId);
      const d = extractCurriculumFromEnvelope(res);
      if (!d) {
        toast.error(t('curriculum:form.toasts.readFailed'));
        navigate(ROUTER.USER.CURRICULUM_MINE, { replace: true });
        return;
      }

      if (!canEditCurriculumInForm(d.status)) {
        /** Thường gặp khi bản đã Submit/duyệt nhưng URL /edit còn trong lịch sử (Back) — không spam toast, chỉ thoát entry cũ. */
        navigate(ROUTER.USER.CURRICULUM_MINE, { replace: true });
        return;
      }

      setTitle(d.title);
      setDescription(d.description ?? '');
      setAuthors(d.authors ?? '');
      setCategoryId(d.category_id);
      setPdfUrl(d.pdf_url ?? '');
      setExistingFilePath(d.file_path ?? '');
    } catch {
      toast.error(t('curriculum:form.toasts.fetchFailed'));
      navigate(ROUTER.USER.CURRICULUM_MINE, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [editId, navigate, t]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t('curriculum:form.errors.titleRequired');
    if (!categoryId) nextErrors.category_id = t('curriculum:form.errors.categoryRequired');
    if (!isEdit && !file && !pdfUrl.trim()) nextErrors.file = t('curriculum:form.errors.sourceRequired');
    if (pdfUrl.trim() && !/^https?:\/\//i.test(pdfUrl.trim())) {
      nextErrors.pdf_url = 'URL phải bắt đầu bằng http:// hoặc https://';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      scrollToFirstFieldError(nextErrors);
      toast.error(t('curriculum:form.errors.sourceRequired'));
      return;
    }

    setSaving(true);
    try {
      setFieldErrors({});
      const payload = {
        title: title.trim(),
        description: description || null,
        category_id: categoryId,
        authors: authors || undefined,
        pdf_url: pdfUrl.trim() || undefined,
        file: file ?? undefined,
      };

      if (isEdit && editId) {
        await curriculumService.update(editId, payload);
        toast.success(t('curriculum:form.toasts.updated'));
      } else {
        await curriculumService.create(payload);
        toast.success(t('curriculum:form.toasts.createdDraft'));
      }
      navigate(ROUTER.USER.CURRICULUM_MINE, { replace: true });
    } catch (err: unknown) {
      const backendErrors = (err as { response?: { data?: { errors?: Array<{ field?: string; message?: string }> } } })
        ?.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const next: Record<string, string> = {};
        for (const it of backendErrors) {
          if (it?.field && it?.message && !next[it.field]) {
            next[it.field] = translateApiMessage(t, it.message);
          }
        }
        setFieldErrors(next);
        window.setTimeout(() => scrollToFirstFieldError(next), 0);
      }
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('curriculum:form.toasts.saveFailed');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden">
        <style>{meteorStyles}</style>
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {meteors.map((m) => (
            <div
              key={m.id}
              className="list-meteor"
              style={{
                top: m.top,
                right: m.right,
                animationDuration: m.animationDuration,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/50">{t('curriculum:form.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pb-24 relative overflow-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* Background Decor + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px]" />
        {meteors.map((m) => (
          <div
            key={m.id}
            className="list-meteor"
            style={{
              top: m.top,
              right: m.right,
              animationDuration: m.animationDuration,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        <button
          type="button"
          onClick={() => navigate(ROUTER.USER.CURRICULUM_MINE, { replace: true })}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 mb-10 transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          {t('curriculum:form.actions.discardExit')}
        </button>

        <div className="flex items-center gap-4 mb-2">
           <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
              <FilePlus2 size={20} />
           </div>
           <h1 className="text-3xl font-[1000] text-white uppercase italic tracking-tighter">
             {isEdit ? t('curriculum:form.title.edit') : t('curriculum:form.title.create')}{' '}
             <span className="text-cyan-500">{t('curriculum:form.title.asset')}</span>
           </h1>
        </div>
        <p className="text-slate-500 text-sm mb-10 ml-14">
          {t('curriculum:form.draftHintPrefix')}{' '}
          <strong className="text-slate-300">{t('curriculum:form.draftHintDraft')}</strong>.{' '}
          {t('curriculum:form.draftHintSuffix')}
        </p>

        <form onSubmit={onSubmit} className="space-y-8 bg-[#0f172a]/60 rounded-[40px] border border-white/5 p-10 shadow-2xl backdrop-blur-md">
          {/* Section 1: Core Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
                <Info size={14} className="text-cyan-500" /> {t('curriculum:form.fields.title')}
              </label>
              <input
                data-error-field="title"
                value={title}
                onChange={(e) => {
                  clearFieldError('title');
                  setTitle(e.target.value);
                }}
                placeholder={t('curriculum:form.placeholders.title')}
                className={inputClass('title', 'w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all font-bold')}
              />
              <FieldError message={fieldErrors.title} />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
                <Sparkles size={14} className="text-cyan-500" /> {t('curriculum:form.fields.authors')}
              </label>
              <input
                data-error-field="authors"
                value={authors}
                onChange={(e) => {
                  clearFieldError('authors');
                  setAuthors(e.target.value);
                }}
                placeholder={t('curriculum:form.placeholders.authors')}
                className={inputClass('authors', 'w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all font-medium')}
              />
              <FieldError message={fieldErrors.authors} />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
                <Layers size={14} className="text-cyan-500" /> {t('curriculum:form.fields.category')}
              </label>
              <select
                data-error-field="category_id"
                value={categoryId}
                onChange={(e) => {
                  clearFieldError('category_id');
                  setCategoryId(e.target.value);
                }}
                className={inputClass('category_id', 'w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all font-medium appearance-none cursor-pointer')}
              >
                <option value="" className="bg-[#0f172a]">{t('curriculum:form.placeholders.category')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0f172a]">
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.category_id} />
            </div>
          </div>

          {/* Section 2: Description */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
              {t('curriculum:form.fields.description')}
            </label>
            <textarea
              data-error-field="description"
              value={description}
              onChange={(e) => {
                clearFieldError('description');
                setDescription(e.target.value);
              }}
              rows={4}
              placeholder={t('curriculum:form.placeholders.description')}
              className={inputClass('description', 'w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all font-medium resize-none')}
            />
            <FieldError message={fieldErrors.description} />
          </div>

          {/* Section 3: Asset Source */}
          <div className="pt-6 border-t border-white/5 space-y-6">
            <h3 className="text-[10px] font-[1000] uppercase tracking-[0.3em] text-cyan-500/50 italic">{t('curriculum:form.source.title')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
                  <Upload size={14} className="text-cyan-500" /> {t('curriculum:form.source.uploadLabel')}
                </label>
                <div className={`relative h-32 w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center hover:border-cyan-500/40 transition-all cursor-pointer overflow-hidden ${fieldErrors.file ? 'bg-red-500/10 border-red-500/80' : 'bg-[#020617] border-white/10'}`}>
                  <input
                    data-error-field="file"
                    type="file"
                    accept=".pdf,.doc,.docx,.rtf,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    onChange={(e) => {
                      clearFieldError('file');
                      setFile(e.target.files?.[0] ?? null);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <Upload className={`mb-2 ${file ? 'text-emerald-400' : 'text-slate-600'}`} size={24} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center px-4">
                    {file
                      ? file.name
                      : existingFilePath
                        ? t('curriculum:form.source.inheritingFile')
                        : t('curriculum:form.source.dropOrClick')}
                  </span>
                </div>
                <FieldError message={fieldErrors.file} />
                {!file && existingFilePath && (
                  <a
                    href={existingFilePath}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
                  >
                    {t('curriculum:form.source.openExisting')}
                  </a>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-[1000] uppercase tracking-[0.2em] text-slate-500 mb-3">
                  <LinkIcon size={14} className="text-cyan-500" /> {t('curriculum:form.source.urlLabel')}
                </label>
                <div className="flex flex-col h-32 justify-between">
                  <input
                    data-error-field="pdf_url"
                    value={pdfUrl}
                    onChange={(e) => {
                      clearFieldError('pdf_url');
                      setPdfUrl(e.target.value);
                    }}
                    placeholder={t('curriculum:form.placeholders.sourceUrl')}
                    className={inputClass('pdf_url', 'w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all font-mono text-xs')}
                  />
                  <FieldError message={fieldErrors.pdf_url} />
                  <p className="text-[9px] text-slate-600 italic leading-relaxed">
                    {t('curriculum:form.source.priorityHint')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap gap-4 pt-10">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-14 inline-flex items-center justify-center gap-3 rounded-2xl bg-cyan-500 text-[#020617] text-[11px] font-[1000] uppercase tracking-[0.2em] hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} strokeWidth={3} />}
              {isEdit ? t('curriculum:form.actions.commit') : t('curriculum:form.actions.initDraft')}
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTER.USER.CURRICULUM_MINE)}
              className="px-10 h-14 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              {t('common:actions.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CurriculumFormPage;

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="mt-2 text-xs font-semibold text-red-400">{message}</p>;
};